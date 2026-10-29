import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {addRelease,updateRelease,listReleases,saveImportedMovieDetails} from '../lib/store.ts';
import {groupMovieReleases,preferredRelease} from '../lib/library.ts';
import {mergeImportedDetails} from '../lib/linkify.ts';
import {validateReleasePresentation} from '../lib/release-settings.ts';
const links=[{label:'Mirror',url:'https://example.com/fixture'}];
beforeEach(async()=>{
 process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-presentation-'));
 for(const id of ['older','newer','draft','other']){
  await addRelease({id,filename:'Presentation.2024.'+id+'.1080p.IMAX.mkv',title:'Presentation Test',year:2024,category:'IMAX',resolution:'1080p',size:'1 GB'});
  await saveImportedMovieDetails(id,{tmdbId:id==='other'?2:1,genres:'Action',synopsis:'Saved movie content'});
  await updateRelease(id,'Presentation Test',links,id==='draft'?'draft':'published');
 }
});

test('admin-selected main release and movie genres persist across related encodes only',async()=>{
 assert.equal(await updateRelease('older','Presentation Test',links,'published',{genres:'Drama, Adventure'},{category:'Open Matte',primaryReleaseId:'older'}),true);
 const rows=await listReleases();const related=rows.filter(row=>row.details?.tmdbId===1);
 assert.equal(rows.find(row=>row.id==='older')?.category,'Open Matte');
 assert.ok(related.every(row=>row.details?.primaryReleaseId==='older'&&row.details?.genres==='Drama, Adventure'&&row.details?.genresEdited));
 assert.equal(rows.find(row=>row.id==='other')?.details?.primaryReleaseId,undefined);
 assert.equal(rows.find(row=>row.id==='other')?.details?.genres,'Action');
 assert.equal(groupMovieReleases(rows).find(group=>group.movie.details?.tmdbId===1)?.movie.category,'Open Matte');
 assert.equal(preferredRelease(related)?.id,'older');
});

test('invalid cross-movie or draft main selections roll back all changes',async()=>{
 for(const id of ['other','draft','missing'])await assert.rejects(()=>updateRelease('older','Changed title',links,'published',{genres:'Wrong'},{category:'35mm',primaryReleaseId:id}),/published main release from this movie/);
 const rows=await listReleases();assert.equal(rows.find(row=>row.id==='older')?.title,'Presentation Test');assert.equal(rows.find(row=>row.id==='older')?.category,'IMAX');
 assert.ok(rows.every(row=>row.details?.genres==='Action'&&row.details?.primaryReleaseId===undefined));
});

test('metadata refresh preserves main release and manually cleared movie genres',async()=>{
 await updateRelease('older','Presentation Test',links,'published',{genres:''},{primaryReleaseId:'newer'});
 const row=(await listReleases()).find(row=>row.id==='older')!;
 assert.equal(mergeImportedDetails(row.details!,{genres:'Imported genre'}).genres,'');
 await saveImportedMovieDetails('older',{tmdbId:1,genres:'Imported genre',synopsis:'Refreshed metadata'});
 const refreshed=(await listReleases()).find(row=>row.id==='older')!;
 assert.equal(refreshed.details?.primaryReleaseId,'newer');assert.equal(refreshed.details?.genres,'');assert.equal(refreshed.details?.genresEdited,true);assert.equal(refreshed.details?.synopsis,'Refreshed metadata');
});

test('unpublished main releases fall back and Automatic clears the preference',async()=>{
 await updateRelease('older','Presentation Test',links,'published',undefined,{primaryReleaseId:'older'});
 await updateRelease('older','Presentation Test',links,'draft');
 const published=await listReleases(true);assert.equal(preferredRelease(published.filter(row=>row.details?.tmdbId===1)),undefined);
 assert.equal(groupMovieReleases(published).find(group=>group.movie.details?.tmdbId===1)?.movie.id,'newer');
 await updateRelease('newer','Presentation Test',links,'published',undefined,{primaryReleaseId:null});
 assert.ok((await listReleases()).filter(row=>row.details?.tmdbId===1).every(row=>row.details?.primaryReleaseId===undefined));
});

test('custom formats are validated and survive reads independently of filename tags',async()=>{
 await updateRelease('older','Presentation Test',links,'published',undefined,{category:' Custom edition '});
 assert.equal((await listReleases()).find(row=>row.id==='older')?.category,'Custom edition');
 for(const category of ['', 'x'.repeat(61),'Open\nMatte'])assert.throws(()=>validateReleasePresentation({category}));
 assert.throws(()=>validateReleasePresentation({primaryReleaseId:''}));
 assert.equal(validateReleasePresentation({category:'open   matte'}).category,'Open Matte');
});

test('choosing a main encode keeps an unidentified movie URL stable',()=>{
 const first={id:'first',title:'Unknown Film',year:2024,status:'published',category:'Other',created_at:'2020-01-01',details:{primaryReleaseId:'second'}};
 const second={...first,id:'second',category:'Open Matte',created_at:'2025-01-01'};
 const group=groupMovieReleases([second,first])[0];
 assert.equal(group.movie.id,'first');assert.equal(group.movie.category,'Open Matte');assert.equal(preferredRelease(group.releases)?.id,'second');
});

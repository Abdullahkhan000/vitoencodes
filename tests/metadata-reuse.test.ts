import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {addRelease,listReleases,setReleaseMetadata,updateRelease} from '../lib/store.ts';
import {enrichReleases,lookupMovieMetadata} from '../lib/enrichment.ts';
import {hasSavedMovieInfo} from '../lib/metadata-state.ts';
const row=(id:string)=>({id,filename:'Dune.2021.'+id+'.VITO.mkv',title:'Dune',year:2021,category:'IMAX',resolution:'1080p',size:'1 GB'});
const isolate=()=>{process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-reuse-'));};
test('already saved movie information skips lookups even across provider changes',async()=>{
 isolate();(await addRelease(row('existing')));(await setReleaseMetadata('existing','Dune',2021,'/posters/existing.jpg','original'));(await updateRelease('existing','Dune',[],'draft',{synopsis:'Saved about',genres:'Adventure',metadataProvider:'Older provider'}));
 let calls=0;const result=await enrichReleases(['existing'],{lookup:async()=>{calls++;throw new Error('Must not request metadata');}});
 assert.equal(calls,0);assert.equal(result.results[0].status,'cached');assert.equal((await listReleases())[0].poster,'/posters/existing.jpg');
 assert.equal(hasSavedMovieInfo({details:{metadataFetchedAt:'2026-10-27T00:00:00Z'}}),true,'successful imports are not repeatedly queried for optional missing provider fields');
});
test('filling missing about preserves an already added poster',async()=>{
 isolate();(await addRelease(row('partial')));(await setReleaseMetadata('partial','Dune',2021,'/posters/existing.jpg','original'));
 const result=await enrichReleases(['partial'],{lookup:async()=>({poster:'https://image.tmdb.org/t/p/w780/new.jpg',synopsis:'New about',genres:'Science Fiction',metadataFetchedAt:'2026-10-27T00:00:00Z',metadataProvider:'TMDB'})});
 const saved=(await listReleases())[0];assert.equal(result.updated,1);assert.equal(saved.poster,'/posters/existing.jpg');assert.equal(saved.details?.synopsis,'New about');
 let calls=0;await enrichReleases(['partial'],{lookup:async()=>{calls++;throw new Error('Should be skipped');}});assert.equal(calls,0);
});
test('another encode reuses saved movie data without inheriting encode screenshots',async()=>{
 isolate();(await addRelease(row('original')));(await setReleaseMetadata('original','Dune',2021,'/posters/existing.jpg','original'));(await updateRelease('original','Dune',[],'draft',{synopsis:'Saved about',genres:'Adventure',screenshots:['https://example.com/encode-specific.jpg'],trailer:'https://youtu.be/dQw4w9WgXcQ'}));(await addRelease(row('alternate')));
 const info=await lookupMovieMetadata('Dune',2021);assert.equal(info.poster,'/posters/existing.jpg');assert.equal(info.synopsis,'Saved about');assert.equal(info.screenshots,undefined);
 await enrichReleases(['alternate']);const saved=(await listReleases()).find(r=>r.id==='alternate')!;assert.equal(saved.poster,'/posters/existing.jpg');assert.equal(saved.details?.synopsis,'Saved about');assert.equal(saved.details?.screenshots,undefined);
});

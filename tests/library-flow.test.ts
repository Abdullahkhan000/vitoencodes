import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseBulkLinks} from '../lib/bulk-links.ts';
import {importBulkLinks} from '../lib/bulk-store.ts';
import {listReleases,updateRelease,cacheMovieMetadata,readMovieMetadataCache} from '../lib/store.ts';
import {enrichReleases,previewMovieMetadata} from '../lib/enrichment.ts';
import {mapLinkifyDetails,LinkifyError} from '../lib/linkify.ts';
import {availableCollections,collectionMovies,genreRecommendations,movieCollection,sameMovie} from '../lib/library.ts';
import type {Release} from '../lib/store.ts';
function isolated(){process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-full-flow-'));}
const provider=(id:number,title:string,year:number,collection=true)=>mapLinkifyDetails({id,title,release_date:year+'-01-01',overview:'A verified movie overview.',runtime:150,genres:[{name:'Science Fiction'},{name:'Adventure'}],poster_path:'/poster-'+id+'.jpg',belongs_to_collection:collection?{id:123,name:'Dune Collection',poster_path:'/dune.jpg'}:null,external_ids:{imdb_id:'tt1234567'}},id,year);
test('bulk preview and save carry Linkify poster, about, genres and collection into real records',async()=>{
 isolated();const text='Dune.2021.1080p.BluRay.VITO.mkv - 5.94 GB\nhttps://hubdrive.bar/file/7921763673\nDune.Part.Two.2024.1080p.BluRay.VITOENCODES.mkv - 6.41 GB\nhttps://hubdrive.bar/file/2494876504';
 const entries=parseBulkLinks(text);let calls=0;
 const lookup=async(title:string,year:number|null)=>{calls++;return provider(year===2021?1:2,title,year!);};
 const preview=await previewMovieMetadata(entries,[],lookup);
 assert.equal(preview.length,2);assert.ok(preview.every(r=>r.poster.includes('image.tmdb.org')&&r.details.synopsis&&r.details.genres&&r.details.collection?.name==='Dune Collection'));
 assert.equal((await listReleases()).length,0,'preview never creates releases');
 const imported=(await importBulkLinks(entries));const result=await enrichReleases(imported.ids,{lookup});
 assert.equal(result.updated,2);const rows=(await listReleases());assert.ok(rows.every(r=>r.poster?.includes('image.tmdb.org')&&r.details?.synopsis&&r.status==='draft'&&r.links.length===1));
 assert.equal(availableCollections(rows).length,0,'draft collections stay private');
 for(const row of rows)(await updateRelease(row.id,row.title,row.links,'published'));
 const published=(await listReleases(true));assert.equal(availableCollections(published)[0].count,2);assert.equal(collectionMovies(published[0],published).length,2);
 assert.equal((await importBulkLinks(entries)).unchanged,2);await enrichReleases(imported.ids,{lookup});assert.equal(calls,4,'complete metadata is reused on repeated save');
});
test('provider outage leaves saved links intact and marks every missing poster/info as pending',async()=>{
 isolated();const entries=parseBulkLinks('Movie.2024.1080p.mkv - 1 GB\nhttps://hubdrive.bar/file/111\nOther.2023.1080p.mkv - 2 GB\nhttps://hubdrive.bar/file/222');let calls=0;
 const failed=async()=>{calls++;throw new LinkifyError('Provider unavailable',503);};
 const preview=await previewMovieMetadata(entries,[],failed);assert.equal(calls,1);assert.ok(preview.every(r=>r.metadataStatus==='pending'));
 const imported=(await importBulkLinks(entries));const result=await enrichReleases(imported.ids,{lookup:failed});assert.equal(result.pending,2);assert.equal(calls,2);assert.equal((await listReleases()).length,2);assert.ok((await listReleases()).every(r=>r.links.length===1&&r.status==='draft'));
});
test('metadata cache is persistent and expires independently from stored movie content',async ()=>{
 isolated();(await cacheMovieMetadata('dune|2021',provider(1,'Dune',2021)));assert.equal((await readMovieMetadataCache('dune|2021'))?.collection?.name,'Dune Collection');assert.equal((await readMovieMetadataCache('dune|2021',0)),null);
});
const row=(id:string,title:string,year:number,genres:string,status='published',collection?:{id:number;name:string}):Release=>({id,title,year,status,filename:title+'.mkv',category:'IMAX',resolution:'1080p',size:'1 GB',links:[],details:{genres,...(collection?{collection}:{})}});
test('recommendations use shared genres, exclude self, editions, drafts and unrelated films',()=>{
 const dune=row('dune','Dune',2021,'Science Fiction, Adventure'),sequel=row('dune2','Dune: Part Two',2024,'Science Fiction, Adventure'),match=row('match','Another Film',2020,'Science Fiction, Adventure'),partial=row('partial','A Third Film',2023,'Adventure'),random=row('random','Unrelated Film',2022,'Comedy'),draft=row('draft','Private Film',2025,'Science Fiction','draft'),alternate={...match,id:'alternate'};
 assert.deepEqual(genreRecommendations(dune,[dune,sequel,match,partial,random,draft,alternate]).map(r=>r.title),['Another Film','A Third Film']);
 assert.deepEqual(genreRecommendations({...dune,details:{}},[match,random]),[]);
 assert.deepEqual(collectionMovies(dune,[sequel,dune,{...dune,id:'alternate'},draft]).map(r=>r.title),['Dune','Dune: Part Two']);
 assert.equal(movieCollection(row('old','Dune',1984,'')),null);assert.equal(movieCollection(row('fake','Dune Something Else',2024,'')),null);
 assert.equal(sameMovie({...dune,details:{tmdbId:1}},dune),true);
});
test('official provider collections automatically group franchises without a guessed title prefix',()=>{
 const a=row('a','Different Titles',2001,'Action','published',{id:44,name:'Official Saga Collection'}),b=row('b','A Sequel',2005,'Action','published',{id:44,name:'Official Saga Collection'}),hidden=row('hidden','Private Sequel',2009,'Action','draft',{id:44,name:'Official Saga Collection'});
 assert.deepEqual(collectionMovies(a,[b,hidden,a]).map(r=>r.id),['a','b']);assert.equal(availableCollections([a,b,hidden])[0].count,2);
});

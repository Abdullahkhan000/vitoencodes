import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paginate,releaseSearchScore} from '../lib/catalog-search.ts';
const dune={title:'Dune: Part Two',filename:'Dune.Part.Two.2024.2160p.IMAX.BluRay.x265.10Bit.VITO.mkv',year:2024,category:'IMAX',resolution:'2160p',size:'6.41 GB',details:{genres:'Adventure, Science Fiction',director:'Denis Villeneuve',cast:'Timothee Chalamet',imdbId:'tt15239678',collection:{id:1,name:'Dune Collection'}}};
test('search combines unordered title and encode terms, punctuation, aliases and metadata',()=>{
 for(const query of ['2024 dune','Dune.Part.Two','dune 4k bluray','HEVC IMAX','x265 2160p','science fiction','villeneuve','chalamet','tt15239678','VITO 10bit'])assert.ok(releaseSearchScore(dune,query)>0,query);
 assert.equal(releaseSearchScore(dune,'dune 2021'),0);assert.equal(releaseSearchScore(dune,'dune HDTV'),0);assert.equal(releaseSearchScore(dune,'avatar'),0);
});
test('search supports accent-insensitive prefixes and small typos with exact matches ranked first',()=>{
 assert.ok(releaseSearchScore(dune,'dun')>0);assert.ok(releaseSearchScore(dune,'villeneuv')>0);
 assert.ok(releaseSearchScore({title:'Amélie'},'amelie')>0);
 assert.ok(releaseSearchScore({title:'Avatar'},'avatr')>0);
 assert.ok(releaseSearchScore({title:'Avatar'},'avatar')>releaseSearchScore({title:'Avatar The Way of Water'},'avatar'));
 assert.equal(releaseSearchScore(dune,'202'),0);assert.equal(releaseSearchScore(dune,'2025'),0);
});
test('pagination covers every item once and clamps stale pages, empty results and invalid inputs',()=>{
 const items=Array.from({length:73},(_,i)=>i);const pages=[1,2,3,4].flatMap(page=>paginate(items,page,24).items);assert.deepEqual(pages,items);
 const last=paginate(items,99,24);assert.equal(last.page,4);assert.equal(last.start,73);assert.equal(last.end,73);
 assert.deepEqual(paginate([],9,24),{items:[],page:1,totalPages:1,start:0,end:0,total:0});
 assert.equal(paginate(items,-3,12).page,1);assert.equal(paginate(items,NaN,Infinity).items.length,24);
});

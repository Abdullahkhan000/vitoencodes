import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paginate,releaseSearchScore,createMovieSearch} from '../lib/catalog-search.ts';
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

test('public title search excludes cast, filename and unrelated shared-word matches',()=>{
 const rows=[
  {title:'Iron Man',details:{collection:{id:1,name:'Iron Man Collection'}}},
  {title:'Iron Man 2',details:{collection:{id:1,name:'Iron Man Collection'}}},
  {title:'Iron Man: A Different Story',details:{collection:{id:99,name:'Unrelated Collection'}}},
  {title:'Other Movie',filename:'Iron.Man.1080p.mkv',details:{cast:'Iron Man',director:'Iron Man'}},
  {title:'Ant-Man',details:{collection:{id:2,name:'Ant-Man Collection'}}},
 ];
 const score=createMovieSearch(rows,'Iron Man');
 assert.deepEqual(rows.filter(row=>score(row)>0).map(row=>row.title),['Iron Man','Iron Man 2']);
 assert.ok(score(rows[0])>score(rows[1]));
});

test('public search includes verified sequels even when their titles have different words',()=>{
 const collection={id:9485,name:'The Fast and the Furious Collection'};
 const rows=[{title:'Fast Five',details:{collection}},{title:'The Fate of the Furious',details:{collection}},{title:'Five Feet Apart'},{title:'Fast Food Nation'}];
 const score=createMovieSearch(rows,'Fast Five');
 assert.deepEqual(rows.filter(row=>score(row)>0).map(row=>row.title),['Fast Five','The Fate of the Furious']);
 assert.ok(score(rows[0])>score(rows[1]));
});

test('standalone exact titles do not infer a series from shared words',()=>{
 const rows=[{title:'Life'},{title:'Life of Pi'},{title:'The Secret Life of Walter Mitty'},{title:'Other',details:{cast:'Life'}}];
 const score=createMovieSearch(rows,'life');
 assert.deepEqual(rows.filter(row=>score(row)>0).map(row=>row.title),['Life']);
});

test('verified series names support punctuation, compact names and collection qualifiers',()=>{
 const rows=[
  {title:'Spider-Man 2',details:{collection:{id:556,name:'Spider-Man Collection'}}},
  {title:'Spider-Man: No Way Home',details:{collection:{id:531241,name:'Spider-Man (MCU) Collection'}}},
  {title:'Along Came a Spider'},
  {title:'Man of Steel'},
 ];
 for(const query of ['Spider-Man','spider man','spiderman']){
  const score=createMovieSearch(rows,query);
  assert.deepEqual(rows.filter(row=>score(row)>0).map(row=>row.title),['Spider-Man 2','Spider-Man: No Way Home'],query);
 }
});

test('public title matching prefers complete words over accidental prefixes and typos',()=>{
 const rows=[{title:'Thor: Ragnarok'},{title:'Thorn'},{title:'Other',details:{cast:'Thor'}}];
 const score=createMovieSearch(rows,'thor');
 assert.deepEqual(rows.filter(row=>score(row)>0).map(row=>row.title),['Thor: Ragnarok']);
 const typo=createMovieSearch([{title:'Avatar'}],'avatr');assert.ok(typo({title:'Avatar'})>0);
 const partial=createMovieSearch([{title:'Avatar'}],'ava');assert.ok(partial({title:'Avatar'})>0);
});

test('year and encode constraints still apply when a search expands to the same series',()=>{
 const collection={id:726871,name:'Dune Collection'};
 const rows=[
  {...dune,details:{...dune.details,collection}},
  {title:'Dune',year:2021,filename:'Dune.2021.1080p.BluRay.x264.mkv',resolution:'1080p',details:{collection}},
  {title:'Other Movie',year:2024,resolution:'2160p',filename:'Dune.2024.2160p.x265.mkv'},
 ];
 const score=createMovieSearch(rows,'dune 2024 4k x265');
 assert.ok(score(rows[0])>0);assert.equal(score(rows[1]),0);assert.equal(score(rows[2]),0);
 assert.ok(createMovieSearch(rows,'4k x265')(rows[0])>0);
});

test('numeric movie titles remain searchable instead of becoming release-year filters',()=>{
 const rows=[{title:'1917',year:2019},{title:'2001: A Space Odyssey',year:1968},{title:'Other',year:1917}];
 const score=createMovieSearch(rows,'1917');assert.ok(score(rows[0])>0);assert.equal(score(rows[2]),0);
 assert.ok(createMovieSearch(rows,'2001 a space odyssey')(rows[1])>0);
});


test('public title search trusts the verified title over an outdated imported filename title',()=>{
 const rows=[{title:'Iron Man',details:{officialTitle:'Iron Man',collection:{id:1,name:'Iron Man Collection'}}},{title:'Iron Man',details:{officialTitle:'A Different Movie',collection:{id:99,name:'Other Collection'}}}];
 const score=createMovieSearch(rows,'iron man');assert.ok(score(rows[0])>0);assert.equal(score(rows[1]),0);
});

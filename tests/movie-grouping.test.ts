import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankMovieCandidates,titleMatchScore} from '../lib/movie-matching.ts';
import {groupMovieReleases,movieRouteId} from '../lib/library.ts';
const candidate=(id:number,title:string,year=2025)=>({id,title,release_date:year+'-01-01'});
const match=(query:string,title:string,year=2025)=>rankMovieCandidates({results:[candidate(1,title,year)]},query,year).id;
test('TMDB matching handles missing words, franchise prefixes, roman numerals and small spelling differences',()=>{
 assert.equal(match('F1 The Movie','F1'),1);
 assert.equal(match('Ballerina','From the World of John Wick: Ballerina'),1);
 assert.equal(match('Rambo First Blood','First Blood',1982),1);
 assert.equal(match('Terminator 2 Judgement Day','Terminator 2: Judgment Day',1991),1);
 assert.equal(match('Demon Slayer Infinity Castle','Demon Slayer: Kimetsu no Yaiba Infinity Castle'),1);
 assert.equal(match('Mission Impossible 3','Mission: Impossible III',2006),1);
 assert.equal(match('Dune','Dune: Part Two',2024),1);
});
test('fuzzy matching still rejects different sequels, years, unrelated titles and ambiguous candidates',()=>{
 assert.equal(match('Dune Part Two','Dune: Part Three',2024),null);
 assert.equal(rankMovieCandidates({results:[candidate(1,'Dune',1984)]},'Dune',2021).id,null);
 assert.equal(match('Terminator 2','Terminator 3'),null);
 assert.equal(match('Salt','Hunt'),null);
 assert.equal(rankMovieCandidates({results:[candidate(1,'Hunt',2022),candidate(2,'Hunt',2022)]},'Hunt',2022).id,null);
 assert.equal(rankMovieCandidates({results:[candidate(1,'Mission: Impossible'),candidate(2,'Mission to Mars')]},'Mission',2025).id,null);
 assert.equal(titleMatchScore('The','The Movie'),0);
});
test('movie groups keep every release but present a single TMDB movie and never combine different IDs',()=>{
 const first={id:'a',title:'Mission Impossible Final Reckoning',year:2025,status:'published',poster:'/first.jpg',details:{tmdbId:575265,officialTitle:'Mission: Impossible – The Final Reckoning'},created_at:'2026-01-01'},second={...first,id:'b',poster:'/second.jpg',created_at:'2026-02-01'},other={...first,id:'c',details:{tmdbId:2,officialTitle:'Different movie'}};
 const groups=groupMovieReleases([second,other,first]);assert.equal(groups.length,2);const group=groups.find(g=>g.movie.details.tmdbId===575265)!;assert.equal(group.releases.length,2);assert.equal(group.movie.id,'a');assert.equal(group.movie.title,'Mission: Impossible – The Final Reckoning');assert.equal(movieRouteId(group.movie),'tmdb-575265');assert.deepEqual(group.releases.map(r=>r.id),['a','b']);
});
test('unidentified rows only join a known film when exact title and year identify one group',()=>{
 const rows=[{id:'a',title:'Hunt',year:2022,details:{tmdbId:1}},{id:'b',title:'Hunt',year:2022,details:{tmdbId:2}},{id:'unknown',title:'Hunt',year:2022}];assert.equal(groupMovieReleases(rows).length,3);
 const pair=[{id:'one',title:'Movie',year:2024},{id:'two',title:'Movie',year:2024}];assert.equal(groupMovieReleases(pair)[0].releases.length,2);
});

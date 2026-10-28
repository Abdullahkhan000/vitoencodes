import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shelfMovies,hasRecordedUpdate} from '../lib/shelves.ts';
import type {Release} from '../lib/store.ts';
const release=(extra:Partial<Release>):Release=>({id:'a',title:'Dune',filename:'Dune.2021.1080p.BluRay.VITO.mkv',year:2021,category:'IMAX',resolution:'1080p',size:'5 GB',status:'published',links:[],created_at:'2026-01-01 00:00:00',details:{tmdbId:1},...extra});
test('recently updated excludes drafts, missing history and unchanged insertion timestamps',()=>{
 const rows=[release({id:'unknown',updated_at:null}),release({id:'insert',updated_at:'2026-01-01 00:00:00'}),release({id:'invalid',updated_at:'invalid'}),release({id:'draft',status:'draft',updated_at:'2026-05-01 00:00:00'}),release({id:'change',updated_at:'2026-03-01 00:00:00'})];
 assert.equal(shelfMovies(rows,'updated').length,1);assert.match(shelfMovies(rows,'updated')[0].href,/release=change/);assert.equal(hasRecordedUpdate(rows[0]),false);assert.equal(hasRecordedUpdate(rows[1]),false);
});
test('updated shelf groups versions, selects the changed encode and sorts by actual update date',()=>{
 const rows=[release({id:'old-cut',updated_at:'2026-05-01 00:00:00'}),release({id:'new-cut',created_at:'2026-04-01 00:00:00',updated_at:'2026-04-01 00:00:00'}),release({id:'other',title:'Other',details:{tmdbId:2},updated_at:'2026-03-01 00:00:00'})];const shelf=shelfMovies(rows,'updated');assert.equal(shelf.length,2);assert.equal(shelf[0].id,'tmdb-1');assert.equal(shelf[0].releaseCount,2);assert.match(shelf[0].href,/old-cut/);assert.equal(shelf[1].id,'tmdb-2');
});
test('saved shelf accepts canonical or legacy release IDs without duplicates or draft leakage',()=>{
 const rows=[release({id:'old'}),release({id:'new',created_at:'2026-04-01 00:00:00'}),release({id:'draft',status:'draft',details:{tmdbId:3}})];assert.equal(shelfMovies(rows,'saved').length,0);const shelf=shelfMovies(rows,'saved',['old','new','tmdb-1','draft','unavailable']);assert.equal(shelf.length,1);assert.equal(shelf[0].releaseCount,2);assert.match(shelf[0].href,/release=new/);assert.equal(shelfMovies(rows,'saved',['draft']).length,0);
});

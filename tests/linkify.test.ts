import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fetchLinkifyMovie,mapLinkifyDetails,matchLinkifyMovie,mergeImportedDetails} from '../lib/linkify.ts';
import {addRelease,listReleases,updateRelease,saveImportedMovieDetails} from '../lib/store.ts';
const search={results:[{id:19995,title:'Avatar',release_year:'2009'},{id:76600,title:'Avatar: The Way of Water',release_year:'2022'}]};
const response={id:19995,title:'Avatar',release_date:'2009-12-10',overview:'Movie synopsis',runtime:162,genres:[{name:'Adventure'},{name:'Science Fiction'}],credits:{cast:[{name:'Actor'}],crew:[{name:'Director Name',job:'Director'}]},external_ids:{imdb_id:'tt0499549'},vote_average:7.58,vote_count:100,backdrop_path:'/frame.jpg'};
test('Linkify requires an unambiguous exact title and year before importing',()=>{
 assert.equal(matchLinkifyMovie(search,'Avatar',2009),19995);
 assert.throws(()=>matchLinkifyMovie(search,'Avatar',2022),/exact title/);
 assert.throws(()=>matchLinkifyMovie(search,'Avatar',null),/year/);
 assert.throws(()=>matchLinkifyMovie({results:[{id:1,title:'Avatar',release_year:'2009'},{id:2,title:'Avatar',release_year:'2009'}]},'Avatar',2009),/Multiple/);
 assert.throws(()=>mapLinkifyDetails(response,76600,2009),/different movie/);
 assert.throws(()=>mapLinkifyDetails(response,19995,2022),/different movie/);
});
test('Linkify labels TMDB ratings correctly and never fabricates absent trailers or screenshots',()=>{
 const mapped=mapLinkifyDetails(response,19995,2009);
 assert.equal(mapped.imdbId,'tt0499549');assert.equal(mapped.tmdbRating,7.6);assert.equal(mapped.runtime,'2h 42m');assert.equal(mapped.genres,'Adventure, Science Fiction');assert.equal(mapped.director,'Director Name');assert.equal(mapped.cast,'Actor');
 assert.equal(mapped.trailer,undefined);assert.equal(mapped.screenshots,undefined);assert.equal(mapped.stills,undefined);
 const rich=mapLinkifyDetails({...response,videos:{results:[{site:'YouTube',type:'Trailer',key:'dQw4w9WgXcQ',official:true}]},images:{backdrops:[{file_path:'/still.jpg'},{file_path:'https://evil.test/x.jpg'}]}},19995,2009);
 assert.equal(rich.trailer,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');assert.deepEqual(rich.stills,['https://image.tmdb.org/t/p/original/still.jpg']);assert.equal(rich.screenshots,undefined);
});
test('imported metadata preserves manual fields, mirrors, sizes and publishing decisions',async ()=>{
 process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-linkify-'));
 (await addRelease({id:'avatar',filename:'Avatar.2009.VITO.mkv',title:'Avatar',year:2009,category:'IMAX',resolution:'1080p',size:'6.08 GB'}));
 const links=[{label:'HubDrive',url:'https://hubdrive.bar/file/123'}],manual={synopsis:'My synopsis',trailer:'https://youtu.be/dQw4w9WgXcQ',screenshots:['https://example.com/encode.jpg']};
 (await updateRelease('avatar','Avatar',links,'published',manual));
 const merged=mergeImportedDetails(manual,mapLinkifyDetails(response,19995,2009));(await saveImportedMovieDetails('avatar',merged));
 const row=(await listReleases(true))[0];assert.equal(row.details?.synopsis,'My synopsis');assert.deepEqual(row.details?.screenshots,manual.screenshots);assert.equal(row.details?.imdbId,'tt0499549');assert.equal(row.status,'published');assert.deepEqual(row.links,links);assert.equal(row.size,'6.08 GB');
 (await updateRelease('avatar','Avatar',links,'draft',{synopsis:'Edited later'}));
 assert.equal((await listReleases())[0].details?.imdbId,'tt0499549');assert.equal((await listReleases())[0].details?.synopsis,'Edited later');
});
test('Linkify keeps the secret in headers and uses the documented movie endpoints',async()=>{
 process.env.LINKIFY_MEDIA_API_KEY='test-server-secret';process.env.LINKIFY_MEDIA_API_BASE='https://linkify-media.vercel.app';
 const calls:string[]=[];
 const mock=async(input:URL|RequestInfo,init?:RequestInit)=>{const url=String(input);calls.push(url);assert.equal(url.includes('test-server-secret'),false);assert.equal(new Headers(init?.headers).get('X-API-Key'),'test-server-secret');assert.equal(init?.redirect,'error');return Response.json(url.includes('/search/results/')?search:response);};
 const details=await fetchLinkifyMovie('Avatar',2009,mock as typeof fetch);
 assert.equal(details.imdbId,'tt0499549');assert.equal(calls.length,2);assert.ok(calls[0].includes('year=2009'));assert.ok(calls[1].includes('/api/v1/media/movie/19995/'));
 const failed=async()=>{throw new Error('network error with private transport details');};
 await assert.rejects(()=>fetchLinkifyMovie('Avatar',2009,failed as typeof fetch),/Cannot reach Linkify/);
 const quota=async()=>new Response('{}',{status:429});await assert.rejects(()=>fetchLinkifyMovie('Avatar',2009,quota as typeof fetch),/quota/);
});

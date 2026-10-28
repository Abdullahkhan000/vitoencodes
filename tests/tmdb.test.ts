import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchTmdbMovie} from '../lib/tmdb.ts';
const search={results:[{id:438631,title:'Dune',release_date:'2021-09-15'}]};
const movie={id:438631,title:'Dune',release_date:'2021-09-15',overview:'A movie overview.',genres:[{name:'Science Fiction'}],runtime:155,poster_path:'/poster.jpg',backdrop_path:'/backdrop.jpg',imdb_id:'tt1160419',belongs_to_collection:{id:123,name:'Dune Collection'},credits:{cast:[{name:'Actor'}],crew:[{job:'Director',name:'Director'}]},videos:{results:[{site:'YouTube',type:'Trailer',official:true,key:'dQw4w9WgXcQ'}]},images:{backdrops:[{file_path:'/frame.jpg'}]}};
test('TMDB v3 authentication, strict matching and appended resources feed all movie page fields',async()=>{
 process.env.TMDB_API_KEY='test-v3-secret';delete process.env.TMDB_READ_ACCESS_TOKEN;const calls:URL[]=[];
 const mock=async(input:URL|RequestInfo,init?:RequestInit)=>{const url=new URL(String(input));calls.push(url);assert.equal(url.origin,'https://api.themoviedb.org');assert.equal(url.searchParams.get('api_key'),'test-v3-secret');assert.equal(init?.redirect,'error');return Response.json(url.pathname.endsWith('/search/movie')?search:movie);};
 const details=await fetchTmdbMovie('Dune',2021,mock as typeof fetch);
 assert.equal(details.metadataProvider,'TMDB');assert.equal(details.poster,'https://image.tmdb.org/t/p/w780/poster.jpg');assert.equal(details.synopsis,'A movie overview.');assert.equal(details.imdbId,'tt1160419');assert.equal(details.collection?.name,'Dune Collection');assert.equal(details.genres,'Science Fiction');assert.ok(details.trailer);assert.equal(details.stills?.length,1);assert.equal(calls.length,2);assert.equal(calls[0].searchParams.get('year'),'2021');assert.equal(calls[1].searchParams.get('append_to_response'),'credits,external_ids,videos,images');
});
test('TMDB read tokens use bearer auth and credentials never appear in returned network errors',async()=>{
 process.env.TMDB_READ_ACCESS_TOKEN='test-read-token';const mock=async(input:URL|RequestInfo,init?:RequestInit)=>{const url=new URL(String(input));assert.equal(url.searchParams.has('api_key'),false);assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer test-read-token');return Response.json(url.pathname.endsWith('/search/movie')?search:movie);};
 assert.equal((await fetchTmdbMovie('Dune',2021,mock as typeof fetch)).tmdbId,438631);
 const blocked=async()=>{const error=new Error('private-url-with-test-read-token');Object.assign(error,{cause:{code:'EACCES'}});throw error;};
 await assert.rejects(()=>fetchTmdbMovie('Dune',2021,blocked as typeof fetch),error=>error instanceof Error&&error.message.includes('network permission denied')&&!error.message.includes('test-read-token'));
 const rejected=async()=>new Response('{}',{status:401});await assert.rejects(()=>fetchTmdbMovie('Dune',2021,rejected as typeof fetch),/TMDB rejected/);
 const quota=async()=>new Response('{}',{status:429});await assert.rejects(()=>fetchTmdbMovie('Dune',2021,quota as typeof fetch),/request limit/);
 const wrong=async()=>Response.json({results:[{...search.results[0],release_date:'1984-01-01'}]});await assert.rejects(()=>fetchTmdbMovie('Dune',2021,wrong as typeof fetch),/No confident title/);
});

test('provider selection is explicit and TMDB metadata cannot reuse Linkify cache entries',async()=>{
 const {metadataProvider,metadataConfigured}=await import('../lib/metadata-provider.ts');
 const {metadataCacheKey}=await import('../lib/enrichment.ts');
 process.env.METADATA_PROVIDER='tmdb';delete process.env.TMDB_API_KEY;delete process.env.TMDB_READ_ACCESS_TOKEN;
 assert.equal(metadataProvider(),'TMDB');assert.equal(metadataConfigured(),false);
 process.env.TMDB_API_KEY='test-v3-secret';assert.equal(metadataConfigured(),true);
 assert.notEqual(metadataCacheKey('Dune',2021,'TMDB'),metadataCacheKey('Dune',2021,'Linkify Media'));
 assert.equal(metadataCacheKey('Dune: Part Two',2024,'TMDB'),metadataCacheKey('Dune Part Two',2024,'TMDB'));
});

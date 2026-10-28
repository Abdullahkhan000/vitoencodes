import {rankMovieCandidates,movieSearchQueries,titleMatchScore} from './movie-matching.ts';
import {mapLinkifyDetails,LinkifyError} from './linkify.ts';
async function tmdbRequest(path:string,params:Record<string,string>,request:typeof fetch){
 const key=process.env.TMDB_API_KEY,token=process.env.TMDB_READ_ACCESS_TOKEN;if(!key&&!token)throw new LinkifyError('TMDB is not configured on this server.',503);
 const url=new URL('https://api.themoviedb.org/3/'+path);for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
 const headers:Record<string,string>={Accept:'application/json'};if(token)headers.Authorization='Bearer '+token;else url.searchParams.set('api_key',key!);
 let response:Response;try{response=await request(url,{headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});}
 catch(error){const cause=error instanceof Error?(error as Error&{cause?:{code?:string}}).cause:undefined;throw new LinkifyError(cause?.code==='EACCES'||cause?.code==='EPERM'?'This server blocks outbound network access to TMDB (network permission denied). Retry the import from an environment with network access.':'Cannot reach TMDB from this server. Saved encodes and mirrors are kept.',503);}
 if(!response.ok)throw new LinkifyError(response.status===401||response.status===403?'TMDB rejected the API credential.':response.status===429?'TMDB request limit reached. Retry later.':'TMDB returned HTTP '+response.status+'.',response.status===429?429:502);
 const body=await response.text();if(body.length>4000000)throw new LinkifyError('TMDB response was too large.');try{return JSON.parse(body);}catch{throw new LinkifyError('TMDB returned an invalid response.');}
}
export async function fetchTmdbMovieById(id:number,year:number,request:typeof fetch=fetch){
 if(!Number.isSafeInteger(id)||id<1)throw new LinkifyError('Choose a valid TMDB movie ID.',400);
 try{const payload=await tmdbRequest('movie/'+id,{append_to_response:'credits,external_ids,videos,images',language:'en-US',include_image_language:'en,null'},request);
 const details=mapLinkifyDetails(payload,id,year);details.metadataProvider='TMDB';if(typeof payload.title==='string')details.officialTitle=payload.title.slice(0,200);return details;
 }catch(error){if(error instanceof LinkifyError)throw new LinkifyError(error.message.replace(/Linkify/g,'TMDB'),error.status);throw new LinkifyError('TMDB movie information could not be loaded.');}
}
export async function getTmdbCandidates(title:string,year:number|null,request:typeof fetch=fetch){
 if(!year)throw new LinkifyError('Set the release year before matching a movie.',400);
 const response=await tmdbRequest('search/movie',{query:title,year:String(year),include_adult:'false',language:'en-US'},request);
 if(!Array.isArray(response.results))throw new LinkifyError('TMDB returned an unexpected search response.');
 return response.results.filter((r:any)=>r&&Number.isSafeInteger(r.id)&&Number(String(r.release_date||'').slice(0,4))===year).map((r:any)=>({id:r.id as number,title:String(r.title||''),year,overview:String(r.overview||'').slice(0,1200),language:String(r.original_language||''),score:Math.max(titleMatchScore(title,String(r.title||'')),titleMatchScore(title,String(r.original_title||''))),votes:Number(r.vote_count)||0,poster:typeof r.poster_path==='string'&&/^\/[\w.-]+\.(jpg|png|webp)$/i.test(r.poster_path)?'https://image.tmdb.org/t/p/w342'+r.poster_path:''})).filter((r:{score:number})=>r.score>=.86).slice(0,20);
}
export async function fetchTmdbMovie(title:string,year:number|null,request:typeof fetch=fetch){
 if(!year)throw new LinkifyError('Set the release year before importing movie information.',400);
 const candidates=new Map<number,unknown>();let id:number|null=null,reason='No confident title and year match.';
 for(const query of movieSearchQueries(title)){
  const search=await tmdbRequest('search/movie',{query,year:String(year),include_adult:'false',language:'en-US'},request);
  if(!Array.isArray(search.results))throw new LinkifyError('TMDB returned an unexpected search response.');
  for(const item of search.results)if(item&&Number.isSafeInteger(item.id))candidates.set(item.id,item);
  const match=rankMovieCandidates({results:[...candidates.values()]},title,year);id=match.id;reason=match.reason;
  if(id||reason.startsWith('Multiple'))break;
 }
 if(!id)throw new LinkifyError(reason,422);
 return fetchTmdbMovieById(id,year,request);
}

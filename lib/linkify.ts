import type {MovieDetails} from './movie-details.ts';
type ObjectValue=Record<string,any>;
const record=(value:unknown):ObjectValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as ObjectValue:{};
const text=(value:unknown,max=4000)=>typeof value==='string'?value.trim().slice(0,max):'';
const normalized=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/\biii\b/g,'3').replace(/\bii\b/g,'2').replace(/[^a-z0-9]+/g,' ').trim();
export class LinkifyError extends Error{status:number;constructor(message:string,status=502){super(message);this.status=status;}}
export function matchLinkifyMovie(payload:unknown,title:string,year:number|null){
 if(!year)throw new LinkifyError('Set the release year before importing movie information.',400);
 const candidates=record(payload).results;
 if(!Array.isArray(candidates))throw new LinkifyError('Linkify returned an unexpected search response.');
 const exact=candidates.map(record).filter(item=>Number(item.release_year||String(item.release_date||'').slice(0,4))===year&&[item.title,item.original_title].some(value=>typeof value==='string'&&normalized(value)===normalized(title))&&Number.isSafeInteger(item.id)&&item.id>0);
 const unique=[...new Map(exact.map(item=>[item.id,item])).values()];
 if(unique.length!==1)throw new LinkifyError(unique.length?'Multiple titles matched. Check the title and year before importing.':'No exact title and year match. Check the title in the editor.',422);
 return unique[0].id as number;
}
function tmdbImage(value:unknown,size='original'){const path=text(value,1000);if(!/^\/[a-zA-Z0-9_.-]+\.(jpg|png|webp)$/i.test(path))return '';return 'https://image.tmdb.org/t/p/'+size+path;}
export function mapLinkifyDetails(payload:unknown,tmdbId:number,year:number):MovieDetails{
 const data=record(payload);
 if(data.id!==tmdbId||Number(String(data.release_date||'').slice(0,4))!==year)throw new LinkifyError('Linkify returned a different movie or release year. Nothing was changed.',422);
 const credits=record(data.credits),external=record(data.external_ids),details:MovieDetails={tmdbId,metadataProvider:'Linkify Media',metadataFetchedAt:new Date().toISOString()};
 const synopsis=text(data.overview);if(synopsis)details.synopsis=synopsis;
 const genres=Array.isArray(data.genres)?data.genres.map(record).map(g=>text(g.name,50)).filter(Boolean).join(', ').slice(0,200):'';if(genres)details.genres=genres;
 if(Number.isInteger(data.runtime)&&data.runtime>0&&data.runtime<2000)details.runtime=Math.floor(data.runtime/60)+'h '+data.runtime%60+'m';
 if(Array.isArray(credits.cast)){const cast=credits.cast.slice(0,12).map(record).map(c=>text(c.name,100)).filter(Boolean).join(', ').slice(0,1000);if(cast)details.cast=cast;}
 if(Array.isArray(credits.crew)){const directors=credits.crew.map(record).filter(c=>c.job==='Director').map(c=>text(c.name,100)).filter(Boolean).join(', ').slice(0,200);if(directors)details.director=directors;}
 const imdbId=text(data.imdb_id||external.imdb_id,20);if(/^tt\d{5,12}$/.test(imdbId))details.imdbId=imdbId;
 if(typeof data.vote_average==='number'&&data.vote_average>0&&data.vote_average<=10&&data.vote_count>0)details.tmdbRating=Math.round(data.vote_average*10)/10;
 const poster=tmdbImage(data.poster_path,'w780');if(poster)details.poster=poster;
 const collection=record(data.belongs_to_collection);if(Number.isSafeInteger(collection.id)&&collection.id>0&&text(collection.name,200))details.collection={id:collection.id,name:text(collection.name,200),...(tmdbImage(collection.poster_path,'w500')?{poster:tmdbImage(collection.poster_path,'w500')}:{})};
 const backdrop=tmdbImage(data.backdrop_path);if(backdrop)details.backdrop=backdrop;
 const videos=record(data.videos).results;
 if(Array.isArray(videos)){const trailer=videos.map(record).filter(v=>v.site==='YouTube'&&v.type==='Trailer'&&/^[\w-]{11}$/.test(v.key)).sort((a,b)=>Number(b.official===true)-Number(a.official===true))[0];if(trailer)details.trailer='https://www.youtube.com/watch?v='+trailer.key;}
 const images=record(data.images).backdrops;
 if(Array.isArray(images)){const stills=images.map(record).map(item=>tmdbImage(item.file_path)).filter(Boolean).slice(0,6);if(stills.length)details.stills=stills;}
 return details;
}
export function mergeImportedDetails(current:MovieDetails,imported:MovieDetails):MovieDetails{
 const result={...current};
 for(const [key,value] of Object.entries(imported)){
  const name=key as keyof MovieDetails;
  if(key==='genres'&&current.genresEdited)continue;
  if(['metadataProvider','metadataFetchedAt','tmdbId','tmdbRating','imdbId','poster','collection','officialTitle'].includes(key)||result[name]===undefined||result[name]===''||(Array.isArray(result[name])&&!(result[name] as unknown[]).length))Object.assign(result,{[key]:value});
 }
 return result;
}
export async function fetchLinkifyMovie(title:string,year:number|null,request:typeof fetch=fetch){
 const key=process.env.LINKIFY_MEDIA_API_KEY;if(!key)throw new LinkifyError('Linkify Media is not configured on this server.',503);
 const base=new URL(process.env.LINKIFY_MEDIA_API_BASE||'https://linkify-media.vercel.app');
 if(base.protocol!=='https:'||base.username||base.password)throw new LinkifyError('Linkify API base must be a valid HTTPS origin.',503);
 async function get(path:string,params:Record<string,string>={}){
  const url=new URL(path,base);for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
  let response:Response;try{response=await request(url,{headers:{'X-API-Key':key!,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});}catch(error){const cause=error instanceof Error?(error as Error&{cause?:{code?:string}}).cause:undefined;if(cause?.code==='EACCES'||cause?.code==='EPERM')throw new LinkifyError('This server blocks outbound network access to Linkify (network permission denied). Encodes are saved; retry from an environment with network access.',503);throw new LinkifyError('Cannot reach Linkify Media from this server. Try again when the service is reachable.',503);}
  if(!response.ok)throw new LinkifyError(response.status===401||response.status===403?'Linkify rejected the API key or its permissions.':response.status===429?'Linkify request quota reached. Wait before importing more.':'Linkify API returned HTTP '+response.status+'.',response.status===429?429:502);
  const body=await response.text();if(body.length>2000000)throw new LinkifyError('Linkify response was too large.');try{return JSON.parse(body);}catch{throw new LinkifyError('Linkify did not return valid JSON. Check the API base URL.',502);}
 }
 const search=await get('/api/v1/search/results/',{q:title,type:'movie',...(year?{year:String(year)}:{})});
 const id=matchLinkifyMovie(search,title,year);
 const details=await get('/api/v1/media/movie/'+id+'/',{country:'US'});
 return mapLinkifyDetails(details,id,year!);
}

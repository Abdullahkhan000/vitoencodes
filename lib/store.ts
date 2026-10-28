import {readHubDriveSettings} from './download-settings.ts';
import {normalizeHubDriveLink} from './hubdrive.ts';
import {detectEncoder,type Encoder} from './encoder.ts';
import {classifySource,type EncodeSource} from './encode-source.ts';
import type {MovieDetails} from './movie-details';
import {database} from './database.ts';
export {database} from './database.ts';
export type Release={id:string;filename:string;title:string;year:number|null;category:string;resolution:string;size:string;status:string;links:{label:string;url:string}[];poster?:string;metadata_source?:string;size_bytes?:number|null;created_at?:string;updated_at?:string|null;source?:EncodeSource;encoder?:Encoder;details?:MovieDetails};
const releaseColumns='id,filename,title,year,category,resolution,size,status,links,poster,metadata_source,size_bytes,created_at,updated_at,details';

export async function listReleases(publishedOnly=false):Promise<Release[]>{
 const db=await database();
 try{
  const order=db.postgres?'created_at DESC, sort_order DESC':'julianday(created_at) DESC, rowid DESC';
  const rows=await db.prepare(`SELECT ${releaseColumns} FROM releases ${publishedOnly?"WHERE status='published'":''} ORDER BY ${order}`).all() as unknown as (Omit<Release,'links'|'details'>&{links:string;details:string})[];
  return rows.map(r=>({...r,source:classifySource(r.filename),encoder:detectEncoder(r.filename),links:JSON.parse(r.links),details:JSON.parse(r.details||'{}')}));
 }finally{await db.close();}
}
export async function addRelease(r:Omit<Release,'links'|'status'>){
 const db=await database();
 try{return (await db.prepare('INSERT INTO releases(id,filename,title,year,category,resolution,size) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(r.id,r.filename,r.title,r.year,r.category,r.resolution,r.size)).changes>0;}
 finally{await db.close();}
}
export async function updateRelease(id:string,title:string,links:Release['links'],status:string,details?:MovieDetails){
 const db=await database();
 try{
  const settings=await readHubDriveSettings(db);
  links=links.map(link=>({...link,url:normalizeHubDriveLink(link.url,settings)}));
  links=links.filter((link,index)=>links.findIndex(other=>other.url===link.url)===index);
  const result=details===undefined
   ?await db.prepare('UPDATE releases SET title=?,links=?,status=? WHERE id=?').run(title,JSON.stringify(links),status,id)
   :await db.prepare(`UPDATE releases SET title=?,links=?,status=?,details=${db.postgres?'vito_json_patch(details::jsonb,?::jsonb)::text':'json_patch(details,?)'} WHERE id=?`).run(title,JSON.stringify(links),status,JSON.stringify(details),id);
  return result.changes>0;
 }finally{await db.close();}
}
export async function refreshReleaseSize(id:string,bytes:number,size:string){
 const db=await database();try{return (await db.prepare('UPDATE releases SET size=?,size_bytes=? WHERE id=?').run(size,bytes,id)).changes>0;}finally{await db.close();}
}
export async function setReleaseMetadata(id:string,title:string,year:number,poster:string,source:string){
 const db=await database();try{return (await db.prepare('UPDATE releases SET title=?,year=?,poster=?,metadata_source=? WHERE id=?').run(title,year,poster,source,id)).changes>0;}finally{await db.close();}
}
export async function saveImportedMovieDetails(id:string,details:MovieDetails){
 const db=await database();
 try{
  const poster=details.poster&&(/^https:\/\/image\.tmdb\.org\/t\/p\//.test(details.poster)||(/^\/posters\/[a-zA-Z0-9_./-]+\.(?:jpg|png|webp)$/.test(details.poster)&&!details.poster.includes('..')))?details.poster:null;
  return (await db.prepare('UPDATE releases SET details=?,poster=COALESCE(?,poster),metadata_source=CASE WHEN CAST(? AS TEXT) IS NOT NULL THEN ? ELSE metadata_source END WHERE id=?').run(JSON.stringify(details),poster,poster,details.tmdbId?'https://www.themoviedb.org/movie/'+details.tmdbId:'Linkify Media',id)).changes>0;
 }finally{await db.close();}
}
export async function readMovieMetadataCache(key:string,maxAge=7*24*60*60*1000):Promise<MovieDetails|null>{
 const db=await database();
 try{
  if(!db.postgres)await db.exec('CREATE TABLE IF NOT EXISTS movie_metadata_cache(cache_key TEXT PRIMARY KEY,details TEXT NOT NULL,fetched_at INTEGER NOT NULL)');
  const row=await db.prepare('SELECT details,fetched_at FROM movie_metadata_cache WHERE cache_key=?').get(key) as {details:string;fetched_at:number}|undefined;
  return row&&Date.now()-Number(row.fetched_at)<maxAge?JSON.parse(row.details):null;
 }finally{await db.close();}
}
export async function cacheMovieMetadata(key:string,details:MovieDetails){
 const db=await database();
 try{
  if(!db.postgres)await db.exec('CREATE TABLE IF NOT EXISTS movie_metadata_cache(cache_key TEXT PRIMARY KEY,details TEXT NOT NULL,fetched_at INTEGER NOT NULL)');
  await db.prepare('INSERT INTO movie_metadata_cache(cache_key,details,fetched_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET details=excluded.details,fetched_at=excluded.fetched_at').run(key,JSON.stringify(details),Date.now());
 }finally{await db.close();}
}

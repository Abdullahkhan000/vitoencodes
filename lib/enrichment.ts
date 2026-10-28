import {hasSavedMovieInfo} from './metadata-state.ts';
import {fetchTmdbMovie} from './tmdb.ts';
import {metadataProvider} from './metadata-provider.ts';
﻿import type {MovieDetails} from './movie-details.ts';
import type {Release} from './store.ts';
import {cacheMovieMetadata,readMovieMetadataCache,listReleases,saveImportedMovieDetails} from './store.ts';
import {fetchLinkifyMovie,LinkifyError,mergeImportedDetails} from './linkify.ts';
export type MovieLookup=(title:string,year:number|null,refresh?:boolean)=>Promise<MovieDetails>;
const inFlight=new Map<string,Promise<MovieDetails>>();
export function metadataCacheKey(title:string,year:number|null,provider=metadataProvider()){return provider+'|'+title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+'|'+year;}
export async function lookupMovieMetadata(title:string,year:number|null,refresh=false){
 const key=metadataCacheKey(title,year);
 if(!refresh){
  const existing=(await listReleases()).find(row=>metadataCacheKey(row.title,row.year)===key&&hasSavedMovieInfo(row));
  if(existing){const {screenshots,...filmDetails}=existing.details||{};return {...filmDetails,...(existing.poster?{poster:existing.poster}:{})};}
  const cached=(await readMovieMetadataCache(key));if(cached)return cached;
 }
 const active=inFlight.get(key);if(active)return active;
 const work=(metadataProvider()==='TMDB'?fetchTmdbMovie(title,year):fetchLinkifyMovie(title,year)).then(async details=>{(await cacheMovieMetadata(key,details));if(details.officialTitle)(await cacheMovieMetadata(metadataCacheKey(details.officialTitle,year),details));return details;});inFlight.set(key,work);
 try{return await work;}finally{inFlight.delete(key);}
}
export type MetadataResult={id:string;title:string;status:'updated'|'cached'|'pending';message?:string;poster?:boolean;about?:boolean;genres?:boolean;trailer?:boolean;stills?:number;imdb?:boolean};
export async function enrichReleases(ids:string[],options:{refresh?:boolean;lookup?:MovieLookup}={}){
 const lookup=options.lookup||lookupMovieMetadata,results:MetadataResult[]=[];
 let stopped='';const values=new Map<string,MovieDetails>();
 for(const id of [...new Set(ids)]){
  const row=(await listReleases()).find(r=>r.id===id);if(!row){results.push({id,title:'Missing release',status:'pending',message:'Release no longer exists.'});continue;}
  if(hasSavedMovieInfo(row)&&!options.refresh){results.push({id,title:row.title,status:'cached'});continue;}
  if(stopped){results.push({id,title:row.title,status:'pending',message:stopped});continue;}
  try{
   const key=row.title+'|'+row.year;let imported=values.get(key);if(!imported){imported=await lookup(row.title,row.year,options.refresh);values.set(key,imported);}
   const latest=(await listReleases()).find(r=>r.id===id);if(!latest)continue;
   const merged=mergeImportedDetails(latest.details||{},imported);if(latest.poster&&!options.refresh)merged.poster=latest.poster;(await saveImportedMovieDetails(id,merged));
   results.push({id,title:row.title,status:'updated',poster:Boolean(imported.poster||row.poster),about:Boolean(merged.synopsis),genres:Boolean(merged.genres),trailer:Boolean(merged.trailer),stills:merged.stills?.length||0,imdb:Boolean(merged.imdbId)});
  }catch(error){const message=error instanceof LinkifyError?error.message:'Movie information import failed. Retry from the library.';results.push({id,title:row.title,status:'pending',message});if(!(error instanceof LinkifyError)||[429,502,503].includes(error.status))stopped=message;}
 }
 return {updated:results.filter(r=>r.status==='updated').length,pending:results.filter(r=>r.status==='pending').length,blocked:Boolean(stopped),results};
}
export async function previewMovieMetadata<T extends {filename:string;title:string;year:number|null}>(entries:T[],existing:Release[],lookup:MovieLookup=lookupMovieMetadata){
 const output:(T&{existing:boolean;poster:string;details:MovieDetails;metadataStatus:string;metadataMessage?:string})[]=[];
 let stopped='';const values=new Map<string,MovieDetails>();
 for(const entry of entries){
  const current=existing.find(r=>r.filename.toLowerCase()===entry.filename.toLowerCase());
  const base={...entry,existing:Boolean(current),poster:current?.poster||'',details:current?.details||{},metadataStatus:'pending'};
  if(stopped){output.push({...base,metadataMessage:stopped});continue;}
  if(current&&hasSavedMovieInfo(current)){output.push({...base,metadataStatus:'ready'});continue;}
  try{const key=entry.title+'|'+entry.year;let details=values.get(key);if(!details){details=await lookup(entry.title,entry.year);values.set(key,details);}output.push({...base,poster:base.poster||details.poster||'',details:mergeImportedDetails(base.details,details),metadataStatus:'ready'});}
  catch(error){const message=error instanceof LinkifyError?error.message:'Movie information could not be loaded.';output.push({...base,metadataMessage:message});if(!(error instanceof LinkifyError)||[429,502,503].includes(error.status))stopped=message;}
 }
 return output;
}

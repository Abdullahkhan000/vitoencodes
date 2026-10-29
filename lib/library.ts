import {normalizeMovieTitle} from './movie-matching.ts';
﻿import type {Release} from './store.ts';
export type LibraryMovie=Pick<Release,'id'|'title'|'year'>&Partial<Pick<Release,'status'|'details'|'poster'|'category'|'resolution'|'size'|'created_at'|'updated_at'>>;
const normal=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function movieGenres(movie:LibraryMovie){return [...new Set((movie.details?.genres||'').split(',').map(v=>v.trim()).filter(Boolean))];}
export function movieIdentity(movie:LibraryMovie){return movie.details?.tmdbId?'tmdb:'+movie.details.tmdbId:normal(movie.title)+'|'+movie.year;}
export function movieCollection(movie:LibraryMovie){
 const collection=movie.details?.collection;
 if(collection?.name&&collection.id)return {...collection,slug:normal(collection.name).replace(/ collection$/,'').replace(/ /g,'-')||'collection-'+collection.id};
 // Explicit, year-bound fallback for the series requested by the owner. No prefix guessing.
 if((normal(movie.title)==='dune'&&movie.year===2021)||(normal(movie.title)==='dune part two'&&movie.year===2024))return {id:'dune',name:'Dune Collection',slug:'dune'};
 return null;
}
export function movieTitle(movie:LibraryMovie){return movie.details?.officialTitle||movie.title;}
export function movieRouteId(movie:LibraryMovie){return movie.details?.tmdbId?'tmdb-'+movie.details.tmdbId:movie.id;}
export function sameMovie(a:LibraryMovie,b:LibraryMovie){
 if(a.details?.tmdbId&&b.details?.tmdbId)return a.details.tmdbId===b.details.tmdbId;
 return a.year===b.year&&[a.title,movieTitle(a)].some(title=>[b.title,movieTitle(b)].some(other=>normalizeMovieTitle(title)===normalizeMovieTitle(other)));
}
export function preferredRelease<T extends LibraryMovie>(releases:T[]):T|undefined{
 for(const row of releases){
  const id=row.details?.primaryReleaseId;
  if(id){const selected=releases.find(candidate=>candidate.id===id&&candidate.status!=='draft');if(selected)return selected;}
 }
 return undefined;
}
export function groupMovieReleases<T extends LibraryMovie>(rows:T[]):{movie:T;releases:T[]}[]{
 const sets:T[][]=[];const known=new Map<number,T[]>();
 for(const row of rows){const id=row.details?.tmdbId;if(id){let group=known.get(id);if(!group){group=[];known.set(id,group);sets.push(group);}group.push(row);}}
 for(const row of rows.filter(row=>!row.details?.tmdbId)){
  const matches=[...known.values()].filter(group=>group.some(other=>sameMovie(row,other)));
  if(matches.length===1){matches[0].push(row);continue;}
  const existing=sets.find(group=>!group.some(other=>other.details?.tmdbId)&&sameMovie(row,group[0]));
  if(existing)existing.push(row);else sets.push([row]);
 }
 return sets.map(group=>{
  const releases=[...group].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
  const primary=preferredRelease(releases)||releases[0],info=[...releases].sort((a,b)=>Number(Boolean(b.details?.officialTitle))+Number(Boolean(b.poster))-Number(Boolean(a.details?.officialTitle))-Number(Boolean(a.poster)))[0];
  const {screenshots,...shared}=info.details||{};
  const movie={...primary,id:releases[0].id,title:movieTitle(info),poster:primary.poster||info.poster,details:{...shared,...primary.details}} as T;
  return {movie,releases};
 }).sort((a,b)=>rows.findIndex(row=>a.releases.includes(row))-rows.findIndex(row=>b.releases.includes(row)));
}
function distinct<T extends LibraryMovie>(rows:T[]){return groupMovieReleases(rows).map(group=>group.movie);}
export function collectionMovies<T extends LibraryMovie>(movie:LibraryMovie,rows:T[]){const group=movieCollection(movie);if(!group)return [];return distinct(rows.filter(row=>row.status==='published'&&movieCollection(row)?.slug===group.slug)).sort((a,b)=>(a.year||0)-(b.year||0)||a.title.localeCompare(b.title));}
export function genreRecommendations<T extends LibraryMovie>(movie:LibraryMovie,rows:T[],limit=6){
 const genres=new Set(movieGenres(movie).map(normal));if(!genres.size)return [];
 const collection=movieCollection(movie)?.slug;
 return distinct(rows.filter(row=>row.status==='published'&&!sameMovie(row,movie)&&(!collection||movieCollection(row)?.slug!==collection)))
 .map(row=>({row,score:movieGenres(row).filter(genre=>genres.has(normal(genre))).length}))
 .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||(b.row.year||0)-(a.row.year||0)||a.row.title.localeCompare(b.row.title)).slice(0,limit).map(item=>item.row);
}
export function availableCollections(rows:LibraryMovie[]){const groups=new Map<string,{slug:string;name:string;count:number;poster?:string}>();for(const row of distinct(rows.filter(r=>r.status==='published'))){const group=movieCollection(row);if(!group)continue;const found=groups.get(group.slug);if(found)found.count++;else groups.set(group.slug,{slug:group.slug,name:group.name,count:1,poster:row.poster});}return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));}

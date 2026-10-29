import type {Release} from './store.ts';
import {preferredRelease,groupMovieReleases,movieRouteId,movieTitle} from './library.ts';
import {newestFirst,timestamp} from './release-dates.ts';
export type ShelfMode='saved'|'updated';
export function hasRecordedUpdate(row:Pick<Release,'created_at'|'updated_at'>){const updated=timestamp(row.updated_at),created=timestamp(row.created_at);return Boolean(updated&&(!created||updated.getTime()>created.getTime()));}
export function shelfMovies(rows:Release[],mode:ShelfMode,savedIds:string[]=[]){return groupMovieReleases(rows.filter(row=>row.status==='published')).flatMap(({movie,releases})=>{
 const routeId=movieRouteId(movie);if(mode==='saved'&&!savedIds.includes(routeId)&&!releases.some(row=>savedIds.includes(row.id)))return [];
 const candidates=mode==='updated'?releases.filter(hasRecordedUpdate):releases;if(!candidates.length)return [];
 const sorted=[...candidates].sort(mode==='updated'?(a,b)=>(timestamp(b.updated_at)?.getTime()||0)-(timestamp(a.updated_at)?.getTime()||0):newestFirst),release=(mode==='saved'?preferredRelease(candidates):undefined)||sorted[0];
 return [{...release,id:routeId,title:movieTitle(movie),poster:movie.poster||release.poster,details:movie.details,releases,releaseCount:releases.length,href:'/movies/'+encodeURIComponent(routeId)+'?release='+encodeURIComponent(release.id)}];
 }).sort(mode==='updated'?(a,b)=>(timestamp(b.updated_at)?.getTime()||0)-(timestamp(a.updated_at)?.getTime()||0):newestFirst);}

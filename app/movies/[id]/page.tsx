import type {Metadata} from 'next';
import {siteUrl} from '../../../lib/site-url';
import {newestFirst} from '../../../lib/release-dates';
﻿import {notFound,redirect} from 'next/navigation';
import {catalog} from '../../../lib/catalog';
import {listReleases} from '../../../lib/store';
import {preferredRelease,collectionMovies,genreRecommendations,groupMovieReleases,movieCollection,movieRouteId,movieTitle} from '../../../lib/library';
import MovieDetail from './movie-detail';
export const dynamic='force-dynamic';
const poster=(value:string,id:string,demo=false)=>demo?'/posters/'+id+'.jpg':value.startsWith('/')||value.startsWith('https://')?value:value?'https://image.tmdb.org/t/p/w780/'+value:'';
export default async function Movie({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{release?:string}>}){
 const {id:rawId}=await params;let id:string;try{id=decodeURIComponent(rawId);}catch{notFound();}
 const published=(await listReleases(true)),groups=groupMovieReleases(published);
 const group=groups.find(group=>movieRouteId(group.movie)===id||group.releases.some(row=>row.id===id));
 const demo=catalog.find(r=>r.id===id);if(!group&&!demo)notFound();
 if(group&&movieRouteId(group.movie)!==id)redirect('/movies/'+encodeURIComponent(movieRouteId(group.movie))+'?release='+encodeURIComponent(id));
 const requested=(await searchParams).release;
 const initial=group?.releases.find(r=>r.id===requested)||(group?preferredRelease(group.releases)||[...group.releases].sort(newestFirst)[0]:undefined);
 const release=group&&initial?{...group.movie,...initial,title:movieTitle(group.movie),poster:poster(group.movie.poster||'',group.movie.id),details:group.movie.details,codec:''}:{...demo!,filename:'',links:[],status:'preview',details:{},poster:poster('',demo!.id,true)};
 const alternatives=group?group.releases.map(r=>({...r,poster:poster(r.poster||'',r.id),codec:''})):[release];
 const card=(r:typeof published[number])=>({id:movieRouteId(r),title:movieTitle(r),year:r.year,category:r.category,resolution:r.resolution,size:r.size,poster:poster(r.poster||'',r.id),genres:r.details?.genres||''});
 const related=group?genreRecommendations(group.movie,published).map(card):[];
 const collection=group?movieCollection(group.movie):null;
 const collectionItems=group?collectionMovies(group.movie,published).map(card):[];
 return <MovieDetail movie={release} versions={alternatives} related={related} collection={collection} collectionItems={collectionItems} preview={!group}/>;
}

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;const rows=await listReleases(true),group=groupMovieReleases(rows).find(group=>movieRouteId(group.movie)===id||group.releases.some(row=>row.id===id));if(!group)return {title:'Movie not found | VITOENCODES',robots:{index:false,follow:false}};const row=group.movie,title=movieTitle(row)+(row.year?' ('+row.year+')':'')+' | VITOENCODES',description=(row.details?.synopsis||'Compare '+group.releases.length+' available encodes, formats and download mirrors.').slice(0,180),url=siteUrl()+'/movies/'+encodeURIComponent(movieRouteId(row)),image=poster(row.poster||'',row.id);return {title,description,alternates:{canonical:url},openGraph:{title,description,url,type:'video.movie',...(image?{images:[image]}:{})},twitter:{card:'summary_large_image',title,description,...(image?{images:[image]}:{})}};}

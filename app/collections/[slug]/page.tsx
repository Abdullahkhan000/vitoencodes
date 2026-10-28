import ResilientImage from '../../components/resilient-image';
import SiteFooter from '../../components/site-footer';
﻿import ReleaseDates from '../../components/release-dates';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowUpRight,Film,Layers3} from 'lucide-react';
import {listReleases} from '../../../lib/store';
import {movieCollection,collectionMovies,movieRouteId,movieTitle} from '../../../lib/library';
export const dynamic='force-dynamic';
export default async function Collection({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,published=(await listReleases(true)),first=published.find(r=>movieCollection(r)?.slug===slug);if(!first)notFound();
 const group=movieCollection(first)!,movies=collectionMovies(first,published);
 return <div className="film-page" id="top"><header className="archive-header"><Link className="archive-brand" href="/">VITO<b>ENCODES</b></Link><Link className="film-back" href="/collections"><ArrowLeft size={16}/> All collections</Link></header><main className="film-container collection-page"><span className="film-small-label">THE VITOENCODES COLLECTIONS</span><div className="collection-heading"><div><h1>{group.name}</h1><p>{movies.length} {movies.length===1?'movie':'movies'} available in the archive · In release order</p></div><Layers3 size={42}/></div><div className="collection-movie-grid">{movies.map(movie=><Link href={'/movies/'+encodeURIComponent(movieRouteId(movie))} key={movie.id}><div className="collection-movie-art">{movie.poster?<ResilientImage src={movie.poster} alt={movie.title+' poster'}/>:<Film size={50}/>}<span>{movie.year}</span></div><h2>{movieTitle(movie)}</h2><p>{movie.resolution} · {movie.category}<span>{movie.size}</span></p><ReleaseDates created_at={movie.created_at} updated_at={movie.updated_at}/><span className="collection-view">View encode <ArrowUpRight size={14}/></span></Link>)}</div><p className="film-info-note">Only movies published in this archive appear here. Alternate encodes are available on each movie’s detail page.</p><SiteFooter/></main></div>;
}

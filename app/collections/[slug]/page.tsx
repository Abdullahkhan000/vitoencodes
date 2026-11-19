import type {Metadata} from 'next';
import SiteHeader from '../../components/site-header';
import ResilientImage from '../../components/resilient-image';
import SiteFooter from '../../components/site-footer';
import ReleaseDates from '../../components/release-dates';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowUpRight,Film,Layers3} from 'lucide-react';
import {siteUrl} from '../../../lib/site-url';
import {listReleases} from '../../../lib/store';
import {movieCollection,collectionMovies,movieRouteId,movieTitle} from '../../../lib/library';

export const dynamic='force-dynamic';

async function findPublishedCollection(slug:string){
 const published=await listReleases(true);
 const first=published.find(release=>movieCollection(release)?.slug===slug);
 if(!first)return null;
 const group=movieCollection(first);
 if(!group)return null;
 const movies=collectionMovies(first,published);
 if(movies.length<2)return null;
 return {first,group,movies};
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 const collection=await findPublishedCollection(slug);
 if(!collection)return {title:'Collection not found | VITOENCODES',robots:{index:false,follow:false}};
 const {first,group,movies}=collection;
 const title=group.name+' | Movie Collection | VITOENCODES';
 const description=('Explore '+movies.length+' films in the '+group.name+' collection. Browse available VITOENCODES editions, encode specifications and release details.').slice(0,160);
 const url=siteUrl()+'/collections/'+encodeURIComponent(group.slug);
 const rawImage=first.poster||'';
 const image=rawImage?(rawImage.startsWith('https://')?rawImage:rawImage.startsWith('/')?siteUrl()+rawImage:'https://image.tmdb.org/t/p/w780/'+rawImage):undefined;
 return {
  title,
  description,
  alternates:{canonical:url},
  robots:{index:true,follow:true},
  openGraph:{title,description,url,type:'website',...(image?{images:[{url:image,alt:group.name+' collection'}]}:{})},
  twitter:{card:'summary_large_image',title,description,...(image?{images:[image]}:{})},
 };
}

export default async function Collection({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const collection=await findPublishedCollection(slug);
 if(!collection)notFound();
 const {group,movies}=collection;
 const pageUrl=siteUrl()+'/collections/'+encodeURIComponent(group.slug);
 const schema={
  '@context':'https://schema.org',
  '@type':'CollectionPage',
  '@id':pageUrl+'#collection',
  name:group.name+' | VITOENCODES',
  url:pageUrl,
  description:'Explore '+movies.length+' films in the '+group.name+' collection at VITOENCODES.',
  numberOfItems:movies.length,
  mainEntity:{
   '@type':'ItemList',
   numberOfItems:movies.length,
   itemListElement:movies.map((movie,index)=>({
    '@type':'ListItem',
    position:index+1,
    name:movieTitle(movie),
    url:siteUrl()+'/movies/'+encodeURIComponent(movieRouteId(movie)),
   })),
  },
 };
 const schemaJson=JSON.stringify(schema).replace(/</g,'\\u003c');
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:schemaJson}}/><div className="film-page" id="top"><SiteHeader/><main className="film-container collection-page"><span className="film-small-label">THE VITOENCODES COLLECTIONS</span><div className="collection-heading"><div><h1>{group.name}</h1><p>{movies.length} {movies.length===1?'movie':'movies'} available in the archive · In release order</p></div><Layers3 size={42}/></div><div className="collection-movie-grid">{movies.map(movie=><Link href={'/movies/'+encodeURIComponent(movieRouteId(movie))} key={movie.id}><div className="collection-movie-art">{movie.poster?<ResilientImage src={movie.poster} alt={movie.title+' poster'}/>:<Film size={50}/>}<span>{movie.year}</span></div><h2>{movieTitle(movie)}</h2><p>{movie.resolution} · {movie.category}<span>{movie.size}</span></p><ReleaseDates created_at={movie.created_at} updated_at={movie.updated_at}/><span className="collection-view">View encode <ArrowUpRight size={14}/></span></Link>)}</div><p className="film-info-note">Only movies published in this archive appear here. Alternate encodes are available on each movie’s detail page.</p><SiteFooter/></main></div></>;
}

import type {MetadataRoute} from 'next';
import {publicCatalog} from '../lib/public-catalog';
import {availableCollections,groupMovieReleases,movieRouteId} from '../lib/library';
import {siteUrl} from '../lib/site-url';

export const dynamic='force-dynamic';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=siteUrl();
 const rows=await publicCatalog();
 const groups=groupMovieReleases(rows);
 const collections=availableCollections(rows);
 return [
  {url:base,changeFrequency:'daily',priority:1},
  ...['about','collections','recently-updated','contact','faq','privacy'].map(path=>({url:base+'/'+path})),
  ...collections.map(collection=>({
   url:base+'/collections/'+encodeURIComponent(collection.slug),
   changeFrequency:'weekly' as const,
   priority:0.7,
  })),
  ...groups.map(group=>({
   url:base+'/movies/'+encodeURIComponent(movieRouteId(group.movie)),
   ...(group.movie.updated_at||group.movie.created_at?{lastModified:new Date(group.movie.updated_at||group.movie.created_at!)}:{}),
   changeFrequency:'weekly' as const,
   priority:0.8,
  })),
 ];
}

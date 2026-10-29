import type {MetadataRoute} from 'next';
import {publicCatalog} from '../lib/public-catalog';
import {groupMovieReleases,movieRouteId} from '../lib/library';
import {siteUrl} from '../lib/site-url';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const base=siteUrl();const groups=groupMovieReleases(await publicCatalog());return [{url:base,changeFrequency:'daily',priority:1},...['about','collections','recently-updated','contact','faq','privacy'].map(path=>({url:base+'/'+path})),...groups.map(group=>({url:base+'/movies/'+encodeURIComponent(movieRouteId(group.movie)),...(group.movie.updated_at||group.movie.created_at?{lastModified:new Date(group.movie.updated_at||group.movie.created_at!)}:{}),changeFrequency:'weekly' as const,priority:0.8}))];}

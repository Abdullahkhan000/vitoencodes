import {unstable_cache} from 'next/cache';
import {listReleases} from './store';
// This app uses dynamic routes; keep the supported legacy cache until Cache Components migration.
export const publicCatalog=unstable_cache(()=>listReleases(true,true),['public-catalog-v1'],{tags:['public-catalog'],revalidate:60});

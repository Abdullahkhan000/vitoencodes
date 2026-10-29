import Home from './home';
import {publicCatalog} from '../lib/public-catalog';
import {encodeSources} from '../lib/encode-source';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const text=(key:string,max=100)=>typeof params[key]==='string'?(params[key] as string).slice(0,max):undefined;const source=text('source');return <Home initialReleases={(await publicCatalog())} initialFilters={{query:text('q',200),genre:text('genre'),collection:text('collection'),source:encodeSources.some(value=>value===source)?source:undefined,saved:text('saved')==='1',search:text('search')==='1'}}/>;}

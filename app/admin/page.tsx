import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {SESSION_COOKIE,validSession} from '../../lib/auth';
import {listReleases} from '../../lib/store';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'VITOENCODES / Private Studio',robots:{index:false,follow:false}};
export default async function Admin({searchParams}:{searchParams:Promise<{view?:string}>}){const jar=await cookies();if(!validSession(jar.get(SESSION_COOKIE)?.value))notFound();const view=(await searchParams).view;return <Dashboard initialReleases={(await listReleases())} initialSection={view&&['catalog','bulk','drive','settings','overview','domains','support'].includes(view)?view:'catalog'}/>;}

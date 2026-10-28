import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {SESSION_COOKIE,validSession} from '../../../lib/auth';
import Login from './login';
export const dynamic='force-dynamic';
export const metadata={title:'Private access',robots:{index:false,follow:false}};
export default async function LoginPage(){const jar=await cookies();if(validSession(jar.get(SESSION_COOKIE)?.value))redirect('/admin?view=catalog');return <Login/>;}

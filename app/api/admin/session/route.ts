import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSession, sameOrigin, SESSION_COOKIE, SESSION_SECONDS, validAdminToken, validSession } from '../../../../lib/auth';
export const runtime='nodejs';
const attempts:Map<string,{count:number;until:number}> = new Map();
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 // A single-instance login budget cannot be bypassed by spoofing client IP headers.
 const now=Date.now();const bucket=attempts.get('login');
 if(bucket&&bucket.until>now&&bucket.count>=10)return NextResponse.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429,headers:{'Retry-After':String(Math.ceil((bucket.until-now)/1000))}});
 try{const body=await request.json();if(typeof body.token!=='string'||!validAdminToken(body.token)){const current=bucket&&bucket.until>now?bucket:{count:0,until:now+15*60000};current.count++;attempts.set('login',current);return NextResponse.json({error:'Invalid access key.'},{status:401});}
 attempts.delete('login');const jar=await cookies();jar.set(SESSION_COOKIE,createSession(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Unable to sign in.'},{status:400});}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});const jar=await cookies();jar.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});}

export async function GET(){const jar=await cookies();return NextResponse.json({authenticated:validSession(jar.get(SESSION_COOKIE)?.value)},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}

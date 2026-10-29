import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {createSession,sameOrigin,SESSION_COOKIE,SESSION_SECONDS,validAdminToken,validAdminSession} from '../../../../lib/auth';
import {securityState,verifySecondFactor} from '../../../../lib/mfa';
import {clientKey,consumeLimit,RateLimitError} from '../../../../lib/rate-limit';
import {verifyTurnstile,TurnstileError} from '../../../../lib/turnstile';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 try{
  await consumeLimit('login:'+clientKey(request),10,15*60000);await consumeLimit('login:global',100,15*60000);
  const raw=await request.text();if(raw.length>6000)return NextResponse.json({error:'Invalid request.'},{status:400});const body=JSON.parse(raw);
  await verifyTurnstile(body.turnstileToken,request,'admin_login');
  if(typeof body.token!=='string'||!validAdminToken(body.token))return NextResponse.json({error:'Invalid access key.'},{status:401});
  const policy=await securityState();
  if(policy.enabled&&(typeof body.code!=='string'||body.code.length>128||!await verifySecondFactor(body.code.trim())))return NextResponse.json({error:'Enter a fresh authenticator code or an unused recovery code.',mfaRequired:true},{status:401});
  const jar=await cookies();jar.set(SESSION_COOKIE,createSession(Date.now(),policy.signing_secret,policy.version,Boolean(policy.enabled)),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof RateLimitError)return NextResponse.json({error:error.message},{status:429,headers:{'Retry-After':String(error.retryAfter)}});if(error instanceof TurnstileError)return NextResponse.json({error:error.message},{status:403});return NextResponse.json({error:'Unable to sign in. Please retry.'},{status:400});}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});const jar=await cookies();jar.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});}
export async function GET(){const jar=await cookies();return NextResponse.json({authenticated:await validAdminSession(jar.get(SESSION_COOKIE)?.value)},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}

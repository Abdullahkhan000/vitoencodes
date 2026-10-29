import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {securityState} from './mfa.ts';
export const SESSION_COOKIE='vito_admin_session';
export const SESSION_SECONDS=8*60*60;
function equal(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function validAdminToken(value:string){const secret=process.env.ADMIN_TOKEN;return Boolean(secret&&secret.length>=32&&equal(value,secret));}
function keyVersion(){return createHash('sha256').update(process.env.ADMIN_TOKEN||'').digest('hex');}
function signature(value:string,secret:string){return createHmac('sha256',secret).update('vito-admin:'+value).digest('base64url');}
export function createSession(now=Date.now(),secret=process.env.SESSION_SECRET||process.env.ADMIN_TOKEN||'',version=0,mfa=false){
 if(!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN.length<32||secret.length<32)throw new Error('Admin access is not configured.');
 const payload=Buffer.from(JSON.stringify({exp:now+SESSION_SECONDS*1000,nonce:randomBytes(16).toString('hex'),key:keyVersion(),version,mfa})).toString('base64url');return payload+'.'+signature(payload,secret);
}
export function validSession(value:string|undefined,now=Date.now(),secret=process.env.SESSION_SECRET||process.env.ADMIN_TOKEN||''){
 if(!value||value.length>2000||!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN.length<32||secret.length<32)return false;
 try{const parts=value.split('.');if(parts.length!==2||!equal(parts[1],signature(parts[0],secret)))return false;const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString());return payload.key===keyVersion()&&typeof payload.exp==='number'&&payload.exp>now&&payload.exp<=now+SESSION_SECONDS*1000;}catch{return false;}
}
export async function validAdminSession(value:string|undefined){
 if(!value||value.length>2000)return false;
 const state=await securityState();
 if(validSession(value,Date.now(),state.signing_secret)){
  const payload=JSON.parse(Buffer.from(value.split('.')[0],'base64url').toString());return payload.version===state.version&&(!state.enabled||payload.mfa===true);
 }
 // Existing sessions are accepted only until the first MFA/security-policy change.
 return state.version===0&&!state.enabled&&validSession(value);
}
export function sameOrigin(request:Request){const expected=new URL(request.url);const host=request.headers.get('host');if(host)expected.host=host;return request.headers.get('origin')===expected.origin;}
export async function authorized(request:Request){
 const bearer=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 const pathname=new URL(request.url).pathname;
 if(pathname==='/api/sync'&&process.env.SYNC_TOKEN&&process.env.SYNC_TOKEN.length>=32&&equal(bearer,process.env.SYNC_TOKEN))return true;
 const cookie=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 if(cookie&&(['GET','HEAD'].includes(request.method)||sameOrigin(request))&&await validAdminSession(cookie))return true;
 if(validAdminToken(bearer))return !(await securityState()).enabled;
 return false;
}
export const denied=()=>Response.json({error:'Admin authentication required.'},{status:401,headers:{'Cache-Control':'no-store'}});

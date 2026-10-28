import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const SESSION_COOKIE = 'vito_admin_session';
export const SESSION_SECONDS = 8 * 60 * 60;
function equal(a:string,b:string) { const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right); }
export function validAdminToken(value:string) { const secret=process.env.ADMIN_TOKEN;return Boolean(secret&&secret.length>=32&&equal(value,secret)); }
function signature(value:string) {return createHmac('sha256',process.env.ADMIN_TOKEN||'').update('vito-admin:'+value).digest('base64url');}
export function createSession(now=Date.now()) {if(!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN.length<32)throw new Error('Admin access is not configured.');const payload=Buffer.from(JSON.stringify({exp:now+SESSION_SECONDS*1000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+signature(payload);}
export function validSession(value:string|undefined,now=Date.now()) {if(!value||!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN.length<32)return false;try{const parts=value.split('.');if(parts.length!==2||!equal(parts[1],signature(parts[0])))return false;const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString());return typeof payload.exp==='number'&&payload.exp>now&&payload.exp<=now+SESSION_SECONDS*1000;}catch{return false;}}
export function sameOrigin(request:Request) {const expected=new URL(request.url);const host=request.headers.get('host');if(host)expected.host=host;return request.headers.get('origin')===expected.origin;}
export function authorized(request:Request) {
 if(validAdminToken(request.headers.get('authorization')?.replace(/^Bearer /,'')||''))return true;
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 return validSession(cookie)&&(['GET','HEAD'].includes(request.method)||sameOrigin(request));
}
export const denied=()=>Response.json({error:'Admin authentication required.'},{status:401,headers:{'Cache-Control':'no-store'}});

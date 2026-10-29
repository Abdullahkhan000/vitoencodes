import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import {database,type Database} from './database.ts';
type SecurityState={enabled:number;signing_secret:string;encrypted_secret:string|null;pending_secret:string|null;pending_until:number;last_counter:number;version:number;recovery_hashes:string};
function encryptionKey(){const key=process.env.MFA_ENCRYPTION_KEY||process.env.ADMIN_TOKEN;if(!key||key.length<32)throw new Error('Configure the admin key before enrolling MFA.');return createHash('sha256').update('vito-mfa-storage|'+key).digest();}
function seal(secret:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(value=>value.toString('base64url')).join('.');}
function unseal(value:string){const [iv,tag,encrypted]=value.split('.').map(part=>Buffer.from(part,'base64url'));const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');}
function totp(secret:string){return new OTPAuth.TOTP({issuer:'VITOENCODES',label:'Admin',algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)});}
function codeHash(code:string){return createHash('sha256').update(code.toLowerCase().replace(/[^a-z0-9]/g,'')).digest('hex');}
function equalHash(a:string,b:string){return a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export async function securityState(dbOverride?:Database):Promise<SecurityState>{
 const db=dbOverride||await database();try{
  await db.prepare("INSERT INTO admin_security(id,signing_secret) VALUES('owner',?) ON CONFLICT(id) DO NOTHING").run(randomBytes(48).toString('hex'));
  const row=await db.prepare("SELECT enabled,signing_secret,encrypted_secret,pending_secret,pending_until,last_counter,version,recovery_hashes FROM admin_security WHERE id='owner'").get();
  return {...row,pending_until:Number(row!.pending_until||0),last_counter:Number(row!.last_counter)} as SecurityState;
 }finally{if(!dbOverride)await db.close();}
}
export async function verifySecondFactor(code:string,now=Date.now()){
 const db=await database();try{
  await db.exec('BEGIN IMMEDIATE');const state=await securityState(db);
  if(!state.enabled){await db.exec('COMMIT');return true;}
  const hashes=JSON.parse(state.recovery_hashes) as string[],hash=codeHash(code),index=hashes.findIndex(value=>equalHash(value,hash));
  if(index>=0){hashes.splice(index,1);await db.prepare("UPDATE admin_security SET recovery_hashes=? WHERE id='owner'").run(JSON.stringify(hashes));await db.exec('COMMIT');return true;}
  if(!/^\d{6}$/.test(code)||!state.encrypted_secret){await db.exec('COMMIT');return false;}
  let delta:number|null=null;try{delta=totp(unseal(state.encrypted_secret)).validate({token:code,window:1,timestamp:now});}catch{}
  const counter=Math.floor(now/30000)+(delta||0);
  if(delta===null||counter<=state.last_counter){await db.exec('COMMIT');return false;}
  await db.prepare("UPDATE admin_security SET last_counter=? WHERE id='owner'").run(counter);await db.exec('COMMIT');return true;
 }catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
}
export async function beginMfa(){
 const secret=new OTPAuth.Secret({size:20}).base32,uri=totp(secret).toString();const db=await database();try{
  await securityState(db);await db.prepare("UPDATE admin_security SET pending_secret=?,pending_until=? WHERE id='owner'").run(seal(secret),Date.now()+10*60000);
  return {secret,uri,qrCode:await QRCode.toDataURL(uri,{width:240,margin:2})};
 }finally{await db.close();}
}
export async function confirmMfa(code:string,now=Date.now()){
 const db=await database();try{
  await db.exec('BEGIN IMMEDIATE');const state=await securityState(db);
  if(!state.pending_secret||state.pending_until<now)throw new Error('MFA setup expired. Start again.');
  const secret=unseal(state.pending_secret),delta=totp(secret).validate({token:code,window:1,timestamp:now});
  if(delta===null)throw new Error('Enter the current six-digit authenticator code.');
  const recoveryCodes=Array.from({length:8},()=>randomBytes(16).toString('hex').match(/.{4}/g)!.join('-'));
  await db.prepare("UPDATE admin_security SET enabled=1,encrypted_secret=?,pending_secret=NULL,pending_until=NULL,last_counter=?,version=version+1,recovery_hashes=? WHERE id='owner'").run(state.pending_secret,Math.floor(now/30000)+delta,JSON.stringify(recoveryCodes.map(codeHash)));
  const updated=await securityState(db);await db.exec('COMMIT');return {state:updated,recoveryCodes};
 }catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
}
export async function disableMfa(){const db=await database();try{await db.prepare("UPDATE admin_security SET enabled=0,encrypted_secret=NULL,pending_secret=NULL,pending_until=NULL,last_counter=-1,recovery_hashes='[]',version=version+1 WHERE id='owner'").run();return await securityState(db);}finally{await db.close();}}
export async function revokeSessions(){const db=await database();try{await db.prepare("UPDATE admin_security SET version=version+1 WHERE id='owner'").run();return await securityState(db);}finally{await db.close();}}
export function mfaSummary(state:SecurityState){let needsReenrollment=false;if(state.enabled&&state.encrypted_secret)try{unseal(state.encrypted_secret);}catch{needsReenrollment=true;}return {enabled:Boolean(state.enabled),recoveryCodesRemaining:(JSON.parse(state.recovery_hashes) as string[]).length,needsReenrollment};}

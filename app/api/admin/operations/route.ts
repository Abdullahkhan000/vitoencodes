import {cookies} from 'next/headers';
import {authorized,denied,validAdminToken,createSession,SESSION_COOKIE,SESSION_SECONDS} from '../../../../lib/auth';
import {securityState,mfaSummary,verifySecondFactor,beginMfa,confirmMfa,disableMfa,revokeSessions} from '../../../../lib/mfa';
import {consumeLimit,clientKey,RateLimitError} from '../../../../lib/rate-limit';
import {turnstileConfig} from '../../../../lib/turnstile';
import {bulkEdit,historyEntries,undoEdit,qualityReport} from '../../../../lib/catalog-tools';
import {checkMirrors,linkHealth} from '../../../../lib/link-health';
import {analyticsSummary} from '../../../../lib/analytics';
import {monitoringSummary,resolveError,recordError,safeMessage} from '../../../../lib/monitoring';
import {createRecoveryCopy,recoveryCopies,backupPayload,restoreBackup} from '../../../../lib/backups';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
async function setSession(state:Awaited<ReturnType<typeof securityState>>){const jar=await cookies();jar.set(SESSION_COOKIE,createSession(Date.now(),state.signing_secret,state.version,Boolean(state.enabled)),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});}
async function proveOwner(body:Record<string,unknown>,secondFactor=true){if(typeof body.adminToken!=='string'||!validAdminToken(body.adminToken))throw new Error('Confirm your current admin access key.');const state=await securityState();if(secondFactor&&state.enabled&&(typeof body.code!=='string'||body.code.length>128||!await verifySecondFactor(body.code.trim())))throw new Error('Enter a fresh authenticator or recovery code.');return state;}
export async function GET(request:Request){try{if(!await authorized(request))return denied();
 const query=new URL(request.url).searchParams,section=query.get('section')||'security';
 if(section==='security'){const state=await securityState(),captcha=turnstileConfig();return Response.json({...mfaSummary(state),turnstile:{required:captcha.required,ready:captcha.ready},syncTokenConfigured:Boolean(process.env.SYNC_TOKEN),alertsConfigured:Boolean(process.env.ALERT_WEBHOOK_URL),cronConfigured:Boolean(process.env.CRON_SECRET)},{headers});}
 if(section==='history')return Response.json({entries:await historyEntries()},{headers});
 if(section==='links')return Response.json({checks:await linkHealth()},{headers});
 if(section==='quality')return Response.json({issues:await qualityReport()},{headers});
 if(section==='analytics')return Response.json(await analyticsSummary(),{headers});
 if(section==='monitoring')return Response.json(await monitoringSummary(),{headers});
 if(section==='backups')return Response.json({copies:await recoveryCopies(),cronConfigured:Boolean(process.env.CRON_SECRET)},{headers});
 if(section==='download'){const id=query.get('id')||'';return new Response(await backupPayload(id),{headers:{...headers,'Content-Type':'application/json','Content-Disposition':'attachment; filename="vitoencodes-'+id.replace(/[^a-zA-Z0-9-]/g,'')+'.vito-backup"'}});}
 return Response.json({error:'Unknown section.'},{status:400,headers});
 }catch(error){await recordError(error,'/api/admin/operations','admin').catch(()=>{});return Response.json({error:'Could not load these site tools.'},{status:503,headers});}}
export async function POST(request:Request){try{if(!await authorized(request))return denied();
 const text=await request.text();if(text.length>4*1024*1024)return Response.json({error:'Request too large.'},{status:413});const body=JSON.parse(text) as Record<string,unknown>;
 await consumeLimit('operations:'+clientKey(request),40,60000);
 let result:unknown;
 switch(body.action){
  case 'begin-mfa':await proveOwner(body);result=await beginMfa();break;
  case 'confirm-mfa':await proveOwner(body,false);{const enrolled=await confirmMfa(String(body.newCode||''));await setSession(enrolled.state);result={enabled:true,recoveryCodes:enrolled.recoveryCodes};}break;
  case 'disable-mfa':await proveOwner(body);await setSession(await disableMfa());result={enabled:false};break;
  case 'revoke-sessions':await proveOwner(body);await setSession(await revokeSessions());result={revoked:true};break;
  case 'bulk-preview':result=await bulkEdit(body.ids,body.changes);break;
  case 'bulk-apply':if(typeof body.previewToken!=='string')throw new Error('Preview the changes first.');result=await bulkEdit(body.ids,body.changes,body.previewToken);break;
  case 'undo':result=await undoEdit(String(body.id||''));break;
  case 'check-links':await consumeLimit('link-checks:global',3,60000);if(body.ids!==undefined&&(!Array.isArray(body.ids)||body.ids.length>20||body.ids.some(value=>typeof value!=='string'||value.length>500)))throw new Error('Select up to 20 releases.');result=await checkMirrors(body.ids as string[]|undefined);break;
  case 'resolve-error':await resolveError(String(body.id||''));result={resolved:true};break;
  case 'backup-create':result=await createRecoveryCopy();break;
  case 'backup-preview':if(typeof body.payload!=='string')throw new Error('Choose an encrypted backup file.');result=await restoreBackup(body.payload,undefined,typeof body.backupKey==='string'?body.backupKey:undefined);break;
  case 'backup-restore':await proveOwner(body);if(body.confirm!=='RESTORE'||typeof body.payload!=='string'||typeof body.previewToken!=='string')throw new Error('Preview this restore and type RESTORE to confirm.');result=await restoreBackup(body.payload,body.previewToken,typeof body.backupKey==='string'?body.backupKey:undefined);break;
  default:throw new Error('Unknown operation.');
 }
 if(['bulk-apply','undo','backup-restore'].includes(String(body.action))){const {revalidateTag}=await import('next/cache');revalidateTag('public-catalog',{expire:0});}
 return Response.json(result,{headers});
 }catch(error){if(error instanceof RateLimitError)return Response.json({error:error.message},{status:429,headers:{...headers,'Retry-After':String(error.retryAfter)}});if(error&&typeof error==='object'&&'code' in error){await recordError(error,'/api/admin/operations','admin').catch(()=>{});return Response.json({error:'Operation failed. Check monitoring for details.'},{status:503,headers});}return Response.json({error:safeMessage(error)},{status:400,headers});}}

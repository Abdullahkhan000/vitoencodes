import {consumeLimit,RateLimitError} from './rate-limit.ts';
import {alertConfiguration,deliverAlert} from './alerts.ts';
import {createHash} from 'node:crypto';
import {database} from './database.ts';
export function safeMessage(error:unknown){let text=error instanceof Error?error.message:String(error);for(const [key,value] of Object.entries(process.env))if(/TOKEN|SECRET|PASSWORD|DATABASE_URL|API_KEY/.test(key)&&value&&value.length>6)text=text.replaceAll(value,'[redacted]');return text.replace(/postgres(?:ql)?:\/\/\S+/gi,'[database]').replace(/https?:\/\/[^\s)]+/gi,'[url]').replace(/(?:token|password|secret|key)\s*[:=]\s*\S+/gi,'[redacted]').slice(0,300);}
export async function recordError(error:unknown,path='/',kind='server'){
 const message=safeMessage(error),route=path.split('?')[0].slice(0,200),id=createHash('sha256').update(kind+'|'+route+'|'+message).digest('hex'),now=new Date().toISOString();
 const db=await database();try{
  await db.prepare('INSERT INTO app_errors(id,kind,path,message,first_seen,last_seen,total) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,total=app_errors.total+1,resolved_at=NULL').run(id,kind,route,message,now,now);
 }finally{await db.close();}
 const configured=alertConfiguration().alertsConfigured;
  if(configured){
   try{await consumeLimit('error-alert:'+id,1,15*60000);}catch(error){if(error instanceof RateLimitError)return;throw error;}
   const text='VITOENCODES: '+kind+' error at '+route+' - '+message;
   await deliverAlert('VITOENCODES: '+kind+' error',text).catch(()=>console.warn('Monitoring alert delivery failed. Check the alert provider settings.'));
  }
}
export async function monitoringSummary(){const db=await database();try{return {...alertConfiguration(),cronConfigured:Boolean(process.env.CRON_SECRET),errors:await db.prepare('SELECT id,kind,path,message,first_seen,last_seen,total,resolved_at FROM app_errors ORDER BY last_seen DESC LIMIT 50').all()};}finally{await db.close();}}
export async function resolveError(id:string){const db=await database();try{await db.prepare('UPDATE app_errors SET resolved_at=? WHERE id=?').run(new Date().toISOString(),id);}finally{await db.close();}}

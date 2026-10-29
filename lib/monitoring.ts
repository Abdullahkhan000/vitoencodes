import {createHash,randomUUID} from 'node:crypto';
import {database} from './database.ts';
export function safeMessage(error:unknown){let text=error instanceof Error?error.message:String(error);for(const [key,value] of Object.entries(process.env))if(/TOKEN|SECRET|PASSWORD|DATABASE_URL|API_KEY/.test(key)&&value&&value.length>6)text=text.replaceAll(value,'[redacted]');return text.replace(/postgres(?:ql)?:\/\/\S+/gi,'[database]').replace(/https?:\/\/[^\s)]+/gi,'[url]').replace(/(?:token|password|secret|key)\s*[:=]\s*\S+/gi,'[redacted]').slice(0,300);}
export async function recordError(error:unknown,path='/',kind='server'){
 const message=safeMessage(error),route=path.split('?')[0].slice(0,200),id=createHash('sha256').update(kind+'|'+route+'|'+message).digest('hex'),now=new Date().toISOString();
 const db=await database();try{
  const previous=await db.prepare('SELECT last_seen FROM app_errors WHERE id=?').get(id);
  await db.prepare('INSERT INTO app_errors(id,kind,path,message,first_seen,last_seen,total) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,total=app_errors.total+1,resolved_at=NULL').run(id,kind,route,message,now,now);
  const webhook=process.env.ALERT_WEBHOOK_URL;
  if(webhook&&(!previous||Date.now()-Date.parse(String(previous.last_seen))>15*60000)){
   const url=new URL(webhook);if(url.protocol==='https:'){
    const text='VITOENCODES: '+kind+' error at '+route+' - '+message;
    await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,content:text}),signal:AbortSignal.timeout(5000)}).catch(()=>{});
   }
  }
 }finally{await db.close();}
}
export async function monitoringSummary(){const db=await database();try{return {alertsConfigured:Boolean(process.env.ALERT_WEBHOOK_URL),cronConfigured:Boolean(process.env.CRON_SECRET),errors:await db.prepare('SELECT id,kind,path,message,first_seen,last_seen,total,resolved_at FROM app_errors ORDER BY last_seen DESC LIMIT 50').all()};}finally{await db.close();}}
export async function resolveError(id:string){const db=await database();try{await db.prepare('UPDATE app_errors SET resolved_at=? WHERE id=?').run(new Date().toISOString(),id);}finally{await db.close();}}

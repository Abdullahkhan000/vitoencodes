import {createHash} from 'node:crypto';
import {database,type Database} from './database.ts';
export class RateLimitError extends Error{retryAfter:number;constructor(retryAfter:number){super('Too many requests. Please try again shortly.');this.retryAfter=retryAfter;}}
export function clientKey(request:Request){
 const raw=(process.env.VERCEL?(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')):request.headers.get('x-forwarded-for'))?.split(',')[0]?.trim()||'unknown';
 return createHash('sha256').update((process.env.ADMIN_TOKEN||'local-rate-limit')+'|'+raw).digest('hex');
}
export async function consumeLimit(bucket:string,limit:number,windowMs:number,now=Date.now(),dbOverride?:Database){
 const db=dbOverride||await database();
 try{
  if(!dbOverride)await db.exec('BEGIN IMMEDIATE');
  const current=await db.prepare('SELECT hits,reset_at FROM rate_limits WHERE bucket=?').get(bucket) as {hits:number;reset_at:number}|undefined;
  const reset=!current||Number(current.reset_at)<=now;
  if(!reset&&current.hits>=limit)throw new RateLimitError(Math.max(1,Math.ceil((Number(current.reset_at)-now)/1000)));
  await db.prepare('INSERT INTO rate_limits(bucket,hits,reset_at) VALUES(?,?,?) ON CONFLICT(bucket) DO UPDATE SET hits=excluded.hits,reset_at=excluded.reset_at').run(bucket,reset?1:current!.hits+1,reset?now+windowMs:Number(current!.reset_at));
  if(!dbOverride)await db.exec('COMMIT');
 }catch(error){if(!dbOverride&&db.isTransaction)await db.exec('ROLLBACK');throw error;}
 finally{if(!dbOverride)await db.close();}
}

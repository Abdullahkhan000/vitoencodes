import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {database,type Database} from './database.ts';
import {consumeLimit} from './rate-limit.ts';
import {siteUrl} from './site-url.ts';
import {gmailNewsletterConfig,sendGmailNewsletter} from './newsletter-gmail.ts';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function newsletterConfig(){
 const provider=process.env.NEWSLETTER_PROVIDER==='gmail'?'gmail':'resend',gmail=gmailNewsletterConfig();
 const sender=provider==='gmail'?gmail.sender:process.env.NEWSLETTER_FROM?.trim()||'',origin=siteUrl();
 let validOrigin=false;try{const url=new URL(origin);validOrigin=url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/';}catch{}
 return {ready:validOrigin&&(provider==='gmail'?gmail.ready:Boolean(process.env.RESEND_API_KEY&&sender&&!/[\r\n]/.test(sender)&&!sender.includes('@resend.dev'))),provider,sender,origin:origin.replace(/\/$/,'')};
}
async function sendEmail(to:string,subject:string,text:string,key:string,unsubscribe?:string,send:typeof fetch=fetch){
 const config=newsletterConfig();if(!config.ready)throw new Error('Newsletter is not configured yet. Please try again later.');
 if(config.provider==='gmail'){
  await consumeLimit('newsletter:gmail-daily',250,86400000);
  await sendGmailNewsletter(to,subject,text,key,unsubscribe);return;
 }
 const response=await send('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:config.sender,to:[to],subject,text,...(unsubscribe?{headers:{'List-Unsubscribe':'<'+unsubscribe+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})}),signal:AbortSignal.timeout(7000)});
 if(!response.ok)throw new Error('Email delivery is temporarily unavailable. Please try again later.');
 const result=await response.json();if(typeof result.id!=='string'||!result.id)throw new Error('Email delivery was not confirmed.');
}
export async function subscribeNewsletter(input:unknown,client:string,send:typeof fetch=fetch){
 if(!newsletterConfig().ready)throw new Error('Newsletter is not configured yet. Please try again later.');
 if(typeof input!=='string'||input.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input))throw new Error('Enter a valid email address.');
 const email=input.trim().toLowerCase();
 await consumeLimit('newsletter-ip:'+client,5,3600000);await consumeLimit('newsletter-email:'+hash(email),1,900000);await consumeLimit('newsletter-global',100,3600000);
 const db=await database(),token=randomBytes(32).toString('hex'),now=Date.now();let id='';
 try{
  await db.exec('BEGIN IMMEDIATE');
  const existing=await db.prepare('SELECT id,state FROM newsletter_subscribers WHERE email=?').get(email);
  if(existing?.state==='active'){await db.exec('COMMIT');return;}
  id=String(existing?.id||randomUUID());
  await db.prepare("INSERT INTO newsletter_subscribers(id,email,state,confirm_hash,confirm_until,unsubscribe_token,created_at) VALUES(?,?,'pending',?,?,?,?) ON CONFLICT(email) DO UPDATE SET state='pending',confirm_hash=excluded.confirm_hash,confirm_until=excluded.confirm_until").run(id,email,hash(token),now+86400000,randomBytes(32).toString('hex'),now);
  await db.exec('COMMIT');
 }catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
 await sendEmail(email,'Confirm your VITOENCODES release alerts','You requested emails when a new encode is published. Confirm within 24 hours:\n\n'+newsletterConfig().origin+'/newsletter?confirm='+token+'\n\nIf this was not you, ignore this email. You will not receive release alerts without confirmation.','confirm:'+id+':'+hash(token),undefined,send);
}
export async function confirmNewsletter(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 const db=await database();try{return (await db.prepare("UPDATE newsletter_subscribers SET state='active',confirmed_at=?,confirm_hash=NULL,confirm_until=0 WHERE confirm_hash=? AND state='pending' AND confirm_until>?").run(Date.now(),hash(token),Date.now())).changes>0;}finally{await db.close();}
}
export async function unsubscribeNewsletter(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 const db=await database();try{return (await db.prepare("UPDATE newsletter_subscribers SET state='unsubscribed',confirm_hash=NULL,confirm_until=0 WHERE unsubscribe_token=?").run(token)).changes>0;}finally{await db.close();}
}
// Called inside the publication transaction. The durable marker prevents mail on
// edits/republication; subscriber membership is captured at publication time.
export async function queueReleaseNewsletter(db:Database,id:string){
 const row=await db.prepare("SELECT title,year,resolution,category,size,status FROM releases WHERE id=?").get(id);
 if(!row||row.status!=='published')return;
 if(!(await db.prepare('INSERT INTO newsletter_releases(release_id) VALUES(?) ON CONFLICT(release_id) DO NOTHING').run(id)).changes)return;
 const config=newsletterConfig();if(!config.ready)return;
 const now=Date.now(),subject=('New release: '+row.title).replace(/[\r\n]/g,' ').slice(0,200);
 const body=String(row.title)+(row.year?' ('+row.year+')':'')+'\n'+[row.resolution,row.category,row.size].join(' · ')+'\n\nChoose your encode:\n'+config.origin+'/movies/'+encodeURIComponent(id)+'?release='+encodeURIComponent(id);
 await db.prepare("INSERT INTO newsletter_deliveries(id,subscriber_id,release_id,subject,body,next_at,created_at) SELECT ? || ':' || id,id,?,?,?, ?,? FROM newsletter_subscribers WHERE state='active'").run(randomUUID(),id,subject,body,now,now);
}
export async function processNewsletter(send:typeof fetch=fetch){
 if(!newsletterConfig().ready)return {sent:0,failed:0,configured:false};
 let sent=0,failed=0;const deadline=Date.now()+20000;
 for(let i=0;i<25&&Date.now()<deadline;i++){
  const db=await database();let job:Record<string,unknown>|undefined;
  try{
   await db.exec('BEGIN IMMEDIATE');
   // Never retry past the provider's 24-hour idempotency window automatically.
   job=await db.prepare("SELECT d.*,s.email,s.unsubscribe_token FROM newsletter_deliveries d JOIN newsletter_subscribers s ON s.id=d.subscriber_id JOIN releases r ON r.id=d.release_id WHERE d.state='pending' AND d.next_at<=? AND (d.attempts=0 OR d.created_at>?) AND d.attempts<5 AND s.state='active' AND d.created_at>=s.confirmed_at AND r.status='published' ORDER BY d.created_at LIMIT 1").get(Date.now(),Date.now()-23*3600000);
   if(job)await db.prepare('UPDATE newsletter_deliveries SET state=?,next_at=?,created_at=CASE WHEN attempts=0 THEN ? ELSE created_at END,attempts=attempts+1 WHERE id=?').run(newsletterConfig().provider==='gmail'?'review':'pending',Date.now()+120000,Date.now(),String(job.id));
   await db.exec('COMMIT');
  }catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
  if(!job)break;
  const url=newsletterConfig().origin+'/api/newsletter/unsubscribe?token='+job.unsubscribe_token;
  try{
   await sendEmail(String(job.email),String(job.subject),String(job.body)+'\n\nUnsubscribe:\n'+newsletterConfig().origin+'/newsletter?unsubscribe='+job.unsubscribe_token,'release:'+job.id,url,send);
   const done=await database();try{await done.prepare("UPDATE newsletter_deliveries SET state='sent' WHERE id=?").run(String(job.id));}finally{await done.close();}sent++;
   }catch{failed++;break;}
  // Leave room under the provider's default request-per-second allowance.
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 return {sent,failed,configured:true};
}

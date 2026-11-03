import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../lib/database.ts';
import {addRelease,updateRelease} from '../lib/store.ts';
import {changeVisibility} from '../lib/publishing.ts';
import {subscribeNewsletter,confirmNewsletter,unsubscribeNewsletter,processNewsletter} from '../lib/newsletter.ts';

test('newsletter verifies consent ownership, queues once, retries, and respects unsubscribe',async()=>{
 process.env.RESEND_API_KEY='test-only';process.env.NEWSLETTER_FROM='Archive <releases@example.com>';process.env.SITE_URL='https://example.com';
 const mail:Record<string,unknown>[]=[],keys:string[]=[];
 const send:typeof fetch=async(_url,init)=>{mail.push(JSON.parse(String(init?.body)));keys.push(new Headers(init?.headers).get('Idempotency-Key')||'');return Response.json({id:'accepted'});};
 await subscribeNewsletter('reader@example.com','reader',send);
 assert.equal(mail.length,1);
 const token=String(mail[0].text).match(/confirm=([a-f0-9]{64})/)![1];
 const db=await database();try{const row=await db.prepare('SELECT state,confirm_hash FROM newsletter_subscribers WHERE email=?').get('reader@example.com');assert.equal(row?.state,'pending');assert.notEqual(row?.confirm_hash,token);}finally{await db.close();}
 assert.equal(await confirmNewsletter('0'.repeat(64)),false);assert.equal(await confirmNewsletter(token),true);assert.equal(await confirmNewsletter(token),false);
 await addRelease({id:'newsletter-release',title:'New film',filename:'film.mkv',year:2026,category:'IMAX',resolution:'1080p',size:'2 GB'});
 await updateRelease('newsletter-release','New film',[{label:'Mirror',url:'https://example.com/file'}],'published');
 const rejected:typeof fetch=async()=>new Response(null,{status:503});
 assert.equal((await processNewsletter(rejected)).failed,1);
 const retry=await database();try{await retry.prepare('UPDATE newsletter_deliveries SET next_at=0').run();}finally{await retry.close();}
 assert.equal((await processNewsletter(send)).sent,1);assert.equal((await processNewsletter(send)).sent,0);
 assert.equal(mail.length,2);assert.match(String(mail[1].text),/New film/);assert.equal((mail[1].to as string[]).length,1);
 await changeVisibility(['newsletter-release'],'draft');await changeVisibility(['newsletter-release'],'published');assert.equal((await processNewsletter(send)).sent,0);
 const unsubscribe=String(mail[1].text).match(/unsubscribe=([a-f0-9]{64})/)![1];assert.equal(await unsubscribeNewsletter(unsubscribe),true);
 await addRelease({id:'newsletter-second',title:'Second',filename:'second.mkv',year:2026,category:'IMAX',resolution:'1080p',size:'2 GB'});
 await updateRelease('newsletter-second','Second',[{label:'Mirror',url:'https://example.com/file'}],'published');assert.equal((await processNewsletter(send)).sent,0);
 assert.ok(keys.every(Boolean));
 delete process.env.NEWSLETTER_FROM;delete process.env.RESEND_API_KEY;
});

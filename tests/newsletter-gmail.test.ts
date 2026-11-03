import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {gmailNewsletterConfig,gmailTransportOptions,sendGmailNewsletter} from '../lib/newsletter-gmail.ts';
import {newsletterConfig} from '../lib/newsletter.ts';
import {processNewsletter} from '../lib/newsletter.ts';
import {database} from '../lib/database.ts';
import {addRelease,updateRelease} from '../lib/store.ts';

test('domain-free Gmail mail has VITOENCODES identity, TLS, one recipient and unsubscribe headers',async()=>{
 process.env.NEWSLETTER_PROVIDER='gmail';process.env.GMAIL_USER='archive@gmail.com';process.env.GMAIL_APP_PASSWORD='abcd efgh ijkl mnop';
 assert.equal(newsletterConfig().ready,true);assert.equal(newsletterConfig().provider,'gmail');
 const options=gmailTransportOptions();assert.equal(options.host,'smtp.gmail.com');assert.equal(options.secure,true);assert.equal(options.port,465);assert.equal(options.auth.pass,'abcdefghijklmnop');
 const transport=nodemailer.createTransport({jsonTransport:true});let rendered:Record<string,unknown>|undefined;
 await sendGmailNewsletter('reader@example.com','New encode','Film is live','release:unique','https://example.com/unsubscribe',async mail=>{const result=await transport.sendMail(mail);rendered=JSON.parse(String(result.message));return {accepted:['reader@example.com']};});
 assert.deepEqual(rendered?.from,{address:'archive@gmail.com',name:'VITOENCODES'});assert.equal((rendered?.to as unknown[]).length,1);
 assert.equal((rendered?.headers as Record<string,string>)['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
 await assert.rejects(sendGmailNewsletter('reader@example.com','Subject','Body','key',undefined,async()=>({accepted:[]})),/not confirmed/);
 process.env.GMAIL_APP_PASSWORD='ordinary-password';assert.equal(gmailNewsletterConfig().ready,false);assert.equal(newsletterConfig().ready,false);
 delete process.env.GMAIL_USER;delete process.env.GMAIL_APP_PASSWORD;delete process.env.NEWSLETTER_PROVIDER;
});

test('ambiguous Gmail failures require review instead of risking duplicate delivery',async()=>{
 process.env.NEWSLETTER_PROVIDER='gmail';process.env.GMAIL_USER='archive@gmail.com';process.env.GMAIL_APP_PASSWORD='abcdefghijklmnop';
 const db=await database();try{await db.prepare("INSERT INTO newsletter_subscribers(id,email,state,confirm_until,unsubscribe_token,created_at,confirmed_at) VALUES(?,?,'active',0,?,?,?)").run('smtp-reader','smtp-reader@example.com','1'.repeat(64),1,1);}finally{await db.close();}
 await addRelease({id:'smtp-failure',title:'SMTP test',filename:'smtp.mkv',year:2026,category:'IMAX',resolution:'1080p',size:'1 GB'});
 await updateRelease('smtp-failure','SMTP test',[{label:'Mirror',url:'https://example.com/file'}],'published');
 const stub=mock.method(nodemailer,'createTransport',()=>({sendMail:async()=>{throw new Error('Ambiguous timeout');},close(){}}));
 try{
  assert.equal((await processNewsletter()).failed,1);
  assert.equal((await processNewsletter()).failed,0);
  assert.equal(stub.mock.callCount(),1);
  const check=await database();try{assert.equal((await check.prepare('SELECT state FROM newsletter_deliveries WHERE release_id=?').get('smtp-failure'))?.state,'review');}finally{await check.close();}
 }finally{stub.mock.restore();delete process.env.NEWSLETTER_PROVIDER;delete process.env.GMAIL_USER;delete process.env.GMAIL_APP_PASSWORD;}
});

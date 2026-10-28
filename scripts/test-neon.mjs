import env from '@next/env';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createAppClient} from './neon-test-http.mjs';
import {database,postgresUrl,postgresPool} from '../lib/database.ts';
import {cacheMovieMetadata,readMovieMetadataCache} from '../lib/store.ts';
import {cacheGdflixFiles,savedGdflixPack} from '../lib/gdflix-files.ts';
env.loadEnvConfig(process.cwd());
const marker='neon-check-'+randomUUID();
let server,db,releaseId,issueId;
let stage='configuration';
const fixtureFile='https://gdflix.io/file/'+marker;
try{
 assert.ok(postgresUrl(),'Postgres must be configured; SQLite cannot satisfy this test.');
 assert.ok(process.env.ADMIN_TOKEN?.length>=32,'ADMIN_TOKEN must be configured.');
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const base='http://127.0.0.1:'+port;
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
 let startupError;server.on('error',error=>{startupError=error;});
 // Drain logs without echoing credentials or private database errors.
 server.stdout.on('data',()=>{});server.stderr.on('data',()=>{});
 let ready=false;
 for(let attempt=0;attempt<80;attempt++){
  if(startupError)throw startupError;
  if(server.exitCode!==null)throw new Error('Production server exited before becoming ready.');
  try{const result=await fetch(base+'/api/admin/session',{signal:AbortSignal.timeout(1000)});if(result.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Production server must start.');
 console.log('PASS: production app started.');
 const call=createAppClient(base,process.env.ADMIN_TOKEN);
 stage='Postgres connection';
 db=await database();assert.equal(db.postgres,true);
 assert.equal((await db.prepare('SELECT 1 AS n').get()).n,1);
 console.log('PASS: app environment connects to Postgres.');
 stage='catalog and publishing';
 const filename=marker+'.2026.1080p.mkv';
 await call('/api/catalog',{filename,title:marker,year:2026,category:'Other',resolution:'1080p',size:'1 GB'},true);
 const privateRows=(await call('/api/catalog?admin=1',undefined,true)).releases;
 releaseId=privateRows.find(row=>row.filename===filename)?.id;
 assert.ok(releaseId,'The API must persist the new release.');
 assert.ok(!(await call('/api/catalog')).releases.some(row=>row.id===releaseId),'Draft must be private.');
 const persisted=await db.prepare('SELECT status FROM releases WHERE id=?').get(releaseId);assert.equal(persisted.status,'draft');
 await call('/api/catalog',{action:'update',id:releaseId,title:marker,links:[{label:'Verification fixture',url:'https://example.com/'+marker}],status:'published',details:{synopsis:'Temporary Neon verification record.',genres:'Adventure'}},true);
 assert.ok((await call('/api/catalog')).releases.some(row=>row.id===releaseId&&row.details.genres==='Adventure'));
 const page=await fetch(base+'/movies/'+encodeURIComponent(releaseId));assert.equal(page.status,200);assert.ok((await page.text()).includes(marker));
 console.log('PASS: API create, private draft, Postgres persistence, publish and movie page.');
 stage='settings and caches';
 const domainSettings=await call('/api/admin/download-domains',undefined,true);assert.ok(domainSettings.domain);
 await cacheMovieMetadata(marker,{synopsis:marker});assert.equal((await readMovieMetadataCache(marker)).synopsis,marker);
 await cacheGdflixFiles([{filename,title:marker,year:2026,category:'Other',resolution:'1080p',size:'1 GB',encoder:'Unknown',url:fixtureFile,provider:'GDFlix'}],'Saved GDFlix pack listing: '+marker);
 assert.equal((await savedGdflixPack('https://gdflix.io/pack/'+marker)).entries.length,1);
 console.log('PASS: domain settings, metadata cache and saved import cache.');
 stage='contact submission';
 const report=await call('/api/contact',{name:'Neon verification',email:'',category:'Website problem',subject:marker,message:'Temporary report for the Neon end-to-end verification.',page:''});
 assert.match(report.reference,/^[A-F0-9]{8}$/);
 issueId=(await db.prepare('SELECT id FROM support_issues WHERE subject=?').get(marker))?.id;
 assert.ok(issueId,'Contact submission must persist the report in Postgres.');
 stage='private support inbox';
 assert.ok((await call('/api/admin/support',undefined,true)).issues.some(issue=>issue.id===issueId),'Submitted report must appear in the private inbox.');
 stage='support resolution';
 await call('/api/admin/support',{id:issueId,status:'closed'},true);
 assert.equal((await db.prepare('SELECT status FROM support_issues WHERE id=?').get(issueId)).status,'closed');
 console.log('PASS: contact submission, private inbox and report resolution.');
 console.log('Neon end-to-end verification passed.');
}catch(error){
 const networkError=['EACCES','EPERM','ENOTFOUND','ECONNREFUSED','ETIMEDOUT','ECONNRESET'].includes(error.code);
 console.error('Neon verification FAILED ['+stage+'] ('+(error.code||'check')+'). '+(networkError?'Check network access and the configured database.':error.message));
 process.exitCode=1;
}finally{
 if(db){
  try{
   // Only records with this run's random marker can be removed.
   await db.prepare('DELETE FROM releases WHERE filename=?').run(marker+'.2026.1080p.mkv');
   await db.prepare('DELETE FROM support_issues WHERE subject=?').run(marker);
   await db.prepare('DELETE FROM movie_metadata_cache WHERE cache_key=?').run(marker);
   await db.prepare('DELETE FROM import_file_cache WHERE url=?').run(fixtureFile);
   console.log('Temporary verification records removed.');
  }catch{console.error('Could not clean up all verification records for '+marker);process.exitCode=1;}
  await db.close();
 }
 if(server){const stopped=once(server,'exit');server.kill();await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,5000))]);}
 try{await postgresPool().end();}catch{}
}

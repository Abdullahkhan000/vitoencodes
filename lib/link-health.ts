import {lookup} from 'node:dns/promises';
import type {LookupFunction} from 'node:net';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import {createHash} from 'node:crypto';
import {database} from './database.ts';
import {listReleases} from './store.ts';
export type LinkState='reachable'|'broken'|'unverified'|'reported';
export function publicAddress(address:string){try{return ipaddr.process(address).range()==='unicast';}catch{return false;}}
export async function publicTarget(value:string,resolve:typeof lookup=lookup){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.href.length>4096)throw new Error('Only public HTTPS mirrors can be checked.');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');const addresses=await Promise.race([resolve(hostname,{all:true}),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('DNS timeout')),3000);timer.unref();})]);
 if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw new Error('Private and reserved network addresses are blocked.');
 return {url,address:addresses[0]};
}
export async function probeMirror(value:string):Promise<{state:LinkState;status:number|null;note:string}>{
 if(value.startsWith('magnet:'))return {state:'unverified',status:null,note:'Magnet availability requires a torrent client.'};
 let current=value;const deadline=Date.now()+9000;
 try{
  for(let attempt=0;attempt<4;attempt++){
   if(Date.now()>=deadline)throw new Error('Timeout');
   const {url,address}=await publicTarget(current);
   const result=await new Promise<{status:number;location?:string}>((resolve,reject)=>{
    const request=https.request(url,{method:'HEAD',headers:{'User-Agent':'VITOENCODES-LinkCheck/1.0',Accept:'*/*'},lookup:((_host,options,callback)=>{
     const done=callback as (...args:unknown[])=>void;
     if(typeof options==='object'&&options&&'all' in options&&options.all)done(null,[address]);else done(null,address.address,address.family);
    }) as LookupFunction},response=>{const status=response.statusCode||0,location=response.headers.location;response.destroy();resolve({status,location});});
    request.setTimeout(Math.max(1,Math.min(5000,deadline-Date.now())),()=>request.destroy(new Error('Timeout')));request.on('error',reject);request.end();
   });
   if([301,302,303,307,308].includes(result.status)&&result.location){current=new URL(result.location,current).href;continue;}
   if(result.status>=200&&result.status<300)return {state:'reachable',status:result.status,note:'Provider responded to a safe HEAD request; file contents were not downloaded.'};
   if([404,410].includes(result.status))return {state:'broken',status:result.status,note:'Provider reports this address is missing.'};
   return {state:'unverified',status:result.status,note:'Provider blocked or could not confirm a safe availability check.'};
  }
  return {state:'unverified',status:null,note:'Too many redirects.'};
 }catch{return {state:'unverified',status:null,note:'Address could not be safely reached or verified.'};}
}
const hash=(url:string)=>createHash('sha256').update(url).digest('hex');
export async function checkMirrors(ids?:string[],limit=12,probe:typeof probeMirror=probeMirror){
 const rows=await listReleases();const db=await database();try{
  const known=await db.prepare('SELECT release_id,url_hash,checked_at,state FROM link_health').all();
  const targets=rows.filter(row=>!ids||ids.includes(row.id)).flatMap(row=>row.links.map(link=>({releaseId:row.id,url:link.url,previous:known.find(check=>check.release_id===row.id&&check.url_hash===hash(link.url))})));
  targets.sort((a,b)=>(a.previous?.state==='reported'?-1:0)-(b.previous?.state==='reported'?-1:0)||String(a.previous?.checked_at||'').localeCompare(String(b.previous?.checked_at||'')));
  const selected=targets.slice(0,Math.min(20,limit));let index=0;
  await Promise.all(Array.from({length:Math.min(3,selected.length)},async()=>{while(index<selected.length){const item=selected[index++],result=await probe(item.url);await db.prepare('INSERT INTO link_health(release_id,url_hash,url,state,http_status,checked_at,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(release_id,url_hash) DO UPDATE SET url=excluded.url,state=excluded.state,http_status=excluded.http_status,checked_at=excluded.checked_at,note=excluded.note').run(item.releaseId,hash(item.url),item.url,result.state,result.status,new Date().toISOString(),result.note);}}));
  return {checked:selected.length,remaining:Math.max(0,targets.length-selected.length)};
 }finally{await db.close();}
}
export async function linkHealth(){const db=await database();try{return await db.prepare('SELECT release_id,url,state,http_status,checked_at,note FROM link_health ORDER BY checked_at DESC LIMIT 300').all();}finally{await db.close();}}
export async function publicLinkHealth(id:string){const db=await database();try{
 const release=await db.prepare("SELECT links FROM releases WHERE id=? AND status='published'").get(id);if(!release)return [];
 const links=JSON.parse(String(release.links)) as {url:string}[];
 return (await db.prepare('SELECT url,state,checked_at FROM link_health WHERE release_id=?').all(id)).filter(row=>links.some(link=>link.url===row.url));
 }finally{await db.close();}}
export async function reportMirror(url:string){const rows=await listReleases(true),matches=rows.filter(row=>row.links.some(link=>link.url===url));if(!matches.length)return;const db=await database();try{for(const row of matches)await db.prepare('INSERT INTO link_health(release_id,url_hash,url,state,http_status,checked_at,note) VALUES(?,?,?,?,NULL,?,?) ON CONFLICT(release_id,url_hash) DO UPDATE SET state=excluded.state,checked_at=excluded.checked_at,note=excluded.note').run(row.id,hash(url),url,'reported',new Date().toISOString(),'A visitor reported this mirror. Awaiting verification.');}finally{await db.close();}}

export async function reportReleasePage(value:string,origin:string){try{const url=new URL(value);if(url.origin!==origin)return;const id=url.searchParams.get('release')||decodeURIComponent(url.pathname.split('/movies/')[1]||'');if(!id)return;const rows=await listReleases(true),row=rows.find(row=>row.id===id);if(row)for(const link of row.links)await reportMirror(link.url);}catch{}}

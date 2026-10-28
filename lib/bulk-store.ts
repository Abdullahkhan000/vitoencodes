import {readHubDriveSettings} from './download-settings.ts';
import {normalizeHubDriveLink} from './hubdrive.ts';
﻿import {createHash} from 'node:crypto';
import {database} from './store.ts';
import type {BulkEntry} from './bulk-links.ts';
export async function importBulkLinks(entries:BulkEntry[]){
 const db=(await database());let created=0,updated=0,unchanged=0;const ids:string[]=[];
 try{
  (await db.exec('BEGIN IMMEDIATE'));
  const settings=(await readHubDriveSettings(db));entries=entries.map(entry=>({...entry,url:normalizeHubDriveLink(entry.url,settings)}));
  for(const entry of entries){
   const existing=(await db.prepare('SELECT id,filename,links FROM releases WHERE lower(filename)=lower(?)').all(entry.filename)) as {id:string;filename:string;links:string}[];
   if(existing.length>1)throw new Error('Multiple records have this exact filename. Review it manually: '+entry.title);
   const owner=((await db.prepare('SELECT id,filename,links FROM releases').all()) as {id:string;filename:string;links:string}[]).find(r=>(JSON.parse(r.links) as {url:string}[]).some(l=>l.url===entry.url));
   if(owner&&owner.filename.toLowerCase()!==entry.filename.toLowerCase())throw new Error('A download link is already assigned to a different filename: '+entry.title);
   const row=existing[0];
   if(row){
    ids.push(row.id);const links=JSON.parse(row.links) as {label:string;url:string}[];
    if(links.some(l=>l.url===entry.url)){unchanged++;continue;}
    if(links.length>=5)throw new Error('Maximum 5 mirrors per encode: '+entry.title);
    links.push({label:entry.provider||'HubDrive',url:entry.url});(await db.prepare('UPDATE releases SET links=? WHERE id=?').run(JSON.stringify(links),row.id));updated++;
   }else{
    const id='bulk:'+createHash('sha256').update(entry.filename.toLowerCase()).digest('hex').slice(0,24);ids.push(id);
    (await db.prepare('INSERT INTO releases(id,filename,title,year,category,resolution,size,status,links) VALUES(?,?,?,?,?,?,?,?,?)').run(id,entry.filename,entry.title,entry.year,entry.category,entry.resolution,entry.size,'draft',JSON.stringify([{label:entry.provider||'HubDrive',url:entry.url}])));created++;
   }
  }
  (await db.exec('COMMIT'));return{created,updated,unchanged,ids};
 }catch(error){(await db.exec('ROLLBACK'));throw error;}finally{(await db.close());}
}

import {randomUUID} from 'node:crypto';
import {database} from './store.ts';
import {readHubDriveSettings} from './download-settings.ts';
import {normalizeHubDriveLink,parseHubDriveDomain} from './hubdrive.ts';
export async function hubDriveSettings(){const db=(await database());try{return (await readHubDriveSettings(db));}finally{(await db.close());}}
export async function changeHubDriveDomain(input:string,apply=false){
 const domain=parseHubDriveDomain(input),db=(await database());
 try{
  (await db.exec('BEGIN IMMEDIATE'));
  const previous=(await readHubDriveSettings(db)),settings={domain,knownDomains:[...new Set([...previous.knownDomains,domain])]};
  const rows=(await db.prepare('SELECT id,title,links FROM releases').all()) as {id:string;title:string;links:string}[];
  let changedLinks=0;const updates:{id:string;before:string;after:string}[]=[],samples:{before:string;after:string}[]=[];
  for(const row of rows){let changed=false;const links=(JSON.parse(row.links) as {label:string;url:string}[]).map(link=>{const url=normalizeHubDriveLink(link.url,settings);if(url!==link.url){changed=true;changedLinks++;if(samples.length<5)samples.push({before:link.url,after:url});}return {...link,url};});
   if(changed)updates.push({id:row.id,before:row.links,after:JSON.stringify(links.filter((link,index)=>links.findIndex(other=>other.url===link.url)===index))});
  }
  if(apply){
   if(!db.postgres)(await db.exec('CREATE TABLE IF NOT EXISTS download_domain_history(id TEXT PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,previous_settings TEXT NOT NULL,new_domain TEXT NOT NULL,previous_links TEXT NOT NULL)'));
   if(previous.domain!==domain||updates.length)(await db.prepare('INSERT INTO download_domain_history(id,previous_settings,new_domain,previous_links) VALUES(?,?,?,?)').run(randomUUID(),JSON.stringify(previous),domain,JSON.stringify(updates.map(row=>({id:row.id,links:JSON.parse(row.before)})))));
   for(const row of updates)(await db.prepare('UPDATE releases SET links=? WHERE id=?').run(row.after,row.id));
   (await db.prepare("INSERT INTO download_settings(setting_key,value) VALUES('hubdrive',?) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value").run(JSON.stringify(settings)));
  }
  (await db.exec('COMMIT'));return {domain,previousDomain:previous.domain,changedLinks,changedReleases:updates.length,samples,applied:apply};
 }catch(error){(await db.exec('ROLLBACK'));throw error;}finally{(await db.close());}
}

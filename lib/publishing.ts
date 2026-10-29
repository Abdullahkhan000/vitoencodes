import {snapshots,recordHistory} from './history.ts';
﻿import {database} from './store.ts';
export async function changeVisibility(ids:string[],status:'draft'|'published') {
 if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>typeof id!=='string'||!id))throw new Error('Select between 1 and 500 releases.');
 if(status!=='draft'&&status!=='published')throw new Error('Choose draft or published visibility.');
 const unique=[...new Set(ids)],db=(await database());
 try {
  (await db.exec('BEGIN IMMEDIATE'));
  const before=await snapshots(db,unique);
  const read=db.prepare('SELECT title,links FROM releases WHERE id=?');
  for(const id of unique){
   const row=(await read.get(id)) as {title:string;links:string}|undefined;
   if(!row)throw new Error('A selected release no longer exists. Refresh your library.');
   if(status==='published'){
    const links=JSON.parse(row.links);
    if(!Array.isArray(links)||!links.length||links.length>5||!links.every((link:{label?:unknown;url?:unknown})=>link&&typeof link.label==='string'&&link.label.trim()&&typeof link.url==='string'&&/^(https:\/\/|magnet:\?xt=urn:btih:)/i.test(link.url)))throw new Error(`${row.title} needs a valid download mirror before publishing.`);
   }
  }
  const update=db.prepare('UPDATE releases SET status=? WHERE id=?');
  for(const id of unique)(await update.run(status,id));
  await recordHistory(db,status==='published'?'Publish releases':'Unpublish releases',before,unique);
  (await db.exec('COMMIT'));return unique.length;
 }catch(error){if(db.isTransaction)(await db.exec('ROLLBACK'));throw error;}finally{(await db.close());}
}

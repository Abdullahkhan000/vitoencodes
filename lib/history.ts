import {createHash,randomUUID} from 'node:crypto';
import type {Database} from './database.ts';
export const snapshotColumns=['id','filename','title','year','category','resolution','size','status','links','created_at','poster','metadata_source','updated_at','size_bytes','details'] as const;
type Snapshot=Record<string,unknown>;
export async function snapshots(db:Database,ids:string[]):Promise<Snapshot[]>{
 if(!ids.length)return [];
 return db.prepare('SELECT '+snapshotColumns.join(',')+' FROM releases WHERE id IN ('+ids.map(()=>'?').join(',')+') ORDER BY id').all(...ids);
}
export function stateHash(rows:Snapshot[]){return createHash('sha256').update(JSON.stringify(rows.map(row=>snapshotColumns.map(key=>row[key])))).digest('hex');}
export async function recordHistory(db:Database,action:string,before:Snapshot[],ids:string[],context?:{before:unknown;after:unknown}){
 const after=await snapshots(db,ids);if(stateHash(before)===stateHash(after)&&!context)return;
 await db.prepare('INSERT INTO audit_events(id,action,before_state,after_state,created_at,context) VALUES(?,?,?,?,?,?)').run(randomUUID(),action,JSON.stringify(before),JSON.stringify(after),new Date().toISOString(),JSON.stringify(context||{}));
}
export async function restoreHistory(db:Database,id:string){
 const event=await db.prepare('SELECT before_state,after_state,restored_at,context FROM audit_events WHERE id=?').get(id);
 if(!event||event.restored_at)throw new Error('This history entry cannot be restored.');
 const before=JSON.parse(String(event.before_state)) as Snapshot[],after=JSON.parse(String(event.after_state)) as Snapshot[];
 const ids=[...new Set([...before,...after].map(row=>String(row.id)))];
 const context=JSON.parse(String(event.context||'{}'));
 const settings=context.after?await db.prepare('SELECT setting_key,value FROM download_settings ORDER BY setting_key').all():[];
 if(context.after&&JSON.stringify(settings)!==JSON.stringify(context.after))throw new Error('Download settings changed after this edit. Restore newer changes first.');
 const current=await snapshots(db,ids);
 if(stateHash(current)!==stateHash(after))throw new Error('These releases changed after this edit. Restore their newer history entries first.');
 for(const row of before){
  const columns=snapshotColumns.filter(column=>column!=='id');
  await db.prepare('INSERT INTO releases('+snapshotColumns.join(',')+') VALUES('+snapshotColumns.map(()=>'?').join(',')+') ON CONFLICT(id) DO UPDATE SET '+columns.map(column=>column+'=excluded.'+column).join(',')).run(...snapshotColumns.map(column=>row[column] as string|number|null));
  // Content triggers update dates; restoring history must recover the original dates too.
  await db.prepare('UPDATE releases SET created_at=?,updated_at=? WHERE id=?').run(row.created_at as string,row.updated_at as string|null,String(row.id));
 }
 for(const row of after.filter(row=>!before.some(previous=>previous.id===row.id)))await db.prepare('DELETE FROM releases WHERE id=?').run(String(row.id));
 if(context.before){await db.prepare('DELETE FROM download_settings').run();for(const row of context.before)await db.prepare('INSERT INTO download_settings(setting_key,value) VALUES(?,?)').run(row.setting_key,row.value);}
 await recordHistory(db,'Restore previous edit',current,ids,context.before?{before:settings,after:context.before}:undefined);
 await db.prepare('UPDATE audit_events SET restored_at=? WHERE id=?').run(new Date().toISOString(),id);
 return ids.length;
}

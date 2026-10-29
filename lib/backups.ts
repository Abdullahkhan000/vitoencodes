import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {database,type Database} from './database.ts';
import {snapshotColumns,snapshots,stateHash,recordHistory} from './history.ts';
type Archive={version:1;createdAt:string;releases:Record<string,unknown>[];settings:{setting_key:string;value:string}[]};
function key(value?:string){const secret=value||process.env.BACKUP_ENCRYPTION_KEY||process.env.ADMIN_TOKEN;if(!secret||secret.length<32)throw new Error('Configure a strong backup key before creating a recovery copy.');return createHash('sha256').update('vito-catalog-backup|'+secret).digest();}
export function encryptArchive(archive:Archive){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv),payload=Buffer.concat([cipher.update(gzipSync(JSON.stringify(archive))),cipher.final()]);return JSON.stringify({format:'vitoencodes-catalog-backup',version:1,createdAt:archive.createdAt,count:archive.releases.length,keyHint:createHash('sha256').update(key()).digest('hex').slice(0,8),data:[iv,cipher.getAuthTag(),payload].map(value=>value.toString('base64url')).join('.')});}
export function decryptArchive(text:string,overrideKey?:string):Archive{
 if(text.length>4*1024*1024)throw new Error('This backup exceeds the supported upload size.');
 let archive:Archive;
 try{const envelope=JSON.parse(text);if(envelope.format!=='vitoencodes-catalog-backup'||envelope.version!==1)throw new Error();const [iv,tag,payload]=String(envelope.data).split('.').map((value:string)=>Buffer.from(value,'base64url'));const decipher=createDecipheriv('aes-256-gcm',key(overrideKey),iv);decipher.setAuthTag(tag);archive=JSON.parse(gunzipSync(Buffer.concat([decipher.update(payload),decipher.final()]),{maxOutputLength:16*1024*1024}).toString('utf8'));}catch{throw new Error('Backup could not be decrypted. Check the backup file and its original encryption key.');}
 if(archive.version!==1||!Array.isArray(archive.releases)||archive.releases.length>20000||!Array.isArray(archive.settings))throw new Error('Unsupported backup contents.');
 const ids=new Set();for(const row of archive.releases){
  if(typeof row.id!=='string'||!row.id||row.id.length>500||ids.has(row.id)||typeof row.title!=='string'||!row.title||row.title.length>200||typeof row.filename!=='string'||row.filename.length>500||!['draft','published'].includes(String(row.status)))throw new Error('Invalid release in backup.');ids.add(row.id);
  for(const column of snapshotColumns)if(row[column]!==null&&!['string','number'].includes(typeof row[column]))throw new Error('Invalid backup field.');
  try{const details=JSON.parse(String(row.details)),links=JSON.parse(String(row.links));if(!details||Array.isArray(details)||typeof details!=='object'||!Array.isArray(links)||links.length>5||links.some(link=>typeof link.url!=='string'||typeof link.label!=='string'||!/^(https:\/\/|magnet:\?xt=urn:btih:)/i.test(link.url)))throw new Error();}catch{throw new Error('Invalid movie details or mirrors in backup.');}
 }
 if(archive.settings.some(row=>typeof row.setting_key!=='string'||row.setting_key.length>100||typeof row.value!=='string'||row.value.length>65536))throw new Error('Invalid settings in backup.');return archive;
}
async function archiveFrom(db:Database):Promise<Archive>{const ids=(await db.prepare('SELECT id FROM releases ORDER BY id').all()).map(row=>String(row.id));return {version:1,createdAt:new Date().toISOString(),releases:await snapshots(db,ids),settings:await db.prepare('SELECT setting_key,value FROM download_settings ORDER BY setting_key').all() as {setting_key:string;value:string}[]};}
export async function createRecoveryCopy(dbOverride?:Database){const db=dbOverride||await database();try{
 if(!dbOverride)await db.exec('BEGIN IMMEDIATE');
 // Fresh databases may not have had a download-domain setting saved yet.
 if(!db.postgres)await db.exec('CREATE TABLE IF NOT EXISTS download_settings(setting_key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const archive=await archiveFrom(db),id=randomUUID(),payload=encryptArchive(archive);
 await db.prepare('INSERT INTO catalog_backups(id,created_at,release_count,payload) VALUES(?,?,?,?)').run(id,archive.createdAt,archive.releases.length,payload);
 const old=await db.prepare('SELECT id FROM catalog_backups ORDER BY created_at DESC').all();for(const row of old.slice(7))await db.prepare('DELETE FROM catalog_backups WHERE id=?').run(String(row.id));
 if(!dbOverride)await db.exec('COMMIT');return {id,createdAt:archive.createdAt,count:archive.releases.length};
 }catch(error){if(!dbOverride&&db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{if(!dbOverride)await db.close();}}
export async function recoveryCopies(){const db=await database();try{return await db.prepare('SELECT id,created_at,release_count FROM catalog_backups ORDER BY created_at DESC').all();}finally{await db.close();}}
export async function backupPayload(id:string){const db=await database();try{const row=await db.prepare('SELECT payload FROM catalog_backups WHERE id=?').get(id);if(!row)throw new Error('Recovery copy not found.');return String(row.payload);}finally{await db.close();}}
export async function restoreBackup(payload:string,token?:string,overrideKey?:string){
 const archive=decryptArchive(payload,overrideKey),db=await database();try{
  await db.exec('BEGIN IMMEDIATE');if(!db.postgres)await db.exec('CREATE TABLE IF NOT EXISTS download_settings(setting_key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const current=await archiveFrom(db),expected=createHmac('sha256',process.env.ADMIN_TOKEN||'local-backup').update(stateHash(current.releases)+'|'+JSON.stringify(current.settings)+'|'+createHash('sha256').update(payload).digest('hex')).digest('hex');
  const preview={current:current.releases.length,restored:archive.releases.length,added:archive.releases.filter(row=>!current.releases.some(old=>old.id===row.id)).length,removed:current.releases.filter(row=>!archive.releases.some(restored=>restored.id===row.id)).length};
  if(token===undefined){await db.exec('COMMIT');return {preview,previewToken:expected};}
  if(token!==expected)throw new Error('Catalog changed after the restore preview. Preview again.');
  await createRecoveryCopy(db);
  await db.prepare('DELETE FROM releases').run();
  for(const row of archive.releases){await db.prepare('INSERT INTO releases('+snapshotColumns.join(',')+') VALUES('+snapshotColumns.map(()=>'?').join(',')+')').run(...snapshotColumns.map(column=>row[column] as string|number|null));await db.prepare('UPDATE releases SET updated_at=? WHERE id=?').run(row.updated_at as string|null,String(row.id));}
  await db.prepare('DELETE FROM download_settings').run();
  for(const row of archive.settings)await db.prepare('INSERT INTO download_settings(setting_key,value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value').run(row.setting_key,row.value);
  const affected=[...new Set([...current.releases,...archive.releases].map(row=>String(row.id)))];await recordHistory(db,'Restore catalog recovery copy',current.releases,affected,{before:current.settings,after:[...archive.settings].sort((a,b)=>a.setting_key.localeCompare(b.setting_key))});await db.exec('COMMIT');return {restored:archive.releases.length};
 }catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
}

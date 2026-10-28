import type {Database} from './database.ts';
import {defaultHubDrive,type HubDriveSettings} from './hubdrive.ts';
export async function readHubDriveSettings(db:Database):Promise<HubDriveSettings>{
 if(!db.postgres)(await db.exec('CREATE TABLE IF NOT EXISTS download_settings(setting_key TEXT PRIMARY KEY,value TEXT NOT NULL)'));
 const row=(await db.prepare("SELECT value FROM download_settings WHERE setting_key='hubdrive'").get()) as {value:string}|undefined;
 return row?JSON.parse(row.value):{...defaultHubDrive,knownDomains:[...defaultHubDrive.knownDomains]};
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {database,listReleases,updateRelease} from '../lib/store.ts';
import {changeHubDriveDomain,hubDriveSettings} from '../lib/download-domains.ts';
import {parseBulkLinks} from '../lib/bulk-links.ts';
import {parseHubDriveDomain} from '../lib/hubdrive.ts';
import {importBulkLinks} from '../lib/bulk-store.ts';
process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-domains-'));
test('domain input accepts shorthand and rejects URLs with credentials or paths',()=>{
 assert.equal(parseHubDriveDomain('.pw'),'hubdrive.pw');assert.equal(parseHubDriveDomain('https://hubdrive.bar/'),'hubdrive.bar');
 for(const value of ['evil.com','hubdrive.bar/file/1','https://user@hubdrive.bar','hubdrive.bar:443','.','http://hubdrive.bar'])assert.throws(()=>parseHubDriveDomain(value));
});
test('domain migration preserves releases, backs up links, handles future imports and repeat changes',async ()=>{
 const db=(await database());(await db.prepare('INSERT INTO releases(id,filename,title,year,category,resolution,size,status,links,poster) VALUES(?,?,?,?,?,?,?,?,?,?)').run('one','Dune.2021.1080p.VITO.mkv','Dune',2021,'Other','1080p','5 GB','published',JSON.stringify([{label:'HubDrive',url:'https://hubdrive.bar/file/123'},{label:'Drive',url:'https://drive.google.com/file/d/abc'},{label:'Other',url:'https://hubdrive.bar.evil.com/file/123'}]),'/posters/test.jpg'));(await db.close());
 const preview=(await changeHubDriveDomain('.pw'));assert.equal(preview.changedLinks,1);assert.equal((await hubDriveSettings()).domain,'hubdrive.bar');assert.match((await listReleases())[0].links[0].url,/hubdrive.bar/);
 const result=(await changeHubDriveDomain('.pw',true));assert.equal(result.changedReleases,1);let row=(await listReleases())[0];assert.equal(row.links[0].url,'https://hubdrive.pw/file/123');assert.equal(row.links[1].url,'https://drive.google.com/file/d/abc');assert.equal(row.links[2].url,'https://hubdrive.bar.evil.com/file/123');assert.equal(row.status,'published');assert.equal(row.poster,'/posters/test.jpg');assert.equal(row.size,'5 GB');
 const entries=parseBulkLinks('Dune.2021.1080p.VITO.mkv - 5 GB\nhttps://hubdrive.bar/file/123',(await hubDriveSettings()));assert.equal(entries[0].url,'https://hubdrive.pw/file/123');assert.equal((await importBulkLinks(entries)).unchanged,1);
 (await updateRelease('one','Dune',[{label:'HubDrive',url:'https://hubdrive.bar/file/123'}],'published'));assert.equal((await listReleases())[0].links[0].url,'https://hubdrive.pw/file/123');
 assert.equal((await changeHubDriveDomain('.pw',true)).changedLinks,0);(await changeHubDriveDomain('.bar',true));assert.equal((await listReleases())[0].links[0].url,'https://hubdrive.bar/file/123');
 const audit=(await database());assert.equal(((await audit.prepare('SELECT count(*) AS n FROM download_domain_history').get()) as {n:number}).n,2);(await audit.close());
});

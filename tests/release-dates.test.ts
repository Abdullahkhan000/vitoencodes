import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {database,listReleases,updateRelease,saveImportedMovieDetails} from '../lib/store.ts';
import {dateLabel,timestamp,newestFirst,groupDates} from '../lib/release-dates.ts';
import {groupMovieReleases} from '../lib/library.ts';
process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-release-dates-'));
test('date formatting interprets SQLite timestamps as UTC and renders deterministic PKT',()=>{
 assert.equal(timestamp('2026-10-27 10:30:00')?.toISOString(),'2026-10-27T10:30:00.000Z');
 assert.equal(dateLabel('2026-10-27 10:30:00'),'27 Oct 2026, 15:30 PKT');assert.equal(dateLabel(null),'Not recorded');assert.equal(timestamp('invalid'),null);
});
test('old records keep unknown update history; new records and meaningful edits track dates across write paths',async ()=>{
 const legacy=new DatabaseSync(path.join(process.env.DATA_DIRECTORY!,'catalog.sqlite'));
 legacy.exec("CREATE TABLE releases(id TEXT PRIMARY KEY,filename TEXT NOT NULL,title TEXT NOT NULL,year INTEGER,category TEXT NOT NULL,resolution TEXT NOT NULL,size TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',links TEXT NOT NULL DEFAULT '[]',created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO releases(id,filename,title,year,category,resolution,size,created_at) VALUES('old','Old.2020.mkv','Old',2020,'Other','1080p','5 GB','2020-01-01 00:00:00');");legacy.close();
 assert.equal((await listReleases())[0].updated_at,null);
 const db=(await database());(await db.prepare("INSERT INTO releases(id,filename,title,year,category,resolution,size) VALUES('new','New.2026.mkv','New',2026,'Other','1080p','6 GB')").run());
 const created=(await listReleases()).find(row=>row.id==='new')!;assert.equal(created.updated_at,created.created_at);
 (await db.prepare("UPDATE releases SET updated_at='2001-01-01 00:00:00' WHERE id='new'").run());(await db.close());
 (await updateRelease('new','New',[],'draft'));assert.equal((await listReleases()).find(row=>row.id==='new')!.updated_at,'2001-01-01 00:00:00');
 (await updateRelease('new','New title',[{label:'HubDrive',url:'https://hubdrive.bar/file/99'}],'published'));let edited=(await listReleases()).find(row=>row.id==='new')!;assert.ok(timestamp(edited.updated_at)!.getTime()>timestamp('2001-01-01 00:00:00')!.getTime());assert.equal(edited.created_at,created.created_at);
 (await saveImportedMovieDetails('old',{officialTitle:'Old Film'}));assert.ok(timestamp((await listReleases()).find(row=>row.id==='old')!.updated_at));assert.equal((await listReleases()).find(row=>row.id==='old')!.created_at,'2020-01-01 00:00:00');
});
test('a new encode promotes an existing grouped movie without splitting its versions',()=>{
 const rows=[{id:'old',title:'Dune',year:2021,created_at:'2024-01-01 00:00:00',details:{tmdbId:1}},{id:'other',title:'Other',year:2022,created_at:'2025-01-01 00:00:00',details:{tmdbId:2}},{id:'new',title:'Dune',year:2021,created_at:'2026-01-01 00:00:00',updated_at:'2026-02-01 00:00:00',details:{tmdbId:1}}];
 const groups=groupMovieReleases(rows).map(group=>({...group,...groupDates(group.releases)})).sort(newestFirst);assert.equal(groups.length,2);assert.equal(groups[0].movie.title,'Dune');assert.equal(groups[0].releases.length,2);assert.equal(groups[0].created_at,'2026-01-01 00:00:00');assert.equal(groups[0].updated_at,'2026-02-01 00:00:00');
});

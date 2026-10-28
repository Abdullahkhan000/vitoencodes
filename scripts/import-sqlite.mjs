import env from '@next/env';
import {Pool} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {postgresUrl} from '../lib/database.ts';
import {migrate} from './migrate-postgres.mjs';
env.loadEnvConfig(process.cwd());

// Explicit allowlist; identifiers never come from user input or SQLite rows.
const tables={
 releases:{key:'id',columns:['id','filename','title','year','category','resolution','size','status','links','created_at','poster','metadata_source','updated_at','size_bytes','details'],ordered:true},
 download_settings:{key:'setting_key',columns:['setting_key','value']},
 download_domain_history:{key:'id',columns:['id','created_at','previous_settings','new_domain','previous_links']},
 import_file_cache:{key:'url',columns:['url','entry','source','cached_at'],ordered:true},
 movie_metadata_cache:{key:'cache_key',columns:['cache_key','details','fetched_at']},
 support_issues:{key:'id',columns:['id','name','email','category','subject','message','page','status','created_at','client_hash'],ordered:true},
};
let source,pool,client;
try{
 const file=path.join(process.env.DATA_DIRECTORY||path.join(process.cwd(),'data'),'catalog.sqlite');
 if(!existsSync(file))throw new Error('SQLite source not found. Nothing was imported.');
 source=new DatabaseSync(file,{readOnly:true});
 await migrate();
 pool=new Pool({connectionString:postgresUrl(true),max:1,connectionTimeoutMillis:10000,allowExitOnIdle:true});
 client=await pool.connect();
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(861427)');
 source.exec('BEGIN');
 for(const [table,config] of Object.entries(tables)){
  if(!source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;
  const available=new Set(source.prepare('PRAGMA table_info('+table+')').all().map(row=>row.name));
  const columns=config.columns.filter(column=>available.has(column));
  let copied=0,skipped=0;
  const rows=source.prepare('SELECT '+columns.join(',')+' FROM '+table+(config.ordered?' ORDER BY rowid':'')).all();
  for(const row of rows){
   const placeholders=columns.map((_,index)=>'$'+(index+1)).join(',');
   const result=await client.query('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+placeholders+') ON CONFLICT('+config.key+') DO NOTHING',columns.map(column=>row[column]));
   if(result.rowCount){
    copied++;
    // Preserve unknown historical update dates; the insert trigger handles new app rows.
    if(table==='releases')await client.query('UPDATE releases SET updated_at=$1 WHERE id=$2',[row.updated_at??null,row.id]);
   }else skipped++;
  }
  console.log(table+': '+copied+' copied, '+skipped+' already present.');
 }
 source.exec('COMMIT');
 await client.query('COMMIT');
 console.log('SQLite import committed. Source file was read-only; existing Postgres records were preserved.');
}catch(error){
 if(client)await client.query('ROLLBACK').catch(()=>{});
 console.error('SQLite import failed ('+(error.code||'configuration')+'). No partial import was committed. Check the source file and database connection.');
 process.exitCode=1;
}finally{source?.close();client?.release();if(pool)await pool.end();}

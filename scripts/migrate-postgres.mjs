import env from '@next/env';
import {Pool} from 'pg';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {postgresUrl} from '../lib/database.ts';
env.loadEnvConfig(process.cwd());

export async function migrate(){
  const url=postgresUrl(true);
  if(!url)throw new Error('Configure a complete, direct DATABASE_URL before migrating.');
  const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:10000,allowExitOnIdle:true});
  let client;
  try{
    client=await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(861427)');
    await client.query('CREATE TABLE IF NOT EXISTS vito_schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const directory=new URL('../migrations/',import.meta.url);
    for(const name of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()){
      const sql=await readFile(new URL(name,directory),'utf8');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const existing=await client.query('SELECT checksum FROM vito_schema_migrations WHERE name=$1',[name]);
      if(existing.rows.length){
        if(existing.rows[0].checksum!==checksum)throw new Error('An applied migration changed: '+name);
        console.log('Already applied: '+name);continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO vito_schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
      console.log('Applied: '+name);
    }
    await client.query('COMMIT');
    console.log('Postgres schema is ready.');
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client?.release();await pool.end();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(pathToFileURL(process.argv[1]))){
  try{await migrate();}catch(error){console.error('Database migration failed ('+(error.code||'configuration')+'). Check connectivity and the direct DATABASE_URL.');process.exitCode=1;}
}

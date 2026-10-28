import {Pool,type PoolClient} from 'pg';

type Row = Record<string,unknown>;
type Parameter = string | number | bigint | null;
export type Database = {
  postgres:boolean;
  readonly isTransaction:boolean;
  exec(sql:string):Promise<void>;
  prepare(sql:string):{
    all(...values:Parameter[]):Promise<Row[]>;
    get(...values:Parameter[]):Promise<Row|undefined>;
    run(...values:Parameter[]):Promise<{changes:number}>;
  };
  close():Promise<void>;
};

export function postgresUrl(direct=false){
  // Neon CLI exports DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED.
  // Also accept the user's DATABASE_URL (direct) + DATABASE_URL_POOLED pair.
  const value=(direct
    ?process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL
    :process.env.DATABASE_URL_UNPOOLED?process.env.DATABASE_URL:process.env.DATABASE_URL_POOLED||process.env.DATABASE_URL)?.trim();
  if(!value)return undefined;
  try{
    const url=new URL(value);
    if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.pathname.slice(1))throw new Error();
    if(url.hostname.endsWith('.neon.tech')&&!['require','verify-full','verify-ca'].includes(url.searchParams.get('sslmode')||''))throw new Error();
    if(direct&&url.hostname.includes('-pooler.'))throw new Error();
    if(url.hostname.endsWith('.neon.tech'))url.searchParams.set('sslmode','verify-full');
    return url.href;
  }catch{throw new Error(direct?'DATABASE_URL must be a complete direct Postgres URL with TLS.':'Configure a complete Postgres URL with TLS in DATABASE_URL_POOLED or DATABASE_URL.');}
}

const globals=globalThis as typeof globalThis & {vitoPostgresPool?:{url:string;pool:Pool}};
export function postgresPool(){
  const url=postgresUrl();
  if(!url)throw new Error('Configure DATABASE_URL before connecting to Postgres.');
  if(!globals.vitoPostgresPool||globals.vitoPostgresPool.url!==url){
    const pool=new Pool({connectionString:url,max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,allowExitOnIdle:true});
    pool.on('error',()=>console.error('An idle Postgres connection failed.'));
    const previous=globals.vitoPostgresPool?.pool;
    globals.vitoPostgresPool={url,pool};
    if(previous)void previous.end().catch(()=>{});
  }
  return globals.vitoPostgresPool.pool;
}

// Repository SQL uses ? placeholders. Parameter values are never interpolated.
export function postgresParameters(sql:string){
  let index=0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,token=>token==='?'?'$'+(++index):token);
}

function pgDatabase(client:PoolClient):Database{
  let transaction=false,closed=false;
  const query=async(sql:string,values:Parameter[]=[])=>{
    const result=await client.query(postgresParameters(sql),values);
    for(const row of result.rows)for(const key of ['n','size_bytes'])if(typeof row[key]==='string'){
      const value=Number(row[key]);if(Number.isSafeInteger(value))row[key]=value;
    }
    return result;
  };
  return {
    postgres:true,
    get isTransaction(){return transaction;},
    async exec(sql){
      if(sql==='BEGIN IMMEDIATE'){
        await client.query('BEGIN');transaction=true;
        // Match SQLite's single-writer transactions for imports, publishing and limits.
        await client.query('SELECT pg_advisory_xact_lock(861427)');
      }else{
        await client.query(sql);
        if(sql==='COMMIT'||sql==='ROLLBACK')transaction=false;
      }
    },
    prepare(sql){return {
      async all(...values){return (await query(sql,values)).rows;},
      async get(...values){return (await query(sql,values)).rows[0];},
      async run(...values){return {changes:(await query(sql,values)).rowCount||0};},
    };},
    async close(){
      if(closed)return;closed=true;
      let destroy=false;
      if(transaction)try{await client.query('ROLLBACK');}catch{destroy=true;}
      client.release(destroy);
    },
  };
}

export async function database():Promise<Database>{
  if(postgresUrl())return pgDatabase(await postgresPool().connect());
  const {sqliteDatabase}=await import('./sqlite.ts');
  const db=sqliteDatabase();
  return {
    postgres:false,
    get isTransaction(){return db.isTransaction;},
    async exec(sql){db.exec(sql);},
    prepare(sql){const statement=db.prepare(sql);return {
      async all(...values){return statement.all(...values) as Row[];},
      async get(...values){return statement.get(...values) as Row|undefined;},
      async run(...values){return {changes:Number(statement.run(...values).changes)};},
    };},
    async close(){db.close();},
  };
}

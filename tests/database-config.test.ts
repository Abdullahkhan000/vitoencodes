import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresUrl,postgresParameters,database} from '../lib/database.ts';

const keys=['DATABASE_URL','DATABASE_URL_POOLED','DATABASE_URL_UNPOOLED'] as const;
function configured(values:Partial<Record<typeof keys[number],string>>,work:()=>void){
 const original=keys.map(key=>process.env[key]);
 try{for(const key of keys){delete process.env[key];if(values[key]!==undefined)process.env[key]=values[key];}work();}
 finally{keys.forEach((key,index)=>{if(original[index]===undefined)delete process.env[key];else process.env[key]=original[index];});}
}
const direct='postgresql://owner:private-value@ep-example.us-east-2.aws.neon.tech/catalog?sslmode=require&channel_binding=require';
const pooled=direct.replace('ep-example.','ep-example-pooler.');

test('manual Neon URLs use pooled app traffic and a direct migration connection',()=>{
 configured({DATABASE_URL:direct,DATABASE_URL_POOLED:pooled},()=>{
  assert.ok(new URL(postgresUrl()!).hostname.includes('-pooler.'));
  assert.ok(!new URL(postgresUrl(true)!).hostname.includes('-pooler.'));
  assert.equal(new URL(postgresUrl()!).searchParams.get('sslmode'),'verify-full');
 });
});
test('CLI exports take priority over a stale manually configured pooled URL',()=>{
 configured({DATABASE_URL:pooled,DATABASE_URL_UNPOOLED:direct,DATABASE_URL_POOLED:'invalid-old-value'},()=>{
  assert.ok(new URL(postgresUrl()!).hostname.includes('-pooler.'));
  assert.ok(!new URL(postgresUrl(true)!).hostname.includes('-pooler.'));
 });
});
test('invalid configured database URLs fail closed and never expose credentials',async()=>{
 configured({DATABASE_URL:direct,DATABASE_URL_POOLED:'private-value-is-not-a-url'},()=>{
  assert.throws(()=>postgresUrl(),error=>error instanceof Error&&!error.message.includes('private-value'));
 });
 configured({DATABASE_URL:pooled},()=>assert.throws(()=>postgresUrl(true),/direct Postgres URL/));
 configured({DATABASE_URL:direct.replace('sslmode=require','sslmode=disable')},()=>assert.throws(()=>postgresUrl(),/TLS/));
 const previous=process.env.DATABASE_URL;process.env.DATABASE_URL='invalid';
 try{await assert.rejects(database(),/Configure a complete Postgres URL/);}finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
test('parameter conversion preserves SQL string literals and quoted identifiers',()=>{
 assert.equal(postgresParameters(`SELECT '?' AS "why?", 'it''s ?' WHERE id=? AND title=?`),`SELECT '?' AS "why?", 'it''s ?' WHERE id=$1 AND title=$2`);
});

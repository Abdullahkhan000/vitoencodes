import {database} from '../../../lib/database';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){let db;try{db=await database();await db.prepare('SELECT id FROM audit_events LIMIT 1').get();return Response.json({status:'ok',checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}finally{await db?.close();}}

import {timingSafeEqual} from 'node:crypto';
import {database} from '../../../../lib/database';
import {createRecoveryCopy} from '../../../../lib/backups';
import {checkMirrors} from '../../../../lib/link-health';
import {recordError} from '../../../../lib/monitoring';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(request:Request){
 const expected=process.env.CRON_SECRET||'',actual=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(expected.length<32)return Response.json({error:'Scheduled maintenance is not configured.'},{status:503});
 if(actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const backup=await createRecoveryCopy(),links=await checkMirrors(undefined,12),db=await database();try{
   await db.prepare('DELETE FROM rate_limits WHERE reset_at<?').run(Date.now()-86400000);
   await db.prepare('DELETE FROM analytics_daily WHERE day<?').run(new Date(Date.now()-90*86400000).toISOString().slice(0,10));
   await db.prepare('DELETE FROM audit_events WHERE created_at<?').run(new Date(Date.now()-90*86400000).toISOString());
   await db.prepare('DELETE FROM app_errors WHERE resolved_at IS NOT NULL AND last_seen<?').run(new Date(Date.now()-30*86400000).toISOString());
  }finally{await db.close();}
  return Response.json({ok:true,backup,links},{headers:{'Cache-Control':'no-store'}});
 }catch(error){await recordError(error,'/api/cron/daily','maintenance').catch(()=>{});return Response.json({error:'Scheduled maintenance failed.'},{status:503});}
}

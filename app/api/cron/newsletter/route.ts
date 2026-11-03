import {timingSafeEqual} from 'node:crypto';
import {processNewsletter} from '../../../../lib/newsletter';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(request:Request){
 const expected=process.env.CRON_SECRET||'',actual=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(expected.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await processNewsletter(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Newsletter processing failed.'},{status:503});}
}

import {authorized,denied} from '../../../../lib/auth';
import {listReleases} from '../../../../lib/store';
import {enrichReleases} from '../../../../lib/enrichment';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!authorized(request))return denied();
 try{
  const body=await request.json();if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>5||body.ids.some((id:unknown)=>typeof id!=='string'))return Response.json({error:'Select 1–5 releases per metadata batch.'},{status:400});
  const rows=(await listReleases());if(body.ids.some((id:string)=>!rows.some(r=>r.id===id)))return Response.json({error:'A selected release no longer exists.'},{status:404});
  const result=await enrichReleases(body.ids,{refresh:body.refresh===true});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Movie information could not be imported. Saved releases are unchanged.'},{status:500});}
}

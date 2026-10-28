import {authorized,denied} from '../../../../lib/auth';
import {listIssues,setIssueStatus} from '../../../../lib/support';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){if(!authorized(request))return denied();return Response.json({issues:(await listIssues())},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!authorized(request))return denied();try{const body=await request.json();if(typeof body.id!=='string'||!(await setIssueStatus(body.id,body.status)))return Response.json({error:'Report not found.'},{status:404});return Response.json({updated:true});}catch{return Response.json({error:'Could not update the report.'},{status:400});}}

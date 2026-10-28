import {authorized,denied} from '../../../lib/auth';
import {scanDrive} from '../../../lib/drive';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){if(!authorized(request))return denied();try{return Response.json(await scanDrive())}catch(e){return Response.json({error:e instanceof Error?e.message:'Sync failed'},{status:502})}}

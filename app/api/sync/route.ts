import {revalidateTag} from 'next/cache';
import {authorized,denied} from '../../../lib/auth';
import {scanDrive} from '../../../lib/drive';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handlePOST(request:Request){if(!(await authorized(request)))return denied();try{return Response.json(await scanDrive())}catch(e){return Response.json({error:e instanceof Error?e.message:'Sync failed'},{status:502})}}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok)revalidateTag('public-catalog',{expire:0});return response;}

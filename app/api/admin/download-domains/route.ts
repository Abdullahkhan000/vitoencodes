import {authorized,denied} from '../../../../lib/auth';
import {changeHubDriveDomain,hubDriveSettings} from '../../../../lib/download-domains';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){if(!authorized(request))return denied();return Response.json((await hubDriveSettings()),{headers});}
export async function POST(request:Request){
 if(!authorized(request))return denied();
 try{const body=await request.json();return Response.json((await changeHubDriveDomain(body.domain,body.preview!==true)),{headers});}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Could not update domains.'},{status:400,headers});}
}

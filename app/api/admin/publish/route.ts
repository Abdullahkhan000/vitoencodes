import {revalidateTag} from 'next/cache';
﻿import {authorized,denied} from '../../../../lib/auth';
import {changeVisibility} from '../../../../lib/publishing';
export const runtime='nodejs';
async function handlePOST(request:Request){
 if(!(await authorized(request)))return denied();
 try{const body=await request.json();const updated=(await changeVisibility(body.ids,body.status));return Response.json({updated,status:body.status});}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Unable to change visibility.'},{status:400});}
}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok)revalidateTag('public-catalog',{expire:0});return response;}

import {reportMirror,reportReleasePage} from '../../../lib/link-health';
import {clientKey} from '../../../lib/rate-limit';
import {verifyTurnstile,TurnstileError} from '../../../lib/turnstile';
﻿import {sameOrigin} from '../../../lib/auth';
import {submitIssue} from '../../../lib/support';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Submit the form from this website.'},{status:403});
 try{const raw=await request.text();if(raw.length>12000)return Response.json({error:'Your message is too long.'},{status:413});const input=JSON.parse(raw);await verifyTurnstile(input.turnstileToken,request,'contact');const result=(await submitIssue(input,clientKey(request)));if(input.category==='Broken download link'&&typeof input.page==='string'){await reportMirror(input.page).catch(()=>{});await reportReleasePage(input.page,new URL(request.url).origin).catch(()=>{});}return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});}catch(error){if(error instanceof TurnstileError)return Response.json({error:error.message},{status:403});const message=error instanceof Error?error.message:'';const safe=/^(Check |Please |Enter |Choose |Describe |Use |Too many |Could not submit)/.test(message)?message:'Could not submit your message. Please check the fields and try again.';return Response.json({error:safe},{status:safe.startsWith('Too many')?429:400,headers:{'Cache-Control':'no-store'}});}
}

import {sameOrigin} from '../../../lib/auth';
import {submitIssue} from '../../../lib/support';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Submit the form from this website.'},{status:403});
 try{const raw=await request.text();if(raw.length>12000)return Response.json({error:'Your message is too long.'},{status:413});const input=JSON.parse(raw);const result=(await submitIssue(input,request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local'));return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});}catch(error){const message=error instanceof Error?error.message:'';const safe=/^(Check |Please |Enter |Choose |Describe |Use |Too many |Could not submit)/.test(message)?message:'Could not submit your message. Please check the fields and try again.';return Response.json({error:safe},{status:safe.startsWith('Too many')?429:400,headers:{'Cache-Control':'no-store'}});}
}

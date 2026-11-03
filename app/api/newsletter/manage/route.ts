import {sameOrigin} from '../../../../lib/auth';
import {confirmNewsletter,unsubscribeNewsletter} from '../../../../lib/newsletter';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Use this website.'},{status:403});
 try{const raw=await request.text();if(raw.length>512)throw new Error();const input=JSON.parse(raw);const ok=input.action==='confirm'?await confirmNewsletter(input.token):input.action==='unsubscribe'?await unsubscribeNewsletter(input.token):false;return Response.json({ok},{status:ok?200:400,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({ok:false},{status:400});}
}

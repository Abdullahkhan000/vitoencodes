import {unsubscribeNewsletter} from '../../../../lib/newsletter';
export const runtime='nodejs';
// RFC 8058: the capability token authorizes this POST; no cookie is needed.
export async function POST(request:Request){
 try{const token=new URL(request.url).searchParams.get('token')||'';const ok=await unsubscribeNewsletter(token);return new Response(null,{status:ok?200:400,headers:{'Cache-Control':'no-store'}});}catch{return new Response(null,{status:503});}
}

import {sameOrigin} from '../../../lib/auth';
import {clientKey,RateLimitError} from '../../../lib/rate-limit';
import {verifyTurnstile,TurnstileError} from '../../../lib/turnstile';
import {subscribeNewsletter} from '../../../lib/newsletter';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Submit from this website.'},{status:403});
 try{
  const raw=await request.text();if(raw.length>4096)return Response.json({error:'Request too large.'},{status:413});
  const input=JSON.parse(raw);if(input.consent!==true)return Response.json({error:'Agree to receive release emails.'},{status:400});
  await verifyTurnstile(input.turnstileToken,request,'newsletter');
  await subscribeNewsletter(input.email,clientKey(request));
  return Response.json({message:'Check your inbox to confirm. If already subscribed, you are all set.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const known=error instanceof RateLimitError||error instanceof TurnstileError;
  const message=error instanceof Error?error.message:'';
  return Response.json({error:known||/^(Enter |Newsletter |Email delivery)/.test(message)?message:'Unable to subscribe right now. Please retry later.'},{status:error instanceof RateLimitError?429:error instanceof TurnstileError?403:400,headers:{'Cache-Control':'no-store'}});
 }
}

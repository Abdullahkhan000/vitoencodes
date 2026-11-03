import {authorized,denied} from '../../../../lib/auth';
import {database} from '../../../../lib/database';
import {newsletterConfig,processNewsletter} from '../../../../lib/newsletter';
import {consumeLimit,RateLimitError} from '../../../../lib/rate-limit';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 try{
  if(!await authorized(request))return denied();
  const db=await database();try{
   const subscribers=await db.prepare('SELECT state,COUNT(*) AS n FROM newsletter_subscribers GROUP BY state').all();
   const deliveries=await db.prepare('SELECT state,COUNT(*) AS n FROM newsletter_deliveries GROUP BY state').all();
   const config=newsletterConfig();return Response.json({ready:config.ready,provider:config.provider,sender:config.sender,subscribers:Object.fromEntries(subscribers.map(row=>[row.state,Number(row.n)])),deliveries:Object.fromEntries(deliveries.map(row=>[row.state,Number(row.n)]))},{headers});
  }finally{await db.close();}
 }catch{return Response.json({error:'Unable to load newsletter. Check that the newsletter migration is applied.'},{status:503,headers});}
}
export async function POST(request:Request){
 try{
  if(!await authorized(request))return denied();
  await consumeLimit('newsletter:admin-process',1,60000);
  return Response.json(await processNewsletter(),{headers});
 }catch(error){return Response.json({error:error instanceof RateLimitError?error.message:'Newsletter processing failed.'},{status:error instanceof RateLimitError?429:503,headers});}
}

import {sameOrigin} from '../../../lib/auth';
import {consumeLimit,clientKey} from '../../../lib/rate-limit';
import {trackEvent} from '../../../lib/analytics';
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});if(request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return new Response(null,{status:204});try{const text=await request.text();if(text.length>1000)return new Response(null,{status:413});await consumeLimit('events:'+clientKey(request),80,10*60000);await trackEvent(JSON.parse(text));return new Response(null,{status:204});}catch{return new Response(null,{status:204});}}

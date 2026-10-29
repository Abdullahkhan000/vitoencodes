import {sameOrigin} from '../../../lib/auth';
import {consumeLimit,clientKey} from '../../../lib/rate-limit';
import {recordError} from '../../../lib/monitoring';
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});try{const text=await request.text();if(text.length>1000)return new Response(null,{status:413});await consumeLimit('client-errors:'+clientKey(request),10,10*60000);const body=JSON.parse(text);const path=typeof body.path==='string'&&body.path.startsWith('/')?body.path.split('?')[0].slice(0,200):'/';await recordError(new Error('Client render error'+(typeof body.digest==='string'?' ('+body.digest.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)+')':'')),path,'client');}catch{}return new Response(null,{status:204});}

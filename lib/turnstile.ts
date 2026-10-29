export class TurnstileError extends Error{}
export function turnstileConfig(){const siteKey=process.env.TURNSTILE_SITE_KEY||process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'',secret=process.env.TURNSTILE_SECRET_KEY||'';return {siteKey,required:Boolean(siteKey||secret||process.env.TURNSTILE_REQUIRED==='true'),ready:Boolean(siteKey&&secret)};}
export async function verifyTurnstile(token:unknown,request:Request,action:string,send:typeof fetch=fetch){
 const config=turnstileConfig();if(!config.required)return;
 if(!config.ready)throw new TurnstileError('Verification is not configured completely. Please contact the site owner.');
 if(typeof token!=='string'||!token||token.length>2048)throw new TurnstileError('Complete the security verification and try again.');
 let result:{success?:boolean;hostname?:string;action?:string};
 try{const response=await send('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY!,response:token}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();result=await response.json();}catch{throw new TurnstileError('Verification is temporarily unavailable. Please retry.');}
 const hosts=(process.env.TURNSTILE_HOSTNAMES||process.env.VERCEL_PROJECT_PRODUCTION_URL||new URL(request.url).hostname).split(',').map(value=>value.trim().toLowerCase());
 if(!result.success||!result.hostname||!hosts.includes(result.hostname.toLowerCase())||result.action!==action)throw new TurnstileError('Security verification expired or failed. Please try again.');
}

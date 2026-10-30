export function alertConfiguration(){
 const recipient=process.env.ALERT_EMAIL_TO?.trim()||'',sender=process.env.ALERT_EMAIL_FROM?.trim()||'VITOENCODES <onboarding@resend.dev>';
 const emailConfigured=Boolean(process.env.RESEND_API_KEY?.trim()&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)&&!/[\r\n]/.test(sender));
 let webhookConfigured=false;try{const url=new URL(process.env.ALERT_WEBHOOK_URL||'');webhookConfigured=url.protocol==='https:'&&!url.username&&!url.password;}catch{}
 return {emailConfigured,webhookConfigured,alertsConfigured:emailConfigured||webhookConfigured};
}
export async function deliverAlert(subject:string,text:string,send:typeof fetch=fetch){
 const config=alertConfiguration(),jobs:{channel:string;send:()=>Promise<void>}[]=[];
 if(config.emailConfigured)jobs.push({channel:'email',send:async()=>{
  let response:Response;try{response=await send('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ALERT_EMAIL_FROM?.trim()||'VITOENCODES <onboarding@resend.dev>',to:[process.env.ALERT_EMAIL_TO!.trim()],subject,text}),signal:AbortSignal.timeout(7000)});}catch{throw new Error('Email provider could not be reached. Retry later.');}
  if(!response.ok)throw new Error('Email provider rejected the alert (HTTP '+response.status+'). Check the API key, sender and recipient. The resend.dev sender can only email the Resend account owner.');
  let result:{id?:unknown};try{result=await response.json();}catch{throw new Error('Email provider returned an invalid confirmation.');}if(typeof result.id!=='string'||!result.id)throw new Error('Email provider did not confirm acceptance.');
 }});
 if(config.webhookConfigured)jobs.push({channel:'webhook',send:async()=>{let response:Response;try{response=await send(process.env.ALERT_WEBHOOK_URL!,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,content:text}),signal:AbortSignal.timeout(5000)});}catch{throw new Error('Alert webhook could not be reached. Retry later.');}if(!response.ok)throw new Error('Alert webhook rejected the request (HTTP '+response.status+').');}});
 if(!jobs.length)throw new Error('Configure RESEND_API_KEY and ALERT_EMAIL_TO in Vercel, then redeploy to enable email alerts.');
 const results=await Promise.allSettled(jobs.map(job=>job.send())),failures=results.flatMap((result,index)=>result.status==='rejected'?[jobs[index].channel+': '+(result.reason instanceof Error?result.reason.message:'Delivery failed.')]:[]);
 if(failures.length)throw new Error(failures.join(' '));return {accepted:true,channels:jobs.map(job=>job.channel)};
}

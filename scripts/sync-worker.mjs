const base=process.env.SITE_URL||'http://localhost:3000';
const interval=Math.max(60,Number(process.env.SYNC_INTERVAL_SECONDS)||900)*1000;
if(!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN.length<32)throw new Error('Configure ADMIN_TOKEN before starting the worker.');
while(true){try{const result=await fetch(new URL('/api/sync',base),{method:'POST',headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN},signal:AbortSignal.timeout(600000)});const data=await result.json();console.log(new Date().toISOString(),result.ok?`Scan complete: ${data.added} new drafts.`:`Scan failed (${result.status}): ${data.error}`);}catch{console.error(new Date().toISOString(),'Sync unavailable. Will retry next interval.');}await new Promise(resolve=>setTimeout(resolve,interval));}

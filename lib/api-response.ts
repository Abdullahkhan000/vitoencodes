export async function readApiJson<T=Record<string,unknown>>(response:Response):Promise<T>{
 const text=await response.text();
 if(response.headers.get('x-vercel-mitigated')==='challenge')throw new Error('Vercel security verification interrupted this request. Refresh this page, complete any browser verification, then try again.');
 if(response.redirected&&new URL(response.url).pathname.includes('/login'))throw new Error('Your session expired. Sign in again.');
 const contentType=response.headers.get('content-type')||'';
 if(!contentType.includes('application/json')&&!contentType.includes('+json')){
  if(response.status===401)throw new Error('Your session expired. Sign in again.');
  if(response.status===403)throw new Error('The hosting security layer blocked this request (HTTP 403). Refresh this page and retry; check Vercel Firewall events if it continues.');
  if(response.status>=500)throw new Error('The server is temporarily unavailable (HTTP '+response.status+'). Refresh and retry. If you submitted a change, check its result before submitting it again.');
  throw new Error('Expected an API response but received a web page (HTTP '+response.status+'). Refresh this page; if it continues, check the deployment and security rules.');
 }
 try{return JSON.parse(text) as T;}catch{throw new Error('The server returned an incomplete API response. Refresh and retry.');}
}

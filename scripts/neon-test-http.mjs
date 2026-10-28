/** Use browser-equivalent headers so the live test exercises the real origin checks. */
export function createAppClient(base,adminToken,request=fetch){
 const origin=new URL(base).origin;
 return async function call(route,body,admin=false){
  const hasBody=body!==undefined;
  const headers={...(admin?{Authorization:'Bearer '+adminToken}:{}),...(hasBody?{'Content-Type':'application/json',Origin:origin}:{})};
  const response=await request(new URL(route,base),{method:hasBody?'POST':'GET',headers,body:hasBody?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(route+' returned HTTP '+response.status);
  return response.json();
 };
}

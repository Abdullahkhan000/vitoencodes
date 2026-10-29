'use client';
type EventInput={kind:'view'|'mirror'|'search';releaseId?:string;query?:string};
export function recordEvent(event:EventInput){
 if(typeof navigator==='undefined'||navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return;
 try{const key='vito-event:'+event.kind+':'+(event.releaseId||event.query||''),previous=Number(sessionStorage.getItem(key)||0),windowMs=event.kind==='mirror'?2000:event.kind==='search'?120000:30*60000;if(Date.now()-previous<windowMs)return;sessionStorage.setItem(key,String(Date.now()));}catch{}
 const body=JSON.stringify(event);if(navigator.sendBeacon)navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));else void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
}

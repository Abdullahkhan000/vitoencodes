'use client';
import {useState} from 'react';
export default function ManageNewsletter({token,action}:{token:string;action:'confirm'|'unsubscribe'}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 return <section className="info-card"><p>{action==='confirm'?'Confirm your email to start receiving new release alerts.':'Stop new release emails for this subscription.'}</p><button className="contact-submit" disabled={busy||done} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/newsletter/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action})});if(!response.ok)throw new Error();setDone(true);setMessage(action==='confirm'?'Confirmed! You will receive future release alerts.':'Unsubscribed. You will no longer receive release alerts.');}catch{setMessage('This link is invalid or expired. You can request a new signup email below.');}finally{setBusy(false);}}}>{busy?'Please wait…':action==='confirm'?'Confirm subscription':'Unsubscribe'}</button><p role="status">{message}</p></section>;
}

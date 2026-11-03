'use client';
import {useState} from 'react';
import Turnstile from '../components/turnstile';
import {ArrowUpRight,CheckCircle2,ChevronDown,Send,ShieldCheck,MessageSquare} from 'lucide-react';
import {readApiJson} from '../../lib/api-response';

export default function ContactForm({initialPage,initialSubject,mode='contact'}:{initialPage:string;initialSubject:string;mode?:'contact'|'request'}){
 const [verification,setVerification]=useState({token:'',ready:false}),[reset,setReset]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[message,setMessage]=useState('');
 const request=mode==='request';
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;setBusy(true);setError('');
  try{
   const body={...Object.fromEntries(new FormData(form)),turnstileToken:verification.token};
   const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await readApiJson<{reference:string;error?:string}>(response);
   if(!response.ok)throw new Error(result.error||'Could not send your message.');
   setReference(result.reference);setMessage('');form.reset();
  }catch(error){setError(error instanceof Error?error.message:'Could not submit your message. Try again.');}
  finally{setReset(value=>value+1);setBusy(false);}
 }
 if(reference)return <section className="contact-success" role="status"><span className="contact-success-icon"><CheckCircle2 size={30}/></span><span className="contact-overline">IN THE OWNER?S INBOX</span><h2>{request?'Request received.':'Message received.'}</h2><p>{request?'Your release request':'Your message'} has been saved. If you included an email address, the owner can use it to follow up.</p><div className="contact-reference"><span>Your reference</span><strong>{reference}</strong></div><button className="contact-submit" onClick={()=>{setReference('');setError('');}}>{request?'Submit another request':'Send another message'}<ArrowUpRight size={18}/></button></section>;
 return <form className="contact-form" onSubmit={submit} aria-labelledby="contact-form-heading" aria-busy={busy}>
  <div className="contact-form-heading"><span className="contact-form-icon"><MessageSquare size={22}/></span><div><h2 id="contact-form-heading">{request?'Request an encode':'Send us a message'}</h2><p>{request?'Tell us what you would like to see.':'A little detail helps us get it sorted.'}</p></div></div>
  <p className="contact-required-note">Fields marked <span>*</span> are required.</p>
  <fieldset disabled={busy} className="contact-fields">
   <div className="contact-two"><label><span className="contact-field-label">Your name <small>Optional</small></span><input name="name" maxLength={100} autoComplete="name" placeholder="How should we address you?"/></label><label><span className="contact-field-label">Email address <small>Optional</small></span><input type="email" name="email" maxLength={254} autoComplete="email" placeholder="you@example.com"/><span className="contact-field-hint">Only needed if you would like a reply.</span></label></div>
   {request?<input type="hidden" name="category" value="Release request"/>:<label><span className="contact-field-label">What can we help with? <b>*</b></span><div className="contact-select"><select name="category" required defaultValue={initialPage?'Broken download link':'Website problem'}>{['Broken download link','Wrong movie information','Website problem','Other'].map(value=><option key={value}>{value}</option>)}</select><ChevronDown size={18} aria-hidden="true"/></div></label>}
   <label><span className="contact-field-label">{request?'Movie or series title & year':'Subject'} <b>*</b></span><input name="subject" required maxLength={180} defaultValue={initialSubject} placeholder={request?'Movie title (year)':'Briefly describe what happened'}/></label>
   <label><span className="contact-field-label">{request?'IMDb / TMDB link':'Movie page or mirror link'} <small>Optional</small></span><input name="page" type="url" maxLength={2000} defaultValue={initialPage} placeholder="https://..." inputMode="url"/></label>
   <label><span className="contact-field-label">{request?'Your preferred edition / encode':'Your message'} <b>*</b></span><textarea name="message" required minLength={15} maxLength={5000} rows={6} value={message} onChange={event=>setMessage(event.target.value)} aria-describedby="contact-message-hint" placeholder={request?'Include the edition or cut, resolution, format and audio language you would like.':'Tell us what went wrong. Include the filename, mirror and any error you see. For website issues, mention your device and browser.'}/><span className="contact-message-hint" id="contact-message-hint"><span>At least 15 characters</span><span>{message.length.toLocaleString()} / 5,000</span></span></label>
   <div className="contact-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  </fieldset>
  <div className="contact-form-footer"><p className="contact-privacy"><ShieldCheck size={19} aria-hidden="true"/><span>Your details stay in the owner?s private inbox. Please leave out passwords and other sensitive information.</span></p><Turnstile action="contact" onChange={setVerification} resetKey={reset}/>{error&&<p className="contact-error" role="alert">{error}</p>}<button className="contact-submit" type="submit" disabled={busy||!verification.ready}><Send size={17}/>{busy?'Sending?':request?'Submit request':'Send message'}<ArrowUpRight size={18}/></button></div>
 </form>;
}

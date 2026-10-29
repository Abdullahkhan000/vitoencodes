'use client';
import Script from 'next/script';
import {useEffect,useRef,useState} from 'react';
type Verification={token:string;ready:boolean};
type Widget={render:(container:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void;reset:(id:string)=>void};
declare global{interface Window{turnstile?:Widget}}
export default function Turnstile({action,onChange,resetKey=0}:{action:'admin_login'|'contact';onChange:(value:Verification)=>void;resetKey?:number}){
 const [config,setConfig]=useState<{siteKey:string;required:boolean;ready:boolean}|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const container=useRef<HTMLDivElement>(null),widget=useRef<string|null>(null),callback=useRef(onChange);
 useEffect(()=>{callback.current=onChange;},[onChange]);
 useEffect(()=>{let active=true;fetch('/api/security',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(value=>{if(active){setConfig(value);if(!value.required)callback.current({token:'',ready:true});else if(!value.ready)setError('Security verification is not configured. Please contact the owner.');}}).catch(()=>{if(active)setError('Could not load verification. Refresh this page to retry.');});return()=>{active=false;};},[]);
 useEffect(()=>{if(window.turnstile)setLoaded(true);},[]);
 useEffect(()=>{
  if(!config?.required||!config.ready||!loaded||!container.current||!window.turnstile)return;
  widget.current=window.turnstile.render(container.current,{sitekey:config.siteKey,action,theme:'dark',callback:(token:string)=>{setError('');callback.current({token,ready:true});},'expired-callback':()=>callback.current({token:'',ready:false}),'error-callback':()=>{callback.current({token:'',ready:false});setError('Verification failed. Refresh this page to retry.');}});
  return()=>{if(widget.current)window.turnstile?.remove(widget.current);widget.current=null;};
 },[config,loaded,action]);
 useEffect(()=>{if(resetKey&&config?.required&&widget.current){callback.current({token:'',ready:false});window.turnstile?.reset(widget.current);}},[resetKey,config]);
 if(config&&!config.required)return null;
 return <div className="turnstile-verification">{config?.ready&&<Script id="cloudflare-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={()=>setLoaded(true)} onError={()=>setError('Could not load verification. Refresh to retry.')}/>}<div ref={container}/>{error?<p role="alert">{error}</p>:!loaded&&<p role="status">Loading security verification...</p>}</div>;
}

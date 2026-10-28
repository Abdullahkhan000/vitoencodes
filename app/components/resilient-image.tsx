'use client';
import {useEffect,useRef,useState,type ImgHTMLAttributes} from 'react';
type Props=Omit<ImgHTMLAttributes<HTMLImageElement>,'src'>&{src:string};
function ImageState({src,alt='',className='',onLoad,onError,...props}:Props){const [failed,setFailed]=useState(!src),[loaded,setLoaded]=useState(false);const ref=useRef<HTMLImageElement>(null);useEffect(()=>{if(ref.current?.complete){if(ref.current.naturalWidth>0)setLoaded(true);else if(src){setFailed(true);setLoaded(true);}}},[]);return <img decoding="async" loading={props.fetchPriority==='high'?'eager':'lazy'} {...props} ref={ref} src={failed?'/branding/poster-placeholder.svg':src} alt={alt} className={'resilient-image '+(loaded?'image-ready':'image-waiting')+(failed?' image-fallback':'')+' '+className} onLoad={event=>{setLoaded(true);onLoad?.(event);}} onError={event=>{setFailed(true);setLoaded(true);onError?.(event);}}/>;}
export default function ResilientImage(props:Props){return <ImageState key={props.src} {...props}/>;}

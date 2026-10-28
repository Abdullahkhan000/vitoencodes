'use client';
import Link from 'next/link';
import {RefreshCw,ArrowLeft} from 'lucide-react';
export default function ErrorPage({retry}:{retry:()=>void}){return <main className="route-state"><span className="route-state-mark" aria-hidden="true">V.</span><span className="film-small-label">LET'S TRY THAT AGAIN</span><h1>This page could not load.</h1><p>Something interrupted the request. Try loading the page again, or return to the archive.</p><div><button onClick={()=>retry()}><RefreshCw size={18}/> Try again</button><Link href="/"><ArrowLeft size={18}/> Back to the archive</Link></div><Link className="route-state-help" href="/contact">Still having trouble? Report an issue.</Link></main>;}

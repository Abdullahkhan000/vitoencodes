import SiteHeader from './site-header';
import SiteFooter from './site-footer';
﻿import Link from 'next/link';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
export default function InfoShell({label,title,intro,children}:{label:string;title:string;intro:string;children:React.ReactNode}){return <div className="film-page" id="top"><SiteHeader/><main className="film-container info-page"><section className="info-hero"><span className="film-small-label">{label}</span><h1>{title}</h1><p>{intro}</p></section>{children}<aside className="info-help"><div><h2>Something not working?</h2><p>Send the movie page, affected mirror and a short description.</p></div><Link href="/contact">Report an issue <ArrowUpRight size={17}/></Link></aside><SiteFooter/></main></div>;}

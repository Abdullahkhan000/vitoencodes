'use client';
import {recordEvent} from '../lib/client-analytics';
import ResilientImage from './components/resilient-image';
import ActiveFilters,{type ActiveFilter} from './components/active-filters';
import SiteFooter from './components/site-footer';
import SiteHeader from './components/site-header';

import {newestFirst,groupDates,timestamp} from '../lib/release-dates';
import Pagination from './components/pagination';
import {paginate,createMovieSearch} from '../lib/catalog-search';
import type {Release} from '../lib/store';
import {encodeSpecs} from '../lib/movie-details';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {ArrowDown,ArrowUpRight,Search,X,Grid2X2,List,Bookmark,Download,ChevronLeft,ChevronRight,Plus,Check,ArrowRight} from 'lucide-react';
import {preferredRelease,availableCollections,movieGenres,movieCollection,groupMovieReleases,movieRouteId,movieTitle} from '../lib/library';
import type {MovieDetails} from '../lib/movie-details';
import { classifySource, encodeSources } from '../lib/encode-source';
import { catalog } from '../lib/catalog';

type Movie = Omit<typeof catalog[number],'year'> & {year:number|null} & { links?: { label: string; url: string }[]; live?: boolean; filename?: string;status?:string;details?:MovieDetails;releases?:Movie[];releaseCount?:number;created_at?:string;updated_at?:string|null;size_bytes?:number|null;matchingReleases?:Movie[] };
const image = (movie: Movie) => movie.poster ? ((movie.poster.startsWith('/') || movie.poster.startsWith('https://')) ? movie.poster : posterIds.has(movie.id) ? '/posters/' + movie.id + '.jpg' : 'https://image.tmdb.org/t/p/w780/' + movie.poster) : '';

const posterIds = new Set(catalog.map(m => m.id));

const publicMovie=(r:Release):Movie=>{const specs=encodeSpecs(r.filename);return {...r,codec:specs.codec+(specs.bitDepth!=='Not specified'?' · '+specs.bitDepth:''),poster:r.poster||'',live:true};};
function compactSize(releases:Movie[]){
  const bytes=(release:Movie)=>{
    if(release.size_bytes&&release.size_bytes>0)return release.size_bytes;
    const match=release.size.match(/^(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)$/i);
    if(!match)return Infinity;
    const units:Record<string,number>={b:1,kb:1e3,mb:1e6,gb:1e9,tb:1e12,kib:1024,mib:1024**2,gib:1024**3,tib:1024**4};
    return Number(match[1])*units[match[2].toLowerCase()];
  };
  const smallest=[...releases].sort((a,b)=>bytes(a)-bytes(b))[0];
  return smallest&&Number.isFinite(bytes(smallest))?(releases.length>1?'From ':'')+smallest.size:'Size unavailable';
}
function freshness(movie:Movie,now:number){
  if(!now)return null;
  const added=timestamp(movie.created_at)?.getTime()||0,updated=timestamp(movie.updated_at)?.getTime()||0;
  const recent=(date:number)=>date>0&&now>=date&&now-date<7*24*60*60*1000;
  return recent(added)?'New':updated>added&&recent(updated)?'Updated':null;
}
export default function Home({initialReleases=[],initialFilters={}}:{initialReleases?:Release[];initialFilters?:{query?:string;genre?:string;collection?:string;source?:string;format?:string;quality?:string;saved?:boolean;search?:boolean}}) {
  const router = useRouter();
  const [now,setNow]=useState(0);
  useEffect(()=>setNow(Date.now()),[]);
  const [entries, setEntries] = useState<Movie[]>(initialReleases.length?initialReleases.map(publicMovie):catalog);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => { let active = true; const check = () => { fetch('/api/admin/session', {cache:'no-store'}).then(r => r.ok ? r.json() : Promise.reject()).then(data => {if(active)setIsOwner(data.authenticated === true);}).catch(() => {if(active)setIsOwner(false);}); }; check(); window.addEventListener('focus',check); return () => {active=false;window.removeEventListener('focus',check);}; }, []);
  const [query, setQuery] = useState(initialFilters.query||'');
  const [pageSize,setPageSize]=useState(12);
  const [paging,setPaging]=useState({key:'',page:1});
  const [genre, setGenre] = useState(initialFilters.genre||'All genres');
  const [collectionFilter,setCollectionFilter] = useState(initialFilters.collection||'All collections');
  const [sourceFilter, setSourceFilter] = useState(initialFilters.source||'All sources');
  const [filter, setFilter] = useState(initialFilters.format||'All releases');
  const [quality, setQuality] = useState(initialFilters.quality||'All resolutions');
  const [codecFilter, setCodecFilter] = useState('');
  const [featureId,setFeatureId]=useState<string|null>(null);
  const [year, setYear] = useState('All years');
  const [sort, setSort] = useState('Latest added');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchOpen, setSearchOpen] = useState(Boolean(initialFilters.search));
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(Boolean(initialFilters.saved));
  useEffect(()=>{window.dispatchEvent(new CustomEvent('vito:saved-view',{detail:onlySaved}));},[onlySaved]);
  useEffect(() => { try { const ids = JSON.parse(localStorage.getItem('vito-saved') || '[]'); if(Array.isArray(ids)){const migrated=[...new Set(ids.filter(id=>typeof id==='string').map(id=>{const release=entries.find(row=>row.id===id);return release?movieRouteId(release):id;}))];setSaved(migrated);localStorage.setItem('vito-saved',JSON.stringify(migrated));} } catch {} }, [entries]);
  function toggleSaved(id:string) { setSaved(previous => { const next = previous.includes(id) ? previous.filter(value => value !== id) : [...previous,id]; try { localStorage.setItem('vito-saved',JSON.stringify(next)); } catch {} return next; }); }
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  function openSearch(){
    setSearchOpen(true);
    window.requestAnimationFrame(()=>{searchRef.current?.focus();searchRef.current?.select();});
  }


  useEffect(() => {
    const params=new URLSearchParams(window.location.search);const initialGenre=params.get('genre');if(initialGenre)setGenre(initialGenre);const initialCollection=params.get('collection');if(initialCollection)setCollectionFilter(initialCollection);
    const initialSource=new URLSearchParams(window.location.search).get('source');if(encodeSources.some(source=>source===initialSource))setSourceFilter(initialSource!);
    const initialQuery=new URLSearchParams(window.location.search).get('q');if(initialQuery)setQuery(initialQuery);if(params.get('saved')==='1')setOnlySaved(true);if(params.get('search')==='1')setSearchOpen(true);
    fetch('/api/catalog',{cache:'no-store'}).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (Array.isArray(data.releases)) setEntries(data.releases.map(publicMovie));
    }).catch(() => {});
    const observer = new IntersectionObserver(items => items.forEach(item => {
      if (item.isIntersecting) { item.target.classList.add('is-visible'); observer.unobserve(item.target); }
    }), { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(()=>{let active=true;const refresh=()=>{if(document.hidden)return;fetch('/api/catalog',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(active&&Array.isArray(data.releases))setEntries(data.releases.map(publicMovie));}).catch(()=>{});};window.addEventListener('focus',refresh);const interval=window.setInterval(refresh,60000);return()=>{active=false;window.removeEventListener('focus',refresh);window.clearInterval(interval);};},[]);

  useEffect(() => {
    const showSearch=()=>openSearch();window.addEventListener('vito:open-search',showSearch);
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); window.location.assign('/admin/login'); return; }
      if (!event.isComposing&&!event.altKey&&(event.metaKey||event.ctrlKey)&&(event.code==='KeyK'||event.key.toLowerCase()==='k')) {
        event.preventDefault();
        if(!event.repeat)openSearch();
      }
      if (event.key === 'Escape') { setSearchOpen(false); }
    }
    window.addEventListener('keydown', keyboard, true);
    return () => {window.removeEventListener('keydown', keyboard, true);window.removeEventListener('vito:open-search',showSearch);};
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timeout = window.setTimeout(() => (searchOpen ? searchRef.current : dialogRef.current?.querySelector<HTMLButtonElement>('button'))?.focus(), 40);
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', trap);
    return () => { clearTimeout(timeout); document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', trap); previousFocus.current?.focus(); };
  }, [searchOpen]);

  const movieGroups=groupMovieReleases(entries);
  const cards:Movie[]=movieGroups.map(({movie,releases})=>({...movie,...(preferredRelease(releases)||[...releases].sort(newestFirst)[0]),poster:movie.poster,details:movie.details,id:movieRouteId(movie),title:movieTitle(movie),releases,releaseCount:releases.length,...groupDates(releases)})).sort(newestFirst);
  const genres=[...new Set(cards.flatMap(movieGenres))].sort();
  const collections=availableCollections(entries);
  const visibleCollection=collections.find(collection=>collection.slug===collectionFilter);
  const formats=['All releases','IMAX','Open Matte','35mm',...[...new Set(entries.map(row=>row.category))].filter(value=>value&&!['IMAX','Open Matte','35mm','Other'].includes(value))];
  const years=[...new Set(cards.map(movie=>movie.year).filter((year):year is number=>year!==null))].sort((a,b)=>b-a);
  const matchesRelease=(r:Movie)=>(sourceFilter==='All sources'||classifySource(r.filename||'')===sourceFilter)&&(!codecFilter||r.codec.includes(codecFilter))&&(filter==='All releases'||r.category===filter)&&(quality==='All resolutions'||r.resolution===quality);
  useEffect(()=>{if(query.trim().length<2)return;const timer=setTimeout(()=>recordEvent({kind:'search',query:query.trim()}),1200);return()=>clearTimeout(timer);},[query]);
  const searchScore=createMovieSearch(entries,query);
  const movies=cards.flatMap(movie=>{
    const releases=movie.releases||[movie],matching=[...releases].sort(newestFirst).filter(r=>matchesRelease(r)&&searchScore({...r,details:movie.details,title:movie.title})>0);
    if(!matching.length||(genre!=='All genres'&&!movieGenres(movie).some(value=>value.toLowerCase()===genre.toLowerCase()))||(visibleCollection&&movieCollection(movie)?.slug!==visibleCollection.slug)||(onlySaved&&!saved.includes(movie.id)&&!releases.some(r=>saved.includes(r.id)))||(year!=='All years'&&String(movie.year)!==year))return [];
    return [{...(preferredRelease(matching)||matching[0]),id:movie.id,title:movie.title,poster:movie.poster,details:movie.details,releases,matchingReleases:matching,releaseCount:releases.length,...groupDates(matching)}];
  }).sort((a,b)=>sort==='Title A–Z'?a.title.localeCompare(b.title):sort==='Release year'?(b.year||0)-(a.year||0):query.trim()?Math.max(...(b.releases||[b]).filter(matchesRelease).map(r=>searchScore({...r,details:b.details,title:b.title})))-Math.max(...(a.releases||[a]).filter(matchesRelease).map(r=>searchScore({...r,details:a.details,title:a.title}))):newestFirst(a,b));
  const pagingKey=JSON.stringify([query,genre,visibleCollection?.slug||'All collections',sourceFilter,filter,quality,codecFilter,year,sort,onlySaved,pageSize]);
  const pageData=paginate(movies,paging.key===pagingKey?paging.page:1,pageSize);
  useEffect(()=>setPaging({key:pagingKey,page:1}),[pagingKey]);
  const searchResults=movies.slice(0,12);
  function changePage(page:number){setPaging({key:pagingKey,page});document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}
  function browse(category = 'All releases') { setOnlySaved(false); setFilter(category); }
  function reset() { setGenre('All genres');setCollectionFilter('All collections');setSourceFilter('All sources');setOnlySaved(false); setQuery(''); setFilter('All releases'); setQuality('All resolutions'); setCodecFilter(''); setYear('All years'); }
  const activeFilters:ActiveFilter[]=[
 ...(query.trim()?[{id:'search',label:'Search: '+query,remove:()=>setQuery('')}]:[]),
 ...(genre!=='All genres'?[{id:'genre',label:'Genre: '+genre,remove:()=>setGenre('All genres')}]:[]),
 ...(visibleCollection?[{id:'collection',label:visibleCollection.name,remove:()=>setCollectionFilter('All collections')}]:[]),
 ...(sourceFilter!=='All sources'?[{id:'source',label:'Source: '+sourceFilter,remove:()=>setSourceFilter('All sources')}]:[]),
 ...(filter!=='All releases'?[{id:'format',label:'Format: '+filter,remove:()=>setFilter('All releases')}]:[]),
 ...(quality!=='All resolutions'?[{id:'quality',label:quality,remove:()=>setQuality('All resolutions')}]:[]),
 ...(codecFilter?[{id:'codec',label:codecFilter,remove:()=>setCodecFilter('')}]:[]),
 ...(year!=='All years'?[{id:'year',label:'Year: '+year,remove:()=>setYear('All years')}]:[]),
 ...(onlySaved?[{id:'saved',label:'Saved only',remove:()=>setOnlySaved(false)}]:[]),
 ...(sort!=='Latest added'?[{id:'sort',label:'Sort: '+sort,remove:()=>setSort('Latest added')}]:[])
 ];
  function browseSource(source:string){reset();setSourceFilter(source);document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}
  function openMovie(movie: Movie) { setSearchOpen(false); router.push('/movies/' + encodeURIComponent(movie.id)); }

  const featured=cards.filter(movie=>Boolean(movie.details?.backdrop||image(movie))).slice(0,3);
  const feature=featured.find(movie=>movie.id===featureId)||featured[0]||cards[0];
  const featureBackdrop=feature?.details?.backdrop||image(feature||cards[0]||{poster:'',id:''} as Movie);
  const recentlyUpdated=[...cards].filter(movie=>timestamp(movie.updated_at)&&((timestamp(movie.updated_at)?.getTime()||0)>(timestamp(movie.created_at)?.getTime()||0))).sort((a,b)=>(timestamp(b.updated_at)?.getTime()||0)-(timestamp(a.updated_at)?.getTime()||0)).slice(0,10);
  const hasFilters=activeFilters.length>0;
  function browseFormat(format:string){reset();if(format==='4K')setQuality('2160p');else setFilter(format);document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}
  function shelfScroll(id:string,direction:number){const shelf=document.getElementById(id);shelf?.scrollBy({left:direction*shelf.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  function posterCard(movie:Movie,rank?:number){const options=movie.releases||[movie];return <article className={'cinema-poster-card'+(rank?' ranked':'')} key={movie.id}><div className="cinema-poster-art">{rank&&<span className="cinema-rank" aria-hidden="true">{String(rank).padStart(2,'0')}</span>}<Link href={'/movies/'+encodeURIComponent(movie.id)} aria-label={'View '+movie.title}><ResilientImage src={image(movie)} alt={movie.title+' poster'} loading="lazy"/><span className="cinema-poster-quality">{movie.resolution==='2160p'?'4K':movie.resolution}</span><span className="cinema-poster-hover"><ArrowUpRight size={23}/>View encodes</span></Link><button onClick={()=>toggleSaved(movie.id)} className={saved.includes(movie.id)?'saved':''} aria-label={(saved.includes(movie.id)?'Unsave ':'Save ')+movie.title} aria-pressed={saved.includes(movie.id)}>{saved.includes(movie.id)?<Check size={16}/>:<Plus size={17}/>}</button></div><Link className="cinema-poster-copy" href={'/movies/'+encodeURIComponent(movie.id)}><h3>{movie.title}</h3><p><span>{movie.year||'Year unavailable'}</span><span>{options.length} {options.length===1?'encode':'encodes'}</span></p></Link></article>;}
  function shelf(title:string,kicker:string,items:Movie[],id:string,href:string,ranked=false){if(!items.length)return null;return <section className="cinema-shelf" aria-label={title}><div className="cinema-section-heading"><div><span className="cinema-eyebrow">{kicker}</span><h2>{title}<span>.</span></h2></div><div className="cinema-shelf-actions"><Link href={href}>View all <ArrowUpRight size={14}/></Link><button aria-label={'Scroll '+title+' left'} onClick={()=>shelfScroll(id,-1)}><ChevronLeft size={19}/></button><button aria-label={'Scroll '+title+' right'} onClick={()=>shelfScroll(id,1)}><ChevronRight size={19}/></button></div></div><div className="cinema-poster-shelf" id={id}>{items.map((movie,index)=>posterCard(movie,ranked?index+1:undefined))}</div></section>;}
  return <div className="archive-app cinema-app" id="top">
    <SiteHeader onSearch={openSearch} savedCount={saved.length} owner={isOwner}/>
    <main>
      {feature&&<section className="cinema-hero" aria-label="Featured in the archive"><div className={'cinema-hero-art '+(!feature.details?.backdrop?'poster-fallback':'')} key={feature.id}>{featureBackdrop&&<ResilientImage src={featureBackdrop} alt="" fetchPriority="high"/>}</div><div className="cinema-hero-shade"/><div className="cinema-hero-content"><span className="cinema-eyebrow"><i/> IN THE SPOTLIGHT <span> / </span> THE VITO COLLECTION</span><div className="cinema-hero-meta"><span>{feature.year}</span>{movieGenres(feature).slice(0,3).map(genre=><span key={genre}>{genre}</span>)}{Boolean(feature.details?.tmdbRating)&&<span className="cinema-rating">★ {feature.details!.tmdbRating!.toFixed(1)} <small>TMDB</small></span>}</div><h1>{feature.title}</h1><div className="cinema-hero-editions"><span>{feature.resolution==='2160p'?'4K UHD':feature.resolution}</span>{feature.category!=='Other'&&<span>{feature.category}</span>}<span>{feature.releaseCount||1} {(feature.releaseCount||1)===1?'encode':'encodes'} available</span></div><p>{feature.details?.synopsis||'The film you love. The edition you choose. Explore the available encodes, compare the details and find your frame.'}</p><div className="cinema-hero-buttons"><Link className="cinema-primary" href={'/movies/'+encodeURIComponent(feature.id)}><Download size={18}/>Explore encodes<ArrowRight size={18}/></Link><button className={'cinema-secondary '+(saved.includes(feature.id)?'is-saved':'')} onClick={()=>toggleSaved(feature.id)} aria-pressed={saved.includes(feature.id)}>{saved.includes(feature.id)?<Check size={18}/>:<Plus size={19}/>} {saved.includes(feature.id)?'On my shelf':'Add to my shelf'}</button></div><span className="cinema-hero-note">DIFFERENT EDITIONS. ONE GREAT FILM.</span></div><div className="cinema-feature-index"><span>CURATED PERSPECTIVES</span><div>{featured.map((movie,index)=><button key={movie.id} aria-label={'Feature '+movie.title} aria-pressed={feature.id===movie.id} onClick={()=>setFeatureId(movie.id)}><b>{String(index+1).padStart(2,'0')}</b><span>{movie.title}<small>{movie.year} / {movie.category}</small></span><span className="cinema-feature-line"/></button>)}</div></div><a className="cinema-hero-browse" href="#latest">Discover the archive <ArrowDown size={15}/></a></section>}
      <div className="cinema-content">
        <div className="cinema-intro-line" id="latest"><span><i/> INDEPENDENT ENCODES. EXCEPTIONAL PERSPECTIVES.</span><span>{cards.length} films <b>/</b> {entries.length} encodes</span></div>
        {!entries[0]?.live&&<p className="archive-preview"><span/>Preview collection. Published movies and mirrors will appear here when ready.</p>}
        {shelf('Fresh off the encode','THE LATEST ADDITIONS',cards.slice(0,10),'latest-shelf','#collection',true)}
        <section className="cinema-format-section" aria-label="Explore by format"><div className="cinema-section-heading"><div><span className="cinema-eyebrow">SAME FILM. A DIFFERENT PERSPECTIVE.</span><h2>Find your frame<span>.</span></h2></div><Link href="/faq#format-guide">The format guide <ArrowUpRight size={14}/></Link></div><div className="cinema-format-grid">{[{format:'IMAX',title:'IMAX',caption:'A bigger perspective.',number:'01',className:'imax'},{format:'Open Matte',title:'OPEN MATTE',caption:'See beyond the usual frame.',number:'02',className:'matte'},{format:'35mm',title:'35mm',caption:'For the love of film.',number:'03',className:'film'},{format:'4K',title:'4K UHD',caption:'Every detail, preserved.',number:'04',className:'uhd'}].map(item=><button className={'cinema-format-tile '+item.className} onClick={()=>browseFormat(item.format)} key={item.title}><span className="cinema-format-top">PERSPECTIVE {item.number}<ArrowUpRight size={18}/></span><div className="cinema-format-mark" aria-hidden="true"><i/><i/>{item.title}</div><span className="cinema-format-caption">{item.caption}<b>{cards.filter(movie=>movie.releases?.some(release=>item.format==='4K'?release.resolution==='2160p':release.category===item.format)).length} films</b></span></button>)}</div></section>
        {recentlyUpdated.length>0&&shelf('A fresh perspective','RECENTLY UPDATED',recentlyUpdated,'updated-shelf','/recently-updated')}
        {collections.length>0&&<section className="cinema-collections" aria-label="Movie collections"><div className="cinema-section-heading"><div><span className="cinema-eyebrow">FOLLOW THE STORY</span><h2>Every chapter. One collection<span>.</span></h2></div><Link href="/collections">Explore collections <ArrowUpRight size={14}/></Link></div><div className="cinema-collection-grid">{collections.slice(0,3).map((collection,index)=>{const members=cards.filter(movie=>movieCollection(movie)?.slug===collection.slug);return <Link href={'/collections/'+collection.slug} className="cinema-collection-tile" key={collection.slug}><div className="cinema-collection-art">{members.slice(0,3).map(movie=><ResilientImage src={image(movie)} alt="" key={movie.id} loading="lazy"/>)}</div><span className="cinema-collection-number">COLLECTION / {String(index+1).padStart(2,'0')}</span><div><span>{collection.count} {collection.count===1?'film':'films'} in the archive</span><h3>{collection.name.replace(/ Collection$/,'')}</h3><span className="cinema-collection-cta">Explore the collection <ArrowUpRight size={17}/></span></div></Link>;})}</div></section>}
        <section className="cinema-library archive-collection" id="collection"><div className="cinema-section-heading"><div><span className="cinema-eyebrow">YOUR NEXT GREAT FIND</span><h2>{onlySaved?'Your saved films':visibleCollection?visibleCollection.name:genre!=='All genres'?genre+' films':'The complete archive'}<span>.</span></h2></div><span className="cinema-library-count">{movies.length} films to discover</span></div>
          <div className="cinema-library-toolbar"><label className="cinema-library-search"><Search size={19}/><input aria-label="Search movies" placeholder="A title. A series. Your next favourite." value={query} onChange={event=>setQuery(event.target.value)} maxLength={200}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={17}/></button>}</label><div className="archive-view"><button aria-label="Grid view" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><Grid2X2 size={17}/></button><button aria-label="List view" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={18}/></button></div></div>
          <div className="cinema-filter-row"><div className="archive-source-tabs" aria-label="Browse encode sources">{['All sources',...encodeSources].map(source=><button key={source} className={sourceFilter===source?'active':''} aria-pressed={sourceFilter===source} onClick={()=>browseSource(source)}>{source}</button>)}</div><div className="cinema-sort"><select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort releases"><option>Latest added</option><option>Title A–Z</option><option>Release year</option></select></div></div>
          <div className="archive-tabs" aria-label="Filter format">{formats.map(format=><button key={format} className={filter===format?'active':''} aria-pressed={filter===format} onClick={()=>browse(format)}>{format==='All releases'?'All formats':format}</button>)}</div>
          <div className="archive-filters"><label><span>GENRE</span><select value={genre} onChange={event=>setGenre(event.target.value)} aria-label="Genre"><option>All genres</option>{genres.map(value=><option key={value}>{value}</option>)}{genre!=='All genres'&&!genres.includes(genre)&&<option>{genre}</option>}</select></label><label><span>RESOLUTION</span><select value={quality} onChange={event=>setQuality(event.target.value)} aria-label="Resolution"><option>All resolutions</option>{['2160p','1440p','1080p','720p'].map(value=><option key={value}>{value}</option>)}</select></label><label><span>CODEC</span><select value={codecFilter} onChange={event=>setCodecFilter(event.target.value)} aria-label="Codec"><option value="">All codecs</option><option>HEVC</option><option>AV1</option><option>H.264</option></select></label><label><span>RELEASE YEAR</span><select value={year} onChange={event=>setYear(event.target.value)} aria-label="Release year"><option>All years</option>{years.map(value=><option key={value}>{value}</option>)}</select></label><button className="cinema-reset" onClick={reset} disabled={!hasFilters}><X size={14}/>Reset filters</button></div>
          <ActiveFilters filters={activeFilters} clear={()=>{reset();setSort('Latest added');}}/><div className="archive-results" role="status" aria-live="polite"><span>{movies.length} {movies.length===1?'film':'films'}{query?' matching “'+query+'”':''}</span><span>CHOOSE THE FILM. FIND YOUR ENCODE.</span></div>
          <div className={'archive-grid cinema-library-grid '+(view==='list'?'archive-list':'')}>{pageData.items.map(movie=>{const options=movie.matchingReleases||movie.releases||[movie],badge=freshness(movie,now),primary=preferredRelease(options);return <article className="archive-card archive-card-compact" key={movie.id}><div className="archive-card-art"><Link className="archive-card-open" href={'/movies/'+encodeURIComponent(movie.id)} aria-label={'View '+movie.title}><ResilientImage src={image(movie)} alt={movie.title+' poster'} loading="lazy"/>{badge&&<span className="archive-card-state">{badge}</span>}<span className="archive-card-quality">{movie.resolution==='2160p'?'4K':movie.resolution}</span><span className="archive-card-overlay"><ArrowUpRight size={24}/>View encodes</span></Link><button className={'archive-bookmark '+(saved.includes(movie.id)?'active':'')} onClick={()=>toggleSaved(movie.id)} aria-label={(saved.includes(movie.id)?'Unsave ':'Save ')+movie.title} aria-pressed={saved.includes(movie.id)}><Bookmark size={16} fill={saved.includes(movie.id)?'currentColor':'none'}/></button></div><Link className="archive-card-copy" href={'/movies/'+encodeURIComponent(movie.id)}><h3>{movie.title}</h3><div className="archive-card-facts">{movie.year&&<span>{movie.year}</span>}{movie.category&&movie.category!=='Other'&&<span>{movie.category}</span>}</div><div className="archive-card-summary"><span>{primary?primary.size:compactSize(options)}</span><span>{options.length} {options.length===1?'encode':'encodes'}</span></div></Link></article>;})}</div>
          {!movies.length&&<div className="archive-empty"><Search size={30}/><h3>{onlySaved?'Your saved shelf is empty.':'No films in this frame.'}</h3><p>{onlySaved?'Save a film to keep your next watch close.':'Try another title or clear a filter to discover more.'}</p><button onClick={reset}>Explore all films <ArrowUpRight size={15}/></button></div>}
          <Pagination {...pageData} pageSize={pageSize} onPage={changePage} onSize={setPageSize} label="movies" pageSizes={[12,24,48]}/>
        </section>
        <section className="cinema-closing"><div><span className="cinema-eyebrow">THE VITOENCODES PERSPECTIVE</span><h2>More of the frame.<br/><span>More of the film.</span></h2></div><div><p>IMAX. Open Matte. 35mm. Different editions deserve a place of their own. Find yours, compare the encodes and choose your mirror.</p><Link href="/about">Inside the archive <ArrowUpRight size={16}/></Link></div><span className="cinema-closing-mark" aria-hidden="true">V.</span></section>
      </div>
    </main>
    <SiteFooter/>
    {searchOpen&&<div className="backdrop cinema-search-backdrop" onClick={()=>setSearchOpen(false)}><div ref={dialogRef} className="command-dialog" role="dialog" aria-modal="true" aria-label="Search the archive" onClick={event=>event.stopPropagation()}><button className="close" aria-label="Close dialog" onClick={()=>setSearchOpen(false)}><X size={20}/></button><span className="cinema-eyebrow">FIND YOUR NEXT FRAME</span><div className="command-input"><Search size={23}/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search a title or series" maxLength={200} onKeyDown={event=>{if(event.key==='Enter'&&searchResults[0]){event.preventDefault();openMovie(searchResults[0]);}}} aria-label="Search archive"/></div><div className="command-results">{searchResults.map(movie=><button key={movie.id} onClick={()=>openMovie(movie)}><ResilientImage src={image(movie)} alt="" loading="lazy"/><span>{movie.title}<small>{movie.year} / {movie.releaseCount} encodes</small></span><ArrowUpRight size={18}/></button>)}{!movies.length&&<p>No matching films. Try another title or clear the archive filters.</p>}</div><button className="search-view-all" onClick={()=>{setSearchOpen(false);document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}}>Browse {movies.length} results <ArrowRight size={15}/></button><div className="command-hint"><kbd>ESC</kbd> to close<span>CTRL / CMD + K to search</span></div></div></div>}
  </div>;
}

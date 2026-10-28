'use client';
import ResilientImage from './components/resilient-image';
import ActiveFilters,{type ActiveFilter} from './components/active-filters';
import SiteFooter from './components/site-footer';

import ReleaseDates from './components/release-dates';
import {newestFirst,groupDates} from '../lib/release-dates';
import Pagination from './components/pagination';
import {paginate,releaseSearchScore} from '../lib/catalog-search';
import type {Release} from '../lib/store';
import {encodeSpecs} from '../lib/movie-details';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Search, X, Film, Grid2X2, List, Command, Layers3, Bookmark, Download, Settings2 } from 'lucide-react';
import {availableCollections,movieGenres,movieCollection,groupMovieReleases,movieRouteId,movieTitle} from '../lib/library';
import type {MovieDetails} from '../lib/movie-details';
import { detectEncoder } from '../lib/encoder';
import { classifySource, encodeSources } from '../lib/encode-source';
import { catalog } from '../lib/catalog';

type Movie = Omit<typeof catalog[number],'year'> & {year:number|null} & { links?: { label: string; url: string }[]; live?: boolean; filename?: string;status?:string;details?:MovieDetails;releases?:Movie[];releaseCount?:number;created_at?:string;updated_at?:string|null };
const image = (movie: Movie) => movie.poster ? ((movie.poster.startsWith('/') || movie.poster.startsWith('https://')) ? movie.poster : posterIds.has(movie.id) ? '/posters/' + movie.id + '.jpg' : 'https://image.tmdb.org/t/p/w780/' + movie.poster) : '';
const formats = ['All releases', 'IMAX', 'Open Matte', '35mm'];

const posterIds = new Set(catalog.map(m => m.id));

const publicMovie=(r:Release):Movie=>{const specs=encodeSpecs(r.filename);return {...r,codec:specs.codec+(specs.bitDepth!=='Not specified'?' · '+specs.bitDepth:''),poster:r.poster||'',live:true};};
export default function Home({initialReleases=[],initialFilters={}}:{initialReleases?:Release[];initialFilters?:{query?:string;genre?:string;collection?:string;source?:string;saved?:boolean;search?:boolean}}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Movie[]>(initialReleases.length?initialReleases.map(publicMovie):catalog);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => { let active = true; const check = () => { fetch('/api/admin/session', {cache:'no-store'}).then(r => r.ok ? r.json() : Promise.reject()).then(data => {if(active)setIsOwner(data.authenticated === true);}).catch(() => {if(active)setIsOwner(false);}); }; check(); window.addEventListener('focus',check); return () => {active=false;window.removeEventListener('focus',check);}; }, []);
  const [query, setQuery] = useState(initialFilters.query||'');
  const [pageSize,setPageSize]=useState(8);
  const [paging,setPaging]=useState({key:'',page:1});
  const [genre, setGenre] = useState(initialFilters.genre||'All genres');
  const [collectionFilter,setCollectionFilter] = useState(initialFilters.collection||'All collections');
  const [sourceFilter, setSourceFilter] = useState(initialFilters.source||'All sources');
  const [filter, setFilter] = useState('All releases');
  const [quality, setQuality] = useState('All resolutions');
  const [codecFilter, setCodecFilter] = useState('');
  const [selected, setSelected] = useState<Movie | null>(null);
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
    const openSearch=()=>setSearchOpen(true);window.addEventListener('vito:open-search',openSearch);
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); window.location.assign('/admin/login'); return; }
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setSearchOpen(open => !open); }
      if (event.key === 'Escape') { setSelected(null); setSearchOpen(false); }
    }
    window.addEventListener('keydown', keyboard);
    return () => {window.removeEventListener('keydown', keyboard);window.removeEventListener('vito:open-search',openSearch);};
  }, []);

  useEffect(() => {
    if (!selected && !searchOpen) return;
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
  }, [selected, searchOpen]);

  const movieGroups=groupMovieReleases(entries);
  const cards:Movie[]=movieGroups.map(({movie,releases})=>({...movie,...[...releases].sort(newestFirst)[0],poster:movie.poster,details:movie.details,id:movieRouteId(movie),title:movieTitle(movie),releases,releaseCount:releases.length,...groupDates(releases)})).sort(newestFirst);
  const genres=[...new Set(cards.flatMap(movieGenres))].sort();
  const collections=availableCollections(entries);
  const years=[...new Set(cards.map(movie=>movie.year).filter((year):year is number=>year!==null))].sort((a,b)=>b-a);
  const matchesRelease=(r:Movie)=>(sourceFilter==='All sources'||classifySource(r.filename||'')===sourceFilter)&&(!codecFilter||r.codec.includes(codecFilter))&&(filter==='All releases'||r.category===filter)&&(quality==='All resolutions'||r.resolution===quality);
  const movies=cards.flatMap(movie=>{
    const releases=movie.releases||[movie],matching=[...releases].sort(newestFirst).filter(r=>matchesRelease(r)&&releaseSearchScore({...r,details:movie.details,title:movie.title},query)>0);
    if(!matching.length||(genre!=='All genres'&&!movieGenres(movie).some(value=>value.toLowerCase()===genre.toLowerCase()))||(collectionFilter!=='All collections'&&movieCollection(movie)?.slug!==collectionFilter)||(onlySaved&&!saved.includes(movie.id)&&!releases.some(r=>saved.includes(r.id)))||(year!=='All years'&&String(movie.year)!==year))return [];
    return [{...matching[0],id:movie.id,title:movie.title,poster:movie.poster,details:movie.details,releases,releaseCount:releases.length,...groupDates(matching)}];
  }).sort((a,b)=>sort==='Title A–Z'?a.title.localeCompare(b.title):sort==='Release year'?(b.year||0)-(a.year||0):query.trim()?Math.max(...(b.releases||[b]).filter(matchesRelease).map(r=>releaseSearchScore({...r,details:b.details,title:b.title},query)))-Math.max(...(a.releases||[a]).filter(matchesRelease).map(r=>releaseSearchScore({...r,details:a.details,title:a.title},query))):newestFirst(a,b));
  const pagingKey=JSON.stringify([query,genre,collectionFilter,sourceFilter,filter,quality,codecFilter,year,sort,onlySaved,pageSize]);
  const pageData=paginate(movies,paging.key===pagingKey?paging.page:1,pageSize);
  useEffect(()=>setPaging({key:pagingKey,page:1}),[pagingKey]);
  const searchResults=movies.slice(0,12);
  function changePage(page:number){setPaging({key:pagingKey,page});document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}
  function browse(category = 'All releases') { setOnlySaved(false); setFilter(category); }
  function reset() { setGenre('All genres');setCollectionFilter('All collections');setSourceFilter('All sources');setOnlySaved(false); setQuery(''); setFilter('All releases'); setQuality('All resolutions'); setCodecFilter(''); setYear('All years'); }
  const activeFilters:ActiveFilter[]=[
 ...(query.trim()?[{id:'search',label:'Search: '+query,remove:()=>setQuery('')}]:[]),
 ...(genre!=='All genres'?[{id:'genre',label:'Genre: '+genre,remove:()=>setGenre('All genres')}]:[]),
 ...(collectionFilter!=='All collections'?[{id:'collection',label:collections.find(item=>item.slug===collectionFilter)?.name||'Collection',remove:()=>setCollectionFilter('All collections')}]:[]),
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

  return <>
    <div className="archive-app" id="top">
      <header className="archive-header">
        <a className="archive-brand" href="/" aria-label="VITOENCODES home"><span className="archive-mark">V<span>.</span></span><span>VITO<b>ENCODES</b><small>THE INDEPENDENT ARCHIVE</small></span></a>
        <label className="archive-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title, year, quality, genre or encoder" maxLength={200} aria-label="Search movies"/>{query?<button onClick={()=>setQuery('')} aria-label="Clear search"><X size={16}/></button>:<kbd>CTRL K</kbd>}</label>
        <Link className="archive-saved" href="/saved"><Bookmark size={17}/><span>Saved</span><b>{saved.length}</b></Link>
        {isOwner&&<a className="archive-owner" href="/admin?view=catalog"><Settings2 size={16}/> Studio</a>}
      </header>
      <div className="archive-layout">
        <aside className="archive-sidebar" aria-label="Browse archive">
          <span className="archive-label">YOUR NEXT GREAT FRAME</span>
          <nav><button className={!onlySaved&&filter==='All releases'&&sourceFilter==='All sources'?'active':''} onClick={reset}><Layers3 size={17}/>All movies<span>{cards.length}</span></button><a className="archive-saved-nav" href="/saved"><Bookmark size={17}/>Saved movies<span>{saved.length}</span></a></nav>
          <a className="archive-extra-link" href="/recently-updated">Recently updated <ArrowUpRight size={15}/></a><a className="archive-collections-link" href="/collections"><Layers3 size={17}/> Movie collections <ArrowUpRight size={14}/></a><span className="archive-label">BROWSE BY SOURCE</span><nav className="archive-source-nav">{encodeSources.map(source=><button key={source} className={sourceFilter===source?'active':''} onClick={()=>browseSource(source)}><Layers3 size={17}/>{source}<span>{movieGroups.filter(group=>group.releases.some(movie=>classifySource(movie.filename||'')===source)).length}</span></button>)}</nav><span className="archive-label">EXPLORE BY FORMAT</span>
          <nav>{formats.slice(1).map((format,index)=><button key={format} className={filter===format?'active':''} onClick={()=>browse(format)}><Film size={17}/>{format}<small>{String(index+1).padStart(2,'0')}</small></button>)}</nav>
          <div className="archive-quality"><span className="archive-label">PICK YOUR RESOLUTION</span><div>{['2160p','1080p','720p'].map(value=><button key={value} className={quality===value?'active':''} onClick={()=>setQuality(quality===value?'All resolutions':value)}>{value==='2160p'?'4K UHD':value}</button>)}</div></div>
          <div className="archive-sidebar-note"><Download size={22}/><strong>Your format.<br/>Your download.</strong><p>Compare the encode specs and choose an available mirror.</p><span>NO STREAMING. JUST ENCODES.</span></div>
          <a className="archive-sidebar-bottom" href="#collection">Made for the love of film <ArrowUpRight size={13}/></a>
        </aside>
        <main className="archive-main">
          <div className="archive-breadcrumb">The archive <span>/</span> <b>{onlySaved?'Saved releases':'Browse encodes'}</b></div>
          <section className="archive-intro"><div><span className="archive-label">A DIFFERENT PERSPECTIVE ON CINEMA</span><h1>Great films.<br/><span>Every detail intact.</span></h1><p>Discover carefully crafted encodes.<br/>Original frames. Clear specs. Your choice of mirror.</p><a href="#collection">Explore the archive <ArrowDown size={15}/></a></div><div className="archive-poster-stack" aria-hidden="true">{cards.filter(movie=>image(movie)).slice(0,3).map(movie=><ResilientImage key={movie.id} src={image(movie)} alt=""/>)}</div><span className="archive-intro-index">VITO / THE COLLECTION</span></section>
          <div className="archive-format-strip">{[{title:'IMAX',caption:'The expanded frame',format:'IMAX'},{title:'OPEN MATTE',caption:'More of the picture',format:'Open Matte'},{title:'35mm',caption:'The film experience',format:'35mm'},{title:'4K UHD',caption:'Every little detail',format:'4K'}].map(item=><button key={item.title} onClick={()=>{reset();if(item.format==='4K')setQuality('2160p');else setFilter(item.format);}}><div><strong>{item.title}</strong><span>{item.caption}</span></div><ArrowUpRight size={16}/></button>)}</div>
          {!entries[0]?.live&&<p className="archive-preview"><span/> Preview collection — published releases and download mirrors will appear here when ready.</p>}
          <div className="archive-content-columns">
            <section className="archive-collection" id="collection">
              <div className="archive-section-heading"><div><span className="archive-label">THE RELEASE LIBRARY</span><h2>{onlySaved?'Saved releases':collectionFilter!=='All collections'?(collections.find(c=>c.slug===collectionFilter)?.name||'Collection'):genre!=='All genres'?genre+' movies':sourceFilter==='All sources'?'Newly added encodes':sourceFilter+' movies'}<span>{movies.length}</span></h2></div><div className="archive-view"><button aria-label="Grid view" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><Grid2X2 size={17}/></button><button aria-label="List view" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={18}/></button></div></div>
              <div className="archive-source-tabs" aria-label="Browse encode sources">{['All sources',...encodeSources].map(source=><button key={source} className={sourceFilter===source?'active':''} aria-pressed={sourceFilter===source} onClick={()=>browseSource(source)}>{source}<span>{source==='All sources'?cards.length:entries.filter(movie=>classifySource(movie.filename||'')===source).length}</span></button>)}</div><div className="archive-tabs">{formats.map(format=><button key={format} className={filter===format?'active':''} onClick={()=>browse(format)}>{format}</button>)}</div>
              <div className="archive-filters"><label><span>GENRE</span><select value={genre} onChange={e=>setGenre(e.target.value)} aria-label="Genre"><option>All genres</option>{genres.map(value=><option key={value}>{value}</option>)}{genre!=='All genres'&&!genres.includes(genre)&&<option>{genre}</option>}</select></label><label><span>QUALITY</span><select value={quality} onChange={e=>setQuality(e.target.value)} aria-label="Resolution"><option>All resolutions</option>{['2160p','1440p','1080p','720p'].map(value=><option key={value}>{value}</option>)}</select></label><label><span>CODEC</span><select value={codecFilter} onChange={e=>setCodecFilter(e.target.value)} aria-label="Codec"><option value="">All codecs</option><option>HEVC</option><option>AV1</option><option>H.264</option></select></label><label><span>YEAR</span><select value={year} onChange={e=>setYear(e.target.value)} aria-label="Release year"><option>All years</option>{years.map(value=><option key={value}>{value}</option>)}</select></label><button onClick={reset} title="Reset all filters"><X size={14}/> Reset</button></div>
              <ActiveFilters filters={activeFilters} clear={()=>{reset();setSort('Latest added');}}/><div className="archive-results" role="status" aria-live="polite"><span>{movies.length} {movies.length===1?'movie':'movies'}{query?' matching “'+query+'”':''}</span><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort releases"><option>Latest added</option><option>Title A–Z</option><option>Release year</option></select></div>
              <div className={'archive-grid '+(view==='list'?'archive-list':'')}>{pageData.items.map(movie=><article className="archive-card" key={movie.id}><div className="archive-card-art"><Link className="archive-card-open" href={'/movies/'+encodeURIComponent(movie.id)} aria-label={'View '+movie.title}><ResilientImage src={image(movie)} alt={movie.title+' poster'} loading="lazy"/><span className="archive-card-quality">{movie.resolution}</span><span className="archive-card-overlay"><Download size={24}/> View encode</span></Link><button className={'archive-bookmark '+(saved.includes(movie.id)?'active':'')} onClick={()=>toggleSaved(movie.id)} aria-label={(saved.includes(movie.id)?'Unsave ':'Save ')+movie.title} aria-pressed={saved.includes(movie.id)}><Bookmark size={16} fill={saved.includes(movie.id)?'currentColor':'none'}/></button></div><Link className="archive-card-copy" href={'/movies/'+encodeURIComponent(movie.id)}><span className="archive-card-format">{classifySource(movie.filename||'')!=='Unknown'&&<b className="archive-source-badge">{classifySource(movie.filename||'')}</b>}{movie.category} <span> / {movie.year}</span></span><h3>{movie.title}</h3><span className="archive-card-version-count">{movie.releaseCount&&movie.releaseCount>1?movie.releaseCount+' releases to compare':'1 release'}</span>{movie.details?.genres&&<span className="archive-card-genres">{movie.details.genres}</span>}<span className="archive-card-encoder">{movie.filename?detectEncoder(movie.filename):'VITOENCODES'}</span><div className="archive-card-meta"><span>{movie.codec.replace('Â·','·')}</span><strong>{movie.size}</strong></div><ReleaseDates created_at={movie.created_at} updated_at={movie.updated_at}/></Link></article>)}</div>
              {!movies.length&&<div className="archive-empty"><Search size={30}/><h3>{onlySaved?'Your saved shelf is empty.':'No matching releases.'}</h3><p>{onlySaved?'Bookmark any encode to keep it here.':'Try another title or clear your filters.'}</p><button onClick={reset}>Browse all encodes <ArrowUpRight size={15}/></button></div>}
              <Pagination {...pageData} pageSize={pageSize} onPage={changePage} onSize={setPageSize} label="movies"/>
            </section>
            <aside className="archive-recent"><div className="archive-recent-heading"><span className="archive-label">ON THE SHELF</span><h2>Recently added <ArrowDown size={15}/></h2></div>{cards.slice(0,5).map((movie,index)=><button className="archive-recent-item" key={movie.id} onClick={()=>openMovie(movie)}><span className="archive-recent-number">{String(index+1).padStart(2,'0')}</span>{image(movie)?<ResilientImage src={image(movie)} alt="" loading="lazy"/>:<span className="archive-recent-placeholder"><Film size={18}/></span>}<div><strong>{movie.title}</strong><span>{movie.year} · {movie.resolution}</span><small>{movie.category} <b>{movie.size}</b></small></div></button>)}<div className="archive-year-browse"><span className="archive-label">BROWSE BY RELEASE YEAR</span><div>{years.slice(0,8).map(value=><button key={value} className={year===String(value)?'active':''} onClick={()=>{setYear(year===String(value)?'All years':String(value));document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}}>{value}<ArrowUpRight size={12}/></button>)}</div></div><div className="archive-editorial"><Film size={26}/><h3>More than<br/>a file name.</h3><p>IMAX, Open Matte, 35mm. Find the frame you’re looking for.</p><span>THE VITOENCODES STANDARD</span></div></aside>
          </div>
          <SiteFooter/>
        </main>
      </div>
    </div>

    {(selected || searchOpen) && <div className="backdrop" onClick={() => { setSelected(null); setSearchOpen(false); }}><div ref={dialogRef} className={searchOpen ? 'command-dialog' : 'release-dialog'} role="dialog" aria-modal="true" aria-label={searchOpen ? 'Search the archive' : selected?.title} onClick={e => e.stopPropagation()}><button className="close" aria-label="Close dialog" onClick={() => { setSelected(null); setSearchOpen(false); }}><X size={20}/></button>{searchOpen ? <><div className="command-input"><Search size={24}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Dune 2024, IMAX, 4K or HEVC" maxLength={200} onKeyDown={event=>{if(event.key==='Enter'&&searchResults[0]){event.preventDefault();openMovie(searchResults[0]);}}} aria-label="Search archive"/></div><div className="command-results">{searchResults.map(m => <button key={m.id} onClick={() => openMovie(m)}><span>{m.title}<small>{m.year} / {m.category}</small></span><ArrowUpRight size={20}/></button>)}{!movies.length && <p>No releases found. Try fewer words or reset your filters.</p>}</div><button className="search-view-all" onClick={()=>{setSearchOpen(false);document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});}}>View all {movies.length} results <ArrowUpRight size={15}/></button><div className="command-hint"><Command size={13}/> K TO SEARCH <span>ESC TO CLOSE</span></div></> : selected && <><div className="dialog-art">{image(selected) ? <ResilientImage src={image(selected)} alt={selected.title + ' poster'}/> : <Film size={70}/>}</div><div className="dialog-copy"><span className="eyebrow">{selected.category} / {selected.live ? 'THE ARCHIVE' : 'PREVIEW RELEASE'}</span><h2>{selected.title}</h2><div className="dialog-specs"><span>YEAR<strong>{selected.year || '—'}</strong></span><span>RESOLUTION<strong>{selected.resolution}</strong></span><span>FILE SIZE<strong>{selected.size}</strong></span></div><p className="codec-label">{selected.codec}</p><a className="primary" href={'/movies/' + encodeURIComponent(selected.id)}>Full release details <ArrowUpRight size={19}/></a>{selected.links?.length ? <div className="download-links">{selected.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={15}/></a>)}</div> : <p className="preview-note">Preview entry. Download mirrors will appear when your catalog is connected.</p>}</div></>}</div></div>}
  </>;
}

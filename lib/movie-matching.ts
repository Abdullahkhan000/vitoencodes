const stop=new Set(['the','a','an','of','and','in','on','to','for','from','movie','film']);
const romans:Record<string,string>={ii:'2',iii:'3',iv:'4',v:'5',vi:'6',vii:'7',viii:'8',ix:'9',x:'10'};
export function normalizeMovieTitle(title:string){
 const words=title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^(?:copy of\s+)+/,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/);
 return words.map((word,index)=>index>0&&romans[word]?romans[word]:['two','three','four','five','six','seven','eight','nine','one'].includes(word)&&['part','chapter','episode'].includes(words[index-1])?String(['one','two','three','four','five','six','seven','eight','nine'].indexOf(word)+1):word).join(' ');
}
function tokens(title:string){return normalizeMovieTitle(title).split(' ').filter(word=>word&&!stop.has(word));}
function similarity(a:string,b:string){if(a===b)return 1;if(Math.min(a.length,b.length)<5)return 0;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}}return 1-row[b.length]/Math.max(a.length,b.length);}
export function titleMatchScore(query:string,candidate:string){
 const q=tokens(query),c=tokens(candidate);if(!q.length||!c.length)return 0;
 const qNumbers=q.filter(v=>/^\d+$/.test(v)),cNumbers=c.filter(v=>/^\d+$/.test(v));if(qNumbers.some(v=>!cNumbers.includes(v)))return 0;
 if(q.join(' ')===c.join(' '))return 1;
 const used=new Set<number>();let matched=0,total=0;
 for(const token of q){let best=0,index=-1;for(let i=0;i<c.length;i++){if(used.has(i))continue;const score=similarity(token,c[i]);if(score>best){best=score;index=i;}}if(best>=.8){matched++;total+=best;used.add(index);}}
 if(q.length===1){return matched===1&&q[0].length>=4?0.91:0;}
 if(matched<2)return 0;
 const coverage=matched/Math.min(q.length,c.length),balance=matched/Math.max(q.length,c.length),accuracy=total/matched;
 if(coverage<.8||balance<.35)return 0;
 return (.82*coverage+.18*balance)*accuracy;
}
export type MovieCandidate={id:number;title?:string;original_title?:string;release_date?:string;release_year?:string|number};
export function rankMovieCandidates(payload:unknown,title:string,year:number|null){
 if(!year)return {id:null,reason:'Set the release year before importing movie information.'};
 const results=payload&&typeof payload==='object'?(payload as {results?:unknown}).results:undefined;
 if(!Array.isArray(results))return {id:null,reason:'TMDB returned an unexpected search response.'};
 const ranked=new Map<number,number>();
 for(const value of results){if(!value||typeof value!=='object')continue;const item=value as MovieCandidate;if(!Number.isSafeInteger(item.id)||item.id<1||Number(item.release_year||String(item.release_date||'').slice(0,4))!==year)continue;const score=Math.max(...[item.title,item.original_title].filter((v):v is string=>typeof v==='string').map(v=>titleMatchScore(title,v)),0);ranked.set(item.id,Math.max(ranked.get(item.id)||0,score));}
 const ordered=[...ranked].filter(([,score])=>score>=.86).sort((a,b)=>b[1]-a[1]);
 if(!ordered.length)return {id:null,reason:'No confident title and year match. Try a clearer title.'};
 if(ordered[1]&&ordered[0][1]-ordered[1][1]<.065)return {id:null,reason:'Multiple similar movies match this title and year. Use a more specific title.'};
 return {id:ordered[0][0],reason:''};
}
export function movieSearchQueries(title:string){
 const clean=normalizeMovieTitle(title),significant=tokens(title),queries=[title.trim(),clean,significant.join(' '),significant.slice(0,3).join(' ')];
 return [...new Set(queries.filter(q=>q.length>=2))].slice(0,4);
}

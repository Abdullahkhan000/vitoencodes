import type {MovieDetails} from './movie-details.ts';
import {classifySource} from './encode-source.ts';
import {detectEncoder} from './encoder.ts';
type Searchable={title:string;filename?:string;year?:number|null;category?:string;resolution?:string;codec?:string;size?:string;status?:string;details?:MovieDetails};
export function normalizeSearch(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(?:4k|uhd)\b/g,'2160p').replace(/\b(?:blu[ ._-]?ray|bdrip)\b/g,'bluray').replace(/\bweb[ ._-]?(?:dl|rip)\b/g,'webdl').replace(/\b(?:x265|h[ .]?265)\b/g,'hevc').replace(/\b(?:x264|h[ .]?264|avc)\b/g,'h264').replace(/\bii\b/g,'2').replace(/\biii\b/g,'3').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function nearWord(a:string,b:string){
 if(a.length<4||/\d/.test(a+b)||Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(i<a.length||j<b.length?1:0)<=1;
}
export function releaseSearchScore(row:Searchable,query:string){
 const clean=normalizeSearch(query.slice(0,200));if(!clean)return 1;
 const title=normalizeSearch(row.details?.officialTitle||row.title),filename=row.filename||'';
 const text=normalizeSearch([title,row.title,filename,row.year,row.category,row.resolution,row.codec,row.size,row.status,classifySource(filename),detectEncoder(filename),row.details?.genres,row.details?.director,row.details?.cast,row.details?.imdbId,row.details?.collection?.name].filter(Boolean).join(' '));
 const words=text.split(' '),titleWords=title.split(' ');let score=0;
 for(const token of clean.split(' ').slice(0,24)){
  if(words.includes(token))score+=titleWords.includes(token)?15:7;
  else if(!/\d/.test(token)&&words.some(word=>word.startsWith(token)))score+=4;
  else if(words.some(word=>nearWord(token,word)))score+=1;
  else return 0;
 }
 return score+(title===clean?100:title.startsWith(clean)?40:title.includes(clean)?20:0);
}
export function paginate<T>(items:T[],requested:number,size:number){
 const pageSize=Number.isFinite(size)?Math.max(1,Math.floor(size)):24;
 const totalPages=Math.max(1,Math.ceil(items.length/pageSize));const page=Math.min(totalPages,Math.max(1,Number.isFinite(requested)?Math.floor(requested):1));
 const start=(page-1)*pageSize;return {items:items.slice(start,start+pageSize),page,totalPages,start:items.length?start+1:0,end:Math.min(start+pageSize,items.length),total:items.length};
}
/** Public search matches movie titles and verified series, rather than cast/filename words. */
export function createMovieSearch(rows:Searchable[],query:string){
 const clean=normalizeSearch(query.slice(0,200));
 if(!clean)return (_row:Searchable)=>1;
 const titles=(row:Searchable)=>[normalizeSearch(row.details?.officialTitle||row.title)];
 const compact=(value:string)=>value.replace(/ /g,'');
 const allTitles=new Set(rows.flatMap(titles).map(compact));
 const knownWords=new Set(rows.flatMap(row=>titles(row).flatMap(title=>title.split(' '))));
 const specs=new Set(['2160p','1440p','1080p','720p','480p','hevc','h264','av1','bluray','webdl','hdtv','imax','35mm','vito','vitoencodes','10bit','8bit','hdr','hdr10','sdr']);
 const tokens=clean.split(' ').slice(0,24),technical:string[]=[],titleTokens:string[]=[];
 const exactWholeTitle=allTitles.has(compact(clean));
 for(let index=0;index<tokens.length;index++){
  const token=tokens[index];
  if(!exactWholeTitle&&((token==='open'&&tokens[index+1]==='matte')||(/^(?:8|10)$/.test(token)&&tokens[index+1]==='bit'))){technical.push(token,tokens[++index]);continue;}
  if(!exactWholeTitle&&(specs.has(token)||(/^(?:18|19|20)\d{2}$/.test(token)&&!knownWords.has(token))))technical.push(token);
  else titleTokens.push(token);
 }
 const technicalQuery=technical.join(' ');
 if(!titleTokens.length)return (row:Searchable)=>releaseSearchScore(row,technicalQuery);
 const titleQuery=titleTokens.join(' '),queryKey=compact(titleQuery);
 const collectionId=(row:Searchable)=>row.details?.collection?.id?String(row.details.collection.id):'';
 const collectionName=(row:Searchable)=>normalizeSearch((row.details?.collection?.name||'').replace(/\([^)]*\)/g,' ').replace(/\s+collection\s*$/i,''));
 function titleMatch(row:Searchable){
  let best={precision:0,score:0};
  for(const title of titles(row)){
   if(compact(title)===queryKey)return {precision:4,score:200};
   const words=title.split(' '),used=new Set<number>();let precision=3,score=0;
   for(let index=0;index<titleTokens.length;index++){
    const token=titleTokens[index];
    let found=words.findIndex((word,i)=>!used.has(i)&&word===token);
    if(found>=0){used.add(found);score+=15;continue;}
    // Only the last, incomplete word can be a prefix. Short common words stay exact.
    if(index===titleTokens.length-1&&token.length>=3&&!/\d/.test(token))found=words.findIndex((word,i)=>!used.has(i)&&word.startsWith(token));
    if(found>=0){used.add(found);precision=Math.min(precision,2);score+=4;continue;}
    found=words.findIndex((word,i)=>!used.has(i)&&nearWord(token,word));
    if(found>=0){used.add(found);precision=1;score++;continue;}
    precision=0;break;
   }
   if(precision&&(precision>best.precision||precision===best.precision&&score>best.score))best={precision,score:score+(title.startsWith(titleQuery)?40:0)};
  }
  return best;
 }
 const candidates=rows.map(row=>({row,match:titleMatch(row)}));
 const exactTitles=candidates.filter(candidate=>candidate.match.precision===4);
 const exactCollections=new Set(rows.filter(row=>collectionId(row)&&compact(collectionName(row))===queryKey).map(collectionId));
 const definitive=exactTitles.length>0||exactCollections.size>0;
 const bestPrecision=Math.max(...candidates.map(candidate=>candidate.match.precision),0);
 const anchors=definitive?exactTitles:candidates.filter(candidate=>candidate.match.precision===bestPrecision&&bestPrecision>0);
 const series=new Set([...exactCollections,...anchors.map(candidate=>collectionId(candidate.row)).filter(Boolean)]);
 const anchoredTitles=new Set(anchors.flatMap(candidate=>titles(candidate.row)).map(compact));
 return (row:Searchable)=>{
  const specScore=technicalQuery?releaseSearchScore(row,technicalQuery):1;
  if(!specScore)return 0;
  const match=titleMatch(row),sameSeries=Boolean(collectionId(row)&&series.has(collectionId(row)));
  const sameTitle=titles(row).some(title=>anchoredTitles.has(compact(title)));
  if(definitive&&!sameTitle&&!sameSeries)return 0;
  const direct=match.precision>0&&(definitive?sameTitle||sameSeries:match.precision===bestPrecision);
  if(!direct&&!sameSeries)return 0;
  return (sameTitle?2000:direct?1000:500)+match.score+specScore;
 };
}

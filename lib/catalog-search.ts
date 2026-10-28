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

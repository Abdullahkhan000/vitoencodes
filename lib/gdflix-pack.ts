import {parseBulkLinks,type BulkEntry} from './bulk-links.ts';
export function gdflixPackUrl(value:string){let url:URL;try{url=new URL(value);}catch{throw new Error('Use a valid GDFlix pack URL.');}if(url.protocol!=='https:'||!/^new\d+\.gdflix\.io$|^gdflix\.io$/.test(url.hostname)||url.port||url.username||url.password||url.search||url.hash||!/^\/pack\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))throw new Error('Use an HTTPS gdflix.io pack URL without query parameters.');return url;}
function decode(value:string){return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,code:string)=>{const key=code.toLowerCase();if(key.startsWith('#')){const n=key[1]==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[key]||'';});}
function visible(value:string){return decode(value.replace(/<(?:br\b[^>]*|\/?(?:td|th|div|p|li|h[1-6])\b[^>]*)>/gi,'\n').replace(/<[^>]*>/g,'')).replace(/[\t ]+/g,' ').trim();}
function filename(value:string){return visible(value).split(/[\r\n]+/).map(line=>line.trim().replace(/(\.(?:mkv|mp4|m4v|webm))\s*\[\s*\d+(?:\.\d+)?\s*(?:GiB|GB|MiB|MB)\s*\]\s*$/i,'$1').replace(/^(?:file\s*name\s*:|\d+\s*[.)]\s*)/i,'').trim()).find(line=>/\.(mkv|mp4|m4v|webm)$/i.test(line));}
export function parseGdflixPack(html:string,pack:string,options:{keepDuplicateFilenames?:boolean}={}){
 const base=gdflixPackUrl(pack);if(html.length>2000000)throw new Error('Pack page is too large.');
 const clean=html.replace(/<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>/gi,'');
 const anchors=[...clean.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)].flatMap(match=>{const href=match[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);if(!href)return [];let url:URL;try{url=new URL(decode(href[1]??href[2]??href[3]),base);}catch{return [];}if(url.origin!==base.origin||!/^\/file\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))return [];return [{url:url.href,body:match[2],attrs:match[1],start:match.index!,end:match.index!+match[0].length}];});
 if(anchors.length>1500)throw new Error('Import packs with at most 500 files.');
 const rows=[...clean.matchAll(/<(tr|li)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)].map(match=>({start:match.index!,end:match.index!+match[0].length,html:match[0]}));
 const entries:BulkEntry[]=[],warnings:string[]=[],seen=new Set<string>();
 for(let i=0;i<anchors.length;i++){
  const anchor=anchors[i];if(seen.has(anchor.url))continue;seen.add(anchor.url);
  const found=rows.find(row=>row.start<=anchor.start&&row.end>=anchor.end),rowStart=found?.start??-1,rowEnd=found?.end??-1,row=found?.html||'';
  const scoped=row&&!anchors.some(other=>other.start>rowStart&&other.start<rowEnd&&other.url!==anchor.url)?row:'';
  const title=anchor.attrs.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const name=filename(scoped)||filename(anchor.body)||(title?filename(title[1]??title[2]):undefined);
  const after=clean.slice(anchor.end,Math.min(anchors[i+1]?.start??clean.length,anchor.end+2500));
  const sizeText=visible(scoped||after),sizeMatch=sizeText.match(/\b\d+(?:\.\d+)?\s*(?:GiB|GB|MiB|MB)\b/i),size=sizeMatch&&(!scoped&&/\.(?:mkv|mp4|m4v|webm)\b/i.test(sizeText.slice(0,sizeMatch.index))?undefined:sizeMatch[0]);
  if(!name||!size){warnings.push('File '+(i+1)+': filename or size could not be read.');continue;}
  try{const entry=parseBulkLinks(name+' - '+size+'\n'+anchor.url)[0];if(!options.keepDuplicateFilenames&&entries.some(row=>row.filename.toLowerCase()===entry.filename.toLowerCase())){warnings.push('Repeated filename: '+name);continue;}entries.push(entry);}catch(error){warnings.push(error instanceof Error?error.message:'Invalid pack entry.');}
 }
 if(entries.length>500)throw new Error('Import packs with at most 500 files.');
 return {entries,fileLinks:seen.size,warnings:warnings.slice(0,30),warningCount:warnings.length};
}
export async function fetchGdflixPack(value:string,request:typeof fetch=fetch){const url=gdflixPackUrl(value);const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'text/html'}});if(!response.ok)throw new Error('GDFlix returned HTTP '+response.status+'. The pack may be private, unavailable or blocked.');const reader=response.body?.getReader();if(!reader)throw new Error('GDFlix returned an empty page.');let length=0;const parts:Uint8Array[]=[];try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>2000000)throw new Error('Pack page is too large.');parts.push(value);}}finally{await reader.cancel();}const html=new TextDecoder().decode(Buffer.concat(parts));const result=parseGdflixPack(html,url.href);if(!result.entries.length)throw new Error('No readable movie/file entries found. The pack may need sign-in or a copied file list.');return result;}

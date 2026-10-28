import {defaultHubDrive,type HubDriveSettings} from './hubdrive.ts';
import {detectEncoder,type Encoder} from './encoder.ts';
﻿import {parseFilename} from './parser.ts';
export type BulkEntry={filename:string;title:string;year:number;category:string;resolution:string;size:string;url:string;encoder:Encoder;provider?:'HubDrive'|'GDFlix'};
export function parseBulkLinks(text:string,settings:HubDriveSettings=defaultHubDrive):BulkEntry[]{
 if(typeof text!=='string'||text.length>16000)throw new Error('Paste a batch of up to 5 releases (maximum 16 KB).');
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(!lines.length||lines.length%2!==0||lines.length>10)throw new Error('Use up to 5 pairs: filename - size, then its HubDrive or GDFlix link on the next line.');
 const entries:BulkEntry[]=[];const filenames=new Set<string>(),urls=new Set<string>();
 for(let i=0;i<lines.length;i+=2){
  const match=lines[i].match(/^(.+\.(?:mkv|mp4|m4v|webm))\s+-\s+(\d+(?:\.\d+)?\s*(?:GiB|GB|MiB|MB))$/i);
  if(!match)throw new Error(`Release ${i/2+1}: use filename.mkv - 9.4 GB.`);
  const filename=match[1].trim();if(filename.length>500)throw new Error(`Release ${i/2+1}: filename must be at most 500 characters.`);
  const parsed=parseFilename(filename.replace(/^(?:copy of\s+)+/i,''),{requireBrand:false});
  if(!parsed?.year||parsed.year<1900||parsed.year>2100)throw new Error(`Release ${i/2+1}: include a valid movie year.`);
  let url:URL;try{url=new URL(lines[i+1]);}catch{throw new Error(`Release ${i/2+1}: invalid link.`);}
  const hubdrive=settings.knownDomains.includes(url.hostname)&&/^\/file\/\d+$/.test(url.pathname);
  const gdflix=(url.hostname==='gdflix.io'||/^new\d+\.gdflix\.io$/.test(url.hostname))&&/^\/file\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||(!hubdrive&&!gdflix))throw new Error(`Release ${i/2+1}: use https://${settings.domain}/file/FILE_ID or a valid GDFlix HTTPS file link.`);
  if(hubdrive)url.hostname=settings.domain;else url.pathname=url.pathname.replace(/\/$/,'');
  if(filenames.has(filename.toLowerCase())||urls.has(url.href))throw new Error('Duplicate filenames or HubDrive links in this batch.');
  filenames.add(filename.toLowerCase());urls.add(url.href);
  entries.push({...parsed,year:parsed.year,filename,encoder:detectEncoder(filename),size:match[2].replace(/\s*/g,'').replace(/(GiB|GB|MiB|MB)$/i,' $1'),url:url.href,provider:hubdrive?'HubDrive':'GDFlix'});
 }
 return entries;
}

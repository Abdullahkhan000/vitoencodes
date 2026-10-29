import {classifySource} from './encode-source.ts';
export type MovieDetails={primaryReleaseId?:string;genresEdited?:boolean;synopsis?:string;genres?:string;runtime?:string;director?:string;cast?:string;trailer?:string;screenshots?:string[];stills?:string[];backdrop?:string;imdbId?:string;tmdbId?:number;tmdbRating?:number;metadataProvider?:string;metadataFetchedAt?:string;poster?:string;officialTitle?:string;collection?:{id:number|string;name:string;poster?:string}};
export function validateMovieDetails(value:unknown):MovieDetails{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Movie details must be an object.');
 const source=value as Record<string,unknown>,details:MovieDetails={};
 for(const [key,max] of [['synopsis',4000],['genres',200],['runtime',60],['director',200],['cast',1000],['trailer',500]] as const){
  const text=source[key];if(text===undefined)continue;
  if(typeof text!=='string'||text.length>max)throw new Error(`Check the ${key} field (maximum ${max} characters).`);
  details[key]=text.trim();
 }
 if(details.trailer&&!youtubeEmbed(details.trailer))throw new Error('Use a valid YouTube trailer URL.');
 if(source.screenshots!==undefined){
  if(!Array.isArray(source.screenshots)||source.screenshots.length>6||!source.screenshots.every(url=>typeof url==='string'&&url.length<=2000&&safeImage(url)))throw new Error('Use up to 6 HTTPS screenshot URLs or local /screenshots/ paths.');
  details.screenshots=source.screenshots as string[];
 }
 return details;
}
function safeImage(value:string){try{if(/^\/screenshots\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('..'))return true;const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
export function youtubeEmbed(value:string){try{const url=new URL(value);if(url.protocol!=='https:')return null;let id:string|null=null;if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(?:embed|shorts)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1]||null;else if(url.hostname==='youtu.be')id=url.pathname.slice(1);return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;}catch{return null;}}
export function encodeSpecs(filename:string,fallbackCodec='Not specified'){
 const value=filename.replace(/[._]/g,' ');
 const codec=/\bAV1\b/i.test(value)?'AV1':/\bx265\b|\bHEVC\b/i.test(value)?'HEVC / x265':/\bx264\b|\bAVC\b/i.test(value)?'H.264 / x264':fallbackCodec.replace('Â·','·');
 const bitDepth=/\b10\s*bit\b/i.test(value)?'10-bit':/\b8\s*bit\b/i.test(value)?'8-bit':'Not specified';
 const detectedSource=classifySource(filename),source=detectedSource==='Unknown'?'Not specified':detectedSource;
 const range=/\bSDR\b/i.test(value)?'SDR':/HDR10\+|HDR10Plus/i.test(filename)?'HDR10+':/\bHDR\b|HDR10/i.test(value)?'HDR':'Not specified';
 const language=/\beng(?:lish)?\b/i.test(value)?'English':/\bhindi\b/i.test(value)?'Hindi':'Not specified';
 const audio=[/true\s*hd/i.test(value)?'TrueHD':/\bDDP\b/i.test(value)?'Dolby Digital Plus':/\bDD\b/i.test(value)?'Dolby Digital':/\bDTS\b/i.test(value)?'DTS':'',/\batmos\b/i.test(value)?'Atmos':'',/(?:^|[. _])([257]\.1|2\.0)(?=[. _-]|$)/.exec(filename)?.[1]||''].filter(Boolean).join(' · ')||'Not specified';
 return {codec,bitDepth,source,range,language,audio};
}

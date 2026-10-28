import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {authorized,denied} from '../../../../lib/auth';
import {listReleases,setReleaseMetadata} from '../../../../lib/store';
import {identifyFilm,reviewedPosterUrls} from '../../../../lib/film-metadata';
export const runtime='nodejs';export const dynamic='force-dynamic';
const verifiedPosters:Record<string,string>={
 'mission-impossible-3':'5l0hS4A119jCA1A02XsFZHq1uRD.jpg',
 'mugen-train':'h8Rb9gBr48ODIwYUttZNYeMWeUU.jpg',
 'john-wick-2':'hXWBc0ioZP3cN4zCu6SN3YHXZVO.jpg',
 'quantum-of-solace':'e3DXXLJHGqMx9yYpXsql1XNljmM.jpg',
};
function imageExtension(bytes:Buffer){if(bytes[0]===0xff&&bytes[1]===0xd8)return '.jpg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return '.png';if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return '.webp';throw new Error('Unsupported poster image format');}
export async function POST(request:Request){
 if(!authorized(request))return denied();
 const rows=(await listReleases());const backup=process.env.DATA_DIRECTORY||path.join(process.cwd(),'data');await mkdir(backup,{recursive:true});await writeFile(path.join(backup,'before-artwork-'+Date.now()+'.json'),JSON.stringify(rows,null,2));
 const matches=new Map<string,NonNullable<ReturnType<typeof identifyFilm>>>();for(const row of rows){const match=identifyFilm(row.filename,row.year);if(match)matches.set(match.key,match);}
 const results:{key:string;poster:string;source:string;error?:string}[]=[];
 const output=path.join(process.cwd(),'public','posters','imported');await mkdir(output,{recursive:true});
 for(const match of matches.values()){
  let source='https://en.wikipedia.org/wiki/'+encodeURIComponent(match.wiki.replaceAll(' ','_'));
  if(verifiedPosters[match.key])source='https://image.tmdb.org/t/p/w780/'+verifiedPosters[match.key];
  try{
   let cached:Buffer|undefined,cachedFile='';for(const ext of ['.jpg','.png','.webp']){try{cached=await readFile(path.join(output,match.key+ext));cachedFile=match.key+ext;break;}catch{}}
   let bytes=cached;
   if(!bytes){
    let url:URL;
    if(verifiedPosters[match.key])url=new URL(source);
    else{
     const summary=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(match.wiki.replaceAll(' ','_')),{headers:{'User-Agent':'VitoEncodesCatalog/1.0 (movie poster metadata)'},signal:AbortSignal.timeout(20000)});
     if(!summary.ok)throw new Error('Metadata HTTP '+summary.status);
     const data=await summary.json();const artwork=data.originalimage||data.thumbnail;
     if(!artwork?.source||!artwork.width||!artwork.height||artwork.height<artwork.width*1.2)throw new Error('No confirmed portrait poster in source');url=new URL(artwork.source);
    }
    if(url.protocol!=='https:'||!['upload.wikimedia.org','image.tmdb.org'].includes(url.hostname))throw new Error('Unexpected image source');
    const response=await fetch(url,{redirect:'error',headers:{'User-Agent':'VitoEncodesCatalog/1.0'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Poster HTTP '+response.status);if(!(response.headers.get('content-type')||'').startsWith('image/'))throw new Error('Invalid poster content type');bytes=Buffer.from(await response.arrayBuffer());
   }
   if(bytes.length<1000||bytes.length>10000000)throw new Error('Invalid poster size');
   const file=match.key+imageExtension(bytes);const destination=path.join(output,file);
   if(!cached){await writeFile(destination+'.tmp',bytes);await rename(destination+'.tmp',destination);}else if(cachedFile!==file)await rename(path.join(output,cachedFile),destination);
   const poster='/posters/imported/'+file;for(const row of rows){const film=identifyFilm(row.filename,row.year);if(film?.key===match.key)(await setReleaseMetadata(row.id,match.title,match.year,poster,source));}results.push({key:match.key,poster,source});
  }catch(error){const remote=reviewedPosterUrls[match.key];if(remote){for(const row of rows){if(identifyFilm(row.filename,row.year)?.key===match.key)(await setReleaseMetadata(row.id,match.title,match.year,remote,source));}results.push({key:match.key,poster:remote,source});}else results.push({key:match.key,poster:'',source,error:error instanceof Error?error.message:'Metadata failed'});}
 }
 return Response.json({matchedReleases:rows.filter(r=>identifyFilm(r.filename,r.year)).length,uniqueFilms:matches.size,results},{headers:{'Cache-Control':'no-store'}});
}

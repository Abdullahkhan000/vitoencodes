import {revalidateTag} from 'next/cache';
﻿import {authorized,denied} from '../../../../lib/auth';
import {listReleases,saveImportedMovieDetails} from '../../../../lib/store';
import {fetchTmdbMovieById,getTmdbCandidates} from '../../../../lib/tmdb';
import {LinkifyError,mergeImportedDetails} from '../../../../lib/linkify';
import {cacheMovieMetadata} from '../../../../lib/store';
import {metadataCacheKey} from '../../../../lib/enrichment';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){if(!(await authorized(request)))return denied();const id=new URL(request.url).searchParams.get('id'),row=(await listReleases()).find(r=>r.id===id);if(!row)return Response.json({error:'Release not found.'},{status:404});try{return Response.json({candidates:await getTmdbCandidates(row.title,row.year)},{headers:{'Cache-Control':'no-store'}});}catch(error){return failure(error);}}
async function handlePOST(request:Request){
 if(!(await authorized(request)))return denied();
 try{const body=await request.json(),row=(await listReleases()).find(r=>r.id===body.id);if(!row)return Response.json({error:'Release not found.'},{status:404});
 const candidates=await getTmdbCandidates(row.title,row.year);if(!candidates.some((r:{id:number})=>r.id===body.tmdbId))return Response.json({error:'Select one of the matching title/year candidates.'},{status:400});
 const details=await fetchTmdbMovieById(body.tmdbId,row.year!);(await cacheMovieMetadata(metadataCacheKey(row.title,row.year),details));if(details.officialTitle)(await cacheMovieMetadata(metadataCacheKey(details.officialTitle,row.year),details));
 const latest=(await listReleases()).find(r=>r.id===row.id)!;const merged=mergeImportedDetails(latest.details||{},details);if(latest.poster)merged.poster=latest.poster;(await saveImportedMovieDetails(row.id,merged));
 return Response.json({release:(await listReleases()).find(r=>r.id===row.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}
function failure(error:unknown){return Response.json({error:error instanceof LinkifyError?error.message:'TMDB matching could not be completed.'},{status:error instanceof LinkifyError?error.status:400,headers:{'Cache-Control':'no-store'}});}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok)revalidateTag('public-catalog',{expire:0});return response;}

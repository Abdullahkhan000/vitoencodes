import {revalidateTag} from 'next/cache';
﻿import {authorized,denied} from '../../../../lib/auth';
import {fetchGdflixPack} from '../../../../lib/gdflix-pack';
import {savedGdflixPack} from '../../../../lib/gdflix-files';
import {listReleases} from '../../../../lib/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handlePOST(request:Request){if(!(await authorized(request)))return denied();try{const body=await request.json();if(typeof body.url!=='string'||body.url.length>2000)throw new Error('Enter a GDFlix pack URL.');const result=(await savedGdflixPack(body.url))??await fetchGdflixPack(body.url),rows=(await listReleases());return Response.json({...result,entries:result.entries.map(entry=>{const existing=rows.find(row=>row.filename.toLowerCase()===entry.filename.toLowerCase());return {...entry,existing:Boolean(existing),alreadyLinked:Boolean(existing?.links.some(link=>link.url===entry.url))};})},{headers:{'Cache-Control':'no-store'}});}catch(error){const message=error instanceof Error?error.message:'';return Response.json({error:/^(Use |Enter |GDFlix |No readable |Pack page |Import packs)/.test(message)?message:'Could not read the pack. It may be blocked, redirected or unavailable.'},{status:400,headers:{'Cache-Control':'no-store'}});}}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok)revalidateTag('public-catalog',{expire:0});return response;}

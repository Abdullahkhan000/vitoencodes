import {revalidateTag} from 'next/cache';
import {resolveGdflixLinks} from '../../../../lib/gdflix-files';
import {hubDriveSettings} from '../../../../lib/download-domains';
﻿import {authorized,denied} from '../../../../lib/auth';
import {parseBulkLinks} from '../../../../lib/bulk-links';
import {importBulkLinks} from '../../../../lib/bulk-store';
import {listReleases} from '../../../../lib/store';
import {enrichReleases,previewMovieMetadata} from '../../../../lib/enrichment';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handlePOST(request:Request){
 if(!(await authorized(request)))return denied();
 try{
  const body=await request.json(),entries=body.mode==='gdflix'?await resolveGdflixLinks(body.text):parseBulkLinks(body.text,(await hubDriveSettings()));
  if(body.preview===true){const preview=await previewMovieMetadata(entries,(await listReleases()));return Response.json({entries:preview,metadataPending:preview.filter(r=>r.metadataStatus==='pending').length},{headers:{'Cache-Control':'no-store'}});}
  const result=(await importBulkLinks(entries));
  // A provider failure must never undo a valid saved encode or invite duplicate imports.
  const metadata=await enrichReleases(result.ids);
  return Response.json({...result,metadata},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Import failed.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok)revalidateTag('public-catalog',{expire:0});return response;}

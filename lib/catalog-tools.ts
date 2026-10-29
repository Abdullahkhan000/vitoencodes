import {titleMatchScore} from './movie-matching.ts';
import {createHmac,randomUUID} from 'node:crypto';
import {database,type Database} from './database.ts';
import {listReleases,type Release} from './store.ts';
import {snapshots,stateHash,recordHistory,restoreHistory} from './history.ts';
import {validateReleasePresentation} from './release-settings.ts';
import {groupMovieReleases} from './library.ts';
import {hasSavedMovieInfo} from './metadata-state.ts';
type Changes={category?:string;genres?:string;status?:'draft'|'published'};
function cleanChanges(input:unknown):Changes{
 if(!input||typeof input!=='object')throw new Error('Choose at least one field to edit.');const value=input as Record<string,unknown>,result:Changes={};
 if(value.category!==undefined)result.category=validateReleasePresentation({category:value.category as string}).category;
 if(value.genres!==undefined){if(typeof value.genres!=='string'||value.genres.length>200)throw new Error('Genres must contain at most 200 characters.');result.genres=value.genres.trim();}
 if(value.status!==undefined){if(!['draft','published'].includes(String(value.status)))throw new Error('Choose draft or published.');result.status=value.status as Changes['status'];}
 if(!Object.keys(result).length)throw new Error('Choose at least one field to edit.');return result;
}
function idsFrom(input:unknown){if(!Array.isArray(input)||!input.length||input.length>100||input.some(id=>typeof id!=='string'||!id||id.length>500))throw new Error('Select 1 to 100 releases.');return [...new Set(input)] as string[];}
async function planBulk(db:Database,input:unknown,changeInput:unknown){
 const ids=idsFrom(input),changes=cleanChanges(changeInput),raw=await db.prepare('SELECT id,title,year,status,links,category,details FROM releases').all();
 const rows=raw.map(row=>({...row,details:JSON.parse(String(row.details)),links:JSON.parse(String(row.links))})) as unknown as Release[];
 if(ids.some(id=>!rows.some(row=>row.id===id)))throw new Error('A selected release is missing. Refresh the library.');
 const selected=rows.filter(row=>ids.includes(row.id));
 if(changes.status==='published'&&selected.some(row=>!row.links.length||row.links.length>5||row.links.some(link=>!link.label.trim()||!/^(https:\/\/|magnet:\?xt=urn:btih:)/i.test(link.url))))throw new Error('Every selected release needs a valid mirror before publishing.');
 const affected=changes.genres!==undefined?[...new Set(groupMovieReleases(rows).filter(group=>group.releases.some(row=>ids.includes(row.id))).flatMap(group=>group.releases.map(row=>row.id)))]:ids;
 const before=await snapshots(db,affected);
 const token=createHmac('sha256',process.env.ADMIN_TOKEN||'local-bulk').update(JSON.stringify({ids:[...ids].sort(),changes,state:stateHash(before)})).digest('hex');
 return {ids,changes,affected,before,token,preview:selected.map(row=>({id:row.id,title:row.title,from:{category:row.category,genres:row.details?.genres||'',status:row.status},to:{category:changes.category??row.category,genres:changes.genres??row.details?.genres??'',status:changes.status??row.status}}))};
}
export async function bulkEdit(ids:unknown,changes:unknown,previewToken?:unknown){
 const db=await database();try{
  await db.exec('BEGIN IMMEDIATE');const plan=await planBulk(db,ids,changes);
  if(previewToken===undefined){await db.exec('COMMIT');return {preview:plan.preview,previewToken:plan.token,affected:plan.affected.length};}
  if(typeof previewToken!=='string'||previewToken!==plan.token)throw new Error('The preview is stale. Preview the changes again before applying.');
  for(const id of plan.ids)await db.prepare('UPDATE releases SET category=COALESCE(?,category),status=COALESCE(?,status) WHERE id=?').run(plan.changes.category??null,plan.changes.status??null,id);
  if(plan.changes.genres!==undefined)for(const id of plan.affected)await db.prepare(`UPDATE releases SET details=${db.postgres?'vito_json_patch(details::jsonb,?::jsonb)::text':'json_patch(details,?)'} WHERE id=?`).run(JSON.stringify({genres:plan.changes.genres,genresEdited:true}),id);
  await recordHistory(db,'Bulk edit releases',plan.before,plan.affected);await db.exec('COMMIT');return {updated:plan.ids.length,affected:plan.affected.length};
 }catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
}
export async function historyEntries(){const db=await database();try{return (await db.prepare('SELECT id,action,before_state,after_state,created_at,restored_at FROM audit_events ORDER BY created_at DESC LIMIT 60').all()).map(row=>({id:row.id,action:row.action,createdAt:row.created_at,restored:Boolean(row.restored_at),releases:(JSON.parse(String(row.after_state)) as Release[]).map(item=>({id:item.id,title:item.title})),count:(JSON.parse(String(row.after_state)) as Release[]).length}));}finally{await db.close();}}
export async function undoEdit(id:string){const db=await database();try{await db.exec('BEGIN IMMEDIATE');const count=await restoreHistory(db,id);await db.exec('COMMIT');return {restored:count};}catch(error){if(db.isTransaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}}
export function catalogChecks(rows:Release[]){
 const files=new Map<string,Release[]>(),mirrors=new Map<string,Release[]>();for(const row of rows){const file=row.filename.trim().toLowerCase();files.set(file,[...(files.get(file)||[]),row]);for(const link of row.links)mirrors.set(link.url,[...(mirrors.get(link.url)||[]),row]);}
 return rows.flatMap(row=>{
  const issues:string[]=[];
  if(!row.poster)issues.push('Missing poster');if(!hasSavedMovieInfo(row))issues.push('Incomplete movie information');
  if(!row.details?.tmdbId)issues.push('TMDB match not verified');if(row.details?.officialTitle&&titleMatchScore(row.title,row.details.officialTitle)<.65)issues.push('Review title versus TMDB match');
  if(row.status==='published'&&!row.links.length)issues.push('Published without a mirror');
  if((files.get(row.filename.trim().toLowerCase())?.length||0)>1)issues.push('Duplicate exact filename');
  if(row.links.some(link=>(mirrors.get(link.url)||[]).some(other=>other.id!==row.id&&other.filename.toLowerCase()!==row.filename.toLowerCase())))issues.push('Mirror shared by different filenames');
  const filenameYear=/(?:^|[. _])((?:19|20)\d{2})(?=[. _]|$)/.exec(row.filename)?.[1];if(filenameYear&&row.year&&Number(filenameYear)!==row.year)issues.push('Year differs from filename');
  return issues.length?[{id:row.id,title:row.details?.officialTitle||row.title,filename:row.filename,status:row.status,issues}]:[];
 });
}
export async function qualityReport(){return catalogChecks(await listReleases());}

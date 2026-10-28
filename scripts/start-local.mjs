import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';

const checkOnly=process.argv.includes('--check');
console.log('\nVITOENCODES - local server and movie metadata\n');
if(process.env.CODEX_SANDBOX_NETWORK_DISABLED==='1'){
 console.error('This terminal is inside the Codex network-disabled sandbox.');
 console.error('Open Start VITOENCODES.cmd yourself from Windows File Explorer, or run npm.cmd run start:local in a normal PowerShell window.');
 console.error('No network settings, firewall rules or sandbox permissions were changed.');
 process.exitCode=1;
}else{
 try{await main();}catch(error){console.error(error instanceof Error?error.message:'Local startup failed.');process.exitCode=1;}
}
async function main(){
 if(!existsSync('node_modules/next/dist/bin/next'))throw new Error('Dependencies are missing. Run npm.cmd install in this folder.');
 const {metadataProvider,metadataConfigured}=await import('../lib/metadata-provider.ts');
 const {fetchTmdbMovie}=await import('../lib/tmdb.ts');
 const {listReleases}=await import('../lib/store.ts');
 const {enrichReleases}=await import('../lib/enrichment.ts');
 const {groupMovieReleases}=await import('../lib/library.ts');
 const {hasSavedMovieInfo}=await import('../lib/metadata-state.ts');
 if(checkOnly){
  try{if(metadataProvider()!=='TMDB'||!metadataConfigured())throw new Error('Configure the TMDB credential in .env.local.');console.log('Checking TMDB connection and credential...');await fetchTmdbMovie('Dune',2021);console.log('TMDB connection and credential verified.');}
  catch(error){console.error(error instanceof Error?error.message:'TMDB check failed.');process.exitCode=1;}return;
 }
 const rows=(await listReleases()),pending=rows.filter(row=>!hasSavedMovieInfo(row));
 console.log((rows.length-pending.length)+' completed encodes skipped. '+pending.length+' encodes need movie information.');
 if(!pending.length)console.log('All movie information is already saved. No TMDB requests needed.');
 else if(metadataProvider()!=='TMDB'||!metadataConfigured())console.log('TMDB is not configured. Starting with existing data.');
 else{
  const backup=process.env.DATA_DIRECTORY||path.join(process.cwd(),'data');mkdirSync(backup,{recursive:true});writeFileSync(path.join(backup,'before-local-tmdb-'+Date.now()+'.json'),JSON.stringify(rows,null,2));
  console.log('Importing only missing information. Existing posters are kept; repeat encodes reuse saved movie information.');
  let updated=0;
  for(let index=0;index<pending.length;index+=5){
   const result=await enrichReleases(pending.slice(index,index+5).map(row=>row.id));updated+=result.updated;
   for(const item of result.results)console.log('  '+item.title+': '+item.status+(item.message?' - '+item.message:''));
   if(result.blocked){console.log('Provider connection/rate limit interrupted import. Retry remaining movies from the admin library.');break;}
  }
  console.log(updated+' encodes updated. Existing posters, mirrors and publishing decisions were preserved.');
 }
 const grouped=groupMovieReleases((await listReleases(true)));console.log(grouped.length+' public movies; alternate encodes are grouped inside each movie.');
 let port=3000;while(port<=3010&&!await available(port))port++;
 if(port>3010)throw new Error('Ports 3000-3010 are in use. Close an unused development server and retry.');
 console.log('\nOpen: http://localhost:'+port+'\nAdmin: http://localhost:'+port+'/admin/login\nKeep this window open. Press Ctrl+C to stop.\n');
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{stdio:'inherit',env:process.env});
 child.on('error',()=>{console.error('Unable to start Next.js.');process.exitCode=1;});
 child.on('exit',code=>{process.exitCode=code||0;});
 process.on('SIGINT',()=>child.kill('SIGINT'));
}
function available(port){return new Promise(resolve=>{const server=createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}

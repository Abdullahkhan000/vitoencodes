import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {syncRemoteMain} from './github-sync.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repository='https://github.com/Abdullahkhan000/vitoencodes.git';
function git(args,{capture=false,allowed=[0]}={}){
 const result=spawnSync('git',args,{cwd:root,encoding:'utf8',stdio:capture?'pipe':'inherit',windowsHide:true});
 if(result.error||!allowed.includes(result.status))throw new Error('Git step failed: '+args[0]+'. Setup stopped; no force push was attempted.');
 return capture?(result.stdout||'').trim():result.status;
}
function stagedFiles(){return git(['diff','--cached','--name-only','-z'],{capture:true}).split('\0').filter(Boolean);}
function checkStagedFiles(){
 const files=stagedFiles();
 const dummyUrl='postgresql://owner:private-value@ep-example.us-east-2.aws.neon.tech/catalog?sslmode=require&channel_binding=require';
 const patterns=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@/,
  /\bnpg_[A-Za-z0-9]{8,}\b/,
  /GOCSPX-[A-Za-z0-9_-]{15,}/,
  /AIza[A-Za-z0-9_-]{30,}/,
 ];
 for(const file of files){
  const forbidden=file.split('/').some(part=>['node_modules','.next','.vercel','data','.neon'].includes(part))||(/(^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example');
  if(forbidden)throw new Error('Private/generated file is staged: '+file+'. Remove it from staging before retrying.');
  // Skip binary assets; inspect the staged content of text files, not only the working tree.
  if(/\.(png|jpe?g|ico|webp|woff2?|ttf|mp4|mkv)$/i.test(file))continue;
  const result=spawnSync('git',['show',':'+file],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true});
  if(result.status!==0)throw new Error('Could not inspect staged file: '+file);
  const text=result.stdout.replaceAll(dummyUrl,'DUMMY_TEST_URL');
  if(patterns.some(pattern=>pattern.test(text)))throw new Error('Possible credential in '+file+'. Commit stopped; credential values were not printed.');
 }
 console.log('Staged-file check passed ('+files.length+' files). This checks common secret formats.');
 return files;
}
try{
 if(path.resolve(git(['rev-parse','--show-toplevel'],{capture:true})).toLowerCase()!==root.toLowerCase())throw new Error('Run this launcher from the VITOENCODES repository.');
 const name=git(['config','--get','user.name'],{capture:true,allowed:[0,1]});
 const email=git(['config','--get','user.email'],{capture:true,allowed:[0,1]});
 if(!name||!email)throw new Error('Configure git user.name and user.email before committing.');
 const remote=git(['config','--get','remote.origin.url'],{capture:true,allowed:[0,1]});
 if(remote&&remote.replace(/\.git$/,'').toLowerCase()!==repository.replace(/\.git$/,'').toLowerCase())throw new Error('origin already points to another repository; it was left unchanged.');
 if(!remote)git(['remote','add','origin',repository]);
 console.log('Checking GitHub access. If browser sign-in opens, complete it there.');
 git(['ls-remote','origin','HEAD'],{capture:true});
 const branch=git(['branch','--show-current'],{capture:true});
 if(branch!=='main')git(['branch','-m','main']);
 if(git(['rev-parse','-q','--verify','MERGE_HEAD'],{capture:true,allowed:[0,1]}))throw new Error('An earlier merge is unfinished. Resolve its conflicts and commit before retrying.');
 // Keep Windows launchers locally while removing previously tracked copies.
 git(['rm','--cached','--ignore-unmatch','--','*.cmd']);
 git(['add','--all']);
 const files=checkStagedFiles();
 if(files.length)git(['commit','-m','Set up VITOENCODES with Neon Postgres']);
 git(['rev-parse','--verify','HEAD'],{capture:true});
 syncRemoteMain(git,root,checkStagedFiles);
 git(['push','--set-upstream','origin','main']);
 console.log('Repository pushed: https://github.com/Abdullahkhan000/vitoencodes');
}catch(error){console.error(error.message);process.exitCode=1;}



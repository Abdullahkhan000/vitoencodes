import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {parseEnv} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const require=createRequire(path.join(root,'package.json'));
const packages=['next','@next/env','react','react-dom','pg','@neon/config','@neon/env','typescript','lucide-react'];
function checkDependencies(){
 for(const name of packages){
  try{require.resolve(name);}catch{throw new Error('Dependency missing: '+name+'. Dependency repair must succeed before migration.');}
 }
 const next=JSON.parse(readFileSync(require.resolve('next/package.json'),'utf8'));
 const environment=JSON.parse(readFileSync(require.resolve('@next/env/package.json'),'utf8'));
 if(next.version!==environment.version)throw new Error('Next.js and @next/env versions must match.');
 console.log('Application dependencies verified.');
}
function npm(args){
 // Invoke npm's JavaScript entry directly so a Windows .cmd wrapper cannot hide failure.
 const cli=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
 if(!existsSync(cli))throw new Error('npm was not found beside Node.js. Repair the Node.js installation first.');
 const result=spawnSync(process.execPath,[cli,...args],{cwd:root,stdio:'inherit',windowsHide:true});
 if(result.error||result.signal||result.status!==0)throw new Error('npm '+args.join(' ')+' failed. Setup stopped before the next step.');
}
try{
 if(process.argv.includes('--check-only')){checkDependencies();}
 else{
  console.log('Close any VITOENCODES development-server windows before dependency repair.');
  // Unlike npm ci, install does not first delete an otherwise working node_modules tree.
  npm(['install','--no-audit','--no-fund','--fetch-retries=0','--fetch-timeout=30000']);
  checkDependencies();
  npm(['run','db:migrate']);
  let fileEnv={};
  for(const filename of ['.env','.env.local'])if(existsSync(filename))fileEnv={...fileEnv,...parseEnv(readFileSync(filename,'utf8'))};
  const dataDirectory=process.env.DATA_DIRECTORY||fileEnv.DATA_DIRECTORY||'data';
  if(existsSync(path.resolve(root,dataDirectory,'catalog.sqlite')))npm(['run','db:import']);
  npm(['run','build']);
  npm(['run','test:neon']);
  console.log('Neon schema, data import, build and live verification passed.');
  console.log('Open Start VITOENCODES.cmd to start the app.');
 }
}catch(error){
 console.error(error.message);
 if(error.message.startsWith('npm install'))console.error('If Windows reports EPERM for next-swc, close the app/server windows and retry.');
 process.exitCode=1;
}


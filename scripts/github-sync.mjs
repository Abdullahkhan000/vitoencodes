import {writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';

export function syncRemoteMain(git,root,validateStaging){
 git(['fetch','origin']);
 if(git(['show-ref','--verify','--quiet','refs/remotes/origin/main'],{allowed:[0,1]})===1)return;
 if(git(['merge-base','--is-ancestor','origin/main','HEAD'],{allowed:[0,1]})===0)return;
 const backup='backup/before-github-sync-'+Date.now()+'-'+randomBytes(3).toString('hex');
 git(['branch',backup]);
 console.log('Saved local history in '+backup);
 const status=git(['merge','--no-edit','--allow-unrelated-histories','origin/main'],{allowed:[0,1]});
 if(status===0)return;
 const conflicts=git(['diff','--name-only','--diff-filter=U','-z'],{capture:true}).split('\0').filter(Boolean);
 const unresolved=conflicts.filter(file=>!['README.md','.gitignore'].includes(file));
 if(unresolved.length||!conflicts.length)throw new Error('Merge needs review: '+(unresolved.join(', ')||'inspect git status')+'. Both histories and the backup branch are preserved. No push was attempted.');
 for(const file of conflicts){
  const ours=git(['show',':2:'+file],{capture:true,allowed:[0,128]});
  const theirs=git(['show',':3:'+file],{capture:true,allowed:[0,128]});
  if(file==='README.md'){
   let preserved='README.github-initial.md';
   if(existsSync(path.join(root,preserved)))preserved='README.github-initial-'+randomBytes(3).toString('hex')+'.md';
   writeFileSync(path.join(root,preserved),theirs+'\n');
   writeFileSync(path.join(root,file),ours+'\n');
   git(['add','--',file,preserved]);
   console.log('Kept the app README and preserved the GitHub README in '+preserved);
  }else{
   const rules=[...new Set((ours+'\n'+theirs).split(/\r?\n/))].filter(Boolean);
   const protection=['node_modules/','.next/','.vercel/','data/','.neon','.env*','!.env.example'];
   writeFileSync(path.join(root,file),rules.join('\n')+'\n\n# Keep local credentials and generated files private\n'+protection.join('\n')+'\n');
   git(['add','--',file]);
  }
 }
 validateStaging();
 git(['commit','--no-edit']);
}

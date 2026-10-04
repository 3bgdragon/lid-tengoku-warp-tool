'use strict';
// Explicit interoperability repair, separate from the EXE/DB-only companion.
// Move existing compressed frames; never rewrite logical UPK bytes or saves.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const controller=require('./tfc-companion'),links=require('./kernel/src/executable-links'),layout=require('./package-layout');
const FILES=[controller.EXE,'BrgGame/CookedPCConsole/BrgGame.upk','BrgGame/CookedPCConsole/AS_CH_Main_Male_Common_SF.upk'];
const sha=controller.sha;
function stopped(){if(require('node:child_process').execFileSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true}).match(/BrgGame-Steam\.exe/i))throw Error('Close LET IT DIE completely / 게임을 종료하세요');}
function replace(file,bytes){const tmp=file+'.layout-'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,bytes,{flag:'wx'});try{fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function acquire(lock,stale=false){
 if(stale&&fs.existsSync(lock)){const {pid}=JSON.parse(fs.readFileSync(lock));if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid operation lock');try{process.kill(pid,0);throw Error('Another controller is running');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(lock);}
 const fd=fs.openSync(lock,'wx');try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function repair(game,{running=stopped,failpoint=()=>{}}={}){
 game=path.resolve(game);running();
 if(fs.existsSync(path.join(game,'LID-Mod-State/operation.lock')))throw Error('Standalone operation/recovery lock exists before TFC layout repair');
 const legacy=path.join(game,'LID-Mod-State/state.json');
 if(fs.existsSync(legacy)){const state=JSON.parse(fs.readFileSync(legacy));if(state.active||state.layout)throw Error('Remove/restore standalone patches before TFC layout repair');}
 const root=path.join(game,'LID-TFC-State');fs.mkdirSync(root,{recursive:true});
 const lock=path.join(root,'operation.lock'),pending=path.join(root,'layout-pending.json');
 if(fs.existsSync(path.join(root,'pending.json'))||fs.existsSync(pending))throw Error('Recover interrupted operation first');
 acquire(lock);
 try{
  const before=FILES.map(f=>fs.readFileSync(path.join(game,f))),record=controller.readState(game),owned=require('./owned-functions');
  const featureWarnings=[];
  for(const setting of record?.upkSettings||[])if(owned.inspect(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',setting.file)),setting.mod,setting.file)!==setting.preset)featureWarnings.push('Feature needs selected-preset reinstallation: '+setting.mod+'/'+setting.file+' expected '+setting.preset+' / 해당 TFC 프리셋 재적용 필요');
  links.validatePackageLinks(before[0],game);
  const after=layout.pair(before);
  for(const [i,file] of [[1,'BrgGame.upk'],[2,'AS_CH_Main_Male_Common_SF.upk']])owned.verifyOthers(before[i],after[i],'layout-repair',file);
  if(before.every((b,i)=>b.equals(after[i])))return {changed:false,featureWarnings};
  const folder=path.join(path.dirname(game),'LET-IT-DIE-TFC-layout-backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());fs.mkdirSync(folder,{recursive:true});
  before.forEach((b,i)=>fs.writeFileSync(path.join(folder,'before-'+i),b,{flag:'wx'}));
  const receipt={format:'LID-TFC-LAYOUT-1',game,folder,before:before.map(sha),after:after.map(sha)};
  fs.writeFileSync(pending,JSON.stringify(receipt),{flag:'wx'});running();
  if(FILES.some((f,i)=>sha(fs.readFileSync(path.join(game,f)))!==receipt.before[i]))throw Error('Files changed before layout repair; recover before retrying');
  for(const i of [1,2,0]){if(sha(fs.readFileSync(path.join(game,FILES[i])))!==receipt.before[i])throw Error('External file change during layout repair; recover before retrying');if(!before[i].equals(after[i]))replace(path.join(game,FILES[i]),after[i]);failpoint(i);}
  if(FILES.some((f,i)=>sha(fs.readFileSync(path.join(game,f)))!==receipt.after[i]))throw Error('Layout verification failed; use recover');
  links.validatePackageLinks(fs.readFileSync(path.join(game,controller.EXE)),game);
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({...receipt,status:'applied'}),{flag:'wx'});fs.unlinkSync(pending);
  return {changed:true,backup:folder,logicalDataUnchanged:true,featureWarnings};
 }finally{fs.unlinkSync(lock);}
}
function recover(game,{running=stopped}={}){
 game=path.resolve(game);running();const root=path.join(game,'LID-TFC-State'),pending=path.join(root,'layout-pending.json'),lock=path.join(root,'operation.lock');
 const r=JSON.parse(fs.readFileSync(pending));
 if(r.format!=='LID-TFC-LAYOUT-1'||r.game!==game||path.dirname(path.resolve(r.folder))!==path.join(path.dirname(game),'LET-IT-DIE-TFC-layout-backups')||r.before?.length!==3||r.after?.length!==3)throw Error('Invalid layout recovery receipt');
 acquire(lock,true);
 try{
  const bytes=FILES.map((f,i)=>fs.readFileSync(path.join(r.folder,'before-'+i)));
  if(bytes.some((b,i)=>sha(b)!==r.before[i])||FILES.some((f,i)=>![r.before[i],r.after[i]].includes(sha(fs.readFileSync(path.join(game,f))))))throw Error('External changes or damaged backup: recovery stopped');
  running();for(const i of [1,2,0])replace(path.join(game,FILES[i]),bytes[i]);
  if(FILES.some((f,i)=>sha(fs.readFileSync(path.join(game,f)))!==r.before[i]))throw Error('Recovery verification failed');
  fs.unlinkSync(pending);return {recovered:true,backup:r.folder};
 }finally{fs.unlinkSync(lock);}
}
module.exports={repair,recover,FILES};

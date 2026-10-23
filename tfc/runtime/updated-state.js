'use strict';
// Explicit Steam-update recovery. This does not restore any game/save bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const BUILD=25923506;
const STOCK=[
 ['Binaries/Win64/BrgGame-Steam.exe','f33e91e6e8d58566bfabad8d01cd0486586a0d43fe1c58e65fc6485a417bddfd'],
 ['BrgGame/CookedPCConsole/BrgGame.upk','fec8fca21ff1ec56a71aa734232655859412f5701204c9e11064b131f40d9b94'],
 ['BrgGame/CookedPCConsole/AS_CH_Main_Male_Common_SF.upk','617d73bdeb9fd482bb4f18ec523f222c75d49768d2025a0e125bebe41866f70a'],
 ['BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk','1cc9de6052b40224405c781604cc2bb3d9745f363dedac34ec86cf17933443d3'],
 ['BrgGame/CookedPCConsole/BrgStart_PL.upk','ca7d747567043eb1a34ad53bd78092f71c3dc0516ba3010e442d2a4da2d19e66'],
 ['BrgGame/Content/masters.db','3b4cbda81b883ab2f8fce2af85ef7f7559951d7b6c335645c10d8f58a7ddc11d'],
];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error(m);};
function ordinary(file,type){const s=fs.lstatSync(file);if(s.isSymbolicLink()||(type==='directory'?!s.isDirectory():!s.isFile()))fail('Unexpected filesystem link/type; recovery refused: '+file);}
function directory(file){try{fs.mkdirSync(file);}catch(e){if(e.code!=='EEXIST')throw e;}ordinary(file,'directory');}
function absent(file){try{fs.lstatSync(file);fail('Archive/state destination already exists: '+file);}catch(e){if(e.code!=='ENOENT')throw e;}}
function renameBounded(from,to,verify,rename){
 const delays=[25,50,100,200,400];
 for(let attempt=0;;attempt++){
  verify();
  try{rename(from,to);return;}catch(error){
   if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=delays.length)throw error;
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delays[attempt]);
  }
 }
}
function root(input){const p=path.resolve(input);return path.basename(p).toLowerCase()==='brggame-steam.exe'?path.resolve(p,'../../..'):p;}
function matchesStock(game){
 try{return STOCK.every(([rel,digest])=>{const f=path.join(game,rel),s=fs.lstatSync(f);return s.isFile()&&!s.isSymbolicLink()&&sha(fs.readFileSync(f))===digest;});}catch{return false;}
}
function staleReceipt(r){return r&&[1,2].includes(r.format)&&typeof r.active==='boolean'&&(r.active||r.layout);}
function notice(game,r,{tfc=false}={}){
 if((tfc?r?.format==='LID-TFC-NATIVE-1'&&r.baseHash!==STOCK[0][1]:staleReceipt(r))&&matchesStock(game))return 'Steam update left an old '+(tfc?'TFC':'standalone')+' mod receipt, but all six files are reviewed stock build '+BUILD+'. No files were changed. Inspect: node recover-updated-state.js "'+path.resolve(game)+'"'+(tfc?' --tfc':'')+'; then explicitly archive with --archive and reapply the current mod. Do not restore an old-build whole-file backup. / Steam 업데이트로 구버전 모드 기록만 남았습니다. 위 명령으로 확인한 뒤 --archive를 추가하여 기록 전체를 보존 이관하고 새 패치를 적용하세요. 구버전 전체 백업 복원·기록 삭제는 하지 마세요.';
 return null;
}
function inspect(input,{tfc=false}={}){
 const game=root(input),mode=tfc?'tfc':'standalone',dir=path.join(game,tfc?'LID-TFC-State':'LID-Mod-State'),stateFile=path.join(dir,'state.json');
 if(!fs.existsSync(stateFile))return {game,build:BUILD,mode,recoverable:false,reason:'No '+mode+' receipt / 선택한 모드 기록 없음'};
 ordinary(dir,'directory');ordinary(stateFile,'file');
 const bytes=fs.readFileSync(stateFile);let r;try{r=JSON.parse(bytes);}catch{fail('Invalid state JSON; recovery refused / 상태 JSON 오류로 보존 이관 중단');}
 if(tfc){if(r.format!=='LID-TFC-NATIVE-1'||!Array.isArray(r.rows)||! /^[a-f0-9]{64}$/.test(r.baseHash)||r.base!==r.baseHash||typeof r.config?.warp!=='boolean'||typeof r.config?.vending!=='boolean'||r.upkSettings!==undefined&&!Array.isArray(r.upkSettings))fail('Malformed TFC receipt; recovery refused');}
 else{
  if(!staleReceipt(r))return {game,build:BUILD,mode,recoverable:false,reason:'No active/layout receipt to archive / 보존 이관할 활성 기록 없음'};
  if(r.active&&(!/^[a-f0-9-]{36}$/.test(r.generation)||!Array.isArray(r.before)||!Array.isArray(r.after)||r.before.length!==2||r.after.length!==2||[...r.before,...r.after].some(v=>! /^[a-f0-9]{64}$/.test(v))))fail('Malformed active receipt; recovery refused');
  if(r.layout&&(r.layout.format!==1||!/^[a-f0-9-]{36}$/.test(r.layout.generation)||!Array.isArray(r.layout.before)||!Array.isArray(r.layout.after)||r.layout.before.length!==3||r.layout.after.length!==3||[...r.layout.before,...r.layout.after].some(v=>! /^[a-f0-9]{64}$/.test(v))))fail('Malformed layout receipt; recovery refused');
 }
 for(const name of ['operation.lock','pending.json','layout-pending.json'])if(fs.existsSync(path.join(dir,name)))fail('Pending standalone operation; recover that operation first / 진행 중 작업을 먼저 복구하세요');
 for(const name of ['state.json','pending.json','layout-pending.json','operation.lock'])if(fs.existsSync(path.join(game,tfc?'LID-Mod-State':'LID-TFC-State',name)))fail('Other installer state exists; mixed-mode archive refused / 다른 설치 방식의 기록이 있어 혼합 상태 이관을 차단합니다');
 for(const suffix of ['-wal','-shm','-journal'])if(fs.existsSync(path.join(game,STOCK[5][0])+suffix))fail('Database is open/recovering; close the game first');
 const staging=path.join(dir,'staging');if(fs.existsSync(staging)&&fs.readdirSync(staging).length)fail('Staged operation exists; recovery refused');
 if(!matchesStock(game))fail('Not all six files match reviewed clean build '+BUILD+'. Mixed mods/unknown edits are never archived automatically. Keep state/backups and send diagnostics. / 순정 새 빌드 6개 파일이 모두 일치하지 않습니다. 다른 모드·혼합 상태를 덮어쓰지 않습니다. 기록과 백업을 유지하고 진단 로그를 보내세요.');
 if(tfc&&r.baseHash===STOCK[0][1])return {game,build:BUILD,mode,recoverable:false,reason:'Current-build native baseline; not an old Steam-update receipt / 현재 빌드 기록이므로 구버전 이관 대상이 아닙니다'};
 return {game,build:BUILD,mode,recoverable:true,stateSha256:sha(bytes),generation:r.generation||null,layoutGeneration:r.layout?.generation||null,stock:STOCK.map(([file,sha256])=>({file,sha256})),message:'Read-only check passed. Close the game and add --archive to preserve the entire old state folder; game/save files will not be rewritten. / 읽기 전용 확인 완료. 게임 종료 후 --archive로 기존 기록 전체를 보존 이관하세요.'};
}
function running(){return process.platform==='win32'&&/BrgGame-Steam\.exe/i.test(execFileSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true}));}
function archive(input,{checkRunning=running,tfc=false,rename=fs.renameSync}={}){
 if(checkRunning())fail('Close the game completely / 게임을 완전히 종료하세요');
 const before=inspect(input,{tfc});if(!before.recoverable)return {...before,changed:false};
 const game=before.game,dir=path.join(game,tfc?'LID-TFC-State':'LID-Mod-State'),lock=path.join(dir,'operation.lock'),token=crypto.randomUUID();
 const archiveRoot=path.join(path.dirname(game),'LET-IT-DIE-Archived-Mod-State',sha(Buffer.from(game.toLowerCase())).slice(0,16));
 const destination=path.join(archiveRoot,new Date().toISOString().replace(/[:.]/g,'-')+'-'+token),metadata=path.join(dir,'steam-update-archive.json');
 let locked=false,moved=false,wroteMetadata=false;
 try{
  fs.writeFileSync(lock,token,{flag:'wx'});locked=true;
  if(checkRunning())fail('Game started during recovery; nothing archived');
  if(sha(fs.readFileSync(path.join(dir,'state.json')))!==before.stateSha256||!matchesStock(game))fail('Files/state changed during recovery; nothing archived');
  fs.writeFileSync(metadata,JSON.stringify({format:'LID-STEAM-UPDATE-ARCHIVE-1',build:BUILD,mode:before.mode,game,archive:destination,stateSha256:before.stateSha256,stock:before.stock,note:'Old state/backups/blobs preserved. Do not restore old-build snapshots over the updated game.'},null,2),{flag:'wx'});wroteMetadata=true;
  ordinary(dir,'directory');ordinary(path.join(dir,'state.json'),'file');
  directory(path.dirname(archiveRoot));directory(archiveRoot);
  const verifyMove=()=>{ordinary(dir,'directory');ordinary(path.join(dir,'state.json'),'file');ordinary(lock,'file');ordinary(path.dirname(archiveRoot),'directory');ordinary(archiveRoot,'directory');absent(destination);if(fs.readFileSync(lock,'utf8')!==token)fail('Recovery lock changed');if(checkRunning()||!matchesStock(game)||sha(fs.readFileSync(path.join(dir,'state.json')))!==before.stateSha256)fail('Files/state changed during archive; nothing archived');};
  renameBounded(dir,destination,verifyMove,rename);moved=true;
  if(checkRunning()||!matchesStock(game)||sha(fs.readFileSync(path.join(destination,'state.json')))!==before.stateSha256)fail('Files/state changed during archive; restoring the old receipt location');
  const movedLock=path.join(destination,'operation.lock');if(fs.readFileSync(movedLock,'utf8')!==token)fail('Recovery lock changed');fs.unlinkSync(movedLock);locked=false;
  return {...before,changed:true,archive:destination,message:'Old state/backups preserved at the archive path. No game/save file was changed. Reapply the current mod now. / 구버전 기록과 백업을 위 경로에 보존했습니다. 게임·세이브는 변경하지 않았습니다. 이제 새 패치를 적용하세요.'};
 }catch(error){
  if(moved){try{const verifyRollback=()=>{ordinary(destination,'directory');ordinary(path.join(destination,'state.json'),'file');ordinary(path.join(destination,'operation.lock'),'file');ordinary(path.dirname(archiveRoot),'directory');ordinary(archiveRoot,'directory');absent(dir);if(fs.readFileSync(path.join(destination,'operation.lock'),'utf8')!==token||sha(fs.readFileSync(path.join(destination,'state.json')))!==before.stateSha256)fail('Archived receipt/lock changed; manual recovery required');};renameBounded(destination,dir,verifyRollback,rename);moved=false;}catch(rollback){error.message+='\nArchive preserved at '+destination+'; rollback failed: '+rollback.message;throw error;}}
  if(wroteMetadata&&fs.existsSync(metadata))fs.unlinkSync(metadata);
  throw error;
 }finally{if(locked&&!moved&&fs.existsSync(lock)&&fs.readFileSync(lock,'utf8')===token)fs.unlinkSync(lock);}
}
module.exports={BUILD,STOCK,matchesStock,notice,inspect,archive};

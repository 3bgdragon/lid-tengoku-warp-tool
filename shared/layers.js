'use strict';
// Identical, bundled protocol in all four tools. No other checkout is required.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const exe=require('./kernel/src/executable'),pkg=require('./kernel/src/decal-package');
const language=require('./kernel/src/language');
const FILES=['Binaries/Win64/BrgGame-Steam.exe','BrgGame/CookedPCConsole/BrgGame.upk',
 'BrgGame/CookedPCConsole/AS_CH_Main_Male_Common_SF.upk','BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk',
 'BrgGame/CookedPCConsole/BrgStart_PL.upk','BrgGame/Content/masters.db'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error(m);};
const stateRoot=game=>path.join(path.resolve(game),'LID-Mod-State');
const statePath=game=>path.join(stateRoot(game),'state.json');
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const verifiedRecipes=new Set();
const recipeKey=r=>JSON.stringify([r.before,r.after,r.config]);
function remember(r){if(verifiedRecipes.size>=128)verifiedRecipes.delete(verifiedRecipes.values().next().value);verifiedRecipes.add(recipeKey(r));}
function running(){
 if(process.platform!=='win32')return false;
 return /BrgGame-Steam\.exe/i.test(execFileSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true}));
}
function write(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}
function replace(file,bytes){const tmp=file+'.lid-compose-'+crypto.randomUUID()+'.tmp';write(tmp,bytes);try{fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function snapshot(game,file,bytes){
 const blob=path.join(stateRoot(game),'blobs',hash(bytes));
 if(!fs.existsSync(blob))write(blob,bytes);
 else if(hash(fs.readFileSync(blob))!==hash(bytes))fail('Snapshot blob damaged / 공통 백업 데이터 손상');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 try{fs.linkSync(blob,file);}catch(error){if(error.code==='EEXIST')throw error;fs.copyFileSync(blob,file,fs.constants.COPYFILE_EXCL);}
}
function capture(game){
 for(const suffix of ['-wal','-shm','-journal'])if(fs.existsSync(path.join(game,FILES[5])+suffix))fail('DB is open or recovering / DB가 사용 중이거나 복구 중입니다');
 return FILES.map(name=>fs.readFileSync(path.join(game,name)));
}
function digests(buffers){return buffers.map(hash);}
function matches(game,hashes){return digests(capture(game)).every((v,i)=>v===hashes[i]);}
function receipt(game){
 if(fs.existsSync(path.join(path.resolve(game),'LID-TFC-State','state.json'))||fs.existsSync(path.join(path.resolve(game),'LID-TFC-State','pending.json')))fail('TFC companion controls these files. Use tfc/run.bat; do not mix standalone and TFC installers / TFC 보조 도구 관리 중입니다. tfc/run.bat을 사용하세요');
 if(!fs.existsSync(statePath(game)))return null;
 const r=readJson(statePath(game));
 if(r.format!==1||typeof r.active!=='boolean')fail('Invalid shared mod state / 공통 모드 기록 형식 오류');
 return r.active?r:null;
}
function active(game){
 if(receipt(game))return true;
 const root=process.env.LID_VENDING_BACKUP_DIR||path.resolve(__dirname,'../..','let-it-die-vending-enhancement-backups');
 return adopt(game,root);
}
function materialRows(game){
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(game,FILES[5]),{readOnly:true});
 try{return db.prepare('SELECT * FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000 ORDER BY goods_id').all();}finally{db.close();}
}
function removeMaterials(game,c){
 if(!Array.isArray(c.rows)||c.rows.length!==106||c.rows.some(r=>!Number.isInteger(r.goods_id)||r.goods_id<1900000000||r.goods_id>=1900010000))fail('Missing/invalid owned material rows / 소유 재료 행 기록 오류');
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(game,FILES[5]));
 try{
  db.exec('BEGIN IMMEDIATE');const find=db.prepare('SELECT * FROM master_automaticshop_lineup WHERE goods_id=?'),del=db.prepare('DELETE FROM master_automaticshop_lineup WHERE goods_id=?');
  for(const row of c.rows){const current=find.get(row.goods_id);if(!current||Object.keys(row).some(k=>current[k]!==row[k]))fail('Material row changed by another tool / 다른 도구가 재료 행을 변경했습니다');del.run(row.goods_id);}
  db.exec('COMMIT');
 }catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{db.close();}
}
function config(c){
 if(!c||!['ko','en'].includes(c.language)||typeof c.decals!=='boolean'||typeof c.ammo!=='boolean'||c.ammo&&!c.decals)fail('Invalid vending layer settings / 자판기 레이어 설정 오류');
 return c;
}
function compose(base,c){
 config(c);language.setLanguage(c.language);
 const patched=exe.patchExecutable(base[0]).output;
 const upk=c.decals?pkg.patchPackage(base[1],c.ammo?require('./kernel/patches/vending-build25386710.json'):undefined):base[1];
 return [c.decals?pkg.linkExecutable(patched,base[1],upk):patched,upk];
}
function basePair(game,r){
 if(!/^[a-f0-9-]{36}$/.test(r.generation)||!Array.isArray(r.before)||r.before.length!==2||!Array.isArray(r.after)||r.after.length!==2)fail('Invalid layer receipt / 레이어 기록 오류');
 const base=[0,1].map(i=>fs.readFileSync(path.join(stateRoot(game),'generations',r.generation,'base-'+i)));
 if(base.some((b,i)=>hash(b)!==r.before[i]))fail('Layer baseline damaged / 레이어 원본 손상');
 const current=[0,1].map(i=>fs.readFileSync(path.join(game,FILES[i])));
 if(current.some((b,i)=>hash(b)!==r.after[i]))fail('Shared files changed outside composition; nothing overwritten / 공통 처리 외부에서 파일이 변경되어 덮어쓰지 않습니다');
 require('./kernel/src/executable-links').validatePackageLinks(current[0],game);
 if(!verifiedRecipes.has(recipeKey(r))){
  const expected=compose(base,r.config);
  if(expected.some((b,i)=>!b.equals(current[i])))fail('Vending layer does not match verified recipe / 검증된 자판기 레시피와 파일이 다릅니다');
  remember(r);
 }
 return base;
}
function newReceipt(game,base,output,c){
 const generation=crypto.randomUUID(),folder=path.join(stateRoot(game),'generations',generation);
 base.forEach((b,i)=>snapshot(game,path.join(folder,'base-'+i),b));
 const r={format:1,active:true,generation,config:config(c),before:digests(base),after:digests(output)};remember(r);return r;
}
function register(game,backup,c){
 fs.mkdirSync(stateRoot(game),{recursive:true});const lock=path.join(stateRoot(game),'operation.lock');write(lock,Buffer.from('adopt'));
 try{return registerLocked(game,backup,c);}finally{fs.unlinkSync(lock);}
}
function registerLocked(game,backup,c){
 // Adopt an existing verified vending backup without changing any game bytes.
 const m=readJson(path.join(backup,'manifest.json'));
 if(![1,2].includes(m.version)||m.status!=='applied'||path.resolve(m.game).toLowerCase()!==path.resolve(game).toLowerCase())fail('Not an applied backup for this game / 이 게임에 적용된 백업이 아닙니다');
 const base=[fs.readFileSync(path.join(backup,'original-0')),m.decals?fs.readFileSync(path.join(backup,'original-2')):fs.readFileSync(path.join(game,FILES[1]))];
 if(hash(base[0])!==m.files[0].before||m.decals&&hash(base[1])!==m.files[2].before)fail('Backup baseline damaged / 백업 원본 손상');
 if(hash(fs.readFileSync(path.join(game,FILES[5])))!==m.files[1].after)fail('DB changed since legacy vending backup / 구형 자판기 백업 이후 DB가 변경됐습니다');
 c={...c,rows:materialRows(game)};
 if(c.rows.length!==106||new Set(c.rows.map(r=>r.goods_id)).size!==106)fail('Legacy material rows incomplete / 구형 재료 상품 기록이 불완전합니다');
 const output=compose(base,c),current=[0,1].map(i=>fs.readFileSync(path.join(game,FILES[i])));
 if(output.some((b,i)=>!b.equals(current[i])))fail('Backup and current layer mismatch / 백업과 현재 레이어가 다릅니다');
 if(receipt(game)){basePair(game,receipt(game));return;}
 const before=capture(game),next=newReceipt(game,base,output,c);
 if(output.some((b,i)=>!b.equals(before[i]))||hash(before[5])!==m.files[1].after)fail('Files changed during adoption / 기존 패치 등록 중 파일 변경 감지');
 if(!matches(game,digests(before)))fail('Files changed during adoption / 기존 패치 등록 중 파일 변경 감지');
 replace(statePath(game),Buffer.from(JSON.stringify(next,null,2)));
}
function adopt(game,backupRoot){
 if(receipt(game))return true;
 if(!fs.existsSync(backupRoot))return false;
 for(const item of fs.readdirSync(backupRoot).sort().reverse()){
  const folder=path.join(backupRoot,item);let m;try{m=readJson(path.join(folder,'manifest.json'));}catch{continue;}
  if(m.status!=='applied'||path.resolve(m.game||'.').toLowerCase()!==path.resolve(game).toLowerCase())continue;
  for(const lang of ['ko','en']){try{register(game,folder,{decals:!!m.decals,ammo:!!m.ammo,language:lang});return true;}catch{}}
 }
 return false;
}
function stage(game,original,r){
 const root=path.join(stateRoot(game),'staging',crypto.randomUUID()),directory=path.join(root,'game');
 try{
  original.forEach((b,i)=>write(path.join(directory,FILES[i]),b));
  if(r)basePair(game,r).forEach((b,i)=>replace(path.join(directory,FILES[i]),b));
  return {root,game:directory};
 }catch(error){clean(root,game);throw error;}
}
function clean(stageRoot,game){
 const parent=path.join(stateRoot(game),'staging');
 if(path.dirname(stageRoot)!==parent||!/^[a-f0-9-]{36}$/.test(path.basename(stageRoot)))fail('Unsafe staging cleanup target');
 fs.rmSync(stageRoot,{recursive:true,force:true});
}
function view(game,fn){
 const r=receipt(game);if(!r)return fn(game);
 const original=capture(game),s=stage(game,original,r);
 try{return fn(s.game);}finally{clean(s.root,game);}
}
function install(game,before,after,checkRunning){
 if(checkRunning()||!matches(game,digests(before)))fail('Game running or files changed before commit / 게임 실행 또는 설치 전 파일 변경 감지');
 const installed=[];
 try{
  after.forEach((b,i)=>{if(!b.equals(before[i])){replace(path.join(game,FILES[i]),b);installed.push(i);}});
  if(!matches(game,digests(after)))fail('Post-commit verification failed / 설치 후 검증 실패');
 }catch(error){
  for(const i of installed.reverse()){
   const file=path.join(game,FILES[i]);if(hash(fs.readFileSync(file))!==hash(after[i]))fail('External change during rollback; keep shared backup / 복구 중 외부 변경 감지, 공통 백업을 보존하세요');
   replace(file,before[i]);
  }throw error;
 }
}
function transact(game,kind,fn,{checkRunning=running}={}){
 if(checkRunning())fail('Close the game completely / 게임을 완전히 종료하세요');
 fs.mkdirSync(stateRoot(game),{recursive:true});const lock=path.join(stateRoot(game),'operation.lock');write(lock,Buffer.from(kind));
 let s;
 try{
  const previous=receipt(game),before=capture(game);s=stage(game,before,previous);
  const oldEnv=process.env.LID_SHARED_STAGE_BACKUP;process.env.LID_SHARED_STAGE_BACKUP=path.join(s.root,'legacy-backups');
  let action;try{action=fn(s.game)||{};}finally{if(oldEnv===undefined)delete process.env.LID_SHARED_STAGE_BACKUP;else process.env.LID_SHARED_STAGE_BACKUP=oldEnv;}
  if(action&&typeof action.then==='function')fail('Layer callbacks must be synchronous');
  let next=previous,underlying,pending;
  if(Object.hasOwn(action,'vending')){
   if(action.vending){
    underlying=action.vending.base;const output=compose(underlying,action.vending.config);
    if(output.some((b,i)=>!b.equals(fs.readFileSync(path.join(s.game,FILES[i])))))fail('Vending build verification failed');
    pending=[underlying,output,action.vending.config];
   }else next={format:1,active:false};
  }else if(previous){
   underlying=[0,1].map(i=>fs.readFileSync(path.join(s.game,FILES[i])));
   const output=compose(underlying,previous.config);output.forEach((b,i)=>replace(path.join(s.game,FILES[i]),b));
   pending=[underlying,output,previous.config];
  }
  if(previous||Object.hasOwn(action,'vending'))require('./kernel/src/executable-links').validatePackageLinks(fs.readFileSync(path.join(s.game,FILES[0])),s.game);
  const after=capture(s.game),result=action.result;
  if(before.every((b,i)=>b.equals(after[i]))){
   if(checkRunning()||!matches(game,digests(before)))fail('Game running or files changed during no-op verification / 동일 설정 확인 중 게임 실행 또는 파일 변경 감지');
   return {changed:false,result,backup:null};
  }
  if(pending)next=newReceipt(game,...pending);
  const folder=path.join(stateRoot(game),'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());
  before.forEach((b,i)=>snapshot(game,path.join(folder,'original-'+i),b));
  const m={format:'LID-COMPOSE-1',game:path.resolve(game),kind,status:'prepared',before:digests(before),after:digests(after),receipt:previous};
  write(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(m,null,2)));
  install(game,before,after,checkRunning);
  try{replace(statePath(game),Buffer.from(JSON.stringify(next||{format:1,active:false},null,2)));}
  catch(error){install(game,after,before,checkRunning);throw error;}
  m.status='applied';replace(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(m,null,2)));
  return {changed:true,result,backup:folder};
 }finally{try{if(s)clean(s.root,game);}finally{fs.unlinkSync(lock);}}
}
function backups(game,kind){
 const root=path.join(stateRoot(game),'backups');if(!fs.existsSync(root))return [];
 return fs.readdirSync(root).sort().reverse().map(n=>path.join(root,n)).filter(f=>{try{const m=readJson(path.join(f,'manifest.json'));return m.format==='LID-COMPOSE-1'&&(!kind||m.kind===kind);}catch{return false;}});
}
function restore(game,folder,{checkRunning=running}={}){
 if(checkRunning())fail('Close the game completely / 게임을 완전히 종료하세요');
 const lock=path.join(stateRoot(game),'operation.lock');write(lock,Buffer.from('restore'));
 try{
 const m=readJson(path.join(folder,'manifest.json'));
 if(m.format!=='LID-COMPOSE-1'||path.resolve(m.game).toLowerCase()!==path.resolve(game).toLowerCase()||m.status!=='applied'||!matches(game,m.after))fail('Shared backup restore blocked by later changes / 이후 변경 때문에 공통 전체 백업 복원을 차단했습니다');
 const before=capture(game),original=FILES.map((_,i)=>fs.readFileSync(path.join(folder,'original-'+i)));
 if(digests(original).some((h,i)=>h!==m.before[i]))fail('Shared backup damaged / 공통 백업 손상');
 const safetyBackup=backup(game,m.kind+'-safety');
 install(game,before,original,checkRunning);
 try{replace(statePath(game),Buffer.from(JSON.stringify(m.receipt||{format:1,active:false},null,2)));}
 catch(error){install(game,original,before,checkRunning);throw error;}
 m.status='restored';replace(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(m,null,2)));return {backupPath:folder,safetyBackup};
 }finally{fs.unlinkSync(lock);}
}
function isBackup(folder){try{return readJson(path.join(folder,'manifest.json')).format==='LID-COMPOSE-1';}catch{return false;}}
function backup(game,kind){
 const before=capture(game),folder=path.join(stateRoot(game),'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());
 const r=receipt(game);if(r)basePair(game,r);
 before.forEach((b,i)=>snapshot(game,path.join(folder,'original-'+i),b));
 const m={format:'LID-COMPOSE-1',game:path.resolve(game),kind,status:'applied',before:digests(before),after:digests(before),receipt:r};
 if(!matches(game,m.before))fail('Files changed during backup / 백업 중 파일 변경');
 write(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(m,null,2)));return folder;
}
module.exports={FILES,stateRoot,receipt,active,basePair,compose,materialRows,removeMaterials,register,adopt,view,transact,backups,isBackup,backup,restore,running};

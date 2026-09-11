'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const files=['BrgGame/CookedPCConsole/AS_CH_Main_Male_Common_SF.upk','BrgGame/CookedPCConsole/BrgGame.upk','BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk','BrgGame/CookedPCConsole/BrgStart_PL.upk','Binaries/Win64/BrgGame-Steam.exe'];
function capture(game){return Object.fromEntries(files.map(rel=>{const f=path.join(game,rel);return [rel,fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null];}));}
const same=(a,b)=>a&&b&&files.every(f=>Object.hasOwn(a,f)&&a[f]===b[f]);
function mark(folder,game){const file=path.join(folder,'backup.json'),record=JSON.parse(fs.readFileSync(file,'utf8'));record.afterSnapshot=capture(game);const temporary=file+'.pending';fs.writeFileSync(temporary,JSON.stringify(record,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,file);}
function assertSafe(record,game){
 const current=capture(game);
 if(same(record.beforeSnapshot,current)||same(record.afterSnapshot,current))return;
 // Legacy backups have no reliable context. Only a byte-identical no-op is safe.
 if(!record.beforeSnapshot&&record.files&&Object.values(record.files).length>0&&Object.values(record.files).every(r=>{
  const rel=files.find(f=>path.basename(f)===r.name);if(!rel||!fs.existsSync(path.join(game,rel)))return false;
  return crypto.createHash('sha1').update(fs.readFileSync(path.join(game,rel))).digest('hex').toUpperCase()===r.sha1;
 }))return;
 throw Error('다른 패치/업데이트가 파일을 변경했거나 안전 복원 이력이 없습니다. 전체 백업 복원을 중단합니다. 다른 패치를 유지하려면 패치 제거 또는 순정 설정을 사용하세요. 백업은 보존했습니다.');
}
module.exports={capture,mark,assertSafe};

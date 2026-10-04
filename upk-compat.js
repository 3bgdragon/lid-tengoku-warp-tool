'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline/promises');
const shared=require('./shared/layers');
async function main(){
 const args=process.argv.slice(2),english=args.includes('--lang=en'),t=(ko,en)=>english?en:ko;
 const [major,minor]=process.versions.node.split('.').map(Number);
 if(major<22||(major===22&&minor<5))throw Error('Node.js 22.5+ is required for shared mod operations.');
 let entered=args.find(a=>!a.startsWith('--'));
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 try{
  let game;
  for(;;){
   if(!entered)entered=await rl.question(t('게임 설치 폴더 또는 BrgGame-Steam.exe 경로 (Enter=종료): ','Installation folder or BrgGame-Steam.exe path (Enter=exit): '));
   if(!entered.trim())return;
   entered=entered.trim().replace(/^"(.*)"$/,'$1');game=path.resolve(entered);
   if(path.basename(game).toLowerCase()==='brggame-steam.exe')game=path.resolve(path.dirname(game),'../..');
   if(shared.FILES.every(f=>{try{return fs.statSync(path.join(game,f)).isFile();}catch{return false;}}))break;
   console.log(t('필수 게임 파일을 찾지 못했습니다. 설치 폴더를 다시 지정하세요.','Required game files not found. Please enter the installation folder again.'));entered=null;
  }
  console.log(t('UPK 편집기 호환 배치 — 시험 기능\n게임을 종료하고 네 패치 도구를 모두 이 기능이 포함된 버전으로 사용하세요.\n압축 블록만 연속 배치하며 EXE의 패키지 해시를 갱신합니다. 게임 로직·세이브·DB는 수정하지 않습니다.\n외부 편집기가 이후 UPK를 수정하면 자동 덮어쓰기·복원을 차단합니다.','UPK editor-compatible layout — experimental\nClose the game and use versions of all four patch tools containing this feature.\nOnly compressed block placement and EXE package hashes change; game logic, save and DB are unchanged.\nLater external UPK edits block automatic overwrite and snapshot restore.'));
  const restore=args.includes('--restore');
  const selected=args.find(a=>a.startsWith('--reapply='))?.slice('--reapply='.length);
  if(selected){
   if(!['guard','m2g'].includes(selected))throw Error('Use --reapply=guard or --reapply=m2g');
   console.log(t('전체 UPK 백업이 아니라 기록된 해당 기능만 복구합니다: ','Restore only the recorded selected feature, not an old whole UPK: ')+selected);
   if((await rl.question(t('게임 종료 후 해당 기능 복구에 동의합니까? (y/N): ','Close game. Reapply this recorded preset? (y/N): '))).trim().toLowerCase()!=='y')return;
   const result=shared.reapplyRecorded(game,selected);console.log(JSON.stringify(result,null,2));return;
  }
  const answer=await rl.question(restore?t('마지막 UPK 배치 백업을 복원할까요? (y/N): ','Restore the latest package-layout backup? (y/N): '):t('현재 모드를 유지한 채 연속 배치로 전환할까요? (y/N): ','Convert to contiguous layout while preserving current mods? (y/N): '));
  if(answer.trim().toLowerCase()!=='y')return;
  if(restore){const folder=shared.backups(game,'package-layout').find(f=>JSON.parse(fs.readFileSync(path.join(f,'manifest.json'),'utf8')).status==='applied');if(!folder)throw Error(t('복원 가능한 UPK 배치 백업이 없습니다.','No restorable package-layout backup.'));const result=shared.restore(game,folder);console.log(t('복원 완료: ','Restored: ')+result.backupPath);}
  else{const result=shared.compactPackages(game);console.log(result.changed?t('연속 배치 완료. 변경 전 전체 백업: ','Contiguous layout applied. Pre-change full backup: ')+result.backup:t('이미 연속 배치 상태입니다. 파일을 변경하지 않았습니다.','Already contiguous. No files changed.'));}
 }finally{rl.close();}
}
main().catch(e=>{console.error('Error / 오류: '+e.message);process.exitCode=1;});

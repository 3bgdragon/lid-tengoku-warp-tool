'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline/promises');
const {parseArgs}=require('node:util');
const controller=require('./tfc-companion');
async function main(mod){
 const {values,positionals}=parseArgs({allowPositionals:true,options:{game:{type:'string'},yes:{type:'boolean',default:false}}});
 const input=readline.createInterface({input:process.stdin,output:process.stdout});
 const ask=async text=>(await input.question(text)).trim().replace(/^"|"$/g,'');
 try{
  let command=positionals[0],game=values.game;
  if(command&&fs.existsSync(command)){game=command;command=undefined;}
  if(!game)game=await ask('LET IT DIE folder or BrgGame-Steam.exe path / 설치 폴더 또는 EXE 경로: ');
  if(!game)return;
  game=path.resolve(game);if(path.basename(game).toLowerCase()==='brggame-steam.exe')game=path.resolve(game,'../../..');
  if(!fs.existsSync(path.join(game,controller.EXE)))throw Error('Executable not found / 실행 파일을 찾지 못했습니다');
  console.log('TFC native companion — build 25386710 / TFC edition 1.0.0');
  console.log('UPK and save files are never rewritten. Use TFC to install/remove UPK parts.\nUPK·세이브는 수정하지 않습니다. UPK 적용·제거는 TFC에서 하세요.');
  if(!command){console.log('1. Sync package hashes / 해시 연결\n2. Enable native component / 보조 기능 켜기\n3. Disable native component / 보조 기능 끄기\n4. Restore previous native settings / 이전 보조 설정 복원\n5. Recover interrupted operation / 중단 작업 복구\n6. Status / 상태\n7. Leave TFC mode after uninstalling UPKs / TFC 모드 종료');command={'1':'sync','2':'on','3':'off','4':'restore','5':'recover','6':'status','7':'detach'}[await ask('Select / 선택: ')];}
  if(!['sync','on','off','off-all','restore','recover','status','detach'].includes(command))throw Error('Unknown command');
  if(command==='status'){console.log(JSON.stringify(controller.readState(game)?.config||controller.empty(),null,2));return;}
  if(!values.yes&&!/^y(es)?$/i.test(await ask('Close the game. Backed-up EXE/DB operation; proceed? / 게임 종료 후 백업·적용 진행? (y/N): ')))return;
  let result;
  if(command==='restore')result=controller.restoreLatest(game);
  else if(command==='recover')result=controller.recover(game);
  else if(command==='detach')result=controller.detach(game);
  else{
   const state=controller.readState(game)?.config||controller.empty(),next=command==='off-all'?controller.empty():{...state};
   if(mod==='warp'||mod==='vending'){if(command!=='sync'&&command!=='off-all')next[mod]=command==='on';}
   else if(command!=='sync')console.log('Guard/M2G are UPK-only: this operation only relinks hashes. Apply/remove the UPK with TFC.');
   result=controller.change(game,next);
  }
  console.log(JSON.stringify(result,null,2));
 }finally{input.close();}
}
module.exports={main};

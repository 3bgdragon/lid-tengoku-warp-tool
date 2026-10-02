'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline/promises');
const {parseArgs}=require('node:util');
const controller=require('./tfc-companion');
const {menu,choose}=require('./tfc-menu');
async function main(mod){
 const {values,positionals}=parseArgs({allowPositionals:true,options:{game:{type:'string'},yes:{type:'boolean',default:false},json:{type:'boolean',default:false}}});
 const input=readline.createInterface({input:process.stdin,output:process.stdout});
 const ask=async text=>(await input.question(text)).trim().replace(/^"|"$/g,'');
 try{
  let command=positionals[0],game=values.game;
  if(command&&fs.existsSync(command)){game=command;command=undefined;}
  if(!game)game=await ask('LET IT DIE folder or BrgGame-Steam.exe path / 설치 폴더 또는 EXE 경로: ');
  if(!game)return;
  game=path.resolve(game);if(path.basename(game).toLowerCase()==='brggame-steam.exe')game=path.resolve(game,'../../..');
  if(!fs.existsSync(path.join(game,controller.EXE)))throw Error('Executable not found / 실행 파일을 찾지 못했습니다');
  if(!values.json){
   console.log(menu(mod).title+' — Steam build 25386710');
   console.log('First install/remove the UPK in TFC. Then finish here.\nTFC에서 UPK를 적용·제거한 뒤, 이 도구로 마무리하세요. 세이브는 수정하지 않습니다.');
   if(mod==='vending')console.log('Materials + decals + ammo: fixed ALL ON package. / 재료 상점·데칼 관리·탄약 충전: 세 기능 전체 고정 구성');
  }
  if(!command)command=await choose(mod,ask);
  if(command==='exit')return;
  if(!['sync','on','off','off-all','restore','recover','status','detach'].includes(command))throw Error('Unknown command');
  if(command==='status'){
   const settings=controller.readState(game)?.config||controller.empty();
   if(values.json){console.log(JSON.stringify(settings,null,2));return;}
   const linked=require('./kernel/src/executable-links');
   linked.validatePackageLinks(fs.readFileSync(path.join(game,controller.EXE)),game);
   console.log('Package connection: OK / 게임 파일 연결: 정상');
   if(mod==='warp'||mod==='vending')console.log('Native component / 보조 기능: '+(settings[mod]?'ON / 켜짐':'OFF / 꺼짐'));
   console.log('This does not list TFC UPK presets or prove gameplay. / TFC 적용 옵션·실게임 동작 확인은 별도입니다.');
   return;
  }
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
  if(values.json)console.log(JSON.stringify(result,null,2));
  else{
   console.log('Completed / 완료'+(result.changed===false?' (already up to date / 이미 동일한 상태)':''));
   if(result.backup)console.log('Backup / 백업: '+result.backup);
   if(command==='on'&&mod==='vending')console.log('Materials + decals + ammo: ready / 재료 상점·데칼 관리·탄약 충전: 사용 준비 완료');
   console.log('If TFC UPK processing is complete, you can launch the game. / TFC UPK 작업까지 완료했다면 게임을 실행하세요.');
  }
 }finally{input.close();}
}
module.exports={main};

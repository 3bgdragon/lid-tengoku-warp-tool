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
   console.log('Install: option 5 → install generated folder in TFC → option 1 there. Remove: TFC uninstall → option 2.\n설치: 5번 준비 → 준비 폴더를 TFC로 적용 → 그 폴더에서 1번. 제거: TFC 제거 → 2번. 세이브는 수정하지 않습니다.');
   if(mod==='vending')console.log('Materials + decals + ammo: fixed ALL ON package. / 재료 상점·데칼 관리·탄약 충전: 세 기능 전체 고정 구성');
  }
  if(!command)command=await choose(mod,ask);
  if(command==='exit')return;
  if(command==='prepare'){
   const result=require('./tfc-preflight').prepare(game,mod);
   console.log('Install this prepared folder with TFC, then finish from that folder / TFC 설치 대상:\n'+result.output);return;
  }
  if(!['sync','relink','on','off','removed','off-all','restore','recover','status','detach','repair-layout'].includes(command))throw Error('Unknown command');
  if(command==='status'){
   const record=controller.readState(game),settings=record?.config||controller.empty(),states=[];
   const owned=require('./owned-functions');
   for(const file of new Set(owned.catalog.objects.filter(p=>p.mod===mod).map(p=>p.file))){
    const actual=owned.inspect(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',file)),mod,file),expected=record?.upkSettings?.find(p=>p.mod===mod&&p.file===file)?.preset;
    if(expected!==undefined&&actual!==expected)throw Error('Previously installed feature changed/lost: '+mod+'/'+file+' expected '+expected+', got '+actual);
    states.push({file,preset:actual});
    if(!values.json)console.log('UPK function state / 함수 상태: '+file+' = '+actual);
   }
   if(values.json){console.log(JSON.stringify({...settings,upk:states},null,2));return;}
   const linked=require('./kernel/src/executable-links');
   linked.validatePackageLinks(fs.readFileSync(path.join(game,controller.EXE)),game);
   const bytes=fs.readFileSync(path.join(game,controller.EXE));
   const disabled=Object.entries(linked.PACKAGES).filter(([name,[,count]])=>linked.digestEntries(bytes,name,count).every(e=>!e.checked)).map(([name])=>name);
   if(disabled.length)console.log('External manager file checks OFF (preserved) / 외부 관리자 파일 검사 OFF 유지: '+disabled.join(', '));
   console.log('Package connection: OK / 게임 파일 연결: 정상');
   if(mod==='warp'||mod==='vending')console.log('Native component / 보조 기능: '+(settings[mod]?'ON / 켜짐':'OFF / 꺼짐'));
   console.log('Reviewed file states are checked; gameplay still needs testing. / 검증된 파일 상태만 확인하며 실게임 동작은 별도 확인이 필요합니다.');
   return;
  }
  if(command==='repair-layout')console.log('Explicit UPK layout repair: backs up and relocates compressed frames in BrgGame/common, relinks EXE, preserves logical data. Not a feature reinstallation. / UPK 블록 위치와 EXE 해시만 복구합니다. 기능 재설치가 아닙니다.');
  if(!values.yes&&!/^y(es)?$/i.test(await ask('Close the game. Backed-up operation; proceed? / 게임 종료 후 백업·적용 진행? (y/N): ')))return;
  if(command==='on'||command==='sync')require('./tfc-preflight').verify(game);
  if(command==='off'||command==='removed'){
   const owned=require('./owned-functions');
   for(const file of new Set(owned.catalog.objects.filter(p=>p.mod===mod).map(p=>p.file)))
    if(owned.inspect(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',file)),mod,file)!=='off')throw Error('TFC UPK component is still installed / 먼저 TFC에서 UPK를 제거하세요');
  }
  let result;
  if(command==='repair-layout')result=require('./tfc-layout-repair').repair(game);
  else if(command==='restore')result=controller.restoreLatest(game);
  else if(command==='recover')result=fs.existsSync(path.join(game,'LID-TFC-State/layout-pending.json'))?require('./tfc-layout-repair').recover(game):controller.recover(game);
  else if(command==='detach')result=controller.detach(game);
  else{
   const state=controller.readState(game)?.config||controller.empty(),next=command==='off-all'?controller.empty():{...state};
   if(mod==='warp'||mod==='vending'){if(!['sync','relink','off-all'].includes(command))next[mod]=command==='on';}
   else if(command!=='sync')console.log('Guard/M2G are UPK-only: this operation only relinks hashes. Apply/remove the UPK with TFC.');
   result=controller.change(game,next,{upkMod:command==='relink'?null:mod});
  }
  if(values.json)console.log(JSON.stringify(result,null,2));
  else{
   console.log('Completed / 완료'+(result.changed===false?' (already up to date / 이미 동일한 상태)':''));
   if(result.backup)console.log('Backup / 백업: '+result.backup);
   for(const warning of result.featureWarnings||[])console.log('Warning / 주의: '+warning);
   if(command==='on'&&mod==='vending')console.log('Materials + decals + ammo: ready / 재료 상점·데칼 관리·탄약 충전: 사용 준비 완료');
   console.log('If TFC UPK processing is complete, you can launch the game. / TFC UPK 작업까지 완료했다면 게임을 실행하세요.');
  }
 }finally{input.close();}
}
module.exports={main};

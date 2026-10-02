'use strict';
const TITLES={guard:'Just Guard / 저스트가드',warp:'Tengoku Warp / 텐고쿠 워프',m2g:'M2G Knife-Only / M2G 나이프 전용',vending:'Vending Enhancement / 자판기 강화'};
function menu(mod){
 if(!Object.hasOwn(TITLES,mod))throw Error('Unknown mod');
 const native=mod==='warp'||mod==='vending';
 return {
  title:TITLES[mod],
  text:'1. Finish installation'+(mod==='vending'?' — enable all 3 features':'')+' / 설치 마무리'+(mod==='vending'?' — 세 기능 모두 켜기':'')+'\n2. Finish removal (after TFC uninstall) / 제거 마무리 (TFC에서 제거한 뒤)\n3. Check connection / 연결 상태 확인\n4. Advanced: backup / recovery / 고급: 백업·복구\n0. Exit / 종료',
  commands:{'1':native?'on':'sync','2':native?'off':'sync','3':'status','4':'advanced','0':'exit'}
 };
}
async function choose(mod,ask,print=console.log){
 const basic=menu(mod);print(basic.title+'\n'+basic.text);
 const command=basic.commands[await ask('Select / 선택: ')];
 if(!command)throw Error('Choose 0–4 / 0~4번을 선택하세요');
 if(command!=='advanced')return command;
 print('1. Refresh package connection / 다른 TFC 모드 변경 후 연결 갱신\n2. Restore previous EXE/DB settings / 이전 EXE·DB 설정 복원\n3. Recover interrupted operation / 중단 작업 복구\n4. Leave TFC mode (after removing all UPKs and native components) / 전체 제거 후 TFC 모드 종료\n0. Exit / 종료');
 const advanced={'1':'sync','2':'restore','3':'recover','4':'detach','0':'exit'}[await ask('Advanced / 고급 선택: ')];
 if(!advanced)throw Error('Choose 0–4 / 0~4번을 선택하세요');
 return advanced;
}
module.exports={menu,choose};

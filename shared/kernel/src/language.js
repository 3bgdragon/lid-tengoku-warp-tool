'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let language='ko';
function setLanguage(value){if(!['ko','en'].includes(value))throw new Error('Language must be ko or en');language=value;}
const text=(ko,en)=>language==='en'?en:ko;
function parseLanguage(args){
 const rest=[];let lang;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--lang'){
   if(lang!==undefined||!['ko','en'].includes(args[i+1]))throw new Error('Usage: --lang ko | --lang en');
   lang=args[++i];
  }else rest.push(args[i]);
 }
 return {args:rest,language:lang};
}
function settingsPath(toolDir){return path.join(path.dirname(path.resolve(toolDir)),'let-it-die-tool-settings.json');}
function readSettings(toolDir){
 const file=settingsPath(toolDir);
 if(!fs.existsSync(file))return {};
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid language settings: '+file);
 return data;
}
function savedLanguage(toolDir){const data=readSettings(toolDir);return ['ko','en'].includes(data.language)?data.language:undefined;}
function saveLanguage(toolDir,lang){
 if(!['ko','en'].includes(lang))throw new Error('Language must be ko or en');
 const data=readSettings(toolDir),file=settingsPath(toolDir);
 const pending=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
 fs.writeFileSync(pending,JSON.stringify({...data,language:lang},null,2),{flag:'wx'});
 try{fs.renameSync(pending,file);}catch(e){fs.unlinkSync(pending);throw e;}
 setLanguage(lang);
}
// Only translate known error messages at the presentation boundary. Keep the
// original diagnostics in logs and never translate paths, hashes or patch data.
const errors=[
 ['게임 실행 여부를 확인하지 못했습니다. 관리자 권한으로 실행하거나 시스템 권한을 확인하세요. 파일은 변경하지 않습니다.','Cannot check whether the game is running. Check permissions; no files were changed.'],
 ['게임을 완전히 종료한 뒤 실행하세요.','Close the game completely before continuing.'],
 ['DB 사용/복구 파일이 있습니다: ','Database in-use/recovery file exists: '],
 ['패치 DB 무결성 실패','Patched database integrity check failed'],
 ['준비 중 파일이 변경되었습니다: ','File changed during preparation: '],
 ['쓰기 검증 실패','Write verification failed'],
 ['복원 가능한 백업이 없습니다','No restorable backup found'],
 ['백업 형식 불일치','Backup format mismatch'],
 ['백업 손상','Corrupted backup'],
 ['패치 이후 다른 변경이 있습니다. 덮어쓰지 않습니다: ','Files changed after patching. Refusing to overwrite: '],
 ['복원 검증 실패','Restore verification failed'],
 ['백업 경로 형식 불일치: ','Invalid backup path type: '],
 ['백업 원본 해시 불일치: ','Backup original hash mismatch: '],
 ['같은 이름의 다른 백업이 있습니다. 덮어쓰지 않습니다: ','A different backup has the same name. Refusing to overwrite: '],
 ['백업 복사 검증 실패: ','Backup copy verification failed: '],
 ['복사 중 원본 백업 기록이 변경되었습니다: ','Source backup record changed while copying: '],
 ['지원하지 않는 실행 파일입니다. SHA-256: ','Unsupported executable. SHA-256: '],
 ['PE64 형식 불일치','PE64 format mismatch'],
 ['새 코드 섹션용 헤더 여유 공간이 없습니다','No header space for a new code section'],
 ['잘못된 PE 정렬','Invalid PE alignment'],
 ['후크 위치가 파일 범위 밖입니다','Hook location outside file bounds'],
 ['후크 원본 불일치','Original hook bytes mismatch'],
 ['최초 입고 후크 위치가 파일 범위 밖입니다','Initial-stock hook outside file bounds'],
 ['최초 입고 후크 원본 불일치','Initial-stock original hook bytes mismatch'],
 ['지원하지 않거나 이미 변경된 데칼 메뉴 함수: ','Unsupported or already modified decal-menu function: '],
 ['스크립트 크기 불일치','Script size mismatch'],['분기 원본 불일치','Original branch mismatch'],
 ['잘못된 내보내기 테이블','Invalid export table'],['데칼 함수 누락','Missing decal function'],
 ['데칼 패키지 재검증 실패','Decal package revalidation failed'],['Windows 실행 파일이 아닙니다','Not a Windows executable'],
 ['실행 파일 패키지 해시 테이블 불일치','Executable package hash table mismatch'],
 ['잘린 실행 파일 패키지 해시: ','Truncated executable package digest: '],
 ['실행 파일과 패키지의 해시 연결이 다릅니다: ','Executable and package hash links do not match: '],
 ['실행 파일과 BrgGame 패키지의 해시 연결이 다릅니다','Executable and BrgGame package hash links do not match'],
 ['지원하지 않는 UE3 LZO 패키지','Unsupported UE3 LZO package'],['지원하지 않는 패키지 빌드','Unsupported package build'],
 ['잘못된 압축 구간','Invalid compressed region'],['잘못된 LZO 헤더','Invalid LZO header'],
 ['잘린 압축 테이블','Truncated compression table'],['잘못된 압축 블록','Invalid compressed block'],
 ['압축 해제 길이 불일치','Decompressed length mismatch'],['압축 길이 불일치','Compressed length mismatch'],
 ['압축 검증 실패','Compression verification failed'],['패키지 주소 범위 오류','Package address out of bounds'],
 ['패키지 쓰기 범위 오류','Package write out of bounds']
];
function errorText(message){
 if(language!=='en')return message;
 const suffix=' 백업 복구가 필요할 수 있습니다: ',at=message.indexOf(suffix);
 if(at>=0)return errorText(message.slice(0,at))+' Backup recovery may be required: '+message.slice(at+suffix.length);
 const entry=errors.find(([ko])=>message===ko||message.startsWith(ko.endsWith(': ')?ko:ko+': '));
 return entry?entry[1]+message.slice(entry[0].length):message;
}
module.exports={text,setLanguage,parseLanguage,settingsPath,savedLanguage,saveLanguage,errorText};

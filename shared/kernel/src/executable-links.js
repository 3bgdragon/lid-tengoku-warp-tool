'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Only package digest bytes may vary. Code, headers and added native sections
// remain covered by the executable fingerprint.
const PACKAGES={
 'brggame.upk':['BrgGame.upk',2],
 'heaven_a01_st_col.upk':['Heaven_A01_ST_COL.upk',1],
 'brgstart_pl.upk':['BrgStart_PL.upk',2],
 'as_ch_main_male_common_sf.upk':['AS_CH_Main_Male_Common_SF.upk',1]
};
function digestOffsets(exe,name,count){
 const needle=Buffer.from(name+'\0'),offsets=[];let at=0;
 while((at=exe.indexOf(needle,at))>=0){at+=needle.length;if(at+20>exe.length)throw new Error('잘린 실행 파일 패키지 해시: '+name);offsets.push(at);}
 if(offsets.length!==count)throw new Error('실행 파일 패키지 해시 테이블 불일치: '+name);
 return offsets;
}
function normalizedExecutable(exe){
 const output=Buffer.from(exe);
 for(const [name,[,count]] of Object.entries(PACKAGES))
  for(const at of digestOffsets(exe,name,count))output.fill(0,at,at+20);
 return output;
}
function validatePackageLinks(exe,game){
 for(const [name,[file,count]] of Object.entries(PACKAGES)){
  const target=path.join(game,'BrgGame','CookedPCConsole',file);
  const digest=crypto.createHash('sha1').update(fs.readFileSync(target)).digest();
  for(const at of digestOffsets(exe,name,count))
   if(!exe.subarray(at,at+20).equals(digest))throw new Error('실행 파일과 패키지의 해시 연결이 다릅니다: '+file);
 }
}
module.exports={PACKAGES,digestOffsets,normalizedExecutable,validatePackageLinks};

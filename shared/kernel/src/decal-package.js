'use strict';
const {createHash}=require('node:crypto');
const {reader,pack,words}=require('./package-codec');
const plan=require('../patches/decal-build25386710.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
function patchFunction(original,p){
 if(sha(original)!==p.before||original.length!==p.size)throw new Error('지원하지 않거나 이미 변경된 데칼 메뉴 함수: '+p.name);
 const size=original.readUInt32LE(0x2c),memory=original.readUInt32LE(0x28);
 if(size!==p.scriptSize||memory!==p.scriptMemory)throw new Error('스크립트 크기 불일치');
 const code=Buffer.from(original.subarray(0x30,0x30+size));
 for(const j of p.jumps){if(code.readUInt16LE(j.at)!==j.before)throw new Error('분기 원본 불일치');code.writeUInt16LE(j.after,j.at);}
 const prefix=Buffer.from(p.insert,'hex'),result=Buffer.concat([code.subarray(0,p.at),prefix,code.subarray(p.at)]);
 const header=Buffer.from(original.subarray(0,0x30));header.writeUInt32LE(memory+p.extraMemory,0x28);header.writeUInt32LE(result.length,0x2c);
 return Buffer.concat([header,result,original.subarray(0x30+size)]);
}
function patchPackage(source,selectedPlan=plan){
 const plan=require('./game-language').localizePlan(selectedPlan);
 const r=reader(source),wanted=new Map(plan.patches.map(p=>[p.export,p])),patches=[];
 let at=source.readUInt32LE(0x25);
 for(let i=1;i<=plan.exportCount;i++){
  const entry=r.read(at,68),generations=entry.readUInt32LE(44);
  if(generations>10000)throw new Error('잘못된 내보내기 테이블');
  if(wanted.has(i)){
   const p=wanted.get(i),size=entry.readUInt32LE(32),offset=entry.readUInt32LE(36);
   if(size!==p.size)throw new Error('지원하지 않거나 이미 변경된 데칼 메뉴 함수: '+p.name);
   patches.push({p,slot:at,replacement:patchFunction(r.read(offset,size),p)});
  }at+=68+generations*4;
 }
 if(patches.length!==wanted.size)throw new Error('데칼 함수 누락');
 const last=r.table.length-1,tail=[r.chunk(last)];let logical=r.table[last][0]+r.table[last][1];
 for(const p of patches){r.write(p.slot+32,words(p.replacement.length,logical));p.newOffset=logical;tail.push(p.replacement);logical+=p.replacement.length;}
 const out=Buffer.from(source),append=[];let physical=out.length;
 r.dirty.add(last);
 for(const index of [...r.dirty].sort((a,b)=>a-b)){
  const raw=index===last?Buffer.concat(tail):r.chunk(index),packed=pack(raw);
  words(r.table[index][0],raw.length,physical,packed.length).copy(out,0x75+index*16);append.push(packed);physical+=packed.length;
 }
 const output=Buffer.concat([out,...append]),check=reader(output);
 for(const p of patches)if(!check.read(p.newOffset,p.replacement.length).equals(p.replacement))throw new Error('데칼 패키지 재검증 실패');
 return output;
}
function linkExecutable(exe,before,after){
 if(exe.subarray(0,2).toString('ascii')!=='MZ')throw new Error('Windows 실행 파일이 아닙니다');
 const needle=Buffer.from('brggame.upk\0'),locations=[];let at=0;
 while((at=exe.indexOf(needle,at))>=0){at+=needle.length;locations.push(at);}
 if(locations.length!==2)throw new Error('실행 파일 패키지 해시 테이블 불일치');
 const hash=b=>createHash('sha1').update(b).digest(),old=hash(before),next=hash(after),output=Buffer.from(exe);
 for(const at of locations){if(!exe.subarray(at,at+20).equals(old))throw new Error('실행 파일과 BrgGame 패키지의 해시 연결이 다릅니다');next.copy(output,at);}
 return output;
}
module.exports={patchPackage,patchFunction,linkExecutable,plan};

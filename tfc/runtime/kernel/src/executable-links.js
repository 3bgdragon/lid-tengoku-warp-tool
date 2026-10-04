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
// Nico's file-check switch changes only the last resource-name byte to X/Y.
// Never accept those aliases by a whole-file string search: locate RCDATA 1010.
function resourceEntries(exe){
 function range(at,size){if(!Number.isSafeInteger(at)||at<0||at+size>exe.length)throw Error('Invalid PE resource range');return at;}
 const u16=at=>exe.readUInt16LE(range(at,2)),u32=at=>exe.readUInt32LE(range(at,4));
 if(exe.length<64||exe.toString('ascii',0,2)!=='MZ')throw Error('Not a PE executable');
 const pe=u32(60);range(pe,24);if(exe.toString('ascii',pe,pe+4)!=='PE\0\0')throw Error('Invalid PE signature');
 const optional=pe+24,optionalSize=u16(pe+20),magic=u16(optional),directories=magic===0x20b?112:magic===0x10b?96:0;
 if(!directories||optionalSize<directories+24)throw Error('Unsupported PE optional header');
 range(optional,optionalSize);const table=optional+optionalSize,count=u16(pe+6);if(!count||count>96)throw Error('Invalid PE sections');range(table,count*40);
 function offset(rva,size){const found=[];for(let i=0;i<count;i++){const at=table+i*40,start=u32(at+12),rawSize=u32(at+16),raw=u32(at+20);if(rva>=start&&rva+size<=start+rawSize)found.push(range(raw+rva-start,size));}if(found.length!==1)throw Error('Ambiguous PE resource address');return found[0];}
 const rva=u32(optional+directories+16),size=u32(optional+directories+20);if(!rva||!size)throw Error('Missing PE resource directory');const base=offset(rva,size);
 function entries(relative){if(relative<0||relative+16>size)throw Error('Invalid resource directory');const at=base+relative,n=u16(at+12)+u16(at+14);if(relative+16+n*8>size)throw Error('Invalid resource entries');return Array.from({length:n},(_,i)=>[u32(at+16+i*8),u32(at+20+i*8)]);}
 function descend(relative,id){const matches=entries(relative).filter(e=>e[0]===id);if(matches.length!==1||!(matches[0][1]&0x80000000))throw Error('Missing checksum resource '+id);return matches[0][1]&0x7fffffff;}
 const language=entries(descend(descend(0,10),1010));if(language.length!==1||(language[0][1]&0x80000000))throw Error('Ambiguous checksum resource language');
 const data=language[0][1];if(data+16>size)throw Error('Invalid checksum resource data');const length=u32(base+data+4),start=offset(u32(base+data),length),end=start+length,result=[];
 for(let cursor=start;cursor<end;){const stop=exe.indexOf(0,cursor);if(stop<0||stop>=end)throw Error('Truncated checksum name');const bytes=exe.subarray(cursor,stop);cursor=stop+1;if(!bytes.length)continue;if(bytes.equals(Buffer.from('+++')))break;if(cursor+20>end)throw Error('Truncated checksum entry');if([...bytes].some(b=>b<32||b>126))throw Error('Non-ASCII checksum name');result.push({name:bytes.toString('ascii'),nameAt:stop-bytes.length,offset:cursor});cursor+=20;}
 if(!result.length)throw Error('Empty checksum resource');return result;
}
function digestEntries(exe,name,count){
 name=name.toLowerCase();
 // Real PE files use the resource parser; non-PE fixtures retain the legacy
 // checked-name scanner but can never authorize a disabled-name alias.
 const pe=exe.length>=64?exe.readUInt32LE(60):0;
 if(pe>0&&pe+4<=exe.length&&exe.toString('ascii',pe,pe+4)==='PE\0\0'){
  const entries=resourceEntries(exe).filter(e=>e.name.toLowerCase()===name||e.name===name.slice(0,-1)+'X'||e.name===name.slice(0,-1)+'Y').map(e=>({...e,checked:e.name.toLowerCase()===name}));
  if(entries.length!==count)throw Error('실행 파일 패키지 해시 테이블 불일치: '+name);
  if(entries.some(e=>e.checked)&&entries.some(e=>!e.checked))throw Error('Mixed enabled/disabled package checks: '+name);
  return entries;
 }
 const needle=Buffer.from(name+'\0'),offsets=[];let at=0;
 while((at=exe.indexOf(needle,at))>=0){at+=needle.length;if(at+20>exe.length)throw new Error('잘린 실행 파일 패키지 해시: '+name);offsets.push(at);}
 if(offsets.length!==count)throw new Error('실행 파일 패키지 해시 테이블 불일치: '+name);
 return offsets.map(offset=>({offset,nameAt:offset-needle.length,name,checked:true}));
}
function digestOffsets(exe,name,count){return digestEntries(exe,name,count).map(e=>e.offset);}
function normalizedExecutable(exe){
 const output=Buffer.from(exe);
 for(const [name,[,count]] of Object.entries(PACKAGES))
  for(const e of digestEntries(exe,name,count)){output.fill(0,e.offset,e.offset+20);output[e.offset-2]=name.charCodeAt(name.length-1);}
 return output;
}
function validatePackageLinks(exe,game){
 for(const [name,[file,count]] of Object.entries(PACKAGES)){
  const target=path.join(game,'BrgGame','CookedPCConsole',file);
  const digest=crypto.createHash('sha1').update(fs.readFileSync(target)).digest();
  for(const e of digestEntries(exe,name,count))
   if(e.checked&&!exe.subarray(e.offset,e.offset+20).equals(digest))throw new Error('실행 파일과 패키지의 해시 연결이 다릅니다: '+file);
 }
}
module.exports={PACKAGES,resourceEntries,digestEntries,digestOffsets,normalizedExecutable,validatePackageLinks};

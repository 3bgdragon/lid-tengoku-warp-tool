'use strict';
// Reviewed build-25386710 structure and native dependencies. No full-file hash.
const profiles=[require('./native-preconditions-25386710.json'),require('./native-preconditions-25767944.json')];
function layout(b){
 if(b.length<64||b.toString('ascii',0,2)!=='MZ')throw Error('Unsupported PE structure');
 const pe=b.readUInt32LE(60);if(pe>b.length-24||b.toString('ascii',pe,pe+4)!=='PE\0\0')throw Error('Unsupported PE structure');
 const count=b.readUInt16LE(pe+6),optional=b.readUInt16LE(pe+20),opt=pe+24,table=opt+optional;
 if(optional<112||count<1||count>96||table+count*40>b.length)throw Error('Unsupported PE sections');
 return {pe,machine:b.readUInt16LE(pe+4),optional,magic:b.readUInt16LE(opt),entry:b.readUInt32LE(opt+16),sectionAlignment:b.readUInt32LE(opt+32),fileAlignment:b.readUInt32LE(opt+36),imageSize:b.readUInt32LE(opt+56),headerSize:b.readUInt32LE(opt+60),sections:Array.from({length:count},(_,i)=>{
 const at=table+i*40;return {name:b.toString('ascii',at,at+8),virtualSize:b.readUInt32LE(at+8),rva:b.readUInt32LE(at+12),rawSize:b.readUInt32LE(at+16),raw:b.readUInt32LE(at+20),flags:b.readUInt32LE(at+36)};})};
}
function profileFor(b){
 const found=layout(b);
 const profile=profiles.find(p=>['stock','warp'].some(k=>b.length===p[k].size&&JSON.stringify(found)===JSON.stringify(p[k].layout)));
 const state=profile&&['stock','warp'].find(k=>b.length===profile[k].size&&JSON.stringify(found)===JSON.stringify(profile[k].layout));
 if(!state)throw Error('Unsupported PE layout/sections or overlay / 지원하지 않는 PE 구조·섹션 또는 추가 데이터');
 for(const expected of profile.expected){
  const section=found.sections.find(s=>expected.rva>=s.rva&&expected.rva+expected.size<=s.rva+s.rawSize);
  if(!section)throw Error('Native dependency outside PE range');
  const at=section.raw+expected.rva-section.rva;
  if(!b.subarray(at,at+expected.size).equals(Buffer.from(expected.hex,'hex')))throw Error('Conflicting native bytes at RVA 0x'+expected.rva.toString(16));
 }
 return {profile,state};
}
function validate(b){return profileFor(b).state;}
module.exports={validate,layout,profileFor};

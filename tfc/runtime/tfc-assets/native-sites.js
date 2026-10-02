'use strict';
// A narrow fallback for reviewed native patch sites, not a validation bypass.
const fs=require('node:fs'),path=require('node:path');
function parsePatch(data){
 if(data.length<16||data.subarray(0,8).toString('ascii')!=='LIDBIN1\0')throw new Error('Invalid native patch');
 const size=data.readUInt32LE(8),count=data.readUInt32LE(12),entries=[];let at=16;
 for(let i=0;i<count;i++){
  if(at+8>data.length)throw new Error('Truncated native patch');
  const offset=data.readUInt32LE(at),length=data.readUInt32LE(at+4);at+=8;
  if(at+length>data.length||offset+length>size)throw new Error('Native patch bounds');
  entries.push({offset,bytes:data.subarray(at,at+length)});at+=length;
 }
 if(at!==data.length)throw new Error('Native patch trailing bytes');return {size,entries};
}
function peLayout(b){
 if(b.length<64||b.toString('ascii',0,2)!=='MZ')throw new Error('Not PE');
 const pe=b.readUInt32LE(60);if(pe>b.length-24||b.toString('ascii',pe,pe+4)!=='PE\0\0')throw new Error('Invalid PE');
 const count=b.readUInt16LE(pe+6),optional=b.readUInt16LE(pe+20),opt=pe+24,table=opt+optional;
 if(optional<112||count<1||count>96||table+count*40>b.length)throw new Error('Invalid sections');
 return {pe,machine:b.readUInt16LE(pe+4),optional,magic:b.readUInt16LE(opt),entry:b.readUInt32LE(opt+16),sectionAlignment:b.readUInt32LE(opt+32),fileAlignment:b.readUInt32LE(opt+36),imageSize:b.readUInt32LE(opt+56),headerSize:b.readUInt32LE(opt+60),sections:Array.from({length:count},(_,i)=>{
  const at=table+i*40;return {name:b.toString('ascii',at,at+8),virtualSize:b.readUInt32LE(at+8),rva:b.readUInt32LE(at+12),rawSize:b.readUInt32LE(at+16),raw:b.readUInt32LE(at+20),flags:b.readUInt32LE(at+36)};
 })};
}
function identify(data,definition,assets){
 const profileFile=path.join(assets,'native-sites-25386710.json');
 // Only this reviewed build is enabled. Old/unknown layouts remain rejected.
 if(definition.baseSha1!=='802B3E1181DEA1FB29CE9CA331161922902B9827'||!fs.existsSync(profileFile))return null;
 const profile=JSON.parse(fs.readFileSync(profileFile,'utf8'));
 const enable=parsePatch(fs.readFileSync(path.join(assets,definition.enablePatch)));
 const disable=parsePatch(fs.readFileSync(path.join(assets,definition.disablePatch)));
 let layout;try{layout=peLayout(data);}catch{return null;}
 for(const enabled of [false,true]){
  if(data.length!==(enabled?enable.size:disable.size))continue;
  if(JSON.stringify(layout)!==JSON.stringify(profile[enabled?'patched':'stock']))continue;
  const expected=enabled?enable:disable;
  if(!expected.entries.every(e=>data.subarray(e.offset,e.offset+e.bytes.length).equals(e.bytes)))continue;
  // Every existing byte the enable patch overwrites must have a recorded stock
  // expectation. Otherwise a future delta would silently widen this fallback.
  if(enable.entries.some(e=>e.offset<disable.size&&!disable.entries.some(d=>d.offset===e.offset&&d.bytes.length===e.bytes.length)))return null;
  return {enabled,definition,validation:'patch-sites'};
 }
 return null;
}
module.exports={identify,parsePatch,peLayout};

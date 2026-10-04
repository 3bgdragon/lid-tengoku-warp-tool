'use strict';
// Reorder existing compressed chunks only; never rewrite logical UE3 data.
const crypto=require('node:crypto');
const {digestEntries}=require('./kernel/src/executable-links');
const sha1=b=>crypto.createHash('sha1').update(b).digest();
function compact(source){
 if(source.length<0x75||source.readUInt32LE(0)!==0x9e2a83c1||source.readUInt32LE(0x6d)!==2)throw Error('Unsupported UE3 LZO layout');
 const count=source.readUInt32LE(0x71),end=0x75+count*16;
 if(count<1||count>100000||end>source.length)throw Error('Invalid compressed directory');
 const entries=[];let logicalEnd;
 for(let i=0;i<count;i++){
  const at=0x75+i*16,logical=source.readUInt32LE(at),size=source.readUInt32LE(at+4),physical=source.readUInt32LE(at+8),packed=source.readUInt32LE(at+12);
  if(!size||packed<16||physical<end||physical+packed>source.length||logical+size>0xffffffff||(logicalEnd!==undefined&&logical!==logicalEnd))throw Error('Invalid UE3 compressed range');
  const block=source.readUInt32LE(physical+4),total=source.readUInt32LE(physical+12);
  if(source.readUInt32LE(physical)!==0x9e2a83c1||!block||block>1048576||total!==size)throw Error('Invalid compressed frame');
  const blocks=Math.ceil(size/block);let cursor=physical+16+blocks*8,sum=0,raw=0;
  if(cursor>physical+packed)throw Error('Truncated compressed frame');
  for(let j=0;j<blocks;j++){
   const length=source.readUInt32LE(physical+16+j*8),plain=source.readUInt32LE(physical+20+j*8);
   if(!length||plain!==Math.min(block,size-raw)||cursor+length>physical+packed)throw Error('Invalid compressed block');
   cursor+=length;sum+=length;raw+=plain;
  }
  if(cursor!==physical+packed||sum!==source.readUInt32LE(physical+8))throw Error('Compressed frame length mismatch');
  entries.push({at,physical,packed});logicalEnd=logical+size;
 }
 const sorted=[...entries].sort((a,b)=>a.physical-b.physical);
 for(let i=1;i<sorted.length;i++)if(sorted[i].physical<sorted[i-1].physical+sorted[i-1].packed)throw Error('Overlapping physical chunks');
 // UE3's logical header excludes the compressed-directory records. The first
 // live chunk may have moved; its physical offset is NOT the header length.
 const headerLength=source.readUInt32LE(0x75)+count*16;
 if(headerLength<end||headerLength>sorted[0].physical)throw Error('Invalid UE3 header extent');
 const header=Buffer.from(source.subarray(0,headerLength));let physical=header.length;
 const parts=[header];
 for(const e of entries){header.writeUInt32LE(physical,e.at+8);parts.push(source.subarray(e.physical,e.physical+e.packed));physical+=e.packed;}
 const output=Buffer.concat(parts);
 for(let i=0;i<count;i++){
  const e=entries[i],at=output.readUInt32LE(e.at+8);
  if(!output.subarray(at,at+e.packed).equals(source.subarray(e.physical,e.physical+e.packed)))throw Error('Compressed data changed during compaction');
 }
 return output;
}
function pair(buffers){
 const output=buffers.map(b=>Buffer.from(b));if(output[0].subarray(0,2).toString()!=='MZ')throw Error('Not a Windows executable');
 for(const [i,name,count] of [[1,'brggame.upk',2],[2,'as_ch_main_male_common_sf.upk',1]]){
  const previous=sha1(buffers[i]),next=compact(buffers[i]),digest=sha1(next);
  for(const {offset:at,checked} of digestEntries(output[0],name,count)){
   if(checked&&!output[0].subarray(at,at+20).equals(previous))throw Error('Package hash mismatch before compaction');
   digest.copy(output[0],at);
  }
  output[i]=next;
 }return output;
}
module.exports={compact,pair};

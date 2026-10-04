'use strict';
// Preserve foreign instructions. Only validated warp instruction bytes change.
const crypto=require('node:crypto');
const {pack,words}=require('./kernel/src/package-codec');
const {lzo1xDecompress}=require('./kernel/vendor/lzo1x/dist/index.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const compiled=new WeakMap();
function compile(plan){
 if(compiled.has(plan))return compiled.get(plan);
 const result=new Map();
 for(const p of plan.objects){
  const off=Buffer.from(p.off.base64,'base64'),on=Buffer.from(p.on.base64,'base64');
  if(off.length!==p.off.size||on.length!==p.on.size||off.length!==on.length||sha(off)!==p.off.sha256||sha(on)!==p.on.sha256)throw Error('Damaged scoped warp patch');
  const edits=[],windows=[];
  for(let i=0;i<off.length;i++)if(off[i]!==on[i]){
   edits.push(i);const start=Math.max(0,i-16),end=Math.min(off.length,i+17),last=windows.at(-1);
   if(last&&start<=last[1])last[1]=end;else windows.push([start,end]);
  }
  if(!edits.length)throw Error('Empty scoped warp patch');
  result.set(p.index,{off,on,edits,windows});
 }
 compiled.set(plan,result);return result;
}
function reader(data){
 if(data.length<0x75||data.readUInt32LE(0)!==0x9e2a83c1||data.readUInt16LE(4)!==861||data.readUInt16LE(6)!==19||data.readUInt32LE(0x6d)!==2)throw Error('Unsupported scoped UE3 package layout');
 const count=data.readUInt32LE(0x71),table=[],cache=new Map(),dirty=new Set();
 if(count<1||count>10000||0x75+count*16>data.length)throw Error('Invalid compressed directory');
 for(let i=0;i<count;i++){
  const e=Array.from({length:4},(_,j)=>data.readUInt32LE(0x75+i*16+j*4));
  if(!e[1]||e[1]>64*1024*1024||e[2]<0x75+count*16||e[3]<16||e[2]+e[3]>data.length||e[0]+e[1]>0xffffffff||(i&&e[0]!==table[i-1][0]+table[i-1][1]))throw Error('Invalid compressed range');table.push(e);
 }
 const ranges=[...table].sort((a,b)=>a[2]-b[2]);
 if(ranges.some((e,i)=>i&&e[2]<ranges[i-1][2]+ranges[i-1][3]))throw Error('Overlapping compressed ranges');
 const headerLength=table[0][0]+count*16;
 if(headerLength<0x75+count*16||headerLength>ranges[0][2])throw Error('Invalid package header extent');
 function chunk(i){
  if(cache.has(i))return cache.get(i);
  const [,size,at,packed]=table[i],block=data.readUInt32LE(at+4);
  if(data.readUInt32LE(at)!==0x9e2a83c1||data.readUInt32LE(at+12)!==size||!block||block>1048576)throw Error('Invalid LZO frame');
  const n=Math.ceil(size/block),out=Buffer.alloc(size);let cursor=at+16+n*8,used=0,sum=0;
  if(cursor>at+packed)throw Error('Truncated LZO block table');
  for(let j=0;j<n;j++){
   const length=data.readUInt32LE(at+16+j*8),plain=data.readUInt32LE(at+20+j*8);
   if(!length||plain!==Math.min(block,size-used)||cursor+length>at+packed)throw Error('Invalid LZO block');
   const bytes=data.subarray(cursor,cursor+length),raw=length===plain?bytes:Buffer.from(lzo1xDecompress(bytes,plain));
   if(raw.length!==plain)throw Error('Invalid decoded size');raw.copy(out,used);used+=plain;cursor+=length;sum+=length;
  }
  if(cursor!==at+packed||sum!==data.readUInt32LE(at+8))throw Error('LZO frame length mismatch');cache.set(i,out);return out;
 }
 function range(at,size,write){
  if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(size)||size<0||size>64*1024*1024)throw Error('Invalid logical range');
  const parts=[];let used=0;
  while(used<size){const i=table.findIndex(e=>at>=e[0]&&at<e[0]+e[1]);if(i<0)throw Error('Logical range outside package');const start=at-table[i][0],n=Math.min(size-used,table[i][1]-start);if(write){write.copy(chunk(i),start,used,used+n);dirty.add(i);}else parts.push(chunk(i).subarray(start,start+n));used+=n;at+=n;}
  return write?undefined:Buffer.concat(parts);
 }
 return {table,headerLength,chunk,dirty,read:(a,n)=>range(a,n),write:(a,b)=>range(a,b.length,b)};
}
function inspect(source,plan){
 const r=reader(source),count=source.readUInt32LE(0x21),wanted=new Map(plan.objects.map(p=>[p.index,p])),definitions=compile(plan),objects=[];
 if(count<plan.exportCount||count>200000)throw Error('Unsupported export table');
 let at=source.readUInt32LE(0x25);
 for(let i=0;i<count;i++){
  const entry=r.read(at,68),generations=entry.readUInt32LE(44);
  if(generations>10000)throw Error('Invalid export generations');
  if(wanted.has(i)){
   const p=wanted.get(i),metadata=Buffer.from(entry);metadata.fill(0,32,40);
   if(sha(metadata)!==p.metadata)throw Error('Warp export identity conflict: '+i);
   const size=entry.readUInt32LE(32),offset=entry.readUInt32LE(36),bytes=r.read(offset,size),definition=definitions.get(i);
   // Another mod may legitimately edit a different instruction in this same
   // function (Faster Drops does). Validate the function header and every owned
   // instruction with surrounding context, not its entire serialized hash.
   const matches=side=>size===p.off.size&&bytes.subarray(0,0x30).equals(definition[side].subarray(0,0x30))&&definition.windows.every(([a,b])=>bytes.subarray(a,b).equals(definition[side].subarray(a,b)));
   const enabled=matches('on')?true:matches('off')?false:null;
   if(enabled===null)throw Error('Warp export was changed by another mod: '+i);
   objects.push({p,slot:at,offset,size,enabled,bytes,definition});
  }
  at+=68+generations*4;
 }
 if(objects.length!==wanted.size)throw Error('Missing warp exports');
 if(objects.some(p=>p.enabled!==objects[0].enabled))throw Error('Mixed warp export states; refusing partial overwrite');
 return {enabled:objects[0].enabled,objects,r};
}
function set(source,enable,plan){
 const state=inspect(source,plan);if(state.enabled===enable)return source;
 const {r,objects}=state;
 for(const o of objects){
  const bytes=Buffer.from(o.bytes),replacement=o.definition[enable?'on':'off'];
  for(const at of o.definition.edits)bytes[at]=replacement[at];
  if(bytes.length!==o.size)throw Error('Scoped warp replacement must retain object size');
  r.write(o.offset,bytes);
 }
 const header=Buffer.from(source.subarray(0,r.headerLength)),parts=[header];let physical=header.length;
 for(let i=0;i<r.table.length;i++){
  const [at,size,offset,packed]=r.table[i];
  const bytes=r.dirty.has(i)?pack(r.chunk(i)):source.subarray(offset,offset+packed);
  words(at,size,physical,bytes.length).copy(header,0x75+i*16);parts.push(bytes);physical+=bytes.length;
 }
 const output=Buffer.concat(parts),check=inspect(output,plan);
 if(check.enabled!==enable)throw Error('Scoped warp state verification failed');
 // Prove that all pre-existing logical bytes are preserved, except the owned
 // function bodies. No export slot, foreign function, name or import is rewritten.
 for(let i=0;i<r.table.length;i++)if(r.dirty.has(i)){
  if(!check.r.read(r.table[i][0],r.table[i][1]).equals(r.chunk(i)))throw Error('Unrelated logical data changed');
 }
 return output;
}
module.exports={reader,inspect,set,sha};

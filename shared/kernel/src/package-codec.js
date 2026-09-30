'use strict';
// UE3 LZO block format; adapted from the MIT-licensed M2G patch tool.
// Attribution: ../vendor/package-patch-LICENSE; LZO implementation: vendor/lzo1x.
const {lzo1xCompress,lzo1xDecompress}=require('../vendor/lzo1x/dist/index.cjs');
const TAG=0x9e2a83c1;
const words=(...values)=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
function entries(data){
 if(data.length<0x75||data.readUInt32LE()!==TAG||data.readUInt32LE(0x6d)!==2)throw new Error('지원하지 않는 UE3 LZO 패키지');
 const count=data.readUInt32LE(0x71);
 if(count!==286||data.readUInt32LE(0x21)!==173671)throw new Error('지원하지 않는 패키지 빌드');
 const table=[];let end;
 for(let i=0;i<count;i++){
  const e=Array.from({length:4},(_,j)=>data.readUInt32LE(0x75+i*16+j*4));
  const [logical,size,physical,packed]=e;
  if(!size||size>64*1024*1024||physical<0x75+count*16||physical+packed>data.length||packed<16||(end!==undefined&&logical!==end))throw new Error('잘못된 압축 구간');
  end=logical+size;table.push(e);
 }return table;
}
function unpack(data,e){
 const [,expected,offset,packed]=e,block=data.readUInt32LE(offset+4),total=data.readUInt32LE(offset+12);
 if(data.readUInt32LE(offset)!==TAG||total!==expected||block<1||block>1048576)throw new Error('잘못된 LZO 헤더');
 const count=Math.ceil(total/block),out=Buffer.alloc(total);let cursor=offset+16+count*8,written=0,sum=0;
 if(cursor>offset+packed)throw new Error('잘린 압축 테이블');
 for(let i=0;i<count;i++){
  const len=data.readUInt32LE(offset+16+i*8),size=data.readUInt32LE(offset+20+i*8);
  if(!len||size!==Math.min(block,total-written)||cursor+len>offset+packed)throw new Error('잘못된 압축 블록');
  const payload=data.subarray(cursor,cursor+len),decoded=len===size?payload:Buffer.from(lzo1xDecompress(payload,size));
  if(decoded.length!==size)throw new Error('압축 해제 길이 불일치');
  decoded.copy(out,written);written+=size;cursor+=len;sum+=len;
 }
 if(cursor!==offset+packed||sum!==data.readUInt32LE(offset+8))throw new Error('압축 길이 불일치');return out;
}
function pack(raw){
 const block=131072,parts=[],sizes=[];
 for(let at=0;at<raw.length;at+=block){const piece=raw.subarray(at,at+block),compressed=Buffer.from(lzo1xCompress(piece));
  const payload=compressed.length<piece.length?compressed:piece;
  if(payload!==piece&&!Buffer.from(lzo1xDecompress(payload,piece.length)).equals(piece))throw new Error('압축 검증 실패');
  parts.push(payload);sizes.push(words(payload.length,piece.length));
 }return Buffer.concat([words(TAG,block,parts.reduce((s,b)=>s+b.length,0),raw.length),...sizes,...parts]);
}
function reader(data){
 const table=entries(data),cache=new Map();
 const chunk=i=>{if(!cache.has(i))cache.set(i,unpack(data,table[i]));return cache.get(i);};
 function read(at,size){const parts=[];let left=size;
  while(left){const i=table.findIndex(e=>at>=e[0]&&at<e[0]+e[1]);if(i<0)throw new Error('패키지 주소 범위 오류');
   const start=at-table[i][0],length=Math.min(left,table[i][1]-start);parts.push(chunk(i).subarray(start,start+length));at+=length;left-=length;
  }return Buffer.concat(parts);
 }
 function write(at,bytes){let used=0;while(used<bytes.length){const i=table.findIndex(e=>at>=e[0]&&at<e[0]+e[1]);if(i<0)throw new Error('패키지 쓰기 범위 오류');const start=at-table[i][0],length=Math.min(bytes.length-used,table[i][1]-start);bytes.copy(chunk(i),start,used,used+length);dirty.add(i);used+=length;at+=length;}}
 const dirty=new Set();return {table,chunk,read,write,dirty};
}
module.exports={reader,pack,words};

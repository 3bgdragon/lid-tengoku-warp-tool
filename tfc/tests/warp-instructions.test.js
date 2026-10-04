'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../runtime/warp-instructions'),evidence=require('../runtime/tfc-assets/warp-instructions.json'),proof=require('../runtime/tfc-assets/upk-proof.json');
function fixture(index=71346){
 const p=evidence.objects.find(p=>p.index===index),entry=Buffer.from(p.identity,'hex'),bytes=Buffer.alloc(p.size);
 entry.writeUInt32LE(p.size,32);Buffer.from(p.header,'hex').copy(bytes);
 for(const w of p.windows)Buffer.from(w.bytes,'hex').copy(bytes,w.at);
 return {p,entry,bytes,proof:proof.warp.find(q=>q.file==='BrgGame.upk'&&q.index===index)};
}
test('TFC warp proof validates only supported instructions and remains self-contained',()=>{
 assert.deepEqual(evidence.objects.map(p=>p.index),[71346,82802]);
 for(const p of evidence.objects){const f=fixture(p.index);assert.equal(api.verify(p.index,f.entry,f.bytes,f.proof),true);}
 const source=fs.readFileSync(path.resolve(__dirname,'../runtime/warp-instructions.js'),'utf8');assert.doesNotMatch(source,/require\(['"]\.\.\//);
});
test('Faster Drops and another non-owned instruction in Initialize remain acceptable',()=>{
 const f=fixture();f.bytes[23626]=0x14;assert.equal(api.verify(f.p.index,f.entry,f.bytes,f.proof),true);
 f.bytes[23626]=0;f.bytes[24000]=0x55;assert.equal(api.verify(f.p.index,f.entry,f.bytes,f.proof),true);
});
test('owned instruction/context changes, identity, header and size conflicts fail closed',()=>{
 for(const index of [71346,82802]){
  let f=fixture(index);f.bytes[f.p.windows[0].at]^=1;assert.throws(()=>api.verify(index,f.entry,f.bytes,f.proof),/instruction\/context/);
  f=fixture(index);f.entry[0]^=1;assert.throws(()=>api.verify(index,f.entry,f.bytes,f.proof),/export identity/);
  f=fixture(index);f.bytes[0]^=1;assert.throws(()=>api.verify(index,f.entry,f.bytes,f.proof),/function header/);
  f=fixture(index);assert.throws(()=>api.verify(index,f.entry,f.bytes.subarray(1),f.proof),/serialized size/);
  f=fixture(index);assert.throws(()=>api.verify(index,f.entry,f.bytes,{...f.proof,sha256:'0'.repeat(64)}),/evidence\/proof mismatch/);
 }
});

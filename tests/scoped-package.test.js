'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {pack,words}=require('../shared/kernel/src/package-codec');
const scoped=require('../compat/scoped-package');
function fixture(){
 const raw=Buffer.alloc(220,0x41),header=Buffer.alloc(272);
 header.writeUInt32LE(0x9e2a83c1,0);header.writeUInt16LE(861,4);header.writeUInt16LE(19,6);
 header.writeUInt32LE(2,0x6d);header.writeUInt32LE(1,0x71);header.writeUInt32LE(1,0x21);header.writeUInt32LE(256,0x25);
 const entry=Buffer.alloc(68);entry.writeUInt32LE(100,32);entry.writeUInt32LE(324,36);entry.copy(raw);
 const off=Buffer.alloc(100,0x42),on=Buffer.from(off);on[60]=0x43;off.copy(raw,68);
 const packed=pack(raw);words(256,raw.length,272,packed.length).copy(header,0x75);
 const metadata=Buffer.from(entry);metadata.fill(0,32,40);
 const side=bytes=>({size:bytes.length,sha256:scoped.sha(bytes),base64:bytes.toString('base64')});
 return {source:Buffer.concat([header,packed]),plan:{exportCount:1,objects:[{index:0,metadata:scoped.sha(metadata),off:side(off),on:side(on)}]}};
}
test('foreign data in the same compressed chunk survives enable and removal',()=>{
 const {source,plan}=fixture(),original=scoped.reader(source).read(256,220);
 const on=scoped.set(source,true,plan);assert.equal(scoped.inspect(on,plan).enabled,true);
 const changed=scoped.reader(on).read(256,220),expected=Buffer.from(original);expected[128]=0x43;assert.deepEqual(changed,expected);
 const off=scoped.set(on,false,plan);assert.deepEqual(scoped.reader(off).read(256,220),original);
 assert.equal(scoped.set(on,true,plan),on);
});
test('conflicting warp bytes are blocked, not accepted by ignoring a hash',()=>{
 const {source,plan}=fixture();const r=scoped.reader(source);const raw=Buffer.from(r.chunk(0));raw[128]=0x44;const packed=pack(raw),bad=Buffer.concat([Buffer.from(source.subarray(0,272)),packed]);bad.writeUInt32LE(packed.length,0x75+12);
 assert.throws(()=>scoped.set(bad,true,plan),/changed by another mod/);
});
test('a foreign instruction in the very same function survives both directions',()=>{
 const {source,plan}=fixture(),r=scoped.reader(source),raw=Buffer.from(r.chunk(0));raw[68+90]=0x55;
 const packed=pack(raw),foreign=Buffer.concat([Buffer.from(source.subarray(0,272)),packed]);foreign.writeUInt32LE(packed.length,0x75+12);
 const on=scoped.set(foreign,true,plan);assert.equal(scoped.reader(on).read(324+90,1)[0],0x55);
 const off=scoped.set(on,false,plan);assert.deepEqual(scoped.reader(off).read(256,220),raw);
 // An edit in the owned instruction's context is a conflict, even if the
 // exact byte that warp changes still has its stock value.
 raw[68+50]=0x66;const badPacked=pack(raw),bad=Buffer.concat([Buffer.from(source.subarray(0,272)),badPacked]);bad.writeUInt32LE(badPacked.length,0x75+12);
 assert.throws(()=>scoped.inspect(bad,plan),/changed by another mod/);
});
test('export identity, patch payload and malformed layout are blocked',()=>{
 const {source,plan}=fixture();const before=Buffer.from(source);
 plan.objects[0].metadata='0'.repeat(64);assert.throws(()=>scoped.inspect(source,plan),/identity conflict/);
 assert.deepEqual(source,before);
 const f=fixture();f.plan.objects[0].on.base64=Buffer.from('badasset').toString('base64');assert.throws(()=>scoped.set(f.source,true,f.plan),/Damaged scoped/);
 const bad=Buffer.from(source);bad.writeUInt32LE(0xffffffff,0x75+8);assert.throws(()=>scoped.inspect(bad,plan),/compressed range/);
});
test('published plan contains only the two BrgGame warp exports',()=>{
 const plan=require('../assets/scoped-warp-25386710.json');assert.equal(plan.build,'25386710');
 assert.deepEqual(plan.objects.map(o=>o.index),[71346,82802]);
 for(const o of plan.objects){assert.equal(o.off.size,o.on.size);for(const s of [o.off,o.on])assert.equal(scoped.sha(Buffer.from(s.base64,'base64')),s.sha256);}
});

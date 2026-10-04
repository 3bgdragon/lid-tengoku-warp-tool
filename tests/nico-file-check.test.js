'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const links=require('../shared/kernel/src/executable-links');
function fixture(){
 const b=Buffer.alloc(4096);b.write('MZ');b.writeUInt32LE(128,60);b.write('PE\0\0',128);b.writeUInt16LE(1,134);b.writeUInt16LE(240,148);b.writeUInt16LE(0x20b,152);
 b.writeUInt32LE(4096,280);b.writeUInt32LE(3584,284);b.write('.rsrc',392);b.writeUInt32LE(4096,404);b.writeUInt32LE(3584,408);b.writeUInt32LE(512,412);
 b.writeUInt16LE(1,526);b.writeUInt32LE(10,528);b.writeUInt32LE(0x80000020,532);
 b.writeUInt16LE(1,558);b.writeUInt32LE(1010,560);b.writeUInt32LE(0x80000040,564);
 b.writeUInt16LE(1,590);b.writeUInt32LE(1033,592);b.writeUInt32LE(96,596);
 let cursor=640;for(const [name,[,n]] of Object.entries(links.PACKAGES))for(let i=0;i<n;i++){cursor+=b.write(name+'\0',cursor);b.fill(i+1,cursor,cursor+20);cursor+=20;}
 b.writeUInt32LE(4224,608);b.writeUInt32LE(cursor-640,612);return b;
}
test('Nico disabled checksum aliases normalize without disabling native-byte verification',()=>{
 const b=fixture(),changed=Buffer.from(b),e=links.digestEntries(b,'brggame.upk',2);
 for(const p of e)changed[p.offset-2]=88;
 assert(links.digestEntries(changed,'brggame.upk',2).every(p=>!p.checked));
 assert.deepEqual(links.normalizedExecutable(b),links.normalizedExecutable(changed));
 changed[100]^=1;assert.notDeepEqual(links.normalizedExecutable(b),links.normalizedExecutable(changed));
});
test('mixed/unknown aliases and fake aliases outside checksum resource are refused',()=>{
 const b=fixture(),e=links.digestEntries(b,'brggame.upk',2);b[e[0].offset-2]=88;
 assert.throws(()=>links.digestEntries(b,'brggame.upk',2),/Mixed/);b[e[1].offset-2]=90;
 b.write('brggame.upX\0',320);assert.throws(()=>links.digestEntries(b,'brggame.upk',2));
});
test('ambiguous or out-of-range PE resources are refused',()=>{
 const b=fixture();b.writeUInt32LE(0xffffffff,608);assert.throws(()=>links.resourceEntries(b));
 const c=fixture();c.writeUInt16LE(2,590);assert.throws(()=>links.resourceEntries(c),/ambiguous|Ambiguous/);
});
module.exports={fixture};

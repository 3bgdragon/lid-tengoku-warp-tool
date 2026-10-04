'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const owned=require('../shared/owned-functions');
test('fixed-size warp edits merge independent Faster Drops instructions',()=>{
 const v=owned.group('warp','BrgGame.upk',71346),foreign=Buffer.from(v[0].off);
 assert.equal(foreign[23626],20);foreign[23626]=0;
 const on=owned.merge(foreign,v,'on');assert.equal(on[23626],0);
 const off=owned.merge(on,v,'off');assert.deepEqual(off,foreign);
});
test('owned instruction or adjacent context conflict is blocked before output',()=>{
 const v=owned.group('warp','BrgGame.upk',71346),b=Buffer.from(v[0].off);
 b[28873]=255;assert.throws(()=>owned.merge(b,v,'on'),/conflict/);
 const c=Buffer.from(v[0].off);c[28874]^=1;assert.throws(()=>owned.merge(c,v,'on'),/conflict/);
});
test('length-changing M2G/vending edits never guess a foreign branch layout',()=>{
 for(const mod of ['m2g','vending']){
  const p=owned.catalog.objects.find(p=>p.mod===mod&&Buffer.from(p.off,'base64').length!==Buffer.from(p.on,'base64').length);
  assert.ok(p,mod);const v=owned.group(mod,p.file,p.index),b=Buffer.from(v[0].off);b[64]^=1;
  assert.throws(()=>owned.merge(b,v,p.preset),/conflict/,mod);
 }
});
test('fixed-size guard edits preserve independent function bytes',()=>{
 const p=owned.catalog.objects.find(p=>p.mod==='guard'&&p.file==='BrgGame.upk'),v=owned.group('guard',p.file,p.index),b=Buffer.from(v[0].off);
 const diffs=v.flatMap(p=>[...p.off.keys()].filter(i=>p.off[i]!==p.on[i]));
 const at=[...b.keys()].find(i=>i>=48&&diffs.every(j=>Math.abs(i-j)>16));assert.ok(at);
 b[at]^=1;const on=owned.merge(b,v,p.preset);assert.equal(on[at],b[at]);assert.deepEqual(owned.merge(on,v,'off'),b);
});
test('all reviewed presets round-trip owned bytes',()=>{
 for(const p of owned.catalog.objects){const v=owned.group(p.mod,p.file,p.index),off=Buffer.from(p.off,'base64'),on=owned.merge(off,v,p.preset);
  assert.deepEqual(on,Buffer.from(p.on,'base64'));assert.deepEqual(owned.merge(on,v,'off'),off);
 }
});

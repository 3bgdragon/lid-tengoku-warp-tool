'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const owned=require('../shared/owned-functions'),current=require('../shared/owned-functions-25923506.json');
test('decals-only does not claim ownership of the three ammo-only shop functions',()=>{
 for(const catalog of [owned.catalog,current])for(const index of [83731,83737,83755]){
  const raw=catalog.objects.filter(p=>p.mod==='vending'&&p.file==='BrgGame.upk'&&(p.canonicalIndex??p.index)===index);
  const variants=raw.map(p=>({...p,off:Buffer.from(p.off,'base64'),on:Buffer.from(p.on,'base64')}));
  assert.ok(variants.length);
  for(const language of ['ko','en']){
   assert.equal(owned.owns(variants,'decals-'+language),false);
   if(fs.existsSync(path.join(__dirname,'../tfc/runtime/owned-functions.js')))assert.equal(require('../tfc/runtime/owned-functions').owns(variants,'decals-'+language),false);
   assert(owned.merge(variants[0].off,variants,'decals-'+language).equals(variants[0].off));
  }
  assert.throws(()=>owned.owns(variants,'decals-unknown'),/Unknown scoped/);
  assert.throws(()=>owned.owns(variants,'made-up'),/Unknown scoped/);
 }
});
test('25923506 uses 88 separately audited reference-rebased presets',()=>{
 assert.equal(current.exportCount,173715);assert.equal(current.objects.length,88);
 const functions=new Map();for(const p of current.objects){
  assert.equal(p.build,25923506);assert.ok(p.name.includes('.'));
  const off=Buffer.from(p.off,'base64'),on=Buffer.from(p.on,'base64');
  assert.equal(owned.sha(off),p.offHash);assert.equal(owned.sha(on),p.onHash);
  assert.equal(off.length-48-off.readUInt32LE(44),on.length-48-on.readUInt32LE(44));
  const key=p.mod+'/'+p.index,old=functions.get(key);if(old)assert.equal(old,p.offHash);else functions.set(key,p.offHash);
 }
 assert.equal(functions.size,21);
 assert.equal(current.objects.find(p=>p.name==='BrgUIMenu_SkillExchange.Tick').index,91880);
 assert.equal(current.objects.find(p=>p.name==='BrgUIDebugEditParams.Initialize').index,71390);
});
test('25923506 presets refuse modified length-changing bodies',()=>{
 for(const mod of ['m2g','vending']){
  const p=current.objects.find(p=>p.mod===mod&&Buffer.from(p.off,'base64').length!==Buffer.from(p.on,'base64').length);
  const variants=current.objects.filter(v=>v.mod===mod&&v.index===p.index).map(v=>({...v,off:Buffer.from(v.off,'base64'),on:Buffer.from(v.on,'base64')}));
  const changed=Buffer.from(variants[0].off);changed[60]^=1;assert.throws(()=>owned.merge(changed,variants,p.preset),/conflict/);
 }
});
test('25923506 actual fixture identities match all reviewed stock functions',{skip:!process.env.LID_25923506_FIXTURE},()=>{
 const source=fs.readFileSync(path.join(process.env.LID_25923506_FIXTURE,'BrgGame/CookedPCConsole/BrgGame.upk'));
 assert.equal(source.readUInt32LE(0x21),173715);
 for(const mod of ['guard','m2g','warp','vending']){
  const {rows}=owned.objects(source,mod,'BrgGame.upk');
  for(const row of rows){assert.equal(row.state,'off');assert(row.bytes.equals(row.variants[0].off));}
 }
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const owned=require('../shared/owned-functions'),catalog=require('../shared/owned-functions-26639365.json'),audit=require('../shared/ui-audit-26639365.json');
test('26639365 keeps separate exact stock metadata and 95 reviewed presets',()=>{
 assert.equal(catalog.exportCount,173769);assert.equal(catalog.objects.length,95);assert.equal(new Set(catalog.objects.map(p=>p.name)).size,22);
 for(const p of catalog.objects){assert.equal(p.build,26639365);assert.equal(owned.sha(Buffer.from(p.off,'base64')),p.offHash);assert.equal(owned.sha(Buffer.from(p.on,'base64')),p.onHash);}
 assert.deepEqual(audit.custom,{decalsMenu:7,ammoMenu:8,modalState:23,normalState:7,shopStateBase:23});
 assert.equal(catalog.objects.find(p=>p.name==='BrgUIMenu_ItemVendingMachine.SetupTopMenu').offHash,'00d69d67cba35651153afdf24b328858e724afb778f118f23646ca3624dfe428');
});
test('every 26639365 vending preset inversely reproduces every new vanilla instruction',()=>{
 for(const p of catalog.objects.filter(p=>p.mod==='vending')){
  const off=Buffer.from(p.off,'base64'),on=Buffer.from(p.on,'base64'),f=audit.functions.find(f=>f.name===p.name),delta=on.readUInt32LE(44)-off.readUInt32LE(44);
  assert.equal(owned.sha(off),f.stockSha256);assert(off.subarray(0,40).equals(on.subarray(0,40)),p.name+' header');
  if(!delta){assert(on.equals(off));continue;}
  const code=on.subarray(48,48+on.readUInt32LE(44)),inverse=Buffer.concat([code.subarray(0,f.at),code.subarray(f.at+delta)]);
  for(const jump of f.jumps)inverse.writeUInt16LE(jump.before,jump.at);
  assert(inverse.equals(off.subarray(48,48+off.readUInt32LE(44))),p.name+' '+p.preset+' lost new vanilla instructions');
  assert(on.subarray(48+on.readUInt32LE(44)).equals(off.subarray(48+off.readUInt32LE(44))),p.name+' trailer');
 }
});
test('26639365 TFC registry and 213 unrelated map object safeguards are complete',{skip:!fs.existsSync(path.join(__dirname,'../tfc/runtime/build26639365/registry.json'))},()=>{
 const folder=path.join(__dirname,'../tfc/runtime/build26639365'),registry=require('../tfc/runtime/build26639365/registry.json');
 assert.equal(registry.length,10);for(const p of registry)assert.equal(owned.sha(fs.readFileSync(path.join(folder,p.file))),p.sha256);
 assert.equal(require('../tfc/runtime/build26639365/map-unowned.json').length,213);
});
test('26639365 actual fixture objects and vanilla StartShop state base match evidence',{skip:!process.env.LID_26639365_FIXTURE},()=>{
 const source=fs.readFileSync(path.join(process.env.LID_26639365_FIXTURE,'BrgGame/CookedPCConsole/BrgGame.upk'));assert.equal(source.readUInt32LE(0x21),173769);
 for(const mod of ['guard','warp','m2g','vending'])for(const row of owned.objects(source,mod,'BrgGame.upk').rows)assert(row.bytes.equals(row.variants[0].off));
 const r=require('../shared/scoped-package').reader(source),evidence=audit.startShopEvidence;let at=source.readUInt32LE(0x25),entry;
 for(let i=1;i<=evidence.export;i++){entry=r.read(at,68);if(i!==evidence.export)at+=68+entry.readUInt32LE(44)*4;}
 const bytes=r.read(entry.readUInt32LE(36),entry.readUInt32LE(32));assert.equal(owned.sha(bytes),evidence.sha256);assert.equal(bytes.subarray(evidence.at,evidence.at+evidence.bytes.length/2).toString('hex'),evidence.bytes);
});

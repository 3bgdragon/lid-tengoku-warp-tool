'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const c=require('../runtime/tfc-companion'),file=process.env.LID_25767944_EXE;
test('new-build native compose preserves external bytes and rejects dependency conflicts',{skip:!file},()=>{
 const stock=fs.readFileSync(file),foreign=Buffer.from(stock);foreign[0x100000]^=1;
 for(const config of [{warp:true,vending:false},{warp:false,vending:true},{warp:true,vending:true}]){
  const after=c.compose(foreign,config);assert.equal(after[0x100000],foreign[0x100000]);assert.deepEqual(c.reconcile(foreign,after,after),foreign);
  const bad=Buffer.from(after);bad[bad.length-1]^=1;assert.throws(()=>c.reconcile(foreign,after,bad),/Owned native bytes/);
 }
 const profile=require('../runtime/kernel/src/native-preconditions-25767944.json'),e=profile.expected[0],s=profile.stock.layout.sections.find(s=>e.rva>=s.rva&&e.rva<s.rva+s.rawSize);const bad=Buffer.from(foreign);bad[s.raw+e.rva-s.rva]^=1;
 assert.throws(()=>c.compose(bad,{warp:true,vending:false}),/supported stock/);assert.throws(()=>c.compose(bad,{warp:false,vending:true}),/Conflicting native/);
});
test('native preflight refuses unsupported executable before creating packages',{skip:!file},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'np-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const game=path.join(root,'game'),exe=path.join(game,c.EXE);fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,Buffer.concat([fs.readFileSync(file),Buffer.from('unknown overlay')]));
 for(const mod of ['warp','vending'])assert.throws(()=>c.validateNativeSupport(game,mod),/supported|Unsupported/);
 assert(!fs.existsSync(path.join(game,'LID-TFC-State')));assert(!fs.existsSync(path.join(root,'prepared')));
});

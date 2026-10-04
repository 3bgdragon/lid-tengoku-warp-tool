'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const repair=require('../runtime/tfc-layout-repair'),api=require('../runtime/tfc-companion');
const source=process.env.LID_TFC_LAYOUT_SOURCE,gapped=process.env.LID_TFC_LAYOUT_GAPPED;
test('actual Nico layout: explicit repair, OFF preservation, interruption recovery and idempotence',{skip:!source||!gapped},t=>{
 const root=path.resolve(process.env.LID_TFC_TEST_ROOT||path.join(__dirname,'../.integration-temp'));fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'nico-layout-')),game=path.join(dir,'game'),links=require('../runtime/kernel/src/executable-links');
 const files=[api.EXE,...Object.values(links.PACKAGES).map(([f])=>'BrgGame/CookedPCConsole/'+f)];
 const sourceHashes=files.map(f=>api.sha(fs.readFileSync(path.join(source,f))));
 for(const file of files){fs.mkdirSync(path.dirname(path.join(game,file)),{recursive:true});fs.copyFileSync(path.join(source,file),path.join(game,file));}
 fs.copyFileSync(gapped,path.join(game,'BrgGame/CookedPCConsole/BrgGame.upk'));
 const before=files.map(f=>api.sha(fs.readFileSync(path.join(game,f))));
 assert.throws(()=>repair.repair(game,{running:()=>{},failpoint:i=>{if(i===1)throw Error('injected interruption');}}),/injected/);
 assert.throws(()=>api.change(game,api.empty(),{running:()=>{}}),/Interrupted/);
 repair.recover(game,{running:()=>{}});assert.deepEqual(files.map(f=>api.sha(fs.readFileSync(path.join(game,f)))),before);
 const result=repair.repair(game,{running:()=>{}});assert.equal(result.logicalDataUnchanged,true);
 assert.equal(repair.repair(game,{running:()=>{}}).changed,false);
 const exe=fs.readFileSync(path.join(game,api.EXE));assert(links.digestEntries(exe,'brggame.upk',2).every(e=>!e.checked));links.validatePackageLinks(exe,game);
 assert.deepEqual(files.map(f=>api.sha(fs.readFileSync(path.join(source,f)))),sourceHashes);
 t.after(()=>{assert.equal(path.dirname(dir),root);assert(path.basename(dir).startsWith('nico-layout-'));fs.rmSync(dir,{recursive:true,force:true});});
});

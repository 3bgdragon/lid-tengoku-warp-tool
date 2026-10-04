'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const api=require('../runtime/tfc-companion'),preflight=require('../runtime/tfc-preflight');
function fixture(t){
 const root=path.resolve(process.env.LID_TFC_TEST_ROOT||os.tmpdir());fs.mkdirSync(root,{recursive:true});
 const game=fs.mkdtempSync(path.join(root,'tfc-pending-safety-'));
 t.after(()=>{assert.equal(path.dirname(game),root);assert(path.basename(game).startsWith('tfc-pending-safety-'));fs.rmSync(game,{recursive:true,force:true});});
 return game;
}
for(const pending of ['pending.json','layout-pending.json'])test('pending '+pending+' blocks prepare and detach even without registered state',t=>{
 const game=fixture(t),file=path.join(game,'LID-TFC-State',pending);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'{}');
 assert.throws(()=>preflight.prepare(game,'guard'),/Recover interrupted/);
 assert.throws(()=>api.detach(game,{running:()=>{}}),/Recover interrupted/);
 assert.throws(()=>api.finishRemoval(game,'guard',{running:()=>{}}),/Interrupted transaction/);
 assert.equal(fs.readFileSync(file,'utf8'),'{}');
});
for(const state of [{active:true},{active:false,layout:{generation:'existing'}}])test('active standalone receipt blocks TFC preparation: '+JSON.stringify(state),t=>{
 const game=fixture(t),file=path.join(game,'LID-Mod-State/state.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(state));
 assert.throws(()=>preflight.prepare(game,'guard'),/standalone patches/);
 assert.throws(()=>require('../runtime/tfc-layout-repair').repair(game,{running:()=>{}}),/standalone patches/);
 assert.throws(()=>api.finishRemoval(game,'guard',{running:()=>{}}),/Active standalone/);
 assert.deepEqual(JSON.parse(fs.readFileSync(file)),state);
});
test('standalone operation lock blocks TFC preparation, layout repair and native writes',t=>{
 const game=fixture(t),file=path.join(game,'LID-Mod-State/operation.lock');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'sentinel');
 assert.throws(()=>preflight.prepare(game,'guard'),/Standalone operation/);
 assert.throws(()=>require('../runtime/tfc-layout-repair').repair(game,{running:()=>{}}),/Standalone operation/);
 assert.throws(()=>api.change(game,api.empty(),{running:()=>{}}),/Standalone operation/);
 assert.throws(()=>api.finishRemoval(game,'all',{running:()=>{}}),/Standalone operation/);
 assert.equal(fs.readFileSync(file,'utf8'),'sentinel');
});

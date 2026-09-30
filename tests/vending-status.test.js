'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),script=path.join(root,'lid-tengoku-warp.js');
function load(){
 const context=vm.createContext({require:createRequire(script),__dirname:root,Buffer,process,console});
 vm.runInContext(fs.readFileSync(script,'utf8').split('\nmain().catch')[0]+`
 globalThis.api={readStatus,identifyNativeExecutable,setPatchState,
 simulate:status=>{selectBuild=()=>{};readStatus=()=>status;isGameRunning=()=>false;createBackup=()=>{throw Error('Unexpected write preparation');};manifest.releaseStatus='static-verified-awaiting-gameplay';}};`,context);
 return context.api;
}
function status(coherent=true){return {coherent,brgGame:{enabled:true,foreignPatch:'vending'},executable:{native:{enabled:true,foreignPatch:'vending'}}};}
test('verified vending + warp reapply is a no-op, removal refuses before backup/write',()=>{
 const api=load(),s=status();api.simulate(s);
 assert.equal(api.setPatchState('unused',true,true).changed,false);
 assert.throws(()=>api.setPatchState('unused',false),/자판기|vending/);
});
test('incoherent or half-recognized vending combinations cannot bypass checks',()=>{
 for(const s of [status(false),{...status(),brgGame:{enabled:null}}, {...status(),executable:{native:{enabled:null}}}]){
  const api=load();api.simulate(s);assert.throws(()=>api.setPatchState('unused',true,true),/자판기|vending/);
 }
});
const game='C:/Program Files (x86)/Steam/steamapps/common/LET IT DIE';
test('reported live vending combination is recognized read-only with genuine hash links',{
 skip:!fs.existsSync(path.join(game,'Binaries/Win64/BrgGame-Steam.exe')) ||
 require('node:crypto').createHash('sha1').update(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole/BrgGame.upk'))).digest('hex')!=='2bb216a499ae494c1f94dad9ae3ff63b393df1d4'
},()=>{
 const api=load(),s=api.readStatus(game);
 assert.equal(s.coherent,true);assert.equal(s.brgGame.foreignPatch,'vending');assert.equal(s.executable.native.foreignPatch,'vending');assert.equal(s.executable.valid,true);
 const file=path.join(game,'Binaries/Win64/BrgGame-Steam.exe'),original=fs.readFileSync(file),changed=Buffer.from(original);changed[0x1000]^=1;
 assert.equal(api.identifyNativeExecutable(changed).enabled,null);
 api.simulate(s);assert.equal(api.setPatchState('unused',true,true).changed,false);
 assert.deepEqual(fs.readFileSync(file),original);
});

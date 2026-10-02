'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),script=path.join(root,'lid-tengoku-warp.js'),sites=require('../native-sites');
const manifest=require('../assets/manifest-25386710.json');
const fixture=path.join(root,'../lid-justguard-tool/.integration-temp/guard25386710-test-iuKM3H/game/Binaries/Win64/BrgGame-Steam.exe');
function api(){const ctx=vm.createContext({require:createRequire(script),__dirname:root,Buffer,process,console});vm.runInContext(fs.readFileSync(script,'utf8').split('\nmain().catch')[0]+'\nmanifest=JSON.parse(require("fs").readFileSync(require("path").join(__dirname,"assets/manifest-25386710.json")));globalThis.api={identifyNativeExecutable,makeExecutableTemp,resolveGameInput,chooseGameDirectory};',ctx);return ctx.api;}
test('unrelated EXE bytes survive native apply and removal without full-file hash match',{skip:!fs.existsSync(fixture)},()=>{
 const stock=fs.readFileSync(fixture),foreign=Buffer.from(stock);foreign[0x100000]^=1;
 const a=api(),state=a.identifyNativeExecutable(foreign);assert.equal(state.enabled,false);assert.equal(state.validation,'patch-sites');
 const en=sites.parsePatch(fs.readFileSync(path.join(root,'assets',manifest.executable.native.enablePatch)));
 const patched=Buffer.alloc(en.size);foreign.copy(patched);for(const e of en.entries)e.bytes.copy(patched,e.offset);
 assert.equal(patched[0x100000],foreign[0x100000]);assert.equal(a.identifyNativeExecutable(patched).enabled,true);
 const off=sites.parsePatch(fs.readFileSync(path.join(root,'assets',manifest.executable.native.disablePatch)));
 const restored=Buffer.alloc(off.size);patched.copy(restored);for(const e of off.entries)e.bytes.copy(restored,e.offset);
 assert.deepEqual(restored,foreign);assert.deepEqual(fs.readFileSync(fixture),stock);
 const os=require('node:os'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lid-native-preserve-'));
 try{
  const source=path.join(tmp,'source.exe'),on=path.join(tmp,'on.exe'),again=path.join(tmp,'again.exe'),offPath=path.join(tmp,'off.exe');fs.writeFileSync(source,foreign);
  const hashes={};for(const name of Object.keys(manifest.executable.manifestEntries)){const at=foreign.indexOf(Buffer.from(name+'\0'))+name.length+1;hashes[name]=foreign.subarray(at,at+20).toString('hex').toUpperCase();}
  a.makeExecutableTemp(source,hashes,on,true);assert.equal(fs.readFileSync(on)[0x100000],foreign[0x100000]);
  a.makeExecutableTemp(on,hashes,again,true);assert.deepEqual(fs.readFileSync(again),fs.readFileSync(on));
  a.makeExecutableTemp(on,hashes,offPath,false);assert.deepEqual(fs.readFileSync(offPath),foreign);
  assert.deepEqual(fs.readFileSync(source),foreign);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('hook collisions, altered native tail, changed PE sections and overlays are rejected',{skip:!fs.existsSync(fixture)},()=>{
 const stock=fs.readFileSync(fixture),a=api();
 for(const at of [12781095,17340727,18929002,0x3c]){const b=Buffer.from(stock);b[at]^=1;assert.equal(a.identifyNativeExecutable(b).enabled,null);}
 assert.equal(a.identifyNativeExecutable(Buffer.concat([stock,Buffer.from('foreign overlay')])).enabled,null);
 const p=sites.parsePatch(fs.readFileSync(path.join(root,'assets',manifest.executable.native.enablePatch))),b=Buffer.alloc(p.size);stock.copy(b);for(const e of p.entries)e.bytes.copy(b,e.offset);b[b.length-1]^=1;assert.equal(a.identifyNativeExecutable(b).enabled,null);
});
test('EXE path resolution and invalid manual-path retry',async()=>{
 const os=require('node:os'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lid-path-prompt-'));try{
  for(const item of [manifest.brgGame,manifest.heavenEntry,manifest.brgStart,manifest.executable]){const file=path.join(tmp,item.relativePath);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');}
  const a=api(),exe=path.join(tmp,manifest.executable.relativePath);assert.equal(a.resolveGameInput('"'+exe+'"')[0],tmp);
  const answers=['not-a-real-installation','"'+exe+'"'],prompts=[];
  const selected=await a.chooseGameDirectory({question:async q=>{prompts.push(q);return answers.shift();}},path.join(tmp,'missing'),true);
  assert.equal(selected,tmp);assert.equal(prompts.length,2);
  await assert.rejects(()=>a.chooseGameDirectory({question:async()=>''},path.join(tmp,'missing'),true),/cancelled|취소/);
  await assert.rejects(()=>a.chooseGameDirectory(null,path.join(tmp,'missing'),false),/not found|찾지/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

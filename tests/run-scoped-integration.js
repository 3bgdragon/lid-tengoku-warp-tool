'use strict';
// Source is read-only. All modifications are restricted to a newly created
// .integration-temp fixture. Never run this script as an installer.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const {createRequire}=require('module');
const repo=path.resolve(__dirname,'..'),script=path.join(repo,'lid-tengoku-warp.js');
const temporary=path.join(repo,'.integration-temp');fs.mkdirSync(temporary,{recursive:true});
const root=fs.mkdtempSync(path.join(temporary,'scoped-warp-'));
if(!process.argv[2])throw Error('Usage: node tests/run-scoped-integration.js DISPOSABLE_MANAGER_FASTER_DROPS_FIXTURE');
const source=path.resolve(process.argv[2]);
const files=['BrgGame/CookedPCConsole/BrgGame.upk','BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk','BrgGame/CookedPCConsole/BrgStart_PL.upk','Binaries/Win64/BrgGame-Steam.exe'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=files.map(f=>sha(fs.readFileSync(path.join(source,f))));
const game=path.join(root,'game');for(const f of files){fs.mkdirSync(path.dirname(path.join(game,f)),{recursive:true});fs.copyFileSync(path.join(source,f),path.join(game,f));}
const ctx=vm.createContext({require:createRequire(script),__dirname:repo,Buffer,process,console,testBackup:path.join(root,'backups')});
vm.runInContext(fs.readFileSync(script,'utf8').split('main().catch(')[0]+'\nisGameRunning=()=>false;backupRoot=()=>testBackup;globalThis.api={readStatus,setPatchState};',ctx);
const codec=require(path.join(repo,'compat/scoped-package')),plan=require(path.join(repo,'assets/scoped-warp-25386710.json'));
function verifyForeign(original,current){
 const a=codec.reader(original),b=codec.reader(current),owned=codec.inspect(original,plan).objects;
 assert.equal(a.table.length,b.table.length);
 let compared=0;
 for(let i=0;i<a.table.length;i++){
  assert.deepEqual(a.table[i].slice(0,2),b.table[i].slice(0,2));
  const [start,size,physical,length]=a.table[i],after=b.table[i];
  if(original.subarray(physical,physical+length).equals(current.subarray(after[2],after[2]+after[3])))continue;
  const expected=Buffer.from(a.chunk(i));
  for(const o of owned)for(const edit of o.definition.edits){const absolute=o.offset+edit;if(absolute>=start&&absolute<start+size)expected[absolute-start]=b.read(absolute,1)[0];}
  assert.deepEqual(b.chunk(i),expected,'Foreign logical bytes changed in chunk '+i);compared++;
 }
 return compared;
}
const original=fs.readFileSync(path.join(game,files[0]));
assert.equal(ctx.api.readStatus(game).brgGame.profile.scoped,true);
// A scoped profile has no synthetic whole-file hashes. Do not derive its state
// from the map and accidentally conceal a partial/mismatched installation.
const partial=codec.set(original,true,plan);writePair(partial);
const partialStatus=ctx.api.readStatus(game);assert.equal(partialStatus.brgGame.enabled,true);assert.equal(partialStatus.heavenEntry.enabled,false);assert.equal(partialStatus.coherent,false);
writePair(original);
const exeFile=path.join(game,files[3]),linkedExe=fs.readFileSync(exeFile),badLink=Buffer.from(linkedExe),digestAt=badLink.indexOf(Buffer.from('brggame.upk\0'))+12;
badLink[digestAt]^=1;fs.writeFileSync(exeFile,badLink);
const mismatchBefore=files.map(f=>sha(fs.readFileSync(path.join(game,f))));
assert.throws(()=>ctx.api.setPatchState(game,true,true),/digest links|해시 연결/);
assert.deepEqual(files.map(f=>sha(fs.readFileSync(path.join(game,f)))),mismatchBefore);fs.writeFileSync(exeFile,linkedExe);
const applied=ctx.api.setPatchState(game,true,true);assert.equal(applied.status.coherent,true);
const on=fs.readFileSync(path.join(game,files[0]));const changedChunks=verifyForeign(original,on);
assert.equal(ctx.api.setPatchState(game,true,true).changed,false);
const removed=ctx.api.setPatchState(game,false,true);assert.equal(removed.status.coherent,true);
const off=fs.readFileSync(path.join(game,files[0]));verifyForeign(original,off);
assert.deepEqual(off,original,'Removal without later edits must preserve the manager original byte-for-byte');
assert.deepEqual(files.map(f=>sha(fs.readFileSync(path.join(game,f)))),before,'All original manager file hashes must match after removal');
const originalReader=codec.reader(original),offReader=codec.reader(off);
for(let i=0;i<originalReader.table.length;i++)assert.deepEqual(originalReader.read(originalReader.table[i][0],originalReader.table[i][1]),offReader.read(offReader.table[i][0],offReader.table[i][1]));
// Simulate a non-owned instruction changed *after* warp, including when it is
// in the same function. This deliberately does not bypass the manager's EXE
// policy or claim that the manager itself permits that reverse order.
ctx.api.setPatchState(game,true,true);
const active=fs.readFileSync(path.join(game,files[0])),owner=codec.inspect(active,plan).objects[0];
const modified=Buffer.from(owner.bytes);assert.equal(modified[23626],0);modified[23626]=0x40;
const side=bytes=>({size:bytes.length,sha256:codec.sha(bytes),base64:bytes.toString('base64')});
const foreignPlan={exportCount:plan.exportCount,objects:[{index:owner.p.index,metadata:owner.p.metadata,off:side(owner.bytes),on:side(modified)}]};
const external=codec.set(active,true,foreignPlan);
function writePair(upk){
 const exeFile=path.join(game,files[3]),exe=fs.readFileSync(exeFile),digest=crypto.createHash('sha1').update(upk).digest(),needle=Buffer.from('brggame.upk\0');let at=0,count=0;
 while((at=exe.indexOf(needle,at))>=0){at+=needle.length;digest.copy(exe,at);count++;}assert.equal(count,2);
 fs.writeFileSync(path.join(game,files[0]),upk);fs.writeFileSync(exeFile,exe);
}
writePair(external);ctx.api.setPatchState(game,false,true);
const laterRemoval=fs.readFileSync(path.join(game,files[0]));verifyForeign(external,laterRemoval);assert.equal(codec.inspect(laterRemoval,plan).objects[0].bytes[23626],0x40);
// Actual owned-instruction conflict must refuse before changing any file.
const currentOwner=codec.inspect(laterRemoval,plan).objects[0],conflict=Buffer.from(currentOwner.bytes);
conflict[currentOwner.definition.edits[0]]=0xff;
const conflictPlan={exportCount:plan.exportCount,objects:[{index:currentOwner.p.index,metadata:currentOwner.p.metadata,off:side(currentOwner.bytes),on:side(conflict)}]};
writePair(codec.set(laterRemoval,true,conflictPlan));
const conflictBefore=files.map(f=>sha(fs.readFileSync(path.join(game,f))));
assert.throws(()=>ctx.api.setPatchState(game,true,true),/changed by another mod/);
assert.deepEqual(files.map(f=>sha(fs.readFileSync(path.join(game,f)))),conflictBefore);
assert.deepEqual(files.map(f=>sha(fs.readFileSync(path.join(source,f)))),before);
const result={manager:'1.3.20',fasterDrops:true,apply:true,idempotent:true,remove:true,managerOriginalRestoredExactly:true,foreignLogicalDataPreserved:true,laterForeignEditPreserved:true,partialStateDetected:true,digestMismatchBlocksWrites:true,ownedConflictBlocksAllWrites:true,changedChunks,sourceUnchanged:true,game};
fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

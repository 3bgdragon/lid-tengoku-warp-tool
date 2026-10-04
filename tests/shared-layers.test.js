'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const s=require('../shared/layers');
function fixture(t){const game=fs.mkdtempSync(path.join(os.tmpdir(),'lid-layer-test-'));t.after(()=>{assert.equal(path.dirname(game),path.resolve(os.tmpdir()));assert.match(path.basename(game),/^lid-layer-test-/);fs.rmSync(game,{recursive:true,force:true});});s.FILES.forEach((f,i)=>{const p=path.join(game,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'file-'+i);});return game;}
const opts={checkRunning:()=>false};
for(const marker of ['state.json','pending.json','layout-pending.json','operation.lock'])test('TFC marker blocks standalone writes and snapshot restore: '+marker,t=>{
 const game=fixture(t),file=path.join(game,'LID-TFC-State',marker);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'sentinel');
 assert.throws(()=>s.transact(game,'test',()=>{throw Error('must not stage');},opts),/TFC/);
 assert.throws(()=>s.restore(game,'unused',opts),/TFC/);
 s.FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(game,f),'utf8'),'file-'+i));assert.equal(fs.readFileSync(file,'utf8'),'sentinel');
});
test('staged no-op leaves all files intact and creates no backup',t=>{
 const game=fixture(t);assert.equal(s.transact(game,'test',()=>({result:'ok'}),opts).changed,false);assert.deepEqual(s.backups(game),[]);
 s.FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(game,f),'utf8'),'file-'+i));
});
test('staging exception leaves game unchanged and releases only its own lock',t=>{
 const game=fixture(t);assert.throws(()=>s.transact(game,'test',stage=>{fs.writeFileSync(path.join(stage,s.FILES[0]),'staged');throw Error('test error');},opts),/test error/);
 assert.equal(fs.readFileSync(path.join(game,s.FILES[0]),'utf8'),'file-0');assert.equal(fs.existsSync(path.join(s.stateRoot(game),'operation.lock')),false);
 assert.deepEqual(fs.readdirSync(path.join(s.stateRoot(game),'staging')),[]);
});
test('overlapping operation refuses an existing lock without deleting it',t=>{
 const game=fixture(t),lock=path.join(s.stateRoot(game),'operation.lock');fs.mkdirSync(s.stateRoot(game));fs.writeFileSync(lock,'other');
 assert.throws(()=>s.transact(game,'test',()=>({}),opts),/EEXIST/);assert.equal(fs.readFileSync(lock,'utf8'),'other');
});
test('post-stage external changes are never overwritten',t=>{
 const game=fixture(t),target=path.join(game,s.FILES[0]);assert.throws(()=>s.transact(game,'test',stage=>{fs.writeFileSync(path.join(stage,s.FILES[0]),'desired');fs.writeFileSync(target,'foreign');return {};},opts),/changed|변경/);
 assert.equal(fs.readFileSync(target,'utf8'),'foreign');
});
test('no-op still detects intervening game changes',t=>{
 const game=fixture(t),target=path.join(game,s.FILES[0]);assert.throws(()=>s.transact(game,'test',()=>{fs.writeFileSync(target,'foreign');return {};},opts),/no-op verification/);
 assert.equal(fs.readFileSync(target,'utf8'),'foreign');
});
test('snapshot restoration is exact, but later changes block whole restore',t=>{
 const game=fixture(t),target=path.join(game,s.FILES[0]);const tx=s.transact(game,'test',stage=>{fs.writeFileSync(path.join(stage,s.FILES[0]),'desired');return {};},opts);
 assert.equal(fs.readFileSync(target,'utf8'),'desired');fs.writeFileSync(target,'foreign');assert.throws(()=>s.restore(game,tx.backup,opts),/later changes|이후 변경/);assert.equal(fs.readFileSync(target,'utf8'),'foreign');
 fs.writeFileSync(target,'desired');const restored=s.restore(game,tx.backup,opts);assert.ok(restored.safetyBackup);assert.equal(fs.readFileSync(target,'utf8'),'file-0');
});
test('database recovery sidecars and running games block composition',t=>{
 const game=fixture(t);assert.throws(()=>s.transact(game,'test',()=>({}),{checkRunning:()=>true}),/Close|종료/);
 fs.writeFileSync(path.join(game,s.FILES[5])+'-wal','recovery');assert.throws(()=>s.transact(game,'test',()=>({}),opts),/DB/);
});
test('malformed receipt cannot escape generation folder',t=>{
 const game=fixture(t);fs.mkdirSync(s.stateRoot(game));fs.writeFileSync(path.join(s.stateRoot(game),'state.json'),JSON.stringify({format:1,active:true,generation:'../../elsewhere',before:[],after:[],config:{}}));
 assert.throws(()=>s.view(game,()=>{}),/receipt|기록/);assert.deepEqual(fs.readdirSync(path.join(s.stateRoot(game),'staging')),[]);
});
test('partial installation failure restores already-installed files',t=>{
 const game=fixture(t),rename=fs.renameSync;let injected=false;
 fs.renameSync=function(from,to){if(to===path.join(game,s.FILES[1])&&!injected){injected=true;throw Error('injected second-file failure');}return rename.apply(this,arguments);};
 try{assert.throws(()=>s.transact(game,'test',stage=>{fs.writeFileSync(path.join(stage,s.FILES[0]),'new-0');fs.writeFileSync(path.join(stage,s.FILES[1]),'new-1');return {};},opts),/injected/);}finally{fs.renameSync=rename;}
 assert.equal(injected,true);s.FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(game,f),'utf8'),'file-'+i));
 assert.equal(fs.existsSync(path.join(s.stateRoot(game),'operation.lock')),false);
 assert.equal(fs.readdirSync(path.dirname(path.join(game,s.FILES[1]))).some(n=>n.includes('.lid-compose-')),false);
});
test('receipt write failure rolls back game files and retains the prepared backup',t=>{
 const game=fixture(t),rename=fs.renameSync;let injected=false;
 fs.renameSync=function(from,to){if(to===path.join(s.stateRoot(game),'state.json')&&!injected){injected=true;throw Error('injected receipt failure');}return rename.apply(this,arguments);};
 try{assert.throws(()=>s.transact(game,'test',stage=>{fs.writeFileSync(path.join(stage,s.FILES[0]),'new');return {};},opts),/injected/);}finally{fs.renameSync=rename;}
 assert.equal(injected,true);assert.equal(fs.readFileSync(path.join(game,s.FILES[0]),'utf8'),'file-0');
 const backups=s.backups(game);assert.equal(backups.length,1);assert.equal(JSON.parse(fs.readFileSync(path.join(backups[0],'manifest.json'))).status,'prepared');
 assert.equal(fs.existsSync(path.join(s.stateRoot(game),'operation.lock')),false);
});
for(const phase of ['staging','first-file'])test('hard process exit at '+phase+' retains evidence and blocks blind retry',t=>{
 const game=fixture(t),script=require.resolve('../shared/layers');
 const code=`const fs=require('fs'),s=require(${JSON.stringify(script)}),path=require('path');const game=${JSON.stringify(game)};const rename=fs.renameSync;if(${JSON.stringify(phase)}==='first-file')fs.renameSync=function(a,b){rename.apply(this,arguments);if(b===path.join(game,s.FILES[0]))process.exit(77);};s.transact(game,'crash-test',stage=>{fs.writeFileSync(path.join(stage,s.FILES[0]),'new-0');fs.writeFileSync(path.join(stage,s.FILES[1]),'new-1');if(${JSON.stringify(phase)}==='staging')process.exit(77);return {};},{checkRunning:()=>false});`;
 const child=require('node:child_process').spawnSync(process.execPath,['-e',code],{windowsHide:true,timeout:10000});assert.equal(child.status,77);
 const expected=phase==='staging'?'file-0':'new-0';assert.equal(fs.readFileSync(path.join(game,s.FILES[0]),'utf8'),expected);assert.equal(fs.readFileSync(path.join(game,s.FILES[1]),'utf8'),'file-1');
 const lock=path.join(s.stateRoot(game),'operation.lock');assert.equal(fs.existsSync(lock),true);
 assert.throws(()=>s.transact(game,'retry',()=>({}),opts),/EEXIST/);assert.equal(fs.readFileSync(path.join(game,s.FILES[0]),'utf8'),expected);assert.equal(fs.existsSync(lock),true);
 if(phase==='first-file'){const backups=s.backups(game);assert.equal(backups.length,1);assert.equal(JSON.parse(fs.readFileSync(path.join(backups[0],'manifest.json'))).status,'prepared');s.FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(backups[0],'original-'+i),'utf8'),'file-'+i));}
});
test('tampered owned material row aborts removal and rolls back earlier deletions',t=>{
 const {DatabaseSync}=require('node:sqlite'),game=fixture(t),file=path.join(game,s.FILES[5]);fs.unlinkSync(file);
 const db=new DatabaseSync(file);db.exec('CREATE TABLE master_automaticshop_lineup(goods_id INTEGER PRIMARY KEY, price INTEGER)');const insert=db.prepare('INSERT INTO master_automaticshop_lineup VALUES (?,?)');for(let i=0;i<106;i++)insert.run(1900000000+i,100);db.close();
 const rows=s.materialRows(game),change=new DatabaseSync(file);change.exec('UPDATE master_automaticshop_lineup SET price=999 WHERE goods_id=1900000005');change.close();
 const before=fs.readFileSync(file);assert.throws(()=>s.removeMaterials(game,{rows}),/Material row changed/);assert.deepEqual(fs.readFileSync(file),before);assert.equal(s.materialRows(game).length,106);
});

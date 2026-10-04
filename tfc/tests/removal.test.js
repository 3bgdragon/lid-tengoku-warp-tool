'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const api=require('../runtime/tfc-companion'),owned=require('../runtime/owned-functions');
const links=require('../runtime/kernel/src/executable-links');
const source=process.env.LID_TFC_REMOVAL_SOURCE,opt={running:()=>{}};
const mods=['guard','warp','m2g','vending'];
const packageFiles=Object.values(links.PACKAGES).map(([f])=>'BrgGame/CookedPCConsole/'+f);
// Source: all four installed and recorded, then TFC's original UPKs restored.
// Only disposable fixture copies may be changed by these integration tests.
function fixture(t){
 const root=path.resolve(process.env.LID_TFC_TEST_ROOT||os.tmpdir());fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'tfc-removal-')),game=path.join(dir,'game');
 for(const f of [api.EXE,api.DB,...packageFiles]){const dest=path.join(game,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,f),dest);}
 fs.cpSync(path.join(source,'LID-TFC-State'),path.join(game,'LID-TFC-State'),{recursive:true});
 const save=path.join(game,'Savedata','fixture');fs.mkdirSync(path.dirname(save),{recursive:true});fs.writeFileSync(save,'save must remain untouched');
 assert.deepEqual(api.readState(game).config,{warp:true,vending:true});
 assert(api.readState(game).rows.length>0);
 assert(states(game).every(p=>p.preset==='off'));
 t.after(()=>{
  assert.equal(fs.readFileSync(save,'utf8'),'save must remain untouched');
  assert.equal(path.dirname(dir),root);assert(path.basename(dir).startsWith('tfc-removal-'));
  fs.rmSync(dir,{recursive:true,force:true});
 });
 return game;
}
function states(game){
 return mods.flatMap(mod=>[...new Set(owned.catalog.objects.filter(p=>p.mod===mod).map(p=>p.file))].map(file=>({mod,file,preset:owned.inspect(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',file)),mod,file)})));
}
function hashes(game,files){return files.map(f=>api.sha(fs.readFileSync(path.join(game,f))));}
function blocked(game,action,pattern){
 const files=[api.EXE,api.DB,...packageFiles,'LID-TFC-State/state.json'],before=hashes(game,files);
 assert.throws(action,pattern);assert.deepEqual(hashes(game,files),before,'Rejected operation overwrote game/state');
 assert.equal(fs.existsSync(path.join(game,'LID-TFC-State/pending.json')),false);
}
function set(game,mod,file,preset){const f=path.join(game,'BrgGame/CookedPCConsole',file);fs.writeFileSync(f,owned.set(fs.readFileSync(f),mod,file,preset));}
function updateState(game,edit){const f=path.join(game,'LID-TFC-State/state.json'),r=JSON.parse(fs.readFileSync(f));edit(r);fs.writeFileSync(f,JSON.stringify(r));}
function checkedOff(b){
 for(const [name,[,count]] of Object.entries(links.PACKAGES))for(const e of links.digestEntries(b,name,count))b[e.offset-2]='X'.charCodeAt(0);
 return b;
}
function assertFinished(game,upks){
 const state=api.readState(game);assert.deepEqual(state.config,api.empty());assert.equal(state.rows.length,0);
 assert.deepEqual(state.upkSettings,states(game));assert(state.upkSettings.every(p=>p.preset==='off'));
 assert.deepEqual(hashes(game,packageFiles),upks,'Removal companion rewrote UPKs');
 links.validatePackageLinks(fs.readFileSync(path.join(game,api.EXE)),game);
}
for(const mod of mods)test('full TFC uninstall finalizes through '+mod+' launcher, preserving foreign EXE/DB and OFF checks',{skip:!source},t=>{
 const game=fixture(t),exe=path.join(game,api.EXE),b=checkedOff(fs.readFileSync(exe));b[0x1000]^=1;fs.writeFileSync(exe,b);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(game,api.DB));
 const foreign=db.prepare('SELECT goods_id,pack_money FROM master_automaticshop_lineup WHERE goods_id<1900000000 LIMIT 1').get();assert(foreign);
 db.prepare('UPDATE master_automaticshop_lineup SET pack_money=? WHERE goods_id=?').run(foreign.pack_money+1,foreign.goods_id);db.close();
 const upks=hashes(game,packageFiles),cli=path.resolve(__dirname,'../runtime/tfc-cli');
 const code=`process.argv=[process.execPath,${JSON.stringify(['warp','vending'].includes(mod)?'off':'removed')},'--game',${JSON.stringify(game)},'--yes','--json'];require(${JSON.stringify(cli)}).main(${JSON.stringify(mod)}).catch(e=>{console.error(e);process.exitCode=1});`;
 const r=spawnSync(process.execPath,['-e',code],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr);
 const result=JSON.parse(r.stdout);assert.equal(result.removedAll,true);assert.equal(result.changed,true);
 assertFinished(game,upks);assert.equal(fs.readFileSync(exe)[0x1000],b[0x1000]);
 for(const [name,[,count]] of Object.entries(links.PACKAGES))assert(links.digestEntries(fs.readFileSync(exe),name,count).every(e=>!e.checked));
 const probe=new DatabaseSync(path.join(game,api.DB),{readOnly:true});
 assert.equal(probe.prepare('SELECT pack_money FROM master_automaticshop_lineup WHERE goods_id=?').get(foreign.goods_id).pack_money,foreign.pack_money+1);
 assert.equal(probe.prepare('SELECT count(*) n FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000').get().n,0);probe.close();
 assert.equal(api.finishRemoval(game,mod,opt).changed,false);
 assert.equal(api.detach(game,opt).detached,true);
});
test('full loss is not silently accepted by ordinary change/relink; explicit off-all works',{skip:!source},t=>{
 const game=fixture(t),upks=hashes(game,packageFiles);
 blocked(game,()=>api.change(game,api.empty(),opt),/changed\/lost/);
 assert.equal(api.finishRemoval(game,'all',opt).removedAll,true);assertFinished(game,upks);
});
test('missing legacy UPK receipts still require all four OFF, and reject invalid receipts',{skip:!source},t=>{
 const game=fixture(t);
 updateState(game,r=>{r.upkSettings.push({...r.upkSettings[0]});});
 blocked(game,()=>api.finishRemoval(game,'guard',opt),/Invalid UPK settings receipt/);
 updateState(game,r=>{delete r.upkSettings;});
 set(game,'m2g','BrgGame.upk','on');
 blocked(game,()=>api.finishRemoval(game,'all',opt),/still installed/);
 set(game,'m2g','BrgGame.upk','off');
 const upks=hashes(game,packageFiles);assert.equal(api.finishRemoval(game,'guard',opt).removedAll,true);assertFinished(game,upks);
});
test('partial loss and removing an active component remain blocked',{skip:!source},t=>{
 const game=fixture(t);set(game,'m2g','BrgGame.upk','on');
 blocked(game,()=>api.finishRemoval(game,'m2g',opt),/still installed/);
 blocked(game,()=>api.finishRemoval(game,'all',opt),/still installed/);
 blocked(game,()=>api.finishRemoval(game,'guard',opt),/changed\/lost/);
});
test('normal selective guard removal preserves active vending native component and catalog',{skip:!source},t=>{
 const game=fixture(t);set(game,'vending','BrgGame.upk','all-en');
 // Retain the already installed native vending component, with matching UPKs.
 const exe=path.join(game,api.EXE),record=api.readState(game),base=fs.readFileSync(path.join(game,'LID-TFC-State/bases',record.baseHash));
 const packages=Object.fromEntries(Object.values(links.PACKAGES).map(([f])=>[f,fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',f))]));
 fs.writeFileSync(exe,api.relink(api.compose(base,{warp:false,vending:true}),packages));
 updateState(game,r=>{r.config.warp=false;r.upkSettings=states(game);for(const s of r.upkSettings)if(s.mod==='guard')s.preset=s.file==='BrgGame.upk'?'on-on':'soft';});
 const rows=api.readState(game).rows,db=fs.readFileSync(path.join(game,api.DB)),upks=hashes(game,packageFiles);
 const result=api.finishRemoval(game,'guard',opt);assert.equal(result.removedAll,false);
 assert.deepEqual(api.readState(game).config,{warp:false,vending:true});assert.deepEqual(api.readState(game).rows,rows);
 assert.deepEqual(fs.readFileSync(path.join(game,api.DB)),db);assert.deepEqual(hashes(game,packageFiles),upks);
 assert.equal(api.finishRemoval(game,'guard',opt).changed,false);
});
for(const point of ['prepared','exe','db'])test('complete removal interruption at '+point+' recovers before-state and permits retry',{skip:!source},t=>{
 const game=fixture(t),files=[api.EXE,api.DB,...packageFiles,'LID-TFC-State/state.json'],before=hashes(game,files),upks=hashes(game,packageFiles);
 assert.throws(()=>api.finishRemoval(game,'guard',{...opt,failpoint:p=>{if(p===point)throw Error('injected removal failure');}}),/recover/);
 assert.throws(()=>api.finishRemoval(game,'guard',opt),/recover/);
 api.recover(game,opt);assert.deepEqual(hashes(game,files),before);
 assert.equal(api.finishRemoval(game,'guard',opt).removedAll,true);assertFinished(game,upks);
});
test('complete removal still rejects native conflicts, changed catalog, journals and transaction locks',{skip:!source},t=>{
 const game=fixture(t),exe=path.join(game,api.EXE),before=fs.readFileSync(exe),record=api.readState(game),base=fs.readFileSync(path.join(game,'LID-TFC-State/bases',record.baseHash));
 const at=before.findIndex((v,i)=>i<base.length&&v!==base[i]&&i>0x1000);assert(at>=0);
 const b=Buffer.from(before);b[at]^=1;fs.writeFileSync(exe,b);blocked(game,()=>api.finishRemoval(game,'guard',opt),/Owned native/);fs.writeFileSync(exe,before);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(game,api.DB));
 const row=record.rows[0];db.prepare('UPDATE master_automaticshop_lineup SET pack_money=? WHERE goods_id=?').run(row.pack_money+1,row.goods_id);db.close();
 blocked(game,()=>api.finishRemoval(game,'guard',opt),/Owned material/);
 const lock=path.join(game,'LID-TFC-State/operation.lock');fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
 blocked(game,()=>api.finishRemoval(game,'guard',opt),/EEXIST/);fs.unlinkSync(lock);
 const journal=path.join(game,api.DB)+'-journal';fs.writeFileSync(journal,'open');
 blocked(game,()=>api.finishRemoval(game,'guard',opt),/SQLite is open/);fs.unlinkSync(journal);
});

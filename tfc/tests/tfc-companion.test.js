'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const api=require('../runtime/tfc-companion');
const links=require('../runtime/kernel/src/executable-links');
function mock(){const b=Buffer.alloc(2048);let at=200;for(const [name,[,count]] of Object.entries(links.PACKAGES))for(let i=0;i<count;i++){b.write(name+'\0',at);at+=name.length+21;}return b;}
test('TFC native merge preserves unrelated bytes and ignores only hash links',()=>{
 const base=mock(),expected=Buffer.from(base);expected[20]=7;
 const current=Buffer.from(expected);current[40]=9;
 for(const at of links.digestOffsets(current,'brggame.upk',2))current.fill(8,at,at+20);
 const merged=api.reconcile(base,expected,current);assert.equal(merged[40],9);assert.equal(merged[20],0);
 current[20]=8;assert.throws(()=>api.reconcile(base,expected,current),/Owned native/);
 assert.throws(()=>api.reconcile(base,expected,Buffer.concat([expected,Buffer.alloc(1)])),/size/);
});
const source=process.env.LID_TFC_TEST_SOURCE;
function fixture(t){
 const root=path.resolve(__dirname,'../.integration-temp');fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'tfc-native-')),game=path.join(dir,'game');
 const names=[api.EXE,...Object.values(links.PACKAGES).map(([f])=>'BrgGame/CookedPCConsole/'+f)];
 for(const f of names){const dst=path.join(game,f);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(source,f),dst);}
 const {DatabaseSync}=require('node:sqlite'),file=path.join(game,api.DB);fs.mkdirSync(path.dirname(file),{recursive:true});const db=new DatabaseSync(file);
 const row={goods_id:1,lineup_id:'COMMON',entity_type:'ITEM',type_id:'ITMT_ALUMI_1',is_stable:0,freq:1,is_special:0,display_priority:100,currency_type:0,stock:1,pack_count:5,pack_money:10000,pack_metal:0,pack_recycle_point:0,pack_bloodnium:0,money_discount_rate:0,metal_discount_rate:0,recycle_point_discount_rate:0,bloodnium_discount_rate:0};
 db.exec('CREATE TABLE master_item(itemid TEXT,itemtype TEXT,rarity INTEGER); CREATE TABLE master_automaticshop_lineup ('+Object.entries(row).map(([k,v])=>k+' '+(typeof v==='number'?'INTEGER':'TEXT')).join(',')+');');
 db.prepare('INSERT INTO master_item VALUES (?,?,?)').run('ITMT_ALUMI_1','ITTP_MATERIAL',1);db.close();
 const snapshots=Object.fromEntries(names.slice(1).map(f=>[f,api.sha(fs.readFileSync(path.join(game,f)))]));
 t.after(()=>{for(const [f,hash] of Object.entries(snapshots))assert.equal(api.sha(fs.readFileSync(path.join(game,f))),hash,'UPK changed');});
 return game;
}
const opt={running:()=>{}};
test('actual TFC files: native composition, selective removal and preservation',{skip:!source},t=>{
 const game=fixture(t);api.change(game,{warp:true,vending:false},opt);api.change(game,{warp:true,vending:true},opt);
 const standalone=path.resolve(__dirname,'../../shared/layers.js');
 if(fs.existsSync(standalone))assert.throws(()=>require(standalone).receipt(game),/TFC/);
 const exe=path.join(game,api.EXE),b=fs.readFileSync(exe);b[0x1000]^=1;fs.writeFileSync(exe,b);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(game,api.DB));db.exec("INSERT INTO master_item VALUES ('ITMT_FOREIGN_1','ITTP_MATERIAL',1)");db.close();
 api.change(game,{warp:false,vending:true},opt);assert.equal(fs.readFileSync(exe)[0x1000],b[0x1000]);
 api.change(game,{warp:false,vending:false},opt);assert.equal(fs.readFileSync(exe)[0x1000],b[0x1000]);
 const probe=new DatabaseSync(path.join(game,api.DB));assert.equal(probe.prepare('SELECT count(*) n FROM master_automaticshop_lineup').get().n,0);assert.equal(probe.prepare('SELECT count(*) n FROM master_item').get().n,2);probe.close();
 links.validatePackageLinks(fs.readFileSync(exe),game);
 assert.equal(api.change(game,api.empty(),opt).changed,false);
 assert.equal(api.detach(game,opt).detached,true);assert.equal(api.readState(game),null);
});
test('actual TFC files: interrupted write recovery and previous settings restore',{skip:!source},t=>{
 const game=fixture(t),file=path.join(game,api.EXE),before=fs.readFileSync(file);
 assert.throws(()=>api.change(game,{warp:true,vending:true},{...opt,failpoint:p=>{if(p==='exe')throw Error('injected failure');}}),/recover/);
 assert.throws(()=>api.change(game,api.empty(),opt),/recover/);api.recover(game,opt);assert.deepEqual(fs.readFileSync(file),before);assert.equal(api.readState(game),null);
 api.change(game,{warp:true,vending:false},opt);api.change(game,{warp:true,vending:true},opt);api.restoreLatest(game,opt);assert.deepEqual(api.readState(game).config,{warp:true,vending:false});
});
test('actual TFC files: missing UPK prerequisite and altered owned row fail closed',{skip:!source},t=>{
 const game=fixture(t),file=path.join(game,'BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk'),map=fs.readFileSync(file);fs.writeFileSync(file,Buffer.alloc(200));
 assert.throws(()=>api.change(game,{warp:true,vending:false},opt),/package|layout|TFC/);fs.writeFileSync(file,map);
 api.change(game,{warp:false,vending:true},opt);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(game,api.DB));db.exec('UPDATE master_automaticshop_lineup SET pack_money=123 WHERE goods_id=1900000000');db.close();
 const before=fs.readFileSync(path.join(game,api.EXE));assert.throws(()=>api.change(game,api.empty(),opt),/Owned material/);assert.deepEqual(fs.readFileSync(path.join(game,api.EXE)),before);
});
test('actual TFC files: reverse native install order and hard-exit recovery',{skip:!source},t=>{
 const game=fixture(t);api.change(game,{warp:false,vending:true},opt);api.change(game,{warp:true,vending:true},opt);
 api.change(game,{warp:true,vending:false},opt);assert.deepEqual(api.readState(game).config,{warp:true,vending:false});
 const before=fs.readFileSync(path.join(game,api.EXE));
 const {spawnSync}=require('node:child_process'),modulePath=path.resolve(__dirname,'../runtime/tfc-companion');
 const result=spawnSync(process.execPath,['-e',`require(${JSON.stringify(modulePath)}).change(${JSON.stringify(game)},{warp:false,vending:false},{running:()=>{},failpoint:p=>{if(p==='exe')process.exit(77)}})`],{encoding:'utf8'});
 assert.equal(result.status,77,result.stderr);assert.throws(()=>api.change(game,api.empty(),opt),/EEXIST/);api.recover(game,opt);
 assert.deepEqual(fs.readFileSync(path.join(game,api.EXE)),before);assert.deepEqual(api.readState(game).config,{warp:true,vending:false});
});
test('actual MASTER DB copy: 106 materials and non-owned row preservation',{skip:!source||!process.env.LID_TFC_TEST_DB},t=>{
 const game=fixture(t),originalPath=process.env.LID_TFC_TEST_DB;
 for(const suffix of ['-wal','-shm','-journal'])assert.equal(fs.existsSync(originalPath+suffix),false,'Source DB must be closed');
 const original=fs.readFileSync(originalPath),file=path.join(game,api.DB);fs.writeFileSync(file,original);
 t.after(()=>assert.equal(api.sha(fs.readFileSync(originalPath)),api.sha(original),'Source DB modified'));
 const {DatabaseSync}=require('node:sqlite');let db=new DatabaseSync(file);
 // Only the disposable fixture loses existing experimental catalog rows.
 db.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000');
 const baselineCount=db.prepare('SELECT count(*) n FROM master_automaticshop_lineup').get().n;
 const foreign=db.prepare('SELECT goods_id,pack_money FROM master_automaticshop_lineup WHERE goods_id<1900000000 LIMIT 1').get();db.close();
 api.change(game,{warp:false,vending:true},opt);assert.equal(api.readState(game).rows.length,106);
 db=new DatabaseSync(file);assert.equal(db.prepare('SELECT count(*) n FROM master_automaticshop_lineup').get().n,baselineCount+106);
 db.prepare('UPDATE master_automaticshop_lineup SET pack_money=? WHERE goods_id=?').run(foreign.pack_money+1,foreign.goods_id);db.close();
 assert.throws(()=>api.restoreLatest(game,opt),/Files changed/);
 api.change(game,api.empty(),opt);db=new DatabaseSync(file);
 assert.equal(db.prepare('SELECT count(*) n FROM master_automaticshop_lineup').get().n,baselineCount);
 assert.equal(db.prepare('SELECT pack_money FROM master_automaticshop_lineup WHERE goods_id=?').get(foreign.goods_id).pack_money,foreign.pack_money+1);db.close();
});

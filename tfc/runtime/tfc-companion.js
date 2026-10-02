'use strict';
// UPKs belong to TFC. This controller never writes a UPK or a save.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const links=require('./kernel/src/executable-links');
const assets=path.join(__dirname,'tfc-assets');
const proof=require('./tfc-assets/upk-proof.json');
const native=require('./tfc-assets/native-sites');
const EXE='Binaries/Win64/BrgGame-Steam.exe',DB='BrgGame/Content/masters.db';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const config=c=>{if(!c||typeof c.warp!=='boolean'||typeof c.vending!=='boolean')throw Error('Invalid native configuration');return {warp:c.warp,vending:c.vending};};
const empty=()=>({warp:false,vending:false});
const files=game=>({exe:path.join(game,EXE),db:path.join(game,DB),root:path.join(game,'LID-TFC-State')});
function stopped(){
 if(process.platform==='win32'&&/BrgGame-Steam\.exe/i.test(execFileSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true})))throw Error('Close LET IT DIE completely. / 게임을 완전히 종료하세요.');
}
function write(file,b){fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function replace(file,b){const temp=file+'.tfc-'+crypto.randomUUID()+'.tmp';write(temp,b);try{fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function json(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function lockOperation(root,allowStale=false){
 const file=path.join(root,'operation.lock');
 if(allowStale&&fs.existsSync(file)){
  const pid=json(file).pid;if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid operation lock');
  try{process.kill(pid,0);throw Error('Another controller is running.');}catch(e){if(e.code!=='ESRCH')throw e;}
  fs.unlinkSync(file);
 }
 write(file,Buffer.from(JSON.stringify({pid:process.pid})));return file;
}
function packageBytes(game){return Object.fromEntries(Object.values(links.PACKAGES).map(([file])=>[file,fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',file))]));}
function packageHashes(bytes){return Object.fromEntries(Object.entries(bytes).map(([k,v])=>[k,sha(v)]));}
function relink(exe,packages){
 const b=Buffer.from(exe);
 for(const [name,[file,count]] of Object.entries(links.PACKAGES))for(const at of links.digestOffsets(b,name,count))crypto.createHash('sha1').update(packages[file]).digest().copy(b,at);
 return b;
}
// Read canonical TFC output regardless of its compression-directory count.
function reader(data){
 if(data.length<0x75||data.readUInt32LE()!==0x9e2a83c1||data.readUInt32LE(0x6d)!==2||data.readUInt16LE(4)!==861||data.readUInt16LE(6)!==19)throw Error('Unsupported TFC package layout');
 const count=data.readUInt32LE(0x71),table=[],cache=new Map(),decode=require('./kernel/vendor/lzo1x/dist/index.cjs').lzo1xDecompress;
 if(count<1||count>10000||0x75+count*16>data.length)throw Error('Invalid chunk table');
 for(let i=0;i<count;i++){
  const e=Array.from({length:4},(_,j)=>data.readUInt32LE(0x75+i*16+j*4));
  if(!e[1]||e[1]>64*1024*1024||e[2]<0x75+count*16||e[2]+e[3]>data.length||e[3]<16||(i&&e[0]!==table[i-1][0]+table[i-1][1]))throw Error('Invalid chunk range');table.push(e);
 }
 function chunk(i){
  if(cache.has(i))return cache.get(i);
  const [,size,at,packed]=table[i],block=data.readUInt32LE(at+4);
  if(data.readUInt32LE(at)!==0x9e2a83c1||data.readUInt32LE(at+12)!==size||!block||block>1048576)throw Error('Invalid LZO frame');
  const n=Math.ceil(size/block),out=Buffer.alloc(size);let cursor=at+16+n*8,used=0,sum=0;
  if(cursor>at+packed)throw Error('Truncated block table');
  for(let j=0;j<n;j++){
   const length=data.readUInt32LE(at+16+j*8),plain=data.readUInt32LE(at+20+j*8);
   if(!length||plain!==Math.min(block,size-used)||cursor+length>at+packed)throw Error('Invalid LZO block');
   const payload=data.subarray(cursor,cursor+length),raw=length===plain?payload:Buffer.from(decode(payload,plain));
   if(raw.length!==plain)throw Error('Invalid decoded size');raw.copy(out,used);used+=plain;cursor+=length;sum+=length;
  }
  if(cursor!==at+packed||sum!==data.readUInt32LE(at+8))throw Error('Invalid frame length');cache.set(i,out);return out;
 }
 return (at,size)=>{if(!Number.isSafeInteger(size)||size<0||size>64*1024*1024)throw Error('Invalid read size');const parts=[];while(size){const i=table.findIndex(e=>at>=e[0]&&at<e[0]+e[1]);if(i<0)throw Error('Logical read outside package');const n=Math.min(size,table[i][0]+table[i][1]-at);parts.push(chunk(i).subarray(at-table[i][0],at-table[i][0]+n));at+=n;size-=n;}return Buffer.concat(parts);};
}
function verifyPackages(packages,c){
 for(const mod of ['warp','vending'])if(c[mod]){
  const grouped=new Map();for(const p of proof[mod]){if(!grouped.has(p.file))grouped.set(p.file,new Map());grouped.get(p.file).set(p.index,p);}
  for(const [file,wanted] of grouped){
   const data=packages[file],read=reader(data),count=data.readUInt32LE(0x21);let at=data.readUInt32LE(0x25),found=0;
   if(count>200000)throw Error('Invalid export count');
   for(let i=0;i<count;i++){const entry=read(at,68),generations=entry.readUInt32LE(44);if(generations>10000)throw Error('Invalid export generations');
    if(wanted.has(i)){const p=wanted.get(i),size=entry.readUInt32LE(32);if(size!==p.size||sha(read(entry.readUInt32LE(36),size))!==p.sha256)throw Error(`Install the matching ${mod} TFC UPK patch first: ${file} export ${i}. / TFC UPK 패치를 먼저 적용하세요.`);found++;}at+=68+generations*4;
   }
   if(found!==wanted.size)throw Error('Missing required TFC objects: '+mod);
  }
 }
}
function compose(base,c){
 let result=Buffer.from(base);
 if(c.warp){
  const def={baseSha1:'802B3E1181DEA1FB29CE9CA331161922902B9827',enablePatch:'25386710-native-enable.lidbin',disablePatch:'25386710-native-disable.lidbin'};
  const known=native.identify(result,def,assets);if(!known||known.enabled)throw Error('Expected supported stock native code; remove standalone native patches first.');
  const p=native.parsePatch(fs.readFileSync(path.join(assets,def.enablePatch))),b=Buffer.alloc(p.size);result.copy(b);for(const e of p.entries)e.bytes.copy(b,e.offset);result=b;
 }
 if(c.vending)result=require('./kernel/src/executable').patchExecutable(result).output;
 return result;
}
// Adopt only external changes outside every owned byte and outside PE overlays.
function reconcile(base,expected,current){
 if(current.length!==expected.length)throw Error('External EXE size/section change: refusing to overwrite it.');
 const b=Buffer.from(base),masked=new Set();for(const [name,[,count]] of Object.entries(links.PACKAGES))for(const at of links.digestOffsets(expected,name,count))for(let j=0;j<20;j++)masked.add(at+j);
 for(let i=0;i<current.length;i++)if(current[i]!==expected[i]&&!masked.has(i)){
  if(i>=base.length||expected[i]!==base[i])throw Error('Owned native bytes modified at 0x'+i.toString(16)+'; nothing overwritten.');b[i]=current[i];
 }
 return b;
}
function baseOf(game,r){if(!/^[a-f0-9]{64}$/.test(r.baseHash)||r.base!==r.baseHash)throw Error('Invalid TFC baseline');const b=fs.readFileSync(path.join(files(game).root,'bases',r.baseHash));if(sha(b)!==r.baseHash)throw Error('TFC baseline damaged');return b;}
function readState(game){const p=files(game),file=path.join(p.root,'state.json');if(!fs.existsSync(file))return null;const r=json(file);if(r.format!=='LID-TFC-NATIVE-1'||!Array.isArray(r.rows)||!r.baseHash||typeof r.base!=='string')throw Error('Invalid TFC state');config(r.config);baseOf(game,r);return r;}
function readDb(file){for(const suffix of ['-wal','-shm','-journal'])if(fs.existsSync(file+suffix))throw Error('SQLite is open/recovering: '+file+suffix);return fs.existsSync(file)?fs.readFileSync(file):null;}
function rowsEqual(a,b){const keys=Object.keys(b).sort();return keys.every(k=>a[k]===b[k])&&Object.keys(a).length===keys.length;}
function stageDb(folder,before,rows,enabled){
 if(!before)throw Error('MASTER DB missing');const file=path.join(folder,'staged.db');write(file,before);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(file);let next=[];
 try{
  db.exec('BEGIN IMMEDIATE');
  for(const row of rows){const actual=db.prepare('SELECT * FROM master_automaticshop_lineup WHERE goods_id=?').get(row.goods_id);if(!actual||!rowsEqual(actual,row))throw Error('Owned material row changed: '+row.goods_id);db.prepare('DELETE FROM master_automaticshop_lineup WHERE goods_id=?').run(row.goods_id);}
  if(enabled){
   next=require('./tfc-assets/material-catalog').planMaterialCatalog(db);
   const cols=Object.keys(next[0]);const insert=db.prepare(`INSERT INTO master_automaticshop_lineup (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`);
   for(const row of next)insert.run(...cols.map(k=>row[k]));
  }
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('DB integrity check failed');db.exec('COMMIT');
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
 return {bytes:fs.readFileSync(file),rows:next};
}
function assertNoLegacy(game){const f=path.join(game,'LID-Mod-State/state.json');if(fs.existsSync(f)){const r=json(f);if(r.active||r.layout)throw Error('Active standalone layer receipt exists. Remove/restore using its tool before switching to TFC.');}}
function change(game,next,{running=stopped,failpoint=()=>{}}={}){
 game=path.resolve(game);next=config(next);running();assertNoLegacy(game);
 const p=files(game);fs.mkdirSync(p.root,{recursive:true});const lock=lockOperation(p.root);
 let folder,pending=false;
 try{
  if(fs.existsSync(path.join(p.root,'pending.json')))throw Error('Interrupted transaction: use recover first.');
  const old=readState(game),current=fs.readFileSync(p.exe),db=readDb(p.db),packages=packageBytes(game);
  verifyPackages(packages,next);
  let base=old?reconcile(baseOf(game,old),compose(baseOf(game,old),old.config),current):current;
  if(!old){const layout=native.peLayout(base);if(layout.sections.some(s=>s.name.startsWith('.lidvend')||s.name.startsWith('.lidtw')))throw Error('Unregistered native patch. Restore it with the original tool first.');}
  const afterExe=relink(compose(base,next),packages);
  const root=path.join(path.dirname(game),'LET-IT-DIE-TFC-backups',sha(Buffer.from(game.toLowerCase())).slice(0,16));folder=path.join(root,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());fs.mkdirSync(folder,{recursive:true});
  let afterDb=db,rows=old?.rows||[];
  if(next.vending!==!!old?.config.vending){const result=stageDb(folder,db,rows,next.vending);afterDb=result.bytes;rows=result.rows;}
  else if(next.vending){const {DatabaseSync}=require('node:sqlite'),probe=new DatabaseSync(p.db,{readOnly:true});try{for(const row of rows)if(!rowsEqual(probe.prepare('SELECT * FROM master_automaticshop_lineup WHERE goods_id=?').get(row.goods_id)||{},row))throw Error('Owned material row changed');}finally{probe.close();}}
  const baseHash=sha(base),baseFile=path.join(p.root,'bases',baseHash);
  if(!fs.existsSync(baseFile))write(baseFile,base);else if(sha(fs.readFileSync(baseFile))!==baseHash)throw Error('TFC baseline blob damaged');
  const state={format:'LID-TFC-NATIVE-1',config:next,rows,base:baseHash,baseHash};
  if(current.equals(afterExe)&&(db===null?afterDb===null:db.equals(afterDb))&&old&&JSON.stringify(old.config)===JSON.stringify(next)){return {changed:false};}
  write(path.join(folder,'before.exe'),current);write(path.join(folder,'after.exe'),afterExe);
  if(db){write(path.join(folder,'before.db'),db);write(path.join(folder,'after.db'),afterDb);}
  const record={format:'LID-TFC-TX-1',game,beforeState:old,afterState:state,packages:packageHashes(packages),exe:[sha(current),sha(afterExe)],db:db?[sha(db),sha(afterDb)]:null,status:'prepared'};
  write(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(record)));write(path.join(p.root,'pending.json'),Buffer.from(JSON.stringify({folder})));pending=true;
  running();if(!fs.readFileSync(p.exe).equals(current)||(db&&!readDb(p.db).equals(db))||JSON.stringify(packageHashes(packageBytes(game)))!==JSON.stringify(record.packages))throw Error('Files changed before commit');
  failpoint('prepared');replace(p.exe,afterExe);failpoint('exe');if(db&&!db.equals(afterDb))replace(p.db,afterDb);failpoint('db');
  if(!fs.readFileSync(p.exe).equals(afterExe)||(afterDb&&!readDb(p.db).equals(afterDb))||JSON.stringify(packageHashes(packageBytes(game)))!==JSON.stringify(record.packages))throw Error('Post-write verification failed; recovery required.');
  replace(path.join(p.root,'state.json'),Buffer.from(JSON.stringify(state)));record.status='applied';replace(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(record)));fs.unlinkSync(path.join(p.root,'pending.json'));pending=false;
  return {changed:true,backup:folder,config:next};
 }catch(error){if(pending)error.message+='\nPrepared backup retained. Run recover; do not retry blindly. / recover로 복구하세요. '+folder;throw error;}
 finally{fs.unlinkSync(lock);}
}
function recover(game,{running=stopped}={}){
 game=path.resolve(game);running();const p=files(game),pending=path.join(p.root,'pending.json');if(!fs.existsSync(pending))throw Error('No interrupted transaction');
 const lock=lockOperation(p.root,true);try{
 const folder=json(pending).folder,r=json(path.join(folder,'manifest.json'));
 if(r.format!=='LID-TFC-TX-1'||r.game!==game||JSON.stringify(packageHashes(packageBytes(game)))!==JSON.stringify(r.packages))throw Error('Recovery context changed; refusing overwrite.');
 const current=fs.readFileSync(p.exe),db=readDb(p.db),exe=fs.readFileSync(path.join(folder,'before.exe')),beforeDb=r.db?fs.readFileSync(path.join(folder,'before.db')):null;
 if(sha(exe)!==r.exe[0]||(r.db&&sha(beforeDb)!==r.db[0])||!r.exe.includes(sha(current))||(r.db&&!r.db.includes(sha(db))))throw Error('Backup damaged or external changes; recovery stopped.');
 running();replace(p.exe,exe);if(r.db)replace(p.db,beforeDb);
 if(r.beforeState)replace(path.join(p.root,'state.json'),Buffer.from(JSON.stringify(r.beforeState)));else if(fs.existsSync(path.join(p.root,'state.json')))fs.unlinkSync(path.join(p.root,'state.json'));
 r.status='recovered';replace(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(r)));fs.unlinkSync(pending);return {recovered:true,backup:folder};
 }finally{fs.unlinkSync(lock);}
}
function backups(game){const root=path.join(path.dirname(path.resolve(game)),'LET-IT-DIE-TFC-backups',sha(Buffer.from(path.resolve(game).toLowerCase())).slice(0,16));if(!fs.existsSync(root))return [];return fs.readdirSync(root).sort().reverse().map(n=>path.join(root,n)).filter(f=>{try{return json(path.join(f,'manifest.json')).status==='applied';}catch{return false;}});}
function restoreLatest(game,options={}){
 game=path.resolve(game);const folder=backups(game)[0];if(!folder)throw Error('No applied TFC companion backup');
 const r=json(path.join(folder,'manifest.json')),p=files(game),current=fs.readFileSync(p.exe),after=fs.readFileSync(path.join(folder,'after.exe'));
 if(r.game!==game||sha(after)!==r.exe[1]||!links.normalizedExecutable(current).equals(links.normalizedExecutable(after))||(r.db&&sha(readDb(p.db))!==r.db[1]))throw Error('Files changed after backup; full/config restore stopped. Use selective native removal instead.');
 const state=readState(game);if(JSON.stringify(state)!==JSON.stringify(r.afterState))throw Error('TFC state changed after backup');
 // Restore the prior native configuration, not a whole UPK/DB image. TFC's
 // current packages and unrelated DB rows are preserved and hashes relinked.
 return change(game,r.beforeState?.config||empty(),options);
}
function detach(game,{running=stopped}={}){
 game=path.resolve(game);running();const p=files(game),state=readState(game);
 if(!state)return {detached:false};if(state.config.warp||state.config.vending||fs.existsSync(path.join(p.root,'pending.json')))throw Error('Disable native components/recover before leaving TFC mode.');
 const lock=lockOperation(p.root);try{
  reconcile(baseOf(game,state),compose(baseOf(game,state),state.config),fs.readFileSync(p.exe));links.validatePackageLinks(fs.readFileSync(p.exe),game);
  running();fs.unlinkSync(path.join(p.root,'state.json'));return {detached:true,message:'Only controller metadata removed; backups retained. UPK removal is still handled by TFC.'};
 }finally{fs.unlinkSync(lock);}
}
module.exports={change,recover,readState,config,empty,compose,reconcile,relink,verifyPackages,reader,sha,EXE,DB,backups,restoreLatest,detach};

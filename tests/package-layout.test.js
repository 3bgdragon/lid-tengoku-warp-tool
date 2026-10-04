'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const layout=require('../shared/package-layout'),shared=require('../shared/layers'),{pack}=require('../shared/kernel/src/package-codec');
function packageBytes(seed=1){
 const raw=[Buffer.alloc(512,seed),Buffer.alloc(512,seed+1)],chunks=raw.map(b=>pack(b));
 const header=Buffer.alloc(256);header.writeUInt32LE(0x9e2a83c1,0);header.writeUInt32LE(2,0x6d);header.writeUInt32LE(2,0x71);
 let physical=256;
 for(let i=0;i<2;i++){const at=0x75+i*16;[224+i*512,512,physical,chunks[i].length].forEach((v,j)=>header.writeUInt32LE(v,at+j*4));physical+=chunks[i].length+128;}
 return Buffer.concat([header,chunks[0],Buffer.alloc(128,0xee),chunks[1],Buffer.alloc(13,0xff)]);
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function exeFor(buffers){const out=Buffer.alloc(1024);out.write('MZ');let at=100;for(const [index,name,count] of [[1,'brggame.upk',2],[2,'as_ch_main_male_common_sf.upk',1],[3,'heaven_a01_st_col.upk',1],[4,'brgstart_pl.upk',2]])for(let i=0;i<count;i++){const nameBytes=Buffer.from(name+'\0');nameBytes.copy(out,at);at+=nameBytes.length;crypto.createHash('sha1').update(buffers[index]).digest().copy(out,at);at+=20;}return out;}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-layout-test-'));t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('lid-layout-test-'));fs.rmSync(root,{recursive:true,force:true});});const b=[null,packageBytes(1),packageBytes(3),Buffer.from('map'),Buffer.from('start'),Buffer.from('DB')];b[0]=exeFor(b);b.forEach((v,i)=>{const f=path.join(root,shared.FILES[i]);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);});return {root,b};}
test('compaction preserves all compressed frames and logical directory values, removes gaps and is idempotent',()=>{
 const source=packageBytes(),out=layout.compact(source);assert.ok(out.length<source.length);assert.deepEqual(layout.compact(out),out);
 let expected=256;
 for(let i=0;i<2;i++){const at=0x75+i*16,old=source.readUInt32LE(at+8),size=source.readUInt32LE(at+12);assert.equal(out.readUInt32LE(at+8),expected);assert.deepEqual(out.subarray(expected,expected+size),source.subarray(old,old+size));assert.deepEqual(out.subarray(at,at+8),source.subarray(at,at+8));expected+=size;}
 assert.equal(expected,out.length);
});
test('moved first compressed chunk does not retain orphan data before live chunks',()=>{
 const source=packageBytes(),first=source.readUInt32LE(0x7d),size=source.readUInt32LE(0x81);
 const moved=Buffer.concat([source,source.subarray(first,first+size)]);
 moved.writeUInt32LE(source.length,0x7d);
 assert.deepEqual(layout.compact(moved),layout.compact(source));
});
test('bad ranges, overlap, noncontiguous logical data and corrupt frame lengths are rejected',()=>{
 for(const [offset,value] of [[0x71,100001],[0x75+16+8,256],[0x75+16,999],[256+12,999],[256+8,999]]){const b=packageBytes();b.writeUInt32LE(value,offset);assert.throws(()=>layout.compact(b));}
 assert.throws(()=>layout.compact(packageBytes().subarray(0,260)));
});
test('layout activation, shared edits, readback and exact snapshot restoration preserve unrelated files',t=>{
 const {root,b}=fixture(t),initial=b.map(hash),first=shared.compactPackages(root,{checkRunning:()=>false});assert.equal(first.changed,true);assert.equal(shared.active(root),true);
 assert.equal(JSON.parse(fs.readFileSync(path.join(shared.stateRoot(root),'state.json'),'utf8')).format,2);
 assert.deepEqual(shared.view(root,game=>shared.FILES.map(f=>hash(fs.readFileSync(path.join(game,f))))),initial);
 const noOp=shared.compactPackages(root,{checkRunning:()=>false});assert.equal(noOp.changed,false);
 const edit=shared.transact(root,'test-other-mod',game=>{const raw=shared.FILES.map(f=>fs.readFileSync(path.join(game,f)));raw[1]=packageBytes(9);raw[0]=exeFor(raw);for(const i of [0,1])fs.writeFileSync(path.join(game,shared.FILES[i]),raw[i]);return {};},{checkRunning:()=>false});
 assert.equal(edit.changed,true);assert.deepEqual(fs.readFileSync(path.join(root,shared.FILES[1])),layout.compact(packageBytes(9)));for(const i of [3,4,5])assert.deepEqual(fs.readFileSync(path.join(root,shared.FILES[i])),b[i]);
 shared.restore(root,edit.backup,{checkRunning:()=>false});assert.equal(shared.active(root),true);
 shared.restore(root,first.backup,{checkRunning:()=>false});assert.equal(shared.active(root),false);assert.deepEqual(shared.FILES.map(f=>hash(fs.readFileSync(path.join(root,f)))),initial);
});
test('external editor changes and damaged layout baselines refuse subsequent writes',t=>{
 const {root}=fixture(t);shared.compactPackages(root,{checkRunning:()=>false});const f=path.join(root,shared.FILES[1]),b=fs.readFileSync(f);b[b.length-1]^=1;fs.writeFileSync(f,b);
 assert.throws(()=>shared.view(root,()=>{}),/externally/);assert.throws(()=>shared.compactPackages(root,{checkRunning:()=>false}),/externally/);assert.deepEqual(fs.readFileSync(f),b);
});
test('damaged layout baseline is rejected even after a recipe has been cached',t=>{
 const {root}=fixture(t);shared.compactPackages(root,{checkRunning:()=>false});
 const value=shared.layoutState(root),f=path.join(shared.stateRoot(root),'layouts',value.generation,'raw-1'),b=fs.readFileSync(f);b[b.length-1]^=1;fs.writeFileSync(f,b);
 assert.throws(()=>shared.view(root,()=>{}),/baseline damaged/);
});
test('layout receipt publication failure restores the exact original files',t=>{
 const {root,b}=fixture(t),rename=fs.renameSync;
 fs.renameSync=(from,to)=>{if(to===path.join(shared.stateRoot(root),'state.json'))throw Error('injected layout receipt failure');return rename(from,to);};
 try{assert.throws(()=>shared.compactPackages(root,{checkRunning:()=>false}),/receipt failure/);}finally{fs.renameSync=rename;}
 assert.deepEqual(shared.FILES.map(f=>hash(fs.readFileSync(path.join(root,f)))),b.map(hash));assert.equal(shared.active(root),false);
});
test('standalone compatibility launcher runs without Git and cancels a missing-path prompt', {skip:process.platform!=='win32'},()=>{
 const {spawnSync}=require('node:child_process'),repo=path.resolve(__dirname,'..'),bat=path.join(repo,'upk-compat.bat');
 const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',`""${bat}" "${path.join(os.tmpdir(),'missing LID installation')}" --lang=en"`],{windowsVerbatimArguments:true,encoding:'utf8',input:'\r\n',timeout:10000,env:{...process.env,PATH:path.dirname(process.execPath)+';'+path.join(process.env.SystemRoot,'System32')}});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/Installation folder or BrgGame-Steam.exe path/);assert.match(result.stdout,/Press any key/i);
});

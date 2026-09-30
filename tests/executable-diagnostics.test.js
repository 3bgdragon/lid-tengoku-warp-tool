'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {describe,saveError,formatError}=require('../executable-diagnostics');
test('zero-entry diagnostic is read-only and distinguishes encoding/case',()=>{
 const exe=Buffer.concat([Buffer.from('MZ unrelated BrgGame.upk\0'),Buffer.alloc(20),Buffer.from('brggame.upk\0','utf16le')]),before=Buffer.from(exe);
 const r=describe(exe,'BrgGame-Steam.exe',['brggame.upk']);
 assert.equal(r.size,exe.length);assert.equal(r.sha256.length,64);assert.equal(r.pe.valid,false);
 assert.deepEqual(r.packageNames['brggame.upk'],{asciiLower:0,asciiUpper:0,asciiTitle:1,utf16Lower:1});assert.deepEqual(exe,before);
});
test('malformed PE offsets fail safely and genuine PE sections are described',()=>{
 const exe=Buffer.alloc(256);exe.write('MZ');exe.writeUInt32LE(0xffffffff,60);assert.equal(describe(exe,'x',[]).pe.valid,false);
 exe.writeUInt32LE(64,60);exe.write('PE\0\0',64);exe.writeUInt16LE(0x8664,68);exe.writeUInt16LE(1,70);exe.writeUInt16LE(2,84);exe.writeUInt16LE(0x20b,88);exe.write('.text',90);
 const r=describe(exe,'x',[]);assert.equal(r.pe.valid,true);assert.equal(r.pe.machine,0x8664);assert.equal(r.pe.sections[0].name,'.text');
});
test('error report creates only a visible JSON log, no executable contents',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-warp-report-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const error=new Error('expected 2, found 0');error.executableDiagnostics=describe(Buffer.from('MZ'),'C:/game/BrgGame-Steam.exe',['brggame.upk']);
 const file=saveError(root,error,'test'),r=JSON.parse(fs.readFileSync(file));
 assert.equal(path.dirname(file),path.join(root,'logs'));assert.equal(r.message,error.message);assert.equal(r.executable.size,2);
 assert.deepEqual(fs.readdirSync(root),['logs']);assert.equal(r.version,'test');
});
test('window message contains shareable details, explanation and next steps in both languages',()=>{
 const error=new Error('expected 2, found 0');error.executableDiagnostics=describe(Buffer.from('MZ'),'C:/game/BrgGame-Steam.exe',['brggame.upk']);
 for(const en of [false,true]){
  const text=formatError(error,'1.4.2-dev',(ko,english)=>en?english:ko);
  assert.ok(text.includes(error.message));assert.ok(text.includes(error.executableDiagnostics.path));assert.ok(text.includes(error.executableDiagnostics.sha256));
  assert.match(text,/1\.4\.2-dev/);assert.match(text,/brggame\.upk: 0 \/ 0 \/ 0 \/ 0/);assert.match(text,/END/);
  if(en){assert.doesNotMatch(text,/[가-힣]/);assert.match(text,/Meaning:/);assert.match(text,/Next:/);assert.match(text,/copy this block/);}
  else{assert.match(text,/의미:/);assert.match(text,/다음:/);assert.match(text,/복사해서 공유/);}
 }
 const generic=formatError(new Error('access denied'),'test',(ko,en)=>en);assert.match(generic,/access denied/);assert.match(generic,/No EXE-layout diagnosis/);
});

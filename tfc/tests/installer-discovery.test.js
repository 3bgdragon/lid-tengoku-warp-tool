'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('TFC strips only .PackagePatch, leaving an actual .upk target filename',()=>{
 const root=path.resolve(__dirname,'..');
 const dir=path.join(root,'Game/BrgGame/CookedPCConsole');
 const files=fs.readdirSync(dir).filter(name=>name.endsWith('.PackagePatch'));
 assert(files.length>0);
 for(const name of files){
  const target=name.slice(0,-'.PackagePatch'.length);
  assert(target.endsWith('.upk'),'TFC target must retain .upk: '+name);
 }
 const profile=fs.readFileSync(path.join(root,'GameProfile.xml'),'utf8');
 assert(profile.includes('displayName="LET IT DIE"'));
 assert(!/DISPOSABLE|TEST COPIES/.test(profile));
});

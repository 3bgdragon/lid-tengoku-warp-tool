'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sites=require('../native-sites'),m=require('../assets/manifest-25767944.json');
const file=process.env.LID_25767944_EXE,assets=path.resolve(__dirname,'../assets');
test('new build retains separate static-only validation status and reversible assets',()=>{
 assert.equal(m.steamBuildId,'25767944');assert.equal(m.releaseStatus,'static-verified-awaiting-gameplay');
 assert.deepEqual(m.starts,[51,101,201,301]);assert.equal(m.executable.native.baseSize,45000192);
 assert.equal(m.executable.native.profile,'native-sites-25767944.json');
 for(const p of [m.heavenEntry,m.brgStart,m.executable.native])for(const field of ['enablePatch','disablePatch'])assert.equal(fs.readFileSync(path.join(assets,p[field])).subarray(0,8).toString(),'LIDBIN1\0');
});
test('new native delta is reversible and rejects code/section/tail conflicts',{skip:!file},()=>{
 const source=fs.readFileSync(file),foreign=Buffer.from(source);foreign[0x100000]^=1;
 const def=m.executable.native;assert.equal(sites.identify(foreign,def,assets).enabled,false);
 const on=sites.parsePatch(fs.readFileSync(path.join(assets,def.enablePatch))),off=sites.parsePatch(fs.readFileSync(path.join(assets,def.disablePatch)));
 const patched=Buffer.alloc(on.size);foreign.copy(patched);for(const e of on.entries)e.bytes.copy(patched,e.offset);
 assert.equal(sites.identify(patched,def,assets).enabled,true);assert.equal(patched[0x100000],foreign[0x100000]);
 const restored=Buffer.alloc(off.size);patched.copy(restored);for(const e of off.entries)e.bytes.copy(restored,e.offset);assert.deepEqual(restored,foreign);
 for(const at of on.entries.filter(e=>e.offset>=1024&&e.offset<off.size).map(e=>e.offset)){const bad=Buffer.from(foreign);bad[at]^=1;assert.equal(sites.identify(bad,def,assets),null);}
 const bad=Buffer.from(patched);bad[bad.length-1]^=1;assert.equal(sites.identify(bad,def,assets),null);
 assert.equal(sites.identify(Buffer.concat([foreign,Buffer.from('overlay')]),def,assets),null);
 assert.ok(fs.readFileSync(file).equals(source));
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const owned=require('../runtime/owned-functions'),pre=require('../runtime/tfc-preflight');
test('unprepared source cannot silently finish TFC installation',()=>{
 assert.throws(()=>pre.verify('unused',path.resolve(__dirname,'..')),/preflight first/);
});
test('runtime contains independent reviewed evidence for all four mods',()=>{
 for(const mod of ['guard','warp','m2g','vending'])assert.ok(owned.catalog.objects.some(p=>p.mod===mod));
});
const source=process.env.LID_TFC_PREFLIGHT_SOURCE;
test('game-specific patch preparation preserves Faster Drops and verifies installed bodies',{skip:!source},t=>{
 const root=path.resolve(process.env.LID_TFC_TEST_ROOT||path.join(__dirname,'../.integration-temp'));fs.mkdirSync(root,{recursive:true});
 const name=require('../package.json').name,mod=name.includes('justguard')?'guard':name.includes('tengoku')?'warp':name.includes('m2g')?'m2g':'vending';
 const out=fs.mkdtempSync(path.join(root,'preflight-')),r=pre.prepare(source,mod,path.resolve(__dirname,'..'),out);
 assert.equal(pre.verify(source,r.output).verified,true);
 const receipt=JSON.parse(fs.readFileSync(path.join(r.output,'preflight.json')));
 const fn=receipt.proof.find(p=>p.mod==='warp'&&p.index===71346);
 assert.equal(Buffer.from(fn.expected,'base64')[23626],0);
 // Simulate a cached-original installer losing an independent, unselected
 // function. A unchanged selected warp preset must not bless that result.
 const other=receipt.proof.find(p=>p.mod!==mod);assert.ok(other);
 const changed=Buffer.from(other.expected,'base64');changed[changed.length-1]^=1;
 other.expected=changed.toString('base64');other.hash=owned.sha(changed);
 fs.writeFileSync(path.join(r.output,'preflight.json'),JSON.stringify(receipt));
 assert.throws(()=>pre.verify(source,r.output),/install lost\/changed instructions/);
});

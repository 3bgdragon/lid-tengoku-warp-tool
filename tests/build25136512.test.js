const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const m=require('../assets/manifest-25136512.json');
test('new Steam build keeps separate unverified routing and complete reversible assets',()=>{
 assert.equal(m.steamBuildId,'25136512');
 assert.equal(m.releaseStatus,'static-verified-awaiting-gameplay');
 assert.equal(m.executable.normalizedExtraEntries['as_ch_main_male_common_sf.upk'],1);
 for(const item of [...Object.values(m.brgGame.profiles),m.heavenEntry,m.executable.native]){
  assert.match(item.baseSha1,/^[0-9A-F]{40}$/);
  assert.match(item.patchedSha1,/^[0-9A-F]{40}$/);
  for(const key of ['enablePatch','disablePatch']){
   const data=fs.readFileSync(path.resolve(__dirname,'../assets',item[key]));
   assert.equal(data.subarray(0,8).toString(),'LIDBIN1\0');
  }
 }
});

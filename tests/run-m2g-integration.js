'use strict';
// Developer integration runner. Input files are READ ONLY. All writes go to a
// fresh .integration-temp/m2g-order-* directory, never the source installation.
// Args: original warp-enabled EXE, map folder, enumerated base-package folder.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),engine=require('../compat/m2g/package-patch');
const compat=require('../compat/m2g'),manifest=require('../assets/manifest-25136512.json');
const [exeFile,mapFolder,baseFolder]=process.argv.slice(2);
if(!baseFolder)throw Error('Usage: node tests/run-m2g-integration.js WARP_EXE MAP_FOLDER BASE_PACKAGE_FOLDER');
const exe=fs.readFileSync(exeFile),map=fs.readFileSync(path.join(mapFolder,'Heaven_A01_ST_COL.upk')),start=fs.readFileSync(path.join(mapFolder,'BrgStart_PL.upk'));
const sha=b=>crypto.createHash('sha1').update(b).digest('hex').toUpperCase();
assert.equal(sha(map),manifest.heavenEntry.patchedSha1);assert.equal(sha(start),manifest.brgStart.baseSha1);
fs.mkdirSync(path.join(root,'.integration-temp'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'.integration-temp/m2g-order-'));
const game=path.join(output,'game'),backups=path.join(output,'backups');
const files={brgGame:'BrgGame/CookedPCConsole/BrgGame.upk',heavenEntry:'BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk',brgStart:'BrgGame/CookedPCConsole/BrgStart_PL.upk',executable:'Binaries/Win64/BrgGame-Steam.exe'};
for(const rel of Object.values(files))fs.mkdirSync(path.dirname(path.join(game,rel)),{recursive:true});
const read=()=>Object.fromEntries(Object.entries(files).map(([k,v])=>[k,fs.readFileSync(path.join(game,v))]));
const hashes=pair=>Object.fromEntries(Object.entries(pair).map(([k,v])=>[k,sha(v)]));
function write(pair){for(const [k,b]of Object.entries(pair))fs.writeFileSync(path.join(game,files[k]),b);}
function relink(executable,upk){const b=Buffer.from(executable),needle=Buffer.from('brggame.upk\0');let at=0,count=0;while((at=b.indexOf(needle,at))>=0){at+=needle.length;Buffer.from(sha(upk),'hex').copy(b,at);count++;}assert.equal(count,2);return b;}
function cli(...args){const r=spawnSync(process.execPath,[path.join(root,'lid-tengoku-warp.js'),...args,'--yes','--experimental','--game',game],{env:{...process.env,LID_TENGOKU_BACKUP_DIR:backups},encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;}
function knife(){const pair=read(),upk=engine.build(pair.brgGame);write({brgGame:upk,executable:engine.linkExecutable(pair.executable,pair.brgGame,upk)});}
const results=[];
for(const guard of ['off-off','off-on','on-off','on-on']){
 const warpBase=fs.readFileSync(path.join(baseFolder,`${guard}-warp.upk`));assert.equal(sha(warpBase),manifest.brgGame.profiles[guard].patchedSha1);
 write({brgGame:warpBase,executable:relink(exe,warpBase),heavenEntry:map,brgStart:start});cli('remove');
 const clean=read(),cleanHashes=hashes(clean);assert.equal(cleanHashes.brgGame,manifest.brgGame.profiles[guard].baseSha1);
 // Route A: M2G first, then warp.
 knife();const knifeOnly=hashes(read());assert.equal(knifeOnly.brgGame,compat.forBase(cleanHashes.brgGame).sha1);
 assert.match(cli('status'),/M2G 나이프/);cli('apply');const routeA=hashes(read());
 assert.equal(routeA.brgGame,compat.forBase(sha(warpBase)).sha1);
 cli('remove');assert.deepEqual(hashes(read()),knifeOnly);
 // Exact full-backup restore returns to the preceding combined state.
 const latest=fs.readdirSync(backups).sort().at(-1);cli('restore',path.join(backups,latest));assert.deepEqual(hashes(read()),routeA);
 // Route B: warp first, then M2G. Result must match every byte digest of A.
 write(clean);cli('apply');knife();assert.deepEqual(hashes(read()),routeA);
 cli('remove');assert.deepEqual(hashes(read()),knifeOnly);
 results.push({guard,reportedReproduced:guard==='off-off'&&knifeOnly.brgGame==='F0439B6D568FF02E0E9488F4ED6323056C84F842',bothOrdersIdentical:true,warpRemovalPreservesKnife:true,fullBackupRestoreExact:true});
 console.log(JSON.stringify(results.at(-1)));
 // Delete only this run's disposable backups after successful verification.
 assert.equal(path.dirname(path.resolve(backups)),path.resolve(output));assert.ok(path.basename(output).startsWith('m2g-order-'));
 fs.rmSync(backups,{recursive:true,force:true});
}
assert.ok(fs.readFileSync(exeFile).equals(exe));assert.ok(fs.readFileSync(path.join(mapFolder,'Heaven_A01_ST_COL.upk')).equals(map));assert.ok(fs.readFileSync(path.join(mapFolder,'BrgStart_PL.upk')).equals(start));
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({sourceUntouched:true,results},null,2));
console.log('REPORT '+path.join(output,'results.json'));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
function run(t,mod,command){
 const root=path.resolve(process.env.LID_TFC_TEST_ROOT||os.tmpdir());fs.mkdirSync(root,{recursive:true});
 const game=fs.mkdtempSync(path.join(root,'tfc-relink-routing-')),file=path.join(game,'Binaries/Win64/BrgGame-Steam.exe');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'sentinel');
 t.after(()=>{assert.equal(path.dirname(game),root);assert(path.basename(game).startsWith('tfc-relink-routing-'));fs.rmSync(game,{recursive:true,force:true});});
 const controller=path.resolve(__dirname,'../runtime/tfc-companion'),preflight=path.resolve(__dirname,'../runtime/tfc-preflight'),cli=path.resolve(__dirname,'../runtime/tfc-cli');
 const code=`
 require(${JSON.stringify(controller)});require.cache[require.resolve(${JSON.stringify(controller)})].exports={
 EXE:'Binaries/Win64/BrgGame-Steam.exe',readState:()=>({config:{warp:true,vending:true}}),
 empty:()=>({warp:false,vending:false}),change:(game,next,options)=>({next,options}),
 finishRemoval:(game,mod)=>({removal:mod})
 };
 require(${JSON.stringify(preflight)});require.cache[require.resolve(${JSON.stringify(preflight)})].exports={verify:()=>{throw Error('preflight verification required');}};
 // node -e defaults parseArgs to argv.slice(1), unlike a script file.
 process.argv=[process.execPath,${JSON.stringify(command)},'--game',${JSON.stringify(game)},'--yes','--json'];
 require(${JSON.stringify(cli)}).main(${JSON.stringify(mod)}).catch(e=>{console.error(e.message);process.exitCode=1;});
 `;
 const result=spawnSync(process.execPath,['-e',code],{encoding:'utf8',timeout:10000});assert.equal(result.error,undefined);assert.equal(fs.readFileSync(file,'utf8'),'sentinel');return result;
}
for(const mod of ['guard','warp','m2g','vending'])test('advanced relink preserves native settings and validates every registered feature: '+mod,t=>{
 const r=run(t,mod,'relink');assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));assert.deepEqual(result.next,{warp:true,vending:true});assert.equal(result.options.upkMod,null);
});
test('finish installation still requires the prepared full-function proof',t=>{
 const r=run(t,'guard','sync');assert.equal(r.status,1);assert.match(r.stderr,/preflight verification required/);
});
for(const mod of ['guard','warp','m2g','vending'])for(const command of ['off','removed','off-all'])test('explicit removal routes to locked OFF proof: '+mod+'/'+command,t=>{
 const r=run(t,mod,command);assert.equal(r.status,0,r.stderr);
 assert.deepEqual(JSON.parse(r.stdout),{removal:command==='off-all'?'all':mod});
});

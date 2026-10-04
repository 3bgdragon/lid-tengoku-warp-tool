'use strict';
// Build a game-specific TFC package without modifying the game or saves.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const owned=require('./owned-functions');
const sha=owned.sha;
const repos={guard:'guard',warp:'warp',m2g:'m2g',vending:'vending'};
function prepare(game,mod,source=path.resolve(__dirname,'..'),outputRoot=path.join(path.dirname(source),'prepared')){
 if(!repos[mod])throw Error('Unknown mod');
 if(['pending.json','layout-pending.json','operation.lock'].some(f=>fs.existsSync(path.join(game,'LID-TFC-State',f))))throw Error('Recover interrupted operation before preparation');
 if(fs.existsSync(path.join(game,'LID-Mod-State/operation.lock')))throw Error('Standalone operation/recovery lock exists before TFC preparation');
 const legacy=path.join(game,'LID-Mod-State/state.json');
 if(fs.existsSync(legacy)){const state=JSON.parse(fs.readFileSync(legacy));if(state.active||state.layout)throw Error('Remove/restore standalone patches with their original tools before TFC preparation');}
 const receipt=require('./tfc-companion').readState(game);
 for(const setting of receipt?.upkSettings||[]){
  if(!owned.catalog.objects.some(p=>p.mod===setting.mod&&p.file===setting.file))throw Error('Invalid installed-feature receipt');
  if(setting.mod!==mod&&owned.inspect(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',setting.file)),setting.mod,setting.file)!==setting.preset)throw Error('Previously installed feature changed/lost before preparation: '+setting.mod);
 }
 const cooked=path.join(source,'Game/BrgGame/CookedPCConsole');
 const patches=fs.readdirSync(cooked).filter(n=>n.endsWith('.PackagePatch'));
 const staged=[],proof=[],before={};
 for(const name of patches){
  const file=name.replace(/\.PackagePatch$/,''),data=fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',file));
  before[file]=sha(data);
  const rows=owned.objects(data,mod,file).rows,patch=fs.readFileSync(path.join(cooked,name)),result=Buffer.from(patch);
  if(!owned.catalog.patches.some(p=>p.mod===mod&&p.sha256===sha(patch)))throw Error('Unreviewed/damaged TFC patch template');
  let found=0;
  for(const row of rows){
   // A selected preset may omit this object. Find only reviewed serialized bodies.
   const matches=[...new Map(row.variants.map(p=>({...p,at:patch.indexOf(p.on)})).filter(p=>p.at>=0).map(p=>[sha(p.on),p])).values()];
   if(!matches.length)continue;
   if(matches.length!==1||patch.indexOf(matches[0].on,matches[0].at+1)>=0)throw Error('Ambiguous TFC object payload');
   const p=matches[0],merged=owned.merge(row.bytes,row.variants,p.preset);
   if(merged.length!==p.on.length)throw Error('TFC payload size mismatch');
   merged.copy(result,p.at);found++;
   proof.push({mod,file,index:row.index,expected:merged.toString('base64'),hash:sha(merged)});
  }
  if(!found)throw Error('No reviewed object payload in '+name);
  // Check all existing owned functions, including other mods, after installation.
  for(const other of Object.keys(repos)){
   if(other===mod||!owned.catalog.objects.some(p=>p.mod===other&&p.file===file))continue;
   for(const row of owned.objects(data,other,file).rows){
    if(row.state===null)throw Error('Existing mod has conflicting instructions: '+other+'/'+row.index);
    proof.push({mod:other,file,index:row.index,expected:row.bytes.toString('base64'),hash:sha(row.bytes)});
   }
  }
  staged.push({name,result});
 }
 for(const [file,digest] of Object.entries(before))if(sha(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',file)))!==digest)throw Error('Game changed during preflight');
 const output=path.join(path.resolve(outputRoot),mod+'-'+crypto.randomUUID());
 fs.mkdirSync(output,{recursive:true});
 try{
  for(const name of ['runtime','GameProfile.xml','companion.js','run-tfc.bat','run.bat','COMPANION.md','START-HERE.ko.md']){
   const f=path.join(source,name);if(fs.existsSync(f))fs.cpSync(f,path.join(output,name),{recursive:true});
  }
  const dir=path.join(output,'Game/BrgGame/CookedPCConsole');fs.mkdirSync(dir,{recursive:true});
  for(const p of staged)fs.writeFileSync(path.join(dir,p.name),p.result,{flag:'wx'});
  fs.writeFileSync(path.join(output,'preflight.json'),JSON.stringify({format:'LID-TFC-PREFLIGHT-1',game:path.resolve(game),mod,before,proof},null,2));
  fs.writeFileSync(path.join(output,'ModInfo.xml'),'<ModInfo name="LET IT DIE '+mod+' — game-specific preflight package" />\n');
  fs.writeFileSync(path.join(output,'README.txt'),'Install THIS folder with TFC immediately, then run THIS folder\'s run-tfc.bat to finish. If game files change before installation, prepare again. Do not install the unprepared source folder. Do not stack old presets.\nTFC에 이 폴더를 설치한 뒤 이 폴더의 run-tfc.bat으로 마무리하세요. 설치 전 다른 모드가 파일을 바꾸면 다시 준비하세요. 기존 프리셋을 중복 설치하지 마세요.\n');
 }catch(e){e.message+='\nIncomplete package: '+output;throw e;}
 return {output,objects:proof.length,before};
}
function verify(game,source=path.resolve(__dirname,'..')){
 const file=path.join(source,'preflight.json');
 if(!fs.existsSync(file))throw Error('Run preflight first and finish from the generated package / 먼저 준비한 패키지 폴더에서 설치를 마무리하세요');
 const record=JSON.parse(fs.readFileSync(file));
 if(record.format!=='LID-TFC-PREFLIGHT-1'||path.resolve(record.game).toLowerCase()!==path.resolve(game).toLowerCase()||!Array.isArray(record.proof)||!record.proof.length)throw Error('Invalid preflight receipt');
 const cache=new Map();
 for(const p of record.proof){
  // Finish immediately after installation. A cached manager original can erase
  // independent edits even while the preset name remains unchanged. Verify all
  // recorded bodies, not just the selected mod. Intentional later edits require
  // a newly prepared package; never use an old finish receipt to bless them.
  const expected=Buffer.from(p.expected,'base64');if(sha(expected)!==p.hash)throw Error('Preflight proof damaged');
  const key=p.mod+'/'+p.file;
  if(!cache.has(key))cache.set(key,owned.objects(fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole',p.file)),p.mod,p.file));
  const row=cache.get(key).rows.find(o=>o.index===p.index);
  if(!row||!row.bytes.equals(expected))throw Error(`TFC install lost/changed instructions: ${p.mod} ${p.file} export ${p.index}. Prepare again; do not enable native code. / 설치 후 함수 검증 실패`);
 }
 return {verified:true,mod:record.mod,objects:record.proof.length};
}
module.exports={prepare,verify};

'use strict';
// Reviewed, build-specific object ownership. Never guess bytecode relocations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {reader}=require('./scoped-package');
const {pack,words}=require('./kernel/src/package-codec');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const catalog=require('./owned-functions.json');
const groups=new Map();
const foreignOffContexts=new WeakMap();
for(const row of catalog.objects){
 const p={...row,off:Buffer.from(row.off,'base64'),on:Buffer.from(row.on,'base64')};
 if(sha(p.off)!==row.offHash||sha(p.on)!==row.onHash)throw Error('Owned function evidence damaged');
 const key=p.mod+'/'+p.file+'/'+p.index;
 if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
}
function group(mod,file,index){return groups.get(mod+'/'+file+'/'+index);}
function context(variants){
 const stock=variants[0].off;
 if(variants.some(p=>!p.off.equals(stock)||p.on.length!==stock.length))return null;
 const edits=new Set();for(const p of variants)for(let i=0;i<stock.length;i++)if(stock[i]!==p.on[i])edits.add(i);
 const windows=[];for(const i of [...edits].sort((a,b)=>a-b)){
  const a=Math.max(0,i-16),b=Math.min(stock.length,i+17),last=windows.at(-1);
  if(last&&a<=last[1])last[1]=b;else windows.push([a,b]);
 }
 return {edits,windows};
}
function foreignOffCompatible(bytes,variants){
 // Only the reviewed, uninstalled SkillExchange.Tick layout is eligible.
 // Other tools may alter independent same-size UI literals. We never compile
 // those edits into our length-changing vending bridge or call them vanilla.
 const v=variants[0],stock=v.off;
 if(v.mod!=='vending'||v.file!=='BrgGame.upk'||v.index!==91836||bytes.length!==stock.length)return false;
 let windows=foreignOffContexts.get(variants);
 if(!windows){
  const plan=require('./foreign-vending-off.json');
  if(!plan||plan.before!==sha(stock)||plan.size!==stock.length||plan.scriptSize!==stock.readUInt32LE(0x2c)||plan.scriptMemory!==stock.readUInt32LE(0x28))throw Error('Foreign OFF-layout evidence mismatch');
  const code=Buffer.from(stock.subarray(0x30,0x30+plan.scriptSize));
  for(const jump of plan.jumps){if(code.readUInt16LE(jump.at)!==jump.before)throw Error('Foreign OFF-layout branch evidence mismatch');code.writeUInt16LE(jump.after,jump.at);}
  const inserted=Buffer.concat([code.subarray(0,plan.at),Buffer.from(plan.insert,'hex'),code.subarray(plan.at)]),header=Buffer.from(stock.subarray(0,0x30));
  header.writeUInt32LE(plan.scriptMemory+plan.extraMemory,0x28);header.writeUInt32LE(inserted.length,0x2c);
  const expected=Buffer.concat([header,inserted,stock.subarray(0x30+plan.scriptSize)]);
  if(variants.some(p=>!p.off.equals(stock)||!p.on.equals(expected)))throw Error('Foreign OFF-layout preset evidence mismatch');
  const start=0x30+plan.at,end=0x30+plan.scriptSize;
  windows=[[0,0x30],[Math.max(0x30,start-16),Math.min(end,start+16)],[end,stock.length]];
  for(const jump of plan.jumps){const at=0x30+jump.at;if(at<0x30||at+2>end||stock.readUInt16LE(at)!==jump.before)throw Error('Foreign OFF-layout branch evidence mismatch');windows.push([Math.max(0x30,at-1),at+2]);}
  foreignOffContexts.set(variants,windows);
 }
 return windows.every(([a,b])=>bytes.subarray(a,b).equals(stock.subarray(a,b)));
}
function recognize(bytes,variants){
 const c=context(variants),matches=b=>bytes.length===b.length&&(c?bytes.subarray(0,48).equals(b.subarray(0,48))&&c.windows.every(([a,z])=>bytes.subarray(a,z).equals(b.subarray(a,z))):bytes.equals(b));
 if(matches(variants[0].off))return 'off';
 for(const p of variants)if(matches(p.on))return p.preset;
 if(foreignOffCompatible(bytes,variants))return 'off';
 return null;
}
function merge(bytes,variants,preset){
 const target=preset==='off'?variants[0].off:(variants.find(p=>p.preset===preset)?.on||variants[0].off);
 if(recognize(bytes,variants)===null)throw Error(`Owned instruction conflict: ${variants[0].mod} ${variants[0].file} export ${variants[0].index}; no files changed / 소유 명령어 충돌`);
 const c=context(variants);
 if(!c){
  // OFF is a patch state, not permission to overwrite foreign instructions.
  if(!bytes.equals(variants[0].off)&&!variants.some(p=>bytes.equals(p.on))){
   if(preset==='off')return Buffer.from(bytes);
   throw Error('Cannot relocate a length-changing vending preset over foreign SkillExchange.Tick instructions; nothing overwritten / 외부 데칼 메뉴 수정을 덮어쓰지 않습니다');
  }
  return Buffer.from(target);
 }
 const out=Buffer.from(bytes);for(const i of c.edits)out[i]=target[i];return out;
}
function objects(source,mod,file){
 const wanted=new Map([...groups.values()].filter(v=>v[0].mod===mod&&v[0].file===file).map(v=>[v[0].index,v]));
 if(!wanted.size)throw Error('No reviewed ownership plan: '+mod+'/'+file);
 const r=reader(source),count=source.readUInt32LE(0x21),rows=[];let at=source.readUInt32LE(0x25);
 const existing=[...wanted].filter(([,v])=>v[0].off.length).map(([i])=>i);
 if(count>200000||(existing.length&&count<Math.max(...existing)+1))throw Error('Unsupported object table');
 for(let i=0;i<count;i++){
  const entry=r.read(at,68),generations=entry.readUInt32LE(44);if(generations>10000)throw Error('Invalid generations');
  if(wanted.has(i)){
   const variants=wanted.get(i),metadata=Buffer.from(entry);metadata.fill(0,32,40);
   if(!variants.some(p=>[p.metadata,p.onMetadata].includes(sha(metadata))))throw Error('Owned export identity conflict: '+file+'/'+i);
   const size=entry.readUInt32LE(32),offset=entry.readUInt32LE(36),bytes=r.read(offset,size);
   rows.push({index:i,slot:at,offset,size,bytes,variants,state:recognize(bytes,variants)});
  }at+=68+generations*4;
 }
 for(const [index,variants] of wanted)if(index>=count&&variants[0].off.length===0)rows.push({index,slot:null,offset:0,size:0,bytes:Buffer.alloc(0),variants,state:'off'});
 if(rows.length!==wanted.size)throw Error('Missing owned objects');return {r,rows};
}
function inspect(source,mod,file){
 const {rows}=objects(source,mod,file);
 const presets=['off',...new Set(rows.flatMap(o=>o.variants.map(p=>p.preset)))];
 for(const preset of presets)if(rows.every(o=>{
  if(o.state===null)return false;
  try{return merge(o.bytes,o.variants,preset).equals(o.bytes);}catch{return false;}
 }))return preset;
 throw Error(`Conflicting/partial ${mod} package: ${file} / 모드 함수 충돌·부분 적용`);
}
function set(source,mod,file,preset){
 if(!['off',...new Set(catalog.objects.filter(p=>p.mod===mod&&p.file===file).map(p=>p.preset))].includes(preset))throw Error('Unknown owned preset');
 const {r,rows}=objects(source,mod,file),replacements=rows.map(o=>({...o,next:merge(o.bytes,o.variants,preset)}));
 if(replacements.every(o=>o.bytes.equals(o.next)))return source;
 const last=r.table.length-1,tail=[r.chunk(last)];let logical=r.table[last][0]+r.table[last][1];
 for(const o of replacements){
  if(o.bytes.equals(o.next))continue;
  if(o.slot===null)throw Error('New export/table insertion requires the reviewed TFC table patch; scoped writer cannot guess indices');
  if(o.next.length===o.size)r.write(o.offset,o.next);
  else{r.write(o.slot+32,words(o.next.length,logical));tail.push(o.next);logical+=o.next.length;}
 }
 if(tail.length>1)r.dirty.add(last);
 const header=Buffer.from(source.subarray(0,r.headerLength)),parts=[header];let physical=header.length;
 for(let i=0;i<r.table.length;i++){
  const e=r.table[i],raw=i===last&&tail.length>1?Buffer.concat(tail):r.chunk(i);
  const packed=r.dirty.has(i)?pack(raw):source.subarray(e[2],e[2]+e[3]);
  words(e[0],raw.length,physical,packed.length).copy(header,0x75+i*16);parts.push(packed);physical+=packed.length;
 }
 const output=Buffer.concat(parts),after=objects(output,mod,file);
 for(const o of replacements)if(!after.rows.find(n=>n.index===o.index).bytes.equals(o.next))throw Error('Owned function post-write proof failed');
 // Check every logical chunk against the staged image, including all foreign objects.
 for(let i=0;i<r.table.length;i++){
  const expected=i===last&&tail.length>1?Buffer.concat(tail):r.chunk(i);
  if(!after.r.read(r.table[i][0],expected.length).equals(expected))throw Error('Foreign logical bytes changed');
 }
 return output;
}
function verifyTransition(before,after,mod,file){
 const b=objects(before,mod,file),a=objects(after,mod,file);
 for(const o of a.rows){
  if(o.state===null)throw Error('Installation left unknown owned instructions: '+mod+'/'+o.index);
  const old=b.rows.find(x=>x.index===o.index);
  if(!merge(old.bytes,o.variants,o.state).equals(o.bytes))throw Error('Installation overwrote foreign function bytes: '+mod+'/'+o.index);
 }
 return true;
}
function verifyOthers(before,after,mod,file){
 for(const other of new Set(catalog.objects.filter(p=>p.file===file&&p.mod!==mod).map(p=>p.mod))){
  const b=objects(before,other,file),a=objects(after,other,file);
  for(const old of b.rows){
   const next=a.rows.find(o=>o.index===old.index);
   if(!next||!next.bytes.equals(old.bytes))throw Error(`Other mod function overwritten: ${other} ${file} export ${old.index}`);
  }
 }
 return true;
}
module.exports={inspect,set,objects,merge,recognize,group,verifyTransition,verifyOthers,sha,catalog};

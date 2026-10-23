'use strict';
// Derive an independent ammo entry from reviewed plans. No SkillExchange code
// is emitted, rewritten, relocated or reset by this feature's patch plan.
const assert=require('node:assert/strict');
const all=require('../patches/vending-build25386710.json'),decal=require('../patches/decal-build25386710.json');
const vd='BrgUIMenu_ItemVendingMachine.',symbols=all.testSymbols;
const item=(plan,name)=>{const p=plan.patches.find(p=>p.name===name);assert(p,name);return p;};
function resize(p,insert,extraMemory){return {...p,insert:insert.toString('hex'),extraMemory,jumps:p.jumps.map(j=>({...j,after:j.after===j.before?j.before:j.after-p.extraMemory+extraMemory}))};}
const setup=item(all,vd+'SetupTopMenu'),oldSetup=item(decal,setup.name),setupBytes=Buffer.from(setup.insert,'hex'),oldSetupBytes=Buffer.from(oldSetup.insert,'hex');
assert(setupBytes.subarray(0,oldSetupBytes.length).equals(oldSetupBytes),'Reviewed decal entry prefix changed');
const ammoSetup=resize(setup,setupBytes.subarray(oldSetupBytes.length),setup.extraMemory-oldSetup.extraMemory);
const raw=(b,m=b.length)=>({b:Buffer.from(b),m,j:[]});
const b=(...v)=>raw(v),u32=n=>{const out=Buffer.alloc(4);out.writeInt32LE(n);return out;};
const object=n=>{const key=Object.keys(symbols.objects).find(i=>symbols.objects[i]===n);assert(key,n);return raw(u32(Number(key)),8);};
function seq(...parts){let disk=0,m=0;const jumps=[];for(const p of parts){jumps.push(...p.j.map(j=>({at:j.at+disk,to:j.to+m})));disk+=p.b.length;m+=p.m;}return {b:Buffer.concat(parts.map(p=>p.b)),m,j:jumps};}
const iv=n=>seq(b(1),object(n)),lv=n=>seq(b(0),object(n)),val=n=>seq(b(0x1d),raw(u32(n)));
const native=(n,...args)=>seq(b(n),...args,b(0x16));
const eq=(a,n)=>native(0x9a,a,val(n)),not=a=>native(0x81,a);
function when(c,...body){const out=seq(b(7,0,0),c,...body);out.j.push({at:1,to:out.m});return out;}
const call=n=>{const key=Object.keys(symbols.names).find(i=>symbols.names[i]===n);assert(key,n);return seq(b(0x1b),raw(u32(Number(key))),raw(u32(0)),b(0x16));};
function ctx(target,body){const size=Buffer.alloc(2);size.writeUInt16LE(body.m);return seq(b(0x19),target,raw(size),raw(u32(0),8),b(0),body);}
const ui=iv('BrgUIBase.mUIManager');
// A property context's skip field includes its property identity, just as the
// original reviewed GetMenuDefinition insertion. Reuse its exact condition.
const fullDefinition=item(all,vd+'GetMenuDefinition'),fullBytes=Buffer.from(fullDefinition.insert,'hex');
const buy=seq(b(0x2d),iv(vd+'mBuyOnly')),index=lv(vd+'GetMenuDefinition.Index');
const answer=(i,n)=>when(eq(index,i),seq(b(4,0x24,n)));
const answers=last=>seq(answer(last,7),answer(last+1,5));
// Preserve the exact typed field expression for IsHideBloodnium from the
// reviewed insertion rather than inventing its context metadata.
const field=(owner,n)=>{
 const prop=object(n),body=seq(b(1),prop),size=Buffer.alloc(2);size.writeUInt16LE(body.m);
 return seq(b(0x19),owner,raw(size),prop,b(0),body);
};
const hidden=ctx(field(ui,'BrgUIManager.mGameInfoNative'),call('IsHideBloodnium'));
assert(fullBytes.includes(hidden.b),'Reviewed typed hide-bloodnium condition changed');
const def=seq(when(buy,answers(1)),when(not(buy),when(hidden,answers(4)),when(not(hidden),answers(5))));
for(const j of def.j)def.b.writeUInt16LE(j.to+fullDefinition.memoryAt,j.at);
const definition=resize(fullDefinition,def.b,def.m);
assert(fullBytes.length>definition.insert.length/2,'Ammo menu should not contain the decal entry');
const tick=item(all,vd+'TickASync'),oldTick=item(decal,tick.name),tickBytes=Buffer.from(tick.insert,'hex');
const ammoTick=resize(tick,tickBytes.subarray(0,tickBytes.length-oldTick.insert.length/2),tick.extraMemory-oldTick.extraMemory);
const shop=all.patches.filter(p=>p.name.startsWith('BrgUIMenu_ShopBase.'));
assert.equal(shop.length,3);
module.exports={build:all.build,exportCount:all.exportCount,features:['materials','ammo'],patches:[ammoSetup,definition,ammoTick,...shop],testSymbols:symbols};

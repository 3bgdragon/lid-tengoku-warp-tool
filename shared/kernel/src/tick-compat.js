'use strict';
// Exact reviewed function family, not a size/hash bypass or generic merger.
// Reconstruct the external OFF image from stock + delta; only the vending
// insertion and audited absolute branch words change in its ON image.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const evidence=require('../patches/reviewed-tick-66b852e2.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),cache=new WeakMap();
function family(stock){
 if(cache.has(stock))return cache.get(stock);
 assert.equal(sha(stock),evidence.stockSha256,'Reviewed Tick stock evidence mismatch');
 const body=Buffer.from(stock);
 for(const h of evidence.hunks){const before=Buffer.from(h.before,'hex'),after=Buffer.from(h.after,'hex');assert.equal(before.length,after.length);assert(body.subarray(h.at,h.at+before.length).equals(before),'Reviewed Tick delta mismatch');after.copy(body,h.at);}
 const off=Buffer.concat([body.subarray(0,evidence.append.at),Buffer.from(evidence.append.hex,'hex'),body.subarray(evidence.append.at)]);
 assert.equal(off.length,evidence.foreignSize);assert.equal(sha(off),evidence.foreignSha256);
 assert.equal(off.readUInt32LE(40),evidence.foreignScriptMemory);assert.equal(off.readUInt32LE(44),evidence.foreignScriptSize);
 const code=Buffer.from(off.subarray(48,48+evidence.foreignScriptSize)),bridge=evidence.bridge;
 for(const j of evidence.jumps){assert.equal(code.readUInt16LE(j.at),j.before);code.writeUInt16LE(j.after,j.at);}
 const patched=Buffer.concat([code.subarray(0,bridge.at),Buffer.from(bridge.insert,'hex'),code.subarray(bridge.at)]),header=Buffer.from(off.subarray(0,48));
 header.writeUInt32LE(evidence.foreignScriptMemory+bridge.extraMemory,40);header.writeUInt32LE(patched.length,44);
 const on=Buffer.concat([header,patched,off.subarray(48+evidence.foreignScriptSize)]);assert.equal(sha(on),evidence.mergedSha256);
 const result={off,on};cache.set(stock,result);return result;
}
function identify(bytes,stock){
 if(![evidence.foreignSize,evidence.foreignSize+evidence.bridge.insert.length/2].includes(bytes.length))return null;
 const pair=family(stock);return bytes.equals(pair.off)?'off':bytes.equals(pair.on)?'on':null;
}
function merge(bytes,stock,preset){
 const state=identify(bytes,stock);if(state===null)return null;
 if(!['off','on','all-ko','all-en','decals-ko','decals-en','ammo-ko','ammo-en'].includes(preset))throw Error('Unsupported reviewed Tick preset');
 const pair=family(stock);return Buffer.from(/^ammo-/.test(preset)?bytes:preset==='off'?pair.off:pair.on);
}
function resolve(original,p){
 if(p.export!==evidence.export||p.name!==evidence.name||p.before!==evidence.stockSha256||original.length!==evidence.foreignSize||sha(original)!==evidence.foreignSha256)return p;
 const b=evidence.bridge;assert.equal(p.at,b.at);assert.equal(p.memoryAt,b.memoryAt);assert.equal(p.extraMemory,b.extraMemory);assert.equal(p.insert,b.insert);
 return {...p,before:evidence.foreignSha256,size:evidence.foreignSize,scriptSize:evidence.foreignScriptSize,scriptMemory:evidence.foreignScriptMemory,jumps:evidence.jumps};
}
module.exports={family,identify,merge,resolve,evidence};

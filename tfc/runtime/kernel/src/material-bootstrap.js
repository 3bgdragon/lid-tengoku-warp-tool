'use strict';
const {FIRST_ID,END_ID}=require('./material-selector');
// Build 25386710: wrap the existing non-login request daily-refresh call.
// Preserve normal daily refresh; bootstrap ONLY if neither saved COMMON list
// contains our IDs. Never reset dates, purchases, RE, weekday or bloodnium.
const HOOK_RVA=0x1103266, DAILY_RVA=0x134f050, USER_RVA=0x27d3210;
function buildMaterialBootstrap(rva){
 if(!Number.isSafeInteger(rva)||rva<0||rva>0x7fffffff)throw new Error('Invalid bootstrap RVA');
 const bytes=[],labels=new Map(),fixups=[];
 const emit=h=>bytes.push(...Buffer.from(h,'hex'));
 const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);bytes.push(...b);};
 const label=n=>labels.set(n,bytes.length);
 const rel=(h,to)=>{emit(h);fixups.push({at:bytes.length,to});u32(0);};
 const call=to=>rel('e8',to),jump=to=>rel('e9',to);
 emit('535657415441554881ec80000000'); // five nonvolatile saves; aligned shadow/local space
 call(DAILY_RVA);emit('4889442460');
 rel('4c8d25',USER_RVA); // r12 = saved shop object
 emit('498d8c248c000000');call('hasMaterial');emit('85c0');rel('0f85','done');
 emit('498d8c249c000000');call('hasMaterial');emit('85c0');rel('0f85','done');
 emit('31c04889442420488944242848894424504889442458');
 emit('488d4424404889442430');emit('48b801000000010000004889442438');
 rel('488d05','common');emit('4889442440');
 emit('48b807000000070000004889442448');
 emit('488d4c2420488d5424304183c8ff');call(0x1155960);
 // Compact selected IDs to materials only. Stable original goods are not re-added.
 emit('488b7424208b4c242831db31ff');
 label('filter');emit('39cb');rel('0f8d','filtered');
 emit('8b049e3d');u32(FIRST_ID);rel('0f82','next');emit('3d');u32(END_ID);rel('0f83','next');
 emit('8904beffc7');label('next');emit('ffc3');jump('filter');
 label('filtered');emit('897c242885ff');rel('0f84','cleanup');
 emit('488d4c2420488d542450');call(0x1356b50); // int array -> temporary FString
 emit('837c245801');rel('0f8e','cleanup');
 emit('4183bc249400000001');rel('0f8e','append');
 emit('498d8c248c000000');rel('488d15','comma');call(0x1bbe0);
 label('append');emit('498d8c248c000000488d542450');call(0x1bb10);
 emit('4c89e1498b0424ff5038'); // existing shop dirty notifier
 // Same dirty byte set by the original same-day refresh path.
 emit('c605');fixups.push({at:bytes.length,to:0xf8907e0,tail:1});u32(0);emit('01');
 label('cleanup');emit('488b4c24504885c9');rel('0f84','freeArray');call(0xdf5f0);
 label('freeArray');emit('488b4c24204885c9');rel('0f84','done');call(0xdf5f0);
 label('done');emit('488b4424604881c480000000415d415c5f5e5bc3');
 // Leaf FString scanner: exact comma-delimited 10-digit reserved IDs.
 // Invalid bounds/pointer fail closed (return true), never bootstrap over corruption.
 label('hasMaterial');emit('8b510885d2');rel('0f84','absent');rel('0f88','present');
 emit('81fa');u32(100000);rel('0f87','present');emit('4c8b014d85c0');rel('0f84','present');
 emit('31c94531c94531d2'); // index, digit count, numeric value
 label('scan');emit('39d1');rel('0f83','present');
 emit('410fb7044885c0');rel('0f84','endToken');emit('83f82c');rel('0f84','endToken');
 emit('83e83083f809');rel('0f87','present');
 emit('4183f90a');rel('0f83','present');
 emit('456bd20a4101c241ffc1ffc1');jump('scan');
 label('endToken');emit('4183f90a');rel('0f85','notReserved');
 emit('4181fa');u32(FIRST_ID);rel('0f82','notReserved');emit('4181fa');u32(END_ID);rel('0f82','present');
 label('notReserved');emit('85c0');rel('0f84','absent');
 emit('4531c94531d2ffc1');jump('scan');
 label('present');emit('b801000000c3');label('absent');emit('31c0c3');
 label('common');bytes.push(...Buffer.from('COMMON\0','utf16le'));
 label('comma');bytes.push(...Buffer.from(',\0','utf16le'));
 const code=Buffer.from(bytes);
 for(const f of fixups){const dest=typeof f.to==='string'?rva+labels.get(f.to):f.to;code.writeInt32LE(dest-(rva+f.at+4+(f.tail||0)),f.at);}
 const original=Buffer.alloc(5);original[0]=0xe8;original.writeInt32LE(DAILY_RVA-HOOK_RVA-5,1);
 const hook=Buffer.alloc(5);hook[0]=0xe8;hook.writeInt32LE(rva-HOOK_RVA-5,1);
 return {hookRva:HOOK_RVA,original,hook,caveRva:rva,code,scannerRva:rva+labels.get('hasMaterial')};
}
module.exports={buildMaterialBootstrap};

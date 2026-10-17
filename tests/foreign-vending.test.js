'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const owned=require('../shared/owned-functions'),variants=owned.group('vending','BrgGame.upk',91836),stock=variants[0].off;
const plan=require('../shared/foreign-vending-off.json');
const protectedByte=i=>i<0x30||i>=0x30+plan.scriptSize||Math.abs(i-(0x30+plan.at))<=16||plan.jumps.some(j=>i>=0x30+j.at-1&&i<0x30+j.at+2);
const offset=Array.from({length:stock.length-1000},(_,i)=>1000+i).find(i=>!protectedByte(i));assert(Number.isInteger(offset));
function foreign(){const b=Buffer.from(stock);b[offset]^=1;return b;}
test('unselected stock-layout UI edit is recognized as vending OFF, not an installed preset',()=>{const b=foreign();assert.notDeepEqual(b,stock);assert.equal(owned.recognize(b,variants),'off');assert.deepEqual(owned.merge(b,variants,'off'),b);});
test('installing any length-changing vending preset still rejects foreign UI instructions',()=>{const b=foreign();for(const p of variants)assert.throws(()=>owned.merge(b,variants,p.preset),/nothing overwritten|덮어쓰지/);assert.deepEqual(b,foreign());});
test('modified ON preset is never reclassified as OFF',()=>{for(const p of variants){const b=Buffer.from(p.on);b[offset]^=1;assert.equal(owned.recognize(b,variants),null);assert.throws(()=>owned.merge(b,variants,'off'),/conflict/);}});
for(const [name,at] of [['header',0x28],['bridge context',0x30+plan.at],['branch operand',0x30+plan.jumps[0].at],['function flags',stock.length-1]])test('foreign '+name+' conflict remains blocked',()=>{const b=Buffer.from(stock);b[at]^=1;assert.equal(owned.recognize(b,variants),null);assert.throws(()=>owned.merge(b,variants,'on'),/conflict/);});
test('resized foreign function and unrelated unknown vending function remain blocked',()=>{assert.equal(owned.recognize(Buffer.concat([foreign(),Buffer.alloc(1)]),variants),null);const other=owned.catalog.objects.find(p=>p.mod==='vending'&&p.index!==91836),v=owned.group(other.mod,other.file,other.index),b=Buffer.from(v[0].off);b[b.length-1]^=1;assert.equal(owned.recognize(b,v),null);});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {menu,choose}=require('../runtime/tfc-menu');
test('simple install/remove menu uses only the operation appropriate to each mod',()=>{
 for(const mod of ['guard','m2g']){assert.equal(menu(mod).commands['1'],'sync');assert.equal(menu(mod).commands['2'],'removed');}
 for(const mod of ['warp','vending']){assert.equal(menu(mod).commands['1'],'on');assert.equal(menu(mod).commands['2'],'off');}
 assert.match(menu('vending').text,/all 3/);assert.throws(()=>menu('bad'),/Unknown/);
 for(const mod of ['guard','m2g','warp','vending'])assert.equal(menu(mod).commands['5'],'prepare');
});
test('advanced actions remain available but separate from routine install',async()=>{
 for(const [key,expected]of Object.entries({'1':'relink','2':'restore','3':'recover','4':'detach','5':'repair-layout','0':'exit'})){
  const answers=['4',key],printed=[];
  assert.equal(await choose('vending',async()=>answers.shift(),s=>printed.push(s)),expected);
  assert.equal(printed.length,2);
 }
 assert.equal(await choose('guard',async()=>'0',()=>{}),'exit');
 await assert.rejects(()=>choose('guard',async()=>'9',()=>{}),/Choose/);
});

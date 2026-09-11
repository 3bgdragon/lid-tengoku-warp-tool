'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const safety=require('../restore-safety');
test('whole restore accepts exact snapshots and rejects later cross-tool changes',()=>{
 const game=fs.mkdtempSync(path.join(os.tmpdir(),'lid-restore-test-'));
 const rel='BrgGame/CookedPCConsole/BrgGame.upk',file=path.join(game,rel);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'before');
 const record={files:{},beforeSnapshot:safety.capture(game)};
 safety.assertSafe(record,game);
 fs.writeFileSync(file,'after');record.afterSnapshot=safety.capture(game);safety.assertSafe(record,game);
 const other=path.join(game,'BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk');fs.writeFileSync(other,'later warp');
 assert.throws(()=>safety.assertSafe(record,game),/다른 패치/);
 fs.unlinkSync(other);fs.writeFileSync(file,'external');
 assert.throws(()=>safety.assertSafe(record,game),/다른 패치/);
 fs.unlinkSync(file);fs.rmdirSync(path.dirname(file));fs.rmdirSync(path.join(game,'BrgGame'));fs.rmdirSync(game);
});
test('incomplete snapshot cannot authorize restore',()=>{
 assert.throws(()=>safety.assertSafe({files:{bad:{name:'unknown',sha1:'bad'}},beforeSnapshot:{}},__dirname),/복원/);
});


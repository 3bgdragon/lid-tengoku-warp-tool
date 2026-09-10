'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const compat = require('../compat/m2g');
const { profiles } = require('../compat/m2g/profiles.json');
const manifest = require('../assets/manifest-25136512.json');
test('reported hash identifies stock + M2G Node 1.1.0 exactly', () => {
  const p = compat.identify('F0439B6D568FF02E0E9488F4ED6323056C84F842');
  assert.equal(p.guard, 'off-off'); assert.equal(p.warp, false);
  assert.equal(p.baseSha1, manifest.brgGame.profiles['off-off'].baseSha1);
});
test('legacy reported hash is recognized but reapply targets Node encoding', () => {
  const p=compat.identify('E6954465DE2011C2B80E224AE86823B3DB7221B5');
  assert.equal(p.legacy,true);assert.equal(p.guard,'on-on');assert.equal(p.warp,true);
  assert.notEqual(compat.forBase(p.baseSha1).sha1,p.sha1);
  assert.ok(!compat.forBase(p.baseSha1).legacy);
});
test('all four guard combinations have paired reversible M2G warp states', () => {
  assert.equal(profiles.length, 16);
  assert.equal(new Set(profiles.map(p => p.sha1)).size, 16);
  for (const original of Object.values(manifest.brgGame.profiles)) {
    assert.ok(compat.forBase(original.baseSha1)); assert.ok(compat.forBase(original.patchedSha1));
  }
  for (const p of profiles) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(p.directory.map(d => d.offset), [0x75, 0x75 + 285 * 16]);
    for (const d of p.directory) assert.equal(Buffer.from(d.hex, 'hex').length, 16);
  }
});
test('unknown or damaged M2G input is never stripped or rebuilt', () => {
  assert.equal(compat.identify('0'.repeat(40)), null);
  assert.throws(() => compat.strip(Buffer.from('unrecognized')));
  assert.throws(() => compat.rebuild(Buffer.from('unrecognized')));
});
test('warp recognition retains guard identity and reports M2G correctly', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../lid-tengoku-warp.js'), 'utf8');
  const code = source.slice(source.indexOf('function identifyBrgGame('), source.indexOf('\nfunction identifyHeavenEntry('));
  for (const p of profiles) {
    const context = vm.createContext({ manifest, m2gCompat: compat, sha1File: () => p.sha1, fs: { statSync: () => ({size:1}) } });
    vm.runInContext(code, context);
    const result = context.identifyBrgGame('unused');
    assert.equal(result.enabled, p.warp); assert.equal(result.profile.m2g, true);
    assert.equal(result.profileName, `${p.guard} + M2G 나이프`);
    assert.equal(result.profile.baseSha1, compat.forBase(manifest.brgGame.profiles[p.guard].baseSha1).sha1);
  }
});

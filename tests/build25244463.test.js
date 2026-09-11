'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../assets/manifest-25244463.json');
test('25244463 remains opt-in and includes reversible assets for all targets', () => {
  assert.equal(m.steamBuildId, '25244463');
  assert.equal(m.releaseStatus, 'static-verified-awaiting-gameplay');
  assert.deepEqual(m.starts, [51, 101, 201, 301]);
  assert.equal(m.brgGame.profiles['off-off'].baseSha1, '3877130C584B2CBABB89A22DF1E7A0E437496B37');
  assert.equal(m.heavenEntry.baseSha1, '445F9105C395A6B44966F0A0DB8E449C5159367E');
  assert.deepEqual(Object.keys(m.brgGame.profiles).sort(), ['off-off', 'off-on', 'on-off', 'on-on']);
  for (const item of [...Object.values(m.brgGame.profiles), m.heavenEntry, m.brgStart, m.executable.native]) {
    for (const key of ['enablePatch', 'disablePatch']) {
      const data = fs.readFileSync(path.resolve(__dirname, '../assets', item[key]));
      assert.equal(data.subarray(0, 8).toString(), 'LIDBIN1\0');
    }
  }
});

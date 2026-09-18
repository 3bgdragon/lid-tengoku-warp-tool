'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../assets/manifest-25386710.json');

test('25386710 remains opt-in and includes reversible assets for all targets', () => {
  assert.equal(m.steamBuildId, '25386710');
  assert.equal(m.releaseStatus, 'static-verified-awaiting-gameplay');
  assert.deepEqual(m.starts, [51, 101, 201, 301]);
  assert.equal(m.brgGame.profiles['off-off'].baseSha1, 'C1C9738885B6672F61026A3767EAD65A08D7CD51');
  assert.equal(m.heavenEntry.baseSha1, '9E5922C1862DDC0E04964AAD701D85119AB012F1');
  assert.deepEqual(Object.keys(m.brgGame.profiles).sort(), ['off-off', 'off-on', 'on-off', 'on-on']);
  for (const item of [...Object.values(m.brgGame.profiles), m.heavenEntry, m.brgStart, m.executable.native]) {
    for (const key of ['enablePatch', 'disablePatch']) {
      const data = fs.readFileSync(path.resolve(__dirname, '../assets', item[key]));
      assert.equal(data.subarray(0, 8).toString(), 'LIDBIN1\0');
    }
  }
});

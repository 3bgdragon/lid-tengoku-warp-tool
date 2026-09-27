'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { configure, text } = require('../language');
const directory = path.resolve(__dirname, '..');
test('English and Korean status preserve paths and hashes', () => {
  const source = fs.readFileSync(path.join(directory, 'lid-tengoku-warp.js'), 'utf8');
  const fragment = source.slice(source.indexOf('function profileLabel('), source.indexOf('function assertSupported('));
  const status = { gameDirectory: 'C:/한글 경로', coherent: false, brgGame: { profileName: null, hash: '0123ABC' }, heavenEntry: { enabled: null, hash: 'DEF456' }, executable: { native: { enabled: false }, valid: true } };
  try {
    for (const language of ['ko', 'en']) {
      configure(['--lang', language], directory);
      const lines = [];
      const context = vm.createContext({ t: text, manifest: { gameVersion: 'test' }, console: { log: value => lines.push(value) } });
      vm.runInContext(fragment, context);
      context.printStatus(status);
      const output = lines.join('\n');
      assert.ok(output.includes(status.gameDirectory));
      assert.match(output, /0123ABC/);
      assert.match(output, /DEF456/);
      if (language === 'en') assert.doesNotMatch(output.replace(status.gameDirectory, ''), /[가-힣]/);
      else assert.match(output, /일반 텐고쿠 시작층 선택/);
    }
  } finally { configure(['--lang', 'ko'], directory); }
});
test('English menu consumes choices without invoking a patch when exiting', async () => {
  const source = fs.readFileSync(path.join(directory, 'lid-tengoku-warp.js'), 'utf8');
  const fragment = source.slice(source.indexOf('async function interactive('), source.indexOf('\nasync function main()'));
  configure(['--lang', 'en'], directory);
  try {
    const lines = [];
    const context = vm.createContext({ t: text, readStatus: () => ({}), printStatus: () => {}, console: { log: value => lines.push(value) } });
    vm.runInContext(fragment, context);
    await context.interactive('unused', { question: async prompt => { lines.push(prompt); return '6'; } });
    assert.doesNotMatch(lines.join('\n'), /[가-힣]/);
    assert.match(lines.join('\n'), /Restore latest backup/);
  } finally { configure(['--lang', 'ko'], directory); }
});
test('localized backup message creates exactly one backup', async () => {
  const source = fs.readFileSync(path.join(directory, 'lid-tengoku-warp.js'), 'utf8');
  const fragment = source.slice(source.indexOf('async function interactive('), source.indexOf('\nasync function main()'));
  try {
    for (const language of ['ko', 'en']) {
      configure(['--lang', language], directory);
      const answers = ['3', '6']; let calls = 0;
      const context = vm.createContext({ t: text, readStatus: () => ({}), printStatus: () => {}, console: { log: () => {} }, createBackup: () => { calls++; return 'C:/backup'; } });
      vm.runInContext(fragment, context);
      await context.interactive('unused', { question: async () => answers.shift() });
      assert.equal(calls, 1);
    }
  } finally { configure(['--lang', 'ko'], directory); }
});

'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

for (const accepted of [true, false]) {
  test(`interactive experimental application requires consent: ${accepted}`, async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../lid-tengoku-warp.js'), 'utf8');
    const start = source.indexOf('async function interactive(');
    const end = source.indexOf('\nasync function main()', start);
    const calls = [];
    const messages = [];
    const answers = ['1', '6'];
    const context = vm.createContext({
      manifest: { releaseStatus: 'static-verified-awaiting-gameplay' },
      readStatus: () => ({}), printStatus: () => {},
      console: { log: (message) => messages.push(message) },
      confirm: async (_rl, question, assumeYes) => {
        assert.match(question, /시험 적용에 동의/);
        assert.equal(assumeYes, false);
        assert.ok(messages.some((message) => message.includes('전체 경로는 검증 중')));
        return accepted;
      },
      setPatchState: (...args) => { calls.push(args); return { changed: false }; },
    });
    vm.runInContext(source.slice(start, end), context);
    await context.interactive('test-install', { question: async () => answers.shift() });
    assert.deepEqual(calls, accepted ? [['test-install', true, true]] : []);
  });
}

test('unverified routing cannot modify even a user-confirmed installation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lid-routing-safety-'));
  const relativePaths = ['BrgGame/CookedPCConsole/BrgGame.upk',
    'BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk',
    'BrgGame/CookedPCConsole/BrgStart_PL.upk', 'Binaries/Win64/BrgGame-Steam.exe'];
  try {
    for (const relative of relativePaths) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `sentinel:${relative}`);
    }
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../lid-tengoku-warp.js'),
      'apply', '--yes', '--game', root], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /개발판의 적용을 차단/);
    for (const relative of relativePaths) {
      assert.equal(fs.readFileSync(path.join(root, relative), 'utf8'), `sentinel:${relative}`);
    }
  } finally {
    // Only this test-created, absolute mkdtemp directory is removed.
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('lid-routing-safety-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
test('English launcher forwards language and quoted installation paths from checkout and Git ZIP bytes', { skip: process.platform !== 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lid-warp-launcher-'));
  try {
    fs.writeFileSync(path.join(directory, 'lid-tengoku-warp.js'), 'console.log("ARGV:"+JSON.stringify(process.argv.slice(2)));');
    const variants = [fs.readFileSync(path.join(root, 'run-en.bat')), execFileSync('git', ['show', 'HEAD:run-en.bat'], { cwd: root })];
    const installation = path.join(directory, '한글 경로', 'LET IT DIE');
    for (const bytes of variants) {
      const bat = path.join(directory, 'run-en.bat'); fs.writeFileSync(bat, bytes);
      const command = `""${bat}" status --game "${installation}""`;
      const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], { windowsVerbatimArguments: true, encoding: 'utf8', input: '\r\n', timeout: 10000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const line = result.stdout.split(/\r?\n/).find(value => value.startsWith('ARGV:'));
      assert.ok(line, result.stdout + result.stderr);
      assert.deepEqual(JSON.parse(line.slice(5)), ['--lang', 'en', 'status', '--game', installation]);
    }
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('lid-warp-launcher-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

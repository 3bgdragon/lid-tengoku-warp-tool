'use strict';
// Manual real-file regression runner. Reads archived installations and patches
// only fresh copies. Usage: node tests/run-distribution-integration.js [roots...]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createRequire } = require('node:module'), { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..'), parent = path.dirname(repo);
const ordersOnly = process.argv.includes('--orders-only');
const sources = process.argv.slice(2).filter(p => p !== '--orders-only').map(p => path.resolve(p));
if (!sources.length) throw Error('Pass archived installation roots; do not use live game files as output.');
fs.mkdirSync(path.join(repo, '.integration-temp'), { recursive: true });
const work = fs.mkdtempSync(path.join(repo, '.integration-temp/distribution-'));
const relative = ['BrgGame/CookedPCConsole/BrgGame.upk', 'BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk',
  'BrgGame/CookedPCConsole/BrgStart_PL.upk', 'Binaries/Win64/BrgGame-Steam.exe', 'BrgGame/CookedPCConsole/AS_CH_Main_Male_Common_SF.upk'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const snapshot = dir => Object.fromEntries(relative.filter(p => fs.existsSync(path.join(dir, p))).map(p => [p, hash(path.join(dir, p))]));
const results = [];
function load(directory, entry, symbols, backups) {
  const script = path.join(directory, entry), context = vm.createContext({ require: createRequire(script), __dirname: directory, Buffer, process, console, backups });
  vm.runInContext(fs.readFileSync(script, 'utf8').split('main().catch(')[0] + `\nisGameRunning=()=>false;backupRoot=()=>backups;globalThis.api={${symbols}};`, context);
  return context.api;
}
function clone(source, name) {
  const destination = path.join(work, name);
  for (const item of relative) {
    const from = path.join(source, item); if (!fs.existsSync(from)) continue;
    const to = path.join(destination, item); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to);
  }
  return destination;
}
function removeOwn(directory) {
  assert.ok(path.resolve(directory).startsWith(work + path.sep), 'Cleanup must stay in this fresh test directory');
  fs.rmSync(directory, { recursive: true, force: true });
}
function record(value) {
  results.push(value); fs.writeFileSync(path.join(work, 'results.json'), JSON.stringify({ results }, null, 2));
  console.log('PASS', JSON.stringify(value));
}
function statusProcess(game, language, bat = false) {
  const args = ['status', '--game', game];
  const command = bat ? process.env.ComSpec : process.execPath;
  const invocation = bat ? ['/d', '/s', '/c', `""${path.join(repo, 'run-en.bat')}" status --game "${game}""`] : [path.join(repo, 'lid-tengoku-warp.js'), ...args, '--lang', language];
  const child = spawnSync(command, invocation, { encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: bat, input: '\r\n', timeout: 30000 });
  assert.equal(child.status, 0, child.stdout + child.stderr + (child.error || ''));
  assert.match(child.stdout, language === 'en' ? /Executable hash links: Valid/ : /실행 파일 해시 연결: 정상/);
  return child.stdout;
}
for (let n = 0; !ordersOnly && n < sources.length; n++) {
  const source = sources[n], before = snapshot(source), backup = path.join(work, `build-${n}-backups`);
  const api = load(repo, 'lid-tengoku-warp.js', 'setPatchState,restoreBackup,readStatus', backup);
  const game = clone(source, `build-${n}`);
  assert.equal(api.readStatus(game).coherent, true, source);
  api.setPatchState(game, false, true);
  const clean = snapshot(game);
  for (const language of ['ko', 'en']) {
    require('../language').configure(['--lang', language], repo);
    const applied = api.setPatchState(game, true, true);
    assert.equal(applied.changed, true);
    assert.equal(applied.status.coherent, true);
    const patched = snapshot(game), output = statusProcess(game, language);
    assert.equal(api.setPatchState(game, true, true).changed, false);
    assert.deepEqual(snapshot(game), patched);
    api.restoreBackup(game, applied.backupPath);
    assert.deepEqual(snapshot(game), clean);
    api.setPatchState(game, true, true);
    const removed = api.setPatchState(game, false, true);
    assert.deepEqual(snapshot(game), clean);
    api.restoreBackup(game, removed.backupPath);
    assert.equal(api.readStatus(game).coherent, true);
    api.setPatchState(game, false, true);
    assert.deepEqual(snapshot(game), clean);
    record({ source: n, language, apply: true, freshProcessStatus: true, idempotent: true, removeExact: true, fullRestoreExact: true, variant: output.split('\n').find(line => /variant:|변형:/.test(line)) });
    if (language === 'en' && process.platform === 'win32') { statusProcess(game, 'en', true); record({ source: n, englishBat: true }); }
    removeOwn(backup);
  }
  assert.deepEqual(snapshot(source), before);
  removeOwn(game);
}
// Exercise every installation order on the newest supplied, unmodified source.
const source = sources.at(-1), original = snapshot(source);
const guardRepo = path.join(parent, 'lid-justguard-tool'), m2g = require(path.join(parent, 'lid-m2g-knife-only/tool'));
require('../language').configure(['--lang', 'en'], repo);
require(path.join(guardRepo, 'language')).configure(['--lang', 'en'], guardRepo);
require(path.join(parent, 'lid-m2g-knife-only/language')).configure(['--lang', 'en'], path.join(parent, 'lid-m2g-knife-only'));
let canonical;
for (const order of ['GWM', 'GMW', 'WGM', 'WMG', 'MGW', 'MWG']) {
  const game = clone(source, order), mb = path.join(work, order + '-m'), wb = path.join(work, order + '-w'), gb = path.join(work, order + '-g');
  const warp = load(repo, 'lid-tengoku-warp.js', 'setPatchState,restoreBackup,readStatus', wb);
  const guard = load(guardRepo, 'lid-justguard.js', 'applySettings,restoreBackup,readStatus', gb);
  if (m2g.inspectStatus(m2g.readPair(game)).applied) m2g.remove(game, mb, { running: () => false });
  warp.setPatchState(game, false, true); guard.applySettings(game, 'stock', 'off', 'off');
  const clean = snapshot(game); let first;
  function apply(action) {
    if (action === 'G') return guard.applySettings(game, 'soft', 'on', 'on').backupPath;
    if (action === 'W') return warp.setPatchState(game, true, true).backupPath;
    return m2g.apply(game, mb, { running: () => false });
  }
  for (const action of order) { const backup = apply(action); if (action === order[0]) first = backup; }
  assert.equal(warp.readStatus(game).coherent, true);
  assert.equal(guard.readStatus(game).groggy.m2g, true);
  assert.equal(m2g.inspectStatus(m2g.readPair(game)).applied, true);
  const applied = snapshot(game); canonical ||= applied; assert.deepEqual(applied, canonical);
  statusProcess(game, 'en');
  const restore = () => order[0] === 'G' ? guard.restoreBackup(game, first) : order[0] === 'W' ? warp.restoreBackup(game, first) : m2g.restore(game, mb, { running: () => false });
  assert.throws(restore, /changed|restore|restor|Another/);
  assert.deepEqual(snapshot(game), applied);
  for (const action of [...order].reverse()) {
    if (action === 'G') guard.applySettings(game, 'stock', 'off', 'off');
    else if (action === 'W') warp.setPatchState(game, false, true);
    else m2g.remove(game, mb, { running: () => false });
  }
  assert.deepEqual(snapshot(game), clean);
  record({ order, englishMap: true, freshProcessStatus: true, identicalCombinedFiles: true, reverseRemovalExact: true, unsafeRestoreBlocked: true });
  for (const item of [game, mb, wb, gb]) if (fs.existsSync(item)) removeOwn(item);
}
assert.deepEqual(snapshot(source), original);
require('../language').configure(['--lang', 'ko'], repo);
console.log('All real-copy checks passed; source files unchanged. Report:', path.join(work, 'results.json'));

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..'), script = path.join(root, 'lid-tengoku-warp.js');
function load() {
  const context = vm.createContext({ require: createRequire(script), __dirname: root, Buffer, process, console });
  vm.runInContext(fs.readFileSync(script, 'utf8').split('\nmain().catch')[0] + '\nglobalThis.api={manifestDigestOffsets,inspectExecutable,identifyNativeExecutable,setManifest:m=>manifest=m};', context);
  return context.api;
}
const cases = [
  ['manifest.json', '.integration-temp/BrgGame-Steam.inputfix.exe'],
  ['manifest-25136512.json', '.integration-temp/m2g-order-pofYaV/game/Binaries/Win64/BrgGame-Steam.exe'],
  ['manifest-25244463.json', '.integration-temp/build25244463/native.patched.exe'],
  ['manifest-25386710.json', '.integration-temp/build25386710/native.patched.exe'],
];
for (const [file, fixture] of cases) {
  test(`real executable manifest and native routing: ${file}`, { skip: !fs.existsSync(path.join(root, fixture)) }, () => {
    const api = load(), manifest = require('../assets/' + file), executable = fs.readFileSync(path.join(root, fixture));
    api.setManifest(manifest);
    const hashes = {};
    for (const [name, count] of Object.entries(manifest.executable.manifestEntries)) {
      const offsets = api.manifestDigestOffsets(executable, name, count);
      hashes[name] = executable.subarray(offsets[0], offsets[0] + 20).toString('hex').toUpperCase();
    }
    const status = api.inspectExecutable(path.join(root, fixture), hashes);
    assert.equal(status.valid, true);
    assert.notEqual(status.native.enabled, null);
  });
}
test('reported zero-entry error rejects a different executable before patching', () => {
  const api = load();
  assert.throws(() => api.manifestDigestOffsets(Buffer.from('MZ unrelated executable'), 'brggame.upk', 2), /2.*0/);
});

test('zero-entry inspection includes actionable EXE diagnostics without changing it', () => {
  const os = require('node:os'), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lid-zero-entry-'));
  try {
    const file = path.join(directory, 'BrgGame-Steam.exe'), bytes = Buffer.from('MZ unrelated executable');fs.writeFileSync(file, bytes);
    const api = load();
    assert.throws(() => api.inspectExecutable(file, {}), error => {
      assert.equal(error.executableDiagnostics.size, bytes.length);
      assert.equal(error.executableDiagnostics.packageNames['brggame.upk'].asciiLower, 0);
      assert.ok(error.message.includes(file));assert.match(error.message, /SHA-256/);return true;
    });
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.throws(() => api.manifestDigestOffsets(Buffer.from('brggame.upk\0brggame.upk\0'), 'brggame.upk', 2), /truncated|잘렸/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

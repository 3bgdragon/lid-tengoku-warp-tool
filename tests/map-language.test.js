'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..'), localization = require('../map-language');
const { unpack } = require('../compat/m2g/package-patch');
const { configure } = require('../language');
const cases = [['manifest.json', '.integration-temp/Heaven_A01_ST_COL.v111.packed.upk'], ...['25136512', '25244463', '25386710'].map(build => [`manifest-${build}.json`, `.integration-temp/build${build}/Heaven_A01_ST_COL.patched.upk`])];
for (const [manifestFile, fixture] of cases) {
  test(`real-copy English map conversion and exact restore: ${manifestFile}`, { skip: !fs.existsSync(path.join(root, fixture)) }, () => {
    const manifest = require('../assets/' + manifestFile), ko = fs.readFileSync(path.join(root, fixture));
    const en = localization.toEnglish(ko, manifest.heavenEntry.patchedSha1);
    assert.deepEqual(localization.toKorean(en, manifest.heavenEntry.patchedSha1), ko);
    for (let i = 0; i < 2; i++) {
      const raw = bytes => unpack(bytes, Array.from({ length: 4 }, (_, j) => bytes.readUInt32LE(0x75 + i * 16 + j * 4)));
      const before = raw(ko), expected = Buffer.from(before), after = raw(en);
      for (const [from, to] of localization.labels) {
        const needle = Buffer.from(from + '\0', 'utf16le'); let at = 0;
        while ((at = expected.indexOf(needle, at)) !== -1) {
          Buffer.from(to.padEnd(from.length) + '\0', 'utf16le').copy(expected, at); at += needle.length;
        }
      }
      assert.deepEqual(after, expected, 'Only menu string bytes may change');
    }
    const script = path.join(root, 'lid-tengoku-warp.js');
    const context = vm.createContext({ require: createRequire(script), __dirname: root, Buffer, process, console });
    vm.runInContext(fs.readFileSync(script, 'utf8').split('\nmain().catch')[0] + '\nglobalThis.api={makeHeavenTemp,identifyHeavenEntry,readPatch,setManifest:m=>manifest=m};', context);
    const api = context.api; api.setManifest(manifest);
    const patch = api.readPatch(manifest.heavenEntry.disablePatch), base = Buffer.alloc(patch.targetSize); ko.copy(base);
    for (const entry of patch.entries) entry.payload.copy(base, entry.offset);
    assert.equal(localization.sha(base), manifest.heavenEntry.baseSha1);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lid-map-language-')), source = path.join(dir, 'map.upk'), target = path.join(dir, 'output.upk');
    try {
      fs.writeFileSync(source, base); configure(['--lang', 'en'], root);
      api.makeHeavenTemp(source, manifest.heavenEntry.enablePatch, manifest.heavenEntry.patchedSha1, target, true);
      assert.deepEqual(fs.readFileSync(target), en);
      assert.equal(api.identifyHeavenEntry(target).language, 'en');
      fs.renameSync(target, source);
      configure(['--lang', 'ko'], root);
      api.makeHeavenTemp(source, null, manifest.heavenEntry.patchedSha1, target, true);
      assert.deepEqual(fs.readFileSync(target), ko);
      fs.unlinkSync(target);
      api.makeHeavenTemp(source, manifest.heavenEntry.disablePatch, manifest.heavenEntry.baseSha1, target, false);
      assert.deepEqual(fs.readFileSync(target), base);
      const corrupt = Buffer.from(en); corrupt[corrupt.length - 1] ^= 1;
      assert.throws(() => localization.toKorean(corrupt, manifest.heavenEntry.patchedSha1), /Unsupported/);
    } finally {
      configure(['--lang', 'ko'], root);
      assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
      assert.ok(path.basename(dir).startsWith('lid-map-language-'));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

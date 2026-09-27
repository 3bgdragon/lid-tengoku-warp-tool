'use strict';
const { createHash } = require('node:crypto');
const { unpack, pack } = require('./compat/m2g/package-patch');
const profiles = require('./assets/map-languages.json');
const sha = bytes => createHash('sha1').update(bytes).digest('hex').toUpperCase();
const labels = [
  ['51층부터 시작', 'From 51F'],
  ['100층 구간 건너뛰기 (101층)', 'Start at 101F'],
  ['200층 구간 건너뛰기 (201층)', 'Start at 201F'],
  ['300층 구간 건너뛰기 (301층)', 'Start at 301F'],
];
// Fixed-width UTF-16 replacements retain FString lengths, export offsets and
// every Kismet route/control-flow byte. Only modified chunks are recompressed.
function buildEnglish(source, expectedSourceHash) {
  if (sha(source) !== expectedSourceHash) throw Error('Map language source hash mismatch');
  if (source.readUInt32LE() !== 0x9e2a83c1 || source.readUInt32LE(0x6d) !== 2 || source.readUInt32LE(0x71) !== 2) throw Error('Unsupported translated-map layout');
  const output = Buffer.from(source), append = [], restore = [], counts = labels.map(() => 0);
  let physical = source.length;
  for (let i = 0; i < 2; i++) {
    const slot = 0x75 + i * 16, entry = Array.from({ length: 4 }, (_, j) => source.readUInt32LE(slot + j * 4));
    const raw = unpack(source, entry); let changed = false;
    for (let n = 0; n < labels.length; n++) {
      const [ko, en] = labels[n];
      if (en.length > ko.length) throw Error('Map translation exceeds fixed-width slot');
      const needle = Buffer.from(ko + '\0', 'utf16le'), replacement = Buffer.from(en.padEnd(ko.length) + '\0', 'utf16le');
      let at = 0;
      while ((at = raw.indexOf(needle, at)) !== -1) {
        if (at < 4 || raw.readInt32LE(at - 4) !== -(ko.length + 1)) throw Error('Map FString header mismatch');
        replacement.copy(raw, at); changed = true; counts[n]++; at += needle.length;
      }
    }
    if (changed) {
      const encoded = pack(raw);
      restore.push({ offset: slot + 8, bytes: source.subarray(slot + 8, slot + 16).toString('hex') });
      output.writeUInt32LE(physical, slot + 8); output.writeUInt32LE(encoded.length, slot + 12);
      append.push(encoded); physical += encoded.length;
    }
  }
  // Each label occurs in the name table and in its menu string property.
  if (counts.some(n => n !== 2)) throw Error('Map translation signature count mismatch');
  return { bytes: Buffer.concat([output, ...append]), restore };
}
function identify(hash, koreanHash) {
  return profiles.find(p => p.englishSha1 === hash && p.koreanSha1 === koreanHash);
}
function toKorean(source, koreanHash) {
  if (sha(source) === koreanHash) return source;
  const profile = identify(sha(source), koreanHash);
  if (!profile || source.length !== profile.englishSize) throw Error('Unsupported English map');
  const result = Buffer.from(source.subarray(0, profile.koreanSize));
  for (const entry of profile.restore) Buffer.from(entry.bytes, 'hex').copy(result, entry.offset);
  if (sha(result) !== koreanHash) throw Error('English map normalization verification failed');
  return result;
}
function toEnglish(source, koreanHash) {
  const profile = profiles.find(p => p.koreanSha1 === koreanHash);
  if (!profile) throw Error('No English map profile for this build');
  const result = buildEnglish(source, koreanHash).bytes;
  if (sha(result) !== profile.englishSha1) throw Error('English map verification failed');
  return result;
}
module.exports = { buildEnglish, toEnglish, toKorean, identify, sha, labels };

'use strict';

const { createHash } = require('node:crypto');
const { lzo1xCompress, lzo1xDecompress } = require('./vendor/lzo1x/dist/index.cjs');
const { patchPlayShot } = require('./bytecode');
const TAG = 0x9e2a83c1;
const PLAY_OFFSET = 0xffc020, PLAY_SIZE = 0xf4, EXPORT_SLOT = 0x3cf64b;
const PLAY_HASH = 'd1700b21bef4f3b9933e5f5f7382209775d086219defaa44dc9d7d0e510a859d';
const CHECK_OFFSET = 0x12cc5d2, CHECK_SIZE = 0x94;
const CHECK_HASH = '46f89feed0c8bd0577bcca550071a590a29abcf5407ee178a37f600c27ebc7a2';
const sha = data => createHash('sha256').update(data).digest('hex');
function words(...values) {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((n, i) => b.writeUInt32LE(n, i * 4));
  return b;
}
function entries(data) {
  if (data.length < 0x75 || data.readUInt32LE() !== TAG) throw new Error('Not a UE3 package');
  if (data.readUInt32LE(0x6d) !== 2) throw new Error('Expected LZO package');
  const count = data.readUInt32LE(0x71);
  if (count !== 286 || data.readUInt32LE(0x21) !== 173666) throw new Error('Unsupported game build (expected 25136512 layout)');
  if (data.length < 0x75 + count * 16) throw new Error('Truncated chunk directory');
  const result = []; let lastEnd;
  for (let i = 0; i < count; i++) {
    const entry = Array.from({ length: 4 }, (_, n) => data.readUInt32LE(0x75 + i * 16 + n * 4));
    const [logical, size, physical, packed] = entry;
    if (!size || size > 64 * 1024 * 1024 || physical < 0x75 + count * 16 || physical + packed > data.length || packed < 16 || logical + size > 0xffffffff) throw new Error('Invalid compressed chunk range');
    if (lastEnd !== undefined && logical !== lastEnd) throw new Error('Non-contiguous logical package');
    lastEnd = logical + size; result.push(entry);
  }
  return result;
}
function unpack(data, entry) {
  const [, expected, offset, packedSize] = entry;
  if (offset < 0 || packedSize < 16 || offset + packedSize > data.length) throw new Error('Invalid LZO range');
  const tag = data.readUInt32LE(offset), block = data.readUInt32LE(offset + 4);
  const compressedTotal = data.readUInt32LE(offset + 8), total = data.readUInt32LE(offset + 12);
  if (tag !== TAG || total !== expected || total > 64 * 1024 * 1024 || block < 1 || block > 1048576) throw new Error('Invalid LZO header');
  const count = Math.ceil(total / block);
  let cursor = offset + 16 + count * 8, written = 0, payloadTotal = 0;
  if (cursor > offset + packedSize) throw new Error('Truncated LZO block table');
  const out = Buffer.alloc(total);
  for (let i = 0; i < count; i++) {
    const length = data.readUInt32LE(offset + 16 + i * 8), rawSize = data.readUInt32LE(offset + 20 + i * 8);
    if (!length || rawSize !== Math.min(block, total - written) || cursor + length > offset + packedSize) throw new Error('Invalid LZO block size');
    const payload = data.subarray(cursor, cursor + length);
    const decoded = length === rawSize ? payload : lzo1xDecompress(payload, rawSize);
    if (decoded.length !== rawSize) throw new Error('Invalid decompressed size');
    out.set(decoded, written); written += rawSize; cursor += length; payloadTotal += length;
  }
  if (cursor !== offset + packedSize || payloadTotal !== compressedTotal) throw new Error('Unexpected compressed size/trailing data');
  return out;
}
function pack(raw, block = 131072) {
  if (!Number.isInteger(block) || block < 1 || block > 131072) throw new Error('Invalid output block size');
  const blocks = [], sizes = [];
  for (let offset = 0; offset < raw.length; offset += block) {
    const piece = raw.subarray(offset, offset + block), compressed = Buffer.from(lzo1xCompress(piece));
    const payload = compressed.length < piece.length ? compressed : piece;
    // Verify every encoded block before it can be written into a game package.
    if (payload !== piece && !Buffer.from(lzo1xDecompress(payload, piece.length)).equals(piece)) throw new Error('LZO compression verification failed');
    blocks.push(payload); sizes.push(words(payload.length, piece.length));
  }
  return Buffer.concat([words(TAG, block, blocks.reduce((n, b) => n + b.length, 0), raw.length), ...sizes, ...blocks]);
}
function readAt(data, table, offset, size) {
  for (let index = 0; index < table.length; index++) {
    const [logical, length] = table[index];
    if (logical <= offset && offset + size <= logical + length) {
      const raw = unpack(data, table[index]);
      return { index, raw, data: raw.subarray(offset - logical, offset - logical + size) };
    }
  }
  throw new Error('Requested object crosses chunk boundary');
}
function build(source) {
  const table = entries(source), original = readAt(source, table, PLAY_OFFSET, PLAY_SIZE).data;
  const check = readAt(source, table, CHECK_OFFSET, CHECK_SIZE).data;
  if (sha(original) !== PLAY_HASH || sha(check) !== CHECK_HASH) throw new Error('지원되지 않거나 변경된 M2G 함수입니다. 파일을 변경하지 않았습니다.');
  const exp = readAt(source, table, EXPORT_SLOT + 32, 8);
  if (!exp.data.equals(words(PLAY_SIZE, PLAY_OFFSET))) throw new Error('이미 적용됐거나 지원되지 않는 PlayShot 위치입니다.');
  const replacement = patchPlayShot(original), last = table.length - 1;
  const newOffset = table[last][0] + table[last][1];
  const final = Buffer.concat([unpack(source, table[last]), replacement]);
  words(replacement.length, newOffset).copy(exp.raw, EXPORT_SLOT + 32 - table[exp.index][0]);
  const out = Buffer.from(source), append = []; let physical = out.length;
  for (const [index, raw] of [[exp.index, exp.raw], [last, final]]) {
    const compressed = pack(raw);
    words(table[index][0], raw.length, physical, compressed.length).copy(out, 0x75 + index * 16);
    append.push(compressed); physical += compressed.length;
  }
  const result = Buffer.concat([out, ...append]);
  if (!readAt(result, entries(result), newOffset, replacement.length).data.equals(replacement)) throw new Error('Patched package verification failed');
  return result;
}
function linkExecutable(source, before, after) {
  if (source.subarray(0, 2).toString('ascii') !== 'MZ') throw new Error('Not a Windows executable');
  const needle = Buffer.from('brggame.upk\0'), locations = []; let cursor = 0;
  while (true) {
    const at = source.indexOf(needle, cursor);
    if (at < 0) break;
    cursor = at + needle.length; locations.push(cursor);
  }
  if (locations.length !== 2) throw new Error('Unexpected executable manifest entry count');
  const oldHash = createHash('sha1').update(before).digest(), newHash = createHash('sha1').update(after).digest();
  const result = Buffer.from(source);
  for (const offset of locations) {
    if (!source.subarray(offset, offset + 20).equals(oldHash)) throw new Error('Executable package hash does not match');
    newHash.copy(result, offset);
  }
  return result;
}
module.exports = { sha, entries, unpack, pack, readAt, build, linkExecutable, PLAY_OFFSET, PLAY_SIZE, EXPORT_SLOT };

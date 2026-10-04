'use strict';
const { text: t } = require('../../language');

const { createHash } = require('node:crypto');
const { lzo1xCompress, lzo1xDecompress } = require('./vendor/lzo1x/dist/index.cjs');
const { patchPlayShot } = require('./bytecode');
const TAG = 0x9e2a83c1;

const LAYOUTS = {
  173666: {
    exportCount: 173666,
    exportSlot: 0x3cf64b,
    playOffset: 0xffc020,
    playSize: 0xf4,
    playHash: 'd1700b21bef4f3b9933e5f5f7382209775d086219defaa44dc9d7d0e510a859d',
    checkOffset: 0x12cc5d2,
    checkSize: 0x94,
    checkHash: '46f89feed0c8bd0577bcca550071a590a29abcf5407ee178a37f600c27ebc7a2',
    playerClassIndex: 53632,
    pawnIndex: 9431,
    atkTypeIndex: 9325,
    commonPawnIndex: 9428,
    setBulletName: 62614,
    playAnimName: 57693,
    reflectSkillName: 59818,
  },
  173671: {
    exportCount: 173671,
    exportSlot: 0x3cf700,
    playOffset: 0xffc23d,
    playSize: 0xf4,
    playHash: 'b81b4b96b0d20c15d3a66a49b7ce2da140e902d3eabb4d58f0cc18453cb799cc',
    checkOffset: 0x12cc85e,
    checkSize: 0x94,
    checkHash: 'e9671b9d3c7a065025f96ecace016cfa034216477ac9d2072e88c9448a93e94f',
    playerClassIndex: 53637,
    pawnIndex: 9431,
    atkTypeIndex: 9325,
    commonPawnIndex: 9428,
    setBulletName: 62616,
    playAnimName: 57695,
    reflectSkillName: 59820,
  }
};

const sha = data => createHash('sha256').update(data).digest('hex');

function words(...values) {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((n, i) => b.writeUInt32LE(n, i * 4));
  return b;
}

function getLayout(data) {
  const count = data.readUInt32LE(0x71);
  const exportCount = data.readUInt32LE(0x21);
  if (count !== 286 || !LAYOUTS[exportCount]) {
    throw new Error(`Unsupported game build (chunk count ${count}, export count ${exportCount})`);
  }
  return LAYOUTS[exportCount];
}

function entries(data) {
  if (data.length < 0x75 || data.readUInt32LE() !== TAG) throw new Error('Not a UE3 package');
  if (data.readUInt32LE(0x6d) !== 2) throw new Error('Expected LZO package');
  getLayout(data);
  const count = data.readUInt32LE(0x71);
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
  const layout = getLayout(source);
  const table = entries(source), original = readAt(source, table, layout.playOffset, layout.playSize).data;
  const check = readAt(source, table, layout.checkOffset, layout.checkSize).data;
  if (sha(original) !== layout.playHash || sha(check) !== layout.checkHash) throw new Error(t('지원되지 않거나 변경된 M2G 함수입니다. 파일을 변경하지 않았습니다.', 'Unsupported or modified M2G functions. No files were changed.'));
  const exp = readAt(source, table, layout.exportSlot + 32, 8);
  if (!exp.data.equals(words(layout.playSize, layout.playOffset))) throw new Error(t('이미 적용됐거나 지원되지 않는 PlayShot 위치입니다.', 'PlayShot is already patched or has an unsupported location.'));
  const replacement = patchPlayShot(original, layout), last = table.length - 1;
  const newOffset = table[last][0] + table[last][1];
  const final = Buffer.concat([unpack(source, table[last]), replacement]);
  words(replacement.length, newOffset).copy(exp.raw, layout.exportSlot + 32 - table[exp.index][0]);
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
  const entries = require('../../shared/kernel/src/executable-links').digestEntries(source, 'brggame.upk', 2);
  const oldHash = createHash('sha1').update(before).digest(), newHash = createHash('sha1').update(after).digest();
  const result = Buffer.from(source);
  for (const {offset, checked} of entries) {
    if (checked && !source.subarray(offset, offset + 20).equals(oldHash)) throw new Error('Executable package hash does not match');
    newHash.copy(result, offset);
  }
  return result;
}

// Keep 25136512 constants for backwards compatibility with existing tests
module.exports = {
  sha, entries, unpack, pack, readAt, build, linkExecutable,
  PLAY_OFFSET: LAYOUTS[173666].playOffset,
  PLAY_SIZE: LAYOUTS[173666].playSize,
  EXPORT_SLOT: LAYOUTS[173666].exportSlot,
  LAYOUTS, getLayout
};

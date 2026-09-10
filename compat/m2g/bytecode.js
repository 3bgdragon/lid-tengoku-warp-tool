'use strict';

// UE3 object references occupy 4 bytes on disk but 8 bytes at runtime.
// Absolute jumps and context skips use runtime positions, NOT disk offsets.
function inspect(code) {
  let cursor = 0, memory = 0;
  const jumps = [], boundaries = new Set();
  function take(count, runtime = count) {
    if (cursor + count > code.length) throw new Error('Truncated bytecode');
    const data = code.subarray(cursor, cursor + count);
    cursor += count; memory += runtime;
    return data;
  }
  function expression(depth = 0) {
    if (depth > 128) throw new Error('Bytecode nesting limit');
    boundaries.add(memory);
    const token = take(1)[0], expr = () => expression(depth + 1);
    if ([0x00, 0x01, 0x3a].includes(token)) take(4, 8);
    else if ([0x06, 0x07].includes(token)) {
      const at = cursor, target = take(2).readUInt16LE();
      jumps.push([at, target]);
      if (token === 0x07) expr();
    } else if ([0x0f, 0x14].includes(token)) { expr(); expr(); }
    else if ([0x04, 0x2d].includes(token)) expr();
    else if (token === 0x19) {
      expr();
      const skip = take(2).readUInt16LE();
      take(4, 8); take(1);
      const start = memory;
      expr();
      if (memory - start !== skip) throw new Error('Context skip-size mismatch');
    } else if (token === 0x18) { take(2); expr(); }
    else if (token === 0x2e) { take(4, 8); expr(); }
    else if (token === 0x2c) take(1);
    else if ([0x1b, 0x77, 0x82, 0x9a, 0xf2].includes(token)) {
      if (token === 0x1b) take(8);
      while (cursor < code.length && code[cursor] !== 0x16) expr();
      if (take(1)[0] !== 0x16) throw new Error('Missing call terminator');
    } else if (![0x0b, 0x25, 0x26, 0x27, 0x28, 0x2a, 0x53].includes(token)) {
      throw new Error(`Unsupported bytecode token ${token.toString(16)}`);
    }
  }
  while (cursor < code.length) expression();
  boundaries.add(memory);
  for (const [, target] of jumps) {
    if (!boundaries.has(target)) throw new Error(`Jump to non-instruction boundary ${target}`);
  }
  return { memory, jumps };
}

const bytes = (...values) => Buffer.from(values);
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; }
function instance(ref) { return Buffer.concat([bytes(1), u32(ref)]); }
function call(name, args = Buffer.alloc(0)) {
  return Buffer.concat([bytes(0x1b), u32(name), u32(0), args, bytes(0x16)]);
}
function context(ref, body) {
  const header = Buffer.alloc(7);
  header.writeUInt16LE(inspect(body).memory);
  return Buffer.concat([bytes(0x19), instance(ref), header, body]);
}
function playerPrefix() {
  const condition = Buffer.concat([bytes(0x77, 0x2e), u32(53632), instance(9431), bytes(0x2a, 0x16)]);
  // Player only; preserve AI fallback and shared IsCanFireRedNapalmGun.
  // Type 2 = knife, fired type 6 = existing game's no-previous-bullet sentinel.
  const code = Buffer.concat([
    bytes(0x07, 0, 0), condition, bytes(0x0f), instance(9325), bytes(0x2c, 2),
    context(9428, call(62614, bytes(0x2c, 6))),
    call(57693), call(59818), bytes(0x04, 0x0b),
  ]);
  const { memory } = inspect(code);
  code.writeUInt16LE(memory, 1);
  return { code, memory };
}
function patchPlayShot(original) {
  if (original.length < 0x30) throw new Error('Truncated function');
  const memory = original.readUInt32LE(0x28), size = original.readUInt32LE(0x2c);
  if (size > original.length - 0x30) throw new Error('Truncated function script');
  const code = original.subarray(0x30, 0x30 + size);
  const measured = inspect(code);
  if (measured.memory !== memory || code.at(-1) !== 0x53) throw new Error('Original script serialization mismatch');
  const prefix = playerPrefix(), relocated = Buffer.from(code);
  for (const [offset, target] of measured.jumps) relocated.writeUInt16LE(target + prefix.memory, offset);
  const newCode = Buffer.concat([prefix.code, relocated]), resultMemory = inspect(newCode).memory;
  if (resultMemory !== memory + prefix.memory) throw new Error('Patched script serialization mismatch');
  const header = Buffer.from(original.subarray(0, 0x30));
  header.writeUInt32LE(resultMemory, 0x28); header.writeUInt32LE(newCode.length, 0x2c);
  return Buffer.concat([header, newCode, original.subarray(0x30 + size)]);
}
module.exports = { inspect, instance, call, context, playerPrefix, patchPlayShot };

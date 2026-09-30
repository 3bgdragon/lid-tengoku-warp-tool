'use strict';
// Experimental build-25386710 gate. Installed by the strictly hash-gated tool.
// R14 is unused between the original selection loop and its saved-register
// epilogue. Reset it at row zero and use it only as our material counter.
const HOOK_RVA = 0x1155c47;
const ORIGINAL = Buffer.from('837840017553', 'hex');
const FIRST_ID = 1900000000;
const END_ID = FIRST_ID + 10000;

function buildMaterialGate(caveRva, dailyCount = 7) {
  if (!Number.isSafeInteger(caveRva) || caveRva < 0 || caveRva > 0x7fffffff)
    throw new Error('Invalid experimental code RVA');
  if (!Number.isInteger(dailyCount) || dailyCount < 1 || dailyCount > 50)
    throw new Error('Daily material count must be 1..50');
  const bytes = [], labels = new Map(), fixups = [];
  const emit = hex => bytes.push(...Buffer.from(hex, 'hex'));
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); bytes.push(...b); };
  const label = name => labels.set(name, bytes.length);
  const jump = (opcode, target) => {
    emit(opcode); fixups.push({at: bytes.length, target}); u32(0);
  };
  emit('85db');                          // test ebx,ebx
  jump('0f85', 'row');                   // not first row
  emit('4531f6');                        // xor r14d,r14d
  label('row');
  emit('83784001');                      // original is_stable == 1
  jump('0f84', 0x1155c4d);               // original append
  emit('81fe'); u32(FIRST_ID);           // cmp esi,first reserved material ID
  jump('0f82', 0x1155ca0);               // other candidates: original map
  emit('81fe'); u32(END_ID);
  jump('0f83', 0x1155ca0);
  emit('83784000');                      // only our non-stable candidate rows
  jump('0f85', 0x1155ca0);
  emit('4183fe'); bytes.push(dailyCount);// cmp r14d,quota
  jump('0f83', 0x1155cc6);               // quota reached: original next row
  emit('41ffc6');                        // inc r14d
  jump('e9', 0x1155c4d);                 // original append (allocation unchanged)
  const code = Buffer.from(bytes);
  for (const {at,target} of fixups) {
    const destination = typeof target === 'string' ? caveRva + labels.get(target) : target;
    const delta = destination - (caveRva + at + 4);
    if (!Number.isSafeInteger(delta) || delta < -0x80000000 || delta > 0x7fffffff)
      throw new Error('Experimental jump is out of range');
    code.writeInt32LE(delta, at);
  }
  const hook = Buffer.alloc(6, 0x90);
  hook[0] = 0xe9; hook.writeInt32LE(caveRva - (HOOK_RVA + 5), 1);
  if (caveRva < HOOK_RVA + ORIGINAL.length && caveRva + code.length > HOOK_RVA)
    throw new Error('Experimental code overlaps its hook');
  return {hookRva: HOOK_RVA, original: Buffer.from(ORIGINAL), hook, caveRva, code,
    firstId: FIRST_ID, endId: END_ID, dailyCount};
}
module.exports = {buildMaterialGate, FIRST_ID, END_ID};

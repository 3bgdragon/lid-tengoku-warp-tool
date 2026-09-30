'use strict';
const { text } = require('./language');
const labels = [
  ['데칼 교체 / 탈착', 'Decals'],
  ['탄약 충전 (구입가 20%)', 'Ammo (20% cost)'],
  ['표시된 킬코인을 사용해 이 무기의 탄약을 완충할까요?\n비용: 해당 무기 구입가의 20% (내구도는 회복하지 않음)', 'Refill ammo for 20% of purchase price?\nNo durability repair.'],
];
function localizePlan(plan, language = text('ko', 'en')) {
  if (language === 'ko') return plan;
  if (language !== 'en') throw Error('Unsupported game-menu language');
  const counts = labels.map(() => 0);
  const patches = plan.patches.map(patch => {
    const bytes = Buffer.from(patch.insert, 'hex');
    for (let i = 0; i < labels.length; i++) {
      const [ko, en] = labels[i];
      if (en.length > ko.length) throw Error('Game-menu translation exceeds its fixed-width slot');
      const needle = Buffer.concat([Buffer.from([0x34]), Buffer.from(ko + '\0', 'utf16le')]);
      const replacement = Buffer.concat([Buffer.from([0x34]), Buffer.from(en.padEnd(ko.length) + '\0', 'utf16le')]);
      let at = 0;
      while ((at = bytes.indexOf(needle, at)) !== -1) {
        replacement.copy(bytes, at); counts[i]++; at += needle.length;
      }
    }
    return { ...patch, insert: bytes.toString('hex') };
  });
  const expected = plan.features?.includes('ammo') ? [1, 1, 1] : [1, 0, 0];
  if (counts.some((count, i) => count !== expected[i])) throw Error('Game-menu translation signature count mismatch');
  return { ...plan, patches };
}
module.exports = { localizePlan, labels };

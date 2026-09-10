'use strict';
const crypto = require('node:crypto');
const engine = require('./package-patch');
const { profiles } = require('./profiles.json');
const sha1 = data => crypto.createHash('sha1').update(data).digest('hex').toUpperCase();
function identify(hash) { return profiles.find(p => p.sha1 === hash) || null; }
function forBase(hash) { return profiles.find(p => p.baseSha1 === hash) || null; }
function strip(data) {
  const profile = identify(sha1(data));
  if (!profile || engine.sha(data) !== profile.sha256) throw new Error('검증되지 않은 M2G 패키지입니다. 변경하지 않습니다.');
  // M2G 1.1.0 only changes two directory records and appends two chunks.
  // Restore those records and truncate the append, never touch other data.
  const result = Buffer.from(data.subarray(0, profile.baseSize));
  for (const record of profile.directory) Buffer.from(record.hex, 'hex').copy(result, record.offset);
  if (sha1(result) !== profile.baseSha1 || engine.sha(result) !== profile.baseSha256) throw new Error('M2G 분리 후 원본 검증 실패');
  return result;
}
function rebuild(base) {
  const profile = forBase(sha1(base));
  if (!profile || engine.sha(base) !== profile.baseSha256) throw new Error('검증되지 않은 M2G 재적용 대상입니다.');
  const result = engine.build(base);
  if (sha1(result) !== profile.sha1 || engine.sha(result) !== profile.sha256) throw new Error('M2G 재적용 검증 실패');
  return result;
}
module.exports = { identify, forBase, strip, rebuild };

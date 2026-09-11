'use strict';
// Known embedded knife-only packages whose original function is retained.
// Removing changes only PlayShot's export pointer, never combat/warp code.
const fs = require('node:fs');
const engine = require('./package-patch');
const data = require('./embedded-profiles.json');
const hash = engine.sha;
// Verified pristine Steam build 25244463; rebuilding M2G produces the
// existing canonical off-off profile byte-for-byte.
const PRISTINE_SHA256 = '9a28b0fabcca486ccde76dba6ecc732f83402ae34a7dd5f18320697d303fd11b';
function identify(buffer) {
 const digest=hash(buffer);
 if(digest===PRISTINE_SHA256) {
  const profile=data.profiles.find(p=>p.guard==='off-off' && !p.warp);
  if(!profile)throw Error('순정 패키지 기준 프로필이 없습니다.');
  return {profile,enabled:false,pristine:true};
 }
 for(const p of data.profiles) {
  if(p.sha256===digest)return {profile:p,enabled:true};
  if(p.offSha256===digest)return {profile:p,enabled:false};
 }
 return null;
}
function set(buffer, enabled) {
 const found=identify(buffer);
 if(!found)throw Error('검증되지 않은 내장 M2G 패키지입니다.');
 if(found.enabled===enabled)return Buffer.from(buffer);
 const p=found.profile;
 if(found.pristine) {
  const out=engine.build(buffer);
  if(hash(out)!==p.sha256)throw Error('순정 M2G 기준 변환 검증 실패');
  return out;
 }
 if(enabled){
  const out=Buffer.from(buffer.subarray(0,p.size));
  Buffer.from(p.directoryHex,'hex').copy(out,p.directoryOffset);
  if(hash(out)!==p.sha256)throw Error('M2G 재적용 검증 실패');
  return out;
 }
 const table=engine.entries(buffer);
 const exp=engine.readAt(buffer,table,engine.EXPORT_SLOT+32,8);
 const raw=Buffer.from(exp.raw);
 raw.writeUInt32LE(engine.PLAY_SIZE,engine.EXPORT_SLOT+32-table[exp.index][0]);
 raw.writeUInt32LE(engine.PLAY_OFFSET,engine.EXPORT_SLOT+36-table[exp.index][0]);
 const packed=engine.pack(raw);
 const out=Buffer.concat([buffer,packed]);
 out.writeUInt32LE(buffer.length,p.directoryOffset+8);
 out.writeUInt32LE(packed.length,p.directoryOffset+12);
 if(hash(out)!==p.offSha256)throw Error('M2G 선택 제거 검증 실패');
 return out;
}
module.exports={identify,set};

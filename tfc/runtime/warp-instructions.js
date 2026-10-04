'use strict';
// Read-only proof of the warp instructions. TFC remains the sole UPK writer.
const {createHash}=require('node:crypto');
const evidence=require('./tfc-assets/warp-instructions.json');
const definitions=new Map(evidence.objects.map(p=>[p.index,p]));
if(evidence.build!=='25386710'||definitions.size!==2||!definitions.has(71346)||!definitions.has(82802))throw Error('Invalid TFC warp instruction evidence');
const sha=b=>createHash('sha256').update(b).digest('hex');
function verify(index,entry,bytes,proof){
 const p=definitions.get(index);
 if(!p||p.patchedSha256!==proof.sha256||p.size!==proof.size||!/^[a-f0-9]{64}$/.test(p.metadata)||!Array.isArray(p.windows)||!p.windows.length)throw Error('TFC warp instruction evidence/proof mismatch');
 const identity=Buffer.from(entry);identity.fill(0,32,40);
 const problem=detail=>{throw Error(`Warp instruction prerequisite conflict: BrgGame.upk export ${index}, ${detail}. Install the matching TFC warp patch; do not overwrite other mods. / 워프 명령어 구간 불일치: ${detail}`);};
 if(entry.length!==68||sha(identity)!==p.metadata)problem('export identity');
 if(bytes.length!==p.size||entry.readUInt32LE(32)!==p.size)problem('serialized size');
 const header=Buffer.from(p.header,'hex');
 if(header.length!==0x30||!bytes.subarray(0,0x30).equals(header))problem('function header');
 for(const window of p.windows){
  if(!Number.isSafeInteger(window.at)||window.at<0||typeof window.bytes!=='string'||!/^(?:[a-f0-9]{2})+$/.test(window.bytes))throw Error('Invalid TFC warp instruction window');
  const expected=Buffer.from(window.bytes,'hex');
  if(expected.length>256||window.at+expected.length>p.size)throw Error('Invalid TFC warp instruction window bounds');
  if(!bytes.subarray(window.at,window.at+expected.length).equals(expected))problem('instruction/context at 0x'+window.at.toString(16));
 }
 return true;
}
module.exports={verify,has:index=>definitions.has(index)};

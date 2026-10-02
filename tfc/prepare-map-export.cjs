'use strict';
// An export-only intermediate, never a game-installable replacement.
const fs=require('node:fs');
const {compact}=require('../shared/package-layout');
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node prepare-map-export.cjs modified-map.upk intermediate-map.upk');
const b=compact(fs.readFileSync(input));
const count=b.readUInt32LE(0x71);
if(count!==2||b.readUInt32LE(0x19)!==439||b.readUInt32LE(0x21)!==224)
 throw Error('Unsupported selector map. Expected reviewed 439-name/224-export layout.');
const last=0x75+(count-1)*16;
const end=b.readUInt32LE(last)+b.readUInt32LE(last+4);
if(b.readUInt32LE(0x1d)<=b.readUInt32LE(8)||b.readUInt32LE(0x25)>=end)
 throw Error('Expected relocated map tables');
// The official exporter needs the appended tables inside the header range.
// TFC then constructs a new canonical package from the exported patch.
b.writeUInt32LE(end,8);
fs.writeFileSync(output,b,{flag:'wx'});
console.log('Export-only intermediate created. DO NOT install this UPK in the game:',output);

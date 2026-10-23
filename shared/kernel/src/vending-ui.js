'use strict';
const {text}=require('./language');
const active=c=>!!(c.decals||c.ammo);
function preset(c){return !active(c)?'off':(c.ammo&&!c.decals?'ammo':c.ammo?'all':'decals')+'-'+(c.language||text('ko','en'));}
function plan(c){return c.ammo?(c.decals?require('../patches/vending-build25386710.json'):require('./ammo-only-plan')):undefined;}
module.exports={active,preset,plan};

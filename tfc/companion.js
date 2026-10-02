'use strict';
require('./runtime/tfc-cli').main('warp').catch(error=>{
 console.error('Error / 오류: '+error.message);
 process.exitCode=1;
});

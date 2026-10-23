#!/usr/bin/env node
'use strict';
const recovery=require('./shared/updated-state');
const args=process.argv.slice(2),confirm=args.includes('--archive'),tfc=args.includes('--tfc'),paths=args.filter(a=>!['--archive','--tfc'].includes(a));
try{
 if(paths.length!==1||paths[0].startsWith('--'))throw Error('Usage: node recover-updated-state.js "LET IT DIE folder or EXE" [--tfc] [--archive]\nWithout --archive: read-only inspection. / --archive 없으면 읽기 전용 확인입니다.');
 console.log(JSON.stringify(confirm?recovery.archive(paths[0],{tfc}):recovery.inspect(paths[0],{tfc}),null,2));
}catch(error){console.error('Error / 오류: '+error.message);process.exitCode=1;}

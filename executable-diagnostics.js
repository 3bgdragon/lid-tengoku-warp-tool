'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function count(buffer,needle){let at=0,total=0;while((at=buffer.indexOf(needle,at))>=0){total++;at+=needle.length;}return total;}
function describe(executable,file,names){
 const report={path:path.resolve(file),size:executable.length,sha256:crypto.createHash('sha256').update(executable).digest('hex'),packageNames:{}};
 for(const name of names){
  const title=name==='brggame.upk'?'BrgGame.upk':name;
  report.packageNames[name]={asciiLower:count(executable,Buffer.from(name+'\0')),asciiUpper:count(executable,Buffer.from(name.toUpperCase()+'\0')),asciiTitle:count(executable,Buffer.from(title+'\0')),utf16Lower:count(executable,Buffer.from(name+'\0','utf16le'))};
 }
 report.pe={valid:false};
 if(executable.length<64||executable.toString('ascii',0,2)!=='MZ')return report;
 const pe=executable.readUInt32LE(60);
 if(pe>executable.length-24||executable.toString('ascii',pe,pe+4)!=='PE\0\0')return report;
 const optional=executable.readUInt16LE(pe+20),sections=executable.readUInt16LE(pe+6),table=pe+24+optional;
 if(optional<2||table>executable.length||sections>96||table+sections*40>executable.length)return report;
 report.pe={valid:true,machine:executable.readUInt16LE(pe+4),optionalMagic:executable.readUInt16LE(pe+24),sections:[]};
 for(let i=0;i<sections;i++){const at=table+i*40;report.pe.sections.push({name:executable.toString('ascii',at,at+8).replace(/\0.*$/,''),rva:executable.readUInt32LE(at+12),raw:executable.readUInt32LE(at+20),size:executable.readUInt32LE(at+16)});}
 return report;
}
function saveError(root,error,version){
 const directory=path.join(root,'logs');fs.mkdirSync(directory,{recursive:true});
 const file=path.join(directory,'error-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex')+'.json');
 fs.writeFileSync(file,JSON.stringify({version,node:process.version,time:new Date().toISOString(),message:error.message,executable:error.executableDiagnostics||null},null,2),{flag:'wx'});
 return file;
}
function formatError(error,version,t){
 const lines=[t('===== 오류 진단 (이 블록을 복사해서 공유하세요) =====','===== ERROR DIAGNOSTICS (copy this block to share) ====='),
  t('도구 버전: ','Tool version: ')+version,'Node.js: '+process.version,
  t('오류: ','Error: ')+error.message];
 const r=error.executableDiagnostics;
 if(r){
  lines.push(t('검사한 EXE: ','Inspected EXE: ')+r.path,t('파일 크기: ','File size: ')+r.size+' bytes','SHA-256: '+r.sha256);
  lines.push(t('Windows PE 형식: ','Windows PE format: ')+(r.pe.valid?t('정상 구조','Valid structure'):t('잘못되었거나 확인 불가','Invalid or unrecognized')));
  if(r.pe.valid){
   const hex=n=>'0x'+n.toString(16).toUpperCase();
   lines.push(t('CPU 형식 / 선택 헤더: ','Machine / optional header: ')+hex(r.pe.machine)+' / '+hex(r.pe.optionalMagic));
   lines.push(t('PE 섹션 (이름 / RVA / 파일 위치 / 크기):','PE sections (name / RVA / file offset / size):'));
   for(const s of r.pe.sections)lines.push('  '+s.name+' / '+hex(s.rva)+' / '+hex(s.raw)+' / '+s.size);
  }
  lines.push(t('패키지 이름 발견 개수 (ASCII 소문자 / 대문자 / 표준 표기 / UTF-16 소문자):','Package-name counts (ASCII lower / upper / title / UTF-16 lower):'));
  for(const [name,c] of Object.entries(r.packageNames))lines.push('  '+name+': '+[c.asciiLower,c.asciiUpper,c.asciiTitle,c.utf16Lower].join(' / '));
  lines.push(t('의미: 도구가 요구하는 패키지 해시 항목이 없거나 손상되어 안전하게 중단했습니다.','Meaning: required package hash entries are absent or malformed; the tool stopped safely.'));
  lines.push(t('이 정보만으로 다른 게임 빌드·변형 EXE·파일 손상을 확정할 수 없습니다.','These details alone do not establish whether this is another build, a modified EXE, or corruption.'));
  lines.push(t('다음: 위 정보를 제보하세요. 관리자 권한이나 해시 검사 우회로 해결하지 마세요.','Next: report the details above. Administrator access or bypassing hash checks is not a fix.'));
 }else{
  lines.push(t('EXE 구조 진단은 이 오류에 첨부되지 않았습니다. 오류 본문과 로그를 함께 공유하세요.','No EXE-layout diagnosis is attached to this error. Share the error text and log together.'));
 }
 lines.push(t('공유 전 경로의 사용자 이름은 가려도 됩니다. EXE 원본·세이브 내용은 포함하지 않습니다.','You may redact your username in paths before sharing. EXE contents and saves are not included.'));
 lines.push('===== END =====');return lines.join('\n');
}
module.exports={describe,saveError,formatError};

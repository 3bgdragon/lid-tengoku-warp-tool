#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const readline = require('readline/promises');

const PATCH_MAGIC = Buffer.from('LIDBIN1\0', 'ascii');
const ASSET_DIRECTORY = path.join(__dirname, 'assets');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSET_DIRECTORY, 'manifest.json'), 'utf8'));
const FILE_KEYS = ['brgGame', 'heavenEntry', 'executable'];

function fail(message) {
  const error = new Error(message);
  error.userFacing = true;
  throw error;
}

function timestamp() {
  const date = new Date();
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-` +
    pad(date.getMilliseconds(), 3);
}

function sha1File(filePath) {
  const digest = crypto.createHash('sha1');
  const handle = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(4 * 1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(handle);
  }
  return digest.digest('hex').toUpperCase();
}

function stripQuotes(value) {
  let result = String(value ?? '').trim();
  if ((result.startsWith('"') && result.endsWith('"')) ||
      (result.startsWith("'") && result.endsWith("'"))) result = result.slice(1, -1).trim();
  return result;
}

function uniquePaths(values) {
  const found = new Map();
  for (const value of values.filter(Boolean)) {
    const normalized = path.normalize(value);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (!found.has(key)) found.set(key, normalized);
  }
  return [...found.values()];
}

function readRegistryValue(key, valueName) {
  if (process.platform !== 'win32') return null;
  try {
    const output = childProcess.execFileSync('reg.exe', ['query', key, '/v', valueName], {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const expression = new RegExp(`^\\s*${valueName}\\s+REG_\\w+\\s+`, 'i');
    const line = output.split(/\r?\n/).find((entry) => expression.test(entry));
    return line?.replace(expression, '').trim() || null;
  } catch { return null; }
}

function findSteamRoots() {
  const steamExe = readRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamExe');
  const candidates = [
    readRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    steamExe ? path.dirname(steamExe) : null,
    readRegistryValue('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    readRegistryValue('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'),
    'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam',
  ].filter(Boolean);
  if (process.platform === 'win32') {
    for (let code = 67; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (fs.existsSync(drive)) candidates.push(path.join(drive, 'Steam'), path.join(drive, 'SteamLibrary'));
    }
  }
  const roots = [];
  for (const candidate of uniquePaths(candidates)) {
    if (!fs.existsSync(candidate)) continue;
    roots.push(candidate);
    const vdfPath = path.join(candidate, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdfPath)) continue;
    for (const match of fs.readFileSync(vdfPath, 'utf8').matchAll(/"path"\s+"([^"]+)"/g)) {
      roots.push(match[1].replace(/\\\\/g, '\\'));
    }
  }
  return uniquePaths(roots);
}

function expectedPaths(gameDirectory) {
  const fromManifest = (value) => path.join(gameDirectory, ...value.split('/'));
  return {
    brgGame: fromManifest(manifest.brgGame.relativePath),
    heavenEntry: fromManifest(manifest.heavenEntry.relativePath),
    executable: fromManifest(manifest.executable.relativePath),
  };
}

function isGameDirectory(directory) {
  const paths = expectedPaths(directory);
  return FILE_KEYS.every((key) => fs.existsSync(paths[key]) && fs.statSync(paths[key]).isFile());
}

function resolveGameInput(input) {
  const entered = stripQuotes(input);
  if (!entered) return [];
  const resolved = path.resolve(entered);
  const candidates = [resolved];
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    const lower = resolved.toLowerCase();
    if (lower.endsWith('\\binaries\\win64\\brggame-steam.exe')) candidates.push(path.resolve(resolved, '..', '..', '..'));
    if (lower.endsWith('\\brggame\\cookedpcconsole\\brggame.upk') ||
        lower.endsWith('\\brggame\\cookedpcconsole\\heaven_a01_st_col.upk')) {
      candidates.push(path.resolve(resolved, '..', '..', '..'));
    }
  } else {
    candidates.push(path.join(resolved, 'LET IT DIE'), path.join(resolved, 'common', 'LET IT DIE'),
      path.join(resolved, 'steamapps', 'common', 'LET IT DIE'));
  }
  return uniquePaths(candidates).filter(isGameDirectory);
}

function discoverGameDirectories() {
  return uniquePaths(findSteamRoots().map((root) =>
    path.join(root, 'steamapps', 'common', 'LET IT DIE'))).filter(isGameDirectory);
}

async function chooseGameDirectory(rl, explicitPath, interactiveMode) {
  if (explicitPath) {
    const matches = resolveGameInput(explicitPath);
    if (matches.length !== 1) fail(`LET IT DIE 설치 폴더를 찾지 못했습니다: ${path.resolve(explicitPath)}`);
    return matches[0];
  }
  const matches = discoverGameDirectories();
  if (matches.length === 1) return matches[0];
  if (!interactiveMode) {
    fail(matches.length === 0 ? '설치 폴더를 자동으로 찾지 못했습니다. --game "LET IT DIE 설치 폴더"를 사용하세요.' :
      `설치 폴더가 여러 개입니다. --game으로 지정하세요:\n${matches.join('\n')}`);
  }
  if (matches.length > 1) {
    console.log('\nLET IT DIE 설치 폴더 선택');
    matches.forEach((item, index) => console.log(`${index + 1}. ${item}`));
    console.log(`${matches.length + 1}. 다른 경로 직접 입력`);
    const answer = Number((await rl.question('선택: ')).trim());
    if (answer >= 1 && answer <= matches.length) return matches[answer - 1];
  } else console.log('\nLET IT DIE 설치 폴더를 자동으로 찾지 못했습니다.');
  const entered = await rl.question('게임 설치 폴더 또는 BrgGame-Steam.exe/UPK 경로: ');
  const resolved = resolveGameInput(entered);
  if (resolved.length !== 1) fail(`해당 경로에서 LET IT DIE 설치 파일 3개를 찾지 못했습니다: ${stripQuotes(entered)}`);
  return resolved[0];
}

function isGameRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const output = childProcess.execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /BrgGame-Steam\.exe/i.test(output);
  } catch { return false; }
}

function identifyBrgGame(filePath) {
  const hash = sha1File(filePath);
  const size = fs.statSync(filePath).size;
  for (const [profileName, profile] of Object.entries(manifest.brgGame.profiles)) {
    if (hash === profile.baseSha1) return { hash, size, profileName, enabled: false, profile };
    if (hash === profile.patchedSha1) return { hash, size, profileName, enabled: true, profile };
  }
  return { hash, size, profileName: null, enabled: null, profile: null };
}

function identifyHeavenEntry(filePath) {
  const hash = sha1File(filePath);
  const size = fs.statSync(filePath).size;
  if (hash === manifest.heavenEntry.baseSha1) return { hash, size, enabled: false };
  if (hash === manifest.heavenEntry.patchedSha1) return { hash, size, enabled: true };
  return { hash, size, enabled: null };
}

function findAll(buffer, needle) {
  const positions = [];
  let cursor = 0;
  while (cursor <= buffer.length - needle.length) {
    const position = buffer.indexOf(needle, cursor);
    if (position < 0) break;
    positions.push(position);
    cursor = position + needle.length;
  }
  return positions;
}

function manifestDigestOffsets(executable, assetName, expectedCount) {
  const needle = Buffer.from(`${assetName.toLowerCase()}\0`, 'ascii');
  const positions = findAll(executable, needle);
  if (positions.length !== expectedCount) fail(`${assetName} 실행 파일 해시 항목이 ${expectedCount}개가 아닙니다: ${positions.length}개`);
  return positions.map((position) => position + needle.length);
}

function inspectExecutable(executablePath, expectedHashes) {
  const executable = fs.readFileSync(executablePath);
  const entries = {};
  for (const [assetName, count] of Object.entries(manifest.executable.manifestEntries)) {
    const offsets = manifestDigestOffsets(executable, assetName, count);
    const digests = offsets.map((offset) => executable.subarray(offset, offset + 20).toString('hex').toUpperCase());
    entries[assetName] = { offsets, digests, valid: digests.every((value) => value === expectedHashes[assetName]) };
  }
  return { entries, valid: Object.values(entries).every((entry) => entry.valid) };
}

function readStatus(gameDirectory) {
  const paths = expectedPaths(gameDirectory);
  const brgGame = identifyBrgGame(paths.brgGame);
  const heavenEntry = identifyHeavenEntry(paths.heavenEntry);
  const executable = inspectExecutable(paths.executable, {
    'brggame.upk': brgGame.hash, 'heaven_a01_st_col.upk': heavenEntry.hash,
  });
  const coherent = brgGame.enabled !== null && heavenEntry.enabled !== null &&
    brgGame.enabled === heavenEntry.enabled && executable.valid;
  return { gameDirectory, paths, brgGame, heavenEntry, executable, coherent };
}

function profileLabel(name) {
  return ({
    'off-off': '순정 런타임', 'on-off': '저스트가드 그로기 ON', 'off-on': '근접 방어 제한 해제',
    'on-on': '그로기 ON + 근접 방어 제한 해제', 'off-on-v1.1': '근접 방어 제한 해제(구버전)',
    'on-on-v1.1': '그로기 ON + 근접 방어 제한 해제(구버전)',
  })[name] ?? name ?? '알 수 없음';
}

function printStatus(status) {
  console.log(`\nLET IT DIE ${manifest.gameVersion} — 일반 텐고쿠 시작층 선택`);
  console.log(`설치 폴더: ${status.gameDirectory}`);
  console.log(`시작층 선택: ${status.coherent ? (status.brgGame.enabled ? '적용됨 (51·101·201·301층)' : '적용 안 됨') : '상태 불일치/확인 불가'}`);
  console.log(`BrgGame 변형: ${profileLabel(status.brgGame.profileName)}`);
  console.log(`50층 진입 맵: ${status.heavenEntry.enabled === true ? '선택 메뉴 적용' :
    status.heavenEntry.enabled === false ? '순정' : `지원하지 않음 (${status.heavenEntry.hash})`}`);
  if (!status.brgGame.profileName) console.log(`BrgGame SHA-1: ${status.brgGame.hash}`);
  console.log(`실행 파일 해시 연결: ${status.executable.valid ? '정상' : '불일치'}`);
  console.log('22층 엘리베이터·세이브·MASTER DB: 변경하지 않음');
}

function assertSupported(status) {
  if (!status.brgGame.profileName) fail(`지원하지 않는 BrgGame.upk입니다. SHA-1: ${status.brgGame.hash}`);
  if (status.heavenEntry.enabled === null) fail(`지원하지 않는 Heaven_A01_ST_COL.upk입니다. SHA-1: ${status.heavenEntry.hash}`);
}

function readPatch(patchName) {
  const patchPath = path.join(ASSET_DIRECTORY, patchName);
  const data = fs.readFileSync(patchPath);
  if (data.length < 16 || !data.subarray(0, 8).equals(PATCH_MAGIC)) fail(`패치 파일 형식 오류: ${patchPath}`);
  const targetSize = data.readUInt32LE(8);
  const count = data.readUInt32LE(12);
  const entries = [];
  let cursor = 16;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 8 > data.length) fail(`패치 항목 헤더가 잘렸습니다: ${patchPath}`);
    const offset = data.readUInt32LE(cursor);
    const size = data.readUInt32LE(cursor + 4);
    cursor += 8;
    if (cursor + size > data.length || offset + size > targetSize) fail(`패치 범위 오류: ${patchPath}`);
    entries.push({ offset, payload: data.subarray(cursor, cursor + size) });
    cursor += size;
  }
  if (cursor !== data.length) fail(`패치 파일 꼬리 데이터 오류: ${patchPath}`);
  return { targetSize, entries };
}

function makePackageTemp(sourcePath, patchName, expectedHash, tempPath) {
  if (fs.existsSync(tempPath)) fail(`이전 임시 파일이 남아 있습니다: ${tempPath}`);
  fs.copyFileSync(sourcePath, tempPath, fs.constants.COPYFILE_EXCL);
  if (patchName) {
    const patchData = readPatch(patchName);
    fs.truncateSync(tempPath, patchData.targetSize);
    const handle = fs.openSync(tempPath, 'r+');
    try {
      for (const entry of patchData.entries) fs.writeSync(handle, entry.payload, 0, entry.payload.length, entry.offset);
      fs.fsyncSync(handle);
    } finally { fs.closeSync(handle); }
  }
  const actualHash = sha1File(tempPath);
  if (actualHash !== expectedHash) fail(`임시 패키지 SHA-1 검증 실패: ${actualHash} (예상 ${expectedHash})`);
}

function makeExecutableTemp(sourcePath, packageHashes, tempPath) {
  if (fs.existsSync(tempPath)) fail(`이전 임시 파일이 남아 있습니다: ${tempPath}`);
  const executable = fs.readFileSync(sourcePath);
  for (const [assetName, count] of Object.entries(manifest.executable.manifestEntries)) {
    const digest = Buffer.from(packageHashes[assetName], 'hex');
    for (const offset of manifestDigestOffsets(executable, assetName, count)) digest.copy(executable, offset);
  }
  fs.writeFileSync(tempPath, executable, { flag: 'wx' });
  if (!inspectExecutable(tempPath, packageHashes).valid) fail('임시 실행 파일 해시 연결 검증에 실패했습니다.');
}

function backupRoot() {
  return process.env.LID_TENGOKU_BACKUP_DIR
    ? path.resolve(process.env.LID_TENGOKU_BACKUP_DIR)
    : path.join(__dirname, 'backups');
}

function createBackup(status, reason) {
  const directory = path.join(backupRoot(), timestamp());
  fs.mkdirSync(directory, { recursive: true });
  const metadata = { format: 1, createdAt: new Date().toISOString(), reason, gameDirectory: status.gameDirectory, files: {} };
  try {
    for (const key of FILE_KEYS) {
      const source = status.paths[key];
      const name = path.basename(source);
      const destination = path.join(directory, name);
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      metadata.files[key] = { name, size: fs.statSync(destination).size, sha1: sha1File(destination) };
    }
    fs.writeFileSync(path.join(directory, 'backup.json'), `${JSON.stringify(metadata, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    error.message += `\n불완전한 백업 폴더: ${directory}`;
    throw error;
  }
  return directory;
}

function listBackups() {
  const root = backupRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'backup.json')))
    .map((entry) => path.join(root, entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

function readAndValidateBackup(directory) {
  let metadata;
  try { metadata = JSON.parse(fs.readFileSync(path.join(directory, 'backup.json'), 'utf8')); }
  catch (error) { fail(`백업 정보를 읽을 수 없습니다: ${directory}\n${error.message}`); }
  for (const key of FILE_KEYS) {
    const record = metadata.files?.[key];
    const filePath = record?.name && path.join(directory, record.name);
    if (!record || !filePath || !fs.existsSync(filePath) || fs.statSync(filePath).size !== record.size ||
        sha1File(filePath) !== record.sha1) fail(`백업 파일 검증 실패: ${key}`);
  }
  return metadata;
}

function cleanupFiles(paths) {
  for (const filePath of paths) { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {} }
}

function transactionalReplace(replacements) {
  const rollbacks = replacements.map(({ target }) => `${target}.lid-tengoku.rollback`);
  if (rollbacks.some(fs.existsSync)) fail('이전 작업의 롤백 파일이 남아 있습니다. 게임 폴더를 확인하세요.');
  const moved = [];
  const installed = [];
  try {
    replacements.forEach(({ target }, index) => { fs.renameSync(target, rollbacks[index]); moved.push(index); });
    replacements.forEach(({ target, temp }, index) => { fs.renameSync(temp, target); installed.push(index); });
    cleanupFiles(rollbacks);
  } catch (error) {
    [...installed].reverse().forEach((index) => { try { fs.unlinkSync(replacements[index].target); } catch {} });
    [...moved].reverse().forEach((index) => {
      if (!fs.existsSync(replacements[index].target) && fs.existsSync(rollbacks[index])) {
        try { fs.renameSync(rollbacks[index], replacements[index].target); } catch {}
      }
    });
    throw error;
  }
}

function setPatchState(gameDirectory, enable) {
  if (isGameRunning()) fail('LET IT DIE가 실행 중입니다. 게임을 완전히 종료한 뒤 다시 실행하세요.');
  const status = readStatus(gameDirectory);
  assertSupported(status);
  if (status.brgGame.enabled === enable && status.heavenEntry.enabled === enable && status.executable.valid) {
    return { changed: false, status };
  }
  const backupPath = createBackup(status, enable ? 'enable-selector' : 'disable-selector');
  const profile = status.brgGame.profile;
  const targetBrgHash = enable ? profile.patchedSha1 : profile.baseSha1;
  const targetMapHash = enable ? manifest.heavenEntry.patchedSha1 : manifest.heavenEntry.baseSha1;
  const temps = {
    brgGame: `${status.paths.brgGame}.lid-tengoku.tmp`,
    heavenEntry: `${status.paths.heavenEntry}.lid-tengoku.tmp`,
    executable: `${status.paths.executable}.lid-tengoku.tmp`,
  };
  try {
    makePackageTemp(status.paths.brgGame,
      status.brgGame.enabled === enable ? null : (enable ? profile.enablePatch : profile.disablePatch),
      targetBrgHash, temps.brgGame);
    makePackageTemp(status.paths.heavenEntry,
      status.heavenEntry.enabled === enable ? null : (enable ? manifest.heavenEntry.enablePatch : manifest.heavenEntry.disablePatch),
      targetMapHash, temps.heavenEntry);
    makeExecutableTemp(status.paths.executable, {
      'brggame.upk': targetBrgHash, 'heaven_a01_st_col.upk': targetMapHash,
    }, temps.executable);
    transactionalReplace(FILE_KEYS.map((key) => ({ target: status.paths[key], temp: temps[key] })));
  } catch (error) {
    cleanupFiles(Object.values(temps));
    error.message += `\n변경 전 백업: ${backupPath}`;
    throw error;
  }
  const verified = readStatus(gameDirectory);
  if (!verified.coherent || verified.brgGame.enabled !== enable) fail(`적용 후 검증 실패. 변경 전 백업: ${backupPath}`);
  return { changed: true, backupPath, status: verified };
}

function restoreBackup(gameDirectory, backupPath) {
  if (isGameRunning()) fail('LET IT DIE가 실행 중입니다. 게임을 완전히 종료한 뒤 다시 실행하세요.');
  const metadata = readAndValidateBackup(backupPath);
  const current = readStatus(gameDirectory);
  const safetyBackup = createBackup(current, `before-restore:${path.basename(backupPath)}`);
  const temps = {};
  try {
    for (const key of FILE_KEYS) {
      temps[key] = `${current.paths[key]}.lid-tengoku.tmp`;
      fs.copyFileSync(path.join(backupPath, metadata.files[key].name), temps[key], fs.constants.COPYFILE_EXCL);
      if (sha1File(temps[key]) !== metadata.files[key].sha1) fail(`복원 임시 파일 검증 실패: ${key}`);
    }
    transactionalReplace(FILE_KEYS.map((key) => ({ target: current.paths[key], temp: temps[key] })));
  } catch (error) {
    cleanupFiles(Object.values(temps));
    error.message += `\n복원 직전 안전 백업: ${safetyBackup}`;
    throw error;
  }
  return { backupPath, safetyBackup, status: readStatus(gameDirectory) };
}

function parseCommandLine(argv) {
  const positional = [];
  let gameDirectory;
  let yes = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--game') {
      if (!argv[index + 1]) fail('--game 뒤에 설치 폴더가 필요합니다.');
      gameDirectory = argv[++index];
    } else if (argv[index] === '--yes') yes = true;
    else positional.push(argv[index]);
  }
  return { positional, gameDirectory, yes };
}

async function confirm(rl, message, assumeYes) {
  if (assumeYes) return true;
  const answer = (await rl.question(`${message} (y/N): `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes' || answer === 'ㅇ';
}

async function interactive(gameDirectory, rl) {
  while (true) {
    const status = readStatus(gameDirectory);
    printStatus(status);
    console.log('\n1. 일반 텐고쿠 시작층 선택 적용');
    console.log('2. 패치 제거');
    console.log('3. 현재 게임 파일 백업');
    console.log('4. 최신 백업 복원');
    console.log('5. 백업 목록');
    console.log('6. 종료');
    const choice = (await rl.question('선택: ')).trim();
    if (choice === '6') return;
    if (choice === '1' || choice === '2') {
      const enable = choice === '1';
      const question = enable ? '50층 일반 텐고쿠 진입 전에 51·101·201·301층 선택 메뉴를 추가할까요?' :
        '일반 텐고쿠 시작층 선택 패치를 제거할까요?';
      if (!await confirm(rl, question, false)) continue;
      const result = setPatchState(gameDirectory, enable);
      console.log(result.changed ? `완료했습니다. 변경 전 백업: ${result.backupPath}` : '이미 선택한 상태입니다.');
    } else if (choice === '3') console.log(`백업 완료: ${createBackup(status, 'manual')}`);
    else if (choice === '4') {
      const backups = listBackups();
      if (backups.length === 0) { console.log('복원 가능한 백업이 없습니다.'); continue; }
      console.log(`최신 백업: ${backups[0]}`);
      if (!await confirm(rl, '이 백업을 복원할까요?', false)) continue;
      const result = restoreBackup(gameDirectory, backups[0]);
      console.log(`복원 완료. 복원 직전 안전 백업: ${result.safetyBackup}`);
    } else if (choice === '5') {
      const backups = listBackups();
      if (backups.length === 0) console.log('백업이 없습니다.');
      else backups.forEach((item, index) => console.log(`${index + 1}. ${item}`));
    } else console.log('잘못된 선택입니다.');
  }
}

async function main() {
  const options = parseCommandLine(process.argv.slice(2));
  const command = options.positional[0];
  const interactiveMode = !command;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const gameDirectory = await chooseGameDirectory(rl, options.gameDirectory, interactiveMode);
    if (interactiveMode) return await interactive(gameDirectory, rl);
    if (command === 'status') return printStatus(readStatus(gameDirectory));
    if (command === 'apply' || command === 'remove') {
      const enable = command === 'apply';
      if (!await confirm(rl, enable ? '패치를 적용할까요?' : '패치를 제거할까요?', options.yes)) return;
      const result = setPatchState(gameDirectory, enable);
      printStatus(result.status);
      console.log(result.changed ? `변경 전 백업: ${result.backupPath}` : '변경할 내용이 없습니다.');
      return;
    }
    if (command === 'backup') {
      console.log(`백업 완료: ${createBackup(readStatus(gameDirectory), 'manual')}`);
      return;
    }
    if (command === 'restore') {
      const backup = options.positional[1] ? path.resolve(options.positional[1]) : listBackups()[0];
      if (!backup) fail('복원 가능한 백업이 없습니다.');
      if (!await confirm(rl, `${backup} 백업을 복원할까요?`, options.yes)) return;
      const result = restoreBackup(gameDirectory, backup);
      printStatus(result.status);
      console.log(`복원 직전 안전 백업: ${result.safetyBackup}`);
      return;
    }
    if (command === 'list-backups') {
      const backups = listBackups();
      console.log(backups.length ? backups.join('\n') : '백업이 없습니다.');
      return;
    }
    fail(`알 수 없는 명령: ${command}\n사용법: status | apply | remove | backup | restore [백업 폴더] | list-backups`);
  } finally { rl.close(); }
}

main().catch((error) => {
  console.error(`\n오류: ${error.userFacing ? error.message : `${error.message}\n${error.stack}`}`);
  process.exitCode = 1;
});

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const childProcess = require('child_process');
const readline = require('readline/promises');

const [NODE_MAJOR, NODE_MINOR] = process.versions.node.split('.').map(Number);
if (NODE_MAJOR < 22 || (NODE_MAJOR === 22 && NODE_MINOR < 5)) {
  console.error('오류: 이 도구는 Node.js 22.5 이상이 필요합니다.');
  process.exit(1);
}

const { DatabaseSync } = require('node:sqlite');

const FORMAT_MAGIC = Buffer.from([0x42, 0x52, 0x47, 0x00]);
const FORMAT_VERSION = 2;
const FORMAT_CODEC = Buffer.from('ZLIB', 'ascii');
const TOOL_VERSION = '0.1.0';
const SOURCE_CHECKPOINT_AREA = 'HVN_AREA_000';
const EXPECTED_NODE_IDS = ['4HMA', 'A', 'B', 'C', 'D'];
const EXPECTED_UNITS = [
  'HEAVEN_A01_ST',
  'HEAVEN_ELEVATOR',
  'HEAVEN_GOAL_V01',
  'HEAVEN_START',
];
const WARP_POINTS = [
  {
    floor: 100,
    floorId: 'HVN_FLR_0050',
    sourceAreaId: 'HVN_AREA_017',
    areaId: 'HVN_AREA_WARP_100',
    stopId: 'ELV_MAIN_HVN_WARP_100',
  },
  {
    floor: 200,
    floorId: 'HVN_FLR_0150',
    sourceAreaId: 'HVN_AREA_017',
    areaId: 'HVN_AREA_WARP_200',
    stopId: 'ELV_MAIN_HVN_WARP_200',
  },
  {
    floor: 300,
    floorId: 'HVN_FLR_0250',
    sourceAreaId: 'HVN_AREA_017',
    areaId: 'HVN_AREA_WARP_300',
    stopId: 'ELV_MAIN_HVN_WARP_300',
  },
];

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

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(4 * 1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

function stripPathInputQuotes(input) {
  let value = String(input ?? '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function uniquePaths(values) {
  const unique = new Map();
  for (const value of values.filter(Boolean)) {
    const normalized = path.normalize(value);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return [...unique.values()];
}

function readRegistryValue(key, valueName) {
  if (process.platform !== 'win32') return null;
  try {
    const output = childProcess.execFileSync('reg.exe', ['query', key, '/v', valueName], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const expression = new RegExp(`^\\s*${valueName}\\s+REG_\\w+\\s+`, 'i');
    const line = output.split(/\r?\n/).find((entry) => expression.test(entry));
    return line?.replace(expression, '').trim() || null;
  } catch {
    return null;
  }
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
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ].filter(Boolean);

  if (process.platform === 'win32') {
    for (let code = 67; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (!fs.existsSync(drive)) continue;
      candidates.push(
        path.join(drive, 'Steam'),
        path.join(drive, 'SteamLibrary'),
        path.join(drive, 'Games', 'Steam'),
      );
    }
  }

  const roots = [];
  for (const candidate of uniquePaths(candidates)) {
    if (!fs.existsSync(candidate)) continue;
    roots.push(candidate);
    const libraryFile = path.join(candidate, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(libraryFile)) continue;
    const vdf = fs.readFileSync(libraryFile, 'utf8');
    for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      roots.push(match[1].replace(/\\\\/g, '\\'));
    }
  }
  return uniquePaths(roots);
}

function isGameDirectory(directory) {
  return fs.existsSync(path.join(directory, 'Binaries', 'Win64', 'BrgGame-Steam.exe')) &&
    fs.existsSync(path.join(directory, 'BrgGame', 'Content', 'masters.db'));
}

function resolveGameInput(input) {
  const entered = stripPathInputQuotes(input);
  if (!entered) return [];
  const resolved = path.resolve(entered);
  const candidates = [];
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    if (path.basename(resolved).toLowerCase() === 'masters.db') {
      candidates.push(path.resolve(resolved, '..', '..', '..'));
    }
  } else {
    candidates.push(
      resolved,
      path.join(resolved, 'LET IT DIE'),
      path.join(resolved, 'common', 'LET IT DIE'),
      path.join(resolved, 'steamapps', 'common', 'LET IT DIE'),
    );
    if (path.basename(resolved).toLowerCase() === 'content') {
      candidates.push(path.resolve(resolved, '..', '..'));
    }
    if (path.basename(resolved).toLowerCase() === 'brggame') {
      candidates.push(path.resolve(resolved, '..'));
    }
  }
  return uniquePaths(candidates).filter(isGameDirectory);
}

function discoverGameDirectories() {
  return uniquePaths(findSteamRoots().map((root) =>
    path.join(root, 'steamapps', 'common', 'LET IT DIE'))).filter(isGameDirectory);
}

function listSaveFiles(directory) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
  return fs.readdirSync(directory)
    .filter((name) => /^\d+\.sav$/i.test(name))
    .map((name) => path.join(directory, name));
}

function resolveSaveInput(input) {
  const entered = stripPathInputQuotes(input);
  if (!entered) return [];
  const resolved = path.resolve(entered);
  if (!fs.existsSync(resolved)) return [];
  if (fs.statSync(resolved).isFile()) {
    return /^\d+\.sav$/i.test(path.basename(resolved)) ? [resolved] : [];
  }
  return uniquePaths([
    resolved,
    path.join(resolved, 'Savedata'),
    path.join(resolved, 'LET IT DIE', 'Savedata'),
    path.join(resolved, 'common', 'LET IT DIE', 'Savedata'),
    path.join(resolved, 'steamapps', 'common', 'LET IT DIE', 'Savedata'),
  ].flatMap(listSaveFiles));
}

function discoverSaves(gameDirectories) {
  return uniquePaths(gameDirectories.flatMap((directory) =>
    listSaveFiles(path.join(directory, 'Savedata'))));
}

function isGameRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const output = childProcess.execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /BrgGame-Steam\.exe/i.test(output);
  } catch {
    return false;
  }
}

function readSave(savePath) {
  const packed = fs.readFileSync(savePath);
  if (packed.length < 24 || !packed.subarray(0, 4).equals(FORMAT_MAGIC)) {
    fail('지원하지 않는 세이브입니다: BRG 헤더가 없습니다.');
  }
  if (packed.readUInt32LE(4) !== FORMAT_VERSION) {
    fail(`지원하지 않는 세이브 버전입니다: ${packed.readUInt32LE(4)}`);
  }
  if (!packed.subarray(12, 16).equals(FORMAT_CODEC)) {
    fail('지원하지 않는 압축 형식입니다: ZLIB 세이브가 아닙니다.');
  }

  const declaredSize = packed.readUInt32LE(8);
  const parts = [];
  let offset = 16;
  let decodedSize = 0;
  while (decodedSize < declaredSize) {
    if (offset + 8 > packed.length) fail('세이브 블록 헤더가 잘려 있습니다.');
    const unpackedSize = packed.readUInt32LE(offset);
    const compressedSize = packed.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + compressedSize;
    if (compressedSize === 0 || end > packed.length) fail('세이브 블록 크기가 올바르지 않습니다.');
    let part;
    try {
      part = zlib.inflateSync(packed.subarray(start, end));
    } catch (error) {
      fail(`세이브 압축을 풀 수 없습니다: ${error.message}`);
    }
    if (part.length !== unpackedSize) fail('세이브 블록 크기 검증에 실패했습니다.');
    parts.push(part);
    decodedSize += part.length;
    offset = end;
  }
  if (decodedSize !== declaredSize) fail('세이브 전체 크기 검증에 실패했습니다.');
  const trailer = packed.subarray(offset);
  if (trailer.length !== 4 || !trailer.equals(Buffer.alloc(4))) {
    fail('알 수 없는 세이브 꼬리 데이터가 있어 중단했습니다.');
  }

  const jsonBuffer = Buffer.concat(parts);
  const jsonText = jsonBuffer.toString('utf8');
  if (!Buffer.from(jsonText, 'utf8').equals(jsonBuffer)) fail('세이브 JSON이 올바른 UTF-8이 아닙니다.');
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (error) {
    fail(`세이브 JSON을 읽지 못했습니다: ${error.message}`);
  }
  const openFloors = data?.soul?.openelvflr;
  if (!Array.isArray(openFloors) || openFloors.some((entry) =>
    !entry || typeof entry !== 'object' || typeof entry.id !== 'string')) {
    fail('세이브에서 엘리베이터 해금 목록(soul.openelvflr)을 찾지 못했습니다.');
  }
  return { packed, jsonText, data, blockCount: parts.length, trailer };
}

function packSave(jsonText, blockCount, trailer) {
  const jsonBuffer = Buffer.from(jsonText, 'utf8');
  const header = Buffer.alloc(16);
  FORMAT_MAGIC.copy(header, 0);
  header.writeUInt32LE(FORMAT_VERSION, 4);
  header.writeUInt32LE(jsonBuffer.length, 8);
  FORMAT_CODEC.copy(header, 12);
  const output = [header];
  const baseSize = Math.floor(jsonBuffer.length / blockCount);
  const remainder = jsonBuffer.length % blockCount;
  let offset = 0;
  for (let index = 0; index < blockCount; index += 1) {
    const partSize = baseSize + (index === blockCount - 1 ? remainder : 0);
    const part = jsonBuffer.subarray(offset, offset + partSize);
    const compressed = zlib.deflateSync(part, { level: 6 });
    const blockHeader = Buffer.alloc(8);
    blockHeader.writeUInt32LE(part.length, 0);
    blockHeader.writeUInt32LE(compressed.length, 4);
    output.push(blockHeader, compressed);
    offset += part.length;
  }
  output.push(trailer);
  return Buffer.concat(output);
}

function skipWhitespace(text, offset) {
  while (offset < text.length && /\s/.test(text[offset])) offset += 1;
  return offset;
}

function readJsonStringEnd(text, start) {
  if (text[start] !== '"') fail('세이브 JSON 문자열 구조가 올바르지 않습니다.');
  let escaped = false;
  for (let offset = start + 1; offset < text.length; offset += 1) {
    const character = text[offset];
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === '"') return offset + 1;
  }
  fail('세이브 JSON 문자열이 닫히지 않았습니다.');
}

function findJsonValueEnd(text, start) {
  start = skipWhitespace(text, start);
  if (text[start] === '"') return readJsonStringEnd(text, start);
  if (text[start] !== '{' && text[start] !== '[') {
    let end = start;
    while (end < text.length && ![',', '}', ']'].includes(text[end])) end += 1;
    while (end > start && /\s/.test(text[end - 1])) end -= 1;
    return end;
  }
  const stack = [text[start]];
  for (let offset = start + 1; offset < text.length; offset += 1) {
    const character = text[offset];
    if (character === '"') offset = readJsonStringEnd(text, offset) - 1;
    else if (character === '{' || character === '[') stack.push(character);
    else if (character === '}' || character === ']') {
      const expected = character === '}' ? '{' : '[';
      if (stack.pop() !== expected) fail('세이브 JSON 괄호 구조가 올바르지 않습니다.');
      if (stack.length === 0) return offset + 1;
    }
  }
  fail('세이브 JSON 값이 닫히지 않았습니다.');
}

function findObjectProperty(text, objectStart, propertyName) {
  let offset = skipWhitespace(text, objectStart);
  if (text[offset] !== '{') fail('세이브 JSON 객체 구조가 올바르지 않습니다.');
  offset += 1;
  while (offset < text.length) {
    offset = skipWhitespace(text, offset);
    if (text[offset] === '}') break;
    const keyStart = offset;
    const keyEnd = readJsonStringEnd(text, keyStart);
    let key;
    try {
      key = JSON.parse(text.slice(keyStart, keyEnd));
    } catch {
      fail('세이브 JSON 속성 이름을 읽지 못했습니다.');
    }
    offset = skipWhitespace(text, keyEnd);
    if (text[offset] !== ':') fail('세이브 JSON 속성 구분자가 없습니다.');
    const valueStart = skipWhitespace(text, offset + 1);
    const valueEnd = findJsonValueEnd(text, valueStart);
    if (key === propertyName) return { valueStart, valueEnd };
    offset = skipWhitespace(text, valueEnd);
    if (text[offset] === ',') offset += 1;
    else if (text[offset] !== '}') fail('세이브 JSON 객체 구분자가 올바르지 않습니다.');
  }
  fail(`세이브 JSON에서 ${propertyName} 속성을 찾지 못했습니다.`);
}

function findJsonPath(text, propertyNames) {
  let objectStart = 0;
  let field;
  for (let index = 0; index < propertyNames.length; index += 1) {
    field = findObjectProperty(text, objectStart, propertyNames[index]);
    if (index < propertyNames.length - 1) objectStart = field.valueStart;
  }
  return field;
}

function replaceOpenElevatorFloors(save, operation) {
  const current = save.data.soul.openelvflr;
  const field = findJsonPath(save.jsonText, ['soul', 'openelvflr']);
  let raw;
  try {
    raw = JSON.parse(save.jsonText.slice(field.valueStart, field.valueEnd));
  } catch {
    fail('엘리베이터 해금 목록 원문을 읽지 못했습니다.');
  }
  if (JSON.stringify(raw) !== JSON.stringify(current)) {
    fail('엘리베이터 해금 목록 교차 검증에 실패했습니다.');
  }

  const warpIds = new Set(WARP_POINTS.map((point) => point.stopId));
  let changed;
  if (operation === 'install') {
    changed = [...current];
    const existing = new Set(changed.map((entry) => entry.id));
    for (const point of WARP_POINTS) {
      if (!existing.has(point.stopId)) changed.push({ id: point.stopId });
    }
  } else {
    changed = current.filter((entry) => !warpIds.has(entry.id));
  }

  const jsonText = save.jsonText.slice(0, field.valueStart) +
    JSON.stringify(changed) + save.jsonText.slice(field.valueEnd);
  let verified;
  try {
    verified = JSON.parse(jsonText);
  } catch (error) {
    fail(`수정된 세이브 JSON 검증에 실패했습니다: ${error.message}`);
  }
  const ids = new Set(verified.soul.openelvflr.map((entry) => entry.id));
  const correct = WARP_POINTS.every((point) =>
    operation === 'install' ? ids.has(point.stopId) : !ids.has(point.stopId));
  if (!correct) fail('수정된 엘리베이터 해금 목록 검증에 실패했습니다.');
  return { jsonText, changedCount: Math.abs(changed.length - current.length) };
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getColumns(database, table) {
  return database.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map((row) => row.name);
}

function insertObject(database, table, object) {
  const columns = getColumns(database, table);
  const values = columns.map((column) => object[column]);
  const sql = `INSERT INTO ${quoteIdentifier(table)} (` +
    columns.map(quoteIdentifier).join(', ') + ') VALUES (' +
    columns.map(() => '?').join(', ') + ')';
  database.prepare(sql).run(...values);
}

function requireTables(database) {
  const expected = [
    'master_floor',
    'master_area_setting',
    'master_area_setting_unit',
    'master_area_connect_node',
    'master_area_escalator',
    'master_area_connect_escalator',
    'master_elevator_stop_floor',
  ];
  const existing = new Set(database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  ).all().map((row) => row.name));
  const missing = expected.filter((table) => !existing.has(table));
  if (missing.length) fail(`마스터 DB 필수 테이블이 없습니다: ${missing.join(', ')}`);
}

function validateBaseline(database) {
  requireTables(database);
  const sourceSetting = database.prepare(
    'SELECT * FROM master_area_setting WHERE stgid = ? AND areaid = ?',
  ).all('S_HVN', SOURCE_CHECKPOINT_AREA);
  if (sourceSetting.length !== 1 || sourceSetting[0].dlm !== 1) {
    fail('51층 체크포인트 영역 정의가 예상과 달라 안전하게 중단했습니다.');
  }
  const sourceUnits = database.prepare(
    'SELECT unit FROM master_area_setting_unit WHERE stgid = ? AND areaid = ? ORDER BY unit',
  ).all('S_HVN', SOURCE_CHECKPOINT_AREA).map((row) => row.unit);
  if (JSON.stringify(sourceUnits) !== JSON.stringify([...EXPECTED_UNITS].sort())) {
    fail('51층 체크포인트 맵 유닛 구성이 예상과 달라 안전하게 중단했습니다.');
  }

  for (const point of WARP_POINTS) {
    const floor = database.prepare(
      'SELECT * FROM master_floor WHERE id = ? AND areaid = ? AND stgid = ?',
    ).all(point.floorId, point.sourceAreaId, 'S_HVN');
    if (floor.length !== 1 || floor[0].no !== point.floor || floor[0].sname !== String(point.floor)) {
      fail(`${point.floor}층 원본 정의가 예상과 달라 안전하게 중단했습니다.`);
    }
    const nodeIds = database.prepare(
      'SELECT id, elvflrid FROM master_area_connect_node ' +
      'WHERE stgid = ? AND flrid = ? AND areaid = ? ORDER BY id',
    ).all('S_HVN', point.floorId, point.sourceAreaId);
    if (nodeIds.length !== EXPECTED_NODE_IDS.length ||
        nodeIds.some((row, index) => row.id !== [...EXPECTED_NODE_IDS].sort()[index] || row.elvflrid !== '')) {
      fail(`${point.floor}층 연결 노드가 예상과 달라 안전하게 중단했습니다.`);
    }
    const escalators = database.prepare(
      'SELECT * FROM master_area_escalator WHERE ' +
      '(uflrid = ? AND uareaid = ?) OR (lflrid = ? AND lareaid = ?)',
    ).all(point.floorId, point.sourceAreaId, point.floorId, point.sourceAreaId);
    if (escalators.length !== 2) {
      fail(`${point.floor}층 상·하행 연결이 예상과 달라 안전하게 중단했습니다.`);
    }
  }
}

function getDatabasePatchState(database) {
  requireTables(database);
  const points = [];
  for (const point of WARP_POINTS) {
    const counts = {
      floor: database.prepare(
        'SELECT COUNT(*) count FROM master_floor WHERE id = ? AND areaid = ?',
      ).get(point.floorId, point.areaId).count,
      setting: database.prepare(
        'SELECT COUNT(*) count FROM master_area_setting WHERE stgid = ? AND areaid = ?',
      ).get('S_HVN', point.areaId).count,
      units: database.prepare(
        'SELECT COUNT(*) count FROM master_area_setting_unit WHERE stgid = ? AND areaid = ?',
      ).get('S_HVN', point.areaId).count,
      nodes: database.prepare(
        'SELECT COUNT(*) count FROM master_area_connect_node ' +
        'WHERE stgid = ? AND flrid = ? AND areaid = ? AND elvflrid = ?',
      ).get('S_HVN', point.floorId, point.areaId, point.stopId).count,
      areaEscalators: database.prepare(
        'SELECT COUNT(*) count FROM master_area_escalator WHERE ' +
        '(uflrid = ? AND uareaid = ?) OR (lflrid = ? AND lareaid = ?)',
      ).get(point.floorId, point.areaId, point.floorId, point.areaId).count,
      connectEscalators: database.prepare(
        'SELECT COUNT(*) count FROM master_area_connect_escalator ' +
        'WHERE stgid = ? AND flrid = ? AND areaid = ?',
      ).get('S_HVN', point.floorId, point.areaId).count,
      stop: database.prepare(
        'SELECT COUNT(*) count FROM master_elevator_stop_floor ' +
        'WHERE id = ? AND elvid = ? AND name = ?',
      ).get(point.stopId, 'ELV_MAIN', '').count,
    };
    const installed = counts.floor === 1 && counts.setting === 1 &&
      counts.units === EXPECTED_UNITS.length && counts.nodes === EXPECTED_NODE_IDS.length &&
      counts.areaEscalators === 2 && counts.connectEscalators === EXPECTED_NODE_IDS.length * 2 &&
      counts.stop === 1;
    const artifactCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
    points.push({ point, counts, installed, artifactCount });
  }
  const allInstalled = points.every((item) => item.installed);
  const noneInstalled = points.every((item) => item.artifactCount === 0);
  return {
    points,
    state: allInstalled ? 'installed' : noneInstalled ? 'clean' : 'partial',
  };
}

function installDatabasePatch(databasePath) {
  const database = new DatabaseSync(databasePath);
  try {
    validateBaseline(database);
    const before = getDatabasePatchState(database);
    if (before.state === 'installed') return { alreadyInstalled: true };
    if (before.state === 'partial') {
      fail('마스터 DB에 불완전한 텐고쿠 워프 패치 흔적이 있습니다. 최신 백업을 복원하세요.');
    }
    let nextIndex = database.prepare('SELECT MAX(idx) value FROM master_floor').get().value + 1;
    let nextEscalatorIndex = Math.max(
      database.prepare('SELECT MAX(idx) value FROM master_area_escalator').get().value,
      database.prepare('SELECT MAX(idx) value FROM master_area_connect_escalator').get().value,
    ) + 1;
    database.exec('BEGIN IMMEDIATE');
    try {
      const sourceSetting = database.prepare(
        'SELECT * FROM master_area_setting WHERE stgid = ? AND areaid = ?',
      ).get('S_HVN', SOURCE_CHECKPOINT_AREA);
      const sourceUnits = database.prepare(
        'SELECT * FROM master_area_setting_unit WHERE stgid = ? AND areaid = ? ORDER BY unit',
      ).all('S_HVN', SOURCE_CHECKPOINT_AREA);

      for (const point of WARP_POINTS) {
        const sourceFloor = database.prepare(
          'SELECT * FROM master_floor WHERE id = ? AND areaid = ? AND stgid = ?',
        ).get(point.floorId, point.sourceAreaId, 'S_HVN');
        insertObject(database, 'master_floor', {
          ...sourceFloor,
          areaid: point.areaId,
          idx: nextIndex,
          name: '',
          refareaid: '-',
        });

        insertObject(database, 'master_area_setting', {
          ...sourceSetting,
          areaid: point.areaId,
          conds: '[]',
          replace_units: '[]',
        });
        for (const unit of sourceUnits) {
          insertObject(database, 'master_area_setting_unit', { ...unit, areaid: point.areaId });
        }

        const nodes = database.prepare(
          'SELECT * FROM master_area_connect_node ' +
          'WHERE stgid = ? AND flrid = ? AND areaid = ? ORDER BY id',
        ).all('S_HVN', point.floorId, point.sourceAreaId);
        for (const node of nodes) {
          insertObject(database, 'master_area_connect_node', {
            ...node,
            idx: nextIndex,
            areaid: point.areaId,
            elvflrid: point.stopId,
            ofsx: 0,
            flagofsxs: '[]',
          });
        }

        const areaEscalators = database.prepare(
          'SELECT * FROM master_area_escalator WHERE ' +
          '(uflrid = ? AND uareaid = ?) OR (lflrid = ? AND lareaid = ?)',
        ).all(point.floorId, point.sourceAreaId, point.floorId, point.sourceAreaId);
        const escalatorIndexMap = new Map();
        for (const escalator of areaEscalators) {
          const clone = { ...escalator };
          clone.idx = nextEscalatorIndex;
          escalatorIndexMap.set(escalator.idx, nextEscalatorIndex);
          nextEscalatorIndex += 1;
          if (clone.uflrid === point.floorId && clone.uareaid === point.sourceAreaId) {
            clone.uareaid = point.areaId;
            clone.uunit = 'HEAVEN_START';
          }
          if (clone.lflrid === point.floorId && clone.lareaid === point.sourceAreaId) {
            clone.lareaid = point.areaId;
            clone.lunit = 'HEAVEN_GOAL_V01';
          }
          insertObject(database, 'master_area_escalator', clone);
        }

        const connectEscalators = database.prepare(
          'SELECT * FROM master_area_connect_escalator ' +
          'WHERE stgid = ? AND flrid = ? AND areaid = ? ORDER BY id, dir',
        ).all('S_HVN', point.floorId, point.sourceAreaId);
        if (connectEscalators.length !== EXPECTED_NODE_IDS.length * 2) {
          fail(`${point.floor}층 세부 에스컬레이터 연결이 예상과 달라 중단했습니다.`);
        }
        for (const escalator of connectEscalators) {
          insertObject(database, 'master_area_connect_escalator', {
            ...escalator,
            idx: escalatorIndexMap.get(escalator.idx),
            areaid: point.areaId,
            fromunit: escalator.dir === 1 ? 'HEAVEN_START' : 'HEAVEN_GOAL_V01',
          });
        }

        insertObject(database, 'master_elevator_stop_floor', {
          id: point.stopId,
          elvid: 'ELV_MAIN',
          name: '',
        });
        nextIndex += 1;
      }

      const integrity = database.prepare('PRAGMA integrity_check').get();
      if (integrity.integrity_check !== 'ok') fail(`마스터 DB 무결성 검사 실패: ${integrity.integrity_check}`);
      const after = getDatabasePatchState(database);
      if (after.state !== 'installed') fail('마스터 DB 패치 사후 검증에 실패했습니다.');
      database.exec('COMMIT');
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch {}
      throw error;
    }
    return { alreadyInstalled: false };
  } finally {
    database.close();
  }
}

function removeDatabasePatch(databasePath) {
  const database = new DatabaseSync(databasePath);
  try {
    const state = getDatabasePatchState(database);
    if (state.state === 'clean') return { alreadyRemoved: true };
    if (state.state === 'partial') {
      fail('마스터 DB 패치가 불완전합니다. 삭제 대신 최신 백업 복원을 사용하세요.');
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const point of [...WARP_POINTS].reverse()) {
        database.prepare('DELETE FROM master_elevator_stop_floor WHERE id = ?').run(point.stopId);
        database.prepare(
          'DELETE FROM master_area_connect_escalator WHERE stgid = ? AND flrid = ? AND areaid = ?',
        ).run('S_HVN', point.floorId, point.areaId);
        database.prepare(
          'DELETE FROM master_area_escalator WHERE ' +
          '(uflrid = ? AND uareaid = ?) OR (lflrid = ? AND lareaid = ?)',
        ).run(point.floorId, point.areaId, point.floorId, point.areaId);
        database.prepare(
          'DELETE FROM master_area_connect_node WHERE stgid = ? AND flrid = ? AND areaid = ?',
        ).run('S_HVN', point.floorId, point.areaId);
        database.prepare(
          'DELETE FROM master_area_setting_unit WHERE stgid = ? AND areaid = ?',
        ).run('S_HVN', point.areaId);
        database.prepare(
          'DELETE FROM master_area_setting WHERE stgid = ? AND areaid = ?',
        ).run('S_HVN', point.areaId);
        database.prepare('DELETE FROM master_floor WHERE id = ? AND areaid = ?')
          .run(point.floorId, point.areaId);
      }
      const integrity = database.prepare('PRAGMA integrity_check').get();
      if (integrity.integrity_check !== 'ok') fail(`마스터 DB 무결성 검사 실패: ${integrity.integrity_check}`);
      if (getDatabasePatchState(database).state !== 'clean') fail('마스터 DB 패치 제거 검증에 실패했습니다.');
      database.exec('COMMIT');
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch {}
      throw error;
    }
    return { alreadyRemoved: false };
  } finally {
    database.close();
  }
}

function validateDatabaseFile(databasePath) {
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    requireTables(database);
    const result = database.prepare('PRAGMA integrity_check').get();
    if (result.integrity_check !== 'ok') fail(`마스터 DB 무결성 검사 실패: ${result.integrity_check}`);
  } finally {
    database?.close();
  }
}

function backupRoot() {
  return path.join(__dirname, 'backups');
}

function createBackupSet(masterPath, savePath, reason) {
  const directory = path.join(backupRoot(), `${timestamp()}-${reason}`);
  fs.mkdirSync(directory, { recursive: true });
  const masterBackup = path.join(directory, 'masters.db');
  const saveBackup = path.join(directory, path.basename(savePath));
  fs.copyFileSync(masterPath, masterBackup, fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(savePath, saveBackup, fs.constants.COPYFILE_EXCL);
  const manifest = {
    tool: 'lid-tengoku-warp-tool',
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    reason,
    master: { originalPath: masterPath, file: 'masters.db', sha256: sha256File(masterBackup) },
    save: { originalPath: savePath, file: path.basename(savePath), sha256: sha256File(saveBackup) },
  };
  fs.writeFileSync(path.join(directory, 'backup.json'), JSON.stringify(manifest, null, 2) + '\n', {
    flag: 'wx',
  });
  return { directory, manifest };
}

function samePath(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function listBackupSets(masterPath, savePath) {
  const root = backupRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((directory) => fs.existsSync(path.join(directory, 'backup.json')))
    .filter((directory) => {
      if (!masterPath || !savePath) return true;
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'backup.json'), 'utf8'));
        return samePath(manifest.master.originalPath, masterPath) &&
          samePath(manifest.save.originalPath, savePath);
      } catch {
        return false;
      }
    })
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function readBackupSet(directory) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(directory, 'backup.json'), 'utf8'));
  } catch (error) {
    fail(`백업 정보를 읽지 못했습니다: ${error.message}`);
  }
  const masterBackup = path.join(directory, manifest.master.file);
  const saveBackup = path.join(directory, manifest.save.file);
  if (!fs.existsSync(masterBackup) || !fs.existsSync(saveBackup)) fail('백업 파일이 누락됐습니다.');
  if (sha256File(masterBackup) !== manifest.master.sha256 ||
      sha256File(saveBackup) !== manifest.save.sha256) {
    fail('백업 SHA-256 검증에 실패했습니다.');
  }
  validateDatabaseFile(masterBackup);
  readSave(saveBackup);
  return { manifest, masterBackup, saveBackup };
}

function atomicReplace(destination, source, suffix) {
  const tempPath = `${destination}.${suffix}.tmp`;
  const rollbackPath = `${destination}.${suffix}.rollback`;
  if (fs.existsSync(tempPath) || fs.existsSync(rollbackPath)) {
    fail(`이전 작업의 임시 파일이 남아 있습니다: ${tempPath}`);
  }
  fs.copyFileSync(source, tempPath, fs.constants.COPYFILE_EXCL);
  fs.renameSync(destination, rollbackPath);
  try {
    fs.renameSync(tempPath, destination);
    fs.unlinkSync(rollbackPath);
  } catch (error) {
    if (fs.existsSync(destination)) fs.unlinkSync(destination);
    if (fs.existsSync(rollbackPath)) fs.renameSync(rollbackPath, destination);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

function writeSaveAtomic(savePath, packed, expectedHash, suffix) {
  if (sha256File(savePath) !== expectedHash) fail('작업 중 세이브가 변경되어 안전하게 중단했습니다.');
  const tempPath = `${savePath}.${suffix}.tmp`;
  const rollbackPath = `${savePath}.${suffix}.rollback`;
  if (fs.existsSync(tempPath) || fs.existsSync(rollbackPath)) {
    fail('이전 세이브 작업의 임시 파일이 남아 있습니다.');
  }
  fs.writeFileSync(tempPath, packed, { flag: 'wx' });
  readSave(tempPath);
  fs.renameSync(savePath, rollbackPath);
  try {
    fs.renameSync(tempPath, savePath);
    fs.unlinkSync(rollbackPath);
  } catch (error) {
    if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
    if (fs.existsSync(rollbackPath)) fs.renameSync(rollbackPath, savePath);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

function getStatus(masterPath, savePath) {
  validateDatabaseFile(masterPath);
  const database = new DatabaseSync(masterPath, { readOnly: true });
  let databaseState;
  try {
    databaseState = getDatabasePatchState(database);
  } finally {
    database.close();
  }
  const save = readSave(savePath);
  const openIds = new Set(save.data.soul.openelvflr.map((entry) => entry.id));
  const saveCount = WARP_POINTS.filter((point) => openIds.has(point.stopId)).length;
  return { databaseState, save, saveCount };
}

function applyPatch(masterPath, savePath) {
  if (isGameRunning()) fail('LET IT DIE가 실행 중입니다. 게임을 완전히 종료한 뒤 다시 실행하세요.');
  const before = getStatus(masterPath, savePath);
  if (before.databaseState.state === 'partial' ||
      (before.saveCount !== 0 && before.saveCount !== WARP_POINTS.length)) {
    fail('DB 또는 세이브에 불완전한 워프 패치 흔적이 있습니다. 최신 백업을 복원하세요.');
  }
  if (before.databaseState.state === 'installed' && before.saveCount === WARP_POINTS.length) {
    return { alreadyInstalled: true, backup: null };
  }
  if (before.databaseState.state !== 'clean' || before.saveCount !== 0) {
    fail('DB와 세이브의 패치 상태가 서로 다릅니다. 최신 백업을 복원하세요.');
  }

  const originalMasterHash = sha256File(masterPath);
  const originalSaveHash = sha256Buffer(before.save.packed);
  const backup = createBackupSet(masterPath, savePath, 'before-install');
  try {
    if (sha256File(masterPath) !== originalMasterHash || sha256File(savePath) !== originalSaveHash) {
      fail('백업 중 원본 파일이 변경되어 중단했습니다.');
    }
    installDatabasePatch(masterPath);
    const replacement = replaceOpenElevatorFloors(before.save, 'install');
    const packed = packSave(
      replacement.jsonText,
      before.save.blockCount,
      before.save.trailer,
    );
    writeSaveAtomic(savePath, packed, originalSaveHash, 'tengoku-warp-install');
    const after = getStatus(masterPath, savePath);
    if (after.databaseState.state !== 'installed' || after.saveCount !== WARP_POINTS.length) {
      fail('패치 최종 검증에 실패했습니다.');
    }
  } catch (error) {
    try {
      const verified = readBackupSet(backup.directory);
      atomicReplace(masterPath, verified.masterBackup, 'tengoku-warp-auto-rollback');
      if (sha256File(savePath) !== verified.manifest.save.sha256) {
        atomicReplace(savePath, verified.saveBackup, 'tengoku-warp-auto-rollback');
      }
    } catch (rollbackError) {
      error.message += `\n자동 롤백도 실패했습니다: ${rollbackError.message}\n백업: ${backup.directory}`;
    }
    throw error;
  }
  return { alreadyInstalled: false, backup };
}

function removePatch(masterPath, savePath) {
  if (isGameRunning()) fail('LET IT DIE가 실행 중입니다. 게임을 완전히 종료한 뒤 다시 실행하세요.');
  const before = getStatus(masterPath, savePath);
  if (before.databaseState.state === 'clean' && before.saveCount === 0) {
    return { alreadyRemoved: true, backup: null };
  }
  if (before.databaseState.state !== 'installed' || before.saveCount !== WARP_POINTS.length) {
    fail('DB와 세이브의 패치 상태가 불완전합니다. 최신 백업 복원을 사용하세요.');
  }
  const masterHash = sha256File(masterPath);
  const saveHash = sha256Buffer(before.save.packed);
  const backup = createBackupSet(masterPath, savePath, 'before-remove');
  try {
    removeDatabasePatch(masterPath);
    const replacement = replaceOpenElevatorFloors(before.save, 'remove');
    const packed = packSave(replacement.jsonText, before.save.blockCount, before.save.trailer);
    writeSaveAtomic(savePath, packed, saveHash, 'tengoku-warp-remove');
    const after = getStatus(masterPath, savePath);
    if (after.databaseState.state !== 'clean' || after.saveCount !== 0) {
      fail('패치 제거 최종 검증에 실패했습니다.');
    }
  } catch (error) {
    try {
      const verified = readBackupSet(backup.directory);
      atomicReplace(masterPath, verified.masterBackup, 'tengoku-warp-auto-rollback');
      if (sha256File(savePath) !== verified.manifest.save.sha256) {
        atomicReplace(savePath, verified.saveBackup, 'tengoku-warp-auto-rollback');
      }
    } catch (rollbackError) {
      error.message += `\n자동 롤백도 실패했습니다: ${rollbackError.message}\n백업: ${backup.directory}`;
    }
    throw error;
  }
  return { alreadyRemoved: false, backup };
}

function restoreBackup(masterPath, savePath, requestedDirectory) {
  if (isGameRunning()) fail('LET IT DIE가 실행 중입니다. 게임을 완전히 종료한 뒤 다시 실행하세요.');
  const directory = requestedDirectory
    ? path.resolve(requestedDirectory)
    : listBackupSets(masterPath, savePath)[0];
  if (!directory) fail('복원할 백업이 없습니다.');
  const backup = readBackupSet(directory);
  if (!samePath(backup.manifest.master.originalPath, masterPath) ||
      !samePath(backup.manifest.save.originalPath, savePath)) {
    fail('이 백업은 현재 선택한 마스터 DB와 세이브의 백업이 아닙니다.');
  }
  const safetyBackup = createBackupSet(masterPath, savePath, 'before-backup-restore');
  try {
    atomicReplace(masterPath, backup.masterBackup, 'tengoku-warp-restore');
    atomicReplace(savePath, backup.saveBackup, 'tengoku-warp-restore');
    validateDatabaseFile(masterPath);
    readSave(savePath);
  } catch (error) {
    try {
      const safety = readBackupSet(safetyBackup.directory);
      atomicReplace(masterPath, safety.masterBackup, 'tengoku-warp-restore-rollback');
      atomicReplace(savePath, safety.saveBackup, 'tengoku-warp-restore-rollback');
    } catch (rollbackError) {
      error.message += `\n복원 롤백도 실패했습니다: ${rollbackError.message}\n안전 백업: ${safetyBackup.directory}`;
    }
    throw error;
  }
  return { directory };
}

function printStatus(masterPath, savePath, status) {
  const labels = { clean: '미적용', installed: '적용됨', partial: '불완전' };
  console.log(`\n마스터 DB: ${masterPath}`);
  console.log(`세이브: ${savePath}`);
  console.log(`DB 패치: ${labels[status.databaseState.state]}`);
  console.log(`세이브 워프 해금: ${status.saveCount}/${WARP_POINTS.length}`);
  for (const item of status.databaseState.points) {
    const open = status.save.data.soul.openelvflr.some((entry) => entry.id === item.point.stopId);
    console.log(`  ${item.point.floor}층: DB ${item.installed ? '완료' : item.artifactCount ? '불완전' : '없음'} / ` +
      `세이브 ${open ? '해금' : '미해금'}`);
  }
  console.log(`DB SHA-256: ${sha256File(masterPath)}`);
  console.log(`세이브 SHA-256: ${sha256Buffer(status.save.packed)}`);
}

function parseArguments(argv) {
  const args = [...argv];
  let gameInput = null;
  let saveInput = null;
  let backupInput = null;
  let yes = false;
  for (let index = 0; index < args.length;) {
    const key = args[index];
    if (key === '--game' || key === '--master') {
      if (!args[index + 1]) fail(`${key} 뒤에 게임 설치 폴더 또는 masters.db 경로가 필요합니다.`);
      gameInput = args[index + 1];
      args.splice(index, 2);
    } else if (key === '--save') {
      if (!args[index + 1]) fail('--save 뒤에 세이브 파일 경로가 필요합니다.');
      saveInput = args[index + 1];
      args.splice(index, 2);
    } else if (key === '--backup') {
      if (!args[index + 1]) fail('--backup 뒤에 백업 폴더가 필요합니다.');
      backupInput = args[index + 1];
      args.splice(index, 2);
    } else if (key === '--yes') {
      yes = true;
      args.splice(index, 1);
    } else index += 1;
  }
  return { command: args[0] || null, gameInput, saveInput, backupInput, yes };
}

async function chooseOne(rl, values, label) {
  if (values.length === 1) return values[0];
  console.log(`\n${label} 선택:`);
  values.forEach((value, index) => console.log(`  ${index + 1}. ${value}`));
  const answer = Number(await rl.question('번호: '));
  if (!Number.isInteger(answer) || answer < 1 || answer > values.length) fail('잘못된 선택입니다.');
  return values[answer - 1];
}

async function choosePaths(rl, options) {
  let games = options.gameInput ? resolveGameInput(options.gameInput) : discoverGameDirectories();
  if (games.length === 0) {
    if (!rl) fail('LET IT DIE 설치 폴더를 찾지 못했습니다. --game으로 지정하세요.');
    console.log('\nLET IT DIE 설치 폴더를 자동으로 찾지 못했습니다.');
    console.log('설치 폴더 또는 masters.db 파일을 창에 끌어놓아도 됩니다.');
    const input = await rl.question('게임 설치 폴더 또는 masters.db 경로 (Enter=종료): ');
    games = resolveGameInput(input);
    if (games.length === 0) fail('입력한 위치에서 LET IT DIE 설치 파일을 찾지 못했습니다.');
  }
  const gameDirectory = await chooseOne(rl, games, '게임 설치 경로');
  const masterPath = path.join(gameDirectory, 'BrgGame', 'Content', 'masters.db');

  let saves = options.saveInput ? resolveSaveInput(options.saveInput) : discoverSaves([gameDirectory]);
  if (saves.length === 0) {
    if (!rl) fail('세이브를 찾지 못했습니다. --save로 지정하세요.');
    console.log('\n숫자 이름의 세이브를 자동으로 찾지 못했습니다.');
    console.log('.sav 파일 또는 Savedata/LET IT DIE/SteamLibrary 폴더를 창에 끌어놓아도 됩니다.');
    const input = await rl.question('세이브 파일 또는 폴더 경로 (Enter=종료): ');
    saves = resolveSaveInput(input);
    if (saves.length === 0) fail('입력한 위치에서 숫자 이름의 .sav 파일을 찾지 못했습니다.');
  }
  const savePath = await chooseOne(rl, saves, '세이브');
  return { gameDirectory, masterPath, savePath };
}

async function confirm(rl, message) {
  const answer = (await rl.question(`${message} (y/N): `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function interactive(rl, paths) {
  while (true) {
    const status = getStatus(paths.masterPath, paths.savePath);
    printStatus(paths.masterPath, paths.savePath, status);
    console.log('\n1. 100·200·300층 체크포인트 워프 적용');
    console.log('2. 워프 패치 제거');
    console.log('3. 최신 전체 백업 복원');
    console.log('4. 백업 목록');
    console.log('5. 종료');
    const answer = (await rl.question('선택: ')).trim();
    if (answer === '1') {
      console.log('\n주의: 자연 진행용 100·200·300층은 그대로 두고, 엘리베이터 전용 체크포인트 영역을 추가합니다.');
      if (!await confirm(rl, '게임이 완전히 종료되어 있습니까? 패치를 적용할까요?')) continue;
      const result = applyPatch(paths.masterPath, paths.savePath);
      if (result.alreadyInstalled) console.log('이미 패치가 적용되어 있습니다.');
      else console.log(`적용 완료. 백업: ${result.backup.directory}`);
    } else if (answer === '2') {
      if (!await confirm(rl, '도구가 추가한 워프 데이터만 제거할까요?')) continue;
      const result = removePatch(paths.masterPath, paths.savePath);
      if (result.alreadyRemoved) console.log('이미 패치가 제거되어 있습니다.');
      else console.log(`제거 완료. 제거 전 백업: ${result.backup.directory}`);
    } else if (answer === '3') {
      const backups = listBackupSets(paths.masterPath, paths.savePath);
      if (backups.length === 0) {
        console.log('복원할 백업이 없습니다.');
        continue;
      }
      console.log(`복원 대상: ${backups[0]}`);
      if (!await confirm(rl, '현재 DB와 세이브를 함께 교체할까요?')) continue;
      restoreBackup(paths.masterPath, paths.savePath, backups[0]);
      console.log('전체 백업 복원 완료.');
    } else if (answer === '4') {
      const backups = listBackupSets(paths.masterPath, paths.savePath);
      if (backups.length === 0) console.log('백업이 없습니다.');
      else backups.forEach((backup, index) => console.log(`  ${index + 1}. ${backup}`));
    } else if (answer === '5' || answer === '') return;
    else console.log('잘못된 선택입니다.');
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const interactiveMode = !options.command;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const paths = await choosePaths(interactiveMode ? rl : null, options);
    if (interactiveMode) {
      await interactive(rl, paths);
      return;
    }
    if (options.command === 'status') {
      printStatus(paths.masterPath, paths.savePath, getStatus(paths.masterPath, paths.savePath));
    } else if (options.command === 'apply') {
      if (!options.yes) fail('명령행 적용에는 --yes가 필요합니다.');
      const result = applyPatch(paths.masterPath, paths.savePath);
      console.log(result.alreadyInstalled ? '이미 적용되어 있습니다.' : `적용 완료: ${result.backup.directory}`);
    } else if (options.command === 'remove') {
      if (!options.yes) fail('명령행 제거에는 --yes가 필요합니다.');
      const result = removePatch(paths.masterPath, paths.savePath);
      console.log(result.alreadyRemoved ? '이미 제거되어 있습니다.' : `제거 완료: ${result.backup.directory}`);
    } else if (options.command === 'restore') {
      if (!options.yes) fail('명령행 복원에는 --yes가 필요합니다.');
      const result = restoreBackup(paths.masterPath, paths.savePath, options.backupInput);
      console.log(`복원 완료: ${result.directory}`);
    } else if (options.command === 'backups') {
      const backups = listBackupSets(paths.masterPath, paths.savePath);
      if (!backups.length) console.log('백업이 없습니다.');
      else backups.forEach((backup) => console.log(backup));
    } else {
      fail('사용법: status | apply --yes | remove --yes | restore --yes [--backup 폴더] | backups');
    }
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\n오류: ${error.message}`);
    if (!error.userFacing && process.env.LID_DEBUG === '1') console.error(error.stack);
    process.exitCode = 1;
  });
}

module.exports = {
  WARP_POINTS,
  readSave,
  packSave,
  replaceOpenElevatorFloors,
  getDatabasePatchState,
  installDatabasePatch,
  removeDatabasePatch,
  getStatus,
};

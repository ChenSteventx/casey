// 闭环取证边车的落盘层：四层闸（顶层 exact-key → 类型/长度 → 地址形态 → 规范化整文凭据末门）、
// 按完整摘要派生文件名、先闸后盘的原子写，以及只认本次摘要的读取方。
// 分层理由：写盘绝不许经传递依赖爬进双回放纯核心，所以纯核心只导入同族上下文件，
// 本件的全仓导入站点只有录制 CLI 一处（金牌全仓扫描逐条钉）。
// 三码闭合：EVIDENCE_SCHEMA_REJECTED / EVIDENCE_CREDENTIAL_REJECTED / EVIDENCE_WRITE_FAILED。
// 读取侧同样只用这三码作答：档缺席、读不动、解析不了、绑定失配，都是「证不出本次取证」。

import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { credentialGate } from '../cred-gate.mjs';
import { hasEmbeddedScheme } from '../record-capture.mjs';
import {
  CYCLE_EVIDENCE_ARTIFACT_KIND,
  CYCLE_EVIDENCE_ERROR_NAMES,
  CYCLE_EVIDENCE_EVENT_KEYS,
  CYCLE_EVIDENCE_REASONS,
  CYCLE_EVIDENCE_REFUSAL_POINTS,
  CYCLE_EVIDENCE_SCHEMA_VERSION,
  CYCLE_EVIDENCE_STAGES,
  CYCLE_EVIDENCE_ACTIONS,
  CYCLE_EVIDENCE_RESOLUTIONS,
} from './cycle-evidence-context.mjs';

export const CYCLE_EVIDENCE_REJECTION_CODES = Object.freeze([
  'EVIDENCE_SCHEMA_REJECTED', 'EVIDENCE_CREDENTIAL_REJECTED', 'EVIDENCE_WRITE_FAILED',
]);

export const CYCLE_EVIDENCE_DOCUMENT_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'captureSha256', 'recordedAt', 'stages', 'events',
]);

const SCHEMA_REJECTED = 'EVIDENCE_SCHEMA_REJECTED';
const CREDENTIAL_REJECTED = 'EVIDENCE_CREDENTIAL_REJECTED';
const WRITE_FAILED = 'EVIDENCE_WRITE_FAILED';

const DIGEST_RE = /^[0-9a-f]{64}$/;
const RECORDED_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_EVENTS = 4096;
const MAX_TEXT_BYTES = 4_194_304;

const REFUSAL_POINT_SET = new Set(CYCLE_EVIDENCE_REFUSAL_POINTS);
const STAGE_SET = new Set(CYCLE_EVIDENCE_STAGES);
const EVENT_KEY_SET = new Set(CYCLE_EVIDENCE_EVENT_KEYS);
const ERROR_NAME_SET = new Set(CYCLE_EVIDENCE_ERROR_NAMES);
const REASON_SET = new Set(CYCLE_EVIDENCE_REASONS);
const ACTION_SET = new Set(CYCLE_EVIDENCE_ACTIONS);
const RESOLUTION_SET = new Set(CYCLE_EVIDENCE_RESOLUTIONS);

let tempOrdinal = 0;

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function counted(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 地址形态同口径：内嵌 scheme、百分号编码走私，以及协议相对地址的双斜杠。
// 合格边车全文出自固定枚举 + 十六进制摘要 + 时间戳，任何双斜杠都只可能是走私。
function hasAddressForm(value) {
  const text = String(value);
  return hasEmbeddedScheme(text) || text.includes('//');
}

function legalField(key, value) {
  switch (key) {
    case 'refusalPoint': return REFUSAL_POINT_SET.has(value);
    case 'stage': return STAGE_SET.has(value);
    case 'reason': return REASON_SET.has(value);
    case 'errorName': return ERROR_NAME_SET.has(value);
    case 'action': return ACTION_SET.has(value);
    case 'resolution': return RESOLUTION_SET.has(value);
    case 'seq': return counted(value);
    case 'candidateCount': return counted(value);
    case 'performOk': return typeof value === 'boolean';
    default: return false;
  }
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

// 一层：顶层 exact-key 白名单。二层：逐字段类型/长度/枚举。
function screenShape(document) {
  if (!exactKeys(document, CYCLE_EVIDENCE_DOCUMENT_KEYS)) return SCHEMA_REJECTED;
  if (document.schemaVersion !== CYCLE_EVIDENCE_SCHEMA_VERSION) return SCHEMA_REJECTED;
  if (document.artifactKind !== CYCLE_EVIDENCE_ARTIFACT_KIND) return SCHEMA_REJECTED;
  if (typeof document.captureSha256 !== 'string'
    || !DIGEST_RE.test(document.captureSha256)) return SCHEMA_REJECTED;
  if (typeof document.recordedAt !== 'string'
    || !RECORDED_AT_RE.test(document.recordedAt)) return SCHEMA_REJECTED;
  if (!Array.isArray(document.stages) || document.stages.length > CYCLE_EVIDENCE_STAGES.length) {
    return SCHEMA_REJECTED;
  }
  const seenStages = new Set();
  for (const stage of document.stages) {
    if (!STAGE_SET.has(stage) || seenStages.has(stage)) return SCHEMA_REJECTED;
    seenStages.add(stage);
  }
  if (!Array.isArray(document.events) || document.events.length > MAX_EVENTS) {
    return SCHEMA_REJECTED;
  }
  for (const event of document.events) {
    if (!isRecord(event)) return SCHEMA_REJECTED;
    for (const [key, value] of Object.entries(event)) {
      if (!EVENT_KEY_SET.has(key) && key !== 'refusalPoint') return SCHEMA_REJECTED;
      if (!legalField(key, value)) return SCHEMA_REJECTED;
    }
    if (!REFUSAL_POINT_SET.has(event.refusalPoint)) return SCHEMA_REJECTED;
    if (!STAGE_SET.has(event.stage)) return SCHEMA_REJECTED;
  }
  return null;
}

// 三层：地址形态逐串扫（键与值同扫）。
function screenAddresses(document) {
  const pending = [document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (Array.isArray(node)) {
      for (const item of node) pending.push(item);
      continue;
    }
    if (isRecord(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (hasAddressForm(key)) return CREDENTIAL_REJECTED;
        pending.push(value);
      }
      continue;
    }
    if (typeof node === 'string' && hasAddressForm(node)) return CREDENTIAL_REJECTED;
  }
  return null;
}

// 文档面三层闸：形状 → 类型 → 地址形态。末门整文扫在 screenCycleEvidenceText。
export function screenCycleEvidenceDocument(document) {
  const shape = screenShape(document);
  if (shape) return denied(shape);
  const address = screenAddresses(document);
  if (address) return denied(address);
  return frozen({ ok: true });
}

// 末门：规范化整文一并过地址形态与现役凭据兜底门，命中即整文拒写。
export function screenCycleEvidenceText(text) {
  if (typeof text !== 'string' || text.length === 0) return denied(SCHEMA_REJECTED);
  if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) return denied(SCHEMA_REJECTED);
  if (hasAddressForm(text)) return denied(CREDENTIAL_REJECTED);
  let gate;
  try {
    gate = credentialGate({ 'cycle-evidence.json': text });
  } catch {
    return denied(CREDENTIAL_REJECTED);
  }
  if (gate?.ok !== true) return denied(CREDENTIAL_REJECTED);
  return frozen({ ok: true });
}

// 文件名按完整摘要派生：异 capture 天然不碰撞，前 12 位相同的两枚摘要也落不到同一目标。
export function cycleEvidenceFileName(captureSha256) {
  if (typeof captureSha256 !== 'string' || !DIGEST_RE.test(captureSha256)) return null;
  return `cycle-evidence.${captureSha256}.json`;
}

function canonicalEvent(event) {
  const row = {};
  for (const key of CYCLE_EVIDENCE_EVENT_KEYS) {
    if (key === 'refusalPoint') continue;
    if (Object.hasOwn(event, key)) row[key] = event[key];
  }
  return { refusalPoint: event.refusalPoint, ...row };
}

function stagesOf(events) {
  const seen = new Set(events.map((event) => event.stage));
  return CYCLE_EVIDENCE_STAGES.filter((stage) => seen.has(stage));
}

// 成档：中毒批次一律拒付，绝不静默丢单条冒充完整；键序固定，同一批次逐字节可复现。
export function buildCycleEvidenceDocument({ snapshot, captureSha256, recordedAt } = {}) {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.events)) return denied(SCHEMA_REJECTED);
  if (snapshot.poisoned === true) return denied(SCHEMA_REJECTED);
  if (typeof captureSha256 !== 'string' || !DIGEST_RE.test(captureSha256)) {
    return denied(SCHEMA_REJECTED);
  }
  const stamped = recordedAt === undefined || recordedAt === null
    ? new Date().toISOString()
    : recordedAt;
  if (typeof stamped !== 'string' || !RECORDED_AT_RE.test(stamped)) return denied(SCHEMA_REJECTED);
  let events;
  try {
    events = snapshot.events.map((event) => canonicalEvent(event));
  } catch {
    return denied(SCHEMA_REJECTED);
  }
  const document = {
    schemaVersion: CYCLE_EVIDENCE_SCHEMA_VERSION,
    artifactKind: CYCLE_EVIDENCE_ARTIFACT_KIND,
    captureSha256,
    recordedAt: stamped,
    stages: stagesOf(events),
    events,
  };
  const screened = screenCycleEvidenceDocument(document);
  if (screened.ok !== true) return denied(screened.reason);
  return frozen({ ok: true, document });
}

function serialize(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function discardTemp(path) {
  try {
    unlinkSync(path);
  } catch { /* 临时件已不在即可，拒写路径绝不触碰既有目标 */ }
}

// 先闸后盘：内存内序列化 → 四层闸 → 才写临时件 → rename。
// 拒写路径零临时件零目标写入；写失败只清临时件，既有目标一个字节都不动。
export function writeCycleEvidenceSidecar({ outDir, document } = {}) {
  if (typeof outDir !== 'string' || !outDir) return denied(SCHEMA_REJECTED);
  const screened = screenCycleEvidenceDocument(document);
  if (screened.ok !== true) return denied(screened.reason);
  const fileName = cycleEvidenceFileName(document.captureSha256);
  if (!fileName) return denied(SCHEMA_REJECTED);
  let text;
  try {
    text = serialize(document);
  } catch {
    return denied(SCHEMA_REJECTED);
  }
  const gated = screenCycleEvidenceText(text);
  if (gated.ok !== true) return denied(gated.reason);

  tempOrdinal += 1;
  const tempPath = join(outDir, `${fileName}.${process.pid}-${tempOrdinal}.tmp`);
  try {
    writeFileSync(tempPath, text, { encoding: 'utf8', flag: 'wx' });
  } catch {
    discardTemp(tempPath);
    return denied(WRITE_FAILED);
  }
  try {
    renameSync(tempPath, join(outDir, fileName));
  } catch {
    discardTemp(tempPath);
    return denied(WRITE_FAILED);
  }
  return frozen({ ok: true, fileName });
}

// 读取方：按完整摘要派生名定位，再用顶层摘要复核绑定。
// 口径（威胁模型见 GRILL D4）：单侧误放/残留旧档、或改名但内文摘要未同步——在此拦下；
// 协调双改（改名 + 同步改内文顶层摘要）在界外，本层不声称拦得住。
export function readCycleEvidence(captureSha256, options = {}) {
  const fileName = cycleEvidenceFileName(captureSha256);
  if (!fileName) return denied(SCHEMA_REJECTED);
  const outDir = options?.outDir;
  if (typeof outDir !== 'string' || !outDir) return denied(SCHEMA_REJECTED);
  let text;
  try {
    text = readFileSync(join(outDir, fileName), 'utf8');
  } catch {
    return denied(SCHEMA_REJECTED);
  }
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    return denied(SCHEMA_REJECTED);
  }
  const screened = screenCycleEvidenceDocument(document);
  if (screened.ok !== true) return denied(screened.reason);
  if (document.captureSha256 !== captureSha256) return denied(SCHEMA_REJECTED);
  return frozen({ ok: true, document });
}

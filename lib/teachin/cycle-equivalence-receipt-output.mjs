// teach-in cycle 成功等价收据落盘：只持久化 comparator 已铸成的安全摘要，
// 不写 pairId、页面值、locator、目标地址或凭据。形状/凭据闸通过后才原子发布。

import { createHash } from 'node:crypto';
import { renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { credentialGate } from '../cred-gate.mjs';
import { hasEmbeddedScheme } from '../record-capture.mjs';

const RECEIPT_KEYS = [
  'schemaVersion', 'artifactKind', 'pairId', 'scope', 'sourceReceiptSha256',
  'distilledReceiptSha256', 'comparedDimensions',
];
const CYCLE_KEYS = ['ok', 'developmentOnly', 'promotionReady', 'equivalenceReceipt'];
const DIMENSIONS = Object.freeze([
  'intent-verdict', 'terminal-hard-predicate', 'topology', 'entity', 'effect', 'cleanup',
]);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const CAPTURE_HASH_RE = /^[0-9a-f]{64}$/;
const REJECTED = 'CYCLE_EQUIVALENCE_RECEIPT_REJECTED';
const CREDENTIAL_REJECTED = 'CYCLE_EQUIVALENCE_RECEIPT_CREDENTIAL_REJECTED';
const WRITE_FAILED = 'CYCLE_EQUIVALENCE_RECEIPT_WRITE_FAILED';
let tempOrdinal = 0;

const frozen = (value) => Object.freeze(value);
const denied = (reason) => frozen({ ok: false, reason });
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).sort().join(' ') === [...keys].sort().join(' ');

function validCycle(cycle) {
  if (!exactKeys(cycle, CYCLE_KEYS)
    || cycle.ok !== true || cycle.developmentOnly !== true || cycle.promotionReady !== false) {
    return false;
  }
  const receipt = cycle.equivalenceReceipt;
  if (!exactKeys(receipt, RECEIPT_KEYS)
    || receipt.schemaVersion !== 1
    || receipt.artifactKind !== 'dual-replay-equivalence-receipt'
    || typeof receipt.pairId !== 'string' || !receipt.pairId
    || receipt.scope !== 'read-only-v1'
    || !HASH_RE.test(receipt.sourceReceiptSha256 || '')
    || !HASH_RE.test(receipt.distilledReceiptSha256 || '')
    || receipt.sourceReceiptSha256 === receipt.distilledReceiptSha256
    || !Array.isArray(receipt.comparedDimensions)
    || receipt.comparedDimensions.length !== DIMENSIONS.length) return false;
  return receipt.comparedDimensions.every((dimension, index) => dimension === DIMENSIONS[index]);
}

function hasAddressForm(text) {
  return hasEmbeddedScheme(text) || text.includes('//');
}

function discard(path) {
  try { unlinkSync(path); } catch { /* 临时件已不在即可 */ }
}

export function persistTeachinCycleEquivalenceReceipt({ outDir, captureBytes, cycle } = {}) {
  const bytes = Buffer.isBuffer(captureBytes) || captureBytes instanceof Uint8Array
    ? Buffer.from(captureBytes) : null;
  if (typeof outDir !== 'string' || !outDir || !bytes || bytes.length === 0 || !validCycle(cycle)) {
    return denied(REJECTED);
  }
  const captureSha256 = createHash('sha256').update(bytes).digest('hex');
  if (!CAPTURE_HASH_RE.test(captureSha256)) return denied(REJECTED);
  const receipt = cycle.equivalenceReceipt;
  const document = {
    schemaVersion: 1,
    artifactKind: 'teachin-cycle-equivalence-receipt',
    captureSha256,
    developmentOnly: true,
    promotionReady: false,
    sourceReceiptSha256: receipt.sourceReceiptSha256,
    distilledReceiptSha256: receipt.distilledReceiptSha256,
    comparedDimensions: [...DIMENSIONS],
  };
  let text;
  try { text = `${JSON.stringify(document, null, 2)}\n`; } catch { return denied(REJECTED); }
  if (hasAddressForm(text)) return denied(CREDENTIAL_REJECTED);
  let gated;
  try { gated = credentialGate({ 'cycle-equivalence-receipt.json': text }); } catch {
    return denied(CREDENTIAL_REJECTED);
  }
  if (gated?.ok !== true) return denied(CREDENTIAL_REJECTED);

  const fileName = `cycle-equivalence-receipt.${captureSha256}.json`;
  tempOrdinal += 1;
  const tempPath = join(outDir, `${fileName}.${process.pid}-${tempOrdinal}.tmp`);
  try {
    writeFileSync(tempPath, text, { encoding: 'utf8', flag: 'wx' });
  } catch {
    discard(tempPath);
    return denied(WRITE_FAILED);
  }
  try {
    renameSync(tempPath, join(outDir, fileName));
  } catch {
    discard(tempPath);
    return denied(WRITE_FAILED);
  }
  return frozen({ ok: true, fileName });
}


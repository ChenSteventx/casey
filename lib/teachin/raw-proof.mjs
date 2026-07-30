// CLEAN proof authority 的铸造、非消费式验真与 exact bytes 一次性消费。
// 纯核心：零 browser、零 fs、零 network、零 LLM。CLEAN 只表示「原始动作已在 fresh runtime 全部复现」，
// 不是测试结论，不进裁判，也不产正式报告（护栏 #15）。持久化 proof 文件永远无法自行重建本 authority。

import { createHash } from 'node:crypto';

const CLEAN_PROOF_STATE = new WeakMap();

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function readRecord(cleanProofAuthority) {
  return cleanProofAuthority && typeof cleanProofAuthority === 'object'
    ? CLEAN_PROOF_STATE.get(cleanProofAuthority) || null
    : null;
}

// 只供同进程 raw runner 在 genuine CLEAN 后铸造；FAILED 一律不铸。
export function sealCleanRawReplay({ captureSha256 } = {}) {
  if (typeof captureSha256 !== 'string' || !captureSha256) {
    return denied('CLEAN_PROOF_AUTHORITY_INVALID');
  }
  const cleanProofAuthority = frozen(Object.create(null));
  CLEAN_PROOF_STATE.set(cleanProofAuthority, {
    captureSha256,
    consumed: false,
  });
  return frozen({ ok: true, cleanProofAuthority });
}

// 非消费式真伪检查：只回 captureSha256，不返回 bytes，也不改变一次性消费状态。
export function inspectCleanRawReplayAuthority(options = {}) {
  let cleanProofAuthority;
  try {
    if (!options || typeof options !== 'object') {
      return denied('CLEAN_PROOF_AUTHORITY_INVALID');
    }
    ({ cleanProofAuthority } = options);
  } catch {
    return denied('CLEAN_PROOF_AUTHORITY_INVALID');
  }
  const record = readRecord(cleanProofAuthority);
  if (!record || record.consumed) return denied('CLEAN_PROOF_AUTHORITY_INVALID');
  return frozen({ ok: true, captureSha256: record.captureSha256 });
}

// exact bytes 一次性消费：换字段、换空白、换行或换键序都属于换包。
export function consumeCleanRawReplay(options = {}) {
  let cleanProofAuthority;
  let currentCaptureBytes;
  try {
    if (!options || typeof options !== 'object') {
      return denied('CLEAN_PROOF_AUTHORITY_INVALID');
    }
    ({ cleanProofAuthority, currentCaptureBytes } = options);
  } catch {
    return denied('CLEAN_PROOF_AUTHORITY_INVALID');
  }
  const record = readRecord(cleanProofAuthority);
  if (!record || record.consumed) return denied('CLEAN_PROOF_AUTHORITY_INVALID');
  const bytes = Buffer.isBuffer(currentCaptureBytes)
    ? currentCaptureBytes
    : (currentCaptureBytes instanceof Uint8Array
      ? Buffer.from(currentCaptureBytes)
      : null);
  if (!bytes) return denied('CAPTURE_HASH_MISMATCH');
  const captureSha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (captureSha256 !== record.captureSha256) return denied('CAPTURE_HASH_MISMATCH');
  record.consumed = true;
  return frozen({ ok: true, captureSha256: record.captureSha256 });
}

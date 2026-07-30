// raw proof 的唯一落盘边界：凭据门先于任何 I/O，写盘复用现役 atomicWriteFileSync。
// 本模块不自建第二套写/rename 协议，也不回显路径、内容或门命中详情（护栏 #14 fail-safe）。

import { credentialGate } from '../cred-gate.mjs';
import { atomicWriteFileSync } from '../promptset-authoring.mjs';

// 交给凭据门的产物 label 固定为 artifactKind，不是路径：路径本身可能携带 case 或环境信息。
const PROOF_OUTPUT_LABEL = 'teach-in-raw-replay-proof';

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function copyBytes(proofBytes) {
  if (Buffer.isBuffer(proofBytes)) return Buffer.from(proofBytes);
  if (proofBytes instanceof Uint8Array) return Buffer.from(proofBytes);
  return null;
}

// 工厂只供 canonical 装配与 zero-SUT 注入；CLI 不接 writer/provider。
export function createRawProofOutputWriter(dependencies = {}) {
  const gate = dependencies && typeof dependencies === 'object'
    ? dependencies.credentialGate : undefined;
  const write = dependencies && typeof dependencies === 'object'
    ? dependencies.atomicWriteFileSync : undefined;
  const usable = typeof gate === 'function' && typeof write === 'function';
  return frozen({
    writeRawReplayProof(options = {}) {
      if (!usable) return denied('RAW_PROOF_OUTPUT_REJECTED');
      let outputPath;
      let proofBytes;
      try {
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
          return denied('RAW_PROOF_OUTPUT_REJECTED');
        }
        ({ outputPath, proofBytes } = options);
      } catch {
        return denied('RAW_PROOF_OUTPUT_REJECTED');
      }
      if (typeof outputPath !== 'string' || !outputPath) {
        return denied('RAW_PROOF_OUTPUT_REJECTED');
      }
      const bytes = copyBytes(proofBytes);
      if (!bytes || bytes.length === 0) return denied('RAW_PROOF_OUTPUT_REJECTED');
      const text = bytes.toString('utf8');

      let gated;
      try {
        gated = gate({ [PROOF_OUTPUT_LABEL]: text });
      } catch {
        return denied('RAW_PROOF_OUTPUT_REJECTED');
      }
      if (!gated || gated.ok !== true) return denied('RAW_PROOF_OUTPUT_REJECTED');

      try {
        write(outputPath, text);
      } catch {
        // 现役 atomic writer 已负责清理 sidecar 并保留原目标；这里只做稳定降权。
        return denied('RAW_PROOF_WRITE_FAILED');
      }
      return frozen({ ok: true });
    },
  });
}

const canonicalRawProofOutputWriter = createRawProofOutputWriter({
  credentialGate,
  atomicWriteFileSync,
});

export function writeRawReplayProof(options = {}) {
  return canonicalRawProofOutputWriter.writeRawReplayProof(options);
}

// verified entity lock verification handle 的 mint/consume 接缝。
// 纯核心：零 browser、零 fs、零 network、零 LLM，也不裁定。
// 它只做一件事：把「已验证的 entity lock 事实」封成不可伪造、只可消费一次的私有 capability，
// 并在消费时对 authoring closure、case、events 与 digest 逐项复核。
// mint 只应由 canonical runtime verifier 调用；consume 只应由 pure pair sealer 调用。

import { createHash } from 'node:crypto';

const HANDLE_STATE = new WeakMap();
const CONSUME_KEYS = [
  'caseId', 'eventsBytes', 'handle', 'setSha256', 'verificationScopeAuthority',
];

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

function digestOf(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

// handle 只在本模块内铸造：调用方自报的 handle 永远进不来，clone 也不携带私有状态。
export function mintVerifiedEntityLockVerification(record) {
  const handle = frozen(Object.create(null));
  HANDLE_STATE.set(handle, { ...record, consumed: false });
  return handle;
}

// pair sealer 的唯一复核入口：同一 authoring closure、同一 case/events/digest 才放行，一次性消费。
export function consumeVerifiedEntityLockVerification(options = {}) {
  if (!exactKeys(options, CONSUME_KEYS)) {
    return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
  }
  const record = isRecord(options.handle) ? HANDLE_STATE.get(options.handle) : null;
  if (!record || record.consumed) {
    return denied('ENTITY_LOCK_VERIFICATION_HANDLE_INVALID');
  }
  if (!Buffer.isBuffer(options.eventsBytes)) {
    return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
  }
  if (record.caseId !== options.caseId
    || record.setSha256 !== options.setSha256
    || record.verificationScopeAuthority !== options.verificationScopeAuthority
    || record.eventsSha256 !== digestOf(options.eventsBytes)) {
    return denied('ENTITY_LOCK_VERIFICATION_BINDING_MISMATCH');
  }
  record.consumed = true;
  return frozen({
    ok: true,
    mode: record.mode,
    runtimeAuthorized: record.runtimeAuthorized,
    runtimeEntityLockHandle: record.runtimeEntityLockHandle,
    setSha256: record.setSha256,
  });
}

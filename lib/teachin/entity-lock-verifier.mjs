// canonical entity lock verifier：先用现役 replay admission 对 exact formal events 分类，
// 再决定是 no-entity 只读通道还是必须由现役 v2 handle + publication root 授权的 runtime 通道。
// caller 的 noEntity/mode/handle/digest 一律不收；verification handle 是不可伪造、只可消费一次的
// 内部 capability，只有同一 authoring closure、同一 case/events/digest 才能复核。

import { createHash } from 'node:crypto';
import { checkReplayEntityAdmission } from '../entity-semantic-lock-preflight.mjs';
import {
  REPLAY_ENTITY_ADMISSION_LOCK_REQUIRED_REASONS,
} from '../replay/entity-admission-reasons.mjs';
import { verifyEntityLockSet } from '../entity-semantic-lock-v2.mjs';
import { ENTITY_SEMANTIC_LOCK_PUBLICATIONS } from '../entity-semantic-lock-publications.mjs';
import { mintVerifiedEntityLockVerification } from '../dual-replay/entity-lock-handle.mjs';
import { consumeAuthoringProfileReadEnvelope } from './runtime-owner.mjs';

// verification handle 的铸造与一次性复核都住在纯 dual seam；本模块只做「判定」并铸权，
// 复核入口原样再导出，供既有 pair sealer 消费面不变。
export * from '../dual-replay/entity-lock-handle.mjs';

const VERIFY_KEYS = ['caseId', 'eventsBytes', 'verificationScopeAuthority'];
const RUNTIME_HANDLE_STATE = new WeakMap();

// 首版 no-entity 的 source lock exact bytes 固定 UTF-8 `[]`。
const EMPTY_LOCK_SET_BYTES = Buffer.from('[]', 'utf8');
const EMPTY_LOCK_SET_SHA256 = `sha256:${createHash('sha256')
  .update(EMPTY_LOCK_SET_BYTES).digest('hex')}`;

// admission 非 ok 的缺省是「原因照原样拒绝」；只有现役 preflight 自己列为「需锁」的 reason
// 才允许继续走 runtime entity 通道。枚举与 preflight 同源导出（禁手抄漂移），
// 因此 preflight 将来新增的任何拒绝原因都默认落在拒绝侧，不会悄悄流进铸权分支。
const LOCK_REQUIRED_ADMISSION_REASONS = new Set(
  REPLAY_ENTITY_ADMISSION_LOCK_REQUIRED_REASONS,
);

// canonical 接缝：formal events 必须先经现役 replay admission 分类，再进入现役 v2 handle gate。
function canonicalAdmission(input) {
  return checkReplayEntityAdmission(input);
}

function canonicalLockSetVerification(input) {
  return verifyEntityLockSet(input);
}

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function digestOf(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function rememberRuntimeHandle(handle, binding) {
  if (!isRecord(handle)) return;
  RUNTIME_HANDLE_STATE.set(handle, {
    caseId: binding.caseId,
    eventsSha256: digestOf(binding.eventsBytes),
  });
}

// formal replay preflight 的同进程复核面：只认本 verifier 确实验证并登记过的
// runtime handle，且 exact case/events bytes 不变。plain/clone/跨 run 句柄均拒。
export function verifyDistilledEntityAdmission(options = {}) {
  if (!exactKeys(options, ['caseId', 'eventsBytes', 'handle'])) {
    return denied('ENTITY_LOCK_AUTHORITY_INVALID');
  }
  if (!Buffer.isBuffer(options.eventsBytes)) return denied('ENTITY_LOCK_AUTHORITY_INVALID');
  const record = isRecord(options.handle) ? RUNTIME_HANDLE_STATE.get(options.handle) : null;
  if (!record || record.caseId !== options.caseId
    || record.eventsSha256 !== digestOf(options.eventsBytes)) {
    return denied('ENTITY_LOCK_AUTHORITY_INVALID');
  }
  return frozen({ ok: true });
}

function parseEventsDocument(eventsBytes) {
  let document;
  try {
    document = JSON.parse(eventsBytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!isRecord(document) || !Array.isArray(document.events)) return null;
  return document;
}

// 每项 entityBindings 缺席或严格 [] 才可能走 no-entity 通道。
function declaresNoEntityBindings(document) {
  return document.events.every((event) => {
    if (!isRecord(event)) return false;
    if (!Object.hasOwn(event, 'entityBindings')) return true;
    return Array.isArray(event.entityBindings) && event.entityBindings.length === 0;
  });
}

function publicationDigest(publications, authority) {
  const contractId = typeof authority?.contractId === 'string' ? authority.contractId : null;
  const lockSetKey = typeof authority?.lockSetKey === 'string' ? authority.lockSetKey : null;
  if (!contractId || !lockSetKey) return null;
  const publication = publications?.[contractId];
  if (!isRecord(publication) || !isRecord(publication.locks)) return null;
  const bare = publication.locks[lockSetKey];
  if (typeof bare !== 'string' || !/^[a-f0-9]{64}$/.test(bare)) return null;
  return `sha256:${bare}`;
}

function mintHandle(record) {
  return mintVerifiedEntityLockVerification(record);
}

// 注入的现役 verification 接缝只替换「判定」，绝不替换铸权：handle 仍只在本模块内铸造，
// 并绑定同一 scope/case/events/digest 供一次性复核。caller 自报的 handle 永远进不来。
function mintSeamVerification(result, binding) {
  if (!isRecord(result)) return denied('ENTITY_LOCK_AUTHORITY_INVALID');
  if (result.ok !== true) {
    return denied(typeof result.reason === 'string' ? result.reason : 'ENTITY_LOCK_AUTHORITY_INVALID');
  }
  const mode = result.mode;
  if (mode !== 'not-required' && mode !== 'runtime-required') {
    return denied('ENTITY_LOCK_AUTHORITY_INVALID');
  }
  const runtimeAuthorized = result.runtimeAuthorized === true;
  const setSha256 = result.setSha256;
  if (typeof setSha256 !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(setSha256)) {
    return denied('ENTITY_LOCK_DIGEST_UNAVAILABLE');
  }
  // 未获授权的 runtime 通道不铸 handle：candidate 与 distilled 都不得据此推进。
  if (mode === 'runtime-required' && !runtimeAuthorized) {
    return frozen({
      ok: true, handle: null, mode, runtimeAuthorized: false, setSha256,
    });
  }
  if (mode === 'runtime-required') rememberRuntimeHandle(result.handle, binding);
  return frozen({
    ok: true,
    handle: mintHandle({
      mode,
      runtimeAuthorized,
      runtimeEntityLockHandle: mode === 'runtime-required' ? result.handle || null : null,
      setSha256,
      caseId: binding.caseId,
      eventsSha256: digestOf(binding.eventsBytes),
      verificationScopeAuthority: binding.verificationScopeAuthority,
    }),
    mode,
    runtimeAuthorized,
    setSha256,
  });
}

export function createEntityLockVerifier(deps = {}) {
  const verifyRuntimeSeam = typeof deps.verifyRuntimeEntityLock === 'function'
    ? deps.verifyRuntimeEntityLock
    : null;
  const admit = typeof deps.checkReplayEntityAdmission === 'function'
    ? deps.checkReplayEntityAdmission
    : canonicalAdmission;
  const verifySet = typeof deps.verifyEntityLockSet === 'function'
    ? deps.verifyEntityLockSet
    : canonicalLockSetVerification;
  const publications = isRecord(deps.entityLockPublications)
    ? deps.entityLockPublications
    : ENTITY_SEMANTIC_LOCK_PUBLICATIONS;

  function verify(options = {}) {
    const hasAuthority = isRecord(options) && Object.hasOwn(options, 'authority');
    const allowed = hasAuthority ? [...VERIFY_KEYS, 'authority'] : VERIFY_KEYS;
    if (!exactKeys(options, allowed)) {
      return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
    }
    const { caseId, eventsBytes, verificationScopeAuthority } = options;
    if (typeof caseId !== 'string' || !caseId) {
      return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
    }
    if (!Buffer.isBuffer(eventsBytes) || eventsBytes.length === 0) {
      return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
    }
    if (!isRecord(verificationScopeAuthority)) {
      return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
    }
    if (hasAuthority && !isRecord(options.authority)) {
      return denied('ENTITY_LOCK_VERIFICATION_INPUT_INVALID');
    }
    if (verifyRuntimeSeam) {
      let seamResult;
      try {
        seamResult = verifyRuntimeSeam({
          ...(hasAuthority ? { authority: options.authority } : {}),
          caseId,
          eventsBytes,
          verificationScopeAuthority,
        });
      } catch {
        return denied('ENTITY_LOCK_AUTHORITY_INVALID');
      }
      return mintSeamVerification(seamResult, {
        caseId, eventsBytes, verificationScopeAuthority,
      });
    }

    const eventsDocument = parseEventsDocument(eventsBytes);
    if (!eventsDocument) return denied('REPLAY_EVENTS_INVALID');

    // 先按现役 admission 对 exact formal events 分类，再决定是否进入 v2。
    let admission;
    try {
      admission = admit({ caseId, eventsBytes, eventsDocument });
    } catch {
      return denied('REPLAY_EVENTS_INVALID');
    }
    let profileReadAdmitted = false;
    if (admission?.ok !== true
      && admission?.reason === 'REPLAY_READ_EVENT_TARGET_INVALID') {
      profileReadAdmitted = consumeAuthoringProfileReadEnvelope({
        authoringClosureAuthority: verificationScopeAuthority,
        caseId,
        eventsBytes,
      })?.ok === true;
    }
    if (admission?.ok !== true && !profileReadAdmitted) {
      const reason = typeof admission?.reason === 'string' ? admission.reason : null;
      // 缺省首错停：不在「需锁」白名单里的拒绝一律照原 reason 拒，绝不落进 entity 分支。
      if (!reason || !LOCK_REQUIRED_ADMISSION_REASONS.has(reason)) {
        return denied(reason || 'REPLAY_EVENTS_INVALID');
      }
    }
    const noEntityRequired = (admission?.ok === true || profileReadAdmitted)
      && declaresNoEntityBindings(eventsDocument);

    if (noEntityRequired) {
      // legacy fixed-route read 在 distilled preflight 会再次直接通过 admission，继续不带
      // runtime handle。profile-bound custom route 则须把本次 exact case/events 的私有
      // admission 证明沿 candidate→pair→distilled run 传下去，供二次 preflight fallback。
      const distilledAdmissionHandle = profileReadAdmitted
        ? frozen(Object.create(null))
        : null;
      if (distilledAdmissionHandle) {
        rememberRuntimeHandle(distilledAdmissionHandle, { caseId, eventsBytes });
      }
      return frozen({
        ok: true,
        handle: mintHandle({
          mode: 'not-required',
          runtimeAuthorized: false,
          runtimeEntityLockHandle: distilledAdmissionHandle,
          setSha256: EMPTY_LOCK_SET_SHA256,
          caseId,
          eventsSha256: digestOf(eventsBytes),
          verificationScopeAuthority,
        }),
        mode: 'not-required',
        runtimeAuthorized: false,
        setSha256: EMPTY_LOCK_SET_SHA256,
      });
    }

    if (!hasAuthority) return denied('ENTITY_LOCK_RUNTIME_AUTHORITY_REQUIRED');
    let verified;
    try {
      verified = verifySet({ authority: options.authority, caseId, eventsBytes });
    } catch {
      return denied('ENTITY_LOCK_AUTHORITY_INVALID');
    }
    if (verified?.ok !== true) {
      return denied(typeof verified?.reason === 'string'
        ? verified.reason
        : 'ENTITY_LOCK_AUTHORITY_INVALID');
    }
    if (verified.runtimeAuthorized !== true) {
      return denied('ENTITY_LOCK_RUNTIME_UNAUTHORIZED');
    }
    const setSha256 = publicationDigest(publications, options.authority);
    if (!setSha256) return denied('ENTITY_LOCK_DIGEST_UNAVAILABLE');
    rememberRuntimeHandle(verified.handle, { caseId, eventsBytes });

    return frozen({
      ok: true,
      handle: mintHandle({
        mode: 'runtime-required',
        runtimeAuthorized: true,
        runtimeEntityLockHandle: verified.handle,
        setSha256,
        caseId,
        eventsSha256: digestOf(eventsBytes),
        verificationScopeAuthority,
      }),
      mode: 'runtime-required',
      runtimeAuthorized: true,
      setSha256,
    });
  }

  return frozen({ verify });
}

export const canonicalEntityLockVerifier = createEntityLockVerifier({});

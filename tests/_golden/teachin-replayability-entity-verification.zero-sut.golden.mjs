#!/usr/bin/env node
// Entity verification split: canonical no-entity read path remains executable,
// while identity-sensitive actions still require genuine runtime publication authority.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFrozenEntityLockSetAuthority } from '../../lib/entity-semantic-lock-v2.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-entity-verification';
const EMPTY_SET_SHA256 =
  'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
const failures = [];
let passed = 0;
let api;
let loadFailure = null;

try {
  api = await import('../../lib/teachin/entity-lock-verifier.mjs');
} catch (error) {
  loadFailure = String(error?.code || error?.message || error).slice(-600);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
}

function expectSuccess(result, mode, label) {
  assert(exactKeys(result, [
    'handle', 'mode', 'ok', 'runtimeAuthorized', 'setSha256',
  ]), `${label} success shape 不闭合：${JSON.stringify(result)}`);
  assert(result.ok === true && result.mode === mode,
    `${label} mode 错：${JSON.stringify(result)}`);
  assert(result.handle && Reflect.ownKeys(result.handle).length === 0,
    `${label} handle 必须无公开字段`);
  return result;
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function source(relativePath) {
  const path = resolve(ROOT, relativePath);
  assert(existsSync(path), `缺 production file ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function eventDocument(caseId, {
  atom = 'nav.workflowManagement',
  action = 'nav',
  entityBindings,
  text,
} = {}) {
  const url = '{{baseUrl}}/ai-manager/process/list';
  return {
    schemaVersion: 2,
    channel: 'web',
    caseId,
    url,
    recordedAt: '2026-07-27T00:00:00.000Z',
    compiledBy: 'casey',
    authored: false,
    events: [{
      stepId: 'atstep_1',
      intentId: 'intent_1',
      atom,
      action,
      ...(action === 'nav' ? { url } : {}),
      ...(text ? { text } : {}),
      ...(entityBindings === undefined ? {} : { entityBindings }),
    }],
  };
}

const toBytes = (value) => Buffer.from(JSON.stringify(value));
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const scopeAuthority = () => Object.freeze(Object.create(null));
const identityBinding = () => ({
  role: 'subject',
  candidate: 'candidate-agent-main',
  lockAuthority: {
    lockId: 'lock-agent-main',
    receiptHash: `sha256:${'a'.repeat(64)}`,
  },
});

if (!api) failures.push(`production API unavailable: ${loadFailure || 'ENTITY_VERIFIER_API_MISSING'}`);

if (api) {
  await check('E1 canonical pure navigation 零 binding 产 genuine not-required handle', () => {
    for (const [suffix, entityBindings] of [
      ['absent', undefined],
      ['empty', []],
    ]) {
      const caseId = `tc_entity_read_only_${suffix}`;
      const eventsBytes = toBytes(eventDocument(caseId, { entityBindings }));
      const result = expectSuccess(api.canonicalEntityLockVerifier.verify({
        verificationScopeAuthority: scopeAuthority(),
        caseId,
        eventsBytes,
      }), 'not-required', `canonical read-only ${suffix}`);
      assert(result.runtimeAuthorized === false,
        'not-required 不得伪装成实体 runtimeAuthorized');
      assert(result.setSha256 === EMPTY_SET_SHA256
        && sha256(Buffer.from('[]')) === EMPTY_SET_SHA256,
      'canonical empty set bytes/digest 漂移');
    }
  });

  await check('E2 caller 自报 no-entity/mode/handle/digest 一律 exact-input 拒绝', () => {
    const caseId = 'tc_entity_hint_attack';
    const eventsBytes = toBytes(eventDocument(caseId));
    const base = { verificationScopeAuthority: scopeAuthority(), caseId, eventsBytes };
    const attacks = [
      { noEntity: true },
      { mode: 'not-required' },
      { runtimeAuthorized: true },
      { handle: Object.freeze(Object.create(null)) },
      { setSha256: EMPTY_SET_SHA256 },
      { eventsDocument: eventDocument(caseId) },
    ];
    for (const attack of attacks) {
      expectReason(api.canonicalEntityLockVerifier.verify({ ...base, ...attack }),
        'ENTITY_LOCK_VERIFICATION_INPUT_INVALID',
        `caller hint ${Object.keys(attack)[0]}`);
    }
    expectReason(api.canonicalEntityLockVerifier.verify({ caseId, eventsBytes }),
      'ENTITY_LOCK_VERIFICATION_INPUT_INVALID', 'missing verification scope');
  });

  await check('E3 identity-sensitive read/unknown/mutation 强制 runtime authority', () => {
    const fixtures = [
      eventDocument('tc_bound_read', { entityBindings: [identityBinding()] }),
      eventDocument('tc_agent_search', { atom: 'agent.searchOpen', action: 'click' }),
      eventDocument('tc_unknown_read', { atom: 'future.identityRead', action: 'click' }),
      eventDocument('tc_mutation', { atom: 'workflow.create', action: 'click' }),
    ];
    for (const document of fixtures) {
      const eventsBytes = toBytes(document);
      const verificationScopeAuthority = scopeAuthority();
      expectReason(api.canonicalEntityLockVerifier.verify({
        verificationScopeAuthority,
        caseId: document.caseId,
        eventsBytes,
      }), 'ENTITY_LOCK_RUNTIME_AUTHORITY_REQUIRED', document.caseId);
      expectReason(api.canonicalEntityLockVerifier.verify({
        verificationScopeAuthority,
        caseId: document.caseId,
        eventsBytes,
        authority: Object.freeze({}),
      }), 'ENTITY_LOCK_AUTHORITY_INVALID', `${document.caseId} fake authority`);
    }
  });

  await check('E4 malformed/read-target errors 不能拿 entity branch 掩盖', () => {
    const malformed = eventDocument('tc_bad_action', { action: 'click' });
    expectReason(api.canonicalEntityLockVerifier.verify({
      verificationScopeAuthority: scopeAuthority(),
      caseId: malformed.caseId,
      eventsBytes: toBytes(malformed),
      authority: Object.freeze({}),
    }), 'REPLAY_READ_EVENT_ACTION_INVALID', 'known read wrong action');
    const wrongCase = eventDocument('tc_exact_case');
    expectReason(api.canonicalEntityLockVerifier.verify({
      verificationScopeAuthority: scopeAuthority(),
      caseId: 'tc_other_case',
      eventsBytes: toBytes(wrongCase),
      authority: Object.freeze({}),
    }), 'REPLAY_EVENTS_INVALID', 'case/events mismatch');
  });

  await check('E5 injected v2 正控只认 runtimeAuthorized true + published digest', () => {
    const caseId = 'tc_entity_runtime_positive';
    const document = eventDocument(caseId, { entityBindings: [identityBinding()] });
    const eventsBytes = toBytes(document);
    const verificationScopeAuthority = scopeAuthority();
    const lockSetKey = 'release/entity-lock/test/entity-locks.frozen.json';
    const bareDigest = 'b'.repeat(64);
    const authority = Object.freeze({
      contractId: 'entity-runtime-test',
      lockSetKey,
    });
    const v2Handle = Object.freeze(Object.create(null));
    const verifier = api.createEntityLockVerifier({
      verifyEntityLockSet(input) {
        if (input.authority !== authority) {
          return { ok: false, reason: 'ENTITY_LOCK_AUTHORITY_INVALID' };
        }
        assert(input.caseId === caseId
          && Buffer.isBuffer(input.eventsBytes)
          && Buffer.compare(input.eventsBytes, eventsBytes) === 0,
          'factory 必须把 exact case/events 交 v2');
        return { ok: true, handle: v2Handle, runtimeAuthorized: true };
      },
      entityLockPublications: {
        'entity-runtime-test': {
          source: 'release-resource',
          mode: 'runtime',
          locks: { [lockSetKey]: bareDigest },
        },
      },
    });
    const result = expectSuccess(verifier.verify({
      authority,
      verificationScopeAuthority,
      caseId,
      eventsBytes,
    }), 'runtime-required', 'runtime positive');
    assert(result.runtimeAuthorized === true
      && result.setSha256 === `sha256:${bareDigest}`,
    'runtime success 必须投影 genuine publication digest');
  });

  await check('E6 runtime false/缺 publication digest 均 fail-closed', () => {
    const caseId = 'tc_entity_runtime_denied';
    const eventsBytes = toBytes(eventDocument(caseId, {
      atom: 'agent.searchOpen',
      action: 'click',
    }));
    const verificationScopeAuthority = scopeAuthority();
    const authority = Object.freeze({
      contractId: 'entity-runtime-denied',
      lockSetKey: 'release/entity-lock/test/denied.json',
    });
    const verifierFor = (runtimeAuthorized, entityLockPublications) =>
      api.createEntityLockVerifier({
        verifyEntityLockSet({ authority: actual }) {
          return actual === authority
            ? { ok: true, handle: Object.freeze(Object.create(null)), runtimeAuthorized }
            : { ok: false, reason: 'ENTITY_LOCK_AUTHORITY_INVALID' };
        },
        entityLockPublications,
      });
    expectReason(verifierFor(false, {}).verify({
      authority, verificationScopeAuthority, caseId, eventsBytes,
    }),
      'ENTITY_LOCK_RUNTIME_UNAUTHORIZED', 'historical/non-runtime handle');
    expectReason(verifierFor(true, {}).verify({
      authority, verificationScopeAuthority, caseId, eventsBytes,
    }),
      'ENTITY_LOCK_DIGEST_UNAVAILABLE', 'runtime without publication digest');
  });

  await check('E7 verification handle 换包/跨 pair/clone/digest swap 不消费 genuine', () => {
    const caseId = 'tc_entity_handle_binding';
    const eventsBytes = toBytes(eventDocument(caseId));
    const verificationScopeAuthority = scopeAuthority();
    const verified = expectSuccess(api.canonicalEntityLockVerifier.verify({
      verificationScopeAuthority,
      caseId,
      eventsBytes,
    }), 'not-required', 'handle binding source');
    const consume = (patch = {}) => api.consumeVerifiedEntityLockVerification({
      handle: verified.handle,
      verificationScopeAuthority,
      caseId,
      eventsBytes,
      setSha256: verified.setSha256,
      ...patch,
    });
    expectReason(consume({ handle: { ...verified.handle } }),
      'ENTITY_LOCK_VERIFICATION_HANDLE_INVALID', 'clone handle');
    expectReason(consume({ caseId: 'tc_foreign_pair' }),
      'ENTITY_LOCK_VERIFICATION_BINDING_MISMATCH', 'cross pair');
    expectReason(consume({ verificationScopeAuthority: scopeAuthority() }),
      'ENTITY_LOCK_VERIFICATION_BINDING_MISMATCH',
      'same case/events but foreign pair closure');
    expectReason(consume({ eventsBytes: toBytes(eventDocument(caseId, {
      atom: 'assert.textVisible',
      action: 'assert',
      text: '工作流管理',
    })) }), 'ENTITY_LOCK_VERIFICATION_BINDING_MISMATCH', 'events swap');
    expectReason(consume({ setSha256: `sha256:${'f'.repeat(64)}` }),
      'ENTITY_LOCK_VERIFICATION_BINDING_MISMATCH', 'digest swap');
    expectReason(consume({ callerMode: 'not-required' }),
      'ENTITY_LOCK_VERIFICATION_INPUT_INVALID', 'consumer unknown field');
    const consumed = consume();
    assert(exactKeys(consumed, [
      'mode', 'ok', 'runtimeAuthorized', 'runtimeEntityLockHandle', 'setSha256',
    ]) && consumed.ok === true
      && consumed.mode === 'not-required'
      && consumed.runtimeAuthorized === false
      && consumed.runtimeEntityLockHandle === null
      && consumed.setSha256 === EMPTY_SET_SHA256,
    `exact consume output 错：${JSON.stringify(consumed)}`);
    expectReason(consume(), 'ENTITY_LOCK_VERIFICATION_HANDLE_INVALID',
      'handle replay');
  });

  await check('E8 未发布 entity authority 对 entity-required 明确拒绝', () => {
    const loaded = readFrozenEntityLockSetAuthority({
      contractId: 'unpublished-contract',
      lockSetKey: 'release/entity-lock/unpublished.json',
    });
    expectReason(loaded, 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED',
      'empty publication authority load');
    const document = eventDocument('tc_empty_publication', {
      atom: 'agent.searchOpen',
      action: 'click',
    });
    expectReason(api.canonicalEntityLockVerifier.verify({
      verificationScopeAuthority: scopeAuthority(),
      caseId: document.caseId,
      eventsBytes: toBytes(document),
    }), 'ENTITY_LOCK_RUNTIME_AUTHORITY_REQUIRED',
    'unpublished authority must not degrade to no-entity');
  });
}

await check('E9 production call graph 先 admission，后 v2；pair sealer 真消费 opaque handle', () => {
  const verifier = source('lib/teachin/entity-lock-verifier.mjs');
  const pairAuthority = source('lib/dual-replay/pair-authority.mjs');
  const cycle = source('lib/teachin/runtime-cycle-adapter.mjs');
  assert(/from\s+['"]\.\.\/entity-semantic-lock-preflight\.mjs['"]/.test(verifier)
    && /\bcheckReplayEntityAdmission\s*\(/.test(verifier),
  'canonical verifier 必须静态复用现役 replay admission');
  assert(/from\s+['"]\.\.\/entity-semantic-lock-v2\.mjs['"]/.test(verifier)
    && /\bverifyEntityLockSet\s*\(/.test(verifier)
    && /from\s+['"]\.\.\/entity-semantic-lock-publications\.mjs['"]/.test(verifier),
  'entity-required 必须静态复用 v2 + executable publications');
  assert(verifier.indexOf('checkReplayEntityAdmission(')
    < verifier.indexOf('verifyEntityLockSet('),
  'formal events 必须先 admission 分类，再进入 v2');
  assert(/\bconsumeVerifiedEntityLockVerification\s*\(/.test(pairAuthority)
    && /from\s+['"]\.\/entity-lock-handle\.mjs['"]/.test(pairAuthority)
    && /from\s+['"]\.\.\/dual-replay\/entity-lock-handle\.mjs['"]/.test(verifier),
  'pair sealer 必须经 entity-lock-handle 真消费 verifier 铸造的私有 handle');
  const verifyCall = cycle.match(
    /\bcanonicalEntityLockVerifier\.verify\s*\(\s*\{([^}]*)\}\s*\)/s,
  )?.[1] || '';
  const consumeCall = pairAuthority.match(
    /\bconsumeVerifiedEntityLockVerification\s*\(\s*\{([^}]*)\}\s*\)/s,
  )?.[1] || '';
  assert(/\bverificationScopeAuthority\s*:\s*authoringClosureAuthority\b/.test(verifyCall)
    && /\bverificationScopeAuthority\s*:\s*authoringClosureAuthority\b/.test(consumeCall),
  'verifier 与 pair consumer 必须绑定同一 genuine authoring closure');
  assert(/mode\s*===?\s*['"]not-required['"]/.test(cycle)
    && /mode\s*===?\s*['"]runtime-required['"]/.test(cycle)
    && /runtimeAuthorized\s*===\s*true/.test(cycle),
  'composer 必须显式区分 not-required 与 runtime-required:true');
});

await check('E10 新增实体链文件严格小于 600 行', () => {
  for (const file of [
    'lib/teachin/entity-lock-verifier.mjs',
    'lib/teachin/runtime-cycle-adapter.mjs',
    'lib/dual-replay/pair-authority.mjs',
  ]) {
    const count = source(file).split(/\r?\n/).length;
    assert(count < 600, `${file} 出现 ${count} 行超大文件`);
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

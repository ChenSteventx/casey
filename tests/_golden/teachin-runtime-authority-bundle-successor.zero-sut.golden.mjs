#!/usr/bin/env node
// 同根运行权威组 successor 金牌：仅在临时副本安装测试 bundle；禁止 SUT、假 SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ENTITY_SEMANTIC_LOCK_PUBLICATIONS } from '../../lib/entity-semantic-lock-publications.mjs';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'bundle-readiness', 'root-coherence', 'proxy-and-production']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [bundle-readiness|root-coherence|proxy-and-production]`);
  process.exit(2);
}

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LIB_ROOT = join(PROJECT_ROOT, 'lib');
const FIXTURE_PATH = new URL('./fixtures/teachin-runtime-authority-bundle-successor/bundle-cases.json', import.meta.url);
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const HEALTHY_DRIVER_SOURCE = `async function healthyDriverRead(_input) {
  globalThis.__caseyRuntimeBundleDriverCalls = (globalThis.__caseyRuntimeBundleDriverCalls ?? 0) + 1;
  return Object.freeze({ complete: true, candidates: Object.freeze([Object.freeze(${JSON.stringify(FIXTURE.candidate)})]) });
}`;
const THROWING_DRIVER_SOURCE = `async function throwingDriverRead() {
  globalThis.__caseyRuntimeBundleDriverCalls = (globalThis.__caseyRuntimeBundleDriverCalls ?? 0) + 1;
  throw new Error('DRIVER_MUST_NOT_BE_PROBED_BY_READINESS');
}`;
const HEALTHY_ISSUER_SOURCE = `async function healthyRunContextIssuer(input) {
  return Object.freeze({ runLabel: \`bundle-run:\${input.issuerId}\` });
}`;
const INVALID_ISSUER_SOURCE = `async function invalidRunContextIssuer() {
  return Object.freeze({});
}`;

let passed = 0;
const failures = [];
async function check(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ownData(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: 不是对象`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    assert(Object.prototype.hasOwnProperty.call(descriptor, 'value'), `${label}.${key}: 禁止 accessor`);
  }
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

function assertReadiness(result, expected, label) {
  const row = ownData(result, label);
  assert(Object.isFrozen(result), `${label}: 结果未冻结`);
  for (const [key, value] of Object.entries(expected)) {
    assert(row[key] === value, `${label}.${key}=${JSON.stringify(row[key])}`);
  }
}

function assertDenied(result, reason, label) {
  assert(result && typeof result === 'object', `${label}: 缺拒绝结果`);
  assert(result.ok !== true && result.allowAction !== true && result.status !== 'SAME', `${label}: ${JSON.stringify(result)}`);
  assert(result.reason === reason, `${label}: reason=${JSON.stringify(result.reason)}`);
}

function sourceFor(kind, healthySource, invalidSource) {
  return kind === 'healthy' || kind === 'json-only' ? healthySource : invalidSource;
}

function writeJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

function buildPublication(root, kind, tempRoot) {
  const base = `release/entity-semantic-lock/${root.rootId}`;
  const lockSetKey = `${base}/entity-locks.frozen.json`;
  const eventsKey = `${base}/events.document.json`;
  const actionPolicyKey = `${base}/entity-action-policy.frozen.json`;
  const healthProofKey = `${base}/runtime-authority-health-proof.frozen.json`;
  const sourceLockBytes = readFileSync(join(PROJECT_ROOT, FIXTURE.sourceLock));
  const lockBytes = kind === 'json-only' ? Buffer.from('{}\n') : sourceLockBytes;
  const eventsBytes = readFileSync(join(PROJECT_ROOT, FIXTURE.sourceEvents));
  const actionPolicyBytes = Buffer.from(`${JSON.stringify(FIXTURE.actionPolicy)}\n`);
  for (const [key, bytes] of [
    [lockSetKey, lockBytes], [eventsKey, eventsBytes], [actionPolicyKey, actionPolicyBytes],
  ]) {
    const destination = join(tempRoot, key);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }

  const proof = {
    schemaVersion: 1,
    artifactKind: 'entity-runtime-authority-health-proof',
    status: 'PASS',
    rootId: root.rootId,
    contractId: root.contractId,
    adapterId: root.adapterId,
    issuerId: root.issuerId,
    driverImplementationSha256: sha256(HEALTHY_DRIVER_SOURCE),
    issuerImplementationSha256: sha256(HEALTHY_ISSUER_SOURCE),
    caseId: FIXTURE.caseId,
    lockSetKey,
    lockSetSha256: sha256(lockBytes),
    events: { key: eventsKey, sha256: sha256(eventsBytes) },
    actionPolicySha256: sha256(actionPolicyBytes),
    driverSelfCheckReceiptSha256: sha256('driver-self-check:PASS'),
    issuerSelfCheckReceiptSha256: sha256('issuer-self-check:PASS'),
  };
  const healthProofBytes = writeJson(join(tempRoot, healthProofKey), proof);
  return {
    publication: {
      source: 'release-resource',
      mode: 'runtime',
      rootId: root.rootId,
      adapterId: root.adapterId,
      issuerId: root.issuerId,
      actionPolicy: { key: actionPolicyKey, sha256: sha256(actionPolicyBytes) },
      healthProof: { key: healthProofKey, sha256: sha256(healthProofBytes) },
      locks: { [lockSetKey]: sha256(lockBytes) },
    },
    bundle: {
      ...root,
      driverKind: kind === 'bad-driver' ? 'bad' : 'healthy',
      issuerKind: kind === 'bad-issuer' ? 'bad' : 'healthy',
    },
    lockSetKey,
  };
}

function publicationModuleSource(publications) {
  return [
    `const publications = ${JSON.stringify(publications, null, 2)};`,
    'for (const publication of Object.values(publications)) {',
    '  Object.freeze(publication.locks);',
    '  if (publication.actionPolicy) Object.freeze(publication.actionPolicy);',
    '  if (publication.healthProof) Object.freeze(publication.healthProof);',
    '  Object.freeze(publication);',
    '}',
    'export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = Object.freeze(publications);',
    '',
  ].join('\n');
}

function bundleModuleSource(bundleRows) {
  const rows = bundleRows.map((row, index) => {
    const driverSource = sourceFor(row.driverKind, HEALTHY_DRIVER_SOURCE, THROWING_DRIVER_SOURCE);
    const issuerSource = sourceFor(row.issuerKind, HEALTHY_ISSUER_SOURCE, INVALID_ISSUER_SOURCE);
    return [
      `const driver${index} = ${driverSource};`,
      `const issuer${index} = ${issuerSource};`,
      `bundles[${JSON.stringify(row.rootId)}] = {`,
      `  rootId: ${JSON.stringify(row.rootId)},`,
      `  contractId: ${JSON.stringify(row.contractId)},`,
      `  adapterId: ${JSON.stringify(row.adapterId)},`,
      `  issuerId: ${JSON.stringify(row.issuerId)},`,
      `  driver: Object.freeze({ read: driver${index} }),`,
      `  issuer: Object.freeze({ issue: issuer${index} }),`,
      '};',
    ].join('\n');
  });
  return [
    'const bundles = {};',
    ...rows,
    'for (const bundle of Object.values(bundles)) Object.freeze(bundle);',
    'export const ENTITY_RUNTIME_AUTHORITY_BUNDLES = Object.freeze(bundles);',
    '',
  ].join('\n');
}

async function withIsolated(specs, fn) {
  const root = mkdtempSync(join(tmpdir(), 'casey-runtime-authority-bundle-'));
  try {
    cpSync(LIB_ROOT, join(root, 'lib'), { recursive: true });
    const publications = {};
    const bundles = [];
    const installed = [];
    for (const spec of specs) {
      const built = buildPublication(spec.root, spec.kind, root);
      publications[spec.root.contractId] = built.publication;
      bundles.push(built.bundle);
      installed.push({ ...spec.root, lockSetKey: built.lockSetKey });
    }
    writeFileSync(join(root, 'lib', 'entity-semantic-lock-publications.mjs'), publicationModuleSource(publications));
    writeFileSync(join(root, 'lib', 'entity-runtime-authority-bundles.mjs'), bundleModuleSource(bundles));
    const href = pathToFileURL(join(root, 'lib', 'entity-semantic-lock-v2.mjs')).href;
    const api = await import(`${href}?bundle-successor=${Date.now()}-${Math.random()}`);
    return await fn({ api, installed });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const rootAlpha = FIXTURE.roots[0];
const rootBeta = FIXTURE.roots[1];

await check('bundle-readiness', 'P0 production 空表保持 unpublished/route:human', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  assertReadiness(api.readEntityRuntimeReadiness(), {
    available: false,
    state: 'unpublished',
    route: 'human',
    reason: 'DRIVER_NOT_PUBLISHED',
  }, 'production-readiness');
});

await check('bundle-readiness', 'P0 单一同根 bundle 完整自守才 verified-ready', async () => {
  await withIsolated([{ root: rootAlpha, kind: 'healthy' }], async ({ api }) => {
    assertReadiness(api.readEntityRuntimeReadiness(), {
      available: true,
      state: 'verified-ready',
      route: null,
      reason: null,
      rootId: rootAlpha.rootId,
      contractId: rootAlpha.contractId,
      adapterId: rootAlpha.adapterId,
      issuerId: rootAlpha.issuerId,
    }, 'healthy-bundle');
  });
});

for (const [name, kind] of [
  ['lock 仅为 JSON object', 'json-only'],
  ['driver 永远抛错且实现摘要失配', 'bad-driver'],
  ['issuer 返回非法值且实现摘要失配', 'bad-issuer'],
]) {
  await check('bundle-readiness', `P0 ${name} 只能 published/不可用`, async () => {
    await withIsolated([{ root: rootAlpha, kind }], async ({ api }) => {
      assertReadiness(api.readEntityRuntimeReadiness(), {
        available: false,
        state: 'published',
        route: 'human',
        reason: 'RUNTIME_AUTHORITY_HEALTH_NOT_VERIFIED',
      }, `unhealthy-${kind}`);
    });
  });
}

await check('bundle-readiness', 'HIGH 纯决策器不再接受四个独立 bool 拼根', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  assertReadiness(api.deriveEntityRuntimeReadiness({
    driverReady: true,
    runtimePublicationReady: true,
    actionPolicyReady: true,
    runContextIssuerReady: true,
  }), {
    available: false,
    state: 'unpublished',
    route: 'human',
    reason: 'RUNTIME_READINESS_ROOT_INVALID',
  }, 'legacy-four-bools');
});

await check('root-coherence', 'P0 同根 authority/handle/adapter/run context/capability 得到 SAME', async () => {
  await withIsolated([{ root: rootAlpha, kind: 'healthy' }], async ({ api, installed }) => {
    const root = installed[0];
    const authority = api.readFrozenEntityLockSetAuthority({
      contractId: root.contractId,
      lockSetKey: root.lockSetKey,
    });
    assert(authority?.ok === true && authority.authority, `authority 未建立: ${JSON.stringify(authority)}`);
    const verified = api.verifyEntityLockSet({
      authority: authority.authority,
      caseId: FIXTURE.caseId,
      eventsBytes: readFileSync(join(PROJECT_ROOT, FIXTURE.sourceEvents)),
    });
    assert(verified?.ok === true && verified.runtimeAuthorized === true, `runtime handle 未建立: ${JSON.stringify(verified)}`);
    const adapter = api.createEntityRuntimeAdapter({
      rootId: root.rootId, contractId: root.contractId, adapterId: root.adapterId,
    });
    assert(adapter?.ok === true && adapter.adapter, `adapter 未建立: ${JSON.stringify(adapter)}`);
    const issued = await api.issueEntityRunContext({
      rootId: root.rootId, contractId: root.contractId, issuerId: root.issuerId,
    });
    assert(issued?.ok === true && issued.runContext, `run context 未建立: ${JSON.stringify(issued)}`);
    const read = await api.readEntityRuntimeCapability({
      adapter: adapter.adapter,
      binding: FIXTURE.binding,
      runContext: issued.runContext,
    });
    assert(read?.ok === true && read.capability, `capability 未建立: ${JSON.stringify(read)}`);
    const evaluated = api.evaluateEntityAction({
      handle: verified.handle,
      binding: FIXTURE.binding,
      runtimeCapability: read.capability,
    });
    assert(evaluated?.status === 'SAME' && evaluated.allowAction === true, `同根未得到 SAME: ${JSON.stringify(evaluated)}`);
  });
});

await check('root-coherence', 'P0 adapter/run context 跨根在 driver 执行前拒绝', async () => {
  await withIsolated([
    { root: rootAlpha, kind: 'healthy' },
    { root: rootBeta, kind: 'healthy' },
  ], async ({ api }) => {
    const adapterAlpha = api.createEntityRuntimeAdapter({
      rootId: rootAlpha.rootId, contractId: rootAlpha.contractId, adapterId: rootAlpha.adapterId,
    });
    const contextBeta = await api.issueEntityRunContext({
      rootId: rootBeta.rootId, contractId: rootBeta.contractId, issuerId: rootBeta.issuerId,
    });
    assert(adapterAlpha?.ok === true && contextBeta?.ok === true, '跨根前置能力未建立');
    globalThis.__caseyRuntimeBundleDriverCalls = 0;
    const crossed = await api.readEntityRuntimeCapability({
      adapter: adapterAlpha.adapter,
      binding: FIXTURE.binding,
      runContext: contextBeta.runContext,
    });
    assertDenied(crossed, 'ENTITY_RUNTIME_AUTHORITY_ROOT_MISMATCH', 'adapter/context 跨根');
    assert(globalThis.__caseyRuntimeBundleDriverCalls === 0, `跨根仍执行 driver ${globalThis.__caseyRuntimeBundleDriverCalls} 次`);
  });
});

await check('root-coherence', 'P0 capability/handle 跨根在 allowAction/successor 前拒绝', async () => {
  await withIsolated([
    { root: rootAlpha, kind: 'healthy' },
    { root: rootBeta, kind: 'healthy' },
  ], async ({ api, installed }) => {
    const installedAlpha = installed[0];
    const authorityAlpha = api.readFrozenEntityLockSetAuthority({
      contractId: installedAlpha.contractId,
      lockSetKey: installedAlpha.lockSetKey,
    });
    const verifiedAlpha = api.verifyEntityLockSet({
      authority: authorityAlpha.authority,
      caseId: FIXTURE.caseId,
      eventsBytes: readFileSync(join(PROJECT_ROOT, FIXTURE.sourceEvents)),
    });
    assert(verifiedAlpha?.ok === true && verifiedAlpha.runtimeAuthorized === true, 'alpha handle 未建立');
    const adapterBeta = api.createEntityRuntimeAdapter({
      rootId: rootBeta.rootId, contractId: rootBeta.contractId, adapterId: rootBeta.adapterId,
    });
    const contextBeta = await api.issueEntityRunContext({
      rootId: rootBeta.rootId, contractId: rootBeta.contractId, issuerId: rootBeta.issuerId,
    });
    const readBeta = await api.readEntityRuntimeCapability({
      adapter: adapterBeta.adapter,
      binding: FIXTURE.binding,
      runContext: contextBeta.runContext,
    });
    assert(readBeta?.ok === true && readBeta.capability, 'beta capability 未建立');
    assertDenied(api.evaluateEntityAction({
      handle: verifiedAlpha.handle,
      binding: FIXTURE.binding,
      runtimeCapability: readBeta.capability,
    }), 'ENTITY_RUNTIME_AUTHORITY_ROOT_MISMATCH', 'handle/capability 跨根 evaluate');
    assertDenied(api.createRunSuccessorProof({
      handle: verifiedAlpha.handle,
      binding: FIXTURE.binding,
      transitionId: FIXTURE.transitionId,
      previousHeadHash: FIXTURE.previousHeadHash,
      runtimeCapability: readBeta.capability,
    }), 'ENTITY_RUNTIME_AUTHORITY_ROOT_MISMATCH', 'handle/capability 跨根 successor');
  });
});

await check('root-coherence', 'HIGH selector 不能跨 contract 取得 adapter 或 run context', async () => {
  await withIsolated([{ root: rootAlpha, kind: 'healthy' }], async ({ api }) => {
    assertDenied(api.createEntityRuntimeAdapter({
      rootId: rootAlpha.rootId,
      contractId: rootBeta.contractId,
      adapterId: rootAlpha.adapterId,
    }), 'ENTITY_RUNTIME_ADAPTER_INVALID', '跨 contract adapter');
    assertDenied(await api.issueEntityRunContext({
      rootId: rootAlpha.rootId,
      contractId: rootBeta.contractId,
      issuerId: rootAlpha.issuerId,
    }), 'ENTITY_RUN_CONTEXT_ISSUER_INVALID', '跨 contract issuer');
  });
});

await check('proxy-and-production', 'HIGH Proxy/accessor 零 trap、零 getter 执行并拒绝', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  let trapCalls = 0;
  const handler = {
    get() { trapCalls += 1; throw new Error('GET_TRAP_EXECUTED'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('GET_PROTO_TRAP_EXECUTED'); },
    ownKeys() { trapCalls += 1; throw new Error('OWN_KEYS_TRAP_EXECUTED'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('DESCRIPTOR_TRAP_EXECUTED'); },
  };
  const decision = api.deriveEntityRuntimeReadiness(new Proxy({}, handler));
  const adapterDenied = api.createEntityRuntimeAdapter(new Proxy({}, handler));
  const issuerDenied = await api.issueEntityRunContext(new Proxy({}, handler));
  assert(trapCalls === 0, `Proxy traps 被执行 ${trapCalls} 次`);
  assertReadiness(decision, {
    available: false,
    state: 'unpublished',
    route: 'human',
    reason: 'RUNTIME_READINESS_ROOT_INVALID',
  }, 'proxy-decision');
  assertDenied(adapterDenied, 'ENTITY_RUNTIME_ADAPTER_INVALID', 'proxy-adapter');
  assertDenied(issuerDenied, 'ENTITY_RUN_CONTEXT_ISSUER_INVALID', 'proxy-issuer');

  let getterCalls = 0;
  const accessor = {
    state: 'verified-ready', contractId: rootAlpha.contractId,
    adapterId: rootAlpha.adapterId, issuerId: rootAlpha.issuerId, reason: null,
  };
  Object.defineProperty(accessor, 'rootId', {
    enumerable: true,
    get() { getterCalls += 1; return rootAlpha.rootId; },
  });
  const accessorDecision = api.deriveEntityRuntimeReadiness(accessor);
  assert(getterCalls === 0, `getter 被执行 ${getterCalls} 次`);
  assertReadiness(accessorDecision, {
    available: false,
    state: 'unpublished',
    route: 'human',
    reason: 'RUNTIME_READINESS_ROOT_INVALID',
  }, 'accessor-decision');
});

await check('proxy-and-production', 'P0 production 表无测试 bundle/publication', async () => {
  let bundleTable = null;
  try {
    ({ ENTITY_RUNTIME_AUTHORITY_BUNDLES: bundleTable } = await import('../../lib/entity-runtime-authority-bundles.mjs'));
  } catch {
    bundleTable = null;
  }
  assert(bundleTable && Object.keys(bundleTable).length === 0, 'production 运行权威 bundle 表缺失或非空');
  assert(Object.keys(ENTITY_SEMANTIC_LOCK_PUBLICATIONS).length === 0, 'production publication 表非空');
  const bundleSource = readFileSync(join(LIB_ROOT, 'entity-runtime-authority-bundles.mjs'), 'utf8').toLowerCase();
  assert(!bundleSource.includes('tests/') && !bundleSource.includes('_golden') && !bundleSource.includes('fixture'), 'production bundle 表引用测试路径');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-runtime-authority-bundle-successor: ${failure}`);
  console.error(`RED  teachin-runtime-authority-bundle-successor/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-runtime-authority-bundle-successor/${SECTION}: ${passed}/${passed} 全过（临时隔离纯模块，零 SUT）`);

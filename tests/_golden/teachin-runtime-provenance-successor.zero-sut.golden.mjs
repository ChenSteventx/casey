#!/usr/bin/env node
// Opaque readiness + non-executing release provenance successor；禁止 SUT、假 SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'opaque-readiness', 'data-provenance', 'no-execution-and-production']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [opaque-readiness|data-provenance|no-execution-and-production]`);
  process.exit(2);
}

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LIB_ROOT = join(PROJECT_ROOT, 'lib');
const CASES = JSON.parse(readFileSync(
  new URL('./fixtures/teachin-runtime-provenance-successor/provenance-cases.json', import.meta.url),
  'utf8',
));
const BASE = JSON.parse(readFileSync(join(PROJECT_ROOT, CASES.sourceBundleFixture), 'utf8'));
const ROOT = BASE.roots[0];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const DRIVER_SOURCE = `async function provenanceDriverRead(_input) {
  return Object.freeze({ complete: true, candidates: Object.freeze([RUNTIME_CANDIDATE]) });
}`;
const ISSUER_SOURCE = `async function provenanceRunContextIssuer(input) {
  return Object.freeze({ runLabel: \`provenance-run:\${input.issuerId}\` });
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

function writeBytes(root, key, bytes) {
  const destination = join(root, key);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

function writeJson(root, key, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeBytes(root, key, bytes);
  return bytes;
}

function executableBundleModuleSource({ candidateName = BASE.candidate.name, ambientEffect = false } = {}) {
  return [
    ambientEffect
      ? 'globalThis.__caseyRuntimeProvenanceAmbientEffects = (globalThis.__caseyRuntimeProvenanceAmbientEffects ?? 0) + 1;'
      : '',
    `const RUNTIME_CANDIDATE = Object.freeze({ ...${JSON.stringify(BASE.candidate)}, name: ${JSON.stringify(candidateName)} });`,
    `const provenanceDriverRead = ${DRIVER_SOURCE};`,
    `const provenanceRunContextIssuer = ${ISSUER_SOURCE};`,
    'const bundles = {',
    `  ${JSON.stringify(ROOT.rootId)}: {`,
    `    rootId: ${JSON.stringify(ROOT.rootId)},`,
    `    contractId: ${JSON.stringify(ROOT.contractId)},`,
    `    adapterId: ${JSON.stringify(ROOT.adapterId)},`,
    `    issuerId: ${JSON.stringify(ROOT.issuerId)},`,
    '    driver: Object.freeze({ read: provenanceDriverRead }),',
    '    issuer: Object.freeze({ issue: provenanceRunContextIssuer }),',
    '  },',
    '};',
    'for (const bundle of Object.values(bundles)) Object.freeze(bundle);',
    'export const ENTITY_RUNTIME_AUTHORITY_BUNDLES = Object.freeze(bundles);',
    '',
  ].join('\n');
}

function publicationModuleSource(publication) {
  return [
    `const publications = { ${JSON.stringify(ROOT.contractId)}: ${JSON.stringify(publication, null, 2)} };`,
    'for (const value of Object.values(publications)) {',
    '  Object.freeze(value.locks);',
    '  Object.freeze(value.actionPolicy);',
    '  Object.freeze(value.healthProof);',
    '  if (value.manifest) Object.freeze(value.manifest);',
    '  Object.freeze(value);',
    '}',
    'export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = Object.freeze(publications);',
    '',
  ].join('\n');
}

function dataManifest(entryBytes, dependencyBytes, transitiveBytes, variant) {
  const resources = [
    {
      id: 'bundle-entry',
      resource: { key: CASES.bundleModuleResourceKey, sha256: sha256(entryBytes) },
      dependencies: ['driver-dependency'],
    },
    {
      id: 'driver-dependency',
      resource: { key: CASES.dependencyResourceKey, sha256: sha256(dependencyBytes) },
      dependencies: ['transitive-dependency'],
    },
    {
      id: 'transitive-dependency',
      resource: { key: CASES.transitiveDependencyResourceKey, sha256: sha256(transitiveBytes) },
      dependencies: [],
    },
  ];
  if (variant === 'missing-node') resources.pop();
  if (variant === 'cycle') resources[2].dependencies = ['bundle-entry'];
  if (variant === 'unreachable') resources.push({
    id: 'orphan-resource',
    resource: {
      key: 'release/entity-semantic-lock/runtime-provenance/orphan-resource.mjs',
      sha256: sha256('orphan resource'),
    },
    dependencies: [],
  });
  return {
    schemaVersion: 1,
    artifactKind: 'entity-runtime-authority-data-manifest',
    rootId: ROOT.rootId,
    contractId: ROOT.contractId,
    adapterId: ROOT.adapterId,
    issuerId: ROOT.issuerId,
    entryId: 'bundle-entry',
    resources,
  };
}

async function withVariant(variant, fn) {
  const root = mkdtempSync(join(tmpdir(), 'casey-runtime-provenance-'));
  try {
    cpSync(LIB_ROOT, join(root, 'lib'), { recursive: true });
    const lockSetKey = `release/entity-semantic-lock/runtime-provenance/${variant}/entity-locks.frozen.json`;
    const eventsKey = `release/entity-semantic-lock/runtime-provenance/${variant}/events.document.json`;
    const actionPolicyKey = `release/entity-semantic-lock/runtime-provenance/${variant}/entity-action-policy.frozen.json`;
    const healthProofKey = `release/entity-semantic-lock/runtime-provenance/${variant}/runtime-authority-health-proof.frozen.json`;
    const lockBytes = readFileSync(join(PROJECT_ROOT, BASE.sourceLock));
    const eventsBytes = readFileSync(join(PROJECT_ROOT, BASE.sourceEvents));
    const actionPolicyBytes = Buffer.from(`${JSON.stringify(BASE.actionPolicy)}\n`);
    writeBytes(root, lockSetKey, lockBytes);
    writeBytes(root, eventsKey, eventsBytes);
    writeBytes(root, actionPolicyKey, actionPolicyBytes);

    const ambientEffect = variant === 'ambient-side-effect';
    const healthyEntryBytes = Buffer.from(executableBundleModuleSource({ ambientEffect }));
    const actualEntryBytes = variant === 'entry-mutated'
      ? Buffer.from(executableBundleModuleSource({ candidateName: '模块闭包漂移对象' }))
      : healthyEntryBytes;
    const healthyDependencyBytes = Buffer.from('export const DRIVER_DEPENDENCY = "release-bound-driver";\n');
    const actualDependencyBytes = variant === 'dependency-mutated'
      ? Buffer.from('export const DRIVER_DEPENDENCY = "workspace-mutated-driver";\n')
      : healthyDependencyBytes;
    const healthyTransitiveBytes = Buffer.from('export const TRANSITIVE_DEPENDENCY = "release-bound-transitive";\n');
    const actualTransitiveBytes = variant === 'transitive-mutated'
      ? Buffer.from('export const TRANSITIVE_DEPENDENCY = "workspace-mutated-transitive";\n')
      : healthyTransitiveBytes;

    // On the red baseline this executable module is statically imported before
    // manifest verification. The successor must stop importing it altogether.
    writeFileSync(join(root, 'lib', 'entity-runtime-authority-bundles.mjs'), actualEntryBytes);
    writeBytes(root, CASES.bundleModuleResourceKey, actualEntryBytes);
    writeBytes(root, CASES.dependencyResourceKey, actualDependencyBytes);
    writeBytes(root, CASES.transitiveDependencyResourceKey, actualTransitiveBytes);
    if (variant === 'unreachable') {
      writeBytes(root, 'release/entity-semantic-lock/runtime-provenance/orphan-resource.mjs', Buffer.from('orphan resource'));
    }

    const manifest = dataManifest(
      healthyEntryBytes,
      healthyDependencyBytes,
      healthyTransitiveBytes,
      variant,
    );
    const manifestBytes = writeJson(root, CASES.manifestResourceKey, manifest);
    const healthProof = {
      schemaVersion: 1,
      artifactKind: 'entity-runtime-authority-health-proof',
      status: 'PASS',
      rootId: ROOT.rootId,
      contractId: ROOT.contractId,
      adapterId: ROOT.adapterId,
      issuerId: ROOT.issuerId,
      driverImplementationSha256: sha256(DRIVER_SOURCE),
      issuerImplementationSha256: sha256(ISSUER_SOURCE),
      caseId: BASE.caseId,
      lockSetKey,
      lockSetSha256: sha256(lockBytes),
      events: { key: eventsKey, sha256: sha256(eventsBytes) },
      actionPolicySha256: sha256(actionPolicyBytes),
    };
    const healthProofBytes = writeJson(root, healthProofKey, healthProof);
    const publication = {
      source: 'release-resource',
      mode: 'runtime',
      rootId: ROOT.rootId,
      adapterId: ROOT.adapterId,
      issuerId: ROOT.issuerId,
      actionPolicy: { key: actionPolicyKey, sha256: sha256(actionPolicyBytes) },
      healthProof: { key: healthProofKey, sha256: sha256(healthProofBytes) },
      locks: { [lockSetKey]: sha256(lockBytes) },
    };
    if (variant !== 'missing-manifest') {
      publication.manifest = { key: CASES.manifestResourceKey, sha256: sha256(manifestBytes) };
    }
    writeFileSync(
      join(root, 'lib', 'entity-semantic-lock-publications.mjs'),
      publicationModuleSource(publication),
    );
    globalThis.__caseyRuntimeProvenanceAmbientEffects = 0;
    const href = pathToFileURL(join(root, 'lib', 'entity-semantic-lock-v2.mjs')).href;
    const api = await import(`${href}?runtime-provenance=${variant}-${Date.now()}-${Math.random()}`);
    return await fn(api, {
      ambientEffects: globalThis.__caseyRuntimeProvenanceAmbientEffects,
    });
  } finally {
    delete globalThis.__caseyRuntimeProvenanceAmbientEffects;
    rmSync(root, { recursive: true, force: true });
  }
}

const INSPECTION_INVALID = {
  available: false,
  state: 'unpublished',
  route: 'human',
  reason: 'RUNTIME_READINESS_INSPECTION_INVALID',
};

await check('opaque-readiness', 'P0 public caller 普通字符串根不能 derive available:true', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  assertReadiness(api.deriveEntityRuntimeReadiness({
    state: 'verified-ready',
    rootId: ROOT.rootId,
    contractId: ROOT.contractId,
    adapterId: ROOT.adapterId,
    issuerId: ROOT.issuerId,
    reason: null,
  }), INSPECTION_INVALID, 'caller-string-root');
});

await check('opaque-readiness', 'P0 私有 inspection 只记录 provenance，展开副本不可复刻', async () => {
  await withVariant('healthy', async (api) => {
    const readiness = api.readEntityRuntimeReadiness();
    assertReadiness(readiness, {
      available: false,
      state: 'provenance-recorded',
      route: 'human',
      reason: 'RUNTIME_AUTHORITY_EXECUTABLE_LOADER_NOT_PUBLISHED',
      rootId: ROOT.rootId,
      contractId: ROOT.contractId,
    }, 'private-inspection-readiness');
    const row = ownData(readiness, 'readiness-copy-source');
    assertReadiness(api.deriveEntityRuntimeReadiness({
      state: row.state,
      rootId: row.rootId,
      contractId: row.contractId,
      adapterId: row.adapterId,
      issuerId: row.issuerId,
      reason: row.reason,
    }), INSPECTION_INVALID, 'expanded-inspection-copy');
  });
});

await check('opaque-readiness', 'HIGH public derive 对 Proxy/accessor 零 trap/getter', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  let trapCalls = 0;
  const proxy = new Proxy({}, {
    get() { trapCalls += 1; throw new Error('get trap'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('prototype trap'); },
    ownKeys() { trapCalls += 1; throw new Error('ownKeys trap'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('descriptor trap'); },
  });
  const proxyResult = api.deriveEntityRuntimeReadiness(proxy);
  assert(trapCalls === 0, `Proxy trap 被执行 ${trapCalls} 次`);
  assertReadiness(proxyResult, INSPECTION_INVALID, 'proxy-inspection');
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'state', {
    enumerable: true,
    get() { getterCalls += 1; return 'verified-ready'; },
  });
  const accessorResult = api.deriveEntityRuntimeReadiness(accessor);
  assert(getterCalls === 0, `accessor getter 被执行 ${getterCalls} 次`);
  assertReadiness(accessorResult, INSPECTION_INVALID, 'accessor-inspection');
});

await check('opaque-readiness', 'P0 production 空表继续 unpublished/route:human', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  assertReadiness(api.readEntityRuntimeReadiness(), {
    available: false, state: 'unpublished', route: 'human', reason: 'DRIVER_NOT_PUBLISHED',
  }, 'production-empty');
});

await check('data-provenance', 'P0 三层 release graph 自守也只 provenance-recorded/不可用', async () => {
  await withVariant('healthy', async (api) => {
    assertReadiness(api.readEntityRuntimeReadiness(), {
      available: false,
      state: 'provenance-recorded',
      route: 'human',
      reason: 'RUNTIME_AUTHORITY_EXECUTABLE_LOADER_NOT_PUBLISHED',
    }, 'healthy-data-graph');
  });
});

for (const [variant, label] of [
  ['entry-mutated', '入口 module bytes 与 manifest 摘要失配'],
  ['dependency-mutated', '第二层 dependency bytes 与 manifest 摘要失配'],
  ['transitive-mutated', '第三层 transitive dependency bytes 与 manifest 摘要失配'],
  ['missing-manifest', 'publication 缺 data manifest'],
  ['missing-node', '递归图引用缺失节点'],
  ['cycle', '递归图成环'],
  ['unreachable', '递归图带不可达附加节点'],
]) {
  await check('data-provenance', `P0 ${label} 拒绝 provenance`, async () => {
    await withVariant(variant, async (api) => {
      assertReadiness(api.readEntityRuntimeReadiness(), {
        available: false,
        state: 'published',
        route: 'human',
        reason: 'RUNTIME_AUTHORITY_PROVENANCE_NOT_VERIFIED',
      }, variant);
    });
  });
}

await check('no-execution-and-production', 'P0 release module 含 ambient side effect 也绝不执行', async () => {
  await withVariant('ambient-side-effect', async (api, observed) => {
    assert(observed.ambientEffects === 0, `待核 module 已先执行 ${observed.ambientEffects} 次`);
    assertReadiness(api.readEntityRuntimeReadiness(), {
      available: false,
      state: 'provenance-recorded',
      route: 'human',
      reason: 'RUNTIME_AUTHORITY_EXECUTABLE_LOADER_NOT_PUBLISHED',
    }, 'ambient-module-data-only');
  });
});

await check('no-execution-and-production', 'P0 production registry/publication 继续为空', async () => {
  const [{ ENTITY_RUNTIME_AUTHORITY_BUNDLES }, { ENTITY_SEMANTIC_LOCK_PUBLICATIONS }] = await Promise.all([
    import('../../lib/entity-runtime-authority-bundles.mjs'),
    import('../../lib/entity-semantic-lock-publications.mjs'),
  ]);
  assert(Object.keys(ENTITY_RUNTIME_AUTHORITY_BUNDLES).length === 0, 'production bundle registry 非空');
  assert(Object.keys(ENTITY_SEMANTIC_LOCK_PUBLICATIONS).length === 0, 'production publication 非空');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-runtime-provenance-successor: ${failure}`);
  console.error(`RED  teachin-runtime-provenance-successor/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-runtime-provenance-successor/${SECTION}: ${passed}/${passed} 全过（不执行 release module，零 SUT）`);

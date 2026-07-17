#!/usr/bin/env node
// 迭代有界 provenance 图 successor；禁止 SUT、假 SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'bounded-topology', 'bounded-bytes', 'isolation-and-supersession']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [bounded-topology|bounded-bytes|isolation-and-supersession]`);
  process.exit(2);
}

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LIB_ROOT = join(PROJECT_ROOT, 'lib');
const CASES = JSON.parse(readFileSync(
  new URL('./fixtures/teachin-runtime-provenance-budget-successor/budget-cases.json', import.meta.url),
  'utf8',
));
const BASE = JSON.parse(readFileSync(join(PROJECT_ROOT, CASES.sourceBundleFixture), 'utf8'));
const ROOT = BASE.roots[0];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

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

function writeJson(root, key, value, compact = false) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, compact ? 0 : 2)}\n`);
  writeBytes(root, key, bytes);
  return bytes;
}

function publicationModuleSource(publication) {
  return [
    `const publications = { ${JSON.stringify(ROOT.contractId)}: ${JSON.stringify(publication, null, 2)} };`,
    'for (const value of Object.values(publications)) {',
    '  Object.freeze(value.locks);',
    '  Object.freeze(value.actionPolicy);',
    '  Object.freeze(value.healthProof);',
    '  Object.freeze(value.manifest);',
    '  Object.freeze(value);',
    '}',
    'export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = Object.freeze(publications);',
    '',
  ].join('\n');
}

function resource(id, key, bytes, dependencies = []) {
  return {
    id,
    resource: { key, sha256: sha256(bytes) },
    dependencies,
  };
}

function manifestEnvelope(entryId, resources) {
  return {
    schemaVersion: 1,
    artifactKind: 'entity-runtime-authority-data-manifest',
    rootId: ROOT.rootId,
    contractId: ROOT.contractId,
    adapterId: ROOT.adapterId,
    issuerId: ROOT.issuerId,
    entryId,
    resources,
  };
}

function installGraph(root, variant) {
  const base = `release/entity-semantic-lock/runtime-budget/${variant}`;
  if (variant === 'deep-linear') {
    const unused = Buffer.from('must-not-be-read');
    const resources = Array.from({ length: CASES.deepLinearNodeCount }, (_, index) => resource(
      `node-${index}`,
      `${base}/missing-shared.mjs`,
      unused,
      index + 1 < CASES.deepLinearNodeCount ? [`node-${index + 1}`] : [],
    ));
    return manifestEnvelope('node-0', resources);
  }
  if (variant === 'dense-edges') {
    const unused = Buffer.from('must-not-be-read');
    const resources = Array.from({ length: CASES.denseEdgeNodeCount }, (_, index) => resource(
      `node-${index}`,
      `${base}/missing-shared.mjs`,
      unused,
      Array.from({ length: CASES.denseEdgeNodeCount - index - 1 }, (_value, offset) => `node-${index + offset + 1}`),
    ));
    return manifestEnvelope('node-0', resources);
  }
  if (variant === 'single-resource-over') {
    const bytes = Buffer.alloc(CASES.limits.maxResourceBytes + 1, 0x61);
    const key = `${base}/oversize-resource.mjs`;
    writeBytes(root, key, bytes);
    return manifestEnvelope('bundle-entry', [resource('bundle-entry', key, bytes)]);
  }
  if (variant === 'total-resources-over') {
    const rows = [];
    for (let index = 0; index < CASES.totalResourceCount; index += 1) {
      const bytes = Buffer.alloc(CASES.totalResourceBytesEach, 0x61 + index);
      const key = `${base}/resource-${index}.mjs`;
      writeBytes(root, key, bytes);
      rows.push(resource(
        `resource-${index}`,
        key,
        bytes,
        index === 0
          ? Array.from({ length: CASES.totalResourceCount - 1 }, (_value, offset) => `resource-${offset + 1}`)
          : [],
      ));
    }
    return manifestEnvelope('resource-0', rows);
  }

  const entryBytes = Buffer.from('export const BUNDLE_ENTRY = "data-only";\n');
  const dependencyBytes = Buffer.from('export const DRIVER_DEPENDENCY = "data-only";\n');
  const transitiveBytes = Buffer.from('export const TRANSITIVE_DEPENDENCY = "data-only";\n');
  const entryKey = `${base}/bundle-entry.mjs`;
  const dependencyKey = `${base}/driver-dependency.mjs`;
  const transitiveKey = `${base}/transitive-dependency.mjs`;
  writeBytes(root, entryKey, entryBytes);
  writeBytes(root, dependencyKey, dependencyBytes);
  writeBytes(root, transitiveKey, transitiveBytes);
  return manifestEnvelope('bundle-entry', [
    resource('bundle-entry', entryKey, entryBytes, ['driver-dependency']),
    resource('driver-dependency', dependencyKey, dependencyBytes, ['transitive-dependency']),
    resource('transitive-dependency', transitiveKey, transitiveBytes),
  ]);
}

function injectInspectionFault(root) {
  const modulePath = join(root, 'lib', 'entity-semantic-lock-v2.mjs');
  const source = readFileSync(modulePath, 'utf8');
  const needle = 'function inspectRuntimeAuthorityPublication(entry) {';
  assert(source.includes(needle), '找不到 inspection 故障注入点');
  writeFileSync(modulePath, source.replace(
    needle,
    `${needle}\n  if (globalThis.__caseyProvenanceInspectionFault === true) throw new RangeError('INJECTED_INSPECTION_FAILURE');`,
  ));
}

async function withVariant(variant, fn, { inspectionFault = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'casey-runtime-provenance-budget-'));
  try {
    cpSync(LIB_ROOT, join(root, 'lib'), { recursive: true });
    const base = `release/entity-semantic-lock/runtime-budget/${variant}`;
    const lockSetKey = `${base}/entity-locks.frozen.json`;
    const eventsKey = `${base}/events.document.json`;
    const actionPolicyKey = `${base}/entity-action-policy.frozen.json`;
    const healthProofKey = `${base}/runtime-authority-health-proof.frozen.json`;
    const manifestKey = `${base}/runtime-authority-data-manifest.json`;
    const lockBytes = readFileSync(join(PROJECT_ROOT, BASE.sourceLock));
    const eventsBytes = readFileSync(join(PROJECT_ROOT, BASE.sourceEvents));
    const actionPolicyBytes = Buffer.from(`${JSON.stringify(BASE.actionPolicy)}\n`);
    writeBytes(root, lockSetKey, lockBytes);
    writeBytes(root, eventsKey, eventsBytes);
    writeBytes(root, actionPolicyKey, actionPolicyBytes);

    const manifest = installGraph(root, variant);
    const manifestBytes = writeJson(root, manifestKey, manifest, variant === 'deep-linear');
    assert(manifestBytes.length <= CASES.limits.maxManifestBytes, `${variant}: 测试 manifest 超过冻结上限`);
    const healthProof = {
      schemaVersion: 1,
      artifactKind: 'entity-runtime-authority-health-proof',
      status: 'PASS',
      rootId: ROOT.rootId,
      contractId: ROOT.contractId,
      adapterId: ROOT.adapterId,
      issuerId: ROOT.issuerId,
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
      manifest: { key: manifestKey, sha256: sha256(manifestBytes) },
      locks: { [lockSetKey]: sha256(lockBytes) },
    };
    writeFileSync(
      join(root, 'lib', 'entity-semantic-lock-publications.mjs'),
      publicationModuleSource(publication),
    );
    if (inspectionFault) injectInspectionFault(root);
    globalThis.__caseyProvenanceInspectionFault = inspectionFault;
    const href = pathToFileURL(join(root, 'lib', 'entity-semantic-lock-v2.mjs')).href;
    const api = await import(`${href}?runtime-provenance-budget=${variant}-${Date.now()}-${Math.random()}`);
    return await fn(api);
  } finally {
    delete globalThis.__caseyProvenanceInspectionFault;
    rmSync(root, { recursive: true, force: true });
  }
}

const BUDGET_DENIED = {
  available: false,
  state: 'published',
  route: 'human',
  reason: 'RUNTIME_AUTHORITY_PROVENANCE_BUDGET_EXCEEDED',
};

await check('bounded-topology', 'P0 20,000 节点线性图不爆栈并在读资源前预算拒绝', async () => {
  await withVariant('deep-linear', async (api) => {
    let readiness;
    try {
      readiness = api.readEntityRuntimeReadiness();
    } catch (error) {
      throw new Error(`public readiness 抛 ${error.name}: ${error.message}`);
    }
    assertReadiness(readiness, BUDGET_DENIED, 'deep-linear');
  });
});

await check('bounded-topology', 'P0 稠密 DAG 超边预算且缺资源也先预算拒绝', async () => {
  await withVariant('dense-edges', async (api) => {
    assertReadiness(api.readEntityRuntimeReadiness(), BUDGET_DENIED, 'dense-edges');
  });
});

await check('bounded-bytes', 'P0 单个 release resource 超字节预算拒绝', async () => {
  await withVariant('single-resource-over', async (api) => {
    assertReadiness(api.readEntityRuntimeReadiness(), BUDGET_DENIED, 'single-resource-over');
  });
});

await check('bounded-bytes', 'P0 release resources 合计超总字节预算拒绝', async () => {
  await withVariant('total-resources-over', async (api) => {
    assertReadiness(api.readEntityRuntimeReadiness(), BUDGET_DENIED, 'total-resources-over');
  });
});

await check('bounded-bytes', 'P0 预算内三层图仍只记录 provenance 且不可用', async () => {
  await withVariant('healthy', async (api) => {
    assertReadiness(api.readEntityRuntimeReadiness(), {
      available: false,
      state: 'provenance-recorded',
      route: 'human',
      reason: 'RUNTIME_AUTHORITY_EXECUTABLE_LOADER_NOT_PUBLISHED',
    }, 'healthy-within-budget');
  });
});

await check('isolation-and-supersession', 'HIGH 单 publication inspection 意外异常稳定降级', async () => {
  await withVariant('healthy', async (api) => {
    let readiness;
    try {
      readiness = api.readEntityRuntimeReadiness();
    } catch (error) {
      throw new Error(`inspection 异常越过 public API: ${error.message}`);
    }
    assertReadiness(readiness, {
      available: false,
      state: 'published',
      route: 'human',
      reason: 'RUNTIME_AUTHORITY_PROVENANCE_INSPECTION_FAILED',
    }, 'inspection-fault');
  }, { inspectionFault: true });
});

await check('isolation-and-supersession', 'HIGH public derive 对 Proxy/accessor 继续零 trap/getter', async () => {
  const api = await import('../../lib/entity-semantic-lock-v2.mjs');
  let trapCalls = 0;
  const proxy = new Proxy({}, {
    get() { trapCalls += 1; throw new Error('get trap'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('prototype trap'); },
    ownKeys() { trapCalls += 1; throw new Error('ownKeys trap'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('descriptor trap'); },
  });
  assertReadiness(api.deriveEntityRuntimeReadiness(proxy), {
    available: false,
    state: 'unpublished',
    route: 'human',
    reason: 'RUNTIME_READINESS_INSPECTION_INVALID',
  }, 'proxy-readiness');
  assert(trapCalls === 0, `Proxy trap 被执行 ${trapCalls} 次`);

  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'state', {
    enumerable: true,
    get() { getterCalls += 1; return 'verified-ready'; },
  });
  api.deriveEntityRuntimeReadiness(accessor);
  assert(getterCalls === 0, `accessor getter 被执行 ${getterCalls} 次`);
});

await check('isolation-and-supersession', 'P0 正式取代记录机械确认旧 bundle 当前 3 过 / 9 红', async () => {
  const supersession = readFileSync(
    join(PROJECT_ROOT, 'docs/plans/teachin-runtime-provenance-budget-successor/proposed/SUPERSESSION.md'),
    'utf8',
  );
  assert(supersession.includes('`3 过 / 9 红`'), '正式取代记录缺 3 过 / 9 红');
  assert(supersession.includes('不是绿色'), '正式取代记录未声明非绿色');
  const observed = readFileSync(
    join(PROJECT_ROOT, 'docs/plans/teachin-runtime-provenance-budget-successor/proposed/supersession/old-bundle-current.txt'),
    'utf8',
  );
  assert(observed.includes('exit: 1'), '旧 bundle successor 实测退出码缺失');
  assert(observed.includes('RED  teachin-runtime-authority-bundle-successor/all: 3 过 / 9 红'), '旧 bundle successor 实测汇总缺失');
  assert(!observed.includes('全过'), '旧 bundle successor 被错误描述为全过');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-runtime-provenance-budget-successor: ${failure}`);
  console.error(`RED  teachin-runtime-provenance-budget-successor/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-runtime-provenance-budget-successor/${SECTION}: ${passed}/${passed} 全过（有界迭代，零 SUT）`);

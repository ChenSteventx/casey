#!/usr/bin/env node
// 运行期就绪 successor 金牌：只读生产模块和冻结字节，在临时隔离根安装测试发布；零 SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'readiness-roots', 'historical-and-roles']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [readiness-roots|historical-and-roles]`);
  process.exit(2);
}

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LIB_ROOT = join(PROJECT_ROOT, 'lib');
const FIXTURE_PATH = new URL('./fixtures/teachin-runtime-readiness-successor/publication-cases.json', import.meta.url);
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
const API_PATH = new URL('../../lib/entity-semantic-lock-v2.mjs', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

let api;
try { api = await import(API_PATH); } catch { api = {}; }

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
  assert(row.available === expected.available, `${label}: available=${JSON.stringify(row.available)}`);
  assert(row.route === expected.route, `${label}: route=${JSON.stringify(row.route)}`);
  assert(row.reason === expected.reason, `${label}: reason=${JSON.stringify(row.reason)}`);
}

function expectedReadiness(facts) {
  if (!facts.driverReady) return { available: false, route: 'human', reason: 'DRIVER_NOT_PUBLISHED' };
  if (!facts.runtimePublicationReady) return { available: false, route: 'human', reason: 'RUNTIME_PUBLICATION_NOT_PUBLISHED' };
  if (!facts.actionPolicyReady) return { available: false, route: 'human', reason: 'ENTITY_ACTION_POLICY_NOT_PUBLISHED' };
  if (!facts.runContextIssuerReady) return { available: false, route: 'human', reason: 'RUN_CONTEXT_ISSUER_NOT_PUBLISHED' };
  return { available: true, route: null, reason: null };
}

await check('readiness-roots', 'P0 四根 16 组合只有全真可用，getter/Proxy 只取一次描述符快照', () => {
  assert(typeof api.deriveEntityRuntimeReadiness === 'function', '缺纯四根就绪决策器 deriveEntityRuntimeReadiness');
  for (let mask = 0; mask < 16; mask += 1) {
    const facts = {
      driverReady: Boolean(mask & 1),
      runtimePublicationReady: Boolean(mask & 2),
      actionPolicyReady: Boolean(mask & 4),
      runContextIssuerReady: Boolean(mask & 8),
    };
    assertReadiness(api.deriveEntityRuntimeReadiness(facts), expectedReadiness(facts), `matrix-${mask}`);
  }

  let getterReads = 0;
  const accessorFacts = {
    runtimePublicationReady: true,
    actionPolicyReady: true,
    runContextIssuerReady: true,
  };
  Object.defineProperty(accessorFacts, 'driverReady', {
    enumerable: true,
    get() { getterReads += 1; return true; },
  });
  const accessorResult = api.deriveEntityRuntimeReadiness(accessorFacts);
  assert(getterReads === 0, `accessor 被执行 ${getterReads} 次`);
  assertReadiness(accessorResult, {
    available: false, route: 'human', reason: 'RUNTIME_READINESS_FACTS_INVALID',
  }, 'accessor-facts');

  let proxyGets = 0;
  const proxyFacts = new Proxy(Object.freeze({
    driverReady: true,
    runtimePublicationReady: true,
    actionPolicyReady: true,
    runContextIssuerReady: true,
  }), {
    get() { proxyGets += 1; throw new Error('GET_TRAP_MUST_NOT_RUN'); },
  });
  assertReadiness(api.deriveEntityRuntimeReadiness(proxyFacts), {
    available: true, route: null, reason: null,
  }, 'proxy-facts');
  assert(proxyGets === 0, `Proxy get 被执行 ${proxyGets} 次`);
});

await check('readiness-roots', 'P0 生产就绪只读内部事实，未发布签发者不能写运行上下文', async () => {
  assert(typeof api.readEntityRuntimeReadiness === 'function', '缺生产就绪 API');
  let callerReads = 0;
  const forgedFacts = new Proxy({}, {
    get() { callerReads += 1; throw new Error('CALLER_FACTS_MUST_BE_IGNORED'); },
  });
  assertReadiness(api.readEntityRuntimeReadiness(forgedFacts), {
    available: false, route: 'human', reason: 'DRIVER_NOT_PUBLISHED',
  }, 'production-readiness');
  assert(callerReads === 0, `生产入口读取调用者事实 ${callerReads} 次`);

  assert(typeof api.issueEntityRunContext === 'function', '缺真实运行上下文签发入口');
  const issued = await api.issueEntityRunContext({ issuerId: 'caller-controlled-issuer' });
  assert(issued?.ok !== true && !issued?.runContext, `未发布 issuer 写入运行上下文: ${JSON.stringify(issued)}`);
  assert(issued?.reason === 'ENTITY_RUN_CONTEXT_ISSUER_INVALID', `issuer 拒绝原因不稳定: ${JSON.stringify(issued)}`);
});

let isolated = null;
async function loadIsolatedPublication() {
  if (isolated) return isolated.api;
  const root = mkdtempSync(join(tmpdir(), 'casey-runtime-readiness-successor-'));
  cpSync(LIB_ROOT, join(root, 'lib'), { recursive: true });

  const publications = {};
  const historical = FIXTURE.historical;
  const historicalBytes = readFileSync(join(PROJECT_ROOT, historical.sourceLock));
  const historicalDestination = join(root, historical.releaseLockKey);
  mkdirSync(dirname(historicalDestination), { recursive: true });
  writeFileSync(historicalDestination, historicalBytes);
  publications[historical.contractId] = {
    source: 'release-resource',
    mode: 'historical',
    locks: { [historical.releaseLockKey]: sha256(historicalBytes) },
  };

  const runtimeRoles = FIXTURE.runtimeRoles;
  const actionPolicyBytes = readFileSync(join(PROJECT_ROOT, runtimeRoles.sourceActionPolicy));
  const actionPolicyDestination = join(root, runtimeRoles.releaseActionPolicyKey);
  mkdirSync(dirname(actionPolicyDestination), { recursive: true });
  writeFileSync(actionPolicyDestination, actionPolicyBytes);
  const runtimeLocks = {};
  for (const roleCase of runtimeRoles.cases) {
    const lockBytes = readFileSync(join(PROJECT_ROOT, roleCase.sourceLock));
    const destination = join(root, roleCase.releaseLockKey);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, lockBytes);
    runtimeLocks[roleCase.releaseLockKey] = sha256(lockBytes);
  }
  publications[runtimeRoles.contractId] = {
    source: 'release-resource',
    mode: 'runtime',
    actionPolicy: {
      key: runtimeRoles.releaseActionPolicyKey,
      sha256: sha256(actionPolicyBytes),
    },
    locks: runtimeLocks,
  };

  const publicationModule = [
    `const publications = ${JSON.stringify(publications, null, 2)};`,
    'for (const publication of Object.values(publications)) {',
    '  Object.freeze(publication.locks);',
    '  if (publication.actionPolicy) Object.freeze(publication.actionPolicy);',
    '  Object.freeze(publication);',
    '}',
    'export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = Object.freeze(publications);',
    '',
  ].join('\n');
  writeFileSync(join(root, 'lib', 'entity-semantic-lock-publications.mjs'), publicationModule);
  const loaded = await import(`${pathToFileURL(join(root, 'lib', 'entity-semantic-lock-v2.mjs')).href}?successor=${Date.now()}`);
  isolated = { root, api: loaded };
  return loaded;
}

const HISTORICAL_BINDING = Object.freeze({
  stepId: 'atstep_1',
  intentId: 'intent_1',
  atom: 'workflow.rename',
  role: 'subject',
  candidate: 'candidate-workflow-main',
  lockId: 'lock-workflow-main',
});

function assertDenied(result, expectedReason, label) {
  assert(result && typeof result === 'object', `${label}: 缺结果`);
  assert(result.ok !== true && result.allowAction !== true && result.status !== 'SAME', `${label}: ${JSON.stringify(result)}`);
  assert(result.reason === expectedReason, `${label}: reason=${JSON.stringify(result.reason)}`);
}

await check('historical-and-roles', 'P0 非空 historical handle 显式降权，evaluate/successor 先拒运行授权', async () => {
  const isolatedApi = await loadIsolatedPublication();
  const fixture = FIXTURE.historical;
  const authority = isolatedApi.readFrozenEntityLockSetAuthority({
    contractId: fixture.contractId,
    lockSetKey: fixture.releaseLockKey,
  });
  assert(authority?.ok === true && authority.authority, `historical authority 未建立: ${JSON.stringify(authority)}`);
  const verified = isolatedApi.verifyEntityLockSet({
    authority: authority.authority,
    caseId: fixture.caseId,
    eventsBytes: readFileSync(join(PROJECT_ROOT, fixture.sourceEvents)),
  });
  assert(verified?.ok === true && verified.handle, `historical handle 未建立: ${JSON.stringify(verified)}`);
  assert(verified.runtimeAuthorized === false, `historical handle 未显式降权: ${JSON.stringify(verified)}`);

  const forgedCapability = Object.freeze({ artifactKind: 'forged-runtime-capability' });
  assertDenied(isolatedApi.evaluateEntityAction({
    handle: verified.handle,
    binding: HISTORICAL_BINDING,
    runtimeCapability: forgedCapability,
  }), 'ENTITY_LOCK_RUNTIME_UNAUTHORIZED', 'historical evaluate');
  assertDenied(isolatedApi.createRunSuccessorProof({
    handle: verified.handle,
    binding: HISTORICAL_BINDING,
    transitionId: 'rename-main',
    previousHeadHash: '0d7294372a5048fa77e194c44fdd145da79dd7f40175964aeeb64550f9177f8b',
    runtimeCapability: forgedCapability,
  }), 'ENTITY_LOCK_RUNTIME_UNAUTHORIZED', 'historical successor');
});

for (const roleCase of FIXTURE.runtimeRoles.cases) {
  await check('historical-and-roles', `HIGH 动作身份 policy 真实拒绝 ${roleCase.name}`, async () => {
    const isolatedApi = await loadIsolatedPublication();
    const authority = isolatedApi.readFrozenEntityLockSetAuthority({
      contractId: FIXTURE.runtimeRoles.contractId,
      lockSetKey: roleCase.releaseLockKey,
    });
    assert(authority?.ok === true && authority.authority, `${roleCase.name}: authority 未建立 ${JSON.stringify(authority)}`);
    const verified = isolatedApi.verifyEntityLockSet({
      authority: authority.authority,
      caseId: roleCase.caseId,
      eventsBytes: readFileSync(join(PROJECT_ROOT, roleCase.sourceEvents)),
    });
    assertDenied(verified, 'ENTITY_ACTION_REQUIRED_ROLES_INVALID', roleCase.name);
  });
}

if (isolated) rmSync(isolated.root, { recursive: true, force: true });

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-runtime-readiness-successor: ${failure}`);
  console.error(`RED  teachin-runtime-readiness-successor/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-runtime-readiness-successor/${SECTION}: ${passed}/${passed} 全过（纯函数/静态，零 SUT）`);

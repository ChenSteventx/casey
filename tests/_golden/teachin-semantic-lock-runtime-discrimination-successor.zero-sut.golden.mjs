#!/usr/bin/env node
// 语义锁运行时判别·successor —— 前瞻红基线（forward-looking red baseline）。
// 纯 node、zero-SUT：禁止 SUT、浏览器、server 与网络。
//
// 这是「前瞻规格」，不是今日绿的认证。它逐条收纳三个可达面金牌迁出的、对任何注入
// 手法都结构性不可达的攻击（V2-C 候选判别 / V2-D successor / H2 capability 不透明 /
// H3 successor 同源绑定 / 原 runtime-authority 三条运行时检查），按「运行时权威可验证
// 成立后」的目标态书写断言（SAME 锚成立、重复候选 AMBIGUOUS、畸形 UNVERIFIED、
// 空+完整 MISSING、successor 全套拒绝语义、成功迁移旧链头失效）。
//
// 今日为何诚实红：提交 819015f 按更新的冻结意图「运行时出处不可执行且不透明」硬编码
// runtimeBundleVerified=false（lib/entity-semantic-lock-v2.mjs 约 464 行），evaluateEntityAction
// 与 createRunSuccessorProof 在 runtimeAuthorized!==true 时恒拒于 ENTITY_LOCK_RUNTIME_UNAUTHORIZED，
// createEntityRuntimeAdapter/issueEntityRunContext 亦恒拒（无可执行装载器）。故本文件所有目标态
// 断言今日均被该硬门拦停 → exit 1。这不是回归，是尚未落地的接缝的诚实红账。
//
// 填绿路径是真决策分岔，挂 route:human 待 Steven（本契约不选边）：
//   ① 只认真机运行时权威：联网 publication 落地后，候选由真机驱动读回，真机上填绿；
//   ② 恢复测试可注入的可验证接缝：部分回退 819015f 的不透明姿态（kernel 车道另立契约）；
//   ③ 导出判别内部函数做单元级攻击测试：最小 lib 面改动（另立契约）。
//
// 断言纪律（反空洞）：每条目标态断言都核对「与今日硬门返回值不同」的精确字段（status/reason/ok），
// 使今日统一的 ENTITY_LOCK_RUNTIME_UNAUTHORIZED 不能满足任何一条 → 保证红、非空洞过。
// 该硬门若来日打开（接缝落地），这些断言即转真绿——这正是前瞻基线的用途。

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTRACT_ID = 'teachin-semantic-lock-capability-hardening';
const CASE_ID = 'tc_semantic_lock_capability';
const ROOT_ID = 'golden-runtime-root';
const ADAPTER_ID = 'golden-runtime-adapter';
const ISSUER_ID = 'golden-runtime-issuer';
const LIB_ROOT = fileURLToPath(new URL('../../lib/', import.meta.url));
const LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json', import.meta.url);
const EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/events.document.json', import.meta.url);
const lockBytes = readFileSync(LOCK_PATH);
const eventsBytes = readFileSync(EVENTS_PATH);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const HEAD_HASH = '0d7294372a5048fa77e194c44fdd145da79dd7f40175964aeeb64550f9177f8b';

// ---- 温拷贝临时仓：建一个合法 handle（runtimeAuthorized 恒 false）----
const ROOT = mkdtempSync(join(tmpdir(), 'casey-lock-discrimination-'));
cpSync(LIB_ROOT, join(ROOT, 'lib'), { recursive: true });
const lockKey = 'release/entity-semantic-lock/discrimination/entity-locks.frozen.json';
const lockPath = join(ROOT, lockKey);
mkdirSync(dirname(lockPath), { recursive: true });
writeFileSync(lockPath, lockBytes);
writeFileSync(
  join(ROOT, 'lib', 'entity-semantic-lock-publications.mjs'),
  `export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = ${JSON.stringify({
    [CONTRACT_ID]: { source: 'release-resource', mode: 'historical', locks: { [lockKey]: sha256(lockBytes) } },
  })};\n`,
);

let api;
let handle;
try {
  api = await import(`${pathToFileURL(join(ROOT, 'lib', 'entity-semantic-lock-v2.mjs')).href}?discrimination`);
  const loaded = api.readFrozenEntityLockSetAuthority({ contractId: CONTRACT_ID, lockSetKey: lockKey });
  const verified = api.verifyEntityLockSet({ authority: loaded.authority, caseId: CASE_ID, eventsBytes });
  handle = verified.handle;
  if (!handle) throw new Error(`温拷贝合法 handle 未建立: ${JSON.stringify(verified)}`);
} catch (error) {
  console.error(`RED  runtime-discrimination-successor: 前瞻基线建 handle 失败（应能建 handle 再撞硬门）: ${error.message}`);
  rmSync(ROOT, { recursive: true, force: true });
  process.exit(1);
}

function binding() {
  return { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.rename', role: 'subject', candidate: 'candidate-workflow-main', lockId: 'lock-workflow-main' };
}
function goodCandidate(patch = {}) {
  return {
    physicalId: 'row-1', kind: 'workflow', name: '审批工作流', code: 'wf-001',
    platformId: '90071992547409931234', scopeSha256: '1'.repeat(64),
    parentReceiptHash: null, revisionId: 'rev-7', ...patch,
  };
}
function newReadback(patch = {}) {
  return { name: '审批工作流V2', code: 'wf-002', platformId: '90071992547409931234', revisionId: 'rev-8', ...patch };
}

// 目标态：合法运行时权威成立后，通过手签驱动铸造不透明 capability。今日 createEntityRuntimeAdapter
// 与 issueEntityRunContext 恒拒（无可执行装载器），故 capability 恒不可得——被铸造硬门拦停。
async function mintCapability({ complete = true, candidates = [goodCandidate()], read, runKey = 'run-discrimination' } = {}) {
  const reader = read ?? (async () => ({ complete, candidates }));
  const adapter = api.createEntityRuntimeAdapter({ rootId: ROOT_ID, contractId: CONTRACT_ID, adapterId: ADAPTER_ID, read: reader });
  if (!adapter?.ok || !adapter.adapter) return { ok: false, stage: 'adapter', reason: adapter?.reason ?? 'ADAPTER_UNAVAILABLE' };
  const runContext = await api.issueEntityRunContext({ rootId: ROOT_ID, contractId: CONTRACT_ID, issuerId: ISSUER_ID, runKey });
  if (!runContext?.ok || !runContext.runContext) return { ok: false, stage: 'run-context', reason: runContext?.reason ?? 'RUN_CONTEXT_UNAVAILABLE' };
  const cap = await api.readEntityRuntimeCapability({ adapter: adapter.adapter, binding: binding(), runContext: runContext.runContext });
  if (!cap?.ok || !cap.capability) return { ok: false, stage: 'capability', reason: cap?.reason ?? 'CAPABILITY_UNAVAILABLE' };
  return { ok: true, capability: cap.capability, adapter: adapter.adapter, runContext: runContext.runContext };
}

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
// 目标态断言：期望字段全等；任一不等即抛，且抛出信息带上实际结果与铸造受阻处，指向硬门。
function assertTarget(result, expected, mint) {
  const misses = [];
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(result?.[key]) !== JSON.stringify(value)) {
      misses.push(`${key} 期望 ${JSON.stringify(value)} 实得 ${JSON.stringify(result?.[key])}`);
    }
  }
  if (misses.length) {
    throw new Error(`目标态未达 [${misses.join(' / ')}] | 实际=${JSON.stringify(result)} | 铸造受阻=${mint ? `${mint.stage}:${mint.reason}` : 'n/a'}`);
  }
}
async function evaluateScenario(scenario) {
  const mint = await mintCapability(scenario);
  const result = api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: mint.capability });
  return { result, mint };
}

// ===== 硬门诊断（说明为什么整份基线今日红；非可翻绿的 check）=====
{
  const evGate = api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: {} });
  const suGate = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: {} });
  const adGate = api.createEntityRuntimeAdapter({ rootId: ROOT_ID, contractId: CONTRACT_ID, adapterId: ADAPTER_ID, read: async () => ({ complete: true, candidates: [] }) });
  console.error(`DIAG runtime-discrimination-successor 硬门: evaluate=${evGate?.reason} successor=${suGate?.reason} adapter=${adGate?.reason}`);
}

// ===== V2-C 候选判别（唯一动作门）=====
await check('V2-C 唯一完整候选 → SAME 锚成立', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [goodCandidate()] });
  assertTarget(result, { status: 'SAME', allowAction: true, candidateCount: 1 }, mint);
});
await check('V2-C 重复实际匹配不折叠 → AMBIGUOUS（保真计数 2）', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [goodCandidate(), goodCandidate()] });
  assertTarget(result, { status: 'AMBIGUOUS', allowAction: false, reason: 'ENTITY_RUNTIME_MATCH_AMBIGUOUS', candidateCount: 2 }, mint);
});
await check('V2-C 同 physicalId 异身份冲突 → UNVERIFIED/ENTITY_PHYSICAL_ID_CONFLICT', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [goodCandidate(), goodCandidate({ code: 'wf-conflict' })] });
  assertTarget(result, { status: 'UNVERIFIED', allowAction: false, reason: 'ENTITY_PHYSICAL_ID_CONFLICT' }, mint);
});
await check('V2-C 畸形候选 → UNVERIFIED/ENTITY_CANDIDATE_INVALID', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [{ physicalId: 'broken' }] });
  assertTarget(result, { status: 'UNVERIFIED', allowAction: false, reason: 'ENTITY_CANDIDATE_INVALID' }, mint);
});
await check('V2-C 候选名前导空格不静默 trim → UNVERIFIED/ENTITY_CANDIDATE_INVALID', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [goodCandidate({ name: ' 审批工作流' })] });
  assertTarget(result, { status: 'UNVERIFIED', allowAction: false, reason: 'ENTITY_CANDIDATE_INVALID' }, mint);
});
await check('V2-C 身份漂移（name/code 不配对）→ CHANGED/ENTITY_IDENTITY_CHANGED', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [goodCandidate({ name: '别的工作流', code: 'wf-999' })] });
  assertTarget(result, { status: 'CHANGED', allowAction: false, reason: 'ENTITY_IDENTITY_CHANGED' }, mint);
});
await check('V2-C 可信零扫描（complete+空）→ MISSING/ENTITY_NOT_FOUND（计数 0）', async () => {
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [] });
  assertTarget(result, { status: 'MISSING', allowAction: false, reason: 'ENTITY_NOT_FOUND', candidateCount: 0 }, mint);
});
await check('V2-C 不完整扫描 → UNVERIFIED/ENTITY_SCAN_INCOMPLETE', async () => {
  const { result, mint } = await evaluateScenario({ complete: false, candidates: [] });
  assertTarget(result, { status: 'UNVERIFIED', allowAction: false, reason: 'ENTITY_SCAN_INCOMPLETE' }, mint);
});
await check('V2-C 候选 accessor getter → 铸造 ENTITY_RUNTIME_READ_INVALID 且不泄漏 getter 内文', async () => {
  const accessor = goodCandidate();
  Object.defineProperty(accessor, 'name', { enumerable: true, get() { throw new Error('SECRET_GETTER_TEXT'); } });
  const mint = await mintCapability({ read: async () => ({ complete: true, candidates: [accessor] }) });
  if (mint.ok) throw new Error(`accessor 候选竟铸出 capability: ${JSON.stringify(mint)}`);
  if (JSON.stringify(mint).includes('SECRET_GETTER_TEXT')) throw new Error(`铸造结果泄漏 getter 内文: ${JSON.stringify(mint)}`);
  if (mint.reason !== 'ENTITY_RUNTIME_READ_INVALID') {
    throw new Error(`目标态未达 [reason 期望 "ENTITY_RUNTIME_READ_INVALID" 实得 ${JSON.stringify(mint.reason)}] | 铸造受阻=${mint.stage}:${mint.reason}`);
  }
});

// ===== H2 capability 不透明（SAME/MISSING 只出自 runtime adapter）=====
await check('H2 原始 scan 对象冒充 capability → ENTITY_RUNTIME_CAPABILITY_INVALID', () => {
  const result = api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: { complete: true, candidates: [goodCandidate()] } });
  assertTarget(result, { allowAction: false, reason: 'ENTITY_RUNTIME_CAPABILITY_INVALID' });
});
await check('H2 capability 展开副本丢失身份 → ENTITY_RUNTIME_CAPABILITY_INVALID', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate()] });
  const copied = mint.capability ? { ...mint.capability } : { artifactKind: 'entity-runtime-readback-capability', candidateCount: 1 };
  const result = api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: copied });
  assertTarget(result, { allowAction: false, reason: 'ENTITY_RUNTIME_CAPABILITY_INVALID' }, mint);
});
await check('H2 adapter read 抛异常 → 铸造 ENTITY_RUNTIME_READ_INVALID 且不泄漏 read 内文', async () => {
  const mint = await mintCapability({ read: async () => { throw new Error('SECRET_ADAPTER_TEXT'); } });
  if (mint.ok) throw new Error(`抛异常 adapter 竟铸出 capability: ${JSON.stringify(mint)}`);
  if (JSON.stringify(mint).includes('SECRET_ADAPTER_TEXT')) throw new Error(`铸造结果泄漏 read 内文: ${JSON.stringify(mint)}`);
  // 目标态：读回校验拒于 ENTITY_RUNTIME_READ_INVALID（今日先被 adapter 铸造硬门拦停）。
  if (mint.reason !== 'ENTITY_RUNTIME_READ_INVALID') {
    throw new Error(`目标态未达 [reason 期望 "ENTITY_RUNTIME_READ_INVALID" 实得 ${JSON.stringify(mint.reason)}] | 铸造受阻=${mint.stage}:${mint.reason}`);
  }
});

// ===== V2-D / H3 successor 语义 =====
async function successor({ transitionId = 'rename-main', previousHeadHash = HEAD_HASH, mint } = {}) {
  const use = mint ?? await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())] });
  const result = api.createRunSuccessorProof({ handle, binding: binding(), transitionId, previousHeadHash, runtimeCapability: use.capability });
  return { result, mint: use };
}
await check('V2-D successor 未知 transition → ENTITY_TRANSITION_NOT_SIGNED', async () => {
  const { result, mint } = await successor({ transitionId: 'unknown-transition' });
  assertTarget(result, { ok: false, reason: 'ENTITY_TRANSITION_NOT_SIGNED' }, mint);
});
await check('V2-D successor 非当前 head → ENTITY_LOCK_HEAD_STALE', async () => {
  const { result, mint } = await successor({ previousHeadHash: '0'.repeat(64) });
  assertTarget(result, { ok: false, reason: 'ENTITY_LOCK_HEAD_STALE' }, mint);
});
await check('V2-D successor 平台 ID 换代 → PLATFORM_ID_MISMATCH', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback({ platformId: 'new-generation' }))] });
  const { result } = await successor({ mint });
  assertTarget(result, { ok: false, reason: 'PLATFORM_ID_MISMATCH' }, mint);
});
await check('V2-D successor 缺新 revision → REVISION_UNAVAILABLE', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback({ revisionId: null }))] });
  const { result } = await successor({ mint });
  assertTarget(result, { ok: false, reason: 'REVISION_UNAVAILABLE' }, mint);
});
await check('V2-D successor revision 未前进 → ENTITY_SUCCESSOR_REVISION_NOT_ADVANCED', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback({ revisionId: 'rev-7' }))] });
  const { result } = await successor({ mint });
  assertTarget(result, { ok: false, reason: 'ENTITY_SUCCESSOR_REVISION_NOT_ADVANCED' }, mint);
});
await check('H3 successor 吃异 run capability → ENTITY_SUCCESSOR_RUNTIME_MISMATCH', async () => {
  const other = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())], runKey: 'run-other' });
  const result = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: other.capability });
  assertTarget(result, { ok: false, reason: 'ENTITY_SUCCESSOR_RUNTIME_MISMATCH' }, other);
});
await check('H3 successor 吃异 adapter capability → ENTITY_SUCCESSOR_RUNTIME_MISMATCH', async () => {
  const anchor = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())], runKey: 'run-anchor' });
  api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: anchor.capability });
  const otherAdapter = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())], runKey: 'run-anchor' });
  const result = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: otherAdapter.capability });
  assertTarget(result, { ok: false, reason: 'ENTITY_SUCCESSOR_RUNTIME_MISMATCH' }, otherAdapter);
});
await check('H3 successor 普通字段（无 runtime capability 读回 proof）不推进 head，原 head 仍 SAME', async () => {
  // 可达前置：旧签名 authoritativeReadback/runId 被 closedObject 拒（ENTITY_SUCCESSOR_INPUT_INVALID）。
  const ordinary = api.createRunSuccessorProof({
    handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH,
    authoritativeReadback: newReadback(), runId: 'run-ordinary',
  });
  if (ordinary?.ok || ordinary?.reason !== 'ENTITY_SUCCESSOR_INPUT_INVALID') {
    throw new Error(`普通字段 successor 未被输入闭合拒: ${JSON.stringify(ordinary)}`);
  }
  // 目标态承重断言：失败尝试后 head 未推进，原 head 再评估仍 SAME（今日被硬门拦停）。
  const { result, mint } = await evaluateScenario({ complete: true, candidates: [goodCandidate()] });
  assertTarget(result, { status: 'SAME', allowAction: true, candidateCount: 1 }, mint);
});
await check('V2-D/H3 合法 successor 成立 → ok 且 previousReceiptHash===head', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())] });
  // 目标态：先经同一 runtime 锚定 SAME，再签 successor。
  api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: mint.capability });
  const result = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: mint.capability });
  assertTarget(result, { ok: true, previousReceiptHash: HEAD_HASH }, mint);
  if (!result?.receiptHash || result.receiptHash === HEAD_HASH) {
    throw new Error(`目标态未达 [successor 未换 head] | 实际=${JSON.stringify(result)} | 铸造受阻=${mint.stage}:${mint.reason}`);
  }
});
await check('V2-D 成功迁移使旧链头失效（旧 head 再评估不得 SAME）', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())] });
  api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: mint.capability });
  const proof = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: mint.capability });
  // 目标态：迁移成功后，携旧 head（无 activeHeadProof）再评估必判 CHANGED/HEAD_STALE。
  const stale = api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: mint.capability });
  if (!proof?.ok) {
    throw new Error(`目标态未达 [successor 未成立故旧头失效无从验] | successor=${JSON.stringify(proof)} | 铸造受阻=${mint.stage}:${mint.reason}`);
  }
  assertTarget(stale, { status: 'CHANGED', allowAction: false, reason: 'ENTITY_LOCK_HEAD_STALE' }, mint);
});
await check('V2-D/H3 迁移后携同 run 新 head proof 可继续 → SAME', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())] });
  api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: mint.capability });
  const proof = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: mint.capability });
  if (!proof?.ok) {
    throw new Error(`目标态未达 [successor 未成立故新头续用无从验] | successor=${JSON.stringify(proof)} | 铸造受阻=${mint.stage}:${mint.reason}`);
  }
  const cont = api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: mint.capability, activeHeadProof: proof });
  assertTarget(cont, { status: 'SAME', allowAction: true }, mint);
});

// ===== 原 runtime-authority 三条运行时检查（目标态正向可达 → 今日硬门红）=====
await check('RA-1 铸造只出自手签驱动读回（调用者 read 经合法铸造仍只能得不透明 capability）', async () => {
  const mint = await mintCapability({ complete: true, candidates: [goodCandidate()] });
  if (!mint.ok || !mint.capability) {
    throw new Error(`目标态未达 [合法铸造应得 capability] | 铸造受阻=${mint.stage}:${mint.reason}`);
  }
  if (mint.capability.candidateCount !== 1 || 'candidates' in mint.capability || 'complete' in mint.capability) {
    throw new Error(`目标态未达 [capability 应不透明、只暴露 candidateCount] | 实际=${JSON.stringify(mint.capability)}`);
  }
});
await check('RA-2 run context 必经 issueEntityRunContext 铸造（普通 {runKey} 冻结对象铸不出 capability）', async () => {
  const adapter = api.createEntityRuntimeAdapter({ rootId: ROOT_ID, contractId: CONTRACT_ID, adapterId: ADAPTER_ID, read: async () => ({ complete: true, candidates: [goodCandidate()] }) });
  if (!adapter?.ok || !adapter.adapter) {
    throw new Error(`目标态未达 [合法 adapter 应铸出] | adapter=${JSON.stringify(adapter)}`);
  }
  const plain = await api.readEntityRuntimeCapability({ adapter: adapter.adapter, binding: binding(), runContext: Object.freeze({ runKey: 'plain-run-key' }) });
  assertTarget(plain, { ok: false, reason: 'ENTITY_RUNTIME_CAPABILITY_INPUT_INVALID' }, { stage: 'adapter', reason: adapter?.reason });
});
await check('RA-3 同 runKey 字符串的两个 run context 是两次运行（B 的 capability 签不出 A 的 successor）', async () => {
  const contextA = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())], runKey: 'shared-run-key' });
  const contextB = await mintCapability({ complete: true, candidates: [goodCandidate(newReadback())], runKey: 'shared-run-key' });
  if (!contextA.ok) {
    throw new Error(`目标态未达 [A 运行应铸出以供锚定] | 铸造受阻=${contextA.stage}:${contextA.reason}`);
  }
  api.evaluateEntityAction({ handle, binding: binding(), runtimeCapability: contextA.capability });
  const crossed = api.createRunSuccessorProof({ handle, binding: binding(), transitionId: 'rename-main', previousHeadHash: HEAD_HASH, runtimeCapability: contextB.capability });
  assertTarget(crossed, { ok: false, reason: 'ENTITY_SUCCESSOR_RUNTIME_MISMATCH' }, contextB);
});

rmSync(ROOT, { recursive: true, force: true });

if (failures.length) {
  for (const failure of failures) console.error(`RED  runtime-discrimination-successor: ${failure}`);
  console.error(`RED  runtime-discrimination-successor: ${passed} 过 / ${failures.length} 红（前瞻基线：今日被 ENTITY_LOCK_RUNTIME_UNAUTHORIZED 硬门拦停，填绿路径 route:human 待 Steven）`);
  process.exit(1);
}
console.log(`ok   runtime-discrimination-successor: ${passed}/${passed} 全过（运行时权威接缝已落地，前瞻基线转真绿）`);

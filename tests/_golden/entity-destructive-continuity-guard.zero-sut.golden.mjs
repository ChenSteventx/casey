#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）验收金牌：运行时目标连续性守卫（红先行、zero-SUT）。
// 纯 node：纯内存夹具 + 一组目标纯函数（零 LLM、零浏览器、零网络、零 server、零 fake SUT、零子进程）。
// 断言纪律：退出码 + deepEqual/具名 reason 钉死；禁标记串 grep 判绿（判绿只信退出码，MEMORY 铁律）。
//
// ── 语义边界（务必守，报告不得冒充）─────────────────────────────────────────────────
// C3 是【运行时目标连续性守卫】，用 identityObservationRef 的 platformId 做「同一目标」核对，
//   【非】「消费同一份形式收据」(receiptHash)——那要唤醒被封死的子系统 A（kernel 设计门 + Steven 人签），
//   本轮结构性关不掉（GRILL D1）。本金牌只证 C 束强度（防误删的目标连续性），绝不冒充 A 束的签发根/
//   授权/provenance/联合五元/TOCTOU 五层。v2 形式收据链字节仍冻（b7b5a47e，本轮不碰）。
//
// ── 目标 API（本金牌冻结，loop 阶段实现须迎合；今日模块尚不存在=红先行的红）───────────
// 新模块 lib/entity-destructive-continuity.mjs 导出（纯函数、零 IO、通道无关）：
//   requiresTargetContinuityRef(atom) -> boolean
//       仅 targeting/破坏性原子 true：workflow.deleteByName / agent.delete / picker.selectFirstTool；
//       create/addNode/setNodeField/setSwitch/addNodeInputVar/bindAgent、孤儿 agent.removeToolByName、
//       nav.*/assert.*/agent.searchOpen 及未知原子一律 false（限 targeting、不全量翻；plan 验收点 6/7、GRILL D2/D4）。
//   mintTargetContinuityObservation(input) -> { ok, ref(深冻结) } | { ok:false, reason }
//       创建/首读后铸不可覆盖 observation，绑完整五元(sourceIntentId/candidateId/role/atom/evidenceStepId)
//       + platformId/name/code + profileFingerprint(指纹=identityProfileDigest) + scope + requestCorrelationId(请求关联)
//       + stepOrder(步序，非负整数)；任一字段缺/空即 { ok:false }（plan 验收点 1）。
//   resolveDestructiveTarget({ ref, name }) -> { ok, targetId } | { ok:false, reason }
//       破坏性动作【携带 ref】取 ref.platformId，绝不按 name 再生成；ref 缺 platformId 即 fail-closed，
//       不回落 name（plan 验收点 1 后半）。
//   runGuardedMutation({ atom, request:{url,method,body}, ref, send }) ->
//       { ok:true, released:true, targetId, response } | { ok:false, aborted:true, released:false, reason, mutated:false }
//       出站 mutation 请求【放行前】核对请求 url/body 里的 platformId 与 ref.platformId：一致才调 send(request)
//       放行；不一致/无可验 ID 即中止且【不调 send】（证 SUT 零副作用——poison send 代理）。send 是注入的出站通道，
//       在 replay 里由 page.route 处理器委派本纯决策（plan 验收点 2；GRILL D3「只看 response 太晚」）。
//   classifyPreDeleteScan({ candidates, paginationComplete, correlatable }) -> { verdict:'PROCEED'|'NEEDS_HUMAN', reason }
//       删前完整可证明扫描：坏候选 / 分页不全 / 相关响应不可关联 任一 → NEEDS_HUMAN（plan 验收点 3；GRILL D... fail-closed）。
//   routeOutboundIdentifiability({ request, domId }) -> { route:'proceed' } | { route:'human', reason, failClosed:true }
//       mutation 请求无可验 ID 且 DOM 无 ID → 结构上不能安全自动化 → route:human（plan 验收点 4；GRILL D5）。
//   evaluateTargetAbsence({ ref, window }) -> { proven:boolean, mode:'target-id-absence', targetId, reason }
//       收尾按 target-ID 稳定窗口 absence-proof（window.presentPlatformIds 不含 ref.platformId 且 window.stable）；
//       name-count-only 窗口（无 presentPlatformIds）永远 proven:false（非 name count===0；plan 验收点 5；GRILL D6）。
//   selectDestructiveCandidateByRef({ candidates, ref }) -> { ok:true, candidateId, platformId } | { ok:false, aborted:true, reason }
//       delete/add-tool 同名毒化：按 ref.platformId 唯一命中候选，绝不取 first（nth:0）；0 或 >1 命中即中止
//       （plan 验收点 8；对齐 picker.selectFirstTool 的 nth:0 与 deleteByName 同名取 first 风险面）。
//
// ── 红先行判据 ────────────────────────────────────────────────────────────────────
// 守卫落地前 lib/entity-destructive-continuity.mjs 尚不存在，import 即失败（ERR_MODULE_NOT_FOUND）=RED；
// 实现后 r0 + v1..v8 全绿。每 section 均带「忠实 ref → 全绿」正控 + 「不同 ID/取 first/过度索要/count-only」反控，
// 令 always-放行/always-取first/always-索要/count===0 这类退化实现被逐条逮红（咬合，不空过）。
//
// ── 夹具形态锚真机 ────────────────────────────────────────────────────────────────
// platformId 形态锚 uat-run.md：19 位纯数字 string（opaque，不作数）；同名毒化用同 name 不同 platformId 两候选。
//
// ── 测试替身注入（EDC_IMPL，仅本地咬合验证；gate 恒不设）─────────────────────────────
// 缺省 import 规范 lib 路径（gate 跑的就是这条=生产真值）；设 EDC_IMPL 则 import 指定实现并在 stderr 打
// 「WARN 覆盖」横幅——供作者用忠实/退化替身实证咬合，gate 命令串不含该 env 故永不生效、不能伪装干净绿。

import { deepStrictEqual } from 'node:assert';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'r0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']);
if (!SECTIONS.has(SECTION)) process.exit(2);
const HERE = dirname(fileURLToPath(import.meta.url));
const CANONICAL = resolve(HERE, '..', '..', 'lib', 'entity-destructive-continuity.mjs');
const IMPL_PATH = process.env.EDC_IMPL ? resolve(process.env.EDC_IMPL) : CANONICAL;
if (process.env.EDC_IMPL) {
  console.error(`WARN entity-destructive-continuity-guard: EDC_IMPL 测试替身覆盖生效 → ${IMPL_PATH}（仅本地咬合验证；gate 恒不设此 env）`);
}

// ── 红先行：目标模块尚不存在则 import 抛错，打印 RED 行并 exit 1（红的机制=API 未实现）──
let mod;
try {
  mod = await import(pathToFileURL(IMPL_PATH).href);
} catch (error) {
  console.error(`RED  entity-destructive-continuity-guard: 目标连续性守卫模块缺席（红先行，loop 阶段实现）—— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const EXPORTS = [
  'requiresTargetContinuityRef', 'mintTargetContinuityObservation', 'resolveDestructiveTarget',
  'runGuardedMutation', 'classifyPreDeleteScan', 'routeOutboundIdentifiability',
  'evaluateTargetAbsence', 'selectDestructiveCandidateByRef',
];
for (const name of EXPORTS) {
  if (typeof mod[name] !== 'function') {
    console.error(`RED  entity-destructive-continuity-guard: lib/entity-destructive-continuity.mjs 未导出 ${name} 纯函数`);
    process.exit(1);
  }
}
const {
  requiresTargetContinuityRef, mintTargetContinuityObservation, resolveDestructiveTarget,
  runGuardedMutation, classifyPreDeleteScan, routeOutboundIdentifiability,
  evaluateTargetAbsence, selectDestructiveCandidateByRef,
} = mod;

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const brief = (value) => { try { return JSON.stringify(value).slice(0, 200); } catch { return String(value); } };

// ── 夹具（纯内存，形态锚真机）─────────────────────────────────────────────────────
const TARGET_PLATFORM_ID = '1234567890123456789';    // 19 位纯数字 string（本轮欲删的真目标）
const IMPOSTOR_PLATFORM_ID = '9876543210987654321';  // 同名冒名者（毒化面）
const NAME = 'atl_wf_dup';
const CODE = 'atl_code_dup';

// 忠实 ref（创建/首读铸的连续性观察，绑完整五元 + 指纹 + scope + 请求关联 + 步序）。
function refInput(over = {}) {
  return {
    platformId: TARGET_PLATFORM_ID, name: NAME, code: CODE,
    role: 'subject', atom: 'workflow.deleteByName', evidenceStepId: 'atstep_3',
    sourceIntentId: 'source_1', candidateId: 'candidate-target',
    profileFingerprint: 'sha256:aa11bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff00112233',
    scope: 'process-list', requestCorrelationId: 'corr-del-0001', stepOrder: 3,
    ...over,
  };
}
function mintOk(over = {}) {
  const r = mintTargetContinuityObservation(refInput(over));
  assert(r && r.ok === true && r.ref && typeof r.ref === 'object', `mint 忠实 ref 应成功；实得 ${brief(r)}`);
  return r.ref;
}

// ── r0 结构：守卫模块导出面（8 纯函数）───────────────────────────────────────────────
test('r0', 'r0 守卫模块导出 8 目标纯函数（requiresTargetContinuityRef / mint / resolve / runGuarded / classifyScan / routeIdentifiability / evaluateAbsence / selectByRef）', () => {
  for (const name of EXPORTS) assert(typeof mod[name] === 'function', `${name} 须为导出纯函数`);
});

// ══ 验收点 1：不可覆盖 observation + ref 携带（mint 深冻结、绑全字段；resolve 携 ref 非按名再生成）══
test('v1', 'v1a mint 忠实 ref → 成功且【深冻结】不可覆盖（Object.isFrozen；写字段不生效）', () => {
  const ref = mintOk();
  assert(Object.isFrozen(ref), 'mint 出的 observation 须深冻结（不可覆盖）');
  const before = ref.platformId;
  try { ref.platformId = 'tampered'; } catch { /* strict 抛亦可 */ }
  assert(ref.platformId === before, `冻结 observation 的 platformId 不得被覆盖；实得 ${brief(ref.platformId)}`);
});
test('v1', 'v1b mint 绑完整五元 + platformId/name/code + 指纹 + scope + 请求关联 + 步序（缺任一即拒）', () => {
  const ref = mintOk();
  for (const f of ['platformId', 'name', 'code', 'role', 'atom', 'evidenceStepId', 'sourceIntentId', 'candidateId', 'profileFingerprint', 'scope', 'requestCorrelationId']) {
    assert(typeof ref[f] === 'string' && ref[f].trim(), `ref.${f} 须非空 string；实得 ${brief(ref[f])}`);
  }
  assert(Number.isInteger(ref.stepOrder) && ref.stepOrder >= 0, `ref.stepOrder 须非负整数；实得 ${brief(ref.stepOrder)}`);
  // 缺字段（如缺 requestCorrelationId / 缺 stepOrder / 空 platformId）逐一拒。
  for (const bad of [{ requestCorrelationId: '' }, { scope: '   ' }, { profileFingerprint: '' }, { platformId: '' }]) {
    const r = mintTargetContinuityObservation(refInput(bad));
    assert(r && r.ok === false, `mint 缺字段 ${brief(bad)} 应拒（ok:false）；实得 ${brief(r)}`);
  }
  const rNoStep = mintTargetContinuityObservation({ ...refInput(), stepOrder: undefined });
  assert(rNoStep && rNoStep.ok === false, 'mint 缺 stepOrder（步序）应拒');
});
test('v1', 'v1c resolveDestructiveTarget 携 ref 取 platformId，绝不按 name 再生成（name 变/缺不改结果）', () => {
  const ref = mintOk();
  const r = resolveDestructiveTarget({ ref, name: '完全不同的名字' });
  assert(r && r.ok === true, `resolve 忠实 ref 应成功；实得 ${brief(r)}`);
  assert(r.targetId === TARGET_PLATFORM_ID, `resolve 应取 ref.platformId 非按 name；实得 ${brief(r.targetId)}`);
  // ref 缺 platformId → fail-closed，不回落 name。
  const bad = resolveDestructiveTarget({ ref: { name: NAME }, name: NAME });
  assert(bad && bad.ok === false, `ref 缺 platformId 应 fail-closed（ok:false，不回落 name）；实得 ${brief(bad)}`);
});

// ══ 验收点 2：出站请求前置核对（放行前核 url/body 的 platformId；不同则中止 + 证 SUT 未改）══
function poisonSender() {
  const sent = [];
  const send = (req) => { sent.push(req); return { status: 200, body: 'MUTATED' }; };
  return { sent, send };
}
test('v2', 'v2a 出站请求 platformId 与 ref 一致 → 放行前核对通过、调 send 一次、released', () => {
  const ref = mintOk();
  const { sent, send } = poisonSender();
  const request = { url: `{{baseUrl}}/ai-manager/process/delete?id=${TARGET_PLATFORM_ID}`, method: 'POST', body: { id: TARGET_PLATFORM_ID } };
  const r = runGuardedMutation({ atom: 'workflow.deleteByName', request, ref, send });
  assert(r && r.ok === true && r.released === true, `一致应放行；实得 ${brief(r)}`);
  assert(r.targetId === TARGET_PLATFORM_ID, `放行应回目标 ID；实得 ${brief(r.targetId)}`);
  assert(sent.length === 1, `一致时 send 应恰调一次；实得 ${sent.length}`);
});
test('v2', 'v2b 出站请求 platformId 与 ref 不同（同名冒名者）→ 放行前中止、send 零调用、mutated:false（poison 证零副作用）', () => {
  const ref = mintOk();
  const { sent, send } = poisonSender();
  // 今日按名/计数会命中同名冒名者；C3 核出站 ID 不一致即中止。
  const request = { url: `{{baseUrl}}/ai-manager/process/delete?id=${IMPOSTOR_PLATFORM_ID}`, method: 'POST', body: { id: IMPOSTOR_PLATFORM_ID } };
  const r = runGuardedMutation({ atom: 'workflow.deleteByName', request, ref, send });
  assert(r && r.ok === false && r.aborted === true && r.released === false, `不同 ID 必中止（ok:false/aborted/未放行）；实得 ${brief(r)}`);
  assert(r.mutated === false, `中止须证 SUT 未改（mutated:false）；实得 ${brief(r.mutated)}`);
  // 咬合核心 + 「请求发出前拦」：mismatch 下出站通道零调用；只看 response 的实现会先调 send 而被此断言逮红。
  assert(sent.length === 0, `不同 ID 时出站 send 必零调用（请求发出前拦、SUT 零副作用）；实得 ${sent.length}`);
});
test('v2', 'v2c 出站请求无可验 platformId（url/body 均无 id）→ fail-closed 中止、send 零调用', () => {
  const ref = mintOk();
  const { sent, send } = poisonSender();
  const request = { url: '{{baseUrl}}/ai-manager/process/delete', method: 'POST', body: {} };
  const r = runGuardedMutation({ atom: 'workflow.deleteByName', request, ref, send });
  assert(r && r.ok === false && r.aborted === true, `无可验出站 ID 应 fail-closed 中止；实得 ${brief(r)}`);
  assert(sent.length === 0, `无可验 ID 时 send 必零调用；实得 ${sent.length}`);
});

// ══ 验收点 3：删前完整可证明扫描——坏候选/分页不全/相关响应不可关联 → NEEDS_HUMAN ══
function scanCandidates() {
  return [
    { candidateId: 'c1', name: NAME, platformId: TARGET_PLATFORM_ID },
    { candidateId: 'c2', name: 'atl_other', platformId: IMPOSTOR_PLATFORM_ID },
  ];
}
test('v3', 'v3a 候选全良、分页完整、响应可关联 → PROCEED（正控）', () => {
  const r = classifyPreDeleteScan({ candidates: scanCandidates(), paginationComplete: true, correlatable: true });
  assert(r && r.verdict === 'PROCEED', `全良应 PROCEED；实得 ${brief(r)}`);
});
test('v3', 'v3b 坏候选（缺 platformId）→ NEEDS_HUMAN（fail-closed）', () => {
  const bad = [{ candidateId: 'c1', name: NAME }, { candidateId: 'c2', name: 'x', platformId: IMPOSTOR_PLATFORM_ID }];
  const r = classifyPreDeleteScan({ candidates: bad, paginationComplete: true, correlatable: true });
  assert(r && r.verdict === 'NEEDS_HUMAN', `坏候选应 NEEDS_HUMAN；实得 ${brief(r)}`);
});
test('v3', 'v3c 分页不全（paginationComplete:false）→ NEEDS_HUMAN（fail-closed）', () => {
  const r = classifyPreDeleteScan({ candidates: scanCandidates(), paginationComplete: false, correlatable: true });
  assert(r && r.verdict === 'NEEDS_HUMAN', `分页不全应 NEEDS_HUMAN；实得 ${brief(r)}`);
});
test('v3', 'v3d 相关响应不可关联（correlatable:false）→ NEEDS_HUMAN（fail-closed）', () => {
  const r = classifyPreDeleteScan({ candidates: scanCandidates(), paginationComplete: true, correlatable: false });
  assert(r && r.verdict === 'NEEDS_HUMAN', `响应不可关联应 NEEDS_HUMAN；实得 ${brief(r)}`);
});

// ══ 验收点 4：无可验出站 ID 且 DOM 无 ID → route:human（fail-closed）══
test('v4', 'v4a 请求带可验 id → route:proceed（正控）', () => {
  const r = routeOutboundIdentifiability({ request: { url: `x?id=${TARGET_PLATFORM_ID}`, body: { id: TARGET_PLATFORM_ID } }, domId: '' });
  assert(r && r.route === 'proceed', `带出站 id 应 proceed；实得 ${brief(r)}`);
});
test('v4', 'v4b 请求无 id 但 DOM 有 id → route:proceed（DOM 兜底可验）', () => {
  const r = routeOutboundIdentifiability({ request: { url: '{{baseUrl}}/delete', body: {} }, domId: TARGET_PLATFORM_ID });
  assert(r && r.route === 'proceed', `DOM 有 id 应 proceed；实得 ${brief(r)}`);
});
test('v4', 'v4c 请求无可验 id 且 DOM 无 id → route:human、failClosed:true（结构上不能安全自动化）', () => {
  const r = routeOutboundIdentifiability({ request: { url: '{{baseUrl}}/delete', body: {} }, domId: '' });
  assert(r && r.route === 'human', `两处皆无 id 应 route:human；实得 ${brief(r)}`);
  assert(r.failClosed === true, `route:human 须 failClosed:true；实得 ${brief(r.failClosed)}`);
});

// ══ 验收点 5：按 target-ID 稳定窗口 absence-proof（非 name count===0）══
test('v5', 'v5a 稳定窗口内 target-ID 缺席 → proven:true、mode:target-id-absence（正控）', () => {
  const ref = mintOk();
  const r = evaluateTargetAbsence({ ref, window: { presentPlatformIds: [IMPOSTOR_PLATFORM_ID, '5555555555555555555'], stable: true } });
  assert(r && r.proven === true, `target 缺席应 proven:true；实得 ${brief(r)}`);
  assert(r.mode === 'target-id-absence' && r.targetId === TARGET_PLATFORM_ID, `须按 target-ID 归零；实得 ${brief(r)}`);
});
test('v5', 'v5b target-ID 仍在窗口内 → proven:false（未归零）', () => {
  const ref = mintOk();
  const r = evaluateTargetAbsence({ ref, window: { presentPlatformIds: [TARGET_PLATFORM_ID], stable: true } });
  assert(r && r.proven === false, `target 仍在应 proven:false；实得 ${brief(r)}`);
});
test('v5', 'v5c 仅 name-count 窗口（无 presentPlatformIds，count===0）→ proven:false（非 name count===0；咬合）', () => {
  const ref = mintOk();
  const r = evaluateTargetAbsence({ ref, window: { nameCount: 0 } });
  assert(r && r.proven === false, `name-count-only 窗口不得据 count===0 判归零（须 proven:false）；实得 ${brief(r)}`);
});
test('v5', 'v5d 窗口不稳定（stable:false）→ proven:false', () => {
  const ref = mintOk();
  const r = evaluateTargetAbsence({ ref, window: { presentPlatformIds: [], stable: false } });
  assert(r && r.proven === false, `不稳定窗口应 proven:false；实得 ${brief(r)}`);
});

// ══ 验收点 6：孤儿策略项不误拒（agent.removeToolByName 有 policy 无编译器 → 不被索要 ref）══
test('v6', 'v6a 孤儿原子 agent.removeToolByName（有 side-effect policy、无编译器/无观察通道）→ 不索要连续性 ref（false）', () => {
  assert(requiresTargetContinuityRef('agent.removeToolByName') === false,
    'agent.removeToolByName 是孤儿策略项，不得被索要连续性 ref（D4 不误拒）');
});
test('v6', 'v6b 正控：真破坏性原子 agent.delete 确实被索要 ref（true）——证谓词非 always-false', () => {
  assert(requiresTargetContinuityRef('agent.delete') === true, 'agent.delete 是破坏性原子，须索要连续性 ref');
});

// ══ 验收点 7：限 targeting/破坏性原子——create/addNode/setNodeField 等不被误索要 ══
test('v7', 'v7a targeting/破坏性原子索要 ref：workflow.deleteByName / agent.delete / picker.selectFirstTool 全 true', () => {
  for (const atom of ['workflow.deleteByName', 'agent.delete', 'picker.selectFirstTool']) {
    assert(requiresTargetContinuityRef(atom) === true, `${atom} 须索要连续性 ref（true）`);
  }
});
test('v7', 'v7b 创建/修改流不被误索要（不全量翻）：create/addNode/setNodeField/setSwitch/addNodeInputVar/bindAgent + nav/assert/searchOpen 全 false', () => {
  for (const atom of [
    'workflow.create', 'workflow.addNode', 'workflow.setNodeField', 'workflow.setSwitch',
    'workflow.addNodeInputVar', 'workflow.bindAgent', 'nav.workflowManagement', 'assert.textVisible', 'agent.searchOpen',
  ]) {
    assert(requiresTargetContinuityRef(atom) === false, `${atom} 不得被索要连续性 ref（限 targeting、不全量翻）；实得 true`);
  }
  // 未知原子亦不误索要。
  assert(requiresTargetContinuityRef('totally.unknown') === false, '未知原子不得被索要连续性 ref');
});

// ══ 验收点 8：delete/add-tool 毒化——同名不得取 first，按 ref.platformId 唯一命中 ══
test('v8', 'v8a delete 同名毒化：两同名候选（冒名者在 nth:0、真目标在 nth:1）→ 按 ref 命中 nth:1，绝不取 first', () => {
  const ref = mintOk();
  const candidates = [
    { candidateId: 'row-0', name: NAME, platformId: IMPOSTOR_PLATFORM_ID },  // nth:0 冒名者
    { candidateId: 'row-1', name: NAME, platformId: TARGET_PLATFORM_ID },    // nth:1 真目标
  ];
  const r = selectDestructiveCandidateByRef({ candidates, ref });
  assert(r && r.ok === true, `按 ref 命中应成功；实得 ${brief(r)}`);
  assert(r.candidateId === 'row-1' && r.platformId === TARGET_PLATFORM_ID,
    `须按 ref.platformId 命中 nth:1 真目标、绝不取 first(nth:0)；实得 ${brief(r)}`);
});
test('v8', 'v8b add-tool 同名毒化（picker.selectFirstTool nth:0 面）：按 ref 命中真工具、绝不取 first', () => {
  const ref = mintOk({ platformId: '2222222222222222222', atom: 'picker.selectFirstTool', candidateId: 'candidate-tool' });
  const candidates = [
    { candidateId: 'tool-0', name: 'dup-tool', platformId: '3333333333333333333' },  // nth:0 冒名工具
    { candidateId: 'tool-1', name: 'dup-tool', platformId: '2222222222222222222' },  // nth:1 真工具
  ];
  const r = selectDestructiveCandidateByRef({ candidates, ref });
  assert(r && r.ok === true && r.candidateId === 'tool-1', `add-tool 须按 ref 命中真工具非 nth:0；实得 ${brief(r)}`);
});
test('v8', 'v8c 无候选命中 ref.platformId → 中止（不取 first、不误删）', () => {
  const ref = mintOk();
  const candidates = [
    { candidateId: 'row-0', name: NAME, platformId: IMPOSTOR_PLATFORM_ID },
    { candidateId: 'row-1', name: NAME, platformId: '5555555555555555555' },
  ];
  const r = selectDestructiveCandidateByRef({ candidates, ref });
  assert(r && r.ok === false && r.aborted === true, `无 ID 命中应中止（不取 first）；实得 ${brief(r)}`);
});

// ── 收口 ──────────────────────────────────────────────────────────────────────────
if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-destructive-continuity-guard: ${failure}`);
  console.error(`RED  entity-destructive-continuity-guard/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-destructive-continuity-guard/${SECTION}: ${passed}/${passed} 全过（纯函数 + 纯内存夹具，零 SUT；C 束目标连续性、非 A 束收据消费）`);

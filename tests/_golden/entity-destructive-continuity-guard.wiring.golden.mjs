#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）接线级金牌：把纯守卫接进三处生产路径的【接线本身】咬合验证。
// 纯 node：合成 mock page/route（不起真浏览器、零网络、零 server、零子进程、零 fake SUT）+ 静态源码接线断言。
// 断言纪律：退出码 + deepEqual/具名 reason 钉死；判绿只信退出码（MEMORY 铁律）。
//
// ── 为什么要这枚金牌（闭假绿）─────────────────────────────────────────────────────────
// 冻结金牌 entity-destructive-continuity-guard.zero-sut.golden.mjs 只测 8 纯函数；replay 的 page.route
// 出站拦截【零 hermetic 覆盖】=纯函数绿不等于生产路径接线绿（MEMORY golden-pure-fn-false-green）。本金牌咬
// lib/entity-destructive-continuity-wiring.mjs 的三个适配器与其在 bin/replay.mjs / lib/compile-atoms.mjs /
// lib/entity-semantic-lock-preflight.mjs 的接线，非纯函数本体。
//
// ── 语义边界（务必守）────────────────────────────────────────────────────────────────
// C 束目标连续性（identityObservationRef 的 platformId 核对），非 A 束「消费同一份形式收据」(receiptHash)。
// 真机 page.route 正确性（真删/改请求真携可验 platformId、真机破坏性 UAT）、present platformIds 归零列表投影
// 走 route:human（本金牌只咬 hermetic 接线，实机为准 ADR-0009）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  installOutboundMutationGuard,
  mintDestructiveTargetContinuity,
  evaluateDestructiveTargetAbsence,
} from '../../lib/entity-destructive-continuity-wiring.mjs';
import { mintTargetContinuityObservation } from '../../lib/entity-destructive-continuity.mjs';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'static']);
if (!SECTIONS.has(SECTION)) process.exit(2);
const HERE = dirname(fileURLToPath(import.meta.url));

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return Promise.resolve();
  return (async () => {
    try { await fn(); passed += 1; console.log(`ok   ${name}`); }
    catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
  })();
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const brief = (value) => { try { return JSON.stringify(value).slice(0, 200); } catch { return String(value); } };

// ── 夹具（纯内存，形态锚真机；同冻结金牌）────────────────────────────────────────────
const TARGET = '1234567890123456789';
const IMPOSTOR = '9876543210987654321';
const NAME = 'atl_wf_dup';
const CODE = 'atl_code_dup';
const FP = 'sha256:aa11bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff00112233';

function mintRef(over = {}) {
  const r = mintTargetContinuityObservation({
    platformId: TARGET, name: NAME, code: CODE, role: 'subject', atom: 'workflow.deleteByName',
    evidenceStepId: 'atstep_3', sourceIntentId: 'source_1', candidateId: 'candidate-target',
    profileFingerprint: FP, scope: 'process-list', requestCorrelationId: 'corr-del-0001', stepOrder: 3, ...over,
  });
  assert(r.ok === true, `夹具 mintRef 应成功；实得 ${brief(r)}`);
  return r.ref;
}

// 合成 route（Playwright Route 形态子集）：request()/continue()/abort() 计次——continue=真出站放行（poison 探针）。
function mockRoute({ url = '', method = 'POST', postData = null } = {}) {
  const calls = { continue: 0, abort: 0, abortReason: null };
  return {
    calls,
    request: () => ({ url: () => url, method: () => method, postData: () => postData }),
    continue: async () => { calls.continue += 1; },
    abort: async (reason) => { calls.abort += 1; calls.abortReason = reason; },
  };
}
// 合成 page：route(pattern, handler) 只登记（不起真浏览器）。
function mockPage() {
  const registered = [];
  return { registered, route: (pattern, handler) => registered.push({ pattern, handler }) };
}

const runAll = async () => {
  // ── w0 接线适配器导出面 ──────────────────────────────────────────────────────────
  await test('w0', 'w0 wiring 模块导出三适配器（installOutboundMutationGuard / mintDestructiveTargetContinuity / evaluateDestructiveTargetAbsence）', () => {
    assert(typeof installOutboundMutationGuard === 'function', '缺 installOutboundMutationGuard');
    assert(typeof mintDestructiveTargetContinuity === 'function', '缺 mintDestructiveTargetContinuity');
    assert(typeof evaluateDestructiveTargetAbsence === 'function', '缺 evaluateDestructiveTargetAbsence');
  });

  // ══ 接线 3（replay 出站拦截）：page.route 处理器发出前暂停 + 委派 runGuardedMutation ══
  await test('w1', 'w1 targeting 原子装拦截器且出站 platformId 与 ref 一致 → 放行前委派、route.continue 恰一次、不 abort', async () => {
    const ref = mintRef();
    const page = mockPage();
    let captured = null;
    const res = installOutboundMutationGuard(page, {
      atom: 'workflow.deleteByName', ref, urlPattern: '**/delete*', onDecision: (d) => { captured = d; },
    });
    assert(res.installed === true, `targeting 原子应装拦截器；实得 ${brief(res)}`);
    assert(page.registered.length === 1, `须注册恰一 page.route 拦截器；实得 ${page.registered.length}`);
    const route = mockRoute({ url: `{{baseUrl}}/ai-manager/process/delete?id=${TARGET}`, method: 'POST', postData: JSON.stringify({ id: TARGET }) });
    await page.registered[0].handler(route);
    assert(captured && captured.ok === true && captured.released === true, `一致应委派放行；实得 ${brief(captured)}`);
    assert(captured.targetId === TARGET, `放行应回目标 ID；实得 ${brief(captured?.targetId)}`);
    assert(route.calls.continue === 1, `一致 route.continue（出站放行）应恰一次；实得 ${route.calls.continue}`);
    assert(route.calls.abort === 0, `一致不得 abort；实得 ${route.calls.abort}`);
  });

  await test('w2', 'w2 出站 platformId 与 ref 不符（同名冒名者）→ route.continue 零调用（SUT 未改）、route.abort 中止（请求发出前拦）', async () => {
    const ref = mintRef();
    const page = mockPage();
    let captured = null;
    installOutboundMutationGuard(page, { atom: 'workflow.deleteByName', ref, onDecision: (d) => { captured = d; } });
    const route = mockRoute({ url: `{{baseUrl}}/ai-manager/process/delete?id=${IMPOSTOR}`, method: 'POST', postData: JSON.stringify({ id: IMPOSTOR }) });
    await page.registered[0].handler(route);
    assert(captured && captured.ok === false && captured.aborted === true, `不符必委派中止；实得 ${brief(captured)}`);
    assert(captured.mutated === false, `中止须证 SUT 未改（mutated:false）；实得 ${brief(captured?.mutated)}`);
    // 咬合核心：不符时出站通道零调用——「只看 response（先放行）」或「拆掉委派直接 continue」的接线会在此转红。
    assert(route.calls.continue === 0, `不符 route.continue（出站放行）必零调用；实得 ${route.calls.continue}`);
    assert(route.calls.abort === 1, `不符须 route.abort 中止（请求发出前拦）；实得 ${route.calls.abort}`);
    assert(route.calls.abortReason === 'blockedbyclient', `abort 原因应为 blockedbyclient；实得 ${brief(route.calls.abortReason)}`);
  });

  await test('w3', 'w3 出站无可验 platformId（url/body 均无 id）→ fail-closed 中止、route.continue 零调用、route.abort', async () => {
    const ref = mintRef();
    const page = mockPage();
    let captured = null;
    installOutboundMutationGuard(page, { atom: 'workflow.deleteByName', ref, onDecision: (d) => { captured = d; } });
    const route = mockRoute({ url: '{{baseUrl}}/ai-manager/process/delete', method: 'POST', postData: '{}' });
    await page.registered[0].handler(route);
    assert(captured && captured.ok === false && captured.aborted === true, `无可验 ID 应 fail-closed 中止；实得 ${brief(captured)}`);
    assert(route.calls.continue === 0, `无可验 ID route.continue 必零调用；实得 ${route.calls.continue}`);
    assert(route.calls.abort === 1, `无可验 ID 须 route.abort；实得 ${route.calls.abort}`);
  });

  await test('w4', 'w4 限 targeting：create/addNode/孤儿 removeToolByName 不装拦截器（installed:false、page.route 零注册）', () => {
    const ref = mintRef();
    for (const atom of ['workflow.create', 'workflow.addNode', 'workflow.setNodeField', 'agent.removeToolByName', 'nav.workflowManagement', 'totally.unknown']) {
      const page = mockPage();
      const res = installOutboundMutationGuard(page, { atom, ref });
      assert(res.installed === false, `${atom} 不得装拦截器（限 targeting、不全量翻）；实得 ${brief(res)}`);
      assert(page.registered.length === 0, `${atom} page.route 应零注册；实得 ${page.registered.length}`);
    }
    // 正控：三个破坏性/targeting 原子确实装拦截器（证非 always-false）。
    for (const atom of ['workflow.deleteByName', 'agent.delete', 'picker.selectFirstTool']) {
      const page = mockPage();
      const res = installOutboundMutationGuard(page, { atom, ref });
      assert(res.installed === true && page.registered.length === 1, `${atom} 须装拦截器；实得 ${brief(res)}`);
    }
  });

  await test('w5', 'w5 ref 缺 platformId → 不装拦截器（fail-closed，不回落）', () => {
    const page = mockPage();
    const res = installOutboundMutationGuard(page, { atom: 'workflow.deleteByName', ref: { name: NAME } });
    assert(res.installed === false, `ref 缺 platformId 应 fail-closed 不装；实得 ${brief(res)}`);
    assert(page.registered.length === 0, 'ref 缺 platformId 时 page.route 应零注册');
  });

  // ══ 接线 2（compile 铸 ref 适配器）：由观察铸 ref、补 profile 指纹/scope/请求关联/步序、platformId 非按名再生成 ══
  await test('w6', 'w6 mintDestructiveTargetContinuity 由观察铸深冻结 ref、platformId 恒取自观察（非按名再生成）；缺观察/缺 profile 指纹 fail-closed', () => {
    const observation = {
      platformId: TARGET, name: NAME, code: CODE, role: 'subject', atom: 'workflow.deleteByName',
      evidenceStepId: 'atstep_3', sourceIntentId: 'source_1', candidateId: 'candidate-target',
    };
    const minted = mintDestructiveTargetContinuity(observation, { profileFingerprint: FP, scope: 'process-list', requestCorrelationId: 'corr-1', stepOrder: 3 });
    assert(minted.ok === true, `忠实观察 + 完整 context 应铸成功；实得 ${brief(minted)}`);
    assert(minted.ref.platformId === TARGET, `ref.platformId 恒取自观察（非按名再生成）；实得 ${brief(minted.ref.platformId)}`);
    assert(Object.isFrozen(minted.ref), 'ref 须深冻结（不可覆盖）');
    assert(minted.ref.profileFingerprint === FP && minted.ref.scope === 'process-list'
      && minted.ref.requestCorrelationId === 'corr-1' && minted.ref.stepOrder === 3, `context 应补齐 profile 指纹/scope/请求关联/步序；实得 ${brief(minted.ref)}`);
    // 缺观察 → fail-closed。
    assert(mintDestructiveTargetContinuity(null, { profileFingerprint: FP, scope: 'x', requestCorrelationId: 'y', stepOrder: 0 }).ok === false, '缺观察应 fail-closed');
    // 缺 context 必填（profileFingerprint 缺）→ fail-closed（不武装半成品 ref）。
    assert(mintDestructiveTargetContinuity(observation, { scope: 'x', requestCorrelationId: 'y', stepOrder: 0 }).ok === false, '缺 profileFingerprint 应 fail-closed');
  });

  // ══ 接线 3（归零收尾适配器）：present platformIds 来自 rows.id、按 target-ID 稳定窗口 absence-proof（非 name count===0）══
  await test('w7', 'w7 evaluateDestructiveTargetAbsence 消费 rows.id 作 present platformIds：缺席+稳定 proven、在场 proven:false、无 rows(name-count-only) proven:false、不稳定 proven:false', () => {
    const ref = mintRef();
    const r1 = evaluateDestructiveTargetAbsence({ ref, identityRows: [{ id: IMPOSTOR, code: 'x', name: 'y' }, { id: '5555555555555555555' }], stable: true });
    assert(r1.proven === true && r1.mode === 'target-id-absence' && r1.targetId === TARGET, `目标缺席+稳定应 proven:true 按 target-ID；实得 ${brief(r1)}`);
    const r2 = evaluateDestructiveTargetAbsence({ ref, identityRows: [{ id: TARGET, code: CODE, name: NAME }], stable: true });
    assert(r2.proven === false, `目标仍在 rows 应 proven:false；实得 ${brief(r2)}`);
    const r3 = evaluateDestructiveTargetAbsence({ ref, identityRows: null, stable: true });
    assert(r3.proven === false, `无 present platformIds（name-count-only 语义）不得判归零（proven:false）；实得 ${brief(r3)}`);
    const r4 = evaluateDestructiveTargetAbsence({ ref, identityRows: [{ id: IMPOSTOR }], stable: false });
    assert(r4.proven === false, `窗口不稳定应 proven:false；实得 ${brief(r4)}`);
  });

  // ══ 静态源码接线断言：三处生产路径确实 import 并调用适配器（拆接线即转红——对抗自证咬合）══
  await test('static', 'static bin/replay.mjs 接出站拦截安装器 + 归零 absence 适配器（import 自 wiring 模块 + 调用面）', () => {
    const src = readFileSync(resolve(HERE, '..', '..', 'bin', 'replay.mjs'), 'utf8');
    assert(src.includes('entity-destructive-continuity-wiring'), 'replay 未 import wiring 模块');
    assert(src.includes('installOutboundMutationGuard('), 'replay 未调用出站拦截安装器');
    assert(src.includes('evaluateDestructiveTargetAbsence('), 'replay 未调用归零 absence 适配器');
    assert(src.includes('requiresTargetContinuityRef('), 'replay 未按 targeting 判据门控拦截安装');
  });
  await test('static', 'static lib/compile-atoms.mjs 破坏性编译处 import 并调用铸 ref 适配器（咬两处调用面，非仅 helper 定义）', () => {
    const src = readFileSync(resolve(HERE, '..', '..', 'lib', 'compile-atoms.mjs'), 'utf8');
    assert(src.includes('entity-destructive-continuity-wiring'), 'compile-atoms 未 import wiring 模块');
    assert(src.includes('mintDestructiveTargetContinuity(observation'), 'compile-atoms 未在武装 helper 里消费铸 ref 适配器');
    // 咬两处破坏性编译调用面（workflow.deleteByName 直编 + agent.delete/picker.selectFirstTool 经 recipe），
    // 非仅 helper 定义——拆任一调用面即转红（对抗自证）。
    assert(src.includes("armDestructiveTargetContinuity(run, 'workflow.deleteByName'"), 'compile-atoms workflow.deleteByName 编译处未调用武装');
    assert(src.includes('armDestructiveTargetContinuity(run, atom,'), 'compile-atoms recipe（agent.delete/picker.selectFirstTool）编译处未调用武装');
  });
  await test('static', 'static lib/entity-semantic-lock-preflight.mjs 接连续性 ref 判据（行为式 import：导出面消失即断链转红）', async () => {
    const src = readFileSync(resolve(HERE, '..', '..', 'lib', 'entity-semantic-lock-preflight.mjs'), 'utf8');
    assert(src.includes('entity-destructive-continuity'), 'preflight 未 import 纯守卫');
    // 行为式咬合（非 substring 前缀弱匹配）：真 import preflight 的导出判据，断言其委派纯守卫——
    // 导出改名/删除即 named import 断链、本断言转红（对抗自证咬合），非仅源码含名。
    const preflight = await import('../../lib/entity-semantic-lock-preflight.mjs');
    assert(typeof preflight.requiresTargetContinuityRef === 'function', 'preflight 未导出连续性 ref 判据（requiresTargetContinuityRef）');
    for (const atom of ['workflow.deleteByName', 'agent.delete', 'picker.selectFirstTool']) {
      assert(preflight.requiresTargetContinuityRef(atom) === true, `preflight 判据未对 targeting 原子 ${atom} 索要连续性 ref`);
    }
    for (const atom of ['workflow.create', 'workflow.addNode', 'agent.removeToolByName', 'totally.unknown']) {
      assert(preflight.requiresTargetContinuityRef(atom) === false, `preflight 判据误对非 targeting 原子 ${atom} 索要连续性 ref`);
    }
  });
  await test('static', 'static lib/entity-destructive-continuity-wiring.mjs 委派纯守卫（runGuardedMutation + requiresTargetContinuityRef + mint + evaluateTargetAbsence）', () => {
    const src = readFileSync(resolve(HERE, '..', '..', 'lib', 'entity-destructive-continuity-wiring.mjs'), 'utf8');
    for (const token of ['runGuardedMutation', 'requiresTargetContinuityRef', 'mintTargetContinuityObservation', 'evaluateTargetAbsence']) {
      assert(src.includes(token), `wiring 模块未委派纯守卫 ${token}`);
    }
  });
};

await runAll();

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-destructive-continuity-guard-wiring: ${failure}`);
  console.error(`RED  entity-destructive-continuity-guard-wiring/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-destructive-continuity-guard-wiring/${SECTION}: ${passed}/${passed} 全过（接线级 mock page/route + 静态接线断言，零 SUT；C 束目标连续性接线咬合）`);

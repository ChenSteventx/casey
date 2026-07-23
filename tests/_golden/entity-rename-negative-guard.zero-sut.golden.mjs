#!/usr/bin/env node
// entity-rename-negative-guard（C4）—— 负护栏金牌（negative guard），纯 node、zero-SUT。
// 禁止 SUT、浏览器、server 与网络。只走编译/回放的纯逻辑面 + 真实 verdict 引擎子进程。
//
// 需求要求「改名不能静默更新旧身份，必须签 successor」。签 successor 端到端要唤醒被有意封死的形式
// 收据链（子系统 A，entity-semantic-lock-v2.mjs，sha b7b5a47e），本轮做不到（GRILL D1）。C4 做负护栏：
// 系统在还不能安全处理改名时，必须明确、前置地拒绝改名——绝不半路执行、绝不误判 PASS。
//
// rename 是虚构前瞻原子（workflow.rename），COMPILE_ATOM_COMPILERS 无 rename 编译器（本轮不加真/假编译器）。
// 本金牌钉三条负能力：
//   ①（前置拒绝，具名码）rename 原子在【第一次浏览器副作用之前】被拒——编译面与回放面双证；
//   ②（绝不产 PASS）该拒绝轴喂真实 verdict 引擎（bin/verdict.mjs，零 LLM）终判非 PASS，且带满足的硬断言也非 PASS；
//   ③（fail-closed 在动作执行前）用毒代理 page 证：拒绝在任何 page 方法被触碰之前发生，零浏览器副作用。
//
// 红/绿判据（实现者先探再定，GRILL D4）：探得——编译面对未知原子早抛「暂无编译知识」（进任何 emit 之前，
// 前置拒绝已存在，特征化锁）；回放面 performAction 按 ev.action 派发、无 ev.atom 白名单，手造 rename 事件
// 会落到通用 resolveCandidate+gateAndAct 通路执行 loc.click()——在第一次浏览器副作用之后才可能失败，且唯一
// 命中会吐 resolution:'unique'（PASS 合格）。故回放面 = 无前置拒绝 → 金牌红先行。
// 最小前置 guard（转绿）：不改 performAction（既有金牌逐字节钉其对全谱事件的动作轴），而在生产回放唯一分发口
// 新增前置闸——lib/replay-actions.mjs 的 dispatchReplayAction 先过纯判据 unknownAtomRejection（复用 isCompilableAtom
// 单一事实源），命中即在触碰 page 之前具名拒、绝不委派 performAction；bin/replay.mjs 事件环由 performAction 改经
// dispatchReplayAction。判据只针对 string 原子，对全体合法原子恒放行（零 false positive、零生产行为差）。

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileFlow, isCompilableAtom } from '../../lib/compile-atoms.mjs';
import { dispatchReplayAction, unknownAtomRejection } from '../../lib/replay-actions.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const VERDICT_CLI = join(REPO_ROOT, 'bin', 'verdict.mjs');
const RENAME_ATOM = 'workflow.rename';

// ── 毒代理 page：任一属性访问即记账并抛，用于证「浏览器副作用之前」──
// 任何 page.getByText/getByRole/locator... 的属性读取都会翻 touched 并抛；据此判断拒绝是否发生在触碰 page 之前。
function makePoisonPage(label) {
  const state = { touched: null };
  const proxy = new Proxy(function poison() {}, {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined; // 避免 JS 内部探测（Symbol.toPrimitive 等）误记账
      if (prop === 'then') return undefined; // 防被误当 thenable
      state.touched = `${label}.${String(prop)}`;
      throw new Error(`POISON_TOUCHED:${label}.${String(prop)}`);
    },
    apply() {
      state.touched = `${label}()`;
      throw new Error(`POISON_CALL:${label}`);
    },
  });
  return { proxy, state };
}

// 一个「看起来合法、能唯一命中」的 rename 点击事件（手造/被篡改 artifact 的最小复现）：
// 语义定位为 text-exact，若无前置 guard，回放会对它执行通用 click（浏览器副作用）并可能吐 unique。
function renameClickEvent() {
  return {
    stepId: 'atstep_0',
    intentId: 'intent_0',
    atom: RENAME_ATOM,
    action: 'click',
    semantic: { kind: 'text', name: '审批工作流', exact: true },
    text: '审批工作流',
  };
}

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 跑真实 verdict 引擎（零 LLM）：把一步 axes 写盘、子进程裁定、读回结果。纯 node，无浏览器/网络。
function runVerdict(step) {
  const dir = mkdtempSync(join(tmpdir(), 'casey-rename-guard-verdict-'));
  const axesPath = join(dir, 'axes.json');
  const outPath = join(dir, 'verdict.json');
  writeFileSync(axesPath, JSON.stringify({ caseId: 'tc_rename_negative_guard', steps: [step] }));
  const proc = spawnSync(process.execPath, [VERDICT_CLI, '--axes', axesPath, '--out', outPath], { encoding: 'utf8' });
  if (proc.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`verdict 子进程非零退出 status=${proc.status} stderr=${(proc.stderr || '').slice(0, 200)}`);
  }
  const out = JSON.parse(readFileSync(outPath, 'utf8'));
  rmSync(dir, { recursive: true, force: true });
  return out;
}

// ===== 断言 ① 之 A：编译面前置拒绝（特征化锁——现状已前置拒，非红先行）=====
// isCompilableAtom 是编译知识允许集单一事实源；rename 不在集内。
check('①A rename 不在编译知识允许集（isCompilableAtom=false，具名拒绝口径源头）', () => {
  assert(isCompilableAtom(RENAME_ATOM) === false, `isCompilableAtom('${RENAME_ATOM}') 竟为 true——允许集漏进了 rename`);
  // 反向控制：既有真原子必须仍在集内，证 guard 判据没有把合法原子一并误拒。
  assert(isCompilableAtom('workflow.create') === true, 'workflow.create 竟被判不可编译——允许集误伤合法原子');
  assert(isCompilableAtom('login') === true, 'login 竟被判不可编译');
  assert(isCompilableAtom('assert.textVisible') === true, 'assert.* 竟被判不可编译');
});

await checkAsync('①A 编译面：rename 步在进入任何 emit/浏览器副作用之前被拒（暂无编译知识），零 event 产出、page 零触碰', async () => {
  const poison = makePoisonPage('compilePage');
  const run = { events: [], page: poison.proxy };
  let threw = null;
  try {
    await compileFlow(run, { steps: [{ atom: RENAME_ATOM, params: {} }] });
  } catch (error) {
    threw = error;
  }
  assert(threw !== null, '编译面对 rename 未抛前置拒绝（应 throw 暂无编译知识）');
  assert(/暂无编译知识/.test(threw.message), `编译面拒绝原因非「暂无编译知识」具名口径：${threw.message}`);
  assert(poison.state.touched === null, `编译面在浏览器副作用之前未拒——page 被触碰（${poison.state.touched}）`);
  assert(run.events.length === 0, `编译面对 rename 竟产了 event（应零副作用零产出），events=${run.events.length}`);
});

// ===== 断言 ①之B + ③：回放面前置拒绝、fail-closed 在动作之前（红先行——需最小 guard）=====
// 生产回放唯一分发口 = dispatchReplayAction（bin/replay.mjs 事件环经此）。用毒代理 page 证：rename 在触碰 page
// 之前具名拒、绝不委派 performAction 执行任何浏览器动作。
await checkAsync('①B/③ 回放面：dispatchReplayAction 对 rename 事件在触碰 page 之前具名拒绝，绝不执行任何浏览器动作', async () => {
  const poison = makePoisonPage('replayPage');
  const ev = renameClickEvent();
  let threw = null;
  let axis = null;
  try {
    axis = await dispatchReplayAction(poison.proxy, ev, {});
  } catch (error) {
    threw = error;
  }
  // fail-closed 在动作之前：page 一次都不许被碰（无 guard 时会委派 performAction→resolveCandidate→getByText 触碰毒代理）。
  assert(poison.state.touched === null, `回放面在浏览器副作用之前未拒——page 被触碰（${poison.state.touched}）；rename 落到了通用动作通路`);
  assert(threw === null, `回放面对 rename 抛异常而非具名拒绝轴：${threw && threw.message}`);
  assert(axis && typeof axis === 'object', '回放面对 rename 未返回拒绝轴');
  // 具名拒绝码。
  assert(axis.rejectReason === 'UNKNOWN_ATOM', `回放面拒绝码非 UNKNOWN_ATOM：${JSON.stringify(axis)}`);
  assert(axis.unknownAtom === RENAME_ATOM, `回放面未点名被拒原子：${JSON.stringify(axis)}`);
  // 绝不吐 unique（unique 是 verdict 通往 PASS 的唯一 actionPerformed=true 之一）。
  assert(axis.resolution !== 'unique', `回放面 rename 拒绝竟吐 resolution:unique（PASS 合格轴）：${JSON.stringify(axis)}`);
  assert(!(axis.identityReadback && axis.identityReadback.ok === true), `回放面 rename 拒绝竟带 identityReadback.ok=true：${JSON.stringify(axis)}`);
});

// ===== 负护栏边界（零 false positive）：纯判据对全体合法原子恒放行；分发口对合法原子确会委派 performAction =====
// 证 guard 不误伤——否则会静默拦停合法回放（比漏拦更隐蔽的坏）。unknownAtomRejection 是 page-free 纯函数。
check('边界A unknownAtomRejection 对全体合法原子恒返 null（零 false positive、零生产行为差）', () => {
  // 覆盖：走通用动作通路的真原子（save/publish/create）、走专有分支的真原子（searchOpen/bindAgent）、nav、断言、登录。
  const legit = [
    { atom: 'workflow.save', action: 'click' },
    { atom: 'workflow.publish', action: 'click' },
    { atom: 'workflow.create', action: 'click' },
    { atom: 'agent.searchOpen', action: 'click' },
    { atom: 'workflow.bindAgent', action: 'click' },
    { atom: 'nav.agentManagement', action: 'nav' },
    { atom: 'assert.textVisible', action: 'assert' },
    { atom: 'login', action: 'none' },
  ];
  for (const ev of legit) {
    assert(unknownAtomRejection(ev) === null, `合法原子「${ev.atom}」被负护栏误拒：${JSON.stringify(unknownAtomRejection(ev))}`);
  }
  // 缺省/非 string 原子沿旧路（不扩责任面）：判据放行、交下游既有逻辑。
  assert(unknownAtomRejection({ action: 'click' }) === null, '缺 atom 事件被判据拦（应沿旧路放行）');
  assert(unknownAtomRejection({ atom: 123, action: 'click' }) === null, '非 string atom 被判据拦（应沿旧路放行）');
  // 而 rename/未知原子必被拦（判据正向）。
  const r = unknownAtomRejection({ atom: RENAME_ATOM, action: 'click' });
  assert(r && r.rejectReason === 'UNKNOWN_ATOM', `rename 未被纯判据拦：${JSON.stringify(r)}`);
});

await checkAsync('边界B 分发口对合法原子确委派 performAction（不短路、会正常触碰 page）——证 guard 只短路未知原子', async () => {
  // 合法原子事件喂 dispatchReplayAction + 毒代理 page：必然委派到 performAction 并触碰 page（毒代理翻 touched）。
  // 若合法原子也被短路，touched 会保持 null——那才是误伤。
  const poison = makePoisonPage('legitPage');
  const legitEv = { stepId: 's', intentId: 'i', atom: 'workflow.publish', action: 'click', semantic: { kind: 'role', role: 'button', name: '发布', exact: true } };
  try { await dispatchReplayAction(poison.proxy, legitEv, {}); } catch { /* 毒代理必抛，仅取 touched */ }
  assert(poison.state.touched !== null, '合法原子竟被负护栏短路（未委派 performAction、未触碰 page）——误伤');
});

// ===== 断言 ②：该拒绝路径喂真实 verdict 引擎——绝不产 PASS（带满足的硬断言也不产）=====
await checkAsync('② rename 拒绝轴喂 bin/verdict.mjs：终判非 PASS（fail-safe），即便携满足的硬断言', async () => {
  const poison = makePoisonPage('replayPage2');
  const axis = await dispatchReplayAction(poison.proxy, renameClickEvent(), {});
  assert(axis && axis.resolution !== 'unique', '前置：回放面须先给出非 unique 拒绝轴（依赖 guard）');
  // 对抗：给一条【满足】的硬后置断言。若 rename 被当动作做成（ap=true），这一步就会 PASS——正是护栏要堵的。
  const step = {
    stepId: 'atstep_0',
    intentId: 'intent_0',
    atom: RENAME_ATOM,
    action: axis,
    postAssertions: [{ ok: true }],
  };
  const out = runVerdict(step);
  const v = out.steps[0];
  assert(v.verdict !== 'PASS', `rename 拒绝路径竟被 verdict 终判 PASS：${JSON.stringify(v)}`);
  // fail-safe：证不出别终判——ap=false 且无 SUT 背书 → NEEDS_HUMAN/INDETERMINATE。
  assert(v.verdict === 'NEEDS_HUMAN', `rename 拒绝路径 verdict 非 fail-safe NEEDS_HUMAN：${JSON.stringify(v)}`);
});

// 反向对照（非护栏断言，证 ② 非空洞）：同一步若 rename 竟以 resolution:'unique' 落轴（模拟 guard 缺席、
// rename 被当普通动作做成），配同一满足的硬断言，verdict 就会翻 PASS——这正是本护栏在动作面要堵死的窗口。
await checkAsync('②对照 若 rename 竟以 unique 落轴则 verdict 会 PASS（护栏正堵此窗，证②非空洞）', () => {
  const step = {
    stepId: 'atstep_0',
    intentId: 'intent_0',
    atom: RENAME_ATOM,
    action: { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } },
    postAssertions: [{ ok: true }],
  };
  const out = runVerdict(step);
  const v = out.steps[0];
  assert(v.verdict === 'PASS', `对照失败：unique+硬断言满足竟非 PASS（verdict 语义变了，需复核）：${JSON.stringify(v)}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-rename-negative-guard: ${failure}`);
  console.error(`RED  entity-rename-negative-guard: ${passed} 过 / ${failures.length} 红（负护栏未闭合）`);
  process.exit(1);
}
console.log(`ok   entity-rename-negative-guard: ${passed}/${passed} 全过（负护栏闭合：rename 编译面+回放面双前置拒、绝不产 PASS、fail-closed 在动作之前）`);

#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）round-2 收口金牌：codex round-1 findings 的接线级/纯函数级封口。
// 纯 node：纯内存 + 合成 mock page/route + 真 bin/verdict.mjs 子进程 + 静态源码接线断言（零浏览器/零 SUT/零 fake-SUT）。
// 断言纪律：退出码 + deepEqual/具名 reason；判绿只信退出码（MEMORY 铁律）。改本文件=Test Ratchet 判红。
//
// 覆盖：
//   A. admitDestructiveTargetContinuity（Critical-1 ③ 决策纯函数）：破坏性原子无已认证 ref → 拒；有 ref → 放；
//      无破坏性原子 → 放；缺 intent → 拒；非破坏性原子不误拦。退化 always-放行/always-拒 逐条逮红。
//   B. selectObservationForDestructiveTarget（High-2 编译侧同名不取 first）：唯一命中 → 取；同名多条 → 弃（不取 first）；无命中 → 弃。
//   C. High-1：installOutboundMutationGuard 返回 ready（await page.route 的 Promise）+ unroute（生命周期解除器）。
//   D. High-4：守卫主动中止落 guardAborts 诊断通道、绝不进 pageerror→SUT_DEFECT 通道（真 verdict 子进程证无 pageerror 背书=NEEDS_HUMAN 非 SUT_DEFECT）。
//   E. 静态接线：bin/replay.mjs 在浏览器前调 admitDestructiveTargetContinuity 且拒即 exit 65；compile-atoms 按 under + 唯一观察。

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
  admitDestructiveTargetContinuity, selectObservationForDestructiveTarget,
} from '../../lib/entity-destructive-continuity.mjs';
import { installOutboundMutationGuard } from '../../lib/entity-destructive-continuity-wiring.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const failures = [];
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${String(e?.message || e)}`); console.error(`FAIL ${name}: ${String(e?.message || e)}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

const DEL = { stepId: 'atstep_4', intentId: 'intent_del', atom: 'agent.delete', action: 'click' };
const SEARCH = { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click' };

await test('A1 破坏性原子 + 空 resolvedRefIntents（route:human 采集前恒空）→ 拒（具名 NO_SIGNED_CONTINUITY_REF、点名 atom/intent）', () => {
  const r = admitDestructiveTargetContinuity({ events: [SEARCH, DEL], resolvedRefIntents: new Set() });
  assert(r.ok === false && r.reason === 'DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF', `应拒且具名；实得 ${brief(r)}`);
  assert(r.atom === 'agent.delete' && r.intentId === 'intent_del', `拒因应点名破坏性原子/意图；实得 ${brief(r)}`);
});
await test('A2 破坏性原子意图【有】已认证 ref → 放行（证非 always-拒；proceed 路径真存在，route:human 采集补齐后即放）', () => {
  const r = admitDestructiveTargetContinuity({ events: [SEARCH, DEL], resolvedRefIntents: new Set(['intent_del']) });
  assert(r.ok === true, `破坏意图有 ref 应放行；实得 ${brief(r)}`);
});
await test('A3 无破坏性原子（仅 searchOpen/nav）→ 放行（证非「身份锁在力就一律拒」的退化）', () => {
  const r = admitDestructiveTargetContinuity({ events: [SEARCH, { stepId: 's', intentId: 'i', atom: 'nav.workflowManagement', action: 'nav' }], resolvedRefIntents: new Set() });
  assert(r.ok === true, `无破坏性原子应放行；实得 ${brief(r)}`);
});
await test('A4 三 targeting 原子逐条被索要，孤儿 removeToolByName/create/addNode/setNodeField/unknown 不误索要', () => {
  for (const atom of ['workflow.deleteByName', 'agent.delete', 'picker.selectFirstTool']) {
    const r = admitDestructiveTargetContinuity({ events: [{ stepId: 's', intentId: 'i', atom, action: 'click' }], resolvedRefIntents: new Set() });
    assert(r.ok === false && r.atom === atom, `${atom} 应被索要连续性 ref（拒）；实得 ${brief(r)}`);
  }
  for (const atom of ['agent.removeToolByName', 'workflow.create', 'workflow.addNode', 'workflow.setNodeField', 'nav.workflowManagement', 'totally.unknown']) {
    const r = admitDestructiveTargetContinuity({ events: [{ stepId: 's', intentId: 'i', atom, action: 'click' }], resolvedRefIntents: new Set() });
    assert(r.ok === true, `${atom} 不得被索要（不全量翻、孤儿不误拒）；实得 ${brief(r)}`);
  }
});
await test('A5 破坏性原子缺 intentId → 拒（fail-closed，不静默放行）', () => {
  const r = admitDestructiveTargetContinuity({ events: [{ stepId: 's', atom: 'agent.delete', action: 'click' }], resolvedRefIntents: new Set() });
  assert(r.ok === false && r.reason === 'DESTRUCTIVE_ADMISSION_ATOM_MISSING_INTENT', `缺 intent 应拒；实得 ${brief(r)}`);
});
await test('A6 畸形入参 fail-closed（options/events 非法 → 拒，绝不臆断放行）', () => {
  assert(admitDestructiveTargetContinuity(null).ok === false, 'null 应拒');
  assert(admitDestructiveTargetContinuity({ events: 'x' }).ok === false, 'events 非数组应拒');
});

await test('B1 唯一命中带 platformId 的观察 → 取', () => {
  const obs = [{ name: 'a', platformId: '111' }, { name: 'atl_dup', platformId: '1234567890123456789' }];
  const r = selectObservationForDestructiveTarget({ observations: obs, targetName: 'atl_dup' });
  assert(r.ok === true && r.observation.platformId === '1234567890123456789', `唯一命中应取；实得 ${brief(r)}`);
});
await test('B2 同名多条（毒化面）→ 弃且具名 AMBIGUOUS（绝不取 first）', () => {
  const obs = [{ name: 'atl_dup', platformId: '111' }, { name: 'atl_dup', platformId: '999' }];
  const r = selectObservationForDestructiveTarget({ observations: obs, targetName: 'atl_dup' });
  assert(r.ok === false && r.reason === 'OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME', `同名多条应弃、不取 first；实得 ${brief(r)}`);
});
await test('B3 无命中 / 无 platformId → 弃（NO_MATCH）', () => {
  assert(selectObservationForDestructiveTarget({ observations: [{ name: 'x', platformId: '1' }], targetName: 'atl_dup' }).reason === 'OBSERVATION_SELECT_NO_MATCH', 'name 不匹配应弃');
  assert(selectObservationForDestructiveTarget({ observations: [{ name: 'atl_dup' }], targetName: 'atl_dup' }).reason === 'OBSERVATION_SELECT_NO_MATCH', '缺 platformId 应弃（不武装半成品）');
});

await test('C1 安装成功返回 ready（await page.route 的 Promise）与 unroute（生命周期解除器）', async () => {
  let routeAwaited = false;
  const routePromise = Promise.resolve().then(() => { routeAwaited = true; });
  let unrouted = null;
  const page = { route: () => routePromise, unroute: (p, h) => { unrouted = { p, h: typeof h }; } };
  const ref = { platformId: '1234567890123456789' };
  const res = installOutboundMutationGuard(page, { atom: 'agent.delete', ref, urlPattern: '**/delete*' });
  assert(res.installed === true, `应装；实得 ${brief(res)}`);
  assert(res.ready && typeof res.ready.then === 'function', `应返回 ready thenable（堵 handler 未注册即出站）；实得 ${brief(Object.keys(res))}`);
  await res.ready;
  assert(routeAwaited === true, 'await res.ready 应等到 page.route 的 Promise 落定');
  assert(typeof res.unroute === 'function', '应返回 unroute 解除器（生命周期收口）');
  res.unroute();
  assert(unrouted && unrouted.p === '**/delete*' && unrouted.h === 'function', `unroute 应委派 page.unroute(pattern, handler)；实得 ${brief(unrouted)}`);
});

// ── D. High-4：守卫主动中止不得走 pageerror→SUT_DEFECT 通道（真 verdict 子进程）──────────
// 守卫中止落 guardAborts、绝不进 axes.forensics.lifecycle.pageerror。故对「动作做成但后置断言失败」的破坏步，
// 无 pageerror 背书时 verdict 必落 NEEDS_HUMAN（SUT_DEFECT_OR_STALE），绝不 SUT_DEFECT；有真 pageerror 才 SUT_DEFECT。
await test('D1 真 bin/verdict.mjs：无 pageerror 背书（守卫中止只落 guardAborts）→ NEEDS_HUMAN，非 SUT_DEFECT', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'c3-verdict-'));
  const step = (pageerror) => ({
    stepId: 'atstep_4', intentId: 'intent_del', atom: 'agent.delete',
    action: { resolution: 'unique', identityReadback: { ok: true } },
    postAssertions: [{ kind: 'textHidden', value: 'atl_dup', ok: false, soft: false }],
    forensics: { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror } },
  });
  const runVerdict = (pageerror) => {
    const axesPath = join(tmp, `axes-${pageerror.length}.json`);
    const outPath = join(tmp, `verdict-${pageerror.length}.json`);
    writeFileSync(axesPath, JSON.stringify({ caseId: 'tc', steps: [step(pageerror)] }));
    const r = spawnSync(process.execPath, [VERDICT, '--axes', axesPath, '--out', outPath], { encoding: 'utf8' });
    assert(r.status === 0, `verdict 应 exit 0；实得 ${r.status}：${(r.stderr || '').slice(-200)}`);
    return JSON.parse(readFileSync(outPath, 'utf8')).steps[0];
  };
  const guardAbortLike = runVerdict([]); // 守卫中止：axes 无 pageerror
  assert(guardAbortLike.verdict === 'NEEDS_HUMAN' && guardAbortLike.reason === 'SUT_DEFECT_OR_STALE',
    `守卫中止（无 pageerror）应 NEEDS_HUMAN/SUT_DEFECT_OR_STALE，绝不 SUT_DEFECT；实得 ${brief(guardAbortLike)}`);
  const realPageerror = runVerdict([{ attributedStepId: 'atstep_4', message: 'real-sut-error' }]); // 正控：真 pageerror
  assert(realPageerror.verdict === 'SUT_DEFECT', `真 pageerror 归因本步才 SUT_DEFECT（正控）；实得 ${brief(realPageerror)}`);
});
await test('D2 静态：bin/replay.mjs 的破坏守卫 onDecision 落 guardAborts（非 pageErrors），guardAborts 不进 projectReplayAxes', () => {
  const src = readFileSync(resolve(ROOT, 'bin', 'replay.mjs'), 'utf8');
  const anchor = src.indexOf('onDecision: (decision) => {');
  assert(anchor > 0, 'replay 未见破坏守卫 onDecision 回调');
  const onDec = src.slice(anchor, anchor + 300);
  assert(onDec.includes('guardAborts.push'), 'onDecision 应落 guardAborts（HARNESS 诊断通道）');
  assert(!onDec.includes('pageErrors.push'), 'onDecision 绝不得 pageErrors.push（否则被 verdict 当 SUT 背书误报 SUT_DEFECT）');
  const axesAnchor = src.indexOf('projectReplayAxes({');
  const axesCall = src.slice(axesAnchor, axesAnchor + 400);
  assert(!axesCall.includes('guardAborts'), 'guardAborts 绝不得进 projectReplayAxes（不进 axes/裁定）');
});

await test('E1 静态：bin/replay.mjs import 并在浏览器前调 admitDestructiveTargetContinuity，拒即 process.exit(65)', () => {
  const src = readFileSync(resolve(ROOT, 'bin', 'replay.mjs'), 'utf8');
  assert(src.includes('import { admitDestructiveTargetContinuity }'), 'replay 未 import 破坏性连续性准入纯函数');
  const callIdx = src.indexOf('admitDestructiveTargetContinuity({');
  const launchIdx = src.indexOf('chromium.launch');
  assert(callIdx > 0 && launchIdx > 0 && callIdx < launchIdx, '准入调用须在 chromium.launch 之前（浏览器前 fail-closed）');
  assert(src.slice(callIdx, callIdx + 420).includes('process.exit(65)'), '准入拒须 exit 65（fail-closed，不启浏览器）');
});
await test('E2 静态：compile-atoms 破坏性 ref 武装按 params.under（picker 真参数）+ selectObservationForDestructiveTarget（唯一、非 find-first）', () => {
  const src = readFileSync(resolve(ROOT, 'lib', 'compile-atoms.mjs'), 'utf8');
  assert(src.includes('params.under'), 'compile-atoms 未取 picker.selectFirstTool 真参数 under（High-2）');
  assert(src.includes('selectObservationForDestructiveTarget('), 'compile-atoms 未按唯一观察选取（High-2：同名不取 first）');
  assert(!/identityObservations\s*\|\|\s*\[\]\)\.find\(/.test(src) && !/identityObservations\)\.find\(/.test(src), 'compile-atoms 仍按 name find 取第一条 observation（High-2 未闭）');
});

if (failures.length) {
  for (const f of failures) console.error(`RED  entity-destructive-continuity-guard-round2: ${f}`);
  console.error(`RED  entity-destructive-continuity-guard-round2: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-destructive-continuity-guard-round2: ${passed}/${passed} 全过（Critical-1 ③/High-1/High-2/High-4 接线级+纯函数级封口，零 SUT）`);

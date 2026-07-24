#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）round-4 收口金牌：codex round-3 re-review 残留 finding 的【真生产码路径】封口。
// 纯 node：直驱真生产纯函数（lib/entity-destructive-continuity.mjs / -wiring.mjs）+ spawn 真 bin/verdict.mjs 子进程
//   + 静态源码接线断言。零浏览器/零 SUT/零 fake-SUT/零子代理。判绿只信退出码（MEMORY 铁律）。改本文件=Test Ratchet 判红。
//
// ── 咬什么（round-3 re-review 残留封口）────────────────────────────────────────────────
//   H3 [High abort 按 step 全吞非因果]：partitionGuardAbortPageErrors 改逐 pageerror 因果排除——同一步混合探针
//       （guard abort 的 net-marker pageerror + 独立真 SUT pageerror）→ 真 pageerror KEPT（仍背书 SUT_DEFECT）、
//       只 guard 那条 excluded。旧「按 step 全吞」实现此处 kept=0（吞真缺陷）→ 本断言即先红后绿判据。
//       并 spawn 真 verdict：kept 的真 SUT pageerror 仍 → SUT_DEFECT；被排除后（kept 空）→ NEEDS_HUMAN。
//       url-precise：guardAborts 携 abortedRequestUrl 时按 url 精确锚排除（route:human 真机采集补齐的精确信号）。
//   H4 [High mutation pattern **/*]：installOutboundMutationGuard 加 requirePattern——生产 replay 传 requirePattern:true，
//       缺精确 urlPattern 即 fail-CLOSED 不装（reason MUTATION_URL_PATTERN_REQUIRED、page.route 零注册），不兜 **/*；
//       replay 据 installed:false 拒裸执行破坏动作（guardInstallFailed）。未传 requirePattern 的既有适配器契约保留 **/*
//       兜底（不破人签冻结 wiring 金牌 w1-w5）。
//   M  [Medium guardTeardown 不在 finally]：破坏步 unroute 移进 finally——安装到收尾间任何异常也解除拦截器。静态咬
//       finally 结构（此前在收尾直线上、异常跳过=真 Medium）。
//
// route:human（本轮 hermetic 关不掉，诚实挂账，不在本金牌冒充已闭）：
//   · Critical 编译期破坏面：compile 真执行破坏动作前的连续性守卫本质需真浏览器出站拦截 + 真机 live 观察，且 pre-launch
//     硬门会误破既有合法 channel-less 自建唯一名删除编译（p3-compile 实证 profile 无身份通道却带授权编 workflow.deleteByName）
//     → 见 domainJudgments，走人。
//   · High-2 真破坏原子集：requiresTargetContinuityRef 集被 3 处人签冻结金牌钉死（zero-sut v7/v6a、wiring w4、round3 R2a）；
//     removeToolByName 入集 / selectFirstTool 移除 / confirmToolPicker 真机 agent platformId 取目标 = ADR-0004 重签事件，走人。
//   · abort 应用把 net-abort 包成无标记自定义错误的逐请求 pageerror↔request 精确归因需真浏览器 request handle。

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { partitionGuardAbortPageErrors } from '../../lib/entity-destructive-continuity.mjs';
import { installOutboundMutationGuard } from '../../lib/entity-destructive-continuity-wiring.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const WIRING = join(ROOT, 'lib', 'entity-destructive-continuity-wiring.mjs');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const PLATFORM_ID = '1234567890123456789';

const failures = [];
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${String(e?.message || e)}`); console.error(`FAIL ${name}: ${String(e?.message || e)}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 260); } catch { return String(v); } };

// mock page/route（同 wiring 金牌，不起真浏览器）：只记 page.route 注册数。
function mockPage() {
  const registered = [];
  return { registered, route: (pattern, handler) => { registered.push({ pattern, handler }); return Promise.resolve(); }, unroute: () => {} };
}

// ══ H3 [abort 逐请求因果排除，非按 step 全吞]（真生产纯函数 partitionGuardAbortPageErrors）══
await test('H3a 同一步混合探针：guard abort net-marker pageerror excluded、独立真 SUT pageerror KEPT（旧按 step 全吞此处 kept=0=吞真缺陷）', () => {
  const pageErrors = [
    { attributedStepId: 'del_a', message: 'net::ERR_ABORTED at /ai-manager/process/delete (guard abort side-effect)' },
    { attributedStepId: 'del_a', message: 'TypeError: Cannot read properties of undefined (reading render) — real SUT crash' },
  ];
  const guardAborts = [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'GUARDED_MUTATION_OUTBOUND_ID_MISMATCH' }];
  const { kept, excluded } = partitionGuardAbortPageErrors({ pageErrors, guardAborts });
  // 核心先红后绿：真 SUT pageerror 与 guard abort 同步，旧逐步全吞会连坐它（kept=0）；新逐请求因果只排除 net-marker 那条。
  assert(kept.length === 1 && /real SUT crash/.test(kept[0].message),
    `同一步真 SUT pageerror 须 KEPT（不吞真缺陷）；实得 kept=${brief(kept)}`);
  assert(excluded.length === 1 && /ERR_ABORTED/.test(excluded[0].message),
    `只 guard abort 的 net-marker pageerror excluded；实得 excluded=${brief(excluded)}`);
});
await test('H3b url-precise：guardAborts 携 abortedRequestUrl → message 含该 url 的 pageerror excluded、他因 pageerror KEPT', () => {
  const url = 'http://sut.example/ai-manager/process/delete?id=9';
  const pageErrors = [
    { attributedStepId: 'del_a', message: `Failed to load resource ${url}` }, // 无 net-marker，但携中止 url → 精确排除
    { attributedStepId: 'del_a', message: 'ReferenceError: foo is not defined (真 SUT)' },
  ];
  const guardAborts = [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'GUARDED_MUTATION_OUTBOUND_ID_MISMATCH', abortedRequestUrl: url }];
  const { kept, excluded } = partitionGuardAbortPageErrors({ pageErrors, guardAborts });
  assert(excluded.length === 1 && excluded[0].message.includes(url), `携中止 url 的 pageerror 须按 url 精确排除；实得 ${brief(excluded)}`);
  assert(kept.length === 1 && /ReferenceError/.test(kept[0].message), `他因 pageerror 须 KEPT；实得 ${brief(kept)}`);
});
await test('H3c 因果精度证非 always-exclude / 非 always-keep：他步 pageerror 恒 KEPT；无 guardAborts 全 KEPT（零行为差）', () => {
  const pageErrors = [
    { attributedStepId: 'other_b', message: 'net::ERR_ABORTED' }, // 他步含 marker 但该步无 guard abort → KEPT
    { attributedStepId: 'del_a', message: 'net::ERR_ABORTED' },
  ];
  const g1 = partitionGuardAbortPageErrors({ pageErrors, guardAborts: [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'X' }] });
  assert(g1.kept.some((p) => p.attributedStepId === 'other_b') && g1.excluded.length === 1 && g1.excluded[0].attributedStepId === 'del_a',
    `他步 marker pageerror 须 KEPT（该步无 guard abort、不连坐）；实得 kept=${brief(g1.kept)} excluded=${brief(g1.excluded)}`);
  const g2 = partitionGuardAbortPageErrors({ pageErrors, guardAborts: [] });
  assert(g2.kept.length === 2 && g2.excluded.length === 0, `无 guard abort → 全 KEPT（hermetic 常态零行为差）；实得 ${brief(g2)}`);
});
await test('H3d 真 bin/verdict.mjs：排除后 KEPT 的真 SUT pageerror 仍 → SUT_DEFECT；仅 guard abort（kept 空）→ NEEDS_HUMAN', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'c3r4-verdict-'));
  const stepWith = (pageerror) => ({
    stepId: 'del_a', intentId: 'intent_del', atom: 'agent.delete',
    action: { resolution: 'unique', identityReadback: { ok: true } },
    postAssertions: [{ kind: 'textHidden', value: 'atl_dup', ok: false, soft: false }],
    forensics: { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror } },
  });
  const runVerdict = (pageerror, tag) => {
    const axesPath = join(tmp, `axes-${tag}.json`);
    const outPath = join(tmp, `verdict-${tag}.json`);
    writeFileSync(axesPath, JSON.stringify({ caseId: 'tc', steps: [stepWith(pageerror)] }));
    const r = spawnSync(process.execPath, [VERDICT, '--axes', axesPath, '--out', outPath], { encoding: 'utf8' });
    assert(r.status === 0, `verdict 应 exit 0；实得 ${r.status}：${(r.stderr || '').slice(-200)}`);
    return JSON.parse(readFileSync(outPath, 'utf8')).steps[0];
  };
  // 混合步 → partition → 真 SUT pageerror KEPT → 喂 verdict → SUT_DEFECT（真缺陷不被 guard abort 连坐吞掉）。
  const { kept } = partitionGuardAbortPageErrors({
    pageErrors: [
      { attributedStepId: 'del_a', message: 'net::ERR_BLOCKED_BY_CLIENT (guard abort)' },
      { attributedStepId: 'del_a', message: 'TypeError: real SUT defect' },
    ],
    guardAborts: [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'GUARDED_MUTATION_OUTBOUND_ID_MISMATCH' }],
  });
  const keptVerdict = runVerdict(kept, 'kept');
  assert(keptVerdict.verdict === 'SUT_DEFECT', `KEPT 的真 SUT pageerror 须仍背书 SUT_DEFECT；实得 ${brief(keptVerdict)}`);
  // 仅 guard abort（kept 空）→ 无 pageerror 背书 → NEEDS_HUMAN（工装中止不误报 SUT_DEFECT）。
  const { kept: onlyGuard } = partitionGuardAbortPageErrors({
    pageErrors: [{ attributedStepId: 'del_a', message: 'net::ERR_BLOCKED_BY_CLIENT (guard abort)' }],
    guardAborts: [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'GUARDED_MUTATION_OUTBOUND_ID_MISMATCH' }],
  });
  const guardVerdict = runVerdict(onlyGuard, 'guard');
  assert(guardVerdict.verdict === 'NEEDS_HUMAN' && guardVerdict.reason === 'SUT_DEFECT_OR_STALE',
    `仅 guard abort 步（kept 空）须 NEEDS_HUMAN/SUT_DEFECT_OR_STALE，绝不 SUT_DEFECT；实得 ${brief(guardVerdict)}`);
});

// ══ H4 [mutation pattern 不兜 **/*：requirePattern fail-closed]（真生产适配器 installOutboundMutationGuard）══
await test('H4a requirePattern:true + 缺 urlPattern → fail-CLOSED 不装（reason MUTATION_URL_PATTERN_REQUIRED、page.route 零注册）', () => {
  const page = mockPage();
  const res = installOutboundMutationGuard(page, { atom: 'agent.delete', ref: { platformId: PLATFORM_ID }, requirePattern: true });
  assert(res.installed === false && res.reason === 'MUTATION_URL_PATTERN_REQUIRED',
    `缺精确 pattern 须 fail-closed 不装、不兜 **/*；实得 ${brief(res)}`);
  assert(page.registered.length === 0, `fail-closed 时 page.route 须零注册；实得 ${page.registered.length}`);
});
await test('H4b requirePattern:true + 有精确 urlPattern → 装（证 requirePattern 非 always-refuse）', () => {
  const page = mockPage();
  const res = installOutboundMutationGuard(page, { atom: 'agent.delete', ref: { platformId: PLATFORM_ID }, urlPattern: '**/process/delete*', requirePattern: true });
  assert(res.installed === true && res.pattern === '**/process/delete*', `有精确 pattern 须装且用该 pattern；实得 ${brief(res)}`);
  assert(page.registered.length === 1 && page.registered[0].pattern === '**/process/delete*', `page.route 须以精确 pattern 注册；实得 ${brief(page.registered[0]?.pattern)}`);
});
await test('H4c 未传 requirePattern（既有适配器契约）→ 保留 **/* 兜底默认（不破人签冻结 wiring 金牌 w1-w5）', () => {
  const page = mockPage();
  const res = installOutboundMutationGuard(page, { atom: 'agent.delete', ref: { platformId: PLATFORM_ID } });
  assert(res.installed === true && res.pattern === '**/*', `未传 requirePattern 须保留 **/* 兜底（向后兼容）；实得 ${brief(res)}`);
});
await test('H4d 静态：生产 replay 装出站守卫传 requirePattern:true 且据 installed:false 拒裸执行破坏动作（guardInstallFailed）', () => {
  const src = readFileSync(REPLAY, 'utf8');
  assert(src.includes('requirePattern: true'), 'replay 未向 installOutboundMutationGuard 传 requirePattern:true（缺精确 pattern 会兜 **/*）');
  assert(/installed\.installed\s*===\s*false/.test(src) && src.includes('guardInstallFailed'),
    'replay 未据 installed:false fail-closed 拒裸执行破坏动作（guardInstallFailed）');
  // 静态咬：安装失败分支不 performAction（fail-closed 记 action_failed）。
  const idx = src.indexOf('guardInstallFailed = true');
  assert(idx > 0, 'replay 未在守卫装不上时置 guardInstallFailed');
  assert(/if\s*\(guardInstallFailed\)\s*\{[\s\S]{0,220}action_failed/.test(src),
    'replay 守卫装不上时未走 action_failed fail-closed 分支（不得裸执行破坏动作）');
});

// ══ M [guardTeardown 移进 finally]（静态结构咬 bin/replay.mjs）══
await test('M 静态：破坏步 unroute（await guardTeardown()）在 finally 块内——安装到收尾间异常也解除拦截器', () => {
  const src = readFileSync(REPLAY, 'utf8');
  const call = src.indexOf('await guardTeardown()');
  assert(call > 0, 'replay 未见 await guardTeardown() 调用面');
  // guardTeardown 调用前最近的块起必须是 finally（而非直线收尾）——咬调用点上文 240 字窗内含 `} finally {`。
  const before = src.slice(Math.max(0, call - 240), call);
  assert(/\}\s*finally\s*\{/.test(before),
    'await guardTeardown() 未落在 finally 块内（安装到收尾间异常会跳过 unroute → 拦截器持久残留=真 Medium）');
  // 正控：finally 前有 try（证是真 try/finally 结构、非裸 finally 词）。
  assert(/try\s*\{/.test(src.slice(Math.max(0, call - 3000), call)), 'guardTeardown 的 finally 上文未见配套 try');
});

if (failures.length) {
  for (const message of failures) console.error(`RED  entity-destructive-continuity-guard-round4: ${message}`);
  console.error(`RED  entity-destructive-continuity-guard-round4: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-destructive-continuity-guard-round4: ${passed}/${passed} 全过（round-3 re-review 残留封口：abort 逐请求因果排除 + mutation pattern 不兜 **/* + guardTeardown 移进 finally；真纯函数 + 真 verdict + 静态接线）`);

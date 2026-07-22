#!/usr/bin/env node
// agent-id-readback · resolveDualIdentity 判定表全分支金牌（zero-SUT，纯 node，禁 SUT/浏览器/网络）。
//
// 判据权威：docs/plans/agent-id-readback/plan.md §2（双证门判定表）+
// accept/interface-spec.md §2（resolveDualIdentity 签名冻结）。
// 门层口径：完整性（total/hasNext）语义由 ledger 层保证，门层收到的
// envelope.status !== 'ok' 一律 action_failed。
// 红先行：lib/agent-identity-gate.mjs 缺席时，所有检查逐条判红（红因=模块缺席，
// 不是测试自身崩溃），exit 1。
//
// 检查面（每条独立 check）：
//   G1a-G1d  完整性先决各失败支：envelope status invalid/conflict/unsettled/empty→action_failed；
//   G2       DOM failed→action_failed；
//   G3       完整集合命中 0→absent；
//   G4a-G4c  DOM ambiguous 或同名>1→ambiguous（先数同名再查码——sol 假唯一攻击）；
//   G5a-G5f  名唯一但 expected.code/dom.code/信封 code/signedPlatformId 任一不等→action_failed；
//            dom.code 缺席/空串同拒（codex R1-H1 修复钉：双锚缺一不放行）；
//   G6       三方全等→unique + matched 三元组 deepEqual；
//   G7a-G7b  signedPlatformId 缺席（编译首采）：不参与比对但其余判据照跑。

import { isDeepStrictEqual } from 'node:util';

const TAG = 'agent-id-gate';
let failures = 0;
let passes = 0;
const red = (label, detail) => { failures += 1; console.error(`RED  ${TAG}: ${label}: ${detail}`); };
const ok = (label) => { passes += 1; console.log(`ok   ${TAG}: ${label}`); };

// ---- 被测模块（红先行：现在不存在，动态 import 捕获缺席）----
const MODULE_REL = '../../lib/agent-identity-gate.mjs';
let resolveDualIdentity = null;
let absentReason = null;
try {
  const mod = await import(new URL(MODULE_REL, import.meta.url).href);
  if (typeof mod.resolveDualIdentity === 'function') {
    resolveDualIdentity = mod.resolveDualIdentity;
  } else {
    absentReason = '模块存在但未导出 resolveDualIdentity';
  }
} catch (e) {
  absentReason = e?.code === 'ERR_MODULE_NOT_FOUND'
    ? `模块缺席（${e.code}）——lib/agent-identity-gate.mjs 尚未实现，红先行`
    : `模块加载失败（${e?.code ?? e?.name}: ${e?.message}）`;
}

// ---- 夹具：全等基线（逐 check 单点变异）----
const rowAlice = Object.freeze({ id: '42', code: 'AG-001', name: 'Alice' });
const okEnvelope = (rows) => ({ status: 'ok', rows: rows.map((r) => ({ ...r })), total: rows.length });
const baseDom = () => ({ status: 'unique', name: 'Alice', code: 'AG-001' });
const signedExpected = () => ({
  openName: 'Alice',
  code: 'AG-001',
  signedPlatformId: '42',
  signedCode: 'AG-001',
  signedName: 'Alice',
});
// 编译首采期望（signedPlatformId 缺席）
const firstCaptureExpected = () => ({ openName: 'Alice', code: 'AG-001' });

class CheckFail extends Error {}
const must = (cond, detail) => { if (!cond) throw new CheckFail(detail); };
const mustResolution = (out, expected) => {
  must(out && out.resolution === expected,
    `期望 resolution '${expected}'，实得 ${JSON.stringify(out?.resolution)}（reason=${JSON.stringify(out?.reason)}）`);
};

const check = (label, fn) => {
  if (!resolveDualIdentity) { red(label, `${absentReason}；检查无法执行，判红`); return; }
  try {
    fn();
    ok(label);
  } catch (e) {
    if (e instanceof CheckFail) red(label, e.message);
    else red(label, `检查执行异常（非断言）：${e?.stack?.split('\n')[0] ?? e}`);
  }
};

// ---- G1 完整性先决各失败支（DOM/expected 全等也救不回来）----
for (const status of ['invalid', 'conflict', 'unsettled', 'empty']) {
  check(`G1-${status} envelope.status '${status}'→action_failed（完整性先决，禁点击）`, () => {
    const out = resolveDualIdentity({ dom: baseDom(), envelope: { status }, expected: signedExpected() });
    mustResolution(out, 'action_failed');
  });
}

// ---- G2 DOM failed → action_failed（信封完好也不放行）----
check("G2 dom.status 'failed'→action_failed", () => {
  const out = resolveDualIdentity({
    dom: { status: 'failed' },
    envelope: okEnvelope([rowAlice]),
    expected: signedExpected(),
  });
  mustResolution(out, 'action_failed');
});

// ---- G3 完整集合命中 0 → absent ----
check('G3 完整集合内名称命中 0→absent', () => {
  const out = resolveDualIdentity({
    dom: { status: 'absent' },
    envelope: okEnvelope([
      { id: '7', code: 'AG-007', name: 'Bob' },
      { id: '8', code: 'AG-008', name: 'Carol' },
    ]),
    expected: signedExpected(),
  });
  mustResolution(out, 'absent');
});

// ---- G4 ambiguous：DOM 多卡 或 完整集合同名>1（先数同名，再查码）----
check("G4a DOM ambiguous（多卡）→ambiguous", () => {
  const out = resolveDualIdentity({
    dom: { status: 'ambiguous' },
    envelope: okEnvelope([rowAlice]),
    expected: signedExpected(),
  });
  mustResolution(out, 'ambiguous');
});

check('G4b 完整集合内同名>1→ambiguous（即使 DOM 只见一卡）', () => {
  const out = resolveDualIdentity({
    dom: baseDom(),
    envelope: okEnvelope([
      rowAlice,
      { id: '99', code: 'AG-099', name: 'Alice' },
    ]),
    expected: signedExpected(),
  });
  mustResolution(out, 'ambiguous');
});

check('G4c sol 假唯一攻击：同名两行且其一码中，仍必须 ambiguous（禁先按名+码过滤成一条）', () => {
  // 期望码 AG-001 恰好命中其一——若实现先用 name+code 过滤，会伪造出唯一行判 unique
  const out = resolveDualIdentity({
    dom: baseDom(),
    envelope: okEnvelope([
      rowAlice, // name Alice, code AG-001（码中）
      { id: '2', code: 'AG-002', name: 'Alice' }, // 同名另一行
    ]),
    expected: signedExpected(),
  });
  mustResolution(out, 'ambiguous');
  must(out.resolution !== 'unique', '同名分身被码过滤洗成唯一（sol 攻击面失守）');
});

// ---- G5 名唯一但联合判据任一不等 → action_failed（四个比对方各一 check）----
// 用编译首采形态之外的最小期望（openName+code+signedPlatformId），隔离单一不等因子
const jointExpected = () => ({ openName: 'Alice', code: 'AG-001', signedPlatformId: '42' });

check('G5a expected.code 不等→action_failed', () => {
  const expected = { ...jointExpected(), code: 'AG-999' };
  const out = resolveDualIdentity({ dom: baseDom(), envelope: okEnvelope([rowAlice]), expected });
  mustResolution(out, 'action_failed');
});

check('G5b dom.code（DOM 副标题 code）不等→action_failed', () => {
  const dom = { status: 'unique', name: 'Alice', code: 'AG-777' };
  const out = resolveDualIdentity({ dom, envelope: okEnvelope([rowAlice]), expected: jointExpected() });
  mustResolution(out, 'action_failed');
});

check('G5c 信封 code 不等→action_failed', () => {
  const envelope = okEnvelope([{ id: '42', code: 'AG-555', name: 'Alice' }]);
  const out = resolveDualIdentity({ dom: baseDom(), envelope, expected: jointExpected() });
  mustResolution(out, 'action_failed');
});

check('G5d signedPlatformId 不等→action_failed（已签 id 是硬判据）', () => {
  const expected = { ...jointExpected(), signedPlatformId: '43' };
  const out = resolveDualIdentity({ dom: baseDom(), envelope: okEnvelope([rowAlice]), expected });
  mustResolution(out, 'action_failed');
});

check('G5e dom.code 缺席→action_failed（codex R1-H1 修复钉：物理卡片双锚缺一不放行，缺码不是豁免）', () => {
  const dom = { status: 'unique', name: 'Alice' }; // code 缺席——name 单锚不得洗成 unique
  const out = resolveDualIdentity({ dom, envelope: okEnvelope([rowAlice]), expected: jointExpected() });
  mustResolution(out, 'action_failed');
});

check('G5f dom.code 空串同缺席→action_failed（空证据不是证据）', () => {
  const dom = { status: 'unique', name: 'Alice', code: '' };
  const out = resolveDualIdentity({ dom, envelope: okEnvelope([rowAlice]), expected: jointExpected() });
  mustResolution(out, 'action_failed');
});

// ---- G6 三方全等 → unique + matched 三元组 ----
check('G6 DOM/信封/已签期望三方全等→unique，matched 三元组 deepEqual', () => {
  const out = resolveDualIdentity({
    dom: baseDom(),
    envelope: okEnvelope([rowAlice]),
    expected: signedExpected(),
  });
  mustResolution(out, 'unique');
  const wanted = { name: 'Alice', code: 'AG-001', platformId: '42' };
  must(isDeepStrictEqual(out.matched, wanted),
    `matched 三元组不等：实得 ${JSON.stringify(out.matched)} ≠ 期望 ${JSON.stringify(wanted)}`);
});

// ---- G7 signedPlatformId 缺席（编译首采）：不参与比对，其余判据照跑 ----
check('G7a 编译首采（无已签三元）三方其余全等→unique，matched 取信封 platformId', () => {
  const out = resolveDualIdentity({
    dom: baseDom(),
    envelope: okEnvelope([rowAlice]),
    expected: firstCaptureExpected(),
  });
  mustResolution(out, 'unique');
  const wanted = { name: 'Alice', code: 'AG-001', platformId: '42' };
  must(isDeepStrictEqual(out.matched, wanted),
    `matched 三元组不等：实得 ${JSON.stringify(out.matched)} ≠ 期望 ${JSON.stringify(wanted)}`);
});

check('G7b 编译首采下码不等仍 action_failed（缺签不豁免其余判据）', () => {
  const dom = { status: 'unique', name: 'Alice', code: 'AG-002' };
  const out = resolveDualIdentity({ dom, envelope: okEnvelope([rowAlice]), expected: firstCaptureExpected() });
  mustResolution(out, 'action_failed');
});

// ---- 收口 ----
const total = passes + failures;
if (failures > 0) {
  console.error(`RED  ${TAG}: ${failures}/${total} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${total}/${total} 检查全过`);

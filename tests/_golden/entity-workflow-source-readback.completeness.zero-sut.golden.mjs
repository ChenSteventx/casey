#!/usr/bin/env node
// entity-workflow-source-readback（C2）金牌：workflow 毒化 + 完备性【回归锁】（zero-SUT）。
// 纯 node：通道无关的账本/门纯函数 + workflow 通道配置 + workflow 形态毒化夹具（零浏览器、零 SUT）。
//
// ⚠ 本金牌是【回归锁，非红先行驱动】——诚实标注：完备性/毒化逻辑（lib/agent-identity-observation.mjs 的
//   createIdentityObservationLedger、lib/agent-identity-gate.mjs 的 resolveDualIdentity）是【通道无关纯函数】，
//   workflow 免费继承——故用 workflow 通道配置直调时【现即绿】。它锁住的是「workflow 通道继承完备性」：
//   将来若有人把账本/门 kind-耦合（如按 agent 硬编码），workflow 完备性会在此可见地断裂。
//   毒化的【端到端红先行真证】（信封经 compile→ledger→gate 真流、重复同名 → AMBIGUOUS、total>records →
//   不证 SAME）是 loop 浏览器金牌用 workflow-sut fixture（wftwins-hidden/wfpaged/wfmissing 场景）承担，
//   须 workflow 通道注入（C2 golden compile-channel）+ 武装（C2 golden arming）落地后方可端到端走通。
//
// ── 钉什么（母规格 §5 完备性因果行 C1(agent)+C2(workflow)、本契约 plan 验收点 6）──
//   账本 consume（完整性先决）：total>records.length / cursor 未尽（hasNext）/ 坏行 / failed 终态 → 非 ok（证不出）。
//   查询回声（错 scope）：arm 的 expectedQuery 与请求 queryEcho 不符 → 请求不入事务 → consume 空（不证 SAME/absent）。
//   双证门 resolveDualIdentity：重复同名 → ambiguous（绝不取 first）；信封非 ok → action_failed（不证 SAME/absent）。
// 断言纪律：退出码 + 状态字段 deepEqual；禁标记串 grep（判绿只信退出码，MEMORY 铁律）。
//
// ⚠ 真字段名待真机采、先采不猜（GRILL D4）：WF_CHANNEL 的 recordsPath/totalPath/fields 与 sourcePath 全仿造。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let createIdentityObservationLedger; let resolveDualIdentity;
try {
  ({ createIdentityObservationLedger } = await import(resolve(ROOT, 'lib', 'agent-identity-observation.mjs')));
  ({ resolveDualIdentity } = await import(resolve(ROOT, 'lib', 'agent-identity-gate.mjs')));
} catch (error) {
  console.error(`RED  entity-workflow-source-readback.completeness: 完备性纯函数模块缺席 —— ${String(error?.message || error).slice(0, 200)}`);
  process.exit(1);
}

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };

// workflow 通道配置（仿造字段，镜像 agents.listApi 形状）。
const WF_CHANNEL = { pathname: '/api/workflows/query', method: 'GET', recordsPath: 'data.records', totalPath: 'data.total', queryParam: 'nameLike', hasNextPath: null, fields: { id: 'workflowId', code: 'workflowCode', name: 'workflowName' } };
const WF_NAME = '互联网问诊-主流程';
const WF_MAIN = { id: '1234567890123456789', code: 'WF-IM-001', name: WF_NAME };
const WF_TWIN = { id: '9876543210987654321', code: 'WF-IM-002', name: WF_NAME };

// 账本一次事务完整周期：arm→request→terminal→settle→seal→consume。
function ledgerConsume({ channel = WF_CHANNEL, outcome, expectedQuery = WF_NAME, queryEcho = WF_NAME } = {}) {
  const ledger = createIdentityObservationLedger({ channel });
  const token = ledger.arm({ intentId: 'i0', expectedQuery });
  ledger.onRequestWillBeSent({ requestSeq: 1, method: channel.method, urlPathname: channel.pathname, queryEcho });
  ledger.onBodyTerminal({ requestSeq: 1, outcome });
  ledger.seal(token);
  return ledger.consume(token);
}

// ── 账本完整性先决（workflow 通道；通道无关继承的回归锁）─────────────────────────────
assert(ledgerConsume({ outcome: { kind: 'parsed', rows: [WF_MAIN], total: 2 } }).status === 'invalid',
  't1 total>records.length（total=2 records=1）→ consume invalid（完整性先决不过，不证 SAME）');
assert(ledgerConsume({ outcome: { kind: 'parsed', rows: [WF_MAIN, WF_TWIN], total: 2 } }).status === 'ok',
  't1b 完整信封（total=2 records=2）→ consume ok（正控：完备时才 ok）');
assert(ledgerConsume({ channel: { ...WF_CHANNEL, hasNextPath: 'data.hasNext' }, outcome: { kind: 'parsed', rows: [WF_MAIN], total: 1, hasNext: true } }).status === 'invalid',
  't2 cursor 未尽（声明 hasNextPath 且 hasNext=true）→ consume invalid（分页未尽不证 SAME）');
assert(ledgerConsume({ outcome: { kind: 'failed' } }).status === 'invalid',
  't3 读回接口 failed 终态（如 wfmissing 500）→ consume invalid（failed≠空数组，证不出，不证 absent）');
assert(ledgerConsume({ outcome: { kind: 'parsed', rows: [{ id: 'not-numeric', code: 'x', name: WF_NAME }], total: 1 } }).status === 'invalid',
  't4 坏行（id 非纯数字，越 opaque 复验）→ consume invalid');

// 错 scope（查询回声不符）：请求 queryEcho 与 arm 的 expectedQuery 不符 → 请求不入事务 → consume 空。
assert(ledgerConsume({ expectedQuery: WF_NAME, queryEcho: '别的工作流关键词', outcome: { kind: 'parsed', rows: [WF_MAIN], total: 1 } }).status === 'empty',
  't5 错 scope（queryEcho≠expectedQuery）→ 请求不入事务 → consume 空（别人的完整集合不当本查询的完整性证据，不证 SAME）');

// ── 双证门 resolveDualIdentity（workflow 形态毒化）──────────────────────────────────
{
  // 重复同名工作流（信封两行同名）→ ambiguous（绝不取 first）。
  const r = resolveDualIdentity({
    dom: { status: 'unique', name: WF_NAME, code: WF_MAIN.code },
    envelope: { status: 'ok', rows: [WF_MAIN, WF_TWIN], total: 2 },
    expected: { openName: WF_NAME, code: null },
  });
  assert(r.resolution === 'ambiguous',
    `t6 重复同名工作流（信封两行同名）→ ambiguous（绝不取 first）；实得 ${r.resolution}/${r.reason}`);
}
{
  // 信封非 ok（完整性先决 total>records 已被账本判 invalid）→ action_failed（不证 SAME/absent）。
  const r = resolveDualIdentity({
    dom: { status: 'unique', name: WF_NAME, code: WF_MAIN.code },
    envelope: { status: 'invalid' },
    expected: { openName: WF_NAME, code: null },
  });
  assert(r.resolution === 'action_failed',
    `t7 信封非 ok（完整性先决不过）→ action_failed（不证 SAME/absent）；实得 ${r.resolution}/${r.reason}`);
}
{
  // 正控：完整唯一信封 + DOM 双锚一致 → unique（读回取回 workflowId）。
  const r = resolveDualIdentity({
    dom: { status: 'unique', name: WF_NAME, code: WF_MAIN.code },
    envelope: { status: 'ok', rows: [WF_MAIN], total: 1 },
    expected: { openName: WF_NAME, code: WF_MAIN.code },
  });
  assert(r.resolution === 'unique' && r.matched && r.matched.platformId === WF_MAIN.id,
    `t8 正控：完整唯一 + DOM 双锚一致 → unique、读回 platformId=workflowId；实得 ${r.resolution}/${JSON.stringify(r.matched || null)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  entity-workflow-source-readback.completeness: ${f}`);
  console.error(`RED  entity-workflow-source-readback.completeness: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-workflow-source-readback.completeness: ${passed}/${passed} 全过（workflow 通道完备性/毒化回归锁，通道无关继承，零 SUT）`);

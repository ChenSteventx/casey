#!/usr/bin/env node
// entity-workflow-source-readback（C2）验收金牌：compileWorkflowCreate/Open 武装 source 读回（红先行、zero-SUT 静态面）。
// 纯 node：读 lib/compile-atoms.mjs 源码作结构断言（零浏览器、零网络、零 SUT）。武装点的【行为】端到端真证
// 由 loop 浏览器金牌（workflow-sut fixture）承担；本静态面只钉「武装点存在且经身份通道 ledger 门」。
// 断言纪律：退出码 + 具名断言；改本文件 = Test Ratchet 判红。
//
// ── C2 目标（母规格 §3、本契约 plan 验收点 3、GRILL D2/D5）──
// 今天只有 compileAgentSearchOpen 武装 run.pendingIdentityObservation（agent-id-readback）：
//   lib/compile-atoms.mjs 内 `run.pendingIdentityObservation = { matched: dual.matched, evidenceStepId: r.stepId }`，
//   且仅在 `run.identityLedger` 声明（剖面 agents.listApi）时走双证路径。compileFlow 据此按 flow 步 provenance
//   （sourceIntentId/candidateId/role）归档身份观察行、join 到终端 click binding。
// C2 把这套【对称地】给 workflow source 侧：compileWorkflowCreate / compileWorkflowOpen 在创建/打开工作流后，
//   剖面声明 workflows.listApi（run.identityLedger 在）时武装 source 读回（created-in-run→platform-readback），
//   join 到 source binding（母规格 point 3）。existing 工作流走 user-approval（GRILL D5）。
//
// ── 红先行判据 ──
//   现 compileWorkflowCreate / compileWorkflowOpen 函数体【零触碰】pendingIdentityObservation / identityLedger
//   （只有 compileAgentSearchOpen 武装）→ 本金牌各断言实得「武装点缺席」→ RED。
//   C2 在两函数加「ledger 在则武装 source 读回」后 → 全绿。
//
// 忠实 ref 说明：任何忠实实现要让 source 读回进 sign 对账，唯一路径就是经 run.identityLedger 门武装
//   run.pendingIdentityObservation（compileFlow 的归档只认这一 run 态字段）——故本静态断言不是形状臆测，
//   而是唯一可行接线面。kind/sourcePath 的泛化（归档不再硬钉 agent）由 loop 浏览器金牌端到端证（archived
//   观察行 kind='workflow'、sourcePath 取 workflows 通道），本静态面不脆断源码字面。

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SRC = readFileSync(resolve(ROOT, 'lib', 'compile-atoms.mjs'), 'utf8');

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };

// 提取一个 async function 的函数体切片（从声明处到下一个 `async function` 声明处）。
function funcBody(name) {
  const start = SRC.indexOf(`async function ${name}(`);
  if (start < 0) return null;
  const nextIdx = SRC.indexOf('\nasync function ', start + 1);
  return SRC.slice(start, nextIdx < 0 ? SRC.length : nextIdx);
}

// 基线守卫：compileAgentSearchOpen 的武装范式在场（证提取器/字段名基线未漂——本金牌据此对称断言 workflow）。
const agentBody = funcBody('compileAgentSearchOpen');
assert(agentBody != null && agentBody.includes('run.pendingIdentityObservation =') && agentBody.includes('run.identityLedger'),
  '基线：compileAgentSearchOpen 保有 run.pendingIdentityObservation 武装 + run.identityLedger 门（对称断言基准，防字段名漂移致假红）');

// ── s1 compileWorkflowCreate 武装 source 读回 ──────────────────────────────────────
{
  const body = funcBody('compileWorkflowCreate');
  assert(body != null, 's1a compileWorkflowCreate 函数须存在');
  assert(body != null && body.includes('run.pendingIdentityObservation'),
    's1b compileWorkflowCreate 须武装 run.pendingIdentityObservation（source 读回武装点；现只 agentSearchOpen 武装 → RED）');
  assert(body != null && body.includes('run.identityLedger'),
    's1c compileWorkflowCreate 武装须经 run.identityLedger 门（剖面声明 workflows.listApi 才武装、未声明零行为差；现零触碰 → RED）');
}

// ── s2 compileWorkflowOpen 武装 source 读回 ────────────────────────────────────────
{
  const body = funcBody('compileWorkflowOpen');
  assert(body != null, 's2a compileWorkflowOpen 函数须存在');
  assert(body != null && body.includes('run.pendingIdentityObservation'),
    's2b compileWorkflowOpen 须武装 run.pendingIdentityObservation（source 读回武装点；现只 agentSearchOpen 武装 → RED）');
  assert(body != null && body.includes('run.identityLedger'),
    's2c compileWorkflowOpen 武装须经 run.identityLedger 门（剖面声明 workflows.listApi 才武装；现零触碰 → RED）');
}

if (failures.length) {
  for (const f of failures) console.error(`RED  entity-workflow-source-readback.arming: ${f}`);
  console.error(`RED  entity-workflow-source-readback.arming: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-workflow-source-readback.arming: ${passed}/${passed} 全过（compileWorkflowCreate/Open source 读回武装点，静态零 SUT）`);

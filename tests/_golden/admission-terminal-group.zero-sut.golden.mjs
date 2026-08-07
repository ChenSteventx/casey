#!/usr/bin/env node
// admission-terminal-group 验收金牌（红先行、zero-SUT）：准入验证器终端语义对齐基数门先例
// （Steven 裁甲 2026-08-08——组内末 click 才是终端；脚手架 click 不产观察义务、行锚脚手架具名拒）。
// 直驱真实 validateObservationAdmission + checkIdentityObservationCardinality（T8 两门同判）。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let registry;
try {
  registry = await import(resolve(ROOT, 'lib', 'entity-observation-registry.mjs'));
} catch (error) {
  console.error(`RED  admission-terminal-group: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { validateObservationAdmission, checkIdentityObservationCardinality } = registry;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 160); } catch { return String(v); } };

const click = (stepId, intentId, atom, extra = {}) => ({ stepId, intentId, atom, action: 'click', ...extra });
const bindRow = (stepId, intentId, atom, sourceIntentId, role) => ({ stepId, intentId, atom, sourceIntentId, candidateId: 'wf', role, bindingMode: 'created-in-run' });
const obsRow = (evidenceStepId, sourceIntentId, platformId, atom = 'workflow.create', role = 'subject') => ({
  kind: 'workflow', name: 'wfx', code: 'W1', platformId, sourceIntentId, candidateId: 'wf', role,
  atom, evidenceStepId, sourcePath: '/wf', bindingMode: 'created-in-run', provenance: 'platform-readback',
});
const env = (atom, rows) => ({ source: { kind: 'compile-envelope', atom }, observations: rows });

// T1 多 click create + 单行锚末 click（实现前必红——sign 二跑真形）
{
  const r = validateObservationAdmission({
    events: [click('c1', 'ic', 'workflow.create'), click('c2', 'ic', 'workflow.create'), click('c3', 'ic', 'workflow.create')],
    bindings: [bindRow('c3', 'ic', 'workflow.create', 's_create', 'subject')],
    observation: [env('workflow.create', [obsRow('c3', 's_create', 'P9')])],
  });
  assert(r.ok === true, `T1 多 click create 单行锚组内末 click → ok；实得 ${brief(r)}`);
}
// T2 行锚脚手架（非末）click → 拒（新收紧，实现前红：今日脚手架也是终端故 ok）
{
  const r = validateObservationAdmission({
    events: [click('c1', 'ic', 'workflow.create'), click('c2', 'ic', 'workflow.create')],
    bindings: [bindRow('c1', 'ic', 'workflow.create', 's_create', 'subject')],
    observation: [env('workflow.create', [obsRow('c1', 's_create', 'P9')])],
  });
  assert(r.ok === false, `T2 行锚脚手架（非末）click → 拒（观察必锚终端）；实得 ${brief(r)}`);
}
// T3 真产物全形：多 click create + open 让位 + delete 未登记绑定共存（实现前必红）
const T3 = () => ({
  events: [
    click('c1', 'ic', 'workflow.create'), click('c2', 'ic', 'workflow.create'), click('c3', 'ic', 'workflow.create'),
    click('o1', 'io', 'workflow.open', { yieldedToPlatformId: 'P9' }),
    click('d1', 'id', 'workflow.deleteByName'), click('d2', 'id', 'workflow.deleteByName'),
  ],
  bindings: [
    bindRow('c3', 'ic', 'workflow.create', 's_create', 'subject'),
    bindRow('o1', 'io', 'workflow.open', 's_open', 'source'),
    bindRow('d2', 'id', 'workflow.deleteByName', 's_del', 'subject'),
  ],
  observation: [env('workflow.create', [obsRow('c3', 's_create', 'P9')])],
});
{
  const r = validateObservationAdmission(T3());
  assert(r.ok === true, `T3 真产物全形（脚手架+让位+未登记 delete 共存）→ ok；实得 ${brief(r)}`);
}
// T4 agent 单 click 遗留逐字等价
{
  const r = validateObservationAdmission({
    events: [click('s1', 'i', 'agent.searchOpen')],
    bindings: [{ stepId: 's1', intentId: 'i', atom: 'agent.searchOpen', sourceIntentId: 's', candidateId: 'ag', role: 'subject', bindingMode: 'created-in-run' }],
    observation: [env('agent.searchOpen', [{ ...obsRow('s1', 's', 'PX', 'agent.searchOpen'), kind: 'agent', candidateId: 'ag' }])],
  });
  assert(r.ok === true, `T4 agent 单 click 遗留 → ok 零回归；实得 ${brief(r)}`);
}
// T5 重复完整三元组照拒
{
  const r = validateObservationAdmission({
    events: [click('c1', 'ic', 'workflow.create'), click('c1', 'ic', 'workflow.create')],
    bindings: [bindRow('c1', 'ic', 'workflow.create', 's_create', 'subject')],
    observation: [env('workflow.create', [obsRow('c1', 's_create', 'P9')])],
  });
  assert(r.ok === false && r.rejectCode === 'OBSERVATION_DUPLICATE_TERMINAL',
    `T5 重复完整三元组照拒；实得 ${brief(r)}`);
}
// T6 双 create 组各锚各自末 click → ok（组隔离）
{
  const r = validateObservationAdmission({
    events: [click('a1', 'i1', 'workflow.create'), click('a2', 'i1', 'workflow.create'), click('b1', 'i2', 'workflow.create')],
    bindings: [bindRow('a2', 'i1', 'workflow.create', 's_1', 'subject'), bindRow('b1', 'i2', 'workflow.create', 's_2', 'subject')],
    observation: [env('workflow.create', [obsRow('a2', 's_1', 'P1'), obsRow('b1', 's_2', 'P2')])],
  });
  assert(r.ok === true, `T6 双组各锚各自末 click → ok（组隔离）；实得 ${brief(r)}`);
}
// T7 让位谓词随新终端集生效：open 组多 click，末 click 携字段才豁免
{
  const c = T3();
  c.events[3] = click('o0', 'io', 'workflow.open', { yieldedToPlatformId: 'P9' });
  c.events.splice(4, 0, click('o1', 'io', 'workflow.open'));
  c.bindings[1] = bindRow('o1', 'io', 'workflow.open', 's_open', 'source');
  const r = validateObservationAdmission(c);
  assert(r.ok === false,
    `T7 open 组末 click 无字段（字段在脚手架上）→ 不豁免照拒（让位谓词取组内末 click）；实得 ${brief(r)}`);
}
// T8 两门同判：T3 真形对基数门同样 ok（判据同构实证）
{
  const c = T3();
  const r = checkIdentityObservationCardinality({
    events: c.events,
    observations: [{ atom: 'workflow.create', evidenceStepId: 'c3', kind: 'workflow', role: 'subject', platformId: 'P9' }],
  });
  assert(r.ok === true, `T8 同输入基数门亦 ok（两验证器终端判据同构）；实得 ${brief(r)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  admission-terminal-group: ${f}`);
  console.error(`RED  admission-terminal-group: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   admission-terminal-group: ${passed}/${passed} 全过（组内末 click 终端对齐，零 SUT）`);

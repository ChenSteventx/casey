#!/usr/bin/env node
// admission-envelope-yield 验收金牌（红先行、zero-SUT）：sign 侧准入验证器学让位（承 Steven 已签
// platformId 硬桥接设计的第三消费者接线）。直驱真实 validateObservationAdmission。
//
// 豁免形（与 compile 侧基数门同构、更紧一条）：终端让位 iff ①义务恰 ['source'] ②click 携非空
// yieldedToPlatformId ③全部已验行中恰一条 kind===boundKind && role==='subject' && platformId===字段值
// ④该原子信封**整缺**（空信封在场=畸形态照拒）。4b 面：义务原子全部终端让位才免信封；6 面：零行且
// 让位才免角色计数。加法门控：无字段输入行为逐字节同码。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let registry;
try {
  registry = await import(resolve(ROOT, 'lib', 'entity-observation-registry.mjs'));
} catch (error) {
  console.error(`RED  admission-envelope-yield: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { validateObservationAdmission } = registry;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 160); } catch { return String(v); } };

const createClick = (stepId, intentId, extra = {}) => ({ stepId, intentId, atom: 'workflow.create', action: 'click', ...extra });
const openClick = (stepId, intentId, extra = {}) => ({ stepId, intentId, atom: 'workflow.open', action: 'click', ...extra });
const bind = (stepId, intentId, atom, sourceIntentId, role) => ({ stepId, intentId, atom, sourceIntentId, candidateId: 'wf', role, bindingMode: 'created-in-run' });
const createRow = (evidenceStepId, sourceIntentId, platformId) => ({
  kind: 'workflow', name: 'wfx', code: 'W1', platformId, sourceIntentId, candidateId: 'wf', role: 'subject',
  atom: 'workflow.create', evidenceStepId, sourcePath: '/wf', bindingMode: 'created-in-run', provenance: 'platform-readback',
});
const createEnv = (rows) => ({ source: { kind: 'compile-envelope', atom: 'workflow.create' }, observations: rows });
const openEnv = (rows) => ({ source: { kind: 'compile-envelope', atom: 'workflow.open' }, observations: rows });

const BASE = () => ({
  events: [createClick('c1', 'ic'), openClick('o1', 'io', { yieldedToPlatformId: 'P9' })],
  bindings: [bind('c1', 'ic', 'workflow.create', 's_create', 'subject'), bind('o1', 'io', 'workflow.open', 's_open', 'source')],
  observation: [createEnv([createRow('c1', 's_create', 'P9')])],
});

// A1 豁免正例（实现前必红）
{
  const r = validateObservationAdmission(BASE());
  assert(r.ok === true,
    `A1 让位豁免正例（open 义务信封整缺 + 字段恰一匹配 create subject 行）→ ok；实得 ${brief(r)}`);
}
// A2 无字段遗留照拒（绿基线）
{
  const c = BASE(); c.events[1] = openClick('o1', 'io');
  const r = validateObservationAdmission(c);
  assert(r.ok === false && r.rejectCode === 'OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION',
    `A2 无字段遗留形照拒（加法门控）；实得 ${brief(r)}`);
}
// A3 伪造字段无匹配行照拒
{
  const c = BASE(); c.events[1] = openClick('o1', 'io', { yieldedToPlatformId: 'P8' });
  const r = validateObservationAdmission(c);
  assert(r.ok === false && r.rejectCode === 'OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION',
    `A3 字段值无匹配 subject 行 → 照拒（取证记录非豁免宣告）；实得 ${brief(r)}`);
}
// A4 subject 义务终端携字段照拒（义务面白名单）
{
  const c = {
    events: [createClick('c1', 'ic', { yieldedToPlatformId: 'P9' }), openClick('o1', 'io')],
    bindings: [bind('c1', 'ic', 'workflow.create', 's_create', 'subject'), bind('o1', 'io', 'workflow.open', 's_open', 'source')],
    observation: [openEnv([{ ...createRow('o1', 's_open', 'P9'), atom: 'workflow.open', role: 'source' }])],
  };
  const r = validateObservationAdmission(c);
  assert(r.ok === false && r.rejectCode === 'OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION',
    `A4 subject 义务（create）缺信封携伪造字段 → 照拒（义务恰 ['source'] 才可让）；实得 ${brief(r)}`);
}
// A5 匹配行多条照拒（恰一才豁免）
{
  const c = {
    events: [createClick('c1', 'ic1'), createClick('c2', 'ic2'), openClick('o1', 'io', { yieldedToPlatformId: 'P9' })],
    bindings: [bind('c1', 'ic1', 'workflow.create', 's_c1', 'subject'), bind('c2', 'ic2', 'workflow.create', 's_c2', 'subject'), bind('o1', 'io', 'workflow.open', 's_open', 'source')],
    observation: [createEnv([createRow('c1', 's_c1', 'P9'), createRow('c2', 's_c2', 'P9')])],
  };
  const r = validateObservationAdmission(c);
  assert(r.ok === false && r.rejectCode === 'OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION',
    `A5 同 platformId 匹配行两条 → 照拒（恰一才豁免）；实得 ${brief(r)}`);
}
// A6 空信封在场 + 让位字段照拒（信封整缺才是让位形，c26 拒面不松）
{
  const c = BASE(); c.observation = [createEnv([createRow('c1', 's_create', 'P9')]), openEnv([])];
  const r = validateObservationAdmission(c);
  assert(r.ok === false && r.rejectCode === 'OBSERVATION_ROLE_COUNT_MISMATCH',
    `A6 open 空信封在场 + 字段 → 照拒（畸形态非让位形）；实得 ${brief(r)}`);
}
// A7 agent 遗留形逐字等价
{
  const c = {
    events: [{ stepId: 's1', intentId: 'i', atom: 'agent.searchOpen', action: 'click' }],
    bindings: [{ stepId: 's1', intentId: 'i', atom: 'agent.searchOpen', sourceIntentId: 's', candidateId: 'ag', role: 'subject', bindingMode: 'created-in-run' }],
    observation: [{ source: { kind: 'compile-envelope', atom: 'agent.searchOpen' }, observations: [{ kind: 'agent', name: 'a', code: 'A', platformId: 'PX', sourceIntentId: 's', candidateId: 'ag', role: 'subject', atom: 'agent.searchOpen', evidenceStepId: 's1', sourcePath: '/ag', bindingMode: 'created-in-run', provenance: 'platform-readback' }] }],
  };
  const r = validateObservationAdmission(c);
  assert(r.ok === true, `A7 agent 遗留形（无字段）→ ok 零回归；实得 ${brief(r)}`);
}
// A8 真产物字节形回归（实现前必红）：多 create 绑定行 + 未登记原子（delete）绑定共存 + open 让位
{
  const c = {
    events: [createClick('c1', 'ic'), openClick('o1', 'io', { yieldedToPlatformId: 'P9' }),
      { stepId: 'd1', intentId: 'id', atom: 'workflow.deleteByName', action: 'click' }],
    bindings: [
      bind('c0', 'ic', 'workflow.create', 's_create', 'subject'),
      bind('c1', 'ic', 'workflow.create', 's_create', 'subject'),
      bind('o1', 'io', 'workflow.open', 's_open', 'source'),
      bind('d1', 'id', 'workflow.deleteByName', 's_del', 'subject'),
    ],
    observation: [createEnv([createRow('c1', 's_create', 'P9')])],
  };
  const r = validateObservationAdmission(c);
  assert(r.ok === true,
    `A8 真产物字节形（多 create 绑定 + 未登记 delete 绑定共存 + open 让位）→ ok；实得 ${brief(r)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  admission-envelope-yield: ${f}`);
  console.error(`RED  admission-envelope-yield: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   admission-envelope-yield: ${passed}/${passed} 全过（sign 侧准入让位豁免，零 SUT）`);

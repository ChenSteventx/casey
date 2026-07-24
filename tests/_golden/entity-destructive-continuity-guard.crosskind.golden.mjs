#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）round-6 收口金牌：codex round-5 复审 Critical【跨 kind 绕过】封口。
// 纯 node：直驱真生产纯函数 selectObservationForDestructiveTarget + destructiveTargetKind（lib/entity-destructive-continuity.mjs）
// + 静态咬生产接线 lib/compile-atoms.mjs 的 armDestructiveTargetContinuity（零浏览器/零 SUT/零 fake-SUT/零子进程）。
// 断言纪律：判绿只信退出码（MEMORY 铁律），失败退 1。改本文件=Test Ratchet 判红。
//
// 洞（codex round-5）：selectObservationForDestructiveTarget 旧实现只按 name+platformId 唯一命中、不校验 observation.kind。
// 同时声明 agent+workflow 双通道时，同名 agent 观察（kind='agent'）能给 workflow.deleteByName（boundKind=workflow）铸
// 目标连续性 ref → 触发错目标真删，且 compile 无出站门抓不到（真 fail-open）。
// 修：boundKind 提供时跨 kind 硬闸——同名但 kind 不符的观察绝不入选、更不得铸 ref；有同名命中却 kind 全不符 → fail-closed
// NO_MATCHING_KIND。生产 armDestructiveTargetContinuity 恒按 destructiveTargetKind(atom) 传 boundKind。
//
// 对抗自证（单次运行内先红后绿，无需 stash）：同一 fixture 同名 agent 观察——
//   · 无 kind 闸（不传 boundKind，旧 kind-agnostic 直驱路径）→ 被选中（ok:true）＝真洞暴露（codex 逮的 fail-open 复现）。
//   · 有 kind 闸（boundKind='workflow'）→ 拒（ok:false，NO_MATCHING_KIND）＝修复关死跨 kind 铸 ref。
// 另 git-stash 生产改动亲验先红：accept/red-baselines/entity-destructive-continuity-guard.crosskind.golden.red.txt。

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectObservationForDestructiveTarget, destructiveTargetKind,
} from '../../lib/entity-destructive-continuity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const failures = [];
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${String(e?.message || e)}`); console.error(`FAIL ${name}: ${String(e?.message || e)}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

// 形态锚真机 uat-run.md：19 位纯数字 platformId string。声明 agent+workflow 双通道后，同名 agent 观察是唯一在场件
// （workflow 身份采集尚 route:human 未接 → 无 workflow 观察），正是 codex 描述的可达跨 kind 武装场景。
const AGENT_OBS = { kind: 'agent', name: 'atl_shared', platformId: '1234567890123456789', code: 'AG-1' };
const WORKFLOW_OBS = { kind: 'workflow', name: 'atl_shared', platformId: '9876543210987654321', code: 'WF-1' };

// ---------- kind 映射口径核对（读原子→boundKind，确认与生产一致） ----------
test('K1 destructiveTargetKind 口径：workflow.deleteByName→workflow、agent.*/picker.*→agent', () => {
  assert(destructiveTargetKind('workflow.deleteByName') === 'workflow', 'workflow.deleteByName 应判 workflow');
  assert(destructiveTargetKind('agent.delete') === 'agent', 'agent.delete 应判 agent');
  assert(destructiveTargetKind('agent.confirmToolPicker') === 'agent', 'agent.confirmToolPicker 应判 agent');
  assert(destructiveTargetKind('picker.selectFirstTool') === 'agent', 'picker.selectFirstTool 应判 agent');
});

// ---------- X1 跨 kind 绕过封口：核心先红后绿对抗（同一 fixture 双路径） ----------
test('X1a 真洞复现：无 boundKind（kind-agnostic 旧路径）→ 同名 agent 观察被选中（ok:true）＝codex 逮的 fail-open', () => {
  // 这一分支【故意】不传 boundKind，复现旧 kind-agnostic 选取——同名带 platformId 唯一命中即取，不问 kind。
  // 它证明「若不校验 kind，agent 观察确会被交给 workflow.deleteByName 的铸 ref 入口」——洞真实存在。
  const r = selectObservationForDestructiveTarget({ observations: [AGENT_OBS], targetName: 'atl_shared' });
  assert(r.ok === true && r.observation.platformId === AGENT_OBS.platformId, `无 kind 闸应选中同名 agent 观察（洞复现）；实得 ${brief(r)}`);
});
test('X1b 修复关死：boundKind=workflow + 仅同名 agent 观察 → 拒（NO_MATCHING_KIND，跨 kind 绝不铸 ref）', () => {
  const r = selectObservationForDestructiveTarget({ observations: [AGENT_OBS], targetName: 'atl_shared', boundKind: 'workflow' });
  assert(r.ok === false, `boundKind=workflow 时同名 agent 观察绝不入选（跨 kind 硬闸）；实得 ${brief(r)}`);
  assert(r.reason === 'OBSERVATION_SELECT_NO_MATCHING_KIND', `跨 kind 拒应具名 NO_MATCHING_KIND（区别于纯无名命中）；实得 ${brief(r)}`);
});
test('X1c 混入场景：boundKind=workflow + [agent 同名, workflow 同名] → 只选 workflow 观察（剔 agent、绝不取 first）', () => {
  // 关键正控：同名 agent 与 workflow 观察并存时，跨 kind 剔除 agent 后剩唯一 workflow → 取；agent 绝不冒充。
  const r = selectObservationForDestructiveTarget({ observations: [AGENT_OBS, WORKFLOW_OBS], targetName: 'atl_shared', boundKind: 'workflow' });
  assert(r.ok === true && r.observation.platformId === WORKFLOW_OBS.platformId, `应剔 agent、唯一取 workflow 观察；实得 ${brief(r)}`);
});

// ---------- X2 正控：同 kind 选取不被误破（合法流仍走通） ----------
test('X2a 同 kind 正控：boundKind=workflow + 唯一 workflow 观察 → 正常选中（不误破合法同 kind 选取）', () => {
  const r = selectObservationForDestructiveTarget({ observations: [WORKFLOW_OBS], targetName: 'atl_shared', boundKind: 'workflow' });
  assert(r.ok === true && r.observation.platformId === WORKFLOW_OBS.platformId, `合法 workflow 观察应选中；实得 ${brief(r)}`);
});
test('X2b 同 kind 正控：boundKind=agent + 唯一 agent 观察 → 正常选中（合法 agent.delete 流不破）', () => {
  const r = selectObservationForDestructiveTarget({ observations: [AGENT_OBS], targetName: 'atl_shared', boundKind: 'agent' });
  assert(r.ok === true && r.observation.platformId === AGENT_OBS.platformId, `合法 agent 观察应选中；实得 ${brief(r)}`);
});
test('X2c 同 kind 毒化仍拒：boundKind=agent + 两同名 agent 观察 → AMBIGUOUS（同名不取 first 语义未被 kind 闸吞掉）', () => {
  const dup = { kind: 'agent', name: 'atl_shared', platformId: '1111111111111111111' };
  const r = selectObservationForDestructiveTarget({ observations: [AGENT_OBS, dup], targetName: 'atl_shared', boundKind: 'agent' });
  assert(r.ok === false && r.reason === 'OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME', `同 kind 同名多条仍应 AMBIGUOUS；实得 ${brief(r)}`);
});

// ---------- X3 生产接线静态咬：armDestructiveTargetContinuity 恒按 destructiveTargetKind(atom) 传 boundKind ----------
test('X3 静态：lib/compile-atoms.mjs 的 armDestructiveTargetContinuity 按 destructiveTargetKind(atom) 传 boundKind 给选取', () => {
  const src = readFileSync(join(ROOT, 'lib', 'compile-atoms.mjs'), 'utf8');
  assert(src.includes('destructiveTargetKind') && /import\s*\{[^}]*destructiveTargetKind[^}]*\}\s*from\s*'\.\/entity-destructive-continuity\.mjs'/.test(src),
    'compile-atoms 未从 entity-destructive-continuity 导入 destructiveTargetKind（跨 kind 闸接线断链）');
  assert(src.includes('const boundKind = destructiveTargetKind(atom);'),
    'armDestructiveTargetContinuity 未按 destructiveTargetKind(atom) 算 boundKind（生产处未据原子判目标 kind）');
  assert(src.includes('selectObservationForDestructiveTarget({ observations: run.identityObservations || [], targetName, boundKind })'),
    '铸 ref 的观察选取未把 boundKind 传给 selectObservationForDestructiveTarget（跨 kind 闸未生效于生产铸 ref 路径）');
});

if (failures.length) {
  console.error(`RED  crosskind: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   crosskind: ${passed}/${passed} 全过（跨 kind 绕过封口：同名 agent 观察绝不给 workflow.deleteByName 铸 ref；同 kind 选取不误破）`);
process.exit(0);

#!/usr/bin/env node
// delete-spec-magnifier 验收金牌（红先行、zero-SUT）：replay delete-spec 前置闸白名单放大镜 click
// （Steven 裁闸学精确形状 2026-08-08——文案 null ∧ value 缺 ∧ fallbackCss 逐字等于编译器字面才放，
// 形状矛盾不混装，既有三拒面逐字等价）。直驱真实 validateWorkflowDeleteBindings。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let mod;
try {
  mod = await import(resolve(ROOT, 'lib', 'workflow-delete-spec.mjs'));
} catch (error) {
  console.error(`RED  delete-spec-magnifier: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { validateWorkflowDeleteBindings } = mod;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 160); } catch { return String(v); } };

const MAG = '.hr-input__suffix .search-icon';
const del = (stepId, extra = {}) => ({ stepId, intentId: 'ic', atom: 'workflow.deleteByName', action: 'click', ...extra });

// M1 放大镜双击真产物形（逐字自十五跑 atstep_13/17）→ ok（实现前必红）
{
  const r = validateWorkflowDeleteBindings([
    del('atstep_13', { fallbackCss: MAG }),
    del('atstep_14', { text: '删除', semantic: { kind: 'text', name: '删除', exact: true }, value: 'atl_{{uniqueName}}' }),
    del('atstep_15', { text: '确认', semantic: { kind: 'role', role: 'button', name: '确认', exact: true }, value: 'atl_{{uniqueName}}', compilePhase: 'terminal' }),
    del('atstep_17', { fallbackCss: MAG }),
  ]);
  assert(r.ok === true, `M1 放大镜双击真产物形 → ok；实得 ${brief(r)}`);
}
// M2 css 错一字照拒
{
  const r = validateWorkflowDeleteBindings([del('s1', { fallbackCss: '.hr-input__suffix .search-ico' })]);
  assert(r.ok === false && r.problems[0].reason === 'unsupported_click_label',
    `M2 css 错一字 → 照拒 unsupported_click_label；实得 ${brief(r)}`);
}
// M3 css 对但携 value → 形状矛盾照拒
{
  const r = validateWorkflowDeleteBindings([del('s1', { fallbackCss: MAG, value: 'atl_x' })]);
  assert(r.ok === false && r.problems[0].reason === 'unsupported_click_label',
    `M3 css 对但携 value → 形状矛盾照拒；实得 ${brief(r)}`);
}
// M4 css 对但携文案「删除」→ 原 value 义务照常
{
  const r = validateWorkflowDeleteBindings([del('s1', { fallbackCss: MAG, text: '删除' })]);
  assert(r.ok === false && r.problems[0].reason === 'missing_target_binding',
    `M4 css 对但文案「删除」→ 原 value 义务照常（缺 value 拒）；实得 ${brief(r)}`);
}
// M5 既有三面逐字等价（镜像冻结金牌夹具）
{
  const base = [
    del('s2', { text: '删除', value: 'atl_{{uniqueName}}' }),
    del('s3', { semantic: { name: '确定' }, value: 'atl_{{uniqueName}}' }),
  ];
  const ok = validateWorkflowDeleteBindings(base);
  const stale = validateWorkflowDeleteBindings(base.map((e) => ({ ...e, value: undefined })));
  const unk = validateWorkflowDeleteBindings([del('s4', { text: '未知钮', value: 'atl_x' })]);
  assert(ok.ok === true && stale.ok === false && stale.problems.length === 2
    && stale.problems.every((p) => p.reason === 'missing_target_binding')
    && unk.ok === false && unk.problems[0].reason === 'unsupported_click_label',
    `M5 既有三面逐字等价（ok/缺 value 拒/未知文案拒）；实得 ${brief({ ok, stale, unk })}`);
}
// M6 css 对但 semantic.name 在场 → 照拒（文案定义同闸原口径）
{
  const r = validateWorkflowDeleteBindings([del('s1', { fallbackCss: MAG, semantic: { name: '搜索' } })]);
  assert(r.ok === false && r.problems[0].reason === 'unsupported_click_label',
    `M6 css 对但 semantic.name 在场 → 照拒；实得 ${brief(r)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  delete-spec-magnifier: ${f}`);
  console.error(`RED  delete-spec-magnifier: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   delete-spec-magnifier: ${passed}/${passed} 全过（放大镜精确形状白名单，零 SUT）`);

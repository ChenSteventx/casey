#!/usr/bin/env node
// replay-magnifier-dispatch 验收金牌（红先行、zero-SUT）：分发层接通白名单放大镜 click。
//
// 缝（GRILL 全证）：同一「放大镜过滤」契约三层落点不一致——编译模板发射（S1 冻结钉）、
// 回放前置闸白名单放行（delete-spec-magnifier 冻结钉、Steven 2026-08-08 裁形状），而回放
// 分发层 performActionOnPage 的 deleteByName-click 分支要求 value（目标名绑定）、放大镜形状
// 恰无 value → 运行时无条件拒点、从未执行（2026-08-10 真机三例实证：752ms 纯等待、列表全程
// 未过滤、清理意图折叠必败恒 NEEDS_HUMAN）。
//
// 修法钉三件：① 放大镜形状走通用锁定门真执行（Ra 系，修前必红）；② 白名单判据谓词收单点、
// 分发层只经 import 消费（Rd 结构钉，修前必红——分发层无该 import）；③ 破坏性三 click 的
// 绑定义务与前置闸既有判定零放松（Rb/Rc/Re，修前修后都绿）。
// 执行语义零特殊化（GRILL D3）：多候选 ambiguous 不点、零候选 none 不点（Ra2/Ra0 钉）。

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let replayActions; let deleteSpec;
try {
  replayActions = await import(resolve(ROOT, 'lib', 'replay-actions.mjs'));
  deleteSpec = await import(resolve(ROOT, 'lib', 'workflow-delete-spec.mjs'));
} catch (error) {
  console.error(`RED  replay-magnifier-dispatch: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { dispatchReplayAction } = replayActions;
const { validateWorkflowDeleteBindings } = deleteSpec;

const TAG = 'replay-magnifier-dispatch';
const MAG = '.hr-input__suffix .search-icon';
const failures = [];
let passed = 0;
const eq = (got, want, msg) => {
  if (Object.is(got, want)) { passed += 1; console.log(`ok   ${TAG}: ${msg}`); }
  else { failures.push(msg); console.error(`FAIL ${TAG}: ${msg}：期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}`); }
};
const ok = (cond, msg) => eq(Boolean(cond), true, msg);

// ── mock 页：只给通用路径要的最小面（locator/count/first/click）。
// 语义定位分支（getByRole 等）对放大镜事件不该被走到——走到即记账，Ra 断言其为零。
function mockPage({ iconCount = 1 } = {}) {
  const clicks = [];
  const semanticTouches = [];
  const mkLoc = (sel, count) => ({
    count: async () => count,
    first: () => mkLoc(sel, count >= 1 ? 1 : 0),
    click: async () => { clicks.push(sel); },
    waitFor: async () => {},
    elementHandle: async () => null,
  });
  const page = {
    locator: (sel) => mkLoc(sel, sel === MAG ? iconCount : 0),
    getByRole: (...a) => { semanticTouches.push(['role', ...a]); return mkLoc('role', 0); },
    getByLabel: (...a) => { semanticTouches.push(['label', ...a]); return mkLoc('label', 0); },
    getByText: (...a) => { semanticTouches.push(['text', ...a]); return mkLoc('text', 0); },
  };
  return { page, clicks, semanticTouches };
}

const magEvent = (extra = {}) => ({
  stepId: 'e_mag', intentId: 'ic', atom: 'workflow.deleteByName', action: 'click',
  fallbackCss: MAG, ...extra,
});

// ── Ra 主钉：放大镜形状 → 通用锁定门真执行（修前必红：分发层拒点、零点击）──
{
  const { page, clicks, semanticTouches } = mockPage({ iconCount: 1 });
  const axis = await dispatchReplayAction(page, magEvent(), {});
  eq(axis?.resolution, 'unique', 'Ra 放大镜形状解析态（修前必红：分发层无条件拒点）');
  eq(axis?.identityReadback?.ok, true, 'Ra 动作身份回读（锁定门 perform 成立）');
  eq(clicks.length, 1, 'Ra 恰一次真实点击');
  eq(clicks[0], MAG, 'Ra 点击落在放大镜选择器上');
  eq(semanticTouches.length, 0, 'Ra 语义定位分支零触碰（事件无语义、直走 fallbackCss）');
}

// ── Ra2/Ra0 执行语义零特殊化（GRILL D3）：多候选不点、零候选不点 ──
{
  const { page, clicks } = mockPage({ iconCount: 2 });
  const axis = await dispatchReplayAction(page, magEvent(), {});
  eq(axis?.resolution, 'ambiguous', 'Ra2 双图标 → ambiguous（多匹配绝不落笔）');
  eq(clicks.length, 0, 'Ra2 零点击');
}
{
  const { page, clicks } = mockPage({ iconCount: 0 });
  const axis = await dispatchReplayAction(page, magEvent(), {});
  eq(axis?.resolution, 'none', 'Ra0 图标缺席 → none（零候选绝不点）');
  eq(clicks.length, 0, 'Ra0 零点击');
}

// ── Rb 形状矛盾不混装：css 对但携 value / 携文案 → 不入白名单支、照旧拒 ──
{
  const { page, clicks } = mockPage({ iconCount: 1 });
  const axis = await dispatchReplayAction(page, magEvent({ value: 'atl_x' }), {});
  eq(axis?.resolution, 'action_failed', 'Rb1 css 对但携 value → 拒（形状矛盾不混装）');
  eq(clicks.length, 0, 'Rb1 零点击');
}
{
  const { page, clicks } = mockPage({ iconCount: 1 });
  const axis = await dispatchReplayAction(page, magEvent({ text: '删除' }), {});
  eq(axis?.resolution, 'action_failed', 'Rb2 css 对但携文案「删除」且缺 value → 拒（绑定义务零放松）');
  eq(clicks.length, 0, 'Rb2 零点击');
}

// ── Rc 非放大镜 css 且缺 value 的 deleteByName click → 拒点（既有 fail-safe 零放松）──
{
  const { page, clicks } = mockPage({ iconCount: 1 });
  const axis = await dispatchReplayAction(page, magEvent({ fallbackCss: '.some-other-icon' }), {});
  eq(axis?.resolution, 'action_failed', 'Rc 非白名单 css 缺 value → 拒点');
  eq(clicks.length, 0, 'Rc 零点击');
}

// ── Rd 谓词单点结构钉（修前必红：分发层无 import）──
{
  const specSrc = readFileSync(resolve(ROOT, 'lib', 'workflow-delete-spec.mjs'), 'utf8');
  const dispatchSrc = readFileSync(resolve(ROOT, 'lib', 'replay-actions.mjs'), 'utf8');
  const literal = "'.hr-input__suffix .search-icon'";
  eq(specSrc.split(literal).length - 1, 1, 'Rd 判据字面在 workflow-delete-spec.mjs 恰一处定义');
  eq(dispatchSrc.split(literal).length - 1, 0, 'Rd 判据字面在 replay-actions.mjs 零出现（只经 import 消费）');
  ok(/export function isMagnifierSearchClick/.test(specSrc), 'Rd 谓词由 workflow-delete-spec.mjs 导出（修前必红）');
  ok(/import\s*\{[^}]*isMagnifierSearchClick[^}]*\}\s*from\s*'\.\/workflow-delete-spec\.mjs'/.test(dispatchSrc),
    'Rd 分发层经 import 消费同一谓词（修前必红）');
}

// ── Re 前置闸回归：谓词收单点后 validateWorkflowDeleteBindings 判定逐字不变 ──
{
  const del = (extra = {}) => ({ stepId: 's', intentId: 'ic', atom: 'workflow.deleteByName', action: 'click', ...extra });
  const r1 = validateWorkflowDeleteBindings([del({ fallbackCss: MAG })]);
  eq(r1.ok, true, 'Re1 白名单形状照放');
  const r2 = validateWorkflowDeleteBindings([del({ fallbackCss: MAG, value: 'atl_x' })]);
  eq(r2.ok === false && r2.problems[0]?.reason, 'unsupported_click_label', 'Re2 css 对但携 value → 照拒（unsupported_click_label）');
  const r3 = validateWorkflowDeleteBindings([del({ fallbackCss: MAG, text: '删除' })]);
  eq(r3.ok === false && r3.problems[0]?.reason, 'missing_target_binding', 'Re3 携文案「删除」缺 value → 照拒（missing_target_binding）');
  const r4 = validateWorkflowDeleteBindings([del({ text: '删除', value: 'atl_x' })]);
  eq(r4.ok, true, 'Re4 正常删除 click（文案+value）照放');
}

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

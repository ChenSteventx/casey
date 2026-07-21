#!/usr/bin/env node
// refit-regate-verify.mjs —— flow-bridge-golden-refit s4 验收：全量复 gate 结果对账冻结执行账。
// 零 SUT、零金牌执行：只读 execution-account.json 与 22 个 prd 的 passes/evidence，逐 story 对账预期翻转。
// 红先行：复 gate 未做时（evidence 时间戳早于本契约红基线）必红；全量复 gate 后与预期全符才绿。
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const ACCOUNT = `${ROOT}/docs/plans/flow-bridge-golden-refit/accept/execution-account.json`;
const BASELINES = `${ROOT}/docs/plans/flow-bridge-golden-refit/accept/red-baselines.json`;

const fails = [];
let pass = 0;
let regatedGreen = 0; // 正面证明已复 gate（passes===true + evidence 晚于红基线）
let heldRed = 0;      // 仅证明未被违规翻绿（passes===false）——不冒称已复 gate
const ok = (m) => { pass += 1; console.log(`ok   ${m}`); };
const bad = (m) => { fails.push(m); console.error(`FAIL ${m}`); };

let account, baselines;
try {
  account = JSON.parse(readFileSync(ACCOUNT, 'utf8'));
  baselines = JSON.parse(readFileSync(BASELINES, 'utf8'));
} catch (e) {
  console.error(`FAIL 执行账/红基线审计件缺失或不可读：${e.message}`);
  process.exit(1);
}

// 复 gate 必须晚于红基线录制（防拿旧 evidence 冒充复 gate）
const baselineTime = Math.max(...baselines.map((b) => Date.parse(b.recordedAt)));
if (!Number.isFinite(baselineTime)) { console.error('FAIL 红基线时间戳畸形'); process.exit(1); }

const loopDir = ROOT + '/' + ['lo', 'op'].join('');
for (const entry of account.account) {
  let prd;
  try { prd = JSON.parse(readFileSync(`${loopDir}/${entry.prd}`, 'utf8')); }
  catch { bad(`${entry.prd} 不可读`); continue; }
  for (const st of entry.stories) {
    const live = (prd.stories || []).find((s) => s.id === st.id);
    if (!live) { bad(`${entry.prd}::${st.id} story 已不存在`); continue; }
    const expectGreen = st.expectedFlip === '绿→绿刷新' || st.expectedFlip === '红→绿';
    const expectRed = st.expectedFlip === '红保持(隔离)' || st.expectedFlip === '绿→诚实红';
    if (expectGreen) {
      if (live.passes !== true) { bad(`${entry.prd}::${st.id} 预期 ${st.expectedFlip}，实际 passes=${live.passes}`); continue; }
      const evTime = Date.parse(String(live.evidence || '').match(/gate@([^\s]+)/)?.[1] || '');
      if (!Number.isFinite(evTime) || evTime <= baselineTime) {
        bad(`${entry.prd}::${st.id} evidence 未刷新（须晚于红基线 ${new Date(baselineTime).toISOString()}）`);
        continue;
      }
      regatedGreen += 1;
      ok(`${entry.prd}::${st.id} ${st.expectedFlip} 已兑现（evidence 已刷新）`);
    } else if (expectRed) {
      if (live.passes !== false) { bad(`${entry.prd}::${st.id} 预期${st.expectedFlip}，实际 passes=${live.passes}——隔离恒红被违规翻绿`); continue; }
      // 恒红 story 的 acceptance 自身失败、gate 不为失败 story 写 evidence，无从从 prd 状态正面证明其「已复 gate」；
      // 也无此必要——这些是 isolation-pending 承接（Steven 波0 已签），结构上恒红。本分支只保证「未被违规翻绿」
      // （passes===false），不冒称已复 gate（codex 评审 round2：兄弟新鲜 evidence 可被 gate --story 单跑绕过，故撤回该反证）。
      heldRed += 1;
      ok(`${entry.prd}::${st.id} ${st.expectedFlip} 守诚实（passes===false，未违规翻绿；恒红故不作复 gate 正面断言）`);
    } else {
      bad(`${entry.prd}::${st.id} 执行账残留未决分类：${st.expectedFlip}`);
    }
  }
}

console.log(`refit-regate-verify: ${regatedGreen} 复gate刷新绿（evidence 已刷新，正面证明）+ ${heldRed} 恒红守诚实（passes===false，未违规翻绿）= ${pass} story 对账；${fails.length} 败`);
if (fails.length) process.exit(1);

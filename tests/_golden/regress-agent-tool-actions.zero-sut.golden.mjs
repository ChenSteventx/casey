#!/usr/bin/env node
// 回归保护测试：只读源码与纯函数；禁止启动浏览器、fixture、fake-SUT 或连接任何 SUT。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateDraft } from '../../lib/compile-gate.mjs';
import { isAgentToolSpecialAction } from '../../lib/agent-tool-actions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = (path) => readFileSync(join(ROOT, path), 'utf8');
let passed = 0;
const out = [];
function check(name, fn) {
  try { fn(); passed += 1; out.push(`PASS ${name}`); }
  catch (error) { out.push(`FAIL ${name}: ${error.message}`); }
}

check('B1 七原子的高风险动作都走专用身份门', () => {
  const samples = [
    { atom: 'agent.create', action: 'fill', fieldLabel: '智能体名称' },
    { atom: 'agent.create', action: 'click', text: '输出类型' },
    { atom: 'agent.openToolPicker', action: 'click' },
    { atom: 'picker.search', action: 'press' },
    { atom: 'picker.expandPrimary', action: 'click' },
    { atom: 'picker.selectFirstTool', action: 'click' },
    { atom: 'agent.confirmToolPicker', action: 'click' },
    { atom: 'agent.delete', action: 'click', text: '删除' },
    { atom: 'agent.delete', action: 'press', text: 'post-delete-zero' },
  ];
  for (const sample of samples) if (!isAgentToolSpecialAction(sample)) throw new Error(`${sample.atom}/${sample.action} 未分流`);
  if (isAgentToolSpecialAction({ atom: 'agent.create', action: 'click', text: '新增智能体' })) throw new Error('新增入口应走既有统一点击身份门');
});

check('B2 replay 在通用动作前分流专用身份门', () => {
  const text = source('lib/replay-actions.mjs');
  const special = text.indexOf('isAgentToolSpecialAction(ev)');
  const generic = text.indexOf('const cand = await resolveCandidate(page, ev)');
  if (special < 0 || generic < 0 || special > generic) throw new Error('专用身份门接线顺序错误');
});

check('B3 agent.delete 复用因果弹层授权并支持精确智能体搜索框', () => {
  const actions = source('lib/agent-tool-actions.mjs');
  const domain = source('lib/workflow-delete-domain.mjs');
  if (!actions.includes("searchBoxName: AGENT_SEARCH_NAME")) throw new Error('删除触发未绑定智能体搜索框');
  if (!domain.includes('options.searchBoxName || SEARCH_BOX_NAME')) throw new Error('共享删除域未接受显式搜索框');
  if (/confirmBtn\.nth|buttons\.last\(|getByRole\([^\n]+\)\.last\(/.test(actions)) throw new Error('出现全页最后一个确认按钮模式');
});

check('B4 删除后精确归零是代表事件身份回读，不是散文备注', () => {
  const actions = source('lib/agent-tool-actions.mjs');
  if (!actions.includes("ev.text === 'post-delete-zero'")) throw new Error('缺删除后代表事件分流');
  if (!actions.includes('matches === 0')) throw new Error('缺目标记录精确归零回读');
  if (!actions.includes("return axis('action_failed', 1)")) throw new Error('残留未 fail-closed');
});

check('B5 候选 flow 通过 Casey 三闸但仍未签署', () => {
  const registry = JSON.parse(source('lib/atoms-registry.snapshot.json'));
  const flow = JSON.parse(source('docs/plans/regress-agent-tool-first-slice/candidate/agent-tool-add.flow.json'));
  const result = validateDraft(flow, { prefix: 'atl_', registry });
  if (!result.ok) throw new Error(result.problems.join('；'));
  const note = source('docs/plans/regress-agent-tool-first-slice/candidate/README.md');
  if (!note.includes('不是已签用例') || !note.includes('没有真机 PASS')) throw new Error('候选状态未明确 route:human');
});

console.log(out.join('\n'));
console.log(`${passed}/5 passed`);
process.exit(passed === 5 ? 0 : 1);

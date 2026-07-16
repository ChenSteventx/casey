#!/usr/bin/env node
// 纯函数/静态验收：删除后归零须有稳定窗口，并与同次触发、确认链绑定；禁止连接任何 SUT。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { advanceAgentDeleteZeroEvidence } from '../../lib/agent-tool-actions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let passed = 0;
const out = [];
function check(name, fn) {
  try { fn(); passed += 1; out.push(`PASS ${name}`); }
  catch (error) { out.push(`FAIL ${name}: ${error.message}`); }
}

check('H1 瞬时空列表不能直接背书删除后归零', () => {
  let state = advanceAgentDeleteZeroEvidence(null, { elapsedMs: 0, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 500, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 2999, matches: 0, busy: false });
  if (state.ok) throw new Error('稳定窗口未满却提前背书');
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 3000, matches: 0, busy: false });
  if (!state.ok) throw new Error('稳定窗口满足后仍未背书');
});

check('H2 加载态或目标重现会清零连续证据', () => {
  let state = advanceAgentDeleteZeroEvidence(null, { elapsedMs: 2500, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 2800, matches: 0, busy: true });
  if (state.zeroSamples !== 0 || state.ok) throw new Error('加载态未清零');
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 3100, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 3300, matches: 1, busy: false });
  if (state.zeroSamples !== 0 || state.ok) throw new Error('目标重现未清零');
});

check('H3 后置归零只消费同次触发与确认链', () => {
  const text = readFileSync(join(ROOT, 'lib', 'agent-tool-actions.mjs'), 'utf8');
  for (const token of ['agentDeleteTriggeredTarget', 'agentDeleteConfirmedTarget', 'advanceAgentDeleteZeroEvidence']) {
    if (!text.includes(token)) throw new Error(`缺少绑定：${token}`);
  }
});

console.log(out.join('\n'));
console.log(`${passed}/3 passed`);
process.exit(passed === 3 ? 0 : 1);

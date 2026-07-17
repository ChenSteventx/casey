#!/usr/bin/env node
// 纯函数验收：删除后稳定期从连续零窗口起点计时；禁止连接任何 SUT。
import { advanceAgentDeleteZeroEvidence } from '../../lib/agent-tool-actions.mjs';

let passed = 0;
const out = [];
function check(name, fn) {
  try { fn(); passed += 1; out.push(`PASS ${name}`); }
  catch (error) { out.push(`FAIL ${name}: ${error.message}`); }
}

check('Z1 2.9 秒才首次为零，3.2 秒不得背书', () => {
  let state = advanceAgentDeleteZeroEvidence(null, { elapsedMs: 0, matches: 1, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 2900, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 3050, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 3200, matches: 0, busy: false });
  if (state.ok) throw new Error('只连续归零 300ms 却提前背书');
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 5899, matches: 0, busy: false });
  if (state.ok) throw new Error('连续归零窗口不足 3000ms 却提前背书');
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 5900, matches: 0, busy: false });
  if (!state.ok) throw new Error('连续归零满 3000ms 且样本数达标后仍未背书');
});

check('Z2 busy 会重置连续零窗口', () => {
  let state = advanceAgentDeleteZeroEvidence(null, { elapsedMs: 0, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 1500, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 1600, matches: 0, busy: true });
  if (state.zeroSamples !== 0 || state.zeroWindowStartedAt !== null || state.ok) {
    throw new Error('busy 未清空连续零窗口');
  }
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 3000, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 4500, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 5900, matches: 0, busy: false });
  if (state.ok) throw new Error('busy 后的新窗口未满 3000ms 却提前背书');
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 6000, matches: 0, busy: false });
  if (!state.ok) throw new Error('busy 后的新窗口满 3000ms 仍未背书');
});

check('Z3 非零结果会重置连续零窗口', () => {
  let state = advanceAgentDeleteZeroEvidence(null, { elapsedMs: 0, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 2000, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 2500, matches: 1, busy: false });
  if (state.zeroSamples !== 0 || state.zeroWindowStartedAt !== null || state.ok) {
    throw new Error('非零结果未清空连续零窗口');
  }
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 2800, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 4000, matches: 0, busy: false });
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 5700, matches: 0, busy: false });
  if (state.ok) throw new Error('非零重置后的新窗口未满 3000ms 却提前背书');
  state = advanceAgentDeleteZeroEvidence(state, { elapsedMs: 5800, matches: 0, busy: false });
  if (!state.ok) throw new Error('非零重置后的新窗口满 3000ms 仍未背书');
});

console.log(out.join('\n'));
console.log(`${passed}/3 passed`);
process.exit(passed === 3 ? 0 : 1);

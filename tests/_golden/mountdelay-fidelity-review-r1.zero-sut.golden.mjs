#!/usr/bin/env node
// Grok R1 两条有效 finding 的 zero-SUT 回归锁；不启动被测系统、浏览器或 listener。
import { settleBeforeCapture } from '../../lib/replay-settle.mjs';

const failures = [];
let passed = 0;
async function check(id, name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${id} ${name}`); }
  catch (error) { failures.push(`${id} ${name}: ${String(error?.message || error).slice(-500)}`); }
}

await check('R1-M1', '配置态不得把 number-only 旧桩当成占位已消失', async () => {
  const page = { async evaluate() { return 1000; }, async waitForLoadState() {} };
  const result = await settleBeforeCapture(page, {
    inFlight: () => 0,
    floorMs: 0,
    budgetMs: 260,
    profile: { loading: { selectors: ['.route-loading-mask'] } },
  });
  if (result.settled !== false) throw new Error(`配置态裸数字证不出占位状态，应 settled:false，实际 ${result.settled}`);
});

await check('R1-M2', 'selector 从未命中也不得弱于无配置三拍静止窗', async () => {
  let calls = 0;
  const page = {
    async evaluate() { calls += 1; return { len: 1000, placeholderGone: true }; },
    async waitForLoadState() {},
  };
  const result = await settleBeforeCapture(page, {
    inFlight: () => 0,
    floorMs: 0,
    budgetMs: 800,
    profile: { loading: { selectors: ['.never-matches'] } },
  });
  if (result.settled !== true) throw new Error(`稳定页应最终 settled:true，实际 ${result.settled}`);
  if (calls < 3) throw new Error(`配置态不得少于三拍静止窗，实际 ${calls}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nmountdelay-fidelity review-r1: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nmountdelay-fidelity review-r1: ${passed}/2 passed`);

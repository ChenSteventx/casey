#!/usr/bin/env node
// replay-settle-mount 的 hermetic 存活覆盖：仅以桩 page / inFlight 驱动 settleBeforeCapture。
import { settleBeforeCapture } from '../../../lib/replay-settle.mjs';

const failures = [];
let passed = 0;

async function check(unitCheckId, name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${unitCheckId} ${name}`);
  } catch (error) {
    failures.push(`${unitCheckId} ${name}: ${String(error?.message || error).slice(-500)}`);
  }
}

function stubPage(lenSpec) {
  let i = 0;
  const calls = { evaluate: 0, waitForLoadState: [] };
  return {
    _calls: calls,
    async evaluate() {
      calls.evaluate += 1;
      const k = i++;
      if (lenSpec === 'never') return new Promise(() => {});
      if (lenSpec === 'throw') throw new Error('导航中执行上下文销毁');
      if (typeof lenSpec === 'function') return lenSpec(k);
      return Array.isArray(lenSpec) ? lenSpec[Math.min(k, lenSpec.length - 1)] : lenSpec;
    },
    async waitForLoadState(state, opts) {
      calls.waitForLoadState.push({ state, opts });
    },
  };
}

function stubInFlight(spec) {
  let i = 0;
  return () => {
    if (spec === 'throw') throw new Error('inFlight boom');
    if (Array.isArray(spec)) return spec[Math.min(i++, spec.length - 1)];
    return spec;
  };
}

// sourceObligationId:hg-replay-settle-mount-u1 unitCheckId:replay-settle-mount-unit-u1
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u1","unitCheckId":"replay-settle-mount-unit-u1"}
await check('replay-settle-mount-unit-u1', '稳定页快速放行', async () => {
  const result = await settleBeforeCapture(stubPage(4000), { inFlight: stubInFlight(0) });
  if (result.settled !== true) throw new Error(`稳定页应 settled:true，实际 ${result.settled}`);
  if (!(result.waitedMs < 800)) throw new Error(`稳定页应 waitedMs<800，实际 ${result.waitedMs}`);
});

// sourceObligationId:hg-replay-settle-mount-u2a unitCheckId:replay-settle-mount-unit-u2a
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u2a","unitCheckId":"replay-settle-mount-unit-u2a"}
await check('replay-settle-mount-unit-u2a', '永不稳定且在途恒零', async () => {
  const page = stubPage((k) => 1000 + k * 7);
  const result = await settleBeforeCapture(page, { inFlight: stubInFlight(0), floorMs: 400, budgetMs: 600 });
  if (result.settled !== false) throw new Error(`永不稳定应 settled:false，实际 ${result.settled}`);
  if (!(result.waitedMs >= 1000)) throw new Error(`应 waitedMs≥下限+全额预算(1000)，实际 ${result.waitedMs}`);
  if (!(result.waitedMs < 1800)) throw new Error(`总耗时应有界(<1800)，实际 ${result.waitedMs}`);
  if (page._calls.waitForLoadState.length !== 0) throw new Error('在途已归零应跳过 networkidle 兜底');
});

// sourceObligationId:hg-replay-settle-mount-u8 unitCheckId:replay-settle-mount-unit-u8
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u8","unitCheckId":"replay-settle-mount-unit-u8"}
await check('replay-settle-mount-unit-u8', '小预算下仍进入条件轮询', async () => {
  const page = stubPage((k) => 1000 + k * 7);
  const result = await settleBeforeCapture(page, { inFlight: stubInFlight(0), budgetMs: 100 });
  if (result.settled !== false) throw new Error(`小预算永不稳定应 settled:false，实际 ${result.settled}`);
  if (!(page._calls.evaluate >= 1)) throw new Error(`条件循环须至少跑一拍，实际 ${page._calls.evaluate}`);
});

// sourceObligationId:hg-replay-settle-mount-u2b unitCheckId:replay-settle-mount-unit-u2b
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u2b","unitCheckId":"replay-settle-mount-unit-u2b"}
await check('replay-settle-mount-unit-u2b', '永不稳定且在途恒一', async () => {
  const page = stubPage((k) => 1000 + k * 7);
  const result = await settleBeforeCapture(page, { inFlight: stubInFlight(1), floorMs: 100, budgetMs: 600 });
  if (result.settled !== false) throw new Error(`永不稳定应 settled:false，实际 ${result.settled}`);
  const calls = page._calls.waitForLoadState;
  if (calls.length !== 1) throw new Error(`在途非零应走 networkidle 兜底一次，实际 ${calls.length}`);
  if (calls[0].state !== 'networkidle') throw new Error(`兜底应 networkidle，实际 ${calls[0].state}`);
  if (!(calls[0].opts && Number.isFinite(calls[0].opts.timeout) && calls[0].opts.timeout > 0)) {
    throw new Error(`networkidle 必带有限 timeout，实际 ${JSON.stringify(calls[0].opts)}`);
  }
});

// sourceObligationId:hg-replay-settle-mount-u3 unitCheckId:replay-settle-mount-unit-u3
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u3","unitCheckId":"replay-settle-mount-unit-u3"}
await check('replay-settle-mount-unit-u3', '固定下限可调', async () => {
  const withFloor = await settleBeforeCapture(stubPage(4000), { inFlight: stubInFlight(0), floorMs: 300 });
  if (!(withFloor.settled === true && withFloor.waitedMs >= 300)) {
    throw new Error(`floor 300 应 settled:true/waitedMs≥300，实际 ${JSON.stringify(withFloor)}`);
  }
  const withoutFloor = await settleBeforeCapture(stubPage(4000), { inFlight: stubInFlight(0), floorMs: 0 });
  if (!(withoutFloor.settled === true && withoutFloor.waitedMs < 300)) {
    throw new Error(`floor 0 应 settled:true/waitedMs<300，实际 ${JSON.stringify(withoutFloor)}`);
  }
});

// sourceObligationId:hg-replay-settle-mount-u4 unitCheckId:replay-settle-mount-unit-u4
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u4","unitCheckId":"replay-settle-mount-unit-u4"}
await check('replay-settle-mount-unit-u4', 'evaluate 抛错时不外抛', async () => {
  const result = await settleBeforeCapture(stubPage('throw'), { inFlight: stubInFlight(0), floorMs: 50, budgetMs: 500 });
  if (result.settled !== false) throw new Error(`evaluate 抛错应 settled:false，实际 ${result.settled}`);
  if (typeof result.waitedMs !== 'number') throw new Error('抛错仍须返回 waitedMs');
});

// sourceObligationId:hg-replay-settle-mount-u5 unitCheckId:replay-settle-mount-unit-u5
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u5","unitCheckId":"replay-settle-mount-unit-u5"}
await check('replay-settle-mount-unit-u5', 'evaluate 永不返回仍有硬上界', async () => {
  const startedAt = Date.now();
  const result = await settleBeforeCapture(stubPage('never'), { inFlight: stubInFlight(0), floorMs: 100, budgetMs: 600 });
  const elapsed = Date.now() - startedAt;
  if (result.settled !== false) throw new Error(`永不返回应 settled:false，实际 ${result.settled}`);
  if (!(elapsed < 1800)) throw new Error(`总耗时须有界(<1800)，实际 ${elapsed}`);
});

// sourceObligationId:hg-replay-settle-mount-u6 unitCheckId:replay-settle-mount-unit-u6
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u6","unitCheckId":"replay-settle-mount-unit-u6"}
await check('replay-settle-mount-unit-u6', 'inFlight 抛错时降级为纯判据 B', async () => {
  const result = await settleBeforeCapture(stubPage(4000), { inFlight: stubInFlight('throw') });
  if (result.settled !== true) throw new Error(`inFlight 抛错后稳定页仍应 settled:true，实际 ${result.settled}`);
});

// sourceObligationId:hg-replay-settle-mount-u7 unitCheckId:replay-settle-mount-unit-u7
// lifecycle-successor: {"sourceObligationId":"hg-replay-settle-mount-u7","unitCheckId":"replay-settle-mount-unit-u7"}
await check('replay-settle-mount-unit-u7', '稳定对不跨在途归零点', async () => {
  const page = stubPage(4000);
  const result = await settleBeforeCapture(page, { inFlight: stubInFlight([1, 1, 0, 0, 0, 0]), floorMs: 50 });
  if (result.settled !== true) throw new Error(`应最终 settled:true，实际 ${result.settled}`);
  if (page._calls.evaluate < 4) throw new Error(`放行须在第二个归零拍之后（≥4 拍），实际 ${page._calls.evaluate}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nreplay-settle-mount unit: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\nreplay-settle-mount unit: ${passed}/9 passed`);

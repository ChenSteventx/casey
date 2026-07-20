#!/usr/bin/env node
// mountdelay-fidelity 验收：只用桩 page 驱动静默点，绝不启动被测系统、浏览器或 listener。
import fs from 'node:fs';
import { settleBeforeCapture } from '../../lib/replay-settle.mjs';

const failures = [];
let passed = 0;

async function check(id, name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${id} ${name}`);
  } catch (error) {
    failures.push(`${id} ${name}: ${String(error?.message || error).slice(-500)}`);
  }
}

function snapshotPage(snapshots, { throwWhenConfigured = false } = {}) {
  let index = 0;
  const calls = { evaluate: 0, args: [] };
  return {
    _calls: calls,
    async evaluate(_fn, arg) {
      calls.evaluate += 1;
      calls.args.push(arg);
      // 旧实现不传占位配置，只读取 DOM 长度；让它稳定早放，形成真实红基线。
      if (!arg || !Array.isArray(arg.loadingSelectors)) return 1000;
      if (throwWhenConfigured) throw new Error('placeholder probe failed');
      const value = snapshots[Math.min(index, snapshots.length - 1)];
      index += 1;
      return value;
    },
    async waitForLoadState() {},
  };
}

await check('M1', '配置占位仍在时不得在稳定旧 DOM 上早放', async () => {
  const page = snapshotPage([
    { len: 1000, placeholderGone: false },
    { len: 1000, placeholderGone: false },
    { len: 1000, placeholderGone: false },
    { len: 1000, placeholderGone: false },
    { len: 2000, placeholderGone: true },
    { len: 2000, placeholderGone: true },
  ]);
  const result = await settleBeforeCapture(page, {
    inFlight: () => 0,
    floorMs: 0,
    budgetMs: 1200,
    profile: { loading: { selectors: ['.route-loading-mask'], text: '页面加载中' } },
  });
  if (result.settled !== true) throw new Error(`占位消失并稳定后应 settled:true，实际 ${result.settled}`);
  if (page._calls.evaluate < 6) throw new Error(`占位存活期不得早放，至少应观察 6 拍，实际 ${page._calls.evaluate}`);
});

await check('M2', '无占位配置时静止窗须比旧两拍更长', async () => {
  const page = snapshotPage([{ len: 1000, placeholderGone: true }]);
  const result = await settleBeforeCapture(page, { inFlight: () => 0, floorMs: 0, budgetMs: 800 });
  if (result.settled !== true) throw new Error(`稳定页应 settled:true，实际 ${result.settled}`);
  if (page._calls.evaluate < 3) throw new Error(`无配置兜底至少应连续观察 3 拍，实际 ${page._calls.evaluate}`);
});

await check('M3', '占位探测故障不得假称已稳定', async () => {
  const page = snapshotPage([{ len: 1000, placeholderGone: true }], { throwWhenConfigured: true });
  const result = await settleBeforeCapture(page, {
    inFlight: () => 0,
    floorMs: 0,
    budgetMs: 260,
    profile: { loading: { selectors: ['[broken'] } },
  });
  if (result.settled !== false) throw new Error(`占位探测证不出时应 settled:false，实际 ${result.settled}`);
});

await check('M4', '回放调用处须把通道剖面传给静默点', async () => {
  const source = fs.readFileSync(new URL('../../bin/replay.mjs', import.meta.url), 'utf8');
  const call = source.match(/settleBeforeCapture\(page,\s*\{[\s\S]*?\n\s*\}\);/u)?.[0] || '';
  if (!/\bprofile\s*,/u.test(call)) throw new Error('settleBeforeCapture 调用缺 profile 传递');
  if (/\bexpected\b/u.test(call)) throw new Error('静默点调用不得把 expected 传入判据');
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nmountdelay-fidelity: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\nmountdelay-fidelity: ${passed}/4 passed`);

#!/usr/bin/env node
// zero-SUT golden：瞬时 FS 竞争吸收器 retryOnTransientFsRace 的行为契约。
// 纯 node、零 SUT：无浏览器、无网络、无 fake/fixture、无真实文件系统写——只用注入 fn
// 断言重试语义。为 SAFE_V2 T2 的 9p sharing-violation 修复背书：吸收瞬时 EACCES 等、
// 真实拒绝仍抛、非瞬时 errno 立即抛（不掩盖真错）、退避不改可观察结果。

import { retryOnTransientFsRace } from './support/retry-transient-fs.mjs';

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function fsError(code) { const e = new Error(code); e.code = code; return e; }

// 吸收：前 N 次抛瞬时 EACCES、第 N+1 次成功 → 返回成功值，恰好调用 N+1 次。
check('前 3 次瞬时 EACCES 后成功 → 吸收返回、调用 4 次', () => {
  let calls = 0;
  const result = retryOnTransientFsRace(() => {
    calls += 1;
    if (calls <= 3) throw fsError('EACCES');
    return 'ok';
  }, { tries: 10, delayMs: 0 });
  if (result !== 'ok') throw new Error(`期望 ok 实得 ${result}`);
  if (calls !== 4) throw new Error(`期望调用 4 次实得 ${calls}`);
});

// 四类瞬时 errno 各被吸收一次。
for (const code of ['EACCES', 'EPERM', 'EBUSY', 'ENOTEMPTY']) {
  check(`瞬时 ${code} 单次后成功 → 吸收`, () => {
    let calls = 0;
    const r = retryOnTransientFsRace(() => { calls += 1; if (calls === 1) throw fsError(code); return code; }, { delayMs: 0 });
    if (r !== code || calls !== 2) throw new Error(`${code} 未被吸收：r=${r} calls=${calls}`);
  });
}

// 真实拒绝：恒抛瞬时 → 耗尽 tries 后抛，且恰好尝试 tries 次（不无限、不吞）。
check('恒抛瞬时 EACCES → 耗尽 tries 抛出真实拒绝、尝试恰 tries 次', () => {
  let calls = 0;
  let thrown = null;
  try { retryOnTransientFsRace(() => { calls += 1; throw fsError('EACCES'); }, { tries: 5, delayMs: 0 }); }
  catch (e) { thrown = e; }
  if (thrown?.code !== 'EACCES') throw new Error(`期望耗尽后抛 EACCES 实得 ${thrown?.code}`);
  if (calls !== 5) throw new Error(`期望尝试 5 次实得 ${calls}`);
});

// 非瞬时 errno 立即抛：不重试、不掩盖真错（如 ENOENT 是真缺失，须立刻暴露）。
check('非瞬时 ENOENT → 立即抛、绝不重试', () => {
  let calls = 0;
  let thrown = null;
  try { retryOnTransientFsRace(() => { calls += 1; throw fsError('ENOENT'); }, { tries: 10, delayMs: 0 }); }
  catch (e) { thrown = e; }
  if (thrown?.code !== 'ENOENT') throw new Error(`期望立即抛 ENOENT 实得 ${thrown?.code}`);
  if (calls !== 1) throw new Error(`非瞬时 errno 竟重试：calls=${calls}`);
});

// 无 code 的普通错误也立即抛（不当瞬时吞）。
check('无 code 普通错误 → 立即抛', () => {
  let calls = 0;
  let thrown = null;
  try { retryOnTransientFsRace(() => { calls += 1; throw new Error('boom'); }, { delayMs: 0 }); }
  catch (e) { thrown = e; }
  if (thrown?.message !== 'boom' || calls !== 1) throw new Error(`普通错误未立即抛：msg=${thrown?.message} calls=${calls}`);
});

// 首次即成功 → 只调一次（无谓重试开销）。
check('首次成功 → 只调用一次', () => {
  let calls = 0;
  const r = retryOnTransientFsRace(() => { calls += 1; return 42; }, { delayMs: 0 });
  if (r !== 42 || calls !== 1) throw new Error(`首次成功语义错：r=${r} calls=${calls}`);
});

// 入参校验：非函数 / 非法 tries / 非法 delayMs 拒。
check('入参校验 fail-closed（非函数/非法 tries/非法 delayMs）', () => {
  for (const [args, label] of [
    [[null], 'fn=null'],
    [[() => 0, { tries: 0 }], 'tries=0'],
    [[() => 0, { tries: 1.5 }], 'tries=1.5'],
    [[() => 0, { delayMs: -1 }], 'delayMs=-1'],
  ]) {
    let threw = false;
    try { retryOnTransientFsRace(...args); } catch { threw = true; }
    if (!threw) throw new Error(`${label} 未 fail-closed`);
  }
});

if (failures.length) {
  for (const f of failures) console.error(`RED  lease-rename-retry: ${f}`);
  console.error(`RED  observation-lease-rename-retry: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   observation-lease-rename-retry: ${passed}/${passed} 全过`);

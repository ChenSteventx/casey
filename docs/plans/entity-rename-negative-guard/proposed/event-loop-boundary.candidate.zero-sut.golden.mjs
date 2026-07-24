#!/usr/bin/env node
// C4 保真补强候选二：生产事件环里 UNKNOWN_ATOM 守卫的准确边界。
// 纯 Node、零 SUT、零浏览器、零网络；动态只跑 page-free 分发闸，生产环顺序直接读 bin/replay.mjs。

import { existsSync, readFileSync } from 'node:fs';
import { dispatchReplayAction } from '../../../../lib/replay-actions.mjs';

const REPLAY_SOURCE_URL = new URL('../../../../bin/replay.mjs', import.meta.url);
const ACTION_SOURCE_URL = new URL('../../../../lib/replay-actions.mjs', import.meta.url);
const BOUNDARY_URL = new URL('./boundary-correction.md', import.meta.url);
const UNKNOWN_ATOM = 'workflow.rename';

let passed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function poisonPage() {
  const state = { touched: null };
  const proxy = new Proxy(function poison() {}, {
    get(_target, property) {
      if (typeof property === 'symbol' || property === 'then') return undefined;
      state.touched = String(property);
      throw new Error(`PAGE_TOUCHED:${String(property)}`);
    },
  });
  return { proxy, state };
}

check('L1 真实生产事件环顺序：恢复导航/只读采样/响应监听均早于 UNKNOWN_ATOM 分发闸', () => {
  const source = readFileSync(REPLAY_SOURCE_URL, 'utf8');
  const loopAt = source.indexOf('for (const ev of events)');
  const prePathAt = source.indexOf('const want = ev.pre && ev.pre.path;', loopAt);
  const restoreGotoAt = source.indexOf('page.goto(sut + want', prePathAt);
  const rowCountAt = source.indexOf('before: await rowCount(page', loopAt);
  const responseWaitAt = source.indexOf('page.waitForResponse', loopAt);
  const dispatchAt = source.indexOf('dispatchReplayAction(page, ev, ctx)', loopAt);
  assert(loopAt >= 0, '找不到生产事件环');
  assert(
    loopAt < prePathAt
      && prePathAt < restoreGotoAt
      && restoreGotoAt < rowCountAt
      && rowCountAt < responseWaitAt
      && responseWaitAt < dispatchAt,
    `生产事件环顺序漂移：${JSON.stringify({ loopAt, prePathAt, restoreGotoAt, rowCountAt, responseWaitAt, dispatchAt })}`,
  );
});

check('L2 分发闸内部 UNKNOWN_ATOM 判据先于 performAction 委派', () => {
  const source = readFileSync(ACTION_SOURCE_URL, 'utf8');
  const dispatchAt = source.indexOf('export async function dispatchReplayAction');
  const rejectAt = source.indexOf('const reject = unknownAtomRejection(ev)', dispatchAt);
  const delegateAt = source.indexOf('return performAction(page, ev, ctx)', dispatchAt);
  assert(dispatchAt >= 0 && rejectAt > dispatchAt && delegateAt > rejectAt, '分发闸不再先拒未知原子后委派业务动作');
});

await checkAsync('L3 从分发闸边界起，未知字符串原子不触碰 page 且不委派业务动作', async () => {
  const poison = poisonPage();
  const axis = await dispatchReplayAction(poison.proxy, {
    stepId: 'atstep_0',
    intentId: 'intent_0',
    atom: UNKNOWN_ATOM,
    action: 'click',
    pre: { path: '/workflow/list' },
    semantic: { kind: 'text', name: '审批工作流', exact: true },
  }, {});
  assert(poison.state.touched === null, `分发闸后仍触碰 page：${poison.state.touched}`);
  assert(axis?.resolution === 'action_failed', `未知原子未返回拒绝动作轴：${JSON.stringify(axis)}`);
  assert(axis?.rejectReason === 'UNKNOWN_ATOM', `未知原子拒绝码漂移：${JSON.stringify(axis)}`);
  assert(axis?.identityReadback?.ok === false, `未知原子拒绝轴竟可背书动作成功：${JSON.stringify(axis)}`);
});

check('L4 候选说明明确“可有良性 page 触碰，但无业务动作/破坏动作”边界', () => {
  assert(existsSync(BOUNDARY_URL), '缺 boundary-correction.md 候选边界说明');
  const text = readFileSync(BOUNDARY_URL, 'utf8');
  assert(text.includes('不是“页面零触碰”'), '候选说明未明确撤回页面零触碰过度措辞');
  assert(text.includes('恢复导航 → 只读采样 → 响应监听 → `UNKNOWN_ATOM` 守卫'), '候选说明未记录真实生产事件环顺序');
  assert(text.includes('不委派 `performAction`'), '候选说明未锁定不执行业务动作的准确保证');
  assert(text.includes('候选态，待人签'), '候选说明未声明待人签');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  C4 event-loop-boundary candidate: ${failure}`);
  console.error(`RED  C4 event-loop-boundary candidate: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   C4 event-loop-boundary candidate: ${passed}/${passed} 全过（候选态，零 SUT）`);

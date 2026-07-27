#!/usr/bin/env node
// 正式 newpage action 必须在 locator 前交给 topology bridge；零 page DOM、零 browser/SUT/network。

import { dispatchReplayAction } from '../../lib/replay-actions.mjs';

const TAG = 'page-topology-auth-continuity-replay-action';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-900)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

function fixedPageTrap() {
  const calls = [];
  const page = new Proxy({}, {
    get(_target, property) {
      calls.push(String(property));
      throw new Error(`FIXED_PAGE_TOUCHED:${String(property)}`);
    },
  });
  return { page, calls };
}

function topologyContext() {
  const calls = [];
  const activePageAuthority = Object.freeze({});
  return {
    calls,
    activePageAuthority,
    ctx: {
      pageTopology: {
        activePageAuthority() {
          return activePageAuthority;
        },
        async consumeNewPageEvent({ pageAuthority, event }) {
          calls.push({ pageAuthority, event });
          return {
            ok: true,
            resolution: 'unique',
            candidateCount: 1,
            identityReadback: { ok: true },
          };
        },
      },
    },
  };
}

const NEWPAGE = {
  stepId: 'atstep_1',
  intentId: 'intent_1',
  atom: 'agent.searchOpen',
  action: 'newpage',
  url: '{{baseUrl}}/agents?view=all',
};

await check('R1 newpage 委派 topology controller，固定旧 page 零触碰', async () => {
  const trap = fixedPageTrap();
  const topology = topologyContext();
  const result = await dispatchReplayAction(trap.page, NEWPAGE, topology.ctx);
  assert(topology.calls.length === 1, `consumeNewPageEvent 应恰一次，实际 ${topology.calls.length}`);
  assert(topology.calls[0].pageAuthority === topology.activePageAuthority, '须携当前 active authority');
  assert(topology.calls[0].event === NEWPAGE, '须原对象委派 formal newpage event');
  assert(trap.calls.length === 0, `newpage 不得触碰固定 page locator：${trap.calls.join(',')}`);
  assert(result?.resolution === 'unique' && result.identityReadback?.ok === true,
    `newpage 动作轴不符：${JSON.stringify(result)}`);
});

await check('R2 topology bridge 缺席时 fail-closed，不偷退 locator', async () => {
  const trap = fixedPageTrap();
  const result = await dispatchReplayAction(trap.page, NEWPAGE, {});
  assert(result?.resolution === 'action_failed'
    && result.rejectReason === 'PAGE_TOPOLOGY_UNAVAILABLE'
    && result.identityReadback?.ok === false,
  `缺 bridge 应具名拒：${JSON.stringify(result)}`);
  assert(trap.calls.length === 0, '缺 bridge 也不得触碰固定 page');
});

await check('R3 cloned active authority 被 controller 拒时原样 fail-closed', async () => {
  const trap = fixedPageTrap();
  const calls = [];
  const result = await dispatchReplayAction(trap.page, NEWPAGE, {
    pageTopology: {
      activePageAuthority() {
        return Object.freeze({});
      },
      async consumeNewPageEvent(input) {
        calls.push(input);
        return {
          ok: false,
          reason: 'PAGE_AUTHORITY_INVALID',
          resolution: 'action_failed',
          candidateCount: 0,
          identityReadback: { ok: false },
        };
      },
    },
  });
  assert(calls.length === 1, 'controller 拒绝仍应恰调用一次');
  assert(result?.resolution === 'action_failed' && result.reason === 'PAGE_AUTHORITY_INVALID',
    `controller 拒绝不得改写为 unique：${JSON.stringify(result)}`);
  assert(trap.calls.length === 0, 'controller 拒绝不得触碰固定 page');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

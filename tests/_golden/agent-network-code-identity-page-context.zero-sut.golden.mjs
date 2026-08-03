#!/usr/bin/env node
// Grok R1 修单：用函数序列化模拟 Playwright page.evaluate 隔离边界，禁止 Node 模块自由变量蒙绿。

import { clickAgentCardWithin } from '../../lib/agent-search-gate.mjs';
import { parseAgentIdentityProfile } from '../../lib/agent-identity-profile.mjs';

const MODE = 'network-code-dom-name-v1';
const NAME = '互联网问诊-主诉';
let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   agent-network-code-page-context: ${name}`); }
  catch (error) { failures.push(`${name}: ${error?.message || error}`); }
}
function must(value, message) { if (!value) throw new Error(message); }

function isolatedCard({ code = 'AG-001' } = {}) {
  let clicks = 0;
  const el = {
    isConnected: true,
    getClientRects: () => [{}],
    querySelector: (selector) => {
      if (selector === '.name') return { textContent: NAME };
      if (selector === '.code') return { textContent: code };
      return null;
    },
  };
  return {
    // 间接 eval 在全局域重建函数；模块 import/局部常量不可见，与 Playwright 序列化边界同向。
    evaluate: async (fn, arg) => {
      const pageFunction = (0, eval)(`(${fn.toString()})`);
      return pageFunction(el, arg);
    },
    $: async () => ({ click: async () => { clicks += 1; }, dispose: async () => {} }),
    clicks: () => clicks,
  };
}

await check('P1 网络编号模式在 page-context 隔离域内合法重验并恰点击一次', async () => {
  const card = isolatedCard();
  const ok = await clickAgentCardWithin(card, {
    mode: MODE, cardFields: { name: '.name' }, name: NAME, code: 'AG-001',
  });
  must(ok === true && card.clicks() === 1, 'page-context 合法路径必须点击一次，模块自由变量不得进入回调');
});

await check('P2 legacy 在 page-context 隔离域内仍核同卡 code 后点击', async () => {
  const card = isolatedCard();
  const ok = await clickAgentCardWithin(card, {
    cardFields: { name: '.name', code: '.code' }, name: NAME, code: 'AG-001',
  });
  must(ok === true && card.clicks() === 1, 'legacy 隔离域合法路径必须点击一次');
});

await check('P3 identityMode:null 启动前按畸形拒绝，不与动作期模式语义分裂', () => {
  const out = parseAgentIdentityProfile({
    identityMode: null,
    itemContainer: '.card', cardFields: { name: '.name', code: '.code' },
    listApi: {
      pathname: '/api/agents/query', method: 'GET', queryParam: 'nameLike',
      recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
      fields: { id: 'id', code: 'code', name: 'name' },
    },
  });
  must(out.ok === false, '显式 null 必须 fail-closed；只有字段缺席才是 legacy');
});

console.log(`agent-network-code-page-context: ${passed} passed, ${failures.length} failed`);
for (const failure of failures) console.error(`FAIL ${failure}`);
process.exit(failures.length ? 1 : 0);

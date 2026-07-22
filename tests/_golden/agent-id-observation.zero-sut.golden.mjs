#!/usr/bin/env node
// agent-id-readback · 身份观察事务协议金牌（zero-SUT，纯 node，禁 SUT/浏览器/网络）。
//
// 判据权威：docs/plans/agent-id-readback/plan.md §1（请求级事务协议）+
// accept/interface-spec.md §1（createIdentityObservationLedger 签名冻结）。
// 红先行：lib/agent-identity-observation.mjs 缺席时，所有检查逐条判红（红因=模块缺席，
// 不是测试自身崩溃），exit 1。
//
// 检查面（每条独立 check，独立 ledger）：
//   O1        arm→onRequestWillBeSent 归属冻结：arm 前的请求不入账；
//   O2a-O2c   晚 body 回原 token（sol 攻击：A seal 后晚到 body 不得进 B；
//             B 的 settle 必须等 B 自己的终态；sealed token 不得被晚 body 造出 ok）；
//   O3a-O3c   settle 等全部请求显式终态（parsed/failed/timeout/invalid 都是终态；
//             failed≠空数组语义）；
//   O4a-O4b   seal 后新请求不入本 token；consume 一次性（二次 consume→'consumed'）；
//   O5a-O5b   多响应按 requestSeq 序管理：rows 不一致→'conflict'，一致集合放行；
//   O6a-O6e   ledger 复验有界：>200 行 / 字段空串 / id 非全数字 string /
//             id JSON number 形态（含越过安全整数）→该响应 invalid 整页拒（禁过滤坏行）；
//   O7        未 settle 就 consume→'unsettled'；
//   O8a-O8b   有界终态 + seal 先决（codex R1-M1 修复钉）：settle({timeoutMs}) 界内写显式 timeout；
//             未 seal 即 consume→'unsealed'；
//   O9        查询回声判据（codex R1-H2）：queryEcho≠expectedQuery 的请求不入账→'empty'；
//   O10a-O10d hasNextPath 声明即义务（codex R1-H3）：缺席/null/0/true 皆 invalid、严格 false 才 ok、
//             未声明时投影携 hasNext 亦 invalid；
//   O11a-O11e 采集器纯函数面（codex R1-H2/H4）：同源+queryParam 判据、跨源/异路径拒、
//             200 失败信封 failed、非 2xx failed、正控 parsed。

import { isDeepStrictEqual } from 'node:util';

const TAG = 'agent-id-observation';
let failures = 0;
let passes = 0;
const red = (label, detail) => { failures += 1; console.error(`RED  ${TAG}: ${label}: ${detail}`); };
const ok = (label) => { passes += 1; console.log(`ok   ${TAG}: ${label}`); };

// ---- 被测模块（红先行：现在不存在，动态 import 捕获缺席）----
const MODULE_REL = '../../lib/agent-identity-observation.mjs';
let createLedger = null;
let absentReason = null;
try {
  const mod = await import(new URL(MODULE_REL, import.meta.url).href);
  if (typeof mod.createIdentityObservationLedger === 'function') {
    createLedger = mod.createIdentityObservationLedger;
  } else {
    absentReason = '模块存在但未导出 createIdentityObservationLedger';
  }
} catch (e) {
  absentReason = e?.code === 'ERR_MODULE_NOT_FOUND'
    ? `模块缺席（${e.code}）——lib/agent-identity-observation.mjs 尚未实现，红先行`
    : `模块加载失败（${e?.code ?? e?.name}: ${e?.message}）`;
}

// ---- 夹具 ----
const CHANNEL = Object.freeze({
  pathname: '/api/agents/query',
  method: 'GET',
  recordsPath: 'data.records',
  totalPath: 'data.total',
  hasNextPath: null,
  fields: Object.freeze({ id: 'agentId', code: 'agentCode', name: 'agentName' }),
});
const QUERY = 'alice';
const req = (requestSeq) => ({
  requestSeq,
  method: 'GET',
  urlPathname: '/api/agents/query',
  urlOrigin: 'http://127.0.0.1:4173',
  queryEcho: QUERY,
});
const armArgs = (intentId, generation = 1) => ({ intentId, generation, expectedQuery: QUERY });
const rowAlice = Object.freeze({ id: '42', code: 'AG-001', name: 'Alice' });
const rowAlicia = Object.freeze({ id: '43', code: 'AG-002', name: 'Alicia' });
const rowPoison = Object.freeze({ id: '666', code: 'AG-666', name: 'Mallory' });
const parsed = (rows) => ({ kind: 'parsed', rows: rows.map((r) => ({ ...r })), total: rows.length });

// ---- 断言与探针 ----
class CheckFail extends Error {}
const must = (cond, detail) => { if (!cond) throw new CheckFail(detail); };
const mustDeepEq = (actual, expected, what) => {
  must(isDeepStrictEqual(actual, expected),
    `${what} 不等：实得 ${JSON.stringify(actual)} ≠ 期望 ${JSON.stringify(expected)}`);
};
// 微任务级 pending 探针：settle 在缺终态时绝不可在微任务窗口内解决
const probeState = async (p) => {
  let state = 'pending';
  p.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  return state;
};
// 有界等待：settle 该解决时必须在界内解决（金牌不悬挂）
const awaitBounded = async (p, what, ms = 5000) => {
  let timer = null;
  const outcome = await Promise.race([
    p.then(() => 'resolved', (e) => { throw new CheckFail(`${what} 被 reject：${e?.message}`); }),
    new Promise((res) => { timer = setTimeout(res, ms, 'deadline'); }),
  ]);
  if (timer) clearTimeout(timer);
  must(outcome === 'resolved', `${what} 未在 ${ms}ms 界内解决（settle 悬挂）`);
};

const check = async (label, fn) => {
  if (!createLedger) { red(label, `${absentReason}；检查无法执行，判红`); return; }
  try {
    await fn();
    ok(label);
  } catch (e) {
    if (e instanceof CheckFail) red(label, e.message);
    else red(label, `检查执行异常（非断言）：${e?.stack?.split('\n')[0] ?? e}`);
  }
};

// ---- O1 arm 前的请求不入账 ----
await check('O1 arm 前请求不入账（归属在 requestWillBeSent 冻结，无 armed token 不入账）', async () => {
  const ledger = createLedger({ channel: CHANNEL });
  ledger.onRequestWillBeSent(req(1)); // arm 之前——不得入任何 token
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(2));
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowPoison]) }); // 无主终态
  ledger.onBodyTerminal({ requestSeq: 2, outcome: parsed([rowAlice]) });
  await awaitBounded(ledger.settle(token), 'settle');
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status === 'ok', `期望 status 'ok'，实得 ${JSON.stringify(out.status)}`);
  mustDeepEq(out.rows, [rowAlice], 'rows（arm 前请求的行绝不得混入）');
  must(out.total === 1, `total 期望 1，实得 ${JSON.stringify(out.total)}`);
});

// ---- O2 晚 body 回原 token（sol 三攻击之一：跨事务污染）----
{
  // 共享一次攻击序列，三条独立判据分三个 check（各自独立 ledger 重演，保持 check 独立性）
  const runAttack = async () => {
    const ledger = createLedger({ channel: CHANNEL });
    const tokenA = ledger.arm(armArgs('intent-A', 1));
    ledger.onRequestWillBeSent(req(1)); // A 的请求，loadingFinished 后 body 延迟
    ledger.seal(tokenA); // A 未等到 body 即封存
    const tokenB = ledger.arm(armArgs('intent-B', 2));
    ledger.onRequestWillBeSent(req(2)); // B 自己的请求
    const settleB = ledger.settle(tokenB);
    settleB.catch(() => {});
    ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowPoison]) }); // A 的晚到 body
    return { ledger, tokenA, tokenB, settleB };
  };

  await check('O2a B 的 settle 不被 A 的晚到终态误判满足（必须等 B 自己的终态）', async () => {
    const { ledger, tokenB, settleB } = await runAttack();
    const state = await probeState(settleB);
    must(state === 'pending', `A 晚 body 到达后 settle(B) 状态=${state}（期望仍 pending）`);
    ledger.onBodyTerminal({ requestSeq: 2, outcome: parsed([rowAlice]) });
    await awaitBounded(settleB, 'settle(B)');
    ledger.seal(tokenB);
  });

  await check('O2b A seal 后的晚到 body 不得进 token B（consume(B) 无污染行）', async () => {
    const { ledger, tokenB, settleB } = await runAttack();
    ledger.onBodyTerminal({ requestSeq: 2, outcome: parsed([rowAlice]) });
    await awaitBounded(settleB, 'settle(B)');
    ledger.seal(tokenB);
    const out = ledger.consume(tokenB);
    must(out.status === 'ok', `期望 status 'ok'，实得 ${JSON.stringify(out.status)}`);
    mustDeepEq(out.rows, [rowAlice], 'rows（B 只见 B 自己的响应）');
    must(!JSON.stringify(out).includes(rowPoison.id), 'A 的污染行 id 出现在 consume(B) 结果里');
  });

  await check('O2c sealed 的 A 不得被晚到 body 造出 ok 信封（只能回 A 生前账或落 lateDrops）', async () => {
    const { ledger, tokenA } = await runAttack();
    const out = ledger.consume(tokenA);
    must(out.status !== 'ok', `A 未 settle 即 seal 且 body 晚到被丢弃，consume(A) 不得为 'ok'，实得 ${JSON.stringify(out)}`);
  });
}

// ---- O3 settle 等全部请求显式终态 ----
await check('O3a settle 等全部请求：一请求未终态则 pending，failed 也是显式终态', async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onRequestWillBeSent(req(2));
  const settling = ledger.settle(token);
  settling.catch(() => {});
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowAlice]) });
  const state = await probeState(settling);
  must(state === 'pending', `仅 1/2 请求终态时 settle 状态=${state}（期望仍 pending）`);
  ledger.onBodyTerminal({ requestSeq: 2, outcome: { kind: 'failed' } });
  await awaitBounded(settling, 'settle（failed 终态到齐后）');
});

await check("O3b failed≠空数组语义：唯一请求 failed 后 consume 绝不得是 ok+rows:[]", async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onBodyTerminal({ requestSeq: 1, outcome: { kind: 'failed' } });
  await awaitBounded(ledger.settle(token), 'settle');
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status !== 'ok', `failed 被冒充成功信封：实得 ${JSON.stringify(out)}`);
});

await check('O3c timeout 与 invalid 同为显式终态：settle 不悬挂，consume 非 ok', async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onRequestWillBeSent(req(2));
  ledger.onBodyTerminal({ requestSeq: 1, outcome: { kind: 'timeout' } });
  ledger.onBodyTerminal({ requestSeq: 2, outcome: { kind: 'invalid' } });
  await awaitBounded(ledger.settle(token), 'settle（timeout/invalid 终态）');
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status !== 'ok', `timeout/invalid 被冒充成功信封：实得 ${JSON.stringify(out)}`);
});

// ---- O4 seal 后新请求不入本 token；consume 一次性 ----
{
  const sealedThenConsume = async () => {
    const ledger = createLedger({ channel: CHANNEL });
    const token = ledger.arm(armArgs('intent-A'));
    ledger.onRequestWillBeSent(req(1));
    ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowAlice]) });
    await awaitBounded(ledger.settle(token), 'settle');
    ledger.seal(token);
    // seal 之后到达的新请求：无 armed token，不得入已封存事务
    ledger.onRequestWillBeSent(req(2));
    ledger.onBodyTerminal({ requestSeq: 2, outcome: parsed([rowPoison]) });
    return { ledger, token };
  };

  await check('O4a seal 后新请求不入本 token（consume 只见封存前的账）', async () => {
    const { ledger, token } = await sealedThenConsume();
    const out = ledger.consume(token);
    must(out.status === 'ok', `期望 status 'ok'，实得 ${JSON.stringify(out.status)}`);
    mustDeepEq(out.rows, [rowAlice], 'rows（seal 后请求的行绝不得混入）');
  });

  await check("O4b consume 一次性：二次 consume→'consumed'", async () => {
    const { ledger, token } = await sealedThenConsume();
    const first = ledger.consume(token);
    must(first.status === 'ok', `首次 consume 期望 'ok'，实得 ${JSON.stringify(first.status)}`);
    const second = ledger.consume(token);
    must(second.status === 'consumed', `二次 consume 期望 'consumed'，实得 ${JSON.stringify(second.status)}`);
  });
}

// ---- O5 多响应按 requestSeq 序；rows 不一致→conflict ----
await check("O5a 两响应 rows 不一致→'conflict'（完成序倒置也不得取『最近』蒙混）", async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onRequestWillBeSent(req(2));
  // 终态按完成序倒置到达：seq2 先、seq1 后——管理必须按 requestSeq 序，不按完成序
  ledger.onBodyTerminal({ requestSeq: 2, outcome: parsed([rowAlicia]) });
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowAlice]) });
  await awaitBounded(ledger.settle(token), 'settle');
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status === 'conflict', `期望 'conflict'，实得 ${JSON.stringify(out)}`);
});

await check('O5b 多响应集合一致（rows 相等）不误判冲突，按 requestSeq 序取完整终态放行', async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onRequestWillBeSent(req(2));
  ledger.onBodyTerminal({ requestSeq: 2, outcome: parsed([rowAlice]) });
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowAlice]) });
  await awaitBounded(ledger.settle(token), 'settle');
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status === 'ok', `期望 'ok'，实得 ${JSON.stringify(out.status)}`);
  mustDeepEq(out.rows, [rowAlice], 'rows');
});

// ---- O6 ledger 复验有界：整页任一坏行=整页 invalid（禁过滤后判唯一）----
{
  const consumeWithRows = async (rows, total = rows.length) => {
    const ledger = createLedger({ channel: CHANNEL });
    const token = ledger.arm(armArgs('intent-A'));
    ledger.onRequestWillBeSent(req(1));
    ledger.onBodyTerminal({ requestSeq: 1, outcome: { kind: 'parsed', rows, total } });
    await awaitBounded(ledger.settle(token), 'settle');
    ledger.seal(token);
    return ledger.consume(token);
  };
  const mustWholePageInvalid = (out, what) => {
    must(out.status === 'invalid', `${what} 期望整页 'invalid'，实得 ${JSON.stringify(out.status)}`);
    must(!(out.status === 'ok'), `${what} 被过滤坏行后冒充合法页`);
  };

  await check("O6a 行数 >200（201 行）→该响应 'invalid'", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ id: String(1000 + i), code: `AG-${i}`, name: `N${i}` }));
    mustWholePageInvalid(await consumeWithRows(rows), '201 行');
  });

  await check("O6b 字段空串→整页 'invalid'（禁过滤坏行后拿好行判唯一）", async () => {
    const out = await consumeWithRows([{ ...rowAlice }, { id: '7', code: '', name: 'Bob' }]);
    mustWholePageInvalid(out, '含空串字段行');
    must(!isDeepStrictEqual(out.rows, [rowAlice]), '坏行被静默过滤、好行被放行（假唯一注入面）');
  });

  await check("O6c id 非全数字 string（'12a3'）→整页 'invalid'", async () => {
    const out = await consumeWithRows([{ ...rowAlice }, { id: '12a3', code: 'AG-002', name: 'Bob' }]);
    mustWholePageInvalid(out, '含非全数字 id 行');
  });

  await check("O6d id 以 JSON number 形态传入（安全整数也拒，禁 String(Number(id)) 洗白）→整页 'invalid'", async () => {
    const out = await consumeWithRows([{ ...rowAlice }, { id: 123, code: 'AG-003', name: 'Carol' }]);
    mustWholePageInvalid(out, '含 number 形态 id 行');
  });

  await check("O6e id 为越过安全整数的 JSON number→整页 'invalid'（无损字符串义务）", async () => {
    const out = await consumeWithRows([{ id: Number.MAX_SAFE_INTEGER + 2, code: 'AG-004', name: 'Dave' }]);
    mustWholePageInvalid(out, '越过安全整数的 number id');
  });
}

// ---- O7 未 settle 就 consume→'unsettled' ----
await check("O7 未 settle 就 consume→'unsettled'（请求未达终态，禁未决消费）", async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1)); // 无终态
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status === 'unsettled', `期望 'unsettled'，实得 ${JSON.stringify(out.status)}`);
});

// ---- O8 有界终态 + seal 先决（codex R1-M1 修复钉；interface-spec §1「有界，注入时钟可测」）----
await check('O8a settle 有界：请求永不终态时 settle({timeoutMs}) 界内解决且该请求显式 timeout 终态、consume 非 ok', async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1)); // 永不喂终态——账本自己必须在界内写 timeout
  await awaitBounded(ledger.settle(token, { timeoutMs: 50 }), 'settle({timeoutMs:50})', 2000);
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status !== 'ok', `timeout 终态被冒充成功信封：实得 ${JSON.stringify(out)}`);
  must(out.status !== 'unsettled', `settle 超时后请求仍无终态（账本未写显式 timeout）：实得 ${JSON.stringify(out.status)}`);
});

await check("O8b consume 前必须 seal：settle 完但未 seal 即 consume→'unsealed'（未封存事务禁消费）", async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowAlice]) });
  await awaitBounded(ledger.settle(token), 'settle');
  const out = ledger.consume(token); // 未 seal
  must(out.status === 'unsealed', `期望 'unsealed'，实得 ${JSON.stringify(out.status)}（未封存事务被放行消费）`);
});

await check("O8c 消费即出账（codex R2-M1 引用释放观察面）：consume 后同 seq 晚到终态按未归属丢弃（lateDrops 不增）、复消费恒 'consumed'", async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A'));
  ledger.onRequestWillBeSent(req(1));
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowAlice]) });
  await awaitBounded(ledger.settle(token), 'settle');
  ledger.seal(token);
  must(ledger.consume(token).status === 'ok', '前置：首次 consume 应 ok');
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowPoison]) }); // 已出账 seq 的晚到终态
  must(ledger.lateDropCount() === 0, `已消费事务的晚到终态应按未归属丢弃（反查表已释放），lateDrops 实得 ${ledger.lateDropCount()}`);
  must(ledger.consume(token).status === 'consumed', '复消费应恒 consumed（一次性语义不因释放受损）');
});

// ---- O9 查询回声判据（codex R1-H2 修复钉）：expectedQuery 不符的请求不入事务 ----
await check("O9 queryEcho≠expectedQuery 的请求不入账：唯一请求为异查询→consume 'empty'（绝不消费别人查询的完整集合）", async () => {
  const ledger = createLedger({ channel: CHANNEL });
  const token = ledger.arm(armArgs('intent-A')); // expectedQuery=QUERY('alice')
  ledger.onRequestWillBeSent({ ...req(1), queryEcho: 'mallory' }); // 异查询——不得入账
  ledger.onBodyTerminal({ requestSeq: 1, outcome: parsed([rowPoison]) });
  ledger.seal(token);
  const out = ledger.consume(token);
  must(out.status === 'empty', `期望 'empty'（异查询请求不入账、事务零合格请求），实得 ${JSON.stringify(out)}`);
  must(!JSON.stringify(out).includes(rowPoison.id), '异查询响应的行混进了 consume 结果（查询回声判据失守）');
});

// ---- O10 hasNextPath 声明即义务（codex R1-H3 修复钉）----
{
  const CHANNEL_PAGED = Object.freeze({ ...CHANNEL, hasNextPath: 'data.hasNext' });
  const consumePagedWith = async (extra) => {
    const ledger = createLedger({ channel: CHANNEL_PAGED });
    const token = ledger.arm(armArgs('intent-A'));
    ledger.onRequestWillBeSent(req(1));
    ledger.onBodyTerminal({ requestSeq: 1, outcome: { kind: 'parsed', rows: [{ ...rowAlice }], total: 1, ...extra } });
    await awaitBounded(ledger.settle(token), 'settle');
    ledger.seal(token);
    return ledger.consume(token);
  };
  await check("O10a 声明 hasNextPath 但字段缺席（投影 undefined）→'invalid'（缺席不是完整页证据）", async () => {
    const out = await consumePagedWith({ hasNext: undefined });
    must(out.status === 'invalid', `期望 'invalid'，实得 ${JSON.stringify(out.status)}`);
  });
  await check("O10b 声明 hasNextPath 且值非严格 false（null/0/true 各一）→'invalid'", async () => {
    for (const bad of [null, 0, true]) {
      const out = await consumePagedWith({ hasNext: bad });
      must(out.status === 'invalid', `hasNext=${JSON.stringify(bad)} 期望 'invalid'，实得 ${JSON.stringify(out.status)}`);
    }
  });
  await check("O10c 声明 hasNextPath 且严格 false→'ok'（正控：义务可满足）", async () => {
    const out = await consumePagedWith({ hasNext: false });
    must(out.status === 'ok', `期望 'ok'，实得 ${JSON.stringify(out.status)}`);
  });
  await check("O10d 未声明 hasNextPath 但投影携 hasNext→'invalid'（投影异常拒，禁静默放行）", async () => {
    const ledger = createLedger({ channel: CHANNEL });
    const token = ledger.arm(armArgs('intent-A'));
    ledger.onRequestWillBeSent(req(1));
    ledger.onBodyTerminal({ requestSeq: 1, outcome: { kind: 'parsed', rows: [{ ...rowAlice }], total: 1, hasNext: false } });
    await awaitBounded(ledger.settle(token), 'settle');
    ledger.seal(token);
    const out = ledger.consume(token);
    must(out.status === 'invalid', `期望 'invalid'，实得 ${JSON.stringify(out.status)}`);
  });
}

// ---- O11 采集器纯函数面（codex R1-H2/H4 修复钉；lib/replay-forensics.mjs 导出）----
{
  let matchIdentityRequest = null;
  let projectIdentityEnvelope = null;
  let collectorAbsent = null;
  try {
    const mod = await import(new URL('../../lib/replay-forensics.mjs', import.meta.url).href);
    matchIdentityRequest = typeof mod.matchIdentityRequest === 'function' ? mod.matchIdentityRequest : null;
    projectIdentityEnvelope = typeof mod.projectIdentityEnvelope === 'function' ? mod.projectIdentityEnvelope : null;
    if (!matchIdentityRequest || !projectIdentityEnvelope) collectorAbsent = '采集器未导出 matchIdentityRequest/projectIdentityEnvelope（修复前红）';
  } catch (e) {
    collectorAbsent = `采集器加载失败（${e?.code ?? e?.name}）`;
  }
  const collectorCheck = async (label, fn) => {
    if (collectorAbsent) { red(label, `${collectorAbsent}；检查无法执行，判红`); return; }
    await check(label, fn);
  };
  const COLLECTOR_CHANNEL = Object.freeze({ ...CHANNEL, queryParam: 'nameLike' });
  const ORIGIN = 'http://127.0.0.1:4173';
  const OK_URL = `${ORIGIN}/api/agents/query?nameLike=alice`;
  const OK_BODY = JSON.stringify({ status: 200, data: { records: [{ agentId: '42', agentCode: 'AG-001', agentName: 'Alice' }], total: 1 } });

  await collectorCheck('O11a 同源+method+pathname+queryParam 命中→回声按剖面 queryParam 提取（正控）', async () => {
    const m = matchIdentityRequest(OK_URL, 'GET', { channel: COLLECTOR_CHANNEL, sutOrigin: ORIGIN });
    must(m && m.queryEcho === 'alice' && m.urlOrigin === ORIGIN, `期望命中且 queryEcho='alice'，实得 ${JSON.stringify(m)}`);
  });
  await collectorCheck('O11b 跨源同路径请求不入身份通道（origin 精确等，codex R1-H2）', async () => {
    const m = matchIdentityRequest('http://evil.example:4173/api/agents/query?nameLike=alice', 'GET', { channel: COLLECTOR_CHANNEL, sutOrigin: ORIGIN });
    must(m === null, `期望 null（跨源拒），实得 ${JSON.stringify(m)}`);
  });
  await collectorCheck('O11c pathname 必须精确等（子串/超集路径拒）', async () => {
    const m = matchIdentityRequest(`${ORIGIN}/api/agents/query2?nameLike=alice`, 'GET', { channel: COLLECTOR_CHANNEL, sutOrigin: ORIGIN });
    must(m === null, `期望 null，实得 ${JSON.stringify(m)}`);
  });
  await collectorCheck("O11d HTTP 200 的 API 失败信封（successField 不符）→'failed'（codex R1-H4：绝不当成功身份页）", async () => {
    const body = JSON.stringify({ status: 500, msg: 'server error', data: { records: [{ agentId: '42', agentCode: 'AG-001', agentName: 'Alice' }], total: 1 } });
    const out = projectIdentityEnvelope(body, 200, { channel: COLLECTOR_CHANNEL, successField: 'status', successValue: 200 });
    must(out.kind === 'failed', `期望 'failed'，实得 ${JSON.stringify(out.kind)}（200 失败信封被当成功页消费）`);
  });
  await collectorCheck("O11e 非 2xx 明确成功态之外（302）→'failed'；2xx+成功信封→'parsed'（正控）", async () => {
    const redirected = projectIdentityEnvelope(OK_BODY, 302, { channel: COLLECTOR_CHANNEL, successField: 'status', successValue: 200 });
    must(redirected.kind === 'failed', `302 期望 'failed'，实得 ${JSON.stringify(redirected.kind)}`);
    const okOut = projectIdentityEnvelope(OK_BODY, 200, { channel: COLLECTOR_CHANNEL, successField: 'status', successValue: 200 });
    must(okOut.kind === 'parsed' && Array.isArray(okOut.rows) && okOut.total === 1, `正控期望 parsed，实得 ${JSON.stringify(okOut.kind)}`);
  });
}

// ---- 收口 ----
const total = passes + failures;
if (failures > 0) {
  console.error(`RED  ${TAG}: ${failures}/${total} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${total}/${total} 检查全过`);

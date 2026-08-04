#!/usr/bin/env node
// chief-stream-replylog-import：chat.sendAndWait 在流取证记录在场时不得抛 ReferenceError。
// 根因（2026-08-04 真机失败两轮 + 只读探针 hermetic 复现坐实）：compile-atoms-agent.mjs 使用
// requestLogPath 回填 observed[].replyStreamUrl，但 import 清单漏了它——流记录一在场必抛，
// 使真机 compile 恒败于第 5 步且 observed 永远无法首次落 replyStreamUrl/replyText。
// 零 SUT、零网络；夹具只复现调用形状，不另造语义。

const TAG = 'chief-stream-replylog-import';
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
    failures.push(`${name}: ${error?.message || error}`);
    console.error(`RED  ${TAG}: ${name}: ${error?.message || error}`);
  }
}

const { compileChatSendAndWait } = await import('../../lib/compile-atoms-agent.mjs');

// 忠实复现生产因果纪律：回填 replyText 要求回复相对发送前基线有变化（气泡数增或文本异），
// 故替身在点击后回复数 1→2、末泡文本变化——不许拿恒定文本冒充「有回复」。
function makeChatDouble() {
  const state = { clicked: false };
  const currentText = () => (state.clicked ? 'reply-arrived' : 'baseline-reply');
  const fakeLocator = () => ({
    count: async () => (state.clicked ? 2 : 1),
    // last() 返回的仍是 locator：生产等待器会对它再调 count()（恰一条末泡）。
    last: () => ({
      count: async () => 1,
      innerText: async () => currentText(),
    }),
    innerText: async () => currentText(),
  });
  return { state, fakeLocator };
}

async function runCase({ withStreamRecord }) {
  const observed = [{ atom: 'chat.sendAndWait', replyText: null, replyStreamUrl: null }];
  const { state, fakeLocator } = makeChatDouble();
  // 流记录必须出现在发送点击之后（recMark 在点击前取），与真实流一致。
  const records = [];
  const onClick = () => {
    state.clicked = true;
    if (withStreamRecord) {
      records.push({
        type: 'EventSource',
        url: 'https://sut.invalid/ai-api/tester/agent/stream?x=1',
        streamFinished: true,
      });
    }
  };
  const run = {
    ctx: {},
    observed,
    blockers: [],
    notes: [],
    page: { locator: fakeLocator },
    forensics: { records: () => records },
    newIntent: () => 'intent_1',
    emit: async (ev) => {
      if (ev && ev.action === 'click') onClick();
      return { resolution: 'unique', acted: true, stepId: 'step_5' };
    },
  };
  let threw = null;
  try {
    await compileChatSendAndWait(run, { prompt: 'x' });
  } catch (error) {
    threw = error;
  }
  return { threw, observed, run };
}

await check('S1 流记录在场：不抛，且 replyStreamUrl 首次落为脱敏路径', async () => {
  const { threw, observed } = await runCase({ withStreamRecord: true });
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 120)}`);
  assert(observed[0].replyStreamUrl === '/ai-api/tester/agent/stream',
    `replyStreamUrl 应为脱敏 pathname：${JSON.stringify(observed[0].replyStreamUrl)}`);
  assert(observed[0].replyText === 'reply-arrived',
    `replyText 应回填变化后的回复（因果纪律：相对基线有变才算）：${JSON.stringify(observed[0].replyText)}`);
});

await check('S2 无流记录：不抛，replyStreamUrl 保持 null（既有行为回归钉）', async () => {
  const { threw, observed } = await runCase({ withStreamRecord: false });
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 120)}`);
  assert(observed[0].replyStreamUrl === null,
    `无流记录时应保持 null：${JSON.stringify(observed[0].replyStreamUrl)}`);
});

await check('S3 持久动作证据在两种形态下都保全（不因回填故障丢失）', async () => {
  const a = await runCase({ withStreamRecord: true });
  const b = await runCase({ withStreamRecord: false });
  for (const [label, r] of [['有流', a], ['无流', b]]) {
    const ev = r.run.persistentActionEvidence;
    assert(ev && ev.status === 'CONFIRMED',
      `${label}：persistentActionEvidence 须为 CONFIRMED：${JSON.stringify(ev)}`);
  }
});

await check('S4 结构钉：compile-atoms-agent 的 import 清单包含 requestLogPath', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/compile-atoms-agent.mjs', import.meta.url), 'utf8');
  const importLine = src.split('\n').find((l) => l.includes("from './compile-atoms-support.mjs'"));
  assert(importLine && importLine.includes('requestLogPath'),
    `import 清单须含 requestLogPath：${importLine}`);
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);

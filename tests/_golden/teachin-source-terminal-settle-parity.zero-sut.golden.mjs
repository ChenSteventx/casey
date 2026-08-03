#!/usr/bin/env node
// source raw terminal observation 必须与 distilled formal runner 共用同一有界静默点，
// 不能在 click Promise 刚完成、SPA 终端 DOM 尚未稳定时抢采 signed hard assertion。
// 纯内存 temporal page；零 SUT/browser/network/credentials/LLM。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanonicalRawObservationCollector,
} from '../../lib/teachin/raw-event-observation.mjs';

const TAG = 'teachin-source-terminal-settle-parity';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
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
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function temporalPage({ hostile = false } = {}) {
  const facts = {
    settleTicks: 0,
    terminalTextReads: 0,
    firstTerminalTextReadAtTick: null,
  };
  const page = {
    url: () => 'http://casey.invalid/workflows',
    locator: () => ({ count: async () => 0 }),
    getByRole: () => ({ count: async () => 0 }),
    getByText: () => ({
      async count() {
        facts.terminalTextReads += 1;
        if (facts.firstTerminalTextReadAtTick === null) {
          facts.firstTerminalTextReadAtTick = facts.settleTicks;
        }
        if (hostile) throw new Error('synthetic terminal read unavailable');
        // 模拟 click 返回后 SPA 仍需四拍才挂出 terminal 文本。
        return facts.settleTicks >= 4 ? 1 : 0;
      },
      async evaluateAll() {
        return facts.settleTicks >= 4 ? 1 : 0;
      },
    }),
    async evaluate(fn) {
      const source = String(fn);
      // terminal toast 的同刻快照，不是 settle tick。
      if (source.includes('document.querySelectorAll')) {
        return { all: [], visible: [] };
      }
      // shared settleBeforeCapture 的 DOM tick。
      if (source.includes('document.body')) {
        facts.settleTicks += 1;
        if (hostile) throw new Error('synthetic settle snapshot unavailable');
        const len = facts.settleTicks === 1 ? 100 : 101;
        return { len, placeholderGone: true };
      }
      throw new Error('unexpected synthetic evaluate');
    },
  };
  return { page, facts };
}

function hardTextAssertion() {
  return {
    kind: 'textVisible', op: 'visible', value: 'SYNTHETIC_TERMINAL_ANCHOR',
  };
}

async function capture(temporal, forensics) {
  const collector = createCanonicalRawObservationCollector({
    page: temporal.page,
    profile: {},
    countSelector: '.agent-card',
    buttons: null,
    forensics,
  });
  await collector.captureBaseline({ seq: 2, assertionUniverse: [hardTextAssertion()] });
  return collector.captureTerminal({
    seq: 2,
    assertionUniverse: [hardTextAssertion()],
    actionAxis: { resolution: 'unique', identityReadback: { ok: true } },
  });
}

const oldFloor = process.env.REPLAY_SETTLE_FLOOR_MS;
const oldBudget = process.env.REPLAY_SETTLE_BUDGET_MS;
process.env.REPLAY_SETTLE_FLOOR_MS = '0';
process.env.REPLAY_SETTLE_BUDGET_MS = '1000';

try {
  await check('S1 source terminal 先走 shared settle，再采异步挂载的 signed 文本', async () => {
    const temporal = temporalPage();
    let inFlightReads = 0;
    const terminal = await capture(temporal, {
      inFlightCount() {
        inFlightReads += 1;
        return 0;
      },
    });
    assert(terminal.textHits.SYNTHETIC_TERMINAL_ANCHOR === 1,
      `source terminal 抢采旧 DOM：text hit=${terminal.textHits.SYNTHETIC_TERMINAL_ANCHOR ?? 'unknown'}`);
    assert(temporal.facts.firstTerminalTextReadAtTick >= 4,
      `terminal text read 发生在 settle 前：tick=${temporal.facts.firstTerminalTextReadAtTick}`);
    assert(inFlightReads >= 3,
      `source settle 未消费 exact runtime forensics.inFlightCount：reads=${inFlightReads}`);
  });

  await check('S2 settle 观察失败仍有界且断言保持 unknown，绝不假 true', async () => {
    process.env.REPLAY_SETTLE_BUDGET_MS = '60';
    const temporal = temporalPage({ hostile: true });
    let inFlightReads = 0;
    const started = Date.now();
    const terminal = await capture(temporal, {
      inFlightCount() {
        inFlightReads += 1;
        throw new Error('synthetic in-flight unavailable');
      },
    });
    const elapsed = Date.now() - started;
    assert(elapsed < 1500, `hostile settle 未有界收口：elapsedMs=${elapsed}`);
    assert(!Object.hasOwn(terminal.textHits, 'SYNTHETIC_TERMINAL_ANCHOR'),
      'terminal 证不出却伪造 textVisible 命中');
    assert(inFlightReads >= 1, 'hostile path 未实际经过 shared in-flight observation');
  });

  await check('S3 production raw collector 真调用共享 settle helper，禁止 fixed sleep 替身', () => {
    const source = readFileSync(resolve(ROOT, 'lib/teachin/raw-event-observation.mjs'), 'utf8');
    assert(/import\s*\{[^}]*settleBeforeCapture[^}]*\}\s*from\s*['"]\.\.\/replay-settle\.mjs['"]/.test(source),
      'raw observation 未 import shared settleBeforeCapture');
    const at = source.indexOf('async captureTerminal');
    const tail = at >= 0 ? source.slice(at, at + 1800) : '';
    const settleAt = tail.indexOf('settleBeforeCapture(');
    const terminalAt = tail.indexOf('captureIntentObservationTerminal(');
    assert(settleAt >= 0 && terminalAt > settleAt,
      'raw captureTerminal 未在 terminal observation 前真调用 shared settle');
    assert(!/setTimeout\s*\(|\bsleep\s*\(/.test(tail.slice(0, terminalAt)),
      'raw terminal settle 不得用 fixed sleep 冒充共享条件式静默点');
  });
} finally {
  if (oldFloor === undefined) delete process.env.REPLAY_SETTLE_FLOOR_MS;
  else process.env.REPLAY_SETTLE_FLOOR_MS = oldFloor;
  if (oldBudget === undefined) delete process.env.REPLAY_SETTLE_BUDGET_MS;
  else process.env.REPLAY_SETTLE_BUDGET_MS = oldBudget;
}

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);

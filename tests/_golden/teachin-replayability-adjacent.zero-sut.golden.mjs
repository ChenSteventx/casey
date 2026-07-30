#!/usr/bin/env node
// 示教双回放邻接基线：冻结现役 capture 降权、topology projection 与 CLI 脱敏分类。

import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { projectCapture, validateCaptureFidelity } from '../../lib/record-distill.mjs';
import { normalizeTopologySequence } from '../../lib/page-topology/topology-events.mjs';
import { emitCompileCliFailure } from '../../lib/execution-target/cli-boundary.mjs';

const TAG = 'teachin-replayability-adjacent';
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
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

await check('A1 capture 保持 signed=false/replayReady=false/distillRequired=true 且 host 安全', () => {
  const capture = buildTeachInCapture({
    caseId: 'tc_adjacent',
    startUrl: 'https://capture-adjacent.invalid/private?x=1#frag',
    createdAt: '2026-07-27T00:00:00.000Z',
    events: [{
      action: 'click',
      path: 'https://capture-adjacent.invalid/list?x=1#frag',
      selector: '[data-testid="open"]',
      text: '打开',
    }],
  });
  assert(capture.source?.signed === false, 'capture 必须未签');
  assert(capture.source?.replayReady === false, 'capture 必须不可直通 replay');
  assert(capture.source?.distillRequired === true, 'capture 必须要求 distill');
  const text = JSON.stringify(capture);
  assert(!text.includes('capture-adjacent.invalid') && !text.includes('://'),
    'capture 不得保留 host/scheme');
});

await check('A2 newpage 仍归前一业务 intent，且不创建独立业务 step', () => {
  const capture = {
    caseId: 'tc_adjacent',
    events: [
      { seq: 1, action: 'click', path: '/agents', text: '打开' },
      { seq: 2, action: 'newpage', path: '/agents/detail?mode=read' },
    ],
  };
  const out = projectCapture(capture);
  assert(out.candidateTestCase.steps.length === 1, 'newpage 不得创建独立 TestCase step');
  assert(out.projection.length === 2, 'projection 必须保留 click+newpage');
  assert(out.projection[1].action === 'newpage', 'newpage action 丢失');
  assert(out.projection[1].intentId === out.projection[0].intentId,
    'newpage 必须归触发 click intent');
});

await check('A3 topology normalization 保持 click→newpage 顺序和安全 path', () => {
  const out = normalizeTopologySequence({
    format: 'capture',
    events: [
      { action: 'click', path: '/agents' },
      { action: 'newpage', path: '/agents/detail?mode=read' },
    ],
  });
  assert(out.ok === true, `topology 正控应通过：${out.reason}`);
  assert(out.sequence?.length === 1, 'normalized topology handoff 丢失或重复');
  assert(out.sequence?.[0]?.afterActionIndex === 0, 'handoff 必须归第一个 click');
  assert(out.sequence?.[0]?.path === '/agents/detail?mode=read', '安全 path/query 漂移');
});

await check('A4 fidelity 闸继续拒绝无 capture 证据的 mapping', () => {
  const out = validateCaptureFidelity({
    mapping: [{ intentId: 'i_missing', atom: 'workflow.open' }],
    projection: [{ intentId: 'i1', eventSeq: 1, action: 'click', pathHint: '/agents' }],
    pending: [{ intentId: 'i1', eventSeq: 1, action: 'click', reason: 'pending' }],
  });
  assert(out.ok === false, '无 capture evidence 的 mapping 必须拒绝');
  assert(out.problems.some((problem) => problem.startsWith('NO_CAPTURE_EVIDENCE')),
    '拒绝必须具名 NO_CAPTURE_EVIDENCE');
});

await check('A5 普通 compile 异常固定脱敏，execution-target 原因保持分类', () => {
  const sink = () => {
    let value = '';
    return { write: (chunk) => { value += String(chunk); }, text: () => value };
  };
  const generic = sink();
  const genericExit = emitCompileCliFailure({
    failure: new Error('ENOTDIR https://should-not-leak.invalid/private'),
    stderr: generic,
  });
  assert(genericExit === 1 && generic.text() === 'compile 失败\n',
    '普通 compile 异常须固定文案/exit1');
  const target = sink();
  const targetExit = emitCompileCliFailure({
    failure: { reason: 'NAVIGATION_ORIGIN_MISMATCH' },
    stderr: target,
  });
  assert(targetExit === 1 && target.text() === 'casey compile: NAVIGATION_ORIGIN_MISMATCH\n',
    'execution-target 稳定原因不得漂移');
  assert(!`${generic.text()}${target.text()}`.includes('should-not-leak'),
    '输出不得泄漏异常原文');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

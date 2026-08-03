#!/usr/bin/env node
// canonical preflight 之后的 formal replay 分层：event navigation / axes projection 不得
// 一律洗成 RUN_COMPLETION_INVALID；成功路径必须保持 prepared 五键并由 role seam 补齐七键。
// 纯内存 seam doubles；零 SUT/browser/network/credentials/LLM。

import { createPreparedRun } from '../../lib/replay/prepared-run.mjs';
import { ReplayNavigationAbort } from '../../lib/replay/navigation.mjs';
import { createRoleAxesSeam } from '../../lib/teachin/raw-axes-adapter.mjs';

const TAG = 'teachin-prepared-formal-stage-refusal';
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

const token = () => Object.freeze(Object.create(null));
const RUN = token();
const FRESH = token();
const TOPOLOGY = token();
const OWNER = token();
const TARGET = token();
const PAGE = token();
const EXECUTION = token();
const EVENT_INPUT = Object.freeze({ events: Object.freeze([]) });
const AXES_INPUT = Object.freeze({ caseId: 'tc_formal_stage' });
const EVIDENCE = Object.freeze({ actionByStep: new Map() });
const AXES_TEXT = `${JSON.stringify({ caseId: 'tc_formal_stage', steps: [] }, null, 2)}\n`;

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function input() {
  return {
    runExecutionAuthority: RUN,
    freshRuntimeAuthority: FRESH,
    topologyAuthority: TOPOLOGY,
    runtimeOwnerAuthority: OWNER,
    executionTargetAuthority: TARGET,
  };
}

function runner({ runEvents, projectAxes }) {
  return createPreparedRun({
    inspectClaimedReplayRuntime() {
      return {
        ok: true, page: PAGE, execution: EXECUTION,
        eventRunnerInput: EVENT_INPUT, axesProjectionInput: AXES_INPUT,
      };
    },
    runCanonicalPreflight() {
      return {
        ok: true, eventRunnerInput: EVENT_INPUT, axesProjectionInput: AXES_INPUT,
      };
    },
    runReplayEvents: runEvents,
    projectReplayAxes: projectAxes,
  });
}

await check('P1 preflight 后导航 abort 必须保留稳定 NAVIGATION_FAILED，且 axes 零调用', async () => {
  let axesCalls = 0;
  const prepared = runner({
    async runEvents() { throw new ReplayNavigationAbort('NAVIGATION_FAILED'); },
    projectAxes() { axesCalls += 1; return AXES_TEXT; },
  });
  const result = await prepared.runPreparedReplay(input());
  assert(result?.ok === false && result.reason === 'NAVIGATION_FAILED',
    `导航 abort 被洗码：${JSON.stringify(result)}`);
  assert(axesCalls === 0 && !result.axesBytes && !result.evidence,
    'event 失败必须零 axes 且不发布半成品');
});

await check('P2 event evidence 成功但 axes projector 抛错必须稳定 RAW_AXES_PROJECTION_FAILED', async () => {
  let eventCalls = 0;
  const prepared = runner({
    async runEvents() { eventCalls += 1; return EVIDENCE; },
    projectAxes() { throw new Error('PRIVATE_AXES_FAILURE'); },
  });
  const result = await prepared.runPreparedReplay(input());
  assert(result?.ok === false && result.reason === 'RAW_AXES_PROJECTION_FAILED',
    `axes throw 被洗码：${JSON.stringify(result)}`);
  assert(eventCalls === 1 && !result.axesBytes && !result.evidence,
    'axes 失败不得发布 evidence/axes 半成品');
});

await check('P3 event+axes 成功保持 prepared 五键，role seam 补齐 completion 七键且 authority 同一', async () => {
  const prepared = runner({
    async runEvents() { return EVIDENCE; },
    projectAxes() { return AXES_TEXT; },
  });
  const replayed = await prepared.runPreparedReplay(input());
  assert(exactKeys(replayed, [
    'ok', 'runExecutionAuthority', 'runtimeOwnerAuthority', 'axesBytes', 'evidence',
  ]), `prepared success 不是闭合五键：${JSON.stringify(replayed)}`);
  assert(replayed.ok === true && replayed.runExecutionAuthority === RUN
    && replayed.runtimeOwnerAuthority === OWNER
    && replayed.evidence === EVIDENCE && Buffer.isBuffer(replayed.axesBytes),
  'prepared success 必须保持 exact run/owner/evidence 绑定');

  const artifacts = Object.freeze({
    candidateBytes: Buffer.from('{}'), eventsBytes: Buffer.from('{}'),
    entityLockBytes: Buffer.from('[]'),
  });
  const execution = Object.freeze({
    freshRuntimeAuthority: FRESH, topologyAuthority: TOPOLOGY,
    runtimeOwnerAuthority: OWNER, executionTargetAuthority: TARGET,
    expectedBytes: Buffer.from(JSON.stringify({
      caseId: 'tc_formal_stage', intents: [{ intentId: 'intent_1', expected: [] }],
    })),
    artifacts,
  });
  const role = createRoleAxesSeam({
    role: 'distilled',
    projectAxes() { return AXES_TEXT; },
    runVerdict() {
      return { steps: [{ intentId: 'intent_1', verdict: 'PASS', reason: null }] };
    },
  });
  const completion = await role.sealFormalRun({
    runExecutionAuthority: RUN, execution,
    async runFormalReplay(options) {
      assert(options.runExecutionAuthority === RUN
        && options.runtimeOwnerAuthority === OWNER,
      'role seam 下传 authority 必须 exact');
      return replayed;
    },
  });
  assert(exactKeys(completion, [
    'ok', 'runExecutionAuthority', 'runtimeOwnerAuthority', 'artifacts',
    'axesBytes', 'verdictBytes', 'evidence',
  ]), `completion success 不是闭合七键：${JSON.stringify(completion)}`);
  assert(completion.ok === true && completion.runExecutionAuthority === RUN
    && completion.runtimeOwnerAuthority === OWNER && completion.artifacts === artifacts
    && Buffer.isBuffer(completion.axesBytes) && Buffer.isBuffer(completion.verdictBytes),
  'completion success 必须保持 exact run/owner/artifacts 并发布 axes/verdict bytes');
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);

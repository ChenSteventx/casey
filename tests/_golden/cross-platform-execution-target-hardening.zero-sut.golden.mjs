#!/usr/bin/env node
// 独立复核补门：动作前 origin、登录等待窗、显式 transport 与报告输出封口。
// 全部使用合成 URL/page double；零真实配置、零 SUT、零 browser、零 network。

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import {
  projectExecutionTargetRuntime,
} from '../../lib/execution-target/runtime.mjs';
import { resolveCliExecutionTarget } from '../../lib/execution-target/wiring.mjs';
import { runReplayEvents } from '../../lib/replay/event-runner.mjs';
import { ReplayNavigationAbort } from '../../lib/replay/navigation.mjs';
import { createCompileRun } from '../../lib/compile-atoms-run.mjs';
import { loginBootstrap } from '../../lib/login-bootstrap.mjs';
import { projectReplayAxes } from '../../lib/replay-axes.mjs';

const TAG = 'cross-platform-execution-target-hardening';
const START = 'https://hardening-logical.invalid:9443/same?seed=QUERY_SENTINEL#FRAGMENT_SENTINEL';
const OTHER = 'https://hardening-drift.invalid:7443/same?leak=REDIRECT_QUERY#REDIRECT_FRAGMENT';
const ENDPOINT = 'http://127.0.0.1:15519';
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

function authority() {
  const resolved = resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: START },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  });
  assert(resolved?.ok === true, '合成 execution target authority 应成功');
  return {
    authority: resolved.authority,
    runtime: projectExecutionTargetRuntime(resolved.authority),
  };
}

function emptyLocator() {
  return {
    async count() { return 0; },
    first() { return this; },
    last() { return this; },
    async innerText() { return ''; },
    async evaluateAll() { return 0; },
  };
}

await check('H1 replay 同 pathname 跨 origin 漂移时 action dispatch 必须为 0', async () => {
  const execution = authority();
  const calls = { dispatch: 0, close: 0 };
  const page = {
    url() { return OTHER; },
    async close() { calls.close += 1; },
    locator() { return emptyLocator(); },
    getByText() { return emptyLocator(); },
    getByRole() { return emptyLocator(); },
    async evaluate() { return 0; },
  };
  const event = {
    stepId: 'atstep_1',
    intentId: 'intent_1',
    atom: 'agent.searchOpen',
    action: 'fill',
    value: 'synthetic-name',
    pre: { path: '/same' },
  };
  const forensics = {
    records() { return []; },
    inFlightCount() { return 0; },
    async awaitStreamsSettled() {},
    async drain() {},
  };
  let rejection = null;
  const oldFloor = process.env.REPLAY_SETTLE_FLOOR_MS;
  const oldBudget = process.env.REPLAY_SETTLE_BUDGET_MS;
  process.env.REPLAY_SETTLE_FLOOR_MS = '0';
  process.env.REPLAY_SETTLE_BUDGET_MS = '1';
  try {
    await runReplayEvents({
      page,
      execution,
      args: {},
      events: [event],
      intentEvents: new Map([['intent_1', [event]]]),
      reprStepOf: new Map([['intent_1', 'atstep_1']]),
      profile: {},
      ctx: { identityTokens: new Map() },
      forensics,
      state: { currentStepId: null },
      guardAborts: [],
      expectedByIntent: new Map(),
      globalAssertions: [],
      countSelector: '.synthetic-row',
      buttons: null,
      caseId: 'tc_hardening_replay',
      videoStartedAt: Date.now(),
      log() {},
      dispatchAction: async () => {
        calls.dispatch += 1;
        return { resolution: 'unique', identityReadback: { ok: true } };
      },
    });
  } catch (error) {
    rejection = error;
  } finally {
    if (oldFloor === undefined) delete process.env.REPLAY_SETTLE_FLOOR_MS;
    else process.env.REPLAY_SETTLE_FLOOR_MS = oldFloor;
    if (oldBudget === undefined) delete process.env.REPLAY_SETTLE_BUDGET_MS;
    else process.env.REPLAY_SETTLE_BUDGET_MS = oldBudget;
  }
  assert(rejection instanceof ReplayNavigationAbort
    && rejection.reason === 'NAVIGATION_ORIGIN_MISMATCH',
  `跨 origin 应稳定中止：${rejection?.reason || rejection?.name || 'none'}`);
  assert(calls.dispatch === 0, `跨 origin 后 dispatch 必须为 0，实际 ${calls.dispatch}`);
  assert(calls.close === 1, `跨 origin 后 close 必须恰一次，实际 ${calls.close}`);
});

await check('H2 compile 非 nav 动作前必须核对 origin，拒绝后不得执行 customAct', async () => {
  const execution = authority();
  const calls = { action: 0, close: 0 };
  const page = {
    url() { return OTHER; },
    async close() { calls.close += 1; },
  };
  const run = createCompileRun({
    page,
    forensics: { records() { return []; } },
    state: { currentStepId: null },
    sut: START,
    uniqueName: 'synthetic',
    site: {},
    executionTargetAuthority: execution.authority,
    executionTargetRuntime: execution.runtime,
  });
  run.quietPoint = async () => true;
  run.capture = async () => {};
  const result = await run.emit({
    intentId: run.newIntent(),
    atom: 'agent.searchOpen',
    action: 'fill',
    value: 'synthetic-name',
  }, async () => {
    calls.action += 1;
    return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
  });
  assert(calls.action === 0, `跨 origin 后 customAct 必须为 0，实际 ${calls.action}`);
  assert(calls.close === 1, `跨 origin 后 close 必须恰一次，实际 ${calls.close}`);
  assert(result?.resolution === 'action_failed' && result.acted === false,
    `compile 应 fail-closed：${JSON.stringify(result)}`);
  assert(run.blockers.length >= 1, 'compile origin 拒绝必须留下 blocker，禁止产成功编译件');
});

await check('H3 登录等待表单期间漂移 origin 必须复核，不得误判已登录', async () => {
  const execution = authority();
  const calls = { url: 0, close: 0, fill: 0, submit: 0 };
  let drifted = false;
  const userBox = {
    first() {
      return {
        async waitFor() {
          drifted = true;
          throw new Error('synthetic form absent after redirect');
        },
      };
    },
    async fill() { calls.fill += 1; },
  };
  const page = {
    async goto() {},
    url() {
      calls.url += 1;
      return drifted ? OTHER : START;
    },
    async close() { calls.close += 1; },
    getByRole(role) {
      if (role === 'textbox') return userBox;
      return { async click() { calls.submit += 1; } };
    },
  };
  const result = await loginBootstrap(page, {
    site: {
      login: {
        pathMarker: '/login',
        user: { role: 'textbox', name: '账号' },
        pass: { role: 'textbox', name: '密码' },
        submit: { role: 'button', name: '登录' },
      },
    },
    creds: { user: 'CREDENTIAL_USER_SENTINEL', pass: 'CREDENTIAL_PASS_SENTINEL' },
    startUrl: START,
    executionTargetAuthority: execution.authority,
    timeoutMs: 1,
  });
  assert(result?.ok === false && result.reason === 'NAVIGATION_ORIGIN_MISMATCH',
    `等待窗漂移应稳定拒绝：${JSON.stringify(result)}`);
  assert(calls.close === 1 && calls.fill === 0 && calls.submit === 0,
    `等待窗漂移不得填充或提交：${JSON.stringify(calls)}`);
});

await check('H4 WSL 未显式选择 transport 时必须 direct，不得自动推断 legacy', () => {
  const resolved = resolveCliExecutionTarget({
    site: { target: { startUrl: START, devProxyUrl: ENDPOINT } },
    cliSut: ENDPOINT,
    runtime: { platform: 'linux', isWSL: true },
    requiresOriginContinuity: false,
  });
  assert(resolved?.ok === true, `WSL canonical direct 应准入：${JSON.stringify(resolved)}`);
  assert(resolved.receipt?.transportMode === 'direct'
    && resolved.receipt?.originContinuity === 'preserved',
  `未显式 transport 不得 legacy：${JSON.stringify(resolved.receipt)}`);
});

await check('H5 pageerror message 投影不得把规范 URL 带进 axes/报告', () => {
  const event = {
    stepId: 'atstep_1',
    intentId: 'intent_1',
    atom: 'agent.searchOpen',
    action: 'fill',
  };
  const text = projectReplayAxes({
    caseId: 'tc_hardening_output',
    records: [],
    intentOrder: ['intent_1'],
    intentEvents: new Map([['intent_1', [event]]]),
    reprStepOf: new Map([['intent_1', 'atstep_1']]),
    actionByStep: new Map([['atstep_1', {
      resolution: 'unique',
      identityReadback: { ok: true },
    }]]),
    pageErrors: [{
      attributedStepId: 'atstep_1',
      message: `synthetic failure at ${START}`,
    }],
    intentCount: new Map(),
    expectedByIntent: new Map(),
    globalAssertions: [],
    intentUrl: new Map(),
    intentToasts: new Map(),
    intentTextHits: new Map(),
    intentButtonHits: new Map(),
    intentButtonSeen: new Map(),
    intentButtonDisabledHits: new Map(),
    intentReply: new Map(),
    intentInputReadback: new Map(),
    chatCfg: null,
    allStepIds: new Set(['atstep_1']),
  });
  for (const fragment of [
    'hardening-logical',
    'QUERY_SENTINEL',
    'FRAGMENT_SENTINEL',
    '://',
  ]) {
    assert(!text.includes(fragment), `axes 泄漏 pageerror 片段 ${fragment}`);
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

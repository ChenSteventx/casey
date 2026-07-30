#!/usr/bin/env node
// Formal replay inside an already claimed runtime. In-memory doubles only:
// zero SUT/browser/network/LLM and no credential/config reads.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-prepared-run';
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
    const message = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${message}`);
    console.error(`RED  ${TAG}: ${name}: ${message}`);
  }
}

let api;
try {
  api = await import('../../lib/replay/prepared-run.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

const token = () => Object.freeze(Object.create(null));
const RUN_EXECUTION = token();
const FRESH = token();
const TOPOLOGY = token();
const OWNER = token();
const TARGET = token();
const PAGE = token();
const EXECUTION = token();
const EVENT_RUNNER_INPUT = Object.freeze({
  caseId: 'tc_prepared_run',
  events: Object.freeze([Object.freeze({
    stepId: 'atstep_0',
    intentId: 'i1',
    atom: 'nav.workflowManagement',
    action: 'nav',
  })]),
});
const AXES_INPUT = Object.freeze({
  caseId: 'tc_prepared_run',
  intentOrder: Object.freeze(['i1']),
});
const EVIDENCE = Object.freeze({
  actionByStep: new Map([['atstep_0', Object.freeze({
    resolution: 'unique',
    candidateCount: 1,
    identityReadback: Object.freeze({ ok: true }),
  })]]),
  intentUrl: new Map([['i1', '/workflow']]),
});
const AXES_TEXT = `${JSON.stringify({
  caseId: 'tc_prepared_run',
  steps: [{ stepId: 'atstep_0', intentId: 'i1' }],
}, null, 2)}\n`;

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function validInput(overrides = {}) {
  return {
    runExecutionAuthority: RUN_EXECUTION,
    freshRuntimeAuthority: FRESH,
    topologyAuthority: TOPOLOGY,
    runtimeOwnerAuthority: OWNER,
    executionTargetAuthority: TARGET,
    ...overrides,
  };
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应拒 ${reason}：${JSON.stringify(result)}`);
  assert(!result.axesBytes && !result.evidence,
    `${label} 失败不得发布 axes/evidence`);
}

function makePreparedRun(options = {}) {
  const order = [];
  const stats = {
    inspect: 0,
    preflight: 0,
    events: 0,
    axes: 0,
    launch: 0,
    login: 0,
    close: 0,
    verdict: 0,
  };
  const runnerInput = Object.freeze({ ...EVENT_RUNNER_INPUT });
  const axesInput = Object.freeze({ ...AXES_INPUT });
  const runnerEvidence = options.evidence || EVIDENCE;

  const prepared = api.createPreparedRun({
    inspectClaimedReplayRuntime(input) {
      order.push('inspect');
      stats.inspect += 1;
      if (input.runExecutionAuthority !== RUN_EXECUTION
        || input.freshRuntimeAuthority !== FRESH
        || input.topologyAuthority !== TOPOLOGY
        || input.runtimeOwnerAuthority !== OWNER
        || input.executionTargetAuthority !== TARGET) {
        return { ok: false, reason: 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH' };
      }
      if (options.inspectThrows) throw new Error('PRIVATE_INSPECT https://must-not-leak.invalid');
      return options.inspectResult || {
        ok: true,
        page: PAGE,
        execution: EXECUTION,
        eventRunnerInput: runnerInput,
        axesProjectionInput: axesInput,
      };
    },

    async runCanonicalPreflight({
      runExecutionAuthority,
      runtimeOwnerAuthority,
      page,
      execution,
      eventRunnerInput,
      axesProjectionInput,
    }) {
      order.push('preflight');
      stats.preflight += 1;
      assert(runExecutionAuthority === RUN_EXECUTION
        && runtimeOwnerAuthority === OWNER,
      'preflight run/owner 换绑');
      assert(page === PAGE && execution === EXECUTION,
        'preflight 必须在 claimed exact page/execution 内');
      assert(eventRunnerInput === runnerInput && axesProjectionInput === axesInput,
        'preflight artifact projection 换绑');
      if (options.preflightThrows) throw new Error('PRIVATE_PREFLIGHT https://must-not-leak.invalid');
      return options.preflightResult || {
        ok: true,
        eventRunnerInput,
        axesProjectionInput,
      };
    },

    async runReplayEvents(input) {
      order.push('events');
      stats.events += 1;
      assert(input === runnerInput,
        'runReplayEvents 必须收到 preflight 原样返回的 exact input');
      if (options.eventsThrows) throw new Error('PRIVATE_EVENTS https://must-not-leak.invalid');
      return options.eventsResult === undefined ? runnerEvidence : options.eventsResult;
    },

    projectReplayAxes(input) {
      order.push('axes');
      stats.axes += 1;
      assert(input?.caseId === axesInput.caseId
        && input?.intentOrder === axesInput.intentOrder,
      'projectReplayAxes base input 换绑');
      assert(input?.actionByStep === runnerEvidence.actionByStep
        && input?.intentUrl === runnerEvidence.intentUrl,
      'projectReplayAxes 必须消费同次 event runner evidence');
      if (options.axesThrows) throw new Error('PRIVATE_AXES https://must-not-leak.invalid');
      return options.axesResult === undefined ? AXES_TEXT : options.axesResult;
    },
  });

  return { prepared, order, stats };
}

if (api) {
  await check('P1 exact claimed runtime 只走 preflight→events→axes，字节不重写', async () => {
    const built = makePreparedRun();
    const result = await built.prepared.runPreparedReplay(validInput());
    assert(built.order.join('>') === 'inspect>preflight>events>axes',
      `prepared replay 顺序不符：${built.order.join('>')}`);
    assert(exactKeys(result, [
      'ok', 'runExecutionAuthority', 'runtimeOwnerAuthority', 'axesBytes', 'evidence',
    ]) && result.ok === true,
    `success 输出不闭合：${JSON.stringify(result)}`);
    assert(result.runExecutionAuthority === RUN_EXECUTION
      && result.runtimeOwnerAuthority === OWNER
      && result.evidence === EVIDENCE,
    'success authority/evidence 换绑');
    assert(Buffer.isBuffer(result.axesBytes)
      && result.axesBytes.equals(Buffer.from(AXES_TEXT, 'utf8')),
    'axes 必须是现役 projector 文本的 exact UTF-8 bytes');
    assert(built.stats.inspect === 1 && built.stats.preflight === 1
      && built.stats.events === 1 && built.stats.axes === 1,
    `prepared stages 必须各一次：${JSON.stringify(built.stats)}`);
    assert(built.stats.launch === 0 && built.stats.login === 0
      && built.stats.close === 0 && built.stats.verdict === 0,
    'prepared run 禁止 launch/login/close/verdict');
  });

  await check('P2 owner/target/topology/fresh/run plain、clone、foreign 在 preflight 前拒', async () => {
    const cases = [
      ['run', { runExecutionAuthority: { ...RUN_EXECUTION } }],
      ['fresh', { freshRuntimeAuthority: { ...FRESH } }],
      ['topology', { topologyAuthority: { ...TOPOLOGY } }],
      ['owner', { runtimeOwnerAuthority: { ...OWNER } }],
      ['target', { executionTargetAuthority: { ...TARGET } }],
    ];
    for (const [label, override] of cases) {
      const built = makePreparedRun();
      expectReason(await built.prepared.runPreparedReplay(validInput(override)),
        'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', label);
      assert(built.stats.inspect === 1 && built.stats.preflight === 0
        && built.stats.events === 0 && built.stats.axes === 0,
      `${label} 换绑不得越过 claimed runtime inspector`);
      assert(built.stats.close === 0, `${label} 拒绝不得关闭 caller runtime`);
    }
  });

  await check('P3 exact input 不接受 page/events/axes/verdict 或生命周期注入', async () => {
    for (const extra of [
      { page: PAGE },
      { events: [] },
      { axesBytes: Buffer.from('{}') },
      { verdict: 'PASS' },
      { launchBrowser: () => {} },
      { closeRuntime: () => {} },
    ]) {
      const built = makePreparedRun();
      expectReason(await built.prepared.runPreparedReplay({
        ...validInput(),
        ...extra,
      }), 'RUN_COMPLETION_INVALID', 'caller injection');
      assert(Object.values(built.stats).every((count) => count === 0),
        'caller injection 必须在 inspector 前拒绝');
    }
  });

  await check('P4 preflight 拒绝/throw/malformed 时 event runner 与 axes 为零', async () => {
    const cases = [
      ['returned', { preflightResult: { ok: false, reason: 'PRIVATE_PREFLIGHT' } }],
      ['thrown', { preflightThrows: true }],
      ['malformed', { preflightResult: { ok: true } }],
    ];
    for (const [label, options] of cases) {
      const built = makePreparedRun(options);
      const result = await built.prepared.runPreparedReplay(validInput());
      expectReason(result, 'RUN_COMPLETION_INVALID', label);
      assert(built.stats.preflight === 1
        && built.stats.events === 0 && built.stats.axes === 0,
      `${label} preflight 失败不得进入 replay/axes`);
      assert(built.stats.close === 0 && !JSON.stringify(result).includes('PRIVATE'),
        `${label} 不得关闭 owner 或泄异常`);
    }
  });

  await check('P5 event runner/axes throw 或 malformed 均 fail-closed 且不碰 owner lifecycle', async () => {
    const cases = [
      ['events throw', { eventsThrows: true }, 0],
      ['events malformed', { eventsResult: null }, 0],
      ['axes throw', { axesThrows: true }, 1],
      ['axes malformed', { axesResult: { text: AXES_TEXT } }, 1],
    ];
    for (const [label, options, expectedAxesCalls] of cases) {
      const built = makePreparedRun(options);
      const result = await built.prepared.runPreparedReplay(validInput());
      expectReason(result, 'RUN_COMPLETION_INVALID', label);
      assert(built.stats.events === 1 && built.stats.axes === expectedAxesCalls,
        `${label} 首错调用数不符：${JSON.stringify(built.stats)}`);
      assert(built.stats.launch === 0 && built.stats.login === 0
        && built.stats.close === 0 && built.stats.verdict === 0,
      `${label} 不得接管 runtime lifecycle 或裁定`);
      assert(!JSON.stringify(result).includes('PRIVATE')
        && !JSON.stringify(result).includes('://'),
      `${label} 失败输出泄漏`);
    }
  });

  await check('P6 inspector throw/malformed 不把私有 page/runtime facts带到失败输出', async () => {
    for (const options of [
      { inspectThrows: true },
      { inspectResult: { ok: true, page: PAGE } },
    ]) {
      const built = makePreparedRun(options);
      const result = await built.prepared.runPreparedReplay(validInput());
      expectReason(result, 'RUN_COMPLETION_INVALID', 'bad inspector');
      assert(built.stats.preflight === 0 && built.stats.events === 0
        && built.stats.axes === 0 && Object.keys(result).length === 2,
      'bad inspector 失败必须闭合且停止');
    }
  });

  await check('P7 canonical source 真接 preflight/event-runner/axes，composer 真调用 prepared method', () => {
    const ownPath = resolve(ROOT, 'lib/replay/prepared-run.mjs');
    const composerPath = resolve(ROOT, 'lib/teachin/runtime-cycle-adapter.mjs');
    assert(existsSync(ownPath) && existsSync(composerPath),
      '缺 prepared-run/composer production module');
    const own = readFileSync(ownPath, 'utf8');
    const composer = readFileSync(composerPath, 'utf8');
    assert(own.includes('./event-runner.mjs') && own.includes('../replay-axes.mjs'),
      'prepared-run 必须静态接现役 event runner + axes projector');
    const withoutImports = own.replace(
      /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/gs,
      '',
    );
    assert(/\brunCanonicalPreflight\s*\(/.test(withoutImports)
      && /\brunReplayEvents\s*\(/.test(withoutImports)
      && /\bprojectReplayAxes\s*\(/.test(withoutImports),
    'prepared-run 必须实际调用 preflight→runReplayEvents→projectReplayAxes');
    const composerImport = composer.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/replay\/prepared-run\.mjs['"]/s,
    );
    assert(composerImport?.[1].includes('createPreparedRun')
      && /\bcreatePreparedRun\s*\(/.test(composer)
      && /\.runPreparedReplay\s*\(/.test(composer),
    'runtime composer 必须静态导入、构造并实际调用 prepared-run');
    for (const forbidden of [
      /@playwright\//,
      /\bruntime-owner\b/,
      /\b(?:chromium|firefox|webkit)\.launch\s*\(/,
      /\b(?:launchBrowser|openFreshReplayRuntime)\s*\(/,
      /\bloginBootstrap\s*\(/,
      /\.close\s*\(/,
      /\b(?:closeRuntime|closeReplayRuntimeOwners)\s*\(/,
      /bin\/verdict\.mjs/,
      /verdict-cli-adapter/,
      /\bcreateSemanticReplayReceipt\s*\(/,
      /\brunFrozenVerdict\s*\(/,
    ]) {
      assert(!forbidden.test(own), `prepared-run 越权命中 ${forbidden}`);
    }
    assert(own.trimEnd().split(/\r?\n/).length < 600,
      'prepared-run production 必须 <600 行');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

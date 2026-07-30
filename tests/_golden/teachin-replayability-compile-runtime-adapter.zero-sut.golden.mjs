#!/usr/bin/env node
// Guided-compile authoring runtime acceptance. In-memory doubles only:
// zero SUT/browser/network/LLM and no credential/config reads.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-compile-runtime-adapter';
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
  api = await import('../../lib/teachin/compile-runtime-adapter.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

const token = () => Object.freeze(Object.create(null));
const SOURCE_CLOSURE = token();
const BASELINE_GRANT = token();
const ATOM_GRANT = token();
const TARGET = token();
const AUTHORING_RUNTIME = token();
const AUTHORING_CLOSURE = token();
const PAGE = token();
const FORENSICS = token();
const STATE = Object.freeze({ currentStepId: null });

const TESTCASE = Object.freeze({
  caseId: 'tc_compile_runtime',
  title: 'guided authoring',
  steps: Object.freeze([Object.freeze({
    intentId: 'i1',
    intent: '进入工作流管理',
  })]),
});
const MAPPING = Object.freeze([Object.freeze({
  intentId: 'i1',
  atom: 'nav.workflowManagement',
  params: Object.freeze({}),
})]);
const FLOW = Object.freeze({
  id: 'tc_compile_runtime',
  name: 'guided authoring',
  category: 'normal',
  steps: Object.freeze([Object.freeze({
    atom: 'nav.workflowManagement',
    params: Object.freeze({}),
    sourceIntentId: 'i1',
  })]),
});
const LINEAGE_PLAN = Object.freeze([Object.freeze({
  mappingKey: 'm1',
  sourceIntentId: 'i1',
})]);
const COMPILED_EVENTS = Object.freeze([Object.freeze({
  stepId: 'atstep_0',
  intentId: 'intent_0',
  atom: 'nav.workflowManagement',
  action: 'nav',
  url: '{{baseUrl}}/workflow',
})]);
const COMPILE_LINEAGE = Object.freeze([Object.freeze({
  mappingKey: 'm1',
  sourceIntentId: 'i1',
  stepIds: Object.freeze(['atstep_0']),
})]);
const MANIFEST = Object.freeze({
  topologyParity: true,
  identityDigest: 'f'.repeat(64),
});
const ROUNDTRIP_CANDIDATE = Object.freeze({
  ok: true,
  developmentOnly: true,
  promotionReady: false,
  candidateTestCase: TESTCASE,
  candidateMapping: MAPPING,
  eventsCandidate: COMPILED_EVENTS,
  compileLineage: COMPILE_LINEAGE,
  manifest: MANIFEST,
});

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function deepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Object.values(value).every((child) => deepFrozen(child, seen));
}

function jsonSame(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validInput(overrides = {}) {
  return {
    atomRoundtripGrant: ATOM_GRANT,
    authoringBaselineGrant: BASELINE_GRANT,
    sourceClosureAuthority: SOURCE_CLOSURE,
    runNamespace: 'run_authoring_compile_runtime',
    executionTargetAuthority: TARGET,
    ...overrides,
  };
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应拒 ${reason}：${JSON.stringify(result)}`);
  assert(!result.candidate && !result.authoringClosureAuthority,
    `${label} 失败不得发布 candidate/closure`);
}

function makeAdapter(options = {}) {
  const order = [];
  const stats = {
    roundtrip: 0,
    lazy: 0,
    open: 0,
    preconditions: 0,
    reset: 0,
    createRun: 0,
    compile: 0,
    close: 0,
    lineage: 0,
  };
  let sourceClosureConsumed = false;
  let atomGrantConsumed = false;
  let releaseClose;
  const closeBarrier = options.deferClose
    ? new Promise((resolveClose) => { releaseClose = resolveClose; })
    : null;
  const run = {
    events: [],
    notes: [],
    blockers: [],
  };

  const adapter = api.createCompileRuntimeAdapter({
    async runAtomRoundtrip(input) {
      order.push('roundtrip');
      stats.roundtrip += 1;
      assert(exactKeys(input, ['atomRoundtripGrant', 'compileAdapter'])
        && typeof input.compileAdapter === 'function',
      'compile runtime 必须只把 grant + lazy compileAdapter 交 canonical roundtrip');
      if (input.atomRoundtripGrant !== ATOM_GRANT || atomGrantConsumed) {
        return { ok: false, reason: 'ATOM_ROUNDTRIP_GRANT_INVALID' };
      }
      atomGrantConsumed = true;
      if (options.bridgeReject) {
        return { ok: false, reason: 'BRIDGE_REJECTED' };
      }
      order.push('lazy-compile');
      stats.lazy += 1;
      let compiled;
      try {
        compiled = await input.compileAdapter({
          candidateTestCase: TESTCASE,
          candidateMapping: MAPPING,
          flow: FLOW,
          lineagePlan: LINEAGE_PLAN,
        });
      } catch {
        return { ok: false, reason: 'COMPILE_REJECTED' };
      }
      if (!exactKeys(compiled, ['ok', 'compiledEvents', 'compileLineage'])
        || compiled.ok !== true) {
        return { ok: false, reason: 'COMPILE_REJECTED' };
      }
      order.push('lineage');
      stats.lineage += 1;
      if (!jsonSame(compiled.compiledEvents, COMPILED_EVENTS)
        || !jsonSame(compiled.compileLineage, COMPILE_LINEAGE)) {
        return { ok: false, reason: 'COMPILE_LINEAGE_MISMATCH' };
      }
      if (options.roundtripResult !== undefined) return options.roundtripResult;
      return ROUNDTRIP_CANDIDATE;
    },

    async openFreshAuthoringRuntime({
      sourceClosureAuthority,
      authoringBaselineGrant,
      runNamespace,
      executionTargetAuthority,
    }) {
      if (sourceClosureAuthority !== SOURCE_CLOSURE
        || executionTargetAuthority !== TARGET
        || runNamespace !== 'run_authoring_compile_runtime'
        || sourceClosureConsumed) {
        return { ok: false, reason: 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH' };
      }
      if (authoringBaselineGrant !== BASELINE_GRANT) {
        return { ok: false, reason: 'AUTHORING_BASELINE_GRANT_INVALID' };
      }
      sourceClosureConsumed = true;
      order.push('open');
      stats.open += 1;
      if (options.openResult) return options.openResult;
      return {
        ok: true,
        authoringRuntimeAuthority: AUTHORING_RUNTIME,
        page: PAGE,
        forensics: FORENSICS,
        state: STATE,
      };
    },

    async executeAuthoringPreconditions({
      authoringRuntimeAuthority,
      candidateTestCase,
      executionTargetAuthority,
    }) {
      order.push('preconditions');
      stats.preconditions += 1;
      assert(authoringRuntimeAuthority === AUTHORING_RUNTIME,
        'precondition runtime authority 换绑');
      assert(jsonSame(candidateTestCase, TESTCASE)
        && deepFrozen(candidateTestCase)
        && executionTargetAuthority === TARGET,
      'precondition contract/target 换绑');
      if (options.preconditionThrows) throw new Error('PRIVATE_PRECONDITION https://must-not-leak.invalid');
      return options.preconditionResult || { ok: true };
    },

    async verifyAuthoringReset({
      authoringRuntimeAuthority,
      authoringBaselineGrant,
      runNamespace,
      executionTargetAuthority,
    }) {
      order.push('reset');
      stats.reset += 1;
      assert(authoringRuntimeAuthority === AUTHORING_RUNTIME,
        'reset runtime authority 换绑');
      if (authoringBaselineGrant !== BASELINE_GRANT
        || runNamespace !== 'run_authoring_compile_runtime'
        || executionTargetAuthority !== TARGET) {
        return { ok: false, reason: 'AUTHORING_BASELINE_GRANT_INVALID' };
      }
      if (options.resetThrows) throw new Error('PRIVATE_RESET https://must-not-leak.invalid');
      return options.resetResult || { ok: true };
    },

    createCompileRun(input) {
      order.push('create-run');
      stats.createRun += 1;
      assert(input?.page === PAGE && input?.forensics === FORENSICS
        && input?.state === STATE,
      'createCompileRun 必须收到 exact authoring runtime handles');
      assert(input?.executionTargetAuthority === TARGET,
        'createCompileRun execution target 换绑');
      if (options.createRunThrows) throw new Error('PRIVATE_CREATE_RUN');
      return run;
    },

    async compileFlow(actualRun, flow, { lineagePlan } = {}) {
      order.push('compile-flow');
      stats.compile += 1;
      assert(actualRun === run, 'compileFlow run 换绑');
      assert(jsonSame(flow, FLOW) && jsonSame(lineagePlan, LINEAGE_PLAN),
        'compileFlow 必须收到 grant-bound flow/lineage snapshot');
      assert(deepFrozen(flow) && deepFrozen(lineagePlan),
        'flow/lineage 进入 compiler 前必须深冻结');
      if (options.compileThrows) throw new Error('PRIVATE_COMPILE https://must-not-leak.invalid');
      actualRun.events.push(...COMPILED_EVENTS);
      return options.compileResult === undefined
        ? COMPILE_LINEAGE
        : options.compileResult;
    },

    async closeAuthoringRuntime(input) {
      order.push('close');
      stats.close += 1;
      assert(exactKeys(input, ['authoringRuntimeAuthority'])
        && input.authoringRuntimeAuthority === AUTHORING_RUNTIME,
      'close 必须收到 exact authoring owner 且无 caller 拼接字段');
      if (closeBarrier) await closeBarrier;
      if (options.closeThrows) throw new Error('PRIVATE_CLOSE https://must-not-leak.invalid');
      return options.closeResult || {
        ok: true,
        authoringClosureAuthority: AUTHORING_CLOSURE,
      };
    },
  });

  return {
    adapter,
    order,
    stats,
    releaseClose: () => releaseClose?.(),
  };
}

if (api) {
  await check('C1 exact 五字段经 canonical roundtrip lazy compile，close 后才发布', async () => {
    const built = makeAdapter({ deferClose: true });
    let settled = false;
    const pending = built.adapter.compileAuthoringCandidate(validInput())
      .then((result) => {
        settled = true;
        return result;
      });
    await new Promise((resolveTick) => setImmediate(resolveTick));
    assert(built.order.join('>') === [
      'roundtrip',
      'lazy-compile',
      'open',
      'preconditions',
      'reset',
      'create-run',
      'compile-flow',
      'close',
    ].join('>'), `authoring 顺序不符：${built.order.join('>')}`);
    assert(settled === false, 'exact close 未完成前不得返回 candidate/closure');
    built.releaseClose();
    const result = await pending;
    assert(built.order.at(-1) === 'lineage',
      `roundtrip 应在 close 完成后校验 lineage：${built.order.join('>')}`);
    assert(exactKeys(result, ['ok', 'candidate', 'authoringClosureAuthority'])
      && result.ok === true
      && result.authoringClosureAuthority === AUTHORING_CLOSURE,
    `success 输出不闭合：${JSON.stringify(result)}`);
    assert(jsonSame(result.candidate, ROUNDTRIP_CANDIDATE)
      && deepFrozen(result.candidate),
    'candidate 必须是 canonical roundtrip 的 exact 深冻结结果');
    assert(Object.values(built.stats).every((count) => count === 1),
      `每个 authoring stage 必须恰一次：${JSON.stringify(built.stats)}`);
  });

  await check('C2 五字段 exact input，unknown/caller adapter 在 roundtrip 前拒', async () => {
    for (const input of [
      { ...validInput(), compileAdapter: token() },
      { ...validInput(), entityLockAuthority: token() },
      { ...validInput(), candidate: { compiledEvents: [] } },
      { ...validInput(), fresh: true },
      { ...validInput(), executionTargetAuthority: undefined },
    ]) {
      const built = makeAdapter();
      expectReason(await built.adapter.compileAuthoringCandidate(input),
        'AUTHORING_COMPILE_FAILED', '非法顶层输入');
      assert(Object.values(built.stats).every((count) => count === 0),
        '非法顶层输入不得进入 canonical roundtrip 或打开 runtime');
    }
  });

  await check('C3 atom/bridge 在 lazy open 前拒；source/baseline/target clone fail-closed', async () => {
    const cases = [
      ['atom clone', {}, { atomRoundtripGrant: { ...ATOM_GRANT } },
        'ATOM_ROUNDTRIP_GRANT_INVALID', 0],
      ['bridge reject', { bridgeReject: true }, {},
        'BRIDGE_REJECTED', 0],
      ['source clone', {}, { sourceClosureAuthority: { ...SOURCE_CLOSURE } },
        'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 1],
      ['baseline clone', {}, { authoringBaselineGrant: { ...BASELINE_GRANT } },
        'AUTHORING_BASELINE_GRANT_INVALID', 1],
      ['target clone', {}, { executionTargetAuthority: { ...TARGET } },
        'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 1],
    ];
    for (const [label, options, override, reason, expectedLazy] of cases) {
      const built = makeAdapter(options);
      const result = await built.adapter.compileAuthoringCandidate(validInput(override));
      expectReason(result, reason, label);
      assert(built.stats.createRun === 0 && built.stats.compile === 0,
        `${label} 不得触达 compiler`);
      assert(built.stats.open === 0 && built.stats.close === 0,
        `${label} 首错边界错误：${JSON.stringify(built.stats)}`);
      assert(built.stats.lazy === expectedLazy,
        `${label} lazy compileAdapter 调用边界错误`);
    }
  });

  await check('C4 precondition/reset/compile/lineage 失败都关闭 exact authoring owner一次', async () => {
    const cases = [
      ['precondition', { preconditionResult: { ok: false, reason: 'PRIVATE_PRECONDITION' } },
        'AUTHORING_BASELINE_MISMATCH'],
      ['reset', { resetResult: { ok: false, reason: 'PRIVATE_RESET' } },
        'AUTHORING_BASELINE_MISMATCH'],
      ['compile throw', { compileThrows: true }, 'AUTHORING_COMPILE_FAILED'],
      ['lineage malformed', { compileResult: [{ mappingKey: 'wrong', sourceIntentId: 'i1', stepIds: [] }] },
        'AUTHORING_COMPILE_FAILED'],
    ];
    for (const [label, options, reason] of cases) {
      const built = makeAdapter(options);
      const result = await built.adapter.compileAuthoringCandidate(validInput());
      expectReason(result, reason, label);
      assert(built.stats.close === 1, `${label} 必须关闭 exact authoring owner一次`);
      assert(!JSON.stringify(result).includes('PRIVATE')
        && !JSON.stringify(result).includes('://'),
      `${label} 失败输出泄漏私有详情`);
    }
  });

  await check('C5 compile 已成功但 close 返回失败/throw，仍不发布 candidate/closure', async () => {
    for (const [label, options] of [
      ['returned', { closeResult: { ok: false, reason: 'PRIVATE_CLOSE' } }],
      ['thrown', { closeThrows: true }],
    ]) {
      const built = makeAdapter(options);
      const result = await built.adapter.compileAuthoringCandidate(validInput());
      expectReason(result, 'AUTHORING_RUNTIME_CLOSE_FAILED', label);
      assert(built.stats.compile === 1 && built.stats.close === 1,
        `${label} 应在一次 compile 后一次 close`);
      assert(!JSON.stringify(result).includes('PRIVATE')
        && !JSON.stringify(result).includes('://'),
      `${label} close 失败泄漏`);
    }
  });

  await check('C6 grant/closure 单次消费，成功后不能换参数重跑 authoring', async () => {
    const built = makeAdapter();
    const first = await built.adapter.compileAuthoringCandidate(validInput());
    assert(first?.ok === true, `首次 authoring 应成功：${JSON.stringify(first)}`);
    const replay = await built.adapter.compileAuthoringCandidate(validInput());
    expectReason(replay, 'ATOM_ROUNDTRIP_GRANT_INVALID', 'replayed grants');
    assert(built.stats.open === 1 && built.stats.compile === 1 && built.stats.close === 1,
      'replay 不得第二次 open/compile/close');
  });

  await check('C7 canonical module 真接 atom-roundtrip + compile-atoms，composer 真调用', () => {
    const ownPath = resolve(ROOT, 'lib/teachin/compile-runtime-adapter.mjs');
    const composerPath = resolve(ROOT, 'lib/teachin/runtime-cycle-adapter.mjs');
    assert(existsSync(ownPath) && existsSync(composerPath),
      '缺 compile runtime/composer production module');
    const own = readFileSync(ownPath, 'utf8');
    const composer = readFileSync(composerPath, 'utf8');
    const atomImport = own.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\/atom-roundtrip\.mjs['"]/s,
    );
    const compileImport = own.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/compile-atoms\.mjs['"]/s,
    );
    assert(atomImport?.[1].includes('runAtomRoundtrip'),
      'compile runtime 必须静态导入 canonical runAtomRoundtrip');
    assert(compileImport?.[1].includes('createCompileRun')
      && compileImport?.[1].includes('compileFlow'),
    'compile runtime 必须从现役 compile-atoms façade 静态导入两函数');
    const withoutImports = own.replace(
      /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/gs,
      '',
    );
    assert(/\brunAtomRoundtrip\s*\(/.test(withoutImports)
      && /\bcreateCompileRun\s*\(/.test(withoutImports)
      && /\bcompileFlow\s*\(/.test(withoutImports),
    'compile runtime 必须实际调用 runAtomRoundtrip + createCompileRun + compileFlow');
    assert(!/\bconsumeAtomRoundtripGrant\b/.test(own),
      'compile runtime 禁止复制/旁路 atom-roundtrip grant consumer');
    assert(!/\bentityLockAuthority\b/.test(own)
      && /\bentityLockAuthority\b/.test(composer),
    'entity lock 只归 runtime-cycle post-roundtrip sealer，不得闲置在 compile adapter');
    const composerImport = composer.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\/compile-runtime-adapter\.mjs['"]/s,
    );
    assert(composerImport?.[1].includes('createCompileRuntimeAdapter')
      && /\bcreateCompileRuntimeAdapter\s*\(/.test(composer)
      && /\.compileAuthoringCandidate\s*\(/.test(composer),
    'runtime composer 必须静态导入、构造并实际调用 compile runtime adapter');
    assert(!/(?:bin\/verdict|compareSemanticReplayReceipts|createSemanticReplayReceipt)/.test(own),
      'authoring compile 不得裁定、建 receipt 或比较');
    assert(own.trimEnd().split(/\r?\n/).length < 600,
      'compile-runtime-adapter production 必须 <600 行');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

#!/usr/bin/env node
// Frozen verdict child-process boundary. Zero SUT/browser/network/LLM.

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-verdict-cli-adapter';
const FROZEN_SHA = 'ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53';
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
  api = await import('../../lib/teachin/verdict-cli-adapter.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

function axesDocument(caseId = 'tc_verdict_adapter') {
  const base = (suffix, action, postAssertions, forensics = {
    network: [],
    lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] },
  }) => ({
    stepId: `step_${suffix}`,
    intentId: `intent_${suffix}`,
    atom: `manual.segment.${suffix}`,
    action,
    postAssertions,
    forensics,
  });
  return {
    caseId,
    steps: [
      base('pass', { kind: 'click', resolution: 'unique' }, [
        { kind: 'textVisible', soft: false, ok: true },
      ]),
      base('defect', { kind: 'click', resolution: 'unique' }, [
        { kind: 'textVisible', soft: false, ok: false },
      ], {
        network: [{
          attributedStepId: 'step_defect',
          status: 503,
          errorEnvelope: null,
        }],
        lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] },
      }),
      base('drift', {
        kind: 'click',
        resolution: 'none',
        driftProbe: { sameSignatureUniquePresent: true },
      }, [{ kind: 'textVisible', soft: false, ok: false }]),
      base('ambiguous', {
        kind: 'click',
        resolution: 'ambiguous',
      }, [{ kind: 'textVisible', soft: false, ok: false }]),
    ],
  };
}

const toBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const parseBytes = (value) => JSON.parse(Buffer.from(value).toString('utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function expectFailure(result, reason, label) {
  assert(exactKeys(result, ['ok', 'reason'])
    && result.ok === false && result.reason === reason,
  `${label} 应 exact ${reason}：${JSON.stringify(result)}`);
}

function expectedVerdictFromAxes(input) {
  const states = [
    ['PASS', null],
    ['SUT_DEFECT', null],
    ['HARNESS_ERROR', null],
    ['NEEDS_HUMAN', 'AMBIGUOUS_ACTION'],
  ];
  return {
    caseId: input.caseId,
    steps: input.steps.map((step, index) => ({
      stepId: step.stepId,
      intentId: step.intentId,
      atom: step.atom,
      verdict: states[index][0],
      reason: states[index][1],
    })),
  };
}

function makeDependencies({
  executeJudge,
  removeWorkspace,
  readJudgeBytes,
} = {}) {
  const workspaces = [];
  const executions = [];
  let removed = 0;
  const judge = executeJudge || (({ axesPath, verdictPath }) => {
    const input = JSON.parse(readFileSync(axesPath, 'utf8'));
    writeFileSync(verdictPath, toBytes(expectedVerdictFromAxes(input)));
    return { exitCode: 0 };
  });
  return {
    dependencies: {
      createWorkspace() {
        const directory = mkdtempSync(join(tmpdir(), 'casey-verdict-golden-'));
        const workspace = {
          directory,
          axesPath: join(directory, 'axes.json'),
          verdictPath: join(directory, 'verdict.json'),
        };
        workspaces.push(workspace);
        return workspace;
      },
      writeWorkspaceFile(path, bytes) {
        writeFileSync(path, bytes);
      },
      readWorkspaceFile(path) {
        return readFileSync(path);
      },
      removeWorkspace(workspace) {
        removed += 1;
        if (removeWorkspace) return removeWorkspace(workspace);
        rmSync(workspace.directory, { recursive: true, force: true });
        return undefined;
      },
      readJudgeBytes: readJudgeBytes || (() => readFileSync(resolve(ROOT, 'bin/verdict.mjs'))),
      executeJudge(input) {
        executions.push(input);
        return judge(input);
      },
    },
    executions,
    workspaces,
    removed: () => removed,
  };
}

if (api) {
  await check('V1 frozen judge 字节锚仍与旧 PRD 一致', () => {
    const judge = readFileSync(resolve(ROOT, 'bin/verdict.mjs'));
    const prd = JSON.parse(readFileSync(resolve(ROOT, 'loop/prd-gen-prompts.json'), 'utf8'));
    assert(sha256(judge) === FROZEN_SHA, 'bin/verdict.mjs 已漂移');
    assert(prd?.testChecksums?.['bin/verdict.mjs'] === FROZEN_SHA,
      '旧 PRD judge checksum 锚已漂移');
  });

  await check('V2 canonical adapter 真调 frozen judge 覆盖四态并保持 identity/顺序', async () => {
    assert(api.canonicalVerdictCliAdapter
      && typeof api.canonicalVerdictCliAdapter.runFrozenVerdict === 'function',
    '缺 canonicalVerdictCliAdapter.runFrozenVerdict');
    const input = axesDocument('tc_canonical_four_states');
    const result = await api.canonicalVerdictCliAdapter.runFrozenVerdict({
      axesBytes: toBytes(input),
    });
    assert(exactKeys(result, ['ok', 'verdictBytes']) && result.ok === true
      && Buffer.isBuffer(result.verdictBytes), `canonical result 非 exact success：${JSON.stringify(result)}`);
    const verdict = parseBytes(result.verdictBytes);
    assert(JSON.stringify(verdict) === JSON.stringify(expectedVerdictFromAxes(input)),
      `四态/identity/顺序漂移：${JSON.stringify(verdict)}`);
  });

  await check('V2b factory 冻结 process.execPath/argv/options，同一路径 success cleanup', async () => {
    const built = makeDependencies();
    const adapter = api.createVerdictCliAdapter(built.dependencies);
    const result = await adapter.runFrozenVerdict({
      axesBytes: toBytes(axesDocument('tc_exec_contract')),
    });
    assert(result?.ok === true && built.executions.length === 1,
      'factory success 必须执行 judge 恰一次');
    const execution = built.executions[0];
    assert(exactKeys(execution, [
      'command', 'argv', 'options', 'axesPath', 'verdictPath',
    ]), `executeJudge input 不闭合：${JSON.stringify(execution)}`);
    assert(execution.command === process.execPath
      && JSON.stringify(execution.argv) === JSON.stringify([
        resolve(ROOT, 'bin/verdict.mjs'), '--axes', execution.axesPath,
        '--out', execution.verdictPath,
      ]), `judge command/argv 漂移：${JSON.stringify(execution.argv)}`);
    assert(exactKeys(execution.options, [
      'shell', 'windowsHide', 'timeout', 'maxBuffer',
    ]) && execution.options.shell === false
      && execution.options.windowsHide === true
      && execution.options.timeout === 30_000
      && execution.options.maxBuffer === 1_048_576,
    `execFile options 不闭合：${JSON.stringify(execution.options)}`);
    assert(built.removed() === 1
      && built.workspaces.every((item) => !existsSync(item.directory)),
    'factory success 必须 finally 清理一次');
  });

  await check('V3 canonical concurrent workspaces 不串案，bad input 走 exit65 分流', async () => {
    const [a, b] = await Promise.all([
      api.canonicalVerdictCliAdapter.runFrozenVerdict({
        axesBytes: toBytes(axesDocument('tc_concurrent_a')),
      }),
      api.canonicalVerdictCliAdapter.runFrozenVerdict({
        axesBytes: toBytes(axesDocument('tc_concurrent_b')),
      }),
    ]);
    assert(a.ok === true && b.ok === true, '并发 canonical 调用未同时成功');
    assert(parseBytes(a.verdictBytes).caseId === 'tc_concurrent_a'
      && parseBytes(b.verdictBytes).caseId === 'tc_concurrent_b',
    '并发 workspace 串案');
    const bad = await api.canonicalVerdictCliAdapter.runFrozenVerdict({
      axesBytes: Buffer.from('{}\n'),
    });
    expectFailure(bad, 'VERDICT_INPUT_INVALID', 'bad axes');

    const built = makeDependencies();
    const adapter = api.createVerdictCliAdapter(built.dependencies);
    const results = await Promise.all(['factory_a', 'factory_b'].map((caseId) =>
      adapter.runFrozenVerdict({ axesBytes: toBytes(axesDocument(caseId)) })));
    assert(results.every((result) => result.ok === true)
      && new Set(built.workspaces.map((item) => item.directory)).size === 2
      && built.removed() === 2,
    'factory 并发必须独占 workspace 且 success 全清理');
  });

  await check('V4 factory exact input；caller 不能提交 path/command/env/output facts', async () => {
    const built = makeDependencies();
    const adapter = api.createVerdictCliAdapter(built.dependencies);
    for (const input of [
      {},
      { axesBytes: 'not-buffer' },
      { axesBytes: toBytes(axesDocument()), out: {} },
      { axesBytes: toBytes(axesDocument()), command: 'other' },
      { axesBytes: toBytes(axesDocument()), env: {} },
    ]) {
      expectFailure(await adapter.runFrozenVerdict(input),
        'VERDICT_INPUT_INVALID', 'invalid factory input');
    }
    assert(built.workspaces.length === 0, 'invalid input 不得创建 workspace/执行 judge');
  });

  await check('V5 exit/throw/missing/malformed/stderr 只返回稳定失败且全部清理', async () => {
    const marker = 'PRIVATE_MARKER_MUST_NOT_ESCAPE';
    const cases = [
      ['exit65', 'VERDICT_INPUT_INVALID', () => ({ exitCode: 65, stderr: marker })],
      ['exit1', 'VERDICT_EXECUTION_FAILED', () => ({ exitCode: 1, stderr: marker })],
      ['throw', 'VERDICT_EXECUTION_FAILED', () => { throw new Error(marker); }],
      ['timeout', 'VERDICT_EXECUTION_FAILED', () => {
        const error = new Error(marker);
        error.code = 'ETIMEDOUT';
        throw error;
      }],
      ['missing', 'VERDICT_EXECUTION_FAILED', () => ({ exitCode: 0 })],
      ['malformed', 'VERDICT_EXECUTION_FAILED', ({ verdictPath }) => {
        writeFileSync(verdictPath, '{');
        return { exitCode: 0, stderr: marker };
      }],
    ];
    for (const [label, reason, executeJudge] of cases) {
      const built = makeDependencies({ executeJudge });
      const adapter = api.createVerdictCliAdapter(built.dependencies);
      const result = await adapter.runFrozenVerdict({ axesBytes: toBytes(axesDocument()) });
      expectFailure(result, reason, label);
      assert(!JSON.stringify(result).includes(marker), `${label} 泄漏 stderr/异常内容`);
      assert(built.removed() === 1, `${label} workspace 未恰清理一次`);
    }
  });

  await check('V5b axes Buffer 在读取 judge 前立即复制，调用方后续 mutation 无效', async () => {
    const input = toBytes(axesDocument('tc_immediate_copy'));
    const original = Buffer.from(input);
    const built = makeDependencies({
      readJudgeBytes() {
        input.fill(0x78);
        return readFileSync(resolve(ROOT, 'bin/verdict.mjs'));
      },
    });
    const result = await api.createVerdictCliAdapter(
      built.dependencies,
    ).runFrozenVerdict({ axesBytes: input });
    assert(result?.ok === true
      && parseBytes(result.verdictBytes).caseId === parseBytes(original).caseId
      && built.removed() === 1,
    'adapter 未在任何 dependency 调用前复制 axes bytes');
  });

  await check('V6 unknown key、identity 换绑、乱序与 verdict 形状污染均拒', async () => {
    const attacks = [
      ['top-extra', (out) => { out.extra = true; }],
      ['step-extra', (out) => { out.steps[0].extra = true; }],
      ['case', (out) => { out.caseId = 'tc_other'; }],
      ['step', (out) => { out.steps[0].stepId = 'step_other'; }],
      ['intent', (out) => { out.steps[0].intentId = 'intent_other'; }],
      ['atom', (out) => { out.steps[0].atom = 'other.atom'; }],
      ['order', (out) => { out.steps.reverse(); }],
      ['verdict', (out) => { out.steps[0].verdict = 'CLEAN'; }],
      ['reason-shape', (out) => { out.steps[0].reason = { value: null }; }],
    ];
    for (const [label, mutate] of attacks) {
      const built = makeDependencies({
        executeJudge({ axesPath, verdictPath }) {
          const input = JSON.parse(readFileSync(axesPath, 'utf8'));
          const output = expectedVerdictFromAxes(input);
          mutate(output);
          writeFileSync(verdictPath, toBytes(output));
          return { exitCode: 0 };
        },
      });
      const adapter = api.createVerdictCliAdapter(built.dependencies);
      expectFailure(await adapter.runFrozenVerdict({ axesBytes: toBytes(axesDocument()) }),
        'VERDICT_EXECUTION_FAILED', label);
      assert(built.removed() === 1, `${label} workspace 未清理`);
    }
  });

  await check('V7 judge bytes 漂移拒执行；cleanup 失败覆盖潜在 success', async () => {
    let executed = 0;
    const drift = makeDependencies({
      readJudgeBytes: () => Buffer.from('drift'),
      executeJudge() {
        executed += 1;
        return { exitCode: 0 };
      },
    });
    const driftAdapter = api.createVerdictCliAdapter(drift.dependencies);
    expectFailure(await driftAdapter.runFrozenVerdict({ axesBytes: toBytes(axesDocument()) }),
      'VERDICT_EXECUTION_FAILED', 'judge drift');
    assert(executed === 0 && drift.removed() === 1,
      'judge drift 必须零执行且清理 workspace');

    const cleanup = makeDependencies({
      removeWorkspace() {
        throw new Error('cleanup detail must not escape');
      },
    });
    const cleanupAdapter = api.createVerdictCliAdapter(cleanup.dependencies);
    expectFailure(await cleanupAdapter.runFrozenVerdict({ axesBytes: toBytes(axesDocument()) }),
      'VERDICT_TEMP_CLEANUP_FAILED', 'cleanup failure');
    for (const workspace of cleanup.workspaces) {
      rmSync(workspace.directory, { recursive: true, force: true });
    }
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

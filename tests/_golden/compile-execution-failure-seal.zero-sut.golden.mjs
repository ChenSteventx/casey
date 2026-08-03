#!/usr/bin/env node
// compile --execute 步异常密封：纯内存、零 SUT、零 browser、零 network。
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const TAG = 'compile-execution-failure-seal';
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

let compile;
let failureBoundary;
let emitCompileCliFailure;
try {
  compile = await import('../../lib/compile-atoms.mjs');
  failureBoundary = await import('../../lib/compile-execution-failure.mjs');
  ({ emitCompileCliFailure } = await import('../../lib/execution-target/cli-boundary.mjs'));
} catch (error) {
  console.error(`RED  ${TAG}: 缺生产失败密封模块/接线：${String(error?.code || error?.message || error).slice(-200)}`);
  process.exit(1);
}

const SECRET_ERROR = 'SEEDVAL_RAW_ERROR credential=user@example.invalid token=private';
const SECRET_PARAM = 'SEEDVAL_PARAM_IDENTITY';
const memorySink = () => {
  let value = '';
  return { write(chunk) { value += String(chunk); }, text() { return value; } };
};

function makeRun() {
  return {
    events: [], blockers: [], notes: [], entityBindingProvenance: [], identityObservations: [],
    pendingIdentityObservation: null, assertionAtoms: [], lastIntentId: null, intentN: 0,
    newIntent() { return `intent_${this.intentN++}`; },
    async emit(spec) {
      if (spec.atom === 'workflow.publish') throw new Error(SECRET_ERROR);
      this.events.push({ stepId: `atstep_${this.events.length}`, ...spec });
      return { resolution: 'unique', candidateCount: 1, acted: false };
    },
  };
}

let sealedFailure;
await check('C1 compileFlow 把第二步真实异常收敛成稳定码 + 1-based ordinal + 注册表 atom', async () => {
  const run = makeRun();
  try {
    await compile.compileFlow(run, { steps: [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.publish', params: { identity: SECRET_PARAM } },
    ] });
    throw new Error('异常步不应被吞掉');
  } catch (error) {
    sealedFailure = error;
  }
  assert(sealedFailure?.code === 'COMPILE_ATOM_EXECUTION_FAILED', '缺稳定失败码');
  assert(sealedFailure?.stepOrdinal === 2, `步序必须 1-based=2，实际 ${sealedFailure?.stepOrdinal}`);
  assert(sealedFailure?.atom === 'workflow.publish', `失败 atom 定位错误：${sealedFailure?.atom}`);
  assert(compile.COMPILE_KNOWN_ATOMS.has(sealedFailure.atom), '暴露 atom 必须属于编译动作注册表');
  const registry = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
  assert(Object.hasOwn(registry.atoms || {}, sealedFailure.atom), '暴露 atom 必须同时属于冻结原子注册表快照');
  assert(JSON.stringify(sealedFailure) === '{"code":"COMPILE_ATOM_EXECUTION_FAILED","stepOrdinal":2,"atom":"workflow.publish"}',
    `失败对象只能有三个稳定字段：${JSON.stringify(sealedFailure)}`);
  const exposed = `${String(sealedFailure)}\n${JSON.stringify(sealedFailure)}`;
  for (const secret of [SECRET_ERROR, SECRET_PARAM, 'user@example.invalid', 'token=private']) {
    assert(!exposed.includes(secret), `失败对象泄漏原异常/参数/身份值：${secret}`);
  }
});

await check('C2 未注册 atom 不得借异常诊断回显文件侧值', async () => {
  const secretAtom = 'SEEDVAL_UNREGISTERED_ATOM';
  let failure;
  try {
    await compile.compileFlow(makeRun(), { steps: [{ atom: secretAtom, params: { identity: SECRET_PARAM } }] });
  } catch (error) {
    failure = error;
  }
  assert(failure instanceof Error && /暂无编译知识/u.test(failure.message),
    '未注册 atom 属输入/能力拒绝，须保持既有具名类别而不冒充真实执行失败');
  assert(!`${failure.message}\n${JSON.stringify(failure)}`.includes(secretAtom), '未注册 atom 原值被回显');
});

await check('C3 最小失败 report 只含指定计数与安全定位，不复制 raw error/blocker/身份观察', () => {
  const report = failureBoundary.projectCompileExecutionFailureReport({
    caseId: 'tc_safe_compile_failure',
    failure: sealedFailure,
    knownAtoms: compile.COMPILE_KNOWN_ATOMS,
    destructiveAtoms: new Set(['workflow.publish']),
    run: {
      events: [{}, {}, {}],
      identityObservations: [{ platformId: SECRET_PARAM }, {}],
      blockers: [`blocker ${SECRET_ERROR}`],
      persistentActionEvidence: {
        atom: 'workflow.publish',
        status: 'CONFIRMED',
        stage: 'physical-action-succeeded',
      },
    },
  });
  assert(JSON.stringify(Object.keys(report)) === JSON.stringify([
    'caseId', 'status', 'phase', 'stage', 'failedStepOrdinal', 'failedAtom', 'persistentActionAttempted',
    'persistentActionStatus', 'persistentActionStage',
    'eventsEmitted', 'identityObservationsCaptured', 'blockerCount',
  ]), `report 字段必须最小闭集：${JSON.stringify(Object.keys(report))}`);
  assert(report.caseId === 'tc_safe_compile_failure' && report.status === 'failed' && report.phase === 'execute',
    'report 固定身份/状态/阶段不符');
  assert(report.stage === 'compile-flow', `atom 异常 stage 应为 compile-flow，实际 ${report.stage}`);
  assert(report.failedStepOrdinal === 2 && report.failedAtom === 'workflow.publish', 'report 安全定位不符');
  assert(report.persistentActionAttempted === true, '已进入破坏性失败 atom 时须保守标记持久化动作已尝试');
  assert(report.persistentActionStatus === 'CONFIRMED'
    && report.persistentActionStage === 'physical-action-succeeded',
  '持久化动作必须给出证据状态与安全阶段，而非只给猜测布尔值');
  assert(report.eventsEmitted === 3 && report.identityObservationsCaptured === 2 && report.blockerCount === 1,
    'report 只应投影数组计数');
  const text = JSON.stringify(report);
  for (const secret of [SECRET_ERROR, SECRET_PARAM, 'user@example.invalid', 'token=private']) {
    assert(!text.includes(secret), `report 泄漏原异常/blocker/身份观察：${secret}`);
  }
});

await check('C4 CLI 只输出安全三元组并保持 exit 1；普通异常旧文案不变', () => {
  const stderr = memorySink();
  const exitCode = emitCompileCliFailure({
    failure: sealedFailure,
    phase: 'execute',
    knownAtoms: compile.COMPILE_KNOWN_ATOMS,
    stderr,
  });
  assert(exitCode === 1, `执行异常须保持 exit 1，实际 ${exitCode}`);
  assert(stderr.text() === 'compile: COMPILE_ATOM_EXECUTION_FAILED stepOrdinal=2 atom=workflow.publish\n',
    `CLI 诊断必须稳定且可定位：${JSON.stringify(stderr.text())}`);
  assert(!stderr.text().includes(SECRET_ERROR) && !stderr.text().includes(SECRET_PARAM), 'CLI 泄漏原异常或参数');

  const ordinary = memorySink();
  assert(emitCompileCliFailure({ failure: new Error(SECRET_ERROR), phase: 'execute', stderr: ordinary }) === 1,
    '普通异常 exit 语义不得变化');
  assert(ordinary.text() === 'compile: 执行失败\n', '普通异常固定旧文案不得变化');
});

await check('C5 bin/compile execute catch 真接最小 report 原子写链，成功产物分支保持独立', () => {
  const source = readFileSync(join(ROOT, 'bin', 'compile.mjs'), 'utf8');
  assert(source.includes("from '../lib/compile-execution-failure.mjs'"), 'compile 入口未导入失败 report 投影器');
  assert(/catch\s*\(e\)\s*\{[\s\S]{0,1200}projectCompileExecutionFailureReport\s*\(/u.test(source),
    'execute catch 未在异常事实点投影最小 report');
  assert(/catch\s*\(e\)\s*\{[\s\S]{0,1800}gatedWrite\s*\(\s*\{[\s\S]{0,400}compile-report\.json/u.test(source),
    'execute catch 未复用凭据门 + 临时文件 rename 的原子写链');
  assert(/if\s*\(exitCode\s*===\s*0\)/u.test(source), '成功产物路径须继续由 exitCode===0 独立守门');
});

await check('C6 loginBootstrap 失败独立密封：flow 前稳定码 + 空 atom 定位 + 明确零持久化尝试', () => {
  const loginFailure = failureBoundary.createLoginBootstrapFailure();
  assert(JSON.stringify(loginFailure) === '{"code":"LOGIN_BOOTSTRAP_FAILED_BEFORE_FLOW"}',
    `登录失败对象只准暴露稳定码：${JSON.stringify(loginFailure)}`);
  const report = failureBoundary.projectCompileExecutionFailureReport({
    caseId: 'tc_login_failure',
    failure: loginFailure,
    knownAtoms: compile.COMPILE_KNOWN_ATOMS,
    destructiveAtoms: new Set(['workflow.publish']),
    run: { events: [], identityObservations: [], blockers: [] },
  });
  assert(report.stage === 'login-bootstrap', `登录失败 stage 错误：${report.stage}`);
  assert(report.failedStepOrdinal === null && report.failedAtom === null,
    'flow 前失败不得伪造 step/atom 定位');
  assert(report.persistentActionAttempted === false && report.eventsEmitted === 0,
    '登录失败必须明确未尝试持久化动作且零 event');
  assert(!JSON.stringify(report).includes(SECRET_ERROR), '登录失败 report 泄漏 raw timeout/error');

  const stderr = memorySink();
  const exitCode = emitCompileCliFailure({
    failure: loginFailure,
    phase: 'execute',
    knownAtoms: compile.COMPILE_KNOWN_ATOMS,
    stderr,
  });
  assert(exitCode === 1, '登录失败须保持 exit 1');
  assert(stderr.text() === 'compile: LOGIN_BOOTSTRAP_FAILED_BEFORE_FLOW\n',
    `登录失败 CLI 必须是独立稳定码：${JSON.stringify(stderr.text())}`);

  const source = readFileSync(join(ROOT, 'bin', 'compile.mjs'), 'utf8');
  assert(/try\s*\{[\s\S]{0,800}loginBootstrap\s*\([\s\S]{0,500}catch\s*\{[\s\S]{0,300}createLoginBootstrapFailure\s*\(/u.test(source),
    'bin/compile 未在 loginBootstrap 本地边界先密封再交外层 report catch');
});

await check('C7 chat 持久副作用按物理 click 事实三态裁定，旧 9-event 缺口不得假报 false', () => {
  const chatFailure = failureBoundary.createCompileAtomExecutionFailure({
    stepOrdinal: 5,
    atom: 'chat.sendAndWait',
    knownAtoms: compile.COMPILE_KNOWN_ATOMS,
  });
  const historicalNineEvents = [
    ...Array.from({ length: 6 }, (_, index) => ({
      stepId: `atstep_${index}`,
      atom: 'nav.workflowManagement',
      action: 'nav',
    })),
    { stepId: 'atstep_6', atom: 'chat.sendAndWait', action: 'fill' },
    { stepId: 'atstep_7', atom: 'chat.sendAndWait', action: 'press' },
    { stepId: 'atstep_8', atom: 'chat.sendAndWait', action: 'press' },
  ];
  const historical = failureBoundary.projectCompileExecutionFailureReport({
    caseId: 'tc_chiefcomplaint_smoke',
    failure: chatFailure,
    knownAtoms: compile.COMPILE_KNOWN_ATOMS,
    run: { events: historicalNineEvents, verification: [], identityObservations: [], blockers: [] },
  });
  assert(historical.eventsEmitted === 9, '历史诊断复现必须保持 9 events');
  assert(historical.persistentActionStatus === 'INDETERMINATE'
    && historical.persistentActionAttempted === null,
  `click event 未完成落盘时不得假报 false：${JSON.stringify(historical)}`);
  assert(historical.persistentActionStage === 'click-event-not-recorded',
    `历史证据缺口须具名定位：${historical.persistentActionStage}`);

  const spoofedInferenceStage = {
    events: historicalNineEvents,
    verification: [], identityObservations: [], blockers: [],
    persistentActionEvidence: {
      atom: 'chat.sendAndWait', status: 'CONFIRMED', stage: 'recorded-action-succeeded',
    },
  };
  const spoofed = failureBoundary.projectCompileExecutionFailureReport({
    caseId: 'tc_chiefcomplaint_smoke', failure: chatFailure,
    knownAtoms: compile.COMPILE_KNOWN_ATOMS, run: spoofedInferenceStage,
  });
  assert(spoofed.persistentActionStatus === 'INDETERMINATE'
    && spoofed.persistentActionStage === 'click-event-not-recorded',
  'fallback 推断阶段不得被 caller 塞回 run 冒充 CONFIRMED 强证据');

  const cases = [
    ['input-preparation', 'NOT_ATTEMPTED', false],
    ['before-click-call', 'NOT_ATTEMPTED', false],
    ['physical-click-invoked', 'INDETERMINATE', null],
    ['physical-click-succeeded', 'CONFIRMED', true],
    ['waiting-for-reply', 'CONFIRMED', true],
  ];
  for (const [stage, status, attempted] of cases) {
    const run = { events: historicalNineEvents, verification: [], identityObservations: [], blockers: [] };
    failureBoundary.recordPersistentActionEvidence(run, {
      atom: 'chat.sendAndWait',
      stage,
      status,
    });
    const report = failureBoundary.projectCompileExecutionFailureReport({
      caseId: 'tc_chiefcomplaint_smoke',
      failure: chatFailure,
      knownAtoms: compile.COMPILE_KNOWN_ATOMS,
      run,
    });
    assert(report.persistentActionStage === stage
      && report.persistentActionStatus === status
      && report.persistentActionAttempted === attempted,
    `阶段 ${stage} 三态投影错误：${JSON.stringify(report)}`);
  }

  const priorPersistent = {
    events: [{ stepId: 'atstep_prior', atom: 'workflow.publish', action: 'click' }],
    verification: [{ stepId: 'atstep_prior', acted: true }],
    identityObservations: [], blockers: [],
  };
  failureBoundary.recordPersistentActionEvidence(priorPersistent, {
    atom: 'chat.sendAndWait', status: 'NOT_ATTEMPTED', stage: 'input-preparation',
  });
  const priorReport = failureBoundary.projectCompileExecutionFailureReport({
    caseId: 'tc_prior_persistent', failure: chatFailure,
    knownAtoms: compile.COMPILE_KNOWN_ATOMS, run: priorPersistent,
  });
  assert(priorReport.persistentActionStatus === 'CONFIRMED'
    && priorReport.persistentActionAttempted === true
    && priorReport.persistentActionStage === 'recorded-action-succeeded',
  '当前 chat 尚未 click 的 NOT_ATTEMPTED 不得抹掉本轮此前已确认的持久动作');

  const atomSource = readFileSync(join(ROOT, 'lib', 'compile-atoms-agent.mjs'), 'utf8');
  const runSource = readFileSync(join(ROOT, 'lib', 'compile-atoms-run.mjs'), 'utf8');
  assert(atomSource.includes("stage: 'input-preparation'")
    && atomSource.includes("stage: 'before-click-call'")
    && atomSource.includes("stage: 'waiting-for-reply'"),
  'chat compiler 未在输入前/click 调用前/等待期记录阶段');
  assert(runSource.includes("stage: 'physical-click-invoked'")
    && runSource.includes("stage: 'physical-click-succeeded'"),
  'run.emit 未在物理 click 调用前后记录事实');
});

await check('C8 物理 click 成功后 quiet/capture 抛错：即使 click event 未落盘也保持 CONFIRMED', async () => {
  const page = {
    waitForResponse() { return Promise.resolve(null); },
  };
  const run = compile.createCompileRun({
    page,
    forensics: { records() { return []; } },
    state: { currentStepId: null },
    sut: 'http://127.0.0.1:1',
    uniqueName: 'hermetic',
    site: {},
    profile: {},
  });
  run.admitPageOrigin = async () => true;
  run.resolveTarget = async () => ({
    count: 1,
    locator: {
      first() {
        return {
          async click() {
            assert(run.persistentActionEvidence?.stage === 'physical-click-invoked'
              && run.persistentActionEvidence?.status === 'INDETERMINATE',
            '调用物理 click 的瞬间必须先记 INDETERMINATE');
          },
        };
      },
    },
  });
  run.quietPoint = async () => { throw new Error(SECRET_ERROR); };
  let thrown = false;
  try {
    await run.emit({
      intentId: 'intent_chat', atom: 'chat.sendAndWait', action: 'click', fallbackCss: '.safe',
    }, undefined, { persistentActionBoundary: true });
  } catch {
    thrown = true;
  }
  assert(thrown, 'quietPoint 异常必须向 compileFlow 传播，才能落失败 report');
  assert(run.events.length === 0, 'quietPoint 抛错发生于 click event 落盘前，复现证据缺口');
  assert(run.persistentActionEvidence?.status === 'CONFIRMED'
    && run.persistentActionEvidence?.stage === 'physical-click-succeeded',
  `物理 click 成功事实不得被后续采证异常抹掉：${JSON.stringify(run.persistentActionEvidence)}`);

  const chatFailure = failureBoundary.createCompileAtomExecutionFailure({
    stepOrdinal: 5, atom: 'chat.sendAndWait', knownAtoms: compile.COMPILE_KNOWN_ATOMS,
  });
  const report = failureBoundary.projectCompileExecutionFailureReport({
    caseId: 'tc_chiefcomplaint_smoke', failure: chatFailure,
    knownAtoms: compile.COMPILE_KNOWN_ATOMS, run,
  });
  assert(report.persistentActionStatus === 'CONFIRMED'
    && report.persistentActionAttempted === true
    && report.persistentActionStage === 'physical-click-succeeded',
  `无 click event 时仍须优先信任物理 click 成功事实：${JSON.stringify(report)}`);
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

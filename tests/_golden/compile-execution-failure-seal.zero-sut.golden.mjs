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
    },
  });
  assert(JSON.stringify(Object.keys(report)) === JSON.stringify([
    'caseId', 'status', 'phase', 'stage', 'failedStepOrdinal', 'failedAtom', 'persistentActionAttempted',
    'eventsEmitted', 'identityObservationsCaptured', 'blockerCount',
  ]), `report 字段必须最小闭集：${JSON.stringify(Object.keys(report))}`);
  assert(report.caseId === 'tc_safe_compile_failure' && report.status === 'failed' && report.phase === 'execute',
    'report 固定身份/状态/阶段不符');
  assert(report.stage === 'compile-flow', `atom 异常 stage 应为 compile-flow，实际 ${report.stage}`);
  assert(report.failedStepOrdinal === 2 && report.failedAtom === 'workflow.publish', 'report 安全定位不符');
  assert(report.persistentActionAttempted === true, '已进入破坏性失败 atom 时须保守标记持久化动作已尝试');
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

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);

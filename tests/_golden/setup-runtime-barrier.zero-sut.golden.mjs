#!/usr/bin/env node
// S1 executable specification：setup → receipt → admission → main 的硬 barrier。
// zero-SUT：adapter 全为内存替身，只证明控制流；真实页面另走 observability。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planSetupFlow } from '../../lib/adaptive-execution/setup-flow.mjs';
import { executeWithSetupBarrier } from '../../lib/adaptive-execution/setup-barrier.mjs';
import { hashSetupPlan } from '../../lib/adaptive-execution/setup-receipt.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
const subject = (candidateId) => [{ candidateId, role: 'subject' }];
const bindExecution = (execution, request) => ({
  ...execution,
  executionChallenge: request.executionChallenge,
});
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function check(name, fn) {
  try { await fn(); passed++; }
  catch (error) { failed++; console.error(`not ok - ${name}: ${error.message}`); }
}

function fixture() {
  const testcase = {
    schemaVersion: 1,
    caseId: 'tc_setup_barrier',
    title: '前置进入智能体管理后打开目标',
    uniquePrefix: 'atl_',
    preconditions: ['已登录'],
    steps: [{ intentId: 'main_open', intent: '打开智能体' }],
  };
  const candidate = {
    schemaVersion: 1,
    artifactKind: 'setup-flow-candidate',
    caseId: testcase.caseId,
    goalStates: ['在智能体管理页'],
    steps: [
      { intentId: 'setup_2_agent', atom: 'nav.agentManagement', params: {}, entityBindings: subject('agent_list') },
      { intentId: 'setup_1_workflow', atom: 'nav.workflowManagement', params: {} },
    ],
  };
  const setupPlan = planSetupFlow({ testcase, candidate, registry: REGISTRY });
  assert(setupPlan.ready, JSON.stringify(setupPlan.problems));
  const execution = {
    schemaVersion: 1,
    artifactKind: 'setup-execution-evidence',
    caseId: testcase.caseId,
    setupPlanSha256: hashSetupPlan(setupPlan),
    steps: [
      {
        intentId: 'setup_1_workflow', status: 'executed', resolution: 'unique', acted: true,
        verifiedStates: [{ state: '在工作流管理页', evidenceStepId: 'atstep_1', proof: 'post-readback' }],
      },
      {
        intentId: 'setup_2_agent', status: 'executed', resolution: 'unique', acted: true,
        verifiedStates: [{ state: '在智能体管理页', evidenceStepId: 'atstep_2', proof: 'post-readback' }],
      },
    ],
    identityObservationRefs: [],
  };
  const mainMapping = [{
    intentId: 'main_open',
    atom: 'agent.searchOpen',
    params: { searchKeyword: 'AG-001', openName: '示例智能体', code: 'AG-001' },
    entityBindings: subject('agent_1'),
  }];
  return { testcase, setupPlan, execution, mainMapping };
}

await check('C1 happy path 顺序固定，主体恰调用一次', async () => {
  const f = fixture();
  const calls = [];
  const result = await executeWithSetupBarrier({
    setupPlan: f.setupPlan,
    testcase: f.testcase,
    mainMapping: f.mainMapping,
    registry: REGISTRY,
    executeSetup: async (plan, request) => {
      calls.push(`setup:${plan.artifactKind}`);
      return { execution: bindExecution(f.execution, request), identityObservationBytes: null };
    },
    executeMain: async (admission) => {
      calls.push(`main:${admission.allowMainStart}`);
      return { ok: true, marker: 'main-ran' };
    },
  });
  assert(result.stage === 'complete', JSON.stringify(result));
  assert(calls.join(',') === 'setup:setup-flow-plan,main:true', `调用顺序错：${calls.join(',')}`);
  assert(result.mainResult.marker === 'main-ran', '主体结果未传回');
});

await check('C2 setup adapter 抛错时主体零调用', async () => {
  const f = fixture();
  let mainCalls = 0;
  const result = await executeWithSetupBarrier({
    setupPlan: f.setupPlan, testcase: f.testcase, mainMapping: f.mainMapping, registry: REGISTRY,
    executeSetup: async () => { throw new Error('setup failed'); },
    executeMain: async () => { mainCalls++; },
  });
  assert(result.stage === 'setup-failed', JSON.stringify(result));
  assert(mainCalls === 0, 'setup 抛错后主体必须零调用');

  let setupCalls = 0;
  const invalidPlan = structuredClone(f.setupPlan);
  invalidPlan.ready = false;
  invalidPlan.problems = [{ code: 'SETUP_DESTRUCTIVE_PREFIX_INVALID' }];
  const preDenied = await executeWithSetupBarrier({
    setupPlan: invalidPlan, testcase: f.testcase, mainMapping: f.mainMapping, registry: REGISTRY,
    executeSetup: async () => { setupCalls++; return { execution: f.execution, identityObservationBytes: null }; },
    executeMain: async () => { mainCalls++; },
  });
  assert(preDenied.stage === 'setup-failed' && setupCalls === 0,
    'plan 未过前置准入时 setup adapter 必须零调用');
});

await check('C3 setup 非 unique 或 readback 不足时主体零调用', async () => {
  for (const mutate of [
    (e) => { e.steps[1].resolution = 'ambiguous'; e.steps[1].acted = false; },
    (e) => { e.steps[1].verifiedStates = []; },
  ]) {
    const f = fixture();
    mutate(f.execution);
    let mainCalls = 0;
    const result = await executeWithSetupBarrier({
      setupPlan: f.setupPlan, testcase: f.testcase, mainMapping: f.mainMapping, registry: REGISTRY,
      executeSetup: async (_plan, request) => ({
        execution: bindExecution(f.execution, request),
        identityObservationBytes: null,
      }),
      executeMain: async () => { mainCalls++; },
    });
    assert(result.stage === 'receipt-rejected', JSON.stringify(result));
    assert(mainCalls === 0, 'receipt 拒绝后主体必须零调用');
  }
});

await check('C4 receipt 或主体 admission 不闭合时主体零调用', async () => {
  for (const mutate of [
    (f) => { f.execution.setupPlanSha256 = `sha256:${'0'.repeat(64)}`; },
    (f) => { f.mainMapping[0].atom = 'workflow.open'; f.mainMapping[0].params = {}; },
  ]) {
    const f = fixture();
    mutate(f);
    let mainCalls = 0;
    const result = await executeWithSetupBarrier({
      setupPlan: f.setupPlan, testcase: f.testcase, mainMapping: f.mainMapping, registry: REGISTRY,
      executeSetup: async (_plan, request) => ({
        execution: bindExecution(f.execution, request),
        identityObservationBytes: null,
      }),
      executeMain: async () => { mainCalls++; },
    });
    assert(['receipt-rejected', 'main-admission-rejected'].includes(result.stage), JSON.stringify(result));
    assert(mainCalls === 0, 'receipt/admission 坏时主体必须零调用');
  }
});

await check('C5 main adapter 抛错只记 main-failed，不伪造裁定', async () => {
  const f = fixture();
  const result = await executeWithSetupBarrier({
    setupPlan: f.setupPlan, testcase: f.testcase, mainMapping: f.mainMapping, registry: REGISTRY,
    executeSetup: async (_plan, request) => ({
      execution: bindExecution(f.execution, request),
      identityObservationBytes: null,
    }),
    executeMain: async () => { throw new Error('main failed'); },
  });
  assert(result.stage === 'main-failed', JSON.stringify(result));
  const raw = JSON.stringify(result);
  assert(!raw.includes('"verdict"') && !raw.includes('"passes"') && !raw.includes('"PASS"'),
    `barrier 不得产裁定：${raw}`);
});

if (failed) {
  console.error(`setup-runtime-barrier: ${passed} 过 / ${failed} 败`);
  process.exit(1);
}
console.log(`ok   setup-runtime-barrier: ${passed}/5（setup 失败主体零调用 + 零 LLM 裁定）`);

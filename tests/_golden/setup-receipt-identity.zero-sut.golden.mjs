#!/usr/bin/env node
// S1 executable specification：setup execution → candidate receipt → main admission + 同一身份观察。
// zero-SUT：只消费内存对象/字节，不启动浏览器。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planSetupFlow } from '../../lib/adaptive-execution/setup-flow.mjs';
import {
  admitMainFlowWithSetup,
  finalizeSetupReceipt,
  hashSetupPlan,
} from '../../lib/adaptive-execution/setup-receipt.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const subject = (candidateId) => [{ candidateId, role: 'subject' }];
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function check(name, fn) {
  try { fn(); passed++; }
  catch (error) { failed++; console.error(`not ok - ${name}: ${error.message}`); }
}

function workflowFixture() {
  const testcase = {
    schemaVersion: 1,
    caseId: 'tc_setup_workflow',
    title: '前置打开工作流后保存',
    uniquePrefix: 'atl_',
    preconditions: ['已登录'],
    steps: [{ intentId: 'main_save', intent: '保存工作流' }],
  };
  const candidate = {
    schemaVersion: 1,
    artifactKind: 'setup-flow-candidate',
    caseId: testcase.caseId,
    goalStates: ['画布已开'],
    steps: [
      { intentId: 'setup_open', atom: 'workflow.open', params: { openName: 'atl_demo' }, entityBindings: subject('wf_1') },
      { intentId: 'setup_nav', atom: 'nav.workflowManagement', params: {} },
    ],
  };
  const plan = planSetupFlow({ testcase, candidate, registry: REGISTRY });
  assert(plan.ready, JSON.stringify(plan.problems));
  const execution = {
    schemaVersion: 1,
    artifactKind: 'setup-execution-evidence',
    caseId: testcase.caseId,
    setupPlanSha256: hashSetupPlan(plan),
    steps: [
      {
        intentId: 'setup_nav', status: 'executed', resolution: 'unique', acted: true,
        verifiedStates: [{ state: '在工作流管理页', evidenceStepId: 'atstep_1', proof: 'post-readback' }],
      },
      {
        intentId: 'setup_open', status: 'executed', resolution: 'unique', acted: true,
        verifiedStates: [{ state: '画布已开', evidenceStepId: 'atstep_2', proof: 'post-readback' }],
      },
    ],
    identityObservationRefs: [],
  };
  const mainMapping = [{
    intentId: 'main_save',
    atom: 'workflow.save',
    params: {},
    entityBindings: subject('wf_1'),
  }];
  return { testcase, candidate, plan, execution, mainMapping };
}

check('B1 全步 unique + post-readback 才产生非正式 candidate receipt', () => {
  const { plan, execution } = workflowFixture();
  const result = finalizeSetupReceipt({ plan, execution });
  assert(result.ok === true, JSON.stringify(result.problems));
  assert(result.receipt.signed === false && result.receipt.replayReady === false, 'receipt 不得签署或 replayReady');
  assert(result.receipt.status === 'verified', 'receipt 状态应为 verified');
  assert(!Object.hasOwn(result.receipt, 'verdict') && !Object.hasOwn(result.receipt, 'passes'), 'receipt 不得携 verdict/passes');
  assert(JSON.stringify(result.receipt.providedStates) === JSON.stringify(['在工作流管理页', '画布已开']),
    JSON.stringify(result.receipt.providedStates));
});

check('B2 ambiguous/absent/action_failed 任一出现都不能成 receipt', () => {
  for (const resolution of ['ambiguous', 'absent', 'action_failed']) {
    const { plan, execution } = workflowFixture();
    execution.steps[1].resolution = resolution;
    execution.steps[1].acted = false;
    const result = finalizeSetupReceipt({ plan, execution });
    assert(result.ok === false && result.receipt === null, `${resolution} 不得成 receipt`);
    assert(result.problems.some((p) => p.code === 'SETUP_EXECUTION_NOT_UNIQUE'), JSON.stringify(result.problems));
  }
});

check('B3 缺步、重复、错序、plan digest 错、额外状态分别拒绝', () => {
  const mutations = [
    (e) => { e.steps.pop(); },
    (e) => { e.steps.push(structuredClone(e.steps[1])); },
    (e) => { e.steps.reverse(); },
    (e) => { e.setupPlanSha256 = `sha256:${'0'.repeat(64)}`; },
    (e) => { e.steps[1].verifiedStates.push({ state: '伪造状态', evidenceStepId: 'atstep_x', proof: 'post-readback' }); },
  ];
  for (const mutate of mutations) {
    const { plan, execution } = workflowFixture();
    mutate(execution);
    const result = finalizeSetupReceipt({ plan, execution });
    assert(result.ok === false && result.receipt === null, `坏 evidence 被接受：${JSON.stringify(execution)}`);
  }
});

check('B4 already-satisfied 只有 probe proof 完整时允许 acted:false', () => {
  const { plan, execution } = workflowFixture();
  execution.steps[1] = {
    intentId: 'setup_open',
    status: 'already-satisfied',
    resolution: 'unique',
    acted: false,
    verifiedStates: [{ state: '画布已开', evidenceStepId: 'probe_1', proof: 'probe-readback' }],
  };
  const ok = finalizeSetupReceipt({ plan, execution });
  assert(ok.ok === true && ok.receipt.steps[1].acted === false, JSON.stringify(ok.problems));
  execution.steps[1].verifiedStates[0].proof = 'post-readback';
  const bad = finalizeSetupReceipt({ plan, execution });
  assert(bad.ok === false, 'already-satisfied 缺 probe-readback 应拒绝');
});

check('B5 无 receipt 主体仍缺状态；合法 receipt 合并后 main bridge 变绿', () => {
  const { testcase, plan, execution, mainMapping } = workflowFixture();
  const denied = admitMainFlowWithSetup({
    testcase, mainMapping, setupPlan: plan, setupReceipt: null,
    identityObservationBytes: null, registry: REGISTRY,
  });
  assert(denied.ok === false && denied.allowMainStart === false, '无 receipt 不得启动主体');
  const receipt = finalizeSetupReceipt({ plan, execution }).receipt;
  const admitted = admitMainFlowWithSetup({
    testcase, mainMapping, setupPlan: plan, setupReceipt: receipt,
    identityObservationBytes: null, registry: REGISTRY,
  });
  assert(admitted.ok === true && admitted.allowMainStart === true, JSON.stringify(admitted.problems));
  assert(admitted.initialStates.includes('画布已开'), '主体初态应合并 receipt 状态');
  assert(admitted.stateTrace.problems.length === 0, '主体 state trace 应变绿');
});

function agentIdentityFixture() {
  const testcase = {
    schemaVersion: 1,
    caseId: 'tc_setup_identity',
    title: '先按名称与编号打开智能体',
    uniquePrefix: 'atl_',
    preconditions: ['已登录'],
    steps: [{ intentId: 'main_panel', intent: '打开测试面板' }],
  };
  const candidate = {
    schemaVersion: 1,
    artifactKind: 'setup-flow-candidate',
    caseId: testcase.caseId,
    goalStates: ['智能体详情已开'],
    steps: [
      {
        intentId: 'setup_open',
        atom: 'agent.searchOpen',
        params: { searchKeyword: 'AG-001', openName: '示例智能体', code: 'AG-001' },
        entityBindings: subject('agent_1'),
      },
      { intentId: 'setup_nav', atom: 'nav.agentManagement', params: {}, entityBindings: subject('agent_list') },
    ],
  };
  const plan = planSetupFlow({ testcase, candidate, registry: REGISTRY });
  assert(plan.ready, JSON.stringify(plan.problems));
  const artifact = {
    schemaVersion: 1,
    artifactKind: 'compile-identity-observation',
    caseId: testcase.caseId,
    capturedAgainstBuild: 'held-out-build',
    identityProfileDigest: `sha256:${'1'.repeat(64)}`,
    eventsSha256: `sha256:${'2'.repeat(64)}`,
    source: { kind: 'agent', atom: 'agent.searchOpen', signed: false, replayReady: false },
    observations: [{
      name: '示例智能体',
      code: 'AG-001',
      platformId: '2079000000000000001',
      sourceIntentId: 'setup_open',
      candidateId: 'agent_1',
      role: 'subject',
      atom: 'agent.searchOpen',
      evidenceStepId: 'atstep_2',
    }],
  };
  const identityObservationBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  const execution = {
    schemaVersion: 1,
    artifactKind: 'setup-execution-evidence',
    caseId: testcase.caseId,
    setupPlanSha256: hashSetupPlan(plan),
    steps: [
      {
        intentId: 'setup_nav', status: 'executed', resolution: 'unique', acted: true,
        verifiedStates: [{ state: '在智能体管理页', evidenceStepId: 'atstep_1', proof: 'post-readback' }],
      },
      {
        intentId: 'setup_open', status: 'executed', resolution: 'unique', acted: true,
        verifiedStates: [{ state: '智能体详情已开', evidenceStepId: 'atstep_2', proof: 'post-readback' }],
      },
    ],
    identityObservationRefs: [{
      artifactSha256: sha(identityObservationBytes),
      sourceIntentId: 'setup_open',
      candidateId: 'agent_1',
      role: 'subject',
      atom: 'agent.searchOpen',
      evidenceStepId: 'atstep_2',
    }],
  };
  const mainMapping = [{
    intentId: 'main_panel',
    atom: 'agent.openTestPanel',
    params: {},
    entityBindings: subject('agent_1'),
  }];
  return { testcase, plan, execution, identityObservationBytes, mainMapping };
}

check('B6 identity ref 按原始字节与完整关联键唯一解析，平台 ID 只来自观察行', () => {
  const f = agentIdentityFixture();
  const receiptResult = finalizeSetupReceipt({ plan: f.plan, execution: f.execution });
  assert(receiptResult.ok, JSON.stringify(receiptResult.problems));
  const raw = JSON.stringify(receiptResult.receipt);
  assert(!raw.includes('2079000000000000001'), 'receipt 不得复制 platformId');
  const admitted = admitMainFlowWithSetup({
    testcase: f.testcase,
    mainMapping: f.mainMapping,
    setupPlan: f.plan,
    setupReceipt: receiptResult.receipt,
    identityObservationBytes: f.identityObservationBytes,
    registry: REGISTRY,
  });
  assert(admitted.ok === true, JSON.stringify(admitted.problems));
  assert(admitted.resolvedIdentities.length === 1, '应解析唯一身份');
  assert(admitted.resolvedIdentities[0].platformId === '2079000000000000001', '平台 ID 必须来自观察行');
  assert(!Object.hasOwn(admitted.mainFlow.steps[0].entityBindings[0], 'platformId'), 'main mapping 不得写入 platformId');
});

check('B7 hash/关联键/名称/编号任一错，或同 candidate 多观察行，都 fail-closed', () => {
  const mutations = [
    (f) => { f.execution.identityObservationRefs[0].artifactSha256 = `sha256:${'0'.repeat(64)}`; },
    (f) => { f.execution.identityObservationRefs[0].evidenceStepId = 'atstep_wrong'; },
    (f) => {
      const doc = JSON.parse(f.identityObservationBytes);
      doc.observations[0].name = '同名替身';
      f.identityObservationBytes = Buffer.from(`${JSON.stringify(doc, null, 2)}\n`);
      f.execution.identityObservationRefs[0].artifactSha256 = sha(f.identityObservationBytes);
    },
    (f) => {
      const doc = JSON.parse(f.identityObservationBytes);
      doc.observations[0].code = 'AG-WRONG';
      f.identityObservationBytes = Buffer.from(`${JSON.stringify(doc, null, 2)}\n`);
      f.execution.identityObservationRefs[0].artifactSha256 = sha(f.identityObservationBytes);
    },
    (f) => {
      const doc = JSON.parse(f.identityObservationBytes);
      doc.observations.push({ ...doc.observations[0], platformId: '2079000000000000002' });
      f.identityObservationBytes = Buffer.from(`${JSON.stringify(doc, null, 2)}\n`);
      f.execution.identityObservationRefs[0].artifactSha256 = sha(f.identityObservationBytes);
    },
  ];
  for (const mutate of mutations) {
    const f = agentIdentityFixture();
    mutate(f);
    const receipt = finalizeSetupReceipt({ plan: f.plan, execution: f.execution });
    if (!receipt.ok) continue;
    const admitted = admitMainFlowWithSetup({
      testcase: f.testcase, mainMapping: f.mainMapping, setupPlan: f.plan,
      setupReceipt: receipt.receipt, identityObservationBytes: f.identityObservationBytes, registry: REGISTRY,
    });
    assert(admitted.ok === false && admitted.allowMainStart === false, '坏身份观察不得启动主体');
  }
});

check('B8 receipt 内联 platformId 或追加未证状态不能成为权威', () => {
  const f = agentIdentityFixture();
  const receipt = finalizeSetupReceipt({ plan: f.plan, execution: f.execution }).receipt;
  receipt.identityObservationRefs[0].platformId = '2079000000000000001';
  receipt.providedStates.push('伪造授权状态');
  const admitted = admitMainFlowWithSetup({
    testcase: f.testcase, mainMapping: f.mainMapping, setupPlan: f.plan,
    setupReceipt: receipt, identityObservationBytes: f.identityObservationBytes, registry: REGISTRY,
  });
  assert(admitted.ok === false && admitted.allowMainStart === false, 'receipt 额外字段/状态必须拒绝');
});

if (failed) {
  console.error(`setup-receipt-identity: ${passed} 过 / ${failed} 败`);
  process.exit(1);
}
console.log(`ok   setup-receipt-identity: ${passed}/8（候选收据 + 名称/编号发现 + 平台 ID 观察确认）`);


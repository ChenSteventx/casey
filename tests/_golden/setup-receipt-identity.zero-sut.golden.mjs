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
  createSetupAdmissionSession,
  createSetupExecutionRequest,
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
    title: '前置进入智能体管理后打开目标',
    uniquePrefix: 'atl_',
    preconditions: ['已登录'],
    steps: [{ intentId: 'main_open', intent: '按名称与编号打开智能体' }],
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
  const plan = planSetupFlow({ testcase, candidate, registry: REGISTRY });
  assert(plan.ready, JSON.stringify(plan.problems));
  const execution = {
    schemaVersion: 1,
    artifactKind: 'setup-execution-evidence',
    caseId: testcase.caseId,
    setupPlanSha256: hashSetupPlan(plan),
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
  const admissionSession = createSetupAdmissionSession({ caseId: testcase.caseId });
  execution.executionChallenge = createSetupExecutionRequest({
    plan,
    admissionSession,
  }).executionChallenge;
  return {
    testcase, candidate, plan, execution, mainMapping,
    admissionSession,
  };
}

check('B1 全步 unique + post-readback 才产生非正式 candidate receipt', () => {
  const { plan, execution, admissionSession } = workflowFixture();
  let duplicateRequestRejected = false;
  try { createSetupExecutionRequest({ plan, admissionSession }); }
  catch { duplicateRequestRejected = true; }
  assert(duplicateRequestRejected, '同一 session 只能签发一次 execution request');
  const result = finalizeSetupReceipt({ plan, execution, admissionSession });
  assert(result.ok === true, JSON.stringify(result.problems));
  assert(result.receipt.signed === false && result.receipt.replayReady === false, 'receipt 不得签署或 replayReady');
  assert(result.receipt.status === 'verified', 'receipt 状态应为 verified');
  assert(!Object.hasOwn(result.receipt, 'verdict') && !Object.hasOwn(result.receipt, 'passes'), 'receipt 不得携 verdict/passes');
  assert(JSON.stringify(result.receipt.providedStates) === JSON.stringify(['在智能体管理页']),
    JSON.stringify(result.receipt.providedStates));
  assert(!result.receipt.providedStates.includes('在工作流管理页'),
    'exclusive group 已移除的中间页面状态不得进入 receipt 供主体复用');
  const other = workflowFixture();
  const otherReceipt = finalizeSetupReceipt({
    plan: other.plan,
    execution: other.execution,
    admissionSession: other.admissionSession,
  }).receipt;
  assert(result.receipt.executionRequestSha256 !== otherReceipt.executionRequestSha256,
    '不同 run/session 的 receipt 必须绑定不同 execution request digest');
  assert(JSON.stringify(result.receipt) !== JSON.stringify(otherReceipt),
    '不同 run/session 不得产生字节完全相同的 receipt');
});

check('B2 ambiguous/absent/action_failed 任一出现都不能成 receipt', () => {
  for (const resolution of ['ambiguous', 'absent', 'action_failed']) {
    const { plan, execution, admissionSession } = workflowFixture();
    execution.steps[1].resolution = resolution;
    execution.steps[1].acted = false;
    const result = finalizeSetupReceipt({ plan, execution, admissionSession });
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
    const { plan, execution, admissionSession } = workflowFixture();
    mutate(execution);
    const result = finalizeSetupReceipt({ plan, execution, admissionSession });
    assert(result.ok === false && result.receipt === null, `坏 evidence 被接受：${JSON.stringify(execution)}`);
  }
});

check('B4 already-satisfied 只有 probe proof 完整时允许 acted:false', () => {
  const { plan, execution, admissionSession } = workflowFixture();
  execution.steps[1] = {
    intentId: 'setup_2_agent',
    status: 'already-satisfied',
    resolution: 'unique',
    acted: false,
    verifiedStates: [{ state: '在智能体管理页', evidenceStepId: 'probe_1', proof: 'probe-readback' }],
  };
  const ok = finalizeSetupReceipt({ plan, execution, admissionSession });
  assert(ok.ok === true && ok.receipt.steps[1].acted === false, JSON.stringify(ok.problems));
  execution.steps[1].verifiedStates[0].proof = 'post-readback';
  const bad = finalizeSetupReceipt({ plan, execution, admissionSession });
  assert(bad.ok === false, 'already-satisfied 缺 probe-readback 应拒绝');
});

check('B5 无 receipt 主体仍缺状态；合法 receipt 合并后 main bridge 变绿', () => {
  const { testcase, plan, execution, mainMapping, admissionSession } = workflowFixture();
  const denied = admitMainFlowWithSetup({
    testcase, mainMapping, setupPlan: plan, setupReceipt: null,
    identityObservationBytes: null, registry: REGISTRY, admissionSession,
  });
  assert(denied.ok === false && denied.allowMainStart === false, '无 receipt 不得启动主体');
  const receipt = finalizeSetupReceipt({ plan, execution, admissionSession }).receipt;
  const admitted = admitMainFlowWithSetup({
    testcase, mainMapping, setupPlan: plan, setupReceipt: receipt,
    identityObservationBytes: null, registry: REGISTRY, admissionSession,
  });
  assert(admitted.ok === true && admitted.allowMainStart === true, JSON.stringify(admitted.problems));
  assert(admitted.initialStates.includes('在智能体管理页'), '主体初态应合并 receipt 状态');
  assert(admitted.stateTrace.problems.length === 0, '主体 state trace 应变绿');
  const reused = admitMainFlowWithSetup({
    testcase, mainMapping, setupPlan: plan, setupReceipt: receipt,
    identityObservationBytes: null, registry: REGISTRY, admissionSession,
  });
  assert(reused.ok === false && reused.allowMainStart === false, '同一 session 的 receipt 不得重复准入');
  const foreign = admitMainFlowWithSetup({
    testcase, mainMapping, setupPlan: plan, setupReceipt: receipt,
    identityObservationBytes: null, registry: REGISTRY,
    admissionSession: createSetupAdmissionSession({ caseId: testcase.caseId }),
  });
  assert(foreign.ok === false && foreign.allowMainStart === false, 'receipt 不得换新 session 跨调用重用');
  const replaySession = createSetupAdmissionSession({ caseId: testcase.caseId });
  createSetupExecutionRequest({ plan, admissionSession: replaySession });
  const replayedEvidence = finalizeSetupReceipt({
    plan,
    execution,
    admissionSession: replaySession,
  });
  assert(replayedEvidence.ok === false
    && replayedEvidence.problems.some((p) => p.code === 'SETUP_EXECUTION_SHAPE_PLAN_OR_CHALLENGE_MISMATCH'),
  '旧 execution evidence 不得由 fresh session 重新 finalize');

  const late = workflowFixture();
  late.testcase.preconditions.push('测试面板已开');
  const lateReceipt = finalizeSetupReceipt({
    plan: late.plan,
    execution: late.execution,
    admissionSession: late.admissionSession,
  }).receipt;
  const omittedPrecondition = admitMainFlowWithSetup({
    testcase: late.testcase,
    mainMapping: late.mainMapping,
    setupPlan: late.plan,
    setupReceipt: lateReceipt,
    identityObservationBytes: null,
    registry: REGISTRY,
    admissionSession: late.admissionSession,
  });
  assert(omittedPrecondition.ok === false
    && omittedPrecondition.problems.some((p) => p.code === 'SETUP_PRECONDITION_UNVERIFIED'),
  '复用旧 plan/receipt 时不得漏掉 TestCase 新增业务前置');
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
    source: { kind: 'compile-envelope', atom: 'agent.searchOpen', signed: false, replayReady: false },
    observations: [{
      kind: 'agent',
      name: '示例智能体',
      code: 'AG-001',
      platformId: '2079000000000000001',
      sourceIntentId: 'setup_open',
      candidateId: 'agent_1',
      role: 'subject',
      atom: 'agent.searchOpen',
      evidenceStepId: 'atstep_2',
      sourcePath: '/api/agents/query',
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
  const admissionSession = createSetupAdmissionSession({ caseId: testcase.caseId });
  execution.executionChallenge = createSetupExecutionRequest({
    plan,
    admissionSession,
  }).executionChallenge;
  return {
    testcase, plan, execution, identityObservationBytes, mainMapping,
    admissionSession,
  };
}

check('B6 identity ref 按原始字节与完整关联键唯一解析，平台 ID 只来自观察行', () => {
  const f = agentIdentityFixture();
  const receiptResult = finalizeSetupReceipt({
    plan: f.plan, execution: f.execution, admissionSession: f.admissionSession,
  });
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
    admissionSession: f.admissionSession,
  });
  assert(admitted.ok === true, JSON.stringify(admitted.problems));
  assert(admitted.resolvedIdentities.length === 1, '应解析唯一身份');
  assert(admitted.resolvedIdentities[0].platformId === '2079000000000000001', '平台 ID 必须来自观察行');
  assert(!Object.hasOwn(admitted.mainFlow.steps[0].entityBindings[0], 'platformId'), 'main mapping 不得写入 platformId');
});

check('B7 hash/关联键/名称/编号任一错，或同 candidate 多观察行，都 fail-closed', () => {
  const mutations = [
    (f) => { f.execution.identityObservationRefs = []; },
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
      doc.observations[0].kind = 'workflow';
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
    const receipt = finalizeSetupReceipt({
      plan: f.plan, execution: f.execution, admissionSession: f.admissionSession,
    });
    if (!receipt.ok) continue;
    const admitted = admitMainFlowWithSetup({
      testcase: f.testcase, mainMapping: f.mainMapping, setupPlan: f.plan,
      setupReceipt: receipt.receipt, identityObservationBytes: f.identityObservationBytes, registry: REGISTRY,
      admissionSession: f.admissionSession,
    });
    assert(admitted.ok === false && admitted.allowMainStart === false, '坏身份观察不得启动主体');
  }
});

check('B8 receipt 内联 platformId 或追加未证状态不能成为权威', () => {
  const f = agentIdentityFixture();
  const receipt = finalizeSetupReceipt({
    plan: f.plan, execution: f.execution, admissionSession: f.admissionSession,
  }).receipt;
  receipt.identityObservationRefs[0].platformId = '2079000000000000001';
  receipt.providedStates.push('伪造授权状态');
  const admitted = admitMainFlowWithSetup({
    testcase: f.testcase, mainMapping: f.mainMapping, setupPlan: f.plan,
    setupReceipt: receipt, identityObservationBytes: f.identityObservationBytes, registry: REGISTRY,
    admissionSession: f.admissionSession,
  });
  assert(admitted.ok === false && admitted.allowMainStart === false, 'receipt 额外字段/状态必须拒绝');
});

if (failed) {
  console.error(`setup-receipt-identity: ${passed} 过 / ${failed} 败`);
  process.exit(1);
}
console.log(`ok   setup-receipt-identity: ${passed}/8（候选收据 + 名称/编号发现 + 平台 ID 观察确认）`);

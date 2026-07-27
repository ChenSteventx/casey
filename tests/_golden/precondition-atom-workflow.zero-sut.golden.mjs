#!/usr/bin/env node
// S1 executable specification：setup candidate → registry 真值 → 稳定拓扑 → 现役 flow 形状。
// zero-SUT：只导入纯函数与冻结 registry，不启动浏览器。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planSetupFlow } from '../../lib/adaptive-execution/setup-flow.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`not ok - ${name}: ${error.message}`);
  }
}

function testcase(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId: 'tc_setup_agent',
    title: '先打开目标再执行主体',
    uniquePrefix: 'atl_',
    preconditions: ['已登录'],
    steps: [{ intentId: 'main_1', intent: '打开测试面板' }],
    ...overrides,
  };
}

const subject = (candidateId) => [{ candidateId, role: 'subject' }];
const baseCandidate = {
  schemaVersion: 1,
  artifactKind: 'setup-flow-candidate',
  caseId: 'tc_setup_agent',
  goalStates: ['智能体详情已开'],
  steps: [
    {
      intentId: 'setup_open',
      atom: 'agent.searchOpen',
      params: { searchKeyword: 'AG-001', openName: '示例智能体', code: 'AG-001' },
      entityBindings: subject('agent_1'),
    },
    {
      intentId: 'setup_nav',
      atom: 'nav.agentManagement',
      params: {},
      entityBindings: subject('agent_list'),
    },
  ],
};

check('A1 乱序 provider/consumer 依 registry 稳定重排并达成目标状态', () => {
  const plan = planSetupFlow({ testcase: testcase(), candidate: baseCandidate, registry: REGISTRY });
  assert(plan.ready === true, `plan 应 ready，实得 ${JSON.stringify(plan.problems)}`);
  assert(JSON.stringify(plan.orderedIntentIds) === JSON.stringify(['setup_nav', 'setup_open']),
    `拓扑顺序错误：${JSON.stringify(plan.orderedIntentIds)}`);
  assert(plan.flow.steps.map((step) => step.sourceIntentId).join(',') === 'setup_nav,setup_open',
    'flow 顺序须与 orderedIntentIds 一致');
  assert(plan.stateTrace.problems.length === 0, 'ready plan 的 state trace 不应有 missing');
  assert(plan.providedStates.includes('智能体详情已开'), 'providedStates 应含目标状态');
});

check('A2 相同输入重复规划字节稳定且不变异输入', () => {
  const tc = testcase();
  const candidate = structuredClone(baseCandidate);
  const before = JSON.stringify({ tc, candidate });
  const one = planSetupFlow({ testcase: tc, candidate, registry: REGISTRY });
  const two = planSetupFlow({ testcase: tc, candidate, registry: REGISTRY });
  assert(JSON.stringify(one) === JSON.stringify(two), '重复规划输出应逐字稳定');
  assert(JSON.stringify({ tc, candidate }) === before, '规划器不得变异输入');
});

check('A3 candidate 自报状态投影必须与 registry 完全一致', () => {
  const candidate = structuredClone(baseCandidate);
  candidate.steps[0].stateProjection = {
    requires: ['已登录'],
    provides: ['伪造状态'],
    removes: [],
  };
  const plan = planSetupFlow({ testcase: testcase(), candidate, registry: REGISTRY });
  assert(plan.ready === false, '伪造状态投影不得 ready');
  assert(plan.problems.some((p) => p.code === 'SETUP_STATE_PROJECTION_MISMATCH'),
    `应具名投影不一致：${JSON.stringify(plan.problems)}`);
});

check('A4 缺 provider 与多 provider 分别具名拒绝', () => {
  const missing = planSetupFlow({
    testcase: testcase({ caseId: 'tc_missing' }),
    candidate: {
      schemaVersion: 1, artifactKind: 'setup-flow-candidate', caseId: 'tc_missing',
      goalStates: ['画布已开'],
      steps: [{ intentId: 'setup_save', atom: 'workflow.save', params: {}, entityBindings: subject('wf_1') }],
    },
    registry: REGISTRY,
  });
  assert(missing.problems.some((p) => p.code === 'SETUP_PROVIDER_MISSING'), JSON.stringify(missing.problems));

  const ambiguous = planSetupFlow({
    testcase: testcase({ caseId: 'tc_ambiguous' }),
    candidate: {
      schemaVersion: 1, artifactKind: 'setup-flow-candidate', caseId: 'tc_ambiguous',
      goalStates: ['画布已开'],
      steps: [
        { intentId: 'setup_create', atom: 'workflow.create', params: { name: 'atl_demo' }, entityBindings: subject('wf_1') },
        { intentId: 'setup_open', atom: 'workflow.open', params: { openName: 'atl_demo' }, entityBindings: subject('wf_1') },
        { intentId: 'setup_save', atom: 'workflow.save', params: {}, entityBindings: subject('wf_1') },
      ],
    },
    registry: REGISTRY,
  });
  assert(ambiguous.problems.some((p) => p.code === 'SETUP_PROVIDER_AMBIGUOUS'), JSON.stringify(ambiguous.problems));
});

check('A5 依赖环具名拒绝，不能靠 trace 补 missing 假装达成', () => {
  const registry = structuredClone(REGISTRY);
  registry.atoms['cycle.a'] = { params: {}, requires: ['cycle-b'], provides: ['cycle-a'], removes: [] };
  registry.atoms['cycle.b'] = { params: {}, requires: ['cycle-a'], provides: ['cycle-b'], removes: [] };
  const plan = planSetupFlow({
    testcase: testcase({ caseId: 'tc_cycle' }),
    candidate: {
      schemaVersion: 1, artifactKind: 'setup-flow-candidate', caseId: 'tc_cycle',
      goalStates: ['cycle-a'],
      steps: [
        { intentId: 'a', atom: 'cycle.a', params: {}, entityBindings: subject('x') },
        { intentId: 'b', atom: 'cycle.b', params: {}, entityBindings: subject('x') },
      ],
    },
    registry,
  });
  assert(plan.ready === false, '环不得 ready');
  assert(plan.problems.some((p) => p.code === 'SETUP_DEPENDENCY_CYCLE'), JSON.stringify(plan.problems));
});

check('A6 login、未知 atom、册内但不可编译 atom 均 fail-closed', () => {
  for (const [atom, code] of [
    ['login', 'SETUP_LOGIN_FORBIDDEN'],
    ['not.registered', 'SETUP_ATOM_UNKNOWN'],
    ['agent.selectModel', 'SETUP_ATOM_NOT_COMPILABLE'],
  ]) {
    const plan = planSetupFlow({
      testcase: testcase({ caseId: `tc_${atom.replaceAll('.', '_')}` }),
      candidate: {
        schemaVersion: 1, artifactKind: 'setup-flow-candidate',
        caseId: `tc_${atom.replaceAll('.', '_')}`,
        goalStates: [],
        steps: [{ intentId: 'setup_1', atom, params: {}, entityBindings: subject('x') }],
      },
      registry: REGISTRY,
    });
    assert(plan.ready === false && plan.problems.some((p) => p.code === code),
      `${atom} 应 ${code}：${JSON.stringify(plan.problems)}`);
  }
});

check('A7 goalStates 未由初态或 setup 真正提供时不 ready', () => {
  const candidate = structuredClone(baseCandidate);
  candidate.goalStates = ['不存在的目标状态'];
  const plan = planSetupFlow({ testcase: testcase(), candidate, registry: REGISTRY });
  assert(plan.ready === false, '未达目标不得 ready');
  assert(plan.problems.some((p) => p.code === 'SETUP_GOAL_UNSATISFIED'), JSON.stringify(plan.problems));
});

check('A8 mutation 必须恰 subject；缺失与未知角色都拒绝', () => {
  for (const entityBindings of [undefined, [{ candidateId: 'wf_1', role: 'owner' }]]) {
    const candidate = {
      schemaVersion: 1, artifactKind: 'setup-flow-candidate', caseId: 'tc_role',
      goalStates: ['画布已开'],
      steps: [{ intentId: 'setup_create', atom: 'workflow.create', params: { name: 'atl_role' }, ...(entityBindings ? { entityBindings } : {}) }],
    };
    const plan = planSetupFlow({ testcase: testcase({ caseId: 'tc_role' }), candidate, registry: REGISTRY });
    assert(plan.ready === false && plan.problems.some((p) => p.code === 'SETUP_ENTITY_BINDINGS_INVALID'),
      JSON.stringify(plan.problems));
  }
});

check('A9 workflow.open 角色真值冲突须 route:human；relation 仍按显式 source/target 拒错配', () => {
  const good = {
    schemaVersion: 1, artifactKind: 'setup-flow-candidate', caseId: 'tc_relation',
    goalStates: ['节点智能体已绑定'],
    steps: [
      { intentId: 'setup_nav', atom: 'nav.workflowManagement', params: {} },
      {
        intentId: 'setup_open',
        atom: 'workflow.open',
        params: { openName: 'atl_relation' },
        entityBindings: subject('workflow_1'),
      },
      {
        intentId: 'setup_drawer',
        atom: 'workflow.openNode',
        params: { label: '智能体/工作流' },
        entityBindings: subject('workflow_1'),
      },
      {
        intentId: 'setup_bind',
        atom: 'workflow.bindAgent',
        params: { nodeLabel: '智能体/工作流', agentName: '示例智能体', agentCode: 'AG-001' },
        entityBindings: [
          { candidateId: 'agent_1', role: 'target' },
          { candidateId: 'workflow_1', role: 'source' },
        ],
      },
    ],
  };
  const tc = testcase({ caseId: 'tc_relation', preconditions: ['已登录'] });
  const plan = planSetupFlow({ testcase: tc, candidate: good, registry: REGISTRY });
  assert(plan.ready === false, 'action=subject / observation=source 未统一前不得执行 setup');
  assert(plan.problems.some((p) => p.code === 'SETUP_IDENTITY_ROLE_CONFLICT' && p.route === 'human'
    && p.atom === 'workflow.open'), JSON.stringify(plan.problems));
  const bad = structuredClone(good);
  bad.steps[3].entityBindings = [
    { candidateId: 'workflow_1', role: 'source' },
    { candidateId: 'agent_1', role: 'source' },
  ];
  const denied = planSetupFlow({ testcase: tc, candidate: bad, registry: REGISTRY });
  assert(denied.ready === false && denied.problems.some((p) => p.code === 'SETUP_ENTITY_BINDINGS_INVALID'),
    JSON.stringify(denied.problems));
});

check('A10 TestCase 业务前置声明不直通初态，只有 Login Bootstrap 状态可信', () => {
  const plan = planSetupFlow({
    testcase: testcase({ preconditions: ['已登录', '测试面板已开', '智能体详情已开'] }),
    candidate: baseCandidate,
    registry: REGISTRY,
  });
  assert(plan.ready === true, JSON.stringify(plan.problems));
  assert(JSON.stringify(plan.initialStates) === JSON.stringify(['已登录']),
    `业务前置文本不得进入 initialStates：${JSON.stringify(plan.initialStates)}`);
  assert(!plan.initialStates.includes('测试面板已开') && !plan.initialStates.includes('智能体详情已开'),
    '未 probe/readback 的业务状态不得视为已满足');
});

if (failed) {
  console.error(`precondition-atom-workflow: ${passed} 过 / ${failed} 败`);
  process.exit(1);
}
console.log(`ok   precondition-atom-workflow: ${passed}/10（registry 真值 + 稳定拓扑 + 业务前置不直通）`);

// 准入策略行为语料（admission behavior corpus）：纯数据 + 纯调用计划，零 SUT / 零 fs / 零网络 / 零随机。
// 用途：把「三面拆分」改写前后的准入面行为逐字节钉住——同一份语料、同一个 runner，跑改写前后两版模块，
// 输出 JSON 必须逐字节相同。语料与 runner 同住本夹具，防「两边各写一份 runner 悄悄漂移」。
//
// 覆盖面（对齐 lib/entity-semantic-lock-preflight.mjs 里全部读策略的地方）：
//   · containsMutation（flow/events 两个入口）
//   · inspectOperationBindings / requiredEntityBindings（flow 用 policyForAtom、events 用 legacy 投影）
//   · expectedRoles（buildEntityBindingsDraft 与 checkReplayEntityAdmission 共吃）
//   · checkReplayEntityAdmission 的只读通道（allowedActions + 未绑定只读信封）
//   · checkCompileIdentityAdmission 的 execute 只读短路

export const ATOMS = Object.freeze([
  // 已登记 9 原子
  'nav.workflowManagement',
  'assert.textVisible',
  'workflow.create',
  'workflow.addNode',
  'workflow.setNodeField',
  'workflow.setSwitch',
  'workflow.addNodeInputVar',
  'agent.removeToolByName',
  'workflow.bindAgent',
  // 未登记原子（走保守默认）：泛化未知 + 本次要如实描述的两个具体原子
  'future.unknownAtom',
  'chat.sendAndWait',
  'agent.searchOpen',
]);

export const ROLE_SETS = Object.freeze([
  [], ['subject'], ['source'], ['target'], ['source', 'target'], ['subject', 'target'], ['mystery'],
]);

const RECEIPT = `sha256:${'d'.repeat(64)}`;
const roleLabel = (roles) => (roles.length ? roles.join('+') : 'none');

const flowStep = (atom, roles) => ({
  atom,
  sourceIntentId: 'source_1',
  entityBindings: roles.map((role) => ({ candidateId: `cand-${role}`, role })),
});

const frozenEvent = (atom, roles, { stepId = 'atstep_1', intentId = 'intent_1' } = {}) => ({
  stepId,
  intentId,
  atom,
  entityBindings: roles.map((role) => ({
    stepId, intentId, atom, role, candidateId: `cand-${role}`, lockId: `lock-${role}`, receiptHash: RECEIPT,
  })),
});

const provenanceRow = (atom, role, { stepId = 'atstep_1', intentId = 'intent_1' } = {}) => ({
  stepId, intentId, atom, sourceIntentId: 'source_1', candidateId: `cand-${role}`, role,
});

const READ_ACTIONS = Object.freeze(['nav', 'assert', 'click']);
const READ_URLS = Object.freeze([
  null,
  '{{baseUrl}}/ai-manager/process/list',
  '{{baseUrl}}/workflow',
  '{{baseUrl}}/evil/route',
]);

// 有序生成，保证语料与基线一一对齐（禁 Object.keys 顺序依赖、禁随机）。
export function buildCases() {
  const cases = [];
  const push = (id, kind, payload) => cases.push(Object.freeze({ id, kind, payload }));

  for (const atom of ATOMS) {
    // A 副作用分类：裸原子 + 敌对 caller flags（策略必须压过 flags）
    push(`A/flow/${atom}`, 'flowMutation', { steps: [{ atom }] });
    push(`A/events/${atom}`, 'eventsMutation', { events: [{ atom }] });
    push(`A/flow-flags/${atom}`, 'flowMutation', {
      steps: [{ atom, mutation: false, destructive: false, relationWrite: false, entityBindings: [] }],
    });
    push(`A/events-flags/${atom}`, 'eventsMutation', {
      events: [{ atom, mutation: false, destructive: false, relationWrite: false, entityBindings: [] }],
    });
    // A' 无 entityBindings 字段（只读原子的合法形态）
    push(`A/flow-nobind/${atom}`, 'flowBindings', { id: 'flow-nobind', steps: [{ atom, sourceIntentId: 'source_1' }] });
    push(`A/events-nobind/${atom}`, 'eventBindings', {
      schemaVersion: 2, caseId: 'tc-facets', events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom }],
    });

    for (const roles of ROLE_SETS) {
      const label = roleLabel(roles);
      // B 逐操作绑定必需角色（flow 侧 policyForAtom / events 侧 legacy 投影）
      push(`B/flow/${atom}/${label}`, 'flowBindings', { id: 'flow-policy', steps: [flowStep(atom, roles)] });
      push(`B/events/${atom}/${label}`, 'eventBindings', {
        schemaVersion: 2, caseId: 'tc-facets', events: [frozenEvent(atom, roles)],
      });
      // C 草稿期 expectedRoles（provenance 与事件三元组对齐）
      push(`C/draft/${atom}/${label}`, 'draft', {
        eventsDocument: { schemaVersion: 2, caseId: 'tc-facets', events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom, action: 'click' }] },
        provenance: roles.map((role) => provenanceRow(atom, role)),
      });
    }

    // D 回放准入只读通道：action × url 组合（无 frozen authority）
    for (const action of READ_ACTIONS) {
      for (const url of READ_URLS) {
        const event = { stepId: 'atstep_1', intentId: 'intent_1', atom, action };
        if (url) event.url = url;
        for (const docUrl of [null, '{{baseUrl}}/ai-manager/process/list']) {
          const document = { schemaVersion: 2, caseId: 'tc-facets', events: [event] };
          if (docUrl) document.url = docUrl;
          push(`D/replay/${atom}/${action}/${url || 'nourl'}/${docUrl ? 'docurl' : 'nodocurl'}`, 'replayAdmission', {
            caseId: 'tc-facets', document,
          });
        }
      }
    }
    // D' 只读原子带 text（assert 分支的合法未绑定信封）
    push(`D/replay-text/${atom}`, 'replayAdmission', {
      caseId: 'tc-facets',
      document: {
        schemaVersion: 2,
        caseId: 'tc-facets',
        url: '{{baseUrl}}/workflow',
        events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom, action: 'assert', text: '标题' }],
      },
    });

    // E 编译准入 execute 只读短路
    push(`E/compile/${atom}`, 'compileAdmission', {
      mode: 'execute',
      caseId: 'tc-facets',
      containsEntityMutation: true,
      flow: { id: 'flow-policy', steps: [flowStep(atom, ['subject'])] },
    });
    push(`E/compile-nobind/${atom}`, 'compileAdmission', {
      mode: 'execute',
      caseId: 'tc-facets',
      containsEntityMutation: true,
      flow: { id: 'flow-policy', steps: [{ atom, sourceIntentId: 'source_1' }] },
    });
  }

  // F 混合文档：只读 + 变更混装，钉住「整份判定」而非逐条判定
  for (const atom of ATOMS) {
    push(`F/mixed-flow/${atom}`, 'flowMutation', {
      steps: [{ atom: 'nav.workflowManagement' }, { atom }],
    });
    push(`F/mixed-bindings/${atom}`, 'flowBindings', {
      id: 'flow-policy',
      steps: [
        { atom: 'nav.workflowManagement', sourceIntentId: 'source_0' },
        flowStep(atom, ['subject']),
      ],
    });
  }

  return Object.freeze(cases);
}

// 单一 runner：改写前后两版模块共用，杜绝「两份 runner 各自漂移」。
export function runCase(admission, testCase) {
  const { kind, payload } = testCase;
  const bytes = (document) => Buffer.from(JSON.stringify(document), 'utf8');
  try {
    if (kind === 'flowMutation') return admission.flowContainsEntityMutation(payload);
    if (kind === 'eventsMutation') return admission.eventsContainEntityMutation(payload);
    if (kind === 'flowBindings') return admission.requiredFlowEntityBindings(payload);
    if (kind === 'eventBindings') return admission.requiredEventEntityBindings(payload);
    if (kind === 'draft') {
      return admission.buildEntityBindingsDraft({
        eventsBytes: bytes(payload.eventsDocument),
        eventsDocument: payload.eventsDocument,
        provenance: payload.provenance,
      });
    }
    if (kind === 'replayAdmission') {
      return admission.checkReplayEntityAdmission({
        caseId: payload.caseId,
        eventsBytes: bytes(payload.document),
        eventsDocument: payload.document,
      });
    }
    if (kind === 'compileAdmission') return admission.checkCompileIdentityAdmission(payload);
  } catch (error) {
    return { __threw: String(error && error.message) };
  }
  return { __unknownKind: kind };
}

export function runCorpus(admission) {
  return buildCases().map((testCase) => ({ id: testCase.id, out: runCase(admission, testCase) }));
}

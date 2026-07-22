// real-uat-attestation 铸件（plan §3）：testcase + flow（validateDraft 过闸+Steven 确认）+ 身份剖面
// + 执行权威（audience=production、Steven 授权条件直签先例）+ 新 prd（authority sha 入 checksum）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { requiredFlowEntityBindings, calculateIdentityAdmissionSignature, hashIdentityAdmissionBytes } from '../../lib/entity-semantic-lock-preflight.mjs';
import { validateDraft } from '../../lib/compile-gate.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const CASE = 'tc_agent_id_readback_real_uat_v1';
const X_NAME = 'atl_同名对抗0722';
const CASE_DIR = join(ROOT, 'cases', CASE);
const AUTH_DIR = join(ROOT, 'runs', 'real-uat-attestation', CASE);
mkdirSync(CASE_DIR, { recursive: true });
mkdirSync(AUTH_DIR, { recursive: true });
const jt = (v) => JSON.stringify(v, null, 2) + '\n';

// 1) testcase
const tc = {
  schemaVersion: 1,
  caseId: CASE,
  channel: 'web',
  uniquePrefix: 'atl_',
  preconditions: ['已登录'],
  source: 'agent-id-readback 冻结 uatDefinition（prd observability 同名字段）四步真机见证；测试智能体 X 由本契约预置（D1=A，用后即删）',
  intents: [
    { intentId: 'intent_nav', text: '进入智能体管理列表页' },
    { intentId: 'intent_open', text: `按名称精确搜索并打开智能体 ${X_NAME}（双证门：信封读回+DOM 物理卡片，点击前对已签 platformId；期望进入详情路由）` },
  ],
};
writeFileSync(join(CASE_DIR, 'testcase.json'), jt(tc));

// 2) flow（validateDraft 过闸后带 gate 字段落盘；Steven 确认=D2 授权条件直签同一授权链）
const flow = {
  id: CASE,
  name: 'agent-id-readback 真机 UAT：名称+平台 ID 双定位到点击那一刻',
  category: 'normal',
  steps: [
    { atom: 'nav.agentManagement', params: {}, sourceIntentId: 'intent_nav', entityBindings: [{ candidateId: 'candidate-agent-list', role: 'subject' }] },
    { atom: 'agent.searchOpen', params: { searchKeyword: X_NAME, openName: X_NAME }, sourceIntentId: 'intent_open', entityBindings: [{ candidateId: 'candidate-agent-x', role: 'subject' }] },
  ],
};
const registry = JSON.parse(readFileSync(join(ROOT, 'lib/atoms-registry.snapshot.json'), 'utf8'));
const gateRe = validateDraft(flow, { prefix: tc.uniquePrefix, registry, initialStates: tc.preconditions });
if (!gateRe.ok) { console.error('validateDraft 未过:', JSON.stringify(gateRe.problems)); process.exit(1); }
const flowDoc = {
  caseId: CASE,
  uniquePrefix: 'atl_',
  preconditions: tc.preconditions,
  gate: { ok: true, atomsFrom: 'lib/atoms-registry.snapshot.json' },
  confirmedBy: 'Steven',
  confirmedAt: new Date().toISOString(),
  flow,
};
const flowPath = join(CASE_DIR, `flow-${CASE}.json`);
writeFileSync(flowPath, jt(flowDoc));

// 3) 身份剖面（真机填值=realmachine-live-verify 实证 + 尖峰卡片类名；denylist/成功信封复用三链剖面）
const profile = {
  _note: '通道剖面（web / Heren 中台，非凭据配置）：三链 denylist/成功信封复用；routes.agentList 与 agents.* 为 agent-id-readback 真机实证填值（realmachine-live-verify + 尖峰卡片采样）。',
  background: [
    '/ai-manager/auths/queryAuthCodes',
    '/ai-manager/auths/getMenu',
    '/ai-manager/commonData/getLoginUser',
    '/ai-manager/accountInfo/getAccountInfo',
  ],
  successField: 'status',
  successValue: 200,
  routes: { agentList: '/heren/aimanagement/agent/list' },
  agents: {
    listApi: {
      pathname: '/ai-manager/agent/setup/queryAgentPageList',
      method: 'GET',
      queryParam: 'nameLike',
      recordsPath: 'data.list',
      totalPath: 'data.pageInfo.totalItems',
      hasNextPath: null,
      fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
    },
    itemContainer: '.agent-card',
    cardFields: { name: '.agent-card__title', code: '.agent-card__subtitle' },
  },
};
writeFileSync(join(CASE_DIR, 'profile.json'), jt(profile));

// 4) 执行权威（entity-pre-execution-authority；三链配方同款）
const bindings = requiredFlowEntityBindings(flow);
if (!Array.isArray(bindings) || !bindings.length) { console.error('绑定投影未闭合:', bindings?.reason); process.exit(1); }
const artifact = {
  schemaVersion: 1, artifactKind: 'entity-pre-execution-authority', authorizedFor: 'compile-execute',
  caseId: CASE, signed: true, signerId: 'Steven', signedAt: new Date().toISOString(), audience: 'production',
  flowSha256: hashIdentityAdmissionBytes(readFileSync(flowPath)),
  testcaseSha256: hashIdentityAdmissionBytes(readFileSync(join(CASE_DIR, 'testcase.json'))),
  bindings: bindings.map((b) => ({ ...b })),
};
artifact.signature = calculateIdentityAdmissionSignature(artifact);
const authText = jt(artifact);
const authRel = `runs/real-uat-attestation/${CASE}/execute-authority.json`;
writeFileSync(join(ROOT, authRel), authText);
const authSha = createHash('sha256').update(authText).digest('hex');

// 5) 新 prd（扁平每用例 prd；authority sha 入 checksum，冻结件 sha 由 sign 后续写入）
const prd = {
  schemaVersion: 2,
  caseId: CASE,
  task: `agent-id-readback 真机 UAT 见证用例（uatDefinition 四步；契约 real-uat-attestation，GRILL 三分岔 Steven 全 A）：测试智能体 ${X_NAME} 一件两放——全场唯一时全链 PASS；预置精确同名第二件后回放同一冻结件必 AMBIGUOUS 不点击（NEEDS_HUMAN·AMBIGUOUS_ACTION 为预期正确行为）。用后即删+归零证据。`,
  testChecksums: {
    [authRel]: authSha,
  },
  stories: [],
};
writeFileSync(join(ROOT, 'loop', `prd-${CASE}.json`), jt(prd));
console.log('steps:', flow.steps.map((s) => `${s.atom}<-${s.sourceIntentId}`).join('|'));
console.log('bindings:', bindings.length, '| authSha:', authSha);
console.log('CRAFT-OK');

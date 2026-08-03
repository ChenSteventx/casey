#!/usr/bin/env node
// chiefcomplaint-sendandwait-admission v2 后继验收金牌。
// 纯 Node / 零 SUT：只读现役用例字节，驱动纯函数与既有零 SUT sign 金牌；不启动浏览器、网络或 fake SUT。

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateIdentityAdmissionSignature,
  checkCompileIdentityAdmission,
  flowContainsEntityMutation,
  hashIdentityAdmissionBytes,
  readIdentityAdmissionAuthorityFromPrd,
  requiredFlowEntityBindings,
  validateFrozenEntityLockArtifact,
} from '../../lib/entity-semantic-lock-preflight.mjs';
import {
  admitDestructiveTargetContinuity,
  requiresTargetContinuityRef,
} from '../../lib/entity-destructive-continuity.mjs';
import {
  AGENT_IDENTITY_MODE_NETWORK_CODE,
  parseAgentIdentityProfile,
} from '../../lib/agent-identity-profile.mjs';
import { resolveDualIdentity } from '../../lib/agent-identity-gate.mjs';
import { screenTier2CaseAuthorization } from '../../lib/selftest-tier2.mjs';
import { validateSuiteManifestDoc } from '../../lib/selftest-tier2-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CASE_ID = 'tc_chiefcomplaint_smoke';
const CASE_DIR = join(ROOT, 'cases', CASE_ID);
const FLOW_PATH = join(CASE_DIR, `flow-${CASE_ID}.json`);
const TESTCASE_PATH = join(CASE_DIR, 'testcase.json');
const EVENTS_PATH = join(CASE_DIR, 'events.json');
const PROFILE_PATH = join(CASE_DIR, 'profile.json');
const EXPECTED_PATH = join(CASE_DIR, 'expected.frozen.json');
const BINDINGS_PATH = join(CASE_DIR, 'entity-bindings.draft.json');
const OBSERVATIONS_PATH = join(CASE_DIR, 'identity-observations.compile.json');
const LOCKS_PATH = join(CASE_DIR, 'entity-locks.frozen.json');
const REGISTRY_PRD_PATH = join(ROOT, 'loop', `prd-${CASE_ID}.json`);
const MANIFEST_PATH = join(ROOT, 'cases', 'tier2-suite.manifest.json');
const SIGN_GOLDEN = join(ROOT, 'tests', '_golden', 'agent-id-sign-observation.zero-sut.golden.mjs');

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const repoKey = (path) => relative(ROOT, path).split(sep).join('/');

const failures = [];
let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error)}`);
    console.error(`FAIL ${name}: ${String(error?.message || error)}`);
  }
}

const flowBytes = readFileSync(FLOW_PATH);
const testcaseBytes = readFileSync(TESTCASE_PATH);
const flowDoc = JSON.parse(flowBytes.toString('utf8'));
const eventsDoc = json(EVENTS_PATH);
const profileDoc = json(PROFILE_PATH);

// A5：现役 flow 每个需绑定步骤恰有 subject；删任一绑定即 fail-closed。
check('A5 flow subject bindings complete', () => {
  const bindings = requiredFlowEntityBindings(flowDoc.flow);
  assert(Array.isArray(bindings) && bindings.length > 0, '现役 flow 未形成闭合绑定集');
  assert(bindings.every((row) => row.role === 'subject'), '现役 flow 含非 subject 绑定');
  assert(bindings.length === flowDoc.flow.steps.length, '现役 flow 不是逐步恰一 subject');
});

check('A5 missing binding is rejected', () => {
  const broken = clone(flowDoc.flow);
  delete broken.steps[0].entityBindings;
  const result = requiredFlowEntityBindings(broken);
  assert(result?.ok === false && result.reason === 'ENTITY_BINDING_REQUIRED_ROLES_INVALID', '缺绑定未被精确拒绝');
});

// A6：本例原子均不索目标连续性 ref；加入真实破坏原子后空 ref 必拒。
check('A6 current event atoms do not require destructive continuity', () => {
  assert(eventsDoc.events.every((event) => requiresTargetContinuityRef(event.atom) === false), '本例原子被误纳入破坏性连续性门');
  const admitted = admitDestructiveTargetContinuity({ events: eventsDoc.events, resolvedRefByStep: new Map() });
  assert(admitted.ok === true, '本例在空连续性 ref 表下未放行');
});

check('A6 destructive negative control is rejected', () => {
  const destructive = [...eventsDoc.events, {
    stepId: 'negative_destructive_step', intentId: 'negative_destructive_intent', atom: 'workflow.deleteByName', action: 'click',
  }];
  const denied = admitDestructiveTargetContinuity({ events: destructive, resolvedRefByStep: new Map() });
  assert(denied.ok === false && denied.reason === 'DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF', '破坏性空 ref 负控未拒绝');
});

// A7：缺权威必须拒；规范 PRD checksum 读取后铸出的 opaque authority 才能放行。
check('A7 missing execute authority is rejected before execution', () => {
  const requiredBindings = requiredFlowEntityBindings(flowDoc.flow);
  const denied = checkCompileIdentityAdmission({
    mode: 'execute', caseId: CASE_ID, containsEntityMutation: true,
    flowBytes, testcaseBytes, requiredBindings, flow: flowDoc.flow,
  });
  assert(denied.ok === false && denied.reason === 'PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID', '缺预执行权威未拒绝');
});

check('A7 checksum-published execute authority admits exact bytes', () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const prdId = `chiefv2golden-${suffix}`;
  const scratchRel = `.golden-scratch-chief-v2-successor-${suffix}`;
  const scratchDir = join(ROOT, scratchRel);
  const artifactKey = `${scratchRel}/execute-authority.json`;
  const artifactPath = join(ROOT, artifactKey);
  const prdPath = join(ROOT, 'loop', `prd-${prdId}.json`);
  let ownsScratch = false;
  let ownsPrd = false;
  try {
    mkdirSync(scratchDir, { recursive: false });
    ownsScratch = true;
    const bindings = requiredFlowEntityBindings(flowDoc.flow);
    const unsigned = {
      schemaVersion: 1,
      artifactKind: 'entity-pre-execution-authority',
      authorizedFor: 'compile-execute',
      caseId: CASE_ID,
      signed: true,
      signerId: 'golden-human-fixture',
      signedAt: '2026-08-03T00:00:00.000Z',
      audience: 'test',
      flowSha256: hashIdentityAdmissionBytes(flowBytes),
      testcaseSha256: hashIdentityAdmissionBytes(testcaseBytes),
      bindings,
    };
    const artifactText = jsonText({ ...unsigned, signature: calculateIdentityAdmissionSignature(unsigned) });
    writeFileSync(artifactPath, artifactText, { flag: 'wx' });
    const prdText = jsonText({
      schemaVersion: 2, contractKind: 'registry', caseId: prdId,
      task: 'zero-sut execute authority golden fixture',
      testChecksums: { [artifactKey]: sha256(Buffer.from(artifactText)) }, stories: [],
    });
    writeFileSync(prdPath, prdText, { flag: 'wx' });
    ownsPrd = true;
    const read = readIdentityAdmissionAuthorityFromPrd({ prdId, artifactKey, domain: 'execute' });
    assert(read.ok === true, '规范 PRD 未铸出 execute authority');
    const admitted = checkCompileIdentityAdmission({
      mode: 'execute', caseId: CASE_ID, containsEntityMutation: flowContainsEntityMutation(flowDoc.flow),
      executeAuthority: read.authority, flowBytes, testcaseBytes, requiredBindings: bindings, flow: flowDoc.flow,
    });
    assert(admitted.ok === true, '精确字节与权威匹配后仍未放行');
  } finally {
    if (ownsPrd) rmSync(prdPath, { force: true });
    if (ownsScratch) rmSync(scratchDir, { recursive: true, force: true });
  }
});

// A8/A12/A13：复用已冻结的 v2 sign 接缝矩阵；分段逐个跑，避免把大测试的偶然绿当覆盖。
for (const section of ['c1', 'c2', 'c3', 'c4']) {
  check(`A8/A12/A13 sign-observation control ${section}`, () => {
    const run = spawnSync(process.execPath, [SIGN_GOLDEN, section], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    assert(run.status === 0, `既有 sign 负控段 ${section} exit ${run.status ?? 'null'}`);
  });
}

// A11：网络信封单证编号；DOM 卡只准 name，模式/字段不闭合均浏览器前拒。
const networkProfile = {
  identityMode: AGENT_IDENTITY_MODE_NETWORK_CODE,
  itemContainer: '[data-golden-agent-card]',
  cardFields: { name: '[data-golden-agent-name]' },
  listApi: {
    pathname: '/golden/agents/query', method: 'GET', queryParam: 'keyword',
    recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: 'data.hasNext',
    fields: { id: 'id', code: 'code', name: 'name' },
  },
};

check('A11 network-code DOM-name profile positive and negative controls', () => {
  const good = parseAgentIdentityProfile(networkProfile);
  assert(good.ok === true && good.mode === AGENT_IDENTITY_MODE_NETWORK_CODE, '合法 network-code 剖面未通过');
  const withDomCode = parseAgentIdentityProfile({ ...networkProfile, cardFields: { ...networkProfile.cardFields, code: '.code' } });
  assert(withDomCode.ok === false, 'DOM code 负控未拒绝');
  const unknownMode = parseAgentIdentityProfile({ ...networkProfile, identityMode: 'unknown-mode' });
  assert(unknownMode.ok === false, '未知 identityMode 负控未拒绝');
  const incompleteEnvelope = clone(networkProfile);
  delete incompleteEnvelope.listApi.fields.id;
  assert(parseAgentIdentityProfile(incompleteEnvelope).ok === false, '不完整网络信封负控未拒绝');
});

check('A11 target profile has the v2 identity channel', () => {
  const parsed = parseAgentIdentityProfile(profileDoc.agents);
  assert(parsed.ok === true && parsed.mode === AGENT_IDENTITY_MODE_NETWORK_CODE, '目标 profile.agents 尚未闭合 network-code-dom-name-v1');
});

check('A13 replay identity mismatch controls release zero target', () => {
  const base = {
    mode: AGENT_IDENTITY_MODE_NETWORK_CODE,
    dom: { status: 'unique', name: 'golden-agent' },
    envelope: { status: 'ok', rows: [{ id: 'golden-platform-id', code: 'golden-code', name: 'golden-agent' }] },
    expected: {
      openName: 'golden-agent', code: 'golden-code', signedName: 'golden-agent',
      signedCode: 'golden-code', signedPlatformId: 'golden-platform-id',
    },
  };
  assert(resolveDualIdentity(base).resolution === 'unique', '合法三元组未唯一解析');
  assert(resolveDualIdentity({ ...base, expected: { ...base.expected, signedName: 'replacement-name' } }).resolution === 'action_failed', '同名替换负控未拒绝');
  assert(resolveDualIdentity({ ...base, expected: { ...base.expected, signedCode: 'replacement-code' } }).resolution === 'action_failed', '编号错配负控未拒绝');
  assert(resolveDualIdentity({ ...base, expected: { ...base.expected, signedPlatformId: 'replacement-id' } }).resolution === 'action_failed', '平台标识错配负控未拒绝');
});

check('A12/A13 target fresh observation and signed v2 artifacts are closed', () => {
  for (const path of [BINDINGS_PATH, OBSERVATIONS_PATH, LOCKS_PATH]) assert(existsSync(path), `${repoKey(path)} 不在场`);
  const bindings = json(BINDINGS_PATH);
  const observations = json(OBSERVATIONS_PATH);
  const locks = json(LOCKS_PATH);
  assert(bindings.schemaVersion === 2, 'entity-bindings draft 不是 v2');
  assert(observations.schemaVersion === 1 && observations.artifactKind === 'compile-identity-observation', 'compile 身份观察件形状不符');
  assert(validateFrozenEntityLockArtifact(locks)?.schemaVersion === 2, '冻结实体锁不是有效 v2 人签件');
  assert(bindings.identityObservationsSha256 === hashIdentityAdmissionBytes(readFileSync(OBSERVATIONS_PATH)), 'draft 未绑定观察件原始字节');
  assert(bindings.identityProfileDigest === observations.identityProfileDigest, 'draft/profile observation digest 未闭合');
  assert(locks.identityObservationsSha256 === hashIdentityAdmissionBytes(readFileSync(OBSERVATIONS_PATH)), '冻结锁未绑定观察件原始字节');
  assert(locks.identityProfileDigest === observations.identityProfileDigest, '冻结锁/profile observation digest 未闭合');
  const registry = json(REGISTRY_PRD_PATH);
  const expectedKey = repoKey(EXPECTED_PATH);
  const locksKey = repoKey(LOCKS_PATH);
  assert(!String(registry.task || '').includes('v1'), '用例 registry 仍宣称 v1');
  assert(registry.testChecksums?.[expectedKey] === sha256(readFileSync(EXPECTED_PATH)), 'registry 未冻结当前 expected');
  assert(registry.testChecksums?.[locksKey] === sha256(readFileSync(LOCKS_PATH)), 'registry 未冻结当前 v2 locks');
});

// A15：目标成员必须 mutation + per-run approval + v2 lock；壳层还须消费本轮授权位。
check('A15 desired manifest shape and per-run authorization controls', () => {
  const manifest = json(MANIFEST_PATH);
  const desired = clone(manifest);
  const member = desired.members.find((row) => row.caseId === CASE_ID);
  assert(member, '目标 tier-2 成员缺席');
  member.effect = 'mutation';
  member.perRunApproval = true;
  member.artifacts[repoKey(LOCKS_PATH)] = '0'.repeat(64);
  assert(validateSuiteManifestDoc(desired).ok === true, '期望态 manifest 结构本身不合法');
  const missingPerRun = clone(desired);
  delete missingPerRun.members.find((row) => row.caseId === CASE_ID).perRunApproval;
  assert(validateSuiteManifestDoc(missingPerRun).ok === false, 'mutation 缺逐次授权义务未拒绝');
  const denied = screenTier2CaseAuthorization({ smokeAuthorized: true, effect: 'mutation', authorizedMutation: false });
  const admitted = screenTier2CaseAuthorization({ smokeAuthorized: true, effect: 'mutation', authorizedMutation: true });
  assert(denied.ran === false && denied.refusalReason === 'per_run_mutation_authorized_flag_absent', '缺本轮 mutation 授权未拒跑');
  assert(admitted.ran === true, '本轮 mutation 授权在场仍未放行');
});

check('A15 target manifest member is mutation, per-run, and hash-closed', () => {
  const manifest = json(MANIFEST_PATH);
  const member = manifest.members.find((row) => row.caseId === CASE_ID);
  assert(member?.effect === 'mutation', '目标成员 effect 尚非 mutation');
  assert(member?.perRunApproval === true, '目标成员尚未声明逐次授权');
  const lockKey = repoKey(LOCKS_PATH);
  assert(typeof member?.artifacts?.[lockKey] === 'string', '目标成员 artifact 集尚无 v2 lock');
  for (const [key, digest] of Object.entries(member.artifacts)) {
    const path = join(ROOT, key);
    assert(existsSync(path), `manifest artifact ${key} 不在场`);
    assert(sha256(readFileSync(path)) === digest, `manifest artifact ${key} hash 未闭合`);
  }
});

console.log(`\nchiefcomplaint v2 successor: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('RED: v2 successor target state is not yet complete');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('GREEN: v2 successor zero-SUT contract satisfied');

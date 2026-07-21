#!/usr/bin/env node
// entity-ui-wiring W2 验收金牌：workflow.bindAgent 原子接线 + 双 receipt 语义锁链贯通。
// 纯 node：只调纯函数 + 静态读取 + 一次 bin/sign.mjs 子进程（零 LLM、零浏览器、零网络、零 server、零 fake SUT）。
// 断言纪律：退出码 + 精确 reason 字段 + deepEqual 钉结构；禁标记串 grep。
// 验收点（docs/plans/entity-ui-wiring/plan.md）：
//   A4a COMPILE_KNOWN_ATOMS 含 'workflow.bindAgent' 且恰 26（今日 25 → 红）。
//   A4b flow-bridge 对带 source+target 双 binding 的 bindAgent flow 放行（今日 registry 缺词条 → 红）；
//       对缺任一 binding 的 bindAgent flow 拒绝并含精确 reason（今日已绿，回归保护）。
//   A5  双 receipt 端到端锁链：compile-draft→confirm→sign(bin/sign.mjs)→replay 准入全链（今日全环已绿）。
//   A6  单边 frozen locks 过 replay 准入必得 FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID（今日绿，回归保护）。

import { deepStrictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildFlow, validateBridge } from '../../lib/flow-bridge.mjs';
import { COMPILE_KNOWN_ATOMS } from '../../lib/compile-atoms.mjs';
import {
  buildEntityBindingsDraft,
  calculateIdentityAdmissionSignature,
  checkReplayEntityAdmission,
  hashIdentityAdmissionBytes,
  readIdentityAdmissionAuthorityFromPrd,
} from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const SECTION = process.argv[2] ?? 'all';
if (!new Set(['all', 'a4a', 'a4b', 'a5', 'a6']).has(SECTION)) process.exit(2);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
const SCRATCH_ROOT = join(ROOT, '.golden-scratch-entity-ui-wiring');
// 关系原子 side-effect policy 未闭合时 flow-bridge 的确定性拒绝串（lib/flow-bridge.mjs:133 逐字）。
const ROLES_POLICY_PROBLEM = '实体绑定策略未闭合（ENTITY_BINDING_REQUIRED_ROLES_INVALID）';

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';
const sha = (value) => createHash('sha256').update(value).digest('hex');

// ── A4a：编译分派表识别 bindAgent，总数恰 26 ──────────────────────────────────
test('a4a', 'A4a COMPILE_KNOWN_ATOMS 含 workflow.bindAgent', () => {
  assert(COMPILE_KNOWN_ATOMS.has('workflow.bindAgent'),
    `COMPILE_KNOWN_ATOMS 缺 workflow.bindAgent（今日 ${COMPILE_KNOWN_ATOMS.size} 原子无 bindAgent 编译器）`);
});

test('a4a', 'A4a 编译原子总数恰 26', () => {
  assert(COMPILE_KNOWN_ATOMS.size === 26,
    `COMPILE_KNOWN_ATOMS.size=${COMPILE_KNOWN_ATOMS.size}（期望 26：25 现有 + workflow.bindAgent）`);
});

// ── A4b：flow-bridge 对 bindAgent flow 的放行/拒绝 ────────────────────────────
// bindAgent 落在节点配置抽屉域（plan W2：复用 doOpenNode 域锁纪律；registry params nodeLabel/agentName）。
// 生成一条单步 bindAgent flow，前置态种齐画布/抽屉域诸态，让状态机闸与放行判定只系于 registry 是否登记 bindAgent。
const bridgeTestcase = {
  caseId: 'tc_bridge_bindagent', title: '绑定智能体', uniquePrefix: 'atl_',
  preconditions: ['已登录', '画布已开', '节点抽屉已开'],
  steps: [{ intentId: 'i_bind', intent: '绑定智能体' }],
};
const bindAgentMapping = (entityBindings) => [{
  intentId: 'i_bind', atom: 'workflow.bindAgent',
  params: { nodeLabel: '智能体/工作流', agentName: '审批助手' },
  entityBindings,
}];
const bothBindings = [
  { candidateId: 'candidate-workflow-main', role: 'source' },
  { candidateId: 'candidate-agent-main', role: 'target' },
];

test('a4b', 'A4b flow-bridge 放行带 source+target 双 binding 的 bindAgent flow', () => {
  const result = validateBridge(bridgeTestcase, bindAgentMapping(bothBindings), { registry: REGISTRY });
  assert(result.ok === true,
    `双 binding bindAgent flow 未被 flow-bridge 放行（今日 registry 缺 bindAgent 词条）；problems=${JSON.stringify(result.problems)}`);
});

for (const soleRole of ['source', 'target']) {
  test('a4b', `A4b flow-bridge 拒绝仅 ${soleRole} 单边 binding 的 bindAgent flow 且报精确 reason`, () => {
    // buildFlow 接受单个合法角色（结构层不猜完整关系）——拒绝须来自 side-effect 策略层的角色闭合闸。
    const flow = buildFlow(bridgeTestcase, bindAgentMapping([{ candidateId: 'candidate-workflow-main', role: soleRole }]));
    assert(flow.steps[0].entityBindings.length === 1 && flow.steps[0].entityBindings[0].role === soleRole, 'buildFlow 未保真单边角色');
    const result = validateBridge(bridgeTestcase, bindAgentMapping([{ candidateId: 'candidate-workflow-main', role: soleRole }]), { registry: REGISTRY });
    assert(result.ok === false, `单边 ${soleRole} bindAgent flow 被误放行`);
    assert(result.problems.includes(ROLES_POLICY_PROBLEM),
      `单边 ${soleRole} 拒绝未含精确角色闭合 reason；problems=${JSON.stringify(result.problems)}`);
  });
}

// ── 双 receipt 端到端链（A5）：compile-draft → confirm → sign → replay 准入 ──────
const CASE_ID = 'tc_eui_bindagent_lockchain';
const workflowReceipt = createEntityLockReceipt({
  lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-workflow',
  expected: { name: '工作流A', code: 'WF-A' }, observed: { name: '工作流A', code: 'WF-A' }, source: 'user-confirmed',
});
const agentReceipt = createEntityLockReceipt({
  lockId: 'lock-agent-main', kind: 'agent', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-agent',
  expected: { name: '智能体A', code: 'AG-A' }, observed: { name: '智能体A', code: 'AG-A' }, source: 'user-confirmed',
});

// prepareSignCase 双 receipt 变体（样板：tests/_golden/entity-binding-operability-successor.zero-sut.golden.mjs:33-73）。
// events 手编、含单条 relation bindAgent event；provenance 两行 source+target；confirmations 两 receipt 两 lockId。
function prepareBindAgentSignCase(caseId, physicalDir) {
  mkdirSync(physicalDir, { recursive: true });
  const signedAt = '2026-07-22T08:00:00.000Z';
  const events = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow', recordedAt: signedAt,
    compiledBy: 'entity-ui-wiring-golden', authored: false,
    events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', action: 'click', text: '绑定智能体' }],
  };
  const eventsText = jsonText(events);
  const provenance = [
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', sourceIntentId: 'source_1', candidateId: 'candidate-workflow-main', role: 'source' },
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'target' },
  ];
  const draftResult = buildEntityBindingsDraft({ eventsBytes: Buffer.from(eventsText), eventsDocument: events, provenance });
  assert(draftResult.ok === true, `compile-draft 环红：buildEntityBindingsDraft ${draftResult.reason}`);
  const confirmations = provenance.map((row) => ({ ...row, receipt: row.candidateId.includes('agent') ? agentReceipt : workflowReceipt }));
  const names = {
    draft: 'expected.draft.json', events: 'events.json', bindings: 'entity-bindings.draft.json',
    confirmations: 'entity-confirmations.json', frozen: 'expected.frozen.json', locks: 'entity-locks.frozen.json',
  };
  writeFileSync(join(physicalDir, names.draft), jsonText({
    caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [],
  }));
  writeFileSync(join(physicalDir, names.events), eventsText);
  writeFileSync(join(physicalDir, names.bindings), jsonText(draftResult.draft));
  writeFileSync(join(physicalDir, names.confirmations), jsonText({ caseId, confirmations }));
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  writeFileSync(prdPath, jsonText({ schemaVersion: 1, caseId, task: 'entity-ui-wiring bindAgent lockchain golden', testChecksums: {}, stories: [] }));
  return {
    caseId, signedAt, prdPath, events, eventsText,
    draft: join(physicalDir, names.draft), eventsFile: join(physicalDir, names.events),
    bindings: join(physicalDir, names.bindings), confirmations: join(physicalDir, names.confirmations),
    frozen: join(physicalDir, names.frozen), locks: join(physicalDir, names.locks),
  };
}

function runSign(fixture) {
  return spawnSync(process.execPath, [SIGN, fixture.caseId,
    '--draft', fixture.draft, '--prd', fixture.prdPath, '--frozen-out', fixture.frozen,
    '--signer', 'golden-human', '--against-build', 'golden-build', '--signed-at', fixture.signedAt,
    '--events', fixture.eventsFile, '--entity-bindings-draft', fixture.bindings,
    '--entity-confirmations', fixture.confirmations, '--entity-locks-out', fixture.locks,
    '--audience', 'test'], { cwd: ROOT, encoding: 'utf8' });
}

test('a5', 'A5 双 receipt 端到端链 compile-draft→confirm→sign→replay 准入全绿', () => {
  const scratchDir = join(SCRATCH_ROOT, CASE_ID);
  const prdPath = join(ROOT, 'loop', `prd-${CASE_ID}.json`);
  const locksKey = `.golden-scratch-entity-ui-wiring/${CASE_ID}/entity-locks.frozen.json`;
  try {
    rmSync(scratchDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
    const fixture = prepareBindAgentSignCase(CASE_ID, scratchDir);

    // sign 环：真 CLI 冻结双 receipt relation 锁（退出码钉死）。
    const signResult = runSign(fixture);
    assert(signResult.status === 0, `sign 环红：exit ${signResult.status}；stderr=${signResult.stderr}`);

    // 冻结锁的 relation 双边 binding 结构 deepEqual 钉死（source=workflow / target=agent，各自 lockId + receiptHash）。
    const frozen = JSON.parse(readFileSync(fixture.locks, 'utf8'));
    assert(frozen.artifactKind === 'entity-locks-frozen' && frozen.signed === true
      && frozen.replayReady === true && frozen.audience === 'test', 'frozen locks 顶层封装不符');
    assert(frozen.eventsSha256 === hashIdentityAdmissionBytes(Buffer.from(fixture.eventsText)), 'frozen locks eventsSha256 未绑原字节');
    deepStrictEqual(frozen.bindings, [
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', role: 'source', candidateId: 'candidate-workflow-main', lockId: 'lock-workflow-main', receiptHash: workflowReceipt.receiptHash },
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', role: 'target', candidateId: 'candidate-agent-main', lockId: 'lock-agent-main', receiptHash: agentReceipt.receiptHash },
    ]);

    // replay 准入环：从 sign 写入 PRD 的 checksum 铸 opaque authority，双边锁齐 → 放行。
    const read = readIdentityAdmissionAuthorityFromPrd({ prdId: CASE_ID, artifactKey: locksKey, domain: 'verify' });
    assert(read.ok === true, `replay 环红：opaque authority 未铸造 ${read.reason}`);
    const replay = checkReplayEntityAdmission({
      caseId: CASE_ID, eventsBytes: Buffer.from(fixture.eventsText), eventsDocument: fixture.events, frozenLockAuthority: read.authority,
    });
    assert(replay.ok === true && replay.allowBrowserLaunch === true && replay.reason === null
      && replay.authorityKind === 'frozen-entity-locks-internal-policy',
      `replay 准入未放行双 receipt 锁链：${JSON.stringify(replay)}`);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
    if (existsSync(SCRATCH_ROOT)) { try { rmSync(SCRATCH_ROOT, { recursive: true, force: true }); } catch { /* 尽力 */ } }
  }
});

// ── A6：单边 frozen locks 过 replay 准入必红角色闭合（回归保护，今日绿）───────────
// 手工铸造单边（仅 source / 仅 target）frozen locks artifact（freeze 器不产此形，须绕 freeze 直造 + 自签）。
// 经固定 PRD checksum 铸 opaque authority 后过 replay 准入 → 关系原子角色不齐必得 FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID。
function craftSingleSidedFrozen(caseId, soleRole) {
  const events = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow', recordedAt: '2026-07-22T00:00:00.000Z',
    compiledBy: 'entity-ui-wiring-golden', authored: false,
    events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', action: 'click', text: '绑定智能体' }],
  };
  const eventsText = jsonText(events);
  const eventsBytes = Buffer.from(eventsText);
  const artifact = {
    schemaVersion: 1, artifactKind: 'entity-locks-frozen', caseId, signed: true, replayReady: true,
    signerId: 'fixture-human', signedAt: '2026-07-22T01:00:00.000Z', audience: 'test',
    eventsSha256: hashIdentityAdmissionBytes(eventsBytes),
    bindings: [{
      stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', role: soleRole,
      candidateId: 'candidate-workflow-main', lockId: 'lock-workflow-main', receiptHash: `sha256:${'a'.repeat(64)}`,
    }],
  };
  artifact.signature = calculateIdentityAdmissionSignature(artifact);
  return { events, eventsBytes, artifactText: jsonText(artifact) };
}

for (const soleRole of ['source', 'target']) {
  test('a6', `A6 仅 ${soleRole} 单边 frozen locks 过 replay 准入必红 FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID`, () => {
    const caseId = `tc_eui_bindagent_${soleRole}only`;
    const scratchDir = join(SCRATCH_ROOT, caseId);
    const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
    const locksKey = `.golden-scratch-entity-ui-wiring/${caseId}/entity-locks.frozen.json`;
    try {
      rmSync(scratchDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
      mkdirSync(scratchDir, { recursive: true });
      const { events, eventsBytes, artifactText } = craftSingleSidedFrozen(caseId, soleRole);
      writeFileSync(join(scratchDir, 'entity-locks.frozen.json'), artifactText);
      writeFileSync(prdPath, jsonText({ schemaVersion: 2, caseId, task: 'entity-ui-wiring single-sided regression', testChecksums: { [locksKey]: sha(artifactText) }, stories: [] }));

      const read = readIdentityAdmissionAuthorityFromPrd({ prdId: caseId, artifactKey: locksKey, domain: 'verify' });
      assert(read.ok === true, `单边 ${soleRole} opaque authority 未铸造 ${read.reason}`);
      const replay = checkReplayEntityAdmission({ caseId, eventsBytes, eventsDocument: events, frozenLockAuthority: read.authority });
      assert(replay.ok === false && replay.allowBrowserLaunch === false, `单边 ${soleRole} 被误放行：${JSON.stringify(replay)}`);
      assert(replay.reason === 'FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID',
        `单边 ${soleRole} reason 不符：${JSON.stringify(replay)}`);
      assert(replay.nextAction === 'REDRAFT_AND_RESIGN_ALL_EVENT_ROLES', `单边 ${soleRole} nextAction 不符：${JSON.stringify(replay)}`);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
      if (existsSync(SCRATCH_ROOT)) { try { rmSync(SCRATCH_ROOT, { recursive: true, force: true }); } catch { /* 尽力 */ } }
    }
  });
}

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-ui-wiring.bindagent-lockchain: ${failure}`);
  console.error(`RED  entity-ui-wiring.bindagent-lockchain/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-ui-wiring.bindagent-lockchain/${SECTION}: ${passed}/${passed} 全过（纯函数 + 本地文件 + 一次 sign 子进程，零 SUT）`);

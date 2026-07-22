#!/usr/bin/env node
// agent-id-readback 验收金牌 3：sign 观察对账面（plan §4 哈希闭环 + interface-spec §5，红先行）。
// 纯 node：纯函数 + 本地文件 + bin/sign.mjs 子进程（零 LLM、零浏览器、零网络、零 server、零 fake SUT）。
// 断言纪律：退出码 + deepEqual/字段钉结构；禁标记串 grep（判绿只信退出码，MEMORY 铁律）。
//
// accept 相冻结的公开面（plan §4「digest 闭合字段集与规范化算法在 accept 相冻结」授权本金牌钉死；
// interface-spec §3/§4/§5 未逐字给出的命名由此处冻结，实现必须迎合）：
//   - identityProfileDigest = 'sha256:' + sha256(JSON.stringify(递归按键排序的 listApi 闭合对象))；
//   - entity-bindings-draft v2 = v1 全字段 + { schemaVersion: 2, identityProfileDigest,
//     identityObservationsSha256 }（观察件原始字节 sha，命名对称既有 eventsSha256——sign 以 draft 侧
//     两字段为对账基准：观察件 digest 与 draft digest 必须相等、观察件字节 sha 必须命中）；
//   - entity-locks-frozen v2 = v1 全字段 + { schemaVersion: 2, identityProfileDigest,
//     identityObservationsSha256, identityObservations: [{ name, code, platformId, evidenceStepId, … }] }
//     （期望三元组进冻结锁，供 replay 做 click 前比对——plan §2/§4）。
//
// 检查面（任务书 1–7）：
//   c1 v2 draft + 齐全观察件 + 五元 join 对齐 → sign exit 0 且冻结锁携期望三元组
//      —— 今日必红：sign-cli-args 白名单不识 --entity-observations（exit 64 参数面拒）。
//   c2 v2 draft 缺观察件 → 65（今日碰巧绿：v2 形状被 freezeEntityBindingsDraft closedRecord 拒同为 65；
//      实现后语义变为「v2 强制观察件、缺件拒签」，同一退出码继续绿=回归保护）。
//   c3 join 错位（evidenceStepId 指 fill 而非终端 click）→ 65（今日红：exit 64 同 c1）。
//   c4 三错配各一：capturedAgainstBuild≠--against-build / identityProfileDigest 不符 / eventsSha256 不符
//      → 各 65（今日红：exit 64 同 c1）。
//   c5 陈旧观察件复用（对另一 events 字节完全自洽的观察件配本 events 签）→ 65（今日红：exit 64 同 c1）。
//   c6 拒签零新增：失败后 frozen-out/entity-locks/journal/tmp 全不存在、prd 字节零动（testChecksums 无新键）
//      —— 目录快照逐字节对照（今日绿：现 sign 拒签路径本就零落盘；冻结即绿=回归保护）。
//   c7 v1 兼容回归锁：不带 --entity-observations、v1 draft 走 lockchain 同款 happy → exit 0
//      （今日应绿，冻结即绿=回归保护：v1 路径逐字不变，interface-spec §5）。
//   c8 观察义务锚定字面量（codex R1-H5 修复钉）：观察义务集合从 events 的 atom+action 独立推导，
//      source.atom/row.atom 必须精确 'agent.searchOpen'、row.kind 必须 'agent'——观察件自报别的 atom
//      把矛头错开（真 searchOpen 无观察）必须 65；修前红：自报 atom 驱动 join、kind 只查非空，exit 0 过签。
// 旗标不识/模块缺席造成的失败逐条打印 RED 行并 exit 1（红先行取证格式）。

import { deepStrictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEntityBindingsDraft, hashIdentityAdmissionBytes } from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const SECTION = process.argv[2] ?? 'all';
if (!new Set(['all', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']).has(SECTION)) process.exit(2);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const SCRATCH_ROOT = join(ROOT, '.golden-scratch-agent-id-sign-observation');
const SIGNED_AT = '2026-07-22T08:00:00.000Z';
const BUILD = 'golden-build';
const AGENT_NAME = '互联网问诊-主诉';
const AGENT_CODE = 'AG-IM-001';
const AGENT_PLATFORM_ID = '1234567890123456789'; // 19 位纯数字字符串（interface-spec §6 同款形态）

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';

// ── identityProfileDigest（interface-spec §3；规范化算法在此冻结）────────────────
const LIST_API_PROFILE = {
  pathname: '/api/agents/query',
  method: 'GET',
  recordsPath: 'data.records',
  totalPath: 'data.total',
  hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
};
const canonicalValue = (value) => (Array.isArray(value)
  ? value.map(canonicalValue)
  : (value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
    : value));
const profileDigest = (listApi) => 'sha256:' + createHash('sha256').update(JSON.stringify(canonicalValue(listApi))).digest('hex');
const PROFILE_DIGEST = profileDigest(LIST_API_PROFILE);
const PROFILE_DIGEST_VARIANT = profileDigest({ ...LIST_API_PROFILE, pathname: '/api/agents/other' });

// ── 共同夹具：单 agent.searchOpen intent 的 fill/press/click 三 event ───────────
// agent.searchOpen 走默认 mutation policy（subject 单角色）：三 event 各携一条 subject provenance；
// 观察只 join 终端 click（atstep_3）——fill/press bindings 不要求观察也不许携观察（plan §4 join 基数）。
function buildEventsDoc(caseId, recordedAt = SIGNED_AT) {
  return {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/agent/list', recordedAt,
    compiledBy: 'agent-id-readback-golden', authored: false,
    events: [
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: AGENT_NAME },
      { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
      { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
    ],
  };
}
const PROVENANCE_STEP_IDS = ['atstep_1', 'atstep_2', 'atstep_3'];
const buildProvenance = () => PROVENANCE_STEP_IDS.map((stepId) => ({
  stepId, intentId: 'intent_1', atom: 'agent.searchOpen',
  sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
}));

const agentReceipt = createEntityLockReceipt({
  lockId: 'lock-agent-main', kind: 'agent', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-agent',
  expected: { name: AGENT_NAME, code: AGENT_CODE },
  observed: { name: AGENT_NAME, code: AGENT_CODE, platformId: AGENT_PLATFORM_ID },
  source: 'user-confirmed',
});

// 身份观察件（interface-spec §4 字段逐字；observations 行五元 join 键 + 三元组）。
function buildObservation({ caseId, eventsSha256, evidenceStepId = 'atstep_3', capturedAgainstBuild = BUILD, identityProfileDigest = PROFILE_DIGEST }) {
  return {
    schemaVersion: 1,
    artifactKind: 'compile-identity-observation',
    caseId,
    capturedAgainstBuild,
    identityProfileDigest,
    eventsSha256,
    source: { kind: 'compile-envelope', atom: 'agent.searchOpen', signed: false, replayReady: false },
    observations: [{
      kind: 'agent', name: AGENT_NAME, code: AGENT_CODE, platformId: AGENT_PLATFORM_ID,
      sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
      atom: 'agent.searchOpen', evidenceStepId, sourcePath: '/api/agents/query',
    }],
  };
}

// prepareSignCase（样板：entity-ui-wiring.bindagent-lockchain 的 prepareBindAgentSignCase）。
// draftVersion 2：v1 draft 基础上手造 v2（schemaVersion:2 + identityProfileDigest + 观察件字节 sha）；
// makeObservation(ctx) 允许各 check 注入错配观察件——draft 的 identityObservationsSha256 始终绑「实际
// 写盘的观察件字节」，保证各 check 只考目标那一处错配、不被 sha 失配噪声掩盖。
function prepareSignCase(caseId, physicalDir, {
  draftVersion = 2,
  writeObservationFile = true,
  makeObservation = (ctx) => buildObservation({ caseId, eventsSha256: ctx.eventsSha256 }),
  eventsDoc = null,
  provenance = null,
} = {}) {
  mkdirSync(physicalDir, { recursive: true });
  const events = eventsDoc ?? buildEventsDoc(caseId);
  const provRows = provenance ?? buildProvenance();
  const eventsText = jsonText(events);
  const eventsSha256 = hashIdentityAdmissionBytes(Buffer.from(eventsText));
  const draftResult = buildEntityBindingsDraft({
    eventsBytes: Buffer.from(eventsText), eventsDocument: events, provenance: provRows,
  });
  assert(draftResult.ok === true, `夹具自身红：buildEntityBindingsDraft ${draftResult.reason}`);

  const observation = makeObservation({ caseId, eventsSha256 });
  const observationText = jsonText(observation);
  const observationSha256 = hashIdentityAdmissionBytes(Buffer.from(observationText));

  const bindingsDraft = draftVersion === 2
    ? { ...draftResult.draft, schemaVersion: 2, identityProfileDigest: PROFILE_DIGEST, identityObservationsSha256: observationSha256 }
    : draftResult.draft;
  const confirmations = provRows.map((row) => ({ ...row, receipt: agentReceipt }));

  const names = {
    draft: 'expected.draft.json', events: 'events.json', bindings: 'entity-bindings.draft.json',
    confirmations: 'entity-confirmations.json', observations: 'identity-observations.compile.json',
    frozen: 'expected.frozen.json', locks: 'entity-locks.frozen.json',
  };
  writeFileSync(join(physicalDir, names.draft), jsonText({
    caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [],
  }));
  writeFileSync(join(physicalDir, names.events), eventsText);
  writeFileSync(join(physicalDir, names.bindings), jsonText(bindingsDraft));
  writeFileSync(join(physicalDir, names.confirmations), jsonText({ caseId, confirmations }));
  if (writeObservationFile) writeFileSync(join(physicalDir, names.observations), observationText);

  // 临时 prd：先清残留再 wx 独占写（绝不静默覆写并发会话的真 prd），finally 清理。
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  rmSync(prdPath, { force: true });
  const prdText = jsonText({ schemaVersion: 1, caseId, task: 'agent-id-readback sign-observation golden', testChecksums: {}, stories: [] });
  writeFileSync(prdPath, prdText, { flag: 'wx' });
  return {
    caseId, prdPath, prdText, events, eventsText, eventsSha256, observation, observationText, observationSha256,
    draft: join(physicalDir, names.draft), eventsFile: join(physicalDir, names.events),
    bindings: join(physicalDir, names.bindings), confirmations: join(physicalDir, names.confirmations),
    observationsFile: writeObservationFile ? join(physicalDir, names.observations) : null,
    frozen: join(physicalDir, names.frozen), locks: join(physicalDir, names.locks),
  };
}

function runSign(fixture, { withObservations = fixture.observationsFile !== null } = {}) {
  const argv = [SIGN, fixture.caseId,
    '--draft', fixture.draft, '--prd', fixture.prdPath, '--frozen-out', fixture.frozen,
    '--signer', 'golden-human', '--against-build', BUILD, '--signed-at', SIGNED_AT,
    '--events', fixture.eventsFile, '--entity-bindings-draft', fixture.bindings,
    '--entity-confirmations', fixture.confirmations, '--entity-locks-out', fixture.locks,
    '--audience', 'test'];
  if (withObservations) argv.push('--entity-observations', fixture.observationsFile);
  return spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8' });
}

function cleanupCase(caseId) {
  rmSync(join(SCRATCH_ROOT, caseId), { recursive: true, force: true });
  rmSync(join(ROOT, 'loop', `prd-${caseId}.json`), { force: true });
}

// 拒签零新增（interface-spec §5「拒签零新增产物（frozen/prd/journal/tmp）」）：
// 逐条失败 check 后调用；c6 另做整目录快照逐字节对照。
function assertRejectionLeftNoResidue(fixture) {
  assert(!existsSync(fixture.frozen), '拒签后 frozen-out 文件不应存在');
  assert(!existsSync(fixture.locks), '拒签后 entity-locks.frozen.json 不应存在');
  assert(!existsSync(fixture.locks + '.publish.json'), '拒签后不得留 publication journal');
  for (const path of [fixture.frozen, fixture.locks, fixture.prdPath]) {
    assert(!existsSync(path + '.tmp'), `拒签后不得留 tmp 残片：${path}.tmp`);
  }
  assert(readFileSync(fixture.prdPath, 'utf8') === fixture.prdText,
    '拒签后 prd 字节被改动（testChecksums 出现新键 = 拒签残留）');
}

function assertRejected(result, label) {
  assert(result.status === 65,
    `${label} 应 exit 65；实得 exit ${result.status}` +
    `${result.status === 64 ? '（今日红：sign-cli-args 白名单不识 --entity-observations，参数面 64 拒）' : ''}` +
    `；stderr=${(result.stderr || '').trim().slice(0, 160)}`);
  assert((result.stdout || '').trim() === '', `${label} 拒签须零 stdout（interface-spec §5 零输出）；实得 stdout=${(result.stdout || '').trim().slice(0, 120)}`);
}

// ── c1：v2 happy——齐全观察件 + 五元 join 对齐 → exit 0 且冻结锁携期望三元组 ────
test('c1', 'c1 v2 draft+齐全观察件+join 对齐 → sign exit 0 且冻结锁携期望三元组（今日红：不识 --entity-observations/v2 形状）', () => {
  const caseId = 'tc_air_signobs_happy';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId));
    const result = runSign(fixture);
    assert(result.status === 0,
      `v2 happy 应 exit 0；实得 exit ${result.status}（今日红：sign 不识 --entity-observations 旗标 / v2 draft 形状）；stderr=${(result.stderr || '').trim().slice(0, 200)}`);

    const frozen = JSON.parse(readFileSync(fixture.locks, 'utf8'));
    assert(frozen.artifactKind === 'entity-locks-frozen' && frozen.signed === true
      && frozen.replayReady === true && frozen.audience === 'test', 'frozen locks 顶层封装不符');
    assert(frozen.schemaVersion === 2, `frozen locks 应为 v2（schemaVersion=2）；实得 ${frozen.schemaVersion}`);
    assert(frozen.caseId === caseId, 'frozen locks caseId 不符');
    assert(frozen.eventsSha256 === fixture.eventsSha256, 'frozen locks eventsSha256 未绑 events 原始字节（既有 v1 义务在 v2 保留）');
    assert(frozen.identityProfileDigest === PROFILE_DIGEST, 'frozen locks 未携 identityProfileDigest（plan §4：冻结面携身份通道 digest）');
    assert(frozen.identityObservationsSha256 === fixture.observationSha256, 'frozen locks 未绑观察件原始字节 sha（plan §4：保留观察 hash）');

    // 期望三元组（plan §4：供 replay opaque authority 消费做 click 前比对）+ 终端 click join 键。
    const rows = frozen.identityObservations;
    assert(Array.isArray(rows) && rows.length === 1, `frozen locks identityObservations 应恰 1 行（单 click join）；实得 ${JSON.stringify(rows)?.slice(0, 120)}`);
    const row = rows[0];
    assert(row.name === AGENT_NAME && row.code === AGENT_CODE && row.platformId === AGENT_PLATFORM_ID,
      `期望三元组未进冻结锁；实得 ${JSON.stringify({ name: row.name, code: row.code, platformId: row.platformId })}`);
    assert(row.evidenceStepId === 'atstep_3', `三元组须绑终端 click 的 evidenceStepId=atstep_3；实得 ${row.evidenceStepId}`);

    // v1 既有锁链义务不回退：bindings 三行齐 lockId+receiptHash，prd 收到 locks checksum。
    deepStrictEqual(frozen.bindings, PROVENANCE_STEP_IDS.map((stepId) => ({
      stepId, intentId: 'intent_1', atom: 'agent.searchOpen', role: 'subject',
      candidateId: 'candidate-agent-main', lockId: 'lock-agent-main', receiptHash: agentReceipt.receiptHash,
    })));
    const prd = JSON.parse(readFileSync(fixture.prdPath, 'utf8'));
    const locksKey = `.golden-scratch-agent-id-sign-observation/${caseId}/entity-locks.frozen.json`;
    assert(typeof prd.testChecksums?.[locksKey] === 'string', 'prd testChecksums 未收 entity-locks checksum（authority 铸造前提）');
  } finally { cleanupCase(caseId); }
});

// ── c2：v2 draft 缺观察件 → 65 ────────────────────────────────────────────────
test('c2', 'c2 v2 draft 缺观察件（不带 --entity-observations）→ exit 65 拒签', () => {
  const caseId = 'tc_air_signobs_missing';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), { writeObservationFile: false });
    const result = runSign(fixture, { withObservations: false });
    assertRejected(result, 'v2 缺观察件');
    assertRejectionLeftNoResidue(fixture);
  } finally { cleanupCase(caseId); }
});

// ── c3：join 错位——evidenceStepId 指 fill 而非终端 click → 65 ─────────────────
test('c3', 'c3 join 错位（evidenceStepId=atstep_1 指 fill 非终端 click）→ exit 65 拒签', () => {
  const caseId = 'tc_air_signobs_joinskew';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), {
      makeObservation: (ctx) => buildObservation({ caseId, eventsSha256: ctx.eventsSha256, evidenceStepId: 'atstep_1' }),
    });
    const result = runSign(fixture);
    assertRejected(result, 'join 错位');
    assertRejectionLeftNoResidue(fixture);
  } finally { cleanupCase(caseId); }
});

// ── c4：三错配各一（plan §4 R2-4：任一即 65）────────────────────────────────────
const MISMATCH_CASES = [
  ['tc_air_signobs_buildmm', 'capturedAgainstBuild≠--against-build',
    (caseId) => (ctx) => buildObservation({ caseId, eventsSha256: ctx.eventsSha256, capturedAgainstBuild: 'other-build' })],
  ['tc_air_signobs_digestmm', 'identityProfileDigest 不符（观察件携异剖面 digest）',
    (caseId) => (ctx) => buildObservation({ caseId, eventsSha256: ctx.eventsSha256, identityProfileDigest: PROFILE_DIGEST_VARIANT })],
  ['tc_air_signobs_eventsmm', 'eventsSha256 不符（观察件携异字节 sha）',
    (caseId) => () => buildObservation({ caseId, eventsSha256: hashIdentityAdmissionBytes(Buffer.from('not-the-signed-events-bytes\n')) })],
];
for (const [caseId, label, makeObservationFor] of MISMATCH_CASES) {
  test('c4', `c4 错配：${label} → exit 65 拒签`, () => {
    try {
      cleanupCase(caseId);
      const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), { makeObservation: makeObservationFor(caseId) });
      const result = runSign(fixture);
      assertRejected(result, label);
      assertRejectionLeftNoResidue(fixture);
    } finally { cleanupCase(caseId); }
  });
}

// ── c5：陈旧观察件复用——对另一 events 字节完全自洽的观察件配本 events 签 → 65 ──
// 与 c4 eventsSha 错配的区别：观察件不是被篡改，而是真产自同 case 另一次编译（events 字节不同——
// recordedAt 异），整件自洽；换到本 events 下签必拒（防「重编译后拿旧观察件蒙混」）。
test('c5', 'c5 陈旧观察件复用（观察件自洽于另一 events 字节）→ exit 65 拒签', () => {
  const caseId = 'tc_air_signobs_stale';
  try {
    cleanupCase(caseId);
    const staleEventsText = jsonText(buildEventsDoc(caseId, '2026-07-21T08:00:00.000Z'));
    const staleEventsSha256 = hashIdentityAdmissionBytes(Buffer.from(staleEventsText));
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), {
      makeObservation: () => buildObservation({ caseId, eventsSha256: staleEventsSha256 }),
    });
    assert(staleEventsSha256 !== fixture.eventsSha256, '夹具自身红：陈旧 events 字节须与在签 events 不同');
    const result = runSign(fixture);
    assertRejected(result, '陈旧观察件复用');
    assertRejectionLeftNoResidue(fixture);
  } finally { cleanupCase(caseId); }
});

// ── c6：拒签零新增——整目录快照逐字节对照 ───────────────────────────────────────
function snapshotDir(dir) {
  const out = new Map();
  (function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.set(path, readFileSync(path).toString('base64'));
    }
  })(dir);
  return out;
}

test('c6', 'c6 拒签零新增：失败 sign 前后夹具目录快照逐字节一致 + prd 零动 + 无 journal/tmp', () => {
  const caseId = 'tc_air_signobs_residue';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), { writeObservationFile: false });
    const before = snapshotDir(join(SCRATCH_ROOT, caseId));
    const result = runSign(fixture, { withObservations: false });
    assert(result.status !== 0, `残留普查前提：该 sign 必须失败；实得 exit ${result.status}`);
    const after = snapshotDir(join(SCRATCH_ROOT, caseId));
    deepStrictEqual([...after.keys()].sort(), [...before.keys()].sort(),
      '拒签后夹具目录文件集合有增删（零新增产物被破坏）');
    for (const [path, bytes] of before) assert(after.get(path) === bytes, `拒签后文件字节被改动：${path}`);
    assertRejectionLeftNoResidue(fixture);
    const prd = JSON.parse(readFileSync(fixture.prdPath, 'utf8'));
    deepStrictEqual(prd.testChecksums, {}, '拒签后 prd testChecksums 出现新键');
  } finally { cleanupCase(caseId); }
});

// ── c7：v1 兼容回归锁（今日应绿；冻结即绿=回归保护，interface-spec §5「v1 路径逐字不变」）──
test('c7', 'c7 v1 draft 不带 --entity-observations 走既有 happy → exit 0 且冻结锁形状为 v1（回归保护，今日绿）', () => {
  const caseId = 'tc_air_signobs_v1';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), { draftVersion: 1, writeObservationFile: false });
    const result = runSign(fixture, { withObservations: false });
    assert(result.status === 0, `v1 兼容 happy 应 exit 0；实得 exit ${result.status}；stderr=${(result.stderr || '').trim().slice(0, 200)}`);
    const frozen = JSON.parse(readFileSync(fixture.locks, 'utf8'));
    assert(frozen.schemaVersion === 1 && frozen.artifactKind === 'entity-locks-frozen'
      && frozen.signed === true && frozen.replayReady === true && frozen.audience === 'test', 'v1 frozen locks 顶层封装不符');
    assert(frozen.eventsSha256 === fixture.eventsSha256, 'v1 frozen locks eventsSha256 未绑原字节');
    for (const v2Field of ['identityProfileDigest', 'identityObservationsSha256', 'identityObservations']) {
      assert(!Object.hasOwn(frozen, v2Field), `v1 路径逐字不变被破坏：frozen 出现 v2 字段 ${v2Field}`);
    }
    deepStrictEqual(frozen.bindings, PROVENANCE_STEP_IDS.map((stepId) => ({
      stepId, intentId: 'intent_1', atom: 'agent.searchOpen', role: 'subject',
      candidateId: 'candidate-agent-main', lockId: 'lock-agent-main', receiptHash: agentReceipt.receiptHash,
    })));
  } finally { cleanupCase(caseId); }
});

// ── c8：观察义务锚定字面量（codex R1-H5 修复钉）───────────────────────────────────
// 攻击构造：events 同时含真 agent.searchOpen intent（终端 click=atstep_3）与另一 atom 的 click
// （atstep_4）；观察件自报 source.atom/row.atom='nav.agentManagement' 并把观察锚到 atstep_4——
// 修前实现用自报 atom 找终端集合，join 全对齐、exit 0 过签，真 searchOpen click 无观察；
// 修后义务集合从 events 按字面量 'agent.searchOpen' 独立推导 → 必须 65。
function buildMixedEventsDoc(caseId) {
  const base = buildEventsDoc(caseId);
  return {
    ...base,
    events: [
      ...base.events,
      { stepId: 'atstep_4', intentId: 'intent_2', atom: 'nav.agentManagement', action: 'click', text: AGENT_NAME },
    ],
  };
}
const buildMixedProvenance = () => [
  ...buildProvenance(),
  { stepId: 'atstep_4', intentId: 'intent_2', atom: 'nav.agentManagement',
    sourceIntentId: 'source_2', candidateId: 'candidate-agent-bind', role: 'subject' },
];

test('c8', 'c8a 观察件自报别的 atom 把矛头错开（真 searchOpen 无观察）→ exit 65 拒签（修前红：自报 atom 驱动 join、exit 0 过签）', () => {
  const caseId = 'tc_air_signobs_atomskew';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), {
      eventsDoc: buildMixedEventsDoc(caseId),
      provenance: buildMixedProvenance(),
      makeObservation: (ctx) => ({
        ...buildObservation({ caseId, eventsSha256: ctx.eventsSha256, evidenceStepId: 'atstep_4' }),
        source: { kind: 'compile-envelope', atom: 'nav.agentManagement', signed: false, replayReady: false },
        observations: [{
          kind: 'agent', name: AGENT_NAME, code: AGENT_CODE, platformId: AGENT_PLATFORM_ID,
          sourceIntentId: 'source_2', candidateId: 'candidate-agent-bind', role: 'subject',
          atom: 'nav.agentManagement', evidenceStepId: 'atstep_4', sourcePath: '/api/agents/query',
        }],
      }),
    });
    const result = runSign(fixture);
    assertRejected(result, '观察件自报 atom 转移矛头');
    assertRejectionLeftNoResidue(fixture);
  } finally { cleanupCase(caseId); }
});

test('c8', 'c8b 观察行 kind 非 agent（kind:workflow）→ exit 65 拒签（修前红：kind 只查非空、exit 0 过签）', () => {
  const caseId = 'tc_air_signobs_kindskew';
  try {
    cleanupCase(caseId);
    const fixture = prepareSignCase(caseId, join(SCRATCH_ROOT, caseId), {
      makeObservation: (ctx) => {
        const obs = buildObservation({ caseId, eventsSha256: ctx.eventsSha256 });
        obs.observations = [{ ...obs.observations[0], kind: 'workflow' }];
        return obs;
      },
    });
    const result = runSign(fixture);
    assertRejected(result, '观察行 kind 非 agent');
    assertRejectionLeftNoResidue(fixture);
  } finally { cleanupCase(caseId); }
});

if (existsSync(SCRATCH_ROOT)) { try { rmSync(SCRATCH_ROOT, { recursive: true, force: true }); } catch { /* 尽力 */ } }
if (failures.length) {
  for (const failure of failures) console.error(`RED  agent-id-sign-observation: ${failure}`);
  console.error(`RED  agent-id-sign-observation/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   agent-id-sign-observation/${SECTION}: ${passed}/${passed} 全过（纯函数 + 本地文件 + sign 子进程，零 SUT）`);

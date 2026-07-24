#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）真机码路径 fail-closed 金牌（codex round-1 Critical-1 ③ 收口证据）。
// 纯 node：spawn 真 bin/replay.mjs（零浏览器/零 SUT/零 fake-SUT/零子 fetch）——CASEY_LAUNCH_SENTINEL 在
// chromium.launch 前短路，门若在浏览器前拦即 exit 65 且哨兵缺席（不用 seam-mock 冒充生产路径）。
//
// ── 咬什么（round-1 假绿的封口）──────────────────────────────────────────────────────
// round-1：身份锁在力时，破坏性 click 查不到目标连续性 ref → 跳过守卫、随后【照常 performAction 删除】=fail-OPEN。
// 本金牌用【真生产码路径】证：v2 冻结锁（携身份观察=身份锁在力）+ events 含破坏性原子（agent.delete）但无
// 已认证目标连续性 ref → replay 在【浏览器启动前】拒执行（exit 65 + 具名 reason + 哨兵缺席），绝不启动、绝不删除。
// 破坏链身份采集补齐让破坏步真解析 ref = route:human；hermetic 无采集件即恒拒（fail-CLOSED 默认）。
//
// 夹具自哈希自洽（同 agent-id-readback C8 构造：ADR-0010 威胁边界内的合法构造）：手造 v2 冻结锁 + 重算
// calculateIdentityAdmissionSignature + 临时 prd 注册 checksum，不经真 compile/浏览器。锁 identityProfileDigest
// 精确对齐 replay 由 profile.agents.listApi 现算的 liveDigest（含 queryParam），否则指纹错配门会抢跑。
//
// 断言纪律：退出码 + 具名 reason + 哨兵在场性；判绿只信退出码（MEMORY 铁律）。改本文件=Test Ratchet 判红。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateIdentityAdmissionSignature } from '../../lib/entity-semantic-lock-preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const SCRATCH_ROOT = join(ROOT, '.golden-scratch-c3-failclosed');

const NAME = 'atl_wf_dup';
const CODE = 'AG-DUP-001';
const PLATFORM_ID = '1234567890123456789'; // 19 位纯数字 string（形态锚真机）
const HASH64 = `sha256:${'a'.repeat(64)}`;
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const bytesSha = (text) => `sha256:${sha256Hex(Buffer.from(text))}`;

// 通道剖面：agents.listApi 身份声明 + 卡片物理面（形状同 agent-id-readback，含 queryParam）。
const LIST_API = {
  pathname: '/api/agents/query', method: 'GET', queryParam: 'nameLike',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
};
const PROFILE = {
  background: [], successField: 'status', successValue: 200,
  agents: {
    itemContainer: '.agent-card',
    cardFields: { name: '.agent-card__name', code: '.agent-card__code' },
    listApi: LIST_API,
  },
};
// replay 内部由 profile.agents.listApi 现搭 identityChannelCfg（含 queryParam、hasNextPath ?? null），
// liveDigest = sha256(规范化)。锁 identityProfileDigest 须逐字节等于此值，否则指纹错配门抢跑（非本门）。
const canonical = (v) => (Array.isArray(v) ? v.map(canonical)
  : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v));
const CHANNEL_CFG = {
  pathname: LIST_API.pathname, method: LIST_API.method, recordsPath: LIST_API.recordsPath,
  totalPath: LIST_API.totalPath, queryParam: LIST_API.queryParam,
  hasNextPath: LIST_API.hasNextPath ?? null,
  fields: { id: LIST_API.fields.id, code: LIST_API.fields.code, name: LIST_API.fields.name },
};
const PROFILE_DIGEST = `sha256:${sha256Hex(JSON.stringify(canonical(CHANNEL_CFG)))}`;

const SEARCH_EVENTS = [
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: NAME },
  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
  { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: NAME },
];
const DELETE_EVENT = { stepId: 'atstep_4', intentId: 'intent_2', atom: 'agent.delete', action: 'click', text: NAME };

const subjectBinding = (ev) => ({
  stepId: ev.stepId, intentId: ev.intentId, atom: ev.atom, role: 'subject',
  candidateId: `candidate-${ev.stepId}`, lockId: `lock-${ev.stepId}`, receiptHash: HASH64,
});
const OBSERVATION_ROW = {
  name: NAME, code: CODE, platformId: PLATFORM_ID, sourceIntentId: 'source_1',
  candidateId: 'candidate-atstep_3', role: 'subject', atom: 'agent.searchOpen', evidenceStepId: 'atstep_3',
};

// 手造自洽 v2 冻结锁（signature 现算、checksum 现注册）。events 传入决定 bindings/eventsSha256。
function buildFrozenLock({ caseId, eventEntries, eventsSha256 }) {
  // 身份观察恒在场（身份锁在力）：D1/D2 都激活身份锁，差别只在 events 是否含破坏性原子——证本门只拦破坏性原子。
  const lock = {
    schemaVersion: 2, artifactKind: 'entity-locks-frozen', caseId,
    signed: true, replayReady: true, signerId: 'golden-human', signedAt: '2026-07-22T08:00:00.000Z',
    audience: 'test', eventsSha256,
    identityProfileDigest: PROFILE_DIGEST,
    identityObservationsSha256: HASH64,
    identityObservations: [OBSERVATION_ROW],
    bindings: eventEntries.map(subjectBinding),
    signature: 'sha256:placeholder',
  };
  lock.signature = calculateIdentityAdmissionSignature(lock);
  return lock;
}

// 一个用例场景：写 events/expected/profile/lock/prd，spawn replay，回收结果。scratch 在 ROOT 下（artifactKey 须
// canonical 项目相对；sign 产物路径安全面同律）。
function runScenario({ tag, caseId, eventEntries }) {
  const dir = join(SCRATCH_ROOT, tag);
  mkdirSync(dir, { recursive: true });
  const url = '{{baseUrl}}/agent/list';
  const eventsDoc = { schemaVersion: 2, channel: 'web', caseId, url, recordedAt: '2026-07-22T08:00:00.000Z', compiledBy: 'c3-golden', authored: false, events: eventEntries };
  const eventsText = jsonText(eventsDoc);
  const eventsPath = join(dir, 'events.json');
  writeFileSync(eventsPath, eventsText);
  const eventsSha256 = bytesSha(eventsText);

  const expectedPath = join(dir, 'expected.json');
  writeFileSync(expectedPath, jsonText({ caseId, channel: 'web', intents: [], globalAssertions: [] }));
  const profilePath = join(dir, 'profile.json');
  writeFileSync(profilePath, jsonText(PROFILE));

  const lock = buildFrozenLock({ caseId, eventEntries, eventsSha256 });
  const lockText = jsonText(lock);
  const locksPath = join(dir, 'entity-locks.frozen.json');
  writeFileSync(locksPath, lockText);
  const artifactKey = resolve(locksPath).slice(ROOT.length + 1).split('\\').join('/');

  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  rmSync(prdPath, { force: true });
  writeFileSync(prdPath, jsonText({
    schemaVersion: 1, caseId, task: 'C3 fail-closed replay golden 临时 prd（finally 清理）',
    testChecksums: { [artifactKey]: sha256Hex(Buffer.from(lockText)) }, stories: [],
  }), { flag: 'wx' });

  const sentinel = join(dir, 'launch.sentinel');
  const axesPath = join(dir, 'axes.json');
  const env = { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel };
  const result = spawnSync(process.execPath, [
    REPLAY, '--events', eventsPath, '--sut', 'http://127.0.0.1:1', '--expected', expectedPath,
    '--profile', profilePath, '--out', axesPath, '--entity-locks', locksPath,
  ], { encoding: 'utf8', timeout: 90000, env });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return { result, output, sentinelWritten: existsSync(sentinel), prdPath };
}

const failures = [];
const cleanup = [];
try {
  // ── D1 破坏 fail-CLOSED：身份锁在力 + agent.delete 无连续性 ref → 浏览器前拒（exit 65 + 具名 reason + 哨兵缺席）──
  {
    const caseId = 'tc_c3fc_deny';
    const { result, output, sentinelWritten, prdPath } = runScenario({ tag: 'deny', caseId, eventEntries: [...SEARCH_EVENTS, DELETE_EVENT] });
    cleanup.push(prdPath);
    if (result.status !== 65) failures.push(`D1 破坏动作应 fail-closed exit 65，实际 ${result.status}：${output.slice(-260)}`);
    if (!output.includes('破坏性目标连续性 ref 缺失') || !output.includes('DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF')) {
      failures.push(`D1 未命中破坏性连续性准入拒（具名 reason）：${output.slice(-260)}`);
    }
    if (!output.includes('agent.delete')) failures.push(`D1 拒因未点名破坏性原子 agent.delete：${output.slice(-200)}`);
    if (sentinelWritten) failures.push('D1 CASEY_LAUNCH_SENTINEL 已写：控制流越过浏览器前门=fail-open 未真闭（破坏动作会真执行）');
  }

  // ── D2 正控：身份锁在力但【无】破坏性原子（仅 searchOpen）→ 本门不拦，控制流抵达浏览器前哨兵（exit 66、哨兵在场）──
  // 证本门【只】拦破坏性原子、非「身份锁在力就一律拒」的退化闸（always-refuse 会在此转红）。
  {
    const caseId = 'tc_c3fc_allow';
    const { result, output, sentinelWritten, prdPath } = runScenario({ tag: 'allow', caseId, eventEntries: [...SEARCH_EVENTS] });
    cleanup.push(prdPath);
    if (output.includes('破坏性目标连续性 ref 缺失')) failures.push(`D2 无破坏性原子却被破坏性连续性门拦=过度拒（always-refuse）：${output.slice(-260)}`);
    if (result.status !== 66 || !sentinelWritten) {
      failures.push(`D2 无破坏性原子应抵达浏览器前哨兵（exit 66 + 哨兵在场），实际 exit ${result.status}、哨兵 ${sentinelWritten}：${output.slice(-260)}`);
    }
  }
} finally {
  for (const prd of cleanup) rmSync(prd, { force: true });
  rmSync(SCRATCH_ROOT, { recursive: true, force: true });
}

if (failures.length) {
  for (const message of failures) console.error(`RED  entity-destructive-continuity-guard-failclosed: ${message}`);
  console.error(`RED  entity-destructive-continuity-guard-failclosed: ${failures.length} 红`);
  process.exit(1);
}
console.log('ok   entity-destructive-continuity-guard-failclosed: 破坏动作缺已签连续性 ref 时真 fail-CLOSED 被拒（浏览器前，真 bin/replay.mjs 码路径）；正控证只拦破坏性原子');

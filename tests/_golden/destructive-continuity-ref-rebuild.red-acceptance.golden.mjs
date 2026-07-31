#!/usr/bin/env node
// destructive-continuity-ref-rebuild —— 【红先行】验收金牌（预期今日判红，写入侧落地后转绿）。
//
// ── 本文件是什么 ────────────────────────────────────────────────────────────────────
// `bin/replay.mjs:203` 建【空】的 destructiveContinuityByStep 后立刻拿它做准入，全仓零处 `.set()`。
// 故只要冻结锁在力且 events 含破坏原子，回放恒 exit 65——【人到机器前也一样】，人不会把 ref 填进去。
// 本金牌钉死「写入侧落地之后」该长什么样：逐破坏步 ref 由已签冻结面重建，缺失/错配恒拒、合法才放行。
//
// ── 判红判绿只信退出码（MEMORY 铁律）────────────────────────────────────────────────
// 本文件自身退出码即判据：全类通过 exit 0，任一类不符 exit 1 并逐条列出。绝不 grep 失败标记串判绿。
// 五个场景一律 spawn 真 `bin/replay.mjs`（零浏览器/零 SUT/零 fake-SUT），`--sut` 恒指死回环端口
// 127.0.0.1:1；CASEY_LAUNCH_SENTINEL 在 chromium.launch 前短路，故「有没有越过浏览器前门」可证。
// 抽纯函数只测纯函数是本仓已被逮过的假绿模式——本文件不碰纯函数，只走生产码路径。
//
// ── 夹具纪律（别倒着裁）────────────────────────────────────────────────────────────
// 锁的构造【逐字复现】既有人签冻结金牌 entity-destructive-continuity-guard.failclosed-replay.golden.mjs
// 的同一接缝（同 profile、同 events、同 signature 现算、同临时 prd 注册 checksum），只在其上叠加待设计的
// v3 `destructiveContinuity` 段。不为让预定裁定成立而投喂答案：R1 用的就是现役 v2 形状、今日本就该绿。
//
// ── 今日预期（红先行基线，实测见 docs/plans/destructive-continuity-ref/design-per-step-ref.md）──
//   R1 ref 缺失      → 今日【绿】（现役 fail-closed 行为，落地后必须保持绿）
//   R2 ref 错配·platformId 与被引观察不符 → 今日【红】（v3 段未实现，锁在 closedRecord 处即判非法）
//   R3 ref 错配·跨 kind                   → 今日【红】（同上）
//   R4 ref 挂错步（授权落在观察步而非破坏步）→ 今日【红】（拒因未点名破坏步 stepId）
//   R5 ref 合法                            → 今日【红】（今日恒 65，落地后应 66 + 哨兵在场）
//
// 本金牌【不得】登记进任何 prd 的 testChecksums：它按设计今日判红，登记会把 gate 拖红。
// 写入侧落地、五类全绿之后，再由实现契约登记冻结（届时属 Test Ratchet 面）。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateIdentityAdmissionSignature } from '../../lib/entity-semantic-lock-preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const SCRATCH_ROOT = join(ROOT, '.golden-scratch-c3-refrebuild');

const NAME = 'atl_wf_dup';
const CODE = 'AG-DUP-001';
const PLATFORM_ID = '1234567890123456789';
const OTHER_PLATFORM_ID = '9876543210987654321'; // 错配用：真实存在但【非】本目标
const HASH64 = `sha256:${'a'.repeat(64)}`;
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const bytesSha = (text) => `sha256:${sha256Hex(Buffer.from(text))}`;

// 通道剖面与 identityProfileDigest 的算法逐字同 failclosed 金牌——指纹错配门必须【不】抢跑，
// 否则测的就不是连续性门了（假绿源）。
const LIST_API = {
  pathname: '/api/agents/query', method: 'GET', queryParam: 'nameLike',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
};
const PROFILE = {
  background: [], successField: 'status', successValue: 200,
  mutationUrlPattern: '**/api/agents/delete*',
  agents: {
    itemContainer: '.agent-card',
    cardFields: { name: '.agent-card__name', code: '.agent-card__code' },
    listApi: LIST_API,
  },
};
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
const ALL_EVENTS = [...SEARCH_EVENTS, DELETE_EVENT];
const DELETE_STEP_ORDER = ALL_EVENTS.length - 1; // 3（0 基，破坏步在 events 里的真实位序）

const subjectBinding = (ev) => ({
  stepId: ev.stepId, intentId: ev.intentId, atom: ev.atom, role: 'subject',
  candidateId: `candidate-${ev.stepId}`, lockId: `lock-${ev.stepId}`, receiptHash: HASH64,
});

// v2 观察行（现役冻结形状，八字段）+ 设计新增 kind（跨 kind 硬闸所需，v2 冻结面把它丢了）。
const OBSERVATION_ROW_V2 = {
  name: NAME, code: CODE, platformId: PLATFORM_ID, sourceIntentId: 'source_1',
  candidateId: 'candidate-atstep_3', role: 'subject', atom: 'agent.searchOpen', evidenceStepId: 'atstep_3',
};
const OBSERVATION_ROW_V3 = { ...OBSERVATION_ROW_V2, kind: 'agent' };

// 设计中的 v3 逐破坏步授权边：把「哪条观察授权哪个破坏步」显式签进冻结面。
const legalContinuityEntry = () => ({
  destructiveStepId: 'atstep_4',
  destructiveIntentId: 'intent_2',
  destructiveAtom: 'agent.delete',
  boundKind: 'agent',
  observationEvidenceStepId: 'atstep_3',
  platformId: PLATFORM_ID,
  scope: 'case:tc_c3ref/intent:intent_2',
  requestCorrelationId: 'corr-atstep_4-0001',
  stepOrder: DELETE_STEP_ORDER,
});

function buildLock({ caseId, eventEntries, eventsSha256, continuity }) {
  const v3 = continuity != null;
  const lock = {
    schemaVersion: v3 ? 3 : 2, artifactKind: 'entity-locks-frozen', caseId,
    signed: true, replayReady: true, signerId: 'golden-human', signedAt: '2026-07-22T08:00:00.000Z',
    audience: 'test', eventsSha256,
    identityProfileDigest: PROFILE_DIGEST,
    identityObservationsSha256: HASH64,
    identityObservations: [v3 ? OBSERVATION_ROW_V3 : OBSERVATION_ROW_V2],
    ...(v3 ? { destructiveContinuity: continuity } : {}),
    bindings: eventEntries.map(subjectBinding),
    signature: 'sha256:placeholder',
  };
  // 签名覆盖除 signature 外全部键（lib/entity-semantic-lock-preflight.mjs:317-320）——
  // 故 destructiveContinuity 天然被签，无需改签名算法。
  lock.signature = calculateIdentityAdmissionSignature(lock);
  return lock;
}

function runScenario({ tag, caseId, eventEntries, continuity }) {
  const dir = join(SCRATCH_ROOT, tag);
  mkdirSync(dir, { recursive: true });
  const eventsDoc = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/agent/list',
    recordedAt: '2026-07-22T08:00:00.000Z', compiledBy: 'c3-ref-red-acceptance',
    authored: false, events: eventEntries,
  };
  const eventsText = jsonText(eventsDoc);
  const eventsPath = join(dir, 'events.json');
  writeFileSync(eventsPath, eventsText);

  const expectedPath = join(dir, 'expected.json');
  writeFileSync(expectedPath, jsonText({ caseId, channel: 'web', intents: [], globalAssertions: [] }));
  const profilePath = join(dir, 'profile.json');
  writeFileSync(profilePath, jsonText(PROFILE));

  const lock = buildLock({ caseId, eventEntries, eventsSha256: bytesSha(eventsText), continuity });
  const lockText = jsonText(lock);
  const locksPath = join(dir, 'entity-locks.frozen.json');
  writeFileSync(locksPath, lockText);
  const artifactKey = resolve(locksPath).slice(ROOT.length + 1).split('\\').join('/');

  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  rmSync(prdPath, { force: true });
  writeFileSync(prdPath, jsonText({
    schemaVersion: 1, caseId, task: 'C3 ref 重建红验收临时 prd（finally 清理）',
    testChecksums: { [artifactKey]: sha256Hex(Buffer.from(lockText)) }, stories: [],
  }), { flag: 'wx' });

  const sentinel = join(dir, 'launch.sentinel');
  const axesPath = join(dir, 'axes.json');
  const result = spawnSync(process.execPath, [
    REPLAY, '--events', eventsPath, '--sut', 'http://127.0.0.1:1', '--expected', expectedPath,
    '--profile', profilePath, '--out', axesPath, '--entity-locks', locksPath,
  ], { encoding: 'utf8', timeout: 90000, env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel } });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
    sentinelWritten: existsSync(sentinel),
    prdPath,
  };
}

const red = [];
const cleanup = [];
const note = (cls, msg) => red.push(`[${cls}] ${msg}`);

try {
  // ── R1 ref 缺失：现役 v2 锁 + 破坏原子 → 浏览器前 exit 65、具名 reason、哨兵缺席（今日应绿）──
  {
    const r = runScenario({ tag: 'r1-missing', caseId: 'tc_c3ref_missing', eventEntries: ALL_EVENTS, continuity: null });
    cleanup.push(r.prdPath);
    if (r.status !== 65) note('R1 ref 缺失', `应 exit 65，实际 ${r.status}：${r.output.slice(-240)}`);
    if (!r.output.includes('DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF')) {
      note('R1 ref 缺失', `拒因未具名 DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF：${r.output.slice(-240)}`);
    }
    if (r.sentinelWritten) note('R1 ref 缺失', '哨兵已写：控制流越过浏览器前门，破坏动作会真执行（fail-open）');
  }

  // ── R2 ref 错配·platformId：授权边自报的 platformId 与它引用的观察行不符 → 恒拒，且拒因须与「缺失」可区分 ──
  // 咬的洞：若实现只看「有没有 ref」不看「ref 与被引观察是否同一目标」，伪造 platformId 即可指向【别的实体】真删。
  {
    const entry = { ...legalContinuityEntry(), platformId: OTHER_PLATFORM_ID };
    const r = runScenario({ tag: 'r2-idmismatch', caseId: 'tc_c3ref_idmismatch', eventEntries: ALL_EVENTS, continuity: [entry] });
    cleanup.push(r.prdPath);
    if (r.status !== 65) note('R2 ref 错配·platformId', `应 exit 65，实际 ${r.status}：${r.output.slice(-240)}`);
    if (!r.output.includes('DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH')) {
      note('R2 ref 错配·platformId', `拒因未具名 DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH（与「缺失」不可区分即不可诊断）：${r.output.slice(-240)}`);
    }
    if (r.sentinelWritten) note('R2 ref 错配·platformId', '哨兵已写：错配 ref 竟放行至浏览器（fail-open，会删错对象）');
  }

  // ── R3 ref 错配·跨 kind：boundKind=workflow 却授权 agent.delete → 恒拒 ──
  // 咬的洞：codex round-5 Critical 的同款跨 kind 绕过，在【重建】路径上必须同样关死，不能只在 compile 铸造处关。
  {
    const entry = { ...legalContinuityEntry(), boundKind: 'workflow' };
    const r = runScenario({ tag: 'r3-crosskind', caseId: 'tc_c3ref_crosskind', eventEntries: ALL_EVENTS, continuity: [entry] });
    cleanup.push(r.prdPath);
    if (r.status !== 65) note('R3 ref 错配·跨 kind', `应 exit 65，实际 ${r.status}：${r.output.slice(-240)}`);
    if (!r.output.includes('DESTRUCTIVE_CONTINUITY_KIND_MISMATCH')) {
      note('R3 ref 错配·跨 kind', `拒因未具名 DESTRUCTIVE_CONTINUITY_KIND_MISMATCH：${r.output.slice(-240)}`);
    }
    if (r.sentinelWritten) note('R3 ref 错配·跨 kind', '哨兵已写：跨 kind ref 放行（fail-open）');
  }

  // ── R4 ref 挂错步：授权边落在【观察步】atstep_3 而非破坏步 atstep_4 → 破坏步仍无授权，恒拒且拒因须点名破坏步 ──
  // 咬的洞：per-step 授权粒度（codex round-2 High）在重建路径上不得退化成 per-intent/per-case。
  {
    const entry = { ...legalContinuityEntry(), destructiveStepId: 'atstep_3', destructiveAtom: 'agent.searchOpen', destructiveIntentId: 'intent_1', stepOrder: 2 };
    const r = runScenario({ tag: 'r4-wrongstep', caseId: 'tc_c3ref_wrongstep', eventEntries: ALL_EVENTS, continuity: [entry] });
    cleanup.push(r.prdPath);
    if (r.status !== 65) note('R4 ref 挂错步', `应 exit 65，实际 ${r.status}：${r.output.slice(-240)}`);
    if (!r.output.includes('atstep_4')) {
      note('R4 ref 挂错步', `拒因未点名【未获授权的破坏步】atstep_4，逐步定位不可诊断：${r.output.slice(-240)}`);
    }
    if (r.sentinelWritten) note('R4 ref 挂错步', '哨兵已写：非破坏步的授权被当成破坏步授权（per-step 退化=fail-open）');
  }

  // ── R5 ref 合法：授权边完整自洽 → 准入放行，控制流抵达浏览器前哨兵（exit 66 + 哨兵在场）──
  // 反 always-refuse：没有这条，「恒拒」也能让 R1-R4 全绿，守卫就退化成永远不放行的死闸。
  {
    const r = runScenario({ tag: 'r5-legal', caseId: 'tc_c3ref_legal', eventEntries: ALL_EVENTS, continuity: [legalContinuityEntry()] });
    cleanup.push(r.prdPath);
    if (r.output.includes('破坏性目标连续性 ref 缺失')) {
      note('R5 ref 合法', `合法 ref 仍被判缺失（重建侧未接线或投影错步）：${r.output.slice(-240)}`);
    }
    if (r.status !== 66 || !r.sentinelWritten) {
      note('R5 ref 合法', `应抵达浏览器前哨兵（exit 66 + 哨兵在场），实际 exit ${r.status}、哨兵 ${r.sentinelWritten}：${r.output.slice(-240)}`);
    }
  }
} finally {
  for (const p of cleanup) rmSync(p, { force: true });
  rmSync(SCRATCH_ROOT, { recursive: true, force: true });
}

if (red.length) {
  console.error('RED destructive-continuity-ref-rebuild: 逐破坏步连续性 ref 重建验收未满足');
  for (const line of red) console.error(`  - ${line}`);
  console.error(`\n红 ${red.length} 条。写入侧（bin/replay.mjs 的 destructiveContinuityByStep 填充）落地前，R2-R5 判红属预期。`);
  process.exit(1);
}
console.log('ok   destructive-continuity-ref-rebuild: ref 缺失/错配/合法三类均按逐破坏步语义收口');

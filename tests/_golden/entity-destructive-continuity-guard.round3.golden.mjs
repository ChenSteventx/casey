#!/usr/bin/env node
// entity-destructive-continuity-guard（C3）round-3 收口金牌：codex round-2 re-review 残留 finding 的【真生产码路径】封口。
// 纯 node：spawn 真 bin/replay.mjs（CASEY_LAUNCH_SENTINEL 在 chromium.launch 前短路，零浏览器/零 SUT/零 fake-SUT）
//   + 真 bin/verdict.mjs 子进程 + 直驱真生产纯函数 + 静态源码接线断言。断言纪律：退出码 + 具名 reason + 哨兵在场性；
//   判绿只信退出码（MEMORY 铁律）。改本文件=Test Ratchet 判红。
//
// ── 咬什么（round-2 re-review 残留封口）──────────────────────────────────────────────
//   R1 [Critical v1 旁路]：合法【v1】破坏锁（无身份通道）+ agent.delete 无 ref → 真 replay 浏览器前 exit 65 拒
//       + 具名 reason + 哨兵缺席（原门只在 v2 frozenIdentityRows 非空时调、放行 v1 破坏锁=真 fail-open；此处堵死）。
//       正控：v1 锁 + 只读 searchOpen → exit 66 抵达浏览器前哨兵（v1 只读不被过度拒）。
//   R2 [High 真破坏原子错位]：agent.confirmToolPicker（真持久化加工具面）入 requiresTargetContinuityRef 集——
//       v2 身份锁在力 + confirmToolPicker 无 ref → 真 replay 浏览器前 exit 65 拒 + 具名 atom=agent.confirmToolPicker
//       （旧集只护 picker.selectFirstTool 勾选面、放行真持久化 confirmToolPicker=真 fail-open；此处堵死）。
//   R3 [High per-intent 非 per-step]：admitDestructiveTargetContinuity 逐破坏步核【自己那一步 stepId】的 ref——
//       同 intent 两破坏步只有 A 有 ref → B 仍被拒（一 intent 一 ref 绝不放行全部破坏步）；两步都有 ref → 放。
//   R4 [High unroute 生命周期]：生产 replay 破坏步收尾【真调】unroute（精确 pattern）——静态咬调用面（此前 unroute
//       只由适配器返回、生产从不调用=真 High）。
//   R5 [High abort 漏成 pageerror]：守卫 abort 的 pageerror 按步因果排除（纯函数）+ 真 verdict：守卫 abort 步的
//       pageerror 不进 axes → 该步 NEEDS_HUMAN 非 SUT_DEFECT；非 abort 步真 pageerror → SUT_DEFECT（正控）。
//
// 夹具自哈希自洽（同 failclosed-replay / agent-id-readback C8：ADR-0010 威胁边界内的合法构造）：手造 v1/v2 冻结锁 +
// 重算 calculateIdentityAdmissionSignature + 临时 prd 注册 checksum，不经真 compile/浏览器。

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { calculateIdentityAdmissionSignature } from '../../lib/entity-semantic-lock-preflight.mjs';
import {
  requiresTargetContinuityRef, admitDestructiveTargetContinuity, partitionGuardAbortPageErrors,
} from '../../lib/entity-destructive-continuity.mjs';
import { installOutboundMutationGuard } from '../../lib/entity-destructive-continuity-wiring.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const SCRATCH_ROOT = join(ROOT, '.golden-scratch-c3-round3');

const NAME = 'atl_wf_dup';
const CODE = 'AG-DUP-001';
const PLATFORM_ID = '1234567890123456789'; // 19 位纯数字 string（形态锚真机）
const HASH64 = `sha256:${'a'.repeat(64)}`;
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const bytesSha = (text) => `sha256:${sha256Hex(Buffer.from(text))}`;

const failures = [];
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${String(e?.message || e)}`); console.error(`FAIL ${name}: ${String(e?.message || e)}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 220); } catch { return String(v); } };

// ── v2 剖面/摘要（identityProfileDigest 须逐字节等于 replay 由 profile.agents.listApi 现算的 liveDigest）──
const LIST_API = {
  pathname: '/api/agents/query', method: 'GET', queryParam: 'nameLike',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
};
const PROFILE_V2 = {
  background: [], successField: 'status', successValue: 200,
  agents: { itemContainer: '.agent-card', cardFields: { name: '.agent-card__name', code: '.agent-card__code' }, listApi: LIST_API },
};
const canonical = (v) => (Array.isArray(v) ? v.map(canonical)
  : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v));
const CHANNEL_CFG = {
  pathname: LIST_API.pathname, method: LIST_API.method, recordsPath: LIST_API.recordsPath,
  totalPath: LIST_API.totalPath, queryParam: LIST_API.queryParam, hasNextPath: LIST_API.hasNextPath ?? null,
  fields: { id: LIST_API.fields.id, code: LIST_API.fields.code, name: LIST_API.fields.name },
};
const PROFILE_DIGEST = `sha256:${sha256Hex(JSON.stringify(canonical(CHANNEL_CFG)))}`;
const PROFILE_V1 = { background: [], successField: 'status', successValue: 200 };

const SEARCH_EVENTS = [
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: NAME },
  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
  { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: NAME },
];
const DELETE_EVENT = { stepId: 'atstep_4', intentId: 'intent_2', atom: 'agent.delete', action: 'click', text: NAME };
const CONFIRM_TOOL_EVENT = { stepId: 'atstep_4', intentId: 'intent_2', atom: 'agent.confirmToolPicker', action: 'click', text: '确认' };

const subjectBinding = (ev) => ({
  stepId: ev.stepId, intentId: ev.intentId, atom: ev.atom, role: 'subject',
  candidateId: `candidate-${ev.stepId}`, lockId: `lock-${ev.stepId}`, receiptHash: HASH64,
});
const OBSERVATION_ROW = {
  name: NAME, code: CODE, platformId: PLATFORM_ID, sourceIntentId: 'source_1',
  candidateId: 'candidate-atstep_3', role: 'subject', atom: 'agent.searchOpen', evidenceStepId: 'atstep_3',
};

function buildLock({ version, caseId, eventEntries, eventsSha256 }) {
  const base = {
    schemaVersion: version, artifactKind: 'entity-locks-frozen', caseId,
    signed: true, replayReady: true, signerId: 'round3-golden-human', signedAt: '2026-07-22T08:00:00.000Z',
    audience: 'test', eventsSha256,
    ...(version === 2 ? {
      identityProfileDigest: PROFILE_DIGEST, identityObservationsSha256: HASH64, identityObservations: [OBSERVATION_ROW],
    } : {}),
    bindings: eventEntries.map(subjectBinding),
    signature: 'sha256:placeholder',
  };
  base.signature = calculateIdentityAdmissionSignature(base);
  return base;
}

// spawn 真 replay，回收退出码/输出/哨兵在场性。scratch 在 ROOT 下（artifactKey 须 canonical 项目相对）。
function runReplay({ tag, version, caseId, eventEntries }) {
  const dir = join(SCRATCH_ROOT, tag);
  mkdirSync(dir, { recursive: true });
  const eventsDoc = { schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/agent/list', recordedAt: '2026-07-22T08:00:00.000Z', compiledBy: 'c3-round3', authored: false, events: eventEntries };
  const eventsText = jsonText(eventsDoc);
  const eventsPath = join(dir, 'events.json');
  writeFileSync(eventsPath, eventsText);
  const expectedPath = join(dir, 'expected.json');
  writeFileSync(expectedPath, jsonText({ caseId, channel: 'web', intents: [], globalAssertions: [] }));
  const profilePath = join(dir, 'profile.json');
  writeFileSync(profilePath, jsonText(version === 2 ? PROFILE_V2 : PROFILE_V1));
  const lock = buildLock({ version, caseId, eventEntries, eventsSha256: bytesSha(eventsText) });
  const lockText = jsonText(lock);
  const locksPath = join(dir, 'entity-locks.frozen.json');
  writeFileSync(locksPath, lockText);
  const artifactKey = resolve(locksPath).slice(ROOT.length + 1).split('\\').join('/');
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  rmSync(prdPath, { force: true });
  writeFileSync(prdPath, jsonText({
    schemaVersion: 1, caseId, task: 'C3 round-3 real-path golden 临时 prd（finally 清理）',
    testChecksums: { [artifactKey]: sha256Hex(Buffer.from(lockText)) }, stories: [],
  }), { flag: 'wx' });
  const sentinel = join(dir, 'launch.sentinel');
  const axesPath = join(dir, 'axes.json');
  const env = { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel };
  const result = spawnSync(process.execPath, [
    REPLAY, '--events', eventsPath, '--sut', 'http://127.0.0.1:1', '--expected', expectedPath,
    '--profile', profilePath, '--out', axesPath, '--entity-locks', locksPath,
  ], { encoding: 'utf8', timeout: 90000, env });
  return { result, output: `${result.stdout || ''}${result.stderr || ''}`, sentinelWritten: existsSync(sentinel), prdPath };
}

const cleanup = [];
try {
  // ── R1 [Critical v1 旁路]：v1 破坏锁 + agent.delete → 浏览器前 exit 65 拒 + 具名 reason + 哨兵缺席 ──
  await test('R1a v1 破坏锁 + agent.delete 无 ref → 真 replay 浏览器前 exit 65 拒（v1 旁路堵死）+ 具名 reason + 哨兵缺席', () => {
    const caseId = 'tc_c3r3_v1del';
    const { result, output, sentinelWritten, prdPath } = runReplay({ tag: 'v1del', version: 1, caseId, eventEntries: [...SEARCH_EVENTS, DELETE_EVENT] });
    cleanup.push(prdPath);
    assert(result.status === 65, `v1 破坏锁应 fail-closed exit 65，实际 ${result.status}：${output.slice(-260)}`);
    assert(output.includes('DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF') && output.includes('agent.delete'),
      `拒因须具名破坏性连续性准入 + 点名 agent.delete：${output.slice(-260)}`);
    assert(output.includes('v1 锁'), `拒因须点明 v1 锁在力（无身份通道）：${output.slice(-260)}`);
    assert(!sentinelWritten, 'CASEY_LAUNCH_SENTINEL 已写：控制流越过浏览器前门=v1 旁路未真闭（破坏动作会真执行）');
  });
  await test('R1b 正控：v1 锁 + 只读 searchOpen（无破坏原子）→ 抵达浏览器前哨兵 exit 66（v1 只读不被过度拒、非 always-refuse）', () => {
    const caseId = 'tc_c3r3_v1read';
    const { result, output, sentinelWritten, prdPath } = runReplay({ tag: 'v1read', version: 1, caseId, eventEntries: [...SEARCH_EVENTS] });
    cleanup.push(prdPath);
    assert(!output.includes('破坏性目标连续性 ref 缺失'), `v1 只读流被破坏门拦=过度拒：${output.slice(-260)}`);
    assert(result.status === 66 && sentinelWritten, `v1 只读应抵达哨兵 exit 66 + 哨兵在场，实际 exit ${result.status}、哨兵 ${sentinelWritten}：${output.slice(-260)}`);
  });

  // ── R2 [High 真破坏原子错位]：agent.confirmToolPicker 入集——v2 锁在力 + confirmToolPicker 无 ref → exit 65 拒 ──
  await test('R2a 纯函数：requiresTargetContinuityRef(agent.confirmToolPicker) === true（真持久化加工具面入集）', () => {
    assert(requiresTargetContinuityRef('agent.confirmToolPicker') === true, 'agent.confirmToolPicker 须索要连续性 ref（真持久化 mutation 面）');
    // selectFirstTool 保留（冗余但 fail-closed 安全）；正控证谓词非 always-true。
    assert(requiresTargetContinuityRef('picker.selectFirstTool') === true, 'picker.selectFirstTool 保留在集内');
    assert(requiresTargetContinuityRef('agent.searchOpen') === false, 'searchOpen 非破坏原子、不索要（证非 always-true）');
  });
  await test('R2b v2 身份锁在力 + agent.confirmToolPicker 无 ref → 真 replay 浏览器前 exit 65 拒 + 点名 confirmToolPicker + 哨兵缺席', () => {
    const caseId = 'tc_c3r3_v2confirm';
    const { result, output, sentinelWritten, prdPath } = runReplay({ tag: 'v2confirm', version: 2, caseId, eventEntries: [...SEARCH_EVENTS, CONFIRM_TOOL_EVENT] });
    cleanup.push(prdPath);
    assert(result.status === 65, `confirmToolPicker（真持久化面）应 fail-closed exit 65，实际 ${result.status}：${output.slice(-300)}`);
    assert(output.includes('DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF') && output.includes('agent.confirmToolPicker'),
      `拒因须具名 + 点名 agent.confirmToolPicker（旧集只护 selectFirstTool 勾选面=fail-open）：${output.slice(-300)}`);
    assert(!sentinelWritten, 'CASEY_LAUNCH_SENTINEL 已写：confirmToolPicker 真持久化面越过浏览器前门=真 fail-open 未闭');
  });

  // ── R3 [High per-intent 非 per-step]：逐破坏步核自己那一步 ref ──────────────────────────
  await test('R3 admitDestructiveTargetContinuity per-step：同 intent 两破坏步只有 A 有 ref → B 仍被拒（一 intent 一 ref 不放行全部破坏步）', () => {
    const A = { stepId: 'del_a', intentId: 'intent_shared', atom: 'agent.delete', action: 'click' };
    const B = { stepId: 'del_b', intentId: 'intent_shared', atom: 'agent.delete', action: 'click' };
    // 只给 A 一步的 ref；B 同 intent 但无自己那一步的 ref。
    const onlyA = new Map([['del_a', { platformId: PLATFORM_ID }]]);
    const r = admitDestructiveTargetContinuity({ events: [A, B], resolvedRefByStep: onlyA });
    assert(r.ok === false && r.reason === 'DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF' && r.stepId === 'del_b',
      `B 步无自己那一步 ref 应被拒（per-step，非 per-intent 放行全部）；实得 ${brief(r)}`);
    // 两步各自有 ref → 放（证非 always-拒、proceed 路径存在）。
    const both = new Map([['del_a', { platformId: PLATFORM_ID }], ['del_b', { platformId: '2222222222222222222' }]]);
    const r2 = admitDestructiveTargetContinuity({ events: [A, B], resolvedRefByStep: both });
    assert(r2.ok === true, `两破坏步各自有 ref 应放行（proceed 路径存在）；实得 ${brief(r2)}`);
    // 无破坏原子 → 放（证非退化）。
    const r3 = admitDestructiveTargetContinuity({ events: [{ stepId: 's', intentId: 'i', atom: 'agent.searchOpen', action: 'click' }], resolvedRefByStep: new Map() });
    assert(r3.ok === true, `无破坏原子应放行；实得 ${brief(r3)}`);
  });

  // ── R4 [High unroute 生命周期]：生产 replay 破坏步收尾真调 unroute（精确 pattern）──────────
  await test('R4a 静态：bin/replay.mjs 留存 unroute 解除器并在破坏步收尾【真调】（guardTeardown = installed.unroute + await guardTeardown()）', () => {
    const src = readFileSync(REPLAY, 'utf8');
    assert(/guardTeardown\s*=\s*installed\s*&&\s*typeof\s*installed\.unroute\s*===\s*'function'\s*\?\s*installed\.unroute/.test(src),
      'replay 未留存出站拦截器的 unroute 解除器（生命周期收口）');
    assert(src.includes('await guardTeardown()'), 'replay 破坏步收尾未【真调】unroute（此前 unroute 只由适配器返回、生产从不调用=真 High）');
    // 精确 pattern：安装器 urlPattern 取 profile.mutationUrlPattern（非恒 **/*）。
    assert(src.includes('urlPattern: profile.mutationUrlPattern'), 'replay 未按 profile.mutationUrlPattern 供精确 urlPattern');
  });
  await test('R4b 行为式：installOutboundMutationGuard 的 unroute 委派 page.unroute(pattern, handler)（生命周期解除器可用）', () => {
    let unrouted = null;
    const page = { route: () => Promise.resolve(), unroute: (p, h) => { unrouted = { p, h: typeof h }; } };
    const res = installOutboundMutationGuard(page, { atom: 'agent.delete', ref: { platformId: PLATFORM_ID }, urlPattern: '**/agent/delete*' });
    assert(res.installed === true && typeof res.unroute === 'function', `应装且返回 unroute；实得 ${brief(res)}`);
    res.unroute();
    assert(unrouted && unrouted.p === '**/agent/delete*' && unrouted.h === 'function', `unroute 应委派 page.unroute(精确 pattern, handler)；实得 ${brief(unrouted)}`);
  });

  // ── R5 [High abort 漏成 pageerror]：守卫 abort 的 pageerror 按步因果排除 + 真 verdict 证不误报 SUT_DEFECT ──
  await test('R5a 纯函数 partitionGuardAbortPageErrors：守卫 abort 步的 pageerror → excluded；非 abort 步 pageerror → kept', () => {
    const pageErrors = [
      { attributedStepId: 'del_a', message: 'net::ERR_ABORTED (guard abort side-effect)' },
      { attributedStepId: 'other_b', message: 'real-sut-crash' },
    ];
    const guardAborts = [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'GUARDED_MUTATION_OUTBOUND_ID_MISMATCH' }];
    const { kept, excluded } = partitionGuardAbortPageErrors({ pageErrors, guardAborts });
    assert(excluded.length === 1 && excluded[0].attributedStepId === 'del_a', `守卫 abort 步 pageerror 应 excluded；实得 ${brief(excluded)}`);
    assert(kept.length === 1 && kept[0].attributedStepId === 'other_b', `非 abort 步 pageerror 应 kept（不误排除真 SUT 缺陷）；实得 ${brief(kept)}`);
    // 空 guardAborts（hermetic 常态）→ 全 kept（对既有回放零行为差）。
    const p2 = partitionGuardAbortPageErrors({ pageErrors, guardAborts: [] });
    assert(p2.kept.length === 2 && p2.excluded.length === 0, `无守卫 abort 应全 kept（零行为差）；实得 ${brief(p2)}`);
  });
  await test('R5b 真 bin/verdict.mjs：守卫 abort 步的 pageerror 被排除（不进 axes）→ 该步 NEEDS_HUMAN 非 SUT_DEFECT；非 abort 步真 pageerror → SUT_DEFECT（正控）', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'c3r3-verdict-'));
    const stepWith = (pageerror) => ({
      stepId: 'del_a', intentId: 'intent_del', atom: 'agent.delete',
      action: { resolution: 'unique', identityReadback: { ok: true } },
      postAssertions: [{ kind: 'textHidden', value: NAME, ok: false, soft: false }],
      forensics: { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror } },
    });
    const runVerdict = (pageerror, tag) => {
      const axesPath = join(tmp, `axes-${tag}.json`);
      const outPath = join(tmp, `verdict-${tag}.json`);
      writeFileSync(axesPath, JSON.stringify({ caseId: 'tc', steps: [stepWith(pageerror)] }));
      const r = spawnSync(process.execPath, [VERDICT, '--axes', axesPath, '--out', outPath], { encoding: 'utf8' });
      assert(r.status === 0, `verdict 应 exit 0；实得 ${r.status}：${(r.stderr || '').slice(-200)}`);
      return JSON.parse(readFileSync(outPath, 'utf8')).steps[0];
    };
    // 守卫 abort 步：partition 把 pageerror 排除 → axes 该步 pageerror:[] → 无背书 → NEEDS_HUMAN/SUT_DEFECT_OR_STALE。
    const excludedPageErrors = [{ attributedStepId: 'del_a', message: 'net::ERR_ABORTED' }];
    const { kept } = partitionGuardAbortPageErrors({
      pageErrors: excludedPageErrors,
      guardAborts: [{ attributedStepId: 'del_a', atom: 'agent.delete', reason: 'GUARDED_MUTATION_OUTBOUND_ID_MISMATCH' }],
    });
    const afterExclude = runVerdict(kept, 'excluded'); // kept 恒空
    assert(afterExclude.verdict === 'NEEDS_HUMAN' && afterExclude.reason === 'SUT_DEFECT_OR_STALE',
      `守卫 abort 步 pageerror 排除后应 NEEDS_HUMAN/SUT_DEFECT_OR_STALE，绝不 SUT_DEFECT；实得 ${brief(afterExclude)}`);
    // 正控：非守卫 abort 步的真 pageerror 未被排除 → 背书 SUT_DEFECT（证排除不吞真缺陷）。
    const realDefect = runVerdict([{ attributedStepId: 'del_a', message: 'real-sut-error' }], 'real');
    assert(realDefect.verdict === 'SUT_DEFECT', `非守卫 abort 步真 pageerror 应 SUT_DEFECT（正控，排除不误吞真缺陷）；实得 ${brief(realDefect)}`);
  });
  await test('R5c 静态：bin/replay.mjs 投影前按 partitionGuardAbortPageErrors 排除、只把 keptPageErrors 交 projectReplayAxes；guardAborts 绝不进 projectReplayAxes', () => {
    const src = readFileSync(REPLAY, 'utf8');
    assert(src.includes('partitionGuardAbortPageErrors({ pageErrors, guardAborts })'), 'replay 未按 partitionGuardAbortPageErrors 做守卫 abort 因果排除');
    const axesAnchor = src.indexOf('projectReplayAxes({');
    const axesCall = src.slice(axesAnchor, axesAnchor + 400);
    assert(axesCall.includes('pageErrors: keptPageErrors'), 'projectReplayAxes 未只收已过滤的 keptPageErrors');
    assert(!axesCall.includes('guardAborts'), 'guardAborts 绝不得进 projectReplayAxes（round-2 D2：不进 axes/裁定）');
  });
} finally {
  for (const prd of cleanup) rmSync(prd, { force: true });
  rmSync(SCRATCH_ROOT, { recursive: true, force: true });
}

if (failures.length) {
  for (const message of failures) console.error(`RED  entity-destructive-continuity-guard-round3: ${message}`);
  console.error(`RED  entity-destructive-continuity-guard-round3: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-destructive-continuity-guard-round3: ${passed}/${passed} 全过（round-2 re-review 残留 finding 真生产码路径封口：v1 旁路 + confirmToolPicker + per-step + unroute + abort 因果排除）`);

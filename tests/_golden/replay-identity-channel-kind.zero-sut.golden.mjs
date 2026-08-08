#!/usr/bin/env node
// replay-identity-channel-kind 验收金牌：v2 身份锁通道解析按锁行 atom 反查注册表推导 kind
// （GRILL 两裁：①锁行 atom→注册表、③控制器覆盖步豁免）。纯 node：spawn 真 bin/replay.mjs
// （零浏览器/零 SUT/零 fake-SUT）——CASEY_LAUNCH_SENTINEL 在 chromium.launch 前短路：
// 门在浏览器前拦 = exit 65 + 具名 reason + 哨兵缺席；全门通过 = exit 66 + 哨兵在场。
//
// ── 咬什么（第九例「从未走通过」的封口）──────────────────────────────────────
// 现行 bin/replay.mjs 只认 profile.agents 置 identityChannelCfg（agent 通道硬编码），
// workflow v2 锁（行 atom=workflow.create）被「未声明 agents.listApi」误拒。本金牌钉：
//   W1 非覆盖 workflow 行（无消费面）→ 具名 IDENTITY_EXPECTATION_CONSUMER_MISSING 拒
//   W2 剖面缺 workflows 段 → 拒因点名 workflows.listApi（不再报错剖面键）
//   W3 锁 digest 与 workflows 段错配（且行非覆盖）→ 指纹错配拒（数字段门先于消费面门）
//   W4 锁行 atom 注册表外 → IDENTITY_LOCK_ATOM_UNREGISTERED
//   W5 agent/workflow 行混装 → IDENTITY_LOCK_KIND_MIXED（镜像 C2 单通道约束）
//   W6 行被 v3 created-workflow 权威覆盖 → 豁免全排除、锁级两门过、不建账本、抵哨兵
// agent 零行为差由 C3 金牌 D2 + agent-id-readback 家族承担（邻接复跑），此处不重钉。
//
// 夹具自哈希自洽（C3 failclosed-replay 同款：ADR-0010 威胁边界内合法构造）：手造 v2
// 冻结锁 + calculateIdentityAdmissionSignature + 临时 prd 注册 checksum。digest 对齐
// 直接 import parseAgentIdentityProfile 现算（不手抄规范化）；W6 的 v3 权威/票据走
// 导出 mint 链（签名皆内容哈希）。
// 断言纪律：退出码 + 具名 reason + 哨兵在场性；判绿只信退出码。改本文件=Test Ratchet 判红。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateIdentityAdmissionSignature } from '../../lib/entity-semantic-lock-preflight.mjs';
import { parseAgentIdentityProfile } from '../../lib/agent-identity-profile.mjs';
import {
  issueCreatedWorkflowCompileProvenance,
  prepareCreatedWorkflowOwnershipDraft,
  freezeCreatedWorkflowOwnershipAuthority,
} from '../../lib/entity-created-workflow-continuity-v3.mjs';
import {
  authorCreatedWorkflowReplayGrantDraft,
  freezeCreatedWorkflowReplayGrant,
} from '../../lib/entity-created-workflow-replay-grant.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const SCRATCH_ROOT = join(ROOT, '.golden-scratch-replay-kind');

const NAME = 'atl_wf_kindgen';
const HASH64 = `sha256:${'a'.repeat(64)}`;
const WRONG_DIGEST = `sha256:${'b'.repeat(64)}`;
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const bytesSha = (text) => `sha256:${sha256Hex(Buffer.from(text))}`;

// 中性 workflow 身份通道剖面段（物理卡片面 + listApi；形状同 C3 金牌 agents 段）。
const WF_LIST_API = {
  pathname: '/api/workflows/query', method: 'GET', queryParam: 'nameLike',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'workflowId', code: 'workflowCode', name: 'workflowName' },
};
const AG_LIST_API = {
  pathname: '/api/agents/query', method: 'GET', queryParam: 'nameLike',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
};
const WF_SECTION = {
  itemContainer: '.wf-card',
  cardFields: { name: '.wf-card__name', code: '.wf-card__code' },
  listApi: WF_LIST_API,
};
const AG_SECTION = {
  itemContainer: '.agent-card',
  cardFields: { name: '.agent-card__name', code: '.agent-card__code' },
  listApi: AG_LIST_API,
};
const wfParsed = parseAgentIdentityProfile(WF_SECTION);
if (!wfParsed.ok) { console.error(`RED  replay-identity-channel-kind: 夹具 workflows 段解析失败（${wfParsed.reason}），夹具须先自洽`); process.exit(1); }
const WF_DIGEST = wfParsed.digest;

const baseProfile = () => ({ background: [], successField: 'status', successValue: 200 });

// 最小 workflow 事件流：create fill + 终端 click（不携 deleteByName——不触 delete-spec 闸，
// 无破坏性原子则 C3 破坏性准入自然放行；本金牌只孤立 v2 身份门族）。
const WF_EVENTS = [
  { stepId: 'atstep_1', intentId: 'intent_create', atom: 'workflow.create', action: 'fill', value: NAME },
  { stepId: 'atstep_2', intentId: 'intent_create', atom: 'workflow.create', action: 'click', text: '确认' },
];

const subjectBinding = (ev) => ({
  stepId: ev.stepId, intentId: ev.intentId, atom: ev.atom, role: 'subject',
  candidateId: `candidate-${ev.stepId}`, lockId: `lock-${ev.stepId}`, receiptHash: HASH64,
});
const wfObservationRow = (overrides = {}) => ({
  name: NAME, code: 'WF-KG-001', platformId: '1234567890123456789', sourceIntentId: 'source_1',
  candidateId: 'candidate-atstep_2', role: 'subject', atom: 'workflow.create', evidenceStepId: 'atstep_2',
  ...overrides,
});

function buildFrozenLock({ caseId, eventEntries, eventsSha256, rows, digest }) {
  const lock = {
    schemaVersion: 2, artifactKind: 'entity-locks-frozen', caseId,
    signed: true, replayReady: true, signerId: 'golden-human', signedAt: '2026-08-08T08:00:00.000Z',
    audience: 'test', eventsSha256,
    identityProfileDigest: digest,
    identityObservationsSha256: HASH64,
    identityObservations: rows,
    bindings: eventEntries.filter((ev) => ev.atom.startsWith('workflow.') || ev.atom.startsWith('agent.')).map(subjectBinding),
    signature: 'sha256:placeholder',
  };
  lock.signature = calculateIdentityAdmissionSignature(lock);
  return lock;
}

// 场景跑法（C3 姿势）：写 events/expected/profile/lock + 临时 prd 注册 checksum，
// spawn 真 replay，回收 退出码/输出/哨兵在场性。
function runScenario({ tag, caseId, eventEntries, rows, digest, profile, extraArgs = [], extraFiles = null }) {
  const dir = join(SCRATCH_ROOT, tag);
  mkdirSync(dir, { recursive: true });
  const eventsDoc = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow/list',
    recordedAt: '2026-08-08T08:00:00.000Z', compiledBy: 'kind-golden', authored: false, events: eventEntries,
  };
  const eventsText = jsonText(eventsDoc);
  const eventsPath = join(dir, 'events.json');
  writeFileSync(eventsPath, eventsText);
  const eventsSha256 = bytesSha(eventsText);

  const expectedPath = join(dir, 'expected.json');
  writeFileSync(expectedPath, jsonText({ caseId, channel: 'web', intents: [], globalAssertions: [] }));
  const profilePath = join(dir, 'profile.json');
  writeFileSync(profilePath, jsonText(profile));

  const lock = buildFrozenLock({ caseId, eventEntries, eventsSha256, rows, digest });
  const lockText = jsonText(lock);
  const locksPath = join(dir, 'entity-locks.frozen.json');
  writeFileSync(locksPath, lockText);
  const artifactKey = resolve(locksPath).slice(ROOT.length + 1).split('\\').join('/');

  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  rmSync(prdPath, { force: true });
  writeFileSync(prdPath, jsonText({
    schemaVersion: 1, caseId, task: 'replay-identity-channel-kind 金牌临时 prd（finally 清理）',
    testChecksums: { [artifactKey]: sha256Hex(Buffer.from(lockText)) }, stories: [],
  }), { flag: 'wx' });

  // extraFiles：在 events/profile 落盘后、spawn 前铸额外夹具件（W6 的 v3 权威链），
  // 回传追加 argv——保证所有件都对「同一份字节」铸，不做第二次拼装。
  const moreArgs = typeof extraFiles === 'function'
    ? extraFiles({ dir, eventsText, profileText: jsonText(profile) })
    : [];
  const sentinel = join(dir, 'launch.sentinel');
  const axesPath = join(dir, 'axes.json');
  const env = { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel };
  const result = spawnSync(process.execPath, [
    REPLAY, '--events', eventsPath, '--sut', 'http://127.0.0.1:1', '--expected', expectedPath,
    '--profile', profilePath, '--out', axesPath, '--entity-locks', locksPath,
    ...moreArgs, ...extraArgs,
  ], { encoding: 'utf8', timeout: 90000, env });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return { result, output, sentinelWritten: existsSync(sentinel), prdPath };
}

const failures = [];
const cleanup = [];
const expectDeny = ({ label, run, mustInclude }) => {
  cleanup.push(run.prdPath);
  if (run.result.status !== 65) failures.push(`${label} 应 fail-closed exit 65，实际 ${run.result.status}：${run.output.slice(-300)}`);
  for (const token of mustInclude) {
    if (!run.output.includes(token)) failures.push(`${label} 拒因缺具名标记「${token}」：${run.output.slice(-300)}`);
  }
  if (run.sentinelWritten) failures.push(`${label} 哨兵已写：控制流越过浏览器前门=fail-open 未闭`);
};

try {
  // ── W1 非覆盖 workflow 行（无控制器、消费面不存在）→ 具名拒 ──
  expectDeny({
    label: 'W1 消费面缺失',
    run: runScenario({
      tag: 'w1', caseId: 'tc_rik_w1', eventEntries: WF_EVENTS,
      rows: [wfObservationRow()], digest: WF_DIGEST,
      profile: { ...baseProfile(), workflows: WF_SECTION },
    }),
    mustInclude: ['IDENTITY_EXPECTATION_CONSUMER_MISSING'],
  });

  // ── W2 剖面缺 workflows 段 → 拒因点名 workflows.listApi（kind 参数化文案）──
  expectDeny({
    label: 'W2 剖面段缺失',
    run: runScenario({
      tag: 'w2', caseId: 'tc_rik_w2', eventEntries: WF_EVENTS,
      rows: [wfObservationRow()], digest: WF_DIGEST,
      profile: baseProfile(),
    }),
    mustInclude: ['workflows.listApi', '剖面只是适配器'],
  });

  // ── W3 digest 错配（行非覆盖）→ 指纹错配拒——证数字段门先于消费面门 ──
  expectDeny({
    label: 'W3 指纹错配',
    run: runScenario({
      tag: 'w3', caseId: 'tc_rik_w3', eventEntries: WF_EVENTS,
      rows: [wfObservationRow()], digest: WRONG_DIGEST,
      profile: { ...baseProfile(), workflows: WF_SECTION },
    }),
    mustInclude: ['identityProfileDigest 错配'],
  });

  // ── W4 锁行 atom 注册表外 → IDENTITY_LOCK_ATOM_UNREGISTERED ──
  expectDeny({
    label: 'W4 注册表外 atom',
    run: runScenario({
      tag: 'w4', caseId: 'tc_rik_w4', eventEntries: WF_EVENTS,
      rows: [wfObservationRow({ atom: 'gizmo.frobnicate' })], digest: WF_DIGEST,
      profile: { ...baseProfile(), workflows: WF_SECTION },
    }),
    mustInclude: ['IDENTITY_LOCK_ATOM_UNREGISTERED'],
  });

  // ── W5 agent/workflow 行混装 → IDENTITY_LOCK_KIND_MIXED（单通道约束）──
  expectDeny({
    label: 'W5 kind 混装',
    run: runScenario({
      tag: 'w5', caseId: 'tc_rik_w5', eventEntries: WF_EVENTS,
      rows: [
        wfObservationRow(),
        wfObservationRow({ atom: 'agent.searchOpen', evidenceStepId: 'atstep_9', candidateId: 'candidate-ag' }),
      ],
      digest: WF_DIGEST,
      profile: { ...baseProfile(), workflows: WF_SECTION, agents: AG_SECTION },
    }),
    mustInclude: ['IDENTITY_LOCK_KIND_MIXED'],
  });
  // ── W6 行被 v3 created-workflow 权威覆盖 → 豁免全排除、锁级两门过、不建账本、抵哨兵 ──
  // 夹具走导出 mint 链（provenance/权威/票据签名皆内容哈希；audience=test 对齐无凭据上下文）。
  {
    const caseId = 'tc_rik_w6';
    const NAME_T = 'atl_{{uniqueName}}';
    const w6Events = [
      { stepId: 'atstep_1', intentId: 'intent_create', atom: 'workflow.create', action: 'fill', value: NAME_T },
      { stepId: 'atstep_2', intentId: 'intent_create', atom: 'workflow.create', action: 'click', text: '确认', compilePhase: 'terminal' },
      { stepId: 'atstep_3', intentId: 'intent_cleanup', atom: 'workflow.deleteByName', action: 'fill', value: NAME_T },
      { stepId: 'atstep_4', intentId: 'intent_cleanup', atom: 'workflow.deleteByName', action: 'click', text: '删除', value: NAME_T },
      { stepId: 'atstep_5', intentId: 'intent_cleanup', atom: 'workflow.deleteByName', action: 'click', text: '确认', value: NAME_T, compilePhase: 'terminal' },
    ];
    const w6Section = {
      ...WF_SECTION,
      mutationAdapter: { method: 'POST', path: '/api/workflows/remove', idLocation: 'body.data.workflowId' },
    };
    const w6Parsed = parseAgentIdentityProfile(w6Section);
    let run = null;
    let mintFailure = null;
    if (!w6Parsed.ok) {
      mintFailure = `W6 夹具 workflows 段（含 mutationAdapter）解析失败：${w6Parsed.reason}`;
    } else {
      try {
        run = runScenario({
          tag: 'w6', caseId, eventEntries: w6Events,
          rows: [wfObservationRow()], digest: w6Parsed.digest,
          profile: { ...baseProfile(), workflows: w6Section },
          extraFiles: ({ dir, eventsText, profileText }) => {
            const flowText = jsonText({
              caseId,
              flow: {
                id: caseId,
                steps: [
                  { sourceIntentId: 'intent_create', atom: 'workflow.create', params: { name: NAME_T }, entityBindings: [{ candidateId: 'candidate-wf', role: 'subject' }] },
                  { sourceIntentId: 'intent_cleanup', atom: 'workflow.deleteByName', params: { name: NAME_T }, entityBindings: [{ candidateId: 'candidate-wf', role: 'subject' }] },
                ],
              },
            });
            const flowPath = join(dir, 'flow.confirmed.json');
            writeFileSync(flowPath, flowText);
            const testcaseText = jsonText({ schemaVersion: 1, caseId, channel: 'web' });
            const testcasePath = join(dir, 'testcase.json');
            writeFileSync(testcasePath, testcaseText);
            const issued = issueCreatedWorkflowCompileProvenance({
              caseId, eventsBytes: Buffer.from(eventsText), confirmedFlowBytes: Buffer.from(flowText),
            });
            if (!issued.ok) throw new Error(`provenance 铸造失败：${issued.reason}`);
            const provText = jsonText(issued.provenance);
            const provPath = join(dir, 'compile-provenance.json');
            writeFileSync(provPath, provText);
            const prep = prepareCreatedWorkflowOwnershipDraft({
              caseId,
              eventsBytes: Buffer.from(eventsText), flowBytes: Buffer.from(flowText),
              testcaseBytes: Buffer.from(testcaseText), profileBytes: Buffer.from(profileText),
              compileProvenanceBytes: Buffer.from(provText),
            });
            if (!prep.ok) throw new Error(`权威草案失败：${prep.reason}`);
            const sealed = freezeCreatedWorkflowOwnershipAuthority({
              draft: prep.draft, signerId: 'golden-human', signedAt: '2026-08-08T08:00:00.000Z', audience: 'test',
            });
            if (!sealed.ok) throw new Error(`权威冻结失败：${sealed.reason}`);
            const authText = jsonText(sealed.authority);
            const authPath = join(dir, 'created-workflow-authority.json');
            writeFileSync(authPath, authText);
            const grantDraft = authorCreatedWorkflowReplayGrantDraft({
              batchId: 'rikw6batch', audience: 'test', grantNonce: 'c'.repeat(32),
              notAfter: '2027-01-01T00:00:00.000Z',
              cases: [{ caseId, authorityBytes: Buffer.from(authText) }],
            });
            if (!grantDraft.ok) throw new Error(`票据草案失败：${grantDraft.reason}`);
            const grantSealed = freezeCreatedWorkflowReplayGrant({
              draft: grantDraft.draft, signerId: 'golden-human', signedAt: '2026-08-08T08:00:00.000Z',
            });
            if (!grantSealed.ok) throw new Error(`票据冻结失败：${grantSealed.reason}`);
            const grantPath = join(dir, 'replay-grant.json');
            writeFileSync(grantPath, jsonText(grantSealed.grant));
            const ledgerRoot = join(dir, 'grant-ledger');
            mkdirSync(ledgerRoot, { recursive: true });
            return [
              '--created-workflow-authority', authPath, '--flow', flowPath, '--testcase', testcasePath,
              '--compile-provenance', provPath, '--replay-grant', grantPath, '--replay-grant-ledger', ledgerRoot,
              '--batch-token', 'rikw6', '--unique-name', 'rikw6-case1',
            ];
          },
        });
      } catch (error) {
        mintFailure = `W6 夹具铸造失败（lib mint 链，与 replay 无关）：${error.message}`;
      }
    }
    if (mintFailure) {
      failures.push(mintFailure);
    } else {
      cleanup.push(run.prdPath);
      if (run.result.status !== 66 || !run.sentinelWritten) {
        failures.push(`W6 覆盖豁免应抵达浏览器前哨兵（exit 66 + 哨兵在场），实际 exit ${run.result.status}、哨兵 ${run.sentinelWritten}：${run.output.slice(-300)}`);
      }
    }
  }
} finally {
  for (const prd of cleanup) rmSync(prd, { force: true });
  rmSync(SCRATCH_ROOT, { recursive: true, force: true });
}

if (failures.length) {
  for (const message of failures) console.error(`RED  replay-identity-channel-kind: ${message}`);
  console.error(`RED  replay-identity-channel-kind: ${failures.length} 红`);
  process.exit(1);
}
console.log('ok   replay-identity-channel-kind: v2 身份锁通道按锁行 atom 反查注册表推导 kind——五路 fail-closed 具名拒（真 bin/replay.mjs 码路径、浏览器前）');

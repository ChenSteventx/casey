#!/usr/bin/env node
// bin/replay.mjs —— 确定性回放器（相3）。真回放 SUT（被测系统）→ 产三轴 axes.json → 喂已冻 verdict.mjs。
// 冻结 CLI：node bin/replay.mjs --events <f> --sut <baseUrl> --expected <f> --profile <f> --out <axes.json> [--entity-locks <f>] [--login-bootstrap]
// 可选登录、历史与视频均不进入 verdict；凭据只进内存，失败不落 axes。
// 裁判零 LLM（护栏 #15）：本进程只产三轴事实，绝不裁定、绝不问 LLM、绝不写 verdict/passes。
// 取证按【动作作用域 + 发起方】归因（护栏 #15，非时间窗）：currentStepId 仅在该步动作执行+静默期开放，
//   预导航/上下文恢复期一律 null；证不出归 null（fail-safe，护栏 #14）。
import { readFileSync, writeFileSync, writeSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pw from '@playwright/test';
import { instantiate } from '../lib/instantiate.mjs';
import { createPageForensicsHub } from '../lib/replay-forensics.mjs';
import { normalizeLoadingProfile } from '../lib/replay-settle.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { assertSignedContract } from '../lib/sign-gate.mjs';
import { validateWorkflowDeleteBindings } from '../lib/workflow-delete-spec.mjs';
import { projectReplayAssertion, validateReplayEntityAnchors } from '../lib/replay-entity-anchor.mjs';
import {
  checkReplayEntityAdmission as checkCompileIdentityAdmission,
  readIdentityAdmissionAuthorityFromPrd,
  checkCredentialAudienceGate,
  readFrozenIdentityObservations,
  readFrozenDestructiveContinuity,
} from '../lib/entity-semantic-lock-preflight.mjs';
// 准入纯函数单列一行导入：round-2 冻结金牌 E1 逐字咬 `import { admitDestructiveTargetContinuity }`，
// 合并进下方多行导入会让该静态断言失配（收口面未变、断言却转红）。
import { admitDestructiveTargetContinuity } from '../lib/entity-destructive-continuity.mjs';
import {
  destructiveTargetKind,
  requiresTargetContinuityRef,
  selectObservationForDestructiveTarget,
} from '../lib/entity-destructive-continuity.mjs';
import { mintDestructiveTargetContinuity } from '../lib/entity-destructive-continuity-wiring.mjs';
import { parseAgentIdentityProfile } from '../lib/agent-identity-profile.mjs';
import { ENTITY_KIND_COMPILE_CHANNELS, deriveFrozenLockChannelKind } from '../lib/entity-observation-registry.mjs';
import { PROJECT_ROOT } from '../lib/paths.mjs';
import { playwrightLaunchOptions, resolveCliExecutionTarget } from '../lib/execution-target/wiring.mjs';
import { emitExecutionTargetCliFailure } from '../lib/execution-target/cli-boundary.mjs';
import { runReplayEvents } from '../lib/replay/event-runner.mjs';
import { finalizeReplayArtifacts } from '../lib/replay/artifact-finalizer.mjs';
import { ReplayNavigationAbort, requireLoginBootstrapResult } from '../lib/replay/navigation.mjs';
import { createReplayOriginAdmission } from '../lib/replay/origin-admission.mjs';
import { createReplayVideoLifecycle } from '../lib/replay/video-lifecycle.mjs';
import { navigateExecutionTargetPage } from '../lib/execution-target/runtime.mjs';
import {
  parseReplayArgs,
  projectReplayArtifactKey,
} from '../lib/replay/cli-input.mjs';
import { classifyReplayFatal } from '../lib/replay/cli-failure.mjs';
import {
  captureReplaySessionSeed,
  installReplaySessionSeedBeforeNavigation,
  openReplayTopology,
} from '../lib/page-topology/replay-session.mjs';
import { readCreatedWorkflowReplayGrant } from '../lib/entity-created-workflow-replay-grant.mjs';
import { occupyReplayGrantMember } from '../lib/replay-grant-ledger.mjs';
import {
  createCreatedWorkflowReplayContinuityController,
  issueCreatedWorkflowCompileProvenance,
  readCreatedWorkflowOwnershipAuthority,
} from '../lib/entity-created-workflow-continuity-v3.mjs';

const { chromium } = pw;

// ── 录像基座（replay-video GRILL D1/M3–M5）─────────────────────
// fail-closed 退出路径的录像清扫：不许把镜头残件（尤其登录期键入）留在盘上（护栏 #7）。
let activeBrowser = null;
const videoLifecycle = createReplayVideoLifecycle();

// 读失败消毒（output-seal 追加缝：AUDIT 未列 events/expected/profile 的裸 JSON.parse，坏 JSON 原流进
// 兜底 catch 打栈携内容片段——照 sign/draft/compile 同款消毒，只报「不是合法 JSON/不可读」，内容不回显）。
function readJsonSafe(f, label) {
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch { console.error(`replay: 读/解析 ${label} 失败（${f}；不是合法 JSON 或不可读，内容不回显）`); process.exit(65); }
}

async function main() {
  const args = parseReplayArgs(process.argv.slice(2));
  for (const k of ['events', 'sut', 'expected', 'profile', 'out']) {
    if (typeof args[k] !== 'string' || !args[k]) { console.error(`replay: 缺 --${k}`); process.exit(64); }
  }
  if (args.createdWorkflowAuthority && (args.uniqueName == null || args.batchToken == null)) {
    console.error('replay: v3 created-workflow 回放须显式提供 --batch-token 与 --unique-name，禁止默认 r1');
    process.exit(64);
  }
  // 回放授权票据双旗标（p9-replay-authority-split plan §4）：有结构件即同为必填、缺任一即拒。
  // 次序必须排在上面的 batch-token 门之后，否则拒因会被旧门吃掉（金牌 R2 钉这条次序）。
  if (args.createdWorkflowAuthority) {
    if (typeof args.replayGrant !== 'string' || !args.replayGrant) {
      console.error('replay: v3 created-workflow 回放须提供 --replay-grant（批级一次性回放授权票据）');
      process.exit(64);
    }
    if (typeof args.replayGrantLedger !== 'string' || !args.replayGrantLedger) {
      console.error('replay: v3 created-workflow 回放须提供 --replay-grant-ledger（核销台账根，launch 前原子占用）');
      process.exit(64);
    }
  }
  const uniqueName = args.uniqueName == null ? 'r1' : String(args.uniqueName);
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(uniqueName)) {
    console.error('replay: --unique-name 非法（须为 1-64 位字母数字/下划线/连字符，且以字母数字开头）');
    process.exit(64);
  }
  // 看门狗 120s（同 compile 先例；chiefcomplaint-smoke D2：chat 用例含 LLM 流式等待，75s 偏紧）。fail-safe 语义不变。
  // M5 尽力收口（codex R1-F1 采信）：清扫先行（不依赖 close 成败）→ 尽力关 → 关后补扫，4s 兜底强退，
  // 退出码语义不变（仍 1）。REPLAY_WATCHDOG_MS 仅测试缝（golden 钉清扫语义用），缺省 120s 一字不变。
  const wdMs = Number(process.env.REPLAY_WATCHDOG_MS) > 0 ? Number(process.env.REPLAY_WATCHDOG_MS) : 120000;
  const watchdog = setTimeout(async () => {
    console.error('replay 看门狗：超时强制退出');
    const bail = setTimeout(() => process.exit(1), 4000);
    videoLifecycle.sweep();
    try { if (activeBrowser) await activeBrowser.close(); } catch { /* 尽力而为 */ }
    videoLifecycle.sweep();
    clearTimeout(bail);
    process.exit(1);
  }, wdMs);
  const DBG = !!process.env.REPLAY_DEBUG;
  const T0 = Date.now();
  const log = (m) => { if (DBG) console.error('[replay +' + (Date.now() - T0) + 'ms] ' + m); };

  const eventsDoc = readJsonSafe(args.events, 'events');
  const expectedDoc = readJsonSafe(args.expected, 'expected');
  // 未签→裁定拒算数前置闸（相2 sign，护栏 #14）：读完 expected、开浏览器前——非空断言契约未签则 exit 65
  // fail-closed（不进「算数」路径、零 axes）。空断言契约 assertSignedContract vacuously ok，零行为差。
  const signCheck = assertSignedContract(expectedDoc);
  if (!signCheck.ok) {
    console.error('replay: expected 契约未签，裁定流程拒算数（fail-closed，护栏 #14）：' + signCheck.problems.slice(0, 3).join('；'));
    process.exit(65);
  }
  // caseId 端到端绑定（codex R1-F1 + R2-F2）：非空签署契约须与本次 events 同 case——两侧 caseId 都在且相等，
  // 否则拒算数（防用 A 的签名给 B 的 events、或删 caseId 绕过绑定）。空契约 vacuously 无需绑定。
  const expHasAssertions = (expectedDoc.intents || []).some((it) => (it.expected || []).length > 0) || (expectedDoc.globalAssertions || []).length > 0;
  if (expHasAssertions && (!expectedDoc.caseId || !eventsDoc.caseId || expectedDoc.caseId !== eventsDoc.caseId)) {
    console.error('replay: 已签契约与 events 的 caseId 未双向绑定（两侧文件值不符或缺，原值不回显——output-seal A10），拒算数（fail-closed）');
    process.exit(65);
  }
  const profile = readJsonSafe(args.profile, 'profile');
  try { normalizeLoadingProfile(profile); }
  catch {
    console.error('replay: profile.loading 形状非法，浏览器启动前拒绝');
    process.exit(65);
  }
  // 身份通道剖面（agent-id-readback + replay-identity-channel-kind：C2 泛化接线 replay 侧）。
  // 闭集遍历已登记 kind 的剖面段（agent→agents、workflow→workflows），产 kind→cfg/digest 两映射；
  // 通道选择由冻结锁行推导的 kind 点名唯一段（锁驱动、非静默择一），选定在下方 v2 门内。
  // 执法时机分层（全仓扫描实证修正，见 plan-amendment-1）：agents 段保持今日既有「声明即执法」
  // 字节行为（形状/listApi 非法→浏览器前拒）；非 agent 段（workflows.listApi 兼作 v3 连续性
  // 适配器素材，最小声明不必是良构身份通道——p9 权威 CLI 金牌两件实证）改「延迟执法」：
  // 解析失败只记录，锁真点名该 kind 时才在 v2 门内具名拒，v3 专用剖面零行为差。
  const identityChannelsByKind = new Map();
  const identityDigestsByKind = new Map();
  const identityChannelParseFailures = new Map();
  for (const [kind, channelSpec] of ENTITY_KIND_COMPILE_CHANNELS) {
    const channelProfile = profile ? profile[channelSpec.profileKey] : undefined;
    if (channelProfile === undefined || channelProfile === null) continue;
    if (typeof channelProfile !== 'object' || Array.isArray(channelProfile)) {
      if (kind === 'agent') { console.error(`replay: 通道剖面 ${channelSpec.profileKey} 形状非法，浏览器启动前拒绝`); process.exit(65); }
      identityChannelParseFailures.set(kind, 'PROFILE_SECTION_SHAPE_INVALID');
      continue;
    }
    if (channelProfile.listApi !== undefined && channelProfile.listApi !== null) {
      const parsed = parseAgentIdentityProfile(channelProfile);
      if (!parsed.ok) {
        if (kind === 'agent') { console.error(`replay: 通道剖面 ${channelSpec.profileKey} 身份模式或物理卡片面非法（${parsed.reason}），浏览器启动前拒绝`); process.exit(65); }
        identityChannelParseFailures.set(kind, parsed.reason);
        continue;
      }
      identityChannelsByKind.set(kind, parsed.channel);
      identityDigestsByKind.set(kind, parsed.digest);
    }
  }
  let identityChannelCfg = null;
  let identityProfileDigest = null;
  const events = eventsDoc.events || [];
  // 破坏性删除的陈旧 spec 必须在启动浏览器、接触 SUT 前拒绝。否则前序创建/发布已发生后，
  // 两个无 value 的 click 才 fail-safe，会制造可避免的 atl_ 残留。正确恢复路径是重编译 events，
  // 绝不从页面状态猜目标、也不放宽 workflow.deleteByName 域锁。
  const deleteBindingCheck = validateWorkflowDeleteBindings(events);
  if (!deleteBindingCheck.ok) {
    console.error(`replay: workflow.deleteByName spec 的 click 文案或目标绑定非法（${deleteBindingCheck.problems.length} 步），须先重编译；为避免真实环境残留，本次未启动浏览器（fail-closed）`);
    process.exit(65);
  }
  const caseId = eventsDoc.caseId || expectedDoc.caseId || 'unknown';
  let createdWorkflowController = null;
  let createdWorkflowAuthorityAudience = null;
  let createdWorkflowCovered = new Set();
  if (args.createdWorkflowAuthority) {
    for (const key of ['flow', 'testcase', 'compileProvenance']) {
      if (typeof args[key] !== 'string' || !args[key]) {
        console.error(`replay: v3 created-workflow 回放缺 --${key === 'compileProvenance' ? 'compile-provenance' : key}`);
        process.exit(64);
      }
    }
    let authorityBytes;
    let eventsBytes;
    let flowBytes;
    let testcaseBytes;
    let profileBytes;
    let provenanceBytes;
    try {
      authorityBytes = readFileSync(args.createdWorkflowAuthority);
      eventsBytes = readFileSync(args.events);
      flowBytes = readFileSync(args.flow);
      testcaseBytes = readFileSync(args.testcase);
      profileBytes = readFileSync(args.profile);
      provenanceBytes = readFileSync(args.compileProvenance);
    } catch {
      console.error('replay: v3 created-workflow 授权或绑定源不可读（内容不回显）');
      process.exit(65);
    }
    const issued = issueCreatedWorkflowCompileProvenance({
      caseId,
      eventsBytes,
      confirmedFlowBytes: flowBytes,
    });
    let suppliedProvenance = null;
    try { suppliedProvenance = JSON.parse(provenanceBytes.toString('utf8')); } catch { suppliedProvenance = null; }
    if (!issued.ok || JSON.stringify(issued.provenance) !== JSON.stringify(suppliedProvenance)) {
      console.error('replay: compile provenance 与真实 events/flow 不一致，未启动浏览器');
      process.exit(65);
    }
    const authorityRead = readCreatedWorkflowOwnershipAuthority({
      caseId,
      authorityBytes,
      eventsBytes,
      flowBytes,
      testcaseBytes,
      profileBytes,
    });
    if (!authorityRead.ok) {
      console.error(`replay: v3 created-workflow 授权未过（${authorityRead.reason}），未启动浏览器`);
      process.exit(65);
    }
    // 回放授权票据：读回 → 批会话判定 → launch 前原子占用。三步全过才有 controller。
    let grantBytes;
    try { grantBytes = readFileSync(args.replayGrant); }
    catch {
      console.error('replay: 回放授权票据不可读（内容不回显）');
      process.exit(65);
    }
    const grantRead = readCreatedWorkflowReplayGrant({
      grantBytes,
      cases: [{ caseId, authorityBytes }],
      // 生产路径的时钟一律主机墙钟：不接受任何调用方喂时（plan §3.5）。
      now: new Date().toISOString(),
    });
    if (!grantRead.ok) {
      console.error(`replay: 回放授权票据未过（${grantRead.reason}），未启动浏览器`);
      process.exit(65);
    }
    const occupied = occupyReplayGrantMember({
      ledgerRoot: args.replayGrantLedger,
      grantNonce: grantRead.grantNonce,
      batchToken: String(args.batchToken),
      caseId,
      grantCaseIds: grantRead.caseIds,
    });
    if (!occupied.allowLaunch) {
      console.error(`replay: 回放授权票据核销未过（${occupied.reason}），未启动浏览器`);
      process.exit(65);
    }
    const opened = createCreatedWorkflowReplayContinuityController({
      caseId,
      runId: typeof args.runId === 'string' && args.runId ? args.runId : `${caseId}-${args.batchToken}`,
      batchToken: String(args.batchToken),
      uniqueNameToken: uniqueName,
      authority: authorityRead.handle,
      grant: grantRead.handle,
      profile,
    });
    if (!opened.ok) {
      console.error(`replay: v3 created-workflow 控制器未过（${opened.reason}），未启动浏览器`);
      process.exit(65);
    }
    createdWorkflowController = opened.controller;
    createdWorkflowAuthorityAudience = authorityRead.audience;
    createdWorkflowCovered = new Set(opened.controller.coveredIntentAtoms()
      .map((row) => `${row.intentId}\u0000${row.atom}`));
  }
  // frozen locks 必须绑定本次 events 原始字节与全部显式对象角色；该准入早于登录、浏览器启动和任何业务动作。
  const entityLocksSupplied = typeof args.entityLocks === 'string' && Boolean(args.entityLocks);
  const frozenArtifactKey = entityLocksSupplied
    ? projectReplayArtifactKey(args.entityLocks)
    : null;
  const frozenAuthorityRead = frozenArtifactKey
    ? readIdentityAdmissionAuthorityFromPrd({
      prdId: caseId,
      artifactKey: frozenArtifactKey,
      domain: 'verify',
    })
    : null;
  const frozenLockAuthority = frozenAuthorityRead?.ok === true ? frozenAuthorityRead.authority : null;
  const needsLegacyIdentityAdmission = !createdWorkflowController || events.some((event) => {
    const covered = createdWorkflowCovered.has(`${event.intentId}\u0000${event.atom}`);
    return !covered && !['nav.workflowManagement', 'assert.textVisible'].includes(event.atom);
  });
  const identityAdmission = needsLegacyIdentityAdmission
    ? checkCompileIdentityAdmission({
      caseId,
      eventsBytes: readFileSync(args.events),
      eventsDocument: eventsDoc,
      ...(entityLocksSupplied ? { frozenLockAuthority } : {}),
    })
    : { ok: true };
  if (!identityAdmission.ok) {
    console.error(`replay: frozen identity locks 未过（${identityAdmission.reason}），未启动浏览器；下一步 ${identityAdmission.nextAction}`);
    process.exit(65);
  }
  // v2 冻结锁期望三元组（agent-id-readback plan §5 + replay-identity-channel-kind 两裁）：
  // 锁行在场时回放闭环到点击前——通道 kind 由锁行 atom 反查注册表推导（裁①），缺对应段或
  // 通道指纹不符=浏览器前拒（plan §3：换旧剖面无法降级新签用例）。门序：先锁级两门
  // （通道解析+数字段），后行级豁免（裁③：已被 created-workflow 权威覆盖的行豁免双证，
  // 豁免判据=v3 覆盖面命中、绝非锁自报标记）。
  const frozenIdentityRows = frozenLockAuthority ? readFrozenIdentityObservations(frozenLockAuthority) : null;
  let identityExpectedByStep = null;
  if (frozenIdentityRows && frozenIdentityRows.length) {
    const derived = deriveFrozenLockChannelKind(frozenIdentityRows);
    if (!derived.ok) {
      console.error(`replay: v2 冻结锁身份观察行通道 kind 推导失败（${derived.rejectCode}——注册表闭集反查，锁是权威、不回退猜测），未启动浏览器`);
      process.exit(65);
    }
    const lockKind = derived.kind;
    const lockProfileKey = ENTITY_KIND_COMPILE_CHANNELS.get(lockKind)?.profileKey ?? lockKind;
    if (!identityChannelsByKind.has(lockKind)) {
      if (identityChannelParseFailures.has(lockKind)) {
        // 延迟执法的兑现点：段声明了但非良构身份通道，而锁点名了该 kind——此刻才拒，具名带解析拒因。
        console.error(`replay: v2 冻结锁携 ${lockKind} 身份观察但通道剖面 ${lockProfileKey} 非良构身份通道（${identityChannelParseFailures.get(lockKind)}），未启动浏览器`);
        process.exit(65);
      }
      console.error(`replay: v2 冻结锁携 ${lockKind} 身份观察但通道剖面未声明 ${lockProfileKey}.listApi（剖面只是适配器、不得降级），未启动浏览器`);
      process.exit(65);
    }
    const liveDigest = identityDigestsByKind.get(lockKind) ?? null;
    let lockDigest = null;
    try { lockDigest = JSON.parse(readFileSync(resolve(PROJECT_ROOT, String(args.entityLocks)), 'utf8')).identityProfileDigest ?? null; } catch { lockDigest = null; }
    if (lockDigest !== liveDigest) {
      console.error('replay: 身份通道指纹与 v2 冻结锁不符（identityProfileDigest 错配），未启动浏览器');
      process.exit(65);
    }
    identityChannelCfg = identityChannelsByKind.get(lockKind);
    identityProfileDigest = liveDigest;
    // 裁③ 行级豁免：行 evidenceStepId 所指事件 (intentId, atom) 命中 createdWorkflowCovered
    // 才排除（该步连续性由 v3 控制器接管，编译轮签的 platformId 对回放重建实体结构上不可比）；
    // 步不在 events=非覆盖（fail-closed 倾向）。agent 行的覆盖集恒不含 agent 原子，行为零差。
    const eventByStepId = new Map();
    for (const event of events) { if (!eventByStepId.has(event.stepId)) eventByStepId.set(event.stepId, event); }
    const uncoveredRows = frozenIdentityRows.filter((row) => {
      const anchor = eventByStepId.get(row.evidenceStepId);
      return !(anchor && createdWorkflowCovered.has(`${anchor.intentId}\u0000${anchor.atom}`));
    });
    if (uncoveredRows.length) {
      if (lockKind !== 'agent') {
        // 诚实边界（GRILL §5）：点击前双证的唯一消费面是 agent.searchOpen 路径（lib/replay-actions/
        // agent-search.mjs），其余 kind 的非覆盖签署期望无处兑现——带着它启动浏览器=静默放弃
        // 已签验证义务，具名拒。
        console.error(`replay: v2 冻结锁携 ${lockKind} 身份观察且未被 created-workflow 权威覆盖，回放无该 kind 点击前双证消费面（IDENTITY_EXPECTATION_CONSUMER_MISSING），未启动浏览器（fail-closed）`);
        process.exit(65);
      }
      identityExpectedByStep = new Map();
      for (const row of uncoveredRows) {
        identityExpectedByStep.set(row.evidenceStepId, { signedName: row.name, signedCode: row.code, signedPlatformId: row.platformId });
      }
    }
  }
  // C3 破坏性目标连续性准入（fail-closed，浏览器前；codex Critical-1 ③ + round-2 Critical/High 收口）：
  // 【任一冻结锁在力】（frozenLockAuthority 非空，v1 或 v2）时，events 里每个 targeting/破坏性原子（workflow.deleteByName/
  // agent.delete/picker.selectFirstTool/agent.confirmToolPicker）必须能按【本破坏步自身 stepId】解析到已【认证】的目标
  // 连续性 ref；解析不出即【拒执行该破坏动作】——不启浏览器、绝不 performAction 破坏步。
  //   · round-2 Critical「v1 旁路」：原门只在 v2 frozenIdentityRows 非空时调，放行了合法【v1】破坏锁（无身份通道、
  //     结构上无法核实目标连续性）→ 真 fail-open。此处改判据为 frozenLockAuthority（覆盖 v1/v2）：v1 锁下破坏性原子
  //     一律 fail-CLOSED 拒（与 C1「v1 实体裁定降级」一脉；v1 永不填 ref 表，故恒拒）。
  //   · round-2 High「per-intent 非 per-step」：授权按【逐破坏步 stepId】而非 per-intent——同 intent 里一步有 ref
  //     绝不放行其它破坏步（委派纯守卫 admitDestructiveTargetContinuity 的 resolvedRefByStep 主路）。
  // destructiveContinuityByStep = Map<破坏步 stepId, 已认证 ref>。v1/v2 锁下恒空 → 破坏性原子恒被拒
  // （fail-closed 默认，绝不臆断放行、绝不据锁自报字段放行）；v3 锁下由下方重建块按已签授权边逐条铸入，
  // 权威恒取被签的观察行、边上自报字段只用于对账。
  const destructiveContinuityByStep = new Map(); // per-step 已认证 ref；v1/v2 锁恒空，v3 锁由下方重建填
  const lockKindLabel = (frozenIdentityRows && frozenIdentityRows.length) ? 'v2 身份锁' : 'v1 锁（无身份通道、结构上不可核实目标连续性）';
  // ── v3 冻结锁：逐破坏步连续性 ref 重建（写入侧；docs/plans/destructive-continuity-ref/design-replay-rebuild.md）──
  // 时机三面夹死：在身份通道指纹比对【之后】（指纹没核完就铸 ref＝承认一份与现行剖面不配对的锁）、在下方
  // 破坏性准入门【之前】（准入门是浏览器前最后一道）、在浏览器启动哨兵【之前】（哨兵在场性才证得了
  // 破坏动作有没有可能真发生）。填的是「表怎么被填满」，不是「表怎么被检查」——下方准入门一字不改。
  // 任一不变量不成立即【具名硬退出】，不是「不铸让下游拒」：后者会把拒因压成
  // DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF，「锁里压根没写」与「锁里写了但是伪造的」变得不可区分，
  // 而第二种是攻击信号，必须当场具名（设计纪律一）。
  const signedContinuityEdges = frozenLockAuthority ? readFrozenDestructiveContinuity(frozenLockAuthority) : null;
  if (signedContinuityEdges) {
    const destructiveStepIds = events
      .filter((event) => requiresTargetContinuityRef(event.atom) && typeof event.stepId === 'string')
      .map((event) => event.stepId);
    // 拒绝行同时点名【此刻仍未获授权的破坏步】：硬退出发生在违规边处（该边可能挂在观察步上），
    // 只报边不足以看出「哪些破坏步还裸着」——逐步可定位是 per-step 授权粒度的验收面。
    const refuseEdge = (reason, edge) => {
      const pending = destructiveStepIds.filter((stepId) => !destructiveContinuityByStep.has(stepId));
      const at = `边=${edge?.destructiveStepId ?? '(未知步)'}/${edge?.destructiveAtom ?? '(未知原子)'}`;
      console.error(`replay: v3 冻结锁的破坏性目标连续性授权边非法（${reason}，${at}），仍未获授权的破坏步 [${pending.join(', ') || '无'}]，未启动浏览器（fail-closed，护栏 #14）`);
      process.exit(65);
    };
    if (!identityExpectedByStep || !frozenIdentityRows || !frozenIdentityRows.length) {
      // v3 锁必带非空观察行、且必过上方指纹门；走到这里说明通道剖面未声明身份通道或观察面缺失——
      // 结构上无从核实「同一目标」，恒拒（与 v1 锁同一律）。
      console.error('replay: v3 冻结锁的身份通道未经核验，拒重建破坏性目标连续性 ref（DESTRUCTIVE_CONTINUITY_IDENTITY_CHANNEL_UNVERIFIED），未启动浏览器（fail-closed）');
      process.exit(65);
    }
    // 位序权威是 events 的 0 基下标（I6 的定义面），故索引建在完整 events 上。
    const stepIndex = new Map();
    events.forEach((event, index) => {
      if (!stepIndex.has(event.stepId)) stepIndex.set(event.stepId, { event, index });
    });
    for (const edge of signedContinuityEdges) {
      const hit = stepIndex.get(edge.destructiveStepId);
      // I1：授权边必须对上 events 里真实存在的那一个破坏步（步在、原子逐字相符）。
      if (!hit) refuseEdge('DESTRUCTIVE_CONTINUITY_STEP_NOT_IN_EVENTS', edge);
      if (hit.event.atom !== edge.destructiveAtom) refuseEdge('DESTRUCTIVE_CONTINUITY_ATOM_MISMATCH', edge);
      // I7：授权不得跨意图漂移。
      if (hit.event.intentId !== edge.destructiveIntentId) refuseEdge('DESTRUCTIVE_CONTINUITY_INTENT_MISMATCH', edge);
      // I2：给非破坏步发授权即 per-step 粒度失效。
      if (!requiresTargetContinuityRef(edge.destructiveAtom)) refuseEdge('DESTRUCTIVE_CONTINUITY_ATOM_NOT_TARGETING', edge);
      // I6：位序不得造假（出站取证对账锚）。
      if (hit.index !== edge.stepOrder) refuseEdge('DESTRUCTIVE_CONTINUITY_STEP_ORDER_MISMATCH', edge);
      // I3：跨类别硬闸——codex round-5 Critical 的同款绕过，在【重建】路径上必须同样关死。
      if (edge.boundKind !== destructiveTargetKind(edge.destructiveAtom)) refuseEdge('DESTRUCTIVE_CONTINUITY_KIND_MISMATCH', edge);
      // I8：一步一条，重复即拒（后写覆盖前写＝静默取谁未定义）。
      if (destructiveContinuityByStep.has(edge.destructiveStepId)) refuseEdge('DESTRUCTIVE_CONTINUITY_DUPLICATE_STEP', edge);
      // I4：按目标名 + 类别唯一命中，绝不取 first（同名毒化面）。
      const picked = selectObservationForDestructiveTarget({
        observations: frozenIdentityRows,
        targetName: hit.event.text,
        boundKind: edge.boundKind,
      });
      if (!picked.ok) refuseEdge(picked.reason, edge);
      // 外键须真指向被选中那一条，不许「选了甲、引了乙」。
      if (picked.observation.evidenceStepId !== edge.observationEvidenceStepId) {
        refuseEdge('DESTRUCTIVE_CONTINUITY_OBSERVATION_REF_MISMATCH', edge);
      }
      // I5：边自报 platformId 只用于对账，权威恒取观察行——伪造它即指向别的实体、真删错对象。
      if (picked.observation.platformId !== edge.platformId) {
        refuseEdge('DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH', edge);
      }
      // 复用既有铸造适配器，不另造；指纹取锁顶层唯一事实源——它已在上方与现算 liveDigest 逐字节比对过
      // （不符早已 exit 65），逐条再存一份只会制造「两处不一致时听谁的」。
      const minted = mintDestructiveTargetContinuity(picked.observation, {
        profileFingerprint: identityProfileDigest,
        scope: edge.scope,
        requestCorrelationId: edge.requestCorrelationId,
        stepOrder: edge.stepOrder,
      });
      if (!minted.ok) refuseEdge(minted.reason, edge);
      destructiveContinuityByStep.set(edge.destructiveStepId, minted.ref);
    }
  }
  if (frozenLockAuthority) {
    const destructiveEvents = createdWorkflowController
      ? events.filter((event) => !createdWorkflowCovered.has(`${event.intentId}\u0000${event.atom}`))
      : events;
    const destructiveAdmission = admitDestructiveTargetContinuity({ events: destructiveEvents, resolvedRefByStep: destructiveContinuityByStep });
    if (!destructiveAdmission.ok) {
      const a = destructiveAdmission.atom ? `, atom=${destructiveAdmission.atom}` : '';
      console.error(`replay: 破坏性目标连续性 ref 缺失（${destructiveAdmission.reason}${a}），${lockKindLabel}在力却无法证同一目标，未启动浏览器（fail-closed，护栏 #14）`);
      process.exit(65);
    }
  }
  // 身份账本激活判据（codex R1-M3）：只由已验证 v2 冻结权威激活——真 v1 件即使换上声明了
  // listApi 的新剖面也固定走旧 DOM-only 路径（剖面只是适配器，不得反向改变签署件版本语义）。
  const identityLedger = identityExpectedByStep
    ? (await import('../lib/agent-identity-observation.mjs')).createIdentityObservationLedger({ channel: identityChannelCfg })
    : null;
  const cliSut = String(args.sut);
  let executionSite = null;
  try {
    // Execution target authority is needed for every real replay. Loading this
    // shape does not load credentials and keeps the canonical target off CLI.
    executionSite = loadSiteConfig(undefined, { strict: true });
  } catch {
    writeSync(2, 'replay: 执行目标配置不可读或形状非法（内容/目标不回显）\n');
    process.exit(65);
  }
  let loginCreds = null;
  if (args.loginBootstrap) {
    try {
      loginCreds = loadCreds();
    } catch {
      // process.exit() does not wait for an asynchronous stderr pipe to flush.
      // This pre-launch rejection is consumed by deterministic callers, so emit
      // the fixed, credential-free line synchronously before the terminal exit.
      writeSync(2, 'replay: 登录预备动作前置失败（fail-closed；凭据/站点配置详情不回显，护栏 #7——output-seal B5）\n');
      process.exit(65);
    }
  }
  const execution = resolveCliExecutionTarget({
    site: executionSite,
    cliSut,
    requiresOriginContinuity: Boolean(args.loginBootstrap),
  });
  if (!execution.ok) {
    process.exit(emitExecutionTargetCliFailure({
      command: 'replay',
      failure: execution,
    }));
  }
  const sut = execution.runtime.browserVisibleBaseUrl;
  // 确定性令牌（可 golden）；真机由 compile-gate 注入带 Reserved Prefix 的实体名。
  // baseUrl：G6 分岔三取 C——events url 走 {{baseUrl}} 占位符，回放期回填 --sut（对完整 URL 的旧 fixture 是 no-op）。
  // promptText（regress-promptset）：被测参数经 --prompt-text 注入，回填 fill 步的 {{promptText}} 提示槽（护栏 #6
  // 冻占位符不冻字面量）；RH_PLACEHOLDER 已覆盖 {{promptText}}——回放历史始终显占位符、绝不落真被测参数（护栏 #7）。
  const ctx = {
    uniqueName, baseUrl: sut,
    ...(args.promptText != null ? { promptText: String(args.promptText) } : {}),
    // 容器覆写同参（codex R1-M1）：把通道剖面带给动作门（agent.searchOpen 条目容器覆写与编译侧同一通道）。
    ...(profile && typeof profile === 'object' ? { profile } : {}),
    // 身份双证（agent-id-readback plan §5）：账本+已签期望三元组带给动作门；fill 时 arm、click 时 settle/consume。
    ...(identityLedger ? { identityLedger, identityTokens: new Map() } : {}),
    ...(identityExpectedByStep ? { identityExpectedByStep } : {}),
    // C3 破坏性目标连续性 ref（按破坏步 stepId 关联，非按 searchOpen 的 evidenceStepId——codex Critical-1 ②）：
    // 与上方准入门同一 per-step Map（codex round-2 High per-step）；v3 冻结锁下由上方重建块按已签授权边填，
    // 供出站拦截安装器/归零按破坏步真解析 ref。v1/v2 锁下恒空——空即上方 admission 已在浏览器前拒破坏步。
    // 【诚实边界】重建让浏览器前的授权链闭合，出站消费半边（真拦住请求、真核平台 ID、真在发出前中止）
    // hermetic 证不出、需真浏览器，仍挂 route:human；不得据此宣称破坏链已闭。
    destructiveContinuityByStep,
    ...(createdWorkflowController ? { createdWorkflowController } : {}),
    admitReplayActionOrigin: createReplayOriginAdmission(execution.authority),
  };

  // 登录入口由 execution-target authority 投影。原生平台保持规范 origin；
  // transport endpoint 不再参与页面 URL 拼接。凭据只进内存，绝不入日志。
  const loginPrep = args.loginBootstrap
    ? {
      site: executionSite,
      creds: loginCreds,
      startUrl: execution.runtime.browserVisibleStartUrl,
      executionTargetAuthority: execution.authority,
    }
    : null;

  // 凭据上下文门（ADR-0010）：铸权后、启动浏览器前，准入受众须匹配凭据上下文——真凭据 run（loginPrep 成立）↔
  // production 受众、无凭据 run ↔ test 受众，不符 fail-closed 不启动浏览器。只对有受众的 mutation 回放生效
  // （只读回放无 authority、无受众、跳过）。防测试锁被误指向真 SUT 授权真实改动。
  if (frozenAuthorityRead?.ok === true) {
    const credentialContext = loginPrep ? 'production' : 'test';
    const audienceGate = checkCredentialAudienceGate({ audience: frozenAuthorityRead.audience, credentialContext });
    if (!audienceGate.ok) {
      console.error(`replay: 准入受众与凭据上下文不符（${audienceGate.reason}：受众=${frozenAuthorityRead.audience} 上下文=${credentialContext}），未启动浏览器；下一步 ${audienceGate.nextAction}`);
      process.exit(65);
    }
  }
  if (createdWorkflowAuthorityAudience != null) {
    const credentialContext = loginPrep ? 'production' : 'test';
    const audienceGate = checkCredentialAudienceGate({
      audience: createdWorkflowAuthorityAudience,
      credentialContext,
    });
    if (!audienceGate.ok) {
      console.error(`replay: v3 created-workflow 授权受众与凭据上下文不符（${audienceGate.reason}），未启动浏览器`);
      process.exit(65);
    }
  }

  // 按钮补采通道（wf-publish-states GRILL D2，通道剖面非凭据段，可整段缺省）：present 则 extraSelector
  // 须非空字符串——形状非法拒跑 fail-closed（routes 先例，compile.mjs 同律）。
  let buttonsCfg = null;
  if (profile.buttons !== undefined) {
    const b = profile.buttons;
    const okShape = b && typeof b === 'object' && !Array.isArray(b) && typeof b.extraSelector === 'string' && b.extraSelector.trim();
    // disabledClass 可选类名补判（btn-enable-ops D1 真机适配口）：给了就须非空字符串，形状非法同拒。
    const okDisabled = b == null || b.disabledClass === undefined || (typeof b.disabledClass === 'string' && b.disabledClass.trim());
    if (!okShape || !okDisabled) {
      console.error('replay: 通道剖面 buttons 形状非法（extraSelector 须非空字符串；disabledClass 给了须非空字符串），拒跑（fail-closed）');
      process.exit(65);
    }
    // disabledClass 存 trim 值（codex R1-F4）：classList.contains 对含空白 token 返回 false 不抛——
    // 存原值会让类名判据静默失效、enabled 方向 fail-open。
    buttonsCfg = { extraSelector: b.extraSelector, disabledClass: b.disabledClass === undefined ? null : b.disabledClass.trim() };
  }

  // 计数通道选择器（wf-add-node GRILL D4 (a)，通道剖面非凭据加法）：普通用例缺省
  // .hr-table-row；workflow.deleteByName + 硬 countChange=0 另由实体锚闸强制目标化 selector。
  // 给了须非空字符串，形状非法拒跑 fail-closed（buttons/routes 同律）。
  let countSel = '.hr-table-row';
  if (profile.countSelector !== undefined) {
    if (typeof profile.countSelector !== 'string' || !profile.countSelector.trim()) {
      console.error('replay: 通道剖面 countSelector 形状非法（给了须非空字符串），拒跑（fail-closed）');
      process.exit(65);
    }
    countSel = profile.countSelector.trim();
  }

  // 破坏性 cleanup 实体锚一致性（必须在 chromium.launch 前）：删除/确认 click 目标、前后重搜目标、
  // 硬归零断言的计数 selector 与 cleanup 内其它实体断言必须同源。支持冻结 selector/assertion 中
  // atl_{{uniqueName}}，只生成本轮派生值，绝不改写冻结件。
  const entityAnchorCheck = validateReplayEntityAnchors({ events, expectedDoc, profile, ctx });
  if (!entityAnchorCheck.ok) {
    console.error(`replay: cleanup 实体锚不一致（${entityAnchorCheck.problems.length} 项），为避免 count 0→0 假 PASS，本次未启动浏览器（fail-closed）`);
    process.exit(65);
  }
  if (entityAnchorCheck.countSelector != null) countSel = entityAnchorCheck.countSelector;

  const intentOrder = [];
  const intentEvents = new Map();
  for (const ev of events) {
    if (!intentEvents.has(ev.intentId)) { intentEvents.set(ev.intentId, []); intentOrder.push(ev.intentId); }
    intentEvents.get(ev.intentId).push(ev);
  }
  const reprStepOf = new Map(intentOrder.map((iid) => [iid, intentEvents.get(iid).slice(-1)[0].stepId]));
  const expectedByIntent = new Map((expectedDoc.intents || []).map((it) => [
    it.intentId,
    (it.expected || []).map((assertion) => projectReplayAssertion(assertion, ctx)),
  ]));
  const globalAssertions = (expectedDoc.globalAssertions || []).map((assertion) => projectReplayAssertion(assertion, ctx));
  // 软期望通道（regress-promptset）：--soft-expect 的断言强制 soft:true 并入按 intent 断言表——本通道定义即软、
  // 绝不注入影响裁定的硬断言（护栏 #17：verdict 只 AND 硬断言、忽略 soft），故合法不过 sign-gate（人签保护进裁定的断言）。
  // 在 sign-gate（170–184，只核签署 expected）之后并入，签署契约原样不变。caseId 有断言时同源核对，防跨 case 拼合。
  if (args.softExpect) {
    const softDoc = readJsonSafe(args.softExpect, 'soft-expect');
    const softHas = (softDoc.intents || []).some((it) => (it.expected || []).length > 0) || (softDoc.globalAssertions || []).length > 0;
    if (softHas && softDoc.caseId && caseId !== 'unknown' && softDoc.caseId !== caseId) {
      console.error('replay: --soft-expect caseId 与 events 不同源（原值不回显），拒算数（fail-closed）');
      process.exit(65);
    }
    const forceSoft = (a) => ({ ...projectReplayAssertion(a, ctx), soft: true });
    for (const it of softDoc.intents || []) {
      const cur = expectedByIntent.get(it.intentId) || [];
      expectedByIntent.set(it.intentId, [...cur, ...(it.expected || []).map(forceSoft)]);
    }
    for (const a of softDoc.globalAssertions || []) globalAssertions.push(forceSoft(a));
  }
  const allStepIds = new Set(events.map((e) => e.stepId));

  // 浏览器启动哨兵（仅测试注入，生产 env 未设即 no-op）：到达本行=控制流已越过一切浏览器前 fail-closed 门（准入/受众门）。
  // 设 env 时写哨兵并 exit 66 短路——【不真启浏览器】即可让验收金牌机械证「门是否在浏览器前拦」：门先 fire→exit 65
  // 哨兵缺席；控制流到达此点→哨兵在 + exit 66（正控证哨兵非空、非 axes 缺席那种可被先启动后退门绕过的弱证）。codex round-4。
  if (process.env.CASEY_LAUNCH_SENTINEL) { writeFileSync(process.env.CASEY_LAUNCH_SENTINEL, 'launched'); process.exit(66); }
  let browser;
  try {
    browser = await chromium.launch(playwrightLaunchOptions(
      execution.runtime,
      { headless: true },
    ));
  } catch {
    const failure = new Error('BROWSER_LAUNCH_FAILED');
    failure.reason = 'BROWSER_LAUNCH_FAILED';
    throw failure;
  }
  activeBrowser = browser;
  // 录像 opt-in（M3）：recordVideo 是 context 级选项；缺省不带旗标时 newContext 无参、行为一字不变。
  const context = await browser.newContext(args.videoDir ? { recordVideo: { dir: args.videoDir } } : undefined);
  if (args.videoDir) {
    videoLifecycle.setSweepDir(args.videoDir);
    // 陈迹清除（codex R2-N2）：目录复用时上一轮 video.json/*.webm 会被编排器误当本次产物接进报告——
    // 起录先清（本次录像文件随 newPage 才出现），拒写/收敛失败的「缺席容忍」才真缺席。
    try { rmSync(join(args.videoDir, 'video.json'), { force: true }); } catch { /* 尽力而为 */ }
    videoLifecycle.sweep();
  }
  let page = await context.newPage();
  let loginPage = null;
  let videoT0 = Date.now(); // 起录时刻 best-effort（M2）：以回放 page 创建时刻为 case 级录屏偏移基准
  // 双 page 舞步（GRILL D1/M6，仅录像+登录同开）：登录跑 page1、其镜头收敛时必删；回放/CDP/取证全在 page2——
  // 登录期键入不入镜（视频是二进制、文本凭据门管不住，卫生只能结构保证）。CDP 尚未接线，登录流量天然不进取证。
  let carrySnapshot = null; // 舞步登录态收割（video-login-carry D1）：仅进程内存，绝不 log/落盘（护栏 #7）
  if (args.videoDir && loginPrep) {
    loginPage = page;
    try {
      requireLoginBootstrapResult(await loginBootstrap(loginPage, loginPrep));
      // 收割：登录归位后一次性取该 origin 的 sessionStorage 全键值快照——页签级登录态不随 page2 继承
      // （Heren 形态 2026-07-06 真机实证）；cookie/localStorage 是 context 级共享，无须收割。
      // 用 entries 数组而非普通对象（codex R2-F4）：键名如 __proto__ 用 obj[k]=v 会被 [[Set]] 吞掉、
      // 不成自有属性 → 「全键值快照」名不副实；[k,v] 对逐条透传，任何字符串键都不丢。
      const capturedCarry = await captureReplaySessionSeed(loginPage);
      if (!capturedCarry.ok) throw new Error(capturedCarry.reason);
      carrySnapshot = capturedCarry.snapshot;
    } catch (e) {
      const failureExit = e instanceof ReplayNavigationAbort
        ? emitExecutionTargetCliFailure({ command: 'replay', failure: e })
        : 65;
      console.error('replay: 登录预备动作失败（fail-closed；错误详情不回显，Playwright 报文可携 SUT 页面片段/凭据路径，护栏 #7——output-seal B5）'); // codex R1-F1
      clearTimeout(watchdog);
      await videoLifecycle.discard(context);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      videoLifecycle.sweep(); // 关后补扫（codex R4-N7）：context 关不上时镜头在 browser.close 期间才终结
      process.exit(failureExit);
    }
    page = await context.newPage();
    videoT0 = Date.now();
  }
  const state = { currentStepId: null };
  const pageErrors = []; // { attributedStepId, message } —— 按发生时活动步归因（finding 4）
  const guardAborts = [];

  let loginMark = 0;
  if (loginPrep && !loginPage) {
    try {
      requireLoginBootstrapResult(await loginBootstrap(page, loginPrep));
      log('login bootstrap done');
    } catch (e) {
      const failureExit = e instanceof ReplayNavigationAbort
        ? emitExecutionTargetCliFailure({ command: 'replay', failure: e })
        : 65;
      console.error('replay: 登录预备动作失败（fail-closed；错误详情不回显，Playwright 报文可携 SUT 页面片段/凭据路径，护栏 #7——output-seal B5）'); // codex R1-F1
      clearTimeout(watchdog);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      process.exit(failureExit);
    }
  } else if (loginPage) {
    try {
      if (carrySnapshot && carrySnapshot.entries.length) {
        const installedCarry = await installReplaySessionSeedBeforeNavigation(page, carrySnapshot);
        if (!installedCarry.ok) throw new Error(installedCarry.reason);
      }
      const warmupNavigation = await navigateExecutionTargetPage({
        page,
        authority: execution.authority,
        targetUrl: loginPrep.startUrl,
        gotoOptions: { waitUntil: 'load' },
      });
      if (!warmupNavigation.ok) {
        throw new ReplayNavigationAbort(warmupNavigation.reason);
      }
      await loginPage.close();
      log('login bootstrap done (video dance)');
    } catch (e) {
      const failureExit = e instanceof ReplayNavigationAbort
        ? emitExecutionTargetCliFailure({ command: 'replay', failure: e })
        : 65;
      console.error('replay: 登录预备动作失败（fail-closed；错误详情不回显，Playwright 报文可携 SUT 页面片段/凭据路径，护栏 #7——output-seal B5）'); // codex R1-F1
      clearTimeout(watchdog);
      await videoLifecycle.discard(context);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      videoLifecycle.sweep(); // 关后补扫（codex R4-N7）
      process.exit(failureExit);
    }
  }

  let seedSnapshot = null;
  if (loginPrep) {
    const capturedSeed = await captureReplaySessionSeed(page);
    if (!capturedSeed.ok) {
      const failure = new Error('SESSION_SEED_CAPTURE_FAILED');
      failure.reason = 'SESSION_SEED_CAPTURE_FAILED';
      throw failure;
    }
    seedSnapshot = capturedSeed.snapshot;
  }
  const {
    forensics,
    attachPageForensics,
  } = createPageForensicsHub({
    context,
    pageErrors,
    options: {
      denylist: profile.background || [],
      successField: profile.successField,
      successValue: profile.successValue,
      currentStep: () => state.currentStepId,
      ...(identityLedger ? {
        identityChannel: {
          ...identityChannelCfg,
          sutOrigin: new URL(sut).origin,
          onRequest: (x) => identityLedger.onRequestWillBeSent(x),
          onTerminal: (x) => identityLedger.onBodyTerminal(x),
        },
      } : {}),
    },
  });
  const topology = await openReplayTopology({
    context,
    initialPage: page,
    seedSnapshot,
    attachForensics: attachPageForensics,
  });
  if (!topology.ok) {
    const failure = new Error('PAGE_TOPOLOGY_UNAVAILABLE');
    failure.reason = topology.reason;
    throw failure;
  }
  ctx.pageTopology = topology.controller;
  const activePage = topology.activePage;
  log('browser+per-page forensics ready');

  const evidence = await runReplayEvents({
    page: activePage,
    execution,
    args,
    events,
    intentEvents,
    reprStepOf,
    profile,
    ctx,
    forensics,
    state,
    guardAborts,
    expectedByIntent,
    globalAssertions,
    countSelector: countSel,
    buttons: buttonsCfg,
    caseId,
    videoStartedAt: videoT0,
    log,
    debug: DBG,
  });
  const { videoOk } = await finalizeReplayArtifacts({
    args,
    context,
    loginPage,
    page,
    sweepVideos: videoLifecycle.sweep,
    caseId,
    records: forensics.records(),
    loginMark,
    intentOrder,
    intentEvents,
    reprStepOf,
    expectedByIntent,
    globalAssertions,
    allStepIds,
    pageErrors,
    guardAborts,
    evidence,
    videoStartedAt: videoT0,
    runStartedAt: T0,
    log,
  });
  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  // 关后补扫（codex R4-N7）：收敛失败（缺席容忍）时，context 关不上而 browser.close 期间才终结的
  // raw 镜头也不许留——缺席必须真缺席；videoOk 成功路径的 video.webm 不在此扫（豁免随 exit 0 到期）。
  if (args.videoDir && !videoOk) videoLifecycle.sweep();
  process.exit(0);
}

main().catch(async (e) => {
  const fatal = classifyReplayFatal(e);
  const exitCode = fatal.executionTarget
    ? emitExecutionTargetCliFailure({ command: 'replay', failure: fatal.failure })
    : fatal.exitCode;
  if (fatal.message) console.error(fatal.message);
  // M5 尽力收口（同看门狗，codex R1-F1）：清扫先行 → 尽力关 → 补扫，4s 兜底强退，退出码语义不变。
  const bail = setTimeout(() => process.exit(1), 4000);
  videoLifecycle.sweep();
  try { if (activeBrowser) await activeBrowser.close(); } catch { /* 尽力而为 */ }
  videoLifecycle.sweep();
  clearTimeout(bail);
  process.exit(exitCode);
});

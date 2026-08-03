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
} from '../lib/entity-semantic-lock-preflight.mjs';
import { admitDestructiveTargetContinuity } from '../lib/entity-destructive-continuity.mjs';
import { parseAgentIdentityProfile } from '../lib/agent-identity-profile.mjs';
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
  // 身份通道剖面（agent-id-readback；与 compile 同律：未声明零行为差、声明则形状非法浏览器前拒）。
  let identityChannelCfg = null;
  let identityProfileDigest = null;
  if (profile && profile.agents !== undefined && profile.agents !== null) {
    const a = profile.agents;
    if (!a || typeof a !== 'object' || Array.isArray(a)) { console.error('replay: 通道剖面 agents 形状非法，浏览器启动前拒绝'); process.exit(65); }
    if (a.listApi !== undefined && a.listApi !== null) {
      const parsed = parseAgentIdentityProfile(a);
      if (!parsed.ok) { console.error(`replay: 通道剖面 agents 身份模式或物理卡片面非法（${parsed.reason}），浏览器启动前拒绝`); process.exit(65); }
      identityChannelCfg = parsed.channel;
      identityProfileDigest = parsed.digest;
    }
  }
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
  const identityAdmission = checkCompileIdentityAdmission({
    caseId,
    eventsBytes: readFileSync(args.events),
    eventsDocument: eventsDoc,
    ...(entityLocksSupplied ? { frozenLockAuthority } : {}),
  });
  if (!identityAdmission.ok) {
    console.error(`replay: frozen identity locks 未过（${identityAdmission.reason}），未启动浏览器；下一步 ${identityAdmission.nextAction}`);
    process.exit(65);
  }
  // v2 冻结锁期望三元组（agent-id-readback plan §5）：v2 件在场时回放闭环到点击前——
  // 缺剖面或通道指纹不符=浏览器前拒（plan §3：换旧剖面无法降级新签用例）。
  const frozenIdentityRows = frozenLockAuthority ? readFrozenIdentityObservations(frozenLockAuthority) : null;
  let identityExpectedByStep = null;
  if (frozenIdentityRows && frozenIdentityRows.length) {
    if (!identityChannelCfg) {
      console.error('replay: v2 冻结锁携身份观察但通道剖面未声明 agents.listApi（剖面只是适配器、不得降级），未启动浏览器');
      process.exit(65);
    }
    const liveDigest = identityProfileDigest;
    let lockDigest = null;
    try { lockDigest = JSON.parse(readFileSync(resolve(PROJECT_ROOT, String(args.entityLocks)), 'utf8')).identityProfileDigest ?? null; } catch { lockDigest = null; }
    if (lockDigest !== liveDigest) {
      console.error('replay: 身份通道指纹与 v2 冻结锁不符（identityProfileDigest 错配），未启动浏览器');
      process.exit(65);
    }
    identityExpectedByStep = new Map();
    for (const row of frozenIdentityRows) {
      identityExpectedByStep.set(row.evidenceStepId, { signedName: row.name, signedCode: row.code, signedPlatformId: row.platformId });
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
  // destructiveContinuityByStep = Map<破坏步 stepId, 已认证 ref>；真机破坏链身份采集补齐才非空（route:human），
  // 当前 hermetic 无采集件即恒空 → 破坏性原子在锁下恒被拒（fail-closed 默认，绝不臆断放行、绝不据锁自报字段放行）。
  const destructiveContinuityByStep = new Map(); // per-step 已认证 ref；route:human 采集补齐前恒空（v1 锁永空）
  const lockKindLabel = (frozenIdentityRows && frozenIdentityRows.length) ? 'v2 身份锁' : 'v1 锁（无身份通道、结构上不可核实目标连续性）';
  if (frozenLockAuthority) {
    const destructiveAdmission = admitDestructiveTargetContinuity({ events, resolvedRefByStep: destructiveContinuityByStep });
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
    // 与上方准入门同一 per-step Map（codex round-2 High per-step）；破坏链身份采集补齐后由已认证持久化件填充，
    // 供出站拦截安装器/归零按破坏步真解析 ref。route:human 采集前恒空——空即上方 admission 已在浏览器前拒破坏步，
    // 出站拦截路径对破坏步不可达；proceed（有合法 ref 放行破坏动作）路径待真机破坏链采集激活（route:human），
    // 当前生产不可达（诚实挂账，非「非 always-refuse」宣称——codex round-2 Medium 收口）。
    destructiveContinuityByStep,
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

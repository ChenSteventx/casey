#!/usr/bin/env node
// bin/replay.mjs —— 确定性回放器（相3）。真回放 SUT（被测系统）→ 产三轴 axes.json → 喂已冻 verdict.mjs。
// 冻结 CLI：node bin/replay.mjs --events <f> --sut <baseUrl> --expected <f> --profile <f> --out <axes.json> [--entity-locks <f>] [--login-bootstrap]
// --entity-locks 仅固定 atom+action 的纯只读 events 可省；任一 mutation/未知项仍在浏览器前 fail-closed。
//   [--run-history <f>] [--run-metrics <f>] [--run-id <id>]（opt-in 回放历史/回放指标真产出，缺省行为一字不变）：
//   纯观察者逐 event 收集（零新增等待、零改动作时序——动了取证归因窗即污染护栏 #15），与 axes 同刻经
//   凭据兜底门一次写出；仅诊断证据，绝不进 verdict.mjs、绝不写 passes（口径见 docs/plans/run-history/proposed/GRILL.md）。
//   --profile = 通道剖面（非凭据）：{ background:[denylist], successField, successValue }。
//   --login-bootstrap（opt-in，缺省行为一字不变）：回放前执行登录预备动作（CONTEXT.md 术语）——
//     不产 event、不进 axes、凭据只进内存（护栏 #7）；前置加载/登录失败 exit 65 不落 axes（护栏 #14）。
//   --video-dir <dir>（opt-in，缺省行为一字不变，replay-video GRILL M3）：context 级录屏——正常收敛后
//     恰余一份 <dir>/video.webm + 元数据旁件 <dir>/video.json（{schemaVersion:1,file,startedAt,steps:[{stepId,videoAt}]}）；
//     与 --login-bootstrap 同开时登录跑独立 page、其镜头收敛必删（登录期不入镜，护栏 #7）；
//     收敛失败按缺席容忍（fail-safe：视频永远只是诊断附件，绝不进 verdict，M5/M7）。
// 裁判零 LLM（护栏 #15）：本进程只产三轴事实，绝不裁定、绝不问 LLM、绝不写 verdict/passes。
// 取证按【动作作用域 + 发起方】归因（护栏 #15，非时间窗）：currentStepId 仅在该步动作执行+静默期开放，
//   预导航/上下文恢复期一律 null；证不出归 null（fail-safe，护栏 #14）。
import { readFileSync, writeFileSync, writeSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import pw from '@playwright/test';
import { performAction } from '../lib/replay-actions.mjs';
import { instantiate } from '../lib/instantiate.mjs';
import { watchNetworkForensics } from '../lib/replay-forensics.mjs';
import { settleBeforeCapture } from '../lib/replay-settle.mjs';
import { evaluateAssertions, inputReadbackFromAction } from '../lib/replay-assert.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { credentialGate, maskCredentialRoute } from '../lib/cred-gate.mjs';
import { assertSignedContract } from '../lib/sign-gate.mjs';
import { foldIntentAction } from '../lib/intent-action-fold.mjs';
import { validateWorkflowDeleteBindings } from '../lib/workflow-delete-spec.mjs';
import { projectReplayAssertion, validateReplayEntityAnchors } from '../lib/replay-entity-anchor.mjs';
import {
  checkReplayEntityAdmission as checkCompileIdentityAdmission,
  readIdentityAdmissionAuthorityFromPrd,
  checkCredentialAudienceGate,
} from '../lib/entity-semantic-lock-preflight.mjs';
import { PROJECT_ROOT } from '../lib/paths.mjs';

const { chromium } = pw;

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--events') o.events = argv[++i];
    else if (a === '--sut') o.sut = argv[++i];
    else if (a === '--expected') o.expected = argv[++i];
    else if (a === '--profile') o.profile = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--entity-locks') o.entityLocks = argv[++i];
    else if (a === '--login-bootstrap') o.loginBootstrap = true;
    else if (a === '--run-history') o.runHistory = argv[++i];
    else if (a === '--run-metrics') o.runMetrics = argv[++i];
    else if (a === '--run-id') o.runId = argv[++i];
    else if (a === '--video-dir') o.videoDir = argv[++i];
    else if (a === '--unique-name') o.uniqueName = argv[++i];
    // regress-promptset：--prompt-text 注入 ctx.promptText（回填冻结 flow 的 {{promptText}} 提示槽）；
    // --soft-expect 非签署软期望通道（强制 soft:true 并入按 intent 断言表，绝不进裁定、不过 sign-gate）。
    else if (a === '--prompt-text') o.promptText = argv[++i];
    else if (a === '--soft-expect') o.softExpect = argv[++i];
  }
  return o;
}

// 文件参数只选择 PRD 已冻结的 artifact key；文件内容本身不携带回放权限。
function projectArtifactKey(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const rel = relative(PROJECT_ROOT, resolve(input));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

// ── 录像基座（replay-video GRILL D1/M3–M5）─────────────────────
// fail-closed 退出路径的录像清扫：不许把镜头残件（尤其登录期键入）留在盘上（护栏 #7）。
// 正常成功路径收敛后 videoSweepDir 置 null，语义名 video.webm 不受清扫。
let activeBrowser = null;
let videoSweepDir = null;
function sweepVideos() {
  if (!videoSweepDir) return;
  try {
    for (const f of readdirSync(videoSweepDir)) if (f.endsWith('.webm')) rmSync(join(videoSweepDir, f));
  } catch { /* 尽力而为 */ }
}
// 舞步失败退出前清扫（codex R1-F1 采信：清扫不依赖 close 成败）：先清扫（unlink 不需要浏览器配合，
// Linux 下写入中的文件同样即刻离目录）、再限时关 context、关后补扫（close 期间新终结的残件）。
async function discardVideos(context) {
  sweepVideos();
  try { await Promise.race([context.close(), new Promise((r) => setTimeout(r, 5000))]); } catch { /* 尽力而为 */ }
  sweepVideos();
}

// ── 回放历史逐行构造（G2/G3/G4 口径见 docs/plans/run-history/proposed/GRILL.md）────
// 纯翻译既有机制事实：locatorResolution 冻结枚举缝合（内部值 action_failed→unique，失败归 result=actionError）；
// valueRef 值侧打码（全串恰为单占位符才透传，否则脱敏标记，护栏 #7）；quietPointReached=该步前置稳定程序达成。
const RH_PLACEHOLDER = /^\{\{[A-Za-z0-9_.-]+\}\}$/;
const RH_INTERACTIVE = new Set(['click', 'dblclick', 'fill', 'selectOption', 'dragTo']); // dragTo 源有定位 → 交互支（wf-add-node）
const RH_ACTIONS = new Set(['click', 'dblclick', 'fill', 'selectOption', 'press', 'nav', 'newpage', 'dragTo']);
const RH_LR_ENUM = new Set(['unique', 'none', 'ambiguous', 'fallback_first', 'coord_fallback']); // 冻结枚举透传（codex R1-F2）
function historyLine(ev, { navOk, navErr, axis, durationMs, caseId, isLast, settled }) {
  if (!RH_ACTIONS.has(ev.action)) return null; // 冻结枚举外（如纯断言步）不落行
  let locatorResolution = null;
  let result;
  if (ev.action === 'nav') {
    result = navOk ? 'ok' : (/timeout/i.test(String((navErr && (navErr.name || navErr.message)) || '')) ? 'timeout' : 'actionError');
  } else {
    const res = (axis && axis.resolution) || 'none';
    // G2 字面提硬（codex R1-F1）：unique 且回读明确 false → actionError（现机制 unique 恒回读 ok，防御映射）。
    const readbackFailed = !!(axis && axis.identityReadback && axis.identityReadback.ok === false);
    result = res === 'unique' ? (readbackFailed ? 'actionError' : 'ok') : res === 'action_failed' ? 'actionError' : 'locatorError';
    if (RH_INTERACTIVE.has(ev.action)) {
      locatorResolution = res === 'action_failed' ? 'unique' : RH_LR_ENUM.has(res) ? res : 'none';
    }
  }
  let valueRef = null;
  if (ev.action === 'fill') valueRef = ev.value == null ? null : (RH_PLACEHOLDER.test(ev.value) ? ev.value : '<redacted:fill>');
  else if (ev.action === 'press') valueRef = ev.key ? '<redacted:key>' : null;
  else if (ev.action === 'selectOption') valueRef = ev.dropdownUnit && ev.dropdownUnit.optionText ? '<redacted:option>' : null;
  const s = ev.semantic || {};
  const role = s.role || ev.role || (ev.action === 'selectOption' ? 'combobox' : null);
  const accessibleName = s.name || ev.accessibleName || ev.fieldLabel || (ev.dropdownUnit && ev.dropdownUnit.fieldLabel) || ev.text || null;
  const locator = role || accessibleName ? { ...(role ? { role } : {}), ...(accessibleName ? { accessibleName } : {}), semantic: null } : null;
  const parameters = locator || valueRef ? { ...(locator ? { locator } : {}), valueRef } : null;
  return {
    timestamp: new Date().toISOString(),
    caseId,
    stepId: ev.stepId,
    intentId: ev.intentId,
    atom: ev.atom ?? null,
    action: ev.action,
    parameters,
    locatorResolution,
    // 代表步（isLast）接静默点结果（replay-settle-mount）：navOk && settled——静默点超时仍记 false
    //   （schema「false=证据可复现性存疑」口径一致）；非代表步维持既有 !!navOk 口径。值域仍 boolean。
    quietPointReached: isLast ? (!!navOk && !!settled) : !!navOk,
    durationMs,
    result,
  };
}

const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };

// 气泡文本稳定等待（chiefcomplaint-smoke D2/D5，regress 实测「网络流结束 ≠ UI 渲染完成」）：
// 选择器 last() 的 innerText 连续 stableMs 不变即稳；budgetMs 上界兜底，取不到回 null（证不出，不背书）。
async function waitReplyStable(page, selector, { stableMs = 2000, budgetMs = 10000 } = {}) {
  const t0 = Date.now();
  let prev = null;
  let since = Date.now();
  while (Date.now() - t0 < budgetMs) {
    let cur = null;
    try {
      const loc = page.locator(selector).last();
      cur = (await loc.count()) ? await loc.innerText({ timeout: 500 }) : null;
    } catch { cur = null; }
    if (cur !== prev) { prev = cur; since = Date.now(); }
    else if (cur != null && Date.now() - since >= stableMs) return cur;
    await new Promise((r) => setTimeout(r, 250));
  }
  return prev;
}

// 行计数：失败回 null（未知），绝不回 0——避免 countChange equals 0 把「证不出」洗成假绿（finding 7）。
// 选择器可经 profile.countSelector 换通道（wf-add-node GRILL D4 (a)：画布用例配 .lf-node），缺省零行为差。
async function rowCount(page, selector = '.hr-table-row') {
  try { return await page.locator(selector).count(); } catch { return null; }
}

// 读失败消毒（output-seal 追加缝：AUDIT 未列 events/expected/profile 的裸 JSON.parse，坏 JSON 原流进
// 兜底 catch 打栈携内容片段——照 sign/draft/compile 同款消毒，只报「不是合法 JSON/不可读」，内容不回显）。
function readJsonSafe(f, label) {
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch { console.error(`replay: 读/解析 ${label} 失败（${f}；不是合法 JSON 或不可读，内容不回显）`); process.exit(65); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
    sweepVideos();
    try { if (activeBrowser) await activeBrowser.close(); } catch { /* 尽力而为 */ }
    sweepVideos();
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
  const frozenArtifactKey = entityLocksSupplied ? projectArtifactKey(args.entityLocks) : null;
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
  const sut = String(args.sut).replace(/\/$/, '');
  // 确定性令牌（可 golden）；真机由 compile-gate 注入带 Reserved Prefix 的实体名。
  // baseUrl：G6 分岔三取 C——events url 走 {{baseUrl}} 占位符，回放期回填 --sut（对完整 URL 的旧 fixture 是 no-op）。
  // promptText（regress-promptset）：被测参数经 --prompt-text 注入，回填 fill 步的 {{promptText}} 提示槽（护栏 #6
  // 冻占位符不冻字面量）；RH_PLACEHOLDER 已覆盖 {{promptText}}——回放历史始终显占位符、绝不落真被测参数（护栏 #7）。
  const ctx = { uniqueName, baseUrl: sut, ...(args.promptText != null ? { promptText: String(args.promptText) } : {}) };

  // 登录预备动作前置（GRILL 人签取 A）：凭据/站点配置在开浏览器前加载，任一失败 exit 65（fail-closed）。
  // 登录入口 = --sut 基址 + site.target.startUrl 路径段（真机实采教训：裸基址不渲染登录表单，SPA 判据
  // 会 fail-open 误判已登录）；无 startUrl 退 events 信封 url 路径段，再退 '/'。凭据只进内存，绝不入日志。
  let loginPrep = null;
  if (args.loginBootstrap) {
    try {
      const site = loadSiteConfig(undefined, { strict: true }); // 坏 site.json 抛错 fail-closed（codex R1-F2）
      const creds = loadCreds();
      let entryPath = null;
      try { entryPath = new URL(site.target.startUrl).pathname; } catch { /* 无 startUrl：走信封 url 兜底 */ }
      if (!entryPath && typeof eventsDoc.url === 'string' && eventsDoc.url) entryPath = pathOf(instantiate(eventsDoc.url, ctx));
      loginPrep = { site, creds, startUrl: sut + (entryPath || '/') };
    } catch (e) {
      // process.exit() does not wait for an asynchronous stderr pipe to flush.
      // This pre-launch rejection is consumed by deterministic callers, so emit
      // the fixed, credential-free line synchronously before the terminal exit.
      writeSync(2, 'replay: 登录预备动作前置失败（fail-closed；凭据/站点配置详情不回显，护栏 #7——output-seal B5）\n'); // e.message 可携 AT_CREDS_FILE 路径
      process.exit(65);
    }
  }

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
  const browser = await chromium.launch({ headless: true });
  activeBrowser = browser;
  // 录像 opt-in（M3）：recordVideo 是 context 级选项；缺省不带旗标时 newContext 无参、行为一字不变。
  const context = await browser.newContext(args.videoDir ? { recordVideo: { dir: args.videoDir } } : undefined);
  if (args.videoDir) {
    videoSweepDir = args.videoDir;
    // 陈迹清除（codex R2-N2）：目录复用时上一轮 video.json/*.webm 会被编排器误当本次产物接进报告——
    // 起录先清（本次录像文件随 newPage 才出现），拒写/收敛失败的「缺席容忍」才真缺席。
    try { rmSync(join(args.videoDir, 'video.json'), { force: true }); } catch { /* 尽力而为 */ }
    sweepVideos();
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
      await loginBootstrap(loginPage, loginPrep);
      // 收割：登录归位后一次性取该 origin 的 sessionStorage 全键值快照——页签级登录态不随 page2 继承
      // （Heren 形态 2026-07-06 真机实证）；cookie/localStorage 是 context 级共享，无须收割。
      // 用 entries 数组而非普通对象（codex R2-F4）：键名如 __proto__ 用 obj[k]=v 会被 [[Set]] 吞掉、
      // 不成自有属性 → 「全键值快照」名不副实；[k,v] 对逐条透传，任何字符串键都不丢。
      carrySnapshot = await loginPage.evaluate(() => {
        const entries = [];
        for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); entries.push([k, sessionStorage.getItem(k)]); }
        return { origin: location.origin, entries };
      });
    } catch (e) {
      console.error('replay: 登录预备动作失败（fail-closed；错误详情不回显，Playwright 报文可携 SUT 页面片段/凭据路径，护栏 #7——output-seal B5）'); // codex R1-F1
      clearTimeout(watchdog);
      await discardVideos(context);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      sweepVideos(); // 关后补扫（codex R4-N7）：context 关不上时镜头在 browser.close 期间才终结
      process.exit(65);
    }
    page = await context.newPage();
    videoT0 = Date.now();
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  log('browser+cdp ready');

  const state = { currentStepId: null };
  const pageErrors = []; // { attributedStepId, message } —— 按发生时活动步归因（finding 4）
  page.on('pageerror', (e) => { pageErrors.push({ attributedStepId: state.currentStepId, message: String((e && e.message) || e).slice(0, 200) }); });
  const forensics = watchNetworkForensics(cdp, {
    denylist: profile.background || [],
    successField: profile.successField,
    successValue: profile.successValue,
    currentStep: () => state.currentStepId,
  });

  // 登录预备动作执行（无录像的单 page 路径，原样）：forensics 已接线、事件循环未开——此刻 currentStepId=null，
  // 登录期流量一律归 null 不背书（护栏 #14/#15）；不产 event、不进 axes（axes 步只源于 events）。失败关浏览器 exit 65。
  let loginMark = 0; // 登录期取证记录数（login-traffic-drop）：投影只取其后，登录期流量整体不进 axes
  if (loginPrep && !loginPage) {
    try {
      await loginBootstrap(page, loginPrep);
      loginMark = forensics.records().length;
      log('login bootstrap done');
    } catch (e) {
      console.error('replay: 登录预备动作失败（fail-closed；错误详情不回显，Playwright 报文可携 SUT 页面片段/凭据路径，护栏 #7——output-seal B5）'); // codex R1-F1
      clearTimeout(watchdog);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      process.exit(65);
    }
  } else if (loginPage) {
    // 舞步后半：回放 page 预热到登录后入口（同 context 共享会话）再关登录 page；预热流量同属登录期、
    // 整体切断（login-traffic-drop 与单 page 路径语义对齐）。失败清扫镜头残件 exit 65。
    try {
      // 注入（video-login-carry D1）：首次 goto 前挂 init script，location.origin 恒等才种入——
      // 每次导航自动重种、SPA 同 origin 覆盖；异 origin 不种，快照不外溢。空快照不挂（cookie 会话零行为差）。
      if (carrySnapshot && carrySnapshot.entries.length) {
        await page.addInitScript(({ origin, entries }) => {
          if (location.origin !== origin) return;
          for (const [k, v] of entries) sessionStorage.setItem(k, v);
        }, carrySnapshot);
      }
      await page.goto(loginPrep.startUrl, { waitUntil: 'load' });
      await loginPage.close();
      loginMark = forensics.records().length;
      log('login bootstrap done (video dance)');
    } catch (e) {
      console.error('replay: 登录预备动作失败（fail-closed；错误详情不回显，Playwright 报文可携 SUT 页面片段/凭据路径，护栏 #7——output-seal B5）'); // codex R1-F1
      clearTimeout(watchdog);
      await discardVideos(context);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      sweepVideos(); // 关后补扫（codex R4-N7）
      process.exit(65);
    }
  }

  const actionByStep = new Map();
  const intentUrl = new Map();
  const intentCount = new Map();
  const intentToasts = new Map();   // kinds-harden：代表步静默点 toast 快照
  const intentTextHits = new Map(); // kinds-harden：代表步 textVisible 命中计数
  const intentButtonHits = new Map(); // wf-publish-states：代表步 buttonState 命中合计（role + 可选补采，可见口径）
  const intentButtonSeen = new Map(); // wf-publish-states：代表步全通道可见按钮总数（absent 活性反证，codex R1-F1）
  const intentButtonDisabledHits = new Map(); // btn-enable-ops：代表步命中且判禁用计数（enabled/disabled 判据采集）
  const intentInputReadback = new Map(); // regress-wf-node-script：代表事件同一物理字段的精确动作回读

  // 回放历史 opt-in（run-history）：纯观察者收集，不加任何等待、不改任何时序。
  const rhOn = !!(args.runHistory || args.runMetrics);
  const rhLines = [];
  let rhQuietWait = 0;
  const vSteps = []; // 录像逐事件步偏移（M2 case 级单录屏）：video.json steps，纯观察者零时序影响

  // chat 通道配置（chiefcomplaint-smoke D5，通道剖面非凭据段，可整段缺省）：
  // replySelector 缺省跟随通道既定气泡类；streamUrlPattern 供 streamReplyReceived 谓词普化。
  const chatCfg = profile.chat && typeof profile.chat === 'object' ? profile.chat : null;
  const replySelector = (chatCfg && chatCfg.replySelector) || '.hr-chat__text__assistant';
  const intentReply = new Map();     // 代表步静默点实采 reply 正文（气泡 DOM 通道）
  const intentReplyBase = new Map(); // intent 首步气泡基线（codex R1-F3：陈迹不当新回复）

  try {
    for (const ev of events) {
      const isFirst = intentEvents.get(ev.intentId)[0].stepId === ev.stepId;
      const isLast = reprStepOf.get(ev.intentId) === ev.stepId;
      log('event ' + ev.stepId + ' ' + ev.action + ' intent=' + ev.intentId);

      // 预导航/上下文恢复期：归因关闭（currentStepId=null），此期请求不系任何步（护栏 #15）。
      state.currentStepId = null;
      const evT0 = Date.now();
      let reprSettled = false; // 代表步静默点结果（replay-settle-mount）：喂 historyLine 的 quietPointReached
      if (args.videoDir) vSteps.push({ stepId: ev.stepId, videoAt: Math.max(0, evT0 - videoT0) });
      let navOk = true;
      let navErr = null;
      try {
        if (ev.action === 'nav') {
          state.currentStepId = ev.stepId; // nav 本身就是动作，开放归因
          // 旧只读信封可缺 url 以通过无锁迁移门，但缺目标绝不能拼成 `/undefined`
          // 触碰 SUT；按动作失败收口。带 url 的无锁 read 已在 identity admission 钉住固定路径。
          if (typeof ev.url !== 'string' || !ev.url) throw new TypeError('nav event 缺 compiler-authored url');
          await page.goto(sut + pathOf(instantiate(ev.url, ctx)), { waitUntil: 'load' });
        } else {
          const want = ev.pre && ev.pre.path;
          if (want && pathOf(page.url()) !== want) {
            const restoreT = Date.now();
            try { await page.goto(sut + want, { waitUntil: 'load' }); } finally { rhQuietWait += Date.now() - restoreT; }
          }
        }
      } catch (e) { navOk = false; navErr = e; }

      if (isFirst) intentCount.set(ev.intentId, { before: await rowCount(page, countSel), after: null });

      // reply 陈迹基线（codex R1-F3）：intent 首步记气泡数与末泡文本；基线证不出则本 intent 不回填（fail-safe）。
      if (isFirst && chatCfg) {
        let base = null;
        try {
          const loc = page.locator(replySelector);
          const n = await loc.count();
          base = { n, text: n ? await loc.last().innerText({ timeout: 500 }) : null };
        } catch { base = null; }
        intentReplyBase.set(ev.intentId, base);
      }

      if (ev.action === 'nav') {
        // nav 动作轴按 goto 实际成败（不再恒 unique，finding 3）。
        actionByStep.set(ev.stepId, navOk ? { resolution: 'unique', identityReadback: { ok: true } } : { resolution: 'action_failed', identityReadback: { ok: false } });
        state.currentStepId = null;
      } else {
        // 动作作用域：归因开放，覆盖动作 + 静默期（save/stream 异步在此窗回来）。
        state.currentStepId = ev.stepId;
        const respWait = ev.action === 'click'
          ? page.waitForResponse((r) => /saveOrModifyProcessData|streamReply/.test(r.url()), { timeout: 600 }).catch(() => null)
          : Promise.resolve(null);
        const axis = await performAction(page, ev, ctx);
        actionByStep.set(ev.stepId, axis || { resolution: 'none' });
        const settleT = Date.now();
        await respWait;
        // 给动作的直接异步后果（如 save 响应后随即开的 SSE 流）一点点出现窗，仍归本步——
        // 这是动作的因果作用域（save→stream），非任意时间窗；背景轮询仍由 denylist 归 null。
        if (ev.action === 'click') { await new Promise((r) => setTimeout(r, 150)); }
        // 动态流等待（chiefcomplaint-smoke D2，Steven 拍板；codex R1-F2 + R2 两轮收紧）：
        // 只等「本步 firingStepId 发起 且 命中 chat 流 URL 域」的 EventSource 走到 finished（或 30s 上界）
        // ——流是本步动作的直接后果，归因窗随延（因果作用域，非任意时间窗）；背景/他步长流、本步开的
        // 非对话长流（如面板附带 SSE）都绝不拖本步。配置了 streamUrlPattern 才有域可判；未配置时按
        // 本步发起判（与 compile 侧对称）。无本步流零行为差（p5/catalog 回归锁背书）。
        const streamInScope = (u) => !(chatCfg && chatCfg.streamUrlPattern) || String(u).includes(chatCfg.streamUrlPattern);
        const myStreams = () => forensics.records().filter((r) => r.type === 'EventSource' && r.firingStepId === ev.stepId && streamInScope(r.url));
        if (myStreams().length > 0) {
          log('  step stream open, waiting finished ' + ev.stepId);
          const swT = Date.now();
          while (Date.now() - swT < 30000 && !myStreams().every((r) => r.streamFinished === true)) {
            await new Promise((r) => setTimeout(r, 200));
          }
          // 网络流结束 ≠ UI 渲染完成（regress 实测）：配置了 chat 通道再等气泡文本 2s 稳定（上界 10s）。
          if (chatCfg) await waitReplyStable(page, replySelector);
        }
        rhQuietWait += Date.now() - settleT;
        log('  acted ' + ev.stepId + ' resolution=' + (axis && axis.resolution));
        state.currentStepId = null; // 动作作用域结束，关闭归因
      }

      if (isLast) {
        // 代表步采集前的有界静默点（replay-settle-mount）：镜像编译侧 quietPoint，让 SPA 路由挂载 /
        //   「页面加载中」占位消失后再采断言输入（intentUrl/intentCount/toast/textHits/buttonHits/buttonSeen/
        //   reply 同刻性保留）。纯观察者、有界、fail-safe：helper 自身故障照现状采、不吞步；归因此刻已关
        //   （currentStepId=null），归因语义零动。等待计入 rhQuietWait（诚实记账，不进裁定）。
        //   下限/预算读 REPLAY_SETTLE_FLOOR_MS/REPLAY_SETTLE_BUDGET_MS（仅测试缝，REPLAY_WATCHDOG_MS 先例，缺省 250/2500）。
        const settleFloor = Number(process.env.REPLAY_SETTLE_FLOOR_MS);
        const settleBudget = Number(process.env.REPLAY_SETTLE_BUDGET_MS);
        const settleT = Date.now();
        try {
          const sr = await settleBeforeCapture(page, {
            inFlight: () => forensics.inFlightCount(),
            floorMs: Number.isFinite(settleFloor) && settleFloor >= 0 ? settleFloor : undefined,
            budgetMs: Number.isFinite(settleBudget) && settleBudget > 0 ? settleBudget : undefined,
            log,
          });
          reprSettled = sr.settled;
          if (DBG) log('settle intent=' + ev.intentId + ' waited=' + sr.waitedMs + ' settled=' + sr.settled);
        } catch (e) { log('settle helper error (fail-safe, capture as-is): ' + String((e && e.message) || e)); }
        rhQuietWait += Date.now() - settleT;

        intentUrl.set(ev.intentId, pathOf(page.url()));
        // inputReadback 不另查 DOM：只投影刚执行的代表事件动作轴。动作门未给出 unique + ok:true +
        // string actual 时存 undefined，断言评估据此 fail-safe 证不出。
        intentInputReadback.set(ev.intentId, inputReadbackFromAction(actionByStep.get(ev.stepId)));
        const c = intentCount.get(ev.intentId);
        if (c) c.after = await rowCount(page, countSel);
        // kinds-harden（G3）：代表步静默点现场采——事后卷回评估只吃此刻事实（同 intentUrl/intentCount 范式）。
        // toast 快照选择器逐字复刻 lib/compile-atoms.mjs 观测采集（编译期作者与回放期消费者同构）。
        const toasts = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('.hr-toast,.hr-message,[role="status"],[role="alert"]')) {
            const t = (el.textContent || '').trim();
            if (t) out.push(t);
          }
          return [...new Set(out)];
        }).catch(() => []);
        intentToasts.set(ev.intentId, toasts);
        // 本 intent textVisible/textHidden 断言值命中计数：正文 getByText + toast 文本双通道（toast 短暂，双保）。
        // textHidden 复用同通道（chiefcomplaint-smoke D4：缺席断言 = 命中数为 0 才过）。
        const hits = {};
        for (const a of [...(expectedByIntent.get(ev.intentId) || []), ...globalAssertions]) {
          if ((a.kind !== 'textVisible' && a.kind !== 'textHidden') || typeof a.value !== 'string') continue;
          const inPage = await page.getByText(a.value).count().catch(() => 0);
          const inToast = toasts.filter((t) => t.includes(a.value)).length;
          hits[a.value] = inPage + (inPage === 0 ? inToast : 0);
        }
        intentTextHits.set(ev.intentId, hits);
        // 本 intent buttonState 断言值命中合计（wf-publish-states D2）：role=button exact 必采 +
        // profile.buttons.extraSelector 可选补采。任一通道采集失败 = 该值缺采集（不落 0）→ 评估证不出。
        // codex R1 两 High 收紧：F2 补采只数可见节点（隐藏模板不计）；F1 同刻加采通道总活性
        // buttonSeen（全通道可见按钮总数）——absent 判真的反证前提，盲区页 seen=0 → 证不出。
        const btnVals = [...new Set([...(expectedByIntent.get(ev.intentId) || []), ...globalAssertions]
          .filter((a) => a.kind === 'buttonState' && typeof a.value === 'string').map((a) => a.value))];
        if (btnVals.length) {
          const visibleCount = (els, name) => els.filter((el) =>
            (name == null || (el.textContent || '').trim() === name) &&
            el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden').length;
          let roleTotal = null;
          try { roleTotal = await page.getByRole('button').count(); } catch { roleTotal = null; }
          let extraTotal = 0;
          if (buttonsCfg) {
            try { extraTotal = await page.locator(buttonsCfg.extraSelector).evaluateAll(visibleCount, null); } catch { extraTotal = null; }
          }
          // 禁用态计数谓词（btn-enable-ops D1/D2）：disabled 属性 ∨ aria-disabled="true" ∨ 可选类名补判；
          // vis=true 时叠可见性过滤（补采通道口径同 buttonHits），role 通道自身角色树已滤隐藏不再叠。
          const disabledCount = (els, o) => els.filter((el) => {
            if (o.name != null && (el.textContent || '').trim() !== o.name) return false;
            if (o.vis && !(el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')) return false;
            return el.disabled === true || el.getAttribute('aria-disabled') === 'true' || (o.cls ? el.classList.contains(o.cls) : false);
          }).length;
          const cls = buttonsCfg ? buttonsCfg.disabledClass : null;
          const btnHits = {};
          const btnDisabledHits = {};
          for (const value of btnVals) {
            let roleN = null;
            let roleDisN = null;
            try { roleN = await page.getByRole('button', { name: value, exact: true }).count(); } catch { roleN = null; }
            try { roleDisN = await page.getByRole('button', { name: value, exact: true }).evaluateAll(disabledCount, { name: null, vis: false, cls }); } catch { roleDisN = null; }
            let extraN = 0;
            let extraDisN = 0;
            if (buttonsCfg) {
              try { extraN = await page.locator(buttonsCfg.extraSelector).evaluateAll(visibleCount, value); } catch { extraN = null; }
              try { extraDisN = await page.locator(buttonsCfg.extraSelector).evaluateAll(disabledCount, { name: value, vis: true, cls }); } catch { extraDisN = null; }
            }
            if (roleN == null || extraN == null) continue;
            btnHits[value] = roleN + extraN;
            // 禁用态双通道任一失败 = 该值缺禁用态采集（不落 0）→ enabled/disabled 评估证不出（镜像 buttonHits 纪律）。
            if (roleDisN != null && extraDisN != null) btnDisabledHits[value] = roleDisN + extraDisN;
          }
          intentButtonHits.set(ev.intentId, btnHits);
          intentButtonDisabledHits.set(ev.intentId, btnDisabledHits);
          if (roleTotal != null && extraTotal != null) intentButtonSeen.set(ev.intentId, roleTotal + extraTotal);
        }
        // reply 正文采集（chiefcomplaint-smoke D5：DOM 气泡通道，代表步静默点实采；未配置 chat 段不采。
        // codex R1-F3：对照 intent 首步基线，仅「新气泡出现或末泡文本变化」才回填——陈迹绝不当新回复）。
        if (chatCfg) {
          let rt;
          const base = intentReplyBase.get(ev.intentId);
          try {
            const loc = page.locator(replySelector);
            const n = await loc.count();
            const text = n ? await loc.last().innerText({ timeout: 1000 }) : null;
            rt = base != null && text != null && (n > base.n || text !== base.text) ? text : undefined;
          } catch { rt = undefined; }
          intentReply.set(ev.intentId, rt);
        }
      }

      if (rhOn) {
        const line = historyLine(ev, { navOk, navErr, axis: ev.action === 'nav' ? null : actionByStep.get(ev.stepId), durationMs: Date.now() - evT0, caseId, isLast, settled: reprSettled });
        if (line) rhLines.push(line);
      }
    }
  } finally {
    log('loop done, settling streams + draining');
    await forensics.awaitStreamsSettled(2500);
    await forensics.drain();
    log('drained');
  }

  // 录像收敛（GRILL D1/M4/M5）：视频只在 context 关闭后保证落盘——先显式关 context；登录页镜头必删
  // （删除失败重试一次仍败 = 凭据卫生 fail-closed 非零退出，卫生优先于回放结果）；回放页镜头收敛语义名
  // video.webm。收敛失败按缺席容忍：videoOk=false → 不写 video.json、报告无附件，回放结果与裁定零影响。
  let videoOk = false;
  if (args.videoDir) {
    const loginVideo = loginPage ? loginPage.video() : null;
    const replayVideo = page.video();
    try { await context.close(); } catch { /* 缺席容忍 */ }
    if (loginVideo) {
      let deleted = false;
      for (let i = 0; i < 2 && !deleted; i++) {
        try { await loginVideo.delete(); deleted = true; } catch { /* 重试一次 */ }
      }
      if (!deleted) {
        console.error('replay: 登录页录像删除失败（凭据卫生 fail-closed，护栏 #7）');
        clearTimeout(watchdog);
        sweepVideos();
        await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
        sweepVideos(); // 关后补扫（codex R4-N7）：登录镜头若在 browser.close 才终结也不许留
        process.exit(1);
      }
    }
    try {
      const raw = replayVideo ? await replayVideo.path() : null;
      if (raw) { renameSync(raw, join(args.videoDir, 'video.webm')); videoOk = true; }
    } catch { videoOk = false; }
    if (!videoOk) sweepVideos(); // 收敛失败清掉残件：缺席容忍 = 干净缺席
    // 刻意不在此解除清扫（codex R3-N6）：下游凭据门任一 fail-closed 退出都不得遗留已收敛录像——
    // 清扫豁免只随成功 exit 0 自然到期（正常路径此后无人再调 sweep）。
  }

  // 登录期流量整体不进 axes（login-traffic-drop，CONTEXT「登录预备动作…不进 axes」字面兑现）：
  // 真机实证凭据可走 query（doLogin），归因 null 不够——记录本体切断（步过滤本按 firingStepId，
  // 唯一入径是孤儿并入）。无登录旗标 loginMark=0 零行为差。
  const allRecords = forensics.records().slice(loginMark);
  // 归因到本步的记录归一到 intent 代表步（verdict 按 ===StepAxes.stepId 背书，须对齐，finding 5）；其余归 null。
  // url 投影两道卫生（cred-route-mask + login-traffic-drop G3）：剥 host 只留 pathname+search
  // （目标地址只活在 site.json、绝不进任何输出——真机基址字面撞门实证；query 保留仍受门拦）+
  // 凭据路由名打码。报告装配下游同源受益。
  // blob: 等非 http(s)/ws(s) scheme 的 pathname 内嵌完整 origin（codex 实证 blob:http://host/uuid）——
  // 一律脱敏占位；解析不了且非 / 开头同罪（:// 零容忍，宁失细节不漏 host）。
  const toPathQuery = (u) => {
    const s = String(u);
    try {
      const x = new URL(s);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(x.protocol)) return '<redacted:non-http-url>';
      const out = x.pathname + x.search;
      // 代理型路径可自嵌完整 URL（/proxy/http://host/x）——:// 零容忍到输出侧（codex R2 纵深）。
      return out.includes('://') ? '<redacted:non-http-url>' : out;
    } catch {
      // //host/x 协议相对引用也走私 host（codex R2）：仅放行单斜杠起始的纯路径。
      return s.startsWith('/') && !s.startsWith('//') && !s.includes('://') ? s : '<redacted:non-http-url>';
    }
  };
  const projUrl = (u) => maskCredentialRoute(toPathQuery(u));
  const projectNet = (r, reprStepId) => ({
    url: projUrl(r.url), status: r.status, ts: r.ts, initiator: r.initiator,
    attributedStepId: r.attributedStepId != null ? reprStepId : null,
    errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus,
  });

  const steps = intentOrder.map((iid) => {
    const es = intentEvents.get(iid);
    const reprStepId = reprStepOf.get(iid);
    const eventActions = es.map((e) => ({ stepId: e.stepId, action: actionByStep.get(e.stepId) || { resolution: 'none' } }));
    const stepIds = new Set(es.map((e) => e.stepId));
    const net = allRecords.filter((r) => r.firingStepId != null && stepIds.has(r.firingStepId)).map((r) => projectNet(r, reprStepId));
    const pe = pageErrors.filter((p) => p.attributedStepId != null && stepIds.has(p.attributedStepId)).map((p) => ({ attributedStepId: reprStepId, message: p.message }));
    const cnt = intentCount.get(iid) || {};
    const post = evaluateAssertions([...(expectedByIntent.get(iid) || []), ...globalAssertions], {
      urlPath: intentUrl.get(iid),
      netRecords: net,
      countBefore: cnt.before, countAfter: cnt.after,
      pageErrors: pe,
      toastTexts: intentToasts.get(iid),  // kinds-harden：缺采集即 undefined → 证不出
      textHits: intentTextHits.get(iid),
      buttonHits: intentButtonHits.get(iid), // wf-publish-states：缺采集即 undefined → 证不出
      buttonSeen: intentButtonSeen.get(iid), // 同刻通道活性（absent 反证前提）；缺采集即 undefined → 证不出
      buttonDisabledHits: intentButtonDisabledHits.get(iid), // btn-enable-ops：缺采集即 undefined → enabled/disabled 证不出
      replyText: intentReply.get(iid),    // chiefcomplaint-smoke：缺采集即 undefined → 证不出
      inputReadback: intentInputReadback.get(iid), // 脚本/字段值：只认 setNodeField 同一物理字段动作回读
      streamUrlPattern: chatCfg ? chatCfg.streamUrlPattern : undefined,
    });
    return {
      stepId: reprStepId,
      intentId: iid,
      atom: es.slice(-1)[0].atom,
      // verdict 仍只消费 intent 级 action；这里先对逐 event 轴 fail-safe 折叠，前序失败不得被末事件洗白。
      action: foldIntentAction(eventActions),
      // 完整逐 event 证据继续原样外露，供 compile --verify、报告原子操作和人工诊断消费。
      eventActions,
      postAssertions: post,
      forensics: { network: net, lifecycle: { crashed: false, crashedAtStepId: null, pageerror: pe } },
    };
  });

  // 孤儿网络记录（首事件前/无步发起）并进首 intent，归因仍 null，确保 allNet 可见。
  const orphan = allRecords.filter((r) => r.firingStepId == null || !allStepIds.has(r.firingStepId))
    .map((r) => ({ url: projUrl(r.url), status: r.status, ts: r.ts, initiator: r.initiator, attributedStepId: null, errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus }));
  if (orphan.length && steps.length) steps[0].forensics.network.push(...orphan);

  // axes 落盘前过凭据兜底门（cred-route-mask codex R1 High：axes 此前是漏网落盘口——路径段已打码，
  // 但 query/hash 携凭据只能靠门拦；命中即拒写 exit 1，fail-closed，同 compile/report 先例）。
  const axesText = JSON.stringify({ caseId, steps }, null, 2) + '\n';
  const axesGate = credentialGate({ 'axes.json': axesText });
  if (!axesGate.ok) {
    console.error(`凭据兜底门拦截（护栏 #7）：${axesGate.hit}；拒绝落盘 axes`);
    clearTimeout(watchdog);
    sweepVideos(); // fail-closed 退出不留已收敛录像（codex R3-N6）
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
    sweepVideos(); // 关后补扫（codex R4-N7）
    process.exit(1);
  }
  writeFileSync(args.out, axesText, 'utf8');

  // 回放历史/回放指标真产出（G5：与 axes 同刻、正常成功路径、过凭据兜底门、命中拒写 exit 1）。
  // locatorHitRate 分母只数有定位需求步（locatorResolution 非 null），分母 0 → null（诚实无比率）。
  if (rhOn) {
    const denom = rhLines.filter((l) => l.locatorResolution !== null);
    const metrics = {
      schemaVersion: 1,
      caseId,
      runId: args.runId || null,
      totalSteps: rhLines.length,
      passedActions: rhLines.filter((l) => l.result === 'ok').length,
      locatorHitRate: denom.length ? denom.filter((l) => l.locatorResolution === 'unique').length / denom.length : null,
      quietPointWaitMs: Math.max(0, Math.round(rhQuietWait)),
      totalDurationMs: Date.now() - T0,
    };
    const outputs = {};
    // 零行集写空文件（codex R1-F3）：JSONL 不容空行。
    if (args.runHistory) outputs['run-history.jsonl'] = rhLines.length ? rhLines.map((l) => JSON.stringify(l)).join('\n') + '\n' : '';
    if (args.runMetrics) outputs['run-metrics.json'] = JSON.stringify(metrics, null, 2) + '\n';
    const gate = credentialGate(outputs);
    if (!gate.ok) {
      console.error(`凭据兜底门拦截（护栏 #7）：${gate.hit}；拒绝落盘诊断件`);
      clearTimeout(watchdog);
      sweepVideos(); // fail-closed 退出不留已收敛录像（codex R3-N6）
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      sweepVideos(); // 关后补扫（codex R4-N7）
      process.exit(1);
    }
    if (args.runHistory) writeFileSync(args.runHistory, outputs['run-history.jsonl'], 'utf8');
    if (args.runMetrics) writeFileSync(args.runMetrics, outputs['run-metrics.json'], 'utf8');
  }

  // 视频元数据旁件（M3：照 run-history 式样——正常成功路径、过凭据兜底门写出；收敛失败缺席容忍不写）。
  // 内容只有语义文件名/时刻/毫秒偏移；stepId 源自输入事件、可走私 URL 形态——整文 :// 零容忍
  // （codex R1-F3 采信）：命中拒写旁件（缺席容忍，视频本体与回放结果零影响）；凭据门仍是末道闸。
  if (args.videoDir && videoOk) {
    const vText = JSON.stringify({ schemaVersion: 1, file: 'video.webm', startedAt: videoT0, steps: vSteps }, null, 2) + '\n';
    if (vText.includes('://')) {
      console.error('replay: 视频元数据含 ://（零容忍），拒绝落盘 video.json（缺席容忍）');
    } else {
      const vGate = credentialGate({ 'video.json': vText });
      if (!vGate.ok) {
        console.error(`凭据兜底门拦截（护栏 #7）：${vGate.hit}；拒绝落盘视频元数据`);
        clearTimeout(watchdog);
        sweepVideos(); // fail-closed 退出不留已收敛录像（codex R3-N6）
        await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
        sweepVideos(); // 关后补扫（codex R4-N7）
        process.exit(1);
      }
      writeFileSync(join(args.videoDir, 'video.json'), vText, 'utf8');
    }
  }

  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  // 关后补扫（codex R4-N7）：收敛失败（缺席容忍）时，context 关不上而 browser.close 期间才终结的
  // raw 镜头也不许留——缺席必须真缺席；videoOk 成功路径的 video.webm 不在此扫（豁免随 exit 0 到期）。
  if (args.videoDir && !videoOk) sweepVideos();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('replay 失败：' + String((e && e.message) || e).slice(0, 300)); // 剥栈只留消息（output-seal B6）
  // M5 尽力收口（同看门狗，codex R1-F1）：清扫先行 → 尽力关 → 补扫，4s 兜底强退，退出码语义不变。
  const bail = setTimeout(() => process.exit(1), 4000);
  sweepVideos();
  try { if (activeBrowser) await activeBrowser.close(); } catch { /* 尽力而为 */ }
  sweepVideos();
  clearTimeout(bail);
  process.exit(1);
});

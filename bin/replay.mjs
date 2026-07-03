#!/usr/bin/env node
// bin/replay.mjs —— 确定性回放器（相3）。真回放 SUT（被测系统）→ 产三轴 axes.json → 喂已冻 verdict.mjs。
// 冻结 CLI：node bin/replay.mjs --events <f> --sut <baseUrl> --expected <f> --profile <f> --out <axes.json> [--login-bootstrap]
//   [--run-history <f>] [--run-metrics <f>] [--run-id <id>]（opt-in 回放历史/回放指标真产出，缺省行为一字不变）：
//   纯观察者逐 event 收集（零新增等待、零改动作时序——动了取证归因窗即污染护栏 #15），与 axes 同刻经
//   凭据兜底门一次写出；仅诊断证据，绝不进 verdict.mjs、绝不写 passes（口径见 docs/plans/run-history/proposed/GRILL.md）。
//   --profile = 通道剖面（非凭据）：{ background:[denylist], successField, successValue }。
//   --login-bootstrap（opt-in，缺省行为一字不变）：回放前执行登录预备动作（CONTEXT.md 术语）——
//     不产 event、不进 axes、凭据只进内存（护栏 #7）；前置加载/登录失败 exit 65 不落 axes（护栏 #14）。
// 裁判零 LLM（护栏 #15）：本进程只产三轴事实，绝不裁定、绝不问 LLM、绝不写 verdict/passes。
// 取证按【动作作用域 + 发起方】归因（护栏 #15，非时间窗）：currentStepId 仅在该步动作执行+静默期开放，
//   预导航/上下文恢复期一律 null；证不出归 null（fail-safe，护栏 #14）。
import { readFileSync, writeFileSync } from 'node:fs';
import pw from '@playwright/test';
import { performAction } from '../lib/replay-actions.mjs';
import { instantiate } from '../lib/instantiate.mjs';
import { watchNetworkForensics } from '../lib/replay-forensics.mjs';
import { evaluateAssertions } from '../lib/replay-assert.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { credentialGate, maskCredentialRoute } from '../lib/cred-gate.mjs';

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
    else if (a === '--login-bootstrap') o.loginBootstrap = true;
    else if (a === '--run-history') o.runHistory = argv[++i];
    else if (a === '--run-metrics') o.runMetrics = argv[++i];
    else if (a === '--run-id') o.runId = argv[++i];
  }
  return o;
}

// ── 回放历史逐行构造（G2/G3/G4 口径见 docs/plans/run-history/proposed/GRILL.md）────
// 纯翻译既有机制事实：locatorResolution 冻结枚举缝合（内部值 action_failed→unique，失败归 result=actionError）；
// valueRef 值侧打码（全串恰为单占位符才透传，否则脱敏标记，护栏 #7）；quietPointReached=该步前置稳定程序达成。
const RH_PLACEHOLDER = /^\{\{[A-Za-z0-9_.-]+\}\}$/;
const RH_INTERACTIVE = new Set(['click', 'dblclick', 'fill', 'selectOption']);
const RH_ACTIONS = new Set(['click', 'dblclick', 'fill', 'selectOption', 'press', 'nav', 'newpage']);
const RH_LR_ENUM = new Set(['unique', 'none', 'ambiguous', 'fallback_first', 'coord_fallback']); // 冻结枚举透传（codex R1-F2）
function historyLine(ev, { navOk, navErr, axis, durationMs, caseId }) {
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
    quietPointReached: !!navOk,
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
async function rowCount(page) {
  try { return await page.locator('.hr-table-row').count(); } catch { return null; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const k of ['events', 'sut', 'expected', 'profile', 'out']) {
    if (!args[k]) { console.error(`replay: 缺 --${k}`); process.exit(64); }
  }
  // 看门狗 120s（同 compile 先例；chiefcomplaint-smoke D2：chat 用例含 LLM 流式等待，75s 偏紧）。fail-safe 语义不变。
  const watchdog = setTimeout(() => { console.error('replay 看门狗：超时强制退出'); process.exit(1); }, 120000);
  const DBG = !!process.env.REPLAY_DEBUG;
  const T0 = Date.now();
  const log = (m) => { if (DBG) console.error('[replay +' + (Date.now() - T0) + 'ms] ' + m); };

  const eventsDoc = JSON.parse(readFileSync(args.events, 'utf8'));
  const expectedDoc = JSON.parse(readFileSync(args.expected, 'utf8'));
  const profile = JSON.parse(readFileSync(args.profile, 'utf8'));
  const events = eventsDoc.events || [];
  const caseId = eventsDoc.caseId || expectedDoc.caseId || 'unknown';
  const sut = String(args.sut).replace(/\/$/, '');
  // 确定性令牌（可 golden）；真机由 compile-gate 注入带 Reserved Prefix 的实体名。
  // baseUrl：G6 分岔三取 C——events url 走 {{baseUrl}} 占位符，回放期回填 --sut（对完整 URL 的旧 fixture 是 no-op）。
  const ctx = { uniqueName: 'r1', baseUrl: sut };

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
      console.error('replay: 登录预备动作前置失败（fail-closed）：' + String((e && e.message) || e).slice(0, 300));
      process.exit(65);
    }
  }

  const intentOrder = [];
  const intentEvents = new Map();
  for (const ev of events) {
    if (!intentEvents.has(ev.intentId)) { intentEvents.set(ev.intentId, []); intentOrder.push(ev.intentId); }
    intentEvents.get(ev.intentId).push(ev);
  }
  const reprStepOf = new Map(intentOrder.map((iid) => [iid, intentEvents.get(iid).slice(-1)[0].stepId]));
  const expectedByIntent = new Map((expectedDoc.intents || []).map((it) => [it.intentId, it.expected || []]));
  const globalAssertions = expectedDoc.globalAssertions || [];
  const allStepIds = new Set(events.map((e) => e.stepId));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
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

  // 登录预备动作执行：forensics 已接线、事件循环未开——此刻 currentStepId=null，登录期流量一律
  // 归 null 不背书（护栏 #14/#15）；不产 event、不进 axes（axes 步只源于 events）。失败关浏览器 exit 65。
  if (loginPrep) {
    try {
      await loginBootstrap(page, loginPrep);
      log('login bootstrap done');
    } catch (e) {
      console.error('replay: 登录预备动作失败（fail-closed）：' + String((e && e.message) || e).slice(0, 300));
      clearTimeout(watchdog);
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      process.exit(65);
    }
  }

  const actionByStep = new Map();
  const intentUrl = new Map();
  const intentCount = new Map();
  const intentToasts = new Map();   // kinds-harden：代表步静默点 toast 快照
  const intentTextHits = new Map(); // kinds-harden：代表步 textVisible 命中计数

  // 回放历史 opt-in（run-history）：纯观察者收集，不加任何等待、不改任何时序。
  const rhOn = !!(args.runHistory || args.runMetrics);
  const rhLines = [];
  let rhQuietWait = 0;

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
      let navOk = true;
      let navErr = null;
      try {
        if (ev.action === 'nav') {
          state.currentStepId = ev.stepId; // nav 本身就是动作，开放归因
          await page.goto(sut + pathOf(instantiate(ev.url, ctx)), { waitUntil: 'load' });
        } else {
          const want = ev.pre && ev.pre.path;
          if (want && pathOf(page.url()) !== want) {
            const restoreT = Date.now();
            try { await page.goto(sut + want, { waitUntil: 'load' }); } finally { rhQuietWait += Date.now() - restoreT; }
          }
        }
      } catch (e) { navOk = false; navErr = e; }

      if (isFirst) intentCount.set(ev.intentId, { before: await rowCount(page), after: null });

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
        intentUrl.set(ev.intentId, pathOf(page.url()));
        const c = intentCount.get(ev.intentId);
        if (c) c.after = await rowCount(page);
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
        const line = historyLine(ev, { navOk, navErr, axis: ev.action === 'nav' ? null : actionByStep.get(ev.stepId), durationMs: Date.now() - evT0, caseId });
        if (line) rhLines.push(line);
      }
    }
  } finally {
    log('loop done, settling streams + draining');
    await forensics.awaitStreamsSettled(2500);
    await forensics.drain();
    log('drained');
  }

  const allRecords = forensics.records();
  // 归因到本步的记录归一到 intent 代表步（verdict 按 ===StepAxes.stepId 背书，须对齐，finding 5）；其余归 null。
  // url 过凭据路由名打码（cred-route-mask）：报告装配下游同源受益；无关键词路由零行为差。
  const projectNet = (r, reprStepId) => ({
    url: maskCredentialRoute(r.url), status: r.status, ts: r.ts, initiator: r.initiator,
    attributedStepId: r.attributedStepId != null ? reprStepId : null,
    errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus,
  });

  const steps = intentOrder.map((iid) => {
    const es = intentEvents.get(iid);
    const reprStepId = reprStepOf.get(iid);
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
      replyText: intentReply.get(iid),    // chiefcomplaint-smoke：缺采集即 undefined → 证不出
      streamUrlPattern: chatCfg ? chatCfg.streamUrlPattern : undefined,
    });
    return {
      stepId: reprStepId,
      intentId: iid,
      atom: es.slice(-1)[0].atom,
      action: actionByStep.get(reprStepId) || { resolution: 'none' },
      // 逐 event 动作轴（加性，p3 评审 R1-F4）：intent 卷回只留代表步动作，中间 event 的
      // ambiguous/失配会被掩盖——编译回放核验（casey compile --verify）须逐 event 扫，故全量外露。
      // verdict.mjs 只读 action.resolution，不消费本字段。
      eventActions: es.map((e) => ({ stepId: e.stepId, action: actionByStep.get(e.stepId) || { resolution: 'none' } })),
      postAssertions: post,
      forensics: { network: net, lifecycle: { crashed: false, crashedAtStepId: null, pageerror: pe } },
    };
  });

  // 孤儿网络记录（首事件前/无步发起）并进首 intent，归因仍 null，确保 allNet 可见。
  const orphan = allRecords.filter((r) => r.firingStepId == null || !allStepIds.has(r.firingStepId))
    .map((r) => ({ url: maskCredentialRoute(r.url), status: r.status, ts: r.ts, initiator: r.initiator, attributedStepId: null, errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus }));
  if (orphan.length && steps.length) steps[0].forensics.network.push(...orphan);

  // axes 落盘前过凭据兜底门（cred-route-mask codex R1 High：axes 此前是漏网落盘口——路径段已打码，
  // 但 query/hash 携凭据只能靠门拦；命中即拒写 exit 1，fail-closed，同 compile/report 先例）。
  const axesText = JSON.stringify({ caseId, steps }, null, 2) + '\n';
  const axesGate = credentialGate({ 'axes.json': axesText });
  if (!axesGate.ok) {
    console.error(`凭据兜底门拦截（护栏 #7）：${axesGate.hit}；拒绝落盘 axes`);
    clearTimeout(watchdog);
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
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
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      process.exit(1);
    }
    if (args.runHistory) writeFileSync(args.runHistory, outputs['run-history.jsonl'], 'utf8');
    if (args.runMetrics) writeFileSync(args.runMetrics, outputs['run-metrics.json'], 'utf8');
  }

  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(0);
}

main().catch((e) => { console.error('replay 失败：' + ((e && e.stack) || e)); process.exit(1); });

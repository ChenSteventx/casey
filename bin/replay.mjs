#!/usr/bin/env node
// bin/replay.mjs —— 确定性回放器（相3）。真回放 SUT（被测系统）→ 产三轴 axes.json → 喂已冻 verdict.mjs。
// 冻结 CLI：node bin/replay.mjs --events <f> --sut <baseUrl> --expected <f> --profile <f> --out <axes.json>
//   --profile = 通道剖面（非凭据）：{ background:[denylist], successField, successValue }。
// 裁判零 LLM（护栏 #15）：本进程只产三轴事实，绝不裁定、绝不问 LLM、绝不写 verdict/passes。
// 取证按【动作作用域 + 发起方】归因（护栏 #15，非时间窗）：currentStepId 仅在该步动作执行+静默期开放，
//   预导航/上下文恢复期一律 null；证不出归 null（fail-safe，护栏 #14）。
import { readFileSync, writeFileSync } from 'node:fs';
import pw from '@playwright/test';
import { performAction } from '../lib/replay-actions.mjs';
import { instantiate } from '../lib/instantiate.mjs';
import { watchNetworkForensics } from '../lib/replay-forensics.mjs';
import { evaluateAssertions } from '../lib/replay-assert.mjs';

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
  }
  return o;
}

const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };

// 行计数：失败回 null（未知），绝不回 0——避免 countChange equals 0 把「证不出」洗成假绿（finding 7）。
async function rowCount(page) {
  try { return await page.locator('.hr-table-row').count(); } catch { return null; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const k of ['events', 'sut', 'expected', 'profile', 'out']) {
    if (!args[k]) { console.error(`replay: 缺 --${k}`); process.exit(64); }
  }
  const watchdog = setTimeout(() => { console.error('replay 看门狗：超时强制退出'); process.exit(1); }, 75000);
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

  const actionByStep = new Map();
  const intentUrl = new Map();
  const intentCount = new Map();

  try {
    for (const ev of events) {
      const isFirst = intentEvents.get(ev.intentId)[0].stepId === ev.stepId;
      const isLast = reprStepOf.get(ev.intentId) === ev.stepId;
      log('event ' + ev.stepId + ' ' + ev.action + ' intent=' + ev.intentId);

      // 预导航/上下文恢复期：归因关闭（currentStepId=null），此期请求不系任何步（护栏 #15）。
      state.currentStepId = null;
      let navOk = true;
      try {
        if (ev.action === 'nav') {
          state.currentStepId = ev.stepId; // nav 本身就是动作，开放归因
          await page.goto(sut + pathOf(instantiate(ev.url, ctx)), { waitUntil: 'load' });
        } else {
          const want = ev.pre && ev.pre.path;
          if (want && pathOf(page.url()) !== want) await page.goto(sut + want, { waitUntil: 'load' });
        }
      } catch { navOk = false; }

      if (isFirst) intentCount.set(ev.intentId, { before: await rowCount(page), after: null });

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
        await respWait;
        // 给动作的直接异步后果（如 save 响应后随即开的 SSE 流）一点点出现窗，仍归本步——
        // 这是动作的因果作用域（save→stream），非任意时间窗；背景轮询仍由 denylist 归 null。
        if (ev.action === 'click') { await new Promise((r) => setTimeout(r, 150)); }
        log('  acted ' + ev.stepId + ' resolution=' + (axis && axis.resolution));
        state.currentStepId = null; // 动作作用域结束，关闭归因
      }

      if (isLast) {
        intentUrl.set(ev.intentId, pathOf(page.url()));
        const c = intentCount.get(ev.intentId);
        if (c) c.after = await rowCount(page);
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
  const projectNet = (r, reprStepId) => ({
    url: r.url, status: r.status, ts: r.ts, initiator: r.initiator,
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
    });
    return {
      stepId: reprStepId,
      intentId: iid,
      atom: es.slice(-1)[0].atom,
      action: actionByStep.get(reprStepId) || { resolution: 'none' },
      postAssertions: post,
      forensics: { network: net, lifecycle: { crashed: false, crashedAtStepId: null, pageerror: pe } },
    };
  });

  // 孤儿网络记录（首事件前/无步发起）并进首 intent，归因仍 null，确保 allNet 可见。
  const orphan = allRecords.filter((r) => r.firingStepId == null || !allStepIds.has(r.firingStepId))
    .map((r) => ({ url: r.url, status: r.status, ts: r.ts, initiator: r.initiator, attributedStepId: null, errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus }));
  if (orphan.length && steps.length) steps[0].forensics.network.push(...orphan);

  writeFileSync(args.out, JSON.stringify({ caseId, steps }, null, 2) + '\n', 'utf8');
  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(0);
}

main().catch((e) => { console.error('replay 失败：' + ((e && e.stack) || e)); process.exit(1); });

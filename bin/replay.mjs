#!/usr/bin/env node
// bin/replay.mjs —— 确定性回放器（相3）。真回放 SUT（被测系统）→ 产三轴 axes.json → 喂已冻 verdict.mjs。
// 冻结 CLI：node bin/replay.mjs --events <f> --sut <baseUrl> --expected <f> --profile <f> --out <axes.json>
//   --profile = 通道剖面（非凭据）：{ background:[denylist], successField, successValue }。
// 裁判零 LLM（护栏 #15）：本进程只产三轴事实，绝不裁定、绝不问 LLM、绝不写 verdict/passes。
import { readFileSync, writeFileSync } from 'node:fs';
import pw from '@playwright/test';
import { performAction } from '../lib/replay-actions.mjs';
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

async function rowCount(page) {
  try { return await page.locator('.hr-table-row').count(); } catch { return 0; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const k of ['events', 'sut', 'expected', 'profile', 'out']) {
    if (!args[k]) { console.error(`replay: 缺 --${k}`); process.exit(64); }
  }
  // 看门狗：单次回放绝不挂死（永不 resolve 的 promise 会拖死 golden 的 execFileSync）。超时强制非 0 退出。
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
  const ctx = { uniqueName: 'r1' }; // 确定性令牌（可 golden）；真机由 compile-gate 注入带 Reserved Prefix 的实体名

  // intent 顺序 + 每 intent 的 events、repr（末事件 = 该 intent 动作轴/取证归因的代表步）
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

  const state = { currentStepId: null, pageErrored: false };
  page.on('pageerror', () => { state.pageErrored = true; });
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
      state.currentStepId = ev.stepId;
      log('event ' + ev.stepId + ' ' + ev.action + ' intent=' + ev.intentId);
      const isFirst = intentEvents.get(ev.intentId)[0].stepId === ev.stepId;
      const isLast = reprStepOf.get(ev.intentId) === ev.stepId;

      // 导航到本步录制 pre.path（鲁棒回放：上一步未推进时强制回到本步上下文，每步独立可裁）
      try {
        if (ev.action === 'nav') {
          await page.goto(sut + pathOf(ev.url), { waitUntil: 'load' });
        } else {
          const want = ev.pre && ev.pre.path;
          if (want && pathOf(page.url()) !== want) await page.goto(sut + want, { waitUntil: 'load' });
        }
      } catch { /* 导航失败由后续轴体现 */ }

      if (isFirst) intentCount.set(ev.intentId, { before: await rowCount(page), after: 0 });

      // 有界静默点：点击可能触发 save/stream，等其响应（背景 poll 不在此 filter）。
      const respWait = ev.action === 'click'
        ? page.waitForResponse((r) => /saveOrModifyProcessData|streamReply/.test(r.url()), { timeout: 600 }).catch(() => null)
        : Promise.resolve(null);
      const axis = await performAction(page, ev, ctx);
      log('  acted ' + ev.stepId + ' resolution=' + axis.resolution);
      actionByStep.set(ev.stepId, axis);
      await respWait;
      log('  respWait done ' + ev.stepId);

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
  const projectNet = (r) => ({ url: r.url, status: r.status, ts: r.ts, initiator: r.initiator, attributedStepId: r.attributedStepId, errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus });

  const steps = intentOrder.map((iid) => {
    const es = intentEvents.get(iid);
    const stepIds = new Set(es.map((e) => e.stepId));
    const net = allRecords.filter((r) => r.firingStepId != null && stepIds.has(r.firingStepId)).map(projectNet);
    const cnt = intentCount.get(iid) || {};
    const post = evaluateAssertions([...(expectedByIntent.get(iid) || []), ...globalAssertions], {
      urlPath: intentUrl.get(iid),
      netRecords: net,
      countBefore: cnt.before, countAfter: cnt.after,
      pageErrored: state.pageErrored,
    });
    return {
      stepId: reprStepOf.get(iid),
      intentId: iid,
      atom: es.slice(-1)[0].atom,
      action: actionByStep.get(reprStepOf.get(iid)) || { resolution: 'none' },
      postAssertions: post,
      forensics: { network: net, lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] } },
    };
  });

  // 孤儿记录（首事件前发起 / firingStepId 不属任何步）并进首 intent，确保 allNet 可见、归因仍 null。
  const orphan = allRecords.filter((r) => r.firingStepId == null || !allStepIds.has(r.firingStepId)).map(projectNet);
  if (orphan.length && steps.length) steps[0].forensics.network.push(...orphan);

  writeFileSync(args.out, JSON.stringify({ caseId, steps }, null, 2) + '\n', 'utf8');
  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(0);
}

main().catch((e) => { console.error('replay 失败：' + ((e && e.stack) || e)); process.exit(1); });

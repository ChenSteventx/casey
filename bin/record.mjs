#!/usr/bin/env node
// bin/record.mjs -- manual teach-in capture.
// Produces source material only: not signed, not replay-ready, not a bypass around the seven-phase pipeline.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeTeachInCapture } from '../lib/record-capture.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import {
  playwrightLaunchOptions,
  resolveCliExecutionTarget,
} from '../lib/execution-target/wiring.mjs';
import { navigateExecutionTargetPage } from '../lib/execution-target/runtime.mjs';
import { emitExecutionTargetCliFailure } from '../lib/execution-target/cli-boundary.mjs';
import {
  capturePageSessionSeed,
  createRecordBridgeSession,
} from '../lib/page-topology/record-bridge.mjs';

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
      else o[k] = true;
    } else o.pos.push(a);
  }
  return o;
}

function usage() {
  console.error('用法: casey record <caseId> --sut <baseUrl> --out-dir <dir> (--login-bootstrap|--no-login) [--from-events <f>] [--headless] [--max-ms <ms>]');
}

function dieUsage(msg) {
  console.error(`record: ${msg}`);
  usage();
  process.exit(64);
}

function readRawEvents(file) {
  let j;
  try {
    j = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.error('record: --from-events 不是合法 JSON 或不可读（内容不回显）');
    process.exit(65);
  }
  if (Array.isArray(j)) return { events: j, startUrl: null };
  // 形态 fail-closed：非数组、且非 {events:[...]} 的合法 JSON（裸数字/字符串/无 events 键对象）
  // 证不出录制意图，拒——不静默产空包冒充「录了个空」（异构评审 F2）。
  if (j && typeof j === 'object' && Array.isArray(j.events)) return { events: j.events, startUrl: j.startUrl || j.url || null };
  console.error('record: --from-events 形态非法（须为事件数组或 {events:[...]}；内容不回显）');
  process.exit(65);
}

function writePackage({ caseId, outDir, startUrl, events }) {
  try {
    const { file, doc } = writeTeachInCapture({ caseId, outDir, startUrl, events });
    const rel = `<out-dir>/${caseId}/record-capture/teach-in-capture.json`;
    console.log(`record: 示教录制包已写入 → ${rel}`);
    console.log(`record: ${doc.events.length} 条事件；signed=false / replayReady=false / distillRequired=true`);
    console.log('record: 该包只作蒸馏语料，不是正式回放输入。');
    process.exit(0);
  } catch (e) {
    if (e?.code === 'CREDENTIAL_GATE') {
      console.error('record: 凭据兜底门拦截（护栏 #7；详情不回显），拒绝落盘');
      process.exit(1);
    }
    // 写盘失败信息含用户 out-dir 绝对路径——不回显路径/内容，只留 errno（output-seal 成功侧占位符同口径，异构评审 A3）。
    console.error(`record: 写包失败（errno=${e?.code || 'UNKNOWN'}；路径与内容不回显）`);
    process.exit(1);
  }
}

function recorderInitScript() {
  if (window.__caseyRecordInstalled) return;
  window.__caseyRecordInstalled = true;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const send = (ev) => {
    if (window.__caseyRecordActive !== true) return;
    try { window.__caseyRecord(ev); } catch (_) { /* binding not ready */ }
  };
  const path = () => location.pathname + location.search;
  const css = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && !/\d{4,}|[0-9a-f]{8}-/i.test(el.id)) return '#' + CSS.escape(el.id);
    const dt = el.getAttribute('data-testid');
    if (dt) return `[data-testid=${JSON.stringify(dt)}]`;
    const ph = el.getAttribute('placeholder');
    if (ph) return `${el.tagName.toLowerCase()}[placeholder=${JSON.stringify(ph)}]`;
    let cur = el;
    const parts = [];
    for (let d = 0; cur && cur.nodeType === 1 && cur !== document.body && d < 4; d++, cur = cur.parentElement) {
      let part = cur.tagName.toLowerCase();
      const cls = String(cur.getAttribute('class') || '').split(/\s+/).find((c) => c && !/\d/.test(c) && !/^is-/.test(c));
      if (cls) part += '.' + CSS.escape(cls);
      const p = cur.parentElement;
      if (p) {
        const sibs = Array.from(p.children).filter((x) => x.tagName === cur.tagName);
        if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
    }
    return parts.join(' > ');
  };
  const targetOf = (e) => e.target?.closest?.('button,a,[role="button"],input,select,textarea,label,[class*="btn"],[class*="item"],[class*="card"]') || e.target;
  const clickPayload = (e, action) => {
    const t = targetOf(e);
    if (!t || !t.getBoundingClientRect) return null;
    const r = t.getBoundingClientRect();
    return {
      action,
      path: path(),
      selector: css(t),
      text: clean(t.innerText || t.value || '').slice(0, 80),
      tagName: String(t.tagName || '').toLowerCase(),
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      ox: Math.round(e.clientX - r.left),
      oy: Math.round(e.clientY - r.top),
    };
  };
  document.addEventListener('click', (e) => { const p = clickPayload(e, 'click'); if (p) send(p); }, true);
  document.addEventListener('dblclick', (e) => { const p = clickPayload(e, 'dblclick'); if (p) send(p); }, true);
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !('value' in t)) return;
    send({
      action: 'fill',
      path: path(),
      selector: css(t),
      tagName: String(t.tagName || '').toLowerCase(),
      fieldLabel: clean(t.labels?.[0]?.innerText || t.getAttribute?.('aria-label') || t.getAttribute?.('placeholder') || '').slice(0, 80),
      type: t.type || '',
      value: String(t.value || '').slice(0, 1000),
    });
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) send({ action: 'press', path: path(), selector: css(e.target), key: 'Enter' });
  }, true);
  window.addEventListener('popstate', () => send({ action: 'nav', path: path() }));
}

function activateRecorderInitScript() {
  window.__caseyRecordActive = true;
}

async function browserMode({ caseId, args }) {
  const pw = await import('@playwright/test');
  const { chromium } = pw.default || pw;
  const events = [];
  const site = loadSiteConfig(undefined, { strict: true });
  const execution = resolveCliExecutionTarget({
    site,
    cliSut: String(args.sut),
    requiresOriginContinuity: Boolean(args['login-bootstrap']),
  });
  if (!execution.ok) {
    const error = new Error(execution.reason);
    error.code = execution.reason;
    throw error;
  }
  const startUrl = execution.runtime.browserVisibleStartUrl;
  let browser;
  try {
    browser = await chromium.launch(playwrightLaunchOptions(
      execution.runtime,
      { headless: !!args.headless },
    ));
  } catch {
    const error = new Error('BROWSER_LAUNCH_FAILED');
    error.code = 'BROWSER_LAUNCH_FAILED';
    throw error;
  }
  const context = await browser.newContext();
  const bridgeCreated = createRecordBridgeSession({
    context,
    emitEvent: (event) => events.push(event),
  });
  if (!bridgeCreated.ok) {
    const error = new Error(bridgeCreated.reason);
    error.code = bridgeCreated.reason;
    throw error;
  }
  const recordBridge = bridgeCreated.bridge;
  await context.exposeBinding(
    '__caseyRecord',
    (source, event) => recordBridge.handleBinding(source, event),
  );
  await context.addInitScript(recorderInitScript);
  context.on('page', (nextPage) => recordBridge.observePage(nextPage));
  const page = await context.newPage();
  let timer = null;
  try {
    if (args['login-bootstrap']) {
      const creds = loadCreds();
      const login = await loginBootstrap(page, {
        site,
        creds,
        startUrl,
        executionTargetAuthority: execution.authority,
      });
      if (login?.ok === false) {
        const error = new Error(login.reason);
        error.code = login.reason;
        throw error;
      }
    } else {
      const navigation = await navigateExecutionTargetPage({
        page,
        authority: execution.authority,
        targetUrl: startUrl,
        gotoOptions: { waitUntil: 'load' },
      });
      if (!navigation.ok) {
        const error = new Error(navigation.reason);
        error.code = navigation.reason;
        throw error;
      }
    }
    const seed = await capturePageSessionSeed({ page });
    if (!seed.ok) {
      const error = new Error(seed.reason);
      error.code = seed.reason;
      throw error;
    }
    const activated = await recordBridge.activate({
      initialPage: page,
      sessionSeedAuthority: seed.authority,
    });
    if (!activated.ok) {
      const error = new Error(activated.reason);
      error.code = activated.reason;
      throw error;
    }
    await context.addInitScript(activateRecorderInitScript);
    await page.evaluate(recorderInitScript);
    await page.evaluate(activateRecorderInitScript);
    console.error('record: 浏览器已打开。完成人工操作后关闭浏览器，或等待 --max-ms 到时收口。');
    const maxMs = Number(args['max-ms'] || 0);
    await new Promise((resolveDone) => {
      page.on('close', resolveDone);
      if (Number.isFinite(maxMs) && maxMs > 0) timer = setTimeout(resolveDone, maxMs);
    });
  } finally {
    if (timer) clearTimeout(timer);
    await recordBridge.drain();
    await browser.close().catch(() => {});
  }
  const bridgeFailure = recordBridge.failure();
  if (bridgeFailure) {
    const error = new Error(bridgeFailure);
    error.code = bridgeFailure;
    throw error;
  }
  writePackage({ caseId, outDir: args['out-dir'], startUrl, events });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!caseId) dieUsage('缺 caseId');
  // caseId 进产物路径段——限路径安全字符，拒 / .. 等穿越形态（fail-closed，镜像 draft.mjs:42 / compile.mjs:283 先例；异构评审 F1）。
  if (!/^[A-Za-z0-9_-]+$/.test(caseId)) { console.error('record: caseId 含非法字符（仅限字母数字_-；原值不回显——CLI 参数在凭据门扫描面外）'); process.exit(65); }
  // 必填/带值旗标须真带值——裸旗标（parseArgs 记 true）不得静默降级为 <cwd>/true 之类落点（镜像 draft.mjs:44；异构评审 F3）。
  for (const k of ['sut', 'out-dir', 'from-events', 'max-ms']) {
    if (args[k] !== undefined && typeof args[k] !== 'string') dieUsage(`--${k} 须带值`);
  }
  if (!args.sut) dieUsage('缺 --sut');
  if (!args['out-dir']) dieUsage('缺 --out-dir');
  if (!!args['login-bootstrap'] === !!args['no-login']) dieUsage('须且只能传 --login-bootstrap 或 --no-login');

  if (args['from-events']) {
    const raw = readRawEvents(resolve(String(args['from-events'])));
    writePackage({ caseId, outDir: args['out-dir'], startUrl: raw.startUrl || args.sut, events: raw.events });
    return;
  }
  await browserMode({ caseId, args });
}

main().catch((e) => {
  process.exit(emitExecutionTargetCliFailure({
    command: 'record',
    failure: e,
  }));
});

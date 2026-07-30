#!/usr/bin/env node
// bin/record.mjs -- manual teach-in capture.
// Produces source material only: not signed, not replay-ready, not a bypass around the seven-phase pipeline.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { writeTeachInCapture } from '../lib/record-capture.mjs';
import { runRecordedTeachinReplayabilityCycle } from '../lib/teachin/replayability-cycle-entry.mjs';
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
import {
  buildRecordedCycleInput,
  inspectRecordedCycleArgs,
} from '../lib/teachin/cycle-input-loader.mjs';
import { createFreshReplayWitness } from '../lib/teachin/fresh-runtime.mjs';
import {
  createCycleEvidenceCollector,
  runWithCycleEvidence,
  sealCycleEvidence,
} from '../lib/teachin/cycle-evidence-context.mjs';
import {
  buildCycleEvidenceDocument,
  writeCycleEvidenceSidecar,
} from '../lib/teachin/cycle-evidence-output.mjs';

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
  console.error('用法: casey record <caseId> --sut <baseUrl> --out-dir <dir> (--login-bootstrap|--no-login) [--from-events <f>] [--cycle-plan <f> | --testcase <f> --expected <f> --entity-lock <f> --profile <f> --sut-build-digest <sha256:...>] [--headless] [--max-ms <ms>]');
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

// 落盘成功返回 capture 文件绝对路径（供同进程闭环读 exact final bytes）；失败只置退出码，
// 不再在此 process.exit——浏览器归属还要靠调用侧 finally 收尾，硬退会跳过 finally。
function writePackage({ caseId, outDir, startUrl, events }) {
  try {
    const { file, doc } = writeTeachInCapture({ caseId, outDir, startUrl, events });
    const rel = `<out-dir>/${caseId}/record-capture/teach-in-capture.json`;
    console.log(`record: 示教录制包已写入 → ${rel}`);
    console.log(`record: ${doc.events.length} 条事件；signed=false / replayReady=false / distillRequired=true`);
    console.log('record: 该包只作蒸馏语料，不是正式回放输入。');
    return file;
  } catch (e) {
    if (e?.code === 'CREDENTIAL_GATE') {
      console.error('record: 凭据兜底门拦截（护栏 #7；详情不回显），拒绝落盘');
      process.exitCode = 1;
      return null;
    }
    // 写盘失败信息含用户 out-dir 绝对路径——不回显路径/内容，只留 errno（output-seal 成功侧占位符同口径，异构评审 A3）。
    console.error(`record: 写包失败（errno=${e?.code || 'UNKNOWN'}；路径与内容不回显）`);
    process.exitCode = 1;
    return null;
  }
}

// 闭环结论恒为开发期技术候选：只回显闭合 ok/固定 reason，绝不回显真实值或异常原文。
function emitCycleOutcome(cycle) {
  if (cycle?.ok === true) {
    console.log('record: 示教复现闭环技术等价成立（developmentOnly=true / promotionReady=false）。');
    console.log('record: 它不是正式测试结论，也不是正式报告。');
    return;
  }
  console.error(`record: 示教复现闭环未成立（reason=${cycle?.reason || 'CYCLE_ENTRY_FAILED'}；真实值不回显）`);
  process.exitCode = 1;
}

// 闭环取证边车（开发期）的拒付码闭合表：请求了取证却产不出合格边车即非零退出。
const EVIDENCE_REJECTION_HINT = Object.freeze({
  EVIDENCE_SCHEMA_REJECTED: '形状闸拒付',
  EVIDENCE_CREDENTIAL_REJECTED: '凭据闸拒付',
  EVIDENCE_WRITE_FAILED: '原子写失败',
});

// 边车只是闭环之外多落的一份可诊断旁证：闭环结论本身原样不动，
// 落盘失败也不改结论，只报固定码并置非零退出（真实值、路径与异常原文一律不回显）。
function emitCycleEvidence({ snapshot, captureBytes, outDir }) {
  const built = buildCycleEvidenceDocument({
    snapshot,
    captureSha256: createHash('sha256').update(captureBytes).digest('hex'),
  });
  const written = built?.ok === true
    ? writeCycleEvidenceSidecar({ outDir, document: built.document })
    : built;
  if (written?.ok === true) {
    console.log(`record: 闭环取证边车已写入 → <capture-dir>/${written.fileName}`);
    return;
  }
  const reason = written?.reason || 'EVIDENCE_WRITE_FAILED';
  console.error(`record: 闭环取证边车未产出（reason=${reason}／${EVIDENCE_REJECTION_HINT[reason] || '未知拒付'}；真实值不回显）`);
  process.exitCode = 1;
}

function recorderInitScript() {
  if (window.__caseyRecordInstalled) return;
  window.__caseyRecordInstalled = true;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const send = (ev) => {
    if (window.__caseyRecordActive !== true) return;
    try { window.__caseyRecord(ev); } catch (_) { /* binding not ready */ }
  };
  const isCaseyControl = (ev) => (ev.composedPath?.() || [])
    .some((node) => node?.getAttribute?.('data-casey-control') === 'true');
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
  document.addEventListener('click', (e) => {
    if (isCaseyControl(e)) return;
    const p = clickPayload(e, 'click'); if (p) send(p);
  }, true);
  document.addEventListener('dblclick', (e) => {
    if (isCaseyControl(e)) return;
    const p = clickPayload(e, 'dblclick'); if (p) send(p);
  }, true);
  document.addEventListener('input', (e) => {
    if (isCaseyControl(e)) return;
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
    if (isCaseyControl(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) send({ action: 'press', path: path(), selector: css(e.target), key: 'Enter' });
  }, true);
  window.addEventListener('popstate', () => send({ action: 'nav', path: path() }));
  const mountFinishControl = () => {
    // 控件只在录制激活后存在：激活前的登录自动化窗口内不得有可点的完成按钮，
    // 否则会在零事件时就把录制收口掉。
    if (window.__caseyRecordActive !== true) return;
    if (document.querySelector('[data-casey-control="true"]')) return;
    const parent = document.documentElement || document.body;
    if (!parent) return;
    const host = document.createElement('div');
    host.setAttribute('data-casey-control', 'true');
    const root = host.attachShadow({ mode: 'closed' });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '完成录制';
    button.setAttribute('aria-label', '完成 Casey 示教录制');
    button.style.cssText = [
      'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
      'padding:10px 18px', 'border:0', 'border-radius:8px',
      'background:#1677ff', 'color:#fff', 'font:600 14px sans-serif',
      'box-shadow:0 4px 16px rgba(0,0,0,.28)', 'cursor:pointer',
    ].join(';');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.__caseyRecordActive = false;
      button.disabled = true;
      button.textContent = '正在收口…';
      try { window.__caseyFinishRecording(); } catch (_) { button.disabled = false; }
    });
    root.append(button);
    parent.append(host);
  };
  window.__caseyMountFinishControl = mountFinishControl;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountFinishControl, { once: true });
  } else {
    mountFinishControl();
  }
}

function activateRecorderInitScript() {
  window.__caseyRecordActive = true;
  try {
    window.__caseyMountFinishControl();
  } catch (_) { /* 早于 recorder init 或 DOM 未就绪：由 DOMContentLoaded 那次补挂 */ }
}

async function browserMode({ caseId, args, cycleMode }) {
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
      {
        headless: !!args.headless,
        // 开发期 WSLg 输入通路救援用（换 ozone 平台或开本机调试口）；未设该环境变量时零行为差。
        ...(process.env.CASEY_RECORD_BROWSER_ARGS
          ? { args: process.env.CASEY_RECORD_BROWSER_ARGS.split(/\s+/).filter(Boolean) }
          : {}),
      },
    ));
  } catch {
    const error = new Error('BROWSER_LAUNCH_FAILED');
    error.code = 'BROWSER_LAUNCH_FAILED';
    throw error;
  }
  // 交权后 recording Browser/Context 归同进程 application service 独占，本文件的 finally 禁止二次 close。
  let recordingOwnerTransferred = false;
  try {
    const context = await browser.newContext();
    let finishRecording;
    const recordingFinished = new Promise((resolveDone) => {
      finishRecording = resolveDone;
    });
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
    // 激活前（登录自动化窗口内）页面脚本调用 binding 一律忽略：不许在零事件时就收口。
    let recordingActivated = false;
    await context.exposeBinding('__caseyFinishRecording', () => {
      if (!recordingActivated) return;
      finishRecording('explicit');
    });
    await context.addInitScript(recorderInitScript);
    context.on('page', (nextPage) => recordBridge.observePage(nextPage));
    const page = await context.newPage();
    if (args['login-bootstrap']) {
      const witnessed = createFreshReplayWitness({
        recordingBrowser: browser,
        recordingContext: context,
      });
      if (witnessed.ok !== true) {
        const error = new Error(witnessed.reason);
        error.code = witnessed.reason;
        throw error;
      }
    }
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
      recordingActivated = true;
      await context.addInitScript(activateRecorderInitScript);
      await page.evaluate(recorderInitScript);
      await page.evaluate(activateRecorderInitScript);
      console.error('record: 浏览器已打开。完成人工操作后点击“完成录制”；关闭标签页/浏览器或 --max-ms 到时也会兜底收口。');
      const maxMs = Number(args['max-ms'] || 0);
      await new Promise((resolveDone) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolveDone();
        };
        // 完成语义不绑单一初始页：popup 交接之后初始页正常关闭不得提前收口，
        // 只有 context 内活跃页全部关掉（含用户关掉当前 active 那一页）才兜底收口。
        const livePages = () => {
          try {
            return context.pages().filter((one) => one?.isClosed?.() !== true);
          } catch {
            return [];
          }
        };
        const doneWhenNoLivePage = () => {
          if (livePages().length === 0) done();
        };
        const watchPage = (one) => {
          if (one && typeof one.on === 'function') one.on('close', doneWhenNoLivePage);
          // 页面可能在「枚举快照→挂监听」间隙已关闭：挂好后立即复查，闭合竞态窗口。
          doneWhenNoLivePage();
        };
        context.on('page', watchPage);
        for (const one of livePages()) watchPage(one);
        // 监听安装完成时活跃页可能已为零（进入等待前全部关闭）：立即重检一次，
        // 否则默认无超时（--max-ms 缺省 0）下将永久等待。
        doneWhenNoLivePage();
        recordingFinished.then(done);
        context.on('close', done);
        browser.on('disconnected', done);
        if (Number.isFinite(maxMs) && maxMs > 0) timer = setTimeout(done, maxMs);
      });
    } finally {
      if (timer) clearTimeout(timer);
      await recordBridge.drain();
    }
    const bridgeFailure = recordBridge.failure();
    if (bridgeFailure) {
      const error = new Error(bridgeFailure);
      error.code = bridgeFailure;
      throw error;
    }
    const captureFile = writePackage({ caseId, outDir: args['out-dir'], startUrl, events });
    // 默认 full-cycle 从刚落盘的同一份 capture exact bytes 生成 input；旧 plan 只作模板。
    // 生成失败仍由本层 finally 关闭录制 runtime，未发生归属交接。
    if (captureFile && args['login-bootstrap'] && cycleMode.requested) {
      let exactCaptureBytes;
      try {
        exactCaptureBytes = readFileSync(captureFile);
      } catch {
        emitCycleOutcome({ ok: false, reason: 'CYCLE_CAPTURE_UNREADABLE' });
        return;
      }
      const built = buildRecordedCycleInput({
        args,
        caseId,
        captureBytes: exactCaptureBytes,
        executionTargetAuthority: execution.authority,
      });
      if (built?.ok !== true) {
        emitCycleOutcome(built);
        return;
      }
      recordingOwnerTransferred = true;
      // 取证收集器的词法边界恰包住单次闭环：并发或迟到的异步任务都串不进本次账。
      const evidenceCollector = createCycleEvidenceCollector();
      const cycle = await runWithCycleEvidence(evidenceCollector, () => (
        runRecordedTeachinReplayabilityCycle({
          caseId,
          captureBytes: exactCaptureBytes,
          recordingBrowser: browser,
          recordingContext: context,
          cycleInput: built.cycleInput,
        })
      ));
      // 聚合之前先封存：此后迟到的通报只计数，绝不入档。
      const evidenceSnapshot = sealCycleEvidence(evidenceCollector);
      // 入口以 CYCLE_ENTRY_INPUT_INVALID 拒绝时，其前置校验发生在 lifecycle 收尾之前，
      // 按合同未接管录制归属；归属退回本层 finally，避免两侧都不关。
      if (cycle?.reason === 'CYCLE_ENTRY_INPUT_INVALID') recordingOwnerTransferred = false;
      emitCycleOutcome(cycle);
      emitCycleEvidence({
        snapshot: evidenceSnapshot,
        captureBytes: exactCaptureBytes,
        outDir: dirname(captureFile),
      });
    }
  } finally {
    if (!recordingOwnerTransferred) {
      await browser.close().catch(() => {});
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!caseId) dieUsage('缺 caseId');
  // caseId 进产物路径段——限路径安全字符，拒 / .. 等穿越形态（fail-closed，镜像 draft.mjs:42 / compile.mjs:283 先例；异构评审 F1）。
  if (!/^[A-Za-z0-9_-]+$/.test(caseId)) { console.error('record: caseId 含非法字符（仅限字母数字_-；原值不回显——CLI 参数在凭据门扫描面外）'); process.exit(65); }
  // 必填/带值旗标须真带值——裸旗标（parseArgs 记 true）不得静默降级为 <cwd>/true 之类落点（镜像 draft.mjs:44；异构评审 F3）。
  for (const k of [
    'sut', 'out-dir', 'from-events', 'max-ms', 'cycle-plan',
    'testcase', 'expected', 'entity-lock', 'profile', 'sut-build-digest',
  ]) {
    if (args[k] !== undefined && typeof args[k] !== 'string') dieUsage(`--${k} 须带值`);
  }
  if (!args.sut) dieUsage('缺 --sut');
  if (!args['out-dir']) dieUsage('缺 --out-dir');
  if (!!args['login-bootstrap'] === !!args['no-login']) dieUsage('须且只能传 --login-bootstrap 或 --no-login');
  const cycleMode = inspectRecordedCycleArgs(args);
  if (cycleMode.ok !== true) dieUsage(cycleMode.reason);
  if (cycleMode.requested && !args['login-bootstrap']) {
    dieUsage('示教闭环须使用 --login-bootstrap');
  }
  if (cycleMode.requested && args['from-events']) {
    dieUsage('--from-events 没有可交接的 live recording runtime，不能开示教闭环');
  }

  if (args['from-events']) {
    const raw = readRawEvents(resolve(String(args['from-events'])));
    writePackage({ caseId, outDir: args['out-dir'], startUrl: raw.startUrl || args.sut, events: raw.events });
    return;
  }
  await browserMode({ caseId, args, cycleMode });
}

main().catch((e) => {
  process.exit(emitExecutionTargetCliFailure({
    command: 'record',
    failure: e,
  }));
});

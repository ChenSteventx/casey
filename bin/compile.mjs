#!/usr/bin/env node
// bin/compile.mjs —— 相1 编译 CLI（三段式，G3 分岔一取 A：flow 落盘 + 人 confirm 门）。
//
//   node bin/compile.mjs <caseId> --testcase <f> --flow <f> --out-dir <d>
//       闸段：flow 草稿过 compile-gate 双闸（前缀自 TestCase.uniquePrefix，fail-closed）→ 落 flow-<caseId>.json 等人 confirm。
//   node bin/compile.mjs <caseId> --execute --sut <url> --out-dir <d> --profile <f> [--skip-login] [--unique-name <tok>]
//       执行段：登录预备动作（凭据只进内存）→ 骑 atom 知识真机逐步执行 → events.json + observed-<caseId>.json + compile-report.json。
//   node bin/compile.mjs <caseId> --verify --sut <url> --out-dir <d> --profile <f>
//       核验段（G1 取 B）：调 bin/replay.mjs 产 axes → 动作轴全 unique 才 0；否则列雷点清单非零退出。
//
// 退出码：0 成功；1 运行时失败/凭据门拦；64 缺参；65 输入坏/闸拒（fail-closed）；66 flow 未 confirm。
// 所有落盘口过 lib/cred-gate.mjs（G5 取 B，护栏 #7）。本进程零 LLM、零裁定（护栏 #15）。
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pw from '@playwright/test';
import { validateDraft } from '../lib/compile-gate.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { watchNetworkForensics } from '../lib/replay-forensics.mjs';
import { createCompileRun, compileFlow, projectObserved, ROUTE_LIST } from '../lib/compile-atoms.mjs';
import { PROJECT_ROOT } from '../lib/paths.mjs';

const { chromium } = pw;
const SNAPSHOT_FILE = join(PROJECT_ROOT, 'lib', 'atoms-registry.snapshot.json');

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

function readJson(f, label) {
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch (e) { console.error(`compile: 读/解析 ${label} 失败（${f}）：${e.message}`); process.exit(65); }
}

// 落盘统一过凭据门（G5）：任一产物命中即全部拒写、非零退出（fail-closed）。
function gatedWrite(files) {
  const outputs = Object.fromEntries(Object.entries(files).map(([p, text]) => [p, text]));
  const gate = credentialGate(outputs);
  if (!gate.ok) { console.error(`compile: 凭据兜底门拦截（护栏 #7）：${gate.hit}；拒绝落盘`); process.exit(1); }
  for (const [p, text] of Object.entries(files)) writeFileSync(p, text, 'utf8');
}

// ── 闸段：flow 草稿 → compile-gate → 落盘等 confirm ─────────────────────────
function gateMode(caseId, args) {
  const tc = readJson(args.testcase, 'TestCase');
  if (tc.caseId !== caseId) { console.error(`compile: TestCase.caseId（${tc.caseId}）与命令行 caseId（${caseId}）不一致`); process.exit(65); }
  if (typeof tc.uniquePrefix !== 'string' || !tc.uniquePrefix.length) { console.error('compile: TestCase.uniquePrefix 缺失/空——破坏性前缀硬闸无锚，拒绝（fail-closed）'); process.exit(65); }
  const flow = readJson(args.flow, 'flow 草稿');
  const registry = readJson(SNAPSHOT_FILE, '原子注册表快照');
  // 初始状态种子 = TestCase.preconditions（「已登录」由登录预备动作建立，flow 不含 login 原子）。
  const { ok, problems } = validateDraft(flow, { prefix: tc.uniquePrefix, registry, initialStates: tc.preconditions || [] });
  if (!ok) {
    console.error(`compile: flow 草稿未过编译门（${problems.length} 问题，fail-closed）：`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(65);
  }
  const outDir = resolve(String(args['out-dir']));
  mkdirSync(outDir, { recursive: true });
  const doc = {
    caseId, uniquePrefix: tc.uniquePrefix,
    gate: { ok: true, atomsFrom: 'lib/atoms-registry.snapshot.json' },
    confirmedBy: '', confirmedAt: null,
    flow,
  };
  const p = join(outDir, `flow-${caseId}.json`);
  gatedWrite({ [p]: JSON.stringify(doc, null, 2) + '\n' });
  console.log(`compile: flow 草稿过闸 → ${p}`);
  console.log('compile: 等人 confirm（填 confirmedBy/confirmedAt）后方可 --execute（G3 人签门）');
  process.exit(0);
}

// ── 执行段：登录预备动作 → 骑 atom 知识逐步执行 → 三产物 ─────────────────────
async function executeMode(caseId, args) {
  const outDir = resolve(String(args['out-dir']));
  const flowFile = join(outDir, `flow-${caseId}.json`);
  if (!existsSync(flowFile)) { console.error(`compile: 缺 ${flowFile}——先跑闸段落 flow 草稿`); process.exit(65); }
  const flowDoc = readJson(flowFile, 'flow-<caseId>.json');
  if (typeof flowDoc.confirmedBy !== 'string' || !flowDoc.confirmedBy.trim()) {
    console.error('compile: flow 草稿未经人 confirm（confirmedBy 空）——破坏性原子上真机前须人眼一道（G3 人签门），拒跑');
    process.exit(66);
  }
  const profile = readJson(args.profile, '通道剖面');
  const sut = String(args.sut).replace(/\/$/, '');
  const uniqueName = String(args['unique-name'] || Date.now().toString(36));
  const site = loadSiteConfig();
  const watchdog = setTimeout(() => { console.error('compile 看门狗：超时强制退出'); process.exit(1); }, 120000);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const state = { currentStepId: null };
  const forensics = watchNetworkForensics(cdp, {
    denylist: profile.background || [],
    successField: profile.successField,
    successValue: profile.successValue,
    currentStep: () => state.currentStepId,
  });

  const run = createCompileRun({ page, forensics, state, sut, uniqueName, site });
  let exitCode = 0;
  try {
    if (!args['skip-login']) {
      // 登录预备动作：不产 event，凭据只进内存（护栏 #7）。startUrl 取 site.json 投影，绝不写死。
      const creds = loadCreds();
      const startUrl = (site.target && (site.target.devProxyUrl || site.target.startUrl)) || sut + ROUTE_LIST;
      await loginBootstrap(page, { site, creds, startUrl });
      run.notes.push('登录预备动作完成（不产 event）');
    }
    await compileFlow(run, flowDoc.flow);
  } catch (e) {
    console.error(`compile: 执行失败：${String(e && e.stack || e).slice(0, 500)}`);
    exitCode = 1;
  } finally {
    await forensics.awaitStreamsSettled(1500);
    await forensics.drain();
  }

  if (exitCode === 0) {
    const now = new Date().toISOString();
    const firstNav = run.events.find((e) => e.action === 'nav');
    const eventsDoc = {
      schemaVersion: 2, channel: 'web', caseId,
      url: firstNav ? firstNav.url : `{{baseUrl}}${ROUTE_LIST}`,
      recordedAt: now, compiledBy: 'casey-compile/p3', authored: false,
      events: run.events,
    };
    const observedDoc = projectObserved(run, { caseId, capturedAt: now, capturedAgainstBuild: null });
    const reportDoc = {
      caseId, compiledAt: now, uniquePrefix: flowDoc.uniquePrefix,
      verification: run.verification,
      caseDefectCandidates: run.caseDefectCandidates,
      handoff: { assertionAtoms: run.assertionAtoms },
      notes: run.notes,
    };
    gatedWrite({
      [join(outDir, 'events.json')]: JSON.stringify(eventsDoc, null, 2) + '\n',
      [join(outDir, `observed-${caseId}.json`)]: JSON.stringify(observedDoc, null, 2) + '\n',
      [join(outDir, 'compile-report.json')]: JSON.stringify(reportDoc, null, 2) + '\n',
    });
    const nonUnique = run.verification.filter((v) => v.resolution !== 'unique');
    console.log(`compile: 执行段完成 → events ${run.events.length} 步 / observed ${observedDoc.steps.length} 步 / 候选 ${run.caseDefectCandidates.length}`);
    if (nonUnique.length) console.log(`compile: ${nonUnique.length} 步定位核验非唯一 → route:human（见 compile-report.json）`);
  }
  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(exitCode);
}

// ── 核验段（G1 取 B）：喂空 expected 跑 bin/replay.mjs，扫动作轴全 unique ────────
// 判据是动作轴（可加载、可回放、点击身份门全 unique），不以 verdict 终判为准（无冻结断言时裁定必落 NEEDS_HUMAN 属正常）。
function verifyMode(caseId, args) {
  const outDir = resolve(String(args['out-dir']));
  const eventsFile = join(outDir, 'events.json');
  if (!existsSync(eventsFile)) { console.error(`compile: 缺 ${eventsFile}——先 --execute 产 events`); process.exit(65); }
  const tmp = mkdtempSync(join(tmpdir(), 'casey-compile-verify-'));
  const expFile = join(tmp, 'expected.empty.json');
  writeFileSync(expFile, JSON.stringify({ caseId, channel: 'web', intents: [], globalAssertions: [] }));
  const axesFile = join(tmp, 'axes.json');
  const r = spawnSync(process.execPath, [join(PROJECT_ROOT, 'bin', 'replay.mjs'),
    '--events', eventsFile, '--sut', String(args.sut), '--expected', expFile, '--profile', String(args.profile), '--out', axesFile,
  ], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) {
    console.error(`compile --verify: 回放器非零退出（${r.status}）：${(r.stderr || '').slice(-400)}`);
    process.exit(1);
  }
  const axes = readJson(axesFile, 'axes');
  const bad = (axes.steps || []).filter((s) => !s.action || s.action.resolution !== 'unique');
  if (bad.length) {
    console.error(`compile --verify: ${bad.length} 步未过点击身份门（回放核验红，G1 判据）：`);
    for (const s of bad) console.error(`  - ${s.stepId}（intent=${s.intentId}）resolution=${s.action && s.action.resolution}（ambiguous/失配雷点 → route:human）`);
    process.exit(1);
  }
  console.log(`compile --verify: ${(axes.steps || []).length} 步动作轴全 unique——events 可加载、可回放、点击身份门全过`);
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!caseId) { console.error('compile: 缺 <caseId>'); process.exit(64); }
  if (args.verify) {
    for (const k of ['sut', 'out-dir', 'profile']) if (!args[k]) { console.error(`compile --verify: 缺 --${k}`); process.exit(64); }
    return verifyMode(caseId, args);
  }
  if (args.execute) {
    for (const k of ['sut', 'out-dir', 'profile']) if (!args[k]) { console.error(`compile --execute: 缺 --${k}`); process.exit(64); }
    return executeMode(caseId, args);
  }
  for (const k of ['testcase', 'flow', 'out-dir']) if (!args[k]) { console.error(`compile: 缺 --${k}（闸段用法：--testcase <f> --flow <f> --out-dir <d>）`); process.exit(64); }
  return gateMode(caseId, args);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error('compile 失败：' + ((e && e.stack) || e)); process.exit(1); });

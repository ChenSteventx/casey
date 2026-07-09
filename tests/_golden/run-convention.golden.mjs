// run-convention.golden.mjs —— `casey run <caseId>` 约定布局解析金牌。
// 红先行：实现前 `runPipeline` 仍要求 --events/--expected/--profile，A1/A2/A4/A5/A6/A7 应红。
// 验收目标：只给 caseId + --sut 时，从 AT_CASES_DIR/<caseId>/ 自动解析 events/expected/profile/observed/case-meta；
// 显式旗标恒赢；必填缺件 exit 64 且点名；可选件缺失不阻塞但 stderr 明示降级。
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { startPublishSut } from '../fixtures/publish-sut/server.mjs';
import { signExpected } from './_sign-helper.mjs';
import { FORBIDDEN_KEYWORDS } from '../../lib/cred-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-run-convention-'));
const casesRoot = join(tmp, 'cases');
mkdirSync(casesRoot, { recursive: true });

const SITE_FILE = writeJson(join(tmp, 'site.synthetic.json'), {});
const ENV = { ...process.env, AT_CASES_DIR: casesRoot, AT_SITE_JSON: SITE_FILE, AT_CREDS_FILE: join(tmp, 'no-creds-here.json') };
delete ENV.AT_CREDS_USER;
delete ENV.AT_CREDS_PASS;
process.env.AT_CASES_DIR = casesRoot;

const fails = [];
let pass = 0;
const stationOutputs = [];
async function checkAsync(name, fn) {
  try {
    await fn();
    pass++;
  } catch (e) {
    fails.push(`${name}: ${String(e && (e.stderr || e.message || e)).slice(-700)}`);
  }
}
function writeJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return file;
}
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function run(args, extraEnv = {}, timeout = 180000) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...ENV, ...extraEnv }, cwd: tmp });
  stationOutputs.push((r.stdout || '') + (r.stderr || ''));
  return r;
}
const relCases = (caseId, leaf) => `cases/${caseId}/${leaf}`;

const bsa = (op, value) => ({ kind: 'buttonState', op, value, soft: false });
function makeEvents(caseId, { broken = false } = {}) {
  return {
    schemaVersion: 2,
    channel: 'web',
    caseId,
    url: '{{baseUrl}}/ai-manager/process/detail',
    recordedAt: '2026-07-09T00:00:00.000Z',
    compiledBy: 'run-convention-golden',
    authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.processDetail', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
      {
        stepId: 'atstep_1',
        intentId: 'intent_2',
        atom: 'workflow.publish',
        action: 'click',
        semantic: { kind: 'role', role: 'button', name: broken ? '不存在按钮' : '发布', exact: true },
        text: broken ? '不存在按钮' : '发布',
      },
    ],
  };
}
function makeExpected(caseId) {
  return signExpected({
    caseId,
    channel: 'web',
    intents: [
      { intentId: 'intent_1', expected: [bsa('present', '发布'), bsa('present', '保存'), bsa('absent', '导出')] },
      { intentId: 'intent_2', expected: [bsa('present', '导出'), bsa('present', '新建版本'), bsa('absent', '发布')] },
    ],
    globalAssertions: [],
  });
}
function makeProfile() {
  return {
    background: [],
    successField: 'status',
    successValue: 200,
    routes: { workflowList: '/ai-manager/process/list' },
    buttons: { extraSelector: '.editor-btn' },
  };
}
function seedCase(caseId, { events = makeEvents(caseId), optional = true } = {}) {
  const dir = join(casesRoot, caseId);
  mkdirSync(dir, { recursive: true });
  const files = {
    dir,
    events: writeJson(join(dir, 'events.json'), events),
    expected: writeJson(join(dir, 'expected.frozen.json'), makeExpected(caseId)),
    profile: writeJson(join(dir, 'profile.json'), makeProfile()),
    observed: join(dir, `observed-${caseId}.json`),
    caseMeta: join(dir, 'testcase.json'),
  };
  if (optional) {
    writeJson(files.observed, { schemaVersion: 1, caseId, steps: [] });
    writeJson(files.caseMeta, {
      caseId,
      channel: 'web',
      title: 'run-convention 约定布局用例',
      naturalLanguage: '打开工作流详情并发布，确认发布态按钮翻面。',
      intentTextByIntent: { intent_1: '打开工作流详情', intent_2: '发布工作流' },
    });
  }
  return files;
}
const stableVerdict = (runDir) => readJson(join(runDir, 'verdict.json')).steps.map((s) => ({
  intentId: s.intentId,
  atom: s.atom,
  verdict: s.verdict,
  reason: s.reason,
}));
function assertReports(caseId, runDir) {
  for (const f of ['axes.json', 'verdict.json', 'report-model.json', 'run-history.jsonl', 'run-metrics.json']) {
    if (!existsSync(join(runDir, f))) throw new Error(`缺 run 产物 ${f}`);
  }
  for (const ext of ['html', 'md', 'json']) {
    if (!existsSync(join(runDir, `${caseId}.report.${ext}`))) throw new Error(`缺 ${caseId}.report.${ext}`);
  }
}
function assertAllPass(runDir) {
  const verdict = readJson(join(runDir, 'verdict.json'));
  const bad = verdict.steps.filter((s) => s.verdict !== 'PASS');
  if (bad.length) throw new Error(`verdict 应全 PASS，实际 ${JSON.stringify(bad)}`);
}

const srv = await startPublishSut({ scenario: 'happy' });
let a1RunDir = null;
try {
  await checkAsync('A1 约定布局全解析：只给 caseId + --sut 即 exit 0 并产报告', async () => {
    const caseId = 'tc_run_convention_a1';
    seedCase(caseId);
    a1RunDir = join(tmp, 'a1-run');
    const r = run([CASEY, 'run', caseId, '--sut', srv.url, '--run-dir', a1RunDir, '--no-video', '--generated-at', '2026-07-09T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`casey run 约定解析应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-500)}`);
    assertReports(caseId, a1RunDir);
    assertAllPass(a1RunDir);
  });

  await checkAsync('A2 显式旗标覆盖约定：约定 events 损坏但 --events 指正确文件仍 PASS', async () => {
    const caseId = 'tc_run_convention_a2';
    seedCase(caseId, { events: makeEvents(caseId, { broken: true }) });
    const explicitEvents = writeJson(join(tmp, 'a2-explicit-events.json'), makeEvents(caseId));
    const runDir = join(tmp, 'a2-run');
    const r = run([CASEY, 'run', caseId, '--sut', srv.url, '--events', explicitEvents, '--run-dir', runDir, '--no-video', '--generated-at', '2026-07-09T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`显式 --events 应覆盖损坏约定 events，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-500)}`);
    assertAllPass(runDir);
    const axes = readJson(join(runDir, 'axes.json'));
    if (axes.steps.length !== 2) throw new Error(`显式 events 应产生 2 步 axes，实际 ${axes.steps.length}`);
  });

  await checkAsync('A3 缺 caseId：exit 64 且报用法，不崩栈', async () => {
    const r = run([CASEY, 'run']);
    if (r.status !== 64) throw new Error(`缺 caseId 应 exit 64，实际 ${r.status}`);
    const out = (r.stderr || '') + (r.stdout || '');
    if (!out.includes('<caseId>') || !out.includes('--sut')) throw new Error(`用法输出应含 <caseId> 与 --sut，实际 ${out.slice(-300)}`);
  });

  await checkAsync('A4 必填约定件缺失：exit 64 点名缺件与约定相对路径；--sut 不进约定', async () => {
    for (const [label, leaf] of [['events', 'events.json'], ['expected', 'expected.frozen.json'], ['profile', 'profile.json']]) {
      const caseId = `tc_run_convention_missing_${label}`;
      const files = seedCase(caseId);
      const target = label === 'events' ? files.events : label === 'expected' ? files.expected : files.profile;
      writeFileSync(target, '', 'utf8');
      const { rmSync } = await import('node:fs');
      rmSync(target, { force: true });
      const r = run([CASEY, 'run', caseId, '--sut', srv.url, '--run-dir', join(tmp, `${caseId}-run`), '--no-video']);
      if (r.status !== 64) throw new Error(`${label} 缺失应 exit 64，实际 ${r.status}`);
      const out = (r.stderr || '') + (r.stdout || '');
      if (!out.includes(label) || !out.includes(relCases(caseId, leaf))) throw new Error(`${label} 缺失报文应点名 ${relCases(caseId, leaf)}，实际 ${out.slice(-500)}`);
    }
    const caseId = 'tc_run_convention_missing_sut';
    seedCase(caseId);
    const r = run([CASEY, 'run', caseId, '--run-dir', join(tmp, 'missing-sut-run'), '--no-video']);
    if (r.status !== 64) throw new Error(`缺 --sut 应 exit 64，实际 ${r.status}`);
    const out = (r.stderr || '') + (r.stdout || '');
    if (!out.includes('--sut')) throw new Error(`缺 --sut 报文应点名 --sut，实际 ${out.slice(-300)}`);
  });

  await checkAsync('A5 可选件缺失：照跑 exit 0，但 stderr 明示降级', async () => {
    const caseId = 'tc_run_convention_optional_missing';
    seedCase(caseId, { optional: false });
    const runDir = join(tmp, 'a5-run');
    const r = run([CASEY, 'run', caseId, '--sut', srv.url, '--run-dir', runDir, '--no-video', '--generated-at', '2026-07-09T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`可选件缺失仍应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-500)}`);
    if (!String(r.stderr || '').includes('降级')) throw new Error(`可选件缺失必须 stderr 明示降级，实际 stderr=${String(r.stderr || '').slice(-500)}`);
    assertReports(caseId, runDir);
  });

  await checkAsync('A6 全显式调用零行为差：全显式 verdict 与约定 verdict 稳定字段深等', async () => {
    const caseId = 'tc_run_convention_a6';
    const files = seedCase(caseId);
    const explicitRunDir = join(tmp, 'a6-explicit-run');
    const conventionRunDir = join(tmp, 'a6-convention-run');
    const explicit = run([CASEY, 'run', caseId, '--sut', srv.url, '--events', files.events, '--expected', files.expected, '--profile', files.profile,
      '--observed', files.observed, '--case-meta', files.caseMeta, '--run-dir', explicitRunDir, '--no-video', '--generated-at', '2026-07-09T00:00:00.000Z']);
    if (explicit.status !== 0) throw new Error(`全显式 run 应 exit 0，实际 ${explicit.status}：${((explicit.stderr || '') + (explicit.stdout || '')).slice(-500)}`);
    const convention = run([CASEY, 'run', caseId, '--sut', srv.url, '--run-dir', conventionRunDir, '--no-video', '--generated-at', '2026-07-09T00:00:00.000Z']);
    if (convention.status !== 0) throw new Error(`约定 run 应 exit 0，实际 ${convention.status}：${((convention.stderr || '') + (convention.stdout || '')).slice(-500)}`);
    if (!deepEq(stableVerdict(explicitRunDir), stableVerdict(conventionRunDir))) {
      throw new Error(`全显式与约定 verdict 稳定字段应深等，显式=${JSON.stringify(stableVerdict(explicitRunDir))} 约定=${JSON.stringify(stableVerdict(conventionRunDir))}`);
    }
  });

  await checkAsync('A7 casePaths 字段形状对齐真实布局，且 AT_CASES_DIR 生效', async () => {
    const modUrl = pathToFileURL(join(ROOT, 'lib', 'paths.mjs')).href + `?run-convention=${Date.now()}`;
    const { casePaths } = await import(modUrl);
    const cp = casePaths('tc_x');
    if (!cp.events.endsWith('tc_x/events.json')) throw new Error(`events 路径不符：${cp.events}`);
    if (!cp.expected.endsWith('tc_x/expected.frozen.json')) throw new Error(`expected 路径不符：${cp.expected}`);
    if (!cp.profile.endsWith('tc_x/profile.json')) throw new Error(`profile 路径不符：${cp.profile}`);
    if (!cp.observed.endsWith('tc_x/observed-tc_x.json')) throw new Error(`observed 路径不符：${cp.observed}`);
    if (!cp.caseMeta.endsWith('tc_x/testcase.json')) throw new Error(`caseMeta 路径不符：${cp.caseMeta}`);
    for (const k of ['spec', 'report', 'verdict']) if (Object.prototype.hasOwnProperty.call(cp, k)) throw new Error(`casePaths 不应再暴露误述布局键 ${k}`);
    if (!cp.dir.startsWith(casesRoot)) throw new Error(`AT_CASES_DIR 未生效：dir=${cp.dir} casesRoot=${casesRoot}`);

    const oldCwd = process.cwd();
    process.env.AT_CASES_DIR = 'relative-cases-root';
    process.chdir(tmp);
    try {
      const relModUrl = pathToFileURL(join(ROOT, 'lib', 'paths.mjs')).href + `?run-convention-rel=${Date.now()}`;
      const { casePaths: relCasePaths } = await import(relModUrl);
      const relCp = relCasePaths('tc_rel');
      const expectedRoot = join(ROOT, 'relative-cases-root');
      if (!relCp.dir.startsWith(expectedRoot)) throw new Error(`相对 AT_CASES_DIR 应按 PROJECT_ROOT 解析：dir=${relCp.dir} expectedRoot=${expectedRoot}`);
    } finally {
      process.chdir(oldCwd);
      process.env.AT_CASES_DIR = casesRoot;
    }
  });

  await checkAsync('A8 caseId 路径穿越硬拒：exit 64，不按约定越界探测', async () => {
    for (const badCaseId of ['../escape', 'nested/case', 'nested\\case', '/abs/case', '.', '..']) {
      const r = run([CASEY, 'run', badCaseId, '--sut', srv.url, '--run-dir', join(tmp, 'bad-case-run'), '--no-video']);
      if (r.status !== 64) throw new Error(`非法 caseId=${badCaseId} 应 exit 64，实际 ${r.status}`);
      const out = (r.stderr || '') + (r.stdout || '');
      if (!out.includes('caseId') || !out.includes('安全')) throw new Error(`非法 caseId 报文应点名安全约束，实际 ${out.slice(-500)}`);
      if (out.includes('cases/../') || out.includes('cases/nested/')) throw new Error(`非法 caseId 不应拼出越界约定路径，实际 ${out.slice(-500)}`);
    }
  });

  await checkAsync('A9 卫生：输出与文本产物无凭据形关键词，用参错误不回显 site.json/真目标', async () => {
    const offenders = [];
    const scanText = (label, text) => {
      const low = String(text).toLowerCase();
      for (const kw of FORBIDDEN_KEYWORDS) if (low.includes(kw)) offenders.push(`${label}⇒${kw}`);
    };
    (function walk(dir) {
      for (const n of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, n.name);
        if (n.isDirectory()) { walk(p); continue; }
        if (/\.(webm|png)$/.test(n.name)) continue;
        scanText(relative(tmp, p), readFileSync(p, 'utf8'));
      }
    })(tmp);
    stationOutputs.forEach((t, i) => scanText(`station-output[${i}]`, t));
    if (offenders.length) throw new Error(`凭据形关键词命中：${offenders.join('；')}`);
    const missing = stationOutputs.filter((x) => x.includes('缺') || x.includes('用法'));
    for (const out of missing) {
      if (out.includes('site.json') || out.includes(srv.url)) throw new Error(`用参错误输出不得回显 site.json 或 SUT 地址：${out.slice(-500)}`);
    }
    // 确认约定输入文件本身未被实现写坏。
    const a1Events = join(casesRoot, 'tc_run_convention_a1', 'events.json');
    const sha = createHash('sha256').update(readFileSync(a1Events, 'utf8')).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(sha)) throw new Error('sha256 自检异常');
  });
} finally {
  await srv.close();
}

console.log(`run-convention golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}

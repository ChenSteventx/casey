#!/usr/bin/env node
// bin/demo.mjs —— 端到端 hermetic 样例报告生成器（零外部依赖、零真机、零凭据）。
// 用途：一条命令跑出一份可直接打开的 Casey 测试报告样例，验证 replay→verdict→report 整条流水线能用。
//   node bin/casey.mjs demo   （门面直通；亦可直接 node bin/demo.mjs）
// 复刻 casey run 的相3→相4→相6 编排（bin/casey.mjs runPipeline），SUT 指向 tests/fixtures/publish-sut
// happy 夹具，不改仓库任何 lib/bin/web，只调既有冻结 bin。案例 = 工作流「发布」状态机（六条 buttonState
// 断言 present/absent），现场应全 PASS。产物落 runs/sample-wf-publish/（gitignored），HTML 自包含可离线打开。
//
// 提升自 scripts/sample-report.mjs（casey-demo 契约 GRILL D3 甲，编排语义一字不改），顺手清两处味道：
//   1. 不再 import 测试件 tests/_golden/_sign-helper.mjs（生产 bin 不引测试件）——签署字段内联为样例常量。
//   2. 打开路径提示不再字面替换某个 WSL 挂载点前缀；改用 wslpath 从真实产物路径真转换（GRILL D5），
//      非 WSL 环境或 wslpath 不可用则只给本机绝对路径，不臆造盘符。
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const bin = (n) => join(ROOT, 'bin', n);
const { startPublishSut } = await import(`file://${join(ROOT, 'tests', 'fixtures', 'publish-sut', 'server.mjs').replace(/\\/g, '/')}`);

const CASE_ID = 'tc_wf_publish_sample';
const runDir = join(ROOT, 'runs', 'sample-wf-publish');
if (existsSync(runDir)) rmSync(runDir, { recursive: true, force: true }); // 清建幂等：每次跑落同一处、覆盖上次
mkdirSync(join(runDir, 'video'), { recursive: true });

// —— 案例三件套（events / expected / profile）：工作流「发布」状态机 happy 场景 ——
const EVENTS = join(runDir, 'events.json');
writeFileSync(EVENTS, JSON.stringify({
  schemaVersion: 2, channel: 'web', caseId: CASE_ID,
  url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-06T00:00:00.000Z', compiledBy: 'sample-driver', authored: false,
  events: [
    { stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.processDetail', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
    { stepId: 'atstep_1', intentId: 'intent_2', atom: 'workflow.publish', action: 'click', semantic: { kind: 'role', role: 'button', name: '发布', exact: true }, text: '发布', fallbackCss: '.editor-btn:text-is("发布")' },
  ],
}, null, 2));

// 样例签署常量（内联，去 _sign-helper 测试件耦合）：signExpected 原本从「测试专用签署 helper」深盖这三字段
// 补齐已签契约形态；样例是固定语料、签署值本就恒定，直接把三字段写进断言字面量语义一字不变。
const SIGN = { signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'hermetic-b0', signerId: 'qa.hermetic' };
const bsa = (op, value) => ({ kind: 'buttonState', op, value, soft: false, ...SIGN });
const EXPECTED = join(runDir, 'expected.json');
writeFileSync(EXPECTED, JSON.stringify({
  caseId: CASE_ID, channel: 'web',
  intents: [
    { intentId: 'intent_1', expected: [bsa('present', '发布'), bsa('present', '保存'), bsa('absent', '导出')] },
    { intentId: 'intent_2', expected: [bsa('present', '导出'), bsa('present', '新建版本'), bsa('absent', '发布')] },
  ],
  globalAssertions: [],
}, null, 2));

const PROFILE = join(runDir, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/ai-manager/process/list' },
  buttons: { extraSelector: '.editor-btn' },
}, null, 2));

const axesOut = join(runDir, 'axes.json');
const verdictOut = join(runDir, 'verdict.json');
const modelOut = join(runDir, 'report-model.json');
const histOut = join(runDir, 'run-history.jsonl');
const metrOut = join(runDir, 'run-metrics.json');
const vdir = join(runDir, 'video');

function stage(label, binPath, args) {
  const r = spawnSync(process.execPath, [binPath, ...args], { encoding: 'utf8', timeout: 120000 });
  process.stdout.write(`  [${label}] exit=${r.status}\n`);
  if (r.status !== 0) { process.stderr.write(`    stderr: ${(r.stderr || '').slice(-500)}\n`); throw new Error(`${label} 非零退出 ${r.status}`); }
  return r;
}

const srv = await startPublishSut({ scenario: 'happy' });
try {
  stage('相3 replay 回放+录屏+取证', bin('replay.mjs'), [
    '--events', EVENTS, '--sut', srv.url, '--expected', EXPECTED, '--profile', PROFILE, '--out', axesOut,
    '--run-history', histOut, '--run-metrics', metrOut, '--run-id', 'sample-wf-publish', '--video-dir', vdir,
  ]);
  stage('相4 verdict 多态裁定（零 LLM）', bin('verdict.mjs'), ['--axes', axesOut, '--out', verdictOut]);
  const rmArgs = ['--verdict', verdictOut, '--axes', axesOut, '--events', EVENTS, '--expected', EXPECTED, '--out', modelOut];
  const vmeta = join(vdir, 'video.json');
  if (existsSync(vmeta)) rmArgs.push('--video-meta', vmeta);
  stage('装配 report-model', bin('report-model.mjs'), rmArgs);
  stage('相6 report 自包含报告', bin('report.mjs'), ['--model', modelOut, '--out', runDir, '--run-metrics', metrOut, '--run-history', histOut]);
} finally {
  await srv.close();
}

const htmlPath = join(runDir, `${CASE_ID}.report.html`);
console.log('\n样例报告已产出（可直接用浏览器打开）：');
console.log('  ' + htmlPath);
// 跨平台路径提示（不字面硬编码挂载点前缀，casey-demo GRILL D5）：WSL 下用 wslpath 从真实产物路径真转换出
// Windows 形态；非 WSL 或 wslpath 不可用（非 Windows 主机场景）则只给本机绝对路径，不臆造盘符。
const isWsl = process.platform === 'linux' && existsSync('/proc/version') && /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
if (isWsl) {
  const conv = spawnSync('wslpath', ['-w', htmlPath], { encoding: 'utf8' });
  if (!conv.error && conv.status === 0 && conv.stdout.trim()) console.log('  Windows: ' + conv.stdout.trim());
}

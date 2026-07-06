#!/usr/bin/env node
/**
 * casey —— LLM 驱动的「文本用例 → 测试报告」自动化测试 CLI。
 *
 * 生命周期（设计 §3，LLM 只在相0/1/2/5 出现；相3/4/6 是零 LLM 确定性）：
 *   相0 ingest   归一(L1)    excel/json/txt/freetext → 规范 TestCase
 *   相1 compile  编译(L3)    agent 真机跑一遍 → spec/events + observed（地面真值）
 *   相2 draft    断言草拟(L2) 从 intent + observed 推导带类型 expected[]
 *   相2 sign     人签门       人签掉冻结断言（gate 绿 ≠ 完成）
 *   相3 replay   回放(L0)     确定性重放 + 录屏 + 取证（零 LLM）
 *   相4 verdict  多态裁定(L0) verdict.mjs 判定树 → PASS/SUT_DEFECT/HARNESS_ERROR/NEEDS_HUMAN
 *   相5 heal     自愈(L3)     仅对确证 HARNESS_ERROR 的非就地有界重锚
 *   相6 report   报告(L0)     自包含 HTML + 裁定徽章 + 缺陷单
 *   run          端到端串起以上（MVP 串行单用例）
 *
 * loop 机制（薄壳直通 loop-kit）：lint / gate / breaker / contract。
 * selftest --tier1 = hermetic 链路自检（零外部依赖，验证确定性内核 + 统一语言双向有效）。
 *
 * 设计立场：本 CLI 是确定性引擎入口；skill 与 MCP server 都只是它的薄壳。
 * 退出码：0 成功；1 失败/红；2 熔断/互锁拦截；3 该阶段尚未实现（见计划 Pn）；64 用法错误。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, CASES_DIR, NODE_EXE, kit, casePaths } from '../lib/paths.mjs';

const C = { reset: '\x1b[0m', cyan: '\x1b[36m', gray: '\x1b[90m', yellow: '\x1b[33m', green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m' };
const col = (c, s) => `${c}${s}${C.reset}`;
const EXIT_NOT_IMPL = 3;

function parseArgs(argv) {
  const opts = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[a.slice(2)] = argv[++i];
      else opts[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { opts, pos };
}

function runNode(scriptAbs, args, { quiet = false } = {}) {
  const r = spawnSync(NODE_EXE, [scriptAbs, ...args], { cwd: PROJECT_ROOT, stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── loop 机制薄壳（直通 loop-kit）──────────────────────────────
function passThrough(kitScript, rest) {
  const r = runNode(kit(kitScript), rest);
  process.exit(r.code);
}

// ── 阶段桩：诚实声明未实现，绝不冒充已完成 ─────────────────────
function notImplemented(phase, planRef, willDo) {
  console.error(col(C.yellow, `\n[${phase}] 该阶段尚未实现（${planRef}）。`));
  console.error(col(C.gray, '本命令计划行为：') + willDo);
  console.error(col(C.gray, '当前已落地：') + 'P0 引导 loop 机制 + P1 DDD 词表/ADR（loop 纪律已生效）。');
  console.error(col(C.gray, '推进顺序见：') + 'docs/plans/bootstrap/plan.md\n');
  process.exit(EXIT_NOT_IMPL);
}

// ── run：确定性尾段编排（相3 回放 → 相4 裁定 → 报表模型装配 → 相6 报告）────
// LLM 前段（相0-2 ingest/compile/draft/sign）未建、route:human；本命令喂 compile产物直跑尾段。
function runPipeline(pos, opts) {
  const caseId = pos[0];
  // 确定性尾段已实现：缺必填参 = 用参错误 → exit 64（非 notImplemented 的 3）。相0-2 LLM 前段未建、route:human。
  if (!caseId || !opts.events || !opts.expected || !opts.profile || !opts.sut) {
    console.error(col(C.red, '[run] 缺必填参 → 用参错误(64)'));
    console.error('LLM 前段(相0-2 ingest/compile/draft/sign)未建、route:human；确定性尾段用法：');
    console.error('  casey run <caseId> --sut <url> --events <f> --expected <f> --profile <f> [--observed <f>] [--generated-at <iso>] [--case-meta <f>] [--run-dir <dir>] [--login-bootstrap] [--no-video]');
    console.error('  串 相3回放 → 相4裁定 → 报表模型装配 → 相6报告，落 runs/<caseId>/<runId>/。');
    process.exit(64);
  }
  const runDir = opts['run-dir'] || path.join(PROJECT_ROOT, 'runs', caseId, `run_${Date.now()}`);
  fs.mkdirSync(runDir, { recursive: true });
  const bin = (s) => path.join(PROJECT_ROOT, 'bin', s);
  const axesOut = path.join(runDir, 'axes.json');
  const verdictOut = path.join(runDir, 'verdict.json');
  const modelOut = path.join(runDir, 'report-model.json');

  // 退出码归一：各阶段自有码（replay 0/1/64、verdict 0/64/65、report 0/1/2）→ casey 统一图例；任一非零 fail-closed。
  const normCode = (code) => (code === 64 ? 64 : code === 2 ? 2 : 1);
  const stage = (label, scriptAbs, args) => {
    const r = runNode(scriptAbs, args, { quiet: true });
    if (r.code !== 0) {
      console.error(col(C.red, `[run] 阶段「${label}」非零退出（${r.code}）→ fail-closed`));
      if (r.stderr) console.error(col(C.gray, r.stderr.slice(-600)));
      process.exit(normCode(r.code));
    }
  };

  // --login-bootstrap 透传（同 compile --verify 先例）：真机跑过登录墙；hermetic 不带旗标零行为差。
  // 回放历史/回放指标接线（G6）：runId=runDir 目录名（本编排器是 runs/<caseId>/<runId>/ 布局唯一知情者）；
  // 仅诊断证据——相4 verdict 只吃 axes.json，绝不喂这两件（护栏 #15/#17）。
  // 录屏缺省开启（replay-video GRILL D4）：--no-video 显式关；视频与元数据旁件落本 runDir
  // （登录期不入镜由 replay 双 page 舞步结构保证）。仅诊断附件，绝不进相4 裁定（M7）。
  stage('相3 replay 回放', bin('replay.mjs'), ['--events', opts.events, '--sut', opts.sut, '--expected', opts.expected, '--profile', opts.profile, '--out', axesOut,
    '--run-history', path.join(runDir, 'run-history.jsonl'), '--run-metrics', path.join(runDir, 'run-metrics.json'), '--run-id', path.basename(runDir),
    ...(opts['login-bootstrap'] ? ['--login-bootstrap'] : []),
    ...(opts['no-video'] ? [] : ['--video-dir', runDir])]);
  stage('相4 verdict 裁定', bin('verdict.mjs'), ['--axes', axesOut, '--out', verdictOut]);
  // --expected 恒透传（report-fidelity G1）：run 必带该参，装配器读签署字段投影「期望版本/签署人」。
  const rmArgs = ['--verdict', verdictOut, '--axes', axesOut, '--events', opts.events, '--expected', opts.expected, '--out', modelOut];
  if (opts.observed) rmArgs.push('--observed', opts.observed);
  if (opts['generated-at']) rmArgs.push('--generated-at', opts['generated-at']);
  if (opts['case-meta']) rmArgs.push('--case-meta', opts['case-meta']);
  // 视频元数据旁件存在才透传（replay-video M5 缺席容忍：收敛失败/--no-video 时零行为差）。
  const videoMetaPath = path.join(runDir, 'video.json');
  if (!opts['no-video'] && fs.existsSync(videoMetaPath)) rmArgs.push('--video-meta', videoMetaPath);
  stage('报表模型装配', bin('report-model.mjs'), rmArgs);
  // 回放诊断呈现（report-diagnostics 路 B）：相3 恒产两旁件于本 runDir，相6 传路径进呈现层——仅诊断不进裁定。
  stage('相6 report 报告', bin('report.mjs'), ['--model', modelOut, '--out', runDir,
    '--run-history', path.join(runDir, 'run-history.jsonl'), '--run-metrics', path.join(runDir, 'run-metrics.json')]);

  console.log(col(C.green, `\n[run] 端到端（确定性尾段）GREEN → ${runDir}`));
  const videoNote = fs.existsSync(path.join(runDir, 'video.webm')) ? ' / video.webm / video.json' : '';
  console.log(col(C.gray, `  axes.json / verdict.json / report-model.json / run-history.jsonl / run-metrics.json / ${caseId}.report.{html,md,json}${videoNote}`));
  process.exit(0);
}

// ── selftest tier1：hermetic 链路自检 ─────────────────────────
function selftestTier1() {
  console.log(col(C.bold, '\ncasey selftest --tier1 —— hermetic 链路自检（零外部依赖）\n'));
  let ok = true;
  const step = (name, fn) => {
    try { const pass = fn(); ok = ok && pass; console.log(`${pass ? col(C.green, 'ok  ') : col(C.red, 'RED ')} ${name}`); }
    catch (e) { ok = false; console.log(`${col(C.red, 'RED ')} ${name} —— ${e.message}`); }
  };

  // 1. 统一语言：注册表完整（白名单方向）
  step('统一语言注册表完整（term-lint --registry exit 0）', () => runNode(kit('term-lint.mjs'), ['--registry'], { quiet: true }).code === 0);

  // 2. 统一语言：弃用别名被拦（黑名单方向——证明机制真有牙）
  step('弃用别名被 term-lint 拦红（黑名单方向）', () => {
    const tmp = path.join(CASES_DIR, '_selftest'); fs.mkdirSync(tmp, { recursive: true });
    const f = path.join(tmp, 'deny.md');
    fs.writeFileSync(f, '# 自检\n\n这里故意用一个弃用别名「出口闸」来验证黑名单。\n', 'utf8');
    const code = runNode(kit('term-lint.mjs'), ['--file', f], { quiet: true }).code;
    return code === 1; // 命中弃用别名应 exit 1
  });

  // 3. 熔断器可清零
  step('熔断器可清零（breaker --reset exit 0）', () => runNode(kit('breaker.mjs'), ['--reset'], { quiet: true }).code === 0);

  // 4. 质量门禁：可执行规格 exit 0 → 确定性裁判翻绿
  step('质量门禁消费 1-story 契约并翻绿（gate exit 0 + passes 翻 true）', () => {
    const tmp = path.join(CASES_DIR, '_selftest'); fs.mkdirSync(tmp, { recursive: true });
    const prd = path.join(tmp, 'prd-_selftest.json');
    fs.writeFileSync(prd, JSON.stringify({
      schemaVersion: 1,
      task: 'tier1 自检：可执行规格 exit 0 即翻绿',
      stories: [{ id: 'tier1', desc: 'hermetic 自检 story', lane: 'implementation', acceptance: ['node -e "process.exit(0)"'], passes: false }],
      testChecksums: {},
    }, null, 2), 'utf8');
    const code = runNode(kit('gate.mjs'), ['--prd', 'cases/_selftest/prd-_selftest.json'], { quiet: true }).code;
    const flipped = JSON.parse(fs.readFileSync(prd, 'utf8')).stories[0].passes === true;
    return code === 0 && flipped;
  });

  // 5. 裁判零 LLM（护栏 #15，I1）：verdict.mjs 依赖闭包无 LLM/网络客户端（model-lane-guard 契约）
  step('裁判零 LLM：verdict.mjs 闭包无 LLM/网络客户端（verdict-purity-guard exit 0）', () =>
    runNode(path.join(PROJECT_ROOT, 'bin', 'verdict-purity-guard.mjs'),
      ['--entry', path.join(PROJECT_ROOT, 'bin', 'verdict.mjs')], { quiet: true }).code === 0);

  // 清理临时产物
  try { fs.rmSync(path.join(CASES_DIR, '_selftest'), { recursive: true, force: true }); } catch { /* ignore */ }

  console.log('');
  if (ok) { console.log(col(C.green, 'selftest --tier1: 全链路 GREEN —— 确定性内核 + 统一语言双向有效。')); process.exit(0); }
  console.log(col(C.red, 'selftest --tier1: 有红 —— 确定性内核未就绪。')); process.exit(1);
}

function help() {
  console.log(`${col(C.bold, 'casey')} —— 文本用例 → 测试报告 自动化测试（loop engineering 驱动）

${col(C.cyan, '端到端')}
  casey run <caseId> --sut <本地基址> --events <f> --expected <f> --profile <f> [--run-dir <d> --login-bootstrap --no-video]
                                          相3-4-6 编排：回放→裁定→装配→报告（相0-2 前段先各自跑完备料）
                                          --sut 只喂隧道回环基址（site.json 的 devProxyUrl）或夹具地址；真目标地址绝不进命令行（护栏 #7）

${col(C.cyan, '生命周期分步')}（LLM 只在 ingest/compile/draft/sign-辅助/heal；replay/verdict/report 零 LLM）
  casey ingest  <caseId> --in <f> --out-dir <d>
                                          相0 归一：候选（CLI 外 LLM 产）→ 校验 → 规范 TestCase
  casey compile <caseId> --testcase <f> --flow <f> --out-dir <d>
                                          相1 编译闸段（落 flow 待人 confirm）；执行段加 --execute --sut <本地基址> --profile <f> [--skip-login --unique-name <t>]
  casey flow-bridge <caseId> --testcase <f> --mapping <f> --out-dir <d>
                                          相1 flow 草拟桥：TestCase + mapping → compile 的 --flow
  casey draft   <caseId> --observed <f> --compile-report <f> --out-dir <d> [--patch <f>]
                                          相2 断言草拟：骨架+补缝合并+闸 → expected.draft（未签）
  casey sign    <caseId> --draft <f> --prd <f> --frozen-out <f> --signer <id> --against-build <id> [--signed-at <iso> --verdict-baseline <f> --resign --force --archive-dir <d>]
                                          相2 人签门：草稿→冻结签署（未签契约会被回放前置闸拒）
  casey replay  --events <f> --sut <本地基址> --expected <f> --profile <f> --out <axes.json> [--login-bootstrap ...]
                                          相3 确定性回放 + 录屏 + 取证（未签契约拒回放）
  casey verdict --axes <f> --out <f>      相4 多态裁定（零 LLM 判定树）
  casey heal    <caseId>                  相5 自愈：仅对确证 HARNESS_ERROR 非就地重锚      [P6]
  casey report  --model <f> --out <d> [--run-history <f> --run-metrics <f>]
                                          相6 自包含报告 + 裁定徽章 + 缺陷单

${col(C.cyan, 'loop 机制')}（薄壳直通 loop-kit；纪律已生效）
  casey lint [--registry|--file <...>]    统一语言检查（term-lint）
  casey gate     [--prd <path>] [...]     质量门禁（确定性裁判，唯一写 passes）
  casey breaker  [--reset|--round ...]    熔断器
  casey contract [init|advance|check|show] ...  Loop Contract 阶段台账

${col(C.cyan, '自检')}
  casey selftest --tier1                  hermetic 链路自检（零外部依赖）                 [可用]
  casey selftest --tier2                  live smoke（需 site.json + creds，route:human） [P9]

退出码：0 成功；1 红；2 熔断/互锁；3 该阶段未实现；64 用法错误。
进度：七相全建（heal 唯一诚实桩）+ hermetic 全链金牌贯通；真机端到端 route:human——权威现状见 docs/HANDOFF.md。`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { opts, pos } = parseArgs(rest);

  switch (cmd) {
    case undefined: case 'help': case '--help': case '-h': return help();

    // loop 机制直通
    case 'lint': return passThrough('term-lint.mjs', rest.length ? rest : ['--registry']);
    case 'gate': return passThrough('gate.mjs', rest);
    case 'breaker': return passThrough('breaker.mjs', rest);
    case 'contract': return passThrough('contract.mjs', rest);

    // 自检
    case 'selftest':
      if (opts.tier2) return notImplemented('selftest --tier2', 'P9 两层 selftest + 真机 UAT', 'live smoke：需 site.json + creds，覆盖 SUT_DEFECT/取证/流式分支，gated route:human。');
      return selftestTier1();

    // 生命周期（当前为诚实桩，逐阶段实现）
    // 相0 归一：LLM 在 CLI 外产候选，本 CLI 是 L0 确定性校验器（parseTestCase，fail-closed）。
    case 'ingest': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'ingest.mjs'), rest); process.exit(r.code); }
    // 相1 编译（P3）：三段式确定性 CLI（闸+confirm 门 / 执行 / 回放核验），LLM 只在 CLI 外产 flow 草稿。
    case 'compile': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'compile.mjs'), rest); process.exit(r.code); }
    case 'draft': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'draft.mjs'), rest); process.exit(r.code); }
    case 'flow-bridge': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'flow-bridge.mjs'), rest); process.exit(r.code); }
    case 'sign': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'sign.mjs'), rest); process.exit(r.code); }
    // 相3/4/6 直通各自 bin（参数契约归各 bin 自管，同 compile/draft/sign/flow-bridge/ingest 五先例；
    // 此前为桩而底层 bin 早已建成、run 编排内部直连在用——cli-mcp-face 契约接通门面）。
    case 'replay': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'replay.mjs'), rest); process.exit(r.code); }
    case 'verdict': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'verdict.mjs'), rest); process.exit(r.code); }
    case 'heal':    return notImplemented('相5 heal 自愈', 'P6 自愈准入门 + 非就地有界自愈', '仅对确证 HARNESS_ERROR：重锚 → 写 drift 补丁旁文件（原 spec 不变）→ 人签后应用 → 重跑。');
    case 'report': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'report.mjs'), rest); process.exit(r.code); }
    case 'run':     return runPipeline(pos, opts);

    default:
      console.error(col(C.red, `未知命令：${cmd}`));
      console.error('跑 `casey help` 看命令表。');
      process.exit(64);
  }
}

main();

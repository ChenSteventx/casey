#!/usr/bin/env node
/**
 * casey MCP server —— Casey CLI 的 MCP 薄壳（stdio 传输，newline-delimited JSON-RPC 2.0）。
 *
 * 设计立场（同 skill）：本 server 不含任何裁定/LLM 逻辑，只把 MCP tools/call 映射到 `bin/casey.mjs`
 * 的确定性命令并回传 stdout/stderr/exitCode。裁判零 LLM、fail-safe 等内核全在 CLI/loop-kit 里。
 *
 * 零第三方依赖（不需要 @modelcontextprotocol/sdk）：手写最小 stdio 协议，便于 P0 即可挂载。
 * 退出码语义透传：tools/call 结果里带 exitCode（3 = 该阶段未实现），调用方据此区分「跑完」与「未实现」。
 *
 * 挂载（WSL 侧——回放依赖 Linux 侧 playwright，Windows 侧挂载必败，G6 人签约束）：
 *   跑 `casey mcp-config --agent <claude|codex>` 自适应吐出本仓正确挂载配置（免手抄改盘符）；
 *   详见 README「MCP 挂载」与仓根 AGENTS.md。
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'casey.mjs');
// 版本单源：从 package.json 读（唯一事实源，GRILL D4）——不再写死字面量，日后 bump 一处即两处同步。
const SERVER_INFO = { name: 'casey', version: JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version };
const log = (...a) => process.stderr.write(`[casey-mcp] ${a.join(' ')}\n`); // 诊断只走 stderr，绝不污染 stdout 协议流

// 工具目录：每个工具映射成一组 casey CLI 参数（cli-mcp-face 契约对齐 CLI 真面：inputSchema 逐字对齐
// 各 bin 真实旗标；toArgs 只对在场值拼旗标——空参调用透传到 CLI 落真实用法错码，绝不在壳里预判）。
// flag(k,v)：值在场才产 ['--k', v]；boolFlag：true 才产 ['--k']。
const flag = (k, v) => (v === undefined || v === null || v === '' ? [] : [`--${k}`, String(v)]);
const boolFlag = (k, v) => (v ? [`--${k}`] : []);
function compatibleValue(args, currentKey, legacyKey) {
  const current = args[currentKey];
  const legacy = args[legacyKey];
  if (current !== undefined && legacy !== undefined && String(current) !== String(legacy)) {
    throw new TypeError(`${currentKey} 与 deprecated ${legacyKey} 冲突`);
  }
  return current !== undefined ? current : legacy;
}

function signEntityArgs(args) {
  const draft = compatibleValue(args, 'entityBindingsDraft', 'entityLocksDraft');
  const confirmations = compatibleValue(args, 'entityConfirmations', 'entityLocksConfirm');
  const out = compatibleValue(args, 'entityLocksOut', 'entityLocksFrozen');
  return [
    ...flag('events', args.events),
    ...flag('entity-bindings-draft', draft),
    ...flag('entity-confirmations', confirmations),
    ...flag('entity-locks-out', out),
  ];
}
// export：漂移锁金牌直接对 toArgs 做 argv 映射表断言（cli-mcp-face 契约 codex R1-F1）；服务行为零变。
export const TOOLS = [
  {
    name: 'casey_selftest',
    description: 'hermetic 链路自检（零外部依赖）：验证确定性内核 + 统一语言双向有效。',
    inputSchema: { type: 'object', properties: { tier: { type: 'string', enum: ['tier1'], default: 'tier1' } } },
    toArgs: () => ['selftest', '--tier1'],
  },
  {
    name: 'casey_lint',
    description: '统一语言检查（term-lint）。target=registry 查注册表完整性；或传文件路径查违例。',
    inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'registry 或文件路径' } } },
    toArgs: (a) => (a.target && a.target !== 'registry' ? ['lint', '--file', a.target] : ['lint', '--registry']),
  },
  {
    name: 'casey_gate',
    description: '质量门禁（确定性裁判，唯一写 passes）。可传 prd 契约路径。',
    inputSchema: { type: 'object', properties: { prd: { type: 'string' } } },
    toArgs: (a) => (a.prd ? ['gate', '--prd', a.prd] : ['gate']),
  },
  {
    name: 'casey_ingest',
    description: '相0 归一：候选 TestCase JSON（LLM 在 CLI 外把杂乱原文归一成候选）→ 确定性 parseTestCase 校验 → testcase-<caseId>.json（喂相1）。闸拒 exit 65 零落盘；凭据门前置扫输入原文 exit 1。',
    inputSchema: { type: 'object', required: ['caseId', 'in', 'outDir'], properties: { caseId: { type: 'string' }, in: { type: 'string', description: '候选 JSON 文件路径' }, outDir: { type: 'string' } } },
    toArgs: (a) => ['ingest', ...(a.caseId ? [a.caseId] : []), ...flag('in', a.in), ...flag('out-dir', a.outDir)],
  },
  {
    name: 'casey_flow_bridge',
    description: '相1 flow 草拟桥：规范 TestCase + LLM mapping（CLI 外产 [{intentId,atom,params}]）→ 过三闸（投影忠实/编译知识允许集/compile-gate）→ flow-<caseId>.json（compile 的 --flow 输入）。闸拒 exit 65 零落盘。',
    inputSchema: { type: 'object', required: ['caseId', 'testcase', 'mapping', 'outDir'], properties: { caseId: { type: 'string' }, testcase: { type: 'string' }, mapping: { type: 'string' }, outDir: { type: 'string' } } },
    toArgs: (a) => ['flow-bridge', ...(a.caseId ? [a.caseId] : []), ...flag('testcase', a.testcase), ...flag('mapping', a.mapping), ...flag('out-dir', a.outDir)],
  },
  {
    name: 'casey_compile',
    description: '相1 编译三段式：闸段（--testcase --flow --out-dir，落 flow 文档待人 confirm）；执行段（--execute --sut --profile，须 flow 已 confirm，落 events/observed/compile-report）；核验段（--verify --sut --profile）。未 confirm 执行 exit 66。',
    inputSchema: { type: 'object', required: ['caseId', 'testcase', 'outDir'], properties: { caseId: { type: 'string' }, testcase: { type: 'string' }, flow: { type: 'string' }, outDir: { type: 'string' }, execute: { type: 'boolean' }, verify: { type: 'boolean' }, sut: { type: 'string' }, profile: { type: 'string' }, entityAuthority: { type: 'string', description: 'compile --execute 的预执行身份授权' }, entityLocks: { type: 'string', description: 'compile --verify 的最终 frozen locks' }, skipLogin: { type: 'boolean' }, loginBootstrap: { type: 'boolean' }, uniqueName: { type: 'string' } } },
    toArgs: (a) => ['compile', ...(a.caseId ? [a.caseId] : []), ...boolFlag('execute', a.execute), ...boolFlag('verify', a.verify), ...flag('testcase', a.testcase), ...flag('flow', a.flow), ...flag('out-dir', a.outDir), ...flag('sut', a.sut), ...flag('profile', a.profile), ...flag('entity-authority', a.entityAuthority), ...flag('entity-locks', a.entityLocks), ...boolFlag('skip-login', a.skipLogin), ...boolFlag('login-bootstrap', a.loginBootstrap), ...flag('unique-name', a.uniqueName)],
  },
  {
    name: 'casey_draft',
    description: '相2 断言草拟：observed + compile-report 骨架查表映射 + 可选 --patch（LLM 补缝，CLI 外产）→ validateDraft 闸 → expected.draft-<caseId>.json（未签草稿）。违规整份拒 exit 65。',
    inputSchema: { type: 'object', required: ['caseId', 'observed', 'compileReport', 'outDir'], properties: { caseId: { type: 'string' }, observed: { type: 'string' }, compileReport: { type: 'string' }, outDir: { type: 'string' }, patch: { type: 'string' } } },
    toArgs: (a) => ['draft', ...(a.caseId ? [a.caseId] : []), ...flag('observed', a.observed), ...flag('compile-report', a.compileReport), ...flag('out-dir', a.outDir), ...flag('patch', a.patch)],
  },
  {
    name: 'casey_sign',
    description: '相2 人签门：草稿 → 冻结签署 + PRD checksum；实体语义锁须把 events、entityBindingsDraft、entityConfirmations、entityLocksOut 四件成组传入。缺件由 CLI exit 64，绝不静默只签 expected。签署人身份归人、本工具只代跑 CLI。',
    inputSchema: { type: 'object', required: ['caseId', 'draft', 'prd', 'frozenOut', 'signer', 'againstBuild'], properties: { caseId: { type: 'string' }, draft: { type: 'string' }, prd: { type: 'string' }, frozenOut: { type: 'string' }, signer: { type: 'string' }, againstBuild: { type: 'string' }, signedAt: { type: 'string' }, verdictBaseline: { type: 'string' }, resign: { type: 'boolean' }, force: { type: 'boolean' }, archiveDir: { type: 'string' }, events: { type: 'string', description: '最终 events v2 原字节路径；实体锁四件套之一' }, entityBindingsDraft: { type: 'string', description: 'compile 产 entity-bindings.draft.json' }, entityConfirmations: { type: 'string', description: '人确认 receipts 文件' }, entityLocksOut: { type: 'string', description: '固定名 entity-locks.frozen.json' }, entityLocksDraft: { type: 'string', deprecated: true, description: '旧名兼容；等价 entityBindingsDraft' }, entityLocksConfirm: { type: 'string', deprecated: true, description: '旧名兼容；等价 entityConfirmations' }, entityLocksFrozen: { type: 'string', deprecated: true, description: '旧名兼容；等价 entityLocksOut' } } },
    toArgs: (a) => ['sign', ...(a.caseId ? [a.caseId] : []), ...flag('draft', a.draft), ...flag('prd', a.prd), ...flag('frozen-out', a.frozenOut), ...flag('signer', a.signer), ...flag('against-build', a.againstBuild), ...flag('signed-at', a.signedAt), ...flag('verdict-baseline', a.verdictBaseline), ...boolFlag('resign', a.resign), ...boolFlag('force', a.force), ...flag('archive-dir', a.archiveDir), ...signEntityArgs(a)],
  },
  {
    name: 'casey_record',
    description: '示教录制：真浏览器打开 --sut 让人操作，抓成 teach-in-capture.json（signed=false / replayReady=false / distillRequired=true）。只作蒸馏语料，不签署、不直通回放。--login-bootstrap 与 --no-login 互斥（缺或双给由 CLI 落 exit 64）；--from-events 走非浏览器路径（既有事件夹具直接成包，hermetic）。',
    inputSchema: { type: 'object', required: ['caseId', 'sut', 'outDir'], properties: { caseId: { type: 'string' }, sut: { type: 'string' }, outDir: { type: 'string' }, loginBootstrap: { type: 'boolean' }, noLogin: { type: 'boolean' }, fromEvents: { type: 'string' }, headless: { type: 'boolean' }, maxMs: { type: 'string' } } },
    toArgs: (a) => ['record', ...(a.caseId ? [a.caseId] : []), ...flag('sut', a.sut), ...flag('out-dir', a.outDir), ...boolFlag('login-bootstrap', a.loginBootstrap), ...boolFlag('no-login', a.noLogin), ...flag('from-events', a.fromEvents), ...boolFlag('headless', a.headless), ...flag('max-ms', a.maxMs)],
  },
  {
    name: 'casey_intake',
    description: '示教入账：安全复核录制包（凭据门 / URL 泄漏 / 重复键 / 形态 fail-closed）→ 登记入账台账 intake-ledger.jsonl（accepted/rejected + capture sha256）。不转形、不签署、不回放；拒账 fail-closed exit 65。--capture 须落 <caseId>/record-capture/teach-in-capture.json 规范布局。',
    inputSchema: { type: 'object', required: ['caseId', 'capture'], properties: { caseId: { type: 'string' }, capture: { type: 'string' } } },
    toArgs: (a) => ['intake', ...(a.caseId ? [a.caseId] : []), ...flag('capture', a.capture)],
  },
  {
    name: 'casey_replay',
    description: '相3 确定性回放（零 LLM）：events + 已签 expected + profile → 真浏览器回放 --sut → 三轴 axes.json（+可选录屏/回放历史/回放指标）。未签契约/caseId 不符 exit 65 零 axes。',
    inputSchema: { type: 'object', required: ['events', 'sut', 'expected', 'profile', 'out'], properties: { events: { type: 'string' }, sut: { type: 'string' }, expected: { type: 'string' }, profile: { type: 'string' }, out: { type: 'string' }, 'entityLocks': { type: 'string', description: '写链必需；纯只读链可省略，由 replay 内部固定 policy 裁定' }, loginBootstrap: { type: 'boolean' }, runHistory: { type: 'string' }, runMetrics: { type: 'string' }, runId: { type: 'string' }, videoDir: { type: 'string' } } },
    toArgs: (a) => ['replay', ...flag('events', a.events), ...flag('sut', a.sut), ...flag('expected', a.expected), ...flag('profile', a.profile), ...flag('out', a.out), ...flag('entity-locks', a.entityLocks), ...boolFlag('login-bootstrap', a.loginBootstrap), ...flag('run-history', a.runHistory), ...flag('run-metrics', a.runMetrics), ...flag('run-id', a.runId), ...flag('video-dir', a.videoDir)],
  },
  {
    name: 'casey_verdict',
    description: '相4 多态裁定（零 LLM 判定树）：axes.json → 每步 PASS/SUT_DEFECT/HARNESS_ERROR/NEEDS_HUMAN(+reason) → verdict.json。fail-safe：证不出一律 NEEDS_HUMAN，绝不静默 PASS。',
    inputSchema: { type: 'object', required: ['axes', 'out'], properties: { axes: { type: 'string' }, out: { type: 'string' } } },
    toArgs: (a) => ['verdict', ...flag('axes', a.axes), ...flag('out', a.out)],
  },
  {
    name: 'casey_report',
    description: '相6 自包含报告（零 LLM 渲染）：report-model.json → <caseId>.report.{html,md,json}（裁定徽章 + 期望对实际 + 缺陷单仅 SUT_DEFECT；可选回放诊断旁件）。注意：本命令用法错历史码为 exit 2。',
    inputSchema: { type: 'object', required: ['model', 'out'], properties: { model: { type: 'string' }, out: { type: 'string' }, runHistory: { type: 'string' }, runMetrics: { type: 'string' } } },
    toArgs: (a) => ['report', ...flag('model', a.model), ...flag('out', a.out), ...flag('run-history', a.runHistory), ...flag('run-metrics', a.runMetrics)],
  },
  {
    name: 'casey_run',
    description: '相3-4-6 编排：回放 → 裁定 → 装配 → 报告，产物落 --run-dir（缺省 runs/<caseId>/run_<ts>/）。相0-2 前段（ingest/flow-bridge/compile/draft/sign）须先各自跑完备好 events 与已签 expected。',
    inputSchema: { type: 'object', required: ['caseId', 'sut', 'events', 'expected', 'profile'], properties: { caseId: { type: 'string' }, sut: { type: 'string' }, events: { type: 'string' }, expected: { type: 'string' }, profile: { type: 'string' }, 'entityLocks': { type: 'string', description: '写链必需；纯只读链可省略，由 replay 内部固定 policy 裁定' }, observed: { type: 'string' }, generatedAt: { type: 'string' }, caseMeta: { type: 'string' }, runDir: { type: 'string' }, loginBootstrap: { type: 'boolean' }, noVideo: { type: 'boolean' } } },
    toArgs: (a) => ['run', ...(a.caseId ? [a.caseId] : []), ...flag('sut', a.sut), ...flag('events', a.events), ...flag('expected', a.expected), ...flag('profile', a.profile), ...flag('entity-locks', a.entityLocks), ...flag('observed', a.observed), ...flag('generated-at', a.generatedAt), ...flag('case-meta', a.caseMeta), ...flag('run-dir', a.runDir), ...boolFlag('login-bootstrap', a.loginBootstrap), ...boolFlag('no-video', a.noVideo)],
  },
];
const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function callCli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
  const exitCode = r.status ?? 1;
  const body = [r.stdout, r.stderr].filter(Boolean).join('\n').trim() || '(无输出)';
  // 在文本里显式标注退出码语义，让调用方/模型不把 exit 3 桩当成已完成。
  const note = exitCode === 3 ? '\n\n[exitCode=3] 该阶段尚未实现（见 docs/plans/bootstrap/plan.md），不是测试结论。' : `\n\n[exitCode=${exitCode}]`;
  return { content: [{ type: 'text', text: body + note }], isError: exitCode !== 0 && exitCode !== 3 };
}

function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOL_BY_NAME.get(params?.name);
      if (!tool) return fail(-32602, `未知工具：${params?.name}`);
      try { return reply(callCli(tool.toArgs(params.arguments || {}))); }
      catch (e) { return fail(-32603, `执行失败：${e.message}`); }
    }
    default:
      if (id === undefined) return null; // 通知（如 notifications/initialized）：不回复
      return fail(-32601, `未实现的方法：${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { log('收到非 JSON 行，忽略'); return; }
  const out = handle(msg);
  if (out) process.stdout.write(JSON.stringify(out) + '\n');
});
log(`casey MCP server 就绪（${TOOLS.length} 个工具）。CLI=${CLI}`);

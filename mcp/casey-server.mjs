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
 * 挂载（Claude Code）：
 *   claude mcp add casey -- node D:\\ctx\\heren\\casey\\mcp\\casey-server.mjs
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'casey.mjs');
const SERVER_INFO = { name: 'casey', version: '0.1.0' };
const log = (...a) => process.stderr.write(`[casey-mcp] ${a.join(' ')}\n`); // 诊断只走 stderr，绝不污染 stdout 协议流

// 工具目录：每个工具映射成一组 casey CLI 参数。
const TOOLS = [
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
    name: 'casey_run',
    description: '端到端：文本用例 → 测试报告（归一→编译→草拟→人签→回放→裁定→报告，MVP 串行单用例）。注意：当前多阶段为诚实桩，exitCode=3 表示该阶段未实现。',
    inputSchema: { type: 'object', required: ['file'], properties: { file: { type: 'string' }, channel: { type: 'string', enum: ['web', 'cef', 'arbitrary'] } } },
    toArgs: (a) => ['run', a.file, ...(a.channel ? ['--channel', a.channel] : [])],
  },
  {
    name: 'casey_verdict',
    description: '多态裁定（零 LLM 判定树）：对某条用例出 PASS/SUT_DEFECT/HARNESS_ERROR/NEEDS_HUMAN。',
    inputSchema: { type: 'object', required: ['caseId'], properties: { caseId: { type: 'string' } } },
    toArgs: (a) => ['verdict', a.caseId],
  },
  {
    name: 'casey_report',
    description: '出自包含测试报告（操作说明 + 录屏 + 文本输出 + 裁定徽章 + 缺陷单 + trace）。',
    inputSchema: { type: 'object', required: ['caseId'], properties: { caseId: { type: 'string' } } },
    toArgs: (a) => ['report', a.caseId],
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

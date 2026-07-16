#!/usr/bin/env node
// bin/mcp-config.mjs —— casey MCP 挂载配置打印器（distribution，GRILL D2-D6）。
// 自适应从模块位置解析仓根 → 挂载脚本绝对路径（path.join(PROJECT_ROOT,'mcp','casey-server.mjs')，
//   绝不硬编码盘符，F10「手抄改路径」根治点），按 --agent 吐各家 MCP 挂载配置。
// 纯打印器：零 LLM、零外部依赖、零真机、不 import/不读 site.json/.auth、结构上不含 --sut/目标地址
//   （护栏 #7 边界外——挂载配置只含启动器 node + server 脚本路径）。缺/错 --agent → fail-closed exit 64。
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NODE_EXE, PROJECT_ROOT } from '../lib/paths.mjs';

const SUPPORTED = ['claude', 'codex'];

// TOML 基本字符串转义（basic string 转义子集，覆盖挂载路径可能出现的字符）：
//   先转义 `\`（否则下一步为 `"` 补的反斜杠会被当成路径原有反斜杠一起吃进去）、再转义 `"`。
//   Windows 挂载路径（WSL/Windows 挂载场景）天然含反斜杠分隔符，不转义直接拼进 TOML 字符串会产坏 TOML
//   （跨族评审 mustFix：bin/mcp-config.mjs codex 段 serverAbs 未转义）。
export function tomlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// POSIX shell 单引号转义：单引号包裹后，其内一切字符（空格/双引号/反斜杠等）均为字面量，唯一例外是
//   单引号本身——标准写法拆成 `'\''`（闭合当前引号、插一个转义单引号、重开新引号）。
//   （跨族评审 mustFix：bin/mcp-config.mjs claude 段一行命令 serverAbs 未 shell-quote）。
export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export function powershellQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
    else o[k] = true;
  }
  return o;
}

function dieUsage(msg) {
  console.error(`mcp-config: ${msg}`);
  console.error(`用法: casey mcp-config --agent <${SUPPORTED.join('|')}>`);
  console.error(`支持的 agent：${SUPPORTED.join(' / ')}（缺/错 --agent 即 fail-closed，绝不静默默认成某一家，避免把一家配置错喂给另一家）`);
  process.exit(64);
}

// WSL 侧运行须知（G6 人签约束复述；不含任何目标地址/凭据）。
const RUNTIME_NOTE = process.platform === 'win32'
  ? '当前配置绑定 Windows 原生 Node.js；安装/MCP 可直接使用。真实回放仍须 PowerShell 回环代理与完整真实 UAT 证据。'
  : '当前配置绑定执行本命令的 Node.js；请始终在实际运行 Casey 的同一 OS/clone 中生成配置。';

function printClaude(serverAbs) {
  const snippet = { mcpServers: { casey: { command: NODE_EXE, args: [serverAbs] } } };
  console.log('casey MCP 挂载配置 —— claude code');
  console.log('');
  console.log('形态一：粘进仓根 .mcp.json 的 mcpServers（项目级）：');
  console.log('');
  console.log(JSON.stringify(snippet, null, 2));
  console.log('');
  console.log('形态二：一行等效命令（在仓根执行）：');
  console.log(process.platform === 'win32'
    ? `  claude mcp add casey -- ${powershellQuote(NODE_EXE)} ${powershellQuote(serverAbs)}`
    : `  claude mcp add casey -- ${shellQuote(NODE_EXE)} ${shellQuote(serverAbs)}`);
  console.log('');
  console.log(RUNTIME_NOTE);
}

function printCodex(serverAbs) {
  console.log('casey MCP 挂载配置 —— codex');
  console.log('');
  console.log('追加到 ~/.codex/config.toml：');
  console.log('');
  console.log('[mcp_servers.casey]');
  console.log(`command = "${tomlEscape(NODE_EXE)}"`);
  console.log(`args = ["${tomlEscape(serverAbs)}"]`);
  console.log('');
  if (process.platform === 'win32') console.log(`Windows 当前 Node.js 启动器：${NODE_EXE}`);
  if (process.platform === 'win32') console.log('');
  console.log(RUNTIME_NOTE);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const agent = opts.agent;
  // 缺值（裸旗标记 true）或空值 → fail-closed，不降级。
  if (agent === undefined || agent === true || String(agent).trim() === '') dieUsage('缺 --agent（须带值）');
  if (!SUPPORTED.includes(agent)) dieUsage(`未支持的 --agent「${agent}」`);
  // 路径由结构派生：从 lib/paths.mjs 的 PROJECT_ROOT（import.meta.url 派生）拼，任何 clone 位置/OS 自适应。
  const serverAbs = path.join(PROJECT_ROOT, 'mcp', 'casey-server.mjs');
  if (agent === 'claude') printClaude(serverAbs);
  else printCodex(serverAbs);
  process.exit(0);
}

// 仅在被直接当 CLI 执行时跑 main()；被 import（如金牌单测 tomlEscape/shellQuote）时不触发
//   任何 process.exit 副作用（main() 恒以退出码收尾，import 场景下这会杀掉宿主进程）。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();

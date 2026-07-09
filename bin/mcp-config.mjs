#!/usr/bin/env node
// bin/mcp-config.mjs —— casey MCP 挂载配置打印器（distribution，GRILL D2-D6）。
// 自适应从模块位置解析仓根 → 挂载脚本绝对路径（path.join(PROJECT_ROOT,'mcp','casey-server.mjs')，
//   绝不硬编码盘符，F10「手抄改路径」根治点），按 --agent 吐各家 MCP 挂载配置。
// 纯打印器：零 LLM、零外部依赖、零真机、不 import/不读 site.json/.auth、结构上不含 --sut/目标地址
//   （护栏 #7 边界外——挂载配置只含启动器 node + server 脚本路径）。缺/错 --agent → fail-closed exit 64。
import path from 'node:path';
import { PROJECT_ROOT } from '../lib/paths.mjs';

const SUPPORTED = ['claude', 'codex'];

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
const WSL_NOTE = '须知：回放依赖 Linux 侧 playwright；WSL + Windows 组合务必在 WSL 侧挂载并运行本 server（Windows 原生侧挂载必败，G6）。请在你将实际跑 casey 的那一侧执行本命令。';

function printClaude(serverAbs) {
  const snippet = { mcpServers: { casey: { command: 'node', args: [serverAbs] } } };
  console.log('casey MCP 挂载配置 —— claude code');
  console.log('');
  console.log('形态一：粘进仓根 .mcp.json 的 mcpServers（项目级）：');
  console.log('');
  console.log(JSON.stringify(snippet, null, 2));
  console.log('');
  console.log('形态二：一行等效命令（在仓根执行）：');
  console.log(`  claude mcp add casey -- node ${serverAbs}`);
  console.log('');
  console.log(WSL_NOTE);
}

function printCodex(serverAbs) {
  console.log('casey MCP 挂载配置 —— codex');
  console.log('');
  console.log('追加到 ~/.codex/config.toml：');
  console.log('');
  console.log('[mcp_servers.casey]');
  console.log('command = "node"');
  console.log(`args = ["${serverAbs}"]`);
  console.log('');
  console.log(WSL_NOTE);
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

main();

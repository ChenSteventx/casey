#!/usr/bin/env node
// review-deepseek.mjs —— 评审兜底道（异构冗余 / Dissimilar Redundancy）的 critic runner。
//
// 角色：仅当主评审 codex:gpt-5.5 额度耗尽时偶发触发的备用评审者。
// 形态：另起一个无头(headless) Claude Code 实例，指向 DeepSeek 的 Anthropic 兼容端点。
//       不复用 Codex CLI——Codex 自 2026-02 起只认 OpenAI Responses API，
//       而 DeepSeek 是 Chat Completions，裸换 base_url 不工作（见 docs/adr/0003 补记）。
// 凭据：DeepSeek key 读自 ~/.loop-kit/config.json 的 deepseekKey；
//       该文件在仓库外，key 绝不进仓库/日志/审计/任何输出。
// 隐私硬规则：评审输入(spec+diff+门禁证据)会上传 DeepSeek 境内服务器——
//       .auth/、site.json 等凭据内容严禁进入评审输入(CLAUDE.md 硬规则)。
// 信任策略(非对称)：判 FAIL 直接采信(拦截/升级)；判 PASS 仍需人工真机抽验——
//       DeepSeek 作 critic 倾向漏判而非乱判(NIST/CAISI held-out 掉分)。
//
// 跨平台：纯 node、零 bash 依赖（取代原 review-deepseek.sh，迁移 macOS/Linux 即用）。
// 用法：
//   node loop-kit/bin/review-deepseek.mjs <prompt-file>             # 提示词从文件读
//   echo "<review prompt>" | node loop-kit/bin/review-deepseek.mjs  # 或从 stdin 读
// 退出码：0 评审完成；3 前置条件缺失(配置/key/空提示词/找不到 claude)；其它=claude 退出码。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG = path.join(os.homedir(), '.loop-kit', 'config.json');
let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
} catch {
  console.error(`缺/坏 ${CONFIG} —— 在其中填 {"deepseekKey":"..."}（在用户主目录、不入库）`);
  process.exit(3);
}
const key = String(cfg.deepseekKey || '').trim();
if (!key) { console.error(`${CONFIG} 缺 deepseekKey（或为空）`); process.exit(3); }

// 评审提示词：文件参数优先，否则读 stdin
const arg = process.argv[2];
let prompt = '';
if (arg && fs.existsSync(arg)) prompt = fs.readFileSync(arg, 'utf8');
else if (arg) prompt = arg;
else { try { prompt = fs.readFileSync(0, 'utf8'); } catch { /* 无 stdin */ } }
prompt = prompt.trim();
if (!prompt) { console.error('空评审提示词（传 <prompt-file> 或从 stdin 输入）'); process.exit(3); }

// 仅本进程的临时环境变量——主会话(implementer)读磁盘登录态，不受影响；
// AUTH_TOKEN 优先级高于登录态，进程退出即蒸发；CLAUDE_CONFIG_DIR 隔离评审实例状态。
const env = {
  ...process.env,
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_AUTH_TOKEN: key,
  ANTHROPIC_MODEL: 'deepseek-v4-pro',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro',
  CLAUDE_CONFIG_DIR: path.join(os.homedir(), '.loop-kit', 'claude-deepseek'),
};

// 提示词经 stdin 喂给 `claude -p`（避免大 prompt 撞命令行长度上限）。
// Windows 上 claude 是 .cmd 批处理外壳，spawnSync 需 shell:true 才能解析。
const r = spawnSync('claude', ['-p'], {
  input: prompt,
  env,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
});
if (r.error) {
  console.error(`启动 claude 失败：${r.error.message}（确认 claude CLI 在 PATH）`);
  process.exit(3);
}
process.exit(r.status ?? 1);

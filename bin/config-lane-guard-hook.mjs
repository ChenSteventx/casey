#!/usr/bin/env node
// bin/config-lane-guard-hook.mjs — model-lane-guard 的 PostToolUse 钩子壳（独立新条，不改 loop-kit 的 hook-posttool.mjs）。
// 读 stdin 的 PostToolUse 载荷 JSON，tool_input.file_path 命中 loop/config.json 时跑 I2 config 异构守卫：
//   违反→退非零 + stderr（回合内可见拦）；非目标文件 / 合规 / 载荷不可解析→退 0（绝不误拦其它写入）。
// 复用 config-lane-guard.mjs 的 checkConfig（同一判据，DRY）；零 LLM。
import { readFileSync, realpathSync } from 'node:fs';
import { normalize } from 'node:path';
import { checkConfig } from './config-lane-guard.mjs';

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function main() {
  let payload;
  try { payload = JSON.parse(readStdin()); } catch { process.exit(0); } // 载荷不可解析：不误拦
  const filePath = payload && payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') process.exit(0);
  // 路径边界：normalize 收拢 ./ ../ 穿越（codex M2/R2-H5）；再 realpath 解软链，防经 symlink 别名写真 config 漏拦（codex R3-M2）
  const isCfg = (p) => p === 'loop/config.json' || p.endsWith('/loop/config.json');
  const norm = normalize(filePath.replace(/\\/g, '/'));
  let real = '';
  try { real = normalize(realpathSync(filePath).replace(/\\/g, '/')); } catch { /* 文件不存在等：退回词法判断 */ }
  if (!(isCfg(norm) || (real && isCfg(real)))) process.exit(0);
  let config;
  try { config = JSON.parse(readFileSync(filePath, 'utf8')); }
  catch (e) { console.error(`config-lane-guard-hook: 读/解析 ${filePath} 失败（fail-closed）：${e.message}`); process.exit(1); }
  const { ok, violations } = checkConfig(config);
  if (!ok) {
    console.error('config-lane-guard-hook: loop/config.json 模型分层异构不变量违反（回合内可见拦）：');
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  process.exit(0);
}

main();

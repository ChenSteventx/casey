#!/usr/bin/env node
// PostToolUse hook —— Write/Edit 落盘后扫描该文件的术语违例（ADR-0004 执行点 B）。
// 输入：stdin JSON（Claude Code PostToolUse hook 协议，tool_input 含 file_path）。
// 行为：ERROR → exit 2（stderr 反馈给 Claude，要求修复刚写入的文件）；其余 exit 0。
// 范围：仅 .md / .json，且位于本仓库内；运行产物（audit/inbox）不查。

import { readFileSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRegistry, lintFiles } from './term-lint.mjs';
import { resolveRoot } from '../lib/root.mjs';

const ROOT = resolveRoot();
const SKIP = [join(ROOT, 'loop', 'audit.jsonl'), join(ROOT, 'loop', 'inbox.md')];

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const fp = input.tool_input?.file_path;
  if (!fp) process.exit(0);
  const abs = resolve(fp);
  if (!abs.startsWith(ROOT + sep)) process.exit(0);
  if (!/\.(md|json)$/i.test(abs)) process.exit(0);
  if (SKIP.includes(abs)) process.exit(0);
  const { errors, warnings } = lintFiles([abs], { registry: parseRegistry() });
  for (const w of warnings) console.log(`WARN  ${w}`);
  if (errors.length) {
    console.error(`刚写入的文件含术语违例（ADR-0004）：\n${errors.map((e) => `  ${e}`).join('\n')}\n请修复该文件：改用已登记术语，或在 CONTEXT.md 四列制补登记。`);
    process.exit(2);
  }
} catch {
  // 监督机制自身故障不得阻塞正常写入
}
process.exit(0);

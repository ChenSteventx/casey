#!/usr/bin/env node
// Stop hook —— 在 Claude 结束回合前扫描其本回合输出的术语违例（ADR-0004 执行点 A）。
// 输入：stdin JSON（Claude Code Stop hook 协议，含 transcript_path / stop_hook_active）。
// 行为：黑名单/白名单 ERROR → exit 2（阻塞结束，stderr 反馈给 Claude 自纠）；
//       WARN 或基础设施异常 → exit 0（lint 永不阻塞正常工作）。

import { readFileSync } from 'node:fs';
import { parseRegistry, scanText } from './term-lint.mjs';

function lastAssistantText(transcriptPath) {
  const lines = readFileSync(transcriptPath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type !== 'assistant') continue;
    const blocks = entry.message?.content;
    if (!Array.isArray(blocks)) continue;
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (text.trim()) return text;
  }
  return '';
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.stop_hook_active) process.exit(0); // 防递归阻塞
  const text = lastAssistantText(input.transcript_path);
  if (!text) process.exit(0);
  const { errors, warnings } = scanText(text, { label: '本回合输出', registry: parseRegistry() });
  for (const w of warnings) console.log(`WARN  ${w}`);
  if (errors.length) {
    console.error(`术语违例（ADR-0004）：\n${errors.map((e) => `  ${e}`).join('\n')}\n请改用 CONTEXT.md 已登记术语，或当场四列制补登记后再结束回合。`);
    process.exit(2);
  }
} catch {
  // 任何解析失败都放行——监督机制自身故障不得瘫痪会话
}
process.exit(0);

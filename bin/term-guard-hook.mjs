#!/usr/bin/env node
// term-guard-hook —— 把钩子甲（bin/term-guard.mjs）接进 Claude Stop 钩子链的适配器。
// 读 Stop stdin JSON → 抽末条 assistant 输出 → 跑甲的 evaluate → 现阶段 WARN_ONLY（只警告、exit 0 不拦回合）。
// 观察若干轮确认无误判后，把 WARN_ONLY 置 false 即切「硬拦」（exit 2）。
// 独立接一条，绝不改 loop-kit 的 hook-stop.mjs（ADR-0001）；甲/乙不进 verdict.mjs（护栏 #15）。
import { readFileSync } from 'node:fs';
import { parseRegistry } from '../loop-kit/bin/term-lint.mjs';
import { evaluate } from './term-guard.mjs';

const WARN_ONLY = true; // 观察期：只警告不拦；确认无误判后置 false 切硬拦

function lastAssistantText(transcriptPath) {
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (entry.type !== 'assistant') continue;
      const blocks = entry.message?.content;
      if (!Array.isArray(blocks)) continue;
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      if (text.trim()) return text;
    }
  } catch { /* 读不到 transcript：放行，监督自身故障不瘫痪会话 */ }
  return '';
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.stop_hook_active) process.exit(0); // 防递归阻塞（同 hook-stop.mjs）
  const text = lastAssistantText(input.transcript_path);
  if (!text) process.exit(0);
  const registry = parseRegistry();
  if (registry.registryErrors.length) process.exit(0); // 术语表坏由 term-lint 那条报，本条不重复瘫痪
  const { violations } = evaluate(text, registry);
  if (violations.length) {
    const head = 'term-guard（统一语言·钩子甲）本回合输出' + (WARN_ONLY ? '（观察期·只警告不拦）' : '') + '：';
    if (WARN_ONLY) {
      console.log(head + '\n' + violations.map((v) => '  WARN ' + v).join('\n'));
      process.exit(0);
    }
    console.error(head + '\n' + violations.map((v) => '  ' + v).join('\n') + '\n请改用已登记术语或按格式修正后再结束回合。');
    process.exit(2);
  }
} catch {
  // 任何解析失败都放行——监督机制自身故障不得瘫痪会话（同 hook-stop.mjs 立场）
}
process.exit(0);

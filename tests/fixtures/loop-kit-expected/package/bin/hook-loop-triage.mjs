#!/usr/bin/env node
// UserPromptSubmit hook —— 实现意图命中则注入「入口分流 + 六阶段」检查单（软层）。
// 把 triage 钉在动手前的上下文，治「需要 loop 却不走 loop」的 grill 漏跑。闲聊不注入；hook 故障不阻塞。
import { readFileSync } from 'node:fs';

const INTENT = /实现|做一个|做个|加个|新增|重构|改造|开发|功能|参数化|移植|返工|流水线|\bloop\b|feature|build|implement|fix|修复/i;
const CHECKLIST = [
  '[loop 纪律] 动手前先做入口分流（docs/decisions/2026-06-12-loop-kit.md）：',
  '改不改数据 / 影响几个文件 / 跑多久 → 直干 | 轻契约 | 全流水线。',
  '全流水线按序：阶段0 grill-with-docs（决策树清空、落 CONTEXT/ADR）→ 1 to-plan → 2 acceptance-gate（红测试+冻结）',
  '→ 3 实现 + Quality Gate 绿 → 4 异构冗余评审（Codex 非同族，输入只给 spec+diff+证据）→ 5 沉淀。',
  '先 node loop-kit/bin/contract.mjs init <slug> --lane <...> 声明入口分流，再动手（硬层 hook 会按 contract 互锁）。',
].join('\n');

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (!INTENT.test(String(input.prompt || ''))) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: CHECKLIST } }));
} catch { /* hook 自身故障不阻塞提交 */ }
process.exit(0);

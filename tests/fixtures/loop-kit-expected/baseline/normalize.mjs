#!/usr/bin/env node
// normalize.mjs —— 观测基线规范化器（自身入 prd 冻结面，plan.md D7 C2）。
// 字段级白名单：只替换两类逐一登记的易变值——① 隔离树自身绝对根路径 → <TREE_ROOT>；
// ② ISO 8601 时间戳（如 breaker --reset 写入 .breaker-state.json 的 startedAt）→ <TIMESTAMP>。
// 白名单之外一字不动；反向扰动用例（证明本规范化不吞真实差异）见 tests/_golden/loop-kit-extract.golden.mjs C2。
const TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

export function normalize(raw, { treeRoot }) {
  let text = JSON.stringify(raw);
  if (treeRoot) text = text.split(treeRoot).join('<TREE_ROOT>');
  text = text.replace(TIMESTAMP_RE, '<TIMESTAMP>');
  return JSON.parse(text);
}

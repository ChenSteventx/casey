#!/usr/bin/env node
// bin/config-lane-guard.mjs — I2 config 异构守卫（model-lane-guard 契约，零 LLM 确定性）。
// 读 loop/config.json，断言开发流程模型分层三不变量（决策见 HANDOFF「模型分层升级 + 三级兜底」2026-07-01）：
//   (a) review 主 model 家族 != implementation 主 model 家族（异构冗余不塌同族，护栏 #9）；
//   (b) Claude 族(sonnet/opus/haiku/fable)不当 review 主 model、只能待 review.fallback；
//   (c) review.diversity === 'dissimilar'。
// 违反→退非零 + stderr 指明违反条；合规→退 0。fail-closed：读/解析失败或家族测不出一律当违反。
// 只读 config、不碰产品功能、不改 loop-kit（ADR-0001）。冻结契约见 tests/_golden/model-lane-guard.golden.mjs。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLAUDE_FAMILY = 'claude';

// model 字符串 → 家族。只认前缀锚定的已知族，不用宽松 includes（codex H4/R2-H4）：
// deepseek* → deepseek；claude/sonnet/opus/haiku/fable → claude；codex[:-]/gpt-/o[0-9] → openai；
// 其余（qwen/grok/mistral/*-openai-compatible 等未映射族）→ unknown → checkConfig 里 fail-closed 当违反。
export function modelFamily(model) {
  if (!model || typeof model !== 'string') return 'unknown';
  const m = model.toLowerCase().trim();
  if (m.startsWith('deepseek')) return 'deepseek';
  if (/^(claude|sonnet|opus|haiku|fable)\b/.test(m)) return CLAUDE_FAMILY;
  if (/^(codex[:-]|gpt-|o[0-9])/.test(m)) return 'openai';
  return 'unknown';
}

// 断言三不变量。返回 { ok, violations:[string] }。纯函数、零副作用，供钩子壳复用。
export function checkConfig(config) {
  const violations = [];
  const lanes = (config && config.lanes) || {};
  const implModel = lanes.implementation && lanes.implementation.model;
  const review = lanes.review || {};
  const reviewModel = review.model;
  const implFam = modelFamily(implModel);
  const reviewFam = modelFamily(reviewModel);

  // 家族测不出 = fail-closed（不能确认异构就当违反）
  if (implFam === 'unknown') violations.push(`implementation.model 家族测不出（model=${JSON.stringify(implModel)}）：无法确认异构，fail-closed`);
  if (reviewFam === 'unknown') violations.push(`review.model 家族测不出（model=${JSON.stringify(reviewModel)}）：无法确认异构，fail-closed`);

  // (a) review 家族 != implementation 家族
  if (implFam !== 'unknown' && reviewFam !== 'unknown' && reviewFam === implFam)
    violations.push(`(a) review 主 model 家族(${reviewFam}) == implementation 主 model 家族(${implFam})：异构冗余塌成同族（护栏 #9）`);

  // (b) Claude 族不当 review 主
  if (reviewFam === CLAUDE_FAMILY)
    violations.push(`(b) review 主 model 是 Claude 族(${JSON.stringify(reviewModel)})：Claude 族只能待 review.fallback、不当主评审`);

  // (c) diversity dissimilar
  if (review.diversity !== 'dissimilar')
    violations.push(`(c) review.diversity=${JSON.stringify(review.diversity)} != 'dissimilar'`);

  return { ok: violations.length === 0, violations };
}

function main() {
  const argv = process.argv.slice(2);
  const ci = argv.indexOf('--config');
  if (ci < 0 || !argv[ci + 1]) { console.error('用法: config-lane-guard --config <path>'); process.exit(2); }
  const configPath = argv[ci + 1];
  let config;
  try { config = JSON.parse(readFileSync(configPath, 'utf8')); }
  catch (e) { console.error(`config-lane-guard: 读/解析 ${configPath} 失败（fail-closed）：${e.message}`); process.exit(1); }
  const { ok, violations } = checkConfig(config);
  if (!ok) {
    console.error(`config-lane-guard: 模型分层异构不变量违反（${configPath}）：`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  process.exit(0);
}

// 仅作 CLI 入口时跑 main；被 import（钩子壳/测试）时只导出、不执行
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();

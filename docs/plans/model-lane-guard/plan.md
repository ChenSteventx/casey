# model-lane-guard — plan（Sonnet 5 开发分层强制兜底）

## 背景与边界

决策见 `HANDOFF.md`「模型分层升级 + 三级兜底」（2026-07-01）。开发流程改 Opus 4.8 ultracode 主环 + Sonnet 5 max subagent 跑轻车道；模型能自由换的前提是两条不变量被机器守住、不靠遵约。本契约把这两条从文档策略变成机制强制。

边界：仅**开发流程**（谁来跑 loop），不碰产品功能（编译/回放/裁定/报告）；`verdict.mjs` 恒零 LLM。三级梯 watcher（运行时读 `.breaker-state.json` 再派）不在本契约、押后另起辐条。**不碰 loop-kit 引擎**（ADR-0001 字节一致）：guard 全落 Casey 侧 `bin/` + `.claude/settings.json`，不改 `loop-kit/bin/*`。

## 组件

1. `I2` config 异构守卫 `bin/config-lane-guard.mjs`（新建，Casey 侧）：读 `loop/config.json`，断言——
   - `review` 主 `model` 家族 ≠ `implementation` 主 `model` 家族（异构冗余不塌同族，护栏 #9）。
   - Claude 族（`sonnet`/`opus`/`haiku`/`fable`）不当 `review` 主 `model`，只能待 `review.fallback`。
   - `review.diversity === 'dissimilar'`。
   违反→退非零 + 指明违反条；通过→退 0。内含 model→家族映射（`codex:*`→OpenAI、`deepseek-*`→DeepSeek、上述→Claude）。
2. `I1` verdict 零 LLM 守卫（新建，Casey 侧）：静态扫 `bin/verdict.mjs` 传递依赖闭包，断言无 LLM/网络客户端（`anthropic`/`openai`/`fetch`/`http`(s)/`net`/`undici` 等），裁判零 LLM（护栏 #15）机器守；以断言形式入 `casey selftest --tier1`。
3. hook 接线 `.claude/settings.json`：加一条 PostToolUse（matcher `Write|Edit`），被改路径命中 `loop/config.json` 时跑 `I2` 守卫、违反即回合内可见拦。**独立新条**，不改 loop-kit 的 `hook-posttool.mjs`。

## 验收点（命令化 hermetic）

- [命令] `I2` 现网真值：`node bin/config-lane-guard.mjs --config loop/config.json` 退 0（当前 `review=codex:gpt-5.5` 跨族、`sonnet` 只在 fallback）。
- [命令] `I2` 反向红：喂合成坏 config（`review.model` 改 `sonnet`；或 `review.model` 同 `implementation` 家族）→ 守卫退非零 + 指出违反条。
- [命令] `I2` 边界：`review.diversity` 非 `dissimilar` / `review.model` 为 `opus` → 退非零。
- [命令] `I1` 现网真值：`verdict.mjs` 依赖闭包扫描 → 0 个 LLM/网络客户端 → 退 0。
- [命令] `I1` 反向红：合成一个带 LLM/网络 import 的假依赖闭包喂扫描器 → 断言退非零（证不是恒绿假过；不动真 `verdict.mjs`）。
- [命令] hook 接线活证：写坏一份合成 config 触发 PostToolUse → 守卫报违反。
- [命令] `casey selftest --tier1` 无回归。

## 红基线

守卫未建时上述命令化 golden 跑红（缺 `bin/config-lane-guard.mjs` / 缺 `I1` 断言）；实现落齐转绿。反向红 case 用合成坏 config / 合成坏依赖夹具，不改真 config、不改真 `verdict.mjs`（复现接缝、不倒着裁）。

## 完成判据

gate GREEN（命令化层：`I1`+`I2` 正反向 + hook 接线活证 + selftest tier1 无回归）+ codex 异构评审收口。三级梯 watcher 另起辐条，不在本契约。

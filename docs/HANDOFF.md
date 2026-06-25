# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。

## 现状（2026-06-25）

**P0 引导 loop 机制 + P1 DDD 词表/ADR 已落地并验证全绿。** 三交付面（skill·MCP·CLI）脚手架到位，生命周期命令为诚实桩（exit 3）。git 三分支 `master`/`dev`/`test` 同源于已评审的引导基线，当前在 `dev`。

### 已落地（live + 验证方式）

| 模块 | 文件 | 验证 |
|---|---|---|
| loop-kit 引擎 | `loop-kit/bin/*`（与 autotester 字节一致，ADR-0001） | 评审确认 9 个脚本逐一 diff 无偏差 |
| 护栏 | `loop/GUARDRAILS.md`（12 迁移 + 13–16 Casey 安全不变量） | term-lint exit 0；评审确认 13–16 忠于设计 §0.1/§4/§10 |
| 统一语言 | `CONTEXT.md`（两限界上下文） | `term-lint --registry` exit 0 |
| 决策档案 | `docs/adr/0001–0005` | term-lint exit 0 |
| 质量门禁 | `loop/config.json` + `prd.schema.json` + `prd-selftest.json` | `gate --prd loop/prd-selftest.json` GREEN（passes 翻 true） |
| 双 hook | `.claude/settings.json` | 实跑：缺契约时 PreToolUse 拦截、未登记术语时 PostToolUse 拦截 |
| CLI | `bin/casey.mjs` | `casey selftest --tier1` 全链路 GREEN |
| MCP | `mcp/casey-server.mjs` | initialize/tools/list/tools/call 握手通过 |
| skill | `.claude/skills/casey` + `acceptance-gate` | term-lint exit 0 |

### 对抗评审结论（5 维度，7 agent）

无确认的 critical/high（两条 high 经核验降为 low/medium）。已修：① `Lane` 词条歧义（拆出「入口分流」=direct/light/full，区别于模型道 toil/implementation/review）；② 补登 `只读漂移探针`/`route:human`/`静默点`/`LLM-judge`；③ 设计 §8 护栏行补 #15/#16；④ `.gitignore` 改 `cases/` 整目录 deny-by-default；⑤ MCP verdict/report 描述补桩告示。
未修（有意）：loop-kit 引擎脚本（含 gate.mjs 冗余三元、breaker git-HEAD 进展信号）保持与 autotester 字节一致，按 ADR-0001 不在 casey 私自分叉；breaker 进展信号改造属 P5/P6（config.json 已记）。

## 下一步（MVP 第一刀：P0→P5+P7 web 单用例，串行）

按 `docs/plans/bootstrap/plan.md`：
1. **P2 规范 TestCase + 输入归一**（lane: full）：`parseTestCase` 确定性校验（fail-closed）+ L1 归一适配器；golden fixtures。
2. **P3 编译期 recorder-as-library + authoring agent**（红队点名最重，硬门：events.json 不触 authored 拒绝）。
3. **P4 断言草拟 + 冻结 + 人签**；**P5 确定性回放 + 取证 + verdict.mjs 分类器 + 只读漂移探针**（核心，含 breaker `--progress` 改造）；**P7 报告 + 裁定徽章 + 缺陷单**。

开 P2 前：`node loop-kit/bin/contract.mjs init <slug> --lane full --reason "..."`，走 grill→plan→accept→loop→review→learn。

## 待裁决（route:human）

见设计 §11：人签门形态（先 CLI `--sign`）、网络取证归因（已定按发起方）、CASE_DEFECT 判别（只编译期）、并发（MVP 串行）。

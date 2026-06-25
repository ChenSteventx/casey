# CLAUDE.md

**Casey（测易）** —— LLM 驱动的「文本用例 → 测试报告」自动化测试系统。一段文本用例（excel/json/txt/自由文本）→ LLM 编译成确定性可回放 spec → 确定性回放（录屏 + 抓输出）→ 零 LLM 多态裁定出严格结论 → 自包含测试报告。三处统一标识符 `casey`：CLI `bin/casey.mjs`、skill `casey`、MCP server `casey`。

复用 autotester 的 **loop-kit**（loop engineering 工具箱）作为第二消费者（ADR-0001）。Casey 是 autotester（人录、机回放、零 LLM）的「翻面」：输入端改 LLM，但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。

## 必读顺序

1. `CONTEXT.md` —— 统一语言注册表：**所有概念命名以它为准**，弃用别名列是黑名单；
2. `docs/design/txt2testreport-design.md` —— 端到端设计（v0.2，已并入 4 路红队修订）；
3. `docs/plans/bootstrap/plan.md` —— 落地计划（P0–P9 里程碑）；
4. `loop/GUARDRAILS.md` —— 护栏清单，逐条有效（1–12 迁移，13–16 Casey 新增）。

## 硬规则（由机制强制，不是建议）

- 双 hook 在 `.claude/settings.json` 生效：回合输出与写入的 md/json 都会被 `loop-kit/bin/term-lint.mjs` 扫描，术语违例与繁体字会被拦截（ADR-0005）。新概念先查既有学科术语，造词必须先登记 CONTEXT.md；英文术语首次出现附中文白话解释。
- 阶段互锁：实现编辑/提交前必须先 `contract init` 声明入口分流；缺上一阶段交付物时 `hook-loop-guard` 拦截（护栏 #11）。
- `loop/prd-<slug>.json` 的 `passes` 字段只有 `loop-kit/bin/gate.mjs` 有权写入；`testChecksums` 冻结的断言文件对实现者只读。
- **裁判零 LLM**：多态裁定由 `bin/verdict.mjs`（零 LLM）出，自愈（LLM）是其下游消费者，不得进裁判进程（护栏 #15）。
- **fail-safe 不 fail-open**：机器只终判 `PASS` 与有取证背书的 `SUT_DEFECT`；证不出的一律 `NEEDS_HUMAN`（护栏 #14）。自愈只对确证 `HARNESS_ERROR` 开闸（护栏 #13）。
- `.auth/` 与 `site.json` 是凭据，内容不得进任何输出、日志、提交、报告。

## 常用命令

```
node loop-kit/bin/term-lint.mjs --registry              # 术语表完整性检查
node loop-kit/bin/breaker.mjs --reset                   # 熔断器清零（loop 开始时）
node loop-kit/bin/gate.mjs --prd loop/prd-<slug>.json   # 质量门禁（确定性裁判，唯一写 passes）
node loop-kit/bin/contract.mjs init <slug> --lane <direct|light|full> --reason "<一句理由>"
node bin/casey.mjs selftest --tier1                     # 链路自检（hermetic，零外部依赖）
```

业务命令（ingest/compile/sign/replay/verdict/report）见 `bin/casey.mjs --help` 与 README；当前实现进度见计划 P0–P9。

## 决策档案

- `docs/adr/` —— 难逆转决策（复用 loop-kit / 多态裁定 fail-safe / 编译再回放 / 断言冻结人签 / 统一语言强制）；
- `docs/design/`、`docs/plans/` —— 端到端设计与里程碑计划。

## git 分支

`master`（稳定主干）/ `dev`（日常开发，默认工作分支）/ `test`（提测/真机 UAT）。

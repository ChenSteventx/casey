# casey-demo 金牌测试计划（红先行，proposed）

> 为 `casey demo` 样例报告子命令写红先行金牌的断言清单。只列断言与夹具骨架，不写完整实现代码（实现者按 `acceptance-gate` 冻结时补齐并先验红）。
> 性质：light 金牌，hermetic（夹具 SUT + 零凭据 + 零 LLM + 零真机），但**需本机 chromium**（demo 做真回放，与 `e2e-chain` 同级，非 `selftest --tier1` 的零外部依赖）。收编新能力，实现前该红、实现后转绿。
> 决策依据 `proposed/GRILL.md`（D1-D9）；改动面见 `plan.md`。落点建议 `tests/_golden/casey-demo.golden.mjs`（由实现者创建、本包不写）。
> 已实证背书：本包跑过 `scripts/sample-report.mjs`，exit 0、2 步全 `PASS`、报告含 `class="badge pass">通过<`、三产物全文 `://` 计数为 0、无 `127.0.0.1`/`localhost`/`http` 明文——A1/A2/A3 的期望集是实测所得、非臆造。

## 一、测试接缝与夹具

- 被测入口：`node bin/casey.mjs demo`（零参）。金牌只跑门面命令、检产物，不自己起 SUT（demo 内部起夹具 `tests/fixtures/publish-sut/server.mjs`，自包含）。
- 产物落点：固定 `runs/sample-wf-publish/`（GRILL D1）——金牌对固定路径断言，无需扫时间戳目录。`runs/` 已 gitignore，金牌跑完可选清扫或留档。
- chromium 前置：金牌需 `@playwright/test` + chromium 就位（同 `e2e-chain.golden.mjs`）；缺则视为环境未就绪，不混进 `selftest --tier1`。
- 凭据毒化陷阱（证明 demo 不依赖凭据，A6）：`AT_SITE_JSON` 指合成空 site、`AT_CREDS_FILE` 指不存在路径、删 `AT_CREDS_USER`/`AT_CREDS_PASS`——demo 不接凭据源，应照旧 `exit 0`。
- 全站 stdout/stderr + 三产物文本汇集，末尾统一过 `lib/cred-gate.mjs` 的 `FORBIDDEN_KEYWORDS`（单一事实源）。

## 二、断言清单

### A1 `casey demo` exit 0 产 report.{html,md,json}

- 跑 `casey demo`（零参）。
- 断言：`exit 0`；`runs/sample-wf-publish/` 下落 `tc_wf_publish_sample.report.html` / `.md` / `.json` 三件全在；同目录有 `verdict.json`/`report-model.json`/`axes.json`。
- 证明子命令接通、尾段串跑、三产物齐落。

### A2 报告含裁定徽章、逐步 PASS、自包含可打开

- 读 `tc_wf_publish_sample.report.html` 与 `.report.json`。
- 断言：
  - html 含裁定徽章标记（`class="badge pass"` + 中文态名「通过」，实证在场）。
  - `verdict.json`/report json 逐步 `verdict==='PASS'`、无 `SUT_DEFECT`/`HARNESS_ERROR`/`NEEDS_HUMAN`（夹具 happy 场景，实证 2/2 `PASS`）。
  - 自包含可打开：html 无外链/无 `<script src`/无外部样式（沿用相6 自包含纪律，`lib/report.mjs` 只内联 CSS）。
- 证明「先看到 Casey 产物长啥样」的核心承诺——一份带裁定徽章、能离线打开的真报告。

### A3 全文零凭据、零 `://`（对照断言）

- 三产物（html/md/json）+ 全站 stdout/stderr 汇集。
- 断言：
  - 零 `://`（实证三产物 `://` 计数为 0；夹具地址不进报告）。
  - 无 `FORBIDDEN_KEYWORDS` 命中（token/authorization/cookie/password/secret/apikey 等）。
  - 无 `127.0.0.1`/`localhost`/真 host 明文。
- 证明 demo 的凭据卫生是结构性零（不接凭据源、夹具地址不进产物，GRILL D4），不是靠脱敏擦。

### A4 help 暴露 casey demo 且无黑名单 token

- 跑 `casey help`。
- 断言：
  - 输出含 `casey demo`（子命令在 help 表可见，修 F1 的「不可见」）。
  - 输出**不**含 handover-pack C2 黑名单形态：`run <file>`、`--build <id>]`、`--sut <url>`（demo 行零参、无 `--sut`，GRILL D7）——与 `handover-pack.golden.mjs` C2 不冲突。
- 证明用户/agent 从 help 一眼看得到样例报告入口。

### A5 幂等/固定落点

- 连跑两次 `casey demo`。
- 断言：两次均 `exit 0`；两次落同一 `runs/sample-wf-publish/`、同一 caseId `tc_wf_publish_sample`（无时间戳目录）；第二次清建覆盖、产物形态一致（三产物仍在、仍全 `PASS`）。
- 证明固定落点 + 清建幂等（GRILL D1），金牌可对固定路径稳定断言。

### A6 demo 不依赖凭据（毒化仍绿）

- 上凭据毒化三件套（`AT_SITE_JSON` 空 site / `AT_CREDS_FILE` 不存在 / 删 `AT_CREDS_*`）后跑 `casey demo`。
- 断言：仍 `exit 0`、三产物仍落、仍零泄漏——证明 demo 结构上不接凭据源（GRILL D4/D9），与真机 `casey run` 的凭据依赖解耦。

### A7 跨平台路径提示不硬编码盘符

- 抓 demo 的 stdout「可打开路径」提示。
- 断言：不含 `/mnt/d` 字面硬编码（修 GRILL 现状瑕疵 1，`sample-report.mjs:85`）；提示的绝对路径由真实产物路径推导。
- 证明落点/提示跨平台（win/wsl/linux/macos）不失真。

### A8 现有金牌不 re-sign（回归锁）

- 断言：本契约不 re-sign 任何冻结金牌——尤重 `cli-mcp-face`（C5/C6，未加 MCP `casey_demo`）、`handover-pack`（C1 README 八节锚 + 凭据卫生 / C2 help 黑名单 / C3 无盘符硬编码）、`e2e-chain` 及全部相6/回放金牌照旧全绿。
- 证明 demo 是纯加法、零冻结面回归。

## 三、红基线预期（实现前）

- A1/A2/A3/A5/A6/A7 应红：无 `casey demo` 子命令时门面走 `default: exit 64`（未知命令），产不出报告、断言无从谈起。
- A4 应红：help 无 `casey demo` 行。
- A8 现已绿——作防退化守（实现后须仍绿）。
- 冻结前实现者须真跑一次、亲眼见红（`acceptance-gate` 纪律），绝不倒着裁夹具凑预定结论；A1/A2/A3 的期望集照本包实证所得钉死，不跟随产物动态推导。

## 四、交给实现者的边界

- 只加新金牌 `casey-demo.golden.mjs`，不改任何冻结金牌（`cli-mcp-face`/`handover-pack`/`e2e-chain` 等一律不 re-sign；若发现非改不可即停、按面升 lane 记账）。
- 金牌需 chromium 就位（同 `e2e-chain`），不塞进 `selftest --tier1` 的零依赖自检。
- 断言钉死源头期望集（本包实证：2/2 `PASS`、零 `://`、徽章在场），不跟随产物动态推导（`e2e-chain` codex R1-F1 先例）。
- demo 全程夹具 SUT + 零凭据；凭据毒化三件套（A6）齐上，任何真机/真凭据触达即视为破例。
- 固定落点用完可清扫，绝不留残到其它 `runs/*`；绝不硬编码盘符。

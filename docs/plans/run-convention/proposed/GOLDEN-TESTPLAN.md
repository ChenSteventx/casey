# run-convention 金牌测试计划（红先行，proposed）

> 为 `casey run <caseId>` 约定布局解析写红先行金牌的断言清单。只列断言与夹具骨架，不写完整实现代码（实现者按 `acceptance-gate` 冻结时补齐并先验红）。
> 性质：light 金牌，hermetic（夹具 SUT + 零凭据 + 零 LLM + 零真机）。收编新能力，实现前该红、实现后转绿。
> 决策依据 `proposed/GRILL.md`（D1-D8）；改动面见 `plan.md`。落点建议 `tests/_golden/run-convention.golden.mjs`（由实现者创建、本包不写）。

## 一、测试接缝与夹具（GRILL D7）

- 用例根注入：`AT_CASES_DIR` 指向 tmp 目录（需 `lib/paths.mjs` 的 `CASES_DIR` 支持 env 覆盖）。全程在 tmp 内造 `cases/<caseId>/` 约定布局，零污染真实 `cases/` 树。
- 夹具复用：SUT 用 `tests/fixtures/fake-sut/server.mjs` 的 `startFakeSut`；约定五件（`events.json`/`expected.frozen.json`/`profile.json`/`observed-<caseId>.json`/`testcase.json`）复用 `e2e-chain` 已跑通的编译产物形态，或直接跑一遍 `ingest→flow-bridge→compile→draft→sign` 前段落进 tmp 用例目录。
- 凭据毒化陷阱（同 `e2e-chain`）：`AT_SITE_JSON` 指合成空 site、`AT_CREDS_FILE` 指不存在路径、删 `AT_CREDS_USER`/`AT_CREDS_PASS`——`--skip-login`/夹具路径纪律一破即 fail-closed 红。
- 全 tmp + 全站 stdout/stderr 汇集，末尾统一过 `lib/cred-gate.mjs` 的 `FORBIDDEN_KEYWORDS`（单一事实源）。

## 二、断言清单

### A1 约定布局全解析 → exit 0 产报告

- 在 `AT_CASES_DIR/<caseId>/` 备齐五件；只跑 `casey run <caseId> --sut <fake-sut>`（无任何文件旗标）。
- 断言：`exit 0`；`runDir` 下落 `axes.json`/`verdict.json`/`report-model.json` + `<caseId>.report.{html,md,json}`；`verdict.steps` 全 `PASS`（夹具走 happy 场景）。
- 证明约定解析把五件都取到位、尾段串通。

### A2 显式旗标覆盖约定（显式恒赢，GRILL D3）

- 约定目录里的 `events.json` 与另一个 tmp 里的「哨兵 events」形态可辨（例如事件条数不同）；跑 `casey run <caseId> --sut <fake-sut> --events <哨兵events>`，其余四件走约定。
- 断言：`exit 0`；产物反映哨兵 events（如 `axes.steps` 数对上哨兵而非约定件）——证明显式旗标压过约定、约定只兜缺席项。

### A3 缺 caseId → exit 64

- 跑 `casey run`（无位置参、无旗标）。
- 断言：`exit 64`；不崩栈；用法串含 `<caseId>`/`--sut`。沿用现有行为，防退化。

### A4 约定必填件缺 → exit 64 点名缺件、非崩、非静默降级（GRILL D4）

- 分三子例，各在 `AT_CASES_DIR/<caseId>/` 少放一件必填：
  - 缺 `events.json` → `exit 64`，报文点名 `events`（含约定相对路径 `cases/<caseId>/events.json`）。
  - 缺 `expected.frozen.json` → `exit 64`，点名 `expected`。
  - 缺 `profile.json` → `exit 64`，点名 `profile`。
- 外加缺 `--sut`（约定件齐、但不给 `--sut`）→ `exit 64`，点名 `--sut`（GRILL D2：`--sut` 不进约定）。
- 断言：一律 `exit 64`、非 `exit 1`/非崩栈；报文逐条点名缺件；绝不无声继续。

### A5 约定可选件缺 → exit 0 + 可见降级告警（非静默，GRILL D4）

- 备齐必填三件 + `--sut`，删 `observed-<caseId>.json` 与/或 `testcase.json`。
- 断言：`exit 0`（照跑）；stderr 出现可见降级告警行（措辞含「降级」/「未签」/`naturalLanguage` 语义，实现者定稿）；报告仍生成。修掉 F2 的静默降级——对照点：告警行必须存在，缺告警即红。

### A6 既有全显式调用零行为差回归（GRILL D5）

- 同一 `caseId`、同一 SUT，跑两次：
  1. 全显式（五件旗标全带，路径指约定文件本尊，镜像 `e2e-chain` C7 与 runbook 复制块）。
  2. 仅 `caseId` 走约定（A1 的命令）。
- 断言：两次 `exit 0`；`verdict.json` 逐步 `{intentId,atom,verdict,reason}` 深等；核心产物无行为差。证明约定纯做缺省填充、显式路径零回归。

### A7 `casePaths` 字段形状对齐 + 死 import 复活（GRILL D6）

- 单元式 import `lib/paths.mjs` 的 `casePaths('tc_x')`：
- 断言：`expected` 结尾 `cases/tc_x/expected.frozen.json`、`profile` 结尾 `profile.json`、`caseMeta` 结尾 `testcase.json`、`observed` 结尾 `observed-tc_x.json`、`events` 结尾 `events.json`；不再暴露误述布局的 `spec`/`report`/`verdict` 键（或明确不指向 `cases/` 静态输入）。
- 附断言：`AT_CASES_DIR` 生效时 `casePaths` 的路径以其为根（证明接缝真通）。

### A8 凭据与 host 卫生（零泄漏）

- 全 tmp 文本产物 + 全站 stdout/stderr 过 `FORBIDDEN_KEYWORDS`；A4 的 `exit 64` 报文只含 `cases/<caseId>/…` 仓内相对路径。
- 断言：无凭据形关键词命中；报文不含 `site.json` 内容、不含真目标地址；核心确定性产物零 SUT host 明文（沿用 `e2e-chain` C8 纪律）。

## 三、红基线预期（实现前）

- A1/A2/A4/A5/A6/A7 应红：无约定解析时，仅 `caseId` 跑 `casey run` 现走 `exit 64`（`runPipeline:70`），产不出报告、点不了名、告不了警、`casePaths` 字段缺。
- A3 可能已绿（缺 caseId 现已 `exit 64`）——作防退化守。
- A8 视夹具而定，通常随 A1 一起由红转绿。
- 冻结前实现者须真跑一次、亲眼见红（`acceptance-gate` 纪律），绝不倒着裁夹具凑预定结论。

## 四、交给实现者的边界

- 只加新金牌 `run-convention.golden.mjs`，不改任何冻结金牌（`cli-mcp-face`/`e2e-chain` 等一律不 re-sign；若发现非改不可即停、按面升 lane 记账）。
- 断言钉死源头期望集，不跟随产物动态推导（`e2e-chain` codex R1-F1 先例）。
- 夹具 SUT、`--skip-login`、凭据 env 毒化三件套齐上，任何真机/真凭据触达即 fail-closed。
- `AT_CASES_DIR` 用完清扫，绝不留残到真实 `cases/`。

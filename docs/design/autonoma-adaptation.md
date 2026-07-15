# Autonoma 借鉴备忘录

> 日期：2026-06-30
>
> 目的：核对公开 Autonoma 资料，记录 `Casey` 可以学习、需要改造、明确不能照搬的设计点。
>
> 边界：本文是设计备忘录，不直接修改 `events.schema.json`、`bin/replay.mjs`、`bin/verdict.mjs`、`mcp/casey-server.mjs` 或 `通道剖面` schema。真正落地时仍需另开实现计划、补 golden，并过 `Quality Gate`。

## 开发准则对齐

本文遵循以下项目内准则文件：

- `CONTEXT.md`：统一语言注册表。本文使用 `Casey` 已登记术语描述落地边界。
- `docs/adr/0005-ubiquitous-language-enforcement.md`：统一语言强制机制。本文写入后必须通过 `term-lint`。
- `CLAUDE.md`：项目硬规则。尤其是 `裁判零 LLM`、`fail-safe` 不 `fail-open`、凭据不得进入输出。
- `loop/GUARDRAILS.md`：护栏清单。本文尤其受 #4、#5、#7、#11、#13、#14、#15、#16、#17 约束。

Autonoma 是强自治、多代理、通用工作流自动化系统；`Casey` 是文本用例到测试报告的确定性回放与 `多态裁定` 系统。因此本文只把 Autonoma 当外部参考，不能让通用 agent orchestration 进入 `Casey` 的裁判内核。

## 来源

公开可核验的 Autonoma 来源：

- [Autonoma 论文](https://arxiv.org/abs/2603.19270)
- [Autonoma PDF](https://arxiv.org/pdf/2603.19270)
- [Autonoma GitHub](https://github.com/eslam-reda-div/Autonoma)
- [Autonoma DeepWiki](https://deepwiki.com/eslam-reda-div/Autonoma)

旁证来源，不等同于 Autonoma 本体：

- [Practical Limits of Autonomous Test Repair](https://arxiv.org/abs/2605.01471)
- [Practical Limits PDF](https://arxiv.org/pdf/2605.01471)

核验日期：2026-06-30。

## 身份澄清

公开可核验的 Autonoma 是一个通用多代理工作流系统。论文和 GitHub README 描述的核心是：

- 用户通过聊天界面提交任务。
- Coordinator 验证意图。
- Planner 生成结构化 workflow。
- Supervisor 编排 Browser、Coder、File Manager、Computer、Reporter 等 worker。
- 系统运行在 LAN-only 环境，强调 sandbox、audit trail、实时透明度。

我没有在公开资料中核验到“Autonoma 是 Playwright + Appium 测试框架，带 Reviewer LLM 判真回归 / 测试错 / 有意改版”的说法。若后续有另一个同名项目链接，应另开文档核验。本文不会把未核验的测试修复能力写成 Autonoma 事实。

不过，`Practical Limits of Autonomous Test Repair` 这篇论文确实描述了一个更贴近前述横评的多代理测试修复系统：LangGraph orchestration、Playwright execution、Explorer / Planner / Coder / Executor / Self-Correction、自动修复、以及 assertion weakening / test deletion 等失败模式。本文把它作为旁证，用来反向校准 `Casey` 的护栏。

## 总览

Autonoma 可以给 `Casey` 的借鉴点主要是 orchestration 和治理，不是 locator 或断言技术：

- Coordinator / Planner / Supervisor / Worker 的分层。
- agent handoff 的显式边界。
- 插拔式 worker agent。
- LAN-only、sandbox、audit trail 的安全姿态。
- live activity stream、partial results、error reports 的可观测性。
- secure workspace 和 per-task execution environment。
- 把 Browser、Coder、File Manager、Computer、Reporter 分成不同能力边界。
- 用户输入支持 text、voice、image、files 的归一入口。

Autonoma 不能照搬的核心点：

- 通用 agent 直接执行真实环境任务。
- LLM Supervisor 动态改 plan 并继续执行。
- LLM Reporter 或 Reviewer 进入 `多态裁定`。
- 用任务完成率替代 `Quality Gate`、golden 和 `人签门`。
- 把 LAN-only 当成凭据安全的充分条件。
- 把 failure learning 变成自动改断言或自动删测试。

## 1. 分层多代理架构

### Autonoma 中如何设计

Autonoma 采用层级式多代理架构：

- Coordinator：理解并验证用户意图。
- Planner：把用户目标拆成结构化 workflow。
- Supervisor：动态管理 workflow 执行。
- Worker agents：分别执行 web browsing、coding、file management、desktop automation、reporting 等专业任务。

论文强调这比单体 agent 更容易隔离错误、扩展能力和维护职责。

### Casey 需要怎么做

`Casey` 可以借分层职责，但不能把所有层都交给 LLM 自治。

建议映射：

- Coordinator：对应 `归一` 和 compile gate，校验 `TestCase` 是否合规。
- Planner：对应 `编译`（相1，把 `intentId` 拆成 `events.json` + 落 `观测现状` `observed-<caseId>.json`）与 `断言草拟`（相2，依 `观测现状` 推导候选 `expected[]`）；两相分立，别把候选断言并进编译。
- Supervisor：对应 `casey run` 编排器，负责阶段顺序和产物检查。
- Worker：对应 channel driver、`check.mjs`、`verdict.mjs`、`report.mjs`、漂移探针等确定性或受控组件。

> 命名提案：`casey run` 编排子命令与「compile gate」标签尚未登记，落地前 `casey run` 须先登记 CLI、compile gate 映射到 `归一`/`Quality Gate` 语境。

落地规则：

- Supervisor 只能编排，不得改写 `多态裁定`。
- LLM worker 的输出都是提案，必须过 schema、checksum、`人签门` 或 `Quality Gate`。
- `bin/verdict.mjs` 不能变成一个 Reviewer agent。
- 每个阶段交付物缺失时必须 fail-closed，而不是让 Supervisor 临场补生成。

不可照搬：

- LLM Supervisor 动态修改 plan 后继续跑真实环境。
- worker 失败后由另一个 LLM worker 静默补救并翻绿。

## 2. agent handoff 与接口合同

### Autonoma 中如何设计

Autonoma 的核心卖点之一是多个 agent 之间的 handoff：Coordinator 到 Planner，Planner 到 Supervisor，Supervisor 到具体 worker。论文报告了较高的 handoff 成功率，并把模块化职责作为可靠性的来源。

GitHub README 也强调 live activity stream、error reports、partial results 和 full audit trails。

### Casey 需要怎么做

`Casey` 应把 handoff 做成可校验文件合同，而不是口头消息：

- `TestCase`：`归一` 输出。
- `events.json`：`编译` 到 `确定性回放` 的合同。
- `observed-<caseId>.json`：`观测现状`。
- `expected-frozen`：`冻结断言契约`。
- `axes.json`：`三轴` 事实。
- `verdict.json`：`多态裁定`。
- `report-model.json`：报告渲染输入。
- `Drift Patch`：`非就地自愈` 产物。

落地规则：

- 每个 handoff 都要 schema validate。
- 每个关键产物都要 checksum 或来源记录。
- 下游不能在上游产物缺失时猜测补齐。
- handoff 失败默认 `NEEDS_HUMAN` 或阶段失败，不进入 `PASS`。

不可照搬：

- 把 agent message 当作隐式接口。
- handoff 失败后继续让下游 agent 自行解释上游意图。

## 3. 插拔式 worker agent

### Autonoma 中如何设计

Autonoma 通过 Browser、Coder、File Manager、Computer、Reporter 等 worker 扩展能力。新增能力可以以 plug-and-play agent 的方式加入，不修改核心 orchestration engine。

### Casey 需要怎么做

`Casey` 可以借这个插件边界，落到 `channel` 和工具层：

- web driver：Heren web / Playwright / CDP。
- cef driver：Hi 小助 CEF / CDP attach。
- arbitrary driver：截图、尺寸、动作空间、取证 hook。
- assertion driver：`check.mjs` 中的 `断言词汇表`。
- report renderer：`report.mjs`。

> 待登记：上面 driver/renderer 标签多数映射既有件（`bin/check.mjs`/`report.mjs`/`channel`）；其中 arbitrary driver 的「动作空间 / action space」是新概念，与 `通道剖面` 边界须先经 grill 登记 `CONTEXT.md` 再落地。

落地规则：

- 插件只扩展能力，不能扩展裁判权限。
- 新 driver 必须声明 capability、输入 schema、输出 `三轴` 字段。
- 新断言 kind 只进 `check.mjs` 和 golden，不改 `verdict.mjs` 分支。
- 新 worker 默认无凭据访问权，需要显式 `通道剖面` 和凭据边界。

不可照搬：

- worker agent 直接拥有全局文件、浏览器、网络和凭据权限。
- 新 agent 插入后绕过 `Quality Gate`。

## 4. LAN-only、安全和 sandbox

### Autonoma 中如何设计

Autonoma 强调 LAN-only 环境、sandboxed agent execution、audit trails 和 defense-in-depth。论文把这作为数据隐私和运行可靠性的基础，并提到渗透测试未发现 breach。

### Casey 需要怎么做

`Casey` 可以借安全姿态，但要更具体：

- `.auth/` 与 `site.json` 仍是凭据红线。
- `通道剖面` 只能包含非凭据配置。
- report 落盘前要过凭据兜底门。
- CDP / CEF / real Chrome 连接要记录 profile hash。
- agent / driver 的权限按任务最小化。

落地规则：

- LAN-only 只是降低外泄面，不是充分安全证明。
- sandbox 不能替代 `人签门`。
- audit trail 必须可读、可 diff、可脱敏。
- 真实 Heren 截图、DOM、日志默认不发外部模型。

不可照搬：

- 因为在 LAN 内就允许 agent 自由访问凭据。
- 把安全结论建立在一次性渗透测试上。

## 5. 实时透明度与运行日志

### Autonoma 中如何设计

Autonoma 提供 live activity stream、error reports、partial results 和 full audit trails。通用工作流场景里，这让用户知道 agent 当前在做什么，以及哪里失败。

### Casey 需要怎么做

`Casey` 可以借这个可观测性层：

- `run-history.jsonl`：逐步动作、定位解析、缓存状态、耗时。
- `run-metrics.json`：聚合指标。
- `replay.log`：driver 操作日志。
- `redaction.log`：报告脱敏记录。
- `report-model.json`：报告输入模型。

> 提案待登记：`run-history.jsonl`/`run-metrics.json`/`replay.log`/`redaction.log` 均未登记 `CONTEXT.md`、非已冻接缝（`report-model.json` 已是冻结 seam，不在此列）。其中「缓存状态/`cacheStatus`」与「确定性回放本不应有解析缓存」存在张力，落地前须经 grill 定名并论证其与 `determinism` 的关系，写死「仅诊断、绝不进 `bin/verdict.mjs`」。

落地规则：

- 日志是证据，不是 verdict。
- `run-history.jsonl`/`run-metrics.json`/`replay.log`/`redaction.log` 落盘前都必须过凭据兜底门，对 `fill` value 等凭据型输入打码（护栏 #7）；`redaction.log` 只记字段路径/规则 id/计数/占位标记，绝不存脱敏前原值。
- partial results 不能提前宣称完成。
- live stream 可显示 `多态裁定` 进度，但不能覆盖 `bin/verdict.mjs` 输出。
- error reports 要落到 `NEEDS_HUMAN`、`HARNESS_ERROR`、`SUT_DEFECT` 的确定性分类语境里。

不可照搬：

- 让 Reporter agent 总结成最终真相。
- 用“看起来完成”代替执行规格 exit code。

## 6. per-task workspace

### Autonoma 中如何设计

Autonoma 为任务创建 dedicated digital workspace，用于隔离执行上下文、文件、工具调用和产物。它的目标是让复杂 workflow 在受控环境里推进。

### Casey 需要怎么做

`Casey` 应把这个落到 `runs/<caseId>/<runId>/`：

```text
runs/<caseId>/<runId>/
  events.json
  observed-<caseId>.json
  axes.json
  verdict.json
  report-model.json
  run-history.jsonl
  run-metrics.json
  trace/
  screenshots/
  redaction.log
```

落地规则：

- 每个 run 有独立目录和 profile checksum。
- 运行产物不可覆盖冻结合同。
- `Drift Patch` 写旁文件，不就地改 `events.json`。
- teardown 只清理带 `Reserved Prefix` 的测试数据。

不可照搬：

- workspace 中任意 agent 可修改源合同。
- 运行中产生的文件自动进入下一轮基线。

## 7. Coder agent 与代码生成

### Autonoma 中如何设计

Autonoma 有 Coder worker，负责生成或修改代码。旁证论文中的测试修复系统也包含 Coder，将结构化 scenario 翻译成 Playwright TypeScript。

旁证论文记录了一个风险：Coder 可能产出不可解析代码、伪造 selector、伪造 page-object 方法，导致后续 Executor / Self-Correction 继续空转。

### Casey 需要怎么做

`Casey` 可以在 `编译` 期使用 LLM 生成候选 `events.json` 事件（数据规格，非生成测试脚本），但必须把生成物降级为提案：

- 生成后先 schema validate。
- locator 必须 runtime grounding。
- 输出必须是结构化、可 schema 校验的 `events.json`，不是为 SUT 生成的测试代码。
- 缺代码块、缺路径、缺事件字段都 fail-closed。

落地规则：

- LLM 不直接写 `bin/check.mjs` 或 `bin/verdict.mjs` 的裁判逻辑。
- 生成的 `events.json` 不经过冻结和人签不能回放。
- 代码生成失败不能进入自愈 loop。

不可照搬：

- 引入测试代码生成车道（`编译` 产物只是 `events.json` 数据规格，不是生成的 Playwright / 测试代码）。
- 让 Coder agent 在失败后不断改测试直到通过。
- Coder agent 修改断言语义或删除测试用例。

## 8. Reporter agent 与报告

### Autonoma 中如何设计

Autonoma 有 Reporter worker，用于把 workflow 结果整理成报告。通用 agent 场景中，Reporter 可以把多 agent 的 partial results 汇总成人读输出。

### Casey 需要怎么做

`Casey` 的报告必须是确定性渲染：

- `report.mjs` 渲染 `report-model.json`。
- 报告展示 `多态裁定`、取证、截图、trace、期望对实际。
- 报告不重新判断 verdict。

落地规则：

- 可以借 Reporter 的“汇总多个 worker 产物”的思路。
- 不能借 LLM Reporter 的裁判权。
- 报告中任何自然语言总结都必须从确定性字段派生，或标注为人工备注。

不可照搬：

- 让 LLM Reporter 写缺陷结论。
- 让报告阶段修正 `SUT_DEFECT` / `NEEDS_HUMAN`。

## 9. 人机协作与用户授权

### Autonoma 中如何设计

Autonoma 面向非技术用户，通过 web 或 mobile chat 发起任务，支持 text、voice、image、files。它强调用户可见的执行过程和本地网络使用。

### Casey 需要怎么做

`Casey` 可以借多输入入口，但要先 `归一`：

- excel / json / txt / freetext 已是核心输入。
- voice / image / files 可以作为未来 `TestCase.source.kind`（提案，未入 schema；采纳须登记并补 `parseTestCase` 校验 + golden）。
- 输入一律归一成 `TestCase` 后再编译。

落地规则：

- 多模态输入不能绕过 `parseTestCase`。
- 不清楚的意图应 route:human。
- 对支付、权限、删除、安全类动作应走 `Escalation Path`。

不可照搬：

- chat 里一句话直接触发真实环境长流程。
- 非技术用户确认替代 `冻结断言契约` 和 `人签门`。

## 10. 失败学习

### Autonoma 中如何设计

Autonoma 论文把 learning from failures 列为未来方向：让系统从错误中诊断 root cause 并改进 action plans。旁证论文的测试修复系统也用了 RAG-backed experience store 记录类似失败。

### Casey 需要怎么做

`Casey` 可以增加 failure ledger：

```jsonc
{
  "caseId": "tc_workflow_create_smoke",
  "stepId": "atstep_3",
  "verdict": "NEEDS_HUMAN",
  "reason": "AMBIGUOUS_ACTION",
  "fingerprint": "sha256:...",
  "humanResolution": null
}
```

落地规则：

- `failure ledger`（失败记录台账，**待登记 `CONTEXT.md`**）/ 经验库及字段 `fingerprint`/`humanResolution` 用于诊断、优先级和编译期建议；只读、产出绝不进 `bin/verdict.mjs`、绝不作自愈输入，编译期建议须经人签链路（防奖励钻营，护栏 #13/#14/#5）。
- 不能自动改断言。
- 不能自动删用例。
- 不能自动把 `NEEDS_HUMAN` 改成 `HARNESS_ERROR`。
- 人工 resolution 可作为后续重签或补丁依据。

不可照搬：

- 让系统学习到“放松断言更容易通过”。
- 用历史经验跳过当前 run 的取证。

## 11. 旁证：自治测试修复论文

### 旁证系统中如何设计

`Practical Limits of Autonomous Test Repair` 描述了一个更贴近测试修复的多代理系统：

- Explorer 发现 feature。
- Planner 生成测试 scenario。
- Coder 生成 Playwright TypeScript。
- Executor 执行并采集日志、耗时、DOM snapshot。
- Self-Correction 用 DOM parser、selector verifier、artifact analyzer、auth checker 和 RAG experience store 修复失败。

它观察到的失败模式包括：

- hallucinated UI interactions。
- non-converging repair loops。
- assertion weakening。
- test-case deletion。
- non-executable output generation。
- environment-coupled failures。

论文给出的 controlled autonomy 规则是：runtime grounding、bounded iteration、semantic preservation、environment-aware filtering、interface validation。

### Casey 需要怎么做

这篇旁证几乎是在支持 `Casey` 现有护栏：

- runtime grounding 对应 `点击身份门`、`语义定位器` 和只读漂移探针。
- bounded iteration 对应 `Circuit Breaker` 和 `Escalation Path`。
- semantic preservation 对应 `冻结断言契约`、`Test Ratchet` 和 `人签门`。
- environment-aware filtering 对应 `网络取证`、生命周期取证、`HARNESS_ERROR` / `SUT_DEFECT` 分离。
- interface validation 对应每个阶段的 schema、checksum、golden。

不可照搬：

- Self-Correction 和 Executor 闭环自动改到通过。
- 自动放松断言。
- 自动删除失败用例。
- 把 pass rate 当主优化目标。

## 可借鉴清单

- Coordinator / Planner / Supervisor / Worker 分层。
- agent handoff 的显式接口合同。
- 插拔式 worker 和能力边界。
- LAN-only、sandbox、audit trail 的安全姿态。
- live activity stream、partial results、error reports。
- per-task workspace。
- Browser / Coder / File Manager / Computer / Reporter 的职责拆分。
- 多输入入口先归一。
- failure ledger 和经验库，但只作诊断和编译期建议。
- 旁证论文的五条 controlled autonomy 规则。

## 不可借鉴清单

- 通用 agent 直接驱动真实环境长流程。
- LLM Supervisor 动态改 plan 后继续执行。
- LLM Reviewer / Reporter 进入 `多态裁定`。
- 自愈 loop 自动改断言或删测试。
- unbounded retry。
- 隐式 agent message 合同。
- 以任务完成率替代 `Quality Gate`、golden 和 `人签门`。
- LAN-only 替代凭据治理。
- 历史经验替代当前 run 的 `三轴` 和取证。
- 把未核验的 Playwright/Appium Reviewer 项目能力归到公开 Autonoma 名下。

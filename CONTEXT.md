# CONTEXT.md — 统一语言注册表

> 本文件是本仓库「什么叫好」的唯一事实源之一（术语部分）。决策记录见 `docs/adr/`，需求级决策见 `docs/decisions/`，端到端设计见 `docs/design/`。
>
> 规则（详见 ADR-0005，机制同 autotester ADR-0004）：
> 1. 设计文档、代码标识符、prompt、config 字段名共用本表术语；
> 2. 新概念命名先查既有学科（DDD → SRE → 控制论 → CI/CD → XP/BDD → ITIL），映射不到才造词，且必须先登记本表；
> 3. 英文术语在文档中首次出现必须附中文白话解释；
> 4. 标记约定：凡作为术语使用的词必须加粗或反引号标记——`term-lint` 据此做白名单检查；
> 5. 弃用别名列是 `term-lint` 黑名单：命中即红；中文一律标准简体，禁繁体。
>
> 本仓库当前含两个限界上下文（Bounded Context）：孵化自 autotester 的 **loop-kit** 通用子域（编排/验证域）与 **Casey** 核心域（文本用例→测试报告域）。同名术语跨上下文含义以所在分节为准。Casey 是 autotester（人录、机回放、零 LLM）的「翻面」：输入端改为 LLM 读懂用例直接跑，但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。

## loop-kit 通用子域（编排/验证域）

| 术语 | 中文译名 | 白话解释 | 弃用别名 |
|---|---|---|---|
| Loop Contract | loop 契约 | 开任何 loop 前必须存在的约定：目标、非目标、验收、停止条件、预算、护栏、升级路径、审计（八要素） | — |
| Quality Gate | 质量门禁 | 一组必须全部通过才允许提交或进入下一阶段的可运行检查；默认 FAIL，凭证据翻绿（CI/CD 术语） | 出口闸, 门禁闸 |
| Executable Specification | 可执行规格 | 验收标准写成能直接运行的命令或测试，而不是散文描述（BDD/实例化需求术语） | 验收命令化 |
| Acceptance Test | 验收测试 | 钉死在验收点上的 story 级测试；实现期间冻结（xUnit/ATDD 术语） | — |
| ATDD | 验收测试驱动开发 | 实现开始之前先把验收标准写成会失败的测试（Acceptance Test-Driven Development） | — |
| Golden Test | 黄金标准测试 | 固定输入跑确定性转换，输出与人工确认过的存档做 diff；一致绿、不一致红（特征测试的一种） | — |
| Fixture | 固定语料 | 测试使用的固定输入数据；golden test 只能测到语料中出现过的模式（xUnit 术语） | — |
| Test Ratchet | 测试棘轮 | 测试只许加严不许放松；实现者改动验收测试文件 = 质量门禁直接判红（checksum 校验） | — |
| Toil | 事务性工作 | 需要读懂但不需要做决定的有界重复工作：模板化、错误廉价、判断不外溢（Google SRE 术语） | 流水活 |
| Lane | 车道 | 按职责与模型分层划分的模型道（config.json `lanes`）：`toil` / `implementation` / `review`；story 的 lane 取其子集 `toil`/`implementation`。与「入口分流」正交 | — |
| 入口分流 | Entry-Triage Lane | contract.mjs 的 `--lane`：按需求成本把任务分到 `direct`（仅契约+一行理由）/ `light`（加 plan 门）/ `full`（全链）；与模型道 Lane 正交 | — |
| Dissimilar Redundancy | 异构冗余 | 用不同实现/不同模型家族的组件互相校验，避免共享盲区（容错工程术语）；本仓库指 Codex 评审 Claude 产出 | 跨族评审, 异族评审 |
| Circuit Breaker | 熔断器 | 连续异常达到阈值就自动停机的保护装置：迭代上限/连续零进展/同错重复（Nygard《Release It!》） | — |
| Escalation Path | 升级路径 | 机器搞不定的事项移交给人的固定通道：写 Inbox + 通知（ITIL 术语） | 升级通道 |
| `commit` | 提交 | git 提交；阶段互锁中 `commit-impl` 需 loop done 才放行（护栏 #11，only when user asks） | — |
| `push` | 推送 | git 推送远端；阶段互锁中 `push` 需 review done 才放行（护栏 #11） | — |
| Inbox | 收件箱 | 等待人裁决事项的落点文件 `loop/inbox.md`（GTD 术语） | — |
| Guardrail | 护栏 | 永不可违反的约束清单 `loop/GUARDRAILS.md`；每条标注 [enforced]/[prose] 与它编码的假设 | — |
| Reserved Prefix | 保留前缀 | loop 在真实环境创建的一切实体必须以 `atl_` 开头；Teardown 清扫按前缀识别（命名空间隔离） | — |
| Teardown | 测试数据清理 | 清除测试在环境中产生的数据；本仓库策略 = Reserved Prefix + 定期纯脚本清扫兜底（xUnit 术语） | 残留治理 |
| Uniqueness Guard | 唯一性保障 | 新建实体前先在目标系统查重（搜列表）；撞名则保留原名 + 追加 Reserved Prefix 令牌派生不撞的新名并记录（数据库唯一约束 + 幂等创建的冲突消解） | — |
| `Spike` | 技术预研 | 用最小一次性探查回答某个未知、专为消除不确定性，不进产品代码（XP 术语）；本仓库指 plan 前对外部系统能力的只读探查 | — |
| Observability | 可观测性 | 系统状态能否从外部信号推知；质量门禁测不到的维度必然放行，必须显式申报去向（控制论术语） | 无传感器维度 |
| Ubiquitous Language | 统一语言 | 文档、代码、对话共用同一套术语，消灭翻译损耗（DDD 术语）；本文件即其注册表 | — |
| Bounded Context | 限界上下文 | 一套术语有效的边界，跨边界同一个词允许含义不同（DDD 术语） | — |
| 标记约定 | Marking Convention | 凡作为术语使用的词必须加粗或反引号标记，使术语可被 `term-lint` 机器识别 | — |
| Published Language | 发布语言 | 两个系统间共享的、版本化的正式交换格式（DDD 术语） | — |
| `acceptance-gate` | 验收门禁工序 | 项目 skill：读 plan.md 验收点 → 写红测试（运行验证确实红）→ checksum 登记 → 冻结；ATDD + Test Ratchet 的工序化 | tdd-gate |
| `loop-kit` | （产品名） | 可复用 loop engineering 工具箱，孵化于 autotester `loop-kit/` 目录，Casey 为其第二消费者；提取/分发策略见 ADR-0001 | — |

## Casey 核心域（文本用例→测试报告域）

| 术语 | 中文译名 | 白话解释 | 弃用别名 |
|---|---|---|---|
| `Casey` | 测易 | 本项目代号：LLM 驱动的「文本用例→测试报告」自动化测试系统；skill·MCP·CLI 三处统一标识符（CLI `bin/casey.mjs`、命令 `casey`、skill `casey`、MCP server `casey`） | — |
| `txt2testreport` | 文本转测试报告 | Casey 核心端到端能力：一段文本用例（excel/json/txt/自由文本）→ 编译 → 回放 → 裁定 → 自包含报告 | — |
| `SUT` | 被测系统 | System Under Test：被测的真实平台（Heren 中台 web / Hi小助 CEF / 任意站点）（xUnit 术语） | — |
| `TestCase` | 测试用例聚合根 | DDD 聚合根：excel/json/txt/自由文本归一后的唯一内部用例对象（含 target/steps/expected/uniquePrefix）；推广 autotester 的 Dataset | — |
| 归一 | Normalization | 相0：杂乱 excel/txt/自由文本 → 规范 `TestCase`，由确定性 `parseTestCase` 校验，不合规 fail-closed | 输入清洗 |
| `intentId` | 意图步标识 | 用例语义步 id（人/LLM authoring 时写）；区别于回放事件的位置式 `stepId`（一条 intent 可裂成 N 个 event） | — |
| 编译 | Compile | 相1：LLM 唯一一次直接跑用例，把 intent 翻译成确定性可回放 spec + 落观测现状；此后回放不再烧 LLM、结果可复现 | — |
| 观测现状 | Observed Reality | 编译期落盘的地面真值（真实成功 URL/提示/回复/请求日志），存 `observed-<caseId>.json`；断言草拟与裁定的依据 | — |
| 断言词汇表 | Assertion Vocabulary | 带类型的断言枚举（urlPathname/textVisible/countChange/streamReplyReceived/...）+ 每种允许的 op；LLM 不准发明自由断言 | — |
| 断言草拟 | Assertion Drafting | 相2：LLM 从 intent + 观测现状 推导带类型 `expected[]`（只用断言词汇表 + op 约束，默认结构式、易变值模板化） | — |
| 冻结断言契约 | Frozen Assertion Contract | 人签后写入 `loop/prd-<caseId>.json` 并 checksum 冻结的断言；只冻断言文件，不冻 spec（自愈改 locator 合法、改断言触棘轮） | — |
| 多态裁定 | Polymorphic Verdict | 零 LLM 的 `verdict.mjs` 按判定树给每步四态之一的分类；区别于 gate 的二值 `passes` | 判官 |
| `PASS` | 通过 | 机器终判：动作执行成功且全部冻结断言满足 | — |
| `SUT_DEFECT` | 被测缺陷 | 机器终判（需取证背书）：用例已人签 + 工装做了对的动作 + 可观测响应违反期望 + 取证背书；禁止自愈、自动出缺陷单 | — |
| `HARNESS_ERROR` | 过程错误 | 可自愈：正向确证的工装定位漂移（录制 locator 不再命中，但同稳定签名的唯一元素仍在） | — |
| `NEEDS_HUMAN` | 待人裁决 | 路由人：机器无法证明上述任一者；绝不自愈、绝不自动记缺陷；带 reason 子类 | — |
| `SUT_DEFECT_OR_STALE` | 缺陷或期望过时 | `NEEDS_HUMAN` 子类：动作对、断言硬失败、但取证干净；人裁「确认回归→记缺陷」或「有意改版→重签新基线」 | — |
| `CASE_DEFECT` | 用例缺陷 | `NEEDS_HUMAN` 子类：仅编译期/人签前判候选——入口可证缺席或期望自相矛盾，即用例本身有 bug | — |
| `AMBIGUOUS_ACTION` | 动作歧义 | `NEEDS_HUMAN` 子类：多匹配/坐标兜底点击，点没点对存疑；收紧用例 locator 后重编译 | — |
| `AFFORDANCE_ABSENT` | 入口缺席 | `NEEDS_HUMAN` 子类（人签后）：编译时够到的入口回归时没了，又无漂移信号无取证；走缺陷-或-过程错误分诊 | — |
| `INDETERMINATE` | 未定 | `NEEDS_HUMAN` 子类：纯未知失败，看证据人判；catch-all 的 fail-safe 默认落点 | — |
| 点击身份门 | Click Identity Gate | 仅当解析目标唯一（过滤后 count===1）或点击后身份回读成立才置 `actionPerformed=true`；多匹配/坐标兜底 → ambiguous |
| 语义定位器 | Semantic Locator | 按 ARIA 角色/可访问名/标签/文本定位（getByRole/getByText/getByLabel），对照 CSS 选择器与坐标兜底；回放定位与点击身份门的基础（迁自 autotester 核心域） | — | — |
| 网络取证 | Network Forensics | `watchNetworkForensics`：记 response/requestfailed 的 {url,status,initiator} + error-envelope，按请求发起方归因（非时间窗） | — |
| 错误信封 | Error Envelope | HTTP 200 但 body `{code:!=0}` 的软失败；`noErrorEnvelope` 断言据此取证；成功字段按 channel 参数化（Heren 实测为 `status===200`，落 site.json，非写死 `code`） | — |
| 三轴 | Three-Axis | 回放期每个原子步吐的三组事实——动作（过点击身份门判 true/ambiguous/false）/ 逐条断言（typed kind 各一条，断言续跑、不首错即停）/ 取证（网络取证 + 生命周期）；零 LLM 的 `verdict.mjs` 据此跑判定树出四态，是裁判·桥·报告共吃的数据契约 | — |
| 自愈 | Self-heal | 相5：仅对确证 `HARNESS_ERROR` 的有界重锚；是裁定的下游消费者，绝不反向进入裁判进程 | — |
| 自愈准入门 | Self-heal Admission Gate | 护栏：自愈只对确证 `HARNESS_ERROR` 开闸；`SUT_DEFECT`/`NEEDS_HUMAN` 一律拒绝自愈 | — |
| 非就地自愈 | Out-of-place Self-heal | 自愈重锚写 `drift/<caseId>.<ts>.patch` 旁文件，原 spec 不变照常回放，人签后才应用 | — |
| 漂移补丁 | Drift Patch | 非就地自愈产出的旁文件补丁，记重锚前后对照 | — |
| 人签门 | Human Sign-off Gate | 人签掉冻结断言才算数；gate 绿 ≠ 完成，人签真机才完成；CASE_DEFECT 与 SUT_DEFECT 的分水岭 | — |
| 期望版本化 | Expectation Versioning | 每条冻结 `expected[]` 带 `signedAt`/`signedAgainstBuild`/`signerId`；有意改版走重签、不自动记缺陷 | — |
| 重签 | Re-sign | 系统有意改版导致期望过时时，人重签新基线（新 checksum + signedAgainstBuild，旧期望归档） | — |
| 裁定徽章 | Verdict Badge | 报告里每步的四态标记（通过/被测缺陷/过程错误/待人裁决+子类）+ 具名理由 | — |
| 缺陷单 | Defect Ticket | 仅 `SUT_DEFECT` 生成：步号 + 期望对实际 + 取证 + 录屏时间点 + trace 引用 | — |
| `CSS` | 层叠样式表 | Cascading Style Sheets：报告自包含靠内联 CSS、零外部依赖（autotester report.ts 把样式内联进 HTML，Casey 报告照搬此法） | — |
| `trace` | 回放追踪档 | Playwright 逐帧追踪归档（.zip）；报告里不内嵌、复制到 `trace/` 加下载链接与 show-trace 提示 | — |
| `channel` | 通道 | 回放目标类型：`web`（Heren 中台）/`cef`（Hi小助）/`arbitrary`（任意站点）；裁定/报告/熔断/契约层 channel 无关 | — |
| `chat` | 对话流 | 飞轮排期第二维度：覆盖 catalog 维度碰不到的流式回复取证（`streamReplyReceived`、`waitForReplyByStream` 底座）与 `replyContains`；骑 regress `chiefcomplaint_smoke`/`echo_default_on` 语料 | — |
| 移植 | — | 把 regress 现成 flow 用到的原子在 autotester L1 原语上重表达成吐三轴的纯 mjs、再配观测现状与 verdict golden 的工作；飞轮的主要人力成本。弃用口语简写见别名列（2026-06-29 清零并登记） | 港 |
| `verdict.json` | 裁定档 | 可复现的机读产物：caseId + 逐步四态 + passes + 期望对实际字面量 + 取证引用；golden 唯一校验对象 | — |
| recorder-as-library | 录制器库化 | 把 autotester 人操作录制器重构成 LLM agent 拥有 context 的库（关人抖动去噪、避导航竞态）；编译期捕获 agent 动作→events.json | — |
| `fail-safe` | 故障安全 | 失败时退到安全态：机器证不出就路由人（`NEEDS_HUMAN`），绝不默认成可自愈（fail-open 的反面） | — |
| `fail-open` | 故障放行 | 故障时放行：基础设施/hook 自身故障不阻塞正常工作；仅用于 lint/hook，绝不用于裁定 | — |
| `fail-closed` | 故障关闭 | 故障时拒绝：校验不过/缺数据时报红拒绝（用于 `parseTestCase` 等准入） | — |
| `loop engineering` | 循环工程 | 以确定性退出码为唯一真相的闭环工程方法：契约/质量门禁/熔断器/统一语言/异构冗余评审；Casey 复用 autotester loop-kit | — |
| `DDD` | 领域驱动设计 | Domain-Driven Design：按业务域建模 + 统一语言 + 限界上下文 + 聚合根的设计方法 | — |
| `ADR` | 架构决策记录 | Architecture Decision Record：记录难逆转架构决策的短文档（背景/决策/后果），存 docs/adr/ | — |
| `determinism` | 确定性 | 同输入同输出、可复现、可做 golden；Casey 内核「确定性是默认」的名词形态 | — |
| `verdict-logic` | 裁判逻辑 | 红队评审维度之一：多态裁定判定树是否 fail-safe、会不会把真 bug 误判成可自愈 | — |
| `loop-fidelity` | 循环保真 | 红队评审维度之一：loop-kit 构件复用是否名实相符、有无阻抗失配 | — |
| `buildability` | 可建造性 | 红队评审维度之一：组件是「照搬」还是「新建」、依赖是否可实现 | — |
| `watchNetworkForensics` | 网络取证函数 | 实现「网络取证」的函数：记 response/requestfailed + 错误信封、按请求发起方归因 | — |
| `helper` | 辅助件 | 被复用为底层工具而非主逻辑的代码件（如报告自包含机制保留当 helper） | — |
| `tier-1` | 第一层自检 | hermetic 自检：假 SUT、零外部依赖，验编译→回放→报告管线 + 给分类器喂合成四元组逐一触发四态 | — |
| `tier-2` | 第二层自检 | live smoke：需 site.json + creds，覆盖 SUT_DEFECT/取证/流式分支，gated route:human | — |
| 只读漂移探针 | Read-only Drift Probe | findEquivalentAffordance：无 spec 变更、无重跑地探明「同稳定签名唯一元素是否仍在」，供 verdict.mjs 判 `HARNESS_ERROR`；与自愈写回（相5）严格分离（拆 P5/P6 循环依赖） | — |
| route:human | 路由人 | 把某项判断/动作显式移交人裁的标注（落 Inbox + 通知，Escalation Path 的标记形态）；Observability 测不到的维度必申报为 route:human | — |
| 静默点 | Quiet Point | 编译期落观测现状/做后检查前必达的确定性等待条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现 | — |
| LLM-judge | LLM 评分员 | 独立异构家族的语义评分器；判 FAIL 可信、判 PASS 仍人抽检；严格踢出确定性裁判（verdict.mjs）之外，绝不写 passes/verdict | — |
| `CLI` | 命令行接口 | Command-Line Interface：Casey 的确定性引擎入口 `bin/casey.mjs`；skill 与 MCP 都是它的薄壳 | — |
| `MCP` | 模型上下文协议 | Model Context Protocol：编辑器/agent 驱动工具的协议；`mcp/casey-server.mjs` 是 CLI 的 MCP 薄壳 | — |
| `skill` | 技能 | Claude Code 的能力封装；`.claude/skills/casey` 是把自然语言意图映射到 CLI 命令的薄壳 | — |
| `PowerShell` | （Windows 主壳） | Casey 在 win32 主机上的主命令行壳（与 Bash 工具并存、各自语法）；运维/卸载脚本用它 | — |

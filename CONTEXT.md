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
| `loop-kit` | （产品名） | 可复用 loop engineering 工具箱；已提取为独立包（ADR-0008、`loop-kit-extract` 契约），Casey 与 autotester 双消费者；分发 = 兄弟目录直解析（正式前置条件：包与消费树同层），npm 本地路径依赖出口按 route:human #4 已裁定取甲、本契约不采用 | — |
| `shim` | 垫片 | 只做包定位、ROOT 注入与命令/导出转发的薄层，零业务逻辑（校验与降级逻辑单点收在 `loop-kit/lib/boot.mjs`，`shim` 以最小内联 `try/catch` 边界调它）；提取后 in-repo `loop-kit/bin/*.mjs` 十件的形态，由单一模板展开生成、金牌逐字比对钉死（`loop-kit-extract` 契约） | — |
| `kit-lock` | 包身份锁 | Casey 侧 git 跟踪的包内容全清单（除 `.git` 外逐文件 sha256，严格集合相等、纯内容寻址、不含包仓 commit），任何定位方式（兄弟约定/`LOOP_KIT_PKG`）每次转发前校验，失配按降级矩阵处置（`loop-kit-extract` 契约） | — |
| 观测基线 | Observation Baseline | 切换前于旧引擎录制的规范化行为存档（完整 exit code / stdout / stderr / 文件系统差量），行为等价断言的比对锚（既有学科词 golden master 范式，登记取其本仓专义，`loop-kit-extract` 契约） | — |
| 并行工作树 baton | Per-Worktree Baton | 每棵 git worktree 各自独立的活契约槽；`active-contract.json` 与熔断态均 gitignored、每树一份、互不共享，故 N 棵 worktree = N 个并行 baton，零机制改动即多路并行落地（取代「单活契约 baton 真天花板」，见 roadmap v3 §二） | — |
| `contract list` | 跨树 baton 总览 | 枚举所有 worktree 的活 baton 与阶段进度的 read-only 视图（一屏看全并行轨）；遇坏契约/无 baton 降级显示、绝不抛 | — |
| `contract worktree` | 起树脚手架 | 一条命令起 git worktree + 立 baton，起一条并行开发轨；slug 全局唯一硬拒（防同名骑 gate-绿串味）、落点已存在拒、部分失败回滚 | — |
| Execution Profile | 执行剖面 | 同一工作流内核下可互换的执行面配置：`claude-code`（主）与 `codex`（接续，配额受限时顶上），同状态/同门禁/同完成判据；切换只在已过节点边界或配额中断协议下发生（loop 双 profile 改革 §6）。与 Casey 域「通道剖面」无关 | — |
| Durable Workflow State | 持久工作流状态 | 每 worktree 一份的 16 节点机读工作流状态（`loop/state.json` + `loop/events.jsonl`，gitignored），经有界切换后成为唯一可写的当前工作流真相；六阶段台账降为其只读投影；只有 `workflow-state.mjs` 有转移写权（改革 §3/§4） | — |
| Ownership Lease | 所有权租约 | 同一节点尝试同时至多一个写者的租约；配额中断时旧尝试封存 blocked 并释放租约，新剖面开新尝试、可复用字节但绝不继承未经验证的通过结果；两租约绝不同时有效（改革 §6.3/§9） | — |
| `kernel` 车道 | Kernel Lane | 入口分流第四车道：触 verdict/sign/凭据门/fail-safe/冻结协议/强制层（gate/contract/hook/签名写路径/批量重签写面）的改动，强制双设计审 + 异构冗余实现审 + round-2 + 全仓门禁 + 人签（改革 §5）；车道只许升不许降 | — |
| Review Receipt | 评审收据 | 版本化结构化评审证据（`docs/plans/<slug>/reviews/`）：绑 plan/验收/diff/门禁证据 hash 与作者·评审双方家族及 requested/reported 模型身份；被绑输入一变即失效；同族、家族测不出、超时无有效产出一律不满足异构门（改革 §7） | — |
| Readiness View | 就绪视图 | 从 `git worktree list` 与各树只读投影派生的调度视图：只读、无全局可写队列文件、无合并权，调度注解只经转移引擎写入（护栏 #18 兼容，改革 §11） | — |
| Fitness Function | 适应度函数 | 可执行的架构结构规则检查（演进式架构学科术语）：如 loop-kit 不得依赖 Casey 核心域、report 不得写 verdict、只有 gate 写 `passes`；复用 `verdict-purity-guard` 依赖闭包范式，查不了的规则显式留作评审义务（改革 §12） | — |

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
| 登录预备动作 | Login Bootstrap | 回放/编译开始前把浏览器带到已登录态的开场步；不产 event、不进 spec（凭据红线护栏 #7），凭据只经 `.auth/` 与 env 进内存；复用件按 ADR-0001 拷快照范式取自 autotester（登录选择器 + `loadCreds` + `loadSiteConfig`）；`TestCase.preconditions` 记「已登录」、`target.auth` 记 `ref:site.json` | — |
| 观测现状 | Observed Reality | 编译期落盘的地面真值（真实成功 URL/提示/回复/请求日志），存 `observed-<caseId>.json`；断言草拟与裁定的依据 | — |
| 断言词汇表 | Assertion Vocabulary | 带类型的断言枚举（urlPathname/textVisible/countChange/streamReplyReceived/...）+ 每种允许的 op；LLM 不准发明自由断言 | — |
| 动作词汇表 | Action Vocabulary | 已冻 events.schema action 枚举（click/dblclick/fill/selectOption/press/nav/newpage/dragTo）的治理投影层：每动作登记 paramSchema 投影/所属 channel/坐标兜底治理/三轴证据产出/驱动指针/golden/fail-closed；action 名权威仍在 events.schema，verdict.mjs 对 action 不可知（护栏 #17 动作侧对称）。与 断言词汇表 对称 | — |
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
| 容器归属闸 | Container Membership Gate | 文本精确唯一命中后仍须证明命中元素落在预期记录容器内（表格行/卡片/条目容器，剖面可覆写容器选择器）；容器外命中=同名非记录控件碰撞，硬阻断 fail-closed 不点。wf-open-smoke 首立（workflow.open），entity-ui-wiring 抽为 agent.searchOpen 编译/回放共享门 | — |
| 因果菜单授权 | Causal Menu Authorization | 只接受「点击目标记录的更多操作入口后恰好新出现的那一个浮层菜单」作为删除项的取值域（多个新浮层/零新浮层一律具名拒）；是 容器归属闸 在浮层场景的对位物——容器归属闸给结构性归属（控件长在记录容器里），本条给因果性归属（浮层由点这条记录的入口所致）。卡片布局删除入口移进悬停「更多操作」菜单后立（`wf-delete-card-layout` 契约），与确认弹层共用同一个纯函数 `classifyCausalDialog` 与同一套物理身份比较。因果绑定弱于结构绑定，残留风险显式申报 route:human | — |
| 关系原子 | Relation Atom | 动作效果为建立两个业务对象间关系的原子（首例 `workflow.bindAgent`：把智能体绑进工作流节点）；准入策略 `effect=relation`，必须同时携 `source` 与 `target` 双角色绑定且双边独立锁定（各自 lockId+收据 hash），缺任一边整份拒绝，绝不单边降级 | — |
| 准入三面策略 | Three-Facet Admission Policy | 人签冻结准入策略表对每个原子分开表达三件互不蕴含的事，不再压进一个 `effect` 字段：`entityChange` **结构性变更**（`none`/`entity`/`relation`，改不改业务实体）、`identityBindingRoles` **身份钉定角色**（冻结实体绑定必须覆盖哪些角色，空集=无身份可钉）、`nonEntityEffect` **非实体持久副作用**（`none`/`persistent`/`unknown`，会不会在业务对象模型之外留下持久痕迹，例如真给被测智能体发一条消息）。第四件事「目标身份连续性」不在本表登记，唯一事实源是纯守卫 `requiresTargetContinuityRef`，聚合视图外联拼入。旧 `{effect, requiredRoles}` 降为纯函数派生的兼容投影（唯一投影点 `deriveAdmissionRule`），不再是事实源 | — |
| 准入档 | Admission Class | 三面派生出的准入通道：`unbound-read`（三面全清白，零绑定只读放行）/ `entity-lock`（须恰好钉住指定角色的冻结绑定）/ `unsupported`（既非只读、又无身份可钉——现有通道都不适用，查表出口返 `null`，各消费点走既有 fail-closed 分支）。`unsupported` 不得投影成「非只读 + 空必需角色集」：那不是挡板而是 fail-open，实测零绑定的已签冻结件会真放行并准许启动浏览器 | — |
| 业务对象语义锁 | Business Object Semantic Lock | 手录后把工作流、智能体等业务对象从脆弱 DOM 位置提升为冻结身份；回放前重新只读解析并与已签身份收据确定性比较，只有 `SAME` 可重绑定临时 UI 句柄，业务身份变化一律零点击并路由人 | — |
| 业务对象身份收据 | Entity Identity Receipt | 业务对象语义锁的不可变权威载体：至少锁 `kind + name + code + scopeFingerprint`，平台提供稳定 ID、父对象或版本时一并锁定；收据带内容 hash，外部对象须用户确认、自建对象须平台权威读回，LLM/视觉只可提候选不可确认同一性 | — |
| 身份观察旁车 | Identity Observation Sidecar | 示教录制期间与操作事件分开落盘的最小业务身份候选；只收 `kind/name/code/platformId/scopeFingerprint/parent/evidenceKind/eventSeq`，永远未签且 `replayReady:false`，与 示教录制包 通过两个字节 hash 的联合绑定防换包；缺编号只保留 pending，绝不升格为权威收据 | — |
| 身份迁移 | Identity Transition | 已签用例有意改名/改码时声明的 `旧身份 → 变更动作 → 新身份`；动作后须平台权威读回新名称与编号并生成链接旧收据 hash 的 successor，未声明或读回失败不得静默更新锁 | — |
| `resolution` | 定位解析态 | 点击身份门为每个动作步吐的解析结果（落进 三轴 的动作轴），枚举 `unique`（唯一命中、可动作）/ `ambiguous`（多匹配、点没点对存疑、绝不变更 SUT）/ `none`（录制 locator 全失配、走漂移探针）/ `action_failed`（唯一但动作抛错）/ `absent`（编译期候选零命中）；`verdict.mjs` 据此推 `actionPerformed` 四态。多匹配的唯一合法字面量 = `ambiguous`（点击身份门 count>1 的收口词、三门 emitters 同源）；收敛前的 `multi`（编译门）/`fallback_first`（回放通用门）是旧写法、仅在动作轴/裁定链语境弃用——`fallback_first`/`coord_fallback` 在 run-history 诊断 `locatorResolution` 枚举里仍是合法可表征锁值（seams-freeze-v2 治理），故不登为全仓黑名单弃用别名；另有门内第六态 `container-out`（`lib/agent-search-gate.mjs:25`：恰一命中但落在记录容器外，即 容器归属闸 判定的同名非记录控件碰撞），它只活在共享门返回值里、不落动作轴——编译侧硬阻断零产事件，回放侧投影成 `none`，`verdict.mjs` 从不见到该字面量 | — |
| 语义定位器 | Semantic Locator | 按 ARIA 角色/可访问名/标签/文本定位（getByRole/getByText/getByLabel），对照 CSS 选择器与坐标兜底；回放定位与点击身份门的基础（迁自 autotester 核心域） | — | — |
| 网络取证 | Network Forensics | `watchNetworkForensics`：记 response/requestfailed 的 {url,status,initiator} + error-envelope，按请求发起方归因（非时间窗） | — |
| 错误信封 | Error Envelope | 响应 body 的成功字段判失败的软失败（典型：HTTP 200 但 body 表失败）；`noErrorEnvelope` 断言据此取证；成功字段按 channel 参数化、经`通道剖面`注入（web/Heren 实测为 body `status===200`，非早期假设的 `code!=0`） | — |
| 通道剖面 | Channel Profile | runner 回放某 channel 所需的非凭据配置：背景 denylist + 错误信封成功字段/值 + 可选加载占位 selectors/text；与 `site.json` 凭据密文严格分离（护栏 #7 边界），hermetic 经 `--profile` 传合成值、tier-2 由 site.json 非凭据子集投影 | — |
| 通道驱动 | channelDriver | 端口适配器式接缝：声明某驱动在某 channel 上能执行的动作能力集（actionSpace，严格 ⊆ events.schema 枚举）+ 每动作 call 指针 + coordinateSpace + 取证能力；只声明能力，transport/denylist/成功字段归 通道剖面（只带 profileRef 指针不内嵌）。分工镜像 动作词汇表 : channelDriver ≈ 断言词汇表 : 通道剖面；verdict.mjs 绝不读它、对 action 不可知（护栏 #17） | — |
| 三轴 | Three-Axis | 回放期每个原子步吐的三组事实——动作（过点击身份门判 true/ambiguous/false）/ 逐条断言（typed kind 各一条，断言续跑、不首错即停）/ 取证（网络取证 + 生命周期）；零 LLM 的 `verdict.mjs` 据此跑判定树出四态，是裁判·桥·报告共吃的数据契约 | — |
| 自愈 | Self-heal | 相5：仅对确证 `HARNESS_ERROR` 的有界重锚；是裁定的下游消费者，绝不反向进入裁判进程 | — |
| 自愈准入门 | Self-heal Admission Gate | 护栏：自愈只对确证 `HARNESS_ERROR` 开闸；`SUT_DEFECT`/`NEEDS_HUMAN` 一律拒绝自愈 | — |
| 准入受众 | Admission Audience | 冻结身份准入件（`entity-locks.frozen.json`/`execute-authority.json`）的必填签名字段 `audience ∈ {test, production}`，签进内容自哈希；标记该件只许在测试上下文还是生产上下文授权回放/编译。测试夹具标 `test`，生产件须显式 `production`。防「测试锁被误指向真 SUT 授权真实改动」（ADR-0010） | — |
| 凭据上下文门 | Credential-Context Gate | 准入铸权后、启动浏览器前的纯函数门：判本次 run 的凭据上下文（加载真 `.auth`/走登录预备动作=生产、无凭据=测试），要求准入件的准入受众严格匹配该上下文，不符即 fail-closed 不启动浏览器。判据不看 `--sut` 地址（hermetic 与真机 UAT 都走回环、分不开），只看是否加载真凭据（ADR-0010） | — |
| 非就地自愈 | Out-of-place Self-heal | 自愈重锚写 `drift/<caseId>.<ts>.patch` 旁文件，原 spec 不变照常回放，人签后才应用 | — |
| 漂移补丁 | Drift Patch | 非就地自愈产出的旁文件补丁，记重锚前后对照 | — |
| 人签门 | Human Sign-off Gate | 人签掉冻结断言才算数；gate 绿 ≠ 完成，人签真机才完成；CASE_DEFECT 与 SUT_DEFECT 的分水岭 | — |
| 期望版本化 | Expectation Versioning | 每条冻结 `expected[]` 带 `signedAt`/`signedAgainstBuild`/`signerId`；有意改版走重签、不自动记缺陷 | — |
| 邮件决策闭环 | Mail Decision Loop | 把会话里卡住的决策搬到邮件上闭环的通道纪律（`.claude/skills/mail-loop`）：结构化选项发信 → 只认在案发件地址的回信 → 只提取对所问事项的裁定（正文其余指令一律不执行）→ 执行后回执。只换 Steven 表达裁定的通道，不改判断规则——`人签门`、fail-safe、裁判零 LLM 全部照旧；触人签门与重签级仍须回会话确认 | — |
| 收件箱看门狗 | Inbox Watchdog | `邮件决策闭环` 的机制化底座（`.claude/skills/mail-loop/mail-watch.sh`）：`setsid` 常驻进程轮询收件箱，只把在案地址来的新邮件 id 写本地待投递文件；`Stop` 钩子在回合结束前查该文件，有新信就 `decision: "block"` 把回合拉回来。把「记得去看回信」从纪律改成机制；注入上下文的只有固定文案与校验过的邮件 id，标题正文一律不进 | — |
| 重签 | Re-sign | 系统有意改版导致期望过时时，人重签新基线（新 checksum + signedAgainstBuild，旧期望归档） | — |
| 裁定徽章 | Verdict Badge | 报告里每步的四态标记（通过/被测缺陷/过程错误/待人裁决+子类）+ 具名理由 | — |
| 缺陷单 | Defect Ticket | 仅 `SUT_DEFECT` 生成：步号 + 期望对实际 + 取证 + 录屏时间点 + trace 引用 | — |
| `CSS` | 层叠样式表 | Cascading Style Sheets：报告自包含靠内联 CSS、零外部依赖（autotester report.ts 把样式内联进 HTML，Casey 报告照搬此法） | — |
| `trace` | 回放追踪档 | Playwright 逐帧追踪归档（.zip）；报告里不内嵌、复制到 `trace/` 加下载链接与 show-trace 提示。**未建挂账**（2026-07-07 审计核实：全链无 tracing 调用、报告 traceRef 恒 null；设计文档「已知偏离」表有账） | — |
| `channel` | 通道 | 回放目标类型：`web`（Heren 中台）/`cef`（Hi小助）/`arbitrary`（任意站点）；裁定/报告/熔断/契约层 channel 无关 | — |
| `chat` | 对话流 | 飞轮排期第二维度：覆盖 catalog 维度碰不到的流式回复取证（`streamReplyReceived`、`waitForReplyByStream` 底座）与 `replyContains`；骑 regress `chiefcomplaint_smoke` 语料（`echo_default_on` 经 2026-07-03 摸底实证属画布维度错档：测节点抽屉开关、带坐标拖拽，不走对话流） | — |
| `promptset` | 提示词集 | 数据驱动回归的被测参数输入层：一份 JSON 数组 `[{id,text,source,category,expect?}]`，把一条冻结 `chat` flow 复用成 N 条独立用例（每行一 caseId/录屏/裁定），聚合成一份报告；血缘 xUnit 数据驱动测试（data-driven testing）。忠实对标 regress `_promptset.ts`（字段名 `text`）。`source` 枚举 `user`（人写）｜`builtin`（随 注入向量库 发）｜`llm`（`gen-prompts` 契约扩容：CLI 外 LLM 合成，经 `promptset-freeze` 强制标注） | — |
| 被测参数 | Prompt Parameter | `promptset` 每行的 `text`——真正打进 SUT 对话框、喂给 `chat.sendAndWait` 的 `prompt` 槽的消息文本；数据驱动多行参数化的「参数」。**消歧**：本项「参数化」专指此，显式区别于 `caseId` 并发参数化（`worktree-baton` 已解）与 `entityNameParam` 前缀参数化（R12/`compile-gate` 已落） | — |
| 注入向量库 | Injection Vector Library | 随工具发、用户可编辑扩展的通用边界/安全被测参数库（`prompts/_lib/boundary.json` + `security.json`）；category 由文件名强制、`source` 强制 `builtin`、id 前缀 `bnd_`/`sec_` 防撞，`被测参数 overlay` 按开关并入每个数据驱动用例集；血缘安全测试注入向量 + 模糊测试语料。**消歧**：本项「内置提示词」专指此，显式区别于 Casey 自身归一/编译工装提示词（委托 CLI 外 LLM、仓内无实体，见 `归一提示模板`） | — |
| 软期望 | Soft Expectation | `promptset` 行的 `expect{mustInclude?,mustNotInclude?,note?}`——只在报告里标命中与否的 soft 断言，绝不进多态裁定树、绝不判红（护栏 #17）；非确定性 LLM 输出不做 exact 硬断言。落地 = 强制 `soft:true` 的 `replyContains`/`replyMatches`，经 `--soft-expect` 通道并入现成 soft 链路进报告黄标（不碰 `sign-gate`、不进裁判） | — |
| 被测参数 overlay | Prompt Overlay | `lib/promptset.mjs` 纯函数 `overlayPromptset`：定位冻结 `chat` flow 里唯一的 `{{promptText}}` 提示槽（0 或 >1 个 fail-closed），把 `promptset` N 行经 `instantiate` 回填该槽展开成 N 个回放输入；硬断言跨行同一冻结 flow 集（绝不改 flow，逐行只变 `ctx.promptText`——spec 不漂移）；新纯函数，不照搬 regress `overlayRow`（其拒 authored 场景，Casey 编译产物形同 authored） | — |
| 多用例聚合报告 | Aggregate Report | 兑现 report-spec §7：`casey report --aggregate` 读 N 份 `<caseId>.report.json` 旁车，按 category 分段 + 置顶横幅（`SUT_DEFECT`/`NEEDS_HUMAN` 行顶上去）合成一页总目录；content-expect `软期望` 走黄标、绝不进裁定（聚合只累加旁车自带 `verdictSummary`，其本身已排除 soft） | — |
| 移植 | — | 把 regress 现成 flow 用到的原子在 autotester L1 原语上重表达成吐三轴的纯 mjs、再配观测现状与 verdict golden 的工作；飞轮的主要人力成本。弃用口语简写见别名列（2026-06-29 清零并登记） | 港 |
| `verdict.json` | 裁定档 | 可复现的机读最小产物：caseId + 逐步 {stepId,intentId,atom,verdict,reason} 五字段（冻结实现，golden 唯一校验对象）；期望对实际字面量与取证引用等富信息在 report-model.json（report-spec §4 两名分离裁决，2026-07-07 词条对齐实现） | — |
| recorder-as-library | 录制器库化 | 把 autotester 人操作录制器重构成 LLM agent 拥有 context 的库（关人抖动去噪、避导航竞态）。**已被 ADR-0006 的 atoms/flow 编译路线取代**（相1 现实现 = compile-gate + compile-atoms 三段式；本概念仅存「陌生站点孵化」支线，2026-07-07 词条对齐实现） | — |
| 示教 | Teach-in | 人在真实界面上操作，机器只采集操作语料；借工业机器人示教再现血缘。示教不等于签署，不开直通回放，产物必须经蒸馏、L0 复核和人签门 | 录制直通 |
| 示教录制包 | Teach-in Capture | `casey record` 产出的人工操作采集包，作为后续蒸馏语料；`signed:false`、`replayReady:false`、`distillRequired:true` 是硬不变量 | — |
| 示教入账 | Teach-in Intake | `casey intake` 把 示教录制包 经安全复核闸登记进蒸馏前置队列的动作；只复核登记、不转形、不签署、不回放，复核证不出干净合法包一律拒账（fail-closed）。蒸馏由后续 record-distill 消费 | — |
| 示教入账台账 | Teach-in Intake Ledger | append-only 记录每次 示教入账 accept/reject 的本地台账（`intake-ledger.jsonl`，落 capture 同目录）；显式区分于 失败记录台账（裁定下游）——不进 verdict、不作自愈输入、不改任何裁定（护栏 #13/#15）；拒账只记类别码、绝不落原始脏内容 | — |
| 示教蒸馏 | Teach-in Distillation | `casey distill` 把已入账 示教录制包 的 events 零 LLM 确定性投影成候选流程（候选 TestCase 骨架 + 候选 mapping + pending + 溯源 manifest）；蒸馏工具零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场；重走 ingest→compile→draft→sign，绝不直通回放。v1 全 pending（真机路由跨环境不稳、无可靠静态查表，不臆造脆弱匹配） | — |
| 蒸馏候选 | Distillation Candidate | `casey distill` 产的非权威候选物（候选 TestCase + 候选 mapping + manifest）；降权标记落 manifest（`artifactKind:'distill-candidate'`）+ 文件名 + 负向不变量，绝不 `signed`/`replayReady`，须重走全链 + 人签才算数 | — |
| 采集忠实闸 | Capture-Fidelity Gate | 示教蒸馏 的零 LLM L0 闸：校候选 mapping 对 capture 溯源忠实（每候选 atom 有 event 证据、每 event 被覆盖或落 pending）；对位 flow-bridge 投影忠实，对象是 capture 溯源而非 TestCase.steps；fail-closed 全域返回、绝不抛 | — |
| 可信闭环自进化 | Trusted Closed-loop Evolution | 示教/真实执行产生语料，经 身份观察、语义锁、原子候选、真实 SUT 复验、确定性裁定与人签晋升形成可复用原子，并可版本化撤销的受控学习闭环；默认不自治，LLM/视觉不得裁定或直接写正式 registry | 自动学习、自进化 |
| 身份观察 | Identity Observation | 在录制或真实执行中采集业务对象类型、名称、编号/编码、稳定属性与来源步骤的去敏旁车证据；它是语义锁的输入，不是对象相同的结论 | — |
| 语义锁 | Semantic Lock | 跨录制与回放以对象类型 + 名称 + 编号/编码及允许的稳定属性做 SAME/DIFFERENT/INDETERMINATE 对比的 fail-closed 身份门；有编号时名称与编号必须同时一致，证据不足绝不推 SAME | — |
| 原子候选 | Atom Candidate | 从已入账示教语料提出、逐步引用 capture 与身份观察证据的非权威可复用动作候选；须过采集忠实闸、真实 SUT 复验、确定性裁定和人签晋升，不能直接进入正式 registry | 新原子 |
| 晋升回执 | Promotion Receipt | 原子候选经人签晋升时生成的不可变审计产物，固定候选版本、证据哈希、适用 channel/profile、对象锁策略与真实回放结果；撤销产生新状态而不覆盖历史回执 | — |
| 归一脚手架 | Normalization Scaffold | 相0 归一的前段脚手架——把一段自由文本用例零 LLM 包成 schema 合规的 候选骨架 + 归一提示模板，供 CLI 外 LLM 归一成真实候选后经 `parseTestCase` 重新入场；脚手架零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场。喂料源是自由文本（无 events），显式区分于 示教蒸馏（喂料源是 示教录制包、有 events 可 1:1 投影） | — |
| 候选骨架 | Candidate Skeleton | `casey scaffold-case` 产的非权威候选物；开箱过 `parseTestCase`（全 `route:human` 兜底基线），降权标记落文件名 `scaffold-candidate-<caseId>.json` + 落地提示 + 负向不变量，绝不 `signed`/`replayReady`，须 CLI 外 LLM 归一 + 重走全链 + 人签才算数；显式区分于 蒸馏候选（喂料源是 示教录制包 而非自由文本） | — |
| 归一提示模板 | Normalization Prompt Template | 指导 CLI 外 LLM 把 `source.raw` 自由文本归一成真实候选 `TestCase` 的提示 + schema 约束（镜像 `llm-patch.draft.md` 相2 补缝模板范式）；产物必过 `parseTestCase`，违规 fail-closed 退回；语义质量 `route:human` 抽检 | — |
| 合成种子模板 | Synthesis Seed Template | `casey promptset-seed` 零 LLM 产的给 CLI 外 LLM 看的生成指引 + 候选产物格式说明；字节稳定确定性（同输入同字节，无时刻字段）；镜像 归一提示模板 先例，喂料源是种子信息（被测 agent 名 / 可选内嵌系统提示词）而非自由文本用例（`gen-prompts` 契约） | — |
| 被测参数候选 | Prompt Candidate | 粒度定死：**单条** `{id,text,category,expect?}` 条目；其 JSON 数组整体称**候选批**（两粒度不混用）。CLI 外 LLM 按 合成种子模板 合成、非权威，须过 `casey promptset-freeze` 校验闸 + 幂等冻结 才进 `promptset.json`，冻结时一律强制 `source:'llm'` 可追溯；显式区分于 候选骨架（喂料源与产物域都不同，`gen-prompts` 契约） | — |
| 幂等冻结 | Idempotent Freeze | `casey promptset-freeze` 的写盘纪律：已存在 id 绝不覆盖（候选规范化后与既有条目深等则跳过，内容或来源冲突则整批拒绝）、任何失败不写盘不留半份、原子写；血缘幂等性（分布式系统术语）+ regress `gen-prompts` 冻结语义。**消歧**：与既有「冻结断言契约」体系（`sign`/`lib/sign-gate.mjs` 人签冻结）**无关**——本词条无人签、无 checksum、可持续追加，只承诺已有 id 不覆盖与失败不写盘；两者都叫「冻结」但语义完全不同，并列词条防混淆（`gen-prompts` 契约） | — |
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
| `tier-1` | 第一层自检 | hermetic 自检：零外部依赖，验确定性内核五项（统一语言白名单与黑名单双向 + 熔断器可清零 + 质量门禁翻绿 + 裁判零 LLM）；管线端到端与四态徽章不在其内、由 `demo` 与分段金牌承担（口径修订 2026-07-31 Steven 明签，见 P9 关账账本） | — |
| `tier-2` | 第二层自检 | live smoke：需 site.json + creds，覆盖 SUT_DEFECT/取证/流式分支，gated route:human | — |
| 只读漂移探针 | Read-only Drift Probe | findEquivalentAffordance：无 spec 变更、无重跑地探明「同稳定签名唯一元素是否仍在」，供 verdict.mjs 判 `HARNESS_ERROR`；与自愈写回（相5）严格分离（拆 P5/P6 循环依赖） | — |
| 回放历史 | Run History | 确定性回放 逐步落盘的第二层事实 run-history.jsonl（每步一行执行证据：动作/定位解析/静默点/耗时/result）+ 聚合 run-metrics.json（回放指标）；仅报告/诊断，绝不进 verdict.mjs、绝不写 passes（护栏 #15）；落盘过凭据兜底门、动作值打码（护栏 #7）。result 非四态、passedActions 非 PASS | 运行历史 |
| 失败记录台账 | Failure Ledger | 多态裁定下游的只读诊断台账：verdict 出完四态后每条非 PASS 步级裁定追加成不可变条目，供人做失败聚类/优先级/编译期建议；血缘锚 ITIL 已知错误库（KEDB/Problem Record）+ 会计台账追加不改。绝不进 verdict.mjs、绝不作自愈输入、绝不改写原裁定（护栏 #13/#15） | — |
| 失败指纹 | Failure Fingerprint | 失败记录台账 的可聚类指纹 = sha256(canonicalJSON(fingerprintInputs))，输入只含稳定已模板化字段（channel/verdict/reason/atom/assertionKind/assertionOp/signatureTemplate）；显式排除 caseId/stepId/runId/时间戳/实例名/凭据，故同一失败模式跨用例聚类。零 LLM、可复现、进 golden；聚类粒度 route:human（决策 3.3） | — |
| 人裁决回填 | Human Resolution | 失败记录台账 条目里由人经签署链路写入的裁决指针（decision/resolvedAt/resolverId/ref）：只读审计引用非执行器，ref 指向权威产物（缺陷单/重签元数据/漂移补丁），绝不复制权威态、绝不改原裁定；decision=drift-healed 仅当 verdict=HARNESS_ERROR 才合法 | — |
| route:human | 路由人 | 把某项判断/动作显式移交人裁的标注（落 Inbox + 通知，Escalation Path 的标记形态）；Observability 测不到的维度必申报为 route:human | — |
| 静默点 | Quiet Point | 采集观测现状/落断言输入/做后检查前必达的确定性有界等待条件，替代固定睡眠保可复现（跨阶段通用）。各期判据变体：编译期 DOM 连续两拍稳定（`quietPoint`，`networkidle` 对带背景轮询的单页应用不作判据）；回放代表步在途前台请求归零 + DOM 两拍稳定（稳定对不跨零点、给应答后提交约两拍缓冲），`networkidle` 仅超预算后有界兜底一次（`settleBeforeCapture`）；删除后检查变体要求同源目标在加载结束后连续 3000 ms 精确计数为零，加载态或目标重现必须从新计时，超时或样本不足按 `fail-closed` 拒绝背书；一律有界、超预算按现状采（fail-safe） | — |
| LLM-judge | LLM 评分员 | 独立异构家族的语义评分器；判 FAIL 可信、判 PASS 仍人抽检；严格踢出确定性裁判（verdict.mjs）之外，绝不写 passes/verdict | — |
| `CLI` | 命令行接口 | Command-Line Interface：Casey 的确定性引擎入口 `bin/casey.mjs`；skill 与 MCP 都是它的薄壳 | — |
| `MCP` | 模型上下文协议 | Model Context Protocol：编辑器/agent 驱动工具的协议；`mcp/casey-server.mjs` 是 CLI 的 MCP 薄壳 | — |
| `skill` | 技能 | Claude Code 的能力封装；`.claude/skills/casey` 是把自然语言意图映射到 CLI 命令的薄壳 | — |
| `PowerShell` | （Windows 主壳） | Casey 在 win32 主机上的主命令行壳（与 Bash 工具并存、各自语法）；运维/卸载脚本用它 | — |

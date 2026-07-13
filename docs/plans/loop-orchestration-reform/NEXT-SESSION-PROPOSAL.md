# 下一次 session：loop 编排改革提案

> **已被取代（SUPERSEDED，2026-07-13）**：本文批准记录中的决策 ①（B/C 先行）与 ③（本期不以 `state.json` 替代）已被 Steven 显式批准的 `docs/plans/loop-dual-profile-reform/PROPOSAL.md`（第 0 节批准记录）反转取代；未被反转的其余决策（护栏 #18 不推翻·合并人裁、强制层改动 `kernel` 级治理、默认 2 限界上下文、backlog drop 须 Steven 确认等）由该提案对应条款延续。本文自此仅作历史背景，不再是活动执行序。

> 本文是下一次开发的候选执行方案，不授权当前 session 直接改实现。
>
> **批准记录（2026-07-13，Steven）**：按下方「方案审查结论」的修订顺序执行，七项决策——① 先收 B/C 在制契约再做大改革；② 不推翻护栏 #18：不建共享 worktree registry、共享状态池、自动 merge queue，合并冲突保持人裁；③ 增量扩展现有 contract 台账（更强证据 + checkpoint 字段），本期不新建 `state.json` 替代；④ `gate.mjs`/`contract.mjs`/`hook-loop-guard.mjs`/`term-lint.mjs`/签名与 checksum 写路径等强制层代码改动一律按 kernel 级治理；⑤ 默认保持既有 2 个限界上下文，Replay/Verdict/Reporting 等按模块表达，另立上下文须具体实证；⑥ round-2 复核只对 HIGH/MED findings 强制，LOW 记 debt（多条叠加成高风险除外）；⑦ 任何 backlog 项 drop/archive 须 Steven 明确批准。`docs/plans/loop-ddd-overhaul/DESIGN.md` 为唯一设计源，本文只作评审后的执行摘要。

## 本次 Claude Code 只做什么

本次只进行方案审查：阅读本文和真实代码，判断方案是否存在架构错误、遗漏、范围过大、迁移风险或与 Casey 硬规则冲突的问题。

本次禁止：

- 修改 `bin/`、`lib/`、`loop-kit/` 等实现；
- 初始化实现契约；
- 启动大规模 Workflow 或 worktree；
- 为了证明方案可行而提前实现其中一部分；
- 把方案审查写成“已完成”。

本次应输出：

1. 按 HIGH/MED/LOW 排序的问题，带文件和行号；
2. 方案中正确、应保留的部分；
3. 需要 Steven 拍板的设计分岔；
4. 建议修订后的下一次执行顺序；
5. 若没有阻断问题，明确写出“方案可在下一次 session 执行”；
6. 若有问题，只修改本文方案或提出修改建议，不改实现。

## 方案审查结论（2026-07-13，Claude Code，只审不改实现）

> 本节是对本文的评审产出。**执行以本节「修订后的执行顺序」为准**；下方原 Phase 0–4 保留作背景意图，其具体设计以 `docs/plans/loop-ddd-overhaul/DESIGN.md`（唯一设计源）为准。评审方法：3 路只读子代理核验 loop-kit 状态机 / checksum 漂移 / DDD 现状，加主会话亲读恢复文档、编排脚本、护栏、交接文档与 DESIGN.md 全文。

### 总判定

本文 8 条动机**全部属实**（每条有代码或提交级硬证），但执行方案有 4 处 HIGH 问题：与 Steven 同日已拍板路线冲突、撞护栏 #18 锁死决策、「最小接管」实际吞并了 DESIGN.md 刻意后置的高危 Phase 2、对强制层自身的改动没安排 kernel 级治理。这些都可通过修订排序与范围解决，不需要推翻方向。

### HIGH（阻断原排序，已由本节修订化解）

1. **排序冲突（需 Steven 拍板）**：本文 :28-29「先改造 loop → 再让新 loop 接管 B/C」与 Steven 同日已定路线（`docs/plans/_session-resume/RESUME-2026-07-13.md:47-55`：隧道 → 重起 `bc-contracts-workflow.js` → 真机 UAT → 合并收尾）直接冲突。B/C 两契约接管**不需要任何新 loop 能力**：两树 baton 2/6、plan 已落盘、编排脚本按读盘幂等设计可直接重起（RESUME :53）。把 B/C 与真机 UAT 押在改革后面 = 无必要延迟 + 重复实现风险（`docs/HANDOFF.md` 已记过 wf-set-node-field 误判停摆重实现的事故）。
2. **撞护栏 #18**：Phase 1 的 worktree registry 与最小 merge queue（本文 :77-78；同源 `DESIGN.md:112-116`、:191）撞 `loop/GUARDRAILS.md:41-42` 锁死的「不建共享池、自动合并守卫不建、合并冲突人裁」（2026-07-09 红队 1 High + 4 Med 背书、金牌 G7 实证）。跨树总览已存在且零共享态（`loop-kit/bin/contract.mjs:275-290` 的 `contract list`，从 `git worktree list` 派生）。要引入 merge queue 必须先由 Steven 明示推翻 #18 并同步修护栏文本，不能借改革顺带落地。
3. **「最小接管」不最小**：本文 Phase 1（:68-80）把 `DESIGN.md` 刻意拆开的 Phase 1（低风险：车道细化 / gate 分层 / 反向索引 / checkpoint 字段）与 Phase 2（高危：`active-contract.json` → `state.json`、六阶段降为投影，`DESIGN.md:164-170`）合并成一个「最小能力」，还叠加 merge queue。统一状态机动的是 `hook-loop-guard.mjs:14-71` 所读的强制层对象，中途翻车会让在制契约与阶段互锁悬空。必须按 `DESIGN.md` 原拆法分两期，Phase 2 单独立项、单独 grill。
4. **裁判员的改革没人裁判**：本文 kernel 车道定义（:87）不含 loop-kit 强制层——但 `gate.mjs` 是 `passes` 唯一写者（`loop-kit/bin/gate.mjs:105-116`）、Test Ratchet 唯一执行点（:49-65）。按本文车道表，重写 `gate.mjs` 只需 full 甚至 light 治理，这是自弱化漏洞。改 `gate.mjs`/`contract.mjs`/`hook-loop-guard.mjs`/`term-lint.mjs` 必须 kernel 级（双设计审 + 人签），且须处理 ADR-0001：loop-kit 是 autotester 拷入快照，第二消费者大改造成的两消费者分叉，本文只字未提。

### MED

1. **Phase 3 与 DESIGN.md 双源**：四件 DDD 资产 4/4 逐字重复 `DESIGN.md:120-138`（子代理逐项对照零新增零冲突），且比它少「renderer 不重解释四态」一条与三件配套动作（term-lint 职责收缩、CONTEXT.md 结构字段、未登记术语分级收紧）。两份改革文档并存正是本文自己批判的双状态源——应明定 `DESIGN.md` 为唯一设计源，本文降级为执行摘要。
2. **测试结果缓存有 fail-open 风险**：本文 :91「输入 hash 未变时不重复运行」等于拿历史 PASS 当现证，与本文自己批评的 `contract.mjs:238-248` 同型。边界必须写死：缓存只服务开发内循环；merge 收尾 / kernel / full / 发布必真跑；缓存键须含 fixture、浏览器与运行时版本等全输入闭包（`DESIGN.md:104` 已列全，本文丢了边界）。
3. **Phase 0 重复已完成的盘点**：`DESIGN.md:205-257` 已是带事实校正与处置建议的约 20 项 backlog。Phase 0 应收缩为「对 §十一 做增量刷新 + Steven 确认 drop/archive 项」。
4. **一个 session 装不下**：完成标准（:139-153）预设全部改革落地 + 全部 backlog 分类 + 真机 UAT + 5 项恢复演练同 session 完成，按实际吞吐是 2–4 个 session 的量，须按修订顺序分期。
5. **批量重签的人签边界**：反向索引配套的「批量重签」（`DESIGN.md:106`）会写 `testChecksums`——现唯一写者是 `bin/sign.mjs:196` 且受 ADR-0004 人签门。verify/查询部分 light 即可；批量写签名必须保人签、单列契约。
6. **节点推进写权未设计**：16 节点里每个节点谁有权翻 `passed`？`gate.mjs` 单写者模型如何推广到 plan-review/adjudicate 这类节点？`DESIGN.md:54` 只讲证据绑定没讲写权。不解决就是把护栏 #2「自我报告不作数」的窟窿从阶段级搬到节点级。

### LOW

1. 未登记新词（ADR-0005）：merge queue、worktree registry、durable workflow、checkpoint、kernel 车道、fitness functions、Context Map、Aggregate Catalog 均未入 `CONTEXT.md`（Published Language 已登记 :44）。`DESIGN.md:5` 有「落地前先登记」承诺，本文没带。
2. 并发默认值（:93）与护栏 #18「建议并发 ≤5 树」及 2026-07-09 八契约并行成功实证相左——属调参偏好非纪律，交 Steven。
3. Phase 4 清单缺项：约 40 处逐契约 route:human 真机尾巴、usability-audit F3–F6、breaker 进展哈希、countChange/checkFingerprint 小硬化、报告侧目标态、`run-convention-claude` 分支处置、HANDOFF/NEXT-SESSION 失真收口（含 pi 可驱性矛盾）——全部已在 `DESIGN.md:205-257`，再次指向以它为准。
4. 「8 限界上下文」偏细：`CONTEXT.md:12` 现声明 2 个限界上下文；Replay/Verdict/Reporting 更像 Casey 核心域内部模块。`DESIGN.md:124` 自带「审慎切上下文」保留话，应把「2 上下文 + 模块归属图」设为默认、8 上下文需另行论证。

### 动机核验（8/8 属实，应保留）

双状态源痛点（有细化：contract 台账是被强制的权威源，八段是易失编排层，`contract.mjs:10` vs `bc-contracts-workflow.js:4-13`）；脚本写死路径/模型/任务（`bc-contracts-workflow.js:16-44`；但「跨 session 不能恢复」需收窄为「粗粒度靠读盘幂等可恢复、Build 中途细粒度不可」）；阶段证据弱（`contract.mjs:225-251`：grill 非空即过、plan 正则「验收」、accept 只查键存在、learn 无条件 true）；无标准 checkpoint 曾致误判停摆重实现（HANDOFF 记录在案）；共享冻结无反向索引且漏签复发（12 个路径被 ≥2 份 prd 冻结、近 40 提交内 8 次实质重签、`gate.mjs:50` 只校单 prd、「全仓 ratchet 总核」仍是纯手工纪律）；light 契约支付全价治理（`bc-contracts-workflow.js` 对 light 车道同样跑满八段双评审）；DDD 结构守卫覆盖 1/6（仅 `bin/verdict-purity-guard.mjs`）；内部 golden ≠ 真机价值（护栏 #16 既有共识）。另：本文 :33 内核纪律不弱化清单正确，全程无内核违纪设计。

### 需要 Steven 拍板的分岔

1. **排序**：B/C 先行按 RESUME 既定路线跑（推荐）vs 改革先行再接管。
2. **护栏 #18**：是否立项推翻以引入 merge queue / registry（推荐：不推翻——保持人裁合并，只加 read-only 反向索引验证器）。
3. **唯一状态形态**：扩展现有 contract 台账、就地加证据字段与 checkpoint（推荐）vs 新建 `state.json` + 六阶段投影 + 双读迁移。
4. **kernel 车道范围**：是否纳入 loop-kit 强制层与批量重签工具的写签名面（推荐：纳入）。
5. **DDD 粒度**：2 限界上下文 + 模块目录（推荐）vs 8 上下文。
6. **治理松绑调参**：round-2 只对 HIGH/MED 强制、LOW 进 debt；并发默认值。
7. **backlog 处置确认**：`DESIGN.md` §十一的 drop/archive 项（`run-convention-claude` 删除、regress-strategy 归档等）。

### 修订后的执行顺序（下一次 session 按此执行）

1. **开场收口文档**（direct）：把 RESUME-2026-07-13 与 `docs/HANDOFF.md`/`docs/NEXT-SESSION.md` 对齐（HANDOFF 顶部未提两棵在制树、dev 头已前进、pi 可驱性矛盾），本提案两份改革文档与恢复文档入 git（文档先于 dev 提交）。
2. **按 RESUME 既定路线跑 B/C**：拉标准隧道 → 重起 `bc-contracts-workflow.js`（读盘幂等，重 launch 非 resume）→ Steven 在场时插真机 UAT 四子项。此步不因改革改变。
3. **空档起唯一一件改革前置小契约**：`ratchet` 反向索引 + 全仓核验命令（read-only 验证器，light 车道，冻结面零写入），赶在 B/C 合并收尾前可用——B 要重签 4 份 prd、C 有双冻金牌，正好首用。批量重签（写面）不并入，另走人签立项。
4. **B/C 合并收尾**：顺序合并 + 3-way + 重签 + 用新验证器跑全仓 ratchet 总核 + tier1 + 刷新交接文档。
5. **改革正式立项（本 session 末或下一 session）**：以 `DESIGN.md` 为唯一设计源走完整六阶段（强制层改动按 kernel 治理），grill 时带上一节分岔清单找 Steven 拍板；`DESIGN.md` Phase 1（车道细化 / gate 分层 / checkpoint 字段 / HANDOFF 拆分）先行，Phase 2（16 节点统一状态机）单独立项再审，恢复演练在 Phase 1 落地后用废弃契约做。

### 结论

按上述修订（排序改为 B/C 先行、merge queue 与 registry 移出待 Steven 裁、Phase 1 收缩回 `DESIGN.md` 原拆法、强制层改动升 kernel 治理）后，无 HIGH 阻断残留。**方案可在下一次 session 执行**（英文表述：The revised proposal is ready to be executed in the next session）。

---

## 下一次 session 的目标（原文，排序已被上节修订取代）

若本次审查没有阻断问题，下一次 session 按本文执行：

1. 先改造 loop 的最小接管能力；
2. 再让新 loop 接管当前尚未完成的开发任务；
3. 不做“基础设施全部重写完才恢复业务”的瀑布迁移；
4. 裁判零 LLM、fail-safe、Test Ratchet、凭据边界和人签门不得弱化。

## 为什么需要改

当前 Casey 同时存在：

- loop-kit 六阶段状态机；
- Claude Workflow 八段多 agent 编排；
- worktree baton；
- HANDOFF/audit 人工恢复状态。

主要问题：

1. 六阶段与八段不是同一状态机，存在双状态源；
2. Workflow 写死路径、模型和当前任务，跨 session 不能可靠恢复；
3. contract 的部分阶段只检查文件存在、关键词或历史 PASS，证据未绑定当前 commit；
4. agent 缺少标准 checkpoint，曾出现把未提交工作误判为停摆并重复实现；
5. 共享 golden 到 PRD 没有反向索引，checksum 漏重签反复发生；
6. 普通 light 任务也支付多轮设计审、汇裁、异构审、round-2 和全仓 gate 成本，开发节奏偏慢；
7. DDD 被简化为 `CONTEXT.md + term-lint`，只能约束部分术语，无法约束上下文、聚合、不变量和依赖方向；
8. 大量内部 golden 能证明内核自洽，但不能代替自然语言理解、跨 agent 一致性和真机用户价值验证。

## 下一次 session 的实施方案

### Phase 0：保护和盘点

- 保存 git、worktree、active contract 和未提交现场；
- 不覆盖 Steven 或其他 agent 的改动；
- 为每棵在制 worktree 生成 checkpoint；
- 从 HANDOFF、NEXT-SESSION、PRD、observability、Inbox、分支、worktree、未跟踪计划、exit 3 桩和代码事实建立唯一 backlog；
- 每项记录事实状态、依赖、风险车道、领域归属、验收证据、人工依赖和处置建议；
- drop 任何旧任务必须经 Steven 确认。

### Phase 1：loop 最小接管能力

建立唯一 durable workflow 状态，统一当前六阶段 contract 与八段 Workflow。每个节点至少绑定：状态、attempt、agent role、base/head SHA、输入输出 hash、命令和退出码、checkpoint、失败原因。

先实现最小能力：

- 风险自适应车道；
- 标准 checkpoint；
- focused/affected gate；
- 冻结文件到所有引用 PRD 的反向索引；
- worktree registry；
- crash recovery；
- 最小 merge queue。

不要先重写全部 loop-kit。

### Phase 2：风险自适应提速

- `direct`：文档、注释、无行为变化；实现后静态检查即可；
- `light`：plan-lite、红绿、focused gate、一次异构 review、affected gate；
- `full`：跨模块或共享接缝；完整计划、双视角 review、affected closure；
- `kernel`：verdict、sign、凭据、fail-safe、冻结协议；保持双设计审、双异构审、全仓 gate 和人签。

只有 HIGH/MED finding 强制 round-2；LOW 进入 debt。普通任务不默认跑全仓 Chromium golden。

gate 拆为 `static/focused/affected/full/live`。建立测试缓存；输入 hash 未变时不重复运行同一浏览器测试。full 只用于 kernel、合并收尾、每日构建和发布前。

默认并发：一个调度/合并 owner、两个 implementation owner、一个共享 reviewer。不要默认开启五至七个实现 worktree。

### Phase 3：DDD 从术语检查升级为结构治理

保留 term-lint 负责统一语言，另建结构化资产：

- Context Map：责任、所有权、上下游、允许/禁止依赖；
- Aggregate Catalog：root、identity、lifecycle、invariants、commands、events、允许的修改入口；
- Published Language：testcase/events/expected/axes/verdict/report/workflow schema 的 owner、consumer、版本和迁移规则；
- Fitness Functions：上下文依赖、聚合绕过、schema 所有权、禁止依赖和领域标识符检查。

重点检查：Verdict 不依赖 LLM/network；Reporting 不写或重解释 verdict；MCP 不拥有领域规则；CLI 不直接改冻结断言；loop-kit 不依赖 Casey 核心域；agent adapter 不实现业务裁定。

每个计划必须回答：属于哪个上下文、修改哪个聚合、影响哪条不变量、是否改变 Published Language、是否新增概念、是否跨上下文依赖、哪些层不应承担该规则。

### Phase 4：用新 loop 完成剩余工作

优先核验并接管：

1. `drawer-lock-hardening`；
2. `gen-prompts`；
3. 真机 UAT：历史用例、record/intake/distill、新自然语言用例全链、Claude/Codex/Pi MCP；
4. `heal` exit 3 桩是否属于当前版本范围；
5. `selftest --tier2`；
6. trace 文档承诺与实现偏差；
7. web/cef/arbitrary 多 channel 的真实完成度；
8. 扫描发现的其他未完成任务。

恢复已有 worktree 时先按 commit 和 artifact hash 核验。真实完成的节点跳过；缺证据就重跑验证；不得重复实现。

优先顺序：在制契约收口 -> 新自然语言用例到真实报告 -> 真机 UAT 和跨 agent 接入 -> 文档宣称但未实现的能力 -> 非关键优化。

等待人签、凭据确认或真机操作时，其他无依赖任务继续运行，不允许整个队列空转。

## 必须做的恢复演练

在下一次实施中主动验证：

1. Build 中途终止 session；
2. review 中途终止 session；
3. 两棵 worktree 一成一败；
4. merge 后出现共享 checksum 漂移；
5. 零上下文 Codex 或 Pi 只读机器状态后继续第一个未完成节点。

目标：五分钟内恢复，不依赖维护者口头解释，不重复实现。

## 下一次完成标准

- 新 loop 成为唯一当前状态源；
- light 契约中位 lead time 目标小于 60 分钟；
- 普通变更默认只跑 affected gate；
- checksum 漏签为零；
- session 中断后五分钟内恢复；
- DDD 检查能发现结构违规，而非只检查术语；
- 所有旧任务均被分类，没有失踪任务；
- continue/merge 项完成或明确阻塞；
- drop 有 Steven 确认；
- 合并后全仓 ratchet 和 tier1 通过；
- 能执行的真机 UAT 已执行；
- README、HANDOFF、NEXT-SESSION、CONTEXT 与实现一致；
- 不把 exit 3、文件存在、历史 PASS 或 agent 声明当完成。

## 本次审查的最终问题

请 Claude Code 最后明确回答：

1. 这个方案是否存在会破坏 Casey 内核纪律的问题？
2. 唯一 durable workflow 是否应扩展现有 contract，还是另建兼容层后逐步迁移？
3. Phase 1 是否足以接管现有在制任务？
4. 哪些任务必须保持 kernel 级治理，哪些可以降为 light/full？
5. DDD 资产划分是否过度，哪些只是模块而非限界上下文？
6. 是否遗漏任何现有 worktree、未完成产品承诺或 route:human 工作？
7. 若没有 HIGH 阻断，确认下一次 session 可以按修订后的本文执行。

# Casey loop 与 DDD 治理改造 —— 设计与实施计划（草案 v0.1，待确认）

> **已被取代（SUPERSEDED，2026-07-13）**：Steven 已显式批准 `docs/plans/loop-dual-profile-reform/PROPOSAL.md`（批准记录见其第 0 节）为唯一活动改革设计源。本文自此仅作历史设计输入，不再是执行依据；其 findings 与 backlog 已并入该提案（backlog 行完成度以实时代码与 git 历史核验为准——本文 §十一 的 countChange 行已被证实陈旧，见该提案 P0-9 政策与 `FABLE-REVIEW-DISPOSITION.md`）。

> 状态：设计稿，**未经确认不开始大规模实现**（用户明令）。
> 目标不是「再加一套规范」，而是三个转变：① 双状态源 → 唯一 durable workflow；② 全任务重治理 → 风险自适应治理；③「术语一致即 DDD」→ 上下文/聚合/不变量/交换协议皆可验证。
> 本稿产出：findings（带行号）→ 目标架构与状态机 → 分阶段计划与迁移 → 保留/替换/废弃 → 剩余业务 backlog。术语以 `CONTEXT.md` 为准；本稿新词落地前先登记。

---

## 一、findings（基于真实代码核验，HIGH/MED/LOW）

> 证据行号基于本会话读到的源码。标 `[实证]` 为已直接核到代码；标 `[待子代理]` 为等两路只读扫描确认后补。

### HIGH

- **H1 双状态真相源，无映射 [实证]**：`loop-kit/bin/contract.mjs:10` 定 6 阶段 `grill/plan/accept/loop/review/learn`；`docs/plans/_session-resume/bc-contracts-workflow.js` 定 8 段 `Plan/PlanReview/PlanArb/Build/Review/ReviewArb/Fix/Learn`。两者无一一对应、各自维护阶段真相：contract 台账写 `loop/active-contract.json`，Workflow 阶段只活在内存/journal。同一契约「到哪一步」有两个互不知情的答案。
- **H2 阶段证明过弱，可被绕过 [实证]**：`contract.mjs:225-251` `artifactValidFor`——`grill` 仅查文件非空（:230）；`plan` 仅正则 `/验收/` + 路径等于 `docs/plans/<slug>/plan.md`（:232）；`accept` 仅查 `testChecksums` 非空（:236）；`review` 仅查 `audit.jsonl` 有 `slug+review+pass` 行（:245）；`learn` 无条件 `return true`（:249）。阶段「done」不绑 plan 内容 hash、commit SHA、被测文件 hash 或红基线证据。
- **H3 门证据无因果绑定 [实证]**：`contract.mjs:46-47` + `:265`——`user-confirmed`/`red-verified` 只是调用者自报布尔（`opts['user-confirmed']===true`），不绑 plan hash / commit / 测试 hash / 红基线输出。任何调用方传 `--user-confirmed` 即过 grill 半硬门，机器无法证伪「真被 grill 过 / 红真验过」。
- **H4 Test Ratchet 无反向索引，共享冻结漏签复发 [实证，硬证]**：`gate.mjs:50-65` 只遍历**单个** `prd.testChecksums`；全仓引用 `testChecksums` 的可执行体仅 4 个（`sign.mjs:196` 写单 prd / `gate.mjs:50` 校单 prd / `casey.mjs:200` 初始化空 / `contract.mjs:236` 判非空），**无任何执行体遍历 `loop/prd-*.json`** 做「冻结文件 → 引用它的所有 `prd`」反向索引。实证 12 个共享冻结文件被 ≥2 个 `prd` 引用（`chiefcomplaint-smoke.golden.mjs` 3×，`cli-mcp-face.golden.mjs`/三个 `*-sut/server.mjs`/`seams/*.fixture.json`/`verdict-cases.json` 等 2×）。**硬证**：`active-contract.json` 的 `laneReason` 与 `audit.jsonl` 末行证明——整个 `resign-drift-closure` 契约就是为补两处共享冻结漏签（`verdict-cases.json` + `cli-mcp-face.golden.mjs`）而建。风险不是理论，已实际发生。
- **H5 跨 session workflow 不可恢复 [实证]**：Workflow `resumeFromRunId` 同 session 限定（工具契约明载）。session 中断 → 只能重启新 session 重跑，靠 `docs/HANDOFF.md` 叙事人工判断已完成阶段。恢复正确性依赖维护者口头/文档，不满足「零上下文 agent 按机器状态 5 分钟恢复」。

### MED

- **M1 Workflow 是会话脚本非 durable workflow [实证]**：`bc-contracts-workflow.js` 写死绝对路径（`/mnt/d/ctx/heren/casey`）、具体模型型号（`fable`/`sonnet`/`gpt-5.6-sol`）、当前任务 brief（drawer-lock-hardening/gen-prompts）。换机器/换任务/换模型都要改脚本，非可复用编排。
- **M2 治理成本对低风险任务过重 [实证]**：`checkAction`（`contract.mjs:63-74`）对 `light`/`full` 一律要求 plan/accept/review 传递链；改一行注释或独立夹具也要走契约。缺 `direct` 之上的细分「加法型原子/既有接缝内行为改」的轻量路径（现 `light` 仍需 plan 门 + accept 红基线 + review）。
- **M3 gate 单层、无缓存、无分层 [实证]**：`gate.mjs` 单入口跑 testChecksums + term-lint + 全部 story `acceptance`（:82-113），每条 `acceptance` 命令无条件 `execSync`（:96）、无输入 hash/memoization/affected 检测/跳过；`config.qualityGate` 仅 `prd`/`termLint`/`commandTimeoutMs` 三字段，无 `static/focused/affected/full/live` 分层。**校正**（子代理核实）：并非「每条 acceptance 都起 chromium」——66/69 golden 是 hermetic node 测试（fake-sut），仅 `demo`/`layer3-wiring`/`e2e`/`replay` 少数几条驱浏览器；但因无缓存，这几条每轮都重启 chromium，且全部 hermetic 测试也每轮重跑。缓存价值＝跳过输入未变的 node 测试 + 少数 chromium 条。
- **M4 worktree 只解隔离，未解调度 [实证]**：`contract.mjs worktree`/`list`（:275-319）给了起树 + 跨树 baton 总览，但无依赖 DAG、心跳、失败恢复、合并队列、共享文件冲突归并。护栏 #18 明说「合并策略与冲突裁定是纪律非机制」——即合并全靠人。
- **M5 gate 只验内部纪律，不验语义/跨 agent/真机价值 [实证]**：gate 三检查全是确定性内部纪律（checksum/术语/exit code）。自然语言理解正确性、跨 agent 一致性、真机用户价值全靠 route:human（护栏 #16），无结构化机器检查位。
- **M6 DDD 结构规则多数无机器检查 [实证，子代理已校正]**：`term-lint.mjs` 只做统一语言白/黑名单 + 繁体检测（:72-110）；`CONTEXT.md` 只有术语表，无 `docs/domain/` 结构化资产（限界上下文图/聚合目录/发布语言登记/领域事件）。**校正**：并非「除 term-lint 全无结构检查」——已有两个真结构守卫：`bin/verdict-purity-guard.mjs`（静态扫依赖闭包禁 verdict import LLM/network，接入 `casey.mjs:207-210` 的 `selftest --tier1`）、`bin/config-lane-guard.mjs`（异构评审家族不变量，接入 `PostToolUse` hook）。但准确的收窄判断是：五条命名结构规则里只有「verdict 禁 LLM」有专用预防性机器守卫；其余四条——report 禁写 verdict（架构约定无检查）/ MCP 禁实现裁定（靠冻结金牌间接锁 argv 映射，非专用 lint）/ CLI 禁改冻结断言（只有 ratchet 事后侦测漂移，无预防守卫）/ loop-kit 禁依赖 Casey 核心域（散文+ADR，实测无违规但无 boundary 检查）——均缺预防性机器检查；且无聚合变更守卫、无发布语言所有权守卫。

### LOW

- **L1 CONTEXT.md 单文件膨胀 [实证]**：143 行、两大表格无限追加，术语登记缺 `owningContext`/`conceptType`/`canonicalCodeIdentifier`/`allowedLocations` 结构字段。
- **L2 状态与历史混杂 [实证]**：`docs/HANDOFF.md` 401 行，顶部当前态 + 大量「以下为 XX 快照只溯源」历史层混排；无 `loop/state.json` 唯一机读当前运行状态（`active-contract.json` 只是单契约 baton）。[待子代理确认无全局 state 文件]
- **L3 中文未登记术语永远只是 WARN [实证]**：`term-lint.mjs:102-105` CJK 加粗未登记只 `warnings` 不阻塞，无「先基线→只拦新增→逐步清债→核心域 fail-closed」分阶段收紧。

---

## 二、目标编排架构

### 2.1 唯一 durable workflow 状态

单一事实源 `loop/state.json`（每 worktree 一份，替代 `active-contract.json` 的语义、向后兼容迁移）。Workflow / CLI / Claude / Codex / Pi 都只能推进这一个文件；禁止另建隐形阶段。

状态节点（16 个，覆盖 6 阶段与 8 段的超集）：

```
intake → risk-classify → plan → plan-review → acceptance → red-baseline
  → build → focused-gate → review → adjudicate → fix → affected-gate
  → merge-ready → merged → post-merge-gate → learn
```

每节点记录：`nodeId`（稳定）/ `status`(pending|running|passed|failed|blocked) / `attempt` / `agentFamily` + `capabilityRole` / `startedAt`/`finishedAt` / `baseSha`/`headSha` / `inputArtifactHashes` / `outputArtifactHashes` / `command`+`exitCode` / `findingsDisposition` / `checkpoint` / `failureReason`。

节点 `passed` 判据升级（治 H2/H3）：不再是「文件非空」，而是绑 artifact hash + commit SHA + 证据。例：`red-baseline.passed` 须附「红命令 + 其非零 exitCode 输出摘要 hash」；`plan.passed` 须附 `plan.md` 内容 hash 且 `plan-review` 引用同一 hash；`acceptance.passed` 须附冻结文件 sha256 集。

### 2.2 六阶段 ↔ 八段 ↔ 16 节点映射（治 H1，消双状态源）

| 旧 6 阶段（contract） | 旧 8 段（workflow） | 新 16 节点 |
|---|---|---|
| grill | — | intake, risk-classify |
| plan | Plan | plan |
| — | PlanReview, PlanArb | plan-review |
| accept | — | acceptance, red-baseline |
| loop | Build | build, focused-gate |
| review | Review, ReviewArb | review, adjudicate |
| — | Fix | fix, affected-gate |
| — | — | merge-ready, merged, post-merge-gate |
| learn | Learn | learn |

`contract.mjs` 的 6 阶段成为新状态机的**视图投影**（`contract show` 从 `state.json` 派生 6 阶段摘要），不再是独立真相源。Workflow 脚本不再自持阶段，`agent()` 每段推进 `state.json` 对应节点。

### 2.3 能力角色（治 M1，模型不写死）

节点只认能力角色，具体型号放 adapter config（`loop/adapters.json`）：

- `planner` / `implementer` / `reviewer` / `crossFamilyReviewer` / `adjudicator` / `mergeOwner`

adapter 把角色映射到具体：`planner→fable@xhigh`、`implementer→sonnet5-ultracode`、`crossFamilyReviewer→codex gpt-5.6-sol / pi deepseek-v4pro`、`adjudicator→fable@xhigh`。换模型只改 adapter，编排与状态机不动。

---

## 三、风险自适应治理（治 M2）

四车道（扩 `contract.mjs` 现 `direct|light|full`，加 `kernel`；细化 `light`）：

| 车道 | 适用 | 流程 |
|---|---|---|
| `direct` | 文档/注释/独立夹具/无行为变化 | 实现 → 静态检查 → 完成（免异构评审、免全仓 gate） |
| `light` | 单模块/加法型原子/既有冻结接缝内行为改 | plan-lite → 红测试 → 实现 → focused gate → 单路异构 review → affected gate |
| `full` | 跨模块数据流/共享接缝/schema/多 PRD | 完整 plan → acceptance freeze → build → 双视角 review → affected closure → merge queue |
| `kernel` | verdict/sign/凭据门/fail-safe/冻结协议/裁定输入接缝 | 双设计审 → 实现 → 双异构审 → round-2 → 全仓 gate → 人签 |

`plan-lite` 结构化五字段（非散文）：失败模式 / 修改边界 / 红测试 / 影响文件 / 自动升车道条件。
round-2 只对 HIGH/MED findings 强制；LOW 进 debt 不阻塞普通交付。

---

## 四、gate 提速（治 M3）

拆 `gate.mjs` 为五层子命令：`gate:static`（term-lint + lint，无 chromium）/ `gate:focused`（本契约 story）/ `gate:affected`（反向索引算出的受影响 story 闭包）/ `gate:full`（全仓）/ `gate:live`（真机 route:human）。

默认开发只跑 `focused + affected`。`full` 仅在：kernel 变更 / merge queue 收尾 / 每日构建 / 发布前。

**结果缓存**：键 = implementation-dep-hash + test-hash + fixture-hash + Node 版本 + Playwright 版本 + 相关 config-hash。输入未变不重启 chromium。

**反向依赖索引**（治 H4）：`loop/ratchet-index.json`（可由脚本从所有 `prd.testChecksums` 确定性生成）——冻结文件 → golden → PRD → 接缝 → 下游模块。提供确定性命令：查改动影响哪些 PRD、列出必须重签的完整集合、人签后批量重签、验证全仓 ratchet。取代实现 agent 手工搜索逐个改 checksum。

---

## 五、并行与合并（治 M4）

默认并发：1 调度/合并 owner + 2 实现 owner（各一 worktree）+ 1 共享 reviewer；真机进集中 human window。不默认开 5–7 实现 worktree。

合并队列：`READY → REBASE → AFFECTED_GATE → MERGE → POST_MERGE_GATE`。多契约改同一共享 frozen file/golden → 自动归同一 merge wave，按依赖序合并，最后统一重签 + 统一跑 affected/full ratchet，不让每树重复处理同一冲突。

标准 checkpoint（治 H5，每 agent 持续写进 `state.json` 节点的 `checkpoint`）：已完成事项 / 当前 commit / 未提交文件 / 正在执行节点 / 下一条确定性命令 / 阻塞原因 / 是否允许他人接管。不靠聊天上下文判 agent 是否停摆。

---

## 六、DDD 结构化治理（治 M6）

term-lint 只保留统一语言职责。DDD 拆四类可执行资产 + 独立 fitness functions（结构化规则，非扫全词制造噪音）：

1. `Context Map`（限界上下文图）`docs/domain/context-map.md`：Casey Core / Loop Orchestration / Authoring-Compilation / Replay / Verdict / Reporting / Agent Integration / Infrastructure。每上下文记 responsibility/owns/doesNotOwn/upstream-downstream/publishedLanguage/allowed-prohibited dependencies。审慎切上下文——明确哪些只是 Casey 核心域内部模块。
2. `Aggregate Catalog`（聚合目录）`docs/domain/aggregates.md`：TestCase / Frozen Assertion Contract / Run / Verdict / Loop Contract / Drift Patch / Promptset。每聚合定 root/identity/lifecycle/invariants/commands/domain events/persistence/allowed mutation entry points/forbidden direct writes。状态修改必经聚合入口，CLI/MCP/renderer 禁绕过。
3. `Published Language`（发布语言）`docs/domain/published-language.md`：testcase/events/expected-frozen/axes/verdict/report-model/workflow-state schema，各记 owner/consumers/version/compat policy/freeze policy/migration。跨上下文只依赖发布语言。
4. `Architecture Fitness Functions`（架构适应度函数，新独立检查，覆盖 `.mjs/.js/.json/.md`，基于结构规则）：
   - **已有先例可扩，不从零造**：`bin/verdict-purity-guard.mjs`（静态依赖闭包扫描，禁 verdict import LLM/network，已接 `selftest --tier1`）与 `bin/config-lane-guard.mjs`（异构不变量，已接 `PostToolUse` hook）已证明「结构规则可机器强制」这条路走得通——新 fitness function 复用其依赖闭包扫描 + hook 接入范式，而非另起炉灶。
   - 待补检查：context dependency guard / aggregate mutation guard / published language ownership guard / domain identifier lint / forbidden dependency lint / schema ownership validation。
   - 具体机器规则（现状见 M6：仅 verdict-no-LLM 已有守卫，其余四条待补）：report 禁写 verdict；MCP 只调 application/CLI port 不实现裁定；CLI 不直接改冻结断言（预防性，补 ratchet 事后侦测的空档）；loop-kit 不依赖 Casey 核心域，Casey 核心域只经 loop-kit 公开接口用它；renderer 不重解释四态；agent adapter 无业务规则。

CONTEXT.md 瘦身：核心统一语言 + 指向上述资产入口 + 少量真跨域术语 + 弃用别名。术语登记增 `owningContext`/`conceptType`/`canonicalCodeIdentifier`/`aliases`/`allowedLocations`。中文未登记术语分阶段收紧（治 L3）：生成基线 → 只拦新增 → 逐步清债 → 核心域目录 fail-closed。

### agent DDD 工作协议（写进 plan-lite/plan 结构字段，非散文）

开工前必答：属哪个限界上下文 / 改哪个聚合或应用服务 / 影响哪条不变量 / 是否改 Published Language / 是否新增领域概念 / 是否跨上下文依赖 / 是否需 domain event / 哪些层不应承担该规则。
review 单列 DDD findings：misplaced responsibility / aggregate bypass / vocabulary drift / context leakage / duplicated domain rule / invalid published language dependency。

---

## 七、恢复与文档拆分（治 H5/L2）

- `loop/state.json`：唯一当前运行状态；
- `loop/events.jsonl`：短小结构化事件；
- `reviews/<review-id>.json`：完整评审；
- `docs/HANDOFF.md`：只留当前状态/阻塞/下一步；
- `docs/history/YYYY-MM/`：历史自动归档。

强制恢复演练（验收 = 零上下文 agent 5 分钟内定位并续第一个未完成节点、不重复已完成工作）：① build 中途杀 session；② review 中途杀；③ 两 worktree 一成一败；④ merge 后制造共享 checksum 漂移；⑤ 让零上下文 Codex/Pi 只按机器状态恢复。

---

## 八、分阶段实施（先 ADR 与计划，不大爆炸）

### Phase 1 低风险高收益（不碰 verdict 内核）
- 风险车道正式化（`contract.mjs` 加 `kernel` + `light` 细化 + `plan-lite` schema）；
- gate 分层（`gate:static/focused/affected/full`）+ 结果缓存；
- ratchet 反向索引（`loop/ratchet-index.json` 生成器 + 查询/批量重签/验证命令）；
- 标准 checkpoint 字段；
- HANDOFF 当前态与历史拆分 + `docs/history/` 归档。

预计改：`loop-kit/bin/contract.mjs`、`loop-kit/bin/gate.mjs`（拆分）、新 `loop-kit/bin/ratchet.mjs`、`loop/config.json`、`docs/HANDOFF.md`。迁移兼容：`active-contract.json` 保读、`gate.mjs` 无参仍等价 `gate:full`。

### Phase 2 统一编排状态
- `loop/state.json` durable schema + 16 节点；
- 6 阶段与 8 段统一（contract 6 阶段变投影视图）；
- commit/artifact hash 绑定（治 H2/H3）；
- merge queue 最小版；failure recovery。

预计改：`contract.mjs`（阶段→节点投影）、新 `loop-kit/bin/workflow-state.mjs`、`bc-contracts-workflow.js`（改为推进 state.json）、`hook-loop-guard.mjs`（读 state.json）。迁移：旧 `active-contract.json` → `state.json` 一次性迁移器 + 双读兼容层。

### Phase 3 DDD 结构化
- context map / aggregate catalog / published language registry；
- fitness functions（独立于 term-lint）；核心目录新增违规 fail-closed；
- term-lint 职责收缩；CONTEXT.md 拆分。

预计改：新 `docs/domain/*.md`、新 `loop-kit/bin/fitness.mjs`（或 `casey lint:ddd`）、`term-lint.mjs`（瘦身）、`CONTEXT.md`（拆分 + 加结构字段）、`.claude/settings.json`（挂新 hook）。

### Phase 4 跨 agent 验证
- 同一任务分别让 Claude/Codex/Pi 跑 plan-lite + 恢复流程，比对上下文归属/聚合识别/影响闭包/产物一致性/恢复正确性。

---

## 九、保留 / 替换 / 废弃

| 机制 | 处置 | 理由 |
|---|---|---|
| `gate.mjs` 三检查（ratchet/term/exec-spec）| **保留**，包进 `gate:full` | 内部纪律强，只是缺分层与缓存 |
| `verdict.mjs` 零 LLM 裁判 | **保留不动** | 内核铁律，提速不得降其严格性 |
| `contract.mjs` 6 阶段状态机 | **替换为投影** | 变 `state.json` 的视图，消双状态源 |
| `contract.mjs` worktree/list/baton | **保留 + 扩** | 加 DAG/心跳/merge queue |
| `bc-contracts-workflow.js` 会话脚本 | **替换** | 改为 durable workflow + adapter config |
| `active-contract.json` | **替换（兼容迁移）** | → `loop/state.json` |
| term-lint 统一语言 | **保留 + 收缩** | 只管语言，DDD 结构规则移出 |
| GUARDRAILS #7/#13/#15/#17 散文护栏 | **升级为 fitness function** | 散文 → 机器检查 |
| HANDOFF 混排 | **替换** | 当前态 vs `docs/history/` 拆分 |

---

## 十、硬验收指标（本轮完成定义引用）
checksum 漏签=0 / session 中断 5 分钟恢复 / 无重复实现在跑 agent 的活 / 每领域规则唯一 owner context / 核心聚合无绕 root 直改 / 跨上下文全经 Published Language / DDD 检查发现结构违规非仅拼写 / verdict·签署·凭据·fail-safe 严格性不降。

---

## 十一、剩余业务 backlog（只读扫描核验，非 HANDOFF 叙事）

> 约 20 个可辨识条目。原则：先恢复吞吐（loop 最小接管）→ 用 drawer-lock-hardening + gen-prompts 作首批真实迁移任务 → 合并收口跑全仓 ratchet → 集中真机 UAT → 补 DDD fitness → 最后 heal/tier2/trace/多 channel。

### 关键事实校正（backlog 扫描逮到，HANDOFF 叙事失真）
- **HANDOFF 顶部滞后一整个 session**：写「活契约槽 `resign-drift-closure` 六阶段 done、baton 空闲、下一契约直接 init」，但 `contract list` 有 3 活 baton，`drawer-lock-hardening`/`gen-prompts` 两 worktree 在制（2/6），HANDOFF 全篇未提。真实当前态在未跟踪的 `docs/plans/_session-resume/RESUME-2026-07-13.md`。
- **两在制契约 Build 零落地**：`git log dev..drawer-lock-hardening` 与 `..gen-prompts` **均空**，无任何 commit；plan/GRILL 存在但未 git 跟踪。`drawer` 树另有未提交 WIP `M tests/fixtures/fake-sut/server.mjs`（+33/-3，疑红先行夹具）。
- **dev HEAD 不符**：文档写 `dev=ff73011`，实际三 worktree 全停 `1e3c8cc`（dev 已前进）。
- **pi 可驱性文档自相矛盾**：`prd-distribution.json` + `NEXT-SESSION.md:103` 记「pi 驱不动别试」，`RESUME` 记「pi 已可驱 v0.80.3」——需对齐（本会话已实测可驱）。
- **易用性「✓」偏乐观**：`usability-audit` F3–F6（前段手搓 JSON 无脚手架/全新用例无 hermetic 路/`--profile` 手写/skill 硬编码 0-error 用例）仍开、未收敛为契约。

### A. 在制契约（continue，首批真实迁移任务）
| taskId | 车道 | 事实状态 | 处置 |
|---|---|---|---|
| drawer-lock-hardening | light | baton 2/6，Build 零提交，WIP `server.mjs` 未提交 | continue：按新 loop 接管跑 build→review→merge |
| gen-prompts | full | baton 2/6，Build 完全未起，无 lib/bin 改动 | continue |

### B. 真机 UAT（route:human，集中 human window）
| taskId | 事实状态 | 处置 |
|---|---|---|
| uat-phase0-tunnel | 相位0 关三隧道数据面断（wslrelay 半死），关一关二绿；绕行已清 | continue：`wsl --shutdown` 后重拉标准隧道 |
| uat-①-历史绿转非绿 | `tc_catalog_wf_crud`+`tc_wf_publish_states` 退绿未追因 | continue（autotest 账户） |
| uat-②-示教三环人录 | hermetic 建成，真机录一次未做 | continue |
| uat-③-ingest-scaffold 端到端 | `scaffold-case` 建成，全新用例真机端到端未走 | continue |
| uat-④-各家 agent MCP 挂载 | onboarding「留位」，真机核未做（pi 现可驱） | continue |
| uat-逐契约真机尾巴 | `grep route:human loop/prd-*.json` 约 40 处（画布五原子类名/时序、四停站 flow）| 聚合成一趟行程分批核销 |

### C. CLI 桩
| taskId | 事实状态 | 处置 |
|---|---|---|
| heal | `bin/casey.mjs:311` `notImplemented` exit 3；相5 仅纯函数骨架无 `bin/heal.mjs` | replan：future 契约，当前刻意桩非债；进范围须守「仅对确证 `HARNESS_ERROR` 开闸」 |
| selftest --tier2 | `bin/casey.mjs:288` `notImplemented`；tier1 真实现绿 | continue：并入 B 真机行程 |

### D. 设计对账表挂账（已核代码）
| taskId | 事实状态 | 处置 |
|---|---|---|
| trace-未建 | 全链无 tracing 调用，`lib/report-model.mjs:239` 硬写 `traceRef:null` | replan（低优增量；文档已「已知偏离」记账，别长期宣称有而恒 null）|
| cef/arbitrary 多通道 P8 | `channel` enum/`channelDriver` schema 已冻，回放仅 web 真实现，P8 未启动 | replan（大件，未启动）|
| breaker 进展哈希 | `--progress` 未建，仍按 git HEAD 判进展 | replan |
| countChange 选择器 | 硬编码 `.hr-table-row` 未走通道剖面 | replan（小硬化）|
| checkFingerprint gate | spec 指纹 gate 检查项未建 | replan |
| 取证标注小节 / action.describe / 变量来源#12 | 报告侧目标态未落地 | replan/drop |
| 多用例总目录聚合 | 原文显式标「非欠账·自留待裁决」 | drop（非债）|

### E. 草稿 / 分支 triage
| taskId | 事实状态 | 处置 |
|---|---|---|
| usability-audit F3–F6 | F1/F2 已由 `demo`+`run-convention` 解，F3–F6 仍开未成契约 | replan（未收部分开契约）|
| regress-strategy 草稿 | scope A 已落、scope C 成活契约 gen-prompts | archive（被取代）|
| docs/codex | 并行 codex 会话交接产物，非 Casey 工作 | 别碰（非本仓 backlog）|
| run-convention-claude 分支 | 功能已被 dev `b4f5c27` 取代 | archive（需用户确认再删）|

> 「旧 contract/audit/HANDOFF 迁移」未找到在办任务（worktree-baton 迁移已完成）——本轮改造自身产生的迁移（active-contract→state.json、HANDOFF 拆分）见 Phase 2/Phase 1。

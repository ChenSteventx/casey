# 接口交互诊断 · 事实基线（opus 5 xhigh 计划审 r1，2026-07-30）

> 缘起：首版技术计划流产——codex 会话在发出终稿前断线，`plan-sol-max-r1.log`
> 里没有计划正文。接手评审改为自己逐条核代码，产出本事实基线。**下一轮重跑
> 计划时拿它当地基，不要重做取证。** 文中每条结论都带文件行号，可抽查核实。

PLAN_CHANGES_REQUIRED

## 零、先说结论：**计划书不存在，本次无计划可审**

`docs/plans/api-interaction-diagnosis/plan-sol-max-r1.log` 里没有计划正文。证据：

- `PLAN_DONE_SENTINEL` 在该文件只出现 3 次（第 46、18669、19571 行），三次**全是提示词自身那句「末行 PLAN_DONE_SENTINEL」的回显**，不是 codex 的输出。
- 全文 `^#`/`^##` 标题只有两处（18570、19472 行），是 codex 自己用 `nl -ba` 读 `SCOPE.md` 的 exec 回显。计划书要求的「目标 / 既有资产实况 / 分层设计 / 判据表 / 最小改面 / 排期 / 风险 / 验收 / 术语」九个小节一个都不在。
- 权威账：codex 会话轨迹 `/home/test/.codex/sessions/2026/07/30/rollout-2026-07-30T15-47-11-019fb1fd-d2e8-77e0-b85d-f459574f7f54.jsonl`（351 行）里 `agent_message` 只有 6 条，全是几十字的过程旁白；最后一条记录是 `2026-07-30T08:15:23Z` 的 `reasoning`，紧接在把第 5 步标 `completed` 的 `update_plan` 之后——**会话在发出终稿消息前就断了**。累计 `input_tokens` 8,168,549、`output_tokens` 仅 32,176。
- 所以日志末尾那句「只读调研与方案汇总完成，现提交计划书」+ 五个 ✓，是 `update_plan` 的待办清单渲染，**不是计划**。

日志里幸存的中间结论只有两条实质发现（第 146、199 行位置的 `agent_message`）。我逐条核了代码，**这两条属实**（见下文第 1 条）。

下面按你给的 7 个审点，给出我**自己读代码核出来的事实基线**，作为重跑的地基；并对排期与首刀直接下裁断。

---

## 一、既有资产盘点（我实测，非转述）

**网络取证采集面** —— `lib/replay-forensics.mjs:85-160`，走 CDP `Network` 域。单条 `rec` 出生时带 11 个键（`:96`）：`requestId / url / method / status / ts / initiator / type / firingStepId / attributedStepId / errorEnvelope / streamFinished / streamStatus`。

**按发起方归因** —— `:88-95`：只有 `XHR`/`Fetch`/`EventSource`/`script` 发起的非背景请求才系到当前步；命中 `denylist`、无活动步、非 API 一律 `attributedStepId: null`（ADR-0007 的 fail-safe 落点）。`bin/verdict.mjs:53-59` 只对 `attributedStepId === stepId` 背书，所以 `null` 永不翻裁定。

**落盘产物形状（关键）** —— `lib/replay-axes.mjs:61-65` 的 `projectNet` 是白名单投影，`axes.json` 每条网络记录**只剩 8 键**：`url`（剥 host 只留 `pathname+search`、再打码）、`status`、`ts`、`initiator`、`attributedStepId`、`errorEnvelope`、`streamFinished`、`streamStatus`。**`method`、`type`、`requestId`、`firingStepId` 在这一层被丢弃**。孤儿记录分支 `:110-111` 重复了同一份字面量白名单（加字段必须同改两处，否则孤儿条目缺键）。

**生命周期取证** —— `lib/replay-axes.mjs:105` 硬编码 `crashed: false`，全仓无 `page.on('crash')`。因此 `bin/verdict.mjs:50` 的崩溃背书分支与 `lib/report-model.mjs:292-294` 的崩溃缺陷单分支**在真回放上永不触发**，是死码。

**控制台错误** —— **全仓零采集**。`lib/` 与 `bin/` 搜 `on('console'`、`consoleMessage`、`ConsoleMessage` 零命中；`lib/replay-forensics.mjs` 的监听器只有 `Network.*` 五个（`:85/109/115/125/132`）与 `page.on('pageerror')`（`:202`）。

**页面错误** —— 采到了，但 `lib/replay-axes.mjs:43-53` 把自由文本整体丢弃、只留错误类名（`TypeError: <redacted:pageerror>`）；再进缺陷单时连类名也没了，`lib/report-model.mjs:295-299` 合成的是固定字面量 `{ url: 'lifecycle:pageerror', status: null }`。

**报告面（这条最刺眼）** —— `lib/report-model.mjs:424` 每一步都装配了完整 `step.forensics = { lifecycle, network }`，schema 也冻了它（`tests/_golden/schemas/report-model.schema.json:738-756`），但 **`lib/report.mjs` 全文 639 行没有一处读 `.forensics`**。HTML（`:125-138`）与 Markdown（`:414-421`）只在 `SUT_DEFECT` 步的缺陷单里显示三列：`url` / `status` / 归因步；JSON 旁车（`:545`）只留一个 `hasDefectTicket` 布尔。`PASS`/`NEEDS_HUMAN`/`HARNESS_ERROR` 步的接口调用在报告上**一个字都看不到**。且缺陷单丢掉了「为什么」：筛选判据是 `status>=500 || errorEnvelope.ok===false`（`report-model.mjs:288`），但只带出 `{url,status,attributedStepId}`（`:289`），所以信封失败的那条在报告上表现为「一条 status 200 的请求被列为取证背书」，`field/expected/actual` 全丢。

**报告模型无任何诊断/定责/建议字段**，且顶层 `additionalProperties: false`（`report-model.schema.json:6`）。

---

## 二、分层设计与裁判零 LLM —— **SCOPE.md 的前提本身就错了**

无计划可核，但我核出一条**会反噬计划设计**的事实：

**`lib/heal/` 里根本没有 LLM。** 真 L3 重锚/LLM 自愈被整个删掉、换成零 LLM 确定性重锚：`lib/heal-gate.mjs:5`（「真 L3 重锚/LLM 自愈不在此、属后续 route:human」）、`lib/drift-patch.mjs:4`、`bin/heal.mjs:227`（「重锚（S2）：零 LLM 确定性」）。heal 全域唯一的子进程边界是 `lib/heal/reverify.mjs:168`，且被锁死在本仓 `tests/` 下。

所以 `SCOPE.md:39`「照 P6 自愈（`lib/heal/`）的合规范式接线」这句是**误设前提**：heal 给不出「LLM 怎么接」的先例，它给的是「一个还没到场的 LLM 该被怎样降级」的脚手架。**重跑计划前必须先修 SCOPE 这一句**，否则计划会照着一个不存在的先例设计。

heal 真正可照抄的合规范式（全部代码实证）：

1. 只读裁判产物、不重算裁定 —— `bin/heal.mjs:205-207`；要跑真裁定只能过冻结子进程边界 `lib/teachin/verdict-cli-adapter.mjs`（前后双验 `FROZEN_JUDGE_SHA256` `:100/:121`、`execFile` + `shell:false` `:203-218`、调用方只能递 `axesBytes` `:157`）。
2. 出不了裁定绝不合成 —— `lib/heal/reverify.mjs:392-395`「绝不以合成裁定代替」，exit 6。
3. 纵深两道准入闸 —— `lib/heal/admission.mjs:182` + `lib/heal-gate.mjs:28`，只认正向确证的 `HARNESS_ERROR`。
4. 产物出生即提案态 —— `lib/drift-patch.mjs:108-110`（`status:'proposed'`, `humanSignoff:null`）+ 状态机 `:9-22` + 人签闸 `canApply` `:34-38`（`lib/heal/apply.mjs:103-112` 是唯一消费点）。
5. 证据元组台账 + 熔断 + 事务回主链 —— `lib/heal/drift-patch.mjs:57-59/263-291`、`lib/heal/breaker.mjs:57/63`、`lib/heal/promote.mjs:358-366/545-585`。

**纯度守卫的欠账（重跑计划必须写进去）**：`bin/verdict-purity-guard.mjs` 是**给定入口的闭包扫描器**，没有目录级遍历。现役登记面只有三处，`bin/casey.mjs:219-222` 的 tier1 只登记了 `bin/verdict.mjs`。**`bin/heal.mjs` 与 `lib/heal/**` 完全不在任何纯度扫描入口列表里**——heal 的「零 LLM」目前只是文件头注纪律，没有机器守（与 `loop/GUARDRAILS.md:35` 自标的 `[prose→待enforced]` 一致）。且禁单是有限枚举（`verdict-purity-guard.mjs:17-18`），未登记 SDK 溜得过（`docs/plans/gen-prompts/proposed/GRILL.md:59` 已实测挂账 `@google/generative-ai` 不被拦）。加严的正确姿势是照 `tests/_golden/gen-prompts.golden.mjs:290-297` 在自己金牌里另写闭包白名单核 + 未登记 SDK 金丝雀，**不改守卫本体**（被 `loop/prd-model-lane-guard.json:6` 冻着）。

---

## 三、前后端定责判据 —— **SCOPE.md:40-43 列的 8 个信号，现在只有 3 个真拿得到**

| 信号（SCOPE 原文） | 指向 | 现状 | 证据 |
|---|---|---|---|
| 5xx | 后端 | **拿得到**，已是裁定背书判据 | `replay-axes.mjs:63` / `verdict.mjs:58` |
| 错误信封失败 | 后端 | **拿得到**，同上 | `replay-forensics.mjs:148-153` / `verdict.mjs:58` |
| 200 但渲染断言挂 | 前端 | **拿得到**，正是 `verdict.mjs:88` 现在落 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)` 那一格 | `verdict.mjs:83-88` |
| 超时 / 请求失败 | 后端 | **拿不到**。`Network.loadingFailed` 只 `inFlightApi.delete`，不写回 `rec`（`:125-130`）；无终止时间戳、无 `durationMs`、无 `errorText`。失败请求在 `axes.json` 里表现为 `status: null`，与「响应没采到」不可区分 | `replay-forensics.mjs:125-130`、`:96` |
| 契约字段缺失 | 后端 | **拿不到**。响应体只瞬时解析算 `errorEnvelope`，正文不进 records（刻意的数据最小化）；且无任何响应期望面 | `replay-forensics.mjs:66-68/148-153` |
| 请求根本没发出 | 前端 | **弱信号**。可由「本步 network 为空 + `action.resolution`」推，但缺「本步应该发什么请求」的期望集，证不到「该发没发」 | `replay-axes.mjs:72` |
| 参数畸形 | 前端 | **拿不到**。无 `method`、无请求体；`search` 保留但无期望比对面 | `replay-axes.mjs:61-65` |
| 控制台异常 | 前端 | **拿不到**，零采集 | 见第 1 条 |

**判据**：任何计划若把这 8 条整体写成「确定性规则表」而不逐条标注采集缺口，就是设计了一堆采不到的字段。5 条缺口里，2 条要新增采集（控制台、失败原因/耗时），3 条要新增**期望输入面**（响应契约字段、请求参数期望），后者会把「诊断」从纯观察变成需要用例侧声明的东西——这是设计上的分水岭，重跑计划必须显式裁决。

**证不出的落点是现成的**：`verdict.mjs:88` 的 `SUT_DEFECT_OR_STALE`、`:85` 的 `INDETERMINATE` 就是 `NEEDS_HUMAN` 口径；诊断面只要保持「读裁定产物、不改四态」，`NEEDS_HUMAN` 口径天然守住。

---

## 四、稳定复现指纹 —— 实测数据在手，**可行，但既有 flaky 判据不可复用**

我对 `runs/tc_wf_publish_states/run_baseline1_20260730` 与 `run_baseline2_20260730`（同用例、同日、同部署）做了真比对：

- **跨运行稳定**：`caseId`、每步 `stepId/intentId/atom/action/eventActions/postAssertions` 整块骨架逐字节相同；网络记录的 `status`、`initiator`、`attributedStepId`、`errorEnvelope` 逐位置全等；**每步网络条数与顺序两次完全一致**（37/22/2/3/1/0）。`run-history.jsonl` 12 行里 9 个字段逐行相同。
- **必变**：`axes` 的 `ts`（65 条全不同）——它是 CDP `Network.MonotonicTime`，**秒、浮点、原点随浏览器实例**（实测 `285709.859` vs `60790.61` vs `113090.25`），跨运行绝对值毫无可比性，**必须整字段剔除**；`run-history` 的 `timestamp`/`durationMs`；`run-metrics` 的 `runId`/`quietPointWaitMs`/`totalDurationMs`。
- **`url` 需模板化三类**：19 位雪花实体 ID、用例实例名（`atl_*`）、前端构建产物 hash（仅跨部署变）。**好消息：全仓普查 `query` 里没有任何随机参数**（无 token/traceId/nonce，低基数键取值全是静态常量）。
- **归一化后（剔 `ts` + 模板化 ID/实例名），b1/b2、lf1/lf2、b1/lf1 三组的网络 url 序列逐步逐字节相等**。跨运行比对在工程上成立。
- **真正该判稳定性的观测量**：`locatorResolution`、`quietPointReached`、`result`、`postAssertions`、`run-metrics.passedActions`、`locatorHitRate`。现成红样本：`runs/tc_wf_publish_states/run_pubfix_20260730`（11/12、0.9）对 `run_baseline1_20260730`（12/12、1.0）。

**两个必须写进计划的坑**：

1. **heal 的 flaky 判据不可复用**。`lib/heal/drift-patch.mjs:57-59` 的证据元组用的是 `axes/verdict/events` 的**整文件 sha256**；而 `axes.json` 每次都带变动的 `ts` 与实体 ID，所以真机上**第二次运行必然判 flaky**（`HEAL_FLAKY_ESCALATED`）。它只对同一份冻结产物重放成立。诊断能力必须另建归一层。
2. **已冻但未接线的失败指纹接缝是首刀该复用的资产**：`docs/plans/seams-freeze-v2/proposed/3-failure-ledger.schema.json` 的 `fingerprintInputs` 七元组（`channel/verdict/reason/atom/assertionKind/assertionOp/signatureTemplate`），schema 描述里**显式排除**时间戳、实例名、实体 ID、query 串——与我上面实测的归一清单完全吻合；`tests/_golden/seams-freeze-v2.golden.mjs:73/400-415` 已有复算校验防占位指纹。但 `lib/`、`bin/` 对 `failure-ledger` 零引用，纯草稿。

---

## 五、最小改面与工程量 —— 换签面实测（供重跑对表）

**给 `axes.json` 的 `forensics.network` 加字段，必红的冻结件只有 3 件 + 1 份 prd**：

1. `tests/_golden/fixtures/agent-id-readback/baseline/axes-projection-v1.json`（整份投影输出的字节基线）
2. 同目录 `manifest.json`（逐文件 sha256）
3. 执行体 `tests/_golden/agent-id-regression-diff.zero-sut.golden.mjs:519-522` 做 `baseline.equals(current)` **逐字节 Buffer 等值、不 normalize**
4. `loop/prd-agent-id-readback.json:15/:34` 两笔 checksum 重签（该 prd 已有五笔换签先例）

**免疫面**（不必动）：`p5-replay.golden.mjs:67-69/82-92`（只查三轴在场 + 定向比对）、`p5-replay-coverage`、`layer3-wiring-coverage`（手编夹具）、`report-model.schema.json`（`lib/report-model.mjs:219-228` 是第二道白名单，axes 新字段渗不进来）、P9 的 tier-2 金牌（`lib/selftest-tier2-projection.mjs:109-115` 是第三道白名单，只留 `initiator/attributedStepId/statusClass`）。

**条件追加**：要让新字段进报告，改 `tests/_golden/schemas/report-model.schema.json` + `loop/prd-seams-freeze.json:9` 重签（`docs/HANDOFF.md:1325` 有五份先例）；`observed-reality.schema.json:133` 是 `additionalProperties:false`，但 **`method` 已在册（`:147-153`）**，`durationMs`/`requestId` 不在册。

**加性不破锁的先例**：`docs/HANDOFF.md:1223`（「缺字段零行为差是加法碰冻结渲染核的护身符」，用 `'field' in model` 判定，定向断言金牌自动免疫）；`docs/HANDOFF.md:1065`（**axes 顶层加过 `eventActions`，p5/p7/layer3/tier1 回归全绿**）。

**三个硬约束**：`lib/replay-axes.mjs` 有严格 600 行上限锁（`tests/_golden/teachin-replayability-boundaries.static.golden.mjs:138-150`，现 115 行）且在 `PURE_MODULES` 禁 browser/fs/network/LLM 导入（`:152-166`）——**诊断逻辑绝不能塞进这个文件**；`intent-event-fold.zero-sut.golden.mjs:332-335` 是源码正则锁，改 `projectNet` 时别挪动 `eventActions,` 那行的换行形态；孤儿分支 `replay-axes.mjs:110-111` 必须同步改。

**一个计划极易漏算的成本**：新增 CLI 子命令会强制新增 MCP 工具——`loop/prd-mcp-parity.json` 的 s1 有 A4 覆盖断言「`bin/casey.mjs` switch 派生命令集 − EXCLUDED 每条须有对应 `casey_*` 工具」；而 `tests/_golden/cli-mcp-face.golden.mjs:111/120` 把工具名集 `deepEq` **钉死 14 个**，`:176` 还钉了 14 工具的 argv 映射表。该金牌是 13 份 prd 的验收命令（虽未进 `testChecksums`，不需人签重签，但要改金牌 + 复跑 13 份 gate）。

---

## 六、排期裁断

**契约槽：不冲突，成立。** 槽是每树一个文件（`loop-kit/bin/contract.mjs:13`），`loop/active-contract.json` 与 `.breaker-state.json` 都在 `.gitignore:22-23` → 每棵 worktree 天然独立 baton；`contract worktree <slug>` 起树是既有能力（`contract.mjs:292-318`，含 slug 全局唯一硬拒），护栏 #18 管纪律。当前活契约 `assert-visibility-semantics`（lane `full`，停在 plan done、accept 未起）在 `docs/plans/assert-visibility-semantics/plan.md:23-26` **明写「明确不改 replay-axes」**，生产件层面无冲突。

**真机档期：已被 P9 关账关键路径占满。** `docs/plans/p9-uat-close/P9-CLOSE-LEDGER.md:19-49` —— tier-2 A4 真机实跑待办、A5 三层口径修订 + 人签待办、`tc_wf_publish_states` 是 P9 关账**唯一阻塞项**且已裁定不走 waiver（`:10-15`），需要 Steven 带外侦察一次 + 用例重造 + **真机三轮复跑全 PASS**；`:74-75` 明记「后继契约与 tier-2 谁先占契约槽」尚未决。加上活契约自己要真机四轮。真机是 Steven 本人 + 单机 + 隧道，不可并行。

**人签带宽：有交叉。** 换签 `prd-agent-id-readback` 要 Steven 签，与 P9 那两笔待签换签抢同一决策带宽（`P9-CLOSE-LEDGER.md:21`）。

**我的裁断：SCOPE.md 第五节那两个待决项的答案是「拆开落」，不是整块押 P8 或 P10。**

- **阶段一（采集放行 + 报告呈现）可与 P9 并行**：改面小、验收可做成全 zero-SUT、冻结面 3 件、不碰真机。**硬条件是验收里一条真机断言都不许有**——一旦要真机实证，就必须排到 P9 之后。落 P8 的 web 边角（不碰 CEF/arbitrary，P8 主体 `docs/plans/bootstrap/plan.md:162-170` 仍未做）。
- **阶段二（前后端定责规则表）不宜并行**：它依赖控制台采集、失败原因、期望契约三件新增面，且判据表本身需要真机样本校准。
- **阶段三（稳定复现跨运行比对）明确落 P10**：「跨运行复验」本来就是 P10 的定义内容（`docs/NEXT-SESSION.md:70-71`、`docs/plans/closed-loop-evolution/plan.md`），不该另立门户。

---

## 七、首刀裁断

**首刀 = 把已经采到、却没呈现出来的东西呈现出来。零新增采集、零 LLM、零判读。**

具体两刀（可一个契约内完成）：

1. **`axes` 放行 `method`** —— 上游 `lib/replay-forensics.mjs:96` 已经有，只是被 `projectNet` 丢了；`replay-axes.mjs:61-65` 与孤儿分支 `:110-111` 两处白名单各加一键。`observed-reality.schema.json:147-153` 里 `method` 已在册，不必改 schema。
2. **报告面开「接口交互」小节** —— `lib/report-model.mjs` 加性放行 + `lib/report.mjs` 每步渲染网络表（不只 `SUT_DEFECT` 步），并把缺陷单里丢掉的 `errorEnvelope.field/expected/actual` 补回去（修掉「200 的请求被列为取证背书却无任何解释」这个现状，`report-model.mjs:286-289`）。

**为什么这一刀能独立交付**：它不依赖后面任何一块——不需要定责规则、不需要指纹、不需要 LLM、不需要真机；数据已经在产物里躺着（`report-model.mjs:424` 装配了、schema 冻了、渲染器不读）。而排障痛点的第一因恰恰是「人在报告上一条接口都看不到」。换签面 3 件 + 2 份 prd（`prd-agent-id-readback` 重录基线、`prd-seams-freeze` schema 重签），全部 zero-SUT 可验收。

**反对把「前后端定责判据表」当首刀**：它的 8 条判据里 5 条现在采不到（第 3 条），首刀会变成先补三块采集面，见效最慢。

---

## 八、风险提示

- **R1（最重要，需 Steven 裁决）：Steven 原话「抓包」与既有已冻安全面正面冲突。** 请求/响应正文是**刻意不落盘**的（`lib/replay-forensics.mjs:66-68` 明写「完整响应体仅瞬时解析、不进 records，数据最小化」），且 `tests/_golden/seams-freeze.golden.mjs:23-36` 与 `layer3-wiring.golden.mjs:22-33` 对产物做 `body/headers/cookie/token/authorization/password/secret/credential/apikey` 深扫，命中即红。**「抓包看报文」这个需求会直接撞这道锁**。重跑计划必须显式裁决：是只做「元数据级接口交互」（url/method/status/时序/归因/信封判定），还是要开正文面（那要单独走安全裁决 + 换签，绝不能顺手放宽黑名单）。这条不裁决，后面的判据表全是空中楼阁。
- **R2：`SCOPE.md:39` 的前提错了**（heal 无 LLM，见第 2 条）。重跑前先修这句，否则计划会照不存在的先例设计接线。
- **R3：`SCOPE.md:41-42` 的八信号里五条采不到**（第 3 条）。不先修正会产出采不到的判据表。
- **R4：`crashed` 恒 false 是既有死码**（`replay-axes.mjs:105` + `verdict.mjs:50`）。诊断能力若声称有「页面崩溃」信号，那是假的；顺手补 `page.on('crash')` 是低成本真收益，但属加性改采集面。
- **R5：纯度守卫不自动覆盖新模块**（第 2 条）。新诊断模块必须显式登记 entry，否则「零 LLM」只是散文。
- **R6：重跑本身有失败模式。** 这次 codex 烧掉 817 万 input token、只出 3.2 万 output 就断了，正文一个字没落。重跑必须限流：限定文件白名单（我上面列的那二十来个文件足够）、禁全仓 `rg`、**分段落盘出稿**（每小节写完就落，别攒到最后一次性吐），否则大概率复现同样的空手而归。**建议直接拿本报告的事实基线当输入**，重跑只做设计与工程量，不再重做取证。

---

**需重跑，不需重新取证。** 我已把七个审点里「资产实况」「判据可得性」「指纹稳定性」「换签面」「排期冲突面」五项的事实全部核实落定，重跑只需在此基础上出分层设计、判据表与验收口径。本次未修改任何文件。
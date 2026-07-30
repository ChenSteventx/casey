# regress 战略项 scope 选项 —— 被测参数 + 内置提示词可修改

> 只读研究 + scope 设计，不改实现。供 Steven 点选后再立契约。
> 术语以 `CONTEXT.md` 为准；本文新造词（`promptset`/被测参数/内置提示词库/软期望）落地前须先登记 CONTEXT。

## 1. 这一项到底指什么（先消歧）

战略六点唯一未收项，原话在 `strategy-2026-07-08`（记忆）第 2 条与 `docs/NEXT-SESSION.md:90`：

> 2. **被测参数 / 内置提示词可修改**（参考项目 regress）。
> C. regress 战略项（strategy 剩项）：参数化 + 内置提示词。

「参考项目 regress」= 姊妹项目 `regress_autotest`（`/mnt/d/ctx/heren/regress_autotest`，Casey `compile-atoms` 的血缘来源）。它有一整套「数据驱动回归」子系统，正是本项要对标的东西：

- `_promptset.ts` + 每个 spec 同目录的 `prompts.json`（`regress_autotest/_promptset.ts:4-8`）：**数据驱动的输入层**。一条录制好的交互（一次「打字→发送→等 LLM 流式回复」）被 `loadPrompts(__dirname)` 复用成 N 条独立用例，每条一份 video + trace，聚合成一份报告。每条 `{ id, prompt, source:'user'|'llm', category:'normal'|'boundary'|'security', name?, expect? }`。这里的 `prompt`（「真正打进对话框的消息文本」）就是**被测参数**。
- 共享内置库 `tests/_lib/boundary-prompts.json` + `security-prompts.json`（`_promptset.ts:17-22`）：**随工具发的通用边界/安全注入向量库**，`loadPrompts` 默认把它们并进每个数据驱动 agent 的用例集，category 由文件名强制、id 用 `sec_`/`bnd_` 前缀防撞。这就是**内置提示词（可修改）**——用户编辑/扩展这两份 JSON 就改了内置库。
- `expect` 是**软期望**（`_promptset.ts:44` 原文）：回放时只在报告里标注命中与否，**绝不让用例变红**（非确定性 LLM 输出不做 exact 断言）。
- `scripts/gen-prompts.mjs`（`regress_autotest/scripts/gen-prompts.mjs:1-14`）：一次性 authoring 工具，用 LLM 按 agent 名/内嵌系统提示词合成一组被测参数、**冻结**写进 `prompts.json`；**本脚本不进回归，回放期绝不调 LLM**。

**据此判定「参数化」的准确含义**：是**数据驱动的多行被测参数**（一条冻结 flow 跑 N 行 prompt 数据），**不是**下面这两个同名但无关的东西——

| 同名易混项 | 出处 | 是否本项 |
| --- | --- | --- |
| 数据驱动多行被测参数（promptset 模型） | `regress _promptset.ts` | ✅ 本项 |
| 按 `caseId` 参数化并发 singleton（`LOOP_CONTRACT_FILE`） | 设计 `txt2testreport-design.md:142,299` | ❌ 已由 `worktree-baton` 解决/否决共享池 |
| `entityNameParam` 前缀参数化（破坏性硬闸） | `lib/compile-gate.mjs:88-106`（R12） | ❌ 已落地 |

**据此判定「内置提示词」的准确含义**：是**随工具发的、喂给 SUT 的测试输入库**（regress 的 boundary/security 注入向量库），用户可编辑扩展。**不是** Casey 自身归一/编译/草拟/自愈用的工装提示词——那些当前是委托给「CLI 外 LLM」的，Casey 仓内没有落地的工装提示模板（`ingest-scaffold` 只发「归一脚手架 + 归一提示模板」的登记概念，实体在 CLI 外）。两种读法都记在下面 Option 里，推荐取 regress 忠实读法。

## 2. 落到 Casey 的现状接缝（可对齐点已就位）

- 参数槽已在：`chat.sendAndWait` 原子带 `prompt` 参数（`lib/atoms-registry.snapshot.json:890-893`，编译落 `lib/compile-atoms.mjs:673`）。被测参数 overlay 就是把 N 行文本轮流灌进这个 `prompt` 槽。`chiefcomplaint-smoke` 契约已把这条 chat flow 全链跑通，是天然的数据驱动母体。
- 占位符回填机制已在：`lib/instantiate.mjs` 的 `{{token}}` 回填（冻占位符、不冻一次性值，护栏 #6）——overlay 可直接复用，不新造模板引擎。
- 软期望基座已在：报告规范 `docs/design/report-spec.md:67` 已定「soft 断言单列黄标、不进裁定树、不判红」（照 regress `softMiss`）；`:48` 已定置顶横幅。裁判 `bin/verdict.mjs` 已按护栏 #17「soft 仅 `===true` 才算、绝不 switch on kind」——**被测参数的 content-match 天然落 soft、不进裁判**。
- 聚合报告是「已设计未建」的既定槽：`report-spec.md:10` 明记「§7 多用例总目录聚合按原文自留待裁决、未建（非欠账）」，`:28` 的 `<caseId>.report.json` 机读旁车原文就是「供多用例总目录聚合」。**建它不是开新愿景，是兑现既有设计槽。**

**关键内核不变量（三选项都守）**：
- 裁判零 LLM（护栏 #15）+ fail-safe（护栏 #14）：每行 prompt 仍作一个独立 `caseId`、走现成 `bin/verdict.mjs`。硬断言是**结构式且跨行同一**（`noErrorEnvelope` / 流完成 200 / `noErrorToast`——不依赖 prompt 文本），content-match（`mustInclude`）只作报告 soft 注解，**绝不进裁判进程、绝不判红**。故 `verdict.mjs` 内核不动。
- 断言冻结 + 人签（ADR-0004）：冻的是**一条模板 flow + 一套结构断言**，不是 N 份断言。prompt 文本是唯一变量、经 `instantiate` 回填，不进冻结断言。故不新增逐行重签负担；但 regress `_data_runner.overlayRow` 拒绝 `authored` 场景（设计 `:256` 红队 loop-M 警告），Casey 编译产物形同 authored → **overlay 须是 Casey 自建的新纯函数，不照搬 regress overlayRow**。

## 3. 三个可执行 scope 选项（本轮确定性边界）

### 选项 A（推荐，full）：数据驱动被测参数 overlay + 内置提示词库（无 LLM 合成）

完整覆盖战略两子项（被测参数可改 + 内置提示词可改）的最小确定性边界。

本轮边界：
1. 定 `promptset` schema 并登记 CONTEXT：`{ id(^[a-z0-9_]+$), text, source:user|builtin, category:normal|boundary|security, expect?:{mustInclude?,mustNotInclude?,note?} }`。
2. `lib/promptset.mjs`（新，纯函数、零 I/O、零 LLM）：吃「一条已冻结的 chat flow（含单个 `prompt` 参数槽）+ promptset」→ 展开成 N 个 `caseId` 的回放输入（`{{promptText}}` 经 `instantiate` 回填；沿用现成机制）。硬断言跨行同一冻结集。id 唯一 + 文件系统安全闸（镜像现成 caseId 形状闸）。
3. 内置提示词库：`prompts/_lib/boundary.json` + `security.json`（随仓发、用户可编辑扩展；category 由文件名强制；id 前缀 `bnd_`/`sec_` 防撞），overlay 按开关自动并入——逐字对标 regress 共享库语义。
4. 报告聚合：兑现 `report-spec.md §7` 已留的「多用例总目录」——`casey report` 读 N 份 `<caseId>.report.json` 旁车聚合成一页总目录（按 category 分段 + 置顶横幅），content-expect 走 soft 黄标（不进裁定）。
5. 强化 DDD（战略项 4）：CONTEXT 登记 `promptset`/被测参数/内置提示词库/软期望，设计文档补「数据驱动」一节。

不做（挂到后续）：LLM 合成（`gen-prompts`）；被测参数由用户手写 JSON 或用内置库。
不碰：`bin/verdict.mjs` 内核（每行走现成零 LLM 裁定，content-match 仅报告注解）；断言冻结/人签闸（冻的是模板 flow，非 N 份）。

- touchesFiles：`lib/promptset.mjs`(新)、`bin/`（`casey run --promptset` 接线或新 `bin/promptset.mjs`）、`lib/report-model.mjs` + `bin/report.mjs`（总目录聚合）、`prompts/_lib/*.json`(新内置库)、`CONTEXT.md`、`docs/design/txt2testreport-design.md`（数据驱动一节）；可能 `bin/replay.mjs`/`lib/instantiate.mjs`（占位槽回填，若现槽不够）。
- lane：full（碰 lib+bin+报告聚合+新 schema+CONTEXT，多接缝、需异构评审 codex）。
- tradeoffs：唯一完整覆盖战略两子项的选项，边界清；工作量最大（报告聚合是新建）；但内核（裁判/冻结）零改动，风险锁在两处新纯函数（overlay + 聚合，皆可 hermetic 金牌钉死）。

### 选项 B（light）：只做被测参数 overlay，内置库 + 聚合报告延后

本轮边界：只 `promptset` schema + `lib/promptset.mjs` overlay + `casey run --promptset` 跑 N 行；每行独立 `caseId` + 独立 `<caseId>.report`（复用现成单用例报告，**不建总目录聚合**）。内置 boundary/security 库、报告聚合都不做（挂账下一轮）。用户手写 `promptset.json`。

- touchesFiles：`lib/promptset.mjs`(新)、`bin/`接线、`CONTEXT.md`；可能 `lib/instantiate.mjs`。不碰报告聚合、不加内置库。
- lane：light。
- tradeoffs：最快见效、接缝最少、金牌好钉；但只覆盖「被测参数可修改」半个战略项（内置提示词 + 聚合缺席），且 N 份散报告要人自己翻——regress 的核心价值（一份聚合报告 + 内置注入库）没兑现。

### 选项 C（full+，含 LLM 合成 authoring）：选项 A + `casey gen-prompts`

本轮边界：A 全部 + LLM 合成 authoring 工具（按 agent 名/内嵌系统提示词合成 N 条被测参数，幂等冻结进 `promptset.json`，**绝不进回放/裁定进程**，凭据经现成 `lib/cred-gate.mjs`/env）。逐字对标 regress `gen-prompts.mjs`。

- touchesFiles：A 全部 + `bin/gen-prompts.mjs`(新) + `lib/promptset-synth.mjs`(新，调 LLM) + 凭据接线 + 跨平台（API base/key）。
- lane：full（最大面，含 LLM + 凭据 + 跨平台适配）。
- tradeoffs：最贴 regress 全貌，「可修改」升级为「可自动生成」；但 LLM 合成 + 凭据 + 跨平台显著扩面，authoring 工具是非确定性面（虽冻结后回放零 LLM），且「可修改」手写 JSON 已满足 → 本轮性价比低，宜作 A 落地后独立契约。

## 4. 推荐

**选 A。** 战略项明写两子项（被测参数 + 内置提示词）both 可修改，A 是完整覆盖两子项的最小确定性边界；B 漏了内置库和聚合（战略半兑现 + N 份散报告体验塌，regress 核心价值没兑现）；C 的 LLM 合成是 authoring 便利、「可修改」手写 JSON 已满足、且扩凭据/跨平台面不值当本轮。A 把裁判/冻结核完全不动、风险锁在两处新纯函数（overlay + 聚合，皆可 hermetic 金牌钉死），符合「确定性默认、LLM 是手术刀、裁判零 LLM、fail-safe」内核；报告聚合是 `report-spec §7` 已设计未建的既定槽，非新愿景。落地走 full 车道 + codex 异构评审。

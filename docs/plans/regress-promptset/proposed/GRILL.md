# GRILL — regress-promptset（full，scope A：数据驱动被测参数 + 注入向量库 + 聚合报告）

授权：Steven 已在 `docs/plans/regress-strategy/SCOPE-OPTIONS.md` 选定「选项 A」，并授权本轮自主 draw→freeze→implement（`--user-confirmed`/`--red-verified`）。本文以 SCOPE-OPTIONS 选项 A 为唯一输入，把承重分岔逐个清空、落 CONTEXT/设计。

## 消歧铁律（本项到底做什么）

- **本项「参数化」= 数据驱动多行「被测参数」**：一条冻结 `chat` flow 复用成 N 条独立用例，每行喂给 `chat.sendAndWait` 的 `prompt` 槽一段不同的消息文本（`被测参数`）。**显式不是**：`caseId` 并发参数化（已由 `worktree-baton` 解、否决共享池）、`entityNameParam` 前缀参数化（已由 R12/`compile-gate` 落地）。
- **本项「内置提示词」= 随工具发的边界/安全「注入向量库」**（`prompts/_lib/boundary.json` + `security.json`），用户可编辑扩展、喂给 SUT 当被测输入。**显式不是**：Casey 自身归一/编译/草拟/自愈的工装提示词（那些委托 CLI 外 LLM、仓内无实体，见 `归一提示模板` 词条）。

## 承重决策（逐个清空）

- **D1 提示词集结构**：`[{ id(^[a-z0-9_]+$，唯一+文件系统安全), text(非空), source?:user|builtin(默认 user), category?:normal|boundary|security(默认 normal), expect?:{mustInclude?:string[], mustNotInclude?:string[], note?:string} }]`。忠实对标 regress `_promptset.ts`，两处偏离按 SCOPE-OPTIONS 选项 A 原文取值：字段名 `text`（regress 用 `prompt`）、`source` 枚举 `user|builtin`（regress 用 `user|llm`——本轮不做 LLM 合成，`builtin` 表随库发的注入向量）。`lib/promptset.mjs` 的 `parsePromptset` 零 LLM 确定性校验，任一不合（非数组/空/id 非法或重复/text 空/枚举错/expect 形状错）fail-closed 抛，宁在收集期早失败也不产半成品报告。

- **D2 被测参数 overlay 接缝**：复用现成占位槽——冻结 flow 的 `chat.sendAndWait` fill event 带 `value:"{{promptText}}"`；`lib/replay-actions.mjs` 既有 `instantiate(ev.value, ctx)` 在 fill 时回填；`bin/replay.mjs` 的 `ctx`（`{uniqueName,baseUrl}`）加 `--prompt-text` 一项即够。`RH_PLACEHOLDER=/^\{\{[A-Za-z0-9_.-]+\}\}$/` 已覆盖 `{{promptText}}`——回放历史里始终显 `{{promptText}}`、绝不落真被测参数（护栏 #7 白得）。`lib/promptset.mjs` 的 `overlayPromptset` 是**新纯函数**（不照搬 regress `overlayRow`，其拒 authored 场景、Casey 编译产物形同 authored，SCOPE §2）：定位冻结 flow 里**唯一**一个 `{{promptText}}` 槽（0 或 >1 个 fail-closed——槽缺席/歧义则数据驱动无确定锚），**绝不改 flow**（跨行共享同一冻结 events，逐行只变 `ctx.promptText`）——这就是「硬断言跨行同一冻结 flow 集、不因行不同而漂移 spec」的落点。

- **D3 软期望走现成 soft 通道，绝不进裁判**：`expect` 是软期望（回放只标命中与否、绝不判红，SCOPE §17）。落地口径 = overlay 从 `expect` 合成 `soft:true` 断言（`mustInclude[i]→{kind:replyContains,op:contains,value,soft:true}`；`mustNotInclude[i]→{kind:replyMatches,op:matches,value:"^(?!(?:.|\n)*<escaped>)",soft:true}` 负向环视，复用 chiefcomplaint I3 先例），经 `bin/replay.mjs` 新 `--soft-expect` 通道并入 `evaluateAssertions`。该通道**强制 soft:true**（本通道定义即软、绝不注入影响裁定的硬断言，故合法不过人签闸——人签保护的是进裁定的断言）、**不碰 `lib/sign-gate.mjs`**（签署 `expected` 契约原样全签闸）。soft 断言落 axes→`verdict.mjs` 按护栏 #17 只 AND 硬断言 `ok`、忽略 soft（裁判零改）→`report-model` 既有 `projectPost` 带 soft→报告黄标。裁判/冻结核一字不动。

- **D4 注入向量库**：`prompts/_lib/boundary.json` + `security.json` 随仓发、用户可编辑扩展。category 由文件名强制（`boundary.json→boundary`、`security.json→security`）、`source` 强制 `builtin`、id 前缀 `bnd_`/`sec_` 强制（缺前缀 fail-closed，防与用户 promptset id 及跨库相撞）。overlay 按开关（默认并入、`--no-builtin` 关）把两库并进每个数据驱动用例集，跨集合 id 全局唯一硬拒。逐字对标 regress 共享库语义。

- **D5 护栏 #7 凭据门优先，注入向量库随发条目避禁字段英文子串**：`lib/cred-gate.mjs` 的 `credentialGate` 对 `FORBIDDEN_KEYWORDS`（token/password/secret/cookie/credential/authorization/apikey/bearer/x-api-key）做**子串** fail-closed。被测参数必进报告（要看「测了哪条 prompt」）——故随库发的边界/安全向量**避开这些英文子串**（用中文注入向量：忽略上文/越权/系统提示词回显/超长/角色混淆等，天然不含英文禁字段；对中台 SUT 也更贴切）。用户若自写含禁字段英文子串的被测参数，报告落盘 fail-closed（护栏 #7 零弱化优先、由用户改写消解）。`report-model` 对被测参数展示字段（promptText/name/note）走既有 `redactScalar`（同 `naturalLanguage`/toast 自由文本待遇，纵深防御）。

- **D6 每行一 caseId/录屏/裁定，聚合一份报告——但不伪造 caseId**：冻结 events 的 `caseId` 固定（= 母体用例 id），`report-model` 同源校验要求 verdict/axes/events caseId 一致，故逐行 model 的 `caseId` 诚实 = 母体 id、**不伪造**。逐行落**各自 run 子目录**（`runs/<caseId>/promptset/<promptId>/`），`<caseId>.report.json` 在不同目录不相撞；行与行由 promptset 块的 `promptId` 区分（非文件名）。`report-model` 加可选 `--promptset-meta`（投影 `promptset` 块：promptId/category/source/name/promptText/note，promptText/name/note 脱敏），进 `.report.json` 旁车供聚合分组分段。

- **D7 多用例聚合报告（兑现 report-spec §7）**：`lib/report-model.mjs` 加纯函数 `assembleAggregateModel({reports,generatedAt})`——吃 N 份已解析 `.report.json` 旁车 → 按 `promptset.category` 分段（normal/boundary/security）、置顶横幅（`verdictSummary` 有 SUT_DEFECT>0 或 NEEDS_HUMAN>0 的行顶上去，同构单用例 `bannerHtml`）、content-expect 软期望走黄标从旁车 `steps[].assertions` 里 `soft===true` 项取（**绝不进裁定**：聚合 `verdictTotals` 只累加旁车自带的 `verdictSummary`，其本身已排除 soft）。畸形旁车 fail-closed。`lib/report.mjs` 加纯函数 `renderAggregate`（html/md/json 三形态，内联 CSS 同既有报告、主题中性）。`bin/report.mjs` 加 `--aggregate <dir>`：扫 `<dir>/*/*.report.json` → 装配 → 渲染 → 过 `credentialGate` → 落 `index.report.{html,md,json}`。

- **D8 端到端接线**：新 `bin/promptset.mjs`（编排器，保持 `bin/casey.mjs` 薄），逐行 replay（冻结 events + `--prompt-text` + `--soft-expect`）→ verdict → report-model（`--promptset-meta`）→ report，末了 `report --aggregate` 聚合。`bin/casey.mjs` 的 `runPipeline` 认 `--promptset <f>` 时直通 `bin/promptset.mjs`（兑现 SCOPE「casey run --promptset 接线」）。

## 内核硬约束（一字不让，逐条自证）

- 裁判零 LLM：绝不碰 `bin/verdict.mjs`；content-expect 是 soft、由护栏 #17 既有逻辑忽略、绝不进四态裁定（`judgeKernelTouched=false`）。
- fail-safe 不 fail-open：所有校验（promptset/overlay/库前缀/旁车/软期望通道）不合即 fail-closed，不静默产半成品。
- 不碰冻结/人签闸：冻的是母体 flow + 一套结构硬断言（跨行同一），非 N 份；soft 通道另立、不进 `sign-gate`；`--soft-expect` 强制 soft、绝不注入硬断言。
- 不做 LLM 合成：authoring（`gen-prompts`）属 SCOPE 选项 C，本轮不做；被测参数由用户手写 JSON 或用随库。
- 护栏 #7：被测参数展示脱敏 + 落盘过 `credentialGate`（零弱化，D5）。

## touchesFiles

`lib/promptset.mjs`(新)、`bin/promptset.mjs`(新)、`prompts/_lib/boundary.json`+`security.json`(新)、`bin/replay.mjs`(`--prompt-text`+`--soft-expect`)、`lib/report-model.mjs`+`bin/report-model.mjs`(`--promptset-meta` + `assembleAggregateModel`)、`lib/report.mjs`(renderJson promptset 块 + `renderAggregate`)、`bin/report.mjs`(`--aggregate`)、`bin/casey.mjs`(run --promptset 接线)、`tests/_golden/schemas/report-model.schema.json`(promptset 块)、`CONTEXT.md`、`docs/design/txt2testreport-design.md`(数据驱动一节)。红先行金牌 `tests/_golden/regress-promptset.golden.mjs`。

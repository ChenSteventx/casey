# regress-promptset — 数据驱动被测参数 + 注入向量库 + 多用例聚合报告（full，scope A）

## 背景

战略六点唯一未收项「被测参数 / 内置提示词可修改（参考项目 regress）」。Steven 在 `docs/plans/regress-strategy/SCOPE-OPTIONS.md` 选定「选项 A」——完整覆盖战略两子项的最小确定性边界。姊妹项目 regress 的「数据驱动回归」子系统迁到 Casey：一条冻结 `chat` flow 复用成 N 条独立用例，每行喂一段不同的被测参数，聚合成一份报告。决策口径见 `proposed/GRILL.md`（D1–D8），术语见 `CONTEXT.md`，设计见 `docs/design/txt2testreport-design.md §13`。

内核一字不让：裁判零 LLM（不碰 `bin/verdict.mjs`）、软期望走现成 soft 通道绝不进裁定（护栏 #17）、不碰冻结/人签闸、不做 LLM 合成、护栏 #7 凭据门零弱化。

## 流程（端到端，逻辑描述）

1. 用户手写一份 `promptset.json`（或直接用随库发的注入向量库），每行一段被测参数 + 可选软期望；配一条冻结的 `chat` flow（`chat.sendAndWait` fill event 带 `value:"{{promptText}}"` 提示槽）+ 一套已签署的结构硬断言（跨行同一）。
2. `casey run --promptset <f> --flow <events> --expected <frozen> --profile <f> --sut <base>` 直通编排器 `bin/promptset.mjs`。
3. 编排器 `overlayPromptset` 校验 promptset + 定位唯一 `{{promptText}}` 槽 + 并入注入向量库（默认开），展开成 N 行；逐行：`replay`（冻结 events + `--prompt-text` 注入本行文本进 `ctx` + `--soft-expect` 本行软期望）→ `verdict`（零 LLM）→ `report-model`（`--promptset-meta` 投影本行 promptset 块）→ `report`（落本行子目录 `<caseId>.report.*`）。
4. 全行跑完，`report --aggregate` 扫 N 份 `.report.json` 旁车 → 聚合一页总目录（按 category 分段 + 置顶横幅 + content-expect 黄标）→ 落 `index.report.{html,md,json}`。

## 改动（业务逻辑落点）

1. `lib/promptset.mjs`（新，纯函数、零 LLM）：`parsePromptset`（schema fail-closed 校验）+ `loadBuiltinLibs`（读 `prompts/_lib/*.json`、category/source/前缀强制）+ `overlayPromptset`（定位唯一提示槽、跨行不漂移 flow、合成软期望、产逐行输入）。
2. `prompts/_lib/boundary.json` + `security.json`（新）：随发注入向量库，中文向量避护栏 #7 禁字段英文子串。
3. `bin/replay.mjs`：加 `--prompt-text`（注入 `ctx.promptText`）+ `--soft-expect`（强制 `soft:true` 并入 `evaluateAssertions`，不碰 `sign-gate`）。
4. `lib/report-model.mjs` + `bin/report-model.mjs`：`assembleReportModel` 加可选 `promptsetMeta`（投影 `promptset` 块，脱敏）+ `bin/report-model.mjs` 加 `--promptset-meta`；`lib/report-model.mjs` 加 `assembleAggregateModel`（纯函数聚合 N 份旁车）。
5. `lib/report.mjs`：`renderJson` 投影 `promptset` 块进旁车 + 加 `renderAggregate`（聚合三形态渲染，内联 CSS、主题中性）。
6. `bin/report.mjs`：加 `--aggregate <dir>`（扫旁车 → 装配 → 渲染 → `credentialGate` → 落 `index.report.*`）。
7. `bin/promptset.mjs`（新）：编排器（逐行 replay→verdict→report-model→report + 末了聚合）。
8. `bin/casey.mjs`：`runPipeline` 认 `--promptset` 直通 `bin/promptset.mjs`。
9. `tests/_golden/schemas/report-model.schema.json`：加可选 `promptset` 块（additionalProperties:false 下的加法）。

## 非目标

不动 `bin/verdict.mjs`（裁判零 LLM，`judgeKernelTouched=false`）；不碰 `lib/sign-gate.mjs`/冻结/人签闸（冻的是母体 flow + 结构硬断言、非 N 份，soft 另立通道）；不做 LLM 合成 `gen-prompts`（scope 选项 C、后续独立契约）；不弱化 `credentialGate`（护栏 #7 优先）；被测参数不伪造 caseId（逐行落各自子目录、由 promptId 区分）。

## 验收（红先行，新 golden `tests/_golden/regress-promptset.golden.mjs`，hermetic 零真机零凭据）

- P 解析向：`parsePromptset` happy 通过；非数组/空/id 非法/id 重复/text 空/source 枚举错/category 枚举错/expect 形状错逐一 fail-closed（现红——模块未建）。
- B 注入向量库向：`boundary.json`/`security.json` category 由文件名强制、`source=builtin`；id 缺 `bnd_`/`sec_` 前缀 fail-closed（**内置库 category 撞名/缺前缀必红**）；用户集与库跨集合 id 相撞 fail-closed。
- O overlay 向：定位唯一 `{{promptText}}` 槽；0 槽 / >1 槽 fail-closed；跨行共享同一冻结 flow、逐行只变 `ctx.promptText`（**overlay 跨行 spec 漂移必红**——断言两行 events 结构同一）；`expect` 合成 `soft:true` 软期望（mustInclude→replyContains、mustNotInclude→replyMatches 负向环视）。
- S 软期望不进裁判向：`replay --soft-expect` 落 axes 全 `soft:true`（soft:false 被强制 soft:true）；一条**失败**的 content-expect（回复缺 mustInclude）该步仍判 `PASS`（**content-expect 误进裁定必红**——verdict 不受 soft 影响）。
- A 聚合向：`assembleAggregateModel` 按 category 分段、`SUT_DEFECT`/`NEEDS_HUMAN` 行进置顶横幅、content-expect 从旁车 soft 项走黄标、`verdictTotals` 只累加旁车 `verdictSummary`（soft 绝不进）；畸形旁车 fail-closed。
- W 接线向（chat-sut 端到端）：`casey run --promptset` 跑 2 行（1 用户 + 1 库）→ 逐行 verdict `PASS` + 各自 `<caseId>.report.*` + 一份 `index.report.{html,md,json}`；聚合分段正确；三产物过 `credentialGate`。
- 回归锁：`chiefcomplaint-smoke.golden`（chat 回放 + soft 未回归）+ `p5-replay.golden`（replay 形状加性）+ `report-fidelity.golden`（report-model 加性）+ `p7-report.golden`（渲染）+ `casey selftest --tier1`（确定性内核 + 裁判零 LLM 不破）。
- 收口后 route:human：Steven 过目一份聚合报告样例（分段/横幅/黄标观感），真机接被测参数库另议。

# 接缝冻结 v2 提案 — `run-history.jsonl` / `run-metrics.json`（grill 草稿）

> 草稿 / 未冻 / 待 grill-with-docs 拍板，勿当已决。
>
> 本文只是开放问题清单 + 我的推荐答案，供后续 grill-with-docs 逐条拍板。未登记 `CONTEXT.md`、未冻接缝、未碰 `tests/_golden/` 已冻区、未写 `lib`/`bin`。
>
> 同目录草稿材料：`1-run-history.schema.json`（schema 草稿）、`1-run-history.fixture.json`（合成 fixture）。

## 这条接缝是什么

来源：`docs/design/stagehand-action-ir-adaptation.md` §4（运行历史与指标）的「提案待登记」注、§3（缓存命中可观测）、§12（日志 hook），以及 `docs/design/autonoma-adaptation.md` §5（实时透明度与运行日志）。

定位：`确定性回放`（`bin/replay.mjs`，轨 A · P5）逐步落盘的第二层事实——动作计划（`events.json`）说「应该做什么」，`run-history.jsonl` 说「这次实际发生了什么」；`run-metrics.json` 是其聚合，做趋势 / flake / 性能诊断。两者都只是报告 / 调试证据，绝不进 `bin/verdict.mjs`、绝不写 `passes`。

边界对照已冻接缝：`观测现状`（`observed-<caseId>.json`）是相1 地面真值、喂断言草拟与取证背书；`run-history.jsonl` 是相4 回放期的逐步执行日志，二者不同物、不可合并。

## 开放问题与推荐答案

### Q1 定名：就用 `run-history.jsonl`（单行 JSONL）+ `run-metrics.json`（聚合）这俩名吗？要不要先查 SRE 可观测性术语？

推荐：保留这两个名，但 grill 时按统一语言流程做一次 SRE 可观测性术语核对再登记 `CONTEXT.md`，不要直接搬 Stagehand 的 `history` / `metrics` 词面。

- `run-history` 对应可观测性里的 structured event log / span log（逐事件结构化日志）；`run-metrics` 对应 aggregated metrics（聚合指标）。两者是「事件流 vs 聚合」的标准二分，名实相符。
- 但要避免与已有概念双名竞争：`run-history.jsonl` 不是 `观测现状`、不是 `三轴`、不是 `replay.log`（后者是 driver 操作文本日志）。登记时白话解释须写清边界：「逐回放事件步的结构化执行证据，按 `stepId` 一行，仅报告 / 调试，绝不进裁定」。
- 文件名用全小写连字符 + 扩展名（`run-history.jsonl` / `run-metrics.json`），与 `observed-<caseId>.json` / `report-model.json` 风格一致。
- 待定子项交 grill：中文译名定「运行历史 / 运行指标」还是「回放历史 / 回放指标」。我倾向「回放历史 / 回放指标」，因为它专属 `确定性回放` 阶段、不覆盖编译期；这样也和 `编译` 期的 `compile.log` 不打架。

### Q2 张力：`cacheStatus` / 解析缓存 与「确定性回放本不应有解析缓存」冲突——保不保留 `cacheStatus`？保留怎么论证？

这是本接缝最该被 grill 拷打的一条。事实链：`确定性回放` 每个回放步都重新解析 `语义定位器`（stagehand §8「每个回放步都重新解析」），回放期零 LLM、`events.json` 已冻，所以回放期根本没有「解析缓存」可命中。Stagehand 的 `cacheStatus: HIT|MISS` 源自它编译侧的 `observe()` / `act()` 动作规划缓存，那是编译期的事，不是回放期的事。把 `cacheStatus` 原样塞进回放期 `run-history.jsonl` 会语义错位。

推荐：保留字段名但重定语义 + 强约束，不直接删，理由是它仍承载「这份冻结产物为什么可复用」的溯源价值；二选一交 grill 拍：

- 方案 A（推荐）：`cacheStatus` 不表示「回放期解析缓存命中」，改表示「本次回放所加载的冻结产物 / `通道剖面` 是否复用自既有编译产物」的溯源标记，枚举沿用 `hit|miss|stale|bypass`，纯回放无复用时恒为 `bypass`。schema 描述与登记白话里钉死不变量：「`确定性回放` 每步重解析定位器、本字段绝不影响 `多态裁定`、绝不进 `bin/verdict.mjs`、绝不写 `passes`」（对齐 stagehand §3「`cacheStatus` 只进 `run-history.jsonl`、禁进 `axes.json`」、护栏 #15/#17）。字段设为可空，编译产物溯源不可知时为 null。
- 方案 B：直接从 `run-history.jsonl` 删 `cacheStatus`，把缓存命中溯源全部归到编译期证据（`compile.log` 或一份编译侧产物），回放历史只记「这次实际发生了什么」、不掺编译缓存派生信号。最干净、最贴「回放无缓存」的事实，代价是丢掉 stagehand §3「缓存命中可观测」的借鉴点在回放报告里的落点。
- 连带：`run-metrics.json` 的 `cacheHitRate` 与 `cacheStatus` 同生死。若取方案 A 且本次纯回放无复用，`cacheHitRate` 应为 null（无缓存参与）而非 0，以诚实反映「回放无解析缓存」；fixture 已按 null 示范。若取方案 B，则一并删 `cacheHitRate`。
- 我的倾向：方案 A（留字段、重定义、强约束），因为编译产物复用溯源对「为什么这份 spec 可不重编译直接回放」是有诊断价值的；但若 grill 认为「编译复用应只落编译侧、回放历史保持纯净」更重要，方案 B 我无异议。

### Q3 边界红线：仅报告 / 调试、绝不进 `bin/verdict.mjs` 输入、绝不写 `passes`、落盘过凭据兜底门、对 `fill` value 等凭据型输入打码

推荐：把以下五条红线写进 schema 描述 + 登记白话 + 后续实现 golden，缺一不可：

1. 仅报告 / 调试证据：`run-history.jsonl` / `run-metrics.json` 是第二层事实，不是裁定结论。`多态裁定` 仍只吃确定性 `三轴`、`冻结断言契约`、`观测现状` 与取证事实（stagehand §4 落地规则）。
2. 绝不进 `bin/verdict.mjs` 输入：`bin/verdict.mjs` 的唯一输入接缝是已分轴的 `axes.json` / `StepAxes`；run-history / run-metrics 永不作其分支信号（护栏 #15「裁判零 LLM、与自愈分进程」、#17「裁判按断言种类不可知」）。建议实现期补一条结构 golden：断言 verdict 进程不读这两个文件。
3. 绝不写 `passes`：`passes` 只有 `bin/gate.mjs` 有权写（`CLAUDE.md` 硬规则）。run-metrics 里命名要避坑——`passedActions` 计的是「动作执行成功数」，既不是四态 `PASS`、也不是 prd 的 `passes`；schema 描述须显式写清，防把「看起来健康」误当判绿（stagehand §4「不能因为 history 看起来健康就判 PASS」）。
4. 落盘过凭据兜底门：与报告同受护栏 #7 约束。`run-history.jsonl` / `run-metrics.json`（连同 `replay.log` / `redaction.log`）落盘前都必须过凭据兜底门扫描；`.auth/` 与 `site.json` 内容绝不进（autonoma §5 落地规则）。
5. 对 `fill` value 等凭据型输入打码：schema 里 `parameters` 不收原始动作值——`fill` / `press` 等的值一律以占位符（如 `{{workflowName}}`）或脱敏标记承载，绝不落字面量。`accessibleName`（元素可读名，如按钮「保存」）不是凭据可保留；真正高危的是输入值与流式回复中的 PII。脱敏动作记入 `redaction.log`，但只记字段路径 / 规则 id / 计数 / 占位标记，绝不存脱敏前原值（stagehand §12、autonoma §5）。

### Q4 进哪个 prd 的 `testChecksums`？归哪条轨？

推荐：

- 接缝归属：`run-history.jsonl` / `run-metrics.json` 由 `确定性回放` 产出（轨 A · P5 · `bin/replay.mjs`），由报告消费（轨 B · P7 · `report.mjs`）。属于「P5 产出、P7 消费」的回放证据接缝。
- 冻什么：本草稿的 schema + 合成 fixture 走 v2 接缝冻结（同 `seams-freeze` 那批的做法：schema + 合成 fixture + golden 校验器 + prd），拍板后另开实现计划落 golden。
- 进哪个 `testChecksums`：建议新开 `seams-freeze-v2` 契约冻 schema + fixture（与第1层 `seams-freeze` 对齐），并在轨 A 的 `loop/prd-p5-replay.json` 以加性条目追加运行期 golden 的 checksum——该 golden 断言三件事：(a) 实发 `run-history.jsonl` 逐行过 schema、`run-metrics.json` 过 schema；(b) 凭据脱敏不变量成立（无原始 `fill` value、无 `.auth/`/`site.json` 内容）；(c) verdict 进程不读这两个文件。加性追加不动 P5 已冻的五个 checksum（护栏 #1 Test Ratchet）。
- 归哪条轨：主轨 A（P5 回放内核产出方）。报告呈现侧（轨 B · P7）只读消费、不另冻这条接缝的二次 golden。
- 走哪条入口分流车道：建议 `full`（实质 grill），不走 `light` 跳 grill。理由：本接缝带一条真设计张力（Q2 `cacheStatus` vs `确定性回放`）和一条凭据红线（Q3），不是「无争议形状」，正该让 grill-with-docs 把张力 grill 到收口、把术语登记 `CONTEXT.md`，区别于第1层 `seams-freeze` 的 `light` 跳 grill。

## 次要开放点（一并交 grill）

- N1 字段名 `method` vs 已冻 `action`：stagehand §4 用 `method`，但已冻 `events.schema.json` 的字段叫 `action`（枚举 `click/dblclick/fill/selectOption/press/nav/newpage`）。推荐 run-history 跟随已冻名用 `action`，避免同义双名；schema 草稿暂按任务字段表写 `method` 并在此标记待统一，倾向最终改 `action`。
- N2 `intentId` 形态：已冻 `events.schema.json` 是 `^intent_[0-9]+$`，stagehand §4 示例用点分 `create_workflow.fill_name`（已在 stagehand 备忘录里标注与已冻冲突）。推荐 run-history 跟随已冻 `^intent_[0-9]+$`，fixture 已用 `intent_0/1/2` 示范。
- N3 `locatorResolution` 标量 vs 富对象：§4 是标量字符串（`unique` 等五值之一），§8 是带 `candidateCount`/`backendNodeId`/`centroid` 的富对象。推荐 run-history 先用标量枚举（与 §4 一致、最小面），富对象按需在 `axes.json` 动作轴侧展开，别让回放历史承载几何细节。
- N4 `result` 枚举语义：`result` 记动作执行结果（`ok`/`actionError`/`locatorError`/`timeout`/`quietPointMiss`），不是四态裁定。schema 描述须显式写「`result` 永不等同 `多态裁定` 四态」，防与 verdict 混淆。
- N5 每行是否带 `schemaVersion`：逐行重复版本号噪声大。推荐版本号只落 `run-metrics.json`（或 run 清单）一处，`run-history.jsonl` 单行不带；交 grill 定。

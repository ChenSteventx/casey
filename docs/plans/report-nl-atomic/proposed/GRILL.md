# report-nl-atomic — grill 决策（P7 报告首增量，full）

背景：`report-spec.md` §3 codex 加入的报告新需求经异构核为文实不符（report-model/renderReport 未落地），已记进「目标态、尚未实现」对账表并挂 P7。本契约落其**第一增量**：`naturalLanguage`（用例自然语言块）+ `atomicSteps`（原子操作清单，稳定编号）。其余四项（录像置裁定前、清理证据、画布结构有效、变量默认自定义）为后续增量，errata 随之逐条收缩。

数据源已在 `assembleReportModel` 入参内：`meta.intentTextByIntent`（intentId→意图原文）给 naturalLanguage；`verdict.steps`⋈`axes`（含 action.kind 动词与 postAssertions）给 atomicSteps。故本增量零新增管道、纯投影加法。

## D1 naturalLanguage 取值来源

- 定夺：优先 `meta.naturalLanguage`（新增可选 meta 字段，承用户原文或已签 TestCase 文本）；缺则由有序去重的步骤 `intentText`（意图原文）合成为可读段落；两者皆缺 → `null`。
- 理由：report-spec §3 #2「用户输入或人签 TestCase intents 合成」。合成走既有 `intentTextByIntent`，不新增来源。
- 缺席推定（可否决）：合成用「意图原文按步序去重换行拼接」，不做 LLM 改写（保持零 LLM 渲染）。

## D2 atomicSteps 粒度与形态

- 定夺：一个可观察动作或一个断言各占一条（report-spec §3 #3）。逐 report step 展开：该步 action（若有 action.kind）→ 一条 `kind:"action"`；其每条 postAssertion → 一条 `kind:"assertion"`。全局稳定 `seq` 从 1 起。
- 形态：`atomicSteps: [{ seq:int>=1, kind:"action"|"assertion", stepId:string, intentId:string|null, describe:string }]`。`describe` = 动作动词（action.kind）或断言白话「kind op value」，均经既有标量脱敏 `redactScalar`（护栏 #7）。
- 缺席推定：describe 为零 LLM 机械白话（动词表 + kind/op/value 拼装），不发明语义。

## D3 回指范围（本增量边界）

- 定夺：本增量建 atomicSteps 清单 + 稳定 seq + 每条挂 stepId/intentId（子页可显示「原子操作 #N」这一层回指）。
- 不做（后续增量，errata 保留）：验收点/截图/网络取证/错误摘要**逐类**回指 seq 的全量接线（report-spec §3 #5 后半）。本增量只保证 seq 存在且与 stepId 可对齐，不改各证据块渲染。

## D4 schema 姿态：加法可选、不破既有

- 定夺：`report-model.schema.json` 顶层加 `naturalLanguage`（`["string","null"]`）+ `atomicSteps`（array，items `additionalProperties:false`），**均不入 `required`**。
- 理由：`assembleReportModel` 恒产两字段（真报告必带）；schema 只放行、不强制，手搭 report-model.json 夹具（未过装配器者）不因新字段被拒——加法容错，护栏 #16「gate 绿≠完成」不放松。

## D5 渲染顺序 + 缺席零行为差

- 定夺：HTML/MD 主页头部之后先「测试用例」块（naturalLanguage），紧跟「原子操作」块（atomicSteps），再到录像/裁定概览（report-spec §3 顺序）。JSON 报告直带 `naturalLanguage`/`atomicSteps` 两字段。
- 缺席零行为差（镜像 report-diagnostics「单参字节级零差异」）：模型缺 `naturalLanguage`（null）时块显式标「（未提供自然语言用例）」不静默略（report-spec #10）；模型缺 `atomicSteps`（旧模型/空）时不产该块。既有渲染消费者（其模型经装配器现恒带两字段）用定向断言、非全量 deepEq，加块不破——accept 阶段跑全部 report 涟漪金牌实证。

## D6 fail-safe

- naturalLanguage 合成失败/无源 → null + 明示占位，绝不臆造。
- atomicSteps describe 取不到动词/值 → 该条 describe 落安全占位（如「(动作)」/「(断言)」），seq 不跳号；绝不吞条目致回指错位。
- 全程零 LLM（渲染器纪律不变）。

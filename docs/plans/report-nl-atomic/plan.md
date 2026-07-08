# report-nl-atomic — plan（full）

P7 报告首增量：`report-model` + 渲染器加 `naturalLanguage`（用例自然语言块）与 `atomicSteps`（原子操作清单，稳定编号）。决策见 `docs/plans/report-nl-atomic/proposed/GRILL.md`。纯投影加法，零 LLM，零新增管道。

## 1. schema（冻结形态加法）

- `tests/_golden/schemas/report-model.schema.json` 顶层 `properties` 加：
  - `naturalLanguage`：`{ "type": ["string", "null"] }`。
  - `atomicSteps`：`array`，item `object`（`additionalProperties:false`）：`seq`(integer>=1)、`kind`(enum action|assertion)、`stepId`(string)、`intentId`(string|null)、`describe`(string)。
- 两者均**不入** `required`（加法可选，手搭夹具不破——GRILL D4）。

## 2. 装配器（`lib/report-model.mjs`）

- `assembleReportModel` 末尾恒产两字段：
  - `naturalLanguage` = `meta.naturalLanguage`（新可选 meta 字段，string）优先；缺则由步骤 `intentText` 按步序去重换行拼接；皆缺 → `null`（GRILL D1/D6）。
  - `atomicSteps` = 逐 step 展开：有 `action` → 一条 `kind:"action"`（describe=动作动词）；每条 `postAssertion` → 一条 `kind:"assertion"`（describe=「kind op value」白话，`redactScalar` 脱敏）。全局 `seq` 从 1；每条挂 `stepId`/`intentId`（GRILL D2）。
- meta 旁参自守：`meta.naturalLanguage` 非 string|缺省即报损坏 fail-closed（同现有 meta 字段纪律）。

## 3. 渲染器（`lib/report.mjs` 纯函数 + `bin/report.mjs` 壳零改）

- HTML/MD 主页头部之后：先「测试用例」块（naturalLanguage；null 时显式「（未提供自然语言用例）」不静默略）→ 紧跟「原子操作」块（atomicSteps 编号列表）→ 再录像/裁定概览（GRILL D5、report-spec §3 顺序）。
- JSON 报告直带 `naturalLanguage`/`atomicSteps`。
- 缺席零行为差：模型无 atomicSteps（旧模型）不产该块；有则产。既有 report 涟漪金牌用定向断言、非全量 deepEq。

## 4. 验收（红先行）

- `node tests/_golden/p7-report.golden.mjs`
  - C-A 装配器产 `atomicSteps`：动作 + 断言各占一条、`seq` 稳定从 1 连续、每条挂 stepId/intentId。
  - C-B `naturalLanguage`：meta 显式优先；缺则 intentText 合成；皆缺 null。
  - C-C schema 校验：带两字段的模型过 `report-model.schema.json`；缺两字段的旧模型仍过（可选）。
  - C-D 渲染：HTML/MD 含「测试用例」「原子操作」块且位于裁定概览之前；JSON 带两字段；naturalLanguage=null 时显式占位不静默。
  - C-E 脱敏：atomicSteps.describe 走 `redactScalar`（护栏 #7）。
- `node bin/casey.mjs selftest --tier1` 无回归。
- 全部 report 涟漪金牌（p7-report/report-fidelity/report-diagnostics/replay-video/output-seal/layer3-wiring/seams-freeze 等）加法容错实证绿；schema 冻结金牌 checksum 重签。

## 5. 非目标（后续增量，errata 保留）

- 录像置裁定概览前的**排序重构**、清理证据（删除前后命中数）、工作流画布结构有效、变量默认自定义——各自后续增量。
- 验收点/截图/取证/错误摘要**逐类**回指 atomicStep seq 的全量接线（本增量只保 seq + stepId 可对齐）。
- 每落一项，`report-spec.md`「目标态、尚未实现」对账表对应条目收缩。

## 6. review

Claude 实现 → codex 异构评审（评审家族≠实现家族）；只喂 spec+diff+证据。

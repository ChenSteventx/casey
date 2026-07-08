# report-cleanup-evidence — plan（full）

P7 报告第三增量：report-model + 渲染器加顶层 `cleanupEvidence` 与「清理证据」块（surface `countChange` 断言的删除前后命中数）。决策见 `docs/plans/report-cleanup-evidence/proposed/GRILL.md`。纯投影加法，零 LLM，缺席零行为差。

## 1. schema

- `report-model.schema.json` 顶层加 `cleanupEvidence`：`array`，item `object`（`additionalProperties:false`，`required:["stepId","op"]`）：`stepId`(string)、`intentId`(["string","null"])、`op`(string)、`value`(["string","null"])、`actual`(["string","null"])。不入顶层 `required`。

## 2. 装配器（`lib/report-model.mjs`）

- `assembleReportModel` 恒产 `cleanupEvidence`：扫各 step `postAssertions`，`kind==='countChange'` → `{ stepId, intentId, op, value, actual }`（值取已 `projectPost` 脱敏的）。无 countChange → `[]`。

## 3. 渲染器（`lib/report.mjs`）

- 新 `cleanupEvidenceHtml(model)`：缺键/空 → 空串（零行为差）；非空 → `<section class="cleanup-evidence"><h2>清理证据</h2><ul>…</ul></section>`，逐条「操作 <stepId>：计数 <op> · 删除前后命中数 <actual>（期望 <value>）」。
- 插入位置：`… + summary + banner + cleanupEvidenceHtml(model) + groups + …`（裁定概览/横幅后、分组步骤前）。
- MD：裁定概览/置顶块后、分组步骤前加「## 清理证据」+ 逐条行。
- JSON：`renderJson` 带 `cleanupEvidence`。

## 4. 验收（红先行）

- `node tests/_golden/report-cleanup-evidence.golden.mjs`
  - C-A 装配器：含 countChange 步 → cleanupEvidence 收该条（stepId/op/actual 对）；无 countChange → `[]`。
  - C-B schema：顶层声明 cleanupEvidence（array）、item required [stepId,op] + additionalProperties:false、不入顶层 required。
  - C-C 渲染：HTML/MD 出「清理证据」块含 actual（删前→删后）；位于裁定概览之后、分组步骤之前。
  - C-D 缺席零行为差：空 cleanupEvidence / 无键旧模型 → 不产块。
  - C-E JSON 带 cleanupEvidence；脱敏保持（actual 经 projectPost）。
- `node bin/casey.mjs selftest --tier1` 无回归。
- report 涟漪金牌全绿；schema 涟漪 prd-seams-freeze checksum 重签。

## 5. 非目标

- 精确名称残留复查（#9 后半，断言层已支持）、画布结构有效、变量默认自定义——各自后续增量，report-spec 对账表续收缩。

## 6. review

Claude 实现 → codex 异构评审（评审家族≠实现家族）；只喂 spec+diff+证据。

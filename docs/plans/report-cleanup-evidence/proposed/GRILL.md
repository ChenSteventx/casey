# report-cleanup-evidence — grill 决策（P7 报告第三增量，full）

背景：report-spec §3 硬要求 #9「编辑型用例必须包含清理证据：删除前命中数、删除后命中数」。数据已在——`countChange` 断言的 `actual` = `"before→after"`（`lib/replay-assert.mjs:59`），逐步 期望对实际 表已呈现，但埋在断言里、不醒目。本契约把它 surface 成顶层块。

## D1 cleanupEvidence 数据源

- 定夺：扫所有 report step 的 `postAssertions`，`kind === 'countChange'` 的投影成顶层 `cleanupEvidence` 条目 `{ stepId, intentId, op, value, actual }`。`actual`（"删前→删后"）即 #9 的删除前后命中数，已过 `projectPost` 脱敏（计数为数字、无凭据）。
- 理由：零新增数据/管道，纯 surface 既有断言。

## D2 范围

- 定夺：收全部 `countChange`（`op` equals=归零/down=减少/up=增加均为计数证据）；块题「清理证据」。
- 缺席推定（可否决）：不筛 op——create 的计数变化亦有诊断价值，全收更诚实。

## D3 渲染位置

- 定夺：裁定概览 + 置顶横幅之后、分组步骤之前（属结果证据、置醒目处）。JSON 旁车带 `cleanupEvidence`。
- 零行为差：`cleanupEvidence` 空 / 键缺（旧模型/共享 fixture）→ 不产块。

## D4 schema

- 定夺：顶层 `cleanupEvidence` array，item `object`（`additionalProperties:false`，`required:[stepId,op]`）：`stepId`(string)、`intentId`(string|null)、`op`(string)、`value`(string|null)、`actual`(string|null)。不入顶层 `required`（加法可选）。

## D5 非目标

- 「必要时附精确名称残留复查」（#9 后半）= 删后 `textHidden`/`textVisible` 断言，属断言层、已有 kind 支持、报告逐步已呈现——不在本增量。
- 本增量只 surface `countChange` 计数证据，不改断言评估、不动裁定。

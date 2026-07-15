# real-report-delivery plan

目标：让真实回放的每个单例 HTML 满足自然语言用例、原子操作、录像、附件与视觉复核交付，并让聚合页只作可点击索引。

## 实现

1. `lib/report-model.mjs` 从 case meta 的前置条件与 intent 文本合成 `naturalLanguage`；生成同目录附件清单；校验并投影只读 `visualReview`。
2. `bin/report-model.mjs` 接受可选 `--visual-review`，读 `visual-review.json` 后交给纯装配器。
3. `lib/report.mjs` 显示原子行的 stepId/intentId、附件直接链接和视觉复核区块；视觉摘要明确不参与 verdict。
4. `bin/report.mjs` 聚合扫描时注入已校验的单例相对路径，`lib/report-model.mjs`/`lib/report.mjs` 将其投影为目录链接。
5. 更新 `report-model.schema.json`；只运行 `node --check`、schema/纯函数验收和 `git diff --check`。

## 验收

- 纯函数输入含 `preconditions/intents` 时，HTML/JSON 有完整自然语言。
- 单例 HTML 有九类附件直接链接；录像附件仅在同 run 有 video meta 时出现。
- `visualReview` 有机读字段与 HTML 区块，且固定 `verdictImpact=none`；缺失明示待复核。
- 聚合页链接 `<subdir>/<caseId>.report.html`。
- 不运行任何 fake/fixture SUT 或行为 golden。

## 人工可观察项

- `visual-review.json` 必须在同次真实回放后由视觉能力复核录像生成；本包只提供落点，不伪造真机视觉结论。
- 真机三条串行回放与最终报告由主任务执行。

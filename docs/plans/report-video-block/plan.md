# report-video-block — plan（full）

P7 报告第二增量：report-model + 渲染器加顶层 `replayVideo` 与「回放录像」块（置原子操作后、裁定概览前）。决策见 `docs/plans/report-video-block/proposed/GRILL.md`。纯投影加法，零 LLM，缺席零行为差。

## 1. schema（冻结形态加法）

- `report-model.schema.json` 顶层加 `replayVideo`：`{ "type": ["object","null"] }`，object 时 `additionalProperties:false` + `required:["file"]` + `file:{type:string}`。不入顶层 `required`（加法可选）。

## 2. 装配器（`lib/report-model.mjs`）

- `assembleReportModel` 恒产 `replayVideo` = `videoMeta` 存在时 `{ file: videoMeta.file }`，否则 `null`（videoMeta.file 已过白名单自守）。

## 3. 渲染器（`lib/report.mjs`）

- 新 `replayVideoHtml(model)`：缺 `replayVideo` 键 → 空串（零行为差）；键在且非 null → `<section class="replay-video"><h2>回放录像</h2><video src="<file>" controls></video></section>`；null → 同 section 标「无录像」。
- 插入位置：`head + naturalLanguageHtml + atomicStepsHtml + replayVideoHtml + summary + ...`。
- MD：「原子操作」块后、「裁定概览」前加「## 回放录像」+ 文件名或「无录像」。
- JSON：`renderJson` 带 `replayVideo`。

## 4. 验收（红先行）

- `node tests/_golden/report-video-block.golden.mjs`
  - C-A 装配器：有 videoMeta → `replayVideo.file` = 该文件名；无 videoMeta → `replayVideo === null`。
  - C-B schema：顶层声明 `replayVideo`（object|null）、object 时 required file + additionalProperties:false、不入顶层 required。
  - C-C 渲染顺序：HTML「原子操作」< 「回放录像」< 「裁定概览」(summary)；`<video src=...>` 用相对文件名（无 http）。
  - C-D 无录像明示：`replayVideo:null` → 块含「无录像」不静默；模型无键（旧模型）→ 不产块（零行为差）。
  - C-E JSON 带 replayVideo；MD 有「回放录像」块。
- `node bin/casey.mjs selftest --tier1` 无回归。
- report 涟漪金牌全绿（缺席零行为差）；schema 冻结涟漪 prd-seams-freeze checksum 重签。

## 5. 非目标（后续增量）

- 「无录像」缺失原因细分（登录卫生→两上下文文案）、清理证据、画布结构有效、变量默认自定义——各自后续增量，report-spec 对账表续收缩。

## 6. review

Claude 实现 → codex 异构评审（评审家族≠实现家族）；只喂 spec+diff+证据。

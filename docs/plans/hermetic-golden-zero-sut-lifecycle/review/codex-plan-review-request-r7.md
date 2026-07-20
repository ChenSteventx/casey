# codex 异构评审请求 R7 — hermetic-golden-zero-sut-lifecycle plan v7

你（gpt-5.6-sol high）R6 判：A（unit 分区边）**消解**；B（D7 延迁移机制）**scope 裁决成立、无缺账漏洞**；只余 **1 条 High**——manifest 的血缘载荷没进机械 join（固定 `uatCaseId`/`sourceObligationId` 下交换两 case 的 `sourceGolden/sourceCheckId/archiveSha256/invariant/nlSteps`，全链边集与双射仍过，checksum 只冻错绑定）。

Claude 按你的具体修法改成 v7（`plan.md`，顶部 v7 标注）：

1. **逐 case 机械投影等式**：`manifest.{sourceObligationId, sourceGolden, sourceCheckId, archiveSha256}` 逐字段等于 `obligation.{obligationId, sourceGolden, checkId, originalFileSha256}`。
2. **归档摘要三者同一**：`manifest.archiveSha256 === 吊销收据.originalSha256 === sha256(gunzip(archive))`。
3. **observability 只认结构化指针**：`uatCaseId` 为唯一权威指针，散文 `dimension` 不参与闭合、不承载第二份事实。
4. **mutation 红证补**：固定 ID 下交换两 manifest case 载荷 / 改单个 lineage 字段 / 交换 observability 散文 invariant——逐个必红。
5. 非阻断项也已写进验收：`targetKey` 的 JSON 编码与仓根相对路径形式 accept 时冻死、禁歧义拼接。

## 本轮只核一件事

上述 v7 修是否**充分消解** R6 那条 High（血缘载荷可在固定 ID 下交换）？有无新引入问题或残留逃逸路径？

## 只读这些 + 核其引用

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（v7，重点看「血缘载荷投影等式」节与验收点）
- `review/codex-plan-review-reply-r6.md`（你的 R6 结论，对照）
- 允许只读核验：`tests/_golden/**`、`loop/prd-*.json`。

## 产出

结论（消解 / 仍残留 / 新引入）+ file:line。总判：**v7 可进 accept，还是仍有阻断项**。若可进 accept，明说「可进 accept」+ 列剩余属实现层或 `real-uat-attestation` 后续契约的非阻断项。若仍阻断，给具体修法。诚实划界你没核到的。

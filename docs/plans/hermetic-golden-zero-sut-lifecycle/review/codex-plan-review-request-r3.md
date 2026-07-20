# codex 异构评审请求 R3 — hermetic-golden-zero-sut-lifecycle plan v3

你（gpt-5.6-sol high）R2 认 F2 消解、余 5 条残留（F1/F3/F5/F6/F7，`review/codex-plan-review-reply-r2.md`）。Claude 修成 v3（`plan.md`，顶部 v3 标注）。本轮复审：**逐条核 R2 的 5 条残留是否消解，有无新引入问题，v3 是否可进 accept**。同样对抗式、不确定判需补证。

## 只读这些 + 核其引用

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（v3）
- `review/codex-plan-review-reply-r2.md`（R2 五残留，对照）
- 允许只读核验：`tests/_golden/**`、`loop/prd-*.json`、`bin/verdict.mjs`、`lib/entity-semantic-lock-preflight.mjs`。

## 逐条复核（R2 残留 → v3 修法）

1. **R2-F1/F3（High，混合漏拆 + 矩阵自证）**：v3 引入独立冻结**闭集② `source-obligations`**（逐 check：obligationId/源 span/原 sha/category），矩阵 key 严格等于它、混合金牌清单由 category 推导（非示例）、删/加/重复行突变红证。核：这个独立闭集是否真解「删矩阵一行仍全绿」？category 由闭集①的 check 粒度命中辨识是否可靠？
2. **R2-F5（High，manifest 无人消费）**：v3 把 manifest 纳入新 `prd-hermetic-retired-uat` 的 checksum/ratchet，每 UAT case 一条 passes:false successor story（不引墓碑），加证据/触发/false→true 人签迁移门，四集合双向闭合。核：是否已防永久 vaporware？双向闭合是否真无缺环漏洞？
3. **R2-F6（High，PRD 反向引用未扫）**：v3 加**全 PRD acceptance 反向依赖闭包**（`prd-acceptance-reverse-closure.mjs`）+ story 内拆，机械校验「墓碑路径不残留任何 true story、存活检查 story 保真态」。核：这道闭包是否覆盖你 R2 逮的 prd-chiefcomplaint-smoke s2 / prd-replay-video 多金牌混引？有无遗漏的反向引用形态？
4. **R2-F4（Medium，output-seal 信封不全）**：v3 把 B5 信封与 event URL 同改合法固定信封（`{{baseUrl}}/ai-manager/process/list`）+ action:nav + 无 pre + 哨兵，断 exit 65 + 原因 + 种子不回显 + 哨兵不存在，补专属验收点。核：这个合法只读信封是否真能过无 authority 的 nav 准入（不再 `REPLAY_READ_EVENT_TARGET_INVALID`）？
5. **R2-F7（Medium，扫描器同源自证）**：v3 给扫描器建独立 detector fixture + 正负控 mutation 电池（每启动方式正控必入、每安全前置闸负控必不入如 admission-audience-wiring 死址+哨兵），AST/调用级 + 命中原因+source span，冻结闭集由人复核扫描器输出+正负控背书得出。核：这是否破了「结果=自产集」的自证？正负控覆盖面够不够？

## 产出

逐条判（消解/仍残留/新引入）+ file:line。总判：**v3 可进 accept，还是仍有阻断项**。若仍有，按严重度列 + 具体修法。诚实划界你没核到的（拟议闭集/矩阵/扫描器/manifest 尚未生成，只能审 plan 设计是否闭合、非实现质量）。

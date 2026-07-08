# report-workflow-structure — plan（full）

P7 报告第四增量：report-model + 渲染器加顶层 `workflowStructure` 与「工作流画布结构」块（据画布构造原子判结构覆盖 + 空/半成警示，report-spec #11）。决策见 `docs/plans/report-workflow-structure/proposed/GRILL.md`。纯投影加法，零 LLM，缺席零行为差，不进裁定。

## 1. schema

- `report-model.schema.json` 顶层加 `workflowStructure`：`{ "type": ["object","null"] }`，object `additionalProperties:false` + `required:["hasNodes","hasConnection","hasNodeConfig","structureComplete"]`，各 `boolean`。不入顶层 `required`。

## 2. 装配器（`lib/report-model.mjs`）

- `assembleReportModel` 恒产 `workflowStructure`：若任一步 `atom ∈ {workflow.addNode, workflow.connectNodes, workflow.openNode}` → 对象 `{hasNodes, hasConnection, hasNodeConfig, structureComplete}`；否则 `null`。
- `hasNodes` = ∃ 步 `atom==='workflow.addNode'` 且 `verdict==='PASS'`（连线 connectNodes / 配置 openNode 同理）。`structureComplete` = 三者与。

## 3. 渲染器（`lib/report.mjs`）

- 新 `workflowStructureHtml(model)`：缺键/null → 空串；非 null → `<section class="workflow-structure"><h2>工作流画布结构</h2>` + checklist（节点/连线/节点配置 ✓/✗）+ 结论（完整 / 「结构不完整——空或半成工作流不得算满足验收」）。
- 插入位置：`… + cleanupEvidenceHtml + workflowStructureHtml + groups + …`（清理证据后、分组步骤前）。
- MD：清理证据块后、分组步骤前加「## 工作流画布结构」+ checklist + 结论。
- JSON：`renderJson` 带 `workflowStructure`。

## 4. 验收（红先行）

- `node tests/_golden/report-workflow-structure.golden.mjs`
  - C-A 装配器：含 addNode+connectNodes+openNode 全 PASS → structureComplete=true 三 has 皆真；缺 connectNodes → hasConnection=false、structureComplete=false；无任何画布原子 → workflowStructure=null；败的 addNode 步 → hasNodes=false。
  - C-B schema：顶层声明 workflowStructure（object|null）、object required 四布尔 + additionalProperties:false、不入顶层 required。
  - C-C 渲染：HTML/MD 出「工作流画布结构」块（清理证据后、分组步骤前）；不完整时含警示文案；完整时含结论。
  - C-D 缺席零行为差：null/无键旧模型 → HTML+MD 均不产块。
  - C-E JSON 带 workflowStructure。
- `node bin/casey.mjs selftest --tier1` 无回归。
- report 涟漪金牌全绿；schema 涟漪 prd-seams-freeze checksum 重签。

## 5. 非目标（后续增量）

- 开始/结束节点身份区分（5 项细分）、断言文本兜底覆盖、变量默认自定义（#12，属编译/草拟期）——各自后续，report-spec 对账表续收缩。

## 6. review

Claude 实现 → codex 异构评审（评审家族≠实现家族）；只喂 spec+diff+证据。

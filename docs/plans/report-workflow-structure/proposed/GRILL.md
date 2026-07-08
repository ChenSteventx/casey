# report-workflow-structure — grill 决策（P7 报告第四增量，full）

背景：report-spec §3 硬要求 #11「工作流发布/导出/历史版本类报告必须证明画布结构有效：开始节点/结束节点/开始到结束连线/开始节点配置/结束节点配置；空工作流件不得算满足验收」。数据源 = 各步 `atom`（画布构造原子）+ `verdict`。

画布构造原子（`compile-atoms.mjs`）：`workflow.addNode`（节点）/ `workflow.connectNodes`（连线）/ `workflow.openNode`（节点配置抽屉）。

## D1 触发与形态

- 定夺：存在任一画布构造原子（addNode/connectNodes/openNode）→ 产顶层 `workflowStructure` `{ hasNodes, hasConnection, hasNodeConfig, structureComplete }`（皆布尔）；否则 `null`（非画布构造用例——列表/发布/聊天等——不产块，避误报）。

## D2 覆盖判据

- 定夺：`hasNodes` = ∃ 步 `atom==='workflow.addNode'` 且 `verdict==='PASS'`（连线/配置同理各自原子）。败步不算证（#11 要「证明有效」）。`structureComplete` = 三者皆真。

## D3 五项→三类的诚实收缩（本增量边界，heuristic 留后续）

- 定夺：report-spec #11 的 5 项（开始节点 / 结束节点 / 连线 / 开始配置 / 结束配置）本增量收成 3 类（节点 / 连线 / 节点配置）。
- 理由：report-model 不携「开始 vs 结束」节点身份（atom 不分 start/end、节点标签未单列在 step）——per-node start/end 区分 + 断言文本兜底属启发式，留后续增量（prd observability）。本增量以原子类别证「画布结构操作被验证通过」+ 空/半成警示，兑现 #11 核心（空工作流不得过）。

## D4 渲染

- 定夺：HTML/MD「清理证据」块后、分组步骤前 出「工作流画布结构」块——checklist（节点/连线/节点配置 各 ✓/✗）+ `structureComplete` 结论；不完整时明示「画布结构不完整——空或半成工作流不得算满足验收（report-spec #11）」。JSON 带 `workflowStructure`。
- 零行为差：`workflowStructure` null / 键缺（旧模型/非画布用例）→ 不产块。纯诊断证据、不进裁定（零 LLM）。

## D5 schema

- 定夺：顶层 `workflowStructure` `object|null`，object `additionalProperties:false` + `required:[hasNodes,hasConnection,hasNodeConfig,structureComplete]`（皆 boolean）。不入顶层 `required`。

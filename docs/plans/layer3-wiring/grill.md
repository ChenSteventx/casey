# layer3-wiring — grill（light 车道，不做实质 grill）

> 状态：light 车道 grill —— 不做实质 grill-with-docs，只记「为何可跳」+ 唯一（grounded、非开放）设计决策。判据同第 1 层 `seams-freeze` 的 light 先例：无争议、形状已在别处扎根。

## 为何 light 跳实质 grill

- **目标形状已冻**：终点 `report-model.json` 的形状是已冻 `report-model.schema.json`（第 1 层 seams-freeze 冻结）；本轮只写「产出符合该冻结 schema 的装配器」，不新立 schema、不改任何冻结区。
- **join 语义机械导出**：装配器把 `verdict.json ⋈ axes.json ⋈ observed-reality ⋈ expected-frozen` 按 `stepId` 拼成 report-model，四源形状全是已冻契约，映射是机械对字段，无开放设计张力。
- **无新术语/接缝**：不造词、不登记 `CONTEXT.md`、不加接缝——`报表模型`/`裁定档`/`观测现状`/`三轴` 等全已登记。
- **消费冻结契约、不改内核**：`verdict.mjs`/`check.mjs`/`replay.mjs`/`report.mjs` 一字不改（护栏 #15 裁判零 LLM 不受触碰）。
- 故不满足 `full` 的「碰冻结内核 / 真设计张力」触发条件，走 `light`（加 plan 门、edit-impl 需 plan）。

## 唯一设计决策（grounded，非开放）

**运行产物布局**：编排器把 run 级产物（`axes.json`/`verdict.json`/`report-model.json`/report）落 `runs/<caseId>/<runId>/`——对齐已冻 `run-history.schema`/`drift-patch` 的 `runs/<caseId>/<runId>/` 约定，而非 `lib/paths.mjs` 的扁平 `cases/<caseId>/`（后者留作 case 级输入 events/observed/expected 的位置）。二者本就并存于仓库、此决策消解矛盾。hermetic golden 传显式 `--run-dir` 保确定性。依据冻结 schema，非开放取舍，无需现场辩论。

## 边界红线（贯穿实现）

- 不改任何冻结内核与冻结 schema；只新增 `lib/report-model.mjs`（+ 薄 CLI `bin/report-model.mjs`）与 `casey run` 接线。
- `defectTicket` 仅 `SUT_DEFECT` 步产（正反两向 golden 守，schema 硬约束）。
- 退出码归一到 casey 统一图例、任一阶段非零 fail-closed 不吞错。
- 凭据红线（护栏 #7）：装配器绝不搬 body/headers/cookie/token/PII 进 report-model。

## 用户确认

用户经 AskUserQuestion 选定「搭第 3 层集成 wiring 骨架（hermetic）」方向，本轮范围与之一致。

# layer3-wiring — plan（第 3 层集成 wiring 骨架 · hermetic）

## 背景与边界

第 3 层集成把已建的四个阶段引擎接成端到端管线。现状（Explore 双代理实测）：`compile产物 → replay → verdict` 已能对冻结 fixture 跑通（`tests/_golden/p5-replay.golden.mjs` 就是这条链，止步 verdict）；**断链在 `verdict → report`**——`bin/report.mjs` 要一份 `report-model.json`，但**没有任何代码从 `verdict.json` 产出它**。`bin/casey.mjs` 的 `run`/`replay`/`verdict`/`report` 全是 `notImplemented` 桩（exit 3）。

本轮 = **hermetic 骨架**：对合成 fixture + 假 SUT 跑通端到端，**不需真站**。**消费冻结契约、不改冻结内核**（`verdict.mjs`/`check.mjs`/`replay.mjs`/`report.mjs` 一字不改；`report-model.schema.json` 等冻结 schema 只读对齐）。走 `light` 车道（加 plan 门、跳 grill：目标形状 `report-model.schema` 已冻，无新接缝/新词要 grill）。

## 冻结契约锚点（只读对齐，不改）

- 输入：`events.json`（`events.schema`）、`expected.frozen.json`（`expected-frozen.schema`：`intents[].expected[]`+`globalAssertions`）、`观测现状 observed-<caseId>.json`（`observed-reality.schema`）、`通道剖面 profile.json`（`{background,successField,successValue}` 非凭据）。
- 中间产物：`axes.json`（replay 出，`{caseId,steps:[StepAxes]}`，StepAxes = `{stepId,intentId,atom,action,postAssertions[],forensics}`）、`verdict.json`（verdict 出，`{caseId,steps:[{stepId,intentId,atom,verdict,reason}]}`）。
- 终点：`report-model.json`（`report-model.schema`：`{schemaVersion,caseId,channel,generatedAt,verdictSummary,steps[]}`；step 必填 `stepId,intentId,atom,verdict,reason,postAssertions`，选填 `action,forensics,observed,attachments,defectTicket,intentText`；`defectTicket` 仅 `SUT_DEFECT` 步）→ `report.mjs` 渲染 HTML/MD/json。

## 要建的三件

### 1. 报表模型装配器 `lib/report-model.mjs`（缺的那条 join，核心）

纯函数、零 LLM：`assembleReportModel({ caseId, channel, verdict, axes, observed, expected, meta }) → reportModel`，按 `stepId` 把四源 join 起来：

- 逐步：`verdict/reason`（← verdict.json）⋈ `action/postAssertions/forensics`（← axes StepAxes）⋈ `observed{replyText,...}`（← observed-reality）⋈ `intentText`（← expected/case）。
- `verdictSummary` = 四态计数（PASS/SUT_DEFECT/HARNESS_ERROR/NEEDS_HUMAN）。
- `defectTicket` **仅当 `verdict===SUT_DEFECT`**：`{failedAssertions(← axes.postAssertions 中 !ok), backingForensics(← axes.forensics 中归因本步的 5xx/信封), videoAt/traceRef(← attachments，hermetic 可 null)}`。非 SUT_DEFECT 步绝不产 defectTicket（schema 硬约束 + 装配器守）。
- `generatedAt`；`signedAgainstBuild/signerId/passes`（← expected/prd，无则 null）。
- 产物必过 `report-model.schema`；凭据红线：绝不搬 body/headers/cookie/token（护栏 #7）。

配套薄 CLI `bin/report-model.mjs`（`--verdict --axes --observed --expected --out`），与其它阶段 bin 对称、供编排器子进程调用。

### 2. `casey run` 编排器（`bin/casey.mjs` 接线）

`casey run <caseId> --sut <url> --events <f> --expected <f> --profile <f> [--run-dir <dir>]`，串：

1. `replay.mjs` → `<runDir>/axes.json`
2. `verdict.mjs --axes → <runDir>/verdict.json`
3. `report-model.mjs`（装配）→ `<runDir>/report-model.json`
4. `report.mjs --model → <runDir>/<caseId>.report.{html,md,json}`

- 运行布局：默认 `runs/<caseId>/<runId>/`（对齐冻结 `run-history`/`drift-patch` schema 的 `runs/<caseId>/<runId>/` 约定，非 `lib/paths.mjs` 的扁平 `cases/`）；hermetic golden 传显式 `--run-dir` 保确定性。
- 退出码归一：把各阶段退出码（replay 0/1/64、verdict 0/64/65、report 0/1/2）映射进 casey 统一图例（0 成功/1 红/2 熔断互锁/64 用参/其它非零 fail-closed），任一阶段非零即停、不吞错。

### 3. hermetic 端到端 golden `tests/_golden/layer3-wiring.golden.mjs`

复用假 SUT（`tests/fixtures/fake-sut/server.mjs`，fork 独立进程 + 临时端口）。至少两场景：

- `happy` → 端到端 PASS：verdict.json 全 PASS + report-model 无 defectTicket + report 三文件产出。
- `inject500` → SUT_DEFECT：锚步 verdict=SUT_DEFECT + report-model 该步带 defectTicket（含 backingForensics）+ 其它步不带 + report 产出。

## 验收点

- [命令] `node tests/_golden/layer3-wiring.golden.mjs` exit 0：hermetic 端到端两场景全过——
  - 编排 `replay→verdict→装配→report` 全绿、退出码归一到 0；
  - `verdict.json` 四态与场景期望一致（happy→PASS、inject500 锚步→SUT_DEFECT）；
  - `report-model.json` 过 `report-model.schema` 必填 + `verdictSummary` 计数正确 + `defectTicket` 仅 SUT_DEFECT 步（正反两向）；
  - `report.mjs` 产出 `<caseId>.report.{html,md,json}` 三文件；
  - 深扫产物无凭据/PII 禁字段（护栏 #7）。
- [命令] `node loop-kit/bin/gate.mjs --prd loop/prd-layer3-wiring.json` = GREEN。
- [命令] `node bin/casey.mjs selftest --tier1` 无回归（冻结内核未动）。

## 红基线

golden 先写、`lib/report-model.mjs` 与 `casey run` 未建时跑 → 红（装配器缺失 / run 桩 exit 3）；建齐 → 绿。如实 `--red-verified`。

## 完成判据

gate GREEN + 端到端两场景绿 + selftest tier-1 无回归。**这一步只接管子、只喂合成数据**；真机 bring-up（P3 真编译产真 events/观测现状 → 灌本管线 → tier-2 真站 UAT）与编排器产 `run-history.jsonl`/`run-metrics.json`（本轮不产）押后 route:human（护栏 #16 gate 绿 ≠ 完成）。

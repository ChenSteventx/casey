# run-history — `casey run` 接回放历史/回放指标真产出（light）

## 背景

`seams-freeze-v2` 已冻 `run-history.jsonl` / `run-metrics.json` 的 schema + fixture + golden（`prd-seams-freeze-v2` 九文件 checksum），但全仓零生产者、零消费者。逐行事实（`timestamp`/`durationMs`/`quietPointReached`/`result`）只在相3 回放执行现场存在，故生产者落 `bin/replay.mjs`（当年 grill Q4 既定「P5 产出、P7 消费」）；`casey run` 编排器接线传参、落 `runs/<caseId>/<runId>/`（`layer3-wiring` learn 挂账兑现）。红线四条（grill Q3，schema 描述已钉）：仅报告/调试证据；绝不进 `bin/verdict.mjs` 输入；绝不写 `passes`；落盘过凭据兜底门、动作值一律占位符/脱敏标记。

## 改动

1. `bin/replay.mjs` 加三个 opt-in 旗标：`--run-history <f>`、`--run-metrics <f>`、`--run-id <id>`（同 `--login-bootstrap` 先例：缺省行为一字不变）。生产者是纯观察者：零新增等待、零改动作时序——动了归因窗即污染取证（护栏 #15）。逐 event 内存收集一行 `runHistoryLine`，回放尾（axes 落盘同刻、正常成功路径）经凭据兜底门一次写出；门命中即拒写 + 非零退出（同 `compile.mjs`/`report.mjs` 先例，fail-closed）。
2. 逐行映射只翻译既有机制事实、不造新语义：
   - `timestamp` = 该步完成时刻 ISO；`caseId`/`stepId`/`intentId`/`atom`/`action` 抄 events；
   - `parameters.locator` = `{role, accessibleName, semantic}`（源 `ev.semantic`/`role`/`accessibleName`/`fieldLabel`/`text` 投影；events 无语义键概念，`semantic` 恒 null）；无任何线索则 `parameters: null`；
   - `parameters.valueRef` 值侧红线（护栏 #7）：`ev.value` 恰为单占位符（全串 `{{name}}`）才原样透传，否则有值一律 `<redacted:fill>`；`press` 键 `<redacted:key>`、`selectOption` 选项 `<redacted:option>`；`click`/`dblclick`/`nav`/`newpage` 为 null。字面量绝不落盘（schema pattern 双保）；
   - `locatorResolution`（仅 `click`/`dblclick`/`fill`/`selectOption` 非 null，schema allOf）：动作轴投影 `unique`→`unique`、`none`→`none`、`fallback_first`→`fallback_first`、`action_failed`→`unique`（定位唯一确成立，失败落 `result`）；`nav`/`newpage`/`press` 恒 null（冻结枚举无 `action_failed`，schema 把 press 归无定位需求类，内部解析细节留在 axes 不外泄）；
   - `result`：nav 按 goto 实际成败（成 `ok`、超时 `timeout`、其余 `actionError`）；交互步 `unique`+回读 ok→`ok`、`none`/`fallback_first`→`locatorError`、`action_failed`→`actionError`。`quietPointMiss` 现机制无此失败模式、本轮不产（枚举覆盖非生产义务）；
   - `quietPointReached` = 该步前置稳定程序达成与否（纯观察现机制）：nav 步 goto load 达成；非 nav 步上下文恢复导航达成或无需恢复。false 即「证据可复现性存疑」，与 schema 语义一致；
   - `durationMs` = event 迭代起点到终点（含上下文恢复 + 动作 + 归因窗内等待）。
3. `run-metrics.json` 同进程尾算：`totalSteps`=行数；`passedActions`=`result==='ok'` 行数；`locatorHitRate`=`unique` ÷ `locatorResolution` 非 null 行数（分母 0→null）；`quietPointWaitMs`=非 nav 上下文恢复耗时 + click 机会响应窗/因果窗耗时累计；`totalDurationMs`=回放主流程总耗时；`runId`=`--run-id` 值、缺省 null；`schemaVersion` 1。
4. `bin/casey.mjs` `runPipeline` 相3 args 追加 `--run-history`/`--run-metrics`/`--run-id`（`run-id` = runDir 目录名），尾行产物清单补两文件——这就是「编排器接线」本体。
5. 新 golden `tests/_golden/run-history.golden.mjs`（红先行，`login-sut` 假 SUT）：
   - 集成正向：nav `/app` + 两 fill（混排字面量 vs 纯占位符）+ click「登 录」带三旗标跑 → 逐行按已冻 schema 复核（required/枚举/pattern 直接读 schema 文件取真值源）、行数=事件数、valueRef 打码两向（混排必 `<redacted:fill>` 且全文无实例化字面量、纯占位符原样）、allOf 类别绑定；
   - 聚合一致：metrics 各字段从行重算相符、`runId` 落传入值；
   - 失配诚实：不存在定位的 click → `locatorResolution='none'` + `result='locatorError'`、`passedActions` < `totalSteps`、该轮不带 `--run-id` → `runId===null`；
   - 缺省不变：不带旗标跑 → 两文件不产、exit 0（p5 两冻结 golden 原样绿共同背书零行为差）;
   - 结构红线：`bin/verdict.mjs` 依赖闭包零 `run-history`/`run-metrics` 引用（`prd-seams-freeze-v2` observability 挂账兑现之一）；
   - 编排接线：`casey run` 假 SUT 端到端（复刻 `layer3-wiring` 法）→ runDir 落两件、`runId`=目录名。
6. `loop/prd-run-history.json`：s1 新 golden + tier1；s2 回归锁（`p5-replay`/`p5-replay-coverage`/`kinds-harden`/`layer3-wiring` golden 原样绿）；`testChecksums` 冻新 golden；observability 记真机顺产（route:human 顺手核，非门槛）。

## 非目标

失败记录台账/失败指纹/人裁决回填（同批冻结的另一 schema）不接；报告消费侧（P7 呈现回放历史）不做；`bin/replay.mjs` 行为/时序零改动；已冻 schema/fixture/golden 零改动；replay 非零退出路径（看门狗/登录失败/坏入参）不产诊断件（诊断件与 axes 同生同灭，本轮不承诺半程取证）。

## 验收

新 golden 全绿（实现前红）；四份既有 golden（`p5-replay`/`p5-replay-coverage`/`kinds-harden`/`layer3-wiring`）原样绿；`selftest --tier1` 回归；gate GREEN。

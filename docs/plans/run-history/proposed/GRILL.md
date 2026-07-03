# GRILL — run-history（light，机械决策）

授权：HANDOFF/NEXT-SESSION「下一步 A」+ Steven 本 session 拍板顺序「a 然后 b 然后 c」（2026-07-03）。接缝本体（schema/fixture/golden）已由 `seams-freeze-v2` full 车道 grill 收口冻结，本轮纯接线：把已冻形状的真产出装进既有回放器与编排器，零新领域概念、零 schema 改动。机械决策六条（均为「已冻 schema + 既有机制」的直译，非新设计）：

- **G1 生产者落点**：逐行事实（`timestamp`/`durationMs`/`quietPointReached`/`result`）只在相3 回放执行现场存在，生产者落 `bin/replay.mjs`——当年 grill Q4 既定「P5 产出、P7 消费」。三旗标 opt-in（`--run-history`/`--run-metrics`/`--run-id`），同 `--login-bootstrap` 先例缺省行为一字不变；`casey run` 编排器只接线传参（`layer3-wiring` learn 挂账语义）。生产者是纯观察者：零新增等待、零改动作时序，否则动了取证归因窗（护栏 #15）。
- **G2 枚举缝合**：动作轴内部值 `action_failed` 不在已冻 `locatorResolution` 枚举——投影 `unique`（定位唯一确成立）+ `result='actionError'`（失败归执行结果）；`fallback_first` 在枚举内原样携带；`nav`/`newpage`/`press` 恒 null（schema allOf 既定，回放器内部对 press 的解析细节留在 axes 不外泄）。`result` 映射：nav 按 goto 成败（成 `ok`/超时 `timeout`/其余 `actionError`）；交互步 `unique`+回读 ok→`ok`、`none`/`fallback_first`→`locatorError`、`action_failed`→`actionError`；`quietPointMiss` 现机制无此失败模式、本轮不产（枚举覆盖非生产义务）。
- **G3 `quietPointReached` 口径**：记「该步前置稳定程序达成与否」——nav 步 goto load 达成；非 nav 步上下文恢复导航达成或无需恢复。schema 描述括注的 networkidle/无动画/DOM 稳定是接缝意图描述，现回放机制没有这套探测，补建即违反 G1 纯观察者（新增等待动时序）；按现机制事实如实记录、口径落档，强于两种造假方向（恒 true 过度声明 / 恒 false 洗掉信号）。
- **G4 `valueRef` 打码**：`ev.value` 全串恰为单占位符才透传，否则有值一律 `<redacted:fill>`；`press` 键 `<redacted:key>`、`selectOption` 选项 `<redacted:option>`；无值动作 null。字面量绝不落盘，schema pattern 是第二道机制闸（护栏 #7 value 侧）。
- **G5 落盘纪律**：正常成功路径与 axes 同刻一次写出；两产物过 `lib/cred-gate.mjs`，命中拒写 + exit 1（`compile`/`report` 先例）；replay 非零退出路径（看门狗/登录失败/坏入参）不产诊断件——诊断件与 axes 同生同灭，本轮不承诺半程取证。
- **G6 `runId` 权威**：编排器传 `--run-id` = runDir 目录名（`runs/<caseId>/<runId>/` 布局唯一知情者）；单跑回放器无传则 metrics `runId=null`（schema 可空既定）。

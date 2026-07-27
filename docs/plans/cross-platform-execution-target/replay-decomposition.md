# `bin/replay.mjs` 行为保持拆分设计

## 1. 目标与边界

本设计只解决当前 `bin/replay.mjs` 1062 行且继续承载跨平台执行目标硬化的问题。实施后：

- `bin/replay.mjs` 只保留命令行入口、阶段编排、退出码映射和最终清理，目标不超过 260 行；
- 每个新增或修改文件硬性不超过 600 行，建议在 520 行预警；
- 先做机械搬移与依赖注入，不顺手改变回放时序、裁定语义、产物写入顺序或失败码；
- execution target（执行目标）来源连续性修复落在唯一导航接缝，不能在壳内重新拼地址；
- 不读取、记录、返回或落盘真实站点配置和凭据；
- 不把 `LLM` 引入裁定，不修改 `bin/verdict.mjs` 或 `lib/replay-assert.mjs`。

本轮只形成拆分图，不修改实现，不启动浏览器、被测系统或网络连接。

## 2. 当前代码切片

以下行号基于设计时的 1062 行版本。实施时先用函数名、注释锚和语句形状复核，不以行号做自动切割。

| 当前范围 | 当前职责 | 主要输入 | 主要输出或副作用 |
| --- | --- | --- | --- |
| 19–49 | import 集合 | 文件系统、Playwright、现有内核模块 | 进程依赖 |
| 53–75 | `parseArgs` | `process.argv` | 参数对象 |
| 78–83 | `projectArtifactKey` | 产物路径 | 安全产物名 |
| 88–102 | 全局浏览器和录像清扫 | `activeBrowser`、`videoSweepDir` | 关浏览器、删残件 |
| 104–150 | `historyLine` 及历史常量 | event、动作轴、导航结果 | 单行回放历史 |
| 152–184 | `pathOf`、`waitReplyStable`、`rowCount`、`readJsonSafe` | 页面或文件 | 小型辅助结果 |
| 186–212 | `main` 参数门、看门狗、日志 | 参数、环境测试缝 | 退出、看门狗 |
| 213–341 | 签名、剖面、实体锁与破坏性准入 | events、expected、profile | 冻结身份事实、进程内权威 |
| 342–419 | 站点、凭据、执行目标和受众门 | `--sut`、站点形态、登录旗标 | 执行目标权威、登录预备对象 |
| 421–494 | 按钮、实体锚、断言和 intent 投影 | profile、events、expected | 事件运行计划；启动前哨兵 |
| 495–602 | browser/context/page、录像双页舞步、CDP、取证、登录 | 执行目标、登录预备对象、profile | 活跃会话、取证器、`loginMark` |
| 604–627 | 运行期 Map 与聊天通道初始化 | 运行计划、参数、profile | 可变证据容器 |
| 628–922 | 逐事件导航、动作、静默和代表步观察；最后 drain | page、取证器、运行计划 | 动作轴和观察证据 |
| 924–953 | 录像收敛和登录镜头删除 | context、两个 page | `video.webm` 或干净缺席 |
| 955–1043 | 轴投影、凭据门、历史/指标/录像元数据落盘 | 运行证据 | 四类产物 |
| 1045–1062 | 正常关闭与最终 catch | browser、录像清扫器 | 稳定退出码 |

## 3. 目标模块图

```text
bin/replay.mjs
  ├─ lib/replay-cli-preflight.mjs
  ├─ lib/replay-target-bootstrap.mjs
  ├─ lib/replay-browser-session.mjs
  │    └─ lib/replay-video-lifecycle.mjs
  ├─ lib/replay-event-runner.mjs
  │    ├─ lib/replay-navigation.mjs
  │    ├─ lib/replay-actions.mjs（现有）
  │    ├─ lib/replay-settle.mjs（现有）
  │    └─ lib/replay-observation-capture.mjs
  └─ lib/replay-artifact-finalizer.mjs
       └─ lib/replay-history.mjs
```

壳是唯一进程边界。下层模块不得调用 `process.exit`，不得安装进程级异常处理，也不得打印原始异常。

## 4. 模块契约

### 4.1 `bin/replay.mjs`：薄入口，目标 180–260 行

机械保留：

- import 与 `main().catch(...)`；
- 参数不足、看门狗、调试日志和启动哨兵；
- 依次调用 preflight → target bootstrap → browser session → event runner → finalizer；
- 所有正常和异常路径的唯一退出码映射；
- 最终调用 session/video 的幂等清理。

输入是 `process.argv` 与允许的测试环境变量。输出只有稳定 stderr/stdout、退出码和已过门的产物。禁止持有真实凭据内容；catch 只消费闭集错误 `reason`，不得回显 `error.message`。

### 4.2 `lib/replay-cli-preflight.mjs`：浏览器前准入，目标 300–420 行

从当前 53–75、78–83、181–184、213–341、421–489 搬入：

- `parseArgs`、`readJsonSafe` 和安全产物键；
- events/expected/profile 加载与签名、case 同源门；
- identity channel（身份通道）配置校验；
- workflow delete binding（工作流删除绑定）、实体锁、v2 身份行、破坏性连续性准入；
- 按钮剖面、实体锚校验；
- intent 分组、代表步、硬/软断言投影；
- `ctx` 中与浏览器无关的实例化值。

建议入口：

```js
prepareReplayRun({ args, envFacts, log }) -> {
  runPlan,
  identityRuntime,
  artifactPlan
}
```

`runPlan` 只含 events、intent 索引、断言投影、profile 和安全标识符。`identityRuntime` 是进程内不透明对象，包含被冻结的身份权威、ledger 和连续性 Map；不得 spread、JSON 序列化或写日志。`artifactPlan` 只含路径与 opt-in 布尔值。

失败返回或抛出闭集 `ReplayAbort({ reason, exitCode })`。第一阶段保持现有 exit 65/1 语义，不合并失败类别。

### 4.3 `lib/replay-target-bootstrap.mjs`：目标与登录预备，目标 160–240 行

从当前 342–419 搬入并承接跨平台执行目标修复：

- 无论是否启用登录，都读取同一份脱敏站点目标形态；
- 只有启用登录时才加载凭据；
- 调用 `resolveExecutionTargetFromInputs`；
- 执行 credential audience（凭据受众）门；
- 构造登录起始导航意图，但不在公开对象中返回目标值。

建议入口：

```js
prepareExecutionBootstrap({
  cliSut,
  events,
  loginRequested,
  siteFacts,
  credentialLoader,
  runtimeFacts
}) -> executionBootstrap
```

`executionBootstrap` 必须是不透明能力对象，只能交给浏览器会话与导航模块。它内部可以持有 execution authority（执行权威）和一次性登录材料；公开 receipt 仍只允许闭合分类字段。登录材料在会话建立后立即从活动引用中释放。

### 4.4 `lib/replay-navigation.mjs`：唯一导航入口，目标 100–180 行

接管当前 590、651–660 以及登录内部的首次/提交后导航。对生产回放范围，裸 `page.goto` 必须归零。

建议入口：

```js
navigateReplayPage({ page, executionBootstrap, destination, phase, stop }) -> {
  ok,
  reason
}
```

职责：

- 只接受真实 execution authority；
- 用 authority 投影完整 pathname、query、hash；
- `goto` 后读取 `page.url()` 并严格核验浏览器可见来源；
- 错配固定为 `NAVIGATION_ORIGIN_MISMATCH`，不含任何地址；
- 错配时只调用一次幂等 `stop`，禁止继续登录、动作或观察；
- 同来源内路径、查询和片段变化仍允许。

`loginBootstrap` 应改为接收注入的 `navigate`，并保证首次来源核验发生在任何账号或密码 fill 之前，提交后再核验一次。不能给 `loginBootstrap` 一个可自行拼 URL 的字符串后门。

### 4.5 `lib/replay-video-lifecycle.mjs`：录像资源所有者，目标 120–200 行

从当前 88–102、500–538 的录像部分、924–953 和异常清扫搬入：

```js
createVideoLifecycle({ videoDir, now, fsAdapter }) -> {
  contextOptions,
  markReplayPage(page),
  markLoginPage(page),
  finalize(context),
  cleanup(browser)
}
```

该对象独占录像目录状态，替代模块级 `activeBrowser` 与 `videoSweepDir`。`cleanup` 幂等，可被看门狗、登录失败、凭据门失败和最终 catch 重复调用。登录镜头删除失败仍 exit 1；回放镜头收敛失败仍是干净缺席；只有完整成功路径保留 `video.webm`。

### 4.6 `lib/replay-browser-session.mjs`：浏览器与登录会话，目标 240–340 行

从当前 495–602 搬入：

- launch、context/page 和 CDP；
- 录像双页舞步与 `sessionStorage` 内存续接；
- pageerror、guard abort 和 forensics 接线；
- 单页或双页登录；
- 登录流量截断点 `loginMark`。

建议入口：

```js
openReplaySession({
  executionBootstrap,
  profile,
  identityRuntime,
  videoLifecycle,
  navigation,
  log
}) -> replaySession
```

`replaySession` 暴露 `page`、`forensics`、共享 `attributionState`、安全诊断数组、`loginMark` 和幂等 `close`。凭据在函数内部消费，不出现在返回对象。`attributionState` 必须是同一个对象引用，forensics 回调与事件运行器都引用它，禁止 clone 或 spread。

### 4.7 `lib/replay-event-runner.mjs`：事件编排，目标 300–450 行

从当前 604–922 搬入事件循环、Map 初始化和最终 stream settle/drain。保留以下严格顺序：

1. `currentStepId = null`；
2. 未知 atom（原子操作）拒绝；
3. nav 或上下文恢复；
4. intent 首步基线；
5. 动作因果窗开启；
6. 身份事务武装和破坏性出站守卫；
7. 动作、直接响应和流稳定；
8. `finally` 解除 route；
9. `currentStepId = null`；
10. 代表步静默和同刻观察；
11. 回放历史采样；
12. 循环外 settle streams 和 drain。

建议入口：

```js
runReplayEvents({ session, runPlan, identityRuntime, navigation, log, timing }) -> evidenceBundle
```

`evidenceBundle` 只含投影前证据 Map、历史行、时间指标和录像步偏移；不得包含 page、browser、凭据或 execution authority。异常不能被改写成动作成功。

破坏性动作段可以先保留在本模块。若机械搬移后超过 520 行，再把当前 687–782 原样抽成 `lib/replay-action-scope.mjs`，其输入为单步、page、forensics、identityRuntime 和共享诊断数组，输出动作轴及等待耗时。必须保留 `guardTeardown` 的 `finally`。

### 4.8 `lib/replay-observation-capture.mjs`：代表步同刻观察，目标 180–280 行

从当前 785–910 搬入：

- 有界静默；
- URL path、计数、input readback；
- target-ID absence proof；
- toast、正文、按钮状态和回复正文采集。

建议入口：

```js
captureRepresentativeObservation({
  page,
  event,
  runPlan,
  evidence,
  forensics,
  identityRuntime,
  log,
  timing
}) -> { settled, quietWaitMs }
```

所有采集失败继续遵循现有 fail-safe：证不出时缺值或 `undefined`，不能把异常折成 0、absent 或成功。该模块只收集事实，不 import verdict，不写 `passes`。

### 4.9 `lib/replay-history.mjs`：纯历史投影，目标 80–140 行

搬入当前 104–150 的常量和 `historyLine`，并接收显式 `now` 或已算好的 duration。保持 JSONL 字段、`NAVIGATION_FAILED`、locator resolution（定位解析结果）和 quiet point（静默点）口径不变。

### 4.10 `lib/replay-artifact-finalizer.mjs`：投影与落盘收口，目标 180–280 行

从当前 955–1043 搬入：

- 登录流量切片；
- guard abort 因果 pageerror 排除；
- `projectReplayAxes`；
- axes、回放历史、运行指标和录像元数据凭据门；
- 成功产物写入。

建议入口：

```js
finalizeReplayArtifacts({
  artifactPlan,
  runPlan,
  evidenceBundle,
  sessionEvidence,
  videoResult,
  startedAt,
  now,
  log
}) -> { ok, reason, exitCode }
```

第一阶段必须保持当前写入顺序：axes 可能先于后续诊断件写出。把它改成全产物单次门和原子提交是单独行为变更，需另立验收，不得借拆分暗改。每类文本仍在写入前过 `credentialGate`；录像元数据仍有 `://` 零容忍；guard abort 仍只做减法排除和诊断，不进入 axes。

## 5. 不可漂移的权威和裁定边界

| 边界 | 唯一所有者 | 允许流向 | 禁止 |
| --- | --- | --- | --- |
| execution authority | `replay-target-bootstrap` / `replay-navigation` | 以不透明引用交给 session 和导航 | 序列化、spread、日志、产物、壳内拼地址 |
| 凭据 | target bootstrap 内的一次性登录材料 | 只交 `replay-browser-session` 内部登录 | 返回到 run plan/evidence、日志、异常 message |
| frozen identity authority | `replay-cli-preflight` | 只交 event runner 的身份事务 | 公开 receipt、JSON、跨 run 复用 |
| destructive continuity Map | preflight 创建，event runner 消费 | 同进程、同 run、按 stepId | 按 intent 猜测、缺 ref 时裸执行破坏动作 |
| `currentStepId` | event runner | session forensics 回调只读同一引用 | clone、跨导航恢复期保持非 null |
| 事实采集 | observation capture | artifact finalizer | 直接产 verdict、把未知折成通过 |
| verdict | 现有确定性裁判 | 后续独立阶段 | replay 新模块 import 或调用 LLM |
| 文件写入 | artifact finalizer | 过凭据门的目标文件 | helper 旁路写日志/调试件 |
| 退出码 | `bin/replay.mjs` | 闭集 `ReplayAbort` 映射 | 下层 `process.exit`、原始异常回显 |

## 6. 实施顺序

1. 先加结构门：所有本契约新增和修改文件 `wc -l <= 600`，`bin/replay.mjs <= 600`；再写静态接线 RED。
2. 抽纯 `replay-history` 与 `replay-observation-capture`，做字节级 axes/历史差分。
3. 抽 `replay-video-lifecycle` 和 `replay-artifact-finalizer`，保持写入顺序与退出码。
4. 抽 `replay-cli-preflight`，机械保持所有 browser 前门的相对顺序。
5. 抽 target bootstrap、browser session 和唯一导航接缝；此步同时关闭来源错配 Critical。
6. 最后压薄事件运行器和壳；删除所有生产裸 `page.goto` 与模块级浏览器/录像全局状态。
7. 复跑冻结门并进行四类真实环境在场验收；只有真实回放与确定性裁定能声明通过。

每一步单独提交或至少单独保留可逆差异，不跨两类权威边界做混合重构。

## 7. 必跑门禁

### 7.1 零浏览器、零被测系统门

- `cross-platform-execution-target-core.zero-sut.golden.mjs`
- `cross-platform-execution-target-runtime.zero-sut.golden.mjs`
- `cross-platform-execution-target-boundaries.static.golden.mjs`
- `cross-platform-execution-target-adjacent-regression.zero-sut.golden.mjs`
- `output-seal-b5-prelaunch.zero-sut.golden.mjs`
- `p5-replay-coverage.golden.mjs`
- `replay-entity-anchor.zero-sut.golden.mjs`
- `entity-destructive-continuity-guard.round2/round3/round4/wiring/failclosed-replay`
- `run-history`、`replay-video`、`replay-settle-mount` 的 `units/*zero-sut*` 后继门
- `real-run-trust.zero-sut.golden.mjs`
- `workflow-delete-spec-preflight.static.golden.mjs`

静态测试当前有多处直接咬 `bin/replay.mjs` 的源码形状。实施时必须把断言迁到新生产模块并同时检查壳的真实交接，不能删除断言或把字符串存在当接线完成。

### 7.2 需要真实浏览器或现役验收环境的 owner 门

下列门在允许的真实环境中复跑，本设计阶段不启动：

- `p5-replay.golden.mjs`
- `replay-login-bootstrap.golden.mjs`
- `replay-video.golden.mjs`
- `video-login-carry.golden.mjs`
- `replay-settle-mount.golden.mjs`
- `run-history.golden.mjs`
- `p2-forensics.golden.mjs` 与 `p2-forensics-coverage.golden.mjs`
- `agent-id-readback.chat-sut.golden.mjs`
- 与工作流、智能体、聊天场景关联的现役端到端门

还需在 Windows、原生 Linux、macOS、WSL 分别验证 direct/legacy/proxy 适用分支；AI 中台频繁更新场景必须覆盖正常页内导航、跨来源重定向、popup/new tab（弹窗/新标签页）和掉登录。医生站与 Hi 小助 CEF 不能由 AI 中台结果外推。

## 8. 验收判据

- 壳与全部 touched file（本次触碰文件）逐个不超过 600 行；
- 三入口真实调用 authority-consuming 导航，不再以 import 存在冒充接线；
- 错误来源在填凭据或动作前停止，关闭一次，稳定拒因不含地址；
- 预启动拒绝时 launch、goto、产物写入均为零；
- 同一冻结输入的 axes、历史、指标和录像元数据保持字节一致；
- 当前四态裁定、exit code、登录流量切片、动作归因、守卫解除和录像卫生语义不变；
- 所有声明通过均来自真实回放、`verdict.json` 和用户验收，文件存在或静态门通过不能替代。

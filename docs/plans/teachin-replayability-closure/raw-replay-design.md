# Teach-in raw source fresh replay：最小冻结设计

## 1. 目标与边界

本设计只闭合一件事：人工示教生成的原始 `teach-in-capture.json`，在录制窗口和录制
Browser/BrowserContext 已关闭后，能否在另一套 fresh Browser + fresh BrowserContext 中按原事件顺序
确定性复现。

`CLEAN` 只表示「原始动作已在 fresh runtime 中全部复现」，不是测试结论，不进入
`bin/verdict.mjs`，也不产生正式报告。原始 capture 继续保持：

```json
{
  "source": {
    "signed": false,
    "replayReady": false,
    "distillRequired": true
  }
}
```

第一版只允许 `effect=read` 且 `persistentMutation=false` 的示教链；“幂等”不构成写操作准入理由。
不做 LLM 修正，不使用坐标兜底，不修改 capture，不用导航纠偏错误路径，
也不把 raw proof 当正式 intake、签署或 replay 的替代品。

## 2. 冻结模块与行数预算

| 文件 | 单一职责 | 预算 |
|---|---|---:|
| `lib/teachin/fresh-runtime.mjs` | 观察旧 runtime 生命周期，以真实对象身份铸造一次性 fresh authority | ≤ 220 行 |
| `lib/teachin/raw-capture.mjs` | exact bytes capture 准入与全包预检 | ≤ 260 行 |
| `lib/teachin/raw-action.mjs` | 固定 raw event 投影与 resolve/perform 确定性动作边界 | ≤ 180 行 |
| `lib/teachin/raw-replay-runner.mjs` | admission 编排边界、raw replay 与首错停止 | ≤ 420 行 |
| `lib/teachin/raw-proof.mjs` | CLEAN proof authority 铸造与 exact bytes 一次性消费 | ≤ 180 行 |
| `lib/teachin/raw-proof-output.mjs` | 复用现役 atomic output helper，凭据门后原子落 proof | ≤ 120 行 |
| `lib/teachin/replayability-cycle-entry.mjs` | 同进程 admission→source prepare→full-cycle façade | ≤ 220 行 |
| `bin/teachin-raw-replay.mjs` | 最终字节读取、fresh runtime 启动、同 login mode 接线、安全落盘 | ≤ 250 行 |
| `bin/record.mjs` | login-bootstrap handoff；转移后 finally 禁止二次 close | 实施后仍须 < 600 行 |

不得新增超过 600 行的生产文件。固定的 raw event → generic replay event 投影与
resolve/perform 门必须留在 `lib/teachin/raw-action.mjs`，不得回并 runner 或堆进 CLI。

核心模块不得依赖文件系统、网络、LLM、`verdict` 或 report。I/O、Playwright 启动和 login bootstrap
只在 CLI/现有 adapter 层。

## 3. 最小冻结 API

### 3.1 Fresh runtime authority

```js
createFreshReplayWitness({
  recordingBrowser,
  recordingContext,
})
// -> { ok: true, witness }
// -> { ok: false, reason }

authorizeFreshReplayRuntime({
  witness,
  replayBrowser,
  replayContext,
  replayPage,
  topologyAuthority,
})
// -> {
//   ok: true,
//   freshRuntimeAuthority,
//   receipt: {
//     schemaVersion: 1,
//     lifecycle: "recording-closed/replay-new",
//     valuePersistence: "memory-only"
//   }
// }
// -> { ok: false, reason }

consumeFreshReplayRuntimeAuthority({
  freshRuntimeAuthority,
  topologyAuthority,
})
// -> { ok: true }
// -> { ok: false, reason }
```

`createFreshReplayWitness` 必须在录制 runtime 关闭前调用，并立即安装：

- recording Browser 的 `disconnected` listener；
- recording BrowserContext 的 `close` listener。

`authorizeFreshReplayRuntime` 只能在两个真实 lifecycle 事件均已被 witness 观察后铸权，并同时验证：

1. `replayBrowser !== recordingBrowser`；
2. `replayContext !== recordingContext`；
3. `replayContext.browser() === replayBrowser`；
4. `replayPage.context() === replayContext`；
5. replay Browser 当前仍为 connected；
6. authority 绑定传入的 `topologyAuthority` 精确对象身份；
7. 同一 replay Browser/Context/Page 三层对象从未成功铸造过其它 fresh authority。

authority 必须是冻结空对象，以模块私有 `WeakMap` 持有事实；clone、spread、JSON 往返、手造空对象均无效。
authority 一次性消费。不得接受 `fresh:true`、`freshBrowser:true`、`freshContext:true`、时间戳或随机 ID
作为 fresh 证据。对象身份但没有旧 runtime lifecycle 关闭证据，同样不得铸权。

成功铸权时还必须在模块私有 `WeakSet` 分别登记 replay Browser/Context/Page。任一对象已登记时，后续即使
换成另一枚真实 closed witness，也必须以 `REPLAY_RUNTIME_REUSED` 拒绝且不铸第二枚 authority。该门保证
source raw replay 与 distilled replay 不能复用同一 runtime 只换 token。

持久化 proof 中的 `source.kind` 只是公开说明，不是 fresh authority。若未来要求跨进程消费 fresh 事实，
必须接既有签名 driver receipt；不得把持久化布尔字段升级成权威。

### 3.2 Capture 与 raw replay

```js
admitRawReplayCapture({
  caseId,
  captureBytes,
})
// -> {
//   ok: true,
//   captureAuthority,
//   captureSha256: "sha256:<64hex>",
//   eventCount
// }
// -> { ok: false, reason, failedSeq? }

inspectAdmittedRawReplayCapture({
  captureAuthority,
})
// -> { ok:true, captureBytes, capture, captureSha256 }
// -> { ok:false, reason:"RAW_CAPTURE_AUTHORITY_INVALID" }

projectRawReplayAction(event)
// click/dblclick:
// -> { ok:true, kind:"action", actionRequest:{ action, fallbackCss } }
// fill:
// -> { ok:true, kind:"action", actionRequest:{ action, fallbackCss, value } }
// press:
// -> { ok:true, kind:"action", actionRequest:{ action, fallbackCss, key } }
// nav/newpage:
// -> { ok:true, kind:"control", controlAction }
// invalid:
// -> { ok:false, reason:"RAW_ACTION_INVALID" }

runRawReplay({
  captureAuthority,
  freshRuntimeAuthority,
  topologyAuthority,
  executionTargetAuthority,
  actionDriver,
})
// CLEAN:
// -> {
//   ok: true,
//   status: "CLEAN",
//   proof,
//   cleanProofAuthority
// }
// 首错：
// -> {
//   ok: false,
//   status: "FAILED",
//   reason,
//   proof
// }

admitAndRunRawReplay({
  caseId,
  captureBytes,
  freshRuntimeFactory,
  topologyAuthority,
  executionTargetAuthority,
  actionDriver,
})
// admission 失败：原样返回 { ok:false, reason }，freshRuntimeFactory 与全部 driver 调用为 0
// admission 成功：freshRuntimeFactory({ topologyAuthority }) -> genuine freshRuntimeAuthority
//                 再委托 runRawReplay

consumeCleanRawReplay({
  cleanProofAuthority,
  currentCaptureBytes,
})
// -> { ok: true, captureSha256 }
// -> { ok: false, reason }

inspectCleanRawReplayAuthority({
  cleanProofAuthority,
})
// -> { ok: true, captureSha256 }
// -> { ok: false, reason: "CLEAN_PROOF_AUTHORITY_INVALID" }

createRawProofOutputWriter({
  credentialGate,
  atomicWriteFileSync,
})
// -> { writeRawReplayProof({outputPath,proofBytes}) }

writeRawReplayProof({
  outputPath,
  proofBytes,
})
// -> {ok:true}
// -> {ok:false,reason:"RAW_PROOF_OUTPUT_REJECTED"|"RAW_PROOF_WRITE_FAILED"}
```

`admitRawReplayCapture` 复制调用方传入的最终 bytes，再从同一份不可变副本计算 hash、解析 JSON 和执行
全包预检。hash 口径冻结为：

```text
sha256:<原始最终 bytes 的 64 位小写十六进制摘要>
```

不得通过 `JSON.parse` 后重序列化的字节算 hash。proof、`captureAuthority` 和后续
`cleanProofAuthority` 均绑定该 exact bytes hash。

`captureAuthority` 是 opaque 多读 capability，不是一次性 token。模块私有事实保存 admission 时复制的
exact bytes 与闭合 capture；`inspectAdmittedRawReplayCapture` 每次都返回新的 `captureBytes` Buffer 和
新的深拷贝 capture document。合法 authority 可被 raw runner、resolved projection 等同进程消费者多次
inspect；clone、spread、序列化或手造对象统一拒 `RAW_CAPTURE_AUTHORITY_INVALID`。`runRawReplay` 只
inspect，不消费或撤销 capture authority；一次性的只有 fresh、clean、reset 与 run authority。

`consumeCleanRawReplay` 必须重新对当前 capture 最终 bytes 算 hash，并与 authority 内事实精确匹配；
换一个字段、空白、换行或键序都属于换包。持久化 proof 文件不能自行重建 `cleanProofAuthority`。
development-only full-cycle 只能由 `record` 同进程 application service 消费此 authority；
`teachin-cycle` 只可薄别名 dispatch 到该进程，plain JSON/跨进程重建 capability 一律无权。

`inspectCleanRawReplayAuthority` 只在同一模块的私有 authority 表中做非消费式真实性检查，并只返回
`captureSha256`；它不返回 capture bytes，也不把 authority 变成可序列化收据。dual completion 用它
拒绝 injected issuer 手造的 plain/clone proof，resolved projection 随后仍须通过
`consumeCleanRawReplay` 原子消费同一个 genuine authority。两者不能互相替代。

resolved projection 必须先用 `inspectAdmittedRawReplayCapture` 取得该 authority 对应的深拷贝
`captureBytes`，再把这些 exact bytes 传给 `consumeCleanRawReplay`；不得要求 runner 之后重新 admission，
也不得从调用方另收一份未绑定 bytes。

`admitAndRunRawReplay` 只供独立 raw 诊断入口。它必须先同步完成 exact bytes 全包准入；
失败时不得调用 `freshRuntimeFactory`、`actionDriver.readActivePath`、`actionDriver.resolve` 或
`actionDriver.perform`。只有取得 `captureAuthority` 后才允许创建 fresh runtime，再由 `runRawReplay`
在读取任何页面状态前一次性消费 genuine `freshRuntimeAuthority`。消费发生在 run 入口：后续即使因 path、
selector、action 或 topology 失败，也不得退还 authority 或允许同 runtime 重试。

## 4. 全包预检与 reason 顺序

所有事件必须在启动 fresh Browser 前完成预检。后面的 sensitive/masked evidence 或畸形 topology
也必须令前面的合法 click 零执行。

同一输入同时命中多个问题时，reason 按下表从上到下取第一项；实施不得随意调整顺序。

| 优先级 | 检查 | reason |
|---:|---|---|
| 1 | options、bytes、plain-data 快照失败 | `RAW_CAPTURE_INPUT_INVALID` |
| 2 | JSON、artifactKind、schema、source 降权标志或闭合形状非法 | `RAW_CAPTURE_INVALID` |
| 3 | capture caseId 与调用 caseId 不全等 | `CAPTURE_CASE_MISMATCH` |
| 4 | events 缺失或为空 | `CAPTURE_EVENTS_EMPTY` |
| 5 | 任一 seq 不是正安全整数 | `CAPTURE_SEQ_INVALID` |
| 6 | 任意两个事件 seq 相同 | `CAPTURE_SEQ_DUPLICATE` |
| 7 | seq 不严格等于数组位置 `index + 1`，含跳号和乱序 | `CAPTURE_SEQ_GAP` |
| 8 | startPath 或任一 event.path 不是 host-free path+query | `CAPTURE_PATH_INVALID` |
| 9 | 任一 action 携 `valueMasked:true`、`value:"<redacted>"`，或命中现役 `isSensitiveField(event)` | `MASKED_FILL_UNREPLAYABLE` |
| 10 | fill 缺可复现的 string value | `FILL_VALUE_UNAVAILABLE` |
| 11 | click/dblclick/fill/press 缺非空 selector；x/y/ox/oy 坐标不能补足 | `SELECTOR_UNAVAILABLE` |
| 12 | newpage 序列不满足现役 topology 约束 | 保留 `normalizeTopologySequence` 的 `TOPOLOGY_*` / `PAGE_HANDOFF_AMBIGUOUS` |

其中 `CAPTURE_CASE_MISMATCH` 以 plan/golden 为准，禁止重新引入旧拼法。下列 design 已冻结的
稳定 reason 已同步进 plan；实现不得静默折叠或另起别名：

- `RAW_CAPTURE_INPUT_INVALID`
- `CAPTURE_EVENTS_EMPTY`
- `CAPTURE_PATH_INVALID`
- `FILL_VALUE_UNAVAILABLE`

`MASKED_FILL_UNREPLAYABLE` 保留既有 reason 字面以兼容 plan，但其语义冻结为证据级整包拒绝，
绝不只检查 fill：click、dblclick、press、nav、newpage 或后续新增 action 只要携 masked marker、
规范遮蔽值或敏感字段元数据，均不得铸 `captureAuthority`。此拒绝发生在任何 runtime/scheduling 之前：
不启动 fresh Browser、不读取页面、不执行任何先前事件、不进入 raw replay/projection、不产
`cleanProofAuthority`。不得把 `<redacted>` 当真实输入值或目标内容使用，也不得让 LLM 猜测原值。

selector 要求同样在 admission 阶段闭合。即使 click/dblclick 同时携完整 x/y/ox/oy，缺 selector 仍必须
返回 `SELECTOR_UNAVAILABLE`；坐标只可保留为录制证据，不能成为 raw replay 或 projection 的隐式定位器。

## 5. Fresh 启动和路径规则

### 5.1 Fresh 启动

录制侧顺序冻结为：

```text
安装 recording lifecycle witness
→ 完成人工录制
→ drain binding/page topology
→ 写 capture 最终 bytes
→ admitRawReplayCapture 全包预检
→ close recording context/browser
→ witness 观察 close + disconnected
→ 重新 chromium.launch
→ 重新 browser.newContext
→ 沿用同一 login mode 建立 fresh 初始页
→ 建 topologyAuthority
→ authorizeFreshReplayRuntime
→ 只由 full-cycle core 调 runRawReplay 恰一次
```

首发 full-cycle 的 `--login-bootstrap` 必须在 fresh Browser 中重新登录；`--no-login`
仍只完成 capture，不启动 source/distilled、不声称闭环。不得复制 context 或同 Browser 换 Context 冒充 fresh。

### 5.2 Path checkpoint，零 goto 修正

`runRawReplay` 对每个事件先通过 active page authority 读取当前 host-free pathname+search，并与
`event.path` 逐字比较：

- 当前 path 读不到：`PATH_CHECKPOINT_UNAVAILABLE`；
- 当前 path 不全等：`PATH_CHECKPOINT_MISMATCH`；
- path 相等才可继续。

`nav` 是纯 checkpoint：

- path 相等即记本事件已复现；
- path 不等立即失败；
- 无论正负分支都不得调用 `page.goto`、`requireReplayNavigation` 或任何导航修正 callback。

fresh runtime 的一次初始进入由现役 execution-target guarded navigation 在 raw loop 之前完成；该初始
进入不是 capture nav 事件的纠偏权限。

## 6. 动作与首错停止

raw event 只作以下固定投影，不进入 LLM：

```text
event.selector -> generic replay event.fallbackCss
event.value    -> fill value
event.key      -> press key
```

`projectRawReplayAction` 的成功与失败结果都必须是 exact-key 闭合冻结对象。录制包已登记的
`text/tagName/fieldLabel/x/y/ox/oy` 等采集证据允许出现在输入，但必须从 `actionRequest`
剥离；未知 action、缺 selector/value/key 或额外未登记字段统一拒 `RAW_ACTION_INVALID`。

不接受坐标、截图、文本相似度或全页 first 作为 fallback。pure-coordinate click/dblclick 已在
capture admission 阶段拒绝，不能到本层再把坐标变成 selector。复用现役 generic replay identity
gate，但冻结为两个可观测阶段，禁止 `resolve+click` 合并：

```js
actionDriver.resolve({
  event, // projectRawReplayAction 返回的 exact actionRequest；保留现役 adapter 参数名
  topologyAuthority,
  executionTargetAuthority,
})
// -> { resolution:"none", candidateCount:0 }
// -> { resolution:"ambiguous", candidateCount:N }
// -> { resolution:"unique", candidateCount:1, actionAuthority }

actionDriver.perform({
  actionAuthority,
  topologyAuthority,
  executionTargetAuthority,
})
// -> { ok:true, identityReadback:{ ok:true } }
// -> { ok:false, reason:"ACTION_FAILED", identityReadback? }
```

`resolve` 只能读取 locator/count/identity，不得产生页面动作。只有 `candidateCount === 1` 时才允许返回
opaque 一次性 `actionAuthority`；`perform` 只消费该 authority 并产生真实动作。runner 处理规则：

| 解析/动作结果 | raw replay 处理 |
|---|---|
| `resolution:"unique"` 且 `candidateCount:1`，随后 perform/readback 成功 | 记 `REPRODUCED`，进入下一事件 |
| `candidateCount:0` / `resolution:"none"` | `SELECTOR_NONE`，`perform` spy=0，立即停止 |
| `candidateCount>1` / `resolution:"ambiguous"` | `SELECTOR_AMBIGUOUS`，`perform` spy=0，立即停止 |
| `resolution:"unique"` 但 count 非 1 或缺 genuine `actionAuthority` | 按 count 映射 none/ambiguous，`perform` spy=0 |
| perform 抛出、回读失败或 `{ ok:false }` | `ACTION_FAILED`，立即停止 |
| resolve 形状未知或未分类异常 | `RAW_REPLAY_INTERNAL_ERROR`，立即停止 |

第一条失败之后，后续事件必须满足：

- path reader 零调用；
- locator resolver 零调用；
- page action 零调用；
- topology consumer 零调用；
- proof 中不出现后续步骤。

## 7. Newpage topology

capture 的 `newpage` 保留结构事件，不降成普通 click，也不单独解析 selector：

1. 全包预检使用现役 `normalizeTopologySequence({ format:"capture" })`，拒 orphan、连续 newpage、
   非 click/dblclick trigger 和同一 trigger 多 handoff；
2. 前一 click/dblclick 通过现役 page topology controller 执行，0/1/>1 page、opener、同 origin
   session continuity 继续由 controller 裁定；
3. 随后的 newpage 通过现役 `consumeNewPageAction` 消费；
4. newpage path 必须与当前 active page 的 host-free path+query 全等；
5. 成功后只沿 controller 返回的 opaque active page authority 继续；
6. popup 缺失、多个 popup、错误 opener、cross-origin、错误 path 或 stale authority 均首错停止，
   保留现役稳定 reason，例如：
   `TOPOLOGY_PATH_MISMATCH`、`PAGE_HANDOFF_AMBIGUOUS`、
   `OPENER_AUTHORITY_MISMATCH`、`AUTH_CONTINUITY_UNAVAILABLE`。

不得用 `context.pages().first()/last()` 猜活动页，也不得在 topology 失败后回旧 page 继续执行。

## 8. Runtime reason 顺序

进入 `runRawReplay` 后，同一阶段多错时按下列顺序取第一项：

| 优先级 | 检查 | reason |
|---:|---|---|
| 1 | capture authority 伪造或 clone | `RAW_CAPTURE_AUTHORITY_INVALID` |
| 2 | fresh witness/authority 伪造、clone 或已消费 | `FRESH_RUNTIME_AUTHORITY_INVALID` |
| 3 | witness 未观察旧 context close + browser disconnected | `RECORDING_RUNTIME_NOT_CLOSED` |
| 4 | replay browser/context 与 recording 对象复用 | `REPLAY_RUNTIME_NOT_FRESH` |
| 5 | replay Browser/Context/Page 任一对象已成功用于其它 authority | `REPLAY_RUNTIME_REUSED` |
| 6 | context.browser、page.context 或 topologyAuthority 身份不一致 | `REPLAY_RUNTIME_OWNERSHIP_MISMATCH` |
| 7 | replay Browser 已断开或 page/context 已关闭 | `REPLAY_RUNTIME_NOT_LIVE` |
| 8 | active path 读取失败 | `PATH_CHECKPOINT_UNAVAILABLE` |
| 9 | active path 与 event.path 不等 | `PATH_CHECKPOINT_MISMATCH` |
| 10 | topology 消费失败 | 保留现役 topology reason |
| 11 | selector count 为 0 | `SELECTOR_NONE` |
| 12 | selector count 大于 1 | `SELECTOR_AMBIGUOUS` |
| 13 | 唯一候选动作失败 | `ACTION_FAILED` |
| 14 | 未分类异常 | `RAW_REPLAY_INTERNAL_ERROR` |

`consumeCleanRawReplay` 单独冻结：

- authority 无效或重放：`CLEAN_PROOF_AUTHORITY_INVALID`；
- 当前 capture exact bytes 不同：`CAPTURE_HASH_MISMATCH`。

`inspectCleanRawReplayAuthority` 对 plain、clone、未知或已经消费的 authority 均固定返回
`CLEAN_PROOF_AUTHORITY_INVALID`，且不得改变一次性消费状态。

## 9. Proof：复现证明，不是 verdict

公开 proof 闭合形状：

```json
{
  "schemaVersion": 1,
  "artifactKind": "teach-in-raw-replay-proof",
  "caseId": "tc_example",
  "captureSha256": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "developmentOnly": true,
  "promotionReady": false,
  "source": {
    "kind": "fresh-browser-reproduction"
  },
  "status": "CLEAN",
  "totalEvents": 2,
  "consumedEvents": 2,
  "steps": [
    {
      "seq": 1,
      "action": "click",
      "outcome": "REPRODUCED"
    },
    {
      "seq": 2,
      "action": "newpage",
      "outcome": "REPRODUCED"
    }
  ]
}
```

FAILED proof 只保留成功前缀和第一条失败：

```json
{
  "seq": 2,
  "action": "click",
  "outcome": "FAILED",
  "reason": "SELECTOR_NONE"
}
```

公开 proof 不得包含：

- `PASS` 或任何正式四态结论；
- 名称或值中含 `verdict` 的字段；
- selector、value、text、fieldLabel、页面自由文本；
- `://`、host、origin、绝对 URL；
- Browser/Context/Page ID、opaque authority 或可用于重建 authority 的事实；
- LLM 建议、自动修复内容或变更后的 spec。

`status:"CLEAN"` 只在 `consumedEvents === totalEvents` 且没有 failure 时成立。FAILED proof 不铸
`cleanProofAuthority`。canonical writer 静态绑定现役凭据门与 `atomicWriteFileSync`；工厂只供
zero-SUT 注入，CLI 不接 writer/provider。proof 写失败不得留半份。

逐 event observation 必须由同一次 `runRawReplay` 的 observer 在动作前后采集并与 capture/run/full
seq 绑定；CLEAN 后才能 seal。raw CLEAN 本身不产 axes/verdict，后续两相 source completion 的
唯一契约见 `runtime-seams-design.md`。

## 10. Golden acceptance matrix

### G1 `teachin-replayability-capture-fresh.zero-sut.golden.mjs`

| 编号 | 场景 | 冻结结果 |
|---|---|---|
| A1 | exact bytes、seq=1..N、合法 path；同 authority inspect 两次 | hash 对最终 bytes；两次均成功且 bytes/document 为逐次深拷贝，clone/forge 拒 |
| A2 | 只改一个空白、换行、键序或字段 | CLEAN 消费拒 `CAPTURE_HASH_MISMATCH` |
| A3 | seq 非整数/0/负数 | `CAPTURE_SEQ_INVALID` |
| A4 | seq `[1,1]` | `CAPTURE_SEQ_DUPLICATE` |
| A5 | seq `[1,3]` 或 `[2,1]` | `CAPTURE_SEQ_GAP` |
| A6 | `[合法 click, 任意 action 携 valueMasked/<redacted>/敏感字段元数据]` | `MASKED_FILL_UNREPLAYABLE`，freshFactory/path/resolve/perform 全 0 |
| A7 | `[合法 click, 尾部 click/dblclick 只有坐标、无 selector]` | `SELECTOR_UNAVAILABLE`，freshFactory/path/resolve/perform 全 0 |
| A8 | orphan/连续 newpage | topology reason，runtime spy 全 0 |
| A9 | capture source flags | 始终 `signed:false/replayReady:false/distillRequired:true` |

同一文件继续冻结 fresh runtime：

| 编号 | 场景 | 冻结结果 |
|---|---|---|
| F1 | `{fresh:true}`、空对象、clone、spread | authority invalid |
| F2 | lifecycle listener 安装前/未观察 close 与 disconnected | `RECORDING_RUNTIME_NOT_CLOSED` |
| F3 | 只换 context、复用 Browser | `REPLAY_RUNTIME_NOT_FRESH` |
| F4 | context.browser/page.context/topologyAuthority 任一错配 | `REPLAY_RUNTIME_OWNERSHIP_MISMATCH` |
| F5 | fresh Browser + context + page + topology 正确归属，随后 authority 重放 | 首次消费成功；重放 `FRESH_RUNTIME_AUTHORITY_INVALID` |
| F6 | 换真实 witness 但复用同一 replay Browser/Context/Page | `REPLAY_RUNTIME_REUSED`，不铸第二枚 authority |

### G2 `teachin-replayability-raw-runner.zero-sut.golden.mjs`

| 编号 | 场景 | 冻结结果 |
|---|---|---|
| P0 | runner 收 plain/clone/已消费 fresh authority；或 genuine run 失败后重放；runner 后再 inspect capture | fresh 重放拒且第二次 path/resolve/perform 全 0；capture inspect 仍成功 |
| P1 | 当前 path 与 click path 全等，selector count=1 | resolve 一次、perform 一次，`REPRODUCED` |
| P2 | path mismatch | `PATH_CHECKPOINT_MISMATCH`，locator/action 为 0 |
| P3 | nav path 正确 | 仅 checkpoint，goto spy=0 |
| P4 | nav path 错误 | 首错失败，goto spy=0 |
| P5 | selector count=0 | `SELECTOR_NONE`，perform spy=0 |
| P6 | selector count=2，含伪报 `resolution:"unique"` | `SELECTOR_AMBIGUOUS`，perform spy=0 |
| P7 | 唯一候选动作抛错/回读失败 | `ACTION_FAILED` |
| P8 | 第 2 步失败且有第 3 步 | 第 3 步 path/locator/action spy 全 0 |

同一 `teachin-replayability-raw-runner.zero-sut.golden.mjs` 继续冻结 topology：

| 编号 | 场景 | 冻结结果 |
|---|---|---|
| T1 | click → 单一同源 popup → newpage path 匹配 | active authority 切换，两事件均 `REPRODUCED` |
| T2 | click 后无 popup，但 capture 有 newpage | topology path/active 校验失败，立即停止 |
| T3 | popup path 错 | `TOPOLOGY_PATH_MISMATCH` |
| T4 | 同一 click 出现多个 popup | `PAGE_HANDOFF_AMBIGUOUS`，不任选 |
| T5 | cross-origin popup | `AUTH_CONTINUITY_UNAVAILABLE` |
| T6 | orphan/连续 newpage | 全包预检失败，runtime spy 全 0 |
| T7 | popup close 后 stale authority | 具名拒绝，不回 opener 猜测继续 |

同一文件继续冻结 proof：

| 编号 | 场景 | 冻结结果 |
|---|---|---|
| E1 | 全 N 事件成功 | CLEAN、`consumedEvents=N`、恰铸 clean authority |
| E2 | 第 k 步失败 | FAILED、proof 只到 k、无 clean authority |
| E3 | plain proof/JSON 往返/clone 尝试进入 cycle | `CLEAN_PROOF_AUTHORITY_INVALID` |
| E4 | CLEAN 后换 capture bytes | `CAPTURE_HASH_MISMATCH` |
| E5 | proof 全文安全扫描 | 无正式结论、裁定字段、`://`、测试 host、selector/value/text |
| E6 | proof 写盘失败 | 委托 `raw-proof-output` → 现役 `atomicWriteFileSync`；稳定拒且无半份文件 |

### G3 `teachin-replayability-raw-actions.zero-sut.golden.mjs`

1. click/dblclick/fill/press 的 `actionRequest` exact shape、冻结与值/key 不交换；
2. nav/newpage 只投影为 control；
3. 已登记采集证据被剥离，未知 action、缺字段或未登记字段具名拒绝；
4. runner 按四个业务动作逐一 `resolve → perform`，没有合并身份门；
5. fresh 公开诊断 receipt 只有固定三键，不含 timestamp/session/origin/id/fresh 布尔自报。

### G4 `teachin-replayability-raw-output-seal.zero-sut.golden.mjs`

1. safe proof exact bytes 经 `raw-proof-output` 原子落盘；
2. 凭据门拒绝发生在写调用前，稳定 `RAW_PROOF_OUTPUT_REJECTED`；
3. rename 目标非法时稳定 `RAW_PROOF_WRITE_FAILED`，原目标不变且无 sidecar；
4. 模块静态复用现役 `atomicWriteFileSync`，CLI 只调用 canonical writer。

### G5 `teachin-replayability-boundaries.static.golden.mjs`

1. 上述生产文件逐个少于 600 行；
2. core 零 fs/network/Playwright/LLM/verdict/report 依赖；
3. raw core 和 event loop 不出现 `goto`、`requireReplayNavigation` 或 path restore；
4. `record→cycle-entry→runtime-cycle` 咬合：witness 后关闭旧 owner，再 canonical source bootstrap；
5. fresh authority 调用参数来自真实 Browser/Context/Page 对象，不来自 CLI 布尔；
6. raw 动作复用现役 generic replay identity gate，但 resolve/perform 两阶段可分别计数；
7. newpage 复用现役 topology controller/bridge；
8. capture output 仍明确非 signed、非 replay-ready；
9. raw proof 只经现役 output-seal 原子写盘，CLI 不自建第二套半文件协议。

### G6 邻接回归

继续复跑：

- `record-capture.golden.mjs`；
- `record-intake.golden.mjs`；
- page-topology controller/pipeline/replay-action 金牌；
- execution-target core/runtime/output-seal 金牌；
- `record-distill.golden.mjs`；
- `agent-id-gate.zero-sut.golden.mjs` 的名称 + code + signed platform ID 判定表。

zero-SUT 金牌只证明控制流、authority、字节绑定和 fail-closed；不能替代 AI 中台、医生站或 Hi 小助上的
真实 fresh Browser 回放。真实回放成功也只核销 raw replayability，不自动产生正式测试结论。

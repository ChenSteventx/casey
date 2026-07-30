# Teach-in replayability runtime seams

日期：2026-07-27  
状态：实现前验收冻结候选  
范围：`read-only-v1`；本文只冻结现役 replay/axes/verdict/compile 与三段 runtime 的接缝，
不新增裁判，也不把技术闭环冒充正式 `PASS`。

## 1. 结论

实现不能只把 raw capture 跑到 `CLEAN`。现役 `projectReplayAxes` 需要逐 intent 的动作轴、
断言观察、取证和 topology 输入；而 raw 执行时可信 mapping 尚不存在。因此 source 必须是
严格两相：

```text
同一次 raw 物理执行
→ 对每个 capture event 采 before/action/after/forensics observation
→ 铸 opaque rawObservationAuthority（仍不猜 intent）
→ CLEAN 后确定性验证 eventSeq → authored intent → known atom
→ 用 resolvedProjectionAuthority 聚合既有 observations
→ 真调用 projectReplayAxes
→ 只经 frozen bin/verdict.mjs 子进程桥裁定
```

禁止为补 axes 再跑一次 source，禁止由 mapping 候选预先指导 raw 采证，也禁止调用方提交
axes、verdict、observations 或 `PASS/CLEAN` facts。

第二个 Critical 是 compile runtime。现役 `createCompileRun + compileFlow` 会真实操作页面，
而且 source raw replay 已把页面推进终态。已裁定采用路线 A：

```text
source evidence runtime 完成并关闭
→ 独立 guided-compile authoring runtime
   fresh Browser/Context/Page
   + 相同前置 workflow
   + 同 reset baseline
   + createCompileRun/compileFlow
   + exact owner close
→ distilled evidence runtime 才可创建
```

所以全链是三条物理动作链、两条 evidence replay（source raw + distilled formal）：

| runtime | 物理动作 | semantic receipt | comparator 输入 |
|---|---:|---:|---:|
| source evidence | 是 | 是 | 是 |
| guided-compile authoring | 是 | 否 | 否 |
| distilled evidence | 是 | 是 | 是 |

把 authoring 续在 source 终态、与 distilled 共用 Browser/Context、或把 authoring 当第三份
replay receipt，均属实现错误。

## 2. 与 23 步编排的唯一咬合

本文采用 source 两相和最新序列硬化。成功路径固定为：

表内第 1 步前，`record --login-bootstrap` 的同进程 application service 必须先完成 capture
admission，并让 runtime-cycle 以 live recording handles 做 witness→close/disconnect→
`canonicalRuntimeBootstrap.openRuntime({role:'source',executionTargetAuthority})`；只把
opaque preparation cap 交 façade。`--no-login` 只录制，plain JSON 不能重建 cap。

| 步 | 调用 | 新 authority / 事实 |
|---:|---|---|
| 1 | `createSourceReplayPlanAuthority` | `sourcePlanAuthority` |
| 2 | `claimPreparedSourceReplayRuntime` | source fresh/topology/owner |
| 3 | `createResetAuthority(source)` | live source reset |
| 4 | `authorizeSourceReplay` | source run |
| 5 | `executeAuthorizedSourceReplay(rawReplayIssuer)` | CLEAN + raw observations + owner |
| 6 | `resolveCaptureProjection` | `resolutionAuthority` |
| 7 | `issueSourceSemanticGrant` | source semantic grant |
| 8 | `completeResolvedSourceReplay(resolvedSourceIssuer)` | source completion + `authoringBaselineGrant` |
| 9 | `issueAtomRoundtripGrant` | atom roundtrip grant |
| 10 | `closeReplayRuntimeOwners(source)` | `sourceClosureAuthority` |
| 11 | `runAndSealDistilledCandidate` | candidate + `authoringClosureAuthority` |
| 12 | `finalizeDualReplayPlanAuthority` | pair + pair-bound source completion |
| 13 | `createSemanticReplayReceipt(source)` | source receipt bytes/capability |
| 14 | `prepareDistilledReplayRuntime` | distilled fresh/topology/owner |
| 15 | `createResetAuthority(distilled)` | live distilled reset |
| 16 | `issuePredecessorGrant(source)` | predecessor grant |
| 17 | `authorizeDistilledReplay` | distilled run |
| 18 | `completeAuthorizedReplay(atomReplayIssuer)` | distilled completion + owner |
| 19 | `createSemanticReplayReceipt(distilled)` | distilled receipt bytes/capability |
| 20 | `issueComparisonGrant(source)` | source comparison grant |
| 21 | `issueComparisonGrant(distilled)` | distilled comparison grant |
| 22 | `compareSemanticReplayReceipts` | deterministic equivalence receipt |
| 23 | `closeReplayRuntimeOwners(distilled)` | exact close observed |

第 8 步的 `authoringBaselineGrant` 是 opaque one-shot capability，只证明 authoring 必须复现的
前置 workflow/reset baseline；不公开 baseline facts。第 11 步必须同时消费：

```text
sourceClosureAuthority
+ atomRoundtripGrant
+ authoringBaselineGrant
```

第 11 步内部不可拆穿的顺序是：

```text
validate exact input shape
→ runAtomRoundtrip(atom grant, lazy canonical compile adapter)
   → 先消费 atom grant 并通过 flow-bridge；失败时零 open
   → lazy callback 验真 target 并消费 source closure/baseline grant；失败时零物理 open
   → open independent authoring runtime → login / execute preconditions → 验证同一 reset
   → createCompileRun → compileFlow → close exact authoring owner
   → callback 返 compiled events/lineage；roundtrip 再验 mapping/topology parity
→ seal distilledCandidateAuthority
→ return authoringClosureAuthority
```

第 14 步只消费 `authoringClosureAuthority + pairAuthority`。它不得接受
`sourceClosureAuthority`，从而用 authority 顺序证明三 runtime 严格串行。

## 3. 生产模块拆分

`runtime-cycle-adapter.mjs` 只作静态装配，不承担大段 browser、observation、compile 或
axes 逻辑。冻结拆分：

| 文件 | 唯一职责 | 建议上限 |
|---|---|---:|
| `lib/replay/intent-observation.mjs` | formal/raw 共用 before/terminal 观察原语 | 320 |
| `lib/teachin/raw-event-observation.mjs` | 逐 event 顺序、绑定与 one-shot authority | 280 |
| `lib/teachin/raw-axes-adapter.mjs` | resolved seq→intent 聚合并调用现役 axes/verdict | 320 |
| `lib/teachin/compile-runtime-adapter.mjs` | 独立 authoring open/reset/precondition/compile/close | 360 |
| `lib/teachin/runtime-bootstrap.mjs` | target-bound launch/login/session-seed/topology/forensics | 360 |
| `lib/teachin/replayability-cycle-entry.mjs` | 同进程 capture admission/source preparation/交权 | 220 |
| `lib/teachin/runtime-owner.mjs` | source/authoring/distilled owner 与 closure ratchet | 360 |
| `lib/replay/prepared-run.mjs` | 在已归属 runtime 内调用 formal runner + axes | 260 |
| `lib/teachin/verdict-cli-adapter.mjs` | frozen judge 唯一子进程边界 | 260 |
| `lib/teachin/runtime-cycle-adapter.mjs` | canonical 静态 assembler 与薄 issuer | 240 |

所有文件严格小于 600 行。不得因 `bin/replay.mjs`、`bin/compile.mjs` 已接近上限而继续向
其中堆代码。

## 4. Same-run raw event observation

### 4.1 共用观察原语

从现役 `lib/replay/event-runner.mjs` 抽出而不复制：

```js
captureIntentObservationBaseline(input)
captureIntentObservationTerminal(input)
```

formal runner 与 raw observer 必须静态导入并实际调用同一实现。共用范围包括 count、chat
baseline/reply、URL path、toast、text hit、button state、input readback、settle、pageerror、
network/stream attribution。动作执行仍由各自 runner 负责，观察模块不点击、不导航、不裁定。

raw event 从 begin 到 terminal observation 完成期间，`state.currentStepId` 必须保持
`rawstep_<seq>`；response wait、stream settle、pageerror/network 均因此归属同一 synthetic
step。采完后才清空。不能在动作后立刻清空再采证。

### 4.2 冻结 API

`lib/teachin/raw-event-observation.mjs` 的最终公开命名：

```js
createRawEventObservationSession({
  captureAuthority,
  runExecutionAuthority,
  expectedBytes,
  executionTargetAuthority,
  collector,
  state,
  forensics,
  pageErrors,
})
// -> {ok:true,sessionAuthority}

beginRawEvent({
  sessionAuthority,
  seq,
  topologyAuthority,
})
// -> {ok:true}

finishRawEvent({
  sessionAuthority,
  seq,
  actionAxis,
  topologyAuthority,
})
// -> {ok:true}

sealRawEventObservations({
  sessionAuthority,
  cleanProofAuthority,
})
// -> {ok:true,rawObservationAuthority}

inspectRawEventObservationAuthority({
  rawObservationAuthority,
})
// non-consuming -> {
//   ok:true,captureSha256,eventSeqs,observationCount,runExecutionAuthority
// }
```

`collector` 是 canonical raw issuer 私下绑定的
`{captureBaseline,captureTerminal}` 共用 observation collector，不是 CLI/用户输入；
`beginRawEvent` 恰调用前者，`finishRawEvent` 在 action/settle 后恰调用后者。其返回值只写入
模块私有 authority record，API 不开放自由 `observations` 数组。
两方法都只接 canonical
`{seq,stepId,assertionUniverse,state,forensics,pageErrors}`；terminal 加 exact `actionAxis`。
`assertionUniverse` 来自 session 内冻结的 expected，不含 event→intent mapping。
`expectedBytes` 在 session 创建时复制、解析、校验并冻结。mapping 尚不存在，所以每个 event 必须
采 signed expected 的 assertion universe；resolved 后只选择该 intent 的 authored assertions。
禁止把 mapping、intentId、axes、verdict 或自由 observation 作为 create/begin/finish 输入。

session 必须通过 `captureAuthority` 的 canonical inspector 取得 exact capture event
seq/action/compound key，不接受 caller 另给 event plan。每项只允许
`beginRawEvent → finishRawEvent` 一次。漏项、跳序、重复、并发跨 event、terminal 未完成或
collector throw/malformed 均不能 seal。seal 还必须验证 genuine `cleanProofAuthority` 与
同一 capture hash 绑定。authority 绑定：

```text
capture object identity + captureSha256 + exact expected hash
+ runExecutionAuthority + execution target + topology
+ exact event seq/action list
```

`inspectRawEventObservationAuthority` 只验真和暴露上述最小元数据，不消费 observations；
source raw completion 用它做 exact binding。resolved axes 的内部 consumer 才可 one-shot 读取
完整私有记录。plain、clone、foreign、replay session authority 在 collector 调用前拒绝。

canonical raw issuer 必须在 `runRawReplay` 前创建 session，并把唯一
`eventObserver:{begin,finish}` 闭包接到 raw runner。runner 对每个 event 的固定顺序是
`begin(seq) → path/resolve/perform 或 topology action → finish(seq,actionAxis)`；首错 event
仍 finish 以保留失败动作轴，但下一 seq 不得 begin。只有同一调用返回 genuine `CLEAN` 后，
issuer 才用其 `cleanProofAuthority` seal。先独立跑到 CLEAN、随后离线补 begin/finish 不满足
same-run 契约。

## 5. Resolved raw axes adapter

`lib/teachin/raw-axes-adapter.mjs` 的工厂：

```js
createRawAxesAdapter({
  consumeRawObservationAuthority,
  consumeResolvedProjectionAuthority,
  projectReplayAxes,
  verdictAdapter,
})
// -> { projectAndVerify(input) }
```

canonical 实例必须静态绑定：

- `raw-event-observation.mjs` 的真实 consumer；
- `resolved-projection.mjs` 的 source-only projection consumer；
- `lib/replay-axes.mjs::projectReplayAxes`；
- `canonicalVerdictCliAdapter.runFrozenVerdict`。

入口只收：

```js
projectAndVerify({
  rawObservationAuthority,
  resolvedProjectionAuthority,
})
```

不收 expected、mapping、artifacts、axes、verdict、evidence 或 judge。两 authority 必须 exact
匹配 case/capture/expected/target/topology/owner bindings，并且都 one-shot。

### 5.1 Deterministic aggregation

对每个 resolved mapping：

- `actionByStep`：保留其所有 business event 的 synthetic step/action axis；
- `intentEvents`：按 `evidenceEventSeqs` 顺序构造，不按 atom 名或 intent `Set` 去重；
- `reprStepOf`：最后一个业务 event；
- `intentCount.before`：第一 event baseline；
- `intentCount.after`、URL、toast、text/button/input/reply：最后 event terminal；
- reply baseline 来自第一 event before，terminal 来自最后 event after；
- pageerror/network/stream：按该 intent 的 synthetic stepIds 合并，保留 attribution；
- structural `newpage`：按 verified trigger lineage 接到触发 intent，不可静默丢弃。

存在 pending、event gap、multi-use、未闭合 structural trigger、expected binding mismatch 或
foreign authority时，`projectReplayAxes` 与 verdict 调用数都必须为零。

聚合完成后恰调用一次现役 `projectReplayAxes`。其返回文本只做 UTF-8 bytes 化，不本地重写
axes。随后恰调用一次 frozen verdict adapter；任何 throw/malformed/非零退出均稳定失败，
不回显异常、stderr、URL 或 observation 原值。

成功 exact 返回：

```js
{
  ok: true,
  rawObservationAuthority,
  resolvedProjectionAuthority,
  axesBytes,
  verdictBytes,
  evidence,
}
```

这里的 `evidence` 只能由 axes/verdict 与 authority-bound projection 确定性导出，不能由 caller
提交。模块禁止出现本地 `evaluateAssertions`、`decide`、`deriveActionPerformed`、
`forensicsBacksSutError` 或手写 `PASS/SUT_DEFECT` 判断。

## 6. Prepared formal replay

`bin/replay.mjs` 自己 launch/login/close 且底部无 import guard，不能在 atom issuer 中 spawn：
那会创建与 owner trio 不同的 Browser，破坏 fresh/owner 证明。

新增 `lib/replay/prepared-run.mjs`，在已 claim/prepare 的 exact runtime 中：

```text
canonical preflight
→ runReplayEvents
→ projectReplayAxes
```

它不 launch、不 login、不 close、不运行 verdict。runtime owner 负责 close；issuer 再调用 frozen
verdict bridge。preflight 必须复用签名、profile、workflow delete binding、entity admission/
anchors、assertion projection、origin admission 等现役门，不能因新入口而旁路。

## 7. Guided compile authoring runtime

`lib/teachin/compile-runtime-adapter.mjs` 必须静态调用 canonical `runAtomRoundtrip`，并只把
下列现役编译调用封在它的 lazy `compileAdapter` 回调内：

```js
createCompileRun(...)
compileFlow(run, flow, { lineagePlan })
```

因此 atom grant/bridge 无效时 authoring runtime 尚未 open；回调被调用后才执行
open/precondition/reset/compile/close，闭包只在 exact close 成功后保留
`authoringClosureAuthority`。不得另写 `consumeAtomRoundtripGrant` 旁路 roundtrip。
`compileAuthoringCandidate` 的 exact input 不含 entity lock。外层 runtime-cycle 只在
roundtrip candidate 与 authoring closure 都成功后，才以 candidate 的 canonical caseId 与
events bytes 调 `canonicalEntityLockVerifier.verify`，并把 genuine
`authoringClosureAuthority` 作为 `verificationScopeAuthority`。verifier 自解析 exact formal
events：只有每项 `entityBindings` 缺席或严格 `[]` 且现役 `checkReplayEntityAdmission` 判
无需 runtime entity，才返回 exact
`{ok:true,handle,mode:'not-required',runtimeAuthorized:false,setSha256:<canonical [] digest>}`；
否则为 `runtime-required`，必须同进程提供 genuine authority 并由 publication root 授权。
两种 success 都是 exact 五键；caller 的 noEntity/mode/hint/handle/digest 一律不收。
runtime-cycle 只放行 `not-required`，或 `runtime-required && runtimeAuthorized===true`，再交
`sealDistilledCandidateAuthority({roundtripCandidate,authoringClosureAuthority,
verifiedEntityLockHandle,verifiedEntityLockSetSha256,executionTargetAuthority})`；它 exact 返回
`{ok:true,distilledCandidateAuthority}`，不从 public façade 导出，finalizer 在同一模块消费
其 WeakMap record，并要求 set digest 与 source lock bytes digest 全等。首版 no-entity 的 source
lock exact bytes 固定 UTF-8 `[]`，digest 固定
`sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。raw authority clone/foreign 固定
`ENTITY_LOCK_AUTHORITY_INVALID`，sealer 形状/unknown 固定 `DISTILLED_CANDIDATE_SEAL_INVALID`，
required mode 的 `runtimeAuthorized` 非 true 固定 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED`；两者都可能已花掉
authoring 动作，但绝不铸 candidate 或启动 distilled，不能为追求零动作而在 events 尚不存在时
做一套自证 inspector。
`lib/teachin/entity-lock-verifier.mjs` 只导出
`createEntityLockVerifier(deps)`、`canonicalEntityLockVerifier` 与
`consumeVerifiedEntityLockVerification`。verify exact 输入为
`{caseId,eventsBytes,verificationScopeAuthority,authority?}`，consumer 再以 exact
`{handle,caseId,eventsBytes,setSha256,verificationScopeAuthority}` one-shot 复核同一
scope/case/events/digest。即使两个 pair 的 case/events/digest 相同，foreign authoring closure
也固定拒绝且不消费 genuine handle。无 required publication digest 固定
`ENTITY_LOCK_DIGEST_UNAVAILABLE`，不能接受 caller 自报 digest 或读取 workspace PRD。
lazy callback 失败时 atom grant 已消费；整条 cycle fail-closed，重试必须新 pair/namespace，
不得保留旧 grant 换 closure/baseline 试到成功。
clone/replay atom 或 baseline 分别固定 `ATOM_ROUNDTRIP_GRANT_INVALID` /
`AUTHORING_BASELINE_GRANT_INVALID`；genuine foreign closure 固定
`REPLAY_RUNTIME_OWNERSHIP_MISMATCH`，genuine foreign atom candidate 或 baseline 与其余 source
绑定不一致固定 `AUTHORING_BASELINE_MISMATCH`，且都在物理 authoring open 前拒绝。

允许对 `compileFlow` 做兼容加性扩展：旧调用不传第三参数时行为不变；给出 `lineagePlan` 时，
在任何页面动作前验证整份长度/mappingKey/sourceIntentId，然后利用现有
`firstEvent = run.events.length` 边界返回：

```js
[{mappingKey,sourceIntentId,stepIds}]
```

lineage 不得按最终 atom 名猜，也不得另写 compiler。必须诚实记录 authoring 是物理执行；
它不产生 axes/verdict/semantic receipt。

authoring runtime 任一 open/login/precondition/reset/compile/lineage/close 失败都不铸 candidate。
即使 compile 已成功，exact owner close 失败仍固定 `AUTHORING_RUNTIME_CLOSE_FAILED`。关闭成功
产生一次性 `authoringClosureAuthority`，只可用于第 14 步。

## 8. Runtime owner 与登录/目标连续性

三 runtime 都通过现役接缝：

- `projectExecutionTargetRuntime` / `playwrightLaunchOptions`；
- `loadSiteConfig` / `loadCreds` / `loginBootstrap`；
- `openReplayTopology`；
- `createPageForensicsHub`；
- `createReplayOriginAdmission` / `verifyExecutionTargetPageOrigin`。

`runtime-bootstrap.mjs` 是 source/authoring/distilled fresh open 的唯一生产实现：静态 import 并实际调用
上述接缝，输入 exact `{role,executionTargetAuthority}`，先 `projectExecutionTargetRuntime`，再把同一
runtime 交 `playwrightLaunchOptions` 与 `loginBootstrap`。它不得接受或改写 base URL、host、
loopback endpoint；Windows direct 保留 logical origin，只有 execution-target policy 已批准的
WSL transport 才能出现 loopback。登录后必须安装 session seed、topology、per-page forensics
与 origin admission，避免新标签页掉登录。任一子步失败关闭 partial Browser/Context。

逻辑目标与 transport 分离。Windows direct 不得因 WSL 本机隧道策略把逻辑目标改写为
loopback；只有显式 WSL transport mode 才能使用回环转发。

`runtime-owner.mjs` 私有 WeakMap 绑定 Browser/Context/Page/topology/forensics/session policy。
公开只给 opaque preparation/owner/closure authority。close 必须观察 exact Context closed 与
Browser disconnected；崩溃后若已达该状态可视为关闭，但不得关闭无关 runtime 冒充。

首版 reset 能证明 fresh runtime、重新登录、canonical precondition workflow 与同 baseline
projection；它不能声称回滚未知持久数据。`read-only-v1` 因而禁止持久 mutation。

## 9. Frozen verdict bridge

首发不修改 `bin/verdict.mjs`，其冻结 SHA-256：

```text
ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53
```

唯一边界 `lib/teachin/verdict-cli-adapter.mjs` 使用 `execFile`（不是 `spawn`/shell）、固定
judge path、参数数组、
`shell:false`、独占临时目录、timeout 和 finally 清理。runtime/axes 模块只调用
`canonicalVerdictCliAdapter.runFrozenVerdict({axesBytes})`，不得 import judge、复制 judge、
接受 caller command/path/env 或透传 stderr。

## 10. Stable failures

本接缝新增稳定 reason：

```text
RAW_OBSERVATION_INPUT_INVALID
RAW_OBSERVATION_AUTHORITY_INVALID
RAW_OBSERVATION_SEQUENCE_INVALID
RAW_OBSERVATION_INCOMPLETE
RAW_OBSERVATION_COLLECTION_FAILED
RAW_AXES_BINDING_MISMATCH
RAW_AXES_PROJECTION_INVALID
RAW_AXES_PROJECTION_FAILED
VERDICT_EXECUTION_FAILED
AUTHORING_BASELINE_GRANT_INVALID
ATOM_ROUNDTRIP_GRANT_INVALID
AUTHORING_RUNTIME_OPEN_FAILED
AUTHORING_BASELINE_MISMATCH
AUTHORING_COMPILE_FAILED
AUTHORING_RUNTIME_CLOSE_FAILED
AUTHORING_CLOSURE_AUTHORITY_INVALID
ENTITY_LOCK_AUTHORITY_INVALID
ENTITY_LOCK_RUNTIME_UNAUTHORIZED
ENTITY_LOCK_DIGEST_UNAVAILABLE
DISTILLED_CANDIDATE_SEAL_INVALID
```

失败结果 exact `{ok:false,reason}`；不泄异常原文、target、session、bytes 或半成品 authority。

## 11. 实现前 acceptance

以下测试全部零 SUT、零 browser、零 network、零 LLM：

```text
node tests/_golden/teachin-replayability-raw-event-observation.zero-sut.golden.mjs
node tests/_golden/teachin-replayability-raw-axes-adapter.zero-sut.golden.mjs
node tests/_golden/teachin-replayability-runtime-cycle-adapter.zero-sut.golden.mjs
node tests/_golden/teachin-replayability-compile-runtime-adapter.zero-sut.golden.mjs
node tests/_golden/teachin-replayability-prepared-run.zero-sut.golden.mjs
```

它们在生产模块落地前必须真实 RED；实现后必须证明：

1. formal/raw 实际调用同一 observation primitives；
2. raw observations 与真实 event 顺序/owner/target/expected exact-bind；
3. resolved 后才投影 axes，且真调用现役 projector + frozen verdict adapter；
4. source close → independent authoring open/reset/compile/close → distilled open 严格串行；
5. compile authoring 是第三次物理动作链但不是第三份 replay receipt；
6. canonical adapter 无 caller issuer/provider、无本地 judge、无 test-only mint；
7. production 与 golden 文件逐个严格小于 600 行。

这些 golden 只能证明 wiring、authority 与确定性投影约束，不能证明真实 AI 中台、医生站或
Hi 小助成功。真实登录连续性、fresh Browser、三 runtime、回放录像和正式报告仍须实机 UAT
与用户验收。

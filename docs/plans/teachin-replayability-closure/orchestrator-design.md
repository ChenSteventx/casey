# S5 双回放编排边界设计

日期：2026-07-27
状态：验收冻结候选；生产实现尚未开始
范围：`read-only-v1`，只负责编排已经冻结的 authority 状态迁移，不新增裁判。

## 1. 边界结论

`S5` 只解决一件事：把 source 原始回放、既有 atom 投影和 distilled 回放按唯一顺序接成
技术闭环。它不创建 `PASS`，不把 `CLEAN` 当裁定，也不接受调用方提交
`clean/equivalent/promotionReady` 等事实。

生产拆成三个小文件：

```text
lib/teachin/replayability-cycle-entry.mjs
lib/teachin/dual-replay-orchestrator-core.mjs
lib/teachin/dual-replay-orchestrator.mjs
```

- `replayability-cycle-entry.mjs` 是录制进程内 application service，只做 capture admission、
  source prepare 与 façade 交权；
- `dual-replay-orchestrator-core.mjs` 是零 `SUT` 的确定性编排核心；只导出内部工厂
  `createDualReplayOrchestratorCore`。
- `dual-replay-orchestrator.mjs` 是生产 façade（薄入口）；只导出
  `runTeachinReplayabilityCycle`，静态绑定 canonical runtime-cycle adapter（生产运行周期
  适配器）与现役 authority API。

生产 façade 不导出内部工厂，不接收 issuer、provider、factory、adapter、compile adapter
或 registry；不读 env/global，不动态 import，不 import 测试支持。
它必须是以下形态的等价静态接线，不能只 import 而不消费 canonical 依赖：

```js
import * as dualReplayApi from '../dual-replay/index.mjs';
import * as runAuthorityApi from '../dual-replay/run-authority.mjs';
import atomRegistry from '../atoms-registry.snapshot.json' with { type: 'json' };
import { createDualReplayOrchestratorCore } from './dual-replay-orchestrator-core.mjs';
import * as resolvedProjectionApi from './resolved-projection.mjs';
import { canonicalRuntimeCycleAdapter } from './runtime-cycle-adapter.mjs';

const canonicalCore = createDualReplayOrchestratorCore({
  dualReplayApi,
  runAuthorityApi,
  resolvedProjectionApi,
  atomRegistry,
  runtimeCycleAdapter: canonicalRuntimeCycleAdapter,
});

export async function runTeachinReplayabilityCycle(input) {
  return canonicalCore.runCycle(input);
}
```

`canonicalCore` 必须在 module scope（模块加载期）恰构造一次。façade 自己不得出现成功对象、
`equivalenceReceipt`、`developmentOnly`、`promotionReady`、`equivalent` 或
`promotionEligible` 的组装逻辑。

同进程入口冻结为：

```js
runRecordedTeachinReplayabilityCycle({
  caseId, captureBytes, recordingBrowser, recordingContext, cycleInput,
})
```

`cycleInput` 不含 `sourcePlan.source.captureAuthority` 或 `sourceRuntime`。entry exact-key 验证后
依次只调用 `admitRawReplayCapture`、`canonicalRuntimeCycleAdapter.prepareSourceReplayRuntime`
和 `runTeachinReplayabilityCycle`，把两枚 genuine cap 注入新对象；caller 预开的 replay
Browser/Context/Page/topology、plain/clone cap 与第二次 recording use 均拒。entry/record
不得调用 `runRawReplay`/`admitAndRunRawReplay`；source raw 只在 core 第 5 步发生一次。
entry 在接权时先监听 Context close/Browser disconnected，admission/prepare 早退或抛错均在
`finally` 对仍 live 的 owner 各关闭恰一次；record 设置 handoff 后自己的 `finally` 禁止二次 close。
首发只有 `record --login-bootstrap` 进入此路径；`--no-login` 只录制。`casey teachin-cycle`
是真实 dispatch 到薄别名，再启动 `record` 子进程；cap 从不跨该进程的 JSON 边界。

## 2. 生产输入

```js
runTeachinReplayabilityCycle({
  sourcePlan: {
    pairId,
    testcaseBytes,
    expectedBytes,
    expectedObligations,
    sutBuildDigest,
    channelProfileDigest,
    identityProfileDigest,
    replayKernelDigest,
    resetPlanDigest,
    sessionPolicyDigest,
    source: {
      captureAuthority,
      candidateBytes,
      eventsBytes,
      entityLockBytes,
      runNamespace,
    },
  },
  executionTargetAuthority,
  sourceRuntime: {
    sourceRuntimePreparationAuthority,
  },
  projection: {
    mappingCandidate,
    authoredTestCase,
  },
  distilled: {
    authoringRunNamespace,
    runNamespace,
  },
})
```

顶层与四个嵌套对象都按 exact-key 校验。未知键、缺键或以下任何调用方事实均在第一个
authority 调用前以 `ORCHESTRATOR_INPUT_INVALID` 拒绝：

```text
issuer / provider / factory / adapter / registry / compileAdapter
fresh / reset / clean / CLEAN / PASS / equivalent / promotionReady
artifacts / axes / verdict / evidence / receipt
distilled freshRuntimeAuthority / topologyAuthority / sourceClosureAuthority
distilled entityLockAuthority / noEntity / mode / verified handle 或 digest
```

source preparation authority 来自同进程 adapter 对 live recording handles 的 canonical prepare；
distilled fresh 不允许预先传入，必须等 exact source owners 关闭后由 canonical adapter
现场铸造。
source、authoring、distilled 三个 run namespace 必须非空且两两不同；第 11 步只用
`authoringRunNamespace`，第 14–18 步只用 distilled `runNamespace`，不得复用。

source fresh/topology/owner 三件套只存在 canonical adapter 的私有 WeakMap，prepare 对外只返
one-shot `sourceRuntimePreparationAuthority`。core 建好 source plan 后必须调用
`claimPreparedSourceReplayRuntime`，把 preparation 与 exact plan/namespace/target 绑定；claim
成功才返回 trio 并发生 ownership transfer（所有权转移）。因此调用方无从把 clone/foreign
owner 与 genuine fresh 拼接。claim 前失败由 adapter dispose genuine preparation，claim 后任何
失败由 core 关闭 owner。

## 3. 内部核心接缝

```js
createDualReplayOrchestratorCore({
  dualReplayApi,
  runAuthorityApi,
  resolvedProjectionApi,
  atomRegistry,
  runtimeCycleAdapter,
})
// -> { runCycle(input) }
```

该工厂只供生产 façade 静态装配和 zero-SUT golden 使用，不从生产 façade 转导。
`runtimeCycleAdapter` 的冻结窄面为：

```js
{
  rawReplayIssuer,
  resolvedSourceIssuer,
  atomReplayIssuer,
  resetIssuer,
  runAndSealDistilledCandidate,
  prepareSourceReplayRuntime,
  claimPreparedSourceReplayRuntime,
  disposePreparedSourceReplayRuntime,
  closeReplayRuntimeOwners,
  prepareDistilledReplayRuntime,
}
```

其中：

```js
prepareSourceReplayRuntime({
  runNamespace,
  executionTargetAuthority,
  recordingBrowser,
  recordingContext,
})
// -> {ok:true,sourceRuntimePreparationAuthority}

claimPreparedSourceReplayRuntime({
  sourceRuntimePreparationAuthority,
  sourcePlanAuthority,
  runNamespace,
  executionTargetAuthority,
})
// -> {ok:true,freshRuntimeAuthority,topologyAuthority,runtimeOwnerAuthority}

disposePreparedSourceReplayRuntime({
  sourceRuntimePreparationAuthority,
})
// -> {ok:true}

runAndSealDistilledCandidate({
  atomRoundtripGrant,
  authoringBaselineGrant,
  sourceClosureAuthority,
  runNamespace,
  entityLockAuthority, // 仅 runtime-required 同进程可选；no-entity 缺席
  executionTargetAuthority,
})
// -> {ok:true,distilledCandidateAuthority,authoringClosureAuthority}

closeReplayRuntimeOwners({
  runtimeOwnerAuthority,
})
// source -> {ok:true,sourceClosureAuthority}
// distilled -> {ok:true}
// failure -> {ok:false,reason:'REPLAY_RUNTIME_OWNERSHIP_MISMATCH'}

prepareDistilledReplayRuntime({
  authoringClosureAuthority,
  pairAuthority,
  runNamespace,
  executionTargetAuthority,
})
// -> {
//   ok:true,
//   freshRuntimeAuthority,
//   topologyAuthority,
//   runtimeOwnerAuthority,
// } | {ok:false,reason}
```

adapter 先装 lifecycle witness、依次关闭 recording Context/Browser 并等 disconnected，再以
`canonicalRuntimeBootstrap.openRuntime({role:'source',executionTargetAuthority})` 内部创建
Browser/Context/Page；caller 不能传 replay handles/topology。它用私有 WeakMap（弱引用映射）
把 fresh、topology、owner 三件套绑到同一 runtime。
上游 canonical path 通过 `prepareSourceReplayRuntime` 只取得 preparation cap 后调用本 façade；
core 不调用 `prepareSourceReplayRuntime`，也不接收 source runtime factory。core 只在 exact
input 校验与 source plan 创建成功后 claim；claim/dispose one-shot 互斥。plain/clone/foreign/
replayed preparation 固定 `REPLAY_RUNTIME_OWNERSHIP_MISMATCH`；genuine pre-claim 物理清理失败
固定 `SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED`。
`closeReplayRuntimeOwners` 只认这张表里的 one-shot opaque owner capability（一次性不透明
所有权凭证），真实等待 exact `BrowserContext` close 和 `Browser` disconnected。clone、
foreign owner 与第二次 close 都固定 `REPLAY_RUNTIME_OWNERSHIP_MISMATCH`。

source close 返回一次性 opaque `sourceClosureAuthority`，只供 authoring 子序列消费；
authoring exact close 后返回一次性 `authoringClosureAuthority`。distilled prepare 只能原子
消费后者，launch 全新 Browser/Context/Page，并把 source→authoring 的 predecessor chain
绑定进 distilled 三件套；不返回 browser、context 或 page 对象。prepare 失败必须自行关闭
任何 partial runtime，且不得返回半份 authority。

authoring close 后 runtime-cycle 才以该 genuine `authoringClosureAuthority` 作为
`verificationScopeAuthority`，让 canonical verifier 自解析 candidate events 判
`not-required`/`runtime-required`；caller 不得提交 mode/hint/handle/digest。pair sealer
消费 verified handle 时复核同一 scope/case/events/set digest，防止相同 bytes 的跨 pair 换绑。

`authorizeSourceReplay` 与 `authorizeDistilledReplay` 都携
`runtimeOwnerAuthority`，并把它与 fresh/topology 封入 exact run record。canonical issuer
实际执行后必须原样返回同一个 owner cap。source 的
`executeAuthorizedSourceReplay` 转移 `sourceRuntimeOwnerAuthority`；distilled 的
`completeAuthorizedReplay` 转移 `distilledRuntimeOwnerAuthority`。缺失、clone、foreign、
role 错位或第二次转移都
`RUN_COMPLETION_BINDING_MISMATCH`。orchestrator 还必须把 completion 返回值与自己持有的
prepared owner 作对象 identity 复核。

source completion 不允许 raw issuer 在 mapping 未验证前伪造 axes。raw issuer 只铸
`rawExecutionAuthority + cleanProofAuthority + rawObservationAuthority`；resolved projection
消费 CLEAN 并验证 event→intent→known atom 后分别签发 source-semantic 与 atom-roundtrip
grant。`completeResolvedSourceReplay` 只把 opaque raw observations 与 resolved projection
交给 canonical `resolvedSourceIssuer`，后者复用现役 axes 和 frozen verdict CLI adapter。
distilled 仍由 formal event replay 直接产 axes/verdict。

执行失败的 `cleanup responsibility`（清理责任）唯一归 core：input ownership transfer 后，
issuer 与 completion 无论返回失败、throw、malformed 或 binding mismatch 都不得自行关闭
runtime；core 的 `finally` 用它一直持有的 prepared owner 关闭恰一次。若浏览器已崩溃，
`closeReplayRuntimeOwners` 观察到 exact owner 已达 Context closed + Browser disconnected
即可消耗 capability 并成功，不要求再调用一次物理 close。这样不会由 completion 与 core
竞态双关，也不会因 completion 没有 owner 返回值而丢失清理能力。

## 4. 唯一成功顺序

`runCycle` 必须依次且每步恰调用一次：

| 序号 | 调用 | 后继只接 authority |
|---:|---|---|
| 1 | `createSourceReplayPlanAuthority` | `sourcePlanAuthority` |
| 2 | `claimPreparedSourceReplayRuntime` | source fresh/topology/owner trio |
| 3 | `createResetAuthority(source)` | live source `resetAuthority` |
| 4 | `authorizeSourceReplay` | source `runAuthority` |
| 5 | `executeAuthorizedSourceReplay(rawReplayIssuer)` | raw execution、CLEAN、observations、source owner |
| 6 | `resolveCaptureProjection` | `resolutionAuthority` |
| 7 | `issueSourceSemanticGrant` | source semantic one-shot grant |
| 8 | `completeResolvedSourceReplay(resolvedSourceIssuer)` | source completion + axes/frozen verdict + authoring baseline grant |
| 9 | `issueAtomRoundtripGrant` | atom roundtrip one-shot grant |
| 10 | `closeReplayRuntimeOwners(source)` | `sourceClosureAuthority` |
| 11 | `runAndSealDistilledCandidate` | candidate + closed authoring authority |
| 12 | `finalizeDualReplayPlanAuthority` | pair 与 pair-bound source completion |
| 13 | `createSemanticReplayReceipt(source)` | source bytes/capability |
| 14 | `prepareDistilledReplayRuntime` | consume authoring closure；distilled trio |
| 15 | `createResetAuthority(distilled)` | live distilled `resetAuthority` |
| 16 | `issuePredecessorGrant(source)` | one-shot predecessor grant |
| 17 | `authorizeDistilledReplay` | distilled `runAuthority` |
| 18 | `completeAuthorizedReplay(atomReplayIssuer)` | distilled completion 与同一 owner |
| 19 | `createSemanticReplayReceipt(distilled)` | distilled bytes/capability |
| 20 | `issueComparisonGrant(source)` | source one-shot comparison grant |
| 21 | `issueComparisonGrant(distilled)` | distilled one-shot comparison grant |
| 22 | `compareSemanticReplayReceipts` | deterministic equivalence receipt |
| 23 | `closeReplayRuntimeOwners(distilled)` | 已观察到 exact owner 关闭 |

第 5 步只有 canonical raw issuer 在真实 raw runner 内消费 source fresh；issuer 返回的
owner 必须与第 2 步同一；orchestrator 不得 import/call fresh consumer 或 raw runner。
第 14 步的 fresh 只能由第 11 步的 exact authoring closure 铸造；第 18 步 issuer 返回的 owner必须
与第 14 步同一。由此不会出现 raw runner
与 dual 层双消费同一个 fresh，也不会在 source 仍在线时预建 distilled runtime。

第 6 步必须使用第 5 步原样返回的 `cleanProofAuthority` 与 source plan 内的
`captureAuthority`。第 8 步只接第 5 步 opaque raw execution 与第 7 步 grant；
第 11 步只接第 9 步 grant、第 10 步 source closure、第 8 步
`authoringBaselineGrant` 和 execution target；canonical `runAtomRoundtrip` 只在验证 grant/bridge
后调用 lazy compile-runtime adapter。第 12 步不接受 distilled bytes。
reset 必须在相应 runtime claim/prepare 成功之后验证 live baseline，不能在 page/runtime
尚不存在时靠静态 facts 自报。

第 11 步内部包含一条不可拆穿的 authoring 子序列：

```text
prepare independent authoring Browser/Context/Page
→ 执行相同前置 workflow 并验证 resetPlan/baseline
→ createCompileRun + compileFlow + exact lineage
→ close exact authoring owner
→ seal distilled candidate
```

现役 `compileFlow` 会真实操作页面，所以这是一条第三次物理动作链，但不是 formal replay，
不铸 semantic receipt、不进入 comparator。它必须与 source/distilled 两个 evidence runtime
三者独立且严格串行：只有第 10 步 source closure 才能开启，第 11 步返回前必须关闭，
第 14 步又只能消费 one-shot `authoringClosureAuthority`。绝不能续用 source 终态或让三个
owner 重叠。source closure、baseline grant、target 任一混配/clone/foreign/replay 都拒；
子步任一失败/throw/malformed 或 owner close 失败都不得铸 candidate/closure；关闭失败固定
`AUTHORING_RUNTIME_CLOSE_FAILED`。

## 5. 失败与资源收口

每个状态迁移都先检查 exact `{ok:true,...}` 和所需 opaque authority，再进入下一步。
throw、malformed 或 `{ok:false}` 均停止业务链，绝不尝试“换 fresh/reset 重跑到绿”。

第 2 步 claim 成功前，source owner 仍归 adapter；input/plan/claim 任一失败时，只对 genuine
preparation 调 `disposePreparedSourceReplayRuntime` 恰一次。cleanup 是允许发生的唯一后继，
业务 authority 调用数仍为零；dispose 失败以 `SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED`
覆盖原 stage reason。claim 成功后 core 对 source owner 负全责：第 3–9 步任意失败都在
`finally` 调 `closeReplayRuntimeOwners(source)` 恰一次；第 10 步正常关闭后不得二次调用。
第 10 步失败固定 `SOURCE_RUNTIME_CLOSE_FAILED`，第 11–23 步业务调用数全部为零。
第 11 步的 authoring runtime 全由 adapter 内部负责；它只能在 exact close 后返回
candidate/authoring closure，失败时 core 不伪造第二次关闭。

第 14 步成功即把 distilled owner 转移给 core。第 15–22 步任意成功、失败、throw 或
malformed 都必须在返回前由 `finally` 调用 `closeReplayRuntimeOwners(distilled)` 恰一次。
comparison 成功也要先关闭 distilled，关闭成功后才可公开 equivalence receipt；关闭失败固定
`DISTILLED_RUNTIME_CLOSE_FAILED` 且不得返回 equivalence receipt。第 14 步自身失败由 adapter
保证 partial runtime 已关闭，core 没有 owner 就不伪造 close。

失败输出闭合为：

```json
{
  "ok": false,
  "developmentOnly": true,
  "promotionReady": false,
  "reason": "STABLE_REASON"
}
```

不回显异常原文、输入值、URL、bytes、artifacts、axes、verdict、evidence 或半成品 authority。
依赖返回的 reason 只有符合稳定枚举形态且不是 `PASS/CLEAN/EQUIVALENT` 时才可透传；否则使用
对应 stage 的稳定失败 reason。

## 6. 成功输出

只有 comparator 返回以下 exact 成功形态才允许成功：

```js
{
  ok: true,
  equivalent: true,
  promotionEligible: true,
  reason: null,
  equivalenceReceipt: {
    schemaVersion: 1,
    artifactKind: 'dual-replay-equivalence-receipt',
    pairId,
    scope: 'read-only-v1',
    sourceReceiptSha256,
    distilledReceiptSha256,
    comparedDimensions: [
      'intent-verdict',
      'terminal-hard-predicate',
      'topology',
      'entity',
      'effect',
      'cleanup',
    ],
  },
}
```

orchestrator 只原样转交其中 `equivalenceReceipt`，公开 exact 输出为：

```js
{
  ok: true,
  developmentOnly: true,
  promotionReady: false,
  equivalenceReceipt,
}
```

即使技术等价成立，也不能由本模块把 `promotionEligible:true` 改写成正式测试
`PASS` 或 GitHub 发布就绪。

## 7. Golden 冻结点

`tests/_golden/teachin-replayability-orchestrator.zero-sut.golden.mjs` 必须覆盖：

1. 23 步唯一顺序、source raw/distilled formal evidence replay 各一次，三 runtime 各新开一次；
2. source prep 必须 plan 后 claim，live runtime 在前、reset 在后；source completion/grants
   后先关闭 exact source owner，authoring runtime 再串行 open/reset/compile/close，之后才
   建 source receipt 并 prepare/reset distilled fresh；
3. claim 前 genuine prep 失败只 dispose 一次，claim 后 source owner 始终只关一次；
   prepare 成功后 distilled owner 在
   success/failure/throw 都只关一次；
4. caller-filled `PASS/CLEAN/equivalent`、issuer/provider/factory 与预建 distilled fresh
   在第一步前拒绝；
5. preparation/claim/owner 必须 exact identity；clone/foreign/replay、grant 换绑和第二次 close
   fail-closed；
6. production façade 在 module scope 恰构造一个 canonical core，唯一函数只委托
   `canonicalCore.runCycle(input)`，不本地组装成功；
7. core/façade 不 import raw runner、fresh consumer、browser、network、LLM 或 report/verdict；
   canonical adapter 必须静态接 raw event observations、现役 axes、frozen verdict CLI、
   flow-bridge/compile 与 atom event runner；
8. 成功必须在 distilled owner 已关后才返回，并保持
   `developmentOnly:true/promotionReady:false`，没有正式 `PASS` 字段。

两个生产文件与 golden 各自必须小于 600 行。

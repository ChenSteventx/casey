# Source / Distilled 双回放确定性等价设计
日期：2026-07-27
状态：验收冻结候选；生产实现尚未开始
范围：`read-only-v1`，人工示教的 source 原始回放与 atom 化 distilled 回放各执行一次，
经现役零 LLM 裁判后比较稳定业务语义。
## 1. 结论边界
本链只允许：
```text
effect = read
persistentMutation = false
```
保存、提交、创建、删除、关系绑定、持久 setup、cleanup required、跨 origin SSO、
iframe、shadow、CEF、坐标动作均不进入首版。任一未知 effect 统一
`UNSUPPORTED_EFFECT_CLASS`。
`CLEAN` 只表示原始 capture 被完整重放；`EQUIVALENT` 只表示本 pair 的稳定语义相同；
二者都不是 Casey 的正式 `PASS`。只有现役 `verdict` 产生的逐 intent `PASS` 才可参与
promotion。任一无法证明的事实 fail-closed。
## 2. 无占位的三 runtime、两 evidence replay 顺序
distilled candidate 在 source 原始回放成功并完成 projection 前不存在，因此禁止在
source 回放前给 pair 填假占位。固定顺序为：
```text
已 grill/签署 TestCase + expected
→ record --login-bootstrap 同进程 entry admission → prepareSourceReplayRuntime（只返 cap）
→ createSourceReplayPlanAuthority（只冻结当时已知真值）
→ claimPreparedSourceReplayRuntime（三 authority one-shot 转移）
→ source 独立 reset
→ authorizeSourceReplay（fresh/topology/owner 封入 run record，尚不消费）
→ executeAuthorizedSourceReplay(canonical raw issuer)
   ├─ executeAndVerify 恰一次
   ├─ 同一次 raw replay 原子消费 source fresh
   └─ 只产 CLEAN + per-event observation authority，绝不预判 intent
→ clean proof → resolved projection → issueSourceSemanticGrant
→ completeResolvedSourceReplay → axes/verdict → completion + authoringBaselineGrant
→ issueAtomRoundtripGrant
→ closeReplayRuntimeOwners(source) → sourceClosureAuthority
→ atom grant + source closure + baseline grant → fresh guided-compile authoring runtime
→ createCompileRun/compileFlow → candidate + authoringClosureAuthority
→ finalizeDualReplayPlanAuthority（一次性冻结完整 pair）
→ pair-bound source completion → source semantic receipt
→ prepareDistilledReplayRuntime(authoring closure) → distilled 独立 reset
→ issuePredecessorGrant(source receipt) → authorizeDistilledReplay
→ completeAuthorizedReplay(canonical atom issuer)
   ├─ executeAndVerify 恰一次
   ├─ 原子消费 distilled fresh
   └─ 现役 replay → axes → verdict
→ distilled semantic receipt
→ one-shot comparison grants → deterministic compare → closeReplayRuntimeOwners(distilled)
```

evidence equivalence 只含 source raw evidence replay 与 distilled formal replay；中间另有一次
fresh guided-compile 物理动作链，只负责 authoring/lineage，不产 receipt。三 runtime 串行。
## 3. Authority 模型
### 3.1 Source replay plan
```js
createSourceReplayPlanAuthority({
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
  executionTargetAuthority,
  source: {
    captureAuthority,
    candidateBytes,
    eventsBytes,
    entityLockBytes, // 首发 no-entity 固定 canonical UTF-8 []
    runNamespace,
  },
})
// -> { ok:true, authority, receipt } | { ok:false, reason }
```

所有 Buffer 与对象在入口立即复制、规范化、hash 并冻结；调用方后改原对象无效。
`executionTargetAuthority` 必须是现役 execution-target 模块铸造的 opaque capability，
不能用 caller 自报 build/profile digest 替代。`captureAuthority` 必须来自 exact final
capture admission，并与 source events bytes 一致。source plan 只允许一次成功 source 授权。
公开 receipt 仅含
`{schemaVersion,artifactKind,pairId,sourceCandidateSha256,sourceEventsSha256,
sourceEntityLockSetSha256}`，不含 target、URL、session 或原始 bytes。
### 3.2 Reset authority
```js
createResetAuthority({
  replayPlanAuthority, // source plan 或 finalized pair
  role,
  runNamespace,
  trustedResetIssuer,
})
```

低层函数恰调用一次：
```js
trustedResetIssuer.verifyReset({
  replayPlanAuthority,
  role,
  runNamespace,
})
```

adapter 返回：
```js
{
  resetReceiptBytes,
  resetPlanDigest,
  baselineProjectionSha256,
}
```

`resetReceiptBytes` 是闭合对象，内部必须含并精确匹配 pair、role、run namespace、receipt
instance、plan digest、baseline digest；内外冲突、异常、malformed、caller 直传 facts
均 `RESET_AUTHORITY_INVALID`。source/distilled reset instance 必须不同，baseline 必须相同。
生产 orchestrator 静态绑定 canonical reset adapter，不接受用户/CLI/LLM 注入 adapter。

### 3.3 Pre-run authority 与唯一执行边界
```js
authorizeSourceReplay({
  sourcePlanAuthority,
  role: 'source',
  runNamespace,
  resetAuthority,
  freshRuntimeAuthority,
  topologyAuthority,
  runtimeOwnerAuthority,
  executionTargetAuthority,
})

authorizeDistilledReplay({
  pairAuthority,
  role: 'distilled',
  runNamespace,
  sourceReceiptBytes,
  sourceReceiptAuthority,
  predecessorGrant,
  resetAuthority,
  freshRuntimeAuthority,
  topologyAuthority,
  runtimeOwnerAuthority,
  executionTargetAuthority,
})
```

adapter 先将 fresh/topology/owner 三件套私藏于 one-shot preparation cap；claim 再 exact
绑定 source plan+namespace+target 并转移三件套，拼接/clone/重用均拒。owner 归 core。
唯一 canonical issuer 在真实 execute 时调用
`consumeFreshReplayRuntimeAuthority({freshRuntimeAuthority,topologyAuthority})`。因此一个
fresh 只有一次消费点，raw runner 与 dual 层不得各消费一次。

source plan、pair 的每个 role 均只允许一次成功授权；换一份 genuine reset/fresh 也不能
对同一 role 重试直到 PASS。重试须新 pair/run namespace；二次固定 `RUN_ROLE_ALREADY_AUTHORIZED`。

### 3.4 两相 source completion 与 atom completion
raw source 先只封实际执行：
```js
executeAuthorizedSourceReplay({ runAuthority, trustedRawReplayIssuer })
// -> {ok:true,rawExecutionAuthority,cleanProofAuthority,sourceRuntimeOwnerAuthority}
```
raw issuer 的 `executeAndVerify({runExecutionAuthority})` 恰一次，exact 返回：
```js
{
  ok: true,
  runExecutionAuthority,
  runtimeOwnerAuthority,
  rawObservationAuthority,
  artifacts: { candidateBytes, eventsBytes, entityLockBytes },
  rawReplay: { status: 'CLEAN', cleanProofAuthority },
}
```
`rawObservationAuthority` 只按 `runtime-seams-design.md` §4 的 canonical session 铸；
raw execution non-consuming inspect 并核 exact run/capture/完整 seq/count，伪造或重用均拒。
模块内 observation plain/clone/replay 的 `RAW_OBSERVATION_AUTHORITY_INVALID` 在 completion
边界统一译为 `RUN_COMPLETION_INVALID`；仅 genuine foreign identity mismatch 译为
`RUN_COMPLETION_BINDING_MISMATCH`，内部 reason 不进入 completion 公共集合。
raw 结果禁止 axes/verdict/semantic evidence；因为 capture event 在 resolved mapping 前尚无
可信 intent 归属。raw execution 用 `inspectCleanRawReplayAuthority` 非消费验真并绑定 exact
capture hash；`consumeCleanRawReplay` 仍是 resolved projection 的唯一 consumer。

resolved projection 成功后，`issueSourceSemanticGrant({resolutionAuthority})` 与
`issueAtomRoundtripGrant({resolutionAuthority})` 各铸一次、各消费一次，互不抢占。
source semantic 第二相固定：
```js
completeResolvedSourceReplay({
  rawExecutionAuthority,
  sourceSemanticGrant,
  trustedResolvedSourceIssuer,
})
// -> {ok:true,completionAuthority,authoringBaselineGrant}
```
内部 canonical consume grant 得 opaque `resolvedProjectionAuthority`，再恰调用一次：
```js
trustedResolvedSourceIssuer.projectAndVerify({
  rawObservationAuthority,
  resolvedProjectionAuthority,
})
// exact -> {
//   ok:true, rawObservationAuthority, resolvedProjectionAuthority,
//   axesBytes, verdictBytes, evidence
// }
```
只有这里把逐 event observations 经 resolved seq→intent mapping 投影，并调用现役 axes/verdict；
两 authority 换绑、自由 evidence、unknown/动态字段或 expected 纵向不成立均不铸 source
completion。raw owner 已在第一相原样转给 core，第二相不再返回或重铸 owner。
`authoringBaselineGrant` 只绑定前置条件/reset baseline，不暴露 facts；clone/replay 固定
`AUTHORING_BASELINE_GRANT_INVALID`。

`completeAuthorizedReplay({runAuthority,trustedReplayIssuer})` 只允许 distilled atom role；
issuer exact 回同 execution+owner、source-free artifacts、axes/verdict/evidence，禁止
`rawReplay`。成功返回 completion 与同一 `distilledRuntimeOwnerAuthority`。所有 issuer
缺/多字段、throw、malformed 或换绑均 fail-closed。固定 reason：

- `REPLAY_ISSUER_INVALID`
- `RUN_COMPLETION_INVALID`
- `RUN_COMPLETION_BINDING_MISMATCH`
- `RUN_COMPLETION_AUTHORITY_INVALID`
- `RAW_EXECUTION_AUTHORITY_INVALID`
- `SOURCE_SEMANTIC_GRANT_INVALID`
- `SOURCE_SEMANTIC_COMPLETION_INVALID`
- `SOURCE_SEMANTIC_BINDING_MISMATCH`
- `ATOM_ROUNDTRIP_GRANT_INVALID`
- `AUTHORING_BASELINE_GRANT_INVALID`

### 3.5 Immutable pair finalization
```js
finalizeDualReplayPlanAuthority({
  sourcePlanAuthority,
  sourceCompletionAuthority,
  distilledCandidateAuthority,
})
// -> {
//   ok:true,
//   pairAuthority,
//   pairBoundSourceCompletionAuthority,
//   receipt,
// }
```

`distilledCandidateAuthority` 只由 runtime-cycle adapter 在真调用现役
`runAtomRoundtrip`、验证 flow-bridge/compile lineage、topology parity 与 entity runtime
授权后，调用 pair-authority 内部 `sealDistilledCandidateAuthority` 铸造；该 sealer 不从
public façade 导出，exact 输入为 `{roundtripCandidate,authoringClosureAuthority,
verifiedEntityLockHandle,verifiedEntityLockSetSha256,executionTargetAuthority}`，只返回
candidate authority；finalize 要求 verified set digest 与 source lock bytes digest 全等，
且不接收自由 `candidateBytes/eventsBytes`。finalization
消费原 source completion，核对 source plan exact bindings，再从 candidate authority
读取并冻结 distilled artifacts。失败不修改 source plan；成功后不能再次 finalize。固定
reason：

- `SOURCE_REPLAY_PLAN_AUTHORITY_INVALID`
- `DISTILLED_CANDIDATE_AUTHORITY_INVALID`
- `PAIR_FINALIZATION_BINDING_MISMATCH`

### 3.6 Semantic receipt 与 grants
```js
createSemanticReplayReceipt({
  completionAuthority,
})
// -> { ok:true, bytes, receipt, authority } | { ok:false, reason }

validateSemanticReplayReceipt(receipt)
issuePredecessorGrant({ receiptAuthority })
issueComparisonGrant({ receiptAuthority })
```

receipt 只能从 pair-bound completion 派生。`receiptAuthority` 是 exact-byte-bound、
opaque、不可 clone 的只读 multi-read capability；predecessor/comparison grant 分别
只能铸一次且只能消费一次。这样 source receipt 可先授权 distilled，再参与 comparator，
不会把“可多读收据”误写成“可重复授权”。

`authorizeDistilledReplay` 必须同时核对：

- source exact receipt bytes/authority；
- one-shot predecessor grant；
- source runtime owner set 与 distilled fresh 的 predecessor owner set 相同；
- exact source context 已 close 且 source browser 已 disconnected；
- distilled Browser/Context/Page 全部为新对象；
- source/distilled reset instance、run namespace 不同；
- reset plan、baseline、target、build/profile/kernel/session policy 相同。

关闭无关 runtime 而真正 source 仍在线，固定
`REPLAY_RUNTIME_OWNERSHIP_MISMATCH`。

### 3.7 Fresh receipt 与 attestation
fresh API 的公开诊断 receipt 保持无敏感常量形态：
```json
{
  "schemaVersion": 1,
  "lifecycle": "recording-closed/replay-new",
  "valuePersistence": "memory-only"
}
```

它不用于证明实例不同。模块私有 lifecycle attestation 另含非敏感唯一 nonce、owner
identity 与 topology binding；semantic receipt 只保存其 digest。跨进程时必须换成
canonical signed attestation，禁止把 plain JSON、session 值或 caller `fresh:true`
当 authority。

## 4. Production issuer 静态咬合

低层 completion/reset 单测可注入 double；生产入口不可注入。固定结构：

```text
casey teachin-cycle → bin/teachin-cycle.mjs（薄别名）→ bin/record.mjs
→ lib/teachin/replayability-cycle-entry.mjs → lib/teachin/dual-replay-orchestrator.mjs
→ static import lib/teachin/runtime-cycle-adapter.mjs
   ├─ canonicalRawReplayIssuer
   ├─ canonicalResolvedSourceIssuer
   ├─ canonicalAtomReplayIssuer
   ├─ canonicalResetIssuer
   └─ internal pair-authority sealer（只收 roundtrip result + verified entity handle）
```

orchestrator/CLI 参数不得出现 issuer、`fresh:true`、`reset:true`、`clean:true`、
`equivalent:true`；不得 dynamic import、读 env/global provider 或 import test support。
runtime-cycle adapter 必须真接现役 raw runner / atom replay / axes / verdict，不能复制。

同一模块导出依赖注入工厂供 zero-SUT 使用，但测试实例与生产实例走同一 WeakMap/校验路径：

```js
createRuntimeCycleAdapter({
  runRawReplay,
  runAtomRoundtrip,
  runCompiledReplay,
  verifyRuntimeEntityLock,
  projectAxes,
  runVerdict,
  verifyReset,
  verifyAuthoringReset,
  createCompileRun,
  compileFlow,
  closeRuntimeOwners,
  runtimeBootstrap,
  openFreshAuthoringRuntime,
  openFreshReplayRuntime,
})
// -> {
//   rawReplayIssuer, resolvedSourceIssuer, atomReplayIssuer, resetIssuer,
//   runAndSealDistilledCandidate, prepareSourceReplayRuntime,
//   claimPreparedSourceReplayRuntime, disposePreparedSourceReplayRuntime,
//   prepareDistilledReplayRuntime, closeReplayRuntimeOwners,
// }

adapter.runAndSealDistilledCandidate({
  atomRoundtripGrant,
  sourceClosureAuthority,
  authoringBaselineGrant,
  runNamespace,
  entityLockAuthority, // 仅 runtime-required 同进程可选；no-entity 不传
  executionTargetAuthority,
})
// 与 distilled 不同的 authoring namespace 内 fresh open→createCompileRun/compileFlow→close
// -> {ok:true, distilledCandidateAuthority, authoringClosureAuthority}
```

`prepareSourceReplayRuntime({runNamespace,executionTargetAuthority,recordingBrowser,
recordingContext})` 内部 witness→close/disconnect→canonical source bootstrap，只返回
`{ok:true,sourceRuntimePreparationAuthority}`；随后
`claimPreparedSourceReplayRuntime({sourceRuntimePreparationAuthority,sourcePlanAuthority,
runNamespace,executionTargetAuthority})` one-shot 转移 trio。claim 前失败只可由
`disposePreparedSourceReplayRuntime` 关闭 genuine prep；claim 后由 core finally 关闭 owner。
prep 伪造/重用固定 `REPLAY_RUNTIME_OWNERSHIP_MISMATCH`；物理 dispose 失败固定
`SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED`，其余 lifecycle 细节见 `runtime-seams-design.md`。
source semantic 完成后，core 必须调用
`closeReplayRuntimeOwners({runtimeOwnerAuthority})`，真实等待 exact source
Context close 与 Browser disconnected，成功 exact 返回 `{ok:true,sourceClosureAuthority}`；
runAndSeal 消费 closure/baseline/atom grant，在独立 authoring runtime 真 compile 后关闭；
随后固定调用
`adapter.prepareDistilledReplayRuntime({authoringClosureAuthority,pairAuthority,runNamespace,
executionTargetAuthority}) -> {ok,freshRuntimeAuthority,topologyAuthority,
runtimeOwnerAuthority}`。distilled owner 无论 receipt/compare 成败均由同一 generic close
在 finally 恰关闭一次，成功 exact `{ok:true}`；clone/foreign/replay owner 均
`REPLAY_RUNTIME_OWNERSHIP_MISMATCH`。关闭无关 runtime 不能满足 predecessor continuity。

不存在 `mintForTest` 或直接把 plain candidate 塞进 WeakMap 的捷径。production
orchestrator 静态导入已用现役依赖构造好的 `canonicalRuntimeCycleAdapter`，不接受 factory
或 provider 参数。
首发 `--no-login` 仍是 capture-only；任何跨进程 JSON 都不能重建 capture/preparation authority。

## 5. Pair 与 receipt 闭合 schema
pair shared binding：
- TestCase、expected、expected obligations；
- actual execution-target attestation 与 SUT build；
- channel/identity profile、replay kernel；
- reset plan、session policy。
role-specific binding：
- candidate、events、entity lock；
- run namespace、run ordinal；
- exact axes/verdict；
- reset receipt instance、fresh lifecycle attestation；
- distilled predecessor source receipt exact hash。
receipt 所有对象 exact-key 闭合，digest 为 `sha256:<64 lowercase hex>`，数组按 signed
TestCase intent 顺序规范化并拒重复。最小字段：

```jsonc
{
  "schemaVersion": 1,
  "artifactKind": "semantic-replay-receipt",
  "scope": "read-only-v1",
  "pairId": "pair_x",
  "role": "source",
  "runOrdinal": 1,
  "runNamespace": "src_x",
  "predecessorReceiptSha256": null,
  "binding": {
    "testcaseSha256": "sha256:...",
    "expectedSha256": "sha256:...",
    "expectedObligationsSha256": "sha256:...",
    "candidateSha256": "sha256:...",
    "eventsSha256": "sha256:...",
    "axesSha256": "sha256:...",
    "verdictSha256": "sha256:...",
    "entityLockSetSha256": "sha256:...",
    "executionTargetAttestationSha256": "sha256:...",
    "sutBuildDigest": "sha256:...",
    "channelProfileDigest": "sha256:...",
    "identityProfileDigest": "sha256:...",
    "replayKernelDigest": "sha256:...",
    "resetPlanDigest": "sha256:...",
    "sessionPolicyDigest": "sha256:..."
  },
  "freshness": {
    "resetReceiptSha256": "sha256:...",
    "baselineProjectionSha256": "sha256:...",
    "lifecycleAttestationSha256": "sha256:..."
  },
  "intents": [],
  "terminalHardPredicates": [],
  "topology": [],
  "entities": [],
  "effects": [],
  "cleanup": {
    "required": false,
    "status": "NOT_REQUIRED_READ_ONLY",
    "policySha256": "sha256:..."
  }
}
```

distilled 固定 `runOrdinal:2` 并绑定 source exact receipt hash。

禁止进入 receipt 或失败输出：

- host/origin/真实 URL、path、动态 query；
- locator、坐标、DOM handle、pageId/openerPageId；
- request/session/cookie/storage、原始 response；
- timestamp、duration、路径、日志、异常原文；
- 原始 platform ID/name/code；
- 任意 nested unknown key。

## 6. Semantic 纵向义务

comparator 不只证明“两边相等”，每个 receipt 在创建前还必须对 signed expected 纵向成立：

- intent 集合恰等，verdict/reason 来自 exact 现役 verdict；
- expected hard predicate 每项恰一，`PASS` 时全部 `ok:true`；
- topology 必须匹配 expected 冻结的
  `{intentId,ordinal,kind,routeProjectionSha256}`；
- entity 必须匹配 entity-lock/expected 的
  `{intentId,role,kind,identitySha256}`；
- effect 必须匹配 expected manifest，且每个 evidence ref 在同 receipt、同 intent 中真实存在；
- cleanup 只允许冻结 policy 明确的 `NOT_REQUIRED_READ_ONLY`。

双方同样走错 route、同样命中错实体、同样引用 dangling effect、或
`PASS/PASS + predicate false/false` 都不得 promotion。

动态 event/step/atom 数、locator、pageId、requestId、timestamp 不参与 semantic
comparison。topology 比较 intent + ordinal + kind + canonical route，不比较 action index。

## 7. Comparator 与固定首错

```js
compareSemanticReplayReceipts({
  pairAuthority,
  sourceReceiptBytes,
  sourceReceiptAuthority,
  sourceComparisonGrant,
  distilledReceiptBytes,
  distilledReceiptAuthority,
  distilledComparisonGrant,
})
```

成功固定返回：

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
    comparedDimensions: ['intent-verdict', 'terminal-hard-predicate', 'topology',
      'entity', 'effect', 'cleanup'],
  },
}
```

`equivalenceReceipt` 不含另一层 verdict/promotion 字段；orchestrator 原样携带该字段，不重组
或重判。失败严格只返回：

```json
{
  "ok": false,
  "equivalent": false,
  "promotionEligible": false,
  "reason": "STABLE_REASON"
}
```

固定首错顺序：

1. `COMPARISON_AUTHORITY_INVALID`
2. `RECEIPT_SCHEMA_INVALID`
3. `RECEIPT_AUTHORITY_INVALID`
4. `RECEIPT_HASH_MISMATCH`
5. `ROLE_PAIR_INVALID`
6. `ROLE_ARTIFACT_BINDING_MISMATCH`
7. `COMMON_BINDING_MISMATCH`
8. `RUN_NAMESPACE_COLLISION`
9. `PREDECESSOR_RECEIPT_MISMATCH`
10. `RESET_AUTHORITY_INVALID`
11. `RESET_RECEIPT_REUSED`
12. `BASELINE_PROJECTION_MISMATCH`
13. `EXECUTION_TARGET_AUTHORITY_INVALID`
14. `FRESH_RUNTIME_AUTHORITY_INVALID`
15. `REPLAY_RUNTIME_OWNERSHIP_MISMATCH`
16. `REPLAY_RUNTIME_REUSED`
17. `UNSUPPORTED_EFFECT_CLASS`
18. `INTENT_COVERAGE_MISMATCH`
19. `INTENT_VERDICT_MISMATCH`
20. `TERMINAL_PREDICATE_COVERAGE_MISMATCH`
21. `TERMINAL_PREDICATE_MISMATCH`
22. `TERMINAL_PREDICATE_NOT_SATISFIED`
23. `TOPOLOGY_EVIDENCE_MISSING`
24. `TOPOLOGY_ROUTE_UNCOMPARABLE`
25. `TOPOLOGY_MISMATCH`
26. `ENTITY_EVIDENCE_MISSING`
27. `ENTITY_MISMATCH`
28. `EFFECT_EVIDENCE_MISSING`
29. `EFFECT_MISMATCH`
30. `CLEANUP_EVIDENCE_MISSING`
31. `CLEANUP_MISMATCH`
32. `NON_PROMOTABLE_VERDICT`

未知 verdict/effect/enumeration、无法 canonicalize、重复 obligation 均
`RECEIPT_SCHEMA_INVALID`。四态中只有 `PASS` 可 promotion；
`SUT_DEFECT`、`HARNESS_ERROR`、`NEEDS_HUMAN` 即使两边完全相同也固定
`NON_PROMOTABLE_VERDICT`。

## 8. Executable golden matrix

所有 golden 使用固定字节、合成 execution-target authority 与对象 identity doubles；
零 SUT、零 browser、零 network、零 LLM。必须覆盖：

- authorize 后不执行不得铸 receipt，CLEAN 不得代替 verdict；
- issuer 恰调用一次，throw/malformed/错误 binding fail-closed；
- source plan → completion → immutable pair finalization，不允许假占位；
- source fresh 只消费一次，关闭无关 runtime 不得授权 distilled；
- source/distilled role 各一次，换新 reset/fresh 也不得重试；
- target clone/换绑、baseline mismatch、reset receipt 内外冲突；
- receipt bytes 改一字节、authority clone/forge/cross-pair/role swap；
- receipt multi-read，predecessor/comparison grant one-shot；
- PASS + 双 false predicate、双方同 route/entity/effect 错误；
- 四种 non-PASS/unknown enum；
- nested unknown key 与失败输出 hygiene；
- dynamic fields 差异不制造假红。

## 9. 模块与文件预算

生产建议拆分：
| 文件 | 责任 | 上限 |
|---|---|---:|
| `lib/dual-replay/source-plan-authority.mjs` | 已知 source 真值与 target binding | 220 |
| `lib/dual-replay/pair-authority.mjs` | internal candidate seal / pair finalization ratchet | 260 |
| `lib/dual-replay/run-authority.mjs` | reset、run、predecessor continuity | 300 |
| `lib/dual-replay/replay-completion.mjs` | issuer 一次调用与 completion capability | 280 |
| `lib/dual-replay/receipt-shape.mjs` | 闭合 schema/canonical order | 280 |
| `lib/dual-replay/semantic-projection.mjs` | expected 纵向投影 | 320 |
| `lib/dual-replay/comparator.mjs` | 固定首错纯比较 | 320 |
| `lib/dual-replay/index.mjs` | 薄 façade | 100 |
| `lib/page-topology/semantic-projection.mjs` | intent-anchored route projection | 180 |
| `lib/teachin/raw-event-observation.mjs` | per-event observation authority/session | 260 |
| `lib/teachin/entity-lock-verifier.mjs` | canonical handle + publication set digest | 160 |
| `lib/teachin/runtime-cycle-adapter.mjs` | canonical raw/distilled/reset issuers | 300 |
| `lib/teachin/dual-replay-orchestrator{-core,}.mjs` | 三 runtime、两 evidence replay 编排 | 300/180 |

生产、golden、静态门和 CLI 每个文件均硬性 `<600` 行。接近上限必须拆分，不能删断言。

# teachin-replayability-closure 实施计划

## 1. 目标

完成一个不冒充正式测试结论的示教技术闭环：

```text
manual capture exact bytes
→ 同进程 application service 准入并真实关闭录制 runtime
→ canonical bootstrap 新开 source fresh runtime
→ raw source reproduction
→ clean proof authority
→ resolved existing-atom projection
→ 现役 flow-bridge/compile
→ distilled fresh runtime
→ semantic replay receipt pair
→ deterministic equivalence
```

本契约不让 LLM 进入 replay、proof、receipt、comparator 或 verdict；LLM 只能在 CLI 外提出 mapping 候选。机器执行前由确定性门证明候选逐 event 忠实。

决策细节见 `docs/plans/teachin-replayability-closure/GRILL.md`。

## 2. 非目标

- 不给 capture 增加 `signed:true` 或 `replayReady:true`；
- 不绕过现役 intake、flow-bridge、compile、draft、sign、replay、verdict；
- 不实现 mutation/relation/destructive、持久化 setup 或 cleanup；
- 不实现跨 origin SSO、iframe、shadow DOM、canvas、上传、下载、CEF；
- 不把 `CLEAN`、`REPRODUCED`、`EQUIVALENT` 写成正式 `PASS`；
- 不运行 fake SUT、fixture SUT、浏览器或网络作为 acceptance；
- 不读取真实配置、凭据或目标值。

## 3. 冻结接口

### 3.1 Fresh lifecycle authority

`lib/teachin/fresh-runtime.mjs`：

```js
createFreshReplayWitness({
  recordingBrowser,
  recordingContext,
})

authorizeFreshReplayRuntime({
  witness,
  replayBrowser,
  replayContext,
  replayPage,
  topologyAuthority,
})

consumeFreshReplayRuntimeAuthority({
  freshRuntimeAuthority,
  topologyAuthority,
})
```

只有录制 browser/context 的真实终止事件已观察到，且新 browser/context/page 对象身份与归属正确，才返回一次性 `freshRuntimeAuthority`。公开 receipt 只含：

```json
{
  "schemaVersion": 1,
  "lifecycle": "recording-closed/replay-new",
  "valuePersistence": "memory-only"
}
```

receipt 不含对象、地址、session 值、时间戳或可伪造 freshness 布尔字段。
replay Browser、Context、Page 任一对象不得二次铸权。dual authorizer 只把 genuine
fresh authority 封入 opaque run record；唯一 canonical replay issuer 在实际调用 raw/atom
runner 时原子消费，禁止 dual 层与 runner 对同一 fresh 双消费。
首发 full-cycle 只从 `record --login-bootstrap` 同进程交 live handles；`--no-login`
只产 capture，不声称闭环，plain JSON 不能跨进程重建任何 capability。

### 3.2 Capture admission

`lib/teachin/raw-capture.mjs`：

```js
admitRawReplayCapture({
  caseId,
  captureBytes,
})

inspectAdmittedRawReplayCapture({
  captureAuthority,
})
```

成功返回 opaque `captureAuthority`、公开 `captureSha256` 和 `eventCount`。authority
内保存从 exact final bytes 解析并复制的闭合文档；调用方后续对象修改或换文件无效。
capture authority 是不可伪造但可多次 inspect 的只读 capability，raw runner 不消费它；
每次 inspect 返回相互独立的 bytes 与深拷贝 document。一次性的只有 fresh、clean、
reset、run 与 semantic receipt authority。

固定 reason：

- `RAW_CAPTURE_INPUT_INVALID`
- `RAW_CAPTURE_INVALID`
- `CAPTURE_CASE_MISMATCH`
- `CAPTURE_EVENTS_EMPTY`
- `CAPTURE_SEQ_INVALID`
- `CAPTURE_SEQ_DUPLICATE`
- `CAPTURE_SEQ_GAP`
- `CAPTURE_PATH_INVALID`
- `MASKED_FILL_UNREPLAYABLE`（兼容历史 reason 名；语义覆盖任意 masked/redacted 敏感证据）
- `FILL_VALUE_UNAVAILABLE`
- `SELECTOR_UNAVAILABLE`
- 现役 `TOPOLOGY_*` / `PAGE_HANDOFF_AMBIGUOUS`

### 3.3 Raw replay

`lib/teachin/raw-replay-runner.mjs`：

```js
runRawReplay({
  captureAuthority,
  freshRuntimeAuthority,
  executionTargetAuthority,
  topologyAuthority,
  actionDriver,
})

admitAndRunRawReplay({
  caseId,
  captureBytes,
  freshRuntimeFactory,
  topologyAuthority,
  executionTargetAuthority,
  actionDriver,
})
```

规则：

1. `admitAndRunRawReplay` 是唯一 admission→runtime 编排边界；全包准入失败时
   fresh factory、path read、resolve 与 perform 调用数全部为零；
2. `runRawReplay` 在读取页面前 inspect capture capability，并原子消费 fresh authority；
   capture 仍可多读，fresh 后续失败也不得重放；
3. 每个业务 event 前读取活动页安全 path+query 并精确比较；
4. `nav` 只消费 checkpoint，`goto` 调用数恒为零；
5. `actionDriver.resolve` 只做定位并返回 opaque action authority，selector count 只接受恰一；
6. 只有 unique authority 才能进入 `actionDriver.perform`；none/ambiguous 首错停止且
   perform spy 恒为零；`ACTION_FAILED` 只能来自一次真实 perform 已发生后的失败结果；
7. `newpage` 经现役 replay topology bridge 消费；
8. 只有全部 event 消费才产 `CLEAN` 与一次性 `cleanProofAuthority`。

`lib/teachin/raw-proof.mjs`：

```js
consumeCleanRawReplay({
  cleanProofAuthority,
  currentCaptureBytes,
})

inspectCleanRawReplayAuthority({
  cleanProofAuthority,
})
```

exact bytes/hash 一致且 authority 未消费才允许进入 atom roundtrip。
`inspectCleanRawReplayAuthority` 是非消费式 WeakMap 真伪检查，只返回
`{ok:true,captureSha256}`；dual completion 用它拒 plain/clone proof，resolved projection
仍须用 `consumeCleanRawReplay` 恰一次推进。

### 3.4 Resolved atom projection

`lib/teachin/resolved-projection.mjs`：

```js
resolveCaptureProjection({
  captureAuthority,
  cleanProofAuthority,
  mappingCandidate,
  atomRegistry,
  authoredTestCase,
})
```

projection 必须先通过 `inspectAdmittedRawReplayCapture` 取得 authority 绑定的 exact bytes
与深拷贝 capture，再用这份 bytes 消费 `cleanProofAuthority`；调用方不得另传
`currentCaptureBytes`，避免 capture/proof 换包。

mapping 行最小形态：

```json
{
  "intentId": "i1",
  "atom": "workflow.open",
  "params": {},
  "evidenceEventSeqs": [1]
}
```

输出：

```json
{
  "candidateTestCase": {},
  "candidateMapping": [],
  "resolved": [],
  "pending": [],
  "projection": [],
  "coverage": {
    "mappedEventSeqs": [],
    "pendingEventSeqs": [],
    "structuralEventSeqs": []
  }
}
```

不变量：

- eventSeq 全覆盖且不重复；
- coverage compound key 固定为 `${eventSeq}:${action}`，`intentId` 只作业务归组；
- mapped∩pending 为空；
- mapping atom 必须存在于现役 registry；
- event action 与 atom action/effect/identity 契约兼容；
- mapped step 删除 `route/reason`；
- topology event 以结构 projection 保留，不占独立业务 step；
- candidate 继续走现役 flow-bridge。
- 可选 `authoredTestCase` 的 preconditions、逐 step expected、globalAssertions、
  uniquePrefix 只能原样复制；candidate 不经调用方补写即可进入现役 flow-bridge。

已准入但未支持的 action 固定 pending 为 `UNSUPPORTED_ACTION`；支持的 action 未唯一
命中 recipe 固定 pending 为 `KNOWN_RECIPE_MISSING`，两者不得互换。

固定 reason：

- `CLEAN_PROOF_AUTHORITY_INVALID`
- `CAPTURE_HASH_MISMATCH`
- `MAPPING_INVALID`
- `MAPPING_EVENT_OUT_OF_RANGE`
- `MAPPING_EVENT_DUPLICATE`
- `MAPPED_PENDING_OVERLAP`
- `CAPTURE_EVENT_UNCOVERED`
- `CAPTURE_EVENT_MULTI_COVERED`
- `MAPPING_ACTION_MISMATCH`
- `MAPPING_ATOM_UNKNOWN`
- `MAPPING_IDENTITY_MISMATCH`
- `MAPPING_EFFECT_MISMATCH`
- `TOPOLOGY_COVERAGE_MISMATCH`

### 3.5 Staged pair、completion 与 semantic receipt

生产拆分固定为：

- `lib/dual-replay/source-plan-authority.mjs`
- `lib/dual-replay/pair-authority.mjs`
- `lib/dual-replay/run-authority.mjs`
- `lib/dual-replay/replay-completion.mjs`
- `lib/dual-replay/receipt-shape.mjs`
- `lib/dual-replay/semantic-projection.mjs`
- `lib/dual-replay/comparator.mjs`
- `lib/dual-replay/index.mjs`
- `lib/page-topology/semantic-projection.mjs`

禁止在 source 执行前为尚不存在的 distilled candidate 填占位。固定 authority 状态机：

```text
createSourceReplayPlanAuthority
→ claimPreparedSourceReplayRuntime
→ createResetAuthority(source)
→ authorizeSourceReplay
→ executeAuthorizedSourceReplay(canonical raw issuer)
→ resolveCaptureProjection
→ issueSourceSemanticGrant → completeResolvedSourceReplay(canonical axes/frozen-verdict issuer)
→ issueAtomRoundtripGrant
→ exact source owners close/disconnect
→ runAndSealDistilledCandidate（内部 authoring fresh/precondition/reset/flow-bridge/compile/close）
→ finalizeDualReplayPlanAuthority
→ createSemanticReplayReceipt(pair-bound source completion)
→ prepareDistilledReplayRuntime(authoring closure)
→ createResetAuthority(distilled)
→ issuePredecessorGrant(source receipt) → authorizeDistilledReplay
→ completeAuthorizedReplay(canonical atom issuer)
→ createSemanticReplayReceipt
→ one-shot comparison grants
→ compareSemanticReplayReceipts
→ exact distilled owners close/disconnect
```

核心 façade API：

```js
createSourceReplayPlanAuthority(options)
authorizeSourceReplay(options)
executeAuthorizedSourceReplay({ runAuthority, trustedRawReplayIssuer })
completeResolvedSourceReplay({
  rawExecutionAuthority,
  sourceSemanticGrant,
  trustedResolvedSourceIssuer,
})
completeAuthorizedReplay({ runAuthority, trustedReplayIssuer }) // distilled only
finalizeDualReplayPlanAuthority({
  sourcePlanAuthority,
  sourceCompletionAuthority,
  distilledCandidateAuthority,
})
createSemanticReplayReceipt({ completionAuthority })
validateSemanticReplayReceipt(receipt)
issuePredecessorGrant({ receiptAuthority })
issueComparisonGrant({ receiptAuthority })
authorizeDistilledReplay(options)
compareSemanticReplayReceipts(options)
```

`resolved-projection.mjs` 另导出
`issueSourceSemanticGrant({resolutionAuthority})` 与
`issueAtomRoundtripGrant({resolutionAuthority})`。两枚 grant 各只可铸/消费一次：
前者只把 canonical `resolvedProjectionAuthority` 交给 source axes/verdict issuer，后者只把
`atomRoundtripGrant` 交给现役 flow-bridge/compile；二者互不替代。

`createResetAuthority` 只从 `run-authority.mjs` 导出：

```js
createResetAuthority({
  replayPlanAuthority,
  role,
  runNamespace,
  trustedResetIssuer,
})
```

它恰调用一次
`trustedResetIssuer.verifyReset({replayPlanAuthority,role,runNamespace})`，只认返回的闭合
exact reset receipt、plan digest、baseline projection；caller 直传 facts/布尔信任、
内外冲突、异常或 malformed 均 `RESET_AUTHORITY_INVALID`。source/distilled reset instance
与 namespace 必须不同，baseline/plan 必须相同。

`authorizeSourceReplay`/`authorizeDistilledReplay` 把 reset、fresh、topology、runtime owner、现役
`executionTargetAuthority` 封入私有 run record，但不消费 fresh。source 分成两相，避免在
事件到 intent 的 resolved mapping 尚不存在时伪造 axes：

1. `executeAuthorizedSourceReplay` 只允许 raw issuer 恰执行一次，返回 genuine CLEAN、
   source artifacts、逐 event `rawObservationAuthority` 与同一 owner；禁止返回
   axes/verdict/semantic evidence；
2. `resolveCaptureProjection` 消费 CLEAN 并确定性验证 event seq → authored intent → known atom；
3. `completeResolvedSourceReplay` 消费 source semantic grant，canonical issuer 只接
   `rawObservationAuthority + resolvedProjectionAuthority`，复用现役 axes 投影与 frozen
   verdict 子进程接缝后才铸 source completion。

`completeAuthorizedReplay` 只用于已经具备 formal events 的 distilled role。authorize-only、
caller-filled artifacts/evidence、plain CLEAN、未验证 mapping 或换绑 target 均不能铸 receipt。

`distilledCandidateAuthority` 只能由 `lib/teachin/runtime-cycle-adapter.mjs` 在真调用
`runAtomRoundtrip`、验证 flow-bridge/compile lineage、topology parity，以及
canonical verifier exact 返回 `mode:not-required/runtimeAuthorized:false` 或 `mode:runtime-required/runtimeAuthorized:true` + `setSha256` 后，经内部
`sealDistilledCandidateAuthority({roundtripCandidate,authoringClosureAuthority,
verifiedEntityLockHandle,verifiedEntityLockSetSha256,executionTargetAuthority})` 铸造；
该 sealer exact 只返回
`{ok:true,distilledCandidateAuthority}`，且不从 public façade 导出；
finalizer 不接收自由 distilled bytes。source plan 与每个 role 都是一次性 ratchet，
失败重试必须新建 pair/namespace，不能换一份 fresh/reset 重跑直到 PASS。

`receiptAuthority` 是 exact-byte-bound 的 opaque 多读 capability；predecessor 与
comparison grant 各自只铸一次、只消费一次。distilled 必须绑定 exact source receipt
hash、相同 execution target/build/profile/kernel/session policy、相同 reset baseline，
以及不同 reset/fresh owner instance。关闭无关 runtime 而 source owner 仍在线固定
`REPLAY_RUNTIME_OWNERSHIP_MISMATCH`。

semantic receipt 只含 canonical digest 与稳定 intent/predicate/topology/entity/effect/
cleanup 投影，不含真实 URL、locator、动态 ID、时间戳或 session 值。创建 receipt 前必须
逐项对 signed expected 纵向成立，防止两边同样走错仍判等。比较固定按
authority/schema/hash → role/artifact/shared binding → namespace/predecessor →
reset/baseline/target/fresh ownership → effect scope → intent/verdict → hard predicate →
topology → entity → effect → cleanup → non-promotable verdict 首错。失败闭合返回：

```json
{"ok":false,"equivalent":false,"promotionEligible":false,"reason":"STABLE_REASON"}
```

仅两边 genuine receipt 语义相同、fresh/reset 独立、所有 signed 义务满足且逐 intent
现役 verdict 都是 `PASS` 时，技术 comparison 才成功；成功仍不是正式报告结论。

## 4. 实施切片

### S1 Capture + fresh authority

1. 建 lifecycle witness 与一次性 fresh authority；
2. 建 exact bytes capture authority 与多读深拷贝 inspector；
3. 全包校 seq、任意 masked/redacted 敏感证据、selector、topology；
4. 所有拒绝路径零 action driver 调用；
5. 公开 receipt 全部脱敏。

### S2 Raw source replay

1. 建 path checkpoint 与 selector unique driver；
2. `nav` 零 `goto`；
3. click/dblclick/fill/press 首错停止；
4. newpage 复用现役 topology；
5. 每个 event 同次采 action/断言通道/取证/topology observation，铸 opaque
   `rawObservationAuthority`；此阶段不猜 intent、不产 axes/verdict；
6. 产诊断 proof 与一次性 clean proof authority；
7. 建薄 `bin/teachin-raw-replay.mjs`，不把底层参数暴露给用户自然语言面。

### S3 Resolved atom roundtrip

1. mapping 候选使用逐 event `evidenceEventSeqs`；
2. 纯函数计算 mapped/pending/coverage；capture admission 已拒绝的纯坐标或 masked
   敏感证据不得在本阶段重新准入；
3. existing atom registry 准入；
4. topology 独立覆盖；
5. 输出 resolved candidate；
6. `resolutionAuthority` 只负责各铸一次 source-semantic/atom-roundtrip grant，本身不直接
   进入执行器；
7. 同一 resolution 分别铸 source-semantic 与 atom-roundtrip one-shot grant；
8. source grant 把逐 event observations 按已验证 intent lineage 投给现役 axes/frozen verdict；
9. 真调用注入的现役 compile adapter，冻结 exact lineage、首错与 contract mutation；
10. 现役 `compileFlow` 会真实操作页面，因此在独立 guided-compile authoring runtime 中
    fresh/reset/执行/关闭；它是第三次物理动作链但不铸 replay receipt、不参与等价比较，
    绝不续用 source replay 终态；
11. 经现役 flow-bridge/compile 接缝，不复制编译器，不把技术 candidate 冒充正式 `PASS`。

### S4 Semantic receipt + equivalence

1. 先建 source plan，claim genuine prepared runtime 后验证 live reset；
2. raw execute seal 与 resolved source semantic completion 分相，映射未验证前不得产 axes/verdict；
3. source semantic completion 必须同时绑定 genuine raw observation、resolved projection、
   exact artifacts 与现役 frozen verdict，并只签发 opaque one-shot
   `authoringBaselineGrant`，不公开 baseline facts；
4. 真执行完成后才用 genuine distilled candidate immutable finalize pair；
5. 从 pair-bound completion 投影 signed-expected 纵向成立的最小 semantic receipt；
6. receipt 可多读，predecessor/comparison grant 各一次；
7. comparator 固定首错；同为非 `PASS`、同错 route/entity/effect/predicate 都不得晋升；
8. 动态字段差异不得制造假红。

### S5 Orchestration boundary

Exact input/core/facade 与 23 步次序见 `orchestrator-design.md`。

1. 建薄 `atom-roundtrip.mjs`、`replayability-cycle-entry.mjs`、`runtime-cycle-adapter.mjs`、
   `dual-replay-orchestrator-core.mjs` 与 `dual-replay-orchestrator.mjs`；
2. adapter 工厂供 zero-SUT 注入现役接缝；生产 orchestrator 静态绑定 canonical adapter，
   对外不接 issuer/provider/factory；
3. source raw execute → resolved semantic completion → source owner 关闭 → 独立 authoring
   compile/关闭 → pair finalize → distilled replay → compare 顺序不可跳跃；source raw 只由 core 执行一次；
4. source/authoring/distilled 使用两两不同 namespace；两次 evidence replay 的 reset 与 fresh
   authority 不同；失败后后续业务 stage 调用数
   为零，但已取得的 prepared/runtime owner required cleanup 仍必须恰执行一次；
5. 不接受 `{fresh:true}`、`clean:true`、`equivalent:true` 或 caller-filled receipt；
6. 输出 exact `{ok:true,developmentOnly:true,promotionReady:false,equivalenceReceipt}`，
   技术等价不冒充正式报告 `PASS`。

### S6 Adjacent + structure

1. 现役 capture 的三元降权不变；
2. intake/distill/sign/replay/verdict 无旁路；
3. page topology、execution-target、agent-id、output-seal 邻接门保持；
4. 新增或修改生产/golden 文件逐个严格少于 600 行；
5. 纯核心不 import browser、fs、network、LLM、verdict/report；
6. CLI 只薄接线，真实值与异常原文不进入输出。

冻结生产 manifest 还必须含：

```text
lib/teachin/fresh-runtime.mjs
lib/teachin/raw-capture.mjs
lib/teachin/raw-action.mjs
lib/teachin/raw-replay-runner.mjs
lib/teachin/raw-playwright-driver.mjs
lib/teachin/raw-event-observation.mjs
lib/teachin/raw-axes-adapter.mjs
lib/teachin/raw-proof.mjs
lib/teachin/raw-proof-output.mjs
lib/teachin/verdict-cli-adapter.mjs
lib/teachin/compile-runtime-adapter.mjs
lib/teachin/runtime-bootstrap.mjs
lib/teachin/entity-lock-verifier.mjs
lib/teachin/runtime-owner.mjs
lib/teachin/resolved-projection.mjs
lib/teachin/atom-roundtrip.mjs
lib/teachin/replayability-cycle-entry.mjs
lib/teachin/runtime-cycle-adapter.mjs
lib/teachin/dual-replay-orchestrator-core.mjs
lib/teachin/dual-replay-orchestrator.mjs
lib/teachin-distillation/{event-projection,atom-resolution,fidelity,flow-candidate,compile-lineage,formal-candidate}.mjs
lib/dual-replay/{source-plan-authority,pair-authority,run-authority,replay-completion,receipt-shape,semantic-projection,comparator,index}.mjs
lib/replay/{action-authority,intent-observation,prepared-run}.mjs
lib/{replay-actions,replay-axes,compile-atoms,compile-atoms-run,compile-atoms-flow}.mjs
lib/replay/event-runner.mjs
lib/{login-bootstrap,replay-forensics,entity-semantic-lock-v2,entity-semantic-lock-publications,entity-semantic-lock-preflight,promptset-authoring}.mjs
lib/execution-target/{runtime,wiring}.mjs
lib/page-topology/{replay-session,semantic-projection}.mjs
lib/replay/origin-admission.mjs
lib/flow-bridge.mjs
lib/atoms-registry.snapshot.json
bin/{teachin-raw-replay,teachin-cycle,record,casey,verdict}.mjs
```

## 5. Acceptance 映射

| Story | 可执行验收 | 实现前预期 |
|---|---|---|
| S1 | `node tests/_golden/teachin-replayability-capture-fresh.zero-sut.golden.mjs` | RED：模块缺失 |
| S1/S2 action | `node tests/_golden/teachin-replayability-raw-actions.zero-sut.golden.mjs` | RED：模块缺失 |
| S1/S2 action gate | `node tests/_golden/teachin-replayability-action-authority.zero-sut.golden.mjs` | RED：shared production authority gate 缺失 |
| S2 | `node tests/_golden/teachin-replayability-raw-runner.zero-sut.golden.mjs` | RED：模块缺失 |
| S2 proof | `node tests/_golden/teachin-replayability-clean-proof.zero-sut.golden.mjs` | RED：模块缺失 |
| S2 output | `node tests/_golden/teachin-replayability-raw-output-seal.zero-sut.golden.mjs` | RED：模块缺失 |
| S2/S4 judge | `node tests/_golden/teachin-replayability-verdict-cli-adapter.zero-sut.golden.mjs` | RED：frozen judge 子进程 adapter 缺失 |
| S2 observations | `node tests/_golden/teachin-replayability-raw-event-observation.zero-sut.golden.mjs` | RED：同次逐 event observation authority 缺失 |
| S2/S4 raw axes | `node tests/_golden/teachin-replayability-raw-axes-adapter.zero-sut.golden.mjs` | RED：resolved raw axes/verdict adapter 缺失 |
| S3 | `node tests/_golden/teachin-replayability-resolved-projection.zero-sut.golden.mjs` | RED：模块缺失；现役 projectCapture 全 pending |
| S3 authority | `node tests/_golden/teachin-replayability-resolved-authority-coverage.zero-sut.golden.mjs` | RED：模块缺失 |
| S3 roundtrip | `node tests/_golden/teachin-replayability-atom-roundtrip.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 completion | `node tests/_golden/teachin-replayability-equivalence-completion.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 source semantics | `node tests/_golden/teachin-replayability-equivalence-resolved-completion.zero-sut.golden.mjs` | RED：两相 source completion 缺失 |
| S4 core | `node tests/_golden/teachin-replayability-equivalence-core.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 reset | `node tests/_golden/teachin-replayability-equivalence-reset.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 sequence | `node tests/_golden/teachin-replayability-equivalence-sequence.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 integrity | `node tests/_golden/teachin-replayability-equivalence-integrity-authority.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 semantics | `node tests/_golden/teachin-replayability-equivalence-integrity-semantics.zero-sut.golden.mjs` | RED：模块缺失 |
| S4 evidence | `node tests/_golden/teachin-replayability-equivalence-evidence.zero-sut.golden.mjs` | RED：模块缺失 |
| S5 | `node tests/_golden/teachin-replayability-orchestrator.zero-sut.golden.mjs` | RED：模块/编排缺失 |
| S5 wiring | `node tests/_golden/teachin-replayability-orchestrator-wiring.static.golden.mjs` | RED：生产静态咬合缺失 |
| S5 runtime | `node tests/_golden/teachin-replayability-runtime-cycle-adapter.zero-sut.golden.mjs` | RED：三 runtime canonical assembler 缺失 |
| S5 entry | `node tests/_golden/teachin-replayability-cycle-entry.zero-sut.golden.mjs` | RED：同进程录制→source 入口缺失 |
| S5 entity | `node tests/_golden/teachin-replayability-entity-verification.zero-sut.golden.mjs` | RED：no-entity/runtime-required canonical verifier 缺失 |
| S5 bootstrap | `node tests/_golden/teachin-replayability-runtime-bootstrap.zero-sut.golden.mjs` | RED：跨平台 fresh runtime bootstrap 缺失 |
| S5 authoring | `node tests/_golden/teachin-replayability-compile-runtime-adapter.zero-sut.golden.mjs` | RED：独立 authoring runtime/compile/close 缺失 |
| S5 prepared replay | `node tests/_golden/teachin-replayability-prepared-run.zero-sut.golden.mjs` | RED：claimed runtime 内现役 event replay/axes 缺失 |
| S5 production boundary | `node tests/_golden/teachin-replayability-equivalence-production-boundary.static.golden.mjs` | RED：canonical production adapter 缺失 |
| S5/S6 | `node tests/_golden/teachin-replayability-boundaries.static.golden.mjs` | RED：模块/CLI/静态咬合缺失 |
| 邻接 | `node tests/_golden/teachin-replayability-adjacent.zero-sut.golden.mjs` | GREEN：只运行既有零 SUT 纯检查 |

邻接 story 还固定运行以下经源码审计的现役零 SUT 命令：

```text
node tests/_golden/record-capture.golden.mjs
node tests/_golden/record-intake.golden.mjs
node tests/_golden/record-distill.golden.mjs
node tests/_golden/page-topology-auth-continuity-controller.zero-sut.golden.mjs
node tests/_golden/page-topology-auth-continuity-pipeline.zero-sut.golden.mjs
node tests/_golden/page-topology-auth-continuity-replay-action.zero-sut.golden.mjs
node tests/_golden/cross-platform-execution-target-core.zero-sut.golden.mjs
node tests/_golden/cross-platform-execution-target-runtime.zero-sut.golden.mjs
node tests/_golden/cross-platform-execution-target-cli-output-seal.zero-sut.golden.mjs
node tests/_golden/cross-platform-execution-target-hardening.zero-sut.golden.mjs
node tests/_golden/cross-platform-execution-target-login-origin.zero-sut.golden.mjs
node tests/_golden/cross-platform-execution-target-adjacent-regression.zero-sut.golden.mjs
node tests/_golden/agent-id-gate.zero-sut.golden.mjs
node tests/_golden/p2-verdict.golden.mjs
node tests/_golden/p2-verdict-coverage.golden.mjs
node tests/_golden/model-lane-guard.golden.mjs
node tests/_golden/resolution.golden.mjs
node tests/_golden/gen-prompts.golden.mjs
node tests/_golden/entity-rename-unknown-action-guard.zero-sut.golden.mjs
node tests/_golden/regress-agent-tool-actions.zero-sut.golden.mjs
node tests/_golden/p5-replay-coverage.golden.mjs
```

所有新能力门必须在实现前真实 RED；全部邻接命令冻结时必须真实 GREEN。测试、proof 与
计划写入 sha256 后由唯一 `gate` 消费，`passes` 初始化为 false。

## 6. Observability

以下维度无法由 zero-SUT 证明，必须 route human：

- AI 中台真实 browser/context 生命周期与登录连续性；
- Windows native direct 的新标签页/login continuity：canonical 逻辑目标不得改写成
  WSL-only loopback transport；隧道只在明确 WSL mode 使用；
- raw source 在 current build 与 version-held-out build 的复现；
- source/distilled 两次真实独立 fresh runtime；
- 独立 guided-compile authoring runtime 使用相同前置 workflow/reset baseline，且不与两次
  evidence replay 共用 browser/context/owner；
- source/distilled 正式 draft/sign/replay/verdict/report；
- setup→body 独立场景；
- 医生站 site-held-out；
- Hi 小助 CEF/iframe/shadow/container；
- AI 中台、医生站、Hi 小助真实页面的 name+code 与 signed platform ID 双定位/回读；
- driver receipt 的真实生产签发；
- 至少三份带录屏正式报告与用户明确验收。

## 7. 退出条件

本契约只有在以下条件全部满足时可进入 review：

1. Acceptance 表全部新能力命令真实转绿；
2. Acceptance 表全部邻接/回归命令保持绿；
3. PRD checksum 全匹配，story 全由唯一 `gate` 写为 true；
4. 独立评审没有未关闭的 Critical/High/Medium；
5. 触及文件逐个严格少于 600 行；
6. 文档明确保持 `developmentOnly:true/promotionReady:false`；
7. 真实 UAT 未做时不得宣称录制成功、正式 PASS 或 GitHub 发布就绪。

## 8. 用户验收交付协议

- 需要用户裁定、需要用户查看测试报告，或能可靠观测到周限低于 `5%` 时，通过已配置邮件链通知；
- 测试报告先转为 PDF 再作为邮件附件；
- 回放录像转为手机邮箱客户端可播放的 MP4；转码后仍保留原始录像作为取证源；
- 邮件发送遵守两阶段确认；没有可可靠观测的周限数据时不得猜测或伪报阈值。

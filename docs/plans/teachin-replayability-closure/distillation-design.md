# teachin-replayability-closure：蒸馏设计

## 1. 范围与目标

本设计只闭合以下链路：

```text
已入账 Teach-in Capture
  → 逐事件 capture projection
  → 已有 atom 的 resolved projection
  → TestCase candidate + flow-bridge mapping candidate
  → 现有 flow-bridge
  → 现有 compile
  → distilled formal candidate
```

不在本设计内处理录制成功证明、原始回放、断言生成、身份签署、effect policy 发布、裁定、报告或原子晋升。蒸馏产物仍是非权威候选，不得置 `signed:true` 或 `replayReady:true`，也不得绕过 `ingest → flow-bridge → compile → draft → sign`。

目标是把当前“全 pending”基线增量翻为：

- 能由现役确定性 recipe 且现役 compile 知识证明的事件，优先复用已有 atom；
- 证不出的事件继续显式 pending；
- 每个 capture event 都有独立、不可被共享 `intentId` 去重的 coverage 身份；
- `newpage` 保留为结构事件，随触发 intent 进入 formal candidate；
- mapping 只决定 atom 与参数，不获得修改 expected、identity 或 effect 的权力。

首版 resolved/roundtrip 正控只使用现役 frozen side-effect/entity policy 已明确判为
`effect=read` 且不要求 identity binding 的 atom。`nav.agentManagement`、
`agent.searchOpen` 等当前会被现役 policy 要求 identity 的 atom，不得作为无 authority 正控。

## 2. 核心不变量

### 2.1 逐事件复合键

每个 capture event 先投影为：

```json
{
  "compoundKey": "13:newpage",
  "intentId": "i12",
  "eventSeq": 13,
  "action": "newpage",
  "pathHint": "/agents?view=all",
  "role": "structural",
  "triggerCompoundKey": "12:click"
}
```

`compoundKey` 的规范形式固定为 `${eventSeq}:${action}`，即 closed shape
`{eventSeq, action}` 的稳定字符串投影。coverage 判等必须同时比较权威 capture event 的
`eventSeq` 与 `action`；`intentId` 只作业务归组，禁止用它建 coverage `Set`。

输入事件须满足：

- `eventSeq` 是正安全整数；
- 按 capture 顺序严格递增且唯一；
- `compoundKey` 全局唯一；
- projection 顺序与 capture 顺序相同；
- `pathHint` 继续使用现役 host-free path+query 规范化，不带 scheme、host 或 fragment。

实现不得把数组位置重新编号冒充原始 `eventSeq`。旧 v1 capture 若只有规范连续 `seq`，直接使用该值；缺失、重复、乱序或非法值 fail-closed。

projection 只消费 `admitRawReplayCapture` 已准入的 opaque capture authority。selectorless
pure-coordinate event 已由 capture admission 以 `SELECTOR_UNAVAILABLE` 拒绝；masked-sensitive fill
已由 capture admission 以 `MASKED_FILL_UNREPLAYABLE` 拒绝。两类输入不得进入 projection 后再被
“洗白”为 pending，capture admission 拒绝后 projection 调用数必须为 0。

capture authority 是允许 raw replay 与后继 projection 分别验读的 opaque 多读 capability，不因
raw replay 成功而失效。projection 必须先调用 raw-capture 模块的内部接缝：

```js
inspectAdmittedRawReplayCapture({ captureAuthority })
// -> {ok:true, captureBytes, capture, captureSha256} | {ok:false,reason}
```

该接缝从 authority 私有状态返回深复制的 exact bytes 与已准入文档快照，不接受 plain/clone/forge，
也不消费 authority。随后 projection 必须以返回的 `captureBytes` 调
`consumeCleanRawReplay({cleanProofAuthority,currentCaptureBytes:captureBytes})`；只有 exact bytes
匹配且一次性 clean proof authority 消费成功，才允许读取 `capture` 做 event projection。持久化
proof、调用方另给 bytes、重新解析的普通对象均不能替代这两步。

### 2.2 三分 coverage

全部事件复合键必须恰好落入三类之一：

1. `mapped`：业务事件被某个 resolved atom 的 `evidenceEventSeqs` 覆盖；
2. `pending`：业务事件因证据不足保留给人；
3. `structural`：`newpage` 等结构事件，绑定一个精确 trigger event。

硬不变量：

```text
mapped ∩ pending = ∅
mapped ∩ structural = ∅
pending ∩ structural = ∅
mapped ∪ pending ∪ structural = all capture event compound keys
```

同一业务 event 不能被两个 resolved atom 重复消费。一个 resolved atom 可以消费多个业务 event，但必须给出排序、去重后的 `evidenceEventSeqs`，并能由这些 seq 反查到唯一复合键。

### 2.3 `newpage` 不按 intent 去重

`newpage`：

- 不建立独立 TestCase step；
- 不建立独立 atom mapping；
- 不因为与 trigger click/dblclick 共用 `intentId` 而算作“已被 mapping 覆盖”；
- 必须保留自己的 `compoundKey/eventSeq/pathHint`；
- 必须带 `triggerCompoundKey`，且 trigger 恰为前一项可产生 handoff 的 click/dblclick；
- 同一 trigger 最多一条 `newpage`；orphan、重复 handoff、错序或 host-bearing path 一律拒绝。

若 trigger 业务事件仍 pending，`newpage` 继续留在 structural projection，但不得单独进入 formal candidate。待 trigger 被 resolved 后，结构事件才能随该 atom 物化。

### 2.4 mapping 不改三类权威事实

atom resolution 只可产生：

```json
{
  "intentId": "i12",
  "atom": "nav.workflowManagement",
  "params": {},
  "evidenceEventSeqs": [12],
  "ruleId": "known-nav-workflow-management"
}
```

以下字段不属于 mapping 的决定面：

- expected：不得从“人工操作后页面看起来成功”反推断言；已有 expected/globalAssertions 原字节保留，没有则继续由 draft/human sign 处理。
- identity：recipe 不得生成平台 ID、锁、收据或对象相同结论。`entityBindings` 只能由既有 identity projection authority 按 `candidateId/role` 原样 join；缺 authority 或角色不齐则 pending。
- effect：不得接受 capture、recipe、模型或 mapping 自报的 mutation/read/relation。effect 只取现役冻结 side-effect policy。

候选生成前后分别计算 authored contract、identity projection 与 effect policy 的 digest。任一 digest 改变即拒绝整份 candidate，不允许“修正后继续”。

## 3. 投影数据契约

### 3.1 Capture projection

```json
{
  "schemaVersion": 1,
  "caseId": "tc_example",
  "events": [
    {
      "compoundKey": "1:click",
      "intentId": "i1",
      "eventSeq": 1,
      "action": "click",
      "pathHint": "/agents",
      "role": "business",
      "evidence": {
        "semanticTextPresent": true,
        "fieldLabelPresent": false,
        "selectorPresent": true
      }
    }
  ]
}
```

projection 只保留 recipe 判定必需的已脱敏字段和布尔证据摘要。不得恢复已遮蔽 value，不得把 URL、DOM、截图或页面对象塞入该产物。

### 3.2 Resolved atom projection

```json
{
  "schemaVersion": 1,
  "caseId": "tc_example",
  "resolved": [
    {
      "mappingKey": "m1",
      "intentId": "i1",
      "atom": "nav.workflowManagement",
      "params": {},
      "evidenceEventSeqs": [1],
      "evidenceCompoundKeys": ["1:click"],
      "resolution": "known",
      "ruleId": "known-nav-workflow-management"
    }
  ],
  "pending": [],
  "structural": []
}
```

`evidenceEventSeqs` 与 `evidenceCompoundKeys` 必须一一对应、排序一致且非空。`mappingKey` 在本 projection 内唯一，只作 capture lineage；投影给现役 flow-bridge 时必须剥除它和 evidence 字段。

### 3.3 Flow-bridge 输入投影

传给现役 `validateBridge/buildFlow` 的形态保持不变：

```json
[
  {
    "intentId": "i1",
    "atom": "nav.workflowManagement",
    "params": {}
  }
]
```

若需要 `entityBindings`，只能从单独的 identity authority 确定性 join 后按现役 `{candidateId,role}` 形态加入；resolver 自身不得接收或生成平台身份字段。

TestCase candidate：

- 每个 resolved atom 对应一个普通 step；
- 每个 pending 业务单元对应一个带非空 reason 的 `route:"human"` step；
- `newpage` 不对应 step；
- resolved 与 pending 的 TestCase `intentId` 唯一；
- 已有 preconditions、expected、globalAssertions、uniquePrefix 只复制，不编辑；
- capture-only 输入没有 expected 时保持缺席，绝不补成功断言。

`resolveCaptureProjection` 的 `authoredTestCase` 是这些 authored contract 字段的唯一来源。
投影必须深复制其 `preconditions`、逐 step `expected`、`globalAssertions` 与
`uniquePrefix`，不得补默认值；输出的 `candidateTestCase` 必须不经调用方修补即可直接送入
现役 `validateBridge`。capture-only 没有 `authoredTestCase` 时，缺席字段继续缺席。

## 4. 已有 atom 优先解析

解析顺序固定：

1. 先验证输入确为 capture admission 铸造的 authority；plain、clone、forge 全拒；
2. 在当前 `isCompilableAtom` 和 registry 交集中查 deterministic recipe；
3. 恰一条 recipe 命中才 resolved；
4. 零命中保持 pending；
5. 多命中保持 pending，不按分数、数组顺序或“最长看起来更像”任挑；
6. 现役 known recipe 已命中时，任何外部 proposal 都不得覆盖；
7. resolved mapping 最终仍须在 atom roundtrip 通过现役 `validateBridge`、`compile-gate`、
   状态机与 entity binding policy；bridge 首错固定拒绝，不能调用 compile adapter。

recipe 可声明单事件或连续业务事件组合，并固定：

```json
{
  "ruleId": "known-nav-workflow-management",
  "match": {
    "actions": ["click"],
    "requiresSemanticEvidence": true
  },
  "emit": {
    "atom": "nav.workflowManagement",
    "params": {}
  }
}
```

组合 recipe 可以跨过紧随 trigger 的 structural `newpage`，但不能消费它；`evidenceEventSeqs` 只列业务事件，structural event 继续独立对账。

zero-SUT compound fixture 只可向结构化 clone 的 registry 内、现役已可编译且已由 frozen policy
证明为 read/no-identity 的 `nav.workflowManagement` 注入 `teachinRecipes`。注入项只声明
action 序列与 emit atom，不声明或覆盖 effect/identity；候选仍必须真过现役 flow-bridge。

以下情况必须 pending：

- atom 不在 registry 或没有 compile 知识；
- action/事件组合没有确定性 recipe；
- 已准入 action 当前没有 resolved recipe；
- required 参数缺失或来源 event 不唯一；
- recipe 命中歧义；
- identity requiredRoles 无权威 binding。

状态机或 flow-bridge 拒绝不属于可继续的 pending：semantic projection 可铸携候选的
`resolutionAuthority`，但 `runAtomRoundtrip` 消费其专用 grant 后仍必须在 compile adapter 前固定
`BRIDGE_REJECTED` 并整份终止。

coverage 首错固定：

- 单行 `evidenceEventSeqs` 自重复：`MAPPING_EVENT_DUPLICATE`；
- 两行 mapping 消费同一 compound key：`CAPTURE_EVENT_MULTI_COVERED`；
- known recipe event 没有 mapping 且不属于 pending/structural：`CAPTURE_EVENT_UNCOVERED`；
- candidate 强行 mapping 本应 pending 的 event：`MAPPED_PENDING_OVERLAP`；
- structural event 被 mapping evidence 吞入、三分或 trigger 入账不闭合：
  `TOPOLOGY_COVERAGE_MISMATCH`。

selectorless pure-coordinate 与 masked-sensitive 不属于上述 pending 分支：它们必须在 capture admission
终止。`dragTo` 的 ox/oy 若是已登记 atom 的内容参数，且 source/target grounding 均有稳定证据，
仍可作为已准入业务事件；把坐标当唯一 locator 则由 capture admission 拒绝。

## 5. 接入现有 flow-bridge 与 compile

禁止新增“直接把 capture event 改字段后写 events.json”的路径。

唯一合法路径：

1. resolved projection 生成 TestCase candidate 与标准 mapping candidate；
2. 调现役 `validateBridge(testcase,mapping,{registry})`；
3. 调现役 `buildFlow`，不得复制其投影忠实、状态机或 entity policy；
4. flow 交给现役 compile gate 和 `compileFlow`；
5. compile 只用现役 atom compiler 生成业务 formal events；
6. 一个薄的 lineage adapter 记录每个 flow step 的 `sourceIntentId`、mappingKey 与其实际生成的 `stepId[]`；
7. formal candidate assembler 仅按 lineage 把 structural `newpage` 插到精确 trigger mapping 的最后一个 formal event 后；
8. 用现役 `normalizeTopologySequence/assertTopologyParity` 和 events schema 复核最终序列。

lineage adapter 不执行动作、不生成 locator、不解释 atom。它只观察现役 compile 的 step 前后 event 边界。`bin/compile.mjs` 已接近 600 行，不在其中继续堆实现；CLI 只薄调独立模块。

不能只按 formal `intentId` 或 atom 名回填 `newpage`，因为一个 intent 可裂成多个 event、同一 atom 也可重复。必须按 `mappingKey → stepId[] → triggerCompoundKey` 的 lineage 定位。

formal `newpage` 只含现役 schema 字段，并把 host-free `pathHint` 物化为现役模板 URL。不得持久化 capture `compoundKey`、pageId、openerPageId 或 runtime authority；这些只在 distill manifest/lineage sidecar 中。

只要存在以下任一情况，formal candidate 整份不 ready：

- resolved/pending coverage 不闭合；
- compile 某 mapping 零 event 且该 atom不是合法零事件原子；
- lineage 缺失、重复或跨 mapping；
- trigger mapping 未编译；
- topology 数量、顺序或 path parity 不一致；
- flow-bridge 或 compile 拒绝。

## 6. API

冻结兼容 façade：

```js
resolveCaptureProjection({
  captureAuthority,
  cleanProofAuthority,
  mappingCandidate,
  atomRegistry,
  authoredTestCase
})
// -> {
//   ok, resolutionAuthority,
//   candidateTestCase, candidateMapping, resolved, pending, projection, coverage
// }
//  | {ok:false,reason}
```

`authoredTestCase` 是加性的可选输入；给出时由 flow candidate 投影消费，缺席时不得合成
authored contract 字段。成功结果必须额外铸一次性 opaque `resolutionAuthority`，把 capture hash、
candidate TestCase/mapping、三分 coverage、structural lineage 以及 authored/identity/effect digest
绑定在模块私有状态。它只可分别铸一次 source-semantic 与 atom-roundtrip grant，本身不得直接
进入任一 completion：

```js
issueSourceSemanticGrant({ resolutionAuthority })
// -> {ok:true,grant} | {ok:false,reason}
issueAtomRoundtripGrant({ resolutionAuthority })
// -> {ok:true,grant} | {ok:false,reason}
```

两枚 grant 绑定同一 resolved digest 但互不替代；plain、clone、forge 或 replay 均不得进入
source semantic completion 或 atom roundtrip。单个 genuine grant 只展开自身 resolution；
所谓 cross-resolution 只能在下游同时持有 expected source/baseline 时判断，不能把另一份 genuine
resolution 单独调用 issuer 误判为非法。

atom roundtrip 的冻结入口：

```js
runAtomRoundtrip({
  atomRoundtripGrant,
  compileAdapter
})
// -> {
//   ok:true,
//   developmentOnly:true,
//   promotionReady:false,
//   candidateTestCase,
//   candidateMapping,
//   eventsCandidate,
//   compileLineage,
//   manifest
// }
// -> {ok:false,reason}
```

`compileAdapter` 是现役 compiler 的注入接缝，不是第二套 compiler。`runAtomRoundtrip` 必须先消费
genuine one-shot atom-roundtrip grant，从其私有绑定取得 resolved candidate，经现役
`validateBridge/buildFlow` 得到 flow，再恰调用一次：

```js
compileAdapter({
  candidateTestCase,
  candidateMapping,
  flow,
  lineagePlan
})
// -> {ok:true,compiledEvents,compileLineage}
// -> {ok:false,reason}
```

传给 adapter 的 candidate TestCase、mapping 与 lineage plan 必须是深冻结快照。`lineagePlan`
固定为按 resolved 顺序排列的 `{mappingKey,sourceIntentId}`；adapter 返回的每个 lineage row 固定为
`{mappingKey,sourceIntentId,stepIds}`。每个 mappingKey 必须恰出现一次，sourceIntentId 必须精确
一致，每个非空 stepId 必须在 compiledEvents 中恰出现一次且不得跨 mapping 重复；漏项、额外项、
错 intent、重复 stepId 或事件未入账统一 `COMPILE_LINEAGE_MISMATCH`。

adapter 返回 `{ok:false}`、抛错或返回未知形状时只调用一次、不 retry，固定
`COMPILE_REJECTED`，不回显异常与 adapter 私有 reason。compiled event 不得注入或改写
mapping、expected、identity、effect；发现 candidate digest 改变或 compiled event 携越权
identity/effect 字段，整份以 `CONTRACT_FIELD_MUTATION` 拒绝且不产半份 candidate。

adapter 的 `ok:true` 只说明注入的 compile 接缝返回了候选 events，不是正式测试成功。
成功结果必须固定 `developmentOnly:true/promotionReady:false`，且不得出现 `PASS`、verdict、
`signed:true` 或 `replayReady:true`。正式结论仍只来自后继 draft/sign/replay/verdict/report。

### 6.1 实体验证交接

roundtrip 自身仍无权声明“不需要实体”。runtime-cycle 必须把 roundtrip 产出的 canonical
`caseId/eventsBytes`，以及刚刚 exact close 后得到的 genuine
`authoringClosureAuthority`（作为 `verificationScopeAuthority`）原样交给
`canonicalEntityLockVerifier`；分流细节以 `entity-verification-design.md` 为准。
scope 只在内部按对象身份绑定，不得来自 cycle entry、序列化到候选或出现在公开输出。

首版 read-only 正控固定满足：

- 现役 `checkReplayEntityAdmission` 在无 frozen authority 时证明
  `authorityKind:"deterministic-read-only-policy"`；
- 每个正式 event 的 `entityBindings` 缺席或为 exact 空数组；
- source plan 的 `entityLockBytes` 为 canonical UTF-8 `[]`。

只有上述三项同时成立才可得到 `mode:"not-required"` 与 canonical 空集 digest。
`agent.searchOpen`、未知 atom、任何非空 binding 仍是 `runtime-required`，必须经现役
v2/publication authority 且 `runtimeAuthorized:true`；caller 自报 read/no-entity 标志无效。
蒸馏候选即使是 `developmentOnly:true`，也不得在这一步把 identity-sensitive read 洗成
无实体 action。

`lib/teachin/atom-roundtrip.mjs` 必须直接 import
`{validateBridge,buildFlow}` from `../flow-bridge.mjs`，不得本地复制/覆盖 bridge；bridge
反例固定 `BRIDGE_REJECTED`，compile adapter 调用数为 0。compiler 仍只通过
`compileAdapter` 注入，不得导入或复制 atom compiler。

内部建议按以下小模块拆分：

```js
projectCaptureEvents({
  capture,
  captureAuthority
})
// -> {ok, projectionAuthority, projection, receipt} | {ok:false,reason}

resolveCaptureAtoms({
  projectionAuthority,
  recipes,
  registry,
  identityProjectionAuthority
})
// -> {ok, resolutionAuthority, resolved, pending, structural, receipt}

validateResolvedProjection({
  projectionAuthority,
  resolutionAuthority,
  authoredContractDigest,
  identityProjectionDigest,
  effectPolicyDigest
})
// -> {ok, reason:null, coverageReceipt} | {ok:false,reason,problems}

projectFlowBridgeCandidate({
  resolutionAuthority,
  authoredTestCase
})
// -> {ok, testcaseCandidate, mappingCandidate, lineagePlan}

materializeDistilledFormalCandidate({
  resolutionAuthority,
  compiledEvents,
  compileLineage
})
// -> {ok, eventsCandidate, manifest} | {ok:false,reason}
```

authority 使用模块私有 `WeakMap` 绑定输入 digest；clone/forge 不可消费。所有公共失败返回稳定 reason，不回显事件原值、URL、参数或身份内容。

## 7. 稳定 reason

| 阶段 | reason |
|---|---|
| upstream capture admission | `SELECTOR_UNAVAILABLE`、`MASKED_FILL_UNREPLAYABLE` |
| resolved input authority | `RAW_CAPTURE_AUTHORITY_INVALID`、`CLEAN_PROOF_AUTHORITY_INVALID`、`CAPTURE_HASH_MISMATCH` |
| capture projection | `UNSAFE_DATA_SHAPE`、`RAW_CAPTURE_AUTHORITY_INVALID`、`CAPTURE_EVENT_SEQ_INVALID`、`CAPTURE_EVENT_KEY_DUPLICATE`、`CAPTURE_PATH_INVALID` |
| mapping input | `MAPPING_INVALID`、`MAPPING_EVENT_OUT_OF_RANGE`、`MAPPING_ACTION_MISMATCH`、`MAPPING_ATOM_UNKNOWN`、`MAPPING_IDENTITY_MISMATCH`、`MAPPING_EFFECT_MISMATCH` |
| topology | `TOPOLOGY_TRIGGER_MISSING`、`TOPOLOGY_TRIGGER_INVALID`、`TOPOLOGY_DUPLICATE_HANDOFF`、`STRUCTURAL_TRIGGER_PENDING` |
| atom resolution | `KNOWN_RECIPE_MISSING`、`KNOWN_RECIPE_AMBIGUOUS`、`ATOM_NOT_COMPILABLE`、`UNSUPPORTED_ACTION`、`MISSING_REQUIRED_PARAM`、`IDENTITY_BINDING_PENDING` |
| fidelity | `MAPPING_EVENT_DUPLICATE`、`MAPPED_PENDING_OVERLAP`、`CAPTURE_EVENT_UNCOVERED`、`CAPTURE_EVENT_MULTI_COVERED`、`EVIDENCE_EVENT_INVALID`、`TOPOLOGY_COVERAGE_MISMATCH`、`CONTRACT_FIELD_MUTATION` |
| main path | `RESOLUTION_AUTHORITY_INVALID`、`ATOM_ROUNDTRIP_INPUT_INVALID`、`ATOM_ROUNDTRIP_GRANT_INVALID`、`BRIDGE_REJECTED`、`COMPILE_REJECTED`、`COMPILE_LINEAGE_MISMATCH`、`FORMAL_TOPOLOGY_PARITY_FAILED`、`FORMAL_CANDIDATE_NOT_READY` |

pending reason 与整份拒绝 reason 分开：`KNOWN_RECIPE_MISSING` 等可成为单事件 pending；coverage、authority、contract mutation、bridge/compile/lineage/parity 问题拒绝整份产物。

pending taxonomy 固定：已准入但 resolution 不支持其 action 种类（当前 golden 为
`press`）只返回 `UNSUPPORTED_ACTION`；resolution 支持该 action 种类、但语义证据未命中任何
确定性 recipe（当前 golden 为未知 `click`）只返回 `KNOWN_RECIPE_MISSING`。两者不得互换或用
OR 断言兼容。

## 8. Golden matrix

| 编号 | 场景 | 必须证明 |
|---|---|---|
| G1 | 单事件已知 atom | resolved 1、pending 0、`evidenceEventSeqs` 精确 |
| G2 | 多事件 compound atom | 一个 mapping 覆盖多个 seq，顺序稳定且不重复 |
| G3 | 未知事件 | 不造 atom，事件精确落 pending |
| G4 | admitted `press` / 未命中 recipe 的 `click` | 不造 atom，分别精确 pending 为 `UNSUPPORTED_ACTION` / `KNOWN_RECIPE_MISSING` |
| G5 | selectorless coordinate / masked-sensitive fill | capture admission 分别具名拒绝，projection 调用数为 0 |
| G6 | known recipe 与外部 proposal 冲突 | known 保留，override 不生效并留稳定拒因 |
| G7 | mapped/pending overlap | unknown pending 被 proposal 强行 mapping 时 `MAPPED_PENDING_OVERLAP`，零 candidate |
| G8 | 漏 event / 双消费 | known event 缺 mapping 为 `CAPTURE_EVENT_UNCOVERED`；跨 mapping 双消费为 `CAPTURE_EVENT_MULTI_COVERED`；单行 seq 自重复为 `MAPPING_EVENT_DUPLICATE` |
| G9 | click + newpage 共 intentId | 两个 compound key 均在；newpage 不被 intent Set 洗掉 |
| G10 | orphan/重复/错 path newpage | 三类均 fail-closed |
| G11 | trigger pending | structural 保留，但 formal candidate not ready |
| G12 | expected mutation | mapping happy 也因 `CONTRACT_FIELD_MUTATION` 拒 |
| G13 | identity/effect 注入 | recipe/proposal 自报字段不能进入 mapping 或 policy |
| G14 | flow-bridge round-trip | read-safe 标准 mapping 真过现役 `validateBridge/buildFlow`；真实 bridge 反例在 compile 前拒绝 |
| G15 | compile round-trip | genuine atom-roundtrip grant 令注入 adapter 恰调用一次；stub 成功仍只产 development candidate |
| G16 | compile lineage | 重复 atom 仍按 mappingKey/sourceIntentId/stepIds 精确回链；漏项、错 intent、重复 stepId 均拒 |
| G17 | structural re-materialization | newpage 插入 trigger mapping 末 event 后，source/distilled topology parity 通过 |
| G18 | lineage/topology 篡改 | 零落盘，稳定 reason，不产半份 formal candidate |
| G19 | 字节稳定 | 同 capture/recipe/registry/digest 输入得到同 candidate 字节 |
| G20 | 邻接回归 | record-distill、page-topology、flow-bridge、compile、output-seal 保持绿色 |
| G21 | 结构门 | 本切片全部新增/修改文件逐个严格少于 600 行 |
| G22 | roundtrip grant / contract | grant clone/forge/cross-resolution/replay 零 compile；mapping/expected 深冻结，identity/effect 注入拒 |
| G23 | compile 首错与降权 | adapter fail/throw 不 retry、不泄原文；`ok:true` 不得冒充 `PASS` |
| G24 | compiler 唯一来源 | roundtrip 只调用注入的现役 adapter，不导入、内置或复制 atom compiler |
| G25 | capture/proof authority | projection 直连 canonical inspector/consumer；proof clone/forge/换包/二次消费拒，capture 仍可多读深拷贝 |
| G26 | 实体验证分流 | read/no-binding 只产 genuine `not-required` handle；identity-sensitive read、unknown、nonempty binding 强制 runtime authority |

## 9. 文件拆分

建议实现拆分：

| 文件 | 职责 | 上限 |
|---|---|---:|
| `lib/teachin-distillation/event-projection.mjs` | seq、compound key、脱敏 evidence、structural trigger | 300 |
| `lib/teachin-distillation/atom-resolution.mjs` | known recipe、params、pending | 350 |
| `lib/teachin-distillation/fidelity.mjs` | 三分 coverage、digest 与 authority 校验 | 350 |
| `lib/teachin-distillation/flow-candidate.mjs` | 投影标准 TestCase/mapping，调用 flow-bridge | 250 |
| `lib/teachin-distillation/compile-lineage.mjs` | 观察现役 compile step/event 边界 | 220 |
| `lib/teachin-distillation/formal-candidate.mjs` | structural 重物化、parity、manifest | 350 |
| `lib/teachin/resolved-projection.mjs` | 薄协调 façade；直连 canonical inspector/consumer 后委托内层模块 | 180 |
| `lib/teachin/atom-roundtrip.mjs` | 消费 atom-roundtrip grant、调用 adapter、校 lineage 与降权产物 | 240 |
| `tests/_golden/teachin-distillation-*.golden.mjs` | 按 projection/fidelity/round-trip/static 分文件 | 每个 550 |
| `tests/_golden/teachin-replayability-resolved-authority-coverage.zero-sut.golden.mjs` | inspector/clean proof 与 coverage reason 分门 | 450 |

`bin/distill.mjs` 与 `bin/compile.mjs` 只保留参数、I/O 和调用接线；若接线会把现有文件推过 600 行，先抽独立 adapter，再替换原内联段，不允许以“只是薄接几行”为由突破上限。

## 10. 完成定义

本设计对应实现只有同时满足以下条件才算闭合：

- 每个 capture event 均以 compound key 完整入账；
- `mapped ∩ pending = ∅` 且三分 coverage 完整；
- 已知可编译 atom 优先，unknown/unsupported-but-admitted 诚实 pending；
- selectorless pure-coordinate 与 masked-sensitive 在 capture admission 具名拒绝，projection 不承担洗白；
- `newpage` 精确绑定 trigger compound key 并在 formal candidate 中保真；
- expected、identity、effect digest 零漂移；
- candidate 真走现役 flow-bridge 与 compile；
- capture authority 经多读快照与 exact-byte clean proof 消费后才铸 resolution authority；
- resolution authority 分别铸一次 source-semantic/atom-roundtrip grant，roundtrip 只消费后者；
- atom roundtrip 的 compile adapter 失败首错停止；
- compile stub 成功只产 development candidate，不产生正式 `PASS`；
- formal candidate 通过 schema、lineage 与 topology parity；
- 所有新增/修改文件严格少于 600 行；
- 零 SUT golden 全绿；真实 source/distilled replay 与用户验收另走 `route:human`，不由本设计冒充完成。

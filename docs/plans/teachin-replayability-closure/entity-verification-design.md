# teachin-replayability-closure：实体运行时验证分流

## 1. 首版目标

首版必须让确定性、无实体的纯导航链路可运行，同时不撤销现役实体身份硬门：

- `nav.workflowManagement` 这类由现役策略证明为只读、且正式事件没有实体绑定义务的
  action，走 `mode:"not-required"`；
- `agent.searchOpen`、未知 atom、mutation/relation action，以及任何带非空
  `entityBindings` 的正式事件，全部走 `mode:"runtime-required"`；
- `runtime-required` 只认现役 `entity-semantic-lock-v2` 与 executable publication
  铸出的 genuine authority，且 `runtimeAuthorized` 必须严格为 `true`；
- 生产 publication 为空时，`runtime-required` 明确拒绝，绝不因首版要跑通而降成
  `not-required`。

`mode` 只能由正式事件与现役策略推导。公共输入不接收 `noEntity`、`mode`、
`runtimeAuthorized`、`setSha256` 或 caller 自造 handle。

## 2. 确定性分流

`canonicalEntityLockVerifier.verify` 自己解析 exact `eventsBytes`，得到同字节的
`eventsDocument`，随后必须先在不提供 frozen authority 的条件下调用现役：

```js
checkReplayEntityAdmission({
  caseId,
  eventsBytes,
  eventsDocument,
})
```

只有同时满足以下条件才进入 `not-required`：

1. admission 返回 `ok:true` 且
   `authorityKind:"deterministic-read-only-policy"`；
2. 每个正式 event 的 `entityBindings` 要么缺席，要么是 exact 空数组；
3. `caseId` 与 exact bytes 内文档一致；
4. 文档非空，事件 shape 已由现役 admission 验真。

因此，caller 给已知只读 action 塞入一条 identity binding 也不能冒充无实体。
`agent.searchOpen` 当前不在无实体只读策略中；它即使 UI 动作看起来只读，也必须走
`runtime-required`。未知 atom 继续由现役 fail-closed 策略按实体敏感 action 处理。

admission 的 malformed、重复 triple、read action/target 错误直接保留其稳定拒绝，
不能拿一份 entity authority 绕过事件结构或目标信封错误。只有
`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`，或“只读 admission 通过但存在非空
binding”这两类结果，才进入 `runtime-required` 分支。

## 3. Canonical 空集

无实体集合的唯一规范字节固定为 UTF-8 `[]`，其 digest 固定为：

```text
sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
```

read-only source plan 的 `entityLockBytes` 必须使用这两个 exact bytes，禁止用
`{locks:[]}`、带 tag 的测试对象或 caller 自报 digest 代替。这样 source receipt 的
`sourceEntityLockSetSha256` 与 distilled candidate 的 verified digest 能确定性判等。

`not-required` 成功 exact 返回：

```js
{
  ok: true,
  handle,                    // 模块私有 WeakMap 绑定的 opaque handle
  mode: "not-required",
  runtimeAuthorized: false, // 没有伪装成取得实体运行时权限
  setSha256: "sha256:4f53..."
}
```

`runtimeAuthorized:false` 在这里不是拒绝；composer 的唯一放行式为：

```text
mode == not-required
OR
(mode == runtime-required AND runtimeAuthorized == true)
```

其他组合一律 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED`。尤其禁止把
`not-required` 实现成 caller 可写 boolean。

## 4. 实体必需分支

`runtime-required` 必须依次：

1. 要求 `authority` 存在；
2. 调现役 `verifyEntityLockSet({authority,caseId,eventsBytes})`；
3. 要求返回 genuine v2 handle 且 `runtimeAuthorized === true`；
4. 只从 `ENTITY_SEMANTIC_LOCK_PUBLICATIONS[contractId].locks[lockSetKey]`
   读取已发布 bare digest，并规范成 `sha256:<64hex>`；
5. 用本模块自己的 opaque wrapper handle 绑定
   `{verificationScopeAuthority,caseId,eventsSha256,mode,setSha256,v2Handle}`。

`verificationScopeAuthority` 只能由 runtime-cycle 传入它刚得到的 genuine
`authoringClosureAuthority`，不来自 cycle entry 或用户输入。entity verifier 不单独宣称它
已经验真，只按对象身份绑定；pair-authority 在消费 handle 时仍按原纪律独立验证同一
authoring closure。这个组合能拒绝两个具有相同 case/events/digest 的不同 pair 互换
verification handle，且不新增 caller 自报 `pairId`。

production publication 为空、authority plain/clone、historical-only handle、
未发布 digest 分别稳定拒绝；不得读取 workspace PRD 或接受 caller digest 补洞。

`runtime-required` 成功 exact 返回：

```js
{
  ok: true,
  handle,
  mode: "runtime-required",
  runtimeAuthorized: true,
  setSha256
}
```

## 5. Handle 消费

pair-authority 内部 sealer 不得只相信成功返回对象上的字段。它必须调用
`consumeVerifiedEntityLockVerification`，用 roundtrip candidate 内的 canonical
`caseId/eventsBytes`、它已经独立验真的 `authoringClosureAuthority`，以及收到的
`verifiedEntityLockSetSha256` 复核模块私有 handle。

消费约束：

- plain/clone/forge handle 拒绝；
- genuine handle 换 events bytes、换 caseId、换 digest、换 authoring closure 或跨 pair 拒绝；
- 错误尝试不消费 genuine handle，随后 exact 调用仍可成功；
- exact 成功 one-shot，replay 再消费拒绝；
- consumer 返回私有记录中的 mode/digest/v2 handle，绝不回信 caller 字段。

这样 `not-required` 只免去不存在的实体运行时读取，不免除 roundtrip、authoring close、
pair binding、fresh distilled replay 或 deterministic comparator 的任何一环。

## 6. API 与稳定 reason

```js
createEntityLockVerifier({
  verifyEntityLockSet,
  entityLockPublications,
})

canonicalEntityLockVerifier.verify({
  verificationScopeAuthority, // runtime-cycle 内部的 genuine authoring closure
  caseId,
  eventsBytes,
  authority, // 仅 runtime-required 时必需
})

consumeVerifiedEntityLockVerification({
  handle,
  verificationScopeAuthority,
  caseId,
  eventsBytes,
  setSha256,
})
```

公共输入 exact；unknown key、getter、Proxy、非 Buffer 均 fail-closed。稳定 reason：

- `ENTITY_LOCK_VERIFICATION_INPUT_INVALID`
- `ENTITY_LOCK_RUNTIME_AUTHORITY_REQUIRED`
- `ENTITY_LOCK_AUTHORITY_INVALID`
- `ENTITY_LOCK_RUNTIME_UNAUTHORIZED`
- `ENTITY_LOCK_DIGEST_UNAVAILABLE`
- `ENTITY_LOCK_VERIFICATION_HANDLE_INVALID`
- `ENTITY_LOCK_VERIFICATION_BINDING_MISMATCH`

现役 `checkReplayEntityAdmission` 的结构/策略拒绝保持其原 reason，不被
`ENTITY_LOCK_RUNTIME_AUTHORITY_REQUIRED` 掩盖。

## 7. 验收反例

独立 zero-SUT golden 至少钉死：

- canonical `nav.workflowManagement` + 零 binding 产 genuine `not-required` handle；
- caller 伪造 `noEntity/mode/handle/runtimeAuthorized/setSha256` 全拒；
- 同一个只读 event 增加非空 binding 后强制索要 runtime authority；
- `agent.searchOpen`、未知 atom 与 mutation 不得走 `not-required`；
- production 空 publication 下实体 action 明确拒；
- factory 正控只有 genuine runtime authority + `runtimeAuthorized:true` + published digest
  才能产 `runtime-required` handle；
- missing/clone authority、historical-only、publication digest 缺失全拒；
- handle clone/forge、events 换包、同 case/events 的跨 pair closure、digest 替换、
  二次消费全拒；
- 所有错误尝试均不消费随后可用的 genuine handle；
- entity verifier、pair sealer 与 runtime-cycle 文件各自严格少于 600 行。

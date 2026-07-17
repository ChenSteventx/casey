# teachin-entity-binding-sidecar-successor — plan（superseding）

> 本契约只取代 `teachin-admission-side-effect-policy` 中“把 provenance/锁字段写进 events”的子决定。原 `events` v2 schema、旧 frozen、旧 checksum 全部不改。

## 1. 架构边界

- compile 产出的 `events.json` 字节与 frozen v2 schema 保持不变；不得新增 `sourceIntentId`、`entityBindings`、`signed` 或 `replayReady`。
- compile 另产未签 `entity-bindings.draft.json`（实体绑定草稿 sidecar），固定绑定原 events 原始字节的 `eventsSha256`，逐 event 保存 `{stepId,intentId,atom,sourceIntentId,candidateId,role}`。
- draft 属 spec sidecar（规格旁车），不得进入 Test Ratchet（测试棘轮）`testChecksums`；events 同样不得进入。
- sign 显式人签时消费原 events bytes、draft 与确认后的身份 receipt（收据），只产 `entity-locks.frozen.json`。该 frozen artifact 含七字段 binding、同一 `eventsSha256`、`signed:true`、`replayReady:true` 与签署元数据；只有它可进入 `testChecksums`。
- replay 保持消费原 events v2 + frozen locks；不生成 signed events，不要求 events 携带 schema 外字段。

## 2. Compile draft

- draft 每个 binding 必须引用真实 event triple `{stepId,intentId,atom}`，并保留 flow 的 `sourceIntentId + candidateId + role`。
- 连续两个 mutation 必须逐 event 各有完整 `subject`；relation 必须同一 event 同时有 `source + target`。
- 未知 atom 默认 mutation；只读只认固定 allowlist。缺失、额外、重复、未知或多余角色均整份 invalid。
- builder（构造器）不得修改传入 events bytes/document；输出须通过新增闭合 schema。

## 3. Sign exact join

- confirmations 与 draft 按六字段 `{stepId,intentId,atom,sourceIntentId,candidateId,role}` 精确一对一联结；缺、多、重复、错 candidate/role/receipt 全拒。
- receipt 必须通过身份收据验证，并由 sign 的显式 signer/signedAt 人签承担责任；内容 hash 本身不铸造 replay authority。
- frozen bindings 恰为 `{stepId,intentId,atom,role,candidateId,lockId,receiptHash}`；artifact signature 与 eventsSha256 绑定完整内容。
- sign 原子写 frozen locks 与 PRD checksum；events/draft 不进入 checksum，原 events 不覆写。

## 4. Replay internal derivation

- replay checker 只接 `{caseId,eventsBytes,eventsDocument,frozenLockAuthority}`；副作用与逐 event required roles 均由固定 policy + opaque authority artifact 内部推导。
- caller `containsEntityMutation`、`requiredBindings`、`destructive`、`relationWrite` 或 events 上任何自报字段都无决定权。
- artifact 必须完整覆盖所有 mutation/relation event，不能多锁、少锁、借另一 event 的锁或单边 relation；events bytes、任一 triple、role、candidateId、lockId、receiptHash 篡改均 fail-closed。
- Proxy/accessor/稀疏数组在读取属性前拒绝且零 trap/getter。

## 5. 验收点

### 可命令化

1. `draft`：旧 events v2 shape/bytes 不变；纯 builder 产闭合未签 sidecar；连续 mutation 与 relation 角色完整；compile 静态接线只写 sidecar。
2. `sign`：正向 exact join 产与 frozen fixture 同义 artifact；缺/多/重复/错 receipt 与 events/draft tamper 全拒；sign 不生成 signed events，ratchet 只登记 locks。
3. `replay`：PRD checksum 铸造 opaque frozen-lock authority 后正向 `allowBrowserLaunch:true`；checker 内部按 event triple/policy 校验；caller 旁路与任意篡改拒绝；接线早于 browser。
4. `hostile`：builder/sign/replay 的顶层与嵌套 Proxy/accessor 零执行，invalid 不洗成空集；新 schema 闭合。

全部测试仅调用纯函数和静态读取源码/JSON；禁止子进程、SUT、浏览器、server 与网络。

### 可观察性申报

- 真机 compile 的 event fan-out 与 draft `sourceIntentId/candidateId/role` 同源：`route:human`，逐用例录屏、视觉复核、独立 HTML 与附件。
- 人签 receipt 的真实操作者身份、平台权威读回、撤销与审计日志：`route:human`。
- Win PowerShell/WSL/macOS 安装包内 schema、PRD checksum 与 replay consumer 同源：`route:human`。

## 6. 停止条件

- successor 四分区在 clean `4035806` 上真实 RED；新增 golden/schema/frozen-lock fixture 全进独立 PRD checksum，且 checksum 中不存在 events/draft 路径。
- `gate --dry` 可消费，story 均 `passes:false`；先独立提交 gate，之后才允许恢复实现候选。
- 不改任何旧 frozen，不运行 SUT/browser/server/network。

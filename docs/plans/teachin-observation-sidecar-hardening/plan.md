# teachin-observation-sidecar-hardening — plan（full）

目标：在保持原冻结契约字节不变的前提下，新增受信复核 API，堵死自证 hash、getter TOCTOU、多轮编码敏感绕过和 `eventSeq` 虚假引用。

## 1. 实现计划

修改 `lib/teachin-identity-observations.mjs`：

1. 新增递归 plain-own-data 快照器，仅用 property descriptor 取值一次；拒绝 accessor、symbol、非枚举/额外属性、稀疏数组与循环。
2. 所有公开入口先快照 options 和嵌套数据，验证后不再回读原对象。
3. 敏感 string 同时扫原值与 `normConverge` 值，不收敛拒绝。
4. 保留 `reviewIdentityObservationBundle` 为 `trusted:false` 结构兼容面；新增 `verifyTrustedIdentityObservationBundle`，只有外部闭合 `expectedBinding` 全等时返回 `trusted:true`。
5. 受信复核检查 capture `seq` 唯一且观察 `eventSeq` 全存在。

不修改原冻结测试 `tests/_golden/teachin-observation-sidecar.zero-sut.golden.mjs`，不修改 `loop/prd-teachin-observation-sidecar.json` 或其 checksum。

## 2. 新验收点

1. 结构复核无 `expectedBinding` 只能 `trusted:false`；受信 API 缺绑定必拒，原 `identityBundleLedgerFields` 自产投影不满足新绑定 schema。
2. 一份外部 accepted-ledger 绑定与当前两文件 hash/caseId/count 全等时才 `trusted:true`；协调替换两文件仍被旧外部绑定拒绝。
3. capture/review/pathFacts/observation 中任一 getter/setter、symbol 键、非枚举额外键或普通额外键被固定类别码拒绝，getter 不执行。
4. `%74%6f%6b%65%6e`、`https%253A%252F%252F...` 和超轮不收敛编码被拒绝。
5. capture 序号重复/非正整数或 observation `eventSeq` 不存在时受信复核拒绝；合法唯一引用放行。
6. 新旧两份纯函数黄金标准测试均绿，旧冻结测试 sha256 不变。

## 3. 验收命令

- `node tests/_golden/teachin-observation-sidecar-hardening.zero-sut.golden.mjs`
- 实现前新测试必须红；红证确认后冻结新测试 checksum。

## 4. 可观察性挂账

- pathFacts 的可信 I/O 产生与实际台账来源验真：`route:human`，后续 I/O wiring 契约。
- v2 冻结锁集的签名、events 绑定和角色覆盖：`route:human`，后续 lockset 契约。

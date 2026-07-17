# teachin-observation-sidecar-hardening — GRILL

> 本契约只收紧已有身份观察旁车的纯函数信任边界。不修改原契约冻结测试、PRD 或 checksum；不运行 SUT、fake、fixture server、浏览器或网络。

## D1 兼容与受信 API 分层

- 原 `reviewIdentityObservationBundle` 保留为结构复核兼容面，结果明示 `trusted:false`；不得被 v2 受信锁集消费。
- 新增 `verifyTrustedIdentityObservationBundle`：`expectedBinding` 必填，且必须是闭合的外部 accepted-ledger 形状。缺失、结构复核当场自产的旧投影或 hash 不符均不得 `trusted:true`。
- 纯函数只能核验外部绑定的内容与一致性，无法证明台账文件来源。真实 `open/fstat` 及 v2 签名锁集仍显式 pending。

## D2 一次性 plain-own-data 快照

- 所有公开纯函数先将参数投影为一次性 plain-own-data（纯自有数据）快照，后续只读快照。
- 只接受普通 object/array/标量；拒绝 accessor getter/setter、symbol 键、非可枚举额外属性、数组额外属性、稀疏数组、循环引用和不支持标量。
- 任何 descriptor/proxy 反射异常只返回固定类别码，不把异常 message 写入 reason。

## D3 敏感内容归一扫描

- 复用 `record-intake` 的 `normConverge`：每个可落盘 string 对原值与多轮 `%HH` 解码值同时扫 URL/认证头/Cookie/token/raw body 与凭据字面量。
- 20 轮内不收敛直接拒绝；不回显原值。

## D4 eventSeq 引用完整性

- 受信复核前，capture events 的 `seq` 必须全为正 safe integer 且互不重复。
- 每条身份观察的 `eventSeq` 必须指向 capture 中恰一个真实事件；不存在的序号拒绝。
- capture 中没有身份观察的普通事件不在此层臆造身份，由后续 distill 进 pending。

## D5 明示不在本契约的边界

- pathFacts 仍是纯函数输入；真实路径 containment、全祖先软链拒绝与 `open(no-follow)→fstat→read same fd→fstat` 在 I/O wiring 契约实现。
- `entity-locks.frozen` 的 `eventsSha256`、签名、receipt hash 与 `{stepId,intentId,atom,role}` 覆盖属 v2 lockset 契约，本契约不冒充完成。

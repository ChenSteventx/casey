# semantic-unit-discrimination · grill（决策已裁定，记录范围与反滥用护栏）

## 决策状态：已由 Steven 裁定，本契约不再开分岔

Steven 于 2026-07-18 凌晨以可点选项裁定「单元导出 + 真机双轨」。前瞻红基线
`teachin-semantic-lock-runtime-discrimination-successor`（0/26 诚实红）填绿三选一中：

- 甲「判别纯函数单元导出」→ 本契约执行（hermetic 轨）；
- 乙「真机运行时权威」→ 前瞻红基线保持红，等真机 publication 落地后填绿（真机轨）；
- 丙「恢复可验证接缝」→ 已否决，不做。

裁决记录在 `loop/prd-teachin-semantic-lock-runtime-discrimination-successor.json` 的
observability 与 `docs/HANDOFF.md` 2026-07-18 节。本契约只落地甲，不重开决策。

## 范围（正向锚定）

只读导出 `lib/entity-semantic-lock-v2.mjs` 里既有的判别纯函数，供单元级攻击金牌直接
调用，在纯函数层证明判别逻辑正确：

- `parseCandidate(value, policy)` —— 候选严格闭合校验（畸形拒、无静默 trim、
  platformId/revisionId 结构必比）。
- `compareCandidate(receipt, candidate, policy)` —— SAME/CHANGED 判别与
  platformId/revisionId 值必比。
- `identityKey(candidate)` —— 身份元组键（同 physicalId 异身份 = 冲突、重复候选
  身份相等 的纯粹判别基元；identityKey 不含 physicalId）。
- `parseReceipt(value, policyByKind)` —— 外部锚语义：自行重算 canonical hash，
  收据篡改即拒。
- `parsePolicy(value)` —— 身份策略解析（供金牌以真实 policy 驱动上面各函数）。

导出形态：单一冻结命名空间 `ENTITY_DISCRIMINATION_UNIT_FACE = Object.freeze({...})`，
只引用既有纯函数，名字可被金牌静态断言精确 grep。

## 范围（负向红线，机制强制）

- 绝不新增可铸造权威的入口（不碰 `createEntityRuntimeAdapter` /
  `issueEntityRunContext` / `readEntityRuntimeCapability` 的不可执行姿态）。
- 绝不改 `evaluateEntityAction` / `createRunSuccessorProof` 的任何函数体或行为；
  只加导出行，零行为改动。
- 前瞻红基线文件 `teachin-semantic-lock-runtime-discrimination-successor.zero-sut.golden.mjs`
  字节零触碰（金牌静态断言其 sha256 恒等于当前值证明）。
- 生产 publications 表零触碰（保持 fail-closed 空表姿态）。

## 已知覆盖边界（诚实分工，非缺陷）

单元导出面只覆盖能以纯函数形态导出的判别基元。以下前瞻基线攻击的「裁定分派」
或「有状态机制」内联在 `evaluateEntityAction` / `createRunSuccessorProof`，无法在
不重构的前提下以纯函数导出，因此不属本单元面、仍归前瞻红基线（真机轨）所有：

- 原始计数不折叠 → AMBIGUOUS 的裁定分派（内联，用 raw candidateCount）；
- 空候选 + 完整扫描 → MISSING 的裁定分派（内联，count===0 判定）；
- 不完整扫描 → SCAN_INCOMPLETE 的裁定分派（内联，complete 布尔判定）；
- successor 的有状态判别（未签迁移 / 陈旧链头 / 版本不前进 / 成功迁移使旧链头失效
  —— 依赖 transitionById / activeHeads / runProofs 运行态，非纯函数）。

单元面证明的是这些裁定所依赖的判别基元（parseCandidate 有效性、identityKey 身份
相等/不等、compareCandidate 值比对、parseReceipt 外锚）在纯函数层正确。裁定分派
与状态机的目标态验收仍由前瞻红基线在真机轨兑现。金牌头部与缺口台账如实标注此边界，
不冒充覆盖。

## 反滥用

- 导出面禁止被任何 `bin/` 生产路径与 `mcp/` 路径 import；由金牌静态断言（grep
  `bin/` 与 `mcp/` 下全部 `.mjs` 源码字符串，零命中）钉死。
- 导出面是只读纯函数引用（Object.freeze），不携任何铸造权威能力，即便被误 import
  也无法绕过 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED` 硬门（硬门在 evaluate/successor 内，
  与判别纯函数无关）。

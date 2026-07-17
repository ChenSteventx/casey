# observation-contract-closure — plan

目标：关闭 observation 数据合同审查的一个 HIGH 与两个 MED。全程只运行 zero-SUT 本地检查，不启动 SUT、fake、browser、server 或 network；旧 frozen acceptance 不修改，新增 successor 合同与 machine-readable active suite。

## 1. HIGH：canonical identity package 单一闭合验证器

1. 新增一个无 I/O 的闭合 identity package validator，统一校验：capture v2 顶层与 identity reference 精确键集、sidecar 顶层/source/observation 精确键集、未知字段、敏感内容、百分号编码、sidecar 精确 bytes hash/count、eventSeq 唯一引用与 evidenceKind/action 兼容关系。
2. canonical authority root 的 `readPackage` 必须在 package hash 验证后调用该 validator。由于 intake append、commit 前重读、authority current check 与 distill rehydrate 都只经 `readPackage`，任何 accepted authority 铸造前和 rehydrate 后都消费同一个闭合 validator；不得维护 intake/distill 两套漂移规则。
3. signed readback receipt 必须覆盖 sidecar 的全部 observations。保留 schema v1 单观察兼容，但仅当 sidecar 恰有一条观察时可接受；schema v2 使用按 sidecar 顺序排列的 observations 数组，逐条覆盖 kind/name/code/platformId/scopeFingerprint/parent/evidenceKind/eventSeq/evidenceSha256，数组缺项、多项、乱序或字段不等均拒绝，零 accepted ledger。
4. rehydrated opaque pair 必须携带完整 observation facts；`verifyAcceptedIdentityObservationBundle` 对全部观察逐项比对，合法多观察包可 trusted，不能出现 intake accepted 但 identity consumer 因合同更严而不可消费。

验收：新增 `tests/_golden/observation-identity-contract-closure.zero-sut.golden.mjs`。实现前真实 RED 至少包括：未知 sidecar 字段被 intake 接受、敏感 sidecar 字段被 intake 接受、双观察完整 signed receipt 因旧单条 schema 无法表达而拒绝。实现后必须验证未知/敏感/partial receipt 全拒且零 ledger，完整双观察 intake→distill→trusted consumer 成功。

## 2. MED：runtime trust PRD gzip amendment

1. 不改旧 frozen test bytes。新增 formal amendment receipt，记录旧 PRD task 曾写 `Base64 JSON/originalBase64`，真实落地与已运行门禁是 gzip archive + gunzip hash verification；旧 Base64 尝试从未记 PASS。
2. `loop/prd-observation-runtime-trust-root.json` 的 task 摘要按 amendment 正名为 gzip，并显式指向 amendment；stories、passes、evidence 与 frozen checksums 不回写历史结果。
3. 新 golden 必须同时校验 PRD 摘要、amendment receipt、security-revocation receipt 与 revocation golden 均一致使用 gzip，且 archive 可 gunzip 后匹配历史 sha。

验收：`tests/_golden/observation-runtime-trust-amendment.zero-sut.golden.mjs`。实现前因 PRD 摘要仍写 Base64、amendment 不存在而真实 RED。

## 3. MED：active-suite v2 完整消费 machine-readable 合同

1. 保留旧 `active-suite.json` 与旧 frozen test；新增 `active-suite-v2.json` 和 successor golden。
2. v2 JSON 必须成为以下事实的唯一输入：production/isolated profile 的 test、loader、expectedPassed、expectedFailed、retained/superseded assertion ids；active PRD 与 historical PRD 路径；revoked executable 路径；replacement map。
3. successor golden 不得把 11/6、16/1、loader、PRD 或 revoked paths 另行硬编码。它从 JSON 运行两 profile，精确核 output counts/ids；读取所有 active/historical PRD；校验 revoked paths 与 security-revocation receipt 精确相等。
4. replacement map 的每个数组必须非空；每个 replacement 必须指向 active PRD 中真实存在且 `passes:true` 的 story，且 `testPath` 必须属于该 story acceptance。禁止 synthetic replacement id 与空数组制造 coverage 假绿。

验收：`tests/_golden/observation-active-suite-contract-v2.zero-sut.golden.mjs`。实现前因 v2 JSON 不存在而真实 RED。

## 4. 可观测性与停止条件

- 真实 driver release publication、私钥保护/轮换、nonce 持久防重放与 receipt 是否来自同一次真实平台 readback，仍 route:human；本合同不发布测试 key 到 production。
- Windows 的 symlink/O_NOFOLLOW/file identity/rename/durability 仍须 Windows 真机故障注入，route:human。
- 本门禁只证明本地数据合同与 fail-closed 路径；GREEN 不得外推为真实 SUT 可用或真机业务闭环。
- 停止条件：三份新 acceptance 全绿、旧 observation runtime/active-suite/revocation/安全 lease 回归保持其已声明精确计数、normal gate 通过、独立自审无 Critical/High/Medium 未处理 finding。

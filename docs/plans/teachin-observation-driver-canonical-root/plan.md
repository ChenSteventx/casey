# teachin-observation-driver-canonical-root — plan（coverage-freeze successor）

目标：在 `teachin-observation-transaction-root` 固定的 `PROJECT_ROOT/cases` 事务根上，重新冻结完整 driver provenance（驱动来源）安全契约。旧 `teachin-observation-driver-provenance` golden 的正向 package 固定建在 `/tmp`，被新 canonical root（规范根）在 driver 逻辑执行前安全拒绝；该历史门禁保持原 checksum，不把前置红误报成 driver 回归结论。

本契约是旧 driver provenance 的 canonical-root successor（规范根后继门禁），并组合 transaction-root 的 committed transaction（已提交事务）要求。receipt 必须在 append 前位于固定 package 内；任何 receipt/package/caller-input 拒绝均不得留下 accepted ledger、lock 或 temp residue。若门禁在当前实现上首次运行即绿，则按既有实现的 coverage-freeze（补覆盖冻结）记录，不伪造实现前红、不制造无意义生产修改。

## 1. 固定 driver 信任根

1. plain `source:'platform-runtime'` 只是字符串，不得通过 append、mint receipt 或产生 `trusted:true`；拒绝后零 accepted ledger 残留。
2. 只认生产代码内固定 registry（注册表）按 `keyId` 返回的 Ed25519 公钥。调用者提供的 `publicKey`、registry、自签 keypair 或“可信 keyId + 攻击者签名”均不得扩张信任根，且拒绝发生在 commit 前。
3. 新 fixture 复制旧公开 signed envelope（签名信封）与公开公钥材料，独立登记 checksum；私钥不进入文件、日志、命令行或报告。

## 2. Signed receipt 与 transaction 联合正向

1. signed receipt 在 append 前存在，固定 registry 数学验签成立，并精确绑定 caseId、capture/sidecar/manifest 三 hash、eventSeq、kind/name/code/platformId/scopeFingerprint/evidenceSha256 与 sessionNonce。
2. 正向 append 只铸造无可复制字段的 opaque authority（不透明权柄），随后 read 只铸造 opaque driver receipt；两者须通过私有 transaction token/package hashes/ledger generation 的联合验证，且 identity consumer 最终 `trusted:true`、`replayReady:false`。
3. ledger 必须只有 committed transaction；公开结果、ledger 与 JSON 不得泄漏私有 transaction token。

## 3. 篡改、错包与零残留

1. signed payload 任一字段、signature、keyId 攁一字节或缺 signature 均拒；每次负向 append 后 package 内不得存在 accepted ledger、lock 或 temp residue。
2. signed receipt 复制到三件套字节不同的另一 package 必须在 commit 前拒；用另一 caseId 调同一 canonical package 也拒。
3. 同名、同 click 文本或同 `source` 不放宽 package/case/transaction 绑定。

## 4. Proxy / accessor 零执行

1. append、driver reader、transaction pair、identity consumer 与 registry 的顶层/嵌套 Proxy（代理对象）在任何 trap 前拒绝，trap 调用 0 次。
2. accessor（访问器属性）不得执行 getter；调用者通过 accessor 包装 authority、receipt、public key 或 options 不能改变信任根。

## 5. Machine-readable supersession receipt

`tests/_golden/fixtures/teachin-observation-driver-canonical-root/supersession.json` 明确记录旧门禁、旧 PRD、旧失败前置、新 successor 及组合的 transaction gate。golden 同时重算旧 driver golden/fixture/public-key 与 transaction golden 的既有 PRD checksum，保证历史资产一字节未改。

## 6. 可命令化验收

- `node tests/_golden/teachin-observation-driver-canonical-root.zero-sut.golden.mjs`

共七组：plain receipt；fixed registry/调用者 key；signed 正向与 transaction pair；全 payload/signature/keyId/缺签篡改；跨 package/case；Proxy/accessor；旧 checksum + supersession receipt。

## 7. 可观察性申报

- 生产 driver 私钥是否仅真实 driver 进程可用、是否轮换/吊销，仓库公开 fixture 无法证明，`route:human`。
- signed receipt 是否确实来自同一次真实 DOM/平台响应读回、sessionNonce 的熵和持久防重放，zero-SUT 无法证明，`route:human`。
- Ed25519、file identity、atomic rename 与 lock 在 Windows/macOS/Linux/WSL 的发布构建和文件系统语义，须跨 OS 真机故障注入，`route:human`。
- 本门禁不启动 SUT、fake、fixture server、browser 或 network；GREEN 不得外推为真机 driver 已闭环，`route:human`。

## 8. 停止条件

门禁真实运行；若现实现已绿，存档 coverage-freeze green-before-freeze 证据；golden/fixtures sha256 写入新 PRD；`gate --dry --prd <新 PRD>` 与 `git diff --check` 通过；独立 gate commit 后停止。只有真实红才另改生产并独立提交。

# teachin-observation-driver-provenance — plan（full）

目标：以替代性契约补上身份观察 readback receipt（读回收据）的真实签发来源边界。`source:'platform-runtime'` 是普通字符串，不能成为 trust root（信任根）；只有代码内固定 trusted driver registry（可信驱动注册表）中登记的 `keyId` 对应 Ed25519 公钥验过 detached signature（分离签名），才能铸造 opaque driver receipt（不透明驱动收据）。accepted package authority 与 driver receipt 缺一均不得 `trusted:true`。

本契约 supersede（替代并继续收严）`teachin-observation-authority-root`。原计划、golden、fixture、PRD 与 checksum 全部保持不变；旧 receipt 的 canonical I/O 复核可保留作结构证据，但其 `canonical-receipt-io-only` 结果永远不能再被身份观察入口当成平台运行时背书。

## 1. 固定驱动信任根

1. trusted driver registry 必须是生产代码内只读常量，键为固定 `keyId`，值为固定 Ed25519 公钥。运行时参数、环境变量、receipt 内嵌公钥、同目录公钥文件、调用者传入的 `publicKey`/registry 均不能扩张信任根。
2. 私钥不进入仓库、测试 fixture、日志、红证、报告或命令行。新增 signed fixture（已签固定语料）和 public-key material（公钥材料）只包含公开信息。
3. 未签 plain `identity-readback-receipt.json` 即使 `source === 'platform-runtime'`、全部身份字段与当前 package 一致，也只能结构复核，不能 mint driver receipt，更不能产生 `trusted:true`。
4. 调用者现场自生成 Ed25519 keypair（密钥对）并对同一 payload 正确签名，或把其 public key 一并传入，也必须拒绝；自签名只能证明“某把自带私钥签过”，不能证明是可信 driver。

## 2. Signed receipt 的 Published Language（发布语言）

signed envelope（已签信封）是闭合 JSON object，字段顺序不是信任来源；验签前必须按下列固定顺序重建 canonical payload（规范载荷），UTF-8 `JSON.stringify`、无尾换行，`signature` 不进入载荷：

1. `schemaVersion`
2. `artifactKind`
3. `source`
4. `keyId`
5. `algorithm`
6. `sessionNonce`
7. `caseId`
8. `captureSha256`
9. `sidecarSha256`
10. `manifestSha256`
11. `eventSeq`
12. `kind`
13. `name`
14. `code`
15. `platformId`
16. `scopeFingerprint`
17. `evidenceSha256`

envelope 另含 `signature`，编码为标准 base64；`algorithm` 固定 `Ed25519`。验签只用 registry 按 `keyId` 取出的公钥。未知/缺失字段、重复 JSON key、非 canonical 类型、控制字符、非法 hash/nonce/signature 均 fail-closed。

## 3. 精确绑定与防错包

1. 签名载荷精确绑定 `caseId`，当前 accepted package 的 capture/sidecar/manifest 三个 sha256，`eventSeq`，`kind/name/code/platformId/scopeFingerprint/evidenceSha256`，以及本次 driver session nonce（驱动会话随机数）。
2. 上述任一字段、`signature` 或 `keyId` 改一字节均拒绝；缺签拒绝；可信 `keyId` 配攻击者签名拒绝；未知 `keyId` 即使签名数学上有效也拒绝。
3. 同一个已签 receipt 复制到另一 package、另一 case、三件套任一字节不同的目录均拒绝。名字相同、click 文本相同或 `source` 相同不能放宽。
4. 正向 fixture 只有在真实 append transaction 铸造的 accepted authority 与固定 registry 验过的 driver receipt 同时存在、且当前 bundle 逐字段一致时，身份观察才可 `trusted:true`；driver receipt 自身仍是无可复制字段的 opaque handle。

## 4. Proxy / accessor 零执行边界

1. driver receipt reader、registry lookup 与 identity trusted consumer 的顶层/嵌套输入在参数解构、反射、迭代、base64 decode 或验签前拒绝 Proxy；所有 trap 调用次数为 0。
2. 自有 getter/setter、symbol、非 enumerable 数据、异常 prototype 与循环引用在 getter 执行前拒绝；调用次数为 0。
3. 调用者通过 Proxy/accessor 包装 accepted authority、driver receipt、public key 或 options 不能触发代码执行，也不能改变固定 registry。

## 5. 可命令化验收

- `node tests/_golden/teachin-observation-driver-provenance.zero-sut.golden.mjs`

golden 必须在实现前真实红，并覆盖：plain receipt 当前假信任、调用者自带 key/自签名、固定 registry 正向签名、全部载荷字段/签名/keyId/缺签篡改、跨 package/case 复制、accepted + signed driver receipt 联合 trusted、opaque handle 与 Proxy/accessor 零执行。

冻结材料：

- `tests/_golden/fixtures/teachin-observation-driver-provenance/identity-readback-receipt.signed.json`
- `tests/_golden/fixtures/teachin-observation-driver-provenance/trusted-driver-public-key.pem`

两份材料都只有公开信息。fixture 的 Ed25519 私钥由一次性内存进程生成，未写文件、未打印、未进入 shell 参数或红证；进程退出后即丢弃。

## 6. 可观察性申报

- 生产 driver 私钥是否位于独立密钥存储、是否只有真实 driver 进程可用、是否轮换与吊销，zero-SUT 无法证明，`route:human`。
- signed receipt 是否只能由真实平台 driver 在同一次 DOM/平台响应读回后写出，zero-SUT 无法证明，`route:human`。
- `sessionNonce` 的生成熵、session 级唯一性、持久去重窗口与跨进程 replay（重放）拒绝需要真实 driver/持久状态，固定 fixture 不证明，`route:human`。
- Ed25519 依赖运行时与目标 OS 的发布构建是否一致，须跨 Windows/macOS/Linux/WSL 安装验收，`route:human`。
- 本契约不启动 SUT、fake、fixture server、浏览器或网络；零 SUT GREEN 不得外推成真机 trusted 已闭环，`route:human`。

## 7. 停止条件

新 golden 取得真实红输出并存档；golden、signed fixture、公钥材料的 sha256 写入新 PRD；`gate --dry --prd <新 PRD>` 与 `git diff --check` 通过；独立 acceptance commit 后停止。不改生产实现、不运行 SUT/browser/network、不改任何旧 frozen 资产。

# teachin-observation-sidecar — plan（full）

目标：在不连接任何 SUT 的前提下，建立身份观察旁车的闭合 schema、与示教录制包的双 hash 联合绑定，以及示教入账可调用的 fail-closed 联合复核基础。

## 1. 实现面

新增 `lib/teachin-identity-observations.mjs`：

- `buildIdentityObservationSidecar`：将 adapter 候选规范化成闭合旁车；缺 `code` 保留 `null`，不补猜。
- `serializeIdentityObservationSidecar`：产出稳定 UTF-8 JSON 字节，旁车强制未签且不可回放。
- `bindCaptureIdentityObservations`：用旁车完整字节 sha256 和条数生成 capture v2 引用，拒绝已绑 capture 被静默重绑。
- `reviewIdentityObservationBundle`：从 capture/旁车原始字节重新 parse，拒绝重复键、未知键、URL/凭据、caseId/文件名/条数/hash 不符、软链或读前后换包。
- `identityBundleLedgerFields`：仅对复核 ok 的结果投影 `captureSha256/observationSha256/bundleSha256/identityStatus/replayReady:false`，供后续 intake 台账 wiring 复用。

不修改 `bin/replay.mjs`、`bin/verdict.mjs` 或裁定 schema。

## 2. schema 与状态

- 旁车顶层只允许 `schemaVersion/artifactKind/caseId/source/observations`。
- `source` 只允许 `kind/signed/replayReady/distillRequired`，固定为 manual observation 候选安全态。
- 观察只允许 `kind/name/code/platformId/scopeFingerprint/parent/evidenceKind/eventSeq`。
- 任一观察缺 `code` 时 bundle 仍可作为蒸馏输入入账，但 `identityStatus:'pending'` 且 `replayReady:false`；全部带 code 也只是 `identityStatus:'observed'`，仍不是已签锁。

## 3. 换包与软链模型

- `captureSha256 = sha256(captureRaw)`，`observationSha256 = sha256(observationRaw)`。
- capture v2 内嵌的 observation hash 必须与 intake 现读旁车字节一致。
- `bundleSha256` 只对 `{caseId,captureSha256,observationSha256}` 的稳定序列化求 hash；两文件任一变更都会改变联合绑定。
- path facts 门要求 capture/旁车及其目录全部非软链、文件是 regular file、读前后身份 token 不变；任一不满足返回类别码，不回显路径。

## 4. 验收点

1. 合法旁车闭合、未签、`replayReady:false`，完整 code 也不直通回放。
2. 缺 code 保留 `null` 并返回 pending，不根据 name 生成编号。
3. 顶层/source/观察/capture ref 任一未知键拒绝；URL/query/header/cookie/token/raw body 字段或内容拒绝。
4. 旁车原始字节 hash、条数和定名文件被 capture v2 引用；联合复核复算两个 hash 和 bundle hash。
5. 修改 capture 事件、修改旁车 name/code、替换 caseId、伪造条数或 hash 都 fail-closed。
6. 任一文件/父目录是软链、非常规文件、读前后 token 变化都 fail-closed。
7. 联合复核结果只可投影最小台账字段，无原始页面/请求/响应内容。

## 5. 验收方法

- 新功能黄金标准测试：`node tests/_golden/teachin-observation-sidecar.zero-sut.golden.mjs`。
- 实现前因 `lib/teachin-identity-observations.mjs` 缺失而红；红证确认后冻结 sha256。
- 静态检查：`node --check lib/teachin-identity-observations.mjs`、术语检查与 `git diff --check`。

## 6. 可观察性挂账

- workflow/agent 在真实 AI 中台上如何从同一物理记录读出 name+code+platformId，以及其它对象的 code/parent 实际存在性，必须真机只读 spike，未证明前保持 pending/UNVERIFIED。
- `bin/record.mjs` 的页面 adapter、原子写盘和 `bin/intake.mjs` 的 `lstat/open/fstat` wiring 在后续 story 实现；本契约只交付可测的纯函数内核与台账投影。

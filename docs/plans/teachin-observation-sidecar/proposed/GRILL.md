# teachin-observation-sidecar — GRILL

> 用户已批准并行开发；本契约只建立示教录制包与身份观察旁车的零 SUT 证据链，不运行或连接任何真/假 SUT、fixture，不碰 replay/verdict。

## D1 产物边界

- 身份观察旁车与 `teach-in-capture.json` 分文件落盘，定名 `identity-observations.json`。
- 旁车永远 `signed:false` / `replayReady:false` / `distillRequired:true`，只是后处理候选，不是可回放 spec、不是业务对象身份收据。
- 本路不修改回放和裁定；对象类型 adapter 的真机读回单独 route:human。

## D2 观察字段和 pending

- 每条观察闭合且只允许 `kind/name/code/platformId/scopeFingerprint/parent/evidenceKind/eventSeq`。
- `code` 缺失或为空时规范化为 `null`，联合复核结果保持 `pending`；不由名称推编号，不用输入值冒充平台读回。
- `platformId` 只能是精确 string 或 `null`；`scopeFingerprint` 与 `parent` 只接受 `sha256:<64 hex>` 或 `null`。
- `evidenceKind` 是闭合枚举，LLM/视觉推断不在枚举内。

## D3 凭据与 URL 边界

- URL/query/header/cookie/token/raw body 没有落盘字段；任何未知键直接拒绝。
- 允许字段内出现 scheme/host、认证头或凭据关键词也拒绝；错误只返回类别码，不回显原值。

## D4 无循环的联合 hash

- 先序列化完整旁车字节并计算 `observationSha256`；再把固定文件名、该 hash 与条数写入 capture v2 的 `identityObservations` 引用。
- capture 完整字节另算 `captureSha256`；intake 联合复核同时返回两个 hash 和由 `caseId + captureSha256 + observationSha256` 计算的 `bundleSha256`。
- 这个先后顺序避免两个文件相互包含对方 hash 导致循环；intake 台账后续将同行记录三个 hash。

## D5 intake 故障安全复核

- 联合复核要求 caseId、定名文件、观察条数、两个字节 hash 全部一致。
- capture/旁车/其目录任一是符号链接、非常规文件、读前后身份变化，均 fail-closed。本契约先提供可注入的 path facts 纯函数门，真实 `lstat/open/fstat` adapter 在 CLI wiring 中实现。
- 两文件任一未知字段、重复 JSON 键、换包或计数不符都拒绝。

## D6 验收与停止条件

- 只写一个纯函数/静态黄金标准测试，实现前须因新模块缺失而红，冻结 checksum 后不再编辑。
- 红转绿、术语检查、`git diff --check` 和 pi.dev 异构评审证据齐全后才结束本路。

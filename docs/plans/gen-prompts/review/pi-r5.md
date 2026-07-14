# gen-prompts 修复层评审（r5）——pi

调用式：`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro @docs/plans/gen-prompts/review/material-r5.md <指令>`（pi v0.80.3，provider=deepseek，thinking=high，正常一次性完成）。评审对象：round-4 双路复核结果，与 codex 本轮同料（含修复者自查发现并修复的 userinfo 缺口）。实现方 Claude，评审方 pi/deepseek-v4-pro（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

## 逐条核实

### 1. codex round-4 的 URI authority 检测建议是否真被兑现，`URI_AUTHORITY_RE` 是否有可绕过或可误伤之处

已被兑现。新增正则仅在显式 `http://`/`https://` 协议头之后提取主机部分，不再要求四段；裸文本（无协议头）维持不检测。F4c1c 金牌已覆盖命中与干净对照，并全部通过。

IPv6 字面量：`http://[::1]/` 场景中，捕获组因第一个 `:` 而被截断，只能提取到 `[`，不会得到完整 IPv6 地址。但这不会产生误报或副作用：`[` 经 `tryUrlNormalizeHost` 会被丢弃（返回 `null`），且 IPv6 私网地址早已被既有专有正则单独捕获，新增通道仅补充两三段简写场景，不影响 IPv6 的现有检测能力。这条正则对 IPv6 的提取缺陷属于无实际影响的观察项，不构成缺陷。

非 http(s) 协议（`ftp://`、`ws://` 等）不会被匹配，设计意图达成。`\b` 锚点在常规中文自然语言 + 协议头组合中基本可靠；极端拼字形如 `abchttps://` 几乎不会出现，且即使绕过也不造成安全缺口。

### 2. userinfo 缺口是否已妥善处置，是否还有类似性质的遗漏

已妥善处置。正则中的可选组会跳过可选的 `user:pass@` 前缀，避免了内部冒号截断错误。F4c1c 新增用例（`http://user:pass@10.1/path`）已验证正确命中。未发现其他同类遗漏：userinfo 内部的 `%40`（`@` 的编码）等字符会被整体跳过，不会导致截断；无 `@` 时的冒号被正确视为端口分隔符；路径中的 `@` 不会干扰（遇 `/` 即截断）。

### 3. round-4 修复本身是否引入了新的缺陷

新增通道提取后仍要经过 `tryUrlNormalizeHost`，该函数能够处理两三段简写，没有引入漏检。大小写协议头（`HTTP://`）已通过 `i` 标志覆盖，测试通过。干净对照（版本号、无协议头文本、公网域名/公网 IP）均不误报，证明没有重新引入假阳性。未发现任何新的功能性缺陷。

### 4. 铁不变量

本轮所有材料未出现任意凭据、真实目标地址，未违反"零 LLM 裁定、authoring 不进回放闭包、零 API 密钥/网络/凭据接线"等硬约束。历史归档同样未暴露敏感信息。

---

## 最终判定：**PASS**

本轮修复符合设计要求，codex 建议被正确兑现，自查缺口已修复，未引入新缺陷，铁不变量完整。

**附带一项非阻断观察项（不影响 PASS）**：`URI_AUTHORITY_RE` 对形如 `http://[::1]/` 的 IPv6 字面量的捕获结果不正确（仅捕获到 `[`），但该场景已有专门 IPv6 检测正则覆盖，且错误捕获不会被误报，当前不下判为需修改。若未来计划用该通道解除 IPv6 副驾，建议先行修正主机部分的字符集或显式排除方括号场景。

---

## 驱动员核对（sonnet5，修复者本人）

pi 本轮判 PASS，与 codex 本轮同判 PASS，无分歧。pi 的 IPv6 观察项已实测核验：直接调用 `scanPrivateAddress` 对 `http://[::1]/path`、`http://[::1]:8080/api`、`http://[fc00::1]/status` 三例实测，均正确返回命中（`kind` 分别为 IPv6 本机回环地址/IPv6 本机回环地址/`fc00::/7`），坐实"新增通道的提取缺陷不影响整体检测结果"这一判断——scanPrivateAddress 是多条 `PRIVATE_ADDR_PATTERNS`（含既有专属 IPv6 正则）与 `scanEquivalentEncodings`（含新增 URI authority 通道）并行扫描取或的结果，任一条命中即整体命中，新增通道即便对 IPv6 场景的中间提取值不准确，也不会拖累已经独立覆盖该场景的既有专属正则。判定为已核实、无实际影响、不需修法，详见 `docs/plans/gen-prompts/review/dispositions-r5.md`。

# teachin-semantic-lock-v2 — plan（full）

## 目标

废弃 v1 的“单张收据自校验即可信”模型，建立受外部冻结 SHA-256 锚定的身份锁集。只有经受信锁集验证、冻结 binding 命中、完整扫描唯一且身份策略全部一致时，动作门才可返回 `SAME + allowAction:true`。

本契约只实现零 SUT 的确定性安全内核；不接浏览器、不运行 fake/fixture、不宣称真实 CRUD 可用。真实 AI 中台 workflow/agent 的 SAME、同名异号、删除重建、重复候选、身份迁移必须另走联网真机录像与视觉复核。

## 交付物

1. `lib/entity-semantic-lock-v2.mjs`
   - `verifyEntityLockSet({lockSetBytes,trustedSetSha256,caseId,eventsBytes})`
   - `evaluateEntityAction({handle,binding,scan})`
   - `createRunSuccessorProof({handle,binding,transitionId,previousHeadHash,authoritativeReadback,runId})`
2. `tests/_golden/teachin-semantic-lock-v2.zero-sut.golden.mjs`：冻结攻击回归。
3. 两个冻结 fixture：真实字节口径的 `events.json` 与 `entity-locks.frozen.json`。
4. `loop/prd-teachin-semantic-lock-v2.json`。

## 信任边界

- `trustedSetSha256` 必须来自锁集外部的冻结契约/checksum；待验锁集不能自报可信。
- 对 `lockSetBytes` 和 `eventsBytes` 各只解析一次，生成闭合 plain-data 快照；拒绝额外键、accessor、symbol、继承字段、非法摘要和非精确字符串。
- workflow/agent 的 `platformId` 强制 required；调用者不得省略身份字段或把 `revisionPolicy:exact` 降为 `any`。
- receipt hash 只作已锚锁集内部内容地址；provenance 必须绑定冻结 observation digest 或 user approval ref。
- `evaluateEntityAction` 是唯一可返回 `allowAction:true` 的 API。binding 必须逐字命中冻结 `stepId+intentId+atom+role+lockId+receiptHash`。
- `MISSING` 只允许“可信完整扫描且明确零候选”；扫描不完整、畸形候选、重复物理 ID 冲突、读取异常一律 `UNVERIFIED`。
- successor 只能来自锁集中已签 transition；强制当前链头、同 platformId、exact 新 revision 权威读回。生成后旧链头立即失效；proof 只在当前 run 有效。
- 所有错误只返回闭合安全码，不回显输入、getter/proxy 异常或 SUT 内容。

## 验收点

### S1 外部锚与闭合锁集

- 合法 fixture + 外部冻结 SHA + case/events 同门验证成功。
- 篡改 receipt 后重算内部 hash、篡改整锁集、case/events 错配均拒绝。
- 额外字段、非法 SHA-256、provenance 无证据、workflow/agent 缺 platformId、Number 长 ID、策略降级均拒绝。

### S2 唯一动作门与完整扫描

- 只有完整扫描、唯一物理候选、全部字段一致、当前链头有效才 `SAME`。
- 同 physicalId 冲突为 `UNVERIFIED`；不同 physicalId 同双锚为 `AMBIGUOUS`。
- 畸形候选不能洗成 `MISSING`；不完整零候选为 `UNVERIFIED`，完整零候选才 `MISSING`。
- 空白差异不静默 trim；accessor/proxy/额外字段只返回固定安全码且零动作。

### S3 successor 与旧链头失效

- direct/未知/未签 transition、非当前 head、platformId 换代、exact 新 revision 缺失全部拒绝。
- 合法 successor 链接旧 hash、绑定 runId，并使旧 head 后续零动作。

### S4 v1 隔离

- v1 冻结测试字节不变；生产接线不得继续调用 v1 creator/verify/compare/resolve/successor。
- 本契约实现阶段只提供 v2 新模块，不用包装 v1 获得假安全。

## 可观测性

- route:human：真实 workflow/agent adapter 的平台 ID、parent、revision 只读采样与五类真机对比；每案联网、录屏、视觉复核、独立 HTML/附件。
- route:human：mutation/关系写/删除确认前“同一 binding 即时复核、禁止跨 await 复用许可”的浏览器侧 TOCTOU 验证。
- route:human：人签锁集的真实签署入口、撤销和 successor 跨运行重签。


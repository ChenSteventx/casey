# teachin-semantic-lock — plan（full）

目标：手录后把每个业务对象从“当时点到的 DOM”提升为不可变身份收据；回放前重新读取当前对象并与录制/签署身份比较，完全一致才允许重绑定 UI 句柄和执行 CRUD。

## 1. 术语与产物

- 业务对象语义锁：冻结业务身份、允许重新解析临时 UI 位置的确定性门。
- 业务对象身份收据：闭合白名单对象，包含 `lockId/kind/bindingMode/name/code/platformId/scopeFingerprint/parentReceiptHash/revisionPolicy/revisionId/source/status/receiptHash`。
- 身份观察旁车：record 期间采集的未签、非 replay-ready 最小白名单观察；只用于后处理候选。
- 冻结身份锁集：compile 后绑定 `eventsSha256` 与 `{stepId,intentId,atom,role,lockId}`，随断言一起人签。

这些术语在实现提交前登记到 `CONTEXT.md`。

## 2. 纯函数内核

新增 `lib/entity-semantic-lock.mjs`：

- 建立/校验带 sha256 的不可变收据；外部对象只接受 `user-confirmed`，Casey/手录创建对象只接受 `platform-readback`。
- 所有名称、编号、平台 ID、scope 和 revision 都按精确字符串比较；平台 ID 禁止 Number/parseInt。
- `compareEntityLock(recorded,current)` 只返回 `SAME/CHANGED/MISSING/AMBIGUOUS/UNVERIFIED` 和闭合 reason/nextAction；不抛原始页面内容。
- `resolveEntityLockCandidate` 要求同一物理记录 name+code 精确、scope/parent/ID 满足策略且候选恰一。
- 有意改名/改码只能通过显式 successor API，且新收据链接 `previousReceiptHash`。

## 3. 手录后处理与哈希链

- record 期间由对象类型 adapter 持续采最小身份观察；不能等用户关窗后再从已销毁页面猜。
- capture 与 `identity-observations.json` 分开存放；capture 只记录旁车文件名、sha256 和数量。
- intake 联合校验 caseId、规范布局、软链、重复键、凭据/URL 门、captureSha256、observationSha256；缺失或换包拒账。
- distill 把 eventSeq 分组为对象引用图，只产身份候选和 pending，不直接冻结。
- compile 产生真实 events 后生成 `entity-locks.draft.json`；人签后成为 `entity-locks.frozen.json`，绑定完整 events 字节 sha256。

## 4. 回放重绑定与比较

- 启动浏览器前先校 schema、签名、caseId、eventsSha256 和 binding 覆盖。
- 登录后、首个业务动作前只读重解析：scope → 同记录 name+code → platformId/parent/revision → 详情再次读回。
- 每个 mutation/关系写/删除确认前重新比较同一 receiptHash，防 TOCTOU。
- 关系写必须同时锁 source 与 target；cleanup 也必须持有效锁，不能按旧名字猜删。
- 只允许 locator、页码、排序、行号变化；业务身份任何变化都零点击。

## 5. 有意身份迁移

- 已签 flow 显式声明 `previousReceiptHash + expected new name/code`。
- 保存后从平台权威读回新身份；完全匹配才生成 successor receipt。
- 删除把锁置 `deleted` 并要求双锚归零；后续步骤不得再用。
- 未声明迁移、读回失败或新对象 ID 异常时，旧/新对象均不自动清理，交用户处理。

## 6. 弱 agent 兜底

- 禁止 `.first()`、`nth()`、名称单锚、输入值冒充平台读回、由名称猜编号。
- 失败统一返回安全错误码与自然语言 nextAction：提供准确编号、确认新绑定并重签、重新录制或取消。
- LLM/视觉输出永远只是 candidate，不得写入权威收据字段或改变比较结论。

## 7. 验收与可观察性

机器验收：`tests/_golden/teachin-semantic-lock.zero-sut.golden.mjs`，仅导入纯函数和静态读取，不启动浏览器、网络、fake 或 fixture。

人工/真机验收：workflow 与 agent 各验证 SAME、改名、编号冲突、删除重建、候选重复；每案必须联网真实目标、录像与视觉复核。其它对象类型先只读 spike，未证明前保持 UNVERIFIED。


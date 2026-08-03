# plan — teachin raw locator uniqueness

1. 冻结 `tests/_golden/teachin-raw-locator-uniqueness.browser.golden.mjs`，在旧实现上
   记录真实 Chromium 红灯。
2. 仅修改 `lib/teachin/raw-playwright-driver.mjs`：非权威等待与权威 locator 分离；
   resolve/revalidate 均对原始 locator 计数，恰一后才取 handle。
3. 复跑新金牌、既有 raw action authority/actionability/clear-fill/runner 金牌、
   Tier 1、term-lint，并在提交后再次绑定验证。
4. 本 Wave 不改 verdict、正式 replay 语义、页面拓扑、观测包或模型路径。

## 验收

- 新真实浏览器金牌 8/8；
- 既有 raw action authority/actionability/clear-fill/runner 金牌零回归；
- canonical raw 权威路径不存在 `first/last/nth`、坐标、force 或 try-many；
- Tier 1 与术语门通过；提交后在精确 commit 上重复运行。

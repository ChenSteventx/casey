结论：**RESOLVED**。Medium-4 可最终收口，无阻断项。

证据：

- W3b 独立调用 `bin/compile.mjs`，不再借用 replay 正控：[admission-audience-wiring.golden.mjs:121](/mnt/d/ctx/heren/casey/tests/_golden/admission-audience-wiring.golden.mjs:121)。
- 两个原子均由内置策略明确归类为 read：[entity-semantic-lock-preflight.mjs:42](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:42)，因此 admission 确实走 `deterministic-read-only-policy`：[entity-semantic-lock-preflight.mjs:847](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:847)。
- compile 哨兵位于凭据、受众、身份准入及 profile/site 前置处理之后，紧邻真实 `chromium.launch` 之前：[compile.mjs:237](/mnt/d/ctx/heren/casey/bin/compile.mjs:237)。
- W3b 同时断言 `exit 66` 和 fresh tmp 中哨兵存在：[admission-audience-wiring.golden.mjs:131](/mnt/d/ctx/heren/casey/tests/_golden/admission-audience-wiring.golden.mjs:131)。仓内 compile 哨兵只有这一处写点；删除它后 `launched === false` 必使 W3b 红，即使浏览器路径偶然返回 66 也逃不掉。
- replay 与 compile 两份代码已有各自正控：W1b 约束 replay，W3b 约束 compile，原反例突变已闭合。
- 当前验收文件 SHA-256 为 `68ee7315…b4f`，与契约冻结值一致；新增只读 fixtures 也已在 `prd-tc_compile_audience.json` 冻结。

复验说明：本会话沙箱为全只读，测试因无法 `mkdtemp('/tmp/...')` 报 `EROFS`，因此没有产生有效的本地退出码复跑；这不是被测断言红。契约中保存的 gate 证据为两项 acceptance exit 0。

唯一非阻断清理项：W1b 注释仍称其证明 W1/W2/W3；现在应改成“W1 由 W1b、W2/W3 由 W3b”，但不影响机械闭合结论。

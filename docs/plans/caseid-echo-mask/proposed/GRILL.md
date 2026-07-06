# caseid-echo-mask — grill 决策记录（direct）

> 授权链：ingest 契约 codex R2-F2（High）采信修法已过七轮评审收口；本挂账在收口汇报与 HANDOFF
> 两度呈报 Steven；Steven「先继续做，后面再处理」指示接续。机械镜像已评审修法、零新决策分岔。

## 背景

ingest 契约 codex R2-F2：非法 caseId 拒绝分支回显 CLI 原值——CLI 参数是用户可控文本、在凭据兜底门
扫描面外（门只扫「将写的文本」），拒绝报错把原值打进 stderr 即泄漏面。ingest 已修（`bin/ingest.mjs:29`
只报字符集 + 「原值不回显」）；四个姊妹 CLI 存同族缝共 6 处。

## D1 范围（机械枚举，grep 全仓「非法字符」定位）

- `bin/compile.mjs:267`（caseId）/ `bin/draft.mjs:40`（caseId）/ `bin/flow-bridge.mjs:31`（caseId）/
  `bin/sign.mjs:87`（caseId）+ `:90`（signer）+ `:91`（against-build，同族 CLI 参数）。
- 六处闸序全 args-first（读任何文件之前）——金牌可用假路径直打拒绝分支。
- 改法逐字镜像 `bin/ingest.mjs:29` 已评审形态：报错只报字符集约束 + 「原值不回显」，退出码/流程零变。

## D2 非目标

不动 caseId 不一致类回显（文件侧值，另议）；不动任何退出码/闸序；不动冻结金牌（已核：
`compile-caseid-shape`/`p2-sign` C10/`draft-cli`/`flow-bridge` 只钉退出码不钉文案，零棘轮冲突）；
不动 lib（`parse-testcase` 已在 ingest 契约内封）；不碰真机。

## hermetic 可建

新金牌 `caseid-echo-mask.golden.mjs`：六处各以含哨兵片段（`hunter2`）的非法参数直打 → 断言
exit 65 + 输出含「非法字符」（证打中拒绝分支）+ 输出不含哨兵（证不回显）。实现前红（现回显）。

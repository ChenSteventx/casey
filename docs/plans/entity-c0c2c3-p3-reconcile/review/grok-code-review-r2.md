# Grok TUI code-review 复审

日期：2026-07-24

范围：完整 `casey-c0c2c3-reconcile` worktree，包括代码、权威文档、C0/C2/C3 契约、调和计划与冻结账。

边界：只读评审；未读取 `.auth`/`site.json`，未启动或连接 SUT，未调用 Claude Code。

## 第一轮

结论：`REVISE` / `REQUEST CHANGES`。

评审确认 C5 只保留 `workflow.deleteByName` 的方向正确，没有削弱 C2 source 读回或 C3 fail-closed；阻塞项为：

1. `loop/prd-p3-compile.json` 尚未补本轮 checksum amendment。
2. C3 compile-admission 稳定 2/3，必须修驱动/捕获，禁止删除具名 stderr 断言。
3. 初版构造件和零 SUT 金牌形成入参回声；应把契约默认值放进构造件、改用 atom 闭集和静态 import。
4. support 必须进入校验和所有权。

## 修正

- 构造件收紧为只允许覆盖 `caseId`，其余删除义务为契约默认值。
- 零 SUT 金牌改静态 import、atom 闭集，并继续直驱真实投影与准入纯函数。
- 调和 PRD 与 P3 owner 同时钉 support；P3 owner 补 `p3-compile.golden.mjs` amendment。
- C3 金牌直驱真 `bin/compile.mjs`；实测 plain pipe 仍丢立即退出前诊断，故改成文件描述符捕获。具名 reason 与原子断言均保留，3/3。
- C3 owner 补 checksum amendment；没有修改生产门。

## 第二轮

调用 Grok TUI 的 `code-review` skill 复审。

结论：`APPROVE`。

复审确认上一轮 blocker 已闭合：静态 import、atom 闭集、support 棘轮、P3 owner amendment、C3 3/3 捕获均成立；产品方向仍是夹具隔离而非生产特判。文件命名、单参数签名与捕获辅助抽取仅列为非阻塞打磨。评审曾条件性建议 plain pipe 若已稳定可去掉文件描述符；本地已实际证明直驱 plain pipe 仍为空，因此保留当前捕获。

未背书：full `p3-compile` 15/15、真实删除 proceed、C2 source/subject 角色重签；这些仍按各自契约 `route:human`。

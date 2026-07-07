# report-exit64 — grill 决策记录（light）

> 授权链：cli-mcp-face 契约明令挂账「report 退出码收敛（2→64）另案，动 bin/report.mjs + 其金牌涟漪，
> 记 prd-cli-mcp-face observability」（docs/plans/cli-mcp-face/learn.md:33）；Steven 2026-07-07 点选
> 「C 线快活先行」确认开工。

## D1 收敛方向

- 分岔：2→64 收敛 vs 维持历史例外。
- 证据：`bin/report.mjs:30` 用法错 `process.exit(2)`——早于全仓 exit 64 用法错约定成型；2 与熔断器
  越阈 exit 2 语义撞车（docs/plans/cli-mcp-face/learn.md:27）；全仓九个生命周期 CLI 用法错均 64
  （cli-mcp-face 金牌 :56 映射表实证，report 是唯一例外）。
- 定夺：收敛 2→64（挂账既定方向，无分岔余量）。

## D2 涟漪清单

- `tests/_golden/cli-mcp-face.golden.mjs` 四钉位翻 64：:6 头注「report 历史例外 2」、:48 注释、
  :56 `casey_report: 2`、:64 `['report', 2, '--model']`——挂账文案同步删「收敛另案」句。
- `loop/prd-cli-mcp-face.json` 该金牌 checksum 重签（唯一冻结键）。
- `tests/_golden/p7-report.golden.mjs` 零钉 2（grep 实证空），不动。
- `bin/casey.mjs report` 分发是 `runNode` 直通、退出码继承子进程，零改。

## D3 验收形态

- 新小金牌 `tests/_golden/report-exit64.golden.mjs`：C1 `bin/report.mjs` 缺 `--model` → exit 64 +
  stderr 含用法；C2 `casey report` 空参 → 64（分发面继承核验）。红先行：现状两处 exit 2 实锤。
- `loop/prd-report-exit64.json` 冻新金牌；涟漪验收 = cli-mcp-face 金牌翻钉后全绿 + prd 重签 gate GREEN。

## D4 非目标

不动其它 CLI 退出码；不动 report 渲染/凭据门/坏件六形态语义（exit 1/65 面原样）。

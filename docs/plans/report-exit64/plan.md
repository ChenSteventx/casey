# report-exit64 — report 用法错 exit 2→64 收敛（light）

## 背景

`bin/report.mjs:30` 用法错走 `process.exit(2)`，早于全仓 64 约定成型，与熔断器 exit 2 语义撞车；
cli-mcp-face 契约挂账另案（learn.md:33），本契约兑现。决策见 proposed/GRILL.md D1–D4。

## 改动

1. `bin/report.mjs:30`：用法错 `process.exit(2)` → `process.exit(64)`（仅此一行；exit 1/65 面不动）。
2. `tests/_golden/cli-mcp-face.golden.mjs` 四钉位翻 64（:6/:48 注释、:56 映射、:64 argv 表），
   删「收敛另案挂账」句。
3. `loop/prd-cli-mcp-face.json` 金牌 checksum 重签，gate 复验 GREEN。

## 验收（红金牌 tests/_golden/report-exit64.golden.mjs + loop/prd-report-exit64.json）

- C1 `bin/report.mjs` 缺 `--model` → exit 64 且 stderr 含用法行（红先行：现状 2）。
- C2 `bin/casey.mjs report` 空参 → exit 64（分发面继承核验；红先行：现状 2）。
- 涟漪：cli-mcp-face 金牌翻钉后全绿 + prd 重签 gate GREEN；p7-report 金牌零行为差。

## 非目标

见 GRILL D4。

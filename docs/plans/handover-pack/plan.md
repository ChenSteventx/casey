# handover-pack — 移交包（light）

## 背景

四路审计 D 组结论：对 Claude session 移交成熟，对人类新同事近乎零（无 README/安装步骤/凭据格式
文档；help 三处过时；MCP/skill 文档 D:\ 硬编码引向必败路径）。决策见 `proposed/GRILL.md`。

## 改动

1. `README.md` 新建（八节，见 GRILL D1；凭据节只写格式绝不写真值）。
2. `bin/casey.mjs` help 四处文案修（run/compile/sign 行 + 页脚，零行为差）。
3. `mcp/casey-server.mjs` 头注释挂载命令改 WSL 写法；`.claude/skills/casey/SKILL.md` 两处 D:\ 硬编码改仓相对。
4. `tests/_golden/handover-pack.golden.mjs`（漂移锁，红先行）+ `loop/prd-handover-pack.json`。

## 非目标

见 GRILL D4。

## 验收（红金牌）

- C1 README 在场 + 八节锚标题齐 + 零凭据形关键词真值（FORBIDDEN_KEYWORDS 扫描——字段名在反引号
  代码体里合法、真值形态 `=` 连缀不得出现）；
- C2 `casey help` 无过时形态（`run <file>`、`--build <id>]`、`P0 引导 + P1`）、有真形态锚
  （replay `--events`、sign `--against-build`、run `--expected`）；
- C3 mcp 头注释与 SKILL.md 零 `D:\ctx` 硬编码；
- 涟漪：`selftest --tier1` 无回归 + flow-bridge/ingest 金牌复跑（casey.mjs 文案改动零行为差）；
  README/SKILL.md 写入过 term-lint（hook 自动）。

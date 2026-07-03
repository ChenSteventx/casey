# compile-caseid-shape — 两条输入形状缝收口（direct）

## 改动

1. `bin/compile.mjs`：主分发处 caseId 限 `^[A-Za-z0-9_-]+$`、违例 exit 65（镜像 `draft.mjs`，任何落盘前拒门）。
2. `lib/replay-assert.mjs`：`urlPathname` `matches` 缺 value 一律 `ok:false`（空正则假绿封死，同 `replyMatches` 缝）。
3. 新 golden `tests/_golden/compile-caseid-shape.golden.mjs`（红先行）：穿越拒门 + 合法不误伤 + 空正则封死。

## 非目标

其余 CLI 的 caseId 检查普查（`replay`/`verdict`/`report` 走 `--out` 显式路径、不拼 caseId 文件名）；`matches` 之外 op 的值形状普查。

## 验收

golden 3/3（实现前 C1/C2 双红已核）；回归锁 `p3-compile`/`chiefcomplaint-smoke`/`p2-verdict` + tier1；gate GREEN。

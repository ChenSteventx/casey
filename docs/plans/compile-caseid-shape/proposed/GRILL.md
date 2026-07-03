# GRILL — compile-caseid-shape（direct，机械决策 + 缺席推定记档）

授权：Steven 本 session 显式点单「a 然后 b 然后 c」之 C =「compile.mjs caseId 形状同修（direct 小契约）」（NEXT-SESSION 下一步 C 原文）；执行时 Steven 暂离，grill 确认按缺席推定处理——**可否决**：本契约单独成两 commit 前的工作树改动，回滚路径 = revert 单 commit，零下游依赖；待 Steven 回场追认。

机械决策两条（均为既有先例直译）：

- **G1 caseId 形状检查**：`bin/compile.mjs` 主分发处（任何落盘前）限 `^[A-Za-z0-9_-]+$`、违例 exit 65——逐字镜像 `bin/draft.mjs` R1-F2 先例（draft-cli 评审当时即指明 compile 同型缝）。红先行实证：穿越形态 `x/../../evil` 真把 `flow-*.json` 写出 `--out-dir` 之外且 exit 0。
- **G2 顺手并批 `urlPathname` 空正则缝**：chiefcomplaint-smoke 评审挂账（audit 记档「走后续 direct 小契约」）——`matches` 缺 value 时 `new RegExp(undefined)` 空正则匹配一切假绿；修法同 `replyMatches` 缝（缺 value 一律 false，护栏 #14）。超出 Steven 点单字面的唯一增项，依据 = 挂账原文与同型缝并批先例（draft-cli 修正采纳惯例）。

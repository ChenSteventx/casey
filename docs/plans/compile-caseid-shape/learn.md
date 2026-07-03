# learn — compile-caseid-shape（direct，2026-07-03）

一条沉淀：**评审挂账的「同型缝」要成批收，且每缝红先行**。本契约两缝分别来自 draft-cli 评审（caseId 形状）与 chiefcomplaint-smoke 评审（空正则）——都是「别处修过、此处同型」的缝。经验：同型缝的修法可以直译先例，但红基线不能省——两缝双红都拿到了实证（穿越真写出 out-dir 之外 / 空正则真判 true），证明「同型」判断不是想当然。`new RegExp(undefined)` 这类语言陷阱缝，全仓 grep 构造点普查一遍的成本低于零星再挖（本轮已核：`evalOne` 内两处 matches 均已封、`drift-probe` 的 RegExp 有 escape 包裹、别处无裸构造）。

注：grill 确认按缺席推定记档（Steven 显式点单 C 在先、G2 并批增项待追认，回滚 = revert 单 commit）。

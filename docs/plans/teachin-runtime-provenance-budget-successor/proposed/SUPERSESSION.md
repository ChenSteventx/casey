# Formal supersession — runtime authority bundle successor

- 被取代契约：`teachin-runtime-authority-bundle-successor`
- 当前基线：`819015f523aa966d4005905a7673e73b4cd19eca`
- 实测命令：`node tests/_golden/teachin-runtime-authority-bundle-successor.zero-sut.golden.mjs all`
- 实测退出码：`1`
- 实测汇总：`3 过 / 9 红`（三项通过、九项失败，共十二项；不是绿色）
- 取代链：`teachin-runtime-provenance-successor` → `teachin-runtime-provenance-budget-successor`

旧 PRD 中的 `passes:true` 只记录该旧契约当时的 gate 结果，不能描述当前代码。旧 bundle successor 依赖的可执行正向路径已因先执行后验与来源证明不足被撤回；本 successor 仍只核验不执行的数据 provenance（来源证明），不恢复 executable loader（可执行加载器）。所有旧 golden、fixture、RED 证据和 PRD 保持逐字节不变。

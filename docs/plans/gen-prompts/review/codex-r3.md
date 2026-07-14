# gen-prompts 修复层评审（r3）——codex

调用式：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-gen-prompts -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium <指令> < docs/plans/gen-prompts/review/material-r3.md`（codex-cli 0.144.1，sandbox=read-only，reasoning effort=medium，用量 119,262 tokens）。评审对象：round-2 双路复核结果——codex round-2 判 NEEDS CHANGES 给出 4 条缺陷，修复者逐条处置后的结果（commit `db3ab4d`，父提交 `1416147`）。实现方 Claude，评审方 codex（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

结论：**需修改**（原文 NEEDS CHANGES）。

round-2 的地址脱敏与三种点名编码修复成立，但地址扫描引入了可复现假阴性；N1c 也没有真正关闭 A7，存在两个直接绕过。

1. **A7 仍未关闭：N1c 漏掉 `fork()`，且计数基线允许复用既有调用点。**

   位置：[tests/_golden/gen-prompts.golden.mjs:853](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:853)

   - `SPAWN_CALL_RE` 只包含 `spawn*`、`exec*`、`execFile*`，没有 Node `child_process.fork()`。
   - 实测包含 `fork()` 和被注释剥离器吞掉的动态目标名时：N1b 去注释后看不到 `promptset-freeze`；N1c 命中数为 `0`。
   - 即使继续使用 `spawnSync()`，只要改写 [bin/promptset.mjs:42](/mnt/d/ctx/heren/casey-gen-prompts/bin/promptset.mjs:42) 的既有调用点，让它动态指向 authoring bin：去注释后禁词不可见；调用点仍是 `1`；`1 > baseline 1` 为假，N1c 继续绿。
   - 实测结果：`replacement-poc spawnCount=1 baseline=1 overBaseline=false`；`fork-poc spawnCount=0`。
   - 因此处置表所称"任何新增调用点都会超过基线"并不足以证明 authoring 不会经进程边进入闭包。

2. **四段收紧引入常见 WHATWG 私网简写假阴性。**

   位置：[lib/promptset-authoring.mjs:323](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:323)

   当前正则只提取恰好四段，导致 `127.1 -> 127.0.0.1`、`10.1 -> 10.0.0.1` 均 `hit=false`。`127.1` 是常见回环简写，`10.1` 也是 WHATWG 可归一的私网裸主机形态。处置表把它记为"可接受残余缺口"，但原契约要求覆盖枚举私网网段的裸主机形态，并未将数字型二/三段简写列为非目标。不能直接类比"内部域名无法穷举"。

3. **round-2 地址修复没有进入冻结回归测试。**

   位置：[tests/_golden/gen-prompts.golden.mjs:610](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:610)

   F4c1 仍只测试 round-1 的五种形态。三种 round-2 修复输入（大写十六进制前缀、无分隔符前导零八进制整串、点分段内混十六进制）没有测试断言；新增的版本号、小数干净语料同样没有加入测试。当前实现确实通过这些手工输入，但以后回归时冻结金牌不会判红。

4. **round-3 材料本身不完整且存在陈旧证据。**

   位置：[material-r3.md:3](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/review/material-r3.md:3)、[material-r3.md:122](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/review/material-r3.md:122)

   材料称提交只涉及 3 个文件；实际 `db3ab4d` 修改了 8 个文件，包括 `loop/prd-gen-prompts.json` 和多份评审归档。材料仍称 PRD"待同步重签"，但同一材料的门禁摘录称已 GREEN；实际提交也已更新 checksum 与 gate evidence。

核实成立的部分：

- 已知废弃真实地址字节串在当前仓库、所有评审归档及 `material-r3.md` 中均为 0 命中。
- 三种点名新增编码均实测 `hit:true`。
- "产品版本 10.20"、"重量 10.5 公斤"等特定假阳性均已消失。
- 当前闭包基线准确：replay 11 文件/0、verdict 1/0、promptset 3/1。
- `bin/verdict.mjs`、`lib/sign-gate.mjs` 与父提交 sha256 完全一致；`lib/promptset.mjs` 也字节不动。
- 当前 replay/verdict/promptset import 闭包的 authoring 命中均为 0。
- seed/freeze 两个纯度闭包检查均 exit 0，未发现新增 API key、网络或凭据接线。
- 当前金牌 checksum 与 PRD 冻结值一致。由于沙箱禁止创建 `/tmp`，本轮金牌复跑被 `EROFS` 阻止，不能把附件中的"74/0"表述为本轮独立复跑结果。

---

## 驱动员核对（sonnet5，修复者本人）

4 条全部复现属实，逐条修死（`docs/plans/gen-prompts/review/dispositions-r3.md`）：① `fork` 补进 `SPAWN_CALL_RE`；新增 N1e 正向允许清单核对 `bin/promptset.mjs` 编排目标集合，堵住"repoint 既有调用点"（合成 mutation 测试验证有效；如实记账仍非终极防线，面对动态计算目标名的极端混淆无能为力，同「内部域名无法穷举」一类静态分析公认边界）；② 采纳"域名类比不成立"的批评，改写取舍理由为"两三段简写与自然语言数字词法上不可区分"，金牌新增 F4c1b 冻结此边界现状（非静默维持）；③ F4c1 扩容覆盖 round-2 三新形态 + 假阳性回归语料，冻进金牌；④ `material-r3.md` 两处陈旧/表述不清文字已订正（历史评审事实不变，仅文档内部一致性修正）。金牌 76 过/0 败。

# loop-kit-extract 实现审 round-2 第七次跑评审料（material-impl-r8）

> 用途：喂给异构冗余实现审（`codex` / `pi`）round-2 第七次跑。第六次跑（`r7`）`pi` 判 `PASS`、
> `codex` 判 `CHANGES REQUIRED`（1 `MED`：`codex-impl-r6.md` 的处置记录自述与实际改动范围不一致，
> 详见 `codex-impl-r7.md`）。本轮复核该 `MED` 处置后的状态——若
> 本轮 `codex` 与 `pi` 同时判 `PASS`，round-2 双路复核收口。

---

## 0. 评审指令（原样转发）

你是异构冗余实现审的评审方（评审家族≠实现家族：实现方是 Claude/Sonnet 5）。这是
`casey-loop-kit-extract` 契约实现审第七次跑（round-2 第七次跑）。请核实：

1. `round-2` 第六次跑发现的 1 条 `MED`（`codex-impl-r6.md`「处置与去向」一节原文错误地写「`root.mjs`
   未再改动」「不涉及任何代码字节」，与实际处置——包仓 `root.mjs` 语义 4 补交叉引用——不符）是否已
   妥善处置：改写后的文字是否准确反映实际五处改动（含包仓 `root.mjs` 注释交叉引用一项），有没有
   引入新的不准确表述。
2. 本轮改动是否严格限于 `codex-impl-r6.md` 这一份评审记录文件的文本修订（不涉及 `plan.md`/
   `GRILL.md`/`prd`/任何运行时代码字节的进一步改动）。
3. 是否有任何新引入的问题、或对此前六轮已闭合项目的意外破坏。
4. 冻结纪律与凭据/术语边界同前几轮标准。
5. 若你认为当前状态已是合理的最终态（round-2 双路复核可以收口），请明确给出 `PASS` 结论；若仍有
   发现，请标 `HIGH`/`MED`/`LOW` 并给出文件位置与复现方式。

给出总体结论（`PASS` / `CHANGES REQUIRED`）。你在 `read-only` 沙箱内可以自行读文件、跑只读命令来
验证。

---

## 1. 历史发现摘要

`round-1`（fable 汇裁 `arb-impl-r1.md`，7 条采信，已修复）与 `round-2` 第一至五次跑（`codex` 累计
5 `HIGH`+2 `MED`+1 `LOW`，均已修复；`pi` 每轮同料判 `PASS`）：详见
`docs/plans/loop-kit-extract/review/codex-impl-r2.md`~`r6.md`、`arb-impl-r1.md`。

`round-2` 第六次跑（`r7`，`codex` 1 `MED`，本轮处置对象；`pi` 同料判 `PASS`）：`codex-impl-r6.md`
「处置与去向」一节原文写道 `root.mjs`「未再改动」、修复「不涉及任何代码字节」，但第五次跑（`r6`）
的实际处置包括包仓 `ea5ed85` 对 `root.mjs` 语义 4 的一行注释交叉引用修改（连带更新期望存档副本、
`kit-lock.json` 与两条 `testChecksums`）——记录自述与实际改动范围不一致，未准确反映改动全貌（审计
记录自身准确性问题，非新代码缺陷、非契约缺口）。详见
`docs/plans/loop-kit-extract/review/codex-impl-r7.md`。

## 2. 本轮新增处置（针对第六次跑 `MED`）

改写 `docs/plans/loop-kit-extract/review/codex-impl-r6.md`「处置与去向」一节：

- 把原「四处处置」改为准确的「五处处置」，补入第⑤项（包仓 `root.mjs` 语义 4 补交叉引用）；
- 把「`root.mjs` 本身...未再改动」改为准确描述——语义 6 本身表述在上一轮已准确、本轮未再改动，
  但语义 4 补了指向语义 6 的交叉引用（这才是本轮对 `root.mjs` 的唯一改动）；
- 把「不涉及任何代码字节」改为准确的「Casey 侧三处纯文档变更 + 包仓 `root.mjs` 一行注释交叉引用，
  运行时逻辑函数体零字节改动」；
- 节末新增「勘误」小节，如实记录原文措辞不准确之处、指向 `codex-impl-r7.md`，保留更正过程可追溯
  （不删除或掩盖原始记录的存在，只订正其准确性）。

本轮改动**仅限**该一份评审记录文件的文本；不涉及 `plan.md`/`GRILL.md`/`prd`/任何运行时代码。

## 3. 门禁证据（本轮，disposition 落地后独立重跑，非转录）

```
$ node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json
gate: GREEN —— story 5/5 过

$ node tests/_golden/loop-kit-extract.golden.mjs
loop-kit-extract golden: 73/73 GREEN

$ node bin/casey.mjs selftest --tier1
selftest --tier1: 全链路 GREEN —— 确定性内核 + 统一语言双向有效。

$ node loop-kit/bin/ratchet.mjs verify
ratchet verify: RED -- 69 PRD / 190 冻结文件 / 2 问题
RED FILE_MISSING cases/tc_wf_history_version/expected.frozen.json
RED FILE_MISSING cases/tc_wf_publish_states/expected.frozen.json
```

上述 2 项 `FILE_MISSING` 是本契约无关的既有缺口（`prd` `observability` 已记档，历次跑同为这 2 项，
本轮改动前后无变化）。

Casey 树 HEAD（本轮评审时）：working tree 相对 `7349441` 的未提交改动仅本节所述的
`codex-impl-r6.md` 文本修订 + `material-impl-r7.md`/`pi-impl-r7.md`/`codex-impl-r7.md` 三份新增
评审记录（纯文本证据）+ `prd` 的 `evidence` 时间戳刷新（历次 `gate` 重跑的连带效应，`passes`/
`testChecksums`/`observability` 实质内容不变）。包仓 HEAD 仍为 `ea5ed85`（本轮无包仓改动）。

## 4. Diff（Casey worktree，本轮新增处置：`codex-impl-r6.md` 文本修订）

> 说明：`31e71de`→`7349441` 的累积 diff（round-1 全部修复 + round-2 第一至五次跑全部修复）已在
> `material-impl-r2.md`~`material-impl-r7.md` 中完整呈现并经 `codex`/`pi` 逐轮审过，此处不再重复；
> 本节只含第六次跑发现的 `MED` 在本轮的处置 diff。本 diff 不含同一批次新增的
> `material-impl-r7.md`/`pi-impl-r7.md`/`codex-impl-r7.md`（纯文本评审证据，不参与本轮审查）与
> `prd` 的 `evidence` 时间戳刷新（历次 `gate` 重跑的连带效应，无实质内容变化）。

```diff
diff --git a/docs/plans/loop-kit-extract/review/codex-impl-r6.md b/docs/plans/loop-kit-extract/review/codex-impl-r6.md
index d40333f..78fc954 100644
--- a/docs/plans/loop-kit-extract/review/codex-impl-r6.md
+++ b/docs/plans/loop-kit-extract/review/codex-impl-r6.md
@@ -55,9 +55,16 @@
 纯文档方案、同步全部权威契约表述）：①`plan.md` §1.2/§1.4 两处「进程唯一 ROOT」补加范围精确表述
 的交叉引用；②`GRILL.md` D4 段补加完整的范围精确表述专节（技术原因+收窄依据+触发重评条件）；③
 `plan.md` 新增 route:human #7（待 Steven 契约收尾人签时一并确认）与对应 §7 挂账条目；④`prd`
-`observability` 新增一条 `route: "human"` 记录，格式对齐既有 R2-L1 先例。`root.mjs` 本身语义 6
-的表述在上一轮已经准确（未再改动，`root.mjs` 头注全文已是「本机制运行所在的默认 Node.js 主 realm
-内唯一」，codex 引用的第 12 行「进程唯一」出现在语义 4——已在语义 6 单独精确说明，两处并存，注释
-内部逻辑一致，非矛盾陈述，但为消除误读风险，本轮同时确认该结构仍成立）。修复涉及 Casey 侧
-`plan.md`/`GRILL.md`/`prd` 三处纯文档变更，不涉及任何代码字节。处置完成后需再跑一轮 `codex` +
-`pi` 双路复核确认收口。
+`observability` 新增一条 `route: "human"` 记录，格式对齐既有 R2-L1 先例；⑤包仓
+`/mnt/d/ctx/heren/loop-kit` 的 `root.mjs` 语义 4 补一行交叉引用「（『进程唯一』的准确范围见语义 6，
+下同）」，消除语义 4 无条件表述与语义 6 精确范围表述并存时的内部表述不一致（语义 6 本身的表述在
+上一轮已经准确、本轮未再改动，仅语义 4 补了指向语义 6 的交叉引用）。修复涉及 Casey 侧
+`plan.md`/`GRILL.md`/`prd` 三处纯文档变更 + 包仓 `root.mjs` 一行注释交叉引用，`resolveRoot`/
+`claimAtomic`/`writeClaimed`/`revalidateClaimed` 等运行时逻辑函数体零字节改动。处置完成后需再跑
+一轮 `codex` + `pi` 双路复核确认收口。
+
+**勘误（round-2 第六次跑，`codex` `MED`，见 `codex-impl-r7.md`）**：本节上一版原文错误地写作
+「`root.mjs` 本身...未再改动」「修复涉及 Casey 侧 `plan.md`/`GRILL.md`/`prd` 三处纯文档变更，不
+涉及任何代码字节」——与实际处置（含包仓 `root.mjs` 语义 4 的注释交叉引用，见包仓 commit
+`ea5ed85`）不符，未准确反映改动范围。本节已按实际处置改写为上述五点，此勘误说明保留以存留原始
+记录与更正过程。
```

（本 diff 已是完整逐字节改动，无省略；确系单文件纯文本修订。）

## 5. Diff（包仓 `/mnt/d/ctx/heren/loop-kit`）

本轮无包仓改动（HEAD 仍为 `ea5ed85`，与 `material-impl-r7.md` 第五节评审时一致）。

# loop-kit-extract 实现审 round-2 第八次跑评审料（material-impl-r9）

> 用途：喂给异构冗余实现审（`codex` / `pi`）round-2 第八次跑。第七次跑（`r8`）`pi` 判 `PASS`
> （第二次调用，首次调用退化重跑）、`codex` 判 `CHANGES REQUIRED`（1 `MED`：`codex-impl-r6.md` 的
> 处置记录仍未完整记录冻结哈希连带更新，详见 `codex-impl-r8.md`）。本轮复核该 `MED` 处置后的状态
> ——若本轮 `codex` 与 `pi` 同时判 `PASS`，round-2 双路复核收口。

---

## 0. 评审指令（原样转发）

你是异构冗余实现审的评审方（评审家族≠实现家族：实现方是 Claude/Sonnet 5）。这是
`casey-loop-kit-extract` 契约实现审第八次跑（round-2 第八次跑）。请核实：

1. `round-2` 第七次跑发现的 1 条 `MED`（`codex-impl-r6.md`「处置与去向」一节仍未记录期望存档副本/
   `kit-lock.json`/两条 `testChecksums` 的连带更新，也未写出两侧提交号）是否已妥善处置：补入的
   句子是否准确、完整（连带链路 + 两侧提交号），有没有引入新的不准确表述。
2. 通盘核对 `codex-impl-r6.md`「处置与去向」一节现在的完整文字，是否还有任何遗留的不准确或遗漏
   之处（不局限于第七次跑指出的这一点）。
3. 本轮改动是否严格限于 `codex-impl-r6.md` 这一份评审记录文件的文本（不涉及 `plan.md`/
   `GRILL.md`/`prd`/任何运行时代码字节的进一步改动）。
4. 是否有任何新引入的问题、或对此前七轮已闭合项目的意外破坏。
5. 冻结纪律与凭据/术语边界同前几轮标准。
6. 若你认为当前状态已是合理的最终态（round-2 双路复核可以收口），请明确给出 `PASS` 结论；若仍有
   发现，请标 `HIGH`/`MED`/`LOW` 并给出文件位置与复现方式。

给出总体结论（`PASS` / `CHANGES REQUIRED`）。你在 `read-only` 沙箱内可以自行读文件、跑只读命令来
验证。

---

## 1. 历史发现摘要

`round-1`（fable 汇裁 `arb-impl-r1.md`，7 条采信，已修复）与 `round-2` 第一至五次跑（`codex` 累计
5 `HIGH`+2 `MED`+1 `LOW`，均已修复；`pi` 每轮同料判 `PASS`）：详见
`docs/plans/loop-kit-extract/review/codex-impl-r2.md`~`r6.md`、`arb-impl-r1.md`。

`round-2` 第六次跑（`r7`，`codex` 1 `MED`，已修复）：`codex-impl-r6.md`「处置与去向」一节原文写
`root.mjs`「未再改动」、修复「不涉及任何代码字节」，与第五次跑实际处置（含包仓 `root.mjs` 语义 4
注释交叉引用）不符。修复：改写为准确的五处处置。

`round-2` 第七次跑（`r8`，`codex` 1 `MED`，本轮处置对象；`pi` 第二次调用判 `PASS`）：第六次跑的
改写虽已正确补入包仓 `root.mjs` 注释修改，但仍未记录该改动连带触发的期望存档副本/`kit-lock.json`/
两条 `testChecksums` 更新，也未写出两侧提交号——处置记录本身的完整性仍有缺口。详见
`docs/plans/loop-kit-extract/review/codex-impl-r8.md`。

## 2. 本轮新增处置（针对第七次跑 `MED`）

在 `docs/plans/loop-kit-extract/review/codex-impl-r6.md`「处置与去向」一节「……运行时逻辑函数体
零字节改动。」之后，补一句连带更新说明：包仓 `root.mjs` 字节变化 → Casey 侧期望存档副本
`tests/fixtures/loop-kit-expected/package/lib/root.mjs` 同步复制为逐字节一致 →
`loop-kit/kit-lock.json`（全包清单 sha256）随之改变 → `prd` 中对应两条 `testChecksums`（
`loop-kit/kit-lock.json` 与该期望存档副本）同步更新；并明确写出两侧提交号（包仓 `ea5ed85`、Casey
侧 `7349441`）。

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

上述 2 项 `FILE_MISSING` 是本契约无关的既有缺口，历次跑同为这 2 项，本轮改动前后无变化。包仓
`/mnt/d/ctx/heren/loop-kit` HEAD 仍为 `ea5ed85`（本轮无包仓改动）。

## 4. Diff（Casey worktree，本轮新增处置：`codex-impl-r6.md` 补充连带更新说明）

> 说明：`31e71de`→`7349441` 的累积 diff、以及第六次跑（`r7`）对 `codex-impl-r6.md` 的初次改写
> diff，均已在 `material-impl-r2.md`~`material-impl-r8.md` 中完整呈现并经 `codex`/`pi` 逐轮审过，
> 此处不再重复；本节只含第七次跑发现的 `MED` 在本轮的处置 diff。本 diff 不含同一批次新增的
> `material-impl-r8.md`/`pi-impl-r8.md`/`codex-impl-r8.md`（纯文本评审证据，不参与本轮审查）。

```diff
diff --git a/docs/plans/loop-kit-extract/review/codex-impl-r6.md b/docs/plans/loop-kit-extract/review/codex-impl-r6.md
@@ 处置与去向一节末段（第六次跑改写后的版本）
 `plan.md`/`GRILL.md`/`prd` 三处纯文档变更 + 包仓 `root.mjs` 一行注释交叉引用，`resolveRoot`/
-`claimAtomic`/`writeClaimed`/`revalidateClaimed` 等运行时逻辑函数体零字节改动。处置完成后需再跑
-一轮 `codex` + `pi` 双路复核确认收口。
+`claimAtomic`/`writeClaimed`/`revalidateClaimed` 等运行时逻辑函数体零字节改动。连带更新：包仓
+`root.mjs` 字节变化 → Casey 侧期望存档副本 `tests/fixtures/loop-kit-expected/package/lib/root.mjs`
+同步复制为逐字节一致 → `loop-kit/kit-lock.json`（全包清单 sha256）随之改变 → `prd` 中对应两条
+`testChecksums`（`loop-kit/kit-lock.json` 与该期望存档副本）同步更新；包仓提交为 `ea5ed85`，Casey
+侧落点提交为 `7349441`。处置完成后需再跑一轮 `codex` + `pi` 双路复核确认收口。
```

（本 diff 已是完整逐字节改动，无省略；确系单文件单段落纯文本补充，`plan.md`/`GRILL.md`/`prd`/
包仓均无变化。）

## 5. Diff（包仓 `/mnt/d/ctx/heren/loop-kit`）

本轮无包仓改动（HEAD 仍为 `ea5ed85`）。

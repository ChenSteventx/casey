# loop-kit-extract 实现审记录（r2 第六次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-2 第五次跑发现（1 `HIGH`，治理/文档一致性缺口）处置后的
  复核。Casey 树 commit `7349441`（父 `4dcc918`）+ 包仓 `/mnt/d/ctx/heren/loop-kit` commit `ea5ed85`
  （父 `462c455`）。评审料：`docs/plans/loop-kit-extract/review/material-impl-r7.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s
  read-only -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli
  0.144.1`。
- 评审指令本轮要求：核对 `round-2` 第五次跑 `HIGH` 的四项处置（`plan.md`/`GRILL.md`/`prd`
  `observability`/`root.mjs` 交叉引用）是否完整准确、四处表述与 `codex-impl-r6.md` 记录之间是否
  一致、本轮是否严格纯文档/注释零运行时逻辑改动、是否有新问题或对既往闭合项的破坏。

## 结论

`CHANGES REQUIRED`——发现 1 项 `MED`（审计记录自身准确性问题，非新代码缺陷或契约缺口）。

## MED

**`codex-impl-r6.md` 的处置记录与实际四处修复不一致**
（`docs/plans/loop-kit-extract/review/codex-impl-r6.md:58`、`loop-kit/lib/root.mjs:12`）

`codex-impl-r6.md`「处置与去向」一节原文写道：`root.mjs`「未再改动」、修复只涉及 Casey 侧
`plan.md`/`GRILL.md`/`prd` 三处、「不涉及任何代码字节」。但实际处置还包括包仓 `ea5ed85` 对
`root.mjs` 语义 4 的注释交叉引用修改（新增「（『进程唯一』的准确范围见语义 6，下同）」一句），并
连带更新期望存档副本、`kit-lock.json` 与两条 `testChecksums`。这与材料所称「四处改动」及
`codex-impl-r6.md` 自述的范围直接矛盾，未满足评审指令「四处表述与 `codex-impl-r6.md` 记录之间是否
一致」这一审计一致性要求。

复现：

```
sed -n '52,63p' docs/plans/loop-kit-extract/review/codex-impl-r6.md
git -C /mnt/d/ctx/heren/loop-kit show --stat ea5ed85
```

建议把该处置段修订为实际五处处置（含包仓 `root.mjs` 注释改动），并记录包仓提交及冻结哈希连带更新。
无需修改任何运行时逻辑。

## 已确认闭合

- `plan.md` §1.2/§1.4 两处交叉引用准确指向 `GRILL.md` D4。
- `GRILL.md` D4 新增专节完整覆盖技术原因、三项收窄依据和触发重评条件。
- `prd` `observability` 新增记录格式与既有 `R2-L1` 先例一致，`route: "human"` 标注恰当。
- `root.mjs` 本轮包仓 diff 仅注释、语法检查通过，零运行时逻辑变化。
- 90 个 `testChecksums` 全部匹配；包、期望存档副本与 `kit-lock` 三方一致。
- `C0`/`C1` 独立复跑 `6/6 GREEN`。
- Test Ratchet 仍仅有材料所述两项既有 `FILE_MISSING`，与本契约无关。
- 当前 `prd` 相对 HEAD 的未提交变化仅为独立 `gate` 重跑生成的 5 个 `evidence` 时间戳刷新，不构成
  实现问题。
- 未发现凭据泄漏或新的术语边界问题；未发现对既往五轮已闭合项目的意外破坏。

## 处置与去向

本记录发现的 `MED` 已由实现方（Claude）当场处置（同一工作会话内）：改写
`codex-impl-r6.md`「处置与去向」一节为实际五处处置（补入包仓 `root.mjs` 语义 4 注释交叉引用一项），
并在该节末尾新增一段「勘误」说明，如实记录原文措辞不准确之处、指向本记录、保留更正过程可追溯。
修复涉及 Casey 侧审查记录文件（`docs/plans/loop-kit-extract/review/codex-impl-r6.md`）纯文本更正，
不涉及 `plan.md`/`GRILL.md`/`prd`/任何代码字节的进一步改动（第五次跑的四项处置本身内容不变，只是
其记录的准确性得到修正）。处置完成后需再跑一轮 `codex` + `pi` 双路复核确认收口。

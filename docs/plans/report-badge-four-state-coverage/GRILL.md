# GRILL：四态徽章渲染覆盖缺口

## 谁在拍板

Steven 2026-07-31 裁定「择甲」：补齐四态徽章渲染的黄金标准覆盖。本文件记录裁定前后的事实核对，不是重新论证。

## 事实（已实测，非推断）

`docs/plans/bootstrap/plan.md` 的 P9 验收点写着「4 态徽章全覆盖」，实测不成立：

1. 四态**分类**证据齐 —— `tests/_golden/p2-verdict.golden.mjs` 喂合成三轴逐 case 验四态，夹具
   `tests/_golden/fixtures/p2/verdict-cases.json` 八条 case 覆盖 `PASS` / `SUT_DEFECT` /
   `HARNESS_ERROR` / `NEEDS_HUMAN`（后者含 `SUT_DEFECT_OR_STALE` / `AMBIGUOUS_ACTION` /
   `INDETERMINATE` 三个理由子类）。
2. 四态**徽章渲染**只覆盖两态 —— `tests/_golden/p7-report.golden.mjs` 逐步校「该步态名必须在其片段内出现」，
   但夹具 `tests/_golden/fixtures/seams/report-model.fixture.json` 只有两步，步级 `verdict` 取值集合
   = `{PASS, SUT_DEFECT}`。`HARNESS_ERROR` 与 `NEEDS_HUMAN` 只作为裁定概览计数出现且值为 0。
3. `tests/_golden/casey-demo.golden.mjs` 只钉 `class="badge pass"` 与「通过」，同样不覆盖那两态。

## 渲染器侧核对（本轮复核，结论：无需改实现）

- `lib/report.mjs:17` `VERDICT_ZH` 四态全（`HARNESS_ERROR: '过程错误'`、`NEEDS_HUMAN: '待人裁决'`）；
- `lib/report.mjs:19` `VERDICT_CLS` 四态全（`harness` / `human`）；
- `lib/report.mjs:64-68` 四个徽章 CSS 类都在；
- `lib/report.mjs:102-103` `badge()` 直接查表，无分支；
- `lib/report.mjs:227` `stepHtml()` 对 `NEEDS_HUMAN` 且有 `reason` 时多渲一段「理由子类」，该分支目前无任何黄金标准踩到。

`tests/_golden/p7-report.golden.mjs` 的逐步断言是遍历 `model.steps` 的通用形态，且已预置
`NEEDS_HUMAN` + `reason` 分支断言（写着但因夹具不含该态而从未执行）。所以判别力缺口在夹具、不在断言，也不在渲染器。

## 为什么 `NEEDS_HUMAN` 要紧

它是 fail-safe 内核最常落的一态（publish 真机四轮全落它），徽章却从没被证过。证不出就 `NEEDS_HUMAN`
是护栏 #14 的地板；地板的人读呈现没有回归防线，等于报告最常见的那一屏没人守。

## 裁定与范围

甲案：夹具加两步（一步 `HARNESS_ERROR`、一步 `NEEDS_HUMAN` 带 `reason`），让 `p7-report` 的逐步徽章
断言天然覆盖到它们；渲染器一行不改；两份冻结该夹具的 prd 走 `checksumAmendment` 换签。

不做：不改 `lib/report.mjs`、不改 `tests/_golden/p7-report.golden.mjs`（除非实测证明它硬编码步数/步 id）、
不裁剪夹具去迁就断言。

# plan — teachin-raw-actionability-closure（v3：瘦身直修）

> 前置：`GRILL.md` v3（根因 D0 已实证）。lane=full，worktree 独立 baton
>（与主树 tier-2 收口并行，护栏 #18）。目标：修 seam、保真夹具、补结构性
> 正控，真机两击自动闭环绿（A4）。

## 1. 生产件改动（逐文件，总量刻意小）

1. `lib/teachin/raw-playwright-driver.mjs`：`performRawCandidate` 改闭包捕获
   （invoke 闭包收 actionResult；拓扑结果只判 ok；闭包值缺失/非真 fail-closed
   判失败）。**只动这一处生产逻辑**。
2. 明确不改：`lib/page-topology/controller.mjs`（真接缝就是契约）、
   `lib/page-topology/replay-action.mjs`（先例参照物）、`raw-replay-runner`
   判定语义、`action-authority` 生产件、`cycle-evidence-*`（v1 形状不动）、
   `verdict.mjs`、一切 authority 键集。

## 2. 金牌与夹具换签（红先行）

1. 新 `tests/_golden/teachin-raw-actionability.zero-sut.golden.mjs`：
   GRILL G1-G3（真控制器×真驱动接合正控、seam 回退负控、替身保真逐键对账、
   fill/press 回归）；
2. 换签两枚既有金牌（原件 gzip 存档 `.pre-actionability-amendment.archive.gz`）：
   `teachin-replayability-action-authority.zero-sut.golden.mjs` 与
   `teachin-clear-fill-admission.zero-sut.golden.mjs` 的拓扑替身保真化
   （吞异常/无 value/键集与真控制器全等），受影响断言随真语义修，各配
   负控（替身回填 value 键即红）。

## 3. prd 与验收

`loop/prd-teachin-raw-actionability-closure.json`：s1 新金牌红→绿；
s2 = GRILL G4 十二面精确清单；s3 漂移扫+term-lint。
验收 A1-A5 见 GRILL（A4=真机 wf_list 两击 record 退出码 0）。
换签账：`prd-teachin-replayability-closure` 与 `prd-teachin-clear-fill-admission`
两笔 checksumAmendments + Steven 签。

## 4. 评审与风险

计划 v3 codex delta 一轮（换根说明+瘦身裁定）；实现 opus（worktree）；
实现后 codex 快速 delta（改动面小、grok 不加轮如实记账）。
- R1 修复引入新假绿（闭包值语义读错）→ G1 正控+回退负控双向；
- R2 夹具换签把断言改松 → 换签 diff 逐行入账、负控证新钉判别力；
- R3 波及正式面 → 明确不改清单+production-boundary/邻接复跑；
- R4 真机仍不通 → 边车 v1 如实取证、不硬闯、按新证据再议（诚实四态）。

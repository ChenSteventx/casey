# GRILL — teachin-raw-actionability-closure（v3：根因已证，瘦身直修）

> v1/v2 以「真因未知」为前提设计诊断基建；金牌起草期探针实证真因为**确定性
> 代码 bug**（探针三形态输出在案），v2 的环境判别矩阵失义。Steven 2026-07-30
> 两轮确认（AskUserQuestion + 详版对比后拍板 A）瘦身直修，本版 v3 换根。
> 诊断基建（22 行归因矩阵/diagnosticProfile/TOCTOU 全钩/边车 v2）降级后继契约。

## 根因（已实证，非假设）

**D0 事实链**：`lib/page-topology/controller.mjs` 的 `performClick` 丢弃回调
返回值（`await perform(opener.page)` 不接、异常吞成 performFailed、成功返回
体无 `value` 键）；`lib/teachin/raw-playwright-driver.mjs:119` 却以
`performed?.ok === true && performed.value === true` 判成败 → **click/dblclick
在 raw 回放恒判失败且物理点击已落地**；`fill/press` 走 `evaluateActive`
（有 `value`）故好。正式面 `lib/page-topology/replay-action.mjs:128-145`
早有闭包捕获先例（`actionResult = await perform(...)`），raw 面未沿用。
07-30 真机边车（`raw-runner.event` seq1 `candidateCount:1, performOk:false`）
与机器复现全部由此一因解释；与视口/无头/登录 readiness/遮挡无关。

**D0b 为何金牌没逮到**：两枚冻结金牌的拓扑替身返回了真控制器从不返回的
`value` 键（夹具不保真，违「夹具须复现冻结接缝」铁律）——
`teachin-replayability-action-authority.zero-sut.golden.mjs:213-216`、
`teachin-clear-fill-admission.zero-sut.golden.mjs:433-436`；且全仓无一枚金牌
把真控制器与 canonical raw 驱动接起来跑（正控假绿的结构性缺口）。

## 决策树（v3）

**D1 修法**：raw 驱动 `performRawCandidate` 改闭包捕获（照 replay-action
先例：invoke 闭包收 actionResult，拓扑结果只判 `ok`，动作成败由闭包值判；
闭包值缺失/非真按失败 fail-closed）；控制器与正式面一字不动；驱动对消费者
的返回形状/键集不变。

**D2 夹具保真化（换签面）**：两枚金牌的拓扑替身改为忠实复现冻结接缝——
`performClick` 吞异常、不带 `value`、成功返回体键集与真控制器全等；受影响
断言随真语义修。换签账两笔：`prd-teachin-replayability-closure`
（action-authority 金牌）+ `prd-teachin-clear-fill-admission`（clear-fill
金牌），原件 gzip 存档 + Steven 签（ADR-0004）。

**D3 结构性缺口补钉（新金牌）**：真控制器 × canonical raw 驱动真接合正控
（此前全仓缺失）：resolve unique → perform click → 驱动判成功且物理动作
恰一次；负控=驱动改回 `value` 判据（seam 回退）当场红；替身保真钉=金牌内
拓扑替身与真控制器返回形制逐键对账（替身多 value 键即红，防夹具再漂）。

**D4 边车印证**：修后闭环边车（cycle-evidence v1 形状不动、零扩字段）应零
`raw-runner.event` 拒付事件——真机 A4 复录边车即印证件。

**D5 红线**：禁 `force`；禁改判定语义（修的是结果读取，不是判定规则）；
禁顺手扩诊断面（后继契约）；`verdict.mjs`/正式面/控制器零接触。

## 金牌矩阵（红先行）

- G1 seam 修复钉：真控制器接真驱动，click/dblclick 成功路 + 物理动作恰一次
  + seam 回退负控红；
- G2 保真对账钉：金牌内替身与真控制器返回形制逐键相等（吞异常/无 value/
  键集全等），替身加 value 键即红；
- G3 fill/press 回归：evaluateActive 路行为不变；
- G4 邻接零回归（prd s2 精确清单）：action-authority（换签新件）/
  clear-fill（换签新件）/ raw-runner / cycle-entry / equivalence-completion /
  equivalence-production-boundary / boundaries / cycle-plan.static /
  cycle-evidence / nav-expansion / orchestrator / runtime-cycle-adapter。

## 验收

- A1 新金牌红→绿；A2 换签两金牌新件绿；A3 s2 零回归+漂移扫+term-lint；
- A4（route:human）：真机 wf_list 两击自动闭环 record 退出码 0（修后应直通；
  不通则边车如实取证再议，不硬闯）；
- A5（route:human）：换签两账 + 新金牌冻结 Steven 签。

## 挂账（route:human）

- 诊断基建整体降级后继契约，v2 文档与 plan-codex-r1..r4 四轮评审卷 + 金牌
  起草停手报告（11 项文档-代码冲突清单）封存作其输入；
- codex 四轮计划审未穿透根因（引用过判据行未核控制器侧）——异构评审盲区
  记 learn；起草代理停手报告是本轮真 MVP。

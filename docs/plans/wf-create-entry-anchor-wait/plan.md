# plan · wf-create-entry-anchor-wait（light）

## 背景与根因

sleep 导入修复（`8d0b0bc`）合入后 B4 重跑，`workflow.create` 七步全 emit、身份门如实
fail-closed（exit 65 零产物、readback 证实零残留）——但 `atstep_1`（入口「新增工作流」
按钮点击）`absent count=0`。只读探针定量（2026-08-06 晨，经隧道）：列表页 `load` 事件
11.4s，按钮从 goto 起 14.9s 才可定位——即 **load 后还有约 3.5s 渲染尾巴**；而编译 nav 后
的锚定窗只有约 4s（`quietPoint` 预算 2.5s + `resolveTarget` 附着等待 1.5s），压线必抖
（2026-08-04 傍晚同链路赢了、08-06 晨输了）。B 段三例各要跑一轮 B4 编译，全部要过这条
竞态。

连带实证（同轮 compile-report 与探针）：页面**点击前**预挂离屏创建抽屉 DOM，令后续
fill/click 步 `count=1` 但动作不可达（`action_failed`）——身份门行为正确，此处只入档
不改动；抽屉确认钮现役文本「确认」`count=1`（route:human ⑤ 证据已被 compile note 实采）。

## 修法（最小，compile 侧独有）

`lib/compile-atoms-workflow-crud.mjs` 的 `compileWorkflowCreate`：在入口点击 emit 之前，
对入口按钮（`role=button name=新增工作流 exact`，与 emit 同一语义锚）做**有界显式等待**：
轮询 `count()`（250ms 步长，预算 15s），可定位即停止等待、照旧发 emit；预算耗尽**不改判**
——同样照旧发 emit，由既有身份门如实记 `absent`（失败路径零行为差、fail-closed 语义不动）。

不碰 emit/resolveTarget 全局时序（爆炸半径最小）；不碰回放侧（events 不携带等待，回放
另有 settle 机制）；不碰冻结件。等待用的 `sleep` 正是上一契约补齐的导入。

## 验收

新金牌 `tests/_golden/wf-create-entry-anchor-wait.zero-sut.golden.mjs` 三钉：

- S1 迟挂载行为钉：塑形替身（入口按钮挂载标志 1.2s 后翻真；翻真前 `count()=0`、翻真后
  `=1`；替身记录 count 采样次数与「入口点击 emit 时挂载标志」）跑 `compileWorkflowCreate`：
  不抛；入口点击 emit 发出时挂载标志**必须已翻真**；按钮 count 被采样 ≥2 次（真轮询过）；
  事件序列与既有空页序一致。红基线：现行代码不等待、emit 时挂载标志为假且零采样。
- S2 预算耗尽零行为差钉（回归钉，现行代码同绿）：按钮永不挂载的替身下，事件序列与
  现行 absent 路径完全一致（6 事件、无菜单步），且总耗时 < 20s（预算有界、不挂死）。
- S3 结构钉：`compileWorkflowCreate` 源码在入口点击 emit 之前含有界就绪锚
  （`入口就绪锚` 注释 + 15s 预算 + `count()` 轮询）。

替身纪律同前例：emit 按生产签名收参；迟挂载是真实前置形态（SPA 渲染尾巴）的忠实复现，
等待与否、何时点击是被测代码自己的决定。红基线对最终金牌字节实抓（S1/S3 红、S2 绿），
证据 `accept/red-proofs/entry-anchor.red.txt`；突变闭环：还原修复必红、复原 sha256 同必绿。

邻接复跑：`wf-crud-sleep-import`（同文件上一契约金牌）+ `agent-delete-confirm-import` +
`term-lint --registry` + `selftest --tier1`。

## 非目标

- 不动预挂离屏抽屉引发的 `action_failed` 面（身份门行为正确；若入口锚修复后仍现，另查）；
- 不改 emit/quietPoint/resolveTarget 全局预算；不碰回放侧与任何冻结件；
- 「工作流编码」字段是否必填仍待 B4 真机现场核（route:human 在案，与本契约无关）。

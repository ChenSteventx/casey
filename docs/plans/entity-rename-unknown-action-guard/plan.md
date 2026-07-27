# plan · entity-rename-unknown-action-guard

## 目标

关闭 C4 评审确认的生产旁路：未知字符串原子携 `action:'nav'` 时，不得绕过
`dispatchReplayAction` 执行 `page.goto` 并产生 `unique` 动作轴。未知原子的闭集检查必须在
生产事件环的 `nav` / 非 `nav` 分叉之前统一生效。

## 实现边界

- 复用 `lib/replay-actions.mjs` 已有 `unknownAtomRejection`；
- `bin/replay.mjs` 显式导入并在每个事件进入页面动作前调用；
- 命中时把既有 `action_failed/UNKNOWN_ATOM` 轴写入 `actionByStep`，不进入
  `nav` 或业务动作执行分支；
- 合法原子保持原事件环路径；
- 不新增 rename 编译器，不修改裁定内核，不触碰形式收据链、原 C4 冻结件或人签内容。

## 验收点

1. 新增零 `SUT` 验收金牌，读取真实 `bin/replay.mjs`，证明生产事件环调用
   `unknownAtomRejection(ev)` 的位置早于 `nav` 分叉、`pre.path` 恢复导航和任一
   `page.goto`，且命中后写拒绝轴并跳过两个动作分支。
2. 动态证明 `workflow.rename + nav` 与 `workflow.rename + click` 均得到
   `action_failed/UNKNOWN_ATOM`，合法 `nav.agentManagement` 不被误拒。
3. 把未知 `nav` 拒绝轴送入真实 `bin/verdict.mjs`，即便硬断言满足也只能
   `NEEDS_HUMAN`，绝不 `PASS`；`unique` 对照仍可 `PASS`，证明测试不是空断言。
4. 原 C4 三枚零 `SUT` 验证与 C3 静态/纯函数影响面保持绿；0/26 前瞻基线保持
   0/26 红且拒绝原因不漂，不得为本修单改写。

## 不可命令化验收

- 原 C4 冻结措辞与两枚候选晋升仍需 Steven 按 ADR-0004 人签；
- 真机 rename 负向回放、录屏、视觉复核和独立 HTML 仍走真实 `SUT` 完成闸；
- rename → successor 的正向能力仍须形式收据链恢复与人签，本修单不冒充完成。

## 完成口径

零 `SUT` 质量门禁绿色仅代表 `unknown + nav` 生产旁路已在代码路径上关闭；C4 原契约仍保持
4/6，直到人签冻结面与干净异构复审完成。

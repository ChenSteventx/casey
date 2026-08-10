# plan —— 回放确认步等菜单离场（replay-confirm-menu-dismiss）

车道 full。基线 `aeb500c`。grill 已 done（决策树见 GRILL.md，D3 由 Steven 裁取丙）。

## 一、本契约要改的两件事

1. **生产面**：卡片布局删除链里，菜单删除项点击成功后、返回前，等操作菜单离场（有界）。
   超时不阻断，但在动作轴上留痕（D3 取丙）。
2. **金牌面**：修掉一个已识别的**假绿**——`wf-delete-card-layout` 的 R12 自称测了
   「菜单点后不关闭」，实际测不出真机的拦截（见下节），须先让它能真红。

## 二、R12 假绿的机理（本契约的关键前提，须先修夹具能力）

`tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs` R12 已用
`keepOpenAfterDelete: true` 造出「菜单点完删除项后不关闭」的场景，并断言
`confirmed.resolution === 'unique'`——即**金牌认定菜单不关时确认点得动**。

真机相反：2026-08-10 回放录像抽帧实证，菜单开着时点确认 1ms 即 `actionError`。

根因在夹具的点击原语（该文件 `click()`，约 175-180 行）：

```
if (!visibleNode(this.node)) throw new Error('click 目标不可见');
```

它**只检查元素自身可见，不做遮挡判定**。真机 Playwright 的 click 带 actionability 检查，
其中包含 hit-target（元素是否被其他元素覆盖）。于是同一个「菜单不关」状态，夹具判可点、
真机判不可点。

这与 `assert-visibility-semantics` 契约 D5 记过的是同一类问题：**假环境夹具复现不了真机
接缝，就会把该红的钉成绿**。按那条先例的处置口径，本轮须新增夹具能力去复现真机已观测事实
——**这是复现，不是把夹具倒着裁到预定裁定**（护栏纪律：不许 rig fixture）。

## 三、改动清单

### A. 夹具能力（`tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs`）

新增「浮层遮挡」语义：菜单处于打开态时，对**菜单之外**元素的 click 抛错，模拟真机
hit-target 拦截。落点在夹具 `click()`，新增判定不改既有分支：元素自身不可见照旧抛
「click 目标不可见」；新增「被打开的浮层遮挡」一支，拒因具名区分，便于金牌断言到底哪一种。

只在显式开启该能力的情景生效（新增选项），**既有情景行为一寸不动**——否则会把无关金牌
一起染红，分不清真红假红。

### B. 生产面（`lib/workflow-delete-domain.mjs`）

1. 新增两个常量，与既有三组等待常量并列同构：
   `MENU_DISMISS_TIMEOUT_MS = 3000`、`MENU_DISMISS_POLL_MS = 50`。
2. 新增 `waitForMenuDismissed(page, menu)`：轮询至菜单离场或超时。
   **离场判据**（D1 定案）= 节点已卸载（`isConnected === false`）**或** 按本文件既有三合一
   判据不可见（`display !== 'none' && visibility !== 'hidden' && visibility !== 'collapse'
   && rect.width > 0 && rect.height > 0` 取反）。判据逐字复用既有实现，不另造口径。
   返回 `{ dismissed: boolean, waitedMs: number }`。
3. `performCardMenuDeleteTrigger` 在菜单删除项点击成功之后、`return picked` 之前调用它，
   把结果以**加法字段**并入返回轴：`menuDismiss: { dismissed, waitedMs }`。
   超时（`dismissed: false`）**不改 resolution、不阻断**，照原样返回 `picked`（D3 取丙）。

### C. 影响面控制

- 只走卡片布局分支（`performWorkflowDeleteTrigger` 判 `resolution === 'none'` 那一支）。
  表格布局直接点行内删除钮、不开菜单，零触碰。
- `menuDismiss` 是加法字段，不改任何现有字段语义；下游不读它即不受影响。
- 会红的是逐字钉轴形状的金牌——这些红是**预期的**，须逐个核过确认只是多了字段、
  而非语义变化，再改钉。

## 四、验收（红先行，accept 阶段冻结）

矩阵四条，全部走完整链路（`performWorkflowDeleteTrigger` → `inspectWorkflowDeleteConfirm`
→ `performWorkflowDeleteConfirm`），不许直接调 `waitForMenuDismissed` 交差：

| # | 情景 | 修前 | 修后 |
|---|---|---|---|
| 1 | 菜单点后立即关闭（现行主路径） | 绿 | 绿，且 `waitedMs` 极小、`dismissed: true` |
| 2 | 菜单延迟关闭（小于预算）+ 遮挡能力开 | **红**（确认被拦，锁真实红签名） | 绿，`dismissed: true` |
| 3 | 菜单始终不关（超过预算）+ 遮挡能力开 | 红 | **仍红**（D3 取丙不阻断），但轴带 `dismissed: false` 留痕 |
| 4 | 等待期间菜单被卸载 | 绿 | 绿，`dismissed: true` |

情景 2 是本契约的核心红签名：它复现真机 2026-08-10 的失败，修前必红、修后转绿。
情景 3 钉住「超时不静默」——resolution 不变而留痕在场，正是 D3 丙案的可观测性主张。

另需复跑护栏 #19 要求的全部受影响 browser-replay 金牌（`menuDismiss` 加字段会触碰逐字
钉轴形状的钉），逐条核过再改。

## 五、不做什么

- 不动确认步 `performWorkflowDeleteConfirm` 的内部逻辑（它拿不到菜单句柄，在那里等要重扫
  浮层、引入新的不确定性）。
- 不动表格布局分支。
- 不改 `resolution` 语义、不改任何既有字段。
- 不为超时加固定睡眠——等待必须是可判定条件 + 有界预算（静默点同构）。

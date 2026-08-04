# plan · agent-delete-confirm-import（light）

## 背景与根因

`lib/compile-atoms-agent.mjs:194` 在 `agent.delete` 编译配方的「确定」点击步调用
`inspectWorkflowDeleteConfirm(run.page)`，但该文件第 2–10 行的 import 清单对
`./workflow-delete-domain.mjs` 零导入（函数在 `lib/workflow-delete-domain.mjs:484` 导出）。
`agent.delete` 编译只要走到确认步，该行必抛 `ReferenceError: inspectWorkflowDeleteConfirm is not defined`。

同类溯源：`6f91125` 把单体 `lib/compile-atoms.mjs` 拆成 `compile-atoms-agent.mjs` 等分片时，
拆前的 `lib/compile-atoms.mjs:10` 本有 `inspectWorkflowDeleteConfirm` 导入，代码块搬走了、
导入没跟着搬。与已合入 dev 的 `01e965f`（同一文件漏 `requestLogPath`）是同一缺陷类：
拆文件漏导入，且 hermetic 金牌夹具没造出命中该分支的形态，所以分层绿恒绿、真机必炸。
孪生调用点 `lib/compile-atoms-workflow-crud.mjs:328`（`workflow.deleteByName`）导入齐全、不受影响。

## 修法（最小）

`lib/compile-atoms-agent.mjs` import 清单新增一行
`import { inspectWorkflowDeleteConfirm } from './workflow-delete-domain.mjs';`
（该文件原本对 `workflow-delete-domain.mjs` 零导入，故是新增行而非并入既有行）。
零行为语义变更——本就该这么工作；`inspectWorkflowDeleteConfirm` 是只读 inspect，
不点击、不改 SUT，凭据面与落盘面均不变。

## 验收

新金牌 `tests/_golden/agent-delete-confirm-import.zero-sut.golden.mjs` 四钉：

- S1 行为钉：`agent.delete` 编译走到「确定」步不抛，且 `inspectWorkflowDeleteConfirm`
  的返回被 `fail-closed` 分支正确消费——非 `unique` 即压硬阻断、绝不用未经因果核实的
  「确定」文案落点击（确认事件绝不发出，前 4 个事件如实发出且列表路由覆写生效）。
- S2 回归钉：不命中该分支的形态（`agent.openToolPicker` 走同一 `compileAgentToolRecipe`）零阻断、事件如实发出。
- S3 结构钉：import 清单含 `inspectWorkflowDeleteConfirm` 且来自 `./workflow-delete-domain.mjs`。
- S4 消费形状钉（静态）：`unique` 分支把 `inspected.confirmName` 回写进配方 `text`。

金牌替身纪律：`page` 是零命中的空页替身（无 DOM，一切定位一律零命中，自洽不倒裁），
`emit` 替身按生产签名 `(spec, customAct)` 收参并在有 `customAct` 时真调它——
`agent.delete` 的「删除」点击因此真穿 `performAgentToolAction` → `performWorkflowDeleteTrigger`
这条已冻接缝，确认步看到的「未武装」正是这条真链路的真实结果，非夹具倒裁。
红基线实跑 2/4（S1/S3 红），证据 `accept/red-proofs/delete-confirm-import.red.txt`。

邻接复跑：`compile-execution-failure-seal`（compile-atoms-agent 的既有直接消费金牌）+
`chief-stream-replylog-import`（同文件上一处漏导入的封缝金牌）+ `term-lint --registry` + `selftest --tier1`。

## 非目标

- 不动 `agent.delete` 配方序列、删除域锁（`lib/workflow-delete-domain.mjs`）与其因果绑定金牌；
- 不碰任何 `testChecksums` 冻结件、不改裁定树、不改凭据面；
- `inspectWorkflowDeleteConfirm` 返 `unique` 的行为面（真弹层实采确认文案）无 DOM 的 hermetic 覆不到，
  只由 S4 静态钉守形状，真证走真机 —— `route:human`，须 Steven 另行明示授权（每跑一次真删一个实体）。

# plan · wf-crud-sleep-import（light）

## 背景与根因

B 段首例 B4（`tc_catalog_wf_crud` 重编译）`COMPILE_EXIT=1`，报告
`COMPILE_ATOM_EXECUTION_FAILED stepOrdinal=1 atom=workflow.create eventsEmitted=2`。
真机忠实复现（真 `createCompileRun` + 真登录 + 全域非读请求拦截，零变更抵达被测方）
拿到与 B4 完全相同的签名后，绕过密封边界直调原子抓到原始异常：

`lib/compile-atoms-workflow-crud.mjs:136` 的 `await sleep(250)` 抛
`ReferenceError: sleep is not defined`——该文件第 6 行对 `./compile-atoms-support.mjs`
的 import 清单漏了 `sleep`（正源 `compile-atoms-support.mjs:7` 有 export）。

同类溯源：`6f91125` 拆单体 `compile-atoms.mjs` 时代码块搬走、导入没跟着搬，与已合入
dev 的 `01e965f`（漏 `requestLogPath`）、`agent-delete-confirm-import`（漏
`inspectWorkflowDeleteConfirm`）同缺陷类，这是**第三例**。同类普查再逮一处潜伏：
`lib/compile-atoms-workflow-drawer.mjs:53`（`compileWorkflowOpenNode` 点后轮询路径）调
`sleep(100)`，该文件第 3 行 import 同样漏 `sleep`——真机走到 openNode 必抛，尚未被触发。

hermetic 分层绿恒绿的原因同前两例：既有金牌夹具没造出命中 `sleep` 行的形态。
真机排除项（只读探针已证）：「新增工作流」入口仍是下拉分支、旧 CSS 锚
`.hr-dropdown__menu:visible .hr-dropdown__item-text:text-is("新增工作流")` 命中 1；
两个原候选（入口形态变化 / seam-1 搜索不过滤偏移前序）均不成立。

## 修法（最小）

两行既有 import 各补一个 `sleep` 标识符（均已从 `./compile-atoms-support.mjs` 导入他物，
并入既有行而非新增行）：

- `lib/compile-atoms-workflow-crud.mjs:6`
- `lib/compile-atoms-workflow-drawer.mjs:3`

零行为语义变更——本就该这么工作；`sleep` 是纯定时器，凭据面与落盘面均不变。

## 验收

新金牌 `tests/_golden/wf-crud-sleep-import.zero-sut.golden.mjs` 四钉：

- S1 crud 行为钉：空页替身跑 `compileWorkflowCreate`（emit 按生产签名 `(spec, customAct)`；
  `identityLedger: null` 且 profile 无 `workflows.listApi` → 按 :226 既定条件跳读回，零行为差）：
  不抛，恰发 6 事件（nav / click 新增工作流 / fill 工作流名称 / click 分类壳 / click 分类项 /
  click 确定 `compilePhase: terminal`），notes 恰两条既有 route:human 记账（描述无锚定④、
  确认按钮实采失败⑤），空页上绝不发出菜单项点击。红基线在 `sleep(250)` 抛。
- S2 drawer 行为钉：塑形替身（画布域内该标题恰 1、节点 box 可证、抽屉域恒空——复现
  「节点在画布上、点后抽屉不开」这一真实可能形态）跑 `compileWorkflowOpenNode`：不抛、
  点后轮询真踩 `sleep(100)`（以 `nodeDrawerDomain` 调用次数 ≥3 证轮询真转过），
  超时后压「点后域内…count=0（非恰一）证不出归因」硬阻断 fail-closed 收尾。红基线首拍即抛。
- S3 结构钉：两文件来自 `'./compile-atoms-support.mjs'` 的 import 行均含 `sleep`。
- S4 缺陷类普查钉（静态）：扫 `lib/*.mjs`，凡裸调 `sleep(` 的文件必有 `sleep` 的
  import 或本地定义——把「拆文件漏导入 sleep」这一类整类封死，不点名文件清单、
  新增文件自动纳入普查。

金牌替身纪律：空页替身零命中自洽不倒裁；S2 塑形替身只复现真实前置形态（canvas 节点
存在、抽屉不开），点后轮询与超时阻断是被测代码自己的决定，金牌只观察不预设。
红基线对最终金牌字节临时回退两行修复后实抓、随即还原（还原后 `git diff` 恒为 2 处
单标识符插入），证据 `accept/red-proofs/sleep-import.red.txt`。

邻接复跑：`chief-stream-replylog-import` + `agent-delete-confirm-import`（同缺陷类前两例
封缝金牌）+ `compile-execution-failure-seal`（失败密封边界既有消费金牌）+
`term-lint --registry` + `selftest --tier1`。

## 非目标

- 不动 `workflow.create` / `workflow.openNode` 配方序列与任何编译知识；
- 不碰任何 `testChecksums` 冻结件、不改裁定树、不改凭据面；
- 真机 B4 续跑（乙）不在本契约内：修合入 dev 后按既定授权另行一例一跑；
  真机现场另核新字段「工作流编码」是否必填（若必填属编译知识缺口，另立契约）；
- `replay-settle.mjs` 自带 sleep 定义、`compile-atoms-run.mjs`/`compile-atoms-agent.mjs`
  导入齐全，S4 普查覆盖即可、不改动。

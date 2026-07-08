# wf-open-node — plan（light）

画布维度第三原子 `workflow.openNode`：单击节点中心开配置抽屉。决策全录
`docs/plans/wf-open-node/proposed/GRILL.md`（D1 单击定案 / D4 按原子分发门 / D5 抽屉双证回读 /
D8 例翻涟漪）。零冻结 schema 改动（click 已在枚举）；抽屉族原子（setNodeField/selectNodeDropdown）
的共同前置。

## 1. 契约本体（纯加法）

### 1a. lib/compile-atoms.mjs — compileWorkflowOpenNode

- 分派表 + `'workflow.openNode'` 条目（COMPILE_KNOWN_ATOMS 15→16 由键派生）。
- 预检域锁（emit 的 customAct 通路不走定位核验，此处自证——镜像 addNode 源身份门）：
  `.lf-canvas-overlay` 内 getByText(label, exact) count；恰 1 才点，0/多/证不出 → blocker
  点名 count fail-closed 硬阻断（executeMode 据此截断、不产成功产物）。
- 节点箱：复用 `workflowNodeBox(page, label)`（缺席守卫先例；唯一性闸已在预检，此处 .first()
  即唯一者——不造第三份孪生体，learn #3 教训）；null → blocker。
- `emit({ atom:'workflow.openNode', action:'click', semantic:{kind:'text',name:label,exact:true},
  text:label }, customAct)`；customAct = mouse.click(节点箱中心)（registry SOP「点中心」）→
  限时 5s 等抽屉 `.hr-drawer__content-wrapper` 可见且 hasText(label)（双证）——等不到抛 →
  emit 捕获落 action_failed。
- 后置核验进 blockers（镜像 addNode/connectNodes）：抽屉双证证不出 → blocker 硬阻断；
  过 → notes 落「节点配置抽屉已开（〈label〉）」证据。

### 1b. lib/replay-actions.mjs — doOpenNode 专用回放门

- performAction 分发（resolveCandidate 前，镜像 dragTo 分发位）：
  `ev.action==='click' && ev.atom==='workflow.openNode'` → doOpenNode。
- label 从 ev.semantic（kind text）取；证不出 → action_failed。
- 域锁 `.lf-canvas-overlay` getByText(label, exact)：缺席守卫（waitFor try/catch 不抛穿，
  codex R2-F1 先例）；count 0 → none；count>1 → `ambiguous` 绝不点（统一身份门同律——
  新门自带域内唯一闸，不复用 nodeBoxByLabel 的 .first() 写法直点）。
- count===1 → nodeBoxByLabel 取箱（此时 .first() 即唯一者）；null → none。
- mouse.click(箱中心) → 限时等抽屉可见 + 含精确 label 元素（`filter({ has: getByText(label, exact) })`，
  非子串 hasText——评审 F1：子串会把标题「label副本」等误判开对了抽屉）→ 到 = unique +
  identityReadback ok:true；等不到 = action_failed + ok:false（防「点了没开 / 开错抽屉」假 unique）。

### 1c. tests/fixtures/fake-sut/server.mjs — 节点抽屉纯加法

- renderCanvas 内 overlay 委托 click：target.closest('.lf-node-anchor-hover') 忽略（锚点
  不开抽屉）；target.closest('.lf-node') 命中 → 开/更新右侧 `.hr-drawer__content-wrapper`
  （内容含该节点标题文本）——registry 真机 SOP 最小复现，不倒裁。
- 连线拖拽零干扰（DOM 规范：down/up 目标不同 → click 落共同祖先 overlay、closest 不中节点）；
  既有 addNode/connectNodes 通路与金牌零行为差。
- 抽屉与列表页建单抽屉同类名但异页（画布在详情页）——回放回读域内无撞车。

## 2. 金牌 tests/_golden/wf-open-node.golden.mjs（红先行，镜像 wf-connect-nodes 形制）

- C1 openNode 可编译 + COMPILE_KNOWN_ATOMS 恰 16 + agent.openToolPicker 仍不可编译。
- C2 端到端 happy：compile [nav.workflowManagement, workflow.open, workflow.addNode(模型节点),
  workflow.openNode(模型节点)] → events 末步 = {atom:workflow.openNode, action:click,
  semantic text label} → 过 events.schema（手写校验器复用）→ blockers 空 + compile-report
  含抽屉证据 → draft(+patch)→sign→casey run→verdict 恰 4 intent 全 PASS。
  计数通道单选（learn #5 既定约束）：profile.countSelector='.hr-drawer__content-wrapper'，
  openNode intent 断 countChange up（0→1 抽屉出现）；addNode 用 textVisible、nav 用
  urlPathname、open 用 onPage——四 intent 都有硬断言防 INDETERMINATE、无人抢计数通道。
- C3 fail-closed 族：
  - a 编译面·节点缺席（未 addNode 即 openNode）→ 预检 blocker 点名 count、exit 65、
    零 events、无谎报 acted；
  - b 编译面·域内多匹配（addNode 同 nodeName 两次落两同名 .lf-node）→ 预检 count=2 →
    blocker exit 65 绝不点；
  - c 回放面·节点缺席（手编 events）→ doOpenNode 缺席守卫优雅 none 不崩、verdict 不 PASS；
  - d 回放面·域内多匹配（手编 events：同名两节点 + openNode）→ ambiguous 绝不点、
    verdict 不 PASS。
  「点了抽屉不开」的回放反面 hermetic 造不出（夹具点节点必开、不倒裁）——真机 route:human。
- 红先行：实现前全红（openNode 无编译知识 → C1/C2/C3a-b compile 面即红；C3c-d 回放门缺席红）。

## 3. 例翻 + 重签（GRILL D8）

- 四金牌「集 15」→ 16（注释同步）：flow-bridge.golden:184 / wf-add-node.golden:6,109,113 /
  wf-connect-nodes.golden:9,90,94 / wf-open-smoke.golden:52,55。
- prd 重签：prd-flow-bridge / prd-wf-add-node / prd-wf-connect-nodes / prd-wf-open-smoke
  （golden checksum 棘轮）+ prd-p5-replay（fake-sut server.mjs 夹具 checksum）。
- 新冻 prd-wf-open-node（wf-open-node.golden.mjs）。
- 涟漪回归全绿：e2e-chain / p3-compile / run-history / seams-freeze(-v2) / p5-replay / tier1。
- gate 六 prd 全 GREEN（五重签 + 一新冻）。

## 4. 验收

- 金牌 wf-open-node C1–C3d 全绿，且实现前有红先行证据（全红实录）。
- 四例翻金牌 + p5-replay + e2e-chain + p3-compile + tier1 涟漪回归全绿（零行为差）。
- gate 六 prd 全 GREEN：prd-wf-open-node 新冻 + 五重签（flow-bridge / wf-add-node /
  wf-connect-nodes / wf-open-smoke / p5-replay）。
- codex 异构评审 PASS（Claude 实现 → codex 评，正向归属）。

## 5. 非目标 / 挂账

- setNodeField / selectNodeDropdown：贪心序下一契约（+selectNodeDropdown 解锁 9/23）。
- 真机采样 route:human 挂 prd observability：节点配置抽屉容器类名 + 标题是否含节点名
  （D5 回读假设复核）+ 单击开抽屉行为复核（D1 定案复核）；与 wf-add-node/connectNodes
  observability 合并行程。
- registry desc「点空重点一次」重试启发式不进确定性原子（差异记 learn）。
- 不动 events.schema/verdict/gate 冻结内核；不建 cases/ 真用例；不碰 heal。

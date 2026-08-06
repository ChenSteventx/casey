# plan · semantic-name-instantiate（light）

## 背景与根因（B4 九跑诊断实证）

`workflow.open` 的 emit 传 `semantic: { kind: 'text', name: params.openName }`，而 `params.openName`
是**模板** `atl_{{uniqueName}}`（落盘必须保留模板，回放才能按各自 ctx 回填）。两侧定位构造
（compile `locatorFor`、replay `semanticLocator`）都直接拿这个字面串去 `getByText` ——找不到
含 `{{…}}` 字面的元素，恒 0 命中。

前奏诊断（上一契约）同刻取证坐实：容器内探针用**真名** 5ms 命中、锚定 4ms 命中、页面
`text346/卡5/框16` 完全正常，emit 却 `absent count=0`——页面、隧道、渲染时序全部无辜。
即 `workflow.open` 在带模板的目标名下**从未走通过**（07-02 采知识时用的是固定既有名）。

## 修法（两侧对称、纯投影）

新增纯函数 `instantiateEventSemantic(ev, ctx)`（`lib/instantiate.mjs`）：仅当
`semantic.name` 真含 `{{` 且回填后有变化时返回浅拷贝定位视图，否则返回**同一对象引用**
（落盘字节与上游对象永不被改）。两侧定位入口各调一次：

- compile：`createCompileRun.resolveTarget` 内、`locatorFor(this.page, ev)` 之前；
- replay：`performActionOnPage` 通用路径、`resolveCandidate(page, ev)` 之前
  （专用身份门分支全在其之前，完全不受影响；下游 `gateAndAct` 不消费 `semantic.name`）。

**刻意不改任何既有签名与调用点字面**：首版曾给 `locatorFor`/`semanticLocator`/`resolveCandidate`
加 `ctx` 参数，被全仓扫描逮到两个冻结金牌以字面匹配判接线顺序而误红
（`page-topology-auth-continuity-boundaries` B6 用 `indexOf('resolveCandidate(page, ev)')`、
`regress-agent-tool-actions` B2 同款）——实现让路，投影式零字面变更。

## 验收

金牌四钉：S1 投影钉（回填正确 + 原对象/落盘不被改 + 其余字段逐位保留）；S2 恒等钉
（无占位/缺 ctx/空 ctx/无 semantic/null/undefined 六态均返回同一引用或原样不抛）；
S3 replay 行为钉（`performAction` 通用路径实际用实例化名定位、零命中仍 fail-closed）；
S4 结构对称钉（两侧投影位序 + **三处既有字面必须保持**的自钉，防未来重蹈首版覆辙）。

红基线实抓；突变闭环（`git show` 姿势还原/复原）；**全仓 205 金牌扫描**（不抽样，因为
碰的是定位核心）：与 `97c0d83` 基线逐个双态对比，非零项**全部基线同码**，零回归。

## 非目标

- 不改任何原子的编译知识（`workflow.open` 的 emit 形状不动——模板落盘是既定设计）；
- 不动 `locatorFor`/`semanticLocator`/`resolveCandidate` 签名与调用点字面；
- 不改 `gateAndAct` 及下游产物投影（`semantic.name` 不进 axes/observed 比对面）。

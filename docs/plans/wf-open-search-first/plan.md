# plan · wf-open-search-first（light）

## 背景与根因

B4 六跑（重表达 flow + 就绪锚齐备）`workflow.open` 仍 `atstep_9 absent count=0`。只读探针
否证页签过滤假设（残留卡在含默认「全部」的全部页签均渲染）后，机制收敛为：**create 后
SPA 停在列表路由，`nav.workflowManagement` 同址跳转不触发列表重查询**——页面挂着建单前
的旧卡集，新建卡片不进 DOM，就绪锚轮满 15s 也等不来。反证：搜索图标点击强制发起按名
新查询（seam-1 已核 `Enter` 不过滤、图标才过滤；残留清偿链三次实战均经搜索后成功定位）。

## 修法（最小，与 deleteByName 搜索知识同源）

`lib/compile-atoms-workflow-nav.mjs` `compileWorkflowOpen`：在既有就绪锚之前加**搜索先行**
前奏——搜索框有界就绪（15s 轮询）后：`fill` 搜索框（值 `params.openName` 模板原样入
events、编译期由 emit 按 ctx 实例化）→ `click` 放大镜（`fieldLabel` + fallbackCss
`.hr-input__suffix .search-icon`，与卡片布局删除路径实战同姿势）。搜索框耗尽缺席则
**跳过搜索步不阻断**，交后续既有就绪锚与 emit 身份门 fail-closed（零新增判定）。

事件面：open 步从 1 事件（click 名字）变 3 事件（fill 搜索 + click 图标 + click 名字）；
均为既有通用动作 schema（fill/click + fallbackCss 先例：create 的分类壳点击），回放侧
按事件通用回放、零 schema 变更。

## 验收

新金牌 `tests/_golden/wf-open-search-first.zero-sut.golden.mjs` 三钉：

- S1 搜索先行形状钉：搜索框在场 + 目标文本在场的塑形替身跑 `compileWorkflowOpen`：
  恰发 3 事件且序为 fill(搜索框语义锚, 值=openName 模板) → click(放大镜 fallbackCss) →
  click(目标名 text-exact 语义)；不抛、零阻断。红基线：现行代码只发 1 事件。
- S2 搜索框缺席跳过钉（回归钉，现行同绿）：搜索框与目标均永不挂载：零 fill 事件、
  仍发 1 个 absent 路径的名字点击 emit、总耗时有界（<40s，含搜索框 15s + 目标锚 15s
  两段预算）、零阻断（身份门语义不动）。
- S3 结构钉：`搜索先行` 注释 + `.hr-input__suffix .search-icon` + 搜索框轮询在
  `就绪锚` 之前。

红基线对最终金牌字节实抓（S1/S3 红、S2 绿），证据
`accept/red-proofs/open-search-first.red.txt`；突变闭环同前例。

邻接复跑：`post-nav-anchor-wait`（同函数上一契约金牌，其 S1/S3 对 open 的断言为
find 式、加前奏零破坏——实跑证明）+ `wf-crud-sleep-import` + `wf-create-entry-anchor-wait` +
`term-lint --registry` + `selftest --tier1`。

## 非目标

- 不改 `nav.workflowManagement`（同址跳转是否强刷属 SUT 行为，不在编译知识里补偿两次）；
- 不动就绪锚/归属判定/身份读回；不碰回放侧与冻结件；
- 失败路径预算累加（本契约搜索框 +15s）沿用两轮 pi Medium 的同面挂账：B4 七跑记录总耗时。

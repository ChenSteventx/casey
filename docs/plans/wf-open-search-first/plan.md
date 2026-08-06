# plan · wf-open-search-first（light）

## 背景与根因

B4 六跑（重表达 flow + 就绪锚齐备）`workflow.open` 仍 `atstep_9 absent count=0`。只读探针
否证页签过滤假设（残留卡在含默认「全部」的全部页签均渲染）后，机制收敛为：**create 后
SPA 停在列表路由，`nav.workflowManagement` 同址跳转不触发列表重查询**——页面挂着建单前
的旧卡集，新建卡片不进 DOM，就绪锚轮满 15s 也等不来。反证：搜索图标点击强制发起按名
新查询（seam-1 已核 `Enter` 不过滤、图标才过滤；残留清偿链三次实战均经搜索后成功定位）。

## 修法（最小，与 deleteByName 搜索知识同源）

`lib/compile-atoms-workflow-nav.mjs` `compileWorkflowOpen`：在既有就绪锚之前加**搜索先行**
前奏，采**三候选轮询**——同一 15s 截止内轮询「容器内目标文本 / 裸目标文本 / 搜索框」：
容器内命中（列表已新鲜，标准与归属判定同刻）→ 跳过搜索直入锚定（零开销）；裸文本命中
（瞬态回显如创建成功 toast 会假阳——B4 七跑实证）→ 不跳过搜索、只授后续锚定预算；
搜索框先就位 → `fill` 搜索框（值
`params.openName` 模板原样入 events、编译期由 emit 按 ctx 实例化）→ `click` 放大镜
（纯 fallbackCss `.hr-input__suffix .search-icon`，照 `chat.sendAndWait` 送出图标先例、
不带 fieldLabel 防同名 label 抢锚——评审 r1 grok Medium 采纳）。既有就绪锚改
**条件预算**：已见目标或图标点击真实动作（unique 且 acted，评审 r1 pi Medium 采纳）
才给新预算 15s，否则前奏已为
同一目标等满、锚定让行——**双缺席失败路径总额恒 ~15s 不叠加**（两轮评审 pi Medium
方向的机制化兑现）。搜索框耗尽缺席跳过不阻断，交既有 emit 身份门 fail-closed。

事件面：目标不在旧 DOM 时 open 步 1→3 事件（fill 搜索 + click 图标 + click 名字）、
已新鲜时保持 1 事件；均为既有通用动作 schema（fallbackCss 先例：create 分类壳点击），
回放侧按事件通用回放、零 schema 变更。

## 验收

新金牌 `tests/_golden/wf-open-search-first.zero-sut.golden.mjs` 四钉（状态化替身：目标
可见性 = 列表本就新鲜 或 搜索图标点击后新查询返回——忠实于查询驱动渲染）：

- S1 搜索先行形状钉：搜索框在场、目标不在旧 DOM：恰发 3 事件且序为 fill(搜索框语义锚,
  值=openName 模板) → click(放大镜 fallbackCss) → click(目标名 text-exact)；不抛、零阻断。
  红基线：现行代码只发 1 事件。
- S2 双缺席封顶钉（回归钉，现行同绿）：搜索框与目标均永不挂载：零 fill、仍发 1 个
  absent 路径名字点击 emit、失败路径总额 <20s（条件预算封顶、绝不叠加）、零阻断。
- S4 列表已新鲜直点钉（回归钉，现行同绿）：目标本就在 DOM：零搜索事件、恰发 1 个
  名字点击、零阻断。
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

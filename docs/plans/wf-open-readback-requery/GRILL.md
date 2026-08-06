# GRILL · wf-open-readback-requery（证据定案，免长审）

设计岔口在动手前已被真机证据与在库先例逐一锁死，无悬而未决分支：

1. **是不是隧道/页面问题？** 否。十跑诊断 notes：容器命中 4ms、锚定命中 3ms、页面态
   `text348/卡5/框16` 正常，click 步 unique+acted；阻断在其后的 source 读回双证门
   `envelope-empty`。隧道两端当跑前刚重启、探针 200。
2. **回填 `profile.workflows.searchBox` 能不能修？** 不能。该声明路径 emit 的是
   fill+Enter，而 seam-1 真机已证 **Enter 不过滤、放大镜才过滤**（`compileWorkflowOpen`
   前奏注释 + 清偿工具 `~/casey-tools/cleanup-workflow.mjs` 注释同源）；且全仓无一 profile
   声明过 `searchBox`，此路径从未在真机活过。
3. **在点击后的详情页语境里补重查行不行？** 不行。`compileWorkflowOpen` 现序是
   click → `waitForURL /process/detail` → 才武装读回；详情页上既无列表卡片 DOM
   （`.agent-card`）供物理双锚，也不会自发带回声（`queryEcho === expectedQuery`，
   `agent-identity-observation.mjs:78`）的列表查询——门在该语境**结构性不可满足**。
4. **正确形状是什么？** agent 侧同族门 `compileAgentSearchOpen` 的已证序（其注释即
   本门自称的镜像源）：**武装 → 搜索（武装窗内）→ settle → 双证 → 过门才点 →
   句柄内点击 → evidenceStepId=点击步**。把 workflow 侧的事务整体上移到点击前的
   列表页语境，即恢复镜像。
5. **为何十跑才暴露？** 一至九跑全部停在更早层（登录/预算/save 断层/定位模板），
   十跑是这扇门真机首次执行——「该配置从未走通过」与语义名模板缺陷同族。

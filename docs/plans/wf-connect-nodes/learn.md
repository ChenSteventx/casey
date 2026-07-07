# wf-connect-nodes — learn（2026-07-07，full，评审归属反转 Claude 侧对抗评审 PASS）

并发 session（codex 实现）建成 workflow.connectNodes + addNode expectedNodeDelta 精化，真机验过但六阶段未走。
本契约由 Claude 侧补收口：合法化 codex 全部改动 + 填端到端覆盖缺口 + 修两健壮性缝 + 重签四棘轮 prd + 异构评审。

## 留存学习

1. 评审归属反转（本 session 首例）：异构评审的铁律是「实现方≠评审方」，不是「永远用 codex」。当实现方
   本身是 codex（并发 session 写的），再送 codex 就是同族自评——反转由 Claude 侧评。[[review-uses-codex]]
   的「用 codex」是「Claude 实现→codex 评」的常态投影，遇实现方反转时以「绝不同族自评」为准绳。本例价值
   实锤：起草 Claude 子代理揪出 codex 的 F1/F2 两健壮性缝，同族评审（codex 评 codex）大概率漏——而且这俩
   正是 codex 自己在 wf-add-node R1 立过的同类 fail-closed 纪律，connectNodes 没继承（自己写的代码最容易
   对自己立的规矩视而不见）。
2. 并发 session 共享工作树的治理坑：codex 把实现 + 金牌都写对、真机也验了，但「test 级绿 ≠ gate 级绿」——
   四棘轮 prd 未重签（golden 改了 checksum 漂移），gate 一跑必红（护栏 #16）。共享树 + 单 baton 下,另一
   session 做 lib/bin 改动而不走契约 + 不重签,是可预见的治理缺口;收口方须:① checksum 漂移全扫（不只跑
   test）② 补契约台账 ③ 补覆盖缺口 ④ 异构评审。flow-bridge 那次「2 条失败」也是同因——中途快照撞并发写。
3. 逐字重复的两份代码 = 同缝两处（codex F1/F2 共同根因）：workflowNodeBox（compile）与 nodeBoxByLabel
   （replay）是「编译期作者/回放期消费者同构」惯例产的字节级重复，两处都把「缺席」写成 waitFor 抛而非
   返回 null——修一处必须同修另一处。这类同构重复是护栏 #17 三轴纪律的副产物,收口时 grep 找孪生体一起改。
4. 覆盖缺口的隐蔽性:connectNodes 有编译知识 + 回放分支 + 夹具 + registry,看着「全建」,但金牌只有 C1
   「可编译 + 集 15」注册检查——零端到端。回放分支 doConnectNodes 能静默回归而无金牌拦。「原子建成」的
   验收不是「注册了」而是「compile→replay→verdict 端到端有金牌锁 seam」。收口补的 C2/C3/C4 才是真锁。
5. 计数通道单选的端到端设计约束:rowCount 只认单一 profile.countSelector。一条 flow 里 addNode（数 .lf-node）
   + connectNodes（数 .lf-edge）两种计数——verdict 侧只能给一条断 countChange,另一种走 textVisible/onPage
   等不依赖计数的 kind。这是 profile 单通道的既定约束,画布多原子端到端用例都要照此排断言。

## 交到下一阶段的账

- window.lf 图对象口挂账（连对哪两个的确定性取证，纯 DOM 只断边数增）route:human,与 wf-add-node
  observability 合并真机行程一并采（真机 .lf-node-anchor-hover 类名/拖拽时序漂移复核）。
- R9 其余画布原子逐条另契约:openNode（双击开抽屉）/ setNodeField / selectNodeDropdown（贪心序 +此解锁 9/23）
  等;骑本 session 建的画布 + 连线夹具,多为纯加法。
- switchState kind 未实现:echo flow 核心断言仍 soft（画布维度后续契约同步补）。
- 并发 session 治理:若再有并行 lib/bin 改动,收口方照本契约模式（checksum 全扫 + 补台账 + 补覆盖 + 异构评审
  可能反转）。

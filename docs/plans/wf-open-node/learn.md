# wf-open-node — learn（2026-07-08，light，画布第三原子 workflow.openNode 收口）

单击画布节点中心开配置抽屉的原子。开发在 2026-07-07 晚做到 loop 全绿（gate GREEN），随后连遭三次意外关机，
review/learn/提交全部丢在关机前。本次从会话转录恢复现场、补跑评审、收口。

## 评审怎么跑的（异构 + 视角多样）

实现方是 Claude，按纪律 review 归 codex（正向、非同族）。实际用了三路，各抓到不同的缝：

- **codex（正式异构评审）**：FAIL，三条。F1 抽屉回读用子串（采信）、F2 编译门≠回放门（证伪）、F3 金牌缺
  「开错/不开抽屉」反面（采信）。
- **Claude 五视角对抗评审**：补出 codex 漏掉的一条 High——doOpenNode 吐 `resolution:'ambiguous'`，而裁判
  `verdict.mjs` 只认 `fallback_first`/`coord_fallback`，多匹配被降级成 INDETERMINATE 而非 AMBIGUOUS_ACTION。
- **DDD 视角（Opus 4.8 重跑，前一轮这条挂了）**：把上条深化成统一语言问题——`resolution` 枚举整个没登记
  CONTEXT.md；doOpenNode 是第一个说出 CONTEXT 已登记词 `ambiguous` 的门，反被裁判丢弃；`coord_fallback`
  是幽灵字面量（没有任何门吐它）。另外证伪了「openNode 引入未登记新概念」——身份回读双证/域锁是已登记
  「点击身份门」的实例化（像 connectNodes 的 `.lf-edge +1` 计数回读），不算新词。

## 逐发现处置

| 发现 | 判定 | 处置 |
|---|---|---|
| F1 抽屉回读子串 `hasText`（compile-atoms:556 / replay-actions:142） | 采信 | 改精确 `filter({ has: getByText(label, exact) })`，两侧同刻 |
| F2 编译门≠回放门（box helper 用 hasText） | 证伪 | `workflowNodeBox`/`nodeBoxByLabel` 都是 `getByText(exact).first()`、且都在 count===1 之后取，同一扇门 |
| F3 缺「开错/不开抽屉」反面 | 采信 | 加夹具场景 `drawersuperset`/`drawernone` + 金牌 C3e（开错抽屉，F1 红证）/ C3f（点了不开） |
| C3a blocker 正则太松（覆盖视角） | 采信 | 收紧到要 `画布域内 count=0` 自身签名，隔离预检分支 |
| plan.md 加粗英文 `**ambiguous 绝不点**`（DDD） | 采信 | 改代码体 |
| resolution 枚举未登记 + 裁判不认 `ambiguous` + 幽灵 `coord_fallback`（DDD/Claude） | 采信但另立契约 | 触裁判内核，light 不改内核——见「交到下一阶段」 |
| 「登记新概念」 | 证伪 | 双证/域锁是「点击身份门」的实例化，非新词 |

## 留存学习

1. **身份回读的强度 = 其匹配谓词的强度**。D5 说「双证：开了、且开的是这个节点」，但用子串 `hasText` 实现，
   「开的是这个节点」这一半就名存实亡——标题「模型节点副本」含「模型节点」子串会被判开对。这正是 addNode
   当年用 `exactTextRe` 堵过的同型缝。凡是「回读确认身份」，匹配一律精确、别用子串。
2. **别替评审的假设背书，回到源码核**。codex 的 F2 是「如果 helper 用 hasText…」——它没读到 helper、在猜。
   核了 `workflowNodeBox`/`nodeBoxByLabel` 都是精确同门，F2 不成立。逐发现都要落到具体行号才采信/证伪。
3. **夹具反面模式不能靠 URL query**：replay 的 nav 走 `pathOf`（bin/replay.mjs:382）把 query 剥掉，
   `?nodeDrawerMode=` 根本到不了夹具。第一版红证两条一起假绿（都成默认行为）就是这个坑。反面考场要用夹具
   自己的场景机制（`window.__CFG__.scenario`），它跨导航存活。
4. **视角多样比单评审值钱**：codex 抓 F1/F3，Claude 五视角补出 ambiguous 词表 High，DDD 视角再把它挖成统一
   语言问题并证伪了一条过度登记。同一份代码，三种镜头照出三种缝。[[review-uses-codex]] 的「用 codex」是常态，
   但异构 + 多视角冗余是抓漏网的实招。
5. **关机三连的恢复**：活干在磁盘（/mnt/d）跨重启存活，但 /tmp scratchpad 每次重启清光（评审包、codex 空
   工作目录都丢过）。恢复靠 `~/.claude/projects/*.jsonl` 转录 + `loop/audit.jsonl`（评审是否发生的权威账）。
   [[crash-recovery-from-transcripts]]

## 交到下一阶段的账

- **resolution 词表统一（另立 full 契约，触裁判内核）**：① CONTEXT.md 登记 `resolution` 枚举为唯一权威集；
  ② 裁判 `verdict.mjs` + 镜像 `report-model.mjs` 认已登记的 `ambiguous`（多匹配 → AMBIGUOUS_ACTION）；
  ③ 删幽灵 `coord_fallback`（无门吐）；④ 统一多匹配字面量（compile 的 `multi`/replay 的 `fallback_first`/
  openNode 的 `ambiguous` 三处口径）。fail-safe 现不破（多匹配仍落 NEEDS_HUMAN、只是子类退化），故可从容另做。
  收口时补金牌钉 C3d 的 verdict.reason===AMBIGUOUS_ACTION。
- 编译面「点了不开」后置核验 blocker（compile-atoms.mjs:562）孤立红证需真机（compile 走 SPA go() 不携反面
  参），现 covered-by-symmetry（回放 C3f）+ customAct waitFor fail-closed，挂 route:human。
- 真机抽屉类名/单击行为复核仍挂 observability（原 prd 挂账不变）。

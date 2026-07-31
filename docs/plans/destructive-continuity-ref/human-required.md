# 必须人到场的清单 + B-1／B-2 路线后果对比

给 Steven 拍板用。基线提交 `019d24f`。

## 先纠一个前提

此前（含本轮派活时）的判断是「清理实跑卡在等人到机器前收集 `route:human` 身份」。**这个判断是错的**，
本轮已实证（见 `blockade-recheck.md`）：

- 全仓零处往 `destructiveContinuityByStep` 写值，人到机器前也不会有人把 ref 填进去；
- 授权边所需的全部信息（破坏步 `stepId`/`intentId`/`atom`/位序、目标 `platformId`/`kind`）
  **编译期已经在手**（`lib/compile-atoms-flow.mjs:109-119`），不需要新的采集动作。

所以人要做的不是「去机器前采数据」，而是**签**、**核字段**、**跑最后那次真破坏**。
这三件事性质不同，下面分开列。

## 必须人到场的四件

### 1. 路线裁定（B-1 还是 B-2）—— 只有 Steven 能定

不是技术问题，是「要覆盖面还是要工期」的取舍。见下方对比。

### 2. 冻结格式换版 + 金牌重签 —— ADR-0004 人签门

要签的有三处：

- **v3 锁格式本身**：`identityObservations` 行补 `kind`、新增 `destructiveContinuity` 段。
  这是改已冻结的签署件接缝，属 ADR-0004 面。
- **实体锁撤销声明**：`revokedBy` 是人签身份，机器只能填 `PENDING_STEVEN`，真值必须本人落。
- **守卫可观察行为的新增语义**：今天「有破坏原子 → 恒 `exit 65`」，落地后要变成
  「有破坏原子且 ref 合法 → 放行」。这是新增语义而非翻旧断言
  （`entity-destructive-continuity-guard.failclosed-replay.golden.mjs` 的 D1 用 v2 锁，
  按设计**继续绿**），但守卫的可观察行为变了，仍须补签。

机器可以起草全部字节，**但不得代签**。

### 3. 真站 API 与剖面字段核对 —— 需要真机，机器代替不了

要核的字段，比原 runbook 多一个：

| 字段 | 出处 | 本轮状态 |
|---|---|---|
| `workflows.listApi.{pathname,method,recordsPath,totalPath,queryParam}` | `bin/compile.mjs:233-241` | 待真站核 |
| `workflows.listApi.fields.{id,code,name}` | 同上 | 待真站核 |
| `workflows.itemContainer` + `workflows.cardFields.{name,code}` | `bin/compile.mjs:245-247` | 待真站核 |
| `mutationUrlPattern` | `lib/replay/event-runner.mjs:199` | **本轮新发现，见下** |

`mutationUrlPattern` 是本轮新逮的（复核第 ⑦ 层）：它是出站拦截安装器的必需输入
（`requirePattern: true`），缺了破坏步整步判 `action_failed`，
**但 `bin/compile.mjs` 的剖面形状门从不校验它**。
即：ref 全部弄对之后，仍会因为这个从未被校验过的字段而白跑一趟真机。
核剖面时必须一并把它核出来。

另注：**「三例 profile 是否真的缺 `workflows` 段」本轮核不了**——本工作树没有 `cases/`（不入库）。
这条只能挂账，须在有 `cases/` 的树上或真机侧确认。

### 4. 最后那次真破坏 UAT —— 只能真机

codex 的裁定原话（`docs/plans/entity-destructive-continuity-guard/review/codex-verdict.md:17-25`）：
ref 消费半边（合法真删 proceed 时，铸的 ref 被出站 mutation 请求消费、核对 `platformId` 一致才放行）
**本质需要真机 `page.route` 出站拦截 + live 读回**，hermetic 证不出。

还有三件同类：真机 `page.route` 拦截与既有 `watchNetworkForensics` 的 CDP Network 域共存时序、
`agent.confirmToolPicker` 的真机 `agent platformId` 取值、每例过完成闸（ADR-0009）。

所以即使本设计全部落地，**正确说法是「浏览器前的授权链闭合了」，不是「破坏链已闭」**。

## B-1 / B-2 后果对比

### 路 B-1：接线破坏链身份采集（正解，重）

本轮复核让 B-1 的体量**比 runbook 估的更大**，多出三块：

| 增量 | 来源 | 性质 |
|---|---|---|
| 锁格式是**换版**不是扩容 | 复核 ② | `closedRecord` allow-list 严格相等，塞字段即整锁判非法；必须加 `schemaVersion: 3` 分支 |
| 观察行要补 `kind` | 复核 ⑥ | **安全相关**：`kind` 在冻结时被丢，跨 kind 硬闸（codex round-5 Critical 的收口）在重建路径上调不起来 |
| 撤销流程是**前置**不是第 5 步 | 设计三 | 换 v3 锁必撞 `bin/sign.mjs:175`，没有撤销流程 v3 锁签不出来 |

后果：

- **得到**：三例保留全部清理断言，自清理仍被验证；真机不留 `atl_` 残留；
  破坏链守卫从「结构上恒拒」变成「有据可放行」，后续所有破坏类用例都能用。
- **付出**：一个契约级投入（计划 + 异构评审 + 实现 + 复审）。runbook 估两到三个工作日，
  加上本轮新增三块，**按三到四个工作日估更实**。
- **风险**：踩 ADR-0004 重签（三处，见上）；碰 `lib`/`bin` 生产件，
  按顾问排程裁定，**守卫（跨工作树 baton）没正确落地前不得启动**。
- **不确定性**：出站消费半边仍需真机才闭，落地后不能宣称破坏链已闭。

### 路 B-2：把清理链移出用例（轻，但改用例语义）

- **得到**：半天能通（runbook 估机器段 1.5 小时 + 人签 15 分钟 + 三次真机回放 30 分钟）；
  不碰 `lib`/`bin`，不撞排程守卫；实体锁走 v1 离线造件路径，不需要撤销流程。
- **付出**：删 4 条断言（`tc_catalog_wf_crud` `intent_3` 的 `textVisible appears 删除成功`
  + `countChange equals 0`、`tc_wf_publish_states` `intent_3` 的 `countChange equals 0`、
  `tc_wf_history_version` `intent_7` 的 `countChange equals 0`），自清理不再被验证。
- **残留**：真机会留 `atl_` 前缀测试数据，**当前没有独立清理手段**，谁清、怎么清是开放问题。
- **风险**：改用例语义要重签 `expected.frozen.json`；
  且这笔账不会消失——将来要做破坏类用例时，B-1 的活一件不少地还在那儿。

### 一句话对比

B-2 是把问题推后并付利息（削覆盖面 + 留残留 + 账还在）；
B-1 是现在付清，但它现在被排程守卫挡着，且比原估贵三块。

**本文件不代裁。**

## 本轮已经就位的东西（不用重做）

- 五层阻断逐层实证 + 三条新发现：`blockade-recheck.md`
- 逐破坏步 ref 产物形状 + 九条不变量：`design-per-step-ref.md`
- 回放侧重建接线（写在哪、写什么、三条纪律）：`design-replay-rebuild.md`
- 实体锁撤销/归档流程：`design-lock-revocation.md`
- 红验收（红先行，今日 `exit 1`，R1 绿 / R2-R5 红）：
  `tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs`

裁了路线之后，B-1 可以直接照这四份文档开实现契约；B-2 则把这批文档整体挂账留给下一轮。

# 评审收据 · semantic-name-instantiate

## R1（双路）+ R2（pi 增量复核）

| 项 | 值 |
|---|---|
| 被审快照 | R1：`d3ba2c5`；R2 增量：`d3ba2c5→78d8081` |
| 基线 | dev `97c0d83` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high（tmux 真 TTY、真工作树只读 + /tmp 变异），`r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-flash` high，`r1-pi-deepseek-v4-flash-high.md`、`r2-pi-delta.md` |
| 结论 | grok `APPROVE` 零 C/H/M；pi `CHANGES_REQUIRED`（1 Medium）→ 并集修 `78d8081` → pi R2 `DELTA_VERDICT: APPROVE` |

## R1 发现与处置

**pi Medium（已修 `78d8081`）**：投影原只放在通用定位路径入口，而
`doOpenNode` / `doDragTo` / `doSetNodeField` placeholder 等专用身份门也消费 raw
`semantic.name` 且在投影之前分支——「定位前必须回填」不变式名不副实，S4 自钉的覆盖
声明强于实际。修法：投影上移到 `nav` 早退之后、全部动作分支之前（原下游那处删除，
避免重复投影），S4 补覆盖面自钉（五处专用门分支必须在投影之后）。

pi 同轮的正向核实（并入证据）：投影纯度六态、落盘不被改（compile 侧 `events.push`
推的是 emit 外层原始 ev、replay 侧局部重绑不触调用方）、`ev` 重绑下游零影响
（gate 只读 action/value/atom/targetName、漂移探针 targetName 源自 `hit.event.text`、
axes 零名字字段）、compile 侧对称性无缺口，并附带发现本修复**一并治愈**
`agent.searchOpen` 携模板 openName 时的同类恒 0 命中。

## 双方独立复现的关键证据（并集）

- 红证：双方各自用 `git show 97c0d83:` 姿势在 /tmp 还原三个 lib 文件跑金牌，
  **4/4 红且消息与提交的红证逐字相同**、exit 1；复原后 sha256 逐字节一致、复绿。
- PRD 三条 sha256 双方自算比对一致；两个曾被首版打红的冻结金牌
  （`page-topology-auth-continuity-boundaries` 7/7、`regress-agent-tool-actions` 5/5）现全绿。
- 安全面：回填真名只进 Playwright 查询与内存闭合事件，
  events/observed/verification/notes/axes/报告均不收该名（护栏 #7 合规）。

## 开口项（如实挂账）

1. 端到端真证是 B4 十跑（乙授权、一例一跑）——预期 `workflow.open` 首次真机走通。
2. 回放侧对称修复的真证在后续 P4 回放（届时 events 的 `semantic.name` 首次带模板消费）。
3. 全仓 205 金牌扫描的非零项全部基线同码，其 owner 与清偿另账，不由本契约冒充。

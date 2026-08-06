# 评审收据 · wf-open-readback-requery

## R1（双路）

| 项 | 值 |
|---|---|
| 被审快照 | `85642ad`（分支 `wf-open-readback-requery`，审前 `git diff HEAD` 空） |
| 基线 | dev `8d0e6e3` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high（tmux 真 TTY、真工作树只读、pipe-pane 留痕），`r1-grok-4.5-high.txt`，实际工作 14m31s |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（`-p` 非交互带工具、同树只读、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| 提示词 | `REVIEW-PROMPT-r1.md`（八条风险清单逐条要结论） |
| 结论 | **双路 `APPROVE`，零 Critical/High/Medium** |

## 双方独立复现的关键证据（并集）

- 快照与基线：双方各自核 `git diff HEAD` 空、基线为祖先、白名单 diff 与提交说明一致。
- 验收金牌：双方自跑 20/20 绿；红证双方独立复现——grok 用 `/tmp` 全量拷贝 + `git show
  8d0e6e3:` 覆盖姿势重跑，与提交红证**逐字相等**（11 红）；pi 同法复现 11 红。
- PRD 三条 sha256 双方自算比对全 OK。
- 邻接：wiring 18/18、cardinality-reverse 18/18、search-first 5/5、preface-notes 4/4、
  post-nav 5/5、sleep-import 4/4 双方自跑全绿；两个既存陈旧红（`arming.static` 0/7、
  `searchopen` 10/11，门面拆分族）双方核实**基线同码未更红**。
- 风险清单八条双方逐条给「过」：未声明路径零漂移（空白规范化后字节等价自证）、扫描
  fail-safe 全路径闭入非 unique、判定表投影逐字对齐未走捷径（S3a/S3b 反证）、句柄生命
  周期单次 dispose 无泄漏无双释、观察归档链与 sign 对账面形状不变、提前 return 不涉
  其余原子、金牌四钉实钉、邻接零回归。

## 过程如实记

- grok 思考中曾起草三条候选 finding（card dispose 疑虑 / S2 未单独钉 incomplete 投影 /
  重试语义疑虑），进一步取证后自行否定——非 ok 信封的 fail-closed 由冻结判定表金牌已
  覆盖、dispose 路径经逐路核证单次释放；最终裁定零 C/H/M。
- `bindagent-replay` 邻接金牌初跑 EEXIST：系金牌自产的未跟踪 `loop/prd-tc_bindagent_*.json`
  残件（此前扫描轮遗留），清残件后 7/7 绿——环境残件，非本变更；主树同族 `.tmp` 残件
  （`PUBLICATION_TMP_WITHOUT_JOURNAL` 红因）同源。
- grok 主响应完成后 pane 曾收到一条来路不明的杂散输入「评审」，grok 仅简短回应；主响应
  （14m31s 那轮）为本收据采信对象，scrollback 全文留档 `~/casey-tools/grok-r1-scrollback.txt`。
- pi 一处小误：称 `bindagent-replay` 需真机不可跑——实际零 SUT 可跑且绿（grok 与实现方
  均实跑）；不影响其结论方向。

## 开口项（如实挂账）

1. 端到端真证是 B4 十一跑（乙授权、一例一跑、新 `atl_` 长名令牌）——预期 open 步读回
   三方全等、链路首次推进 `assert.onPage(detail)` 与删除步。
2. 工作流身份账本接线（`bin/compile.mjs:310`）在 open 退役信封路线后无消费者，拆除与否
   留后续契约议（本契约非目标）。
3. Claude Code 终审：额度不可用，按评审纪律不探测不调用；本契约非裁判/签署/凭据门内核
   变更（编译原子层重构 + 冻结判定表零改动），双路异构 APPROVE 收口，终审不冒充。

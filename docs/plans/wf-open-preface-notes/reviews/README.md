# 评审收据 · wf-open-preface-notes

## R1（双路）+ R2（pi 增量复核）

| 项 | 值 |
|---|---|
| 被审快照 | R1：`c1c80ef`；R2 增量：`c1c80ef→7a39aaa` |
| 基线 | dev `49db0c4` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high（tmux 真 TTY、真工作树只读 + /tmp 变异），`r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-flash` high，`r1-pi-deepseek-v4-flash-high.md`、`r2-pi-delta.md` |
| 结论 | grok `APPROVE` 零 C/H/M；pi `CHANGES_REQUIRED`（2 Medium）→ 并集修 `7a39aaa` → pi R2 `DELTA_VERDICT: APPROVE` |

## R1 发现并集与处置

1. **pi Medium#1（已修）**：`page.evaluate` 无显式超时，病态挂起页（正是取证对象）会吃
   默认 30s——pi 建议的 `evaluate(fn, { timeout })` API 形在 Playwright 不存在（第二参是
   fn 入参），改照 `replay-settle` EVAL_RACE 仓内先例 `Promise.race` 3s 竞速让行、降级
   「采样异常」；R2 核实替代达意。grok 中途同面疑虑（终局自证收回）一并覆盖。
2. **pi Medium#2（已修）**：「采样异常」分支零金牌钉——补 S4（拒绝+挂起双面、竞速有界
   <8s、行为零差），红基线更新为 4 红。
3. grok 残余观察（不构成 C/H/M）：诊断卡片计数选择器只覆盖 `.agent-card`（表格布局下
   诊断计数读 0——取证降级非缺陷，知悉）。

## 双方独立复现的关键证据（并集）

- 零行为差坐实（pi：规范化 diff 剥离诊断面后与基线逐字节一致）；notes 内容安全面
  （全布尔/计数/毫秒，护栏 #7 合规）；结构钉界标词零碰撞（同函数两前契约金牌实跑全绿）；
  红证逐字吻合、sha256 全符、notes→exit-65 报告管道实证（`bin/compile.mjs:376`）。

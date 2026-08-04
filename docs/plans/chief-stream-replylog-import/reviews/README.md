# 评审收据 · chief-stream-replylog-import

## R1（代码联审，两路并行，全仓暴露）

| 项 | 值 |
|---|---|
| 被审快照 | `01e965f`（不可变，评审期间作者零改动） |
| 基线 | `96f6107` |
| 作者家族 | Claude（Fable 5 主循环亲改） |
| 评审方 1 | `grok-4.5` high，tmux 真 TTY 多轮，`--cwd` 指真工作树（只读 + 自跑金牌/变异） |
| 评审方 2 | `pi.dev` `deepseek-v4-flash` thinking high，`-p` 带工具跑在真工作树 |
| 评审输入 | 同料同指令（背景 + 白名单 5 件 + 风险五点；不含作者推理） |
| 产物 | `r1-grok-4.5-high.txt`、`r1-pi-deepseek-v4-flash-high.md` |
| 结论 | 两路均终局 `APPROVE`，零 Critical/High/Medium |

> `codex` 无额度（Steven 2026-08-03 告知）；grok 与 pi 双路顶上，均非实现家族，异构门成立。
> pi 首次调用因模式串 `deepseek-v4-flash:high` 被解析到未配置入口而空跑，按实际输出重发
> 既定调用式（`--model deepseek-v4-flash --thinking high`）后成功；不构成供应方不可用。

## 两路独立复现的关键证据

- 双方各自在 /tmp 副本回退单行 import、对最终金牌字节重跑：S1 `ReferenceError` + S4 结构钉红、
  exit 1，与 `red-proofs/replylog-import.red.txt` 一致（pi 做到逐字节 diff 相同）。
- 双方各自核对 PRD 三条 sha256 与实物相等；邻接两金牌自跑 exit 0。
- pi 另实测打码链：`.../stream?x=1` → `/ai-api/tester/agent/stream`；带凭据路由样例 →
  `<redacted:cred-route>`，query 剥除先于 pathname 投影，落盘面无泄漏。

## 收敛的 info 级发现（两路同点，不阻塞）

S1 的 `replyText === 'reply-arrived'` 腿不具修复判别力：`last.replyText` 赋值行先于抛点执行，
不修也绿（被同 check 首条 assert 短路遮蔽）。真正判别修复的是 `replyStreamUrl` 腿与 S4。
该腿保留价值 = 因果纪律 changed 门与稳定窗的回归钉。处置：plan/PRD 字节已冻结，措辞不动，
如实记录于此与 learn.md（「S1 证明回填链路」应读作「replyStreamUrl 首落腿证明链路」）。

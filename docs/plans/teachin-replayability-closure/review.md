# teachin-replayability-closure 异构评审主记录

日期：2026-07-28。契约 lane=full。本记录是 review 阶段的权威账；各轮原卷在 `review/` 目录。

## 评审链时间线与终判

| 轮 | 评审方（家族） | 对象 | 终判 | 原卷 |
|---|---|---|---|---|
| R1 主审 | grok-4.5（xAI） | Claude 流水线实现层（30 金牌首绿态） | `CHANGES_REQUIRED`（C2 H3 M5） | review/grok-r1-20260728.md |
| R1 参考 | deepseek-v4-pro（pi.dev 驱动） | 同上 | `CHANGES_REQUIRED`（C2 H3 M5，五处与 grok 重合） | review/deepseek-r1-20260728.md |
| 修复轮一 | Claude（opus 流水线，13 条合并清单） | canonical 三接缝落真实现、compare 七键、实体枚举缺省全拒等 | 全落地，31 金牌绿 | 修单 R7-R8 与 journal |
| R2 复审 | grok-4.5 | 修复 hunks + 更新真仓 | `APPROVE`（13/13 FIXED，3 条不阻断残差） | review/grok-r2-20260728.md |
| codex 层实现 | codex gpt-5.6-sol（OpenAI，Claude Code 无额度期间） | 录制生命周期、同次 capture 身份链（R9）、teachin-plan、formal 接线、实体链传播 + 静态收口 | 自报全绿，经本会话独立复核为真 | docs/HANDOFF.md 对应节 |
| 四路评审 | Claude 四路只读代理 + 主会话汇裁 | codex 层七核对点 | 须修后过（C0 H0 M6 L5） | review/claude-codex-layer-20260728.md |
| 修复轮二（闭合轮） | Claude（opus 流水线 + 主会话 R10 修单） | M1-M6 + L2/L3 | 7 修 2 挂，全套重验绿 | 修单 R10 与 journal |
| 终审 | codex gpt-5.6-sol（max） | 闭合轮全部修复 hunks 与两条挂账处置 | `CHANGES_REQUIRED`（唯一阻断：M4 枚举竞态残缝） | review/codex-final-20260728.md |
| 终审 delta | codex gpt-5.6-sol（high） | M4 竞态修复单 hunk | `APPROVE` | review/codex-m4-delta-20260728.md |

家族正交性：Claude 实现层由 grok/deepseek 评；codex 实现层由 Claude 评；Claude 修复 hunks 由
codex 终审——每一层的评审家族均不同于实现家族，无自审计入。

## 收口证据（只信退出码）

- 34 枚本契约金牌（33 zero-SUT/static + review-hardening）全部 exit 0；
- 跨契约防回归：cli-mcp-face 12/12、regress-wf-node-script 10/10、tier1 自检全绿；
- 全仓 Test Ratchet：143 份 PRD、732 条冻结引用，零漂移；
- gate GREEN story 6/6（passes 全部由 gate 写入，终验戳见 prd stories evidence）；
- 修单账本 R1-R10 十笔连续，每笔 Steven 批准、红先行或外科 stash 重钉证据在 accept/red-proofs/。

## 遗留挂账（不阻断，交接文档承接）

1. comparator 的 promotionEligible 真值悬空旗标（两枚冻结金牌钉死、无消费者、编排出口恒
   promotionReady:false）；
2. plan 产物与 CLEAN 裸词 stdout 缺自述标记；
3. 签名门前白烧一枚 fresh capability（fail-closed 无洞，工程取舍记录）；
4. prepared-run 对 preflight 具体 reason 的折钝（可观测性，grok R2 残差）；
5. runtime-reset 的 baseline 台账进程级卫生；
6. teachin-observation 与 teachin-runtime-successor 家族 5 枚既有红（含两枚撤销守卫按设计红），
   与本契约无因果；
7. M3 以 reason 词表达归属回收略脆弱，建议后继契约冻结其唯一性。

## 边界重申

本记录只背书 hermetic 机制闭环与代码质量评审：零真机、零浏览器验收发生。真机 UAT、
Windows native direct、双定位真机三类、三份带录屏正式报告与 Steven 人签是完成闸，
全部 route:human 等测试环境稳定后执行；技术 CLEAN/REPRODUCED/EQUIVALENT 不是正式 PASS。

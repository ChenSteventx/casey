# learn — p4-drafter（full，2026-07-02）

六阶段全走完（grill D1/D2 人签 + G-seam 缺席推定 → plan → accept 红先行 → loop gate GREEN → codex 四轮 R4 PASS → learn）。沉淀六条：

1. **接缝对齐要查全伴生 enum**：被点名的漏收是 `assertionKind` 12 vs 15，落地时才发现同 schema 的 `assertionOp` 也漏收 7 个——已收 kind（`requiredFilled`/`streamReplyReceived`/`replyContains`）的法定 op 竟表达不了，潜在假拒埋了两个契约周期。对齐权威表时把同文件伴生 enum 一起对，别只修被点名那个。
2. **缺席推定的边界**：route:human 分岔在人缺席时，若答案被「既有人签决策 + 文档定理」蕴含（D1 映射表预设三 kind 在 schema、schema 自述对齐方向、减法违护栏 #17），可推定执行——但必须记「性质：缺席推定、可否决 + 回滚路径」进 GRILL 并列 prd observability 交人复核。推定 ≠ 代签：可回滚、有据、显式挂账三者缺一不可。
3. **准入闸是 LLM 产物的唯一防线，三类洞逐轮被打**：R1 纪律检查被 `op===equals` 门住（字面量经 `contains` 溜进冻结）；R2 闸自身不 total（畸形顶层入口抛 `TypeError`，fail-closed 的闸先崩）；R3 语义不变量缺席（D2 soft 两向——已实现标 `soft` 绕硬裁定、未实现漏 `soft` 假红）。教训成式：**闸要 total（全域返回不抛）、纪律要盖全通道（别被单 op 门住）、语义不变量在准入执行（别靠下游翻红兜底）**。
4. **覆盖独立性**：两个违规案死于同一条正则 = 第二条守卫其实无锁（削掉 `\d{9,}` golden 照绿）。每条守卫至少配一个独立命中案——这是 golden 的「假绿测试」自检。
5. **多轮评审的收敛形状**：3→2→2→0，最重的 High（soft 语义）第三轮才现——前两轮修掉形状/字面量层后语义层才露出来。异构评审别把「本轮发现变少」当收敛信号，判 PASS 才停。
6. **唯一事实源的实现纪律**：kind/op 校验 spawn `check.mjs --validate-only` 而非建副本表（词表定理落到代码）；已实现集 `IMPLEMENTED_KINDS` 加性导出自 `replay-assert`（与其 `case` 分支同文件、注释互指同步义务）。两处都是「宁付子进程/导入成本、不付双表漂移债」。

配套：`stripTrailingId` 剥实体 ID 的观测分支与 fallback 分支同律（R3-F2——同一契约的两条路径要同一纪律）；未知 `assert.*` 原子落 `pending[]` 留痕不发明（fail-safe 的「不静默丢」方向）。

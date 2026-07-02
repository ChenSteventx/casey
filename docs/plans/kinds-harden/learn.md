# learn — kinds-harden（light，2026-07-02/03 之交）

六阶段全走完（grill G1 词表判人签 → plan → accept 红先行十红（新 5 + 涟漪 5）→ loop 四 gate GREEN → codex 一轮 PASS → learn）。沉淀四条：

1. **「未实现范例」是会过期的钉点**：三份冻结 golden 把 `textVisible`/`noErrorToast` 当「未实现 kind」范例钉进检查，提硬即全体翻红——这不是事故，是 D2 生命周期的**既定涟漪**。经验：范例型钉点尽量选「长期不实现」的 kind（本轮换 `buttonState`），或在 golden 注释标「随 IMPLEMENTED_KINDS 演进须翻」；涟漪清单进 GRILL（G2）先行盘点，红先行时新旧红一起核。
2. **事后卷回评估架构下，新 kind 的成本在采集不在判定**：`evaluateAssertions` 是纯函数吃事实，实现新 kind 的真正工作是「代表步静默点把该 kind 需要的事实采下来」（同 `intentUrl`/`intentCount` 范式）。判定分支五行，采集与上下文管道才是设计点——textVisible 走了 getByText + toast 双通道（toast 短暂、正文与弹窗都算命中）。
3. **采集器同构纪律**：toast 快照选择器逐字复刻 compile 观测采集并注释互指——「编译期作者与回放期消费者同构」是既有定理（semanticLocator 先例），凡两侧都要看同一类信号，采法必须同源，否则编译期采到的 toast 回放期看不见就是假红。
4. **词表判的诚实姿势**：`noErrorToast` 词表（`失败|错误|异常`）是语义启发式，`actual` 恒携实采 toast 全文——判错时人一眼能核出是词表漏了还是真有错。启发式判据 + 全量证据回填 = 可纠错的确定性；结构类名收紧留 route:human 挂账（撞真机错误弹窗顺手采）。

配套：`casey draft` 真用例重产草稿 7 条全硬（soft 0）——D2「补实现 → 重签提硬」生命周期首次真兑现；重签冻结 + 真机重跑待 Steven（route:human）。

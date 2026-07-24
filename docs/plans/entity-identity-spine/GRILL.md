# GRILL · entity-identity-spine（C0）

> 本契约的设计拷问已在三方规划中完成：fable 起草 → codex `gpt-5.6-sol` max 异构压测 → opus 4.8 xhigh 仲裁（含三路只读代码核验）。本文记录 C0 专属的已决分岔，母规格见 `docs/plans/entity-identity-lastmile/plan.md`。

## 决策树（已清空的分岔）

- **D1 泛化目标是哪套门?** 定：泛化的是 admission/读回签署链（`bin/sign.mjs` + `bin/compile.mjs` + `lib/entity-semantic-lock-preflight.mjs` 的 channel/observer 注入），**不碰** `lib/entity-semantic-lock-v2.mjs`（形式收据链 A，被 819015f 有意封死、sha `b7b5a47e` 冻结）。理由：agent 消费者路径实际调的是 `lib/agent-identity-gate.mjs`，v2 在 lib/bin 零 import。
- **D2 泛化的形状?** 定：闭集注册表 `action policy → required role → bound kind/provenance → 允许的 observation issuer/atom`，校验角色、数量、来源、关联 ID **恰好匹配**。**否决**「任何同 kind 的观察行都接受」——那会让伪造一条 `kind:'workflow'` 观察行混入（codex Q3 铁律）。
- **D3 agent 行为能不能变?** 定：**逐字不变**。C0 是纯地基重构，agent-id-readback 全套金牌复跑字节零漂移是 C0 的机器验收证据；任何 agent 面字节漂移即 C0 失败。
- **D4 孤儿策略项怎么办?** 已核实 `SIDE_EFFECT_POLICY` 有 `agent.removeToolByName`（mutation/[subject]）但无编译器。定：闭集注册表逻辑**不得假设每个 policy 键都有编译器**，遇无编译器原子不索要 observation（留给 C3 决定是否补编译器）。
- **D5 0/26 会不会被误动?** 定：C0 泛化可能改到 runtime-authority 检查之前的路径。收口须验 `prd-teachin-semantic-lock-runtime-discrimination-successor` 的 0/26 **红且拒绝原因不漂**（不是只验仍红）。

## 半硬确认

Steven 2026-07-23 全程参与设计拷问：确认需求覆盖矩阵、确认 hermetic 仅证逻辑/fail-safe 非完成（实机为准）、确认「一轮全落 5 契约 + 全 opus 4.8 xhigh」范围与算力，回「同意」。grill 阶段用户确认成立。

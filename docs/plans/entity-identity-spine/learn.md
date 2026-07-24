# entity-identity-spine · learn（阶段 5 沉淀）

> 状态：六阶段全 done；codex 异构评审 R7 终判 PASS（review/codex-r7-verify.md）。C1/C2/C3/C4 的 base 脊。

## 交付结果

按 kind 分的观测准入闭集注册表（`lib/entity-observation-registry.mjs`）：每类实体观测有自己的允许集，未登记 kind 的观测 fail-closed 拒、不兜底放行。R7 5b 门要求 anchoring binding 携 `bindingMode`；`checkIdentityObservationCardinality` 走双向 bijection + 原子对应 + 末次 click 锚定。

## 教训

1. **评审失明来自「把内核当 binary 看」**：codex R1 看不到注册表内部（只喂 diff），逆不出真接线。修法=暴露真 worktree read-only 让评审方自己导航 + 亲跑金牌（记忆 expose-repo-to-reviewers 由此单沉淀）。
2. **按 kind 闭集准入**：观测准入不是一张全局白名单，是每 kind 各一允许集；未登记 kind 的观测证不出归属→拒。closed-set 是 fail-safe 的形状，不是查一次表就放行。
3. **冻结件必须在硬化 base 上验 clean-red**：R7 5b 门加 `bindingMode` 要求后，pre-R7 冻的 accept fixture 缺该字段、FF 上来连回归行都红——这是 accept-freeze 漏验（冻在硬化前）。冻断言前先把断言基线跑到最终硬化态再冻（C2 同栽此坑，两契约互证）。

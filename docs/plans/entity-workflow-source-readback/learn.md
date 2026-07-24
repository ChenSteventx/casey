# entity-workflow-source-readback · learn（阶段 5 沉淀）

> 状态：六阶段全 done；codex 异构评审四轮 R4 终判 PASS（review/codex-verdict.md）。base=entity-identity-spine（C0 脊）。

## 交付结果

workflow 源读回准入：`workflow.create` / `workflow.open` 入注册表；`checkIdentityObservationCardinality` 走双向 bijection（观测↔原子互相唯一背书）+ 原子对应 + 末次 click 锚定，缺任一向 fail-closed。

## 教训

1. **单向检查 = 新 fail-open（首修可能更糟）**：round-2 首修只查「观测→原子」一向，漏了「原子无观测背书」的另一半——引入了比原缺陷更隐的 fail-open。基数闭合必须双向 bijection，round-3 才补回。修一个洞时先证没开新洞。
2. **末次 click 锚定**：观测证据必须锚在 (intentId, atom) 组的**末次 click**（terminal），锚在非末次 click = 证据错位放行。分组键从 NUL 拼接改 `JSON.stringify` 防串键。
3. **冻结 accept golden 在硬化 base 上验 clean-red**：pre-R7 冻的 bindings 缺 `bindingMode`，FF 到 C0 R7 硬化脊后连 agent 回归行都红——accept-freeze 漏验（同 C0 教训）。fixture 修正=给 bindings 补 `bindingMode`（`created-in-run` / `existing`），并复核红先行仍在（workflow 行仍为 `ISSUER_NOT_ALLOWED` 红）。

# plan — teachin-cycle-axes-atom

## 目标

把 resolved mapping 的 canonical atom 传播进 raw axes intent event，使真实
`createRawAxesAdapter -> projectReplayAxes -> canonicalVerdictCliAdapter` 生产链保持
StepAxes 与 verdict identity 闭合。

## 生产改动

`lib/teachin/raw-axes-adapter.mjs` 的 `planIntentEvents`：

1. 要求每条 resolved mapping 的 atom 为非空字符串；
2. 将 mapping 覆盖的业务 event 复制为带 `atom` 的计划行；
3. 同一 mapping 触发的 structural event 继承该 atom；
4. businessTail 指向带 atom 的计划行。

不改 projector、裁判、frozen CLI 校验、authority 或拒付协议。

## 验收

- A9 真驱 adapter × canonical projector × canonical verdict CLI；修前单红、修后全绿。
- axes 与 verdict 的 `atom` 都严格等于 resolved mapping atom；verdict 为 PASS。
- mapping.atom 缺失/空值在 projector 前 fail-closed，并钉 projector/verdict 零调用。
- owner raw-axes gate、cycle-evidence gate、P9 gate、Tier-1×2、drift/term 全绿。
- Grok 或 pi.dev 以内联完整仓库上下文评审实现。
- 合并主树后重跑真实两击；exit 0 前不得宣称 P9/cycle 完成。

## 人签

本轮再次修改 owner 金牌 checksum，沿
`loop/prd-teachin-replayability-closure.json` amendment 续记，保持
`PENDING_STEVEN` 直至 Steven 明签。

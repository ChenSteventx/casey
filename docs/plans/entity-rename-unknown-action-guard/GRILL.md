# GRILL · entity-rename-unknown-action-guard

> C4 后继修单。输入事实来自
> `docs/plans/entity-rename-negative-guard/review/proposed/grok-code-review-20260724.md`：
> 未知字符串原子在业务动作分发路径会被 `UNKNOWN_ATOM` 拒绝，但
> `action === 'nav'` 的生产分支绕过 `dispatchReplayAction`，具备有效身份锁时可落
> `resolution:'unique'`。

## 已决分岔

1. **强制检查放哪里？** 放在生产事件环内、`nav` 与非 `nav` 分叉以及任何
   `page.goto` 之前。继续复用 `unknownAtomRejection` 与
   `isCompilableAtom` 单一事实源，不在前置检查层再造一份原子闭集。
2. **拒绝后怎样落三轴？** 沿用既有
   `{resolution:'action_failed', rejectReason:'UNKNOWN_ATOM'}`，直接写入
   `actionByStep`；后续断言可照常采样，但未知事件本身不得导航或委派业务动作。
3. **非字符串 `atom` 是否并入本修单？** 不并入。它已由生产
   `checkReplayEntityAdmission` 在浏览器启动前以
   `REPLAY_EVENT_SHAPE_INVALID` 拒绝；C4 候选已有独立证据。
4. **是否修改原 C4 冻结件？** 不修改。原 C4 的边界订正仍须 Steven 按
   ADR-0004 人签；本修单只新增后继契约和独立验收。
5. **是否实现 rename 与 successor？** 不实现。未知 rename 原子仍不具备编译能力，
   本轮只统一关闭回放旁路。

## 停止条件

- 未知字符串原子在 `nav` 和非 `nav` 两类动作上均在生产事件环的首个页面动作前得到
  `UNKNOWN_ATOM` 拒绝轴；
- 真实零 `LLM` 裁定对该轴永不产 `PASS`；
- 合法 `nav` 原子仍放行；
- 不修改 `entity-semantic-lock-v2.mjs`、既有 C4 冻结文件或 0/26 前瞻红基线。

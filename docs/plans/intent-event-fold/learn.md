# Learn — intent-event-fold（2026-07-15）

## 结果

- 正式回放不再只拿 intent 最后事件当动作事实；`eventActions` 先经纯函数 fail-safe 折叠，再喂既有零 LLM 裁判。
- 真实事故同构红证已锁：旧代码在 `[ambiguous, unique]` 下明确输出 intent `unique` 与机器 `PASS`；新实现输出 `NEEDS_HUMAN/AMBIGUOUS_ACTION`。
- 全 unique 正向仍 PASS；纯断言不覆盖真实动作证据；坏轴、普通 miss、drift miss 与矛盾成功位都有确定性边界。
- `bin/verdict.mjs`、`lib/report-model.mjs`、冻结 schemas 零改动。

## 异构评审学到的四点

1. 失败折叠不能只改 `resolution`：裁判还有更高优先级成功位 `kind:none` 与 `identityReadback.ok:true`，都必须从 intent 级失败投影消毒；原始证据留 `eventActions`。
2. `HARNESS_ERROR` 是终判，必须比普通 `NEEDS_HUMAN` 更难成立：只有所有 miss 都有正向 drift 解释时才允许，不能因“第一个 miss 恰好有 drift”覆盖后续未解释失败。
3. 纯断言在混合 intent 中是中性，不应占用代表动作；否则 verdict 虽不翻，报告会丢真实动作身份回读。
4. 单测只看折叠对象不够；凡涉及裁判识别优先级，必须穿透 `fold → verdict` 钉最终四态。

## 验证

- 新 golden 16/16。
- PRD gate：8 条 acceptance 全绿，`passes` 由 gate 翻 true。
- tier1 selftest 全绿。
- ratchet verify：73 PRD / 196 冻结文件 / 0 问题。
- `git diff --check` 通过。

## 未完成且不可冒充

本契约完成的是 P0 信任边界实现，不是三条业务真机清理链完成。发布、历史、CRUD 必须等 `workflow.deleteByName` 域锁与签署后置断言合并后串行重跑；每条独立 HTML 必须含自然语言用例、原子操作、同次录屏、附件和视觉复核。带外补救清理不能算该 run 成功。

# Learn — intent-event-fold（2026-07-15）

## 结果

- 正式回放不再只拿 intent 最后事件当动作事实；`eventActions` 先经纯函数 fail-safe 折叠，再喂既有零 LLM 裁判。
- 真实事故的脱敏事件投影 `[ambiguous, none, unique]` 已锁为 zero-SUT（零被测系统）回归：新实现输出 `NEEDS_HUMAN/AMBIGUOUS_ACTION`，不再依赖 fake-SUT 复现。
- 全 unique 正向仍 PASS；纯断言不覆盖真实动作证据；坏轴、普通 miss、drift miss 与矛盾成功位都有确定性边界。
- `bin/verdict.mjs`、`lib/report-model.mjs`、冻结 schemas 零改动。

## 异构评审学到的四点

1. 失败折叠不能只改 `resolution`：裁判还有更高优先级成功位 `kind:none` 与 `identityReadback.ok:true`，都必须从 intent 级失败投影消毒；原始证据留 `eventActions`。
2. `HARNESS_ERROR` 是终判，必须比普通 `NEEDS_HUMAN` 更难成立：只有所有 miss 都有正向 drift 解释时才允许，不能因“第一个 miss 恰好有 drift”覆盖后续未解释失败。
3. 纯断言在混合 intent 中是中性，不应占用代表动作；否则 verdict 虽不翻，报告会丢真实动作身份回读。
4. 单测只看折叠对象不够；凡涉及裁判识别优先级，必须穿透 `fold → verdict` 钉最终四态。

## 验证

- `node --check tests/_golden/intent-event-fold.zero-sut.golden.mjs`：exit 0。
- `node tests/_golden/intent-event-fold.zero-sut.golden.mjs`：17/17，exit 0；只使用内存动作投影、临时 `axes` 与确定性 `bin/verdict.mjs`。
- 仅对新 PRD 执行定向 gate：ratchet checksum、术语检查与唯一 zero-SUT acceptance 全绿，`passes` 由 gate 从 `false` 翻为 `true`。本轮没有运行全量 gate、tier1、浏览器、网络、fake-SUT 或真实 `SUT`，因此不声称这些维度已绿。
- 旧的未跟踪 `tests/_golden/intent-event-fold.golden.mjs` 导入 fake-SUT，不属于交付、未运行、未冻结、未提交。

## 未完成且不可冒充

本契约完成的是 P0 信任边界实现及其 zero-SUT 回归棘轮，不是三条业务真机清理链完成。发布、历史、CRUD 必须等 `workflow.deleteByName` 域锁与签署后置断言合并后串行重跑；每条独立 HTML 必须含自然语言用例、原子操作、同次录屏、附件和视觉复核。带外补救清理不能算该 run 成功。

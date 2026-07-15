# GRILL — intent-event-fold（full，2026-07-15）

授权：Steven 要求 P0 修复 intent 内事件失败折叠，消除机器假 `PASS`；真实样本 `real-sut-fidelity-20260715-c3/tc_wf_publish_states` 已出现同一 cleanup intent 的中间事件 `ambiguous`、`none`，末事件 `unique`，最终却被判 `PASS`。

## 根因

`bin/replay.mjs` 保留了逐事件 `eventActions`，但 intent 级 `action` 只取最后一个代表步。`bin/verdict.mjs` 的确定性裁判只消费 intent 级 `action`，因此前序失败能被末事件成功洗掉。`compile --verify` 会逐事件扫，但正式 `casey run` 不经过这道核验，形成真机假绿。

## 决策

### D1 折叠位置

在回放产出 StepAxes 前折叠，而不是让裁判直接理解 `eventActions`：新增纯函数模块 `lib/intent-action-fold.mjs`，`bin/replay.mjs` 用它生成 intent 级 `action`，同时原样保留完整 `eventActions`。这样裁判零 LLM、判定树和报告一致性镜像均不改，旧的手工 axes 仍按既有契约裁定。

### D2 fail-safe 优先级

按事件顺序分类，纯断言动作 `{kind:'none'}` 为中性，不会拖累同行 intent。其余动作采用确定性优先级：

1. 任一 `resolution:'ambiguous'`：整个 intent 折为该 ambiguous 动作；
2. 否则任一 `resolution:'action_failed'` 或畸形/缺失动作：整个 intent 折为失败动作；
3. 否则任一不带正向 drift 解释的 `resolution:'none'` 或其它证不出成功的动作：整个 intent 折为该动作；
4. 只有所有普通失败均缺席、且所有 `none` 都有正向 drift 解释时，才保留 drift 动作给既有裁判终判 `HARNESS_ERROR`；
5. 只有全部可执行事件均由 `resolution:'unique'` 或 `identityReadback.ok===true` 确证，才保留最后一个真实可执行代表动作；纯断言为中性，全为纯断言才保留 `{kind:'none'}`。

ambiguous 优先是为了保留最具体的 `NEEDS_HUMAN(AMBIGUOUS_ACTION)`；显式 `action_failed`、普通 `none`、未知失败均优先于 `none+driftProbe`，防同一 intent 中另有未解释失败时被误终判成 `HARNESS_ERROR`。相互矛盾的动作轴（例如 ambiguous 同时读回成功）按失败分支处理，并在 intent 级 `action` 消毒 `identityReadback.ok:true`；原始矛盾证据仍完整保留在 `eventActions`。

### D3 证据与兼容

- `eventActions` 字节语义不变，仍用于逐事件诊断、报告原子操作和 `compile --verify`。
- intent 级 `action` 允许投影失败事件的既有字段；不新增 axes/schema 键，不修改 verdict 枚举或 reason。
- 折叠函数必须纯函数、不改输入，空数组和坏形状返回 fail-safe 的 `action_failed`。
- 报告只展示机器 verdict，不由视觉或 LLM 重裁定。

### D4 真机闭环

本契约先用 hermetic 红测试锁信任边界。随后与 `workflow.deleteByName` 加固契约合流，串行重跑发布、历史、CRUD 三条真机清理链；每案必须有独立 HTML、自然语言用例、原子操作、同次录屏与附件。只有 cleanup 的每个 event 都成功、签署后置断言归零、确定性 verdict 与录像一致，才算通过。

## 不做

- 不改 `bin/verdict.mjs`、`lib/report-model.mjs` 判定树；
- 不把 LLM/视觉引入裁定；
- 不把 out-of-band 手工清理算作同次 run 成功；
- 不开展 loop 改革；
- 不在本契约顺手加固 `workflow.deleteByName` 的 DOM 域锁（独立 P0 契约并行）。

## 风险

- 多事件 intent 中旧假绿会翻为 `NEEDS_HUMAN`，这是有意的 fail-safe 收紧；需跑所有回放/报告消费者回归。
- `bin/replay.mjs` 与已完成但未合并的静默点工作树有合并冲突；实现保持单一小接线块，后续 git-native 合并并复跑联合门禁。

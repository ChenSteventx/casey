# mountdelay-fidelity（full）——回放静默点保真强化

> 基线 dev@64b46cb。决策：Steven 2026-07-18 确认「加载占位门为主 + 静止窗兜底」。上游诊断 grill.md + HANDOFF 2026-07-15。

## 目标

修回放代表步 buttonState 真机计时假阴（tc_wf_publish_states intent_1 flaky actual=0）：静默点现只等「网络静 + DOM 静 2 拍」、从不等「UI 延迟提交完成」，框架延迟挂载按钮 > 240ms 缓冲即早放。hermetic 交付=让金牌忠实复现真机假阴 + 静默点强化让金牌确定性绿。

## 详细设计（主会话亲定核心）

### A. fake-sut 补延迟提交子形态（server.mjs）

现 mountdelay（:232）应答后同一微任务立即 `mountEditor()`——DOM 变化与在途归零同刻，hermetic 必绿。补：新增场景（`mountdefer` 或 mountdelay 加 `commitDelayMs` 参数），应答后解耦挂载——`setTimeout(mountEditor, commitDelayMs)`（建议 600，> 现 2 拍 240ms 缓冲），且「页面加载中」占位在延迟挂载时才移除（占位存活期 = 在途已归零但按钮未挂载，忠实复现真机延迟提交）。纯加法，既有场景零行为差（遵 twin*/churn 先例），CONTRACT.md 同步记新场景。

### B. settleBeforeCapture 加占位门 + 静止窗兜底（lib/replay-settle.mjs）

新增判据 C（加载占位门，条件启用）+ 兜底更长静止窗：

- `opts.loadingSelectors`（数组，profile.loading.selectors 传入）+ `opts.loadingText`（可选文本占位如「页面加载中」）。
- `placeholderGone(page)`（async，套 EVAL_RACE_MS 竞速）：evaluate 查所有 selectors（`document.querySelector(s)`）与 loadingText（`body.innerText.includes`）是否全不存在；查抛错/超时 → 降级返回 true（占位门失效退 A∧B，与 inFlightZero 降级同构，铁不变量：绝不外抛）。
- 放行改造（原 L79）：基础判据（A 归零两拍 ∧ B DOM 两拍稳）满足后——
  - 占位门启用（有 selectors/text）：再 `await placeholderGone()`，占位已消失才放行；占位还在则继续循环等（预算内），复现「等到编辑器提交」。
  - 占位门未启用（无配置）：兜底更长静止窗——基础判据连续 `STILL_TICKS`（建议 4 拍 ≈ 480ms）稳才放行（否则计数重置），残余竞态但域通用零配置。
- 铁不变量全保：预算上界超预算按现状采（settled:false）、绝不外抛、条件预算 ≥ 编译期 2500ms、绝不读 expected（占位选择器是 profile 配置的通用 loading 指示器，非 expected 的按钮名，I4 保住）。

### C. 静默点调用处传参（bin/replay.mjs:551-556）

pass-through：把 `profile.loading`（selectors/text）传进 `settleBeforeCapture` 的 opts。回放主循环、动作、归因主体字节不动——仅既有静默点调用处加参数。

### D. profile.loading 配置渠道

与既有 `background` denylist / `buttons.extraSelector` 同渠道（profile 配置），fake-sut 测试 profile 配「页面加载中」占位选择器/文本，供占位门金牌背书。

## 不做（承重边界）

- 不触 bin/verdict.mjs（零 LLM 裁判）、lib/replay-assert.mjs（buttonState 评估）、回放主循环——字节不动。
- 不动 cases/tc_wf_publish_states/expected.frozen.json（人签断言，buttonState 判据不变）。
- 不读 expected 判「按钮该出现」（违 I4）；不用 MutationObserver（plumbing 重、仍残余竞态，已否决）。

## 验收点

1. 红先行：fake-sut `mountdefer` 子形态下，旧 settle（无占位门/2 拍）驱 bin/replay.mjs → 代表步 buttonState actual=0（复现 b1 真机假阴红基线）。
2. 强化后：占位门等占位消失 → actual≥1（绿），确定性关闭竞态。
3. 兜底：无 loadingSelectors 配置时更长静止窗 STILL_TICKS 拍稳才放行，既有 mountdelay/其它场景零回归。
4. 铁不变量金牌：超预算按现状采（settled:false）、inFlight/placeholder 抛错降级不外抛、条件预算 ≥ 2500ms、不读 expected。
5. 受影响 5 prd（server.mjs）+ replay-settle-mount（replay-settle.mjs + CONTRACT.md + 金牌）gate 重签后 GREEN；全仓 ratchet 零新增；tier1 GREEN。
6. codex 异构评审 PASS + Steven 人签（触保真核心冻结面）。

## 真机 route:human（hermetic 完成后另行，需真机+Steven+autotest）

真 Heren 用 autotest 账户多次验 intent_1 发布/保存稳定 actual≥1（单次绿≠修好，flaky 须重复跑 + run-history 时间线交叉核）+ 每用例过完成闸（ADR-0009）+ 占位门 selectors/commitDelay dwell 在真框架标定（fake-sut 是该类竞态的模型，真时序只真 SUT 能证；若真机无稳定占位标记须退兜底静止窗、Steven 权衡延迟 vs 保真）。

## 风险

- 占位门 selectors 配错/真机无稳定占位 → 退兜底静止窗（B），真机标定挂 route:human。
- 静止窗兜底残余竞态（挂载延迟超 STILL_TICKS）——域通用无占位配置时的已知局限，如实挂账。
- 5 prd 重签叠在初始工作树 M（drawer/p5-replay/replay-nth 等 gate 时间戳漂移，用户的）——worktree 隔离干净重签，合并点按并发 git 卫生只提显式路径。

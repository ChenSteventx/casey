# grill 记录——mountdelay-fidelity（2026-07-18）

## 决策树与清空过程

### 根因（侦察 + 真机 runs 坐实）

`lib/replay-settle.mjs:79` 静默点放行判据 = 连续两拍 `document.body.innerHTML.length` 相等 ∧ 两拍均在途 API 归零（`inFlightZero`）。缺陷：只等「网络静 + DOM 静 2 拍（约 240ms）」，**从不等「UI 延迟提交完成」**。真机 Heren：`editorData` 请求 `loadingFinished` 让在途立即归零，框架却把发布/保存按钮挂载排到之后一帧/微任务/setTimeout；归零后那 2 拍 DOM 仍是「页面加载中」占位（长度不变）→ 判据满足 → 放行，按钮尚未挂载 → 代表步采 `buttonHits=0` → `actual=0`。真机 runs 证（`runs/real-sut-fidelity-20260715-*`）：b1 intent_1 actual=0 被判 SUT_DEFECT（`buttonSeen>0` 反证背书、比 NEEDS_HUMAN 更糟的自信误判），b2/c3/final actual=1——即修复收窄窗口但没消除竞态、靠运气绿。此即 codex 曾提 MED「请求结束但 UI 延迟提交的 SPA 形态未覆盖」。

### fake-sut 缺子形态

`tests/fixtures/fake-sut/server.mjs:232` mountdelay 分支应答后**同一微任务立即挂载**（`.then(() => mountEditor())`），DOM 变化与在途归零同刻——hermetic 必绿，未忠实复现真机延迟提交子接缝。补：解耦挂载（新场景 `mountdefer` 或加 `commitDelayMs` 参数，`setTimeout(mountEditor, commitDelayMs)`，建议 500~800 > 现 240ms 缓冲），且占位在延迟挂载时才移除——复现 b1 假阴（旧 settle 早放采 0）。纯加法，既有场景零行为差（遵 twin*/churn 先例）。

### 静默点强化方案（Steven 2026-07-18 可点选项确认「加载占位门为主 + 静止窗兜底」）

追加放行门：在途归零 ∧ DOM 两拍稳 ∧ **已知 loading 占位全消失**。占位选择器走 profile 配置（`profile.loading.selectors`，与既有 `background` denylist / `buttons.extraSelector` 同渠道），键的是「任意 loading 指示器」非具体按钮名——域通用、I4（禁读 expected/倒着裁）保住。Heren 实有「页面加载中」占位（`tc_wf_publish_states` expected 的 `textHidden 页面加载中` 佐证真存在此标记）。占位移除 ⟺ 编辑器提交 → 确定性关闭竞态。无占位配置时退兜底：归零后更长静止窗（K 拍 / 固定 post-zero dwell > 框架典型 commit 延迟）。

### 否决的替代

- 变更静默 MutationObserver：需注入 plumbing 重、仍残余竞态（调度空档 > X 仍早放）。否决（选 A 确定性更强）。
- 读 expected 判「按钮该出现了」：违 I4 禁倒着裁。否决——只键通用 loading 指示器。

### 不触内核（承重边界）

`bin/verdict.mjs`（零 LLM 裁判）、`lib/replay-assert.mjs`（buttonState 评估）、回放主循环（`bin/replay.mjs` 动作/归因主体）字节全不动。仅在既有静默点调用处 `bin/replay.mjs:551-556` 加 pass-through 参数（传 `profile.loading` 进 `settleBeforeCapture`）+ `lib/replay-settle.mjs` 强化放行条件 + fake-sut 补子形态。`cases/tc_wf_publish_states/expected.frozen.json` 不动（人签断言，buttonState 判据不变）。

### hermetic / 真机边界

- hermetic 全自主（零真机零凭据）：fake-sut 补 `mountdefer` 子形态 + 红先行金牌复现假阴（旧 settle→actual=0 红，强化后→actual≥1 绿）+ `settleBeforeCapture` 强化 + 5 prd 重签 + tier1。这一步让金牌忠实复现真机假阴 = 保真契约核心交付。
- route:human（需真机 + Steven 在场 + autotest 账户 + 带外核 .auth）：真 Heren 多次验 intent_1 发布/保存稳定 actual≥1（单次绿≠修好，假阴 flaky 须重复跑 + run-history 时间线交叉核）+ 每用例过完成闸（ADR-0009 保真审计+真机升必过闸）+ dwell/占位门时长在真框架标定（fake-sut 是该类竞态的模型，真时序只真 SUT 能证）。

### 冻结治理

`server.mjs` 冻 5 prd（drawer-lock-hardening/p5-replay/replay-nth-visible-hardening/replay-settle-mount/resolution）、`replay-settle.mjs` 冻 1（replay-settle-mount）、`CONTRACT.md` 冻 2（replay-settle-mount/p5-replay）、金牌 `replay-settle-mount.golden.mjs` 冻 1——改动全部按纪律重签 + Steven 人签。

### 造词检查

`commitDelayMs`（fake-sut 参数）、`profile.loading`（配置键）是代码标识；「加载占位门」是静默点新判据的中文白话描述，须查 CONTEXT.md——若作正式术语登记则四列制补登记，否则正文白话使用。term-lint 会拦未登记加粗英文。

## 结论

full 车道成立（触 lib/replay-settle 保真核心 + 多冻结面重签 + 人签 + 真机边界）。核心设计（选项 A 加载占位门）由 Steven 确认。碰 lib 走 worktree（护栏 #18）。不触裁判内核/断言评估/回放主循环。上游诊断见 `docs/HANDOFF.md` 2026-07-15 节。

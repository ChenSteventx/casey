# zero-shot-observe-admit-step

> 目标：在现有 atom 确定性路径之后，为真正零 recipe 的只读步骤提供一个受限的陌生页单步闭环；
> 页面动作仍是降权 candidate，不改变正式 replay/verdict 权威链。

## 1. 现状与必须补的真缝

现役 `intent-plan` 已能把 exact recipe 锁到 known atom，并拒绝模型覆盖；S1 已能在主体前运行 setup
workflow。缺口在页面漂移后的陌生页：

- 没有主 frame 的 bounded affordance catalog；
- 没有 observation → DOM node 的进程内连续性 authority；
- 没有 page-wide exact、hidden-aware 的确定性 resolver；
- 没有一次性 action admission 与 typed progress；
- `TestCase.steps` 只有 intent/actionHint/inputValue/expected，没有可授权 primitive 的 target/effect；
- 现役 replay locator 会承担正式已签回放，不能直接拿来给未签 zero-shot proposal 扩权。

因此本契约新增 `zero-shot-step-contract`。它由 grill 后的已确认意图产生，冻结单步动作、语义目标、
只读 effect 和进展条件。LLM 只贡献目录内的 affordance 选择，不贡献权限或裁定。

## 2. 交付设计

### 2.1 typed step contract

新增 `lib/zero-shot/step-contract.mjs`：

```text
freezeZeroShotStepContract({
  testcase,
  intentPlan,
  intentId,
  action: "click",
  target: { kind: "role"|"label"|"text", role?, name, exact: true },
  effect: "read",
  expectedProgress: [{ kind: "urlPathname", op: "equals"|"startsWith", value }],
  userConfirmed: true
}) → opaque-backed zero-shot-step-contract
```

规则：

1. TestCase/caseId/intentId 必须一致；
2. `intentPlan` 必须是现役 `buildIntentPlan` 原对象，且 builder authority 证明使用默认 known recipes、
   零 model proposals、产物字节未被改写；clone/spread/手造 plan 不授权；
3. intent plan 已有 mapping 时 `KNOWN_ATOM_DOMINATES`；
4. 只有 `MODEL_PROPOSAL_MISSING` 表示真正零 recipe；其他 unresolved reason 路由 grill/human；
5. MVP 只接受 click + read；
6. target 只接受 exact role/label/text，不接受 selector/nth/坐标；
7. expectedProgress 至少一条，且只接受稳定 pathname 条件；
8. contract 对外仍 `signed:false/replayReady:false`，authority 只在当前进程用于 candidate action；
9. step contract、resolution/proposal、admission、action receipt 与 after observation 都按原对象 authority
   消费，且全链产物递归冻结；clone/spread/手造同形对象或保权原位改写不能执行或证明 progress。

### 2.2 browser port、observation 与 catalog

新增：

- `lib/zero-shot/playwright-page-driver.mjs`
- `lib/zero-shot/affordance-authority.mjs`
- `lib/zero-shot/affordance-catalog.mjs`
- `lib/zero-shot/page-observer.mjs`

依赖方向：

```text
page-observer
  → playwright-page-driver（生产 port，可由调用方注入）
  → affordance-catalog
      → affordance-authority
  → replay-settle / cred-gate（现役稳定与 URL 脱敏）
```

公开 observation 只含：

```text
schemaVersion / artifactKind / observationId / intentId / frameScope
urlPathname / title / settled / catalogDigest / affordances
unsupportedScopes / truncated / signed:false / replayReady:false
```

禁止 raw HTML、origin/host、query/hash、href/src、输入框 value、整页正文、凭据和业务 platformId。

driver port：

```text
settle() → {settled,waitedMs}
snapshotMainFrame({maxCandidates}) → {
  revision,
  url,
  title,
  unsupportedScopes,
  affordances: [{handle, role, accessibleName, label, text, visible, enabled, actionSpace}]
}
revalidate({handle, semanticSignature, revision}) → {
  connected, sameNode, pageCount, visible, enabled
}
perform({handle, action}) → action fact
```

adapter double 只证明纯内核控制流，不启动 server/browser，不模拟 SUT API。生产 Playwright driver 是实际
browser 接缝；真实页面 freshness/hidden/ElementHandle 语义另列 UAT observability。

每个新 observation 使同 driver 的旧 authority 失效；affordance ID 固定使用 `af_*`，不得进入
entity binding。候选排序和 digest 对相同事实稳定，超上限明确 `truncated:true` 并禁止 admission。

### 2.3 deterministic resolver 与 bounded proposal

新增：

- `lib/zero-shot/deterministic-resolver.mjs`
- `lib/zero-shot/action-proposal.mjs`

resolver 只消费 public JSON + step contract：

```text
known atom/mapping
→ block primitive
→ exact target 与 catalog 全页恰一
→ resolved
→ 0 命中：允许 bounded LLM proposal
→ >1 / hidden duplicate / unsupported scope：route:human
```

LLM proposal 闭集：

```json
{
  "schemaVersion": 1,
  "artifactKind": "zero-shot-action-proposal",
  "observationId": "obs_*",
  "intentId": "intent_1",
  "targetAffordanceId": "af_*",
  "action": "click"
}
```

未知字段、数组多动作、selector/js/python/playwright/code、impact/effect、finish/progress、expected、
candidateId/platformId/verdict 均拒绝。页面提示注入文本只能作为惰性候选数据，不能改变 schema 或 policy。
proposal 只能由 builder-issued PageObservation 在确定性零命中时铸造；一旦 exact resolver 已唯一命中，
`DETERMINISTIC_RESOLUTION_DOMINATES`，模型不能另选同一 catalog 中另一个合法 `af_*`。

### 2.4 admission、执行、progress 与 trace

新增：

- `lib/zero-shot/action-admission.mjs`
- `lib/zero-shot/step-executor.mjs`
- `lib/zero-shot/progress-verifier.mjs`
- `lib/zero-shot/exploration-trace.mjs`
- `lib/zero-shot/single-step-runner.mjs`

固定顺序：

```text
validate step contract
→ current observation/catalog authority
→ deterministic resolution 或合规 proposal
→ revalidate：同一 handle + connected + page-wide count===1 + visible + enabled
→ issue one-time admission
→ execute exactly once
→ settle
→ fresh after observation
→ typed progress
→ candidate trace
```

任一前置拒绝 action adapter 零调用；action 抛错只尝试一次，不自动换第二候选或重试。执行前再次重验，
关闭 observation 与点击之间的 DOM replacement 窗口。progress 只接受冻结 pathname 条件；DOM 长度、
截图 hash、动画、计时和 action success 不能推进 intent。

trace 每步保留 observation/catalog/admission/action/progress 的降权引用，恒
`signed:false/replayReady:false`，不导入 verdict。

## 3. touchesFiles

生产新增：

- `lib/intent-plan.mjs`（只加 plan authority，不改公开 plan 字节）
- `lib/zero-shot/step-contract.mjs`
- `lib/zero-shot/playwright-page-driver.mjs`
- `lib/zero-shot/affordance-authority.mjs`
- `lib/zero-shot/affordance-catalog.mjs`
- `lib/zero-shot/page-observer.mjs`
- `lib/zero-shot/deterministic-resolver.mjs`
- `lib/zero-shot/action-proposal.mjs`
- `lib/zero-shot/action-admission.mjs`
- `lib/zero-shot/step-executor.mjs`
- `lib/zero-shot/progress-verifier.mjs`
- `lib/zero-shot/exploration-trace.mjs`
- `lib/zero-shot/single-step-runner.mjs`

S1 纯重构：

- `lib/adaptive-execution/setup-receipt.mjs`
- `lib/adaptive-execution/setup-*.mjs` 新支持模块

验收新增：

- `tests/_golden/page-observer-main-frame.zero-sut.golden.mjs`
- `tests/_golden/deterministic-resolver-step-contract.zero-sut.golden.mjs`
- `tests/_golden/zero-shot-action-progress.zero-sut.golden.mjs`
- `tests/_golden/zero-shot-authority-runner.zero-sut.golden.mjs`
- `tests/_golden/adaptive-module-boundaries.static.golden.mjs`
- `tests/_golden/fixtures/zero-shot-observe-admit-step/adapter-double.mjs`

明确不碰：

- `bin/replay.mjs`
- `bin/verdict.mjs`
- `lib/replay-actions.mjs`
- `lib/compile-atoms.mjs`
- `lib/atoms-registry.snapshot.json`
- 正式 events/expected/identity receipt schema；
- `.auth/`、`site.json`、真实目标地址。

## 4. 可执行验收

### A. observation/catalog/authority

1. main-frame settled snapshot 产有界、稳定排序和稳定 digest 的 public observation；
2. URL 只保留经凭据路由 masking 的 pathname，不含 host/query/hash；
3. raw HTML、href/src、input value、platformId 不进入 public JSON；
4. unsettled、truncated、iframe/container-only 只产不可动作证据；
5. hidden/disabled duplicate 进入 page-wide 歧义计数；
6. 新 observation 撤销旧 authority，JSON clone、DOM replacement 和 dispose 后全部拒绝；
7. 输入不变异，异常收敛为结构化 reason。

### B. step contract/resolver/proposal

1. 真正零 recipe 的 builder-issued intent plan + user-confirmed read click + typed progress 可冻结；
2. 手造/clone/spread/改写 intent plan 与 step contract 全部拒绝；
3. known/model mapping、known override、recipe ambiguous、缺 param、bridge rejected 全部禁止 primitive；
4. exact role/label/text 全页恰一才 resolved；substring/case/fuzzy 不匹配；
5. `affordanceId` 与 entity `candidateId`/platformId 不能混用；
6. 合规 proposal 只在真正零命中的 builder-issued 当前 catalog 中指一个 affordance；
7. deterministic 唯一命中时 proposal 不能绕路另选合法 `af_*`；
8. selector/code/effect/impact/finish/progress/expected/verdict/多动作 proposal 全拒。

### C. admission/execute/progress/trace

1. happy path action 恰一次，fresh after pathname 满足冻结 progress 后标记 progressed；
2. admission 失败 action 零调用；伪造 resolution 即使指向当前 catalog 内另一个合法 `af_*` 也拒；
3. action adapter 抛错只调用一次、不换目标、不重试；
4. admission/action receipt 的 clone/spread/手造对象拒绝，不能双击或伪造 progress；
5. stale observation、DOM replacement、hidden/disabled/ambiguous、known atom、identity pending 全拒；
6. action success 但 after unsettled、lineage 错、内容与 authority 不绑定、pathname 无进展或动作前已满足
   progress 时 intent 仍 pending；
7. deterministic 与 bounded proposal 两条路径都贯通 runner；
8. trace 稳定且只含单步 candidate，恒未签/不可回放、无任何机器裁定字段。
9. contract、observation、resolution/proposal、admission、action receipt 全链递归冻结；不能保权原位换点或
   篡改 progress。

### D. 解耦与回归

1. 本契约全部 S2 核心文件以及 S1 被修改核心文件逐个 `<=600` 行；
2. 纯 resolver/proposal/progress/trace 不直接 import Playwright、fs、network、bin/replay；
3. S1 三金牌、intent plan/state trace、flow bridge、compile gate、replay settle、entity binding 回归不漂移；
4. `term-lint`、`git diff --check` 通过。

## 5. 不可由 zero-SUT 自动证明的 observability

- AI 中台 current build 主 frame fresh observe → one read click → post-readback；
- AI 中台进入智能体管理等真实跳转若产生 popup/new tab：必须证明复用同一 BrowserContext、选择正确活动页、
  登录态连续且未擅自重登；掉登录或页面归属不确定时 route:human，并在报告记录脱敏 page topology 证据；
- version-held-out 页面上的 hidden duplicate、DOM replacement 和 SSE settle；
- 医生站 site-held-out 同通道只读页；
- setup execution request 下沉到真实 browser observer 的 readback freshness；
- Hi 小助 CEF、iframe/shadow/container、mutation/relation/destructive；
- LLM proposal 实际质量、prompt injection 对抗与规模化 held-out 成功率。

这些全部 `route:human`；adapter double 或 fake SUT 的 GREEN 不能替代。

# GRILL · zero-shot-typed-progress-predicate

> 阶段 0 决策树。每条分岔给出裁决与理由；未清空的分岔不得进 plan。

## G1 为什么现在要扩 predicate 闭集

P9 纵向切片 1 的自然语言语义是「点击工作流管理」，其验收点包含三条**否定式**要求：

- 没有自动打开具体工作流；
- 没有进入测试会话；
- 没有进入消息页面。

现役闭集 `lib/zero-shot/step-contract.mjs` 的 `validProgressItem` 硬钉 `kind === 'urlPathname'`，
`lib/zero-shot/progress-verifier.mjs` 的 `matchesPath` 也只认这一种。**否定式进展断言当前无法表达**，
只能靠 `urlPathname` 间接兜——而单页应用「URL 不变但抽屉打开」正是它测不到的那一类。

裁决：扩闭集，不绕过。

## G2 为什么不新造一个观测平台

`PageObservation.affordances[]` 已经逐条带 `semantic{kind,role,name,exact}`、`visible`、`enabled`、
`pageCount`、`actionable`。`roleVisible` / `roleHidden` 是这些**已有事实**的纯函数投影，零新增采集、
零驱动改动、零新增持久状态。

裁决：只加纯判定，不碰 `playwright-page-driver.mjs`、不碰 `affordance-catalog.mjs` 的采集面。

## G3 `roleVisible` 要不要求唯一

分岔甲：只要有任一匹配项可见即成立。
分岔乙：匹配项恰一条且 `pageCount === 1` 且可见。

同名多命中意味着页面状态本身有歧义，「哪一个可见」说不清。现役 `点击身份门`（`action-proposal.mjs`
的 `currentTarget`、`deterministic-resolver.mjs` 的 `matches.length !== 1 || pageCount !== 1`）
对动作目标一律要求恰一。进展断言若比动作断言松，就会出现「动作因歧义被拒、进展却判过」的倒挂。

裁决：取乙。复用现役 count===1 纪律，不另立标准。

## G4 `roleHidden` 的语义是「未挂载」还是「不可见」

`assert-visibility-semantics` 契约（2026-07-31 Steven 已签）已把 `assert.textHidden` 的权威口径
定死为**可见性**（`toBeHidden`，含未挂载），并有真机实证：Esc 后 DOM 命中 1、可见命中 0。

裁决：`roleHidden` = 不可见（缺席与挂载但不可见都算成立）。不为本契约另造第三种口径。

## G5 否定式断言的 fail-open 洞（本契约的真核）

「缺席」只有在**目录完整**时才证得出来。现役 `progress-verifier` 对 after observation
既不查 `truncated` 也不查 `unsupportedScopes`：

- `truncated === true`：`affordance-catalog.mjs` 在超出 `maxCandidates` 时按 `semanticKey` 排序后截断，
  **整组可能被切掉**——包括一个真正可见的匹配元素。据此判「不可见」是假绿。
- `unsupportedScopes.iframe/shadow/containerOnly`：元素可能藏在未观测作用域里，缺席不可证。

对照面：`action-admission.mjs` 的 `observationBlocker` 对**动作前** observation 三项全查
（settled / truncated / unsupportedScopes）。动作后的进展路径漏了后两项。

分岔甲：只在 after 上查。
分岔乙：before 与 after 都查。

初判取乙（理由是因果判据 `beforeMatched` 也吃缺席结论、误判方向不对称）。**但两条路都实测过，
初判是错的**——承重断言不许靠推理下结论：

- 探针一（before 截断可达性）：`observePage(maxCandidates:1)` 造出 `truncated:true` 的 before，
  `resolveDeterministicAction` 直接 `blocked/CATALOG_TRUNCATED`，`admitZeroShotAction` 亦
  `denied=CATALOG_TRUNCATED`，`perform` 调用数 0。**before 截断根本到不了进展校验**——
  `action-admission.mjs:83` 的 `observationBlocker` 已在上游三项全查（settled/truncated/scopes）。
  在 progress 面再查 before 是不可达的死代码。
- 探针二（after 截断可达性）：before 1 个候选不截断、after 3 个候选在 `maxCandidates:2` 下截断，
  admission 通过、`perform=1`、after `truncated:true`，`verifyStepProgress` 仍返回
  **`progressed`**。原因在 `affordance-authority.mjs`：`blockReason` 只在 `revalidateAffordance`
  第 115 行被查，`inspectAffordanceAuthority` 完全不看它，而进展校验走的正是后者。

裁决：改取甲的加强版。

- **after**：凡 expected 含任一缺席类 predicate，after observation 必须非截断且无 unsupported
  scope，否则 fail-closed。这是真实可达的洞——缺席类 predicate 一旦入闭集就会立刻兑现成假绿。
- **before**：不加不可达的重复检查，改为**钉住上游封堵**：新增回归钉断言截断的 before 在
  resolver 与 admission 两处均被拒且 `perform === 0`。将来谁把 `observationBlocker` 重构掉，
  这枚钉子会红，而不是等到进展面悄悄放行。

`roleVisible` 与 `urlPathname` 是**存在性**断言，截断只会丢候选、不会凭空造候选，且 `pageCount`
在截断前的全集上算出、不受截断影响，故不对它们加此约束（加了会无谓收紧现役已签行为）。

## G6 因果性对否定式断言怎么算

现役规则是**合取级**因果：`expected.every(...)` 在 before 全真则判 `EXPECTED_PROGRESS_NOT_CAUSED`，
after 非全真则判 `EXPECTED_PROGRESS_NOT_PROVED`。

否定式 predicate 在语义上是**守卫**（「这件事不许发生」），不是「要发生的变化」。合取级规则下：

- 纯否定 expected（只有 `roleHidden`）且动作前后都成立 → before 全真 → 拒。守卫单独不能冒充进展，正确。
- 混合 expected 且否定项动作前后都成立、肯定项翻转 → 判过。正确，进展由肯定项承担。
- 混合 expected 且否定项由「可见」翻成「不可见」（如关抽屉）→ 判过。正确，这本身就是进展。

裁决：保持合取级因果规则一字不改，只把 `matchesPath` 泛化成 `matchesPredicate`。

## G7 键形状：统一 `{kind,op,value}` 还是按 kind 分键集

`urlPathname` 已被现役冻结件按 `exactKeys(item, ['kind','op','value'])` 精确校验，改形状会破已签字节。
role 类需要 `role` 与 `name` 两个值，塞进单个 `value` 只能用嵌套对象，与现役扁平约定不一致。

仓内已有先例：`validTarget` 就是按 kind 分键集（`['kind','role','name','exact']` 对
`['kind','name','exact']`）。

裁决：按 kind 分精确键集。`urlPathname` 键集与校验规则**一字不动**（现役已签件字节兼容），
role 类用 `['kind','role','name']`，`role` 复用 catalog 的 `/^[a-z][a-z0-9-]{0,63}$/`。

## G8 非目标

- 不做 `dialogOpened`/`drawerOpened`/`pageOpened` 等容器/拓扑类 predicate：它们需要
  `PageObservation` 先有页面内容器作用域，属下一契约（观测包）。本契约不预留半成品字段。
- 不做 `entityPresent`/`networkEnvelope`/`createdEntityReadback`：走既有实体与取证面，不进 zero-shot 闭集。
- 不碰 promotion gate：另立契约。
- 不动 `bin/verdict.mjs`、不动三轴、不新增断言 kind 进 `check.mjs`：本契约完全在 zero-shot
  开发期闭环内，产物仍恒 `signed:false` / `replayReady:false`（护栏 #15/#17 不受影响）。

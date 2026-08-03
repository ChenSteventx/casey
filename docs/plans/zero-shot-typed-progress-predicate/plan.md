# plan · zero-shot-typed-progress-predicate

> lane=full。后继于 `zero-shot-observe-admit-step`（S1–S6，经 R1–R11 对抗加严）。
> 只扩 zero-shot 开发期的 typed progress predicate 闭集，不碰正式回放、三轴、裁判与报告。
> 决策树见同目录 `GRILL.md`。

## 1. 业务目标

P9 纵向切片 1「点击工作流管理」的验收点里有三条否定式要求（没自动打开具体工作流、没进测试会话、
没进消息页面）。现役 typed progress predicate 闭集只有 `urlPathname` 一种，**否定式进展断言表达不出来**，
且单页应用「URL 不变而抽屉打开」正是它测不到的一类。

本契约把闭集扩到能表达「某个语义元素动作后可见」与「某个语义元素动作后不可见」，并堵住否定式断言
在目录截断/未支持作用域下的 fail-open 洞。

## 2. 闭集扩展（精确形状）

`lib/zero-shot/step-contract.mjs` 的 `validProgressItem` 由单一 kind 改为按 kind 分精确键集：

| kind | 精确键集 | 取值约束 |
|---|---|---|
| `urlPathname` | `['kind','op','value']` | **一字不动**：`op ∈ {startsWith,equals}`，`value` 以 `/` 开头，禁 `//`/`?`/`#`/`://` |
| `roleVisible` | `['kind','role','name']` | `role` 匹配 `/^[a-z][a-z0-9-]{0,63}$/`；`name` 为非空 trim 后字符串 |
| `roleHidden` | `['kind','role','name']` | 同上 |

`urlPathname` 的键集与校验规则保持现役字节兼容——已签冻结件不得因本契约失效。

## 3. 判定语义（纯函数，零采集）

判定只读 `PageObservation` 已有事实：`affordances[].semantic{kind,role,name}`、`.visible`、`.pageCount`。
零新增采集、零驱动改动、零持久状态。

- `roleVisible(role,name)` 成立 ⟺ 语义为 `kind:'role'` 且 `role`/`name` 精确相等的 affordance
  **恰一条**，且该条 `pageCount === 1`，且 `visible === true`。
  多命中或 `pageCount > 1` 一律不成立（复用现役点击身份门的 count===1 纪律，进展断言不得比动作断言松）。
- `roleHidden(role,name)` 成立 ⟺ **不存在**任何语义 `role`/`name` 精确相等且 `visible === true` 的 affordance。
  缺席与「挂载但不可见」都算成立（与 `assert-visibility-semantics` 已签的可见性口径一致）。

## 4. 否定式断言的完整性前置（本契约的真核）

缺席只有在目录完整时才证得出来。可达性两条路都已用探针实测（记录见 `GRILL.md` G5），结论不对称：

**after —— 真实可达的洞，本契约必须堵。** 实测：before 一个候选不截断、after 三个候选在
`maxCandidates:2` 下截断，admission 通过、`perform=1`、after `truncated:true`，
`verifyStepProgress` 仍返回 `progressed`。根因是 `affordance-authority.mjs` 的 `blockReason`
只在 `revalidateAffordance` 第 115 行被查，`inspectAffordanceAuthority` 不看它，而进展校验走后者。

**第三条不完整来源（R1 加严补入）：脱敏抑制。** 首版只堵了截断与未支持作用域，实测发现还有一路：
`affordance-catalog.mjs` 的 `semanticOf` 在 `accessibleName`/`label`/`text` **任一**命中敏感规则时
把整条候选丢弃，而这类丢弃**不计入 `truncated`**。探针实证：详情抽屉真的可见、可访问名恰是断言里的
名字，只因正文含 32 字符以上不透明标识就整条消失，目录里再无痕迹可反证，`roleHidden` 误判成立、
判 `progressed`——真实假绿。

修法是让目录把「脱敏抑制」与「无可用名称」分开计数：无名候选没有名称、永远匹配不上 `role+name`
判据，丢弃无害；被抑制的候选却可能正是缺席断言要找的那一个。故目录新增 `redactionSuppressed`
计数（并入 `catalogDigest`），`PageObservation` 原样公开。

**R2 收敛后的统一规则（异构评审逼出来的，首版分法是错的）：凡读目录的判据，前后两份观测都必须完整。**

判据分两类，按「结论是否取决于 affordance 目录」划线，而不是按「肯定/否定」划线：

- 读目录的判据 = `roleVisible` + `roleHidden`；
- 不读目录的判据 = `urlPathname`（只看 `observation.urlPathname`，与目录完整性无关，继续豁免）。

首版只让缺席类吃完整性前置，理由是「存在性断言的 `pageCount` 在截断前全集上算出、不受截断影响」。
异构评审证伪了这条理由——它只对 **catalog 层截断**（`maxCandidates`）成立。真实路径上还有一道
**driver 层截断**：`playwright-page-driver.mjs:71-72` 在 `nodes.length >= MAX_DISCOVERED`（1000）时
直接不收该元素、只置 `sourceTruncated`，候选**根本没进 `projected`**，于是 `pageCount` 在幸存集上
低估成 1。页面上真有两个同名可见元素时，`roleVisible` 会判「唯一可见」而成立——存在性断言同样假绿。

同理，首版「before 面不必查」也只对截断成立。`action-admission.mjs:83` 的 `observationBlocker` 只查
settled / truncated / unsupportedScopes，**不查 `redactionSuppressed`**，所以 before 侧的脱敏抑制
可达：目标元素动作前就已可见、只因正文含不透明标识而不进 before 目录，动作后正文干净、元素出现，
判据由假翻真，因果闸放行一次动作根本没造成的「进展」。

故：凡 `expectedProgress` 含任一读目录判据，`beforeObservation` 与 `afterObservation` **两份**都必须

- `truncated !== true`，否则 `PROGRESS_CATALOG_TRUNCATED`；
- `unsupportedScopes` 的 `iframe`/`shadow`/`containerOnly` 全为非真，否则 `PROGRESS_UNSUPPORTED_SCOPE`；
- `redactionSuppressed` 为整数且等于 0，否则 `PROGRESS_REDACTION_SUPPRESSED`（缺字段或非整数同样拒付）。

缺席类判据**另外**要求 `afterObservation.affordances` 非空，否则 `PROGRESS_CATALOG_EMPTY`：动作后整页
无候选（跳登录页、渲染失败、整页替换）时，「没看见」与「不存在」分不开。

**上游封堵仍单独钉住。** 截断的 before 被 `resolveDeterministicAction` 判 `blocked/CATALOG_TRUNCATED`、
被 `admitZeroShotAction` 判 `denied=CATALOG_TRUNCATED`、`perform` 为 0，这条上游不变量由回归钉守住；
进展面现在也自查 before，两层不互相替代。

**`pageCount === 1` 的可测性（如实挂账）。** 收敛后 `matched.length === 1 && pageCount > 1` 蕴含目录
截断，而截断已对 `roleVisible` fail-closed，故该状态经生产路径不可达：单独删掉 `pageCount === 1` 不会
让金牌转红。保留它是直接表达 §3 的唯一性不变量、并防止将来改动使该状态重新可达；不可达性本身由
「截断 + `roleVisible` → `PROGRESS_CATALOG_TRUNCATED`」这枚钉子守住。这是已知的测试不可达面，不是已覆盖面。

**已知不完整来源不宣称穷尽（route:human）。** 除上述四种（截断 / 未支持作用域 / 脱敏抑制 / 空目录）
外，还有两类元素真实可见却进不了 `role+name` 匹配面，属 driver 枚举与投影策略、不在本契约修复范围：

- `playwright-page-driver.mjs` 的候选过滤只收 native 交互元素与显式 `role` 元素，无 role 属性的可见
  容器（裸 `div` 抽屉等）从不进目录，且不带任何完整性标志；
- 有 role 但可访问名为空的元素被投影成 `kind:'label'`/`kind:'text'`，而 role 类判据只认 `kind:'role'`。

两者都必须在真机验收里由人确认，zero-SUT 夹具证不出。

豁免完整性前置的**只有 `urlPathname`**：它只读 `observation.urlPathname`、完全不读目录，
目录完整与否不影响其结论。（R3 订正：此处曾残留 R1 时代的旧段，把 `roleVisible` 也列为豁免——
该说法已被 R2 的 driver 层截断反例证伪并被统一规则取代，旧段若被照办会把 F1 假绿请回来，故删。）

## 5. 因果性

现役合取级因果规则**一字不改**：before 全真 → `EXPECTED_PROGRESS_NOT_CAUSED`；after 非全真 →
`EXPECTED_PROGRESS_NOT_PROVED`。只把 `matchesPath(pathname, item)` 泛化为
`matchesPredicate(observation, item)`。

推论（须由测试钉死）：纯否定 expected 永远无法自称进展——动作前后都成立则 before 全真被拒，
动作前不成立则 after 也不成立被拒。守卫不能冒充进展。

## 6. 产物降权不变量

`progressReceipt` 继续恒 `signed:false` / `replayReady:false`；`conditionKind` 由固定字面量
`'urlPathname'` 改为本次 expected 实际用到的 kind 集合（确定性排序、去重），使收据可回溯到判据种类。
收据不得出现 `PASS`/`verdict`/`passes` 字样，不得落真实身份值。

本契约完全在 zero-shot 开发期闭环内：不进 `bin/verdict.mjs`、不进三轴、不新增断言 kind 到
`check.mjs`（护栏 #15/#17 不受影响）。

## 7. 最小 ATDD（红先行）

新增并冻结一枚：`tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs`，至少覆盖：

**闭集校验（step-contract 面）**
1. `roleVisible`/`roleHidden` 合法项可冻结；
2. 未知 kind、缺键、多余键、错类型 `role`/空 `name`、`role` 违反字符集一律拒；
3. `urlPathname` 现役形状与全部旧拒因保持一字不变（回归钉）。

**判定与因果（progress-verifier 面）**
4. 正控：动作前目标不可见、动作后唯一可见 → `progressed`；
5. 同名两命中（`pageCount === 2`）时 `roleVisible` 不成立 → `EXPECTED_PROGRESS_NOT_PROVED`；
6. 动作前已可见 → `EXPECTED_PROGRESS_NOT_CAUSED`；
7. `roleHidden` 正控：动作前可见、动作后不可见 → `progressed`；
8. `roleHidden` 反控：动作后仍可见 → `EXPECTED_PROGRESS_NOT_PROVED`；
9. 纯否定 expected 动作前后均成立 → `EXPECTED_PROGRESS_NOT_CAUSED`（守卫不冒充进展）；
10. 挂载但不可见 → `roleHidden` 成立（可见性口径钉死，非未挂载口径）。

**fail-open 堵漏**
11. 含 `roleHidden` 且 after `truncated:true` → `PROGRESS_CATALOG_TRUNCATED`
    （实现前此路实测判 `progressed`，即真实假绿）；
12. 含 `roleHidden` 且 after `unsupportedScopes.iframe/shadow/containerOnly` 任一命中 →
    `PROGRESS_UNSUPPORTED_SCOPE`；
13. 上游封堵回归钉：截断的 before 在 `resolveDeterministicAction` 判 `blocked/CATALOG_TRUNCATED`、
    在 `admitZeroShotAction` 判 `denied=CATALOG_TRUNCATED`，且 `perform` 调用数为 0；
14. 纯 `urlPathname` expected 在 after `truncated:true` 下**不**被本约束误拒
    （R3 订正：原文误含 `roleVisible`，与 R2 统一规则及第 17 条对撞——`roleVisible` 读目录，
    必须吃完整性前置）；
15. 含 `roleHidden` 且 after 有可见候选因脱敏被整体抑制（非截断触发）→
    `PROGRESS_REDACTION_SUPPRESSED`；
16. 无可用名称而被丢弃的候选**不**计入抑制、**不**阻断缺席判定（只抑制才阻断）；
17. `roleVisible` 同样吃完整性前置：after 截断 → `PROGRESS_CATALOG_TRUNCATED`；
18. before 侧脱敏抑制 → `PROGRESS_REDACTION_SUPPRESSED`（钉住因果不被前侧不完整绕过）；
19. `roleVisible` 唯一命中但不可见 → `EXPECTED_PROGRESS_NOT_PROVED`；
20. 缺席类判据遇 after 空目录 → `PROGRESS_CATALOG_EMPTY`。

**降权与授权链**
15. `progressReceipt` 恒 `signed:false`/`replayReady:false`、无 verdict 字样；
16. 现役授权链拒因（contract/receipt/observation authority、lineage、unsettled）逐条保持不变。

## 8. 邻接复跑（护栏 #19）

`zero-shot-action-progress`、`zero-shot-authority-runner`、`deterministic-resolver-step-contract`、
`page-observer-main-frame`、`public-observation-redaction`、`playwright-page-driver-hardening`、
`adaptive-module-boundaries.static`（含逐文件 ≤600 行）、`intent-plan-known-atom`、
`intent-state-trace`，加 `term-lint --registry`、PRD 漂移扫描与 `selftest --tier1`。

## 9. route:human / observability

- 真实 SUT 上 `roleVisible`/`roleHidden` 对 AI 中台实际 ARIA 角色与可访问名的命中质量；
  zero-SUT 夹具只证明控制流，不能替代真机。
- 真实页面 `maxCandidates` 取值是否足以让工作流管理页不触发 `truncated`；触发即本契约按设计拒付，
  需人裁是调容量还是收窄观测。
- 切片 1 的实际 `role`/`name` 字面量必须来自真机只读探查，不得从夹具外推。

## 10. 完成定义与非目标

完成 = 新金牌由红转绿 + 第 8 节邻接全 exit 0 + 异构评审通过。

非目标：容器/拓扑类 predicate（`dialogOpened`/`drawerOpened`/`pageOpened`）留待观测包契约；
promotion gate 另立契约；不动正式回放链、不动裁判、不新增真机或凭据输出面。

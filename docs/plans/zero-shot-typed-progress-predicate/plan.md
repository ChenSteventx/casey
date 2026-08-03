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

故：凡 `expectedProgress` 含任一缺席类 predicate（当前即 `roleHidden`），`afterObservation` 必须

- `truncated !== true`，否则 `PROGRESS_CATALOG_TRUNCATED`；
- `unsupportedScopes` 的 `iframe`/`shadow`/`containerOnly` 全为非真，否则 `PROGRESS_UNSUPPORTED_SCOPE`。

**before —— 上游已封死，不加不可达的死代码。** 实测：截断的 before 被
`resolveDeterministicAction` 判 `blocked/CATALOG_TRUNCATED`、被 `admitZeroShotAction` 判
`denied=CATALOG_TRUNCATED`，`perform` 调用数 0（`action-admission.mjs:83` 的 `observationBlocker`
三项全查）。故 before 截断到不了进展校验。改为**钉住上游封堵**：新增回归钉断言这两处拒付与零动作，
将来谁重构掉 `observationBlocker`，钉子当场红，而不是等进展面悄悄放行。

存在性断言（`urlPathname`、`roleVisible`）不加此约束：截断只丢候选不造候选，且 `pageCount` 在截断前
全集上算出、不受截断影响。无谓收紧会破现役已签行为。

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
14. 纯存在性 expected（只有 `urlPathname`/`roleVisible`）在 after `truncated:true` 下**不**被本约束
    误拒（防无谓收紧现役已签行为）。

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

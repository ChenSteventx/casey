# codex 异构评审记账 — entity-rename-negative-guard（C4）

评审家族：codex gpt-5.6-sol（read-only 暴露真 worktree，亲跑金牌），异构核验 Claude 实现。

> 状态（诚实）：baton 4/6——**review 未过、learn 未收**。本轮 codex 评审**未干净收尾**（收尾合成消息被 codex 侧内容过滤器连掐两次、误报 cybersecurity risk），无干净终判；下方裁定由 codex 已产出的实质发现 + Claude 独立核验合成。**不能标 review PASS。**

## codex 本轮已确证（跑了真金牌 + 真 verdict CLI）

- 金牌 `entity-rename-negative-guard.zero-sut.golden.mjs` 亲跑：`①B/③ dispatchReplayAction 对 rename 事件触 page 前具名拒`、`边界A unknownAtomRejection 对全体合法原子恒返 null` 等过。
- **风险#2（verdict 因果链）= 确认 fail-closed**：亲跑真 `bin/verdict.mjs`——reject 轴 `resolution:'action_failed'` → `NEEDS_HUMAN/INDETERMINATE`（绝不 PASS）；对照 `resolution:'unique'` → PASS。守卫拒绝轴翻不出 PASS。
- **风险#5（非字符串 atom）= 逮到 dispatchReplayAction 孤立漏口**：`ev.atom` = undefined/123/`[]`/`{}` 直调 `dispatchReplayAction` 全 `clicks:1`（碰 page）+ 轴 `unique`（假过）。但 codex 同时发现第二层 `checkReplayEntityAdmission` 对这些非字符串返 `ok:false REPLAY_EVENT_SHAPE_INVALID`——正查「生产是否在事件环前跑这道 preflight」时被内容过滤掐断。

## Claude 独立核验（补齐 codex 被掐断的 crux）

- 生产 `bin/replay.mjs:274` **无条件**调 `checkReplayEntityAdmission`（别名 `checkCompileIdentityAdmission`）、`ok:false` 即 `process.exit(65)`，早于事件环（561）与浏览器启动。codex 探针用的正是这函数的生产入参形态。→ **非字符串 atom 在生产被 preflight 前置拒、浏览器都不启，dispatchReplayAction 那个孤立漏口生产不可达。**
- `policyForAtom`（preflight，行 446）对任何不在 `SIDE_EFFECT_POLICY` 的 string 原子返**默认 mutation 策略**（`|| {effect:'mutation',requiredRoles:['subject']}`）、从不返 null。→ **未知 string 原子（`workflow.rename`，`isCompilableAtom=false`）不被 preflight 当未知拒**、按默认 mutation 处理；若带签名冻结锁可过 preflight 进事件环——**此时 C4 的 `dispatchReplayAction` `UNKNOWN_ATOM` 闸才是那道拦截**。故 C4 守卫**非冗余、是互补层**（preflight 管形态/非字符串，C4 管合法形态但未知的 string 原子）。

## 原 C4 `workflow.rename + click` 安全属性成立（hermetic，多层 fail-closed）

原 C4 所测的 `workflow.rename + click` 路径不执行破坏动作、不产 PASS：非字符串→preflight
`REPLAY_EVENT_SHAPE_INVALID` exit 65；未知 string 的 click 事件→C4 `UNKNOWN_ATOM` reject，
从分发接缝起不碰 page；reject 轴→verdict `NEEDS_HUMAN`。三层在该路径各自 fail-closed。
任意 `action` 的全称结论不成立，`nav` 分支边界见本文末补记。

## 两条金牌保真缺口（codex 逆出属实，非生产 fail-open，但 C4 自证过度声称）

1. **非字符串靠未断言的上游 preflight**：C4 金牌断言 `unknownAtomRejection` 对非字符串返 null（沿旧路），其生产安全**全靠上游 `checkReplayEntityAdmission` 的 `REPLAY_EVENT_SHAPE_INVALID`**——但 C4 金牌**没有端到端断言这层上游封口**。隐性耦合：若 preflight 日后被弱化/移走，C4 守卫单独对非字符串 fail-open。应补端到端金牌钉「生产 replay 对非字符串 atom preflight 拒、浏览器不启」。
2. **「触 page 前拒」对生产过度声称**：金牌以孤立 wrapper 调用验「零 page 触碰」，但生产事件环非 nav 分支在 `dispatchReplayAction`（618）**之前**有 `pre.path` 的 `page.goto`（583）——未知 string 原子若过 preflight 进环，守卫前会有一记 `pre.path` 良性导航。这是导航非破坏动作、轴仍 reject→NEEDS_HUMAN（**不产 PASS、不执行破坏**），非 fail-open；但金牌「零 page 触碰」的措辞对生产不成立，应订正为「破坏动作执行前拒」或补生产事件环覆盖。

## 裁定

- 原 C4 `workflow.rename + click` fail-safe 属性：**成立**（不产 PASS、不执行破坏，多层 fail-closed，亲验）。
- 但：codex 评审被内容过滤掐断、**未干净收尾**；且两条金牌保真缺口属实（自证过度声称）。→ **不标 review PASS，baton 停 4/6。**
- 收口前置（任一路）：① 补两枚端到端金牌闭上述缺口（preflight 非字符串封口 + 生产事件环覆盖/措辞订正）后，跑一轮干净 codex 复审；② 或换避开内容过滤触发的措辞重跑 codex 拿干净终判。

## 残留 route:human

`rename→successor` 端到端（唤醒子系统 A，kernel 设计门+人签）；真机破坏性 rename UAT（每例过完成闸，ADR-0009）。

## 2026-07-24 保真收口候选补记（不改变本评审终态）

两条属实缺口已形成待签候选，详见
`../proposed/boundary-correction.md` 与同目录两枚
`*.candidate.zero-sut.golden.mjs`。修前均为 3 过 / 1 红（唯一红是准确边界说明缺席），
补说明后才可复跑候选绿。

生产边界进一步核细：`UNKNOWN_ATOM` 分发闸之前除 `pre.path` 恢复导航外，还有行计数等只读采样、
可选对话基线与点击响应监听器安装。因此只可声称“到达分发闸后不委派 `performAction`、不执行业务动作
或破坏性操作、拒绝轴不产 `unique`”，不可声称“生产事件环页面零触碰”。

另有一项新边界待人裁：`ev.action==='nav'` 的生产分支不经过 `dispatchReplayAction`，而上游前置检查
对未知字符串原子采用默认 mutation policy。故现有证据只覆盖原 C4 的 `workflow.rename + click` 业务动作
分发路径，不能外推为任意 `action` 的未知原子都不产 PASS；收窄声明或把强制检查前移须在人签时择一。

本补记未改冻结金牌、计划、GRILL、PRD、`testChecksums` 或 `passes`；C4 仍为 baton 4/6，
review 未过、learn 未收。正式收口须先走候选说明中的 ADR-0004 人签清单，再做干净异构冗余复审。

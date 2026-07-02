# P4 断言草拟器 grill 决策记录（slug: `p4-drafter`，lane 待定）

> 零 baton 预备轨草稿（2026-07-02）：本轮只 grill 草拟器设计、清决策树，**不 `contract init`、不占 baton、不写 `lib`/`bin`**。落地（碰 `lib` + 跑 loop）待主 baton（现 `replay-login-bootstrap`）空后另起。
> 血缘：承接 `p4-freeze`（冻结+人签骨架 done、有意延后本块，见 `docs/plans/p4-freeze/grill.md:9`）、design §5（草拟→冻结→裁判）/ §2.1（断言词表 + determinism 铁律）。消费已冻接缝：`observed-reality`（输入）、`expected-frozen`（输出）、`bin/check.mjs` 词表。

## 框定

P4 两块（`p4-freeze/grill.md:7`）：① 断言草拟（L2，本轮）；② 冻结+人签（`p4-freeze` 已 done）。本轮设计**草拟器**：从 `观测现状` + `intent` + 编译期 `assert.*` 原子留痕 → 草拟带类型 `expected[]`，交人签冻结（`sign-gate` 已有）。

## 已锁决策（人签 Steven，2026-07-02）

- **D1 草拟器边界 = 确定性为主、LLM 只补缝**。`assert.*` 原子留痕 + `观测现状` 确定性合成断言骨架；LLM 只补没有 `assert.*` 覆盖的语义断言（挑 `toast` / `replyContains` 关键词）；CLI 内是零 LLM 的校验闸 + 编译（`expected-compile` 已有）+ 人签（`sign-gate` 已有）。取 LLM 面最小、大半可确定性 golden。对称 P3：P3 的 `flow` 草稿 LLM 在 CLI 外产、引擎零 LLM。
- **D2 未实现 kind = 照草拟、冻成 `soft`**。草拟器照草拟全 12 种 kind；`replay-assert` 目前只实现 5 种，未实现的先冻成 `soft`（复用已有语义：进报告不进裁定树、不假红），待 `replay-assert` 补实现后走**重签**提 `hard`。**承载 = 已有 `soft` 标记 + 期望版本化重签**，不碰 `expected-frozen` schema、不碰冻结 `verdict.mjs` 内核（零新概念、纯加法）。

## 确定性合成骨架（D1 推论，拟定）

- `assert.*` 查表映射：`assert.onPage`→`urlPathname startsWith`（值取 `观测现状` 的 `urlPathnameAfter` 剥实体 ID）、`assert.textVisible`→`textVisible appears`、`assert.noErrorToast`→`noErrorToast absent`、`assert.buttonState`/`assert.switchState`→ 同名、`assert.bubble`→`replyContains`（关键词由 LLM 补）。
- 全局取证默认加：每条用例挂 `noPageError` + `noErrorEnvelope`（成功字段取 `通道剖面`）。
- 确定性 lint：`观测现状` 值里的 `atl_` 名/实体 ID/时间戳 → 强制 `{{uniqueName}}` 模板化或 `startsWith` 剥尾，绝不冻字面量（design §2.1 铁律）。

## LLM 只补（过零 LLM 校验闸）

- 补「没有 `assert.*` 覆盖、但 `观测现状` 有干净信号」的 `intent`；从 `replyText` 挑 `replyContains`/`replyMatches` 关键词。
- **校验闸**（fail-closed、可 golden）：`kind` 在 `bin/check.mjs` 词表 / `op` 合法 / `equals` 不含 ID·`atl_` / `uniqueName` 必模板化。不合规拒（护栏 #14）。这道闸是本轮能 hermetic 冻的核心产物——草拟语义质量是 `route:human`，但「草稿合不合规」确定性可测。

## 接缝挂账（本轮发现）

- `expected-frozen.schema.json` 的 `assertionKind` enum 是 **12 种**，`bin/check.mjs` 词表是 **15 种**（多 `textHidden`/`buttonState`/`switchState`）。草拟器落地前须对齐两头：走 seams 补冻把 3 种补进 schema，或反向收 `check.mjs`。**route:human 拍板**。

## route:human / deferred

- LLM 补缝的语义质量（断言选得对不对、覆盖够不够）—— 语义抽检 `route:human`（承接 `p4-freeze`，不可 hermetic）。
- 真人签 UX（`--sign` CLI、身份核验）—— design §11 项 1。
- 未实现 10 种 kind 的 `replay-assert` 实现 + 重签提 `hard` —— 并行加法，每种 = `check.mjs` 已有 + `replay-assert` 补 + golden（护栏 #17 加法式）。
- lane 定档 —— 落地时定：仅新增草拟器不碰冻结 = `light`；连带 12/15 接缝对齐 = `full`。

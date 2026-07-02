# p4-drafter — P4 相2 断言草拟器（full）

## 背景

P3 收官（2026-07-02，六项 route:human 全清），交接面四件套已产真：`观测现状` + `TestCase` 意图留痕 + 编译期 `assert.*` 原子留痕就位。相2 的「冻结+人签」半块（`p4-freeze`：`expected-compile`/`sign-gate`）早已 done，缺的是**草拟器**：把地面真值翻成带类型 `expected[]` 草稿、交人签冻结。决策底稿 = 本目录 `proposed/GRILL.md`（D1/D2 人签 + G-seam 缺席推定，均有案）与 `proposed/plan-draft.md`（另一 session 预备轨）。

## 范围（三处 + 一接缝）

1. **接缝对齐（G-seam）**：`tests/_golden/schemas/expected-frozen.schema.json` 双处对齐 `check.mjs` 权威表（schema 自述「kind 枚举权威活在 bin/check.mjs」）——`assertionKind` enum 12 → 15（补 `textHidden`/`buttonState`/`switchState`）；**落地时新发现同接缝第二漏收**：`assertionOp` enum 8 → 15（补 `filled`/`finished`/`contains`/`enabled`/`disabled`/`on`/`off`——前三个是已收 kind `requiredFilled`/`streamReplyReceived`/`replyContains` 的法定 op，schema 竟表达不了，潜在假拒）。全加法、旧数据仍合法；`prd-seams-freeze` checksum 重签、gate 复验 GREEN（先例：p5 `server.mjs` 重签、p3 golden 补冻）。per-kind op 绑定仍留后续加固（schema 原注既定）。
2. **`lib/assertion-draft.mjs`（新，纯函数零 LLM）**：
   - `synthesizeSkeleton(observed, assertionAtoms) -> expectedDraft`：按 D1 查表映射——`assert.onPage`→`urlPathname startsWith`（值取该 intent 末步 `urlPathnameAfter` 确定性剥尾段实体 ID：尾段为 4+ 位十六进制/数字即剥；无观测步退原子 `params.urlIncludes`）；`assert.textVisible`→`textVisible appears`；`assert.noErrorToast`→`noErrorToast absent`；`assert.buttonState`/`assert.switchState`→同名（op 取 params.state）；未知 `assert.*` 原子**不发明**、落 `draft.pending[]` 记 route:human。全局取证默认加 `noPageError absent` + `noErrorEnvelope envelopeOk`。`caseId` 卷回 observed。
   - `validateDraft(expectedDraft) -> { ok, problems }`：逐条 kind/op 经 `bin/check.mjs --validate-only` 复核（词表唯一事实源，不建副本表）；`equals` 值禁 `atl_` 裸字面量（仅 `atl_{{uniqueName}}` 模板形态合法）与 9+ 位数字长串（时间戳/ID）；违规 fail-closed `ok:false` + `problems` 落点。
   - soft 承载（D2）：kind 不在 `replay-assert` 已实现集 → 标 `soft:true`（进报告不进裁定，补实现后重签提 hard）。
3. **`lib/replay-assert.mjs` 加性导出** `IMPLEMENTED_KINDS`（现 5 种：`urlPathname`/`countChange`/`streamReplyReceived`/`noPageError`/`noErrorEnvelope`）——已实现集唯一事实源，草拟器消费；p5 冻结 golden 原样复跑作回归锁。

## 非目标（照 plan-draft，全挂账）

LLM 补缝语义质量（route:human 抽检；prompt/schema 已备 `proposed/llm-patch.draft.md`，LLM 在 CLI 外跑，同 P3 flow 草稿范式）；真人签 UX；10 种未实现 kind 的 `replay-assert` 实现（并行加法轨）；CLI 面（`casey draft` 命令化）待草拟器函数层验过再议。

## 验收（红先行）

golden 底稿 = `proposed/p4-drafter.golden.draft.mjs`（另一 session 已验红：模块缺席 import 抛），落地移入 `tests/_golden/p4-drafter.golden.mjs`（ROOT 上溯改两层）并增补：
- C-align：schema enum === 15 且含新三种（钉死 G-seam）；
- C-map-ext：`assert.buttonState` 原子 → `buttonState` kind + `soft:true`；`assert.noErrorToast` → 同名 soft；
- C-pending：未知原子（如 `assert.bubble`）不产断言、落 `pending[]`（fail-safe 不发明）；
- C-tpl-ok：`equals` 值 `atl_{{uniqueName}}`（前缀字面 + 模板）须 `ok:true`（防过度拒绝）。
原有检查照单全收（骨架卷回/全局取证/剥 ID/三违规拦/合规放/textVisible soft/urlPathname 硬）。

回归锁：`seams-freeze.golden`（schema 动过）+ p5 两份冻结 golden（`replay-assert` 动过）+ `selftest --tier1`。

## 风险与对策

- G-seam 是缺席推定：GRILL 已记否决回滚路径（enum 扩展在草拟器落地前无消费者，回滚零风险）。
- 剥 ID 规则误伤真路径段：规则收窄（尾段纯 hex/数字 4+ 位才剥），golden 钉正反两向。
- `validateDraft` 每断言 spawn 一次 `check.mjs`：草稿量级（十数条）下可忽略；不为省进程建词表副本（唯一事实源纪律优先）。

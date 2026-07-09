# 归一提示模板：自由文本 → 候选 TestCase（草稿）

> 草稿·未冻。承 `GRILL.md` D9「归一脚手架前段脚手架零 LLM、真实归一是 CLI 外 LLM 的活」：`casey scaffold-case` 已把一段自由文本零 LLM 包成 schema 合规的候选骨架（`source.kind:'freetext'` + `source.raw` 泊原文 + 一条 `route:human` 占位步）；本模板指导 CLI 外 LLM 把 `source.raw` 归一成真实意图步。产出必过零 LLM 校验闸（`casey ingest` 的 `parseTestCase`），违规 `fail-closed` 逐条退回，绝不进下游。
> 语义质量（切得对不对、`actionHint` 选得准不准、意图边界划得对不对）是 `route:human` 抽检，不在 hermetic（镜像 `llm-patch.draft.md`「语义质量 route:human 抽检」）。
> 权威只来自下游人签（护栏 #16）：候选过 `parseTestCase` ≠ 完成；仍须重走 `flow-bridge → compile → draft → 人签`，才是可回放契约。

## 角色与边界

你是 Casey 的自由文本归一器。输入是一份 `casey scaffold-case` 产的候选骨架（`source.raw` 泊了整段自由文本原文 + 一条 `route:human` 占位步）。**只做归一**：读 `source.raw` 把它切成真实意图步，绝不改 `source.raw` 逐字原文、绝不改 `caseId`/`schemaVersion`/`uniquePrefix`。

对每一条你从 `source.raw` 读出的意图：
- 能自动化的步：把占位步升级——去 `route:human` + 补 `actionHint`（动作词汇表枚举）+ 需要时补 `inputValue`（易变值模板化）；断言留给相2（`draft`），本步只出 `intent`/`actionHint`/`inputValue`，**不填 `expected`**（断言归相2、由 `casey draft` 从观测现状推导 + 人签冻结）。
- 升不动的步（要人工核对、无稳定入口、语义模糊）：保持 `route:human` + 写清 `reason`。

## 硬约束（违反即被 `parseTestCase` 拒、`fail-closed`）

1. `schemaVersion` 恒 `1`；`source.kind` 恒 `'freetext'`；`source` 键闭合为 `{kind, raw, ingestedAt}`（加任何闭合外键——如 `signed`——会被 `additionalProperties:false` 拒）。
2. `source.raw` 逐字原文不动（溯源锚，`raw === 用户输入`）。
3. `steps` 至少一条（`minItems:1`）；每步 `intentId` **全局唯一**、非空（重复即拒，防相1 投影忠实退化）。
4. `actionHint` 只能从动作词汇表选：`click` / `fill` / `select` / `send` / `navigate` / `assert`（枚举外即拒）。
5. `route` 只收 `human`；标 `route:human` 的步必带非空 `reason`（`route:human ⟹ reason`，别静默丢）。
6. `uniquePrefix` 保持 `atl_`（`^\S+$` 无空白非空；破坏性实体名前缀）。
7. 易变字面量纪律：名字 / 时间戳 / 实体 ID 必须模板化 `{{uniqueName}}`，绝不冻字面量（`atl_<ts>`/uuid/时间戳绝不进 `inputValue` 字面量）。
8. 不臆造 `target`/`startUrl`：真机入口由相1 `compile` 落地，本相不产 `target`。

## 输入形状（候选骨架，`scaffold-candidate-<caseId>.json`）

```jsonc
{ "schemaVersion": 1, "caseId": "<入参>",
  "source": { "kind": "freetext", "raw": "<整段自由文本原文，逐字>" },
  "steps": [ { "intentId": "i1", "intent": "（占位：待归一）", "route": "human", "reason": "归一脚手架骨架占位…" } ],
  "uniquePrefix": "atl_" }
```

## 输出形状（归一后候选 TestCase，喂 `casey ingest`）

```jsonc
{ "schemaVersion": 1, "caseId": "<原样>",
  "source": { "kind": "freetext", "raw": "<原样逐字>" },
  "steps": [
    { "intentId": "i1", "intent": "新增工作流 atl_{{uniqueName}}", "actionHint": "fill", "inputValue": "atl_{{uniqueName}}" },
    { "intentId": "i2", "intent": "保存工作流", "actionHint": "click" },
    { "intentId": "i3", "intent": "打开列表确认该工作流出现", "actionHint": "navigate", "route": "human", "reason": "列表出现与否须人工核对，暂无稳定入口断言" }
  ],
  "uniquePrefix": "atl_" }
```

## 产出后处理（确定性、零 LLM）

1. 过 `parseTestCase`（跑 `casey ingest <caseId> --in <候选> --out-dir <d>`）：`schemaVersion`/`source` 键集/`intentId` 唯一/`actionHint` 枚举/`route:human ⟹ reason`/`uniquePrefix` 逐条校验，违规逐条 `problems` 退回让归一器重出（有界次数）。
2. 再违规 → 把该步保持 `route:human` + `reason` 交人（`fail-closed`，别硬凑）。
3. 过闸产物 `testcase-<caseId>.json` 直喂相1 `casey flow-bridge`；此后 `compile → draft → 人签` 逐相走，人签冻结断言前不是可回放契约。

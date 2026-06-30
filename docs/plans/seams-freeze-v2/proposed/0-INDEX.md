# 接缝冻结 v2 —— 提案草稿索引

> 草稿 / 未冻 / 待 grill-with-docs 拍板，勿当已决。
>
> 来源：2026-06-30 对三份外部借鉴备忘录（Stagehand / Midscene / Autonoma）的 review 收口。这些是 review 挖出的「新接缝提案」，按 ADR-0005「造词先登记 CONTEXT.md」与 `roadmap-parallel.md` 排期 v3「轨 P · 借鉴接缝 v2 增冻」收口。本目录只起草，不登记 `CONTEXT.md`、不碰 `tests/_golden/` 已冻区、不写 `lib`/`bin`。

## 冻结流程（每条接缝都要走）

`grill`（定名 + 定边界 + 清决策树）→ `plan`（写验收）→ `accept`（红 golden + sha256 冻 testChecksums）→ `loop`（转绿）→ gate → 异构评审 → learn。机理同第 1 层 seams-freeze：先冻 schema + 合成 fixture，下游对 fixture 并行。

## 先行三接缝（本目录草稿）

| 接缝 | 文件 | 最该被拷打的开放问题 |
|---|---|---|
| `run-history.jsonl` / `run-metrics.json` | `1-run-history.{grill.md,schema.json,fixture.json}` | `cacheStatus`/解析缓存与「确定性回放本无解析缓存」的张力——重定义为溯源标记（纯回放恒 bypass）还是直接删；`method` 是否改回已冻 `action` |
| 动作词汇表 / `action vocabulary` | `2-action-vocabulary.{grill.md,schema.json,fixture.json}` | 它是已冻 `events.schema` action 枚举的治理投影层（不改 schema），还是独立 schema；与 `channelDriver.actionSpace` 的边界 |
| 失败记录台账 / `failure ledger` | `3-failure-ledger.{grill.md,schema.json,fixture.json}` | 定名锚 ITIL 已知错误库（`KEDB`）；`fingerprint` 排除 caseId/runId/凭据以聚类失败模式；只读、绝不进 `verdict.mjs`、绝不作自愈输入 |

共同红线（三条都写进 schema 描述）：仅报告/诊断；绝不进 `bin/verdict.mjs` 输入、绝不写 `passes`（护栏 #15/#17）；落盘过凭据兜底门、凭据型值脱敏（护栏 #7）。

## 后置接缝（随 canvas / arbitrary 维度，本轮不起草）

- 视觉模板合同（命中须落成 `断言词汇表` typed 断言、`verdict.mjs` 不分支）。
- `channelDriver` / action space（端口适配器式，须界定与 `通道剖面` 的边界）。

## 相关但独立：两个 hermetic coverage golden 草稿（非接缝）

review 另挖出两个 golden 覆盖缺口，草稿在别处，待接入 light 车道 accept 冻结：

- `docs/plans/p7-report/proposed/credential-gate.coverage.draft.mjs`：`bin/report.mjs` 的 `credentialGate`（护栏 #7）零 golden 覆盖；落地建议把内部 `collectSecretLiterals()` 改成可注入路径，免测试碰 `.auth/`。
- `docs/plans/p6-selfheal/proposed/superseded.coverage.draft.mjs`：`lib/drift-patch.mjs` 的 `superseded` 状态迁移无覆盖；纯函数 drop-in，无实现改动。

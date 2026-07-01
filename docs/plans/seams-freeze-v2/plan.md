# seams-freeze-v2 — plan（第2层借鉴接缝增冻）

## 背景与边界

排期 v3「轨 P·借鉴接缝 v2 增冻」：把 2026-06-30 三份外部借鉴备忘录（Stagehand / Midscene / Autonoma）review 挖出的新接缝草稿形式化成冻结 schema + 合成 fixture，解锁下游对 fixture 并行（机理同第 1 层 seams-freeze）。**只加 schema/fixture/golden + prd、不碰已冻内核 impl**（`events.schema.json` / `verdict.mjs` / `check.mjs` / `通道剖面` schema 一字不改）。走 `full` 车道（承重张力 + 凭据红线，grill 已收口，见 `proposed/GRILL.md`）。

本轮范围 = **四接缝**（承重决策 2.2 已签把 `channelDriver` 从后置接缝拉进本轮）：

1. `run-history.jsonl` / `run-metrics.json`（回放历史/回放指标）—— 确定性回放逐步执行证据 + 聚合。
2. `action-vocabulary`（动作词汇表）—— 已冻 `events.schema` action 枚举的治理投影层。
3. `failure-ledger`（失败记录台账）—— 多态裁定下游只读诊断台账。
4. `channelDriver`（通道驱动）—— 端口适配器式动作能力声明接缝。

## 冻结产物（canonical 路径）

- schema（落 `tests/_golden/schemas/`）：`run-history.schema.json` / `action-vocabulary.schema.json` / `failure-ledger-entry.schema.json` / `channel-driver.schema.json`。
- fixture（落 `tests/_golden/fixtures/seams-v2/`）：`run-history.fixture.json` / `action-vocabulary.fixture.json` / `failure-ledger.fixture.json` / `channel-driver.fixture.json`。
- golden 校验器：`tests/_golden/seams-freeze-v2.golden.mjs`（读已冻 `events.schema` 的 action 枚举作真值源，校四接缝 ⊆ 关系与不变量）。

## 验收点

- [命令] `node tests/_golden/seams-freeze-v2.golden.mjs` exit 0：四条 schema + fixture 解析为合法 JSON Schema，且关键不变量全过——
  - run-history：无 `method`/`cacheStatus`（决策 1.1/1.2）；`action` ∈ 已冻 `events.schema` 7 枚举；`intentId` 非空（决策 1.3）；`run-metrics` 无 `cacheHitRate`；反例 `passedActions < totalSteps`（`quietPointMiss`）；深扫无凭据禁字段。
  - action-vocabulary：`entries[].action ⊆ events.schema` 枚举（决策 2.1）；`source.enumPath` 指向 `events.json`；覆盖全 7 动作；web 坐标兜底恒 `false`；`failClosed` 红线（`neverSubstitute`/`neverSelfHeal`）恒 true；无 `golden` 不入表；深扫无凭据。
  - failure-ledger：三条 fail-safe `allOf`（终判 reason null / `NEEDS_HUMAN` 带子类 / `drift-healed`⟹`HARNESS_ERROR`）；`fingerprintInputs.{channel,verdict,reason,atom}` === 顶层同名；`failedAssertion` 非空 ⟺ `assertionKind` 非空；`fingerprint` 格式 `^sha256:[0-9a-f]{64}$`；深扫无凭据。
  - channelDriver：`actionSpace[].action ⊆ events.schema` 枚举（决策 2.1/Q3）；`channel==='web'` ⟹ `coordinateSpace===null`（决策 Q3 禁纯坐标步）；`profileRef` 为字符串指针或 null（决策 Q2 不内嵌 profile）；`actionSource.enumPath` 指向 `events.json`；深扫无凭据。
  - 跨接缝：`channelDriver.drivers[].driverId` 与 `action-vocabulary.entries[].driver.channelDriver` 交叉一致（决策 Q2 互链不漂移）。
- [命令] `node loop-kit/bin/gate.mjs --prd loop/prd-seams-freeze-v2.json` = GREEN；`testChecksums` 冻结 4 schema + 4 fixture + 1 golden 共 9 文件。
- [命令] `node bin/casey.mjs selftest --tier1` 无回归。

## 红基线

golden 先写、canonical 接缝文件（`tests/_golden/schemas/*` 与 `tests/_golden/fixtures/seams-v2/*`）未落时跑 → 红（缺文件）；落齐 → 绿。如实 `--red-verified`。

## 完成判据

gate GREEN + 9 文件冻结 + selftest tier-1 无回归。下游对 `tests/_golden/fixtures/seams-v2/*` 并行开发；四接缝的 `lib`/`bin` 真产出与运行期 golden 随 P5/P6/P7 真机集成走 route:human（见 `proposed/GRILL.md` §五挂账）。

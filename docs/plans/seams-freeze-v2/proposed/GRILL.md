# 接缝冻结 v2 —— 合并 grill 收口记录

> 状态：grill 收口（决策全定、术语已登记、草稿已对齐）。本文件是 `seams-freeze-v2`（full lane）grill 阶段的交付物，`contract advance grill` 指向它。
>
> 输入：`GRILL-DECISIONS.md`（决策包，含 10 条决策的陈述/选项/权衡/推荐）+ 四份 seam 草稿（`1-run-history`/`2-action-vocabulary`/`3-failure-ledger`/`4-channel-driver` 的 `{schema,fixture,grill}`）。
>
> 本轮范围：**四接缝**（承重决策 2.2 已签把 `channelDriver` 从「后置接缝」拉进本轮 co-grill）。冻结走 `full` 车道（承重张力 + 凭据红线，不满足第 1 层 `light` 的「无争议、形状已扎根」判据）。

## 一、决策收口全表

### 承重决策（人签）

| # | 决策 | 拍板 |
|---|---|---|
| 1.1 | `run-history` 的 `cacheStatus`/`cacheHitRate` 保留还是整删 | **整删**。确定性回放每步重解析定位器、回放期无解析缓存可命中；「编译产物是否复用」的溯源改归编译期字段（类比 `events.schema` 的 `compiledBy`），**本轮登记 deferred 不建**、不动已冻 `events.schema`（取 `GRILL-DECISIONS.md` 决策 1.1 方案 B）。 |
| 2.2 | `channelDriver` 是否与 `action-vocabulary` 同批 co-grill | **拉进本轮**（范围扩到四接缝）。`GRILL-DECISIONS.md` 原推荐维持推迟，人签取相反项：`channelDriver` 净新起草 `{schema,fixture,grill}`、与三接缝同批冻。 |
| 3.3 | `failure-ledger` 的 `fingerprint` 聚类粒度 | **数据契约层维持草稿**（`fingerprintInputs` 字段集合冻结、`atom`/`stepId` 分离）；聚类粒度（按失败模式 vs 用例步）与文案归一阈值 **延后到哈希函数实现阶段 route:human**，不阻塞本轮 schema 冻结。 |
| Q1（channelDriver）| 本轮冻结范围 | **四接缝一起冻**：`channelDriver` schema+fixture 进 `prd-seams-freeze-v2` 的 `testChecksums`（honor 2.2）。 |
| Q2（channelDriver）| 与 `通道剖面` 的边界 | **正交 + `profileRef` 指针**：`channelDriver` 只管能力（`actionSpace`+`call`+`coordinateSpace`+`lifecycleHooks`），transport/CDP/denylist/成功字段归 `通道剖面`，只带 `profileRef` 字符串指针、绝不内嵌 profile 字段（依据 midscene §9）。 |
| Q3（channelDriver）| `actionSpace` 动作名域 | **严格 ⊆ 已冻 `events.schema` 7 枚举**（跟随 2.1），配 Quality Gate 校验子集；`arbitrary`/`cef` 的 `tap`/`scroll`/`longPress` = 未来「改 `events.schema` 枚举 + 驱动 + golden」的显式棘轮 + route:human。 |

### 机械决策（比对已冻范式/护栏/先例即定）

| # | 决策 | 拍板 |
|---|---|---|
| 1.2 | `method` 还是 `action` | 取 `action`（跟随已冻 `events.schema`，ADR-0005 统一语言）。 |
| 1.3 | `intentId` 严格 pattern 还是 `minLength:1` | **`minLength:1`**（跟随 4/4 已冻下游姊妹接缝的一致惯例；草稿原推荐 pattern 已纠正）。 |
| 1.4 | 本接缝走哪条车道 | 取 `full`（不满足第 1 层 `light` 的「无争议」判据）。整批四接缝同一次 `full` grill 走完。 |
| 2.1 | 动作真值源钉哪 | **钉已冻 `events.schema` 枚举**（`channelDriver.actionSpace` 尚不存在、不能作锚点）；`action-vocabulary`/`channelDriver` 均配 `source`/`actionSource` 指针 + Quality Gate 校验 ⊆ 枚举。 |
| 2.3 | `action-vocabulary` 现在冻还是等 `channelDriver` | **现在冻**（纯治理文档、零 `events.schema` 改动、覆盖现有 7 动作；`driver` 字段只是 provenance 指针，与 `channelDriver` 是否落地无数据耦合）。 |
| 3.1 | `failure-ledger` 冻结范围 | **只冻 schema+fixture**；`fingerprint` 哈希函数与编译期建议通道 route:human（遵循第 1 层范式）。 |
| 3.2 | `failure-ledger` prd 落位 | **新开 `prd-seams-freeze-v2.json` 承接四接缝 checksum**；**绝不并入 `prd-p6-selfheal.json`**（护栏 #15 进程隔离 + 已核实 `verdict.mjs` 零依赖 + 第 1 层单 prd 多文件先例）。 |

## 二、术语登记（CONTEXT.md 已落）

Casey 核心域新增 6 条（grill 拍板后登记，符 `0-INDEX.md`「起草不登记、拍板才登记」）：

- **动作词汇表**（Action Vocabulary）—— 挂在已冻 `events.schema` 枚举上的治理投影层，与 `断言词汇表` 对称。
- **通道驱动**（channelDriver）—— 端口适配器式能力声明接缝，分工镜像 `动作词汇表` : `channelDriver` ≈ `断言词汇表` : `通道剖面`。
- **回放历史**（Run History）—— 确定性回放逐步落盘的第二层事实（`run-history.jsonl` + 聚合 `run-metrics.json`）；旧译名已在 CONTEXT.md 登记为弃用别名。
- **失败记录台账**（Failure Ledger）—— 多态裁定下游的只读诊断台账，血缘锚 ITIL `KEDB`/Problem Record。
- **失败指纹**（Failure Fingerprint）—— 台账的可聚类指纹，只哈希稳定已模板化字段、排除易变实例值。
- **人裁决回填**（Human Resolution）—— 台账里人经签署链路写入的裁决指针，只读审计引用非执行器。

## 三、草稿对齐（本轮已改）

- `1-run-history.schema.json`：`method`→`action`、`intentId` 改 `minLength:1`、删 `cacheStatus`/`cacheHitRate`（前一 session 已改并提交）。
- `1-run-history.fixture.json`：跟随 schema 改齐（`action`、去 `cacheStatus`/`cacheHitRate`、`_note` 重写）。
- `1-run-history.grill.md`：加拍板回填 banner + 纠正 N2 原推荐（`minLength:1` 非 pattern）。
- `2-action-vocabulary.grill.md`：加回填 banner + Q4 note 从「待二次校准」改为「本轮定案」（`channelDriver` 已同批 co-grill）。
- `4-channel-driver.{schema,fixture,grill}`：**净新起草**（承重决策 2.2）。
- `CONTEXT.md`：新增 6 术语行。

草稿自检（`scratchpad/validate-v2-seams.mjs`，accept golden 的雏形）四接缝全过：run-history 无 `method`/`cacheStatus`、反例 `passedActions<totalSteps`；action-vocabulary 覆盖全 7 动作、坐标兜底恒 false；failure-ledger 三条 fail-safe 不变量 + `fingerprintInputs` 与顶层一致 + `drift-healed`⟹`HARNESS_ERROR`；channelDriver `actionSpace`⊆7 枚举 + web⟹`coordinateSpace`null + `driverId` 与 action-vocabulary 互链；四份深扫无凭据禁字段。

## 四、交给 plan / accept 的冻结清单

**prd：** 新开 `loop/prd-seams-freeze-v2.json`（决策 3.2），单 story，`testChecksums` 冻以下 9 项：

- 4 schema：`run-history` / `action-vocabulary` / `failure-ledger-entry` / `channel-driver`（落 `tests/_golden/schemas/`）。
- 4 fixture：四接缝合成 fixture（落 `tests/_golden/fixtures/seams-v2/`）。
- 1 golden 校验器：`tests/_golden/seams-freeze-v2.golden.mjs`（由 `scratchpad/validate-v2-seams.mjs` 硬化而来）。

**golden 须校验的跨字段不变量**（schema 表达不了的）：

- run-history：无 `method`/`cacheStatus`（决策 1.1/1.2）；反例 `passedActions<totalSteps`；凭据深扫。
- action-vocabulary：`entries[].action ⊆ events.schema 7 枚举`（决策 2.1）；坐标兜底 web 恒 false；无 golden 不入表；凭据深扫。
- failure-ledger：三条 fail-safe `allOf`（终判 reason null / NEEDS_HUMAN 带子类 / `drift-healed`⟹`HARNESS_ERROR`）；`fingerprintInputs.{channel,verdict,reason,atom}` === 顶层；`failedAssertion` 非空 ⟺ `assertionKind` 非空；凭据深扫。
- channelDriver：`actionSpace[].action ⊆ 7 枚举`（决策 2.1/Q3）；`channel==='web'`⟹`coordinateSpace===null`（决策 Q3）；`driverId` 与 `action-vocabulary.entries[].driver.channelDriver` 交叉一致（决策 Q2 互链）；凭据深扫。

## 五、deferred / route:human 挂账（不静默丢）

- 编译期「编译产物复用溯源」字段（类比 `compiledBy`）—— 决策 1.1 登记 deferred，本轮不建，需要时另起编译侧字段、不占回放期接缝。
- `fingerprint` 哈希函数、模板归一规则、聚类粒度 —— 决策 3.1/3.3，route:human。
- `failure-ledger` 编译期建议通道形态、读时聚合视图（first/last seen、occurrence count）—— 决策 3.1，route:human。
- `channelDriver` 的 `arbitrary`/`cef` 真能力（`tap`/`scroll`/`longPress`/`coordinateSpace` 非 null）+ 触发的 `events.schema` 枚举棘轮；`call`/`lifecycleHooks` 真接线 —— 决策 Q3，route:human。
- 四接缝的 `lib`/`bin` 真产出与运行期 golden（如 run-history 实发逐行过 schema、verdict 进程不读四接缝的结构断言）—— 随 P5/P6/P7 真机集成，route:human。

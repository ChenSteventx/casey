# P3 备料草稿二：编译期观测现状采集计划（`tc_catalog_wf_crud`）

> 状态：**草稿**，非决策。配套草稿一（重表达清单，15 event / 4 intent 编号沿用）。
> 真值源：字段形状以已冻 `tests/_golden/schemas/observed-reality.schema.json` 为唯一真值（`additionalProperties:false`，凭据红线机制兜底）；样例形状对照 `tests/_golden/fixtures/seams/observed-reality.fixture.json`。网络面预期来自 regress 真机情报 `docs/plans/p2-intent-compile/regress-intel.md`（trace 实测）。
> 用途链：相1 编译落盘 → 相2（P4）断言草拟的地面真值 + 相4 取证背书同形消费。本文件不冻结、不进 golden。

## 1. 采集纪律（schema 之上的执行约定)

1. **时机**：每个 event 步动作后、达**静默点**（networkidle + 无动画 + DOM 稳定 K ms）才采；达不到则 `quietPointReached:false` 照实落盘，下游 route:human，绝不静默当地面真值（schema 字段注即此语义）。
2. **粒度**：逐 event（`atstep_i`）各一条 `observedStep`，回填 `intentId`/`atom` 供卷回——observed 步数 = events 步数 = 15。
3. **存实测字面量**：`urlPathnameAfter`、`cleanTitles` 里的 `atl_<实例名>` 照实存（如 `atl_目录CRUD_<ts>`），模板化是下游（P4 草拟）的活，不在采集侧做——与 fixture 的 `atl_目录CRUD_1782634443` 同款纪律。
4. **凭据红线（护栏 #7）**：`requestLog` 绝不含 body/headers/cookie/token（schema 机制兜底）；`errorEnvelope` 只记被检字段的标量 expected/actual。**遗留风险**：`url` 字段可含 query，query 串可能携 token（layer3-wiring 评审 F3 的同款教训：标量字符串照搬即泄漏）——采集侧须剥 query 或对 query 值脱敏后落盘，执行位归草稿三 G5。
5. **归因**：`initiator`/`attributedStepId` 按发起方归因、非时间窗（ADR-0007）；背景轮询记 `initiator:"background"`、`attributedStepId:null`。背景名单与信封成功字段经**通道剖面**传入（非凭据配置，`{background, successField, successValue}`），tier-2 由 site.json 非凭据子集投影。
6. `capturedAgainstBuild`：供期望版本化（`signedAgainstBuild`）对齐。Heren 中台构建标识从哪儿取（页面 meta/接口版本号/人工填）——route:human，取不到落 `null`（schema 允许）。
7. `channel`:"web"、`caseId` 与文件名 `observed-tc_catalog_wf_crud.json` 一致。

## 2. 逐步采集表（15 步）

> 网络面「预期条目」是编译期应观测到的请求（regress trace 实测），供采集器自检「该看到的没看到」——不是断言；实采以真机为准。错误信封成功判据统一 `field:"status"`、`expected:200`（ADR-0006 R6 修正，非早期 `code` 假设）。

### intent_0 进列表

| step | 必采字段要点 | requestLog 预期条目 |
|---|---|---|
| atstep_0 `nav` | `urlPathnameAfter`=列表路径（实测，预期含 `/process/list` 段）；`cleanTitles`=[列表页主标题]；`toastTexts`=[] | `GET /ai-manager/process/listProcessData` 或 `GET /ai-manager/process/queryProcess`（列表首屏拉取，两者以实测为准）；背景轮询若现→`background`/null |

### intent_1 新增工作流

| step | 必采字段要点 | requestLog 预期条目 |
|---|---|---|
| atstep_1 `click` 触发器 | 下拉浮层出现后的 DOM 态；`urlPathnameAfter` 不变 | 通常无业务请求 |
| atstep_2 `click` menuitem | 抽屉出现；`cleanTitles` 采抽屉主标题（P4 草拟 `textVisible` 的料） | 可能有表单初始化请求（如 `GET process/getCode` 编码自动生成，实测定） |
| atstep_3 `fill` 名称 | 回读值（含 `atl_` 实例名）；`cleanTitles` 含抽屉标题 | 无 |
| atstep_4 `fill` 描述 | 回读值 | 无 |
| atstep_5 `selectOption` 分类 | 选项浮层收起后回读「测试分类」；实采 scope/optionListSelector 真实选择器（反哺 events 的 `dropdownUnit`） | 无（分类枚举若为接口拉取，记条目） |
| atstep_6 `click` 确认 | **本 intent 关键步**：`urlPathnameAfter`（预期进 `/process/detail` 段——P4 草拟 `urlPathname` 的地面真值，存实测字面量、含实体 ID 也照存，下游用 `startsWith`/`matches` 绝不 `equals`）；`cleanTitles`（画布页标题 + 新工作流名）；`toastTexts`（预期「新增成功」类提示，有则采——`textVisible` 草拟料） | `POST /ai-manager/process/saveOrModifyProcess`（建，信封 status===200）；辅 `GET process/getCode`、`GET process/getProcessInfoById`；全部 `attributedStepId:"atstep_6"` |

### intent_2 保存

| step | 必采字段要点 | requestLog 预期条目 |
|---|---|---|
| atstep_7 `click` 保存 | `toastTexts`：**双向都采**——成功提示（若有）与错误 toast 候选容器实测（`.hr-message`/`[role=alert]` 等，regress `_atoms.ts:1411` 自承选择器待真机确认 R11——本步观测就是那次「真机确认」，实采结果反哺 `noErrorToast` 的探针选择器）；`urlPathnameAfter` 应仍在画布 | `POST /ai-manager/process/saveOrModifyProcessData`（保存唯一权威成功信号，信封 status===200，`attributedStepId:"atstep_7"`）；背景轮询→null |

### intent_3 收尾清理删除

| step | 必采字段要点 | requestLog 预期条目 |
|---|---|---|
| atstep_8 `click` 回列表 | `urlPathnameAfter` 回列表路径；若遇抽屉遮罩记 `quietPointReached:false`（草稿一 ⑥ 的观测面） | 列表拉取 |
| atstep_9 `fill` 搜索 | 回读搜索词（含实例名） | 无或即时搜索请求（实测定） |
| atstep_10 `press` Enter | 搜索后列表态；「删除」可点目标 count（进 P4 的唯一性证据，见 §3） | `GET /ai-manager/process/queryProcess`（搜索） |
| atstep_11 `click` 删除 | 确认对话框出现；`cleanTitles` 采对话框标题；**实采确认按钮文本**（确定/确认，反哺 events atstep_12 定位） | 无 |
| atstep_12 `click` 确认删除 | `toastTexts`（删除成功类提示） | `POST /ai-manager/process/delete`（信封 status===200，`attributedStepId:"atstep_12"`） |
| atstep_13 `fill` 重搜 | 回读 | 无 |
| atstep_14 `press` Enter | 重搜后列表态：目标行/「删除」目标 count 归 0 的观测（`countChange equals 0` 的地面真值） | `GET /ai-manager/process/queryProcess` |

全流程 `replyText`/`replyStreamUrl` 恒 `null`（本 flow 无对话流；schema 允许 null——流式维度归第二条 `chiefcomplaint_smoke`，飞轮排期）。

## 3. 计数口径对账（`countChange equals 0`，须在编译期钉死）

三方口径现不一致，编译期观测要把三者对齐、对不齐则 route:human：

- regress 原型数的是搜索隔离后「删除」文本节点 count（`_atoms.ts:849-854`）；
- Casey 回放侧 `bin/replay.mjs:32` 的计数探针写死 `.hr-table-row`（表格行数，逐 intent 前后采）；
- 已冻 expected-frozen fixture 的条目只有 `{kind:countChange, op:equals, value:0}`，不带计数目标字段。

编译期须实采：搜索隔离后表格行 count 与「删除」按钮 count 是否恒等（每行恰一个删除按钮则等价）。若等价，`.hr-table-row` 口径直接可用；若不等价（空态占位行等），计数目标的表达方式是接缝级问题（expected 条目要不要带目标选择器字段）→ 上升 G4/route:human。观测落点：schema 无计数专用字段，建议记在该步 `cleanTitles` 之外的既有字段内不可行——**照 schema 不扩字段**，计数值走编译日志与 P4 交接说明，不塞进 observed（`additionalProperties:false` 机制拦着，这是对的）。

## 4. 与相4（回放取证）的同形约定

`requestLog` 条目与 `watchNetworkForensics` 的 network 取证条目同形（schema 描述明写「相4 直接消费」）——编译期采集器应直接复用 `lib/replay-forensics.mjs` 的取证通路（CDP 真发起方归因 + 通道剖面 denylist + 信封检查），只是消费端从 axes 换成 observed 落盘。好处：归因逻辑单源、编译期顺带验一次 CDP `initiator` 在真 Heren 流量下的可靠度（ADR-0007 的推翻条件），一鱼两吃。是否复用归草稿三 G1 边界决策。

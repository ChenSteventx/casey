# zero-shot-page-execution-research

> 状态：研究与架构决策完成；只新增设计文档，不改 `lib/`、`bin/`，不接真实 SUT。
> 后续实现必须另立 `full` 契约并走 acceptance-gate。本文件中的百分比目标是 MVP 工程目标，
> 不是已经取得的结果。
>
> 完整使用工序见 `docs/runbooks/adaptive-page-execution-sop.md`；开发切片与开工顺序见
> `docs/plans/zero-shot-page-execution-research/execution-plan.md`。AI 中台连续版本漂移是第一目标，
> 医生站与 Hi 小助承担跨站/跨通道验证。

## 1. 结论

Casey 要获得「读完测试用例后，执行一个从未见过的页面」的能力，不应把 LLM 塞进日常回放，
而应在现有相1前半增加一层 **相1b 探索编译（Exploratory Compile）**：

本文的 zero-shot 精确定义是：**Casey 对该 site/page 没有现成 atom、profile selector、录制 flow
或页面记忆**。它不声称能证明基础模型训练语料从未出现过该网站；评估通过 site-held-out、
domain-held-out 与程序化页面变体尽量控制这一点。

```text
自然语言用例
  → 必要时 grill，冻结 intent/effect/identity/expected
  → 业务前置条件 setup flow
  → 已签 flow / 已登记 atom / 零 LLM 规则解析优先
  → 确定性路径证不出后才进入探索
  → 页面观察（L0）
  → 有界 affordance 候选集（L0）
  → 单步计划/grounding 提案（LLM）
  → 动作准入（L0）
  → 一次只执行一个动作（L0）
  → 静默点 + progress proof（L0）
  → 探索轨迹（candidate，非 verdict）
  → 轨迹确定性降格/蒸馏（L0；语义分组可由 LLM 提案）
  → events v2 + observed reality + identity observations（candidate）
  → 现有 draft/sign/人签
  → 现有 replay → axes → verdict → report（全程零 LLM）
```

这不是另造一套测试系统。它只补上 Casey 设计中已有、但尚未落地的 L3「真实浏览器 agent」
编译层，并复用：

- `TestCase` 与 `intentId`；
- `events.json` v2 的通用动作词汇；
- `observed-<caseId>.json`；
- 示教 `record → intake → distill` 的候选/降权纪律；
- `kind + name + code + platformId + scope` 实体身份模型；
- 现有 `replay → axes → verdict → report` 确定性热路径。

第一版的产品承诺应是「把陌生页面的一次成功探索变成可签、可重复执行的测试资产」，
而不是「每次回归都让 agent 临场发挥」。

## 2. 为什么这样设计

### 2.1 论文与官方实现给出的共同事实

| 来源 | 可直接用于 Casey 的事实 |
|---|---|
| [Mind2Web](https://arxiv.org/abs/2306.06070) | 真实网页 HTML 太大，先筛相关元素再交给 LLM 能提升效果和效率；评估必须包含 unseen website / unseen domain。 |
| [SeeAct](https://arxiv.org/abs/2401.01614) / [官方实现](https://github.com/OSU-NLP-Group/SeeAct) | 规划与 grounding 必须分层；人工 grounding 时 live task 成功潜力明显高于自动 grounding，说明主要瓶颈是「把意图落到正确物理元素」，不是多写几段思维链。HTML 与视觉联合比单一模态更合适。 |
| [WebArena](https://arxiv.org/abs/2307.13854) | 必须用可执行环境和功能正确性验证长程任务；仅看动作文本或页面表象不够。 |
| [VisualWebArena](https://arxiv.org/abs/2401.13649) | 有一类任务需要视觉信息，纯 DOM/文本观察存在系统性盲区。 |
| [WebLINX](https://arxiv.org/abs/2402.05930) | 整页输入不可承受，候选元素排序/剪枝、截图与动作历史的组合是实用路线；finetune 也不自动解决 unseen website 泛化。 |
| [AgentOccam](https://arxiv.org/abs/2410.13825) / [官方实现](https://github.com/amazon-science/AgentOccam) | 对齐、精简 observation/action space 本身能显著改善 zero-shot web agent；复杂多 agent 编排不是第一优先。 |
| [BrowserGym / AgentLab](https://arxiv.org/abs/2412.05467) / [官方实现](https://github.com/ServiceNow/BrowserGym) | 把浏览器建模为 `observation → one action → next observation`，统一 observation/action 与 trace，便于复现和跨基准评估。 |
| [OmniParser](https://arxiv.org/abs/2408.00203) | 视觉解析可补无障碍树/DOM 缺失的图标类控件，但它应是候选生成的补充，不是绕过语义身份门的坐标执行器。 |
| [Online-Mind2Web](https://arxiv.org/abs/2504.01382) | 静态/旧基准容易高估能力；live、真实、站点分散的评估更接近用户场景。 |
| [WALT](https://arxiv.org/abs/2510.01524) / [官方实现](https://github.com/SalesforceAIResearch/WALT) | 把低层交互抽象成可复用网站能力可减少步骤与 LLM 依赖。但 Casey 是 UI 测试系统，不能为了提效直接绕过 UI 调 API；可借鉴其「能力发现/工具晋升」，执行仍须覆盖被测 UI。 |
| [Test-Time Adaptation via Environment Interaction](https://arxiv.org/abs/2511.04847) | 对陌生环境，任务前有界探索其状态转移规律比盲跑更有效；Casey 可采用只读 reconnaissance 形成页级 world notes，但不把模型参数适应塞进 MVP。 |
| [WebArena-Verified](https://github.com/ServiceNow/webarena-verified) | 任务评估可使用捕获的网络 trace、类型归一和结构比较实现确定性评分；这与 Casey 的零 LLM verdict/取证归因方向一致。 |

### 2.2 对 Casey 的工程推断

1. **closed atoms 与 open web 是两层抽象。** `flow-bridge` 适合把 intent 映射到已经会编译的原子；
   陌生页面首次执行时不能假装原子已经存在。
2. **现役 `events.json` 已有通用 replay IR。** `atom` 是可选字段；`click/fill/selectOption/press/nav`
   加语义定位器本来就能表达首次探索蒸馏后的动作。zero-shot candidate 不应伪造未知 atom。
3. **原子是复用优化，不是首次执行先决条件。** 重复出现且稳定的通用 events 片段，才走
   `candidate → review → promotion receipt → registry` 晋升。
4. **首次任务成功不是 Casey verdict。** 探索 agent 只生产 candidate trace；只有签后的确定性 replay
   才能进入现有四态裁定。
5. **WALT 式 API/tool 发现不能替代 UI 操作。** 对功能 agent，API 可提高成功率；对 UI 测试，
   API 直调会漏掉页面交互缺陷。Casey 只把已发现能力当计划层抽象，仍用 UI events 落地。

## 3. 相1b 组件边界

### 3.1 `PageObserver`（零 LLM）

每一步动作前后生成可哈希的 `PageObservation`：

```jsonc
{
  "schemaVersion": 1,
  "observationId": "obs_17",
  "intentId": "intent_2",
  "urlPathname": "/agents/list",
  "title": "智能体管理",
  "frameScope": "main",
  "pageStateDigest": "sha256:...",
  "axTreeDigest": "sha256:...",
  "screenshot": { "path": "evidence/obs_17.png", "sha256": "sha256:..." },
  "quietPoint": {
    "reached": true,
    "domStableMs": 600,
    "inflightRequests": 0
  },
  "affordances": ["af_1", "af_2"],
  "identityCandidates": ["entity_cand_1"],
  "networkFacts": []
}
```

约束：

- 不把整页原始 HTML 直接喂给 LLM；
- URL 只落 pathname，query/凭据不落盘；
- screenshot 是证据附件，坐标只作展示与视觉候选生成，不作最终唯一定位；
- iframe/shadow DOM 以显式 `frameScope`/容器作用域表示；
- observation 自身不裁定成功。

实现上应同时返回：

- 可落盘、可喂模型的脱敏 `publicObservation`；
- 仅在同进程存活的 `observationAuthority`，持有真实 page/element handle 与 observation hash。

后续 admission 只接受 authority；普通 JSON 即使逐字段仿造，也不能授权浏览器动作。

### 3.2 `AffordanceCatalog`（零 LLM）

从 DOM、accessibility tree 和可选视觉解析生成有界候选：

```jsonc
{
  "candidateId": "af_2",
  "observationId": "obs_17",
  "frameScope": "main",
  "container": {
    "kind": "role",
    "role": "dialog",
    "name": "新增智能体"
  },
  "element": {
    "tagName": "button",
    "role": "button",
    "accessibleName": "确定",
    "label": null,
    "text": "确定",
    "visible": true,
    "enabled": true
  },
  "semanticLocators": [
    { "kind": "role", "role": "button", "name": "确定", "exact": true }
  ],
  "matchCounts": { "page": 2, "container": 1 },
  "bbox": { "x": 0, "y": 0, "width": 0, "height": 0 }
}
```

候选排序输入只取：

- 当前 intent 的词；
- role/name/label/text；
- 容器标题与附近字段；
- 最近 N 步动作历史；
- 可选截图裁剪。

不把隐藏节点、不可用控件、重复无容器消歧的候选放进可动作集。默认只给 LLM top-K；
K 是成本参数，不是身份门。

### 3.3 `ActionProposal`（LLM 提案）

LLM 每轮只能提出一个 typed action：

```jsonc
{
  "schemaVersion": 1,
  "proposalId": "proposal_17",
  "intentId": "intent_2",
  "basedOnObservationId": "obs_17",
  "action": "click",
  "targetCandidateId": "af_2",
  "valueTemplate": null,
  "impact": "mutation",
  "entityBindings": [
    { "role": "subject", "candidateId": "entity_cand_1" }
  ],
  "expectedTransition": [
    { "kind": "dialogCountChange", "op": "down" },
    { "kind": "networkEffect", "op": "appears", "method": "POST" }
  ],
  "stopIfUnproved": true
}
```

探索 proposal 与现役回放动作必须分清。MVP 可 canonicalize 的动作只取现役 events v2 已支持的子集：

- `click`
- `dblclick`
- `fill`
- `selectOption`
- `press`
- `nav`

`finish` 是探索控制消息，不是 event；`goBack`/`scroll` 在扩展 events/replay 前不进入 MVP。
拖拽、文件上传、新窗口、多 tab 延后。禁止模型输出 Playwright/Python/JavaScript 任意代码。
`expectedTransition` 使用独立的 exploration progress 词表和零 LLM evaluator；示例中的
`dialogCountChange/networkEffect` 不是现役 frozen assertion kind，不能自动晋升为 expected。

### 3.4 `ActionAdmission`（零 LLM，执行前）

输入：

- 当前 `PageObservation`；
- `ActionProposal`；
- TestCase 当前 intent；
- 当前 effect policy；
- entity candidate/lock；
- 剩余步数、时间、无进展预算。

输出：

```jsonc
{
  "ok": true,
  "reason": null,
  "authority": "<同进程不落盘能力句柄>",
  "canonicalAction": {
    "action": "click",
    "targetCandidateId": "af_2",
    "locator": { "kind": "role", "role": "button", "name": "确定", "exact": true }
  },
  "evidence": {
    "candidateSetDigest": "sha256:...",
    "candidateCountInScope": 1,
    "samePhysicalHandle": true,
    "identityStatus": "same",
    "effectClass": "mutation"
  }
}
```

执行前机械检查：

1. schema 闭合，action 在允许集；
2. proposal 绑定当前 observation，候选集 digest 未漂；
3. target candidate 存在、可见、可用；
4. 声明容器内语义 locator 恰一；
5. 动作前重新解析的元素与入选时物理句柄同一；
6. value 只取 TestCase 输入或批准模板，不接受页面文本注入成新指令；
7. effect 取冻结用例与已登记 atom policy，不采信模型自报 impact；未知 submit-like 控件按高影响处理；
8. 实体绑定角色满足 read/mutation/relation/destructive policy；
9. 每个非 `finish` 动作至少带一条 typed expected transition；
10. 预算未耗尽、无进展熔断未触发。

拒绝只产生具名原因，例如：

- `AFFORDANCE_NOT_FOUND`
- `AFFORDANCE_AMBIGUOUS`
- `AFFORDANCE_DRIFTED`
- `ACTION_NOT_ALLOWED`
- `EXPECTED_TRANSITION_REQUIRED`
- `ENTITY_IDENTITY_PENDING`
- `ENTITY_BINDING_REQUIRED`
- `NO_PROGRESS_BUDGET_EXHAUSTED`

拒绝时不执行动作；候选轨迹标 `pending`，由上层决定重观察、换候选或
`NEEDS_HUMAN`。Admission 不是 verdict。

### 3.5 `StepExecutor` + `ProgressVerifier`（零 LLM）

严格循环：

```text
observe → propose one → admit → execute one → settle → verify transition
```

不允许模型一次生成 N 个动作后批量执行。每步后：

1. 等现有 settle 静默点；对 SSE/WebSocket/轮询页面复用 profile 与 DOM/placeholder 稳定判据，
   不要求严格 `networkidle`；
2. 生成 next observation；
3. 跑 typed transition checks；
4. 记录本步 network attribution、page lifecycle、input/dropdown readback；
5. `proved` 才推进 intent；
6. `not_proved` 允许一次原样重观察/重定位，不允许自动把期望改掉；
7. `ambiguous` 或预算耗尽停止探索，candidate 路由人。

LLM 可基于下一 observation 重新计划，但不能自称「任务已完成」来替代 progress proof。
progress digest 只投影 route template、已满足 intent、结构化 readback 和实体 ID 等稳定状态；
整页 DOM、截图 hash、动画和计时文本只作证据，不能单独证明进展。

## 4. 探索轨迹与 canonical events 的边界

### 4.1 `ExplorationTrace` 是降权候选

```jsonc
{
  "schemaVersion": 1,
  "artifactKind": "zero-shot-exploration-trace",
  "caseId": "tc_unknown_page_1",
  "source": {
    "kind": "llm-browser-exploration",
    "signed": false,
    "replayReady": false,
    "distillRequired": true
  },
  "steps": [
    {
      "exploreStepId": "explore_17",
      "intentId": "intent_2",
      "beforeObservationId": "obs_17",
      "proposalId": "proposal_17",
      "admission": { "ok": true, "reason": null },
      "actionReceipt": {
        "performed": true,
        "samePhysicalHandle": true
      },
      "afterObservationId": "obs_18",
      "progress": {
        "status": "proved",
        "checks": []
      }
    }
  ]
}
```

它永远不能直接喂 `verdict.mjs`，也不能标 `replayReady:true`。
建议物理格式为 append-only JSONL，每一行绑定 before observation、proposal、admission、
action receipt、after observation、progress receipt 的 hash；模型 rationale 不作为权限或事实。

### 4.2 `TraceCanonicalizer`（零 LLM）

只把满足以下条件的探索步降成现役 `events.json` v2：

- admission 为 `ok:true`；
- 动作确实执行且物理目标连续；
- progress 为 `proved`；
- 有现役 events schema 可表达的稳定 locator；
- 动态值已参数化；
- frame/container 作用域可稳定重建；
- 涉及业务实体时有相应 entity binding/observation；
- 没有依赖纯坐标、模型自由代码、浏览器偶然顺序。

降格规则：

- 首次陌生页动作默认 **不写 `atom`**；`atom` 在 events v2 本来就是可选 provenance；
- MVP 只把 page-wide 唯一的 role/label/text locator 写入 `semantic`；container-only 或 iframe
  唯一在 events schema 能保真承载作用域前必须 pending，不能丢作用域后伪装全页唯一；
- 页面候选集、截图、DOM digest 等留在 exploration evidence，不膨胀热路径 events；
- 每个 TestCase intent 必须被 canonical events 覆盖，否则明确 `pending`，不得漏译；
- canonicalizer 复用 `validateCaptureFidelity` 的「每步有证据、每个事件被覆盖或 pending」原则；
- 输出仍是 candidate，继续走 `draft → sign → 人签`。

硬边界：

- exploration 的 `candidateId/catalog/admission/rationale` 只能在旁文件；现役 events schema
  `additionalProperties:false`，不得偷偷塞入；
- atom 缺省只覆盖不需要业务实体 lock 的 read/navigation/非持久表单动作；
- 业务实体 mutation/relation/targeting 的正式 v2 identity path 要求 terminal atom 已登记在
  `ENTITY_OBSERVATION_REGISTRY`，并与 kind/role/candidate/evidence step 成组关联。因此这类动作必须映射到
  已登记 atom，或先走 atom candidate → 真实复验 → 人签晋升；不能用 `atom:null` 绕过身份策略。

### 4.3 原子晋升

当多个已签用例反复出现同一稳定 events 片段时：

1. 聚类只产 `atom candidate`；
2. 候选带来源 trace hash、参数槽、requires/provides、effect class；
3. 新 atom 先有 red acceptance；
4. 实现编译器和回放专用门；
5. promotion receipt + 人签后才进 `atoms-registry.snapshot.json`；
6. 旧 generic events 继续可回放，不强制静默迁移。

这是 Casey 版本的 WALT：学习的是可审计 UI 能力，不是绕过 UI 的隐藏 API 快捷键。

## 5. 与 ID/名称双定位统一

陌生页不降低 P0 身份边界。页面元素 grounding 与业务实体 identity 是两个不同问题：

- affordance grounding 回答「点哪个物理控件」；
- entity identity 回答「这个控件对应哪个业务对象」。

### 5.1 实体候选

```jsonc
{
  "candidateId": "entity_cand_1",
  "kind": "agent",
  "name": "atl_demo",
  "code": "AGT-001",
  "platformId": "opaque-string-id",
  "scope": "sha256:...",
  "evidence": {
    "containerCandidateId": "af_card_1",
    "nameSource": "dom",
    "codeSource": "dom",
    "platformIdSource": "network-envelope",
    "sameTransaction": true
  },
  "status": "complete"
}
```

### 5.2 分阶段规则

1. 列表观察可先用 `kind + name + code + scope` 找候选集合；
2. 同名、同码、分页不完整、坏行任一存在都不能取 `.first()`；
3. 打开详情或捕获同一列表请求信封后，从平台权威读取 `platformId`；
4. DOM/name/code 与网络/详情 readback 必须在同一物理候选、同一 observation transaction 汇合；
5. 完整五元才可产 v2 identity observation/lock；
6. 无 platformId：
   - 普通页面导航可保留 `pending` 继续只读探索；
   - 业务实体 mutation/relation/destructive 一律 admission 拒绝或 route:human；
   - 绝不能因名称唯一就签成 `SAME`；
7. relation 分别要求 source/target lock；
8. mutation 后继续按同一 platformId 做 post-readback；
9. rename/code change 必须产链接旧 receipt hash 的 successor，不覆盖旧身份。

这样 zero-shot 只负责发现「平台 ID 藏在哪里」，不会绕过现有 identity authority。

## 6. LLM 与零 LLM 边界

| 阶段 | LLM | 说明 |
|---|---:|---|
| 自由文本 → TestCase | 是 | 提案，经 parseTestCase 校验 |
| intent 分解/下一子目标 | 是 | 不写 verdict |
| 候选元素筛选 | 否为主 | 确定性 top-K；可选小模型只排序，不授权 |
| 单步 action proposal | 是 | 只输出 typed proposal |
| action admission | 否 | 唯一性、容器、身份、effect、预算 |
| 浏览器动作执行 | 否 | Playwright typed executor |
| settle/progress/forensics | 否 | 机械检查 |
| 失败后的重新计划 | 是 | 仍须重新 admission |
| trace fidelity/canonicalize | 否 | 逐步证据覆盖 |
| intent 语义分组/expected 草拟 | 可用 | 只是候选，须 L0 校验 + 人签 |
| replay/axes/verdict/report | 否 | 现有铁律不变 |

## 7. MVP 分期

### M0：确定性 intent plan 与断言冻结

先复用现有 `flow-bridge → compile-gate → identity lock → draft/sign`，补它们之前的确定性规划层，
而不是另造执行器或第二套状态机：

- `lib/intent-plan.mjs`
- `lib/intent-recipes.snapshot.json`
- `compile-gate.traceStateMachine(...)` 加法 API
- `assertion-draft.projectTestCaseAssertions(...)`
- `assertion-draft.mergeAssertionSources(...)`
- `bin/draft.mjs --testcase` 内部接线

known recipe 唯一命中时锁定 atom；模型只能补零命中的 intent，不能覆盖已锁 atom。`TestCase.expected`
优先进入 draft，模型补缝只能加 pending，不能删除或覆盖 authored assertion。

### M1：观察与单步闭环

建议模块：

- `lib/zero-shot/page-observer.mjs`
- `lib/zero-shot/affordance-catalog.mjs`
- `lib/zero-shot/deterministic-resolver.mjs`
- `lib/zero-shot/action-proposal.mjs`
- `lib/zero-shot/action-admission.mjs`
- `lib/zero-shot/progress-verifier.mjs`
- `lib/zero-shot/exploration-trace.mjs`
- `bin/explore.mjs`

范围：

- web + Playwright；
- 主 frame；
- page-wide unique role/label/text；
- nav/click/dblclick/fill/select/press；
- 只读导航、搜索、表单填写但不提交；
- 已签 flow/已登记 atom/零 LLM 规则解析优先；
- 一次一动作，10–20 步预算；
- 不改现有 verdict。

### M2：轨迹、示教与双回放

- `lib/zero-shot/trace-canonicalizer.mjs`
- `lib/zero-shot/candidate-events-admission.mjs`
- `bin/explore-distill.mjs`
- 业务前置条件另产 setup-flow candidate，继续复用 registry requires/provides；
- 自动探索失败进入现有 `record → intake → distill`；
- capture 不直通 replay；
- 忠实 source candidate 经人签后独立回放；
- atom 化 distilled candidate 经人签后再次独立回放；
- 两次回放使用独立 reset/测试数据、artifact role 与 run namespace；
- 按 intent verdict、hard predicates、entity/effect/cleanup receipt 做确定性等价比较。

初次技术闭环至少一次 fresh context 零 LLM replay；受控晋升门目标三次。

### M3：实体身份与有限 mutation

- profile adapter 发现 ID readback 通道；
- v2 entity observation/lock；
- `atl_` create/update；
- relation source/target 双锁；
- mutation request platformId 前置核对；
- post-readback；
- 同一 platformId cleanup 与 absence proof；
- 同名/缺 ID/错 ID/rename successor 敌意用例。

### M4：能力/原子晋升

- 通用 events 片段聚类；
- atom candidate；
- requires/provides/effect class；
- acceptance + promotion receipt；
- registry 发布和撤销。

## 8. 验收设计

### 8.1 数据切分

至少五类，并把 warm replay 与 cold compile 分开：

1. `task-held-out-known-site`：同站不同任务，只作对照，不算 zero-shot 主指标；
2. AI 中台 `version-held-out`：旧签资产在新 build 上零 LLM 回放，测 survival 与诚实分诊；
3. AI 中台 cold compile：关闭该 build/page memory 后重新探索；
4. `site-held-out`：医生站等测试 hostname/app 不进 atom、profile selector、page memory 或 prompt 示例；
5. `domain-held-out`：业务域也不同；Hi 小助若为 CEF，列跨通道后继而非 web MVP。

MVP 不追求大榜单。先建 10 个从未写过 page adapter 的 micro-site，每站 5 个简单任务；
6 站用于开发、4 站完全隐藏，得到 20 个 site-held-out 任务；再选
WebArena-Verified/BrowserGym 的小型公开集作外部对照。页面族应覆盖：

- 标准可访问表单；
- 同文案多容器；
- 图标/视觉控件；
- 延迟挂载/SPA；
- 同名实体与网络 ID readback。

### 8.2 指标

| 指标 | MVP 目标 |
|---|---:|
| typed proposal schema 合法率 | 100% 或明确拒绝 |
| 被 admission 接受动作的目标唯一率 | 100% |
| 无 progress proof 仍继续推进 | 0 |
| 错实体 mutation | 0 |
| 未决被误写 PASS | 0 |
| candidate 轨迹的证据覆盖 | 100%（每步 covered 或 pending） |
| 已有 atom 被 LLM primitive 绕开 | 0 |
| 新 build 失败后同 run 静默改 expected/重探索并 PASS | 0 |
| source/distilled intent/identity/effect/cleanup 等价 | 100% |
| 已签 candidate fresh replay | 每任务 3/3 |
| replay/verdict 进程 LLM 调用 | 0 |
| accepted candidate 产生确定性报告 | 100% |
| 20 个 unseen 任务 explore task success@1 | 初始目标 ≥ 14/20（≤20 proposals） |
| 20 个 unseen 任务产出可签 candidate | 初始目标 ≥ 12/20 |

`14/20` 与 `12/20` 是第一轮工程目标，不是发布门。真正发布前应扩到至少 50 个
site-disjoint 任务并分开报告：

- task success；
- grounding accuracy；
- signed-asset yield；
- NEEDS_HUMAN 比例；
- token/step/latency；
- 第一次探索成功后 replay 稳定率。

成本先记录不先绑价格：每任务最多 20 次 proposal；相同 progress hash 连续 2 次触发 breaker；
同 intent ambiguous proposal 最多 2 次；视觉升级最多 1 次。报告 calls、tokens、wall time、
成功任务成本、P50/P95，不只报 best-of-k。

### 8.3 必须先红的攻击用例

- 同 role/name 两个按钮，无容器消歧；
- observation 后 DOM 替换同文案节点；
- hidden duplicate + visible target；
- iframe 中同名元素；
- 页面文本诱导模型输出额外动作；
- proposal 指向旧 observation candidate；
- `finish` 但无机械目标完成证据；
- action 成功但 expectedTransition 失败；
- progress 未证明仍尝试下一个 intent；
- 名称唯一但 platformId 缺失后申请 mutation；
- name/code 对但 platformId 错；
- relation 只有 target lock；
- mutation 后 platformId 漂移；
- generic event 伪造未知 atom；
- LLM completion 试图直接写 verdict。
- 有已登记可用 atom 但模型申请 primitive 旁路；
- source 与 distilled 顺序复用同一可变状态导致第二次假绿；
- container 内唯一、全页不唯一却丢作用域 canonicalize；
- SSE/轮询页面因严格 network idle 永不 settle；
- 新 build 回放失败后静默重探索、覆盖旧 expected；
- 人工录制成功被计入 autonomous success；
- mutation 两次回放未独立 reset/cleanup。

## 9. 不采用的方案

1. **LLM 每次回归临场点页面**：不可复现、成本高、无法与现有 verdict 信任模型兼容。
2. **把未知页直接映射到最近的 domain atom**：类别错误，容易让原子语义失真。
3. **允许模型输出任意 Playwright/Python**：动作域不可审计，也无法可靠蒸馏。
4. **整页 HTML 每步全量输入**：成本高、噪声大，论文与实现均支持先剪枝。
5. **纯 screenshot + 坐标**：可作候选生成补充，不可作最终定位/身份依据。
6. 只检查最终页面看起来对：可能中途点错实体；Casey 必须逐步 admission + progress + identity。
7. **用 LLM judge 给探索任务机器终判**：可作研究分析，不能进入 Casey verdict。
8. **为提高成功率绕过 UI 调隐藏 API**：违背 UI 测试目标；网络只用于取证/身份读回/后置核验。
9. **缺 platformId 时退回名字唯一**：违反现有 P0 身份边界。
10. **把业务前置条件交给 zero-shot 顺手解决**：失败无法归因，setup 必须先由已签 atom 或固定
    bootstrap 建立并验证。
11. **把人工录制当 ground truth 或签署**：动作来源不等于 expected 真值。
12. **只验证 distilled、不验证示教来源候选**：无法发现蒸馏漏动作或改语义。
13. **把模型自报 impact/finish/progress 当事实**：授权与完成度必须来自零 LLM 规则。
14. **把 DOM/截图 hash 变化当业务进展或缺陷**：动态页面会产生系统性假信号。
15. **held-out 偷带任务页 selector/profile/page memory**：属于评测污染，不算 zero-shot。
16. **新 build 失败后同 run 自动改 expected 再 PASS**：修复只能产独立 candidate，重新签署和回放。

## 10. 下一实现契约建议

第一张 full 契约建议叫 `intent-plan-known-atom-foundation`，先闭合最短的确定性优先链：

1. known recipe 唯一命中优先生成现役 flow mapping；
2. 模型只能补 unresolved intent，覆盖已锁 atom 明确拒绝；
3. 复用现有 `validateBridge/compile-gate` 状态机与实体角色策略；
4. name/code 参数与 `candidateId` binding 同时保留，平台 ID 仍由身份旁车读回；
5. `TestCase.expected` 确定性进入 draft/sign/frozen；
6. 不改 replay/verdict/identity runtime。

第二张才是 `zero-shot-observe-admit-step`。完整切片和纵向场景见 `execution-plan.md`；单步基础设施
GREEN 不能冒充完整产品 MVP。

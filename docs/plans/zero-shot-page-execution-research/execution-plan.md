# 自适应页面执行落地计划

> 状态：实施中。Wave 1 已完成；Wave 2 的 S1 业务前置条件 zero-SUT 纯函数与 adapter barrier 已完成，
> 受控浏览器 readback/freshness 集成取证并入 S2 接缝，下一步进入 PageObserver 与确定性 resolver。本文把研究结论与
> `docs/runbooks/adaptive-page-execution-sop.md` 转成可独立验收的开发切片。
>
> 优先级：先闭合可运行的 web 技术链，再扩安全纵深、跨通道和规模化评测。任何百分比和通过数都是
> 目标，不是当前结果。
>
> subagent 的分波次任务、文件所有权、合并顺序和回传协议见同目录 `subagent-plan.md`。

## 1. 交付目标

第一个可用版本必须证明以下完整链路，而不只证明某个 PageObserver：

```text
自然语言用例
→ 必要时 grill
→ 冻结 intent/effect/identity/assertions
→ 已有 atom 确定性优先
→ 业务前置条件 setup flow
→ 页面漂移时受限 zero-shot
→ 自动失败时人工示教
→ 示教来源候选可回放
→ 蒸馏 atom/变体
→ 蒸馏候选可回放
→ 零 LLM verdict/report
```

MVP 主通道为 web + Playwright：

- AI 中台 current build + 至少一个 version-held-out 页面变体；
- 一个同通道医生站隐藏页面作为 site-held-out；
- Hi 小助若仍是 CEF，放到跨通道后继，不拿未实现的 web 方案冒充已支持。

## 2. 第一优先与后置强化边界

### 2.1 第一优先

- 一个可运行的只读或非提交任务；
- 主 frame；
- 现役 events 可表达的 `nav/click/dblclick/fill/selectOption/press`；
- page-wide unique 的 role/label/text 定位；
- 已有 atom 优先、确定性规则解析其次、受限 LLM 再次、人工示教最后；
- 一次一动作和 typed progress；
- 示教候选与 atom 化候选各自干净回放；
- 名称 + ID 的实体硬停；
- 冻结断言和零 LLM verdict；
- 真实 AI 中台经回环入口做一次 UAT，夹具只证明实现行为，不冒充真站闭环。

### 2.2 后置强化

- iframe/shadow DOM、container-scoped locator schema；
- `scroll/goBack` 的回放 IR、上传、拖拽、canvas、多 tab；
- CEF/Hi 小助；
- mutation/relation/destructive 的陌生页探索；
- 视觉解析和坐标候选；
- 长期 page memory、自动聚类/晋升；
- 跨进程 authority、防提示注入纵深、完整 hash chain；
- 50+ site/domain-held-out 规模化评测和性能预算。

以下不是可后置安全项，而是技术正确性底线：LLM 不裁定、已有 atom 不被绕开、身份不猜、断言不在
运行后改写、capture 不直通 replay、没有干净回放不宣称录制成功、凭据与真实目标地址不进输出。

## 3. 实施顺序

每一切片单独立 `full` Loop Contract，走 acceptance-gate、红先行、异构实现评审。前一切片达到退出条件
后再进入下一切片；不要把所有 schema 和浏览器能力揉进一个契约。

### S0：确定性 intent plan 与断言冻结

建议契约：`intent-plan-known-atom-foundation`

目标：补 `flow-bridge` 前的确定性规划层，让陌生用例表述优先落到已有可编译 atom；同时把目前未进入
draft 的 `TestCase.expected/globalAssertions` 接到现有冻结链。

建议新增：

- `lib/intent-plan.mjs`
- `lib/intent-recipes.snapshot.json`
- `tests/_golden/schemas/intent-plan.schema.json`
- `tests/_golden/intent-plan-known-atom.zero-sut.golden.mjs`
- `tests/_golden/testcase-expected-draft.zero-sut.golden.mjs`

建议加法修改：

- `lib/compile-gate.mjs`：新增 `traceStateMachine(...)`，既有状态检查委托它，不复制 requires/provides；
- `lib/assertion-draft.mjs`：新增 `projectTestCaseAssertions(...)` 与 `mergeAssertionSources(...)`；
- `bin/draft.mjs`：内部增加 `--testcase`，继续使用现有 validate/sign/frozen 格式。

核心 API：

```text
buildIntentPlan({
  testcase,
  knownRecipes,
  modelProposals,
  registry
}) → {
  decisions,
  mapping,
  unresolved,
  stateTrace,
  ready
}

mappingFromIntentPlan(plan) → 现役 flow-bridge mapping
```

规则：

- recipe 只做 exact/anchored-template 匹配，不做 fuzzy 猜测；
- 唯一 recipe 命中且 atom 同时在 registry 与 compile knowledge 中，锁定为 known；
- 模型只允许补零命中的 intent；
- 模型覆盖已锁 intent 拒 `KNOWN_ATOM_OVERRIDE`；
- 多 recipe 命中拒 `KNOWN_RECIPE_AMBIGUOUS`；
- required param 缺失不产半份 mapping，进入 grill/unresolved；
- 最终 mapping 直接交现有 `validateBridge`，复用投影忠实、状态机、实体角色和破坏性前缀门。

身份不另造第二条链：规划层同时保留可读 name/code 参数和 `entityBindings.candidateId`；platformId 继续由
compile identity observation 读回并由现有 sign/runtime lock 比对，不能塞进 DOM locator 或普通 expected。

断言合并顺序：

```text
TestCase authored expected
→ compiler assertionAtoms 的确定性映射
→ unresolved pending
→ 可选模型补缝（只加法）
→ 现有 validateDraft
→ sign / expected.frozen
```

验收至少覆盖：

- 唯一 known recipe 生成现役 mapping；
- 模型覆盖 known atom 拒绝；
- recipe 多命中拒绝；
- 册内但不可编译 atom 拒绝；
- 只有 unresolved intent 接受 model proposal；
- requires 缺失时 stateTrace 点名，provider 补齐后通过；
- mapping 保留 name/code 与 candidateId binding；
- 同名但 platformId 错继续由现役 semantic lock 拒绝，不回退名称；
- TestCase authored expected 进入 frozen，模型不能删除或覆盖；
- plan mapping round-trip 通过现有 `validateBridge/buildFlow`；
- 不改 replay/verdict/identity runtime。

退出条件：zero-SUT 证明“陌生用例表述 → 已知 atom → authored expected 冻结”闭环；诚实标注这还不是
任意陌生页面能力。

### S1：业务前置条件 setup flow

状态：`precondition-atom-workflow` 合约与 zero-SUT core 已完成；受控 web adapter/UAT 未冒充完成，
随 S2 browser observer 接缝补齐。

建议契约：`precondition-atom-workflow`

目标：不再把可操作前置条件只当自然语言假设。

建议新增：

- `lib/adaptive-execution/setup-flow.mjs`
- `lib/adaptive-execution/setup-receipt.mjs`
- `tests/_golden/precondition-atom-workflow.zero-sut.golden.mjs`

第一版不修改 `TestCase.preconditions` 语义，新增候选旁车：

```jsonc
{
  "schemaVersion": 1,
  "artifactKind": "setup-flow-candidate",
  "caseId": "tc_demo",
  "steps": [
    {
      "intentId": "setup_1",
      "atom": "agent.ensurePublished",
      "requires": ["agentExists"],
      "provides": ["agentPublished"],
      "entityBindings": [{ "role": "subject", "candidateId": "agent_1" }]
    }
  ]
}
```

优先复用 `lib/atoms-registry.snapshot.json`、`compile-gate` 的 requires/provides 状态机和
`flow-bridge` 的投影忠实/实体绑定规则。

验收：

- setup 拓扑顺序稳定；
- 已满足前置条件只检查并产收据，不重复 mutation；
- 前置失败时主体 flow 不能开始；
- setup 输出的平台 ID 可被主体 entity binding 消费；
- relation 的 source/target 不允许按数组顺序猜；
- 登录继续走登录预备动作，不进入 setup atom。

退出条件：至少一个 setup atom + 一个主体 atom 在受控 web 夹具上全链执行；真 AI 中台的可用
setup atom 另做 UAT 取证。

### S2：确定性 resolver 与陌生页单步闭环

建议契约：`zero-shot-observe-admit-step`

目标：在调用 LLM 之前先覆盖可确定解析；无法确定时只允许一个 typed proposal。

建议新增：

- `lib/zero-shot/page-observer.mjs`
- `lib/zero-shot/affordance-catalog.mjs`
- `lib/zero-shot/deterministic-resolver.mjs`
- `lib/zero-shot/action-proposal.mjs`
- `lib/zero-shot/action-admission.mjs`
- `lib/zero-shot/progress-verifier.mjs`
- `lib/zero-shot/exploration-trace.mjs`
- `bin/explore.mjs`
- `tests/_golden/zero-shot-observe-admit-step.golden.mjs`

resolver 梯级：

```text
已签 flow
→ 已登记 atom 变体
→ role/label + TestCase 值 + page-wide unique 的零 LLM 规则解析
→ bounded affordance catalog 上的 LLM 单步提案
→ 人工示教
```

MVP 不实现 container-only/iframe 候选的 canonical replay；页面全域不唯一时拒绝或路由人。模型自报的
`impact`、`finish`、`progress` 不作事实：effect 取冻结用例/atom policy，完成度取 typed progress。

进展 digest 只投影稳定状态，例如 route template、已满足 intent、结构化 readback 和实体 ID；整页 DOM、
截图 hash、动画和轮询计时只作证据，不作进展事实。settle 复用现役 profile/DOM/placeholder 静默策略，
不要求 AI 中台 SSE/WebSocket 场景的严格 network idle。

验收：

- 相同 role/name 的双候选拒绝；
- hidden duplicate、DOM 替换、旧 observation、无 progress、提示注入全部拒绝；
- 已有 atom 可用时拒绝模型 primitive proposal；
- action 成功但 progress 未证实时不推进 intent；
- 模型不能写 selector/code/verdict；
- 输出始终是 `signed:false/replayReady:false` 的 candidate trace。

退出条件：受控陌生 web 页完成一次只读 `observe → resolve/propose → admit → execute → progress`。

### S3：探索轨迹到签后回放

建议契约：`zero-shot-trace-replay-closure`

目标：让一次成功探索变成真正可签、可回放的测试资产。

建议新增：

- `lib/zero-shot/trace-canonicalizer.mjs`
- `lib/zero-shot/candidate-events-admission.mjs`
- `bin/explore-distill.mjs`
- `tests/_golden/zero-shot-trace-replay-closure.golden.mjs`

只投影现役 events 能无损表达的动作和 page-wide unique locator。`finish` 只是探索控制消息；
`scroll/goBack` 在扩 events schema 前不进入 MVP。exploration 的 container/frame/candidate 元数据留在证据旁车，
不能丢作用域后降成全页 locator。

候选继续走：

```text
candidate events
→ draft
→ sign
→ fresh context replay
→ axes/verdict
```

验收：

- 每个探索动作 covered 或 pending；
- 任一 admission/progress/locator 不可重建即 pending；
- generic atomless event 不得执行正式 entity mutation；
- 签前不能 replay-ready；
- 新 build 上旧资产失败后，不得在同 run 静默探索、改 expected 并覆盖旧资产；
- re-explore 只产生独立 candidate，重新签署、重新运行。

退出条件：AI 中台一个只读任务在 current build 产候选，签后 fresh replay 得到确定性结果。

### S4：示教可回放闭环

建议契约：`teachin-replayability-closure`

目标：先证明「关窗后真的能在 fresh browser 复现」，再把它接到正式签署/回放。文件存在不等于录制成功。

#### S4a：development-only 原始复现与 atom roundtrip

当前真实缺口不能忽略：

- `record` 只产 v1 capture；
- `intake` 现要求 capture + identity sidecar + package manifest + signed driver receipt；
- 生产 `record` 尚未生成这些正式三件套/收据，因此 capture-only 会被现有 intake 正确拒绝；
- `distill` 目前 mapping 为空、每步全 pending；
- capture 不满足正式 replay schema，不能直接喂 replay。

为了先跑通技术闭环，增加显式 `developmentOnly:true/promotionReady:false` 的隔离通道，不给正式 intake/replay
开后门，也不改 capture 的 `replayReady:false`。

建议新增：

- `lib/teachin-raw-replay.mjs`
- `bin/teachin-raw-replay.mjs`
- `bin/teachin-cycle.mjs`
- `tests/_golden/schemas/teachin-raw-replay-proof.schema.json`
- `tests/_golden/record-raw-replay.zero-sut.golden.mjs`
- `tests/_golden/teachin-cycle.zero-sut.golden.mjs`

建议修改：

- `bin/record.mjs`：录制浏览器关闭、capture 落盘后，自动打开 fresh context 做原始复现；
- `lib/record-distill.mjs`：新增 resolved candidate 投影，mapped intent 删除 `route/reason`，
  pending 精确缩为 projection-minus-mapped，禁止 mapped 与 pending 相交；
- `bin/casey.mjs`：增加内部 `teachin-cycle` 接线；用户自然语言面不要求手抄命令。

原始复现规则：

- capture hash 精确绑定；
- fresh browser/fresh context，沿用同一 login mode；
- 每个动作前校验 host-safe pathname；
- nav 只作路径检查点，不能用 `goto` 修正错误路径；
- selector 投影到现有 generic replay action，只接受 `resolution=unique`；
- masked input 不能复现时明确失败；
- 首错停止，全事件消费才产 `CLEAN`；
- proof 不含 PASS/verdict，不导入裁定器。

原始复现证明候选：

```jsonc
{
  "artifactKind": "teach-in-raw-replay-proof",
  "captureSha256": "sha256:...",
  "source": {
    "kind": "fresh-browser-reproduction",
    "formalVerdict": false
  },
  "status": "CLEAN",
  "steps": []
}
```

`teachin-cycle` 只接受 exact capture hash 的 CLEAN proof，再消费 agent/LLM 候选 mapping，经过 resolved
candidate、现有 flow-bridge、compile execute 和 compile verify。输出：

```jsonc
{
  "artifactKind": "teach-in-atom-roundtrip",
  "developmentOnly": true,
  "promotionReady": false,
  "atomReplay": {
    "status": "REPLAYABLE",
    "allEventActionsUnique": true
  }
}
```

这里的 `REPLAYABLE` 只证明技术复现，不是测试 PASS；正式报告仍须进入 S4b 的 draft/sign/run。

S4a 验收：

- seq gap/duplicate、换包、ambiguous、none、action_failed、path mismatch、masked value 全失败；
- nav 仅 checkpoint，不可偷偷 goto；
- capture 仍 `signed:false/replayReady:false`；
- proof/roundtrip 全文没有 PASS/verdict/真实 URL；
- mapped intent 清掉 route/reason，unmapped 仍 route:human，mapped∩pending 为空；
- 任一步失败不进入 atom roundtrip；
- 真机只选只读/幂等链，mutation 不进 development-only M0。

S4a 退出条件：用户示教一次后，系统自动完成 fresh raw reproduction，再完成一个已有 atom 的
compile execute + compile verify；全程不把它冒充正式 verdict。

#### S4b：正式示教来源与 atom 化双回放

后继修复正式链：

- `record` 真实生成 identity sidecar、package manifest 和 canonical signed driver receipt；
- `intake/distill` 强制消费与 capture exact hash 绑定的 raw proof；
- source candidate 与 distilled candidate 分别 draft/sign/replay/verdict；
- 新增 `lib/dual-replay-equivalence.mjs` 做确定性等价；
- development-only 通道在正式链完成后删除或收窄。

两类资产使用不同 artifact role、run namespace、输出目录和身份锁 hash，共享同一 TestCase 与 expected
checksum；使用两套独立测试数据或两次 reset。

双回放不要求 event 数量相同，而比较：

- 每个 intent 的 verdict；
- terminal hard predicates；
- entity receipts；
- effect receipts；
- cleanup/absence proof。

S4b 验收：

- capture、空包、坏包、未 intake、未签全部不能正式回放；
- source candidate fresh replay 通过后才标局部 `REPLAYABLE`；
- distilled candidate 独立 fresh replay通过且等价后才标局部 `PROMOTED`；
- source/distilled 共用状态导致第二次假绿/假红的用例先红；
- 纯坐标/canvas 无法稳定投影时保留 pending；
- 人工操作来源不等于 expected 真值；
- CLI exit 与用户可见状态严格对应。

S4b 退出条件：自动探索故意失败后，用户示教一次，正式 source candidate 干净回放成功；atom 化候选
完成第二次独立回放和等价证明。

### S5：atom 变体与前置/主体全链蒸馏

建议契约：`teachin-atom-variant-distillation`

目标：把可回放示教分成 setup/action/assert，并优先映射已有 atom。

建议新增：

- `lib/teachin-segmentation.mjs`
- `lib/atom-variant-candidate.mjs`
- `tests/_golden/teachin-atom-variant-distillation.golden.mjs`

验收：

- 每个示教 event 被 setup/action/assert 覆盖或 pending；
- 已有 atom 语义一致时只产候选变体，不按页面版本新建 atom；
- requires/provides/effect/identity/assertion 任一改变时不能冒充旧 atom；
- 前置条件录制从未满足状态开始，并在主体执行前产状态收据；
- 固定 sleep 转为现役可观察 settle/readback；
- mutation 若进入后继，只允许已登记实体类型、created-in-run、平台 ID readback、独立 cleanup。

退出条件：一个完整 `setup → action → assert` 人工示教被分解，atom 化资产干净回放通过。

### S6：版本漂移与跨站验收

建议契约：`adaptive-page-execution-uat`

两套指标必须分开：

1. warm replay survival：旧签资产在 AI 中台新 build 上的零 LLM 存活率和诚实分诊；
2. cold zero-shot compile：关闭该 build 的 page memory 后重新探索的成功率。

AI 中台漂移集至少覆盖：

- DOM/容器/路由变化；
- 表格与卡片互换；
- 重复文案新增；
- portal/弹层宿主变化；
- virtual list/分页/延迟挂载；
- feature flag/A-B；
- API envelope 字段变化；
- name/code 不变但平台 ID 错代；
- rename 后 ID 保持；
- 背景请求伪装身份 readback；
- 真实 5xx 与 locator drift 的分诊。

跨站集：

- 医生站 web 页作为 same-channel hidden holdout；
- Hi 小助若为 CEF，只记后继，不报 M0/M1 支持；
- holdout 不带任务页 selector、ID endpoint mapping、演示轨迹或 page memory；
- 允许的配置只有通道、认证 bootstrap、起始页和环境 reset/health；
- 若给站点 ID adapter，必须标为 profile-known，不计完全 zero-shot。

退出条件：

- deterministic/LLM-assisted/human-assisted 三类成功率分开；
- false heal = 0；
- wrong physical click = 0；
- false machine final = 0；
- identity negative rejection = 100%；
- source/distilled evidence coverage = 100%；
- replay/verdict LLM 调用 = 0；
- 真 AI 中台与医生站均有真实回放证据，不用夹具数字冒充。

## 4. MVP 纵向场景

第一条端到端场景选择 AI 中台只读实体定位，避免在探索内引入 mutation：

```text
原始用例：
  打开指定名称和平台 ID 的智能体，确认详情页可打开。

grill：
  补名称、平台 ID、环境和“可打开”的硬断言。

setup：
  登录预备动作；
  agent.ensureExists 只检查并产身份收据。

主体：
  已登记 agent.searchOpen 优先。

漂移：
  在 version-held-out 页面变体上让旧 locator 失效；
  deterministic resolver 失败后才给 LLM 一个 typed proposal。

自动兜底：
  成功则产 candidate → sign → fresh replay。

人工兜底：
  故意提供一个自动不可解但可语义录制的变体；
  record → intake → distill → sign → source replay；
  再映射 agent.searchOpen 候选变体 → sign → distilled replay → equivalence。

裁定：
  两条签后回放均走现役 axes/verdict/report。
```

这条场景跑通后，再增加一个 setup mutation（例如 created-in-run 测试实体）和 cleanup，而不是一开始同时
实现工作流关系、发布、删除、CEF 和视觉 grounding。

## 5. 工件与版本归因

探索/蒸馏 provenance 需要记录但不进入 verdict：

- SUT build 引用；
- channel/profile digest；
- identity profile digest；
- observer/catalog/proposal schema 版本；
- prompt template hash；
- model reference 与推理参数；
- TestCase 与 expected checksum；
- source/distilled artifact role 和 run namespace。

不记录认证信息、真实目标地址、原始网络 body、query 或填写明文。

page memory/world notes 的缓存键至少绑定 channel、scope fingerprint、build/profile digest 和 route template；
build/profile 变化即失效。held-out 评测强制关闭 memory。

## 6. 开工顺序与并行边界

首轮建议三线并行、主线合拢：

1. 决策/断言线：S0；
2. 浏览器单步线：S2 的 observer/catalog/admission；
3. 示教回放线：先为 S4 写现状差距金牌，不改现役 capture 纪律；
4. 主线负责 S1 接 states/requires/provides，并在三线接口冻结后串 S3/S4。

不能并行修改的热点：

- `tests/_golden/schemas/events.schema.json`；
- `lib/atoms-registry.snapshot.json`；
- `bin/replay.mjs`；
- `bin/casey.mjs`；
- `CONTEXT.md`。

前两轮尽量新增模块和测试；只有接口证明不足时，后继契约才修改热点。

## 7. 立即下一步

1. 以本计划和 SOP 作为 grill/plan 输入；
2. 新立 `intent-plan-known-atom-foundation` full 契约；
3. 使用 acceptance-gate 冻结 S0 intent-plan、state trace、known-atom override 和 authored expected 红测试；
4. 并行立 S2/S4 的只读现状评估，先锁真实缺口，不提前改实现；
5. S0 转绿后启动第一条 AI 中台只读纵向场景；
6. 真实 SUT UAT 只经回环入口，测试环境细节和凭据不进文档/日志；
7. 每个切片只宣称自己的退出条件，不能把基础设施 GREEN 冒充整个 zero-shot 产品完成。

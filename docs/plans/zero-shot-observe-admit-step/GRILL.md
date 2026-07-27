# zero-shot-observe-admit-step — GRILL

## 用户已确认的方向

1. 已有 atom 和确定性能力必须优先；只有无法确定、语义模糊时才交给 LLM（大语言模型）；
2. 用例描述模糊时先 grill，改写为详细、可编排的 atom workflow；
3. 业务前置条件先由 setup atom workflow 完成并取证，失败时主体步骤不得开始；
4. 名称/编号用于发现目标，平台 ID 用于确认业务实体；两者不能互相冒充；
5. 自动失败后允许人工示教，随后做原始回放、atom 蒸馏和蒸馏后回放；
6. 优先闭合可运行技术链，安全纵深后置；零 LLM verdict、身份硬停、断言冻结和凭据红线不后置；
7. 模块应解耦，生产核心文件不得超过 600 行；S1 的既有超长文件也要检查和拆分。

## 本契约裁定

- 本轮契约为 `full`，闭合主 frame、只读、一次一动作的
  `observe → resolve/propose → admit → execute → progress`。
- 现有 `TestCase.steps` 没有结构化 target/effect，不能直接授权 primitive action。新增 grill 后确认的
  `zero-shot-step-contract` 旁车，冻结 `action/target/effect/expectedProgress`；模型不得提供或覆盖这些事实。
- MVP 只允许 `effect:"read"` 和 `action:"click"`。fill/select、提交、mutation、relation、destructive
  一律 `route:human`，后继契约再开放。
- zero-shot 资格只来自现役 `buildIntentPlan` 铸造且未被改写的 plan authority；手造/clone plan 不能授权。
  该 intent 已有任何 known/model mapping 时必须走现有 atom；
  `KNOWN_RECIPE_AMBIGUOUS`、`MISSING_REQUIRED_PARAM`、`ATOM_NOT_COMPILABLE`、`BRIDGE_REJECTED`
  也不得偷退 primitive。只有零 recipe 的 `MODEL_PROPOSAL_MISSING` 可在 grill 冻结单步契约后进入。
- 页面物理控件使用 `affordanceId`；现役 `entityBindings[].candidateId` 仍是业务实体内部 join id，
  platformId 仍只来自身份观察/semantic lock。三者互不转写。
- main frame 全页 exact role/label/text 唯一才允许确定性解析。hidden/disabled 同语义项也进入歧义计数；
  container-only、iframe、shadow DOM、nth、CSS/XPath、坐标都不在 MVP。
- intent plan、step contract、resolution/proposal、PageObservation（页面观察件）、admission、
  action receipt 与物理 ElementHandle 都由进程内 WeakMap authority 绑定；JSON clone、
  旧 observation、DOM replacement、新 observation 后的旧句柄全部不能授权动作。
- 复用现役 `settleBeforeCapture`；`settled:false` 可以产降权观察证据，但不能执行动作。SSE/背景轮询
  不要求严格 network idle。
- LLM 只能在 bounded affordance catalog 中提一个 `{observationId, intentId, targetAffordanceId, action}`；
  禁 selector、代码、impact/effect、finish/progress、expected 和 verdict。
- action 返回成功不等于 intent 完成。只有 step contract 冻结的 typed progress 在 fresh after
  observation 中被机械验证，intent 才能推进。
- exploration trace 恒 `signed:false/replayReady:false`，不得出现 PASS、verdict 或 passes。
- 所有新增/修改的 S1/S2 生产核心文件逐文件 `<=600` 行；依赖保持单向，浏览器适配、纯解析、
  admission、executor、progress、trace 分文件。

## 本契约不做

- 不修改 `bin/replay.mjs`、`lib/replay-actions.mjs`、`lib/compile-atoms.mjs` 或 verdict/report；
- 不把 zero-shot candidate 直接写成正式 events，不签署、不宣称 replay-ready；
- 不支持正式实体 mutation/relation/destructive；
- 不支持 iframe/shadow/container-only、视觉 grounding、坐标、滚动、goBack、多 tab 或 CEF；
- 不把 adapter double/fake page 称为真实浏览器或 SUT 完成；
- 不宣称 AI 中台 current build、version-held-out、医生站或 Hi 小助已完成 UAT；
- 不访问 `.auth/`、`site.json`、真实目标地址或认证信息。

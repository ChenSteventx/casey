# SOP 与执行切片缺口审查

> 方式：三个并行只读审查；未访问真实 SUT、浏览器或凭据，未修改实现。

## 1. 架构审查结论

- 完整 SOP 不能从 TestCase 直接跳到 LLM PageObserver；必须先 grill、冻结 effect/identity/expected、
  编排业务前置条件，并按已签 flow、已登记 atom、零 LLM 规则、受限 LLM、人工示教逐级升级。
- AI 中台 warm replay survival 与 cold zero-shot compile 必须分开；旧资产失败后不得在同 run
  静默重探索、改 expected、覆盖旧资产再 PASS。
- source/distilled 双回放需要独立 artifact role、run namespace、测试数据/reset 和身份锁 hash，
  等价比较 intent、identity、effect、terminal predicates 与 cleanup，不比 event 数。
- container/frame 唯一性目前无法保真进入现役 events；`finish` 不是 event，`scroll/goBack`
  在扩回放 IR 前不得宣称可 canonicalize。

## 2. 确定性优先接缝审查结论

- 现有 `flow-bridge` 已复用可编译 atom、`compile-gate` 状态机和实体角色策略，但 mapping 全由外部模型给，
  缺 known-atom dominance。
- 最小实现是在 `flow-bridge` 前新增 `intent-plan` 与少量 exact/anchored recipe；模型只补 unresolved intent。
- `TestCase.steps[].expected/globalAssertions` 已存在，但当前 draft 主链没有直接消费它们，是断言冻结的
  第一优先真缝。
- name/code 用于可读定位参数，`candidateId` 用于 Casey 内部 join，平台 ID 继续走现有 identity
  observation/lock；不能把平台 ID 塞进 DOM locator 或普通 expected。

## 3. 示教回放接缝审查结论

- 生产 `record` 当前只产 v1 capture；正式 `intake` 已要求 identity sidecar、package manifest 与
  canonical signed driver receipt，因此 capture-only 会被正确拒绝。
- `distill` 当前 mapping 为空且全 pending；capture 本身也不满足正式 replay schema。
- 为优先跑通，先建立显式 `developmentOnly:true/promotionReady:false` 的 fresh raw reproduction +
  atom compile/verify roundtrip；capture 仍不可 replay-ready，证明中不出现 PASS/verdict。
- 后继再补正式录制三件套、signed intake、source/distilled 两次正式回放与确定性等价，并收窄
  development-only 通道。

## 4. 对计划的具体修订

- 第一张实现契约改为 `intent-plan-known-atom-foundation`；
- 第二张才做 `zero-shot-observe-admit-step`；
- 示教切片分 S4a 技术复现和 S4b 正式双回放；
- MVP 限 web、主 frame、page-wide unique、只读/非提交任务；
- 医生站作为 same-channel holdout，Hi 小助若为 CEF 后置；
- mutation 进入后继时必须有独立 reset/unique namespace/cleanup。

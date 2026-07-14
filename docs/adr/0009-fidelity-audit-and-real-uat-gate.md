# ADR-0009：fake-sut 保真审计 + 真机 UAT 升为必过完成闸

- 状态：已接受（Steven 2026-07-14 拍板，选项甲）
- 日期：2026-07-14

## 背景

2026-07-14 真机跑 `tc_wf_publish_states`：hermetic 金牌全绿、真机却判 `NEEDS_HUMAN`——`intent_1` 断言创建工作流后「发布/保存」按钮 present，实测 actual=0。视觉 + `run-history` 交叉核实定性：**不是用例过时、也不是平台缺陷，是 fake-sut 未建模真平台的「页面加载中」延迟挂载**——回放侧代表步静默点在编辑器挂载完成前就采按钮、数 0（`atstep_8` 1.5 秒后成功唯一点中「发布」为铁证）。

根因有二，都不是「用了假环境」本身：
1. **保真缺口**：fake-sut 场景没复现真平台的接缝行为（SPA 路由延迟挂载、加载占位），故假绿掩盖了真机才暴露的计时问题；
2. **假绿被当完成**：hermetic gate 绿被当作完成信号——正是护栏 #16「gate 绿 ≠ 完成」要防的，今天真兑现。

Steven 明确「所有假环境须换正式环境」。字面执行（全弃 fake-sut、金牌直打真机）会推倒确定性内核：金牌变非确定性、依赖凭据+隧道、只能 route:human，Test Ratchet 棘轮与 gate/CI 地基整个塌，违 ADR-0007 双层设计。评审后取**选项甲**：不删假环境，而是治其保真缺口 + 堵假绿当完成。

## 决策

1. **hermetic golden 留作确定性内核不动**：ADR-0007 双层（tier-1 hermetic 假 SUT 证内核自洽 / tier-2 真机 UAT 证用户价值）继续有效；假环境是 gate/Test Ratchet/CI 的确定性地基，其价值取决于保真度，故治保真而非删除。
2. **fake-sut 保真审计（新增机制义务）**：每个 fake-sut 场景须对真机采样核对，不符则修 fake 复现真接缝（或修实现）。`tc_wf_publish_states` 的延迟挂载是第一个已知缺口（由 `replay-settle-mount` 契约的回放侧有界静默点修复）。审计产物：每场景一条「对真机采样核过、复现了哪条真接缝」的台账。
3. **真机 UAT 升为必过完成闸**：每条回放用例的完成定义 = hermetic gate 绿（必要非充分）**且** 真机 UAT 人签通过。gate 绿不再等于完成（护栏 #16 从散文升为流程强制）。落地依托 loop 双 profile 改革的 `gate live` 层（结构化真机 UAT 证据、绝不由机器测试自动翻绿），不另造第二套机制。
4. **保真审计与真机闸不弱化任何内核铁律**：裁判零 LLM、fail-safe 不 fail-open、冻结棘轮、凭据边界、人签门一字不让；真机采样只许 autotest 账户（Steven 禁令），凭据不进任何输出。

## 后果

- 收益：假绿不再被当完成；假环境保真度有台账背书，「hermetic 绿 + 真机人签」双证才算数；确定性内核、Test Ratchet、CI 全保留。
- 代价：每条用例多一道真机 UAT 必过闸（route:human，需 Steven 在场 + 隧道 + autotest）；保真审计是一批契约工作量（每修一个 fake 场景是 full 契约、碰冻结面须重签）。
- 兑现关系：升级护栏 #16 为流程强制（`gate live` 必过）；与 loop 双 profile 改革 `gate live` 层合流；ADR-0007 双层不变、只加保真审计义务与完成闸强制。
- 教训入记忆 [[dont-hastily-call-stale-cross-check-timeline]]：NEEDS_HUMAN 别急判过时；假绿掩盖真缝的根因是保真缺口，不是「用了假环境」。

# intent-plan-known-atom-foundation — GRILL

## 已确认决策

用户已确认并要求开工：

1. 能确定的直接执行，只有可约束的不确定性才交给 LLM；
2. 已有 atom 必须优先，模型不能绕开现有能力自行点击；
3. 模糊用例先 grill，再改写成易编排 workflow；
4. 业务前置条件后继编排成 atom workflow；
5. 断言在执行前明确，模型不能根据运行结果移动目标；
6. 名称负责发现，编号/平台 ID 负责身份确认；
7. 优先完成技术闭环，复杂安全强化后置，但不取消零 LLM verdict、身份硬停和凭据红线。

## 本契约边界

本契约只闭合：

```text
归一 TestCase
→ known recipe 确定性匹配
→ intent plan
→ 现有 flow-bridge/compile-gate
→ TestCase authored expected 进入 draft
→ 现有 sign/frozen 边界
```

本契约不实现：

- PageObserver、affordance catalog 或浏览器 zero-shot；
- 前置条件 setup flow；
- 人工录制回放；
- 新 atom 自动晋升；
- 真实 AI 中台、医生站或 Hi 小助 UAT；
- 自动签署或修改 verdict。

## 不可让渡边界

- 模型只补 unresolved intent；
- known intent 上的模型覆盖明确拒绝；
- requires/provides 复用现有 compile-gate 状态机；
- 平台 ID 继续走 identity observation/lock，不进入 DOM locator；
- authored assertion 先于 compiler assertion 和模型补缝；
- 模型补缝只能加法，不能删除或覆盖 authored assertion；
- 实现前先冻结红测试。

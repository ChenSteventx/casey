# precondition-atom-workflow — GRILL

## 已确认决策

用户已确认：

1. 用例有业务前置条件时，先把前置条件改写为 atom workflow 并完成，再执行主体步骤；
2. 描述不清时先 grill，冻结成可编排 workflow；
3. 能确定的直接执行，不确定或歧义才路由模型或人工；
4. 已有 atom 必须优先，模型不能绕开现有确定性能力；
5. 名称/编号用于发现，平台 ID 用于确认目标身份；
6. 优先跑通技术闭环，后置安全纵深，但不取消零 LLM verdict、身份硬停和凭据红线。

## 本契约裁定

- 不修改 `TestCase.preconditions` 的既有语义；新增 setup candidate/plan/receipt 旁车。
- setup 的 requires/provides/removes 真值只来自 atom registry，candidate 自报值只能校对，不能授权。
- 登录继续走 Login Bootstrap（登录预备动作），`login` atom 不进入 setup flow。
- setup 与主体之间有硬 barrier（阶段屏障）：setup 执行、状态 readback 和 receipt 任一失败，主体执行函数
  零调用。
- setup receipt 不内联、不复制、不另铸平台 ID；只引用同一 compile run 的 identity observation。
- “同一 run”由 barrier 在 setup 执行前签发一次性 execution challenge 并要求 evidence 回绑；只靠可重建
  receipt digest 不算同 run 证明。
- 主体 mapping 仍只携 `candidateId + role`。运行期可以从唯一观察行投影平台 ID，但该投影不是第二份
  Entity Identity Receipt（实体身份收据），不能独立签署或授权。
- 已满足状态只有在确定性 probe/readback 有证据时才允许跳过 mutation；TestCase 的自然语言前置声明
  本身不算运行时满足证据。

## 本契约不做

- 不实现陌生页面 PageObserver 或 LLM 单步提案；
- 不实现人工录制回放或正式 record intake；
- 不改 verdict/report；
- 不支持跨 compile run 复用 setup receipt；
- 不自动选择多个 provider；
- 不擅改人签实体动作策略；现役 `workflow.create`、`workflow.open` 的 `subject/source` 角色冲突在规划期
  具名 `route:human`，不得先执行或换夹具掩盖；
- 不承诺 AI 中台、医生站或 Hi 小助真实环境已完成 setup UAT。

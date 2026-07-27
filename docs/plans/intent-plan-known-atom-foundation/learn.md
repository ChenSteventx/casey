# intent-plan-known-atom-foundation · learn

> 状态：Wave 1 已按冻结验收闭合；实现评审结论为 `PASS_WITH_FIXES`。

## 交付结果

完成三条确定性主干：

1. known recipe 优先生成现役 flow-bridge mapping，模型只能补未知 intent；
2. compile-gate 以同一状态机同时产 problems 与逐步 state trace；
3. TestCase authored expected/globalAssertions 进入 draft，compiler 与模型只能幂等加法。

名称/编号参数用于发现和编排，`candidateId` 用于 Casey 内部 join；平台 ID 仍沿现有 identity
observation/semantic lock 读回确认，没有另造身份链。

## 沉淀

1. known dominance 必须连配置错误一起 fail-closed：坏 recipe、坏 proposal、多命中、缺参和不可编译
   atom 都不能退化成“交给模型试试”。
2. 诊断信息应来自执行闸本身：state trace 委托同一状态机，不能复制 requires/provides 规则，否则
   页面高频变化时两套语义会先漂。
3. authored assertion 的不可覆盖还不够，patch 也必须幂等：只允许加法仍可能用重复项放大结果；
   精确结构去重是最小确定性约束。
4. 评审意见也要过冻结契约：真实缺陷应修；与已确认语义冲突或建立在代码误读上的建议不能因来自
   外部模型就直接采用。
5. 阶段能力要诚实命名：Wave 1 是 intent plan 基础，不是浏览器 zero-shot。exact recipe 覆盖率、
   setup flow、陌生页观察和示教回放必须各自取证。

## 后继

按自适应页面执行计划进入：

1. S1 业务前置条件 atom workflow；
2. S2 页面观察、确定性 resolver 与受限单步 proposal；
3. S3 人工示教 capture 的全新浏览器上下文 raw reproduction；
4. source/distilled 两份候选各自干净回放后，才允许进入正式 intake/晋升。

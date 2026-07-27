# entity-rename-unknown-action-guard · learn

> 状态：六阶段闭合；Grok 4.5 异构评审 PASS。该后继只关闭 C4 的
> `unknown + nav` 生产旁路，不替代原 C4 人签与真机完成闸。

## 交付结果

生产 replay 事件环在 nav / 非 nav 分叉以及该事件的任何页面动作之前调用
`unknownAtomRejection(ev)`。未知字符串原子统一写入
`action_failed/UNKNOWN_ATOM`，不再进入导航或业务动作分支；真实零 LLM verdict
对该拒绝轴只产 `NEEDS_HUMAN`，不能 `PASS`。合法原子仍走原路径。

## 教训

1. **闭集守卫应放在所有动作类型分叉之前。** 只在业务动作 dispatcher 里拒绝未知
   原子，会让单独实现的 nav 分支形成旁路。共享前置判据比在每个分支复制闭集可靠。
2. **“标记顺序正确”不等于“控制流 containment 已证明”。** 本轮生产结构经异构
   brace walk 确认正确，但静态金牌仍有结构性 fake-green 余量。事件环下次改动时，
   应优先补 balanced-brace / AST containment 或抽取纯调度核后的 mutation 反控。
3. **拒绝动作不等于停止所有只读取证。** 命中后跳过的是该事件的导航与业务副作用；
   后续断言采样仍可运行并为 fail-safe 裁定提供证据。这与“未知事件不得执行动作”
   不冲突。
4. **后继契约不能吞并原契约的人签债。** 原 C4 仍是 4/6；冻结措辞、候选晋升、真机
   负向回放及 rename → successor 正向能力继续 route:human，本契约的 6/6 只代表
   可机器验证的旁路封口。

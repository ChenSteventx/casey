# entity-c0c2c3-p3-reconcile：C5 组合树调和

状态：Steven 已确认 D1–D4；实现与门禁已完成，Grok TUI `code-review` 复审 `APPROVE`。

## 已证事实

1. 集成树 `integration-entity-c0c2c3@72d6540` 的 `p3-compile` 只有 C5 红，其余 14/15 已在上一轮组合树实跑通过。
2. C5 要证明的义务是：`workflow.deleteByName` 的入口可证缺席时，不落该原子事件，记录 `CASE_DEFECT` 候选且继续编译。
3. C5 当前把 `FLOW_GOOD` 四步整体展开后再追加 `workflow.deleteByName`。因此它在删除义务之前还执行 `workflow.create`、两个断言和 `workflow.save`。
4. C3 为删除步新增 `workflows.listApi` 结构声明后，C2 会同时武装 `workflow.create` 的 source 读回。夹具没有对应平台读回信封，所以在到达删除步之前 fail-closed。
5. 给夹具伪造 source 信封不是合法修法：C2 已诚实挂账 `workflow.create` 的观察角色 `source` 与现行准入角色 `subject` 不一致，不能用测试数据绕过该人签边界。
6. `compileWorkflowDelete` 在入口 `count===0` 时先回滚该原子全部事件、记录候选并返回；不会进入目标连续性 ref 铸造或任何删除动作。

## 决策

### D1：C5 夹具只携被证原子

新增纯数据构造件 `tests/_golden/support/p3-compile-c5-flow.mjs`，产出的 C5 flow 恰含一条 `workflow.deleteByName`，保留：

- `sourceIntentId=intent_cleanup`；
- 恰一 `subject` 绑定；
- 唯一名前缀参数 `atl_{{uniqueName}}`；
- 原 C5 的 flow id/name/category。

`FLOW_GOOD`、C4 happy path、C6/C7 回放接缝均不改。

### D2：保留 C3 的浏览器前结构准入

C5 继续使用声明 `workflows.listApi`、`itemContainer` 与 `cardFields` 的 `profDelFile`。因此删除 flow 仍须通过 C3 的身份通道结构准入；本轮只移除与 C5 无关的 `workflow.create` 前置执行，不删除、不放宽任何生产门。

### D3：不伪造观察，不改生产码

本轮不新增 source 读回信封，不改变 `workflow.create` 的 `source`/`subject` 角色策略，不修改 `lib/` 或 `bin/`。角色冲突继续留在 C2 的 `route:human` 账上。

### D4：证据分层

- 新增零 SUT 金牌，直接断言 C5 flow 只有删除步、绑定闭合，且对 `admitCompileDestructiveContinuity` 呈现“无 workflow 通道拒绝、有 workflow 通道放行”的结构语义。
- 复跑 C3 已冻结的浏览器前结构准入金牌；它用 launch 哨兵在浏览器前退出，不连接 SUT。
- 对变更后的 `p3-compile.golden.mjs` 做语法检查与异构静态评审。
- `p3-compile.golden.mjs` 会启动 fake-SUT，按本 session 的 Casey 执行边界不运行；其 15/15 组合树复跑列为 `route:human`，没有实跑就不声称全绿。

## 明确不做

- 不把 C2 的 source 读回失败改判为成功。
- 不把 C5 期望改成 exit 65；那会丢失原本“入口缺席产生候选并继续”的义务。
- 不让 `FLOW_WITH_DELETE` 继续携带无关创建步骤。
- 冻结测试只在红基线与评审发现的明确边界内走 owner `checksumAmendments`；`passes` 只由 gate 写入，不碰人签件。

## 落地结果

- C5 改为契约默认的 `workflow.deleteByName` 单步夹具；support 同时由调和契约与 P3 owner 校验和钉住。
- 组合树复跑另暴露 C3 金牌的 pipe 捕获缺口：行为半边一直是 exit 65 + launch 哨兵缺席，但具名诊断为空。金牌改为直驱真 `bin/compile.mjs`，stdout/stderr 直写临时文件描述符后读取，保留并通过全部 reason 断言，现为 3/3。
- 调和 gate 在真机执行层 2/2；P3 与 C3 owner 棘轮/术语 dry-run 全绿。full `p3-compile` 15/15 未启动 fake-SUT，仍诚实登记 `route:human`。

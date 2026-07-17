# teachin-runtime-readiness-successor — plan（full）

> 本契约接续 `teachin-runtime-nonvacuous-readiness`。旧冻结测试、固定语料和 PRD 全部保持逐字节不变；本轮用独立 successor（后继）门禁修复两项异构评审 `HIGH`。

## 1. 已核事实

1. `readEntityRuntimeReadiness` 只检查受信运行驱动表是否非空和一个布尔占位；它没有联合检查可读的运行发布、动作身份 policy（策略）以及真能写入 `RUN_CONTEXT_STATE` 的运行上下文签发者。后续只要翻开两个占位，就可能出现 `available:true` 但仍不能建立锁 authority（权威）或运行能力的伪就绪。
2. 生产发布清单清空测试路径是正确的 `fail-closed`（故障关闭）动作，但旧 `teachin-semantic-lock-runtime-authority` 金牌由父提交的 `9/9` 变为当前 `3/9`：历史 handle（句柄）和四组动作角色负向检查在进入 verifier（验证器）前即因未发布返回。新门禁又允许“条目未发布”或空表直接通过，形成结构性覆盖缺口。
3. 调用者输入的 getter（取值器）/`Proxy`（代理对象）仍必须一次性快照；普通对象、伪能力或测试驱动不得进入生产受信注册表。

## 2. 目标

### 2.1 四根联合派生运行期就绪

- 公开纯决策器，四根分别为：至少一个具体且可调用的受信运行驱动；至少一个非空且摘要可读的 `runtime` 发布；该发布的非空且摘要可读动作身份 policy；至少一个具体且可调用、经模块内唯一写入口写入 `RUN_CONTEXT_STATE` 的运行上下文签发者。
- 只有四根同时成立才返回 `available:true`；任一根缺失均返回 `available:false`、`route:'human'` 和稳定原因。
- 生产 `readEntityRuntimeReadiness` 只把模块内部事实传给纯决策器，忽略任何调用者参数。纯决策器只返回诊断状态，不签发 adapter（适配器）、run context（运行上下文）、authority 或 capability（能力）。
- 删除布尔签发者占位，改为具体受信签发者注册表与真实可调用签发入口；生产表本轮保持为空，不为转绿发布假驱动或假签发者。

### 2.2 非生产固定语料恢复安全覆盖

- 新金牌在临时隔离根内复制生产模块，并把既有冻结字节安装为临时 `release/entity-semantic-lock/` 资源；临时 publication（发布条目）只存在于测试副本，绝不进入生产发布清单。
- 非空 `historical` 发布必须建立 `runtimeAuthorized:false` 的真实验证 handle；`evaluateEntityAction` 与 `createRunSuccessorProof` 均先返回 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED`。
- 四组动作身份 policy 负向固定语料继续真正进入 `verifyRequiredActionRoles`：关系动作缺 source（来源对象）、缺 target（目标对象）、变更动作缺 subject（主体对象）、未知 role（角色）均拒绝。
- 新金牌不得注册 fake driver（假驱动）、fake run（假运行）、假被测系统、浏览器、服务或网络。

## 3. 验收点

### 可命令化

1. `readiness-roots`：四根 16 种组合只有全真可用；getter/`Proxy` 输入不产生二次读取；生产入口忽略调用者伪事实，并在当前空受信根下明确 `DRIVER_NOT_PUBLISHED`；未发布签发者不能产生运行上下文。
2. `historical-and-roles`：隔离发布中的 historical handle 非空执行降权；evaluate/successor 以专门原因先拒；四组 source/target/subject/未知角色负向语料均到达动作角色验证器并拒绝。

### 可观察性申报

- `route:human`：真实驱动、真实运行发布、真实动作身份 policy 与真实运行上下文签发者四根在同次真机运行共同取证；唯一匹配得到 `SAME`，真实变更后建立同源 successor，并附录屏、视觉复核、独立 HTML 与附件。
- `route:human`：旧冻结 `teachin-semantic-lock-runtime-authority` 的当前 `3/9` 属结构性红，保留原文件不改；待独立 supersession（取代）契约决定旧命令的最终迁移或退役，不把本轮 successor 金牌冒充旧金牌恢复为绿。

## 4. 非目标与停止条件

- 不向生产注册表加入测试驱动、测试签发者、测试 publication 或测试固定语料。
- 不修改任何已有冻结测试、固定语料或 PRD；新测试可只读复用其字节，并在本轮 PRD 再次登记 checksum（校验和）。
- 不启动或连接任何被测系统、假被测系统、浏览器、服务或网络；只运行静态、schema（模式）和纯函数金牌。
- gate 提交前，新功能验收必须真实为红；回归保护项允许冻结时即绿。实现阶段只能手改生产代码，PRD 的 `passes` 与 evidence（证据）只允许质量门禁回写。

# GRILL · p9-created-workflow-cleanup-continuity-v3

> 定案对象：P9 三条 created-in-run workflow 用例的 v3 删除连续性 successor。
> 本纪要只确定计划边界，不表示实现、换签或真机闭环已经完成。

## 一、已证事实

1. 现役三例没有可证明「本轮创建、本轮删除」的完整生产链；旧删除先例不能覆盖当前件。
2. `destructiveContinuityByStep` 的既有 fail-closed 骨架不能凭空得到本轮 observation；缺 ref 时拒绝是
   正确行为，不能为了跑通而关门。
3. `workflow.create` 当前存在 source 观察与 subject 准入角色冲突，happy path 结构不可达。
4. 三例周期运行若继续使用默认固定 `r1` 名称，会把上轮残留与本轮对象混在一起。
5. Tier2 当前允许业务性非 PASS 作为「管线已完整运行」继续聚合；因此清理义务必须有独立
   `cleanupSatisfied` 门，不能从 verdict 类型推断。
6. 编译期/旧运行的 platformId 不是新 replay 创建对象的 platformId。旧 R5 固定-ID 证明只能作为
   fail-closed/解析回归证据，不能作为真机生命周期证据。

## 二、决策树

### D1. v3 锁签 runtime platformId 吗？

不签。签署发生时，新一轮对象尚不存在；预签 ID 只能是旧 ID 或猜测。v3 只签精确字节下的
create/source → delete/subject **结构授权边**、身份通道、名称模板与一次消费约束。当轮 ID 必须在
create 后从完整 listApi 读回，并只在同 run 内消费。

否决：把 compile 读到的 ID 冻结给 replay；把旧 frozen ID 写进 manifest；按名称临时补 ref。

### D2. workflow.create 的 source/subject 冲突怎么解？

通过人签策略 amendment 把 `workflow.create.identityBindingRoles` 与派生 `requiredRoles` 精确改为
`['source']`。delete 保持 `subject`，由 v3 边显式连接。不能使用 `['subject','source']`，也不能接受
「任一角色」，否则同一候选可绕过精确角色语义。

换签前继续 fail-closed；不得由实现者代签。只处理本闭环需要的 `workflow.create`，不借机扩大
`workflow.open` 或未知原子的权限。

### D3. runtime ID 从哪里来？

create 成功后，走已签 `workflows.listApi` 对同一 scope 做完整扫描。只有名称精确唯一、扫描完整、
ID 为字符串且候选唯一时才能铸 observation。DOM 名称负责关联可见对象，信封 ID 负责身份；任何
一侧歧义都不能选 first。

### D4. 删除请求何时校验？

在 mutation 真正发出前暂停，解析已签 adapter 允许的 URL/body ID 位置，并与当轮 observation 逐字
相等后才放行。响应后检查太晚，不能防误删。URL/body 冲突、缺 ID、多 ID、数值精度损失或无法
唯一关联时零放行。

### D5. 什么算删除完成？

同一 ID 在同一 listApi scope 中持续至少 3000ms、至少 3 个完整样本均缺席。每个样本都要证明分页
完整；名称 count=0、单次 200、toast 或 delete response 都不够。任何重现或不完整样本使
`cleanupSatisfied=false`。

### D6. compile 与 replay 能共用 ID 吗？

不能。二者共用已签结构与纯函数，但各自拥有独立 run、token、observation 和清理证据。三次 fresh
compile 各自完成「建→读→guard→删→稳定缺席」；正式 replay 再从零执行同一生命周期。compile
成功只让件可进入 sign，不替代 replay 真机证据。

### D7. 裁定链放哪里？

沿现役唯一链深消费：event loop → `projectReplayAxes` → verdict → report。清理 intent 由零 LLM
确定性裁定；Tier2 只消费已投影 receipt，并加独立 `cleanupSatisfied` 聚合门，不另写一套按日志猜测
的裁判。

业务 intent 的 SUT_DEFECT/NEEDS_HUMAN 可以仍表示机器管线完整，但不能洗绿环境清洁面。

### D8. uniqueNameToken 的粒度？

每个 fresh batch 一个全新 token，再确定性派生三例互不冲突的名称；compile 批次与正式 replay batch
不共用 token。禁止固定 `r1`、上批复用或只有散文时间戳而无 lineage。

### D9. 旧 v1/v2 与 R5 怎么处理？

保留并继续 fail-closed。v3 reader 必须显式识别版本；缺 v3 结构边或 runtime observation 时拒绝，
不能降级到旧按名路径。旧 R5 可钉错 ID 拒绝、解析与兼容不回退，但不得标记真机 cleanup closed。

### D10. 异常中断后的残留怎么办？

正常路径必须同例清理。独立恢复器只作为硬中断兜底，并须消费持久 run-scoped ownership receipt；
恢复成功只清偿残留，不追认原 run PASS。恢复器不是本契约正常 Tier2 绿的替代品。

## 三、最小反例集

- create/source 被换回 subject、双角色、缺角色或候选交换；
- 旧 fixed ID、compile ID 被 replay 复用、跨 run/case ref、ref 重复消费；
- 同名两条、分页不全、ID 被 Number 化、profile/scope/request correlation 漂移；
- mutation URL 与 body ID 不同、缺 ID、多个 ID、错 ID，均须证明请求零放行；
- 3 个样本不足 3000ms、3000ms 但少于 3 样本、任一样本不完整、同 ID 中途重现、仅名称归零；
- verdict 合法非 PASS 但 cleanup 缺失/false，Tier2 必非零；
- 上批 token 复用、三例名称碰撞、manifest/receipt lineage 断裂。

## 四、换签与真机边界

必须由人完成的签署/见证：

1. `workflow.create` source 角色策略 amendment；
2. 三条精确 flow/TestCase 的一次性 compile-execute 授权；
3. 三份 v3 locks、expected 与 fresh Tier2 manifest；
4. fresh 五成员同批 Tier2 的录像、报告、三条 cleanup receipt 与残留扫描；
5. 最终 P9 UAT signoff。

人签前，机器只能做计划、ATDD 红证、纯函数实现与 fail-closed 验证；不能把旧签字挪用到新的 mutation
边。所有留证脱敏，禁止落真实目标、身份值、URL 或凭据。

## 五、完成口径

successor 机器实现完成不等于 P9 完成。只有四枚最小 ATDD 绿、邻接与 gate 绿、异构评审通过、三次
fresh compile 真闭合、策略/v3 locks/manifest 人签、fresh 五成员同批 Tier2 exit 0、三条
`cleanupSatisfied:true`、录像/报告/残留扫描和最终签认全部在册，才可宣布本闭环完成。

任何 open/pending、人签缺席、同 ID 稳定缺席不足或仅有旧固定-ID R5 证据，P9 都保持 open。

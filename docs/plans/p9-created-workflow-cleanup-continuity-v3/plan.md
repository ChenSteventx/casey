# plan · p9-created-workflow-cleanup-continuity-v3

> lane=full。后继于 `entity-workflow-source-readback`、
> `entity-destructive-continuity-guard` 与 `p9-tier2-live-smoke`；只收口 P9 三条
> created-in-run 工作流用例的「本轮创建 → 本轮按同一平台标识删除 → 稳定缺席」闭环。
> 旧 v1/v2 冻结件与 fail-closed 行为保持有效，不做原地放宽或静默迁移。

## 1. 业务目标

P9 的三条变更型用例：

- `tc_catalog_wf_crud`
- `tc_wf_publish_states`
- `tc_wf_history_version`

每轮都会创建工作流。完成语义不是「页面上按名称点过删除」，而是机器能证明：删除请求针对的
平台标识，正是**本轮创建后通过完整列表信封读回**的平台标识；删除后，同一平台标识在连续
3000ms、至少 3 个完整样本中稳定缺席；该事实进入三轴、确定性裁定与 Tier2 的独立清理门。

这是一条运行时身份连续性链，不把编译期或旧运行的固定平台标识复用到新一轮，也不把旧 R5
固定-ID 金牌当作真机闭环。

## 2. v3 权威模型：只签结构授权边，不签未来运行时 ID

### 2.1 人签冻结什么

v3 冻结锁只签**结构授权边**，绑定精确字节的 TestCase、flow、events、身份通道剖面与下列闭合关系：

1. 哪一条 `workflow.create` 步骤获准创建本轮对象；
2. create 的 `subject` 候选与哪一条 `workflow.deleteByName` 的 `subject` 候选是同一条生命周期边；
3. 哪个 `workflows.listApi` 通道获准在 create 后读回、delete 后验空；
4. 哪个 delete 步骤获准消费该运行时观察，且只允许一次；
5. delete mutation adapter 的 method、path 与唯一 ID location（例如 `body.id`）由锁精确签定，运行时
   不得换 adapter 或多带第二处 ID；
6. 本轮 `batchToken`、逐 case `uniqueNameToken` 的注入位置、名称模板与 lineage 字段必须来自已签结构，运行时只能填值，
   不能改结构。

v3 锁不得预填、签署或继承某次旧运行的 `platformId`。平台标识只能在当轮 create 成功后产生，
由完整 `listApi` 读回铸成 run-scoped observation，再由同轮 delete 消费。任何锁内固定 ID、旧
observation、跨 run ref 或按名称补猜都拒绝。

### 2.2 结构边的最小闭包

每条 v3 边至少绑定：`caseId`、create/delete 的 `intentId + stepId + atom + candidateId + role`、
事件与 flow 摘要、profile 摘要、名称模板、listApi scope、授权受众、单次消费约束和版本号。
运行时 observation 至少绑定：`runId`、本批 `batchToken`、本 case 的 `uniqueNameToken`、完整实体名、字符串形态
`platformId`、create 步、读回请求关联、完整扫描证明、profile 摘要与观察件摘要。

结构边和运行时 observation 缺一不可。v1/v2 件不具备这组闭包时继续 fail-closed，不由兼容分支
降级成按名称执行。

## 3. workflow.create 角色冲突调和

当前 happy path 不可达：C2 的 observation registry 要求 `workflow.create` 为 `source`，而现役
side-effect policy、`requiredFlowEntityBindings`、draft 校验与人签权威均精确要求 `subject`。
本契约采用最小且语义一致的调和：

- side-effect policy 中 `workflow.create.identityBindingRoles:['subject']` 及派生
  `requiredRoles:['subject']` 保持不变；不换签、不放宽该权威；
- 把 observation registry 的 `workflow.create.requiredRoles` 从 `['source']` 改为
  `['subject']`，compile 观察行、flow bridge、draft 与 sign 全部精确使用一条 `subject` 绑定；
- delete 仍精确使用 `subject`；v3 结构边通过 candidate/step/run ownership lineage 把
  create/subject 连到 delete/subject，证明「删的是本轮由该 create 产生的对象」不依赖把角色命名为
  source；
- `workflow.bindAgent` 等 relation 原子的 `source + target` 双锁语义一字不动，不得把本次单实体
  ownership 调和推广为关系原子的单 subject；
- 不顺带修改 `workflow.open`，除非独立验收证明它是三例闭环的必要组成；未登记/旧件仍按现役
  fail-closed 规则处理。

最小正控必须走真实生产纯层/CLI 接缝：三例 flow 的 create/subject → compile 准入 → draft →
sign v3 冻结成功；把 create 改成 source、双角色、漏角色或交换候选必须逐一红。该正控只证明
结构可签，不替代真机运行。

## 4. compile 面：每例本轮创建、本轮读回、本轮清理

三条用例各自获得一次精确绑定当前 TestCase/flow 字节的 compile-execute 授权。每次 compile：

1. 注入本批新 `uniqueNameToken`，创建本轮唯一工作流；
2. create 完成后，通过已签 `workflows.listApi` 进行**完整扫描**；
3. 只在名称精确命中一条、分页/total/cursor 完备、ID 是非空字符串且候选唯一时，铸造本轮
   runtime observation；
4. 后续 delete 只能消费这条 observation；发出 mutation 前执行 §6 的出站 ID guard；
5. delete 后执行 §7 的稳定缺席证明；任何一步不成立，compile 不得产成功观察件或可签 v3 件，
   并按既有退出码 fail-closed。

compile 面产生的 runtime ID 只证明本次 compile 生命周期闭合，不冻结进供后续 replay 复用的锁。
三次 compile 均须留下脱敏观察件、完整性判据、出站 guard 结果和清理结果。

## 5. replay 面：从零获得当轮 runtime ID

每次正式 replay 都必须使用新批次 token，从 create 后完整读回重新获得当轮 `platformId`。回放
不得消费 compile 面的 runtime ID，只消费 v3 锁中已签的结构边，并把当轮 observation 放入
`destructiveContinuityByStep` 的 delete 步。至少满足：

- ref 由已验 v3 权威 + 当轮 observation 机械投影，不接受 caller 自报；
- ref 与 case/run/create/delete/profile/scope/name token 全等；
- 每条 delete ref 恰好消费一次，跨步、跨 case、跨 run、重复消费均拒；
- create 未完成、读回不完整、同名多候选、ID 缺失或 observation 摘要不符时，浏览器不得发出
  delete mutation；
- 前序业务 intent 的裁定与 cleanup intent 分开保留，清理成功不能追认前序业务 PASS。

## 6. 出站 mutation ID guard

删除请求在真正发出前暂停并检查 URL 与 body 的可解释字段：

1. 按 v3 锁已签的 adapter 精确核 method、path 与唯一 ID location，再从该位置提取目标 ID；
2. 请求必须恰有一个有效目标 ID；URL/query/body 任一未签位置多带第二处 ID，即使值相等也拒绝；
3. 提取出的字符串 ID 必须逐字等于当轮 observation 的 `platformId`；
4. 缺 ID、多个冲突 ID、数值化精度损失、adapter 不匹配或请求关联不唯一，一律 abort，且取证必须
   证明请求未被放行；
5. guard 只记录安全类别、摘要和布尔结果，不输出真实目标、身份值、URL 或凭据。

不允许「请求发出后看 response 再判断」；那已经无法防止删错对象。

## 7. 删除后的同 ID 稳定缺席

delete 成功响应不是清理完成。回放必须在同一 `listApi` scope 内针对同一字符串 `platformId`
连续采样：

- 观察窗口至少 3000ms；
- 至少 3 个完整样本；
- 每个样本都须证明扫描完整（records/total/hasNext/cursor 语义闭合），不能以第一页缺席代替；
- 每个样本中目标 ID 均缺席；名称计数不参与终判；
- 任一样本重新出现、扫描不完整、请求无法关联或时间窗口不足，`cleanupSatisfied=false`；
- 样本时间必须单调，3 个瞬时连拍不能冒充 3000ms 稳定窗口。

结果落成可投影的 destructive continuity evidence，包含样本数、窗口、完整性、同 ID 缺席和 guard
结论，但不落真实 ID 或目标地址。

## 8. 三轴、裁定与 Tier2

生产链必须把 v3 结果沿现役唯一通道传递：

`replay event loop → projectReplayAxes → axes.json → verdict → report-model/report`

不得在 Tier2 另造第二套推断器。`projectReplayAxes` 至少保留结构边版本、runtime observation
完整性、mutation guard、stable absence 与 `cleanupSatisfied` 的逐 cleanup intent 投影；verdict 对清理
intent 零 LLM 确定性裁定：只有 guard 全绿且稳定缺席成立才可 PASS，证据不足为 NEEDS_HUMAN，有
取证支持的 SUT 行为错误按现役规则为 SUT_DEFECT。

Tier2 另设不可被业务 verdict 洗掉的环境清洁门：三条变更型成员的 receipt 均须明确
`cleanupSatisfied:true`。`pipeline_complete_with_verdict`、SUT_DEFECT 或 NEEDS_HUMAN 不得让
`cleanupSatisfied !== true` 的成员机器绿；缺字段、false 或畸形均使 batch 非零退出。

## 9. 每批唯一命名

Tier2 每个 fresh batch 必须生成新的 `batchToken`，再为三条变更型用例确定性派生两两不同的 per-case
`uniqueNameToken` 与实体名；每条 receipt 同时绑定 batchToken 和自己的 uniqueNameToken。不得使用
replay 默认固定 `r1`，不得沿用上批 batch/per-case token，也不得用时间戳散文替代结构化 lineage。
compile 三次与最终 replay batch 分属不同生命周期，各自使用新的 batchToken 与 per-case token。

异常中断后的恢复清理不在正常 PASS 路径里偷跑：如另建恢复器，必须消费持久 run-scoped ownership
receipt；恢复成功只清偿残留，不追认原 run 通过。

## 10. 最小 ATDD（红先行）

至少新增并分别冻结四枚测试，不得合成一条宽松静态 grep：

1. `tests/_golden/p9-created-workflow-continuity-v3.created-in-run.zero-sut.golden.mjs`
   - 正控：create 后完整 listApi 唯一读回字符串 ID，v3 ref 只流向同 run delete；
   - 反例：旧固定 ID、跨 run observation、同名多条、分页不全、ID 数值化、错 step/ref 均拒；
   - v3 author→sign→reader→preflight 生产 API 铸结构权威，mutation method/path/唯一 ID location 进签署边；
   - mutation ID guard 在放行前执行，adapter/method/path/ID location 漂移、多 ID、错 ID 时证明发送次数为零。
2. `tests/_golden/p9-created-workflow-continuity-v3.stable-absence.zero-sut.golden.mjs`
   - 3000ms 且至少 3 个完整样本才真；窗口短、样本少、样本不完整、同 ID 重现、只按名称归零均红；
   - 样本时间单调与完整分页证明必须由生产纯函数判定。
3. `tests/_golden/p9-created-workflow-continuity-v3.tier2-cleanup.zero-sut.golden.mjs`
   - 三条 mutation receipt 全部 `cleanupSatisfied:true` 才允许清洁面绿；
   - 合法 SUT_DEFECT/NEEDS_HUMAN 但 cleanup 缺失或 false 时 batch 必非零；
   - 新 batchToken、三例两两不同的 per-case uniqueNameToken/派生唯一名、receipt→聚合 lineage 均须闭合。
4. `tests/_golden/p9-created-workflow-continuity-v3.role-compile-sign.zero-sut.golden.mjs`
   - 三例 create/subject + delete/subject 的 v3 ownership 结构边可经 flow→compile→sign 正向冻结；
   - v3 author/sign/reader/preflight 真生产 API 正控可达；v1/v2 冒充和 events/flow/TestCase/profile 任一精确字节漂移均拒；
   - create/source、任一角色缺失、双角色、候选交换、events/profile 字节变更均 fail-closed；
   - `workflow.bindAgent` 的 source/target 双锁正控继续绿，交换/缺任一角色继续红；
   - v1/v2 旧锁不能冒充 v3 正控。

四枚测试都须留下未实现基线的真实 exit 非零证据、sha256 冻结进 successor PRD；实现后由 gate
独写 `passes`。邻接至少复跑 C2/C3、admission policy facets、flow provenance、replay axes、verdict、
Tier2 selftest、term-lint、drift scan 与 tier1。

## 11. 交付顺序

1. acceptance-gate：四枚 ATDD 红证、checksum、successor PRD、`gate --dry`；
2. 角色调和：只修改 observation registry 与其 owner 冻结金牌/checksum amendment，增加
   create/subject 正控；side-effect policy 人签权威保持原字节与原语义；
3. v3 结构锁 + sign/reader/preflight，旧 v1/v2 reader 行为不放宽；
4. compile 面：create 后完整读回、当轮 ref、出站 guard、稳定缺席；
5. replay 面与 `projectReplayAxes → verdict → report` 深消费；
6. Tier2 `cleanupSatisfied` 独立门 + fresh batch token；
7. 三例重表达、三次 fresh compile、v3 locks/expected/manifest 人签；
8. fresh 五成员同批 Tier2 真机运行、录像过目、残留扫描和最终签认。

## 12. route:human / observability

以下项目机器金牌不能代签，全部在 PRD `observability` 明列：

- 三例各一次 fresh compile-execute 授权；每次授权只绑定精确 flow/TestCase 字节与本次 compile，
  不授权正式 replay 或重复 mutation；
- Steven 人签 v3 entity locks、三例 expected 与 Tier2 suite manifest；observation registry 的
  subject 角色修正及旧 owner checksum amendment 另按 acceptance/review 证据核销，不冒充人签策略换面；
- 真机 compile 三轮与正式五成员同批 batch 的逐轮录像/报告过目；
- 正式 batch 后按同 ID 证据与安全前缀做残留扫描，三例均须零活跃残留；
- fresh 五成员同批 Tier2 exit 0，且三条变更型 receipt 的 `cleanupSatisfied:true` 逐项核对；
- 最终 P9 UAT signoff 绑定 run 目录与所有承重产物 sha256。任何 open/pending 项保持 P9 open。

所有输出与附件禁止包含真实目标地址、身份值、凭据或未脱敏请求内容；`--sut` 仍只接受回环基址。

## 13. 完成定义与非目标

本契约完成须同时满足：四枚 ATDD 由红转绿、successor gate 全绿、邻接无回归、异构评审通过、
三次 fresh compile 闭合、v3 人签完成、fresh 五成员同批 Tier2 exit 0、三条 cleanup receipt 全真、
录像/报告/残留扫描经人签。少一项都不得说 P9 删除链完成。

本契约不把旧 v1/v2 迁移为 v3，不以名称计数代替 ID 证明，不把旧 R5 固定-ID 用例当真机证据，
不让恢复清理器追认原 run PASS，不修改零 LLM 裁判原则，也不新增真目标或凭据输出面。

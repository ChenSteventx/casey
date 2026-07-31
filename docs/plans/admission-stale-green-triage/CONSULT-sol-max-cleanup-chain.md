# CONSULT-sol-max-cleanup-chain —— gpt-5.6-sol max 只读咨询结论（2026-07-31）

> 完整转录（含推理与工具调用）约 380 万字节，只留结论正文。
> 原始转录在会话临时目录，重启即清；如需完整过程请重跑咨询。

结论先说：主路径应选 **(a)**，但不能理解成“给 `events.json` 追加七步”。当前真正的前置阻塞是破坏性目标连续性链尚未接通；另外还需要一个只负责异常中断恢复的补偿清理机制。

## 1. 清理应该补在哪一层

### 推荐：以 (a) 为主，以独立恢复器为兜底

清理是“本轮创建动作已收口”的业务后置条件，应当属于同一个已签用例、同一个 `uniqueName`/平台身份链，并进入同一份三轴和裁定。仓内原子定义本来也是这个口径：清理失败不改写前序业务 intent，但 cleanup intent 不得 PASS。[atoms-registry.snapshot.json:518](/mnt/d/ctx/heren/casey/lib/atoms-registry.snapshot.json:518)

不过，当前不能直接补事件：

- 冻结锁逐字绑定 `eventsSha256`，并只绑定到现有末步；改事件必然要重铸锁、重签 expected，并更新各 PRD 与 tier-2 manifest 的 hash。[entity-locks.frozen.json:10](/mnt/d/ctx/heren/casey/cases/tc_catalog_wf_crud/entity-locks.frozen.json:10) [tier2-suite.manifest.json:91](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:91)
- catalog/history 的当前 flow 仍含 `intent_cleanup`，但 testcase/events 已没有，已发生跨件语义漂移。[catalog flow:69](/mnt/d/ctx/heren/casey/cases/tc_catalog_wf_crud/flow-tc_catalog_wf_crud.json:69) [history flow:138](/mnt/d/ctx/heren/casey/cases/tc_wf_history_version/flow-tc_wf_history_version.json:138)
- publish 不能直接恢复旧 archive：当前版本后来补了“保存、发布、历史版本”语义，[testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/testcase.json:9)，旧归档则发布后马上进入删除链。[events.pre-b2:97](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/archive/events.pre-b2-20260729.json:97) 必须基于当前表达重新编译，不能把旧 events 整份拷回。
- 更致命的是，当前 replay 把逐破坏步连续性 ref 表固定建成空 Map，冻结锁在力时任何 `workflow.deleteByName` 都会在浏览器启动前被拒。[replay.mjs:192](/mnt/d/ctx/heren/casey/bin/replay.mjs:192) [replay.mjs:203](/mnt/d/ctx/heren/casey/bin/replay.mjs:203) 现有跑单也明确写明：补身份通道、锁格式、回放接线、金牌重签等五项后，才轮到 07-22 八步配方。[resign-runbooks.md:360](/mnt/d/ctx/heren/casey/docs/plans/p9-uat-close/resign-runbooks.md:360) [resign-runbooks.md:376](/mnt/d/ctx/heren/casey/docs/plans/p9-uat-close/resign-runbooks.md:376)

所以正确顺序是：先闭合合法删除的 proceed 路径，再统一重表达 testcase/flow/events/profile/expected/locks/PRD/manifest，最后重签真机验证。

### (b) 不适合作为正常主路径

单独签一个清理用例可以保留“所有动作来自签署 spec”，但它需要新增一个跨用例事务协议：

- 主例必须产生不可变 handoff：`runId + caseId + 本轮唯一名 + 创建后权威读回的 platformId + 创建收据 hash`。
- 清理例必须消费同一 handoff，不能只按前缀或名称删。
- 套件完成条件必须是“主例产物在册且清理收据成立”。
- 主例在创建后崩溃、超时或 tier-2 系统性停全集时，后置清理例可能根本不会启动。

当前 tier-2 没有依赖图或 handoff；它只是逐例启动管线，并仅在 manifest 有静态 `uniqueNameToken` 时透传。[selftest-tier2-collect.mjs:141](/mnt/d/ctx/heren/casey/lib/selftest-tier2-collect.mjs:141) [selftest-tier2-collect.mjs:164](/mnt/d/ctx/heren/casey/lib/selftest-tier2-collect.mjs:164)

### (c) 不应承担正常清理

当前 manifest 校验只要求 `cleanupObligation` 是非空字符串，并不执行或验证清理。[selftest-tier2-manifest.mjs:77](/mnt/d/ctx/heren/casey/lib/selftest-tier2-manifest.mjs:77) 把删除直接塞进 tier-2 工装，会形成第二条无签署动作链，且主用例 verdict 与清理结果可以分离。

它可以做异常恢复，但不能把恢复成功追认成原主例 PASS。

### 你漏掉的第四种：签署主清理 + 持久恢复账

即：

1. 同例内用 (a) 正常“我建我删”；
2. 创建前登记本轮不可复用命名空间，创建后立即持久化 platformId 所有权收据；
3. 进程硬中断导致尾链未运行时，由单独签署的恢复清理器消费账本；
4. 恢复结果只清偿残留，不追认原 run 通过。

这是必要的，因为任何尾部清理链都覆盖不了“创建成功后整个进程被杀”的窗口。

还有一个当前现成坑：tier-2 三例没有 `uniqueNameToken`，而 replay 缺参默认使用固定 `r1`。[replay.mjs:65](/mnt/d/ctx/heren/casey/bin/replay.mjs:65) 周期跑若不先修这个，创建失败后的清理可能遇到上一轮同名残留；没有本轮 platformId 收据时，无法证明删的是“我本轮建的”。

另纠正一个前提：三份当前 testcase 中，只有 publish 明写 B-2。[publish testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/testcase.json:9) catalog 与 history 没写。[catalog testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_catalog_wf_crud/testcase.json:9) [history testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_wf_history_version/testcase.json:9) 当前签署 manifest 对 catalog 声称 testcase 写了 B-2，是一条事实漂移。[tier2-suite.manifest.json:80](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:80)

## 2. `tc_agent_id_readback_real_uat_v1` 实际怎么做

严格说，它不属于 (a)/(b)/(c) 中任何一个；若硬归类，执行位置最接近 (c)，但它是一次性 UAT 契约的外部 fixture 生命周期，不是 tier-2 工装职责。

证据：

- testcase 明说对象由契约预置；用例本身只有导航和打开。[testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_agent_id_readback_real_uat_v1/testcase.json:9)
- events 只有四步，完全没有创建或删除。[events.json:9](/mnt/d/ctx/heren/casey/cases/tc_agent_id_readback_real_uat_v1/events.json:9)
- UAT plan 把“预置”和“报告后清理”列在用例外。[plan.md:14](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/plan.md:14) [plan.md:30](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/plan.md:30)
- 见证结果是按名称和两个编码三面归零，2→1→0。[uat-run.md:53](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/uat-run.md:53) [cleanup-run2.log:1](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/cleanup-run2.log:1)
- 最后由 Steven 对整套 UAT 人签，而不是由该 testcase 的 verdict 给清理背书。[uat-signoff.md:3](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/uat-signoff.md:3)

可照搬的是：本轮所有权、逐对象精确身份、多面归零、非零退出、单独留清理证据。

不能直接照搬的是实现形态：

- 它清理的是契约外预置对象；三条工作流则在回放内部创建。
- 旧脚本只要求删除入口至少一个，随后取 `first()`；确认按钮同样取 `first()`，没有证明动作控件唯一。[cleanup-agents.mjs:46](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/scripts/cleanup-agents.mjs:46)
- 它使用固定等待，未满足现行“连续 3000ms 归零、忙态或重现即重新计时”的静默点要求。
- 对象删除后，原冻结锁绑定的 platformId 已失效，重跑必须重预置、重铸、重签；先例自己也明确记录了这一点。[learn.md:24](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/learn.md:24)

因此它是身份与归零证据的先例，不是周期性清理架构的可直接复用模板。

## 3. 已发布态是否根本不能删除

不是。仓内证据足以证明：截至 2026-07-15/16 的真实平台，已发布工作流存在“整条删除”动作。

- 旧冻结 events 在发布后确实进入七步 `workflow.deleteByName` 链。[events.pre-b2:99](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/archive/events.pre-b2-20260729.json:99) [events.pre-b2:110](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/archive/events.pre-b2-20260729.json:110)
- 真实回放历史显示发布成功，随后七个删除事件全部完成。[run-history.jsonl:9](/mnt/d/ctx/heren/casey/runs/real-uat-20260715-final-b2/tc_wf_publish_states/run-history.jsonl:9)
- 确定性裁定把 cleanup intent 判为 PASS。[verdict.json:26](/mnt/d/ctx/heren/casey/runs/real-uat-20260715-final-b2/tc_wf_publish_states/verdict.json:26)
- 后续三例复验记录 publish cleanup 7/7 unique，并有独立只读残留探针确认最终对象数为零。[real-uat-20260716-final.md:12](/mnt/d/ctx/heren/casey/docs/plans/workflow-delete-by-name-hardening/review/real-uat-20260716-final.md:12) [real-uat-20260716-final.md:32](/mnt/d/ctx/heren/casey/docs/plans/workflow-delete-by-name-hardening/review/real-uat-20260716-final.md:32)

所以“不能退回未发布”与“不能整条删除”是两件事。当前 manifest 自己也写的是只能整条删，而非只能停用。[tier2-suite.manifest.json:109](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:109)

未核实项：我没有按纪律跑当前真机，因此不能保证 07-31 当前 UI/权限未漂移。现有证据能证明历史上可删；当前阻塞更明确地位于 Casey 的连续性准入 proceed 路径，而不是平台缺少删除功能。

## 4. 最大的假绿风险与所需断言

你的担心成立，但还有两层更隐蔽的假绿。

清理 intent 至少要满足：

1. 删除前：本轮创建收据中的 platformId 在同一权威列表源中恰好存在一次；名称只是辅助锚。
2. 删除动作：目标记录、删除入口和本次触发产生的确认弹层都必须唯一，全部事件动作轴成功；现有 intent fold 已能保证任一前序事件失败不能被末事件洗绿。[intent-action-fold.mjs:44](/mnt/d/ctx/heren/casey/lib/intent-action-fold.mjs:44)
3. 删除后硬断言：同一 platformId 在同源列表中连续至少 3000ms 缺席，至少三次有效采样；加载/忙态、对象重现都重新计时；超时、样本不足或身份通道不可用均为不成立。这个语义已登记为项目标准。[CONTEXT.md:166](/mnt/d/ctx/heren/casey/CONTEXT.md:166)
4. 精确名称计数为零可以保留，但只能作辅助断言，不能代替 platformId 缺席证明。
5. tier-2 单独记 `cleanupSatisfied`；它必须为真才能宣称本轮无活跃残留，不应由主业务 verdict 类型推断。

当前实现有三个具体漏洞：

- `countChange equals 0` 实际只判断 `after === 0`，不要求 before 为 1，也不证明变化由删除造成。[replay-assert.mjs:86](/mnt/d/ctx/heren/casey/lib/replay-assert.mjs:86) 旧真机 cleanup 甚至显示为 `0→0`。[axes.json:882](/mnt/d/ctx/heren/casey/runs/real-uat-20260715-final-b2/tc_wf_publish_states/axes.json:882)
- 工作流删除仍走通用 2500ms 静默等待；预算耗尽后会“按现状采”，而不是让归零证明失败。[replay-settle.mjs:93](/mnt/d/ctx/heren/casey/lib/replay-settle.mjs:93) [replay-settle.mjs:162](/mnt/d/ctx/heren/casey/lib/replay-settle.mjs:162) 真正的 3000ms 零窗口只接在 `agent.delete` 上。[agent-tool-actions.mjs:13](/mnt/d/ctx/heren/casey/lib/agent-tool-actions.mjs:13) [agent-tool-actions.mjs:325](/mnt/d/ctx/heren/casey/lib/agent-tool-actions.mjs:325)
- target-ID absence 已有纯函数，但目前回放仅把结果放进 `intentTargetAbsence`，最终三轴装配没有消费该 map。[event-runner.mjs:337](/mnt/d/ctx/heren/casey/lib/replay/event-runner.mjs:337) [artifact-finalizer.mjs:98](/mnt/d/ctx/heren/casey/lib/replay/artifact-finalizer.mjs:98)

最大的汇总层假绿是：单例 cleanup 落 `NEEDS_HUMAN` 时，`casey run` 会正确 exit 1；但 tier-2 明确把合法的 SUT_DEFECT/NEEDS_HUMAN 当作“机器管线已完成”，仍可能整体 exit 0。[casey.mjs:170](/mnt/d/ctx/heren/casey/bin/casey.mjs:170) [selftest-tier2.mjs:513](/mnt/d/ctx/heren/casey/lib/selftest-tier2.mjs:513) 因此必须新增独立的清理义务门：业务非 PASS 可以继续按 tier-2 原口径处理，但 `cleanupSatisfied !== true` 必须让“环境清洁面”红。

## 5. 周期性运行如何算账

建议把账分成两类，不能都叫“清理失败”：

| 账类 | 周期性要求 |
|---|---|
| 活跃结构残留：工作流、仍挂在父对象下的版本记录 | 每轮必须精确归零，并有稳定 target-ID absence 证明 |
| 不可变操作足迹：若平台保留创建、发布、删除审计记录 | 不能要求归零；每轮声明预期增量、累计预算和观察口径 |
| 未知是否保留、无法观测的痕迹 | 明确挂 `route:human`，不得默认为零 |

仓内已有“非结构性痕迹也要记账”的先例：chiefcomplaint 成员明确把会话记录累计写进 cleanup obligation。[tier2-suite.manifest.json:53](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:53) history 也把版本记录单列，并声明其随整条工作流删除而去。[tier2-suite.manifest.json:138](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:138)

但我没有找到任何真机产物证明平台是否保留创建/发布/删除的审计日志，也没有找到“审计日志必须归零”的既有口径。agent 先例只证明名称与编码归零，没有核审计面。[cleanup-run2.log:1](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/cleanup-run2.log:1)

因此以下是设计推断，不是已核事实：如果审计记录按平台设计不可删除，它应计作每轮不可变足迹，而不是活跃残留；周期性许可应对其增量和累计量作显式预算。否则“建了又删”会在结构账上是零，在真实环境成本账上却无限增长。

一句推荐：**采用 (a) 作为签署主链，先闭合破坏性连续性与 target-ID 稳定归零，再配一个只处理崩溃孤儿的签署恢复器；最大风险是瞬时/错锚的“0”或 cleanup 的 `NEEDS_HUMAN` 仍被 tier-2 汇总成机器面绿。**
tokens used
468,160
结论先说：主路径应选 **(a)**，但不能理解成“给 `events.json` 追加七步”。当前真正的前置阻塞是破坏性目标连续性链尚未接通；另外还需要一个只负责异常中断恢复的补偿清理机制。

## 1. 清理应该补在哪一层

### 推荐：以 (a) 为主，以独立恢复器为兜底

清理是“本轮创建动作已收口”的业务后置条件，应当属于同一个已签用例、同一个 `uniqueName`/平台身份链，并进入同一份三轴和裁定。仓内原子定义本来也是这个口径：清理失败不改写前序业务 intent，但 cleanup intent 不得 PASS。[atoms-registry.snapshot.json:518](/mnt/d/ctx/heren/casey/lib/atoms-registry.snapshot.json:518)

不过，当前不能直接补事件：

- 冻结锁逐字绑定 `eventsSha256`，并只绑定到现有末步；改事件必然要重铸锁、重签 expected，并更新各 PRD 与 tier-2 manifest 的 hash。[entity-locks.frozen.json:10](/mnt/d/ctx/heren/casey/cases/tc_catalog_wf_crud/entity-locks.frozen.json:10) [tier2-suite.manifest.json:91](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:91)
- catalog/history 的当前 flow 仍含 `intent_cleanup`，但 testcase/events 已没有，已发生跨件语义漂移。[catalog flow:69](/mnt/d/ctx/heren/casey/cases/tc_catalog_wf_crud/flow-tc_catalog_wf_crud.json:69) [history flow:138](/mnt/d/ctx/heren/casey/cases/tc_wf_history_version/flow-tc_wf_history_version.json:138)
- publish 不能直接恢复旧 archive：当前版本后来补了“保存、发布、历史版本”语义，[testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/testcase.json:9)，旧归档则发布后马上进入删除链。[events.pre-b2:97](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/archive/events.pre-b2-20260729.json:97) 必须基于当前表达重新编译，不能把旧 events 整份拷回。
- 更致命的是，当前 replay 把逐破坏步连续性 ref 表固定建成空 Map，冻结锁在力时任何 `workflow.deleteByName` 都会在浏览器启动前被拒。[replay.mjs:192](/mnt/d/ctx/heren/casey/bin/replay.mjs:192) [replay.mjs:203](/mnt/d/ctx/heren/casey/bin/replay.mjs:203) 现有跑单也明确写明：补身份通道、锁格式、回放接线、金牌重签等五项后，才轮到 07-22 八步配方。[resign-runbooks.md:360](/mnt/d/ctx/heren/casey/docs/plans/p9-uat-close/resign-runbooks.md:360) [resign-runbooks.md:376](/mnt/d/ctx/heren/casey/docs/plans/p9-uat-close/resign-runbooks.md:376)

所以正确顺序是：先闭合合法删除的 proceed 路径，再统一重表达 testcase/flow/events/profile/expected/locks/PRD/manifest，最后重签真机验证。

### (b) 不适合作为正常主路径

单独签一个清理用例可以保留“所有动作来自签署 spec”，但它需要新增一个跨用例事务协议：

- 主例必须产生不可变 handoff：`runId + caseId + 本轮唯一名 + 创建后权威读回的 platformId + 创建收据 hash`。
- 清理例必须消费同一 handoff，不能只按前缀或名称删。
- 套件完成条件必须是“主例产物在册且清理收据成立”。
- 主例在创建后崩溃、超时或 tier-2 系统性停全集时，后置清理例可能根本不会启动。

当前 tier-2 没有依赖图或 handoff；它只是逐例启动管线，并仅在 manifest 有静态 `uniqueNameToken` 时透传。[selftest-tier2-collect.mjs:141](/mnt/d/ctx/heren/casey/lib/selftest-tier2-collect.mjs:141) [selftest-tier2-collect.mjs:164](/mnt/d/ctx/heren/casey/lib/selftest-tier2-collect.mjs:164)

### (c) 不应承担正常清理

当前 manifest 校验只要求 `cleanupObligation` 是非空字符串，并不执行或验证清理。[selftest-tier2-manifest.mjs:77](/mnt/d/ctx/heren/casey/lib/selftest-tier2-manifest.mjs:77) 把删除直接塞进 tier-2 工装，会形成第二条无签署动作链，且主用例 verdict 与清理结果可以分离。

它可以做异常恢复，但不能把恢复成功追认成原主例 PASS。

### 你漏掉的第四种：签署主清理 + 持久恢复账

即：

1. 同例内用 (a) 正常“我建我删”；
2. 创建前登记本轮不可复用命名空间，创建后立即持久化 platformId 所有权收据；
3. 进程硬中断导致尾链未运行时，由单独签署的恢复清理器消费账本；
4. 恢复结果只清偿残留，不追认原 run 通过。

这是必要的，因为任何尾部清理链都覆盖不了“创建成功后整个进程被杀”的窗口。

还有一个当前现成坑：tier-2 三例没有 `uniqueNameToken`，而 replay 缺参默认使用固定 `r1`。[replay.mjs:65](/mnt/d/ctx/heren/casey/bin/replay.mjs:65) 周期跑若不先修这个，创建失败后的清理可能遇到上一轮同名残留；没有本轮 platformId 收据时，无法证明删的是“我本轮建的”。

另纠正一个前提：三份当前 testcase 中，只有 publish 明写 B-2。[publish testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/testcase.json:9) catalog 与 history 没写。[catalog testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_catalog_wf_crud/testcase.json:9) [history testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_wf_history_version/testcase.json:9) 当前签署 manifest 对 catalog 声称 testcase 写了 B-2，是一条事实漂移。[tier2-suite.manifest.json:80](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:80)

## 2. `tc_agent_id_readback_real_uat_v1` 实际怎么做

严格说，它不属于 (a)/(b)/(c) 中任何一个；若硬归类，执行位置最接近 (c)，但它是一次性 UAT 契约的外部 fixture 生命周期，不是 tier-2 工装职责。

证据：

- testcase 明说对象由契约预置；用例本身只有导航和打开。[testcase.json:9](/mnt/d/ctx/heren/casey/cases/tc_agent_id_readback_real_uat_v1/testcase.json:9)
- events 只有四步，完全没有创建或删除。[events.json:9](/mnt/d/ctx/heren/casey/cases/tc_agent_id_readback_real_uat_v1/events.json:9)
- UAT plan 把“预置”和“报告后清理”列在用例外。[plan.md:14](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/plan.md:14) [plan.md:30](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/plan.md:30)
- 见证结果是按名称和两个编码三面归零，2→1→0。[uat-run.md:53](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/uat-run.md:53) [cleanup-run2.log:1](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/cleanup-run2.log:1)
- 最后由 Steven 对整套 UAT 人签，而不是由该 testcase 的 verdict 给清理背书。[uat-signoff.md:3](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/uat-signoff.md:3)

可照搬的是：本轮所有权、逐对象精确身份、多面归零、非零退出、单独留清理证据。

不能直接照搬的是实现形态：

- 它清理的是契约外预置对象；三条工作流则在回放内部创建。
- 旧脚本只要求删除入口至少一个，随后取 `first()`；确认按钮同样取 `first()`，没有证明动作控件唯一。[cleanup-agents.mjs:46](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/scripts/cleanup-agents.mjs:46)
- 它使用固定等待，未满足现行“连续 3000ms 归零、忙态或重现即重新计时”的静默点要求。
- 对象删除后，原冻结锁绑定的 platformId 已失效，重跑必须重预置、重铸、重签；先例自己也明确记录了这一点。[learn.md:24](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/learn.md:24)

因此它是身份与归零证据的先例，不是周期性清理架构的可直接复用模板。

## 3. 已发布态是否根本不能删除

不是。仓内证据足以证明：截至 2026-07-15/16 的真实平台，已发布工作流存在“整条删除”动作。

- 旧冻结 events 在发布后确实进入七步 `workflow.deleteByName` 链。[events.pre-b2:99](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/archive/events.pre-b2-20260729.json:99) [events.pre-b2:110](/mnt/d/ctx/heren/casey/cases/tc_wf_publish_states/archive/events.pre-b2-20260729.json:110)
- 真实回放历史显示发布成功，随后七个删除事件全部完成。[run-history.jsonl:9](/mnt/d/ctx/heren/casey/runs/real-uat-20260715-final-b2/tc_wf_publish_states/run-history.jsonl:9)
- 确定性裁定把 cleanup intent 判为 PASS。[verdict.json:26](/mnt/d/ctx/heren/casey/runs/real-uat-20260715-final-b2/tc_wf_publish_states/verdict.json:26)
- 后续三例复验记录 publish cleanup 7/7 unique，并有独立只读残留探针确认最终对象数为零。[real-uat-20260716-final.md:12](/mnt/d/ctx/heren/casey/docs/plans/workflow-delete-by-name-hardening/review/real-uat-20260716-final.md:12) [real-uat-20260716-final.md:32](/mnt/d/ctx/heren/casey/docs/plans/workflow-delete-by-name-hardening/review/real-uat-20260716-final.md:32)

所以“不能退回未发布”与“不能整条删除”是两件事。当前 manifest 自己也写的是只能整条删，而非只能停用。[tier2-suite.manifest.json:109](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:109)

未核实项：我没有按纪律跑当前真机，因此不能保证 07-31 当前 UI/权限未漂移。现有证据能证明历史上可删；当前阻塞更明确地位于 Casey 的连续性准入 proceed 路径，而不是平台缺少删除功能。

## 4. 最大的假绿风险与所需断言

你的担心成立，但还有两层更隐蔽的假绿。

清理 intent 至少要满足：

1. 删除前：本轮创建收据中的 platformId 在同一权威列表源中恰好存在一次；名称只是辅助锚。
2. 删除动作：目标记录、删除入口和本次触发产生的确认弹层都必须唯一，全部事件动作轴成功；现有 intent fold 已能保证任一前序事件失败不能被末事件洗绿。[intent-action-fold.mjs:44](/mnt/d/ctx/heren/casey/lib/intent-action-fold.mjs:44)
3. 删除后硬断言：同一 platformId 在同源列表中连续至少 3000ms 缺席，至少三次有效采样；加载/忙态、对象重现都重新计时；超时、样本不足或身份通道不可用均为不成立。这个语义已登记为项目标准。[CONTEXT.md:166](/mnt/d/ctx/heren/casey/CONTEXT.md:166)
4. 精确名称计数为零可以保留，但只能作辅助断言，不能代替 platformId 缺席证明。
5. tier-2 单独记 `cleanupSatisfied`；它必须为真才能宣称本轮无活跃残留，不应由主业务 verdict 类型推断。

当前实现有三个具体漏洞：

- `countChange equals 0` 实际只判断 `after === 0`，不要求 before 为 1，也不证明变化由删除造成。[replay-assert.mjs:86](/mnt/d/ctx/heren/casey/lib/replay-assert.mjs:86) 旧真机 cleanup 甚至显示为 `0→0`。[axes.json:882](/mnt/d/ctx/heren/casey/runs/real-uat-20260715-final-b2/tc_wf_publish_states/axes.json:882)
- 工作流删除仍走通用 2500ms 静默等待；预算耗尽后会“按现状采”，而不是让归零证明失败。[replay-settle.mjs:93](/mnt/d/ctx/heren/casey/lib/replay-settle.mjs:93) [replay-settle.mjs:162](/mnt/d/ctx/heren/casey/lib/replay-settle.mjs:162) 真正的 3000ms 零窗口只接在 `agent.delete` 上。[agent-tool-actions.mjs:13](/mnt/d/ctx/heren/casey/lib/agent-tool-actions.mjs:13) [agent-tool-actions.mjs:325](/mnt/d/ctx/heren/casey/lib/agent-tool-actions.mjs:325)
- target-ID absence 已有纯函数，但目前回放仅把结果放进 `intentTargetAbsence`，最终三轴装配没有消费该 map。[event-runner.mjs:337](/mnt/d/ctx/heren/casey/lib/replay/event-runner.mjs:337) [artifact-finalizer.mjs:98](/mnt/d/ctx/heren/casey/lib/replay/artifact-finalizer.mjs:98)

最大的汇总层假绿是：单例 cleanup 落 `NEEDS_HUMAN` 时，`casey run` 会正确 exit 1；但 tier-2 明确把合法的 SUT_DEFECT/NEEDS_HUMAN 当作“机器管线已完成”，仍可能整体 exit 0。[casey.mjs:170](/mnt/d/ctx/heren/casey/bin/casey.mjs:170) [selftest-tier2.mjs:513](/mnt/d/ctx/heren/casey/lib/selftest-tier2.mjs:513) 因此必须新增独立的清理义务门：业务非 PASS 可以继续按 tier-2 原口径处理，但 `cleanupSatisfied !== true` 必须让“环境清洁面”红。

## 5. 周期性运行如何算账

建议把账分成两类，不能都叫“清理失败”：

| 账类 | 周期性要求 |
|---|---|
| 活跃结构残留：工作流、仍挂在父对象下的版本记录 | 每轮必须精确归零，并有稳定 target-ID absence 证明 |
| 不可变操作足迹：若平台保留创建、发布、删除审计记录 | 不能要求归零；每轮声明预期增量、累计预算和观察口径 |
| 未知是否保留、无法观测的痕迹 | 明确挂 `route:human`，不得默认为零 |

仓内已有“非结构性痕迹也要记账”的先例：chiefcomplaint 成员明确把会话记录累计写进 cleanup obligation。[tier2-suite.manifest.json:53](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:53) history 也把版本记录单列，并声明其随整条工作流删除而去。[tier2-suite.manifest.json:138](/mnt/d/ctx/heren/casey/cases/tier2-suite.manifest.json:138)

但我没有找到任何真机产物证明平台是否保留创建/发布/删除的审计日志，也没有找到“审计日志必须归零”的既有口径。agent 先例只证明名称与编码归零，没有核审计面。[cleanup-run2.log:1](/mnt/d/ctx/heren/casey/docs/plans/real-uat-attestation/evidence/cleanup-run2.log:1)

因此以下是设计推断，不是已核事实：如果审计记录按平台设计不可删除，它应计作每轮不可变足迹，而不是活跃残留；周期性许可应对其增量和累计量作显式预算。否则“建了又删”会在结构账上是零，在真实环境成本账上却无限增长。

一句推荐：**采用 (a) 作为签署主链，先闭合破坏性连续性与 target-ID 稳定归零，再配一个只处理崩溃孤儿的签署恢复器；最大风险是瞬时/错锚的“0”或 cleanup 的 `NEEDS_HUMAN` 仍被 tier-2 汇总成机器面绿。**
consult exit=0

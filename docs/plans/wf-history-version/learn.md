# learn — wf-history-version（direct，2026-07-03 收口）

六阶段走完（grill 全机械 → plan → accept 红先行 C 编译向红 → loop 一发全绿 → codex 三轮 R3 PASS → learn）。沉淀四条：

1. **「机制缝递减」假设终点验证成立（3→1→0）**：第二条 3 缝、第三条 1 缝、本条 0 缝——两个纯加法编译原子（`clickEditorButton` click / `closeDrawer` press Escape），断言全为已实现 kind，不碰词表/schema/回放器。飞轮复利真在攒：维度装齐后同维度后续条趋近纯语料成本。飞轮下一条同维度（`wf_open_smoke` 只读）预计同为零缝。
2. **共享夹具是耦合面，改动要跑全部消费者**：publish-sut 被 wf-publish-states 与 wf-history-version 两 golden 共吃；初版历史版本钮硬编码真 button 污染了 divButtons 场景的「role 全盲」前提，翻红 wf-publish-states 上轮 codex R1-F1 的 absent 活性反证测试。修法 = 历史版本钮走 `mk()`（随场景 div/button 一致）。教训：扩共享夹具后必跑全部依赖它的 golden + 重签全部相关 prd 的夹具 checksum，别只跑本契约。
3. **direct 车道不豁免异构评审深度**：direct 是「地板全放行」的入口分流，不是「评审放水」——codex 三轮才 PASS，R1 三 High 全是「门禁锁不够紧」（关闭效果没断、event shape 没全锁、断言 intent 挂靠没验）。零机制缝 ≠ 零评审价值：机制没动，但 golden 能不能真锁住编译产物契约是独立问题。评审证伪的正是「golden 绿了但没测到关键契约」。
4. **未跟踪新文件的评审喂料要喂全文不喂 diff**：R3 评审包用 `git diff` 喂 golden 增量、但 golden 是未跟踪新文件故 diff 空，codex 据空 diff 判 FAIL（材料不足非代码问题）；重发喂 C1 全文即 PASS。评审包组装纪律：新文件走 `cat` 全文，改动文件才走 `git diff`。

配套：`compileWorkflowClickEditorButton`/`compileWorkflowCloseDrawer` 两编译原子；publish-sut 夹具扩历史版本弹窗（Esc 清空内容使关闭效果可观测）+ 关闭钮 handler；golden 3 检查（C 编译向 event shape + 断言挂靠全锁 / I1 回放向含关闭效果锁 / W1 端到端）。真机四停站与 `cases/tc_wf_history_version/` 真机件待 route:human（可与 wf-publish-states 停站合并一次行程）。飞轮已铺三维度（dom_crud/chat/发布状态），画布维度（R9 前线）仍压最后。

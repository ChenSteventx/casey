# learn — noerrenv-absence（light，2026-07-02）

六阶段全走完（grill 单分岔人签 → plan → accept 红先行两红 → loop gate GREEN 双 prd → codex 一轮 PASS → learn）。沉淀四条：

1. **首航就是验收器**：hermetic 全绿两个契约周期都没暴露 `noErrorEnvelope` 的夹具捷径（`/saveOrModifyProcessData/` 硬编码）——因为假 SUT 恰好总发这个请求。第一次真机端到端（相2→3→4）立刻打出 3/4 步假败。教训成式：**评估器语义只有在「信号分布与夹具不同」的真数据上才证得完**；每类断言 kind 实现后，首个真机用例要专门看它的正反两向。
2. **fail-safe 的价值在这轮兑现**：假败方向是 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)` 而不是假绿——裁判把「证不出」如实路由给人，人顺着三步同因的模式一眼定位到同一条断言。护栏 #14 不只是安全性，还是可诊断性。
3. **冻结检查也会钉住错误语义**：coverage golden 那条「无 save 记录 → ok:false」当年锁的是「证不出→false」的 fail-safe 方向，实际连带钉死了夹具捷径。翻转流程走对了——实证 + 人签（Steven 批）+ 红先行三向 + 双 prd 同步重签 + codex 复核，护栏 #1 的「改冻结测试须走契约更新」全程可追溯。
4. **同味挂账**：`streamReplyReceived` 分支同样以 URL 模式（`/streamReply/`）找流记录——夹具味相同，但其语义是「存在性断言」（流回来了且 finished），URL 模式暂无更好锚（等 expected 值携带流 URL 模板再议）；记观察挂账、不顺手改（一契约一事）。

配套：缺席断言范式已在同文件二例（`noPageError`/`noErrorEnvelope`）——第三个取证类 kind（`noErrorToast`）实现时照此镜像。

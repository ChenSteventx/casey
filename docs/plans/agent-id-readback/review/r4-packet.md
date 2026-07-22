你是 Casey 仓 agent-id-readback 契约的异构评审员（R3 终判 FAIL，阻塞项 H1、H6、M1 各 PARTIAL；你已确认机器五面 R18-R21 闭合、投影搬移语义成立、调用矩阵与两笔排除接受）。本轮 R4 只核你 R3 三笔残余的四波修复，不重审已接受面、不重审整仓。工作目录 /mnt/d/ctx/heren/casey-agent-id-readback（只读）。

【材料】
1. 你的 R3 结论：docs/plans/agent-id-readback/review/codex-review-r3.log。
2. 四波修复 hunks（R3 候选 640452d→当前候选）：docs/plans/agent-id-readback/review/fix-hunks-r4-wave4.patch。
3. 处置表四波节：docs/plans/agent-id-readback/review/fix-dispositions-r1.md 末两节。

【三笔残余的四波处置】
H1（命中卡 ElementHandle 无 dispose）：lib/compile-atoms.mjs 与 lib/replay-actions.mjs 身份路径——cardGate 取得后整段 try/finally，`if (cardGate.card) await cardGate.card.dispose().catch(() => {})` 全路径兜底（成功/双证拒/点击失败/异常均释放；clickAgentCardWithin 只释放自建 name 子句柄的分工不变）。资源纪律面零 SUT 无确定性构造（同你 R2 对句柄连续性的口径），请静态核 hunks。
M1（ctx.identityTokens 强引用 Map 消费后不删）：lib/replay-actions.mjs doAgentSearchOpen——`consume(token)` 后随即 `ctx.identityTokens.delete(ev.intentId)`，消费即出账延伸到调用方层；账本层 WeakSet/出账/O8c 钉不变。调用方 Map 属 bin 进程内态、零 SUT 无金牌可钉，请静态核。
H6（UAT 绑定只有散文）：sol 必改项三件套落实际字段——loop/prd-agent-id-readback.json observability route:human 项新增结构化字段 `uatCaseId: "tc_agent_id_readback_real_uat_v1"`、`successorContract: "real-uat-attestation"`、`uatDefinition`（冻结四步定义：①真机执行权威产 v2 产物（events+draft v2 双 digest+identity-observations.compile.json，platformId=19 位纯数字）；②sign --entity-observations 五元 join 人签出 frozen v2；③回放点击前信封+DOM 双证对已签 platformId 全等、同名敌意必 AMBIGUOUS 不点击；④报告三形态交付=过闸（ADR-0009））；并把 sol 的时间戳边界一并冻入（真机产物按行为与裁定核验、不宣称跨运行逐字基线）。plan §8 绑同一具体值与定义指针。plan §6 修正其余部分你已接受，本笔只补 UAT 绑定前提。

【现成证据（勿重跑）】
四波修后零 SUT 金牌复跑：棘轮 21/21（v1 字节面零漂移——两处修复均只在身份 v2 路径）、观察 31/31、门 18/18、sign 11/11 全绿；全 gate 第六轮见 gate-run 尾账与 prd passes（gate 唯一写 passes；含 chat-sut 10/10 真实链行为复验）。

【输出要求】
对 H1、H6、M1 逐项裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；对 plan §6 权威修正（补齐 UAT 绑定后）裁定接受/拒绝并说理。最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。

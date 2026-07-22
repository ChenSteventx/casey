你是 Casey 仓 real-uat-attestation 契约的异构评审员（R1 终判 FAIL，阻塞四项：正式报告缺录屏/视觉复核且附件悬空、完整性金牌自证账本、PRD 记账冲突、预置清理 fail-open；R3 脱敏/R4 判定正当你已判 OK）。本轮 R2 只核四阻塞项的修复，不重审已 OK 面、不重审整仓。工作目录 /mnt/d/ctx/heren/casey（只读）。

【材料】
1. 你的 R1 结论：docs/plans/real-uat-attestation/review/codex-review-r1.log。
2. 修复提交：git show 4bbaebf（含金牌重写、evidence run-2 节、plan §4a 修正注记、prd 修正、脚本/日志入库）。
3. run-2 真机产物（本机，附件共置三链版式）：runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay{1,2}/（各含 report 三形态+verdict.json+axes.json+run-history.jsonl+run-metrics.json+video.json+video.webm+visual-review.json+frames/）；cases/tc_agent_id_readback_real_uat_v1/（run-2 签署件；run-1 冻结件已审计归档 archive/run1-20260723/）。

【四阻塞项处置】
A 报告缺件（R2-High）：冻结件绑已删 X 实例 platformId（身份锁语义）→ 整链重跑：重预置 X→重编译→审计摘除 tc prd 陈旧冻结账（sign「无 publication journal 拒猜残留」fail-closed 实证）→全新签署→回放①②各带 --video-dir/--run-history/--run-metrics。两 run 目录附件全部实存共置（报告链接落地）；report-model 注入 --video-meta 与 --visual-review（逐帧人核：回放①列表搜索态→详情页=CONSISTENT；回放②终帧恰两同名异码卡、全程无详情画面=不点击铁证=CONSISTENT）。run-2 回放① verdict 2/2 全 PASS（503 未现——缺陷与 run-1 实例/自动码创建路径相关，精化记账 evidence「503 缺陷相关性精化」节；run-1 账保留=Steven 已采认缺陷的取证与溯源）。
B 金牌自证账本（R5-High）：重写 V1-V6——V2 对 tc prd 全部 checksum【核到值】（逐文件 sha 相等）；V3 纳入终局签认件（Steven/过闸/503 采认要素）；V5 深核真机产物内容（locks v2/replayReady/platformId 19 位纯数字、两放 axes 动作轴与 verdict 字面）；V6 报告四项齐（附件逐件实存、replayVideo/visualReview 非空、账实 sha 前缀对照、清理日志三面归零字面）。金牌头注明示绑见证机（异机红=如实，见证不可迁移）。
C PRD 记账冲突（R1-Medium）：owner prd「待 Steven 人签」→已人签过闸（引 uat-signoff.md）；tc prd task 补 run-1 归档/run-2 重跑审计注记；plan §4a 修正注记（PASS 预期与 run-1 实际的偏差如实记账、run-2 与预期一致）。
D 预置清理 fail-open（R6-Medium）：create 严判前后计数恰等（0→1/1→2）+编码回读必等否则退出不确认；cleanup 卡计数非恰一即 FAIL+删后名称与逐编码三面归零核（nameLike 名码通吃）；运行日志冻结入库 evidence/cleanup-run2.log；脚本四件入库 scripts/ 供审计。

【现成证据（勿重跑）】
金牌 6/6 GREEN、gate GREEN（prd passes 由 gate 写入）；术语钩子过。

【输出要求】
对 A/B/C/D 逐项裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。

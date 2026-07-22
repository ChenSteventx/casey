你是 Casey 仓 agent-id-readback 契约的异构评审员（R1 FAIL→修单→R2 FAIL，阻塞项 H1、H6、M1，其余 7 条你已判 FIXED、且判无新增独立问题）。本轮 R3 只核三个阻塞项的二/三波修复与 plan 权威修正，不重审已 FIXED 项、不重审整仓。工作目录 /mnt/d/ctx/heren/casey-agent-id-readback（只读）。

【材料】
1. 你的 R2 结论：docs/plans/agent-id-readback/review/codex-review-r2.log。
2. 修复 hunks 两段：二波（R2 候选→b920b4f）docs/plans/agent-id-readback/review/fix-hunks-r2-to-r3.patch；三波（b920b4f→当前候选）docs/plans/agent-id-readback/review/fix-hunks-r3-wave3.patch。
3. 处置表 R2 轮增补节+三波节：docs/plans/agent-id-readback/review/fix-dispositions-r1.md。
4. plan §6 权威修正：docs/plans/agent-id-readback/plan.md §6 修正条+§8（授权链=Steven 拍板送 sol max 咨询，review/sol-consult-plan6.log 判「零 SUT 不可达」不成立并给出五面构造；修正与你 R2「走 plan 权威修正」指引同轨）；interface-spec §7 二波/三波增补段同步披露；prd 第五笔 checksumAmendments 记账。

【三阻塞项处置】
H1 句柄连续性（二波）：resolveAgentCardTarget 弃 cards.nth 惰性 Locator——page.evaluateHandle 单次原子快照内圈定命中卡片集合并经 getProperties/asElement 取【ElementHandle】（钉物理节点）；code 从同一句柄二次 evaluate 读出（句柄即节点，替换/摘除如实 detached 失败回 failed）；clickAgentCardWithin 的重验（isConnected/可见/name/code 全等）与点击（card.$(nameSel) 子句柄 click）全部作用于同一物理节点，绝不重新解析；未选中句柄与 name 子句柄逐一 dispose。与仓内 selectNodeDropdown/compile-atoms elementHandle 纪律对齐。TOCTOU 换卡时序在零 SUT 下不可确定性构造，无新增机器钉——如实声明，行为面由 C6/C7/C9 继续覆盖，连续性请你静态核。
M1 引用释放（二波）：tokens 改 WeakSet（账本不强持 token；consumed 一次性由 token 自身标记承载，双 consume 语义不变）；consume 即出账——requestSeq 反查表逐条 delete、requests.clear、waiters 清空；晚到终态自此按未归属请求丢弃。钉=O8a/O8b 保持 + 新增 O8c（consume 后同 seq 晚到终态 lateDrops 不增、复消费恒 consumed）。
H6 探针与五面（二波+三波闭合）：
① 负控升级（二波）：R15 sign v1 happy 真执行（过全部校验+落盘）零身份模块解析；R16 replay 真 v1 件过全部准入到 chromium.launch 哨兵（exit 66）零解析；R17 compile 闸段合法 flow 全跑零解析。
② 面③④落地（二波）：sign-v1-cli.json（三流+完整输出集+逐文件 sha256+prd 字节；双跑探针实证跨运行字节确定——R2 前「确定性未证」假设有误已实测收回；相对路径零绝对路径泄漏）+ cli-early-reject.json（compile/replay 无参三流；sign 无参 usage 属已声明接口合法演进的排除已获 sol 认可）。
③ 残余面②「动作轴/axes/report 字节」（三波，本轮核心）：你 R2 判「不能由低层修单单方消灭原验收义务」——已按此走 plan 权威修正路径：Steven 拍板送 sol max 咨询，sol 判我方「零 SUT 不可达」不成立并给出五面构造，随后全数落地为棘轮面⑦⑧⑨⑩（R18-R21 逐字对照）：
  面⑦ compile-run-v1.json：mock Page/forensics 测试替身（tests/_golden/fixtures/agent-id-readback/mock-page.mjs，行为全由 dom 规格表决定、未登记 evaluate 形态一律抛错）驱【真实】createCompileRun/compileFlow 走 v1 flow，冻 events/verification/entityBindingProvenance/observed 全量+「v1 零身份观察」不变量（?? 归一使 82484ab 与现行同字节）；
  面⑧ action-axes-v1.json：同替身驱【真实】performAction 固定 12 分支 v1 事件脚本（unique fill/press/click、searchOpen 同名双条目 ambiguous、缺席 none、唯一但动作失败、通用多匹配/缺席+漂移探针形状、selectOption 双分支、纯断言、nav→null），冻逐事件动作轴；
  面⑨ axes-projection-v1.json：bin/replay.mjs 浏览器后三轴投影段【逐字搬移】成生产共用纯函数 lib/replay-axes.mjs（bin 与金牌消费同一实现；82484ab..b920b4f 对投影段零 hunks——搬移等价性请你静态核 wave3 补丁），固定证据结构冻完整 axes（归因归一/孤儿并入/凭据路由段打码/blob: 脱敏/协议相对拒绝/intent 折叠洗白禁/软断言透传/多 kind 断言）；
  面⑩ verdict-report-v1.json：面⑨ axes 喂真实 bin/verdict.mjs→bin/report-model.mjs（--generated-at 固定）→bin/report.mjs 三 CLI 链，四态各一（PASS/SUT_DEFECT/NEEDS_HUMAN·INDETERMINATE/NEEDS_HUMAN·AMBIGUOUS_ACTION），冻三流+verdict JSON 全文+axes/verdict/report-model/report JSON 逐文件 sha+产物文件名集。
  基线于 82484ab 窗口重录（九个实现文件检出 82484ab+身份模块移除），既有六面字节零漂移=窗口保真机器证据；红证同窗重取（refit-r3：6/21 红=R1 清单不齐+R12 正控+R18-R21 基线缺席）；退窗现树 21/21 绿=「身份实现不动 v1 字节」机器证据。
  两笔明示排除（同 sign usage 排除口径，冻结的是具体调用矩阵，interface-spec §7 三波段披露）：report 的 html/md 字节属报告模板演进面（plan §6 义务字面=「report 的 JSON 字节」；产物文件名集仍冻）；bin/report.mjs 成功 stdout 打印 resolve 后绝对路径——冻它破跨树可移植（R13 零绝对路径纪律），改冻 status/stderr+产物文件名集+逐文件 sha。
  plan §6 修正条同时把 route:human 收口为只承接真实 DOM/CDP/SUT 行为保真与完整真机 UAT 链（绑结构化 uatCaseId、命名后继契约 real-uat-attestation）。
（另附带：C7 考场自 R2 材料后由 idtwins-hidden 换 idtwins-sync 确定性场景——回放 press→click 零等待使旧 DOM-only 门在 fetch 渲染页有固有竞态、gate 两轮 none 红实证；新考场同步渲卡+信封两行同名，M3 失守必 ambiguous 一击红、82484ab 守恒绿。此为 M3 已 FIXED 钉的考场加固，非语义变化。）

【现成证据（勿重跑）】
零 SUT 金牌修后：观察 31/31（含 O8c）、门 18/18、sign 11/11、棘轮 21/21（R13/R14+R15-R17+R18-R21+R12 正控）；chat-sut 10/10；受影响面复跑 zero-SUT 金牌批（mountdelay-fidelity/replay-entity-anchor/teachin 系/静态预检/units 全批）全绿。real-run-trust.zero-sut 红为先于本契约的陈旧红（其源码字面检查在 82484ab 已不成立、主树同红、无 owner prd 引用），如实挂账交接、不在本契约内顺手修。全 gate 第五轮 GREEN 6/6（story 6/6 过、checksum/term 全过；prd passes 由 gate 写入 @2026-07-22T11:07Z）。

【输出要求】
对 H1、H6、M1 逐项裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；对 plan §6 权威修正裁定接受/拒绝并说理。最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。

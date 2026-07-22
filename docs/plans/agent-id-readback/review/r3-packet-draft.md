你是 Casey 仓 agent-id-readback 契约的异构评审员（R1 FAIL→修单→R2 FAIL，阻塞项 H1、H6、M1，其余 7 条你已判 FIXED、且判无新增独立问题）。本轮 R3 只核三个阻塞项的二波修复与 plan 权威修正，不重审已 FIXED 项、不重审整仓。工作目录 /mnt/d/ctx/heren/casey-agent-id-readback（只读）。

【材料】
1. 你的 R2 结论：docs/plans/agent-id-readback/review/codex-review-r2.log。
2. 二波修复 hunks（R2 候选 → 当前候选）：/tmp/claude-1000/-mnt-d-ctx-heren-casey/05037bcb-8884-4123-b32b-b590c1266fe4/scratchpad/air-fix-hunks-r3.patch
3. 处置表 R2 轮增补：docs/plans/agent-id-readback/review/fix-dispositions-r1.md 末节。
4. plan §6 权威修正（残余字节面处置）：docs/plans/agent-id-readback/plan.md §6 修正段 + 修正授权记录（见处置表/prd checksumAmendments）。

【三阻塞项二波处置】
H1 句柄连续性：resolveAgentCardTarget 弃 cards.nth 惰性 Locator——page.evaluateHandle 单次原子快照内圈定命中卡片集合并经 getProperties/asElement 取【ElementHandle】（钉物理节点）；code 从同一句柄二次 evaluate 读出（句柄即节点，替换/摘除如实 detached 失败回 failed）；clickAgentCardWithin 的重验（isConnected/可见/name/code 全等）与点击（card.$(nameSel) 子句柄 click）全部作用于同一物理节点，绝不重新解析；未选中句柄与 name 子句柄逐一 dispose。与仓内 selectNodeDropdown/compile-atoms:1097 的 elementHandle 纪律对齐。TOCTOU 换卡的时序在零 SUT 下不可确定性构造，无新增机器钉——如实声明，行为面由 C6/C7/C9 继续覆盖，连续性请你静态核。
M1 引用释放：tokens 改 WeakSet（账本不强持 token；consumed 一次性由 token 自身标记承载，双 consume 语义不变）；consume 即出账——requestSeq 反查表逐条 delete、requests.clear、waiters 清空；晚到终态自此按未归属请求丢弃（不入任何事务）。钉=O8a/O8b 保持 + 新增 O8c（consume 后同 seq 晚到终态 lateDrops 不增、复消费恒 consumed）。
H6 探针与五面：① 负控从「无参早退」升级为过校验真路径三条——R15 sign v1 happy 真执行（过全部参数/形状/receipt 校验并落盘产物）零身份模块解析；R16 replay 消费真 v1 冻结件+未声明身份通道剖面，过全部准入校验走到 chromium.launch 哨兵（CASEY_LAUNCH_SENTINEL，exit 66、哨兵文件在）零解析；R17 compile 闸段合法 flow 全跑（非 execute、零浏览器）零解析。② plan §6 面③④落地为冻结面：sign-v1-cli.json（sign v1 happy 固定夹具的三流+完整输出文件集合+逐文件 sha256+prd 字节；双跑探针实证跨运行字节确定——R2 前我方「确定性未证」假设有误，已实测收回；相对路径调用零绝对路径泄漏，跨树可移植）+ cli-early-reject.json（compile/replay 无参拒绝三流；sign 无参 usage 行含 --entity-observations 新旗标文档，属已声明接口的合法演进，不入未声明路径冻结面——sign 三流由面⑤覆盖）。基线在 82484ab（实现 stash）窗口录制。③ 残余=面②中「动作轴/axes/report JSON 字节」：浏览器执行产物、零 SUT 不可达——已按你 R2 指引走 plan 权威修正（非低层修单单方消灭），修正授权与内容见材料 4。
（另附带：C7 考场自 R2 材料后由 idtwins-hidden 换 idtwins-sync 确定性场景——回放 press→click 零等待使旧 DOM-only 门在 fetch 渲染页有固有竞态、gate 两轮 none 红实证；新考场同步渲卡+信封两行同名，M3 失守必 ambiguous 一击红、82484ab 守恒绿。此为 M3 已 FIXED 钉的考场加固，非语义变化。）

【现成证据（勿重跑）】
零 SUT 金牌修后：观察 31/31（含 O8c）、门 18/18、sign 11/11、棘轮 17/17（R13/R14 面对照+R15-R17 负控+R12 正控）；chat-sut 10/10；全 gate GREEN 6/6（prd passes 由 gate 写入）。红证按最新金牌重取（refit-*.red.txt：棘轮红=R12 正控红、观察/门/sign 全红、chat-sut 1 过/9 红——C7 守恒绿如设计）。

【输出要求】
对 H1、H6、M1 逐项裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；对 plan §6 权威修正裁定接受/拒绝并说理。最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。

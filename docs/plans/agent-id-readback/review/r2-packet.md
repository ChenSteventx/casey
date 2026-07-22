你是 Casey 仓 agent-id-readback 契约的异构评审员（家族不同于实现家族；你在 R1 终判 FAIL，阻塞项 C1、H1–H6、M1–M3）。本轮是修复复审：只核原 findings 的处置与修复 hunks，不重审整仓。工作目录 /mnt/d/ctx/heren/casey-agent-id-readback（只读），基线 = 82484ab + R1 候选（你上轮审过的状态）。

【材料】
1. 你的 R1 结论：docs/plans/agent-id-readback/review/codex-review-r1.log（末段 findings）。
2. 修复 hunks（R1 候选 → 当前候选的精确差异，含实现+金牌钉）：/tmp/claude-1000/-mnt-d-ctx-heren-casey/05037bcb-8884-4123-b32b-b590c1266fe4/scratchpad/air-fix-hunks.patch
3. 规格修单：docs/plans/agent-id-readback/accept/interface-spec.md（九处「修单增补/修单 R1-*」标记段）。
4. prd 修单账：loop/prd-agent-id-readback.json 的 checksumAmendments（断言零弱化声明 + 重钉清单）。
5. 无实现态红证（git stash 外科式重钉红）：docs/plans/agent-id-readback/accept/red-proofs/refit-*.red.txt 五份（四零 SUT 全红：30/19/9/2 条 RED；chat-sut 0 过/10 红）。

【逐 finding 处置表（核对 hunks 是否兑现、有无引入新洞）】
C1 编译真接线：bin/compile.mjs 观察件生成后把草稿升 v2（schemaVersion:2 + identityProfileDigest + identityObservationsSha256=观察件原始字节 sha）；声明身份通道时终端 click 数必须恰等观察行数，不齐 exit 65 不产成功产物；compileFlow 归档不齐由静默丢改硬阻断。钉=chat-sut C6 真实 compile→sign→replay 全链（真实产物 v2、真实 sign exit 0、冻结锁携三元组、回放点击 unique）。
H1 物理卡片双锚：lib/agent-search-gate.mjs 新增 resolveAgentCardTarget（容器卡片集合内原子快照数名、同卡读 name+code、回句柄）与 clickAgentCardWithin（点击前同卡重验 connected/可见/name/code、句柄内 name 节点落笔，绝不全页重定位）；lib/agent-identity-gate.mjs dom.code 缺席/空串=action_failed；compile/replay 双侧接卡片门；剖面声明 listApi 即强制 itemContainer+cardFields。钉=G5e/G5f、chat-sut C9（iddom-skew 夹具 DOM 假码）。
H2 归属判据：账本 onRequestWillBeSent 增 queryEcho 严格等（arm 冻结 expectedQuery）；采集器 matchIdentityRequest 同源（--sut origin 精确等）+method+规范化 pathname 精确等+按剖面 queryParam 提回声（导出纯函数）；compile 身份通道下 fill 固定 openName 且 arm expectedQuery=实例化名；replay arm expectedQuery=实例化 fill 值。钉=O9、O11a-c、chat-sut C1（searchKeyword 诱饵 + fill 必须精确 openName）。
H3 hasNextPath 声明即义务：consume 按 channel.hasNextPath 分流——声明则必须严格 false（缺席/undefined/null/0/true 全 invalid）；未声明而投影携 hasNext 亦 invalid。钉=O10a-d。
H4 成功态判据：projectIdentityEnvelope 只认 2xx；successField 在响应体在场必须严格等于 successValue 否则 failed（导出纯函数）。钉=O11d/e。
H5 义务锚定：sign 义务集合从 events 的 atom+action 独立推导、字面量 agent.searchOpen 钉死（source.atom/row.atom 必须精确等、row.kind 必须 agent，自报值不参与推导）；replay v2 权威在场时目标 click 缺已签三元组=立即 action_failed 绝不按首采续跑。钉=c8a/c8b、chat-sut C8（伪造 evidenceStepId 错位锁——内容自哈希重算属 ADR-0010 既有威胁边界内合法构造）。
H6 差分棘轮：poison spy 升级为子进程真实加载探针（spy-loader/spy-hooks 经 node --import 注册解析钩子；负控=compile/replay/sign 三 CLI 未声明路径零身份模块解析、正控=显式 import 必被逮）；compile-atoms/replay-actions 对身份门改动态按需加载；采集器四面基线未重录、继续逐字节绿。诚实缩窄披露：plan §6 允诺的 CLI 三流+完整产物集逐字节面不冻结（sign 产物含 receipt 等跨运行确定性未证字节，冻不确定字节=制造 flaky 假红），改由 C6/C7 行为钉覆盖，axes/events/report 字节面依赖浏览器执行随真机链 route:human——此项请你显式裁定接受与否。
M1 有界终态：settle(token,{timeoutMs,timer}) 到点把未决请求显式写 timeout 终态再放行（账本内兑现、timer 可注入）；consume 前强制 sealed（新增 'unsealed' 态）；两侧调用改用 settle({timeoutMs:5000}) 弃外部 race。钉=O8a/O8b。
M2 判定序：compile/replay 双侧先取信封终态再采 DOM 卡片、一并交纯函数门（完整性先决优先于 DOM 分类）；compile-report 新增结构化 identityGate:{resolution,reason}。钉=chat-sut C10（idpaged-dupdom：信封缺页+DOM 双卡必须 action_failed 非 ambiguous）+C2/C3/C4/C5/C9 类别断言。
M3 版本语义：replay 身份账本只由已验证 v2 冻结权威激活（identityExpectedByStep 非空）；真 v1 件配声明身份通道的新剖面固定走旧 DOM-only 路径。钉=chat-sut C7，考场=新夹具场景 idtwins-sync（按键同步渲一张主卡+照发 fetch、信封仍两行同名——确定性双向：M3 失守的坏代码消费未签信封必 ambiguous 一击红，修后 v1 不建账本同步 DOM 确定 unique；82484ab 上守恒绿）。选确定性考场的原因：回放事件环 press→click 零等待，旧 DOM-only 门在 fetch 渲染页有固有时序竞态（gate 首轮 C7 的 none 红即此、非 M3 信号），竞态属 82484ab 既有时序非本契约改动面。完整处置表见 docs/plans/agent-id-readback/review/fix-dispositions-r1.md。

【现成证据（勿重跑）】
修后金牌：观察 29/29、门 18/18、sign 11/11、棘轮 12/12、chat-sut 10/10，全退出码 0。全 gate 三轮：
首轮/次轮 s5 的 C7 因 82484ab 既有 press→click 零等待竞态红（none、非 M3 信号，gate 如实翻 false 记账），
考场确定性化（idtwins-sync）后第三轮 GREEN 6/6（prd stories passes 全 true，gate 写入）。红证五份如上
（chat-sut 红证已随考场更新重取：1 过/9 红、C7 在 82484ab 上守恒绿、金牌整体仍 exit 1）。

【输出要求】
逐 finding 给裁定：FIXED / PARTIAL / NOT-FIXED / NEW-ISSUE（新洞给 文件:行号 与级别 Critical/High/Medium）。对 H6 的诚实缩窄单独裁定接受/拒绝并说理。最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。

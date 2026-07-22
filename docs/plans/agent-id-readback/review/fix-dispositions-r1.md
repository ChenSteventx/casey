# codex R1 findings 处置表（agent-id-readback 修单，2026-07-22）

R1 终判 `FAIL`（codex-review-r1.log）：C1 + H1–H6 + M1–M3。全部采信修复；每条带修前红对抗钉；
无实现态重钉红走 learn（entity-ui-wiring）#4 合法路径（外科式 `git stash` 只摘实现、金牌/夹具/规格留场），
红证 `accept/red-proofs/refit-*.red.txt`；checksum 重钉入 prd `checksumAmendments`。

| finding | 修复落点 | 对抗钉 |
|---|---|---|
| C1 编译产物停在 v1，platformId 未进闭环 | `bin/compile.mjs`：观察件生成后草稿升 v2（+identityProfileDigest、identityObservationsSha256=观察件原始字节 sha）；终端 click 数≠观察行数即 exit 65 不产成功产物；`lib/compile-atoms.mjs` compileFlow 归档不齐由静默丢改硬阻断 | chat-sut C6：真实 compile→sign→replay 全链（draft v2+双 digest、真实 sign exit 0、冻结锁携三元组、回放点击 unique）；手造 v2 只保留为 sign 面单元考场 |
| H1 DOM 证据只有 name、无卡片 code、无句柄连续性 | `lib/agent-search-gate.mjs` 新增 `resolveAgentCardTarget`（容器卡片集合内原子快照数名、同卡读 name+code、回句柄）与 `clickAgentCardWithin`（点击前同卡重验 connected/可见/name/code、句柄内落笔）；`lib/agent-identity-gate.mjs` dom.code 缺席/空串=action_failed；compile/replay 双侧接卡片门；声明 listApi 即强制 itemContainer+cardFields | G5e/G5f；chat-sut C9（新夹具 iddom-skew：DOM 渲假码必拒） |
| H2 归属不校验同源/查询值、fill 未固定 openName | 账本 onRequestWillBeSent 增 queryEcho 严格等（arm 冻结 expectedQuery）；`lib/replay-forensics.mjs` 导出 `matchIdentityRequest`（--sut 同源精确等+method+pathname 精确等+按剖面 queryParam 提回声）；compile 身份通道下 fill 固定 openName、arm expectedQuery=实例化名；replay arm 同律 | O9、O11a-c；chat-sut C1（searchKeyword 诱饵 + fill 必须精确 openName） |
| H3 声明 hasNextPath 后缺字段被放行 | 账本 consume 按 channel.hasNextPath 分流：声明则必须严格 false（缺席/undefined/null/0/true 全 invalid）；未声明而投影携 hasNext 亦 invalid | O10a-d |
| H4 HTTP 200 失败信封可当成功身份页 | `projectIdentityEnvelope`：只认 2xx；successField 在场必须严格等于 successValue 否则 failed | O11d/e |
| H5 sign 义务由观察件自报 atom 激活；回放缺签仍续跑 | `bin/sign.mjs` 义务集合从 events 按字面量 agent.searchOpen 独立推导；source.atom/row.atom 必须精确等、row.kind 必须 agent；`lib/replay-actions.mjs` v2 权威在场时目标 click 缺已签三元组=立即 action_failed 绝不按首采续跑 | c8a/c8b；chat-sut C8（伪造 evidenceStepId 错位锁——内容自哈希重算属 ADR-0010 既有威胁边界内合法构造） |
| H6 差分棘轮四面自缩、spy 只 grep 静态 import | poison spy 升级子进程真实加载探针（spy-loader/spy-hooks 经 node --import 注册解析钩子；负控=compile/replay/sign 三 CLI 未声明路径零身份模块解析、正控=显式 import 必被逮）；compile-atoms/replay-actions 对身份门改动态按需加载；采集器四面基线未重录继续逐字节绿。plan §6 的 CLI 三流/完整产物集逐字节面**诚实缩窄**：sign 产物含 receipt 等跨运行确定性未证字节，冻不确定字节=制造 flaky 假红——改由 C6/C7 行为钉覆盖，axes/events/report 字节面随真机链 route:human（interface-spec §7 披露，交 R2 显式裁定） | R9-R12 |
| M1 settle 无界、consume 不要求先 seal | `settle(token,{timeoutMs,timer})` 到点把未决请求显式写 timeout 终态再放行（账本内兑现、timer 可注入）；consume 前强制 sealed（新增 unsealed 态）；两侧调用改 settle({timeoutMs:5000}) 弃外部 race | O8a/O8b |
| M2 先跑 DOM 门致信封失败被分类成 absent/ambiguous | compile/replay 双侧先取信封终态再采 DOM 卡片、一并交纯函数门（完整性先决优先于 DOM 分类）；compile-report 新增结构化 identityGate:{resolution,reason} | chat-sut C10（新夹具 idpaged-dupdom：信封缺页+DOM 双卡必须 action_failed 非 ambiguous）+C2/C3/C4/C5/C9 类别断言 |
| M3 v1 件配新剖面被启用身份账本 | `bin/replay.mjs` 身份账本只由已验证 v2 冻结权威激活（identityExpectedByStep 非空）；真 v1 件配声明身份通道的新剖面固定走旧 DOM-only 路径 | chat-sut C7（idtwins-sync 确定性考场：同步渲卡+信封两行同名——M3 失守必 ambiguous 一击红、82484ab 守恒绿） |

## 修单过程中的追加事实

- gate 首轮/次轮 C7 红（resolution none）：真因=回放事件环 press→click 零等待（settleBeforeCapture 只跑
  intent 末事件、而 searchOpen 末事件即 click），旧 DOM-only 门在 fetch 渲染页有固有竞态——C7 是全仓唯一
  踩「旧门+fetch 渲染页」组合的检查（entity-ui-wiring 列表页为同步渲染）。处置=考场确定性化
  （idtwins-sync），不用重试遮竞态；此竞态属 82484ab 既有时序、非本契约改动面，真机侧影响随
  route:human 链评估。
- 修后全绿：观察 29/29、门 18/18、sign 11/11、棘轮 12/12、chat-sut 10/10；全 gate 复跑见 prd passes。

# R2 轮增补（codex R2 终判 FAIL：H1/H6/M1 PARTIAL，7 条 FIXED、零新增独立问题）

| R2 裁定 | 二波修复落点 | 钉 |
|---|---|---|
| H1 PARTIAL（句柄连续性：cards.nth 惰性 Locator 每次消费重新解析） | `resolveAgentCardTarget` 改 evaluateHandle 单次原子快照圈命中集合并取【元素句柄】（ElementHandle 钉物理节点）；code 从同一句柄读出；`clickAgentCardWithin` 重验与点击全作用同一物理节点（card.$ 子句柄点击）；句柄逐一释放（selectNodeDropdown 同款纪律，compile-atoms:1097 对齐） | 行为面由 C6/C7/C9 继续覆盖；连续性属结构纪律，交 R3 静态核（TOCTOU 换卡时序零 SUT 不可确定性构造，如实声明不冒充有钉） |
| M1 PARTIAL（消费后 tokens/byRequestSeq 引用不释放） | tokens 改 WeakSet（账本不强持 token，consumed 一次性由 token 自身标记承载）；consume 即出账：requestSeq 反查表逐条删、requests 清空、waiters 清空；晚到终态按未归属丢弃 | O8c（consume 后同 seq 晚到终态 lateDrops 不增+复消费恒 consumed） |
| H6 PARTIAL（负控只测无参早退；五面义务未兑现；缩窄被拒） | ① 负控升级为过校验真路径：R15 sign v1 真执行（全校验+落盘）零解析、R16 replay 真 v1 件过全部准入到 chromium.launch 哨兵（exit 66）零解析、R17 compile 闸段合法 flow 全跑零解析；② 面③④ 落地：sign-v1-cli.json（三流+完整输出集+逐文件 sha256+prd 字节；双跑探针实证跨运行字节确定、相对路径零绝对路径泄漏——R2 前「确定性未证」的假设被实测推翻，收回）+ cli-early-reject.json（compile/replay 无参三流；sign 无参 usage 含新旗标文档属已声明接口合法演进不入未声明面）；③ 残余=面② 的动作轴/axes/report 字节（浏览器绑定零 SUT 不可达）——按 R2 指引走 plan 权威修正路径，交 Steven 拍板（不再由修单单方消灭） | R13/R14 面对照、R15-R17 负控；基线于 82484ab stash 窗口录制 |

# sol max 咨询结论（plan §6 残余面，2026-07-22 晚；Steven 拍板送审）

`CHANGES REQUIRED`（review/sol-consult-plan6.log）——我方「动作轴/axes/report 字节面零 SUT 不可达」判定不成立，
sol 给出可落地构造（下一 session 实现清单，Steven 拍板交接）：
1. Page/forensics 测试替身驱动【真实】createCompileRun/compileFlow → 冻 events 字节；
2. 同替身驱动【真实】performAction → 冻 v1 动作轴字节；
3. bin/replay.mjs 浏览器后 axes 投影抽成生产共用纯函数 → 冻完整 axes 字节（生产重构，碰 bin/lib）；
4. verdict + 固定 generatedAt 的报告装配（assembleReportModel/renderReport）→ 冻 report JSON 字节；
5. 全程零浏览器/零网络/零 SUT、逐字比较、不 normalize。
已认可项：sign 无参 usage 排除成立（修正文须写明冻结的是具体调用矩阵）；route:human 只承接真实
DOM/CDP/SUT 行为保真与真机 UAT，须绑结构化 uatCaseId + 命名后继契约（可接 real-uat-attestation）。
plan §6 修正案本 session 未落（等构造实现后一并改，避免 plan 先行承诺）。
另注意 sol 附带重申的两笔既有账：① SKILL.md:107 与范围化例外的措辞统一（已在 prd observability
route:human）；② compile 清场清单已含 identity-observations.compile.json（bin/compile.mjs 失败路径
rmSync 已覆盖，sol 引用的行号为 82484ab 旧影——下一 session 复核一眼即可）。

# 三波修复（sol 五面构造兑现，2026-07-22 晚；H6 残余收口）

| 项 | 三波落点 | 钉/证据 |
|---|---|---|
| H6 残余「动作轴/axes/report 字节面零 SUT 不可达」 | sol 咨询证伪后按其构造清单全数落地：①面⑦ `compile-run-v1.json`——mock Page/forensics 测试替身（`tests/_golden/fixtures/agent-id-readback/mock-page.mjs`，行为全由 dom 规格表决定、未登记 evaluate 形态一律抛错）驱【真实】`createCompileRun`/`compileFlow` 走 v1 flow（nav 路由+搜索编码收敛 fill/press/click 文本锚），冻 events/verification/provenance/observed 全量+「v1 零身份观察」不变量（?? 归一使 82484ab 与现行同字节）；②面⑧ `action-axes-v1.json`——同替身驱【真实】`performAction` 固定 12 分支 v1 事件脚本（unique fill/press/click、searchOpen 同名双条目 ambiguous、缺席 none、唯一但动作失败 action_failed、通用多匹配/缺席+漂移探针形状、selectOption 双分支、纯断言 kind:none、nav→null），冻逐事件动作轴；③面⑨ `axes-projection-v1.json`——`bin/replay.mjs:799-881` 投影段逐字搬移成生产共用纯函数 `lib/replay-axes.mjs`（bin 与金牌消费同一实现；82484ab..b920b4f 对投影段零 hunks，搬移 diff 交 R3 静态核），固定证据结构（归因归一/孤儿并入/凭据路由段打码/blob: 脱敏/协议相对拒绝/intent 折叠洗白禁/软断言透传/多 kind 断言）冻完整 axes；④面⑩ `verdict-report-v1.json`——面⑨ axes 喂真实 `bin/verdict.mjs`→`bin/report-model.mjs --generated-at 2026-07-22T08:00:00.000Z`→`bin/report.mjs` 三 CLI 链，四态各一（PASS/SUT_DEFECT/NEEDS_HUMAN·INDETERMINATE/NEEDS_HUMAN·AMBIGUOUS_ACTION），冻三流+verdict JSON 全文+axes/verdict/report-model/report JSON 逐文件 sha+产物文件名集 | R18-R21 逐字对照；红证 `refit-r3-agent-id-regression-diff.zero-sut.red.txt`（82484ab 窗口 6/21 红=R1 清单不齐+R12 正控+R18-R21 基线缺席）；基线 82484ab 窗口重录、既有六面字节零漂移（窗口保真机器证据）；退窗现树 21/21 绿=「身份实现不动 v1 字节」机器证据 |
| plan §6 权威修正 | §6 新增修正条（sol 认可措辞边界）：面②字节面由「不可达随真机链」修正为【具体调用矩阵冻结】（上述①-④逐条列明）；明示排除=sign 无参 usage（已声明接口演进）+ report html/md 字节（报告模板演进面，义务=report 的 JSON 字节、文件名集仍冻）+ `bin/report.mjs` 成功 stdout（resolve 后绝对路径，冻它破跨树可移植/R13 零绝对路径纪律，改冻 status/stderr+sha 集）；§8 route:human 只留真机事实面+绑结构化 uatCaseId+命名后继契约 `real-uat-attestation` | plan.md §6 修正条+§8；interface-spec §7 三波增补段同步 |
| sol 附带两笔既有账复核 | ① SKILL.md:107 措辞统一：已在 prd observability route:human（Steven 另日处理，未动）；② compile 失败路径清场含 `identity-observations.compile.json`：现行 `bin/compile.mjs` rmSync 清场清单已含该件（sol 引用行号为 82484ab 旧影，复核毕无需改） | 只读复核，零实现改动 |

三波过程附加事实：面⑩首録断链（`assembleReportModel` 拒缺 `op` 的 postAssertion）——夹具断言改 schema 规范形
（`envelopeOk`/`absent`/`appears`）后全链 exit 0；断链版基线未冻结、红证/基线同窗重取重录。
受影响面复跑：zero-SUT 金牌批（mountdelay-fidelity/replay-entity-anchor/teachin 系/静态预检/units 全批）全绿；
`real-run-trust.zero-sut` 红为先于本契约的陈旧红（其源码字面检查 `const ctx = { uniqueName, baseUrl: sut` 在
82484ab 已不成立，主树同红、无 owner prd 引用——如实挂账交接，不在本契约内顺手修）。

# 四波修复（codex R3 三 PARTIAL 全采信，2026-07-22 晚）

R3 终判 FAIL 但机器五面被判「已闭合」（R18-R21 驱动生产链成立、投影搬移语义成立、调用矩阵与两笔排除接受）；
三笔残余全采信修复：

| R3 裁定 | 四波落点 | 说明 |
|---|---|---|
| H1 PARTIAL·Medium（命中卡 ElementHandle 转交调用方后无 dispose，成功/双证拒/点击失败路径持有到页面关闭） | `lib/compile-atoms.mjs` 与 `lib/replay-actions.mjs` 身份路径：cardGate 取得后整段 try/finally，`cardGate.card.dispose()` 全路径兜底释放（clickAgentCardWithin 只释放自建 name 子句柄，命中卡句柄的账在调用方——与 selectNodeDropdown 释放纪律对齐） | 资源纪律面，零 SUT 无确定性构造（同 R2 对句柄连续性的处理口径），交 R4 静态核；行为面 C6/C7/C9 复跑绿 |
| M1 PARTIAL·Medium（`ctx.identityTokens` 强引用 Map 消费后不删，长流程按身份 intent 累积已消费 token） | `lib/replay-actions.mjs` doAgentSearchOpen：`consume(token)` 后随即 `ctx.identityTokens.delete(ev.intentId)`——消费即出账延伸到调用方层（账本层 O8c 钉不变） | 调用方 Map 属 bin 进程内态、零 SUT 无金牌可钉，交 R4 静态核 |
| H6 PARTIAL·High（plan 只有散文「绑结构化 uatCaseId」、无实际字段与冻结 UAT 定义） | sol 必改项三件套落实际字段：prd observability route:human 项新增 `uatCaseId: tc_agent_id_readback_real_uat_v1` + `successorContract: real-uat-attestation` + `uatDefinition`（冻结四步定义：真机执行权威产 v2 产物→sign 五元 join 人签→回放点击前对已签 platformId+同名敌意必 AMBIGUOUS→报告三形态交付=过闸；真机产物含时间戳按行为核验、不宣称跨运行逐字基线——sol 咨询边界一并冻入）；plan §8 绑同一具体值与定义指针 | plan §6 修正的其余部分（调用矩阵/排除/机器边界）R3 已接受，本笔只补 UAT 绑定前提 |

## 评审状态快照（当前）

R1 FAIL(1C+6H+3M) → 修单一波+钉 → R2 FAIL(H1/H6/M1 PARTIAL、7 FIXED、零新增) → 二波修复
（H1 ElementHandle 钉扎、M1 WeakSet+消费出账+O8c、H6 面③④+过校验负控 R15-R17）→ gate 第四轮
GREEN 6/6 → 三波修复（sol 五面构造⑦⑧⑨⑩全数落地 + plan §6/§8 权威修正 + interface-spec §7 披露，
棘轮 21/21）→ gate 第五轮 GREEN 6/6 → codex R3 FAIL（机器五面闭合；余 H1 句柄释放/M1 调用方
Map 出账/H6 UAT 三件套未落字段）→ 四波修复已落 → 待 gate 第六轮 + codex R4 终判。

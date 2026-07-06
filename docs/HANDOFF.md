# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。
> 下方「当前状态」是权威现状；「历史层」仅供溯源。

## 当前状态（2026-07-07 凌晨，Steven 三问审计 + 点单四契约全收口——移交包 / 断言提硬 / 欠账清洗 / 飞轮第五条）

上节「四契约六提交」后，Steven 三问（① 移交同事就绪度 ② 计划遗失复核 ③ 飞轮还不够）→ 四路扫描审计答卷 → 点单四契约按其序全收口入 dev。baton 空闲，下一契约直接 `contract init`：

1. `btn-enable-ops`（full，`c33d519`）：`buttonState` 补 `enabled`/`disabled` 双 op（wf-publish-states 明令挂账兑现，`bin/check.mjs` 法定 op 集 2→4、drafter mapAtom 同步吃四态）——判据 Steven 人签「标准判据 + profile 类名补判」：disabled 属性 ∨ `aria-disabled="true"` ∨ `profile.buttons.disabledClass` 命中；`buttonDisabledHits` 双通道采集镜像 buttonHits、`disabledClass` 存 `.trim()`（`classList.contains(' padded ')` 静默 false 假 enabled 实证）；评估器 `Number.isInteger + >=0` 双闸封 NaN fail-open（`hits<=0` 对 NaN 为 false 曾直判 enabled 真——codex R1-F1 红跑实锤）、`hits===0` 一律 ok:false（按钮不在场证不出 enabled/disabled）。publish-sut 加 disabledBtn 三形态对抗场景；wf-publish-states 金牌 U2/U3/D1 生命周期翻转 + prd 重签。codex 两轮 R2 PASS。真机 disabled 类名采样填 `profile.buttons.disabledClass` 挂 route:human。
2. `handover-pack`（light，`62d8acb`）：移交包——`README.md` 建成（八节：定位/环境要求/安装/CLI+MCP+skill 三面用法/七相流水线/凭据纪律「真值一律带外交付，绝不入库/提交/回显」/目录地图/排障，全 URL 仅回环）+ `.claude/skills/casey/SKILL.md` 清 `D:\` 硬编码 + MCP server WSL 挂载注释；漂移锁金牌 C1–C3（README 命令行↔真 help 逐字对齐）。codex 四轮 R4 PASS（R2 残项根因 = 评审包用「…」省略 sign 用法——评审包不许省略的元教训）。真机侧移交两项（MCP 真机挂载核验 / 凭据带外交付演练）route:human 挂账。
3. `plan-debt-sweep`（full，`44fb1df`）：计划遗失复核的欠账兑现——① `capturedAgainstBuild` 自动提取接线 `bin/compile.mjs`（07-02 签核 ⑥ 兑现：入口 HTML 脚本 `src` 抓 `[?&]v=` 前端发版号，取不到 fail-safe null）；② `bin/sign.mjs` 冻结期字面量 lint（断言字符串值含 `atl_` 裸前缀（非 `{{uniqueName}}` 模板）或 9+ 位时间戳 → exit 65，堵一次性值冻进断言）；③ `CONTEXT.md` 三行陈旧修正（verdict.json 最小五字段+report-model 指针 / trace 未建挂账 / recorder-as-library 已被 ADR-0006 取代）；④ design + report-spec 各加「已知偏离」errata 表（文实不符显式记账不静默）。codex 一轮 R1 PASS（5 Low 全挂账向）。
4. `wf-open-smoke`（direct，`7027d53`）：飞轮第五条只读零缝暖场——`nav.workflowManagement` + `workflow.open` 两纯加法编译原子（`COMPILE_KNOWN_ATOMS` 11→13）；容器归属闸（codex R1-F1 High：text-exact 全页唯一仍可能是同名非行控件——命中须在表格行/卡片双布局记录容器内，容器外硬阻断 fail-closed 不点；碰撞反例红跑实锤 exit 0 真点了按钮→修后 65）；身份闭环（夹具行名通路渲染被打开名 + `textVisible` 去前缀子串断身份——`atl_` 裸字面量被上条 lint 禁，其误伤面第一个实证）；flow-bridge 金牌三钉点例翻 `workflow.addNode` + prd-flow-bridge / prd-p5-replay 重签。codex 两轮 R2 PASS。机制缝递减序 3→1→0→1：零缝不是常态、暖场也暴露真闸。
5. 三问答卷（四路扫描审计，锚点见各契约）：① 移交——README 落地前对人类同事接近零入口，现八节自包含 + 三面漂移锁盯防再滞后；剩真机侧两项 route:human。② 计划对账——P0–P9 机制面全建（heal 唯一诚实桩），遗失项已由 plan-debt-sweep 兑现或显式 errata 记账；`casey run` 编排器起于相3、相0–2 前段接线属真机 bring-up 后契约。③ 飞轮——4→5 条（catalog_wf_crud / chiefcomplaint_smoke / wf_publish_states / wf_history_version / wf_open_smoke），覆盖 dom_crud / chat / 发布状态 / 弹窗 / 列表打开五路径；R9 坐标画布维度 23 条仍 blocked（画布原子无编译知识，现被两处金牌当天然反例用）；真机停站现三条 hermetic 半程，可一次行程合并。

以下为本日早前时段快照（2026-07-06 晚：相0 建成 + hermetic 全链贯通 + 三面对齐——七相全建、首尾成链、三面同真），只溯源：

本 session 四契约六提交入 dev（Steven「把剩下的相都跑完」+「先继续做」+「先清目录，然后接着干」+ 三承重决策签核：D3 `source.kind` 必填 / D6 存 raw / D7 只当校验器）：相0 归一（最后一个未建相）建成 → 姊妹 CLI 回显缝收口 → hermetic「文本→报告」全链首次贯通为集成金牌 → CLI/MCP/skill 三面对齐现状。baton 空闲，下一契约直接 `contract init`：

1. `ingest`（相0 归一，full，`b7c8f61`）：`tests/_golden/schemas/testcase.schema.json` 冻结形态契约（draft-07、additionalProperties:false 处处、必填 schemaVersion/caseId/source.kind/steps/uniquePrefix；`uniquePrefix` `^\S+$` 封「纯空白过 compile 长度闸」缝、`preconditions` 数组形态是唯一守点——下游对非数组静默吞）+ `lib/parse-testcase.mjs`（手写闸与 schema 同刻——金牌 C4 从 schema 文件读必填集/enum 现场构造坏输入锁双源；语义闸 intentId 全局唯一 + caseId 一致；手写 JSON 数据投影器：不调 toJSON、own enumerable data、数组稠密 own、`Object.create(null)` 防 `__proto__` setter——校验对象=落盘对象按构造同一）+ `bin/ingest.mjs`（薄 CLI 镜像 flow-bridge：凭据门前置扫输入原文 exit 1 早于解析/回显/mkdir；输出通道三封——成功日志只回显定名产物、读失败只回显 errno、落盘异常捕获 65）+ `bin/casey.mjs` 接线（桩换 runNode + help 真实旗标 + 顺手补 flow-bridge help 行）。金牌 C1–C22（16 起红先行 14 败/2 过，评审期 +C17..C22 逐轮钉红）。codex 七轮 R7 PASS（12 发现 = 10 采信 + 2 修正采纳；R6 High：`JSON.parse` 建 `__proto__` own 键 + 投影赋值触发原型 setter——必填从原型链满足、落盘成空壳，经 CLI 候选文件端到端可达、红跑 exit 0 实锤）。产物 `testcase-<caseId>.json` 直喂相1，round-trip 金牌证相0→相1→compile gate 三段贯通。learn 六教训落 `docs/plans/ingest/learn.md`。
2. 挂账：① 姊妹 CLI 同族缝**已收口**——`caseid-echo-mask`（direct，`d3a5c11`）六处拒绝分支原值回显封缝（compile:267 / draft:40 / flow-bridge:31 / sign:87,90,91，哨兵三断言金牌红先行 0/6→6/6，codex 一轮 R1 PASS，五涟漪金牌零行为差）；余留全仓输出通道系统审计另立契约（prd-caseid-echo-mask observability）；② caseId 形态接缝张力——testcase `^[A-Za-z0-9_-]+$` 宽于 events `^tc_[a-z0-9_]+$`（记 prd-ingest observability，route:human）；③ `casey run` 编排器仍起于相3，相0–2 前段接线属后续契约（真机 compile bring-up 后才有意义）。
3. `e2e-chain`（light，`365c185`）：hermetic「文本→报告」全链首次贯通——十站集成金牌 `tests/_golden/e2e-chain.golden.mjs`（C1–C8）：候选文本(mock 归一)→ingest→flow-bridge(mock mapping 含 assert.* 原子)→compile gate→confirm 门(手编，p3 金牌先例)→execute(fake-sut + --skip-login + AT_SITE_JSON 合成隔离 + 凭据 env 毒化陷阱)→draft(+patch 补 nav 硬断言防 INDETERMINATE)→sign(CLI 真签面 + 最小 prd 夹具)→casey run→verdict 3 intent 全 PASS→报告三件。bring-up 首跑零集成缝（各相接缝纪律迟到红利）。codex 四轮 R4 PASS（15 发现全打金牌断言强度：11 采信——源头期望集 deepEq 钉死/参数双侧闭环/prd 回写 sha256 实算/cwd:tmp；2 修正采纳——真回放铁证钉 axes 取证轴（保存 POST 按步归因+信封 ok+轮询 null 归因+identityReadback）不改冻结夹具；2 证伪留案指认既有守点）。零 lib/bin 改动。链金牌 ~35s 不入 tier1、gate acceptance 位。
4. `cli-mcp-face`（light，`0d0d779`）：CLI/MCP/skill 三面对齐现状——① `bin/casey.mjs` 的 replay/verdict/report 分发桩换 `runNode` 直通（底层 bin 早已建成、run 编排内部直连在用；镜像五先例；heal 保持真桩）+ help 真实旗标；② `mcp/casey-server.mjs` 工具目录 6→12（新增相0–2 六工具、修 `casey_run` 为真 runPipeline 签名、verdict/report 去「诚实桩」误标）0.1.0→0.2.0、协议/传输零动、`TOOLS` 导出供金牌直测；③ `.claude/skills/casey/SKILL.md` 命令映射表逐行真实旗标 + 进度段改现状（立场段零动）。漂移锁金牌 `cli-mcp-face` C1–C7（工具名集/版本 deepEq、argv 映射表 12 工具全量旗标钉死含 camelCase→kebab 与布尔负形态、MCP 层 ingest happy 全管道真产物、九生命周期工具空参落真用法错码——`report` 用法错历史码 exit 2 如实标注、收敛另案挂账）。codex 两轮 R2 PASS（R1-F1 High 映射未真验→TOOLS 导出 argv 表 deepEq；R1-F2 修正采纳分层锁）。红先行 1过/4败；六涟漪金牌含 e2e-chain 全链复跑零行为差。
5. 端到端诚实交底更新：hermetic 机制面七相全建且首尾成链（集成金牌锁定）、CLI/MCP/skill 三面同真（漂移锁金牌盯防再滞后）；「文本用例→报告」真机端到端仍需一次真机 compile bring-up（ADR-0003）+ 相2 人签在场，全属 route:human（记 prd-e2e-chain observability）；相5 自愈不在链上（happy 链不触发，维持未吃过真场景交底）；`heal` 是 CLI 唯一诚实桩。

以下为本日早前时段快照（三相补齐：相2 sign + 相1 flow-bridge + 相3 video-login-carry），只溯源（其「相0 归一是唯一剩口/下一 session 地基」已由上条收口）：

本 session 续三契约三提交入 dev（Steven「三块全建」+ 规范嵌套 TestCase + sign 未签闸硬接 replay 前置闸），把「文本用例→报告」流水线前半段的两处 stub/缺口补成真机制。端到端唯一剩口 = 相0 归一 ingest（下一 session 地基）。baton 空闲，下一契约直接 `contract init`：

1. `sign`（相2 人签门，full，`2497309`）：`bin/sign.mjs` 草稿→冻结签署 CLI 建成（此前为 stub）——两段式 fail-closed 落盘（全 `.tmp` 后 rename，precheck 路径碰撞/原型键/目录副作用）、caseId 路径安全、冻结产物须 `.json` 非 events-/spec- 形态、prd.caseId 绑定、pending 非空默认拒（`--force` 写 sidecar）、expectedVerdict 仅 `--verdict-baseline` 且守 fail-safe 不变量、cred-gate 覆盖冻结+sidecar+prd+归档。`assertSignedContract` 未签前置闸硬接 `bin/replay.mjs`（Steven 两次确认硬接、含知悉约九件 golden 涟漪）+ caseId 绑定闸。codex 七轮 R7 PASS（落盘原子性边角：`.tmp` 派生碰撞 / 归档副作用 / 归档目录在 frozen.tmp 下）。金牌 `p2-sign` 23 检查。九涟漪 golden 经 `signExpected` 重签盖 signedAt/signedAgainstBuild/signerId + 各 prd testChecksums 重签。
2. `flow-bridge`（相1 LLM flow 草拟桥，full，`ef13787`）：补 compile「LLM 一次编译」链条唯一没落地的机制口——规范嵌套 TestCase + CLI 外 LLM mapping → compile 吃的 flow。`lib/flow-bridge.mjs`（buildFlow + validateBridge 三闸：投影忠实 / 编译知识允许集 / 复用 compile-gate.validateDraft）+ `bin/flow-bridge.mjs`（薄 CLI，cred-gate 输入前置早于校验回显与 mkdir、任一闸 exit 65 零落盘）+ `lib/compile-atoms.mjs` 加法（编译分派表 `Object.create(null)` 单一事实源、允许集由其键派生、`Object.hasOwn` own-key 判定）+ `bin/casey.mjs` 接线。codex 三轮 R3 PASS（R1 五含允许集非单一事实源 / route:human 通道太弱；R2 三含分派表原型链键绕过）。金牌 `flow-bridge` 16 检查。route:human 跳过须带 reason 留痕、不得又被 mapping 覆盖。
3. `video-login-carry`（相3 回放，full，`bb6f594`）：修回放舞步登录态 carry——loginBootstrap 后从 page1 采 sessionStorage 快照、page2 首 goto 前经 `addInitScript` 注入（带 origin 守卫、entries 数组防 `__proto__` 污染）；`login-sut` 夹具加 `/app-session` tab 级会话模式（随机三键、`close()` 等 `'close'` 事件保 capture flush 确定性）。codex 四轮 R4 PASS（R3-F1 capture 输出扫描竞态）。
4. `replay-video`（full，`f291c70`，上一 session 末收口、本次刷入 HANDOFF）：回放视频录制补上——`newContext({ recordVideo })` + 落 runDir + 报告接线 + 凭据卫生（视频不含登录期镜头）。兑现下方 07-03 快照第 5 条视频挂账——报告 `attachments.video` 槽不再永空。codex 五轮 R5 PASS。
5. 端到端可用性诚实交底（用户三问「cli/skill 能否直接输入用例产报告」）：hermetic 引擎（相3 回放→相4 裁定→相6 报告）跑通，`scripts/sample-report.mjs` 手写 spec 端到端产样例报告为证（`runs/sample-wf-publish/tc_wf_publish_sample.report.html`）；但「文本用例→spec」前半仍需一次真机 compile bring-up（ADR-0003，LLM 编译期真机跑产地面真值 + 补缺失原子飞轮），且相0 归一 ingest 尚未建（下一 session 地基：`lib/parse-testcase.mjs` + `tests/_golden/schemas/testcase.schema.json` + `bin/ingest.mjs`）。第三面是 MCP server、非 webui。

以下为 2026-07-03 时段快照（飞轮三/四 + 报告诊断），只溯源（其第 5 条视频挂账已由上「replay-video」收口）：

本 session 续三契约三提交全收口（Steven 点单「b再c再a」+ 选型/路线拍板），飞轮铺到三维度、机制缝递减假设终点验证，baton 空闲：

1. `wf-publish-states`（full，飞轮第三条 dom_crud 余量）：发布状态机×按钮态。`buttonState` 提硬（`IMPLEMENTED_KINDS` 10→11，present/absent 双 op）+ 词表收窄（`enabled`/`disabled` 挂账 `publish_blocked` 带实现回归）+ schema `assertionOp` +present 重签；`buttonHits` 双通道采集（role 必采 + `profile.buttons.extraSelector` 补采）+ `buttonSeen` 活性反证（absent 判真须通道活着，盲区证不出）；`workflow.publish` 编译知识；publish-sut 四场景对抗夹具。codex 两轮 R2 PASS（R1 两 High：absent role 盲区假绿 + 补采无可见性过滤）。涟漪四重钉（kinds-harden/chiefcomplaint/p4-drafter 未实现范例换 `switchState` + 精确计数移交前沿）。选型摸底纠错档：`echo_default_on` 实为画布维度（坐标拖拽 + `switchState`），`FLYWHEEL`/`CONTEXT` 已纠。`158ead2`。
2. `report-diagnostics`（light，P7 报告消费侧）：报告加「回放诊断」栏目——`renderReport(model, diagnostics)` 可选第二参（单参字节级零差异，`DIAG_CSS` 条件注入）+ `bin/report.mjs` 旁件旗标（缺席零行为差、坏件六形态 fail-closed）+ `casey run` 相6 接线；`run-metrics` 全局指标行（标注仅诊断不进裁定）+ `run-history` 按 `intentId` 嵌步卡 + 未归属小节。诊断标量 `://` 零容忍脱敏（路 B 绕过装配器脱敏，呈现层补防线）。codex 三轮 R3 PASS（R1 四发现 + R2 一发现：CSS 零行为差、旁件值走私绝对 URL、坏件语义枚举）。replyText 摘录挂账经侦察核销（`observed.replyText` + 断言 `actual` 两通道早已在渲染）+ U5 回归锁。`report-model` 与全部冻结 schema 零动。`7ca5fc6`。
3. `wf-history-version`（direct，飞轮第四条）：历史版本弹窗，零机制缝——机制缝递减 3→1→0 终点验证。两纯加法编译原子（`workflow.clickEditorButton` click / `workflow.closeDrawer` press Escape）+ publish-sut 夹具扩历史版本弹窗，断言全为已实现 kind（`textVisible`/`buttonState`/`textHidden`）。codex 三轮 R3 PASS（R1 三 High + R2 一残项：direct 不豁免评审深度——关闭效果没断、event shape 没全锁、断言 intent 挂靠没验）。共享夹具耦合当场捕获修复（历史版本钮走 `mk()` 保 divButtons role 全盲，wf-publish-states I3 涟漪重签）。`7ec2ff2`。
4. A 会话异常闭环机器可备部分就绪：`runs/tc_chiefcomplaint_smoke/run_1783054730282/defect-handoff.md` 已写（两笔缺陷单——① 智能体回复「会话异常」② 登录凭据走 GET query，各带现象/裁定依据/建议，零凭据值零目标地址）。剩余全 route:human：Steven 转交平台 → 修复后拉隧道复跑见绿。
5. 新挂账（本 session 用户三问揪出）：**回放报告无视频根因 = `bin/replay.mjs` 的 `newContext()` 未启 `recordVideo`**（报告 `attachments.video` 槽永空，非隧道问题）——补录视频是 P7/replay 加法契约候选。`cases/`/`runs/` 全 gitignored（凭据卫生），报告只在真机 `casey run` 后本地产；新两条 tc（`tc_wf_publish_states`/`tc_wf_history_version`）从未真机跑、无报告，四停站待 route:human。

以下为本日早前时段快照（七契约六提交，飞轮第二条真机贯通 + Casey 首个真机 `SUT_DEFECT`），只溯源：

1. `run-history`（light）六阶段收口：`casey run` 接回放历史/回放指标真产出——`bin/replay.mjs` 三 opt-in 旗标（`--run-history`/`--run-metrics`/`--run-id`，缺省行为一字不变），纯观察者逐 event 收集（零新增等待防污染取证归因窗）、与 axes 同刻过凭据门写出；编排器传 `runId`=目录名。codex 两轮 R2 PASS（R1 四发现：三采信含零事件空行真缺陷钉红修绿、一证伪留案）。`f3b0aa6`。
2. `chiefcomplaint-smoke`（full，飞轮第二条）hermetic 半程收口：`IMPLEMENTED_KINDS` 7→10（`replyContains`/`replyMatches`/`textHidden`）+ 流谓词普化（`profile.chat.streamUrlPattern` 命中或 legacy `/streamReply/` 兼容）；动态流等待两轮收紧（本步发起 且 命中对话流 URL 域才等——背景长流/本步附带非对话流都不拖步，40922ms 修前红实证）；keydown 触发垫（`fill`+Space+Backspace 三 event，冻结枚举内绕开 pressSequentially 缺位）；reply 双侧采集带陈迹基线（旧气泡绝不当新回复）；五原子编译知识（`nav.agentManagement`/`agent.searchOpen`/`agent.openTestPanel`/`chat.sendAndWait`/`chat.closeTestPanel`）；`chat-sut` 五场景对抗夹具（happy/error/stale/bgstream/leaky）。codex 三轮 R3 PASS + 审后微调 R4；`kinds-harden` golden 精确计数重钉（涟漪补冻：精确计数移交最新前沿 golden 持有）。`ab8587d` + `dcd48e3`。
3. `compile-caseid-shape`（direct）六阶段收口：caseId 穿越拒门（镜像 `draft.mjs` 先例，`x/../../evil` 真穿越 exit 0 双红实证）+ `urlPathname` matches 空正则封死（`chiefcomplaint` 评审挂账并批）。缺席推定记档、Steven 回场已追认。`69ab478`。
4. `chief-bringup`（direct，真机 bring-up 四修）：五只读探针定点四处假设差——`nav.agentManagement` 路由导航优先（`profile.routes.agentList` 接线；点击被 `hr-submenu`/spacer 拦 + 父 `li` 多匹配实证）；失败步不堆等（30s 级后置等待堆积曾撞死 120s 看门狗、连诊断不落）；消息框语义 `exact:false`（真名「请输入消息...」带省略号）；`agent.openTestPanel` networkidle 有界前置 + 点空重点采集自愈（间歇吞点实证；重点不产 event，回放期风险 fail-safe 兜）。真机编译零非 unique 步跑通。二手结论过时实证：真机 `fill` 即 enable（regress 的 keydown 判据已过时，垫无害保留）。`0ddd7b7`。
5. `cred-route-mask`（direct，Steven 拍板「源头打码」）：`maskCredentialRoute` 路径段打码（observed+axes 投影），凭据门零弱化（门配对机器证明：原样必拦/打码必过）；codex R1 High 挖出 axes 历史债（从无凭据门、query 可携凭据裸落盘）→ 落盘前补门拒写 exit 1 + leaky 场景退桩红。真机误伤原型 = 发送期应用自取临时凭据路由 `getTempTokenForApi`（路由名字面含 `token`）。`60e89d4`。
6. `login-traffic-drop`（direct，真泄露向量修复）：真机停站④两连门拦揪出 `GET doLogin` 凭据走 query → `loginMark` 切断登录期流量（CONTEXT「登录预备动作…不进 axes」字面兑现——此前只做到归因 null、记录本体经孤儿并入落盘）；axes 投影剥 host 只留 `pathname+search`（目标地址绝不进输出）；codex 三轮再挖三缝全采信（`blob:` pathname 内嵌 origin 穿透/代理型自嵌 `://`/`//host/x` 协议相对引用——非白名单形态一律 `<redacted:non-http-url>`）。`f0bd596`。
7. 真机四停站全走完（Steven 在场）：flow confirm（八步）→ `compile --execute` 零非 unique 步落四件套（10 events / 10 observed / 0 候选，打码痕迹在、零原始路由名）→ `casey draft` 骨架 + LLM 补缝 + `validateDraft` 闸 → Steven 人签 6 条全硬（`signedAgainstBuild=1.1.2`）→ `casey run` 端到端落七件 `runs/tc_chiefcomplaint_smoke/run_1783054730282`——**`intent_3` `SUT_DEFECT`（有取证背书）**：所签 `textHidden(会话异常)` 命中（被测智能体真回复「会话异常」四字，彩排两次+编译一次三次一致）+ `noErrorEnvelope` 坏信封同步翻红、流未见 finished，三路证据同源；其余四 intent 全 PASS、动作 10/10、`locatorHitRate`=1。回放历史/回放指标首次真机产出（`runId` 落章）。
8. 凭据卫生收口：历史落盘泄露（catalog 时代 axes 无门期，`doLogin` 带值 query 4 处）就地打码洗盘、终扫 49 件产物零凭据值（git 历史清白，`cases`/`runs` 从未入库）；`testcase` source 措辞消噪（`regress` 仓名后缀撞 `creds.user` 常见词，纯巧合零披露）。
9. 新挂账：平台侧缺陷上报两笔待 Steven 转交——① `doLogin` GET 凭据进 URL/服务端日志（安全面）；② 「互联网问诊-主诉」智能体回复「会话异常」（`run_1783054730282` 报告即证据）。回放期面板吞点观察（回放单击无采集自愈，fail-safe 兜底不假绿；真机回放若频发另起契约议回放器通用机制，动内核须 full）。

以下为昨日快照（2026-07-02 四续；其末条「直接下一步」已被顶部接管并全数完成），只溯源：

本 session 四续（2026-07-02 夜）：P3 收官后即启 P4——`p4-drafter`（full）六阶段全收口（Steven「开！」授权）：

1. G-seam 接缝对齐（GRILL 缺席推定取 A、可否决、列 prd observability 交人复核）：`expected-frozen.schema.json` 双 enum 加法对齐 `check.mjs` 权威表——`assertionKind` 12→15（补 `textHidden`/`buttonState`/`switchState`）+ **落地时新发现同接缝第二漏收** `assertionOp` 8→15（已收 kind 的法定 op `filled`/`finished`/`contains` 竟表达不了 = 潜在假拒）；`prd-seams-freeze` checksum 重签、其 gate 复验 GREEN 1/1。
2. `lib/assertion-draft.mjs`（新，纯函数零 LLM）：`synthesizeSkeleton`（D1 查表映射、观测/`urlIncludes` 双分支同剥实体 ID、未知原子落 `pending[]` 不发明）+ `validateDraft`（LLM 补缝准入闸：kind/op spawn `check.mjs --validate-only` 复核零副本表、易变字面量纪律盖全部字符串值不分 op、D2 soft 语义两向钉死、闸自身 total 全域返回不抛）+ `lib/replay-assert.mjs` 加性导出 `IMPLEMENTED_KINDS`（已实现集唯一供源）。LLM 补缝 prompt/schema 沿用 `proposed/llm-patch.draft.md`（CLI 外跑，同 P3 flow 范式）。
3. golden `tests/_golden/p4-drafter.golden.mjs` 13→20 检查（底稿承另一 session 预备轨、红先行）；gate GREEN 2/2 + seams/p5 回归锁 + tier1 全绿。codex 四轮 R1..R4：3→2→2→0 逐轮全采信钉红修绿（R3 有 High——闸未钉 D2 soft 语义，LLM 草稿可绕硬裁定/造假红），R4 PASS 零发现记 `loop/audit.jsonl`；learn 六教训落 `docs/plans/p4-drafter/learn.md`（接缝对齐查全伴生 enum / 缺席推定三要件 / 闸 total·纪律盖全通道·语义不变量在准入 / 覆盖独立性 / 收敛看 PASS 不看发现数 / 唯一事实源纪律）。
4. 相2 端到端首航已完成、真机 4/4 PASS（2026-07-02 夜，Steven 全程在场）：`tc_catalog_wf_crud` 真产物 → `synthesizeSkeleton` 骨架 + LLM 补缝（本 session Claude 依 `llm-patch.draft.md` 纪律出 3 条：列表路由硬断言 + 保存/删除 toast 两条 soft）→ `validateDraft` 闸 `ok:true` → Steven 人签冻结（7 条断言逐条盖 `signedAt`/`signedAgainstBuild=1.1.2`/`signerId=Steven`，`assertSignedContract` 核过，落 `cases/tc_catalog_wf_crud/expected.frozen.json`）→ 真机回放（`--login-bootstrap` 过登录墙、建删 `atl_r1`）→ 零 LLM `verdict` 出终判。首跑 3/4 步 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)`——首航当场挖出评估器夹具债：`noErrorEnvelope` 硬编码 `/saveOrModifyProcessData/`（p5 假 SUT 捷径，真机无该请求步必假败；fail-safe 方向全对无假绿）。
5. `noerrenv-absence`（light）六阶段全收口（Steven 批冻结翻转）：`noErrorEnvelope` 改缺席语义镜像 `noPageError`（本步归因无坏信封即过、零记录即过；坏信封归因本步必败方向不变）；p5 coverage golden 一条翻三向（红先行两红、双 prd 同步重签、双 gate GREEN）；codex 一轮 PASS 零发现记 audit；learn 四教训落 `docs/plans/noerrenv-absence/learn.md`（首航就是验收器 / fail-safe 即可诊断性 / 冻结翻转全流程可追溯 / `streamReplyReceived` 同味 URL 模式观察挂账）。修后首航重跑真机 4/4 PASS——「文本用例 → 人签断言 → 真机回放 → 零 LLM 终判」全链首次贯通。
6. 相6 真机报告已兑现（`run-login-passthrough` direct 契约）：`casey run` 相3 stage 透传 `--login-bootstrap`（4 行机械接线，同 `compile --verify` 先例）；C6 检查补进 replay-login-bootstrap golden（红先行）至 8 检查、checksum 补冻、gate GREEN、tier1 绿。真机全链跑通：`runs/tc_catalog_wf_crud/run_1783000971249/` 落 axes/verdict/report-model + `tc_catalog_wf_crud.report.{html,md,json}`——裁定概览「通过 4 · 缺陷 0 · 过程错误 0 · 待人裁决 0」，soft 断言如实标「不进裁定树」。「文本用例 → 人签断言 → 真机回放 → 零 LLM 裁定 → 自包含报告」完整愿景首次真机兑现。
7. 报告保真度打磨挂账（首份真报告体检，不阻断）：① 「期望版本：（未签）」——`report-model` 未接 `--expected`（layer3 评审 F8 延期项，现有真消费者，宜接线读签署字段）；② 期望值显示 `[redacted]`（脱敏口径偏宽，路径值非凭据）、实际值全 `null`（axes 未回填 actual，报告「期望对实际」栏目名存实亡）——下一小契约一并处理。
8. `report-fidelity`（light）六阶段全收口——首份真机报告三缺陷全修：① `bin/report-model.mjs` 加 `--expected` 签署投影（全签且联合均一才投影、`--case-meta` 显式优先、签署元组原子性——两字段全缺才整组投影/单缺仅显式半与 expected 元组吻合才补/不符一概不补），`casey run` 恒透传；② `redactScalar` 纯路径形态 token 转 `redactUrlPath` 逐段脱敏（修 `OPAQUE_BLOB` 32+ 长串对纯路径的整段误伤，凭据方向零放松、layer3 金丝雀全保）；③ `evaluateAssertions` 加性回填标量 `actual`（五口径 + 未实现恒 null，`ok` 判定一字不变）。golden 14 检查红先行；codex 三轮 R1 混签部分投影（High）/ R2 跨源拼合元组（High——case-meta 版本 + expected 签署人拼出两源都未背书的组合）逐轮采信钉红修绿 → R3 PASS 记 audit；learn 四教训落 `docs/plans/report-fidelity/learn.md`（防泄漏启发式配反向锁 / 收窄复用既有原语 / 元组语义三问 / actual 口径纪律）。真机重跑亲验：期望版本 `1.1.2`·路径成对可读·取证类计数在场，仍 4/4 PASS（`run_1783002166358`）。
9. G-seam 推定已获追认（Steven「追认」2026-07-02 深夜）：schema 双 enum 对齐转正式人签，`prd-p4-drafter` observability 该项核销、GRILL 已改记。
10. `draft-cli`（light）六阶段全收口：`casey draft` 上线（骨架+`--patch` 补缝合并+闸+落草稿，违规整份拒）；codex 两轮 R2 PASS（R1 四发现：三采信——caseId 缺席同拒/限形状防穿越/裸 `--patch` 拒；一修正采纳——凭据门退出码取 compile 先例 1，修 GRILL 措辞钉约定获 R2 认可）；learn 四教训（薄 CLI 是不可信输入第一道闸 / 一致性闸缺席分支 / 文件名标识符验形状 / 修正采纳第三种处置）。挂账：`compile.mjs` 有同型 caseId 拼文件名缝（顺手同修候选）。
11. `kinds-harden`（light）六阶段全收口——`textVisible`/`noErrorToast` 提硬（`IMPLEMENTED_KINDS` 5→7）：replay 代表步静默点现场采（toast 快照选择器逐字复刻 compile 观测采集 + `getByText`/toast 双通道命中计数），缺采集一律证不出；`noErrorToast` 词表判（`失败|错误|异常`，Steven 人签 G1；`actual` 携实采全文可纠错；结构类名收紧挂账 route:human）。三份冻结 golden「未实现范例」随 D2 生命周期翻转（范例换 `buttonState`/soft 翻硬，GRILL G2 清单红先行、各 prd 补冻、四 gate GREEN）；codex 一轮 PASS 零发现；learn 四教训（范例钉点会过期 / 新 kind 成本在采集 / 采集器同构纪律 / 词表判+全量证据回填）。`casey draft` 真用例重产草稿 7 条全硬（soft 0）——D2「补实现→重签提硬」首次真兑现。
12. 重签提硬完成（Steven「签」，2026-07-03）：7 条全硬断言重签冻结（新 `signedAt`，`expected.frozen.json` 覆盖首航版）→ 真机 `casey run` 重跑 4/4 PASS 零 soft（`run_1783008079114`）——报告「期望对实际」全对：`noErrorToast` 实际值携活采「保存成功」toast（词表判 + 全文可核）、`textVisible` 命中计数在场。D2 生命周期「未实现冻 soft → 补实现 → 重签提硬 → 全硬裁定」端到端走完，`kinds-harden` 的 route:human 主项核销（错误 toast 结构类名采样仍挂）。
13. 直接下一步：① `casey run` 接 `run-history`/`run-metrics` 真产出（旧挂账，编排器天然生产者）；② 第二条用例移植（`chiefcomplaint_smoke`，飞轮第二条）；③ `compile.mjs` caseId 形状同修（direct 小契约候选）；④ 未实现余 8 kind 按需加法（护栏 #17）。

以下为本日早前时段快照（P3 收官），只溯源：

本 session 三续（2026-07-02 晚）：P3 tier-2 真机 bring-up 下半场开局——三跑全通产真四件套 + 登录墙契约收口：

1. 三跑 `--execute`（`--unique-name c2`）真机全通：16 步全 `unique` 且 acted、零 blocker 零 `CASE_DEFECT` 候选；卡片布局计数对账恒等（目标卡片 1 :「删除」目标 1）放行删除段，`atl_c2` 建成→删除净场（末步 toast「删除成功」）；P4 交接面四件套（events / observed / testcase / compile-report）已落 `cases/tc_catalog_wf_crud/`（gitignored）。产物纪律亲验：信封 `authored:false`、16 步 URL 全走 `{{baseUrl}}` 占位符、requestLog 94 条全剥 query 且只落 pathname、75 条按 `initiator` 归因、背景轮询零误归因、`capturedAgainstBuild` 取不到落 `null`（fail-safe）。
2. 核验清单 ⑤⑦④③ + 计数对账（route:human）证据已呈：⑤ 抽屉确认 = role button「确认」count=1 / ⑦ 删除确认 = role button「确定」count=1 / ④ 描述 = label「工作流描述」count=1（此轮 role/label 采样非 0，五雷真机分支未触发即全 unique）/ ③ nav 直达豁免 / 计数对账恒等。Steven 选「先上真机看看」，签核待其过目后落（顺手清 `atl_c1` 残留——二跑遗留真机）。小瑕疵记档：requestLog 对 `data:image` URL 落整段 base64 载荷（纯噪音非泄漏，后续可折叠成 `data:<mime>`）。
3. `replay-login-bootstrap`（light）六阶段全收口——已知缺口「`--verify` 登录墙」hermetic 侧已解：方案分岔人签取「replay 登录预备动作」弃 storageState（AskUserQuestion，Steven）；`bin/replay.mjs` 加 opt-in `--login-bootstrap`（不产 event、不进 axes、凭据只进内存，前置/登录失败 exit 65 不落 axes，登录期 `currentStepId=null` 流量归 null）+ `compile --verify` 透传 + `loadCreds` 加 `AT_CREDS_FILE` env 覆盖（hermetic 凭据源隔离）；新夹具 `tests/fixtures/login-sut/server.mjs`（服务端 cookie 会话、登录标记只落布尔）；golden 7 检查红先行（C2/C3/C5 三红核实）；gate GREEN 2/2 + p5/p3 冻结 golden 回归全绿。codex 两轮：R1 FAIL 3 发现——F1 High 凭据字节经 `JSON.parse` 报错漏 stderr（实测坐实，消毒重抛 + C2b 钉死）/ F2 High 坏 `site.json` 静默回落默认（`loadSiteConfig` 加 `strict`，replay 开旗标 fail-closed + C2c 钉死）/ F3 尾斜杠证伪拒绝（`replay.mjs:56` 既有剥除）→ R2 PASS 零发现记 `loop/audit.jsonl`；learn 落 `docs/plans/replay-login-bootstrap/learn.md`（六教训：报错通道也是泄漏面 / 泄漏断言按片段抓 / 坏文件≠缺文件 / env 换路径隔离凭据源 / 假 SUT 会话服务端化 / 拒绝要带行号证据）。
4. 真机回放核验第二轮已过（WSL 侧，Steven 在场）：`compile --verify --login-bootstrap` 经隧道 → 登录预备动作真机首战成功 → 16 步动作轴全 `unique`（含建/删 `atl_r1` 全过身份门、删除净场），看门狗 75s 未触顶。同场反向实证：Windows 侧同命令失败（登录表单 15s 未现 → fail-closed exit 65、不落 axes、报错无凭据值）——防线行为全对；tier-2 真机命令一律 WSL 侧跑（G6 人签既定：Windows 上 127.0.0.1:15519 非设计路径、直连需把真目标地址写进命令行违护栏 #7、playwright 是 Linux 版）。
5. 直接下一步 = P3 tier-2 剩余 route:human：Steven 签核核验清单 ⑤⑦④③（其选「先上真机看看」，顺手清 `atl_c1` 残留）→ 重录 spike 录屏核销 ① → `capturedAgainstBuild` 来源确认 → 相2 断言草拟+冻结+人签（P4，零 baton 预备轨已推到「就差 accept+loop」：`docs/plans/p4-drafter/proposed/` 含 grill 决策 D1/D2 + plan + golden 红基线草稿（已验红、钉 `lib/assertion-draft.mjs` 的 `synthesizeSkeleton`/`validateDraft`）+ LLM 补缝 prompt/schema；落地前先过接缝硬门——`expected-frozen` schema 12 kind vs `check.mjs` 15 kind 须对齐，route:human）。
6. spike 录屏已重录（route:human ① 机器侧齐备、待 Steven 过目签核）：scratchpad 一次性脚本产 `cases/spike-rerecord/`（gitignored）——`spike-rerecord.webm`（371KB）+ 三截图（登录页空表单/列表页/搜索空态）；凭据红线加固：登录在无录屏 context 完成、登录态经内存 `storageState`+`sessionStorage` 种子移交录屏 context（SPA 令牌在 sessionStorage，`storageState` 不带、须手动移交——新教训），镜头零凭据输入过程；截图亲验中文全齐（字体修复实锤）。镜头顺带拍到 `atl_1782376478282_1` 残留卡片（待清理目标可视化）。只读流程零建删。
7. `capturedAgainstBuild` 采证完毕（route:human ⑥ 待 Steven 三选一）：全站唯一版本信号 = 登录页脚本标签 `api-config.js?v=1.1.2` 查询串（前端构建号，编译期可从入口 HTML 确定性提取）；页面 meta 仅 charset/viewport、`api-config.js` 正文无版本（仅三 API 前缀、无敏感）、`getAccountInfo` 无版本字段（仅租户/账号/visitKey 形状）。候选：A 用 `?v=` 查询串（接线改 `bin/compile.mjs` 属后续小契约）/ B 收下 null 人工填 / C 向 Heren 要版本接口。
8. 签核进展（2026-07-02 晚）：① 录屏签核通过（Steven「没有问题」）——route:human ① 核销，录屏不失真判据成立、G6「退 Windows」附带条件解除。**真机残留已清**（Steven 授权「删」）：scratchpad 脚本按删除段同款纪律执行——搜索隔离后卡片:删除目标 1:1 恒等才点、确认对话框唯一命中、删后复核归零净场，前后截图 `04/05-residue-*.png` 留证 `cases/spike-rerecord/`。随后两签落定（Steven，2026-07-02 晚）：**③ 核验清单 ⑤⑦④③ + 计数对账签核通过（「签」）**；⑥ 构建标识定案取「自动提取 `?v=` 查询串」（「同意」）——编译期从入口 HTML 的脚本 `src` 读前端发版号（如 1.1.2）填 `capturedAgainstBuild`、取不到照旧 null；接线（改 `bin/compile.mjs`）为后续小契约挂账、此前仍落 null。至此 P3 tier-2 六项 route:human 全清（①②③④⑤⑥），P3 里程碑整体收官（hermetic 六阶段 + 真机 bring-up 双侧完成，护栏 #16 的「人签真机」兑现）。下一站 = P4 断言草拟（相2）：另一 session 预备轨已到「就差 accept+loop」，前置接缝硬门 12 vs 15 kind 对齐（route:human）；baton 空闲留给其落地。
9. Windows 侧失败追诊（Steven 质询「fail-closed 真的没关系？」后补证）：连通与单资产两侧全通（登录页 200 / 资产 200，Windows 0.24s），败在真浏览器 SPA 渲染 15s 不完成——疑隧道连接池对 Windows 回环转发的并发/keep-alive 形态不补池（僵尸池家族）；其走的是「登录路径上表单必须出现」严格分支、最危险的 fail-open 分支被正确拒绝。按 G6 人签 Windows 非受支持跑侧，定性已知限制、不深追。顺带挖出的真缺口（backlog 小加法候选）：replay 登录预备动作失败只留 stderr、不落任何诊断产物——compile fail-closed 尚有诊断 compile-report 先例；宜补「失败也落登录诊断痕迹（不含凭据值）」，供 route:human 修雷有据。

以下为本日早前 session 快照（tier-2 上半场；其「直接下一步/已知缺口」已被顶部条目接管，只溯源）：

本 session 再续（2026-07-02 傍晚）：P3 tier-2 真机 bring-up 上半场（969ffbb + 第六雷收口一笔入 dev）——六项 route:human 走到半程：

1. 反向隧道全通：`scripts/wsl-reverse-listen.mjs` 加逐请求 Host 头重写（网关按虚拟主机路由，原 Host 落默认静态块致 API 405）+ keep-alive 状态机整请求单次写出（配合 Windows 代理首包捕获）；环回隔离自测三案（GET / POST 带 body / keep-alive 第二请求）钉绿；僵尸池根因定位——Windows 代理先于 WSL 监听器启动则池不补，重启即愈（启动顺序：先 WSL 后 Windows）；登录页经隧道 HTTP 200 / 38ms 热路径；新增 Windows 侧连通探针 `scripts/win-probe-target.mjs`（只出状态码、目标地址不回显，护栏 #7）。
2. spike（route:human ①）机器侧四向全过：真机登录 1.7s（顺验 login-bootstrap SPA 判据修正）、前台 XHR（queryProcess）按 `initiator` 归因到活动步、无活动步期 56 条流量零违例归 null、错误信封经隧道解析 14/14。录屏曾整片无中文——根因 WSL 零中文字体（headless 无字形可画，DOM/定位/断言不受影响），已装用户级 Noto Sans CJK 修复、登录页截图亲验中文齐；旧录屏作废、待重录人签。
3. `tc_catalog_wf_crud` 三件备齐（`cases/` 下 gitignored）：手写规范 TestCase（意图留痕四 intent）/ 通道剖面 profile.json（背景 denylist 4 条 app-shell 实采 + 信封 successField status/200 + `routes.workflowList`）/ flow 草稿过 compile-gate 闸并人 confirm（Steven，2026-07-02T16:09:22+08:00）。
4. 首跑 `--execute` 撞出真机五雷、fail-closed 诊断报告逐轮收敛后全修（969ffbb）：① 登录入口须 = `--sut` 基址 + site.json startUrl 路径段（裸基址根路径无登录表单，SPA 判据被误读为已登录 fail-open、后续全步 absent）；② `/ai-manager/process/list` 真机是 API 前缀（503）→ 列表路由按通道剖面正名做成 `profile.routes.workflowList` 可选覆盖（缺省 `ROUTE_LIST`、hermetic 行为不变，形状校验 fail-closed）；③ Heren 表单标签是 div 无程序化关联（getByLabel 必 0）→ form__item 容器锚定 fallbackCss（count=1 亲验），描述实名「工作流描述」；④ 分类下拉无 combobox 角色 → 线性化两击（回放 doSelect 只认 combobox；选项限定 `.hr-select__list:visible`——全局同名文本会撞列表页分类 tab 被抽屉遮罩拦点，亲验）；⑤ 抽屉 footer 与删除对话框是 div 按钮（role=button 采样必 0）→ 主按钮锚定 + 实采文本记 compile-report（route:human ⑤⑦ 证据位）。真机分支全部只在角色采样 0 命中时启用；hermetic golden 13/13 + p5/p7 回归锁 + tier1 全绿。
5. site.json 起草的 login 覆盖段真机命中 0（错草稿）已删，回落内置默认（真机逐字吻合）。
6. 二跑 `--execute`（2026-07-02 16:52）撞第六雷、修复已落并补冻：12 步全 `unique` 且 acted（五雷修复全兑现），但删除段计数对账不恒等（表格行=0、删除目标=1）fail-closed 截断——真机列表是卡片布局非表格（`.hr-table-row` 必 0）。修复：对账兼容表格/卡片双布局（`summarizeDeleteCountAudit`/`auditDeleteCount`，卡片按 `.hr-card--bordered` 含目标名计数，证不出仍截断）+ `observed` 的 `requestLog` 只落 pathname 不携 origin（护栏 #7 收紧）；golden 增 C3b 卡片对账 + C4b pathname 断言至 14 检查、checksum 补冻入 prd（护栏 #1 加法，先例同 p5 补冻 b0dcaff）、gate GREEN 2/2 复验、tier1 无回归。**注意真机残留**：二跑 create 段已成、删除被截断 → `atl_c1` 实体残留真机，三跑前先人工清掉或换 `--unique-name c2`。
7. 已知缺口（走核验段前必解）：`compile --verify` 直喂 `bin/replay.mjs`、无登录预备动作 → 真机必撞登录墙；方案（replay 可选登录预备动作 or storageState 移交）待定，涉回放器 CLI 面，建议 light 契约。
8. 直接下一步 = 三跑 `--execute`（卡片对账已修；先清 `atl_c1` 残留或换 `--unique-name c2`）→ 核验清单 ⑤⑦④③ + 计数对账 → 解 `--verify` 登录墙 → 回放核验第二轮 → P4 交接面四件套 → 重录 spike 录屏交人签核销 route:human ①。

以下为本日早前 session 快照（p3-compile 六阶段收口；其第 4 条「直接下一步」已被顶部傍晚条目接管半程，只溯源）：

本 session 续（2026-07-02 下午）：`p3-compile`（full）六阶段全收口（788bb2b/76d6ef5/5f721e2 三笔入 dev + 收口一笔）——P3 相1 编译命令化层落地：

1. grill：G1–G7 全数人签（G6 分岔三人签改选 C——events url 走 `{{baseUrl}}` 占位符 + `instantiate` 回填；其余照草稿倾向），机械决策与 7 项 route:human 挂账合并记 `docs/plans/p3-compile/proposed/GRILL.md`；「登录预备动作」登记 CONTEXT.md。
2. loop：`casey compile` 三段式 CLI（`compile-gate` 三闸+落 flow 人 confirm 门 / 以 `--testcase` 为不可变锚重验三闸+执行 / `--verify` 回放核验逐 event 扫）+ `lib/compile-atoms.mjs` 原子编译知识（拆 intent、分支线性化、入口可证缺席→`CASE_DEFECT` 候选不落步、断言原子折 intent 留痕、计数口径对账）+ `lib/login-bootstrap.mjs`（拷快照 autotester 登录件）+ `lib/cred-gate.mjs`（凭据门共享化+`token`/`cookie` 补强+非凭据键形状校验）+ `lib/atoms-registry.snapshot.json`（整表 60 原子带 `snapshotOf`）+ replay `{{baseUrl}}` 接线与 axes 加性 `eventActions`。hermetic golden 13 检查全绿（红先行）、gate GREEN 2/2、p5/p7/layer3/tier1 回归全绿。
3. review：codex 三轮 R1..R3 至 PASS（R1 六发现/R2 四发现逐轮采信去修各钉红 golden；R1-F5 修正采纳留案——「取消非凭据键跳过」违通道剖面接缝定义被否、改形状校验收紧；记 `loop/audit.jsonl`）。learn 落 `docs/plans/p3-compile/learn.md`。
4. 直接下一步 = P3 tier-2 真机 bring-up（六项 route:human 在 `prd-p3-compile.json` observability）：拉反向隧道 → spike（CDP 归因/录屏）→ 手写规范 TestCase + flow 草稿人 confirm → 真机编译 `tc_catalog_wf_crud` → 核验清单 ⑤⑦④③ + 计数对账 → 回放核验第二轮 → P4 交接面四件套落 `cases/`。需要人在场（Windows 侧拉隧道 + confirm 人签 + 真机建/删实体过目）。

以下为本日早前 session 快照（seams-freeze-v2 收口 + P3 备料，只溯源）：

本 session（2026-07-02）收口一批（827cebc/7c52114/a06c29c 三笔入 dev + 交接文档一笔随后提交，工作树随之干净）：

1. `seams-freeze-v2`（full）六阶段全收口——codex 异构评审十二轮 R1..R12 至 PASS（`loop/audit.jsonl` 有案）：R1 续钉 hard invariant 升 schema 层机制化（827cebc）；R5–R11 本 session 逐轮采信去修 26 条发现、红方向注入亲验 31 场景（7c52114）——指纹真算、SUT_DEFECT 证据背书链（至少一个证据指针→取证指针真信号非装饰→混合证据同锁→空串空壳封口，镜像 `verdict.mjs` 背书语义）、golden 校验器 fail-closed 全量兑现（与数据无关全量预扫 + 关键字值元校验 + `$ref` 悬空/null 子 schema/空组合数组全拒）、三凭据扫描器各带自测金丝雀（key 子串/value kv 提取/字段名字符串）、join 四重（driverId 双向/actionSpace 包含/channel 一致/call 全等）、run-metrics 聚合复算、locatorResolution×action 类别绑定。R9-F1 修正采纳留案：拒「SUT_DEFECT 必须失败断言」（违 ADR-0002，可仅由 5xx/pageerror/crash 背书），改钉证据指针。learn 落 `docs/plans/seams-freeze-v2/learn.md`。
2. `layer3-wiring`（light）六阶段全收口（上一 session 尾、b4985d9）——codex 七轮 R7 判 PASS 记 audit，装配器 fail-safe 硬化：verdict⋈axes 一致性门、join 双射、schema 自守、现实形状凭据脱敏；learn 落 `docs/plans/layer3-wiring/learn.md`。
3. P3 真机 bring-up 前置全解除（a06c29c）——备料三草稿（`docs/plans/p3-compile/proposed/`：`catalog_wf_crud` 重表达清单 7 步→4 intent/15 event、观测现状采集计划、grill 决策草稿 G1–G7，零 baton 子代理产出、全留人签、route:human 7 项）；凭据现场就位（`.auth/` 自 autotester 拷入 + site.json 起草，均 gitignored、内容不进任何输出）；WSL 直连站点不通（Windows 防火墙拦正向入站，亲验 Windows 通/WSL 不通）→ 反向隧道落地（`scripts/wsl-reverse-listen.mjs` + `scripts/win-reverse-agent.mjs` + 重拉 `scripts/win-forward-start.cmd`），登录页经隧道亲验 HTTP 200、site.json 记 `devProxyUrl`；UAT 不能真造 500（用户确认）→ `SUT_DEFECT` 场景改回放侧代理拦截注入（进 P3 grill 决策）。

以下为上一 session（2026-07-01 续）快照——其中 `layer3-wiring` 的 review 修复回合与残留项均已收口（见顶部 1/2），只溯源、勿据其判现状：

`layer3-wiring` 的 review 修复回合进行中（review 阶段未推进、活契约仍 review+learn 待）。codex 异构评审（`gpt-5.5`、只读、空 cwd 喂 stdin，护栏 #9）两轮都判 `FAIL`：

- 第 1 轮 9 发现（5 高 + 3 中 + 1 低），逐条核实全成立、采信去修：F1 缺陷单空证据 / F2 生命周期背书漏投 / F3 URL query 与信封值凭据泄漏 / F4 join 缺失静默假通过 / F5 无 schema 自守 / F6 未知 verdict 静默忽略 / F7 `!!` 掩盖输入损坏 / F8 未接 `--expected` / F9 缺参 exit 3 非 64。
- 已落工作树（**未提交**）：`lib/report-model.mjs` 装配器硬化（缺陷单背书与 `verdict.mjs` 同源含生命周期 pageerror/crash、找不到背书 fail-closed 抛、`url` 剥 query/hash、verdict/channel 枚举 + reason 一致性 + caseId + steps 非空 + 布尔 `ok`/`soft` 自守、verdict⋈axes 唯一 join）+ `bin/report-model.mjs`（F8 文档化取舍）+ `bin/casey.mjs`（F9 exit 64）+ 新 `tests/_golden/layer3-wiring-coverage.golden.mjs`（20 检查，红→绿严格核：先对未修装配器跑 17 红）+ `loop/prd-layer3-wiring.json`（加 testChecksum、加 story `s2-assembler-failsafe-coverage`）。`gate --prd prd-layer3-wiring` GREEN 2/2、原冻结 golden 2/2 仍绿、`selftest --tier1` 无回归。
- 第 2 轮复审：F2 / F4(主) / F6 / F7 / F9 **已闭合**；**残留待下轮收**：
  - F3 未闭合——`safeScalar` 只 redact 对象/数组，标量字符串 `errorEnvelope.actual`/`expected` 仍可原样搬 `token=…&email=…`（护栏 #7）；须对标量值也脱敏/摘要。
  - F5 未闭合——残余非法产物路径：`meta.passes` 非布尔 / `meta.title` 非字符串 / `generatedAt` 未验 date-time / `events.action` 为对象→`action.kind` 对象 / `network.status` 非整数 / `errorEnvelope.field` 缺失或非字符串。
  - 新语义洞——`buildDefectTicket` 无失败硬断言时无条件合成 `actionPerformed` 断言，未校验上游确有 `ap===false`；若 `SUT_DEFECT` 仅由 5xx/pageerror/crash 背书且动作实已执行，会造无证据的失败断言（违「只读消费者」精神）。须先验动作轴再决定是否合成。
  - F4 提醒——装配器拒 `stepId:null` 而 report schema 允许 null；实操 replay 恒 `atstep_i` 非 null、暂无误伤，收残留时一并确认是否放宽。
  - F8 codex 认可作 P3 范围延期（非代码闭合）。

（上段「下轮首要」已完成：codex 续评至 R7 判 PASS、随 b4985d9 收口，见顶部本 session 2。）

上一 session（2 提交 `f41e527`→`a7ab5e9` 全入 dev）：

1. `seams-freeze-v2`（full）四接缝冻结已完成——借鉴接缝 v2 增冻（`run-history`/`action-vocabulary`/`failure-ledger`/`channelDriver`）：grill 收口（承重决策 1.1/2.2/3.3 人签 + 7 机械决策，合并记录 `docs/plans/seams-freeze-v2/proposed/GRILL.md`）→ plan → accept → loop，gate GREEN，9 文件 checksum 冻入 `prd-seams-freeze-v2`，`CONTEXT.md` 登记 6 术语（动作词汇表/通道驱动/回放历史/失败记录台账/失败指纹/人裁决回填），tier-1 无回归。承重决策 2.2 人签把 `channelDriver` 从后置接缝拉进本轮、范围扩到四接缝。（本条快照的「review + learn 待」已于 2026-07-02 十二轮收口，见顶部本 session 1。）
2. `layer3-wiring`（light）第 3 层集成 hermetic 骨架已建成——补上 `verdict→report` 唯一断链：新建 `lib/report-model.mjs` 报表模型装配器（verdict ⋈ 三轴 ⋈ 观测现状 ⋈ 冻结契约 → report-model，符合已冻 schema、缺陷单仅 SUT_DEFECT）+ 薄 CLI `bin/report-model.mjs` + `casey run` 编排器（串 相3→相4→装配→相6，`runs/<caseId>/<runId>/` 布局 + 退出码归一 fail-closed）；hermetic 端到端 golden 假 SUT × 2 场景（happy→PASS / inject500→SUT_DEFECT）2/2 绿、红→绿严格核实（stash impl 退桩红），gate GREEN、tier-1 无回归。确定性尾段（相3-6）现对合成数据端到端跑通。（本条快照的「review+learn 待」已收口六阶段全 done，见顶部本 session 2。）真数据端到端 = P3 之后的直接下一步。

以下为前两 session（2026-07-01 跨两 session）开发流程兜底 + 收口一批（6 提交 `9a9ff03`→`9c5e4cf` 全入 dev）：

1. 模型分层升级——`loop/config.json` 改 Opus 4.8 ultracode 主环 + Sonnet 5 max subagent 轻车道 + 三级兜底梯（详见「锁定的决策」2026-07-01 条）。
2. `term-guard` 契约（统一语言强制兜底，6 阶段全绿）：甲 `bin/term-guard.mjs`（零 LLM 拦 R3 比喻格式 / R6 加粗未登记英文与弃用别名，引用豁免只认反引号）+ 乙 `bin/term-judge.mjs`（语义评分员，待非 Claude 密钥）；codex 九轮异构评审 pass；Stop 钩子 warn-only 接线（不改 loop-kit）。
3. `model-lane-guard` 契约（模型分层强制兜底，6 阶段收口）：I1 `bin/verdict-purity-guard.mjs`（静态扫 `verdict.mjs` 依赖闭包无 LLM/网络客户端，接入 `casey selftest --tier1`，护栏 #15）+ I2 `bin/config-lane-guard.mjs` + `.claude/settings.json` 独立 PostToolUse 钩子（断言 config 异构不塌同族，护栏 #9）；codex 四轮异构评审 6→5→2→0 收敛，逐轮钉红 golden 硬化（全局 fetch/注释插入/目录 index/minified import/未映射族 fail-closed/路径穿越+软链）。**两条不变量从文档策略变成机制强制，守卫已上线。**
4. `hermetic-gap-freeze`（direct）：两份缺口 coverage golden 补冻——P7 credentialGate（护栏 #7 落盘前拒写）入 `prd-p7-report`、P6 nextStatus superseded 状态边入 `prd-p6-selfheal`，gate 各 2/2。
5. `p5-replay` learn 收口——P5 回放核心契约 6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；tier-2 真机 route:human 仍未走。
6. `seams-freeze-v2`（full）grill 当时进行中——现已四接缝冻结完成、见本节顶「本 session」1（本条为前 session 快照、只溯源勿据其判现状）。

以下 P5 与排期为 2026-06-30 快照（★注意：其中 P5 的 review/learn 已在最近一 session 收口、6 阶段全 done，见「当前状态」与「契约 / 运维」；本段只溯源、勿据其中「待跑」字样判现状）：

排期 v2（接缝优先并行）落地 → 第1层接缝冻结完成 → 第2层全部落地：P5 回放内核（★最后一轨）loop 绿——真 chromium 回放假 SUT（被测系统）→ 三轴 → 喂已冻 `verdict.mjs` → 四态全中（golden 10/10）。`casey selftest --tier1` 无回归。P5 review（异构评审）+ learn 后续已收口（本句为 2026-06-30 快照，收口详见「当前状态」）；tier-2 真机 route:human 未走（gate 绿 != 完成，护栏 #16）。排期 v3 见 `docs/plans/roadmap-parallel.md` 文末（2026-06-30 重排）。

里程碑进度：

- P2 裁判内核（`p2-intent-compile`）：loop 绿 + review 收口（真异构 codex 评审 7 修复 + 三镜头核验，见下「异构评审」「真异构评审」节）。learn 未走。
- 排期 v2：`docs/plans/roadmap-parallel.md` —— 接缝优先、运行时依赖 != 开发顺序、P3 不在关键路径、冻接缝后 P4/P5/P6/P7 全可并行（机理同 P2 对合成 fixture 跑 hermetic）。
- 第1层接缝冻结（契约 `seams-freeze`，gate 1/1）：5 条接缝 schema + 合成 fixture（events / observed-reality / report-model / drift-patch / expected-frozen）+ `prd.schema` v2（向后兼容 v1），落 `tests/_golden/schemas/` + `tests/_golden/fixtures/seams/`，golden `tests/_golden/seams-freeze.golden.mjs`。3 决定：冻结 expected[] 走旁车 `expected.frozen.json`（护栏 #5）、`expectedVerdict` 命名、`assertionOp` 封闭 enum。
- 第2层（并行 worktree 建 → 合并 dev → 各 gate 亲验绿）：
  - track-F（`p2-failsafe-coverage`）：C1-C4 + B1-B6/A1 回归锁 golden 3 个（`tests/_golden/p2-*-coverage.golden.mjs`），把真异构评审延后项锁死。
  - P7（`p7-report`）：`lib/report.mjs` + `bin/report.mjs` 报告渲染器（report-model → HTML/Markdown/json，多态徽章 + 缺陷单仅 SUT_DEFECT + 期望对实际 + 凭据兜底门）。
  - P4（`p4-freeze`）：`lib/expected-compile.mjs`（expected.frozen → check 命令）+ `lib/sign-gate.mjs`（人签字段校验）确定性骨架。
  - P6（`p6-selfheal`）：`lib/heal-gate.mjs`（准入门只对 HARNESS_ERROR）+ `lib/drift-patch.mjs`（非就地补丁、签名 before===after 等值、人签后才 apply）。
- P5（`p5-replay`，full lane）：loop 绿（2026-06-30）。Phase 0+1（环境 + 假 SUT + 红 golden）+ Phase 2 实现全落：`bin/replay.mjs` 回放器 + `lib/{replay-actions,replay-forensics,replay-assert,drift-probe,instantiate}.mjs`——真 chromium 回放假 SUT，按 intentId 聚合事件依序回放、过点击身份门出动作轴、CDP 真发起方归因出取证轴（背景 401 归 null 不背书，非时间窗）、按 expected 评估出断言轴，三轴写 axes.json 喂已冻 `verdict.mjs`；只读漂移探针 `findEquivalentAffordance` 从 atom+targetName 构造 canonical 查 count===1（不点不改 spec）。golden `p5-replay.golden.mjs` 10/10 全绿（四态映射 `verdict-cases` 八案 + drift/vanished 复刻 `drift-patch` canonical）。accept 前修法发现并修掉一个冻结夹具缺陷：进程内假 SUT 被同步 `execFileSync(replay)` 冻住事件循环、答不了 replay 浏览器（goto 卡死、之前误判 21 分钟「挂死」），改 `server.mjs` 把假 SUT fork 出独立进程（8 态行为一字未改）→ server.mjs checksum 重签入 prd、accept 重签、gate GREEN。runner 是 `verdict.mjs` 上游产出者、绝不在回放进程内裁定（护栏 #15）。（本条为 2026-06-30 快照；review 异构评审 + learn 后续已收口，见「P5 回放异构评审收口」与「当前状态」。）

## 实现产物（live）

| Story | 文件 | 要点 |
|---|---|---|
| S1 裁判内核 | `bin/verdict.mjs` | §4.2 判定树、零 LLM、按断言种类不可知、断言续跑、取证按本步归因、入参 fail-closed |
| | `lib/forensics.mjs` | `checkErrorEnvelope` 信封成功字段参数化；缺配置 fail-closed |
| | `bin/check.mjs` | 断言词表/op 硬闸，`--validate-only`；断言 kind 枚举唯一活在此处 |
| S2 编译门 | `lib/compile-gate.mjs` | 移植 regress `_flow-authoring` 双闸 + 前缀从 `uniquePrefix` 注入；空/缺 prefix 拒绝放行 |
| S3 对账 | design §2.1 / bootstrap plan | 加 `noErrorToast`、信封参数化、`countChange equals 0` 例外；P3 recorder 降级「陌生站点孵化」 |
| S1 回放器 (P5) | `bin/replay.mjs` | 回放假 SUT 产三轴 axes、编排 + 看门狗（绝不挂死）+ 强制退出；裁判零 LLM（只产事实不裁定，护栏 #15）|
| | `lib/replay-actions.mjs` | 语义定位器 + 点击身份门（unique/fallback_first/none）；守卫不抛、动作失败翻译成轴信号交 verdict |
| | `lib/replay-forensics.mjs` | `watchNetworkForensics`：CDP 真发起方归因、背景 denylist 归 null、错误信封复用 `forensics.checkErrorEnvelope`、SSE `finished` 静默点；getResponseBody 套超时防挂死 |
| | `lib/replay-assert.mjs` | 断言轴评估（typed kind 算 ok，verdict 对 kind 不可知，护栏 #17）；未实现 kind 一律 ok:false（fail-safe）|
| | `lib/drift-probe.mjs` | 只读漂移探针 `findEquivalentAffordance`（同稳定签名 count===1，不点不改 spec，拆 P5/P6 循环依赖）|
| | `lib/instantiate.mjs` | 占位符回填（冻占位符不冻一次性值，护栏 #6）|

配套设计落档：
- `docs/design/report-spec.md` —— 最终报告规格（拆分布局 + HTML/Markdown/json + 多态裁定，反向约束 `verdict.json` 字段）。
- `docs/plans/p2-intent-compile/flywheel-schedule.md` —— 飞轮排期表（五维全加法、第二条移植 `chiefcomplaint_smoke`、23 条 R9 坐标 flow 标 route:human）。
- 交互 demo（演示壳、合成数据，HTML + Markdown 双视图）：`M:\home\liufei\casey-report-demo.html`。

## 异构评审（Claude 侧，2026-06-29）

5 镜头对抗评审 + 逐条核验：26 发现 / 18 确认。3 条 major + 一串防御性 minor，全是 fail-safe 反向不变量缺口（当时 latent，P5 回放未建故未触发）。已**不动冻结测试**修掉，gate 仍 GREEN：

- 生命周期取证（crash / pageerror）改为按本步归因（原来全局信号会翻任意步的 verdict）。
- 缺失 action 轴不再误判成 actionPerformed=true（防畸形步假 PASS）。
- 无硬断言不静默 PASS、缺 stepId 不假命中、`verdict.mjs` 入参 fail-closed。
- 编译门空/缺 prefix 拒绝放行（原来 `startsWith('')` 恒真把破坏性硬闸静默清零）。
- 信封缺配置返回 ok:false、不默认放行。

延后项（不静默丢，留后续 acceptance-gate / design 对账）：
- 冻结 golden 边界覆盖缺口：`atom` 卷回未断言、空 prefix 无 case、CASE_DEFECT 分支无 case —— 改 golden 触 ratchet，须走契约更新补冻。
- design §6 把「带期望对实际」的 `verdict.json` 与 `verdict.mjs` 最小输出混名、`passes` 归属错挂；§4.2/§9.1 取证记录缺 `attributedStepId` —— 留 design 对账（`report-spec` §7 已记）。

## 真异构评审（codex 侧，2026-06-29）

补上「非同族」这一环（护栏 #9：只喂 spec+diff+门禁证据，不喂实现者叙事）。codex 实际模型 gpt-5.5、xhigh 推理、只读。Windows 只读沙箱起不了进程（CreateProcessWithLogonW 267、七次重试全败、首轮交白卷），改把评审包 inline 进 stdin、明令不跑 shell 绕过；评审包在 `scratchpad/codex-review/`。11 条发现，分诊后 7 条落 impl（fail-safe hardening，不动冻结 golden、gate 仍 GREEN）：

- B4/B5（最关键）：破坏性前缀硬闸原裹在 `checkStateMachine` 里、只在 `registry.states` 存在时跑 —— 无 states 注册表会整条绕过，空/缺实体名旧版静默放行。抽成独立 `checkDestructivePrefix`，不依赖 states、空名 fail-closed。
- B1：`soft` 仅 `=== true` 才不进裁定树（非布尔 truthy 不再静默降级失败硬断言）。
- B2：`HARNESS_ERROR` 须 `resolution==='none'` 正向 miss 证据 + 漂移探针，缺则落 fail-safe（护栏 #13，防真缺陷被误当可自愈）。
- B3：`verdict` 入参 `steps` 非数组/空 → exit 65（不再静默写空 verdict）。
- B6：信封缺 `successValue`、body 缺字段、空白字段名 → 一律 `ok:false`（堵 `undefined===undefined` 假判）。
- A1：`successField` 命中凭据字段名 denylist → 不读不回传值（护栏 #7 落到代码）。

经验证：13 探针全过（含反向不误伤：真漂移仍 `HARNESS_ERROR`、合法前缀仍放行、正常信封仍 `ok:true`）；三镜头对抗核验（回归 / 新 fail-open / 护栏，run `wf_317cbbc4-fb6`）全 sound、0 真问题。评审取证留 `loop/audit.jsonl`（review/pass 记录）。

延后项进展（新增独立回归锁 golden、不动冻结测试，详见下方「P5 回放异构评审收口」）：
- **已补冻**（`tests/_golden/p5-replay-coverage.golden.mjs`，commit b0dcaff，gate GREEN 2/2）：
  - C1 全闭：合成 StepAxes 喂已冻 `verdict.mjs`——「硬断言失败 + 500 归因别步/背景归 null → 非 SUT_DEFECT（落 SUT_DEFECT_OR_STALE）」对「归因对齐本步 → SUT_DEFECT」的辨别 case 已钉。
  - C2 的 pageerror 半边：pageerror 归因本步 → SUT_DEFECT、归因别步 → 不背书本步（非全局布尔）已钉。
- **仍待钉**（下轮 acceptance-gate，多属 verdict/forensics 配置层、非 P5 回放）：
  - C2 余项：crash 背书分支、缺 stepId 不背书。
  - C3：空 / 缺 prefix + 空实体名破坏性硬闸，无 case。
  - C4：信封坏配置（缺 successValue / 空白字段名）+ 敏感字段 denylist，无 case。
  - B1（非布尔 soft）、B2（缺 miss 证据不自愈）、B3（steps 非数组/空 fail-closed）三条分支。

## P5 回放异构评审收口（codex 侧，2026-06-30）

P5 回放内核 loop 绿后接异构评审（与上节 P2/verdict 评审不同轮）。codex（gpt-5.5 真非同族、xhigh、只读、空 cwd 喂 stdin，护栏 #9）判 FAIL、10 发现（5 High + 4 Medium + 1 Low），逐条核实全成立、全修（commit b982171，改 lib/bin 不动冻结 golden；仅 `server.mjs` 的 L10 改动重签 checksum）。最严重 H3：唯一元素 click/fill/goto 抛错被吞却仍谎报 `actionPerformed=true`（同族自建漏掉的 fail-open）。要点修复：动作轴改诚实（失败落 `action_failed`→verdict INDETERMINATE；多匹配绝不点击；统一身份门 count===1 才 unique）、取证归因收紧到动作因果作用域（预导航期 `currentStepId=null`，非时间窗）、pageerror 按步归因不全局污染、网络背书归一到代表步对齐 verdict、断言证不出一律 ok:false、drain 先等在途前台 API。golden p5-replay 10/10 复绿 + selftest tier1 无回归 + gate GREEN。

收口补冻（commit b0dcaff）：上述 fail-safe 不变量的失败方向 p5-replay.golden 不覆盖，新增 `tests/_golden/p5-replay-coverage.golden.mjs`（13 检查）作回归锁、并入 prd-p5-replay（testChecksums + story `s2-failsafe-coverage`，ratchet 只增不减=护栏 #1 允许）。锁两层：断言轴证不出/未实现 kind→ok:false（含正反两向防恒-false 假绿）+ 合成 StepAxes 喂已冻 verdict.mjs 验四态归因。gate GREEN 2/2、passes 由 gate 写。P5 流水线截至本节（2026-06-30）grill→plan→accept→loop→review done；learn 于最近一 session 收口、6 阶段全 done（见「当前状态」）。

## 锁定的决策（2026-06-29）

- **岔一**（已锁）：轴通用 = 实现纪律，不是预留字段。`verdict.mjs` 按断言种类不可知、kind 枚举只在 `check.mjs`，新维度纯加法；流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。已落护栏第十七条。
- **质量接口**（已锁）：「内容好不好」走独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。
- **岔二**（已采纳）：压裁判保守分支最便宜的办法是先在 catalog 上多注合成故障（漂移→HARNESS_ERROR、元素消失→AFFORDANCE_ABSENT、真数据多匹配→ambiguous），再移植第二条 `chiefcomplaint_smoke`。
- **岔三**（已采纳）：第一条走 `full`；之后辐条默认轻车道（跳 grill、保留 plan+accept+loop），碰冻结内核才升 `full`；`accept` 任何车道都不跳。
- 全文：`docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。

### 模型分层升级 + 三级兜底（2026-07-01，已锁）

> **范围**：仅**开发流程**的模型分层道（谁来跑 loop：`toil`/`implementation`/`review`），不涉及 Casey 产品功能——编译/回放/裁定/报告 的运行时 LLM 接缝（相1 编译、相5 自愈、将来 `LLM-judge`）均不在本决策内；`verdict.mjs` 恒零 LLM。即配置顶层「两类 lane 正交」里的「模型分层道」那一类。

- **分层**：`loop/config.json` 模型分层道改——主环 Opus 4.8 跑 ultracode（xhigh + 动态工作流编排）当编排器，承 full 车道与冻结内核；轻车道的活派 Sonnet 5 独立 subagent（max effort）。切 subagent 而非主环换模型：prompt 缓存不被打断、上下文隔离（claude-api 缓存文档明写的正确写法）。`review` 未动，`sonnet` 仍同族末位 fallback。`toil` 缓：夜跑暂无需求，2026-07-01 撤回原 `codex:gpt-5.5`，待有 nightly runner 再议。
- 三级兜底阶梯（运行时 fail-safe 升级）：开发任务上 Sonnet 5 max 一直卡（`circuitBreaker` 判 `zeroCommitRounds`/`sameErrorRounds` 跳闸）→ 升 Opus 4.8 xhigh（原 plan）重试 → 再卡 → `NEEDS_HUMAN` 写 `loop/inbox.md`（护栏 #14 fail-safe 不 fail-open，能力升满仍证不出就路由人、绝不静默过）。机制锚已在 `circuitBreaker` + `breaker.mjs`；`toil` 不入此梯（机械小修，跳闸照旧写 inbox）。
- **静态强制兜底（两条不变量，机器守；模型能自由换的前提）**：
  - I1 裁判零 LLM（护栏 #15，承重）：`bin/verdict.mjs` 传递依赖闭包零 LLM/网络客户端——「上游随便换模型都不出静默假 PASS」的根兜底。
  - I2 异构评审不塌同族（护栏 #9 / ADR 异构冗余）：`review.model` 家族 ≠ `implementation.model` 家族，`sonnet`/`opus` 只能在 review `fallback`、绝不当主 `model`。
  - I3「Sonnet 5 只作 subagent 不换主环」是编排期运行时属性、静态不可查，不假装可强制；其兜底即 I1（verdict 零 LLM + 冻结 golden + gate 三重网）。
- **已建**（`model-lane-guard` 契约收口，2026-07-01）：I1 verdict 零依赖断言已入 `casey selftest --tier1`（`bin/verdict-purity-guard.mjs` 静态扫依赖闭包）；I2 config 不变量 PostToolUse 钩子已接（`bin/config-lane-guard{,-hook}.mjs` + `.claude/settings.json` 独立条）。**仍待建**：三级兜底 watcher 读 `loop/.breaker-state.json` 自动再派——另起辐条、不在 model-lane-guard 契约内（别 ad-hoc 破护栏 #11、别改 loop-kit engine ADR-0001）。config 的 `_doc` 是当前策略事实源。

## 下一步

> 新会话接续顺序（2026-07-07 刷新，本 session 八契约收口：相0 ingest / 回显缝 / 全链金牌 / 三面对齐 / 断言提硬 / 移交包 / 欠账清洗 / 飞轮第五条）：活契约槽 baton 空闲（`wf-open-smoke` 六阶段全 done），下一契约直接 `contract init`。hermetic 机制面七相全建首尾成链，余量大头 = 真机 route:human 合并行程（见 0）；机器可独立推进项见 2–7。

0. 真机合并行程（route:human，需拉反向隧道 + Steven 在场，一次行程可清三类）：① 飞轮三条 tc 四停站——`wf_publish_states` / `wf_history_version` / `wf_open_smoke` 均 hermetic 半程、从未真机跑：flow confirm → `compile --execute` → `casey draft` 人签 → `casey run` 报告过目；前置只读探针编辑器顶栏按钮 role 可达性重验（regress 二手结论）、真机行/卡片双布局核 `workflow.open` 定位；顺带核真机报告回放诊断栏目 + 回放视频呈现 + 真机 disabled 类名采样填 `profile.buttons.disabledClass`。② 会话异常闭环——`runs/tc_chiefcomplaint_smoke/run_1783054730282/defect-handoff.md` 两笔缺陷单（「互联网问诊-主诉」智能体回复异常 + `doLogin` GET 凭据走 query）转交平台、修后 `casey run` 复跑见绿。③ 移交包真机侧——MCP 真机挂载核验 + 凭据带外交付演练（handover-pack 挂账）。
1. 真机 compile bring-up 后接线 `casey run` 相0–2 前段（编排器现起于相3，prd-e2e-chain observability 记；ADR-0003 LLM 编译期真机跑亦在此程）。
2. 飞轮第六条起 = 画布维度 R9 前线（23 条 R9 坐标 flow blocked：画布原子无编译知识；`workflow.addNode` 现被 flow-bridge / wf-open-smoke 两处金牌当天然反例用——建原子时须例翻，涟漪先例已两轮）。
3. 余 kind 按需加法（护栏 #17）/ 错误 toast 结构类名采样 / 相5 自愈真机首触（需真 `HARNESS_ERROR`）/ 回放期面板吞点观察 / `report` 用法错历史码 exit 2 收敛（cli-mcp-face 挂账）/ 全仓输出通道系统审计（prd-caseid-echo-mask observability）。
4. `p2-intent-compile` 的 learn（沉淀收尾，轻）。
5. `term-guard` 乙真接线（待 `~/.loop-kit` 非 Claude 密钥）：`bin/term-judge.mjs` 的 `callRealJudge` 接真评分员（复用 review 道 DeepSeek/codex 路径），观察期无误判后把 `bin/term-guard-hook.mjs` 的 `WARN_ONLY` 置 false 切硬拦。
6. push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓。
7. 坏引用挂账（route:human）：loop 纪律 hook 引的 `docs/decisions/2026-06-12-loop-kit.md` 不存在，根在冻结 `loop-kit/bin/hook-loop-triage.mjs:8` 与 `.claude/skills/acceptance-gate/SKILL.md:8`，真身 `docs/adr/0001-reuse-loop-kit.md`。

## 契约 / 运维

- 活契约 `loop/active-contract.json`（runtime、gitignored）现 = `wf-open-smoke`（direct，六阶段全 done，2026-07-07）——baton 空闲，下一契约直接 `contract init <slug>`（重置台账、不丢磁盘草稿）。2026-07-06 白天时段三契约（均六阶段全 done、codex PASS 记 audit、learn 各落 `docs/plans/<slug>/learn.md`）：`sign`（相2 人签门，full，七轮 R7，`2497309`）/ `flow-bridge`（相1 flow 桥，full，三轮 R3，`ef13787`）/ `video-login-carry`（相3 回放，full，四轮 R4，`bb6f594`）。`sign` 未签闸硬接 `bin/replay.mjs` 的涟漪九件 golden 经 `signExpected` 重签、各 prd testChecksums 同步重签；`flow-bridge` 的 `compile-atoms` 分派重构涟漪 `p3-compile`/`chiefcomplaint-smoke`/`wf-publish-states`/`wf-history-version` 复跑零行为差。要提交而活契约是 pre-loop 的 full：先 `init` 一个 `direct` 契约授权 commit、提完 re-init 原契约恢复 baton；light 契约 plan 后 commit-impl 即放行、无 lib/bin 的提交任何时候放行；post-loop 的 full 契约提交放行。恢复某已 done / 被覆盖 契约的台账：re-init + 逐阶段 re-advance（grill 带 `--user-confirmed`、accept 带 `--red-verified`、artifact 交对应产物），gate 复验绿背书。
- 契约一览：
  - 2026-07-06 晚—07-07 八契约（均六阶段全 done、codex PASS 记 audit、learn 各落 `docs/plans/<slug>/learn.md`）：`ingest`（相0 归一，full，七轮 R7，`b7c8f61`）/ `caseid-echo-mask`（direct，一轮 R1，`d3a5c11`）/ `e2e-chain`（light，四轮 R4，`365c185`）/ `cli-mcp-face`（light，两轮 R2，`0d0d779`）/ `btn-enable-ops`（full，两轮 R2，`c33d519`）/ `handover-pack`（light，四轮 R4，`62d8acb`）/ `plan-debt-sweep`（full，一轮 R1，`44fb1df`）/ `wf-open-smoke`（direct，两轮 R2，`7027d53`）。前四条 = 相0 建成 + 姊妹 CLI 回显缝收口 + hermetic 全链集成金牌 + 三面对齐；后四条 = Steven 三问点单（断言提硬 / 移交包 / 欠账清洗 / 飞轮第五条）。另 `aeaa6b3` 补跑 prd-wf-publish-states s2 悬空涟漪锁 gate 复验。
  - 2026-07-06 白天四契约（均六阶段全 done、codex PASS 记 audit、learn 各落 `docs/plans/<slug>/learn.md`）：`sign`（相2 人签门，full，七轮 R7，`2497309`）/ `flow-bridge`（相1 flow 桥，full，三轮 R3，`ef13787`）/ `video-login-carry`（相3 回放舞步登录态 carry，full，四轮 R4，`bb6f594`）/ `replay-video`（回放视频录制，full，五轮 R5，`f291c70`，上一 session 末收口、本次刷入 HANDOFF）。前两条补齐「文本用例→spec」前半的 sign stub + flow 桥缺口，端到端唯余相0 归一 ingest。样例报告驱动 `scripts/sample-report.mjs` 证 hermetic 引擎端到端可跑（相3→相4→相6）。
  - 2026-07-03 全日七契约（均六阶段全 done、codex PASS 记 audit，learn 各落 `docs/plans/<slug>/learn.md`）：`run-history`（light，两轮）/ `chiefcomplaint-smoke`（full，三轮 + 审后微调 R4 微轮）/ `compile-caseid-shape`（direct，一轮，缺席推定已追认）/ `chief-bringup`（direct，两轮）/ `cred-route-mask`（direct，两轮）/ `login-traffic-drop`（direct，三轮）。真机件 `cases/tc_chiefcomplaint_smoke/`（gitignored）四件套 + `expected.frozen.json`（6 条全硬）+ `runs/.../run_1783054730282` 七件齐备。
  - `p3-compile`（full）：六阶段全 done（codex 三轮 R3 PASS 记 audit、learn 落 `docs/plans/p3-compile/learn.md`）。真机 bring-up 六项 route:human 已全清（2026-07-02/03，P3 收官，见「当前状态」）。
  - 前日六契约（2026-07-02 夜至 07-03 晨，均六阶段全 done、codex PASS 记 audit）：`replay-login-bootstrap`（light，两轮）/ `p4-drafter`（full，四轮，含 G-seam 双 enum 对齐 Steven 追认）/ `noerrenv-absence`（light，一轮）/ `run-login-passthrough`（direct）/ `report-fidelity`（light，三轮）/ `draft-cli`（light，两轮）/ `kinds-harden`（light，一轮）。learn 各落 `docs/plans/<slug>/learn.md`。
  - `layer3-wiring`（light）：六阶段全 done（codex 七轮 R7 PASS 记 audit、learn 落 `docs/plans/layer3-wiring/learn.md`；gate GREEN 2/2、覆盖 golden 51 检查）。
  - `seams-freeze-v2`（full）：六阶段全 done（codex 十二轮 R12 PASS 记 audit、learn 落 `docs/plans/seams-freeze-v2/learn.md`；gate GREEN、golden 13 组、`CONTEXT.md` 登记 6 术语）。四接缝 lib/bin 真产出随真机集成 route:human（prd observability 列）。
  - `term-guard`：6 阶段 done（gate GREEN 2/2、codex 九轮异构评审 pass、Stop 钩子 warn-only；乙真接线待密钥见「下一步」5）。
  - `model-lane-guard`：6 阶段 done（gate GREEN 2/2、codex 四轮异构评审 6→5→2→0 收敛 pass；I1+I2 守卫上线）。
  - `hermetic-gap-freeze`（direct）：done（两份缺口 coverage golden 补冻入 prd-p7-report / prd-p6-selfheal，gate 各 2/2）。
  - `p5-replay`（full）：6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；其 prd 的 tier-2 route:human 标注未正式核销，但回放内核已随 P3/P4 真机多轮实跑全绿（回放核验两轮 + `casey run` 三轮，2026-07-02/03）。
  - `p2-intent-compile`：仅 learn 待。其余（seams-freeze / p2-failsafe-coverage / p7-report / p4-freeze / p6-selfheal）loop done、产物落 dev。
- 单活契约 baton 教训（重要）：loop-kit 是单活契约（hook 读主树共享 `active-contract.json`）。本会话并行起多契约（worktree 隔离）撞了这个单 baton 槽——worktree 子代理 commit 受主树 baton 互锁：P6 子代理曾临时翻主 baton（已还原）、P4 子代理被拦只暂存未提交。landing 办法：已 committed 的分支用 `git merge`（不被 commit 互锁拦）；未提交的（P4）把文件拷进 dev、把主 baton 临时切到其真实 loop-done 契约提交、再还原。未来真并行须按 design §3.1：`LOOP_CONTRACT_FILE` 参数化 + `breaker --state`（未建）。
- push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓（参考 autotester = 私有 `ChenSteventx/autotester`）。
- 删不动的残留：`docs/plans/seams-freeze/proposed/`（评审副本，破坏性删除被权限层拦，待人 `! Remove-Item -Recurse -Force` 清）。
- 旧 `p2-testcase` 契约已被取代作废。term-lint 全程过；Windows git 需 `git config windows.appendAtomically false`（已设，否则 merge 报 index.lock 写错）。

## 历史层（溯源用，非现状）

- `P0/P1`（live，不变）：loop-kit 引擎（与 autotester 字节一致，ADR-0001）、护栏（12 迁移 + 13–17 新增）、`CONTEXT.md` 两限界上下文、ADR 0001–0006、`casey selftest --tier1`。
- **2026-06-26**：P2 重定义走完 grill→plan→accept，6 路深读 `regress_autotest`、ADR-0006 的 14 风险落代码核验、冻结 5 红 golden + 2 fixture + prd，停在 loop 前。详见 `docs/plans/p2-intent-compile/grill.md`。
- **2026-06-29**：开 loop 前的岔一/二/三 + 质量接口讨论 → 落档（FLYWHEEL/design/report-spec/flywheel-schedule）→ 实现 loop（S1/S2/S3 绿）→ 提交 `594ecf4` → Claude 侧异构评审 → 收口。
- **2026-06-29 晚续**：codex 真异构评审收口（7 修复，`7923088`）→ omc 列禁言禁用 → 排期 v2（接缝优先并行，`roadmap-parallel.md`）→ 第1层 5 接缝冻结（`4d184f6`）→ 第2层并行 worktree：track-F/P7（`b00b7c7`/`0832ed3`，合并 `e06e309`/`9d92892`）+ P6（`8734307`，合并 `1a37eba`）+ P4（`5a8b08d`）→ P5 grill+plan（ADR-0007）。第2层四轨全在 dev 亲验绿。单活契约 baton 撞并行的教训见「契约/运维」。

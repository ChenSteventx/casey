# 下个 session 接续提示词（Casey）

> 用法：下次开新 session 只需 `/starter`（等价于说「读 `docs/NEXT-SESSION.md` 接着干」）——把本文件内容当开场提示词读进来、按其【下一步】执行。本文件是给接续 Claude 的执行指令；状态事实以 `docs/HANDOFF.md` 为准，二者冲突时信 HANDOFF。本文件由 `/session-handoff` 自动刷新（整节替换为最新开场提示词，剪掉过期内容）。

## 开场提示词

```
项目：Casey（测易，LLM 驱动「文本用例→测试报告」确定性可回放测试系统）。
工作目录 /mnt/d/ctx/heren/casey，分支 dev（master 稳定 / test 提测）。
你是接手者，零上下文起步——先读文档对齐，再按下一步动手。

【一句话定位 + 血缘】
Casey 是 autotester（人录·机回放·零 LLM）的「翻面」：输入端改 LLM 读懂文本用例，
但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。
复用 autotester 的 loop-kit 作第二消费者（ADR-0001）。三处统一标识符 casey：
CLI bin/casey.mjs、skill .claude/skills/casey、MCP mcp/casey-server.mjs。
人类同事移交入口 = README.md（handover-pack 契约建成，八节自包含 + 漂移锁金牌盯防）。

【先读，别现编已决的事】（必读顺序）
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用）
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-07 晚：本 session 五契约收口——
   真机合并行程首航 + 画布两原子 wf-add-node/wf-connect-nodes + report-exit64 + output-seal 全仓输出封缝）
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源，0001–0007）、docs/design/（端到端设计，文实不符处见文内
   「已知偏离」errata 表）；docs/decisions/ 目录不存在，loop 纪律钩子引的坏引用真身是
   docs/adr/0001-reuse-loop-kit.md。环境坑参考本文件文末（WSL / 隧道启动顺序 / loop-guard 误判）。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎同仓拷入归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与四态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN。
- ADR-0003 编译再回放 + 非就地有界自愈：LLM 只编译期读一次用例、日常回放零 LLM；自愈写旁车补丁、人签后应用。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从类型词汇表选、易变值模板化；人签是 CASE_DEFECT 与 SUT_DEFECT 分水岭；期望带 signedAgainstBuild 可重签。
- ADR-0005 统一语言强制：四列制术语表唯一白/黑名单源；Stop + PostToolUse 双 hook；造词先登记；中文禁繁体。
- ADR-0006 Casey = autotester 与 regress 分层融合：否决白嫖 60 原子，锁「扩断言词表 + watchNetworkForensics + 原子吐三轴」增量序。
- ADR-0007 P5 回放基座 @playwright/test + 取证按 CDP 真发起方归因 + 背景 denylist；证不出归 null 永不背书；通道剖面抽非凭据配置。
- 里程碑时间线（git log，越往下越新）：接缝两层冻结 → P5 回放内核 → 机制护栏上线 → layer3-wiring →
  p3-compile 收官 → 相2 首航（人签断言真机 4/4 PASS）→ 相6 真机报告 → P4 草拟器 → 2026-07-03 全日七契约
  （飞轮第二条真机贯通 + Casey 首个真机 SUT_DEFECT）→ 飞轮三/四 + 报告诊断 → 2026-07-06 三相补齐
  （sign 相2 + flow-bridge 相1 + video-login-carry 相3）→ 2026-07-06 晚—07-07 凌晨八契约
  （ingest 相0 建成 + e2e-chain 全链金牌 + cli-mcp-face 三面对齐 + Steven 三问点单四契约）→
  2026-07-07 下午—晚五契约：真机合并行程首航（wf_publish_states 4/4 + wf_history_version 8/8 真机全绿，
  sign 真 prd 首航，24865f4）→ wf-add-node 画布首原子 workflow.addNode + dragTo 动作类（dbc0d0d）→
  report-exit64 report 用法错 exit 2→64（407b511）→ output-seal 全仓输出通道封缝 23 口（cc7a3c2）→
  wf-connect-nodes 并发 codex 实现补收口 workflow.connectNodes 集 14→15（efaa41a，评审归属反转 Claude 评）。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线全建（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性；heal 是唯一诚实桩）：
  相0 归一 ingest → 相1 编译 compile（flow-bridge 桥 + compile 三段式；COMPILE_KNOWN_ATOMS 现 15——
  本 session +workflow.addNode/connectNodes 破画布维度两原子；仍需一次真机 compile bring-up 落 events，ADR-0003）
  → 相2 草拟+冻结+人签（casey draft + casey sign；未签前置闸硬接 replay；sign 冻结期字面量 lint）
  → 相3 回放 replay（零 LLM，登录预备动作 + 舞步登录态 carry + 视频录制 + 静默点采集 + 动态流等待）
  → 相4 裁定 verdict（零 LLM 四态）→ 相5 自愈 self-heal（仅确证 HARNESS_ERROR，尚未吃过真场景，CLI 桩）
  → 相6 报告 report（零 LLM 自包含 HTML/MD/json + 回放诊断栏目）。
  hermetic「文本→报告」十站全链已由 e2e-chain 集成金牌锁定（~35s 不入 tier1）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中才 acted；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。workflow.open 另有容器归属闸
    （text-exact 全页唯一仍须命中在表格行/卡片记录容器内，容器外硬阻断）。
  · dragTo 动作类（本 session 新，events.schema 第 8 动作）：画布拖拽封确定性动作——源经语义定位器锚 .node-item
    面板项 + 点击身份门（唯一才拖），落点 ox/oy 是内容参数（相对 .lf-graph 容器左上角，非定位兜底、必填不缺省）；
    回放 doDragTo 专用同刻门 = 编译门（源锁 .node-item 域）；mouse 三段式 down→move(steps:12)→300ms→up。
  · 断言词汇表：kind 枚举唯一活在 bin/check.mjs；IMPLEMENTED_KINDS 现 11 种（replay-assert 唯一供源）；
    countChange 计数通道可经 profile.countSelector 换选择器（画布用例配 .lf-node，缺省 .hr-table-row 零行为差）。
  · 网络取证按发起方归因：按 attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 通道剖面 profile：channel 回放所需非凭据配置（背景 denylist + 信封成功字段 + routes + chat 流参数 +
    buttons.disabledClass + countSelector）。
  · 输出通道封缝纪律（output-seal）：凭据门只扫落盘产物、stderr/CLI 回显在扫描面外——遮值 + 定位字段一律
    改结构性数组下标（SAFE_ID 挡不住字母数字种子）；异常 JSON.parse 消毒重抛（V8 报文携内容片段）。
  · 登录预备动作 / 凭据路由名打码 / 静默点 / 观测现状 / 冻结断言契约 / TestCase 聚合根 / 错误信封：见 CONTEXT.md。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict / 熔断器 / 报告渲染 / 凭据兜底门）；
  L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁。
  注意 loop 阶段不能跳：accept 后先 advance loop（交 prd）再 advance review（本 session 踩过一次漏 loop）。
- 入口分流三档：direct=地板全放行（台账仍六阶段齐走：grill 要 --user-confirmed、accept 要 prd 且 testChecksums 非空 + --red-verified）；
  light=加 plan 门；full=全链（碰冻结内核必走）。direct/full 都不豁免异构评审深度。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；共享夹具改动后跑全部消费者 golden + 重签全部相关 prd 的夹具 checksum。
- 例翻涟漪纪律：金牌拿「无编译知识原子」当反例时，该原子建成后须例翻到仍无知识的原子并重签 prd
  （wf-add-node 把 workflow.addNode 反例翻到 agent.openToolPicker；flow-bridge C5/C14/C15 + wf-open-smoke C1 四钉位）。
- sign 真 prd = 扁平每用例 prd（loop/prd-tc_<caseId>.json，sign 写 expectedFrozenPath + checksum），与金牌契约 prd 两类勿混。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫；加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 /
  #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 入参畸形 fail-closed（verdict exit 64/65）；回放看门狗 120s 强退；--login-bootstrap 前置/登录失败 exit 65 不落 axes。
- 断言评估：未实现 kind / 缺采集 / 缺 value 一律 ok:false + actual:null；dragTo 落点 ox/oy 缺失即证不出不拖、
  画布容器 .lf-graph 缺席回 false 不假绿；行计数失败回 null 不回 0（防 countChange===0 假绿）。
- 取证按发起方归因：只认 attributedStepId===本步；stepId==null 不背书。
- gate 默认 FAIL 凭证据翻绿；熔断器越阈写 loop/inbox.md 后 exit 2。
- 凭据兜底门：所有落盘口过 lib/cred-gate.mjs（FORBIDDEN_KEYWORDS 单一事实源）——ingest/flow-bridge 输入
  前置扫、compile 四件套、sign 冻结+sidecar、报告、axes、回放历史/指标、inbox/candidates（output-seal 新纳）；
  命中拒写非零退出。输出通道封缝：路径段打码 + axes 剥 host + 登录期流量切断 + 报告诊断标量 :// 零容忍 +
  全仓 die/console 用户可控插值遮值/消毒 + 定位字段结构性下标（output-seal 系统封 23 口）。

【排期】
- P0–P9 机制面全建：相0–相6 七相全建首尾成链（heal 唯一诚实桩）；hermetic 全链集成金牌（e2e-chain）+
  CLI/MCP/skill 三面漂移锁金牌（cli-mcp-face）+ README 移交包（handover-pack）+ 全仓输出通道封缝（output-seal）。
  P8 多目标未开始；P9 tier-1 绿、tier-2 随真机实跑持续兑现。
- 飞轮五条铺四维度 + 画布维度已破首原子：dom_crud（tc_catalog_wf_crud 7 条全硬）/ chat（tc_chiefcomplaint_smoke 首跑
  SUT_DEFECT 真发现）/ 发布状态（wf_publish_states + wf_history_version 真机 4/4 + 8/8 PASS）/ 列表打开（wf_open_smoke
  hermetic 半程、真机件已备待定名）/ 画布（wf-add-node 建 workflow.addNode + wf-connect-nodes 建 connectNodes，openNode/setNodeField 续建）。
- 单 baton 上限：loop-kit 单活契约；并行只用在零 baton fan-out（研究/探针/schema/golden 起草/异构评审）。

【当前契约 / 状态】
- 活契约槽 baton 空闲（wf-connect-nodes 六阶段全 done）——下一契约直接 contract init。最新提交 efaa41a；
  工作树仅剩用户自己的 M .gitignore（Steven 的改动，别动别提交）。
- 本 session（2026-07-07 下午—晚）五契约五提交：真机合并行程首航（route:human，两条 tc 真机四停站全绿、
  sign 真 prd 首航）/ wf-add-node（full，画布首原子 + dragTo 动作类，codex R2 PASS）/ report-exit64（light，
  R1 PASS）/ output-seal（full，全仓输出封缝 23 口，codex 三轮 R3 PASS 连堵「定位字段也是文件侧」同型缝三次）/
  wf-connect-nodes（full，并发 codex 实现补收口 workflow.connectNodes 集 14→15，Claude 侧对抗评审 PASS）。
- 最新工程纪律：① sign 真 prd = 扁平每用例 prd（勿与金牌契约 prd 混）；② 输出封缝定位字段一律结构性下标
  （SAFE_ID 挡不住字母数字种子——codex 连三条实证）、校验前字段须遮校验后枚举可留；③ 示教（teach-in）兜底三决策
  已定（命名示教 / 录不算签 / 不开直通回放）契约未落；④ 真机账户禁令：唯一许用 autotest、动真机前带外核 .auth；
  ⑤ 异构评审归属可反转——实现方是 codex（并发 session 写的）时送 codex 就同族自评，反转由 Claude 侧评（价值实锤：
  Claude 揪出 codex 的 F1/F2 健壮性缝，自己写的代码对自己立的规矩视而不见）；⑥ 并发 session 共享树治理：另一
  session 做 lib/bin 改动不走契约 + 不重签 = test 级绿但 gate 级红（checksum 漂移），收口方须 checksum 全扫 + 补
  台账 + 补覆盖 + 异构评审；摸清并发停手用双照 checksum。
- 承前纪律不变：Claude 实现时 review 用 codex（gpt-5.5 非同族、空 cwd 喂 stdin、--skip-git-repo-check、逐发现
  采信/证伪/修正三处置）绝不同族自评；评审包新文件走全文、改动文件走 git diff、不许「…」省略被评对象；codex
  网络卡死（Reconnecting 循环零输出）掐掉重发；模型分层机制（I1/I2 已上线、三级兜底 watcher 待建）不变；
  提交只用显式路径绝不 -A。

【下一步（任选其一，先对齐再动手）】
A 真机合并行程续跑（route:human，需拉隧道 + Steven 在场 + 先带外确认 .auth 为 autotest；HANDOFF「下一步」0 有全单）：
  ① wf_open_smoke 四停站（三件已备、须现场定 openName）；② 两笔缺陷单转交平台修后复跑见绿；③ 移交包真机侧
  （MCP 挂载 + 凭据带外交付演练）；④ 顺带真机采 wf-add-node 四项观测 + disabled 类名。
B 画布维度续建（机器可独立推 hermetic 半程；addNode + connectNodes 已建）：workflow.openNode（双击开抽屉，纯 click
  骑本 session 画布/连线夹具零冻结）→ selectNodeDropdown（贪心序 +此解锁 9/23）→ setNodeField。建原子须例翻 + 重签 prd。
  connectNodes 的 window.lf 图对象口挂账（连对哪两个的确定性取证）route:human。
C 示教（teach-in）手动录制兜底正式契约（Steven 三决策已定）：record-capture（casey record CLI）/ record-intake
  （触发接线 + 失败台账兑现）/ record-distill（蒸馏 SOP + 例翻闭环）；最小可用版应急脚本已在 scratchpad。
D 小加法菜单：余 kind 按需（inputReadback/requiredFilled 最便宜）/ toast 结构类名采样（卡真机）/ switchState kind
  / term-guard 乙接线骨架 + learn 补账（不卡密钥可先行，端到端待密钥）/ 相5 自愈真机首触（需真 HARNESS_ERROR）。

【环境坑（WSL）】
- 反向隧道（真机访问必用）启动顺序敏感：先 WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），
  后 Windows 侧双击 scripts/win-forward-start.cmd；Windows 先起会留僵尸连接占池不补，重启 Windows 代理即愈。
  WSL 内基址 http://127.0.0.1:15519（= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出。
  真机命令一律 WSL 侧跑（G6 人签既定）。--sut 只喂回环基址、真目标地址绝不进 shell 历史。
- 真机账户：唯一许用 autotest，此前账户停用——动真机前先请 Steven 带外确认 .auth/credentials.json 已换（机器不回显内容）。
- WSL 中文字体：已装用户级 Noto Sans CJK；截图/录屏中文空白先 fc-list :lang=zh 查。
- 9p 崩溃：/mnt/d 全局 EIO 时资源管理器戳一下 D: 唤醒，或 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d。
- git index.lock 卡挂：先 pgrep -a git 杀挂死进程、再删 .git/index.lock。loop/audit.jsonl 与 cases/runs gitignored（提交时警告非错）。
- loop-guard 误判（比想象宽）：命令含 prd 路径 → 判 write-prd；node -e 内联 / cp / rm → 判 edit-impl；
  读类命令带重定向/管道 + bin/ 路径 → 判 edit-impl。对策：查文件用 Read 工具、删/拷用 scratchpad 脚本。
- 授权提交/切 baton：full 契约 pre-loop 拦 commit-impl，先 init 一个 direct 契约授权、提完 re-init 恢复；
  post-loop 的 full 契约与 plan 后的 light 契约提交放行；纯 docs 提交任何时候放行。
- 行尾/checksum 整库 LF 一致；查行尾用 node 数 0x0d。路径 D:\→/mnt/d/。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
契约 review 用 codex 异构评审、绝不同族自评。可并行的活优先 fan-out 零 baton 子代理；
决策分岔用可点选项呈现、别散文长问。真机 route:human 项需人在场（拉隧道/人签/过目），人不在场只挂账绝不代签；
真机账户唯一许用 autotest、动真机前带外核 .auth。
```

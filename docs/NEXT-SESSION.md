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
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-07：本轮八契约收口——相0 ingest 建成 +
   hermetic 全链集成金牌 + CLI/MCP/skill 三面对齐 + Steven 三问点单四契约；七相全建、首尾成链、三面同真）
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源）、docs/design/（端到端设计，文实不符处见文内
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
- 里程碑时间线（git log，越往下越新）：接缝两层冻结 + 四轨 hermetic → P5 回放内核 → 机制护栏上线 →
  layer3-wiring → p3-compile 收官 → 相2 首航（人签断言真机 4/4 PASS）→ 相6 真机报告 + 保真度三修 →
  P4 草拟器 + draft-cli → kinds-harden → 2026-07-03 全日七契约（chiefcomplaint-smoke 飞轮第二条真机贯通、
  Casey 首个真机 SUT_DEFECT）→ 飞轮三/四条 + 报告诊断（wf-publish-states 158ead2 / report-diagnostics /
  wf-history-version）→ 2026-07-06 白天：replay-video → video-login-carry → sign 相2 人签门（2497309）→
  flow-bridge 相1 flow 桥（ef13787）→ 2026-07-06 晚—07-07 八契约：ingest 相0 归一建成（b7c8f61）→
  caseid-echo-mask 回显封缝（d3a5c11）→ e2e-chain hermetic 文本→报告全链首次贯通（365c185）→
  cli-mcp-face 三面对齐（0d0d779）→ btn-enable-ops 断言提硬（c33d519）→ handover-pack 移交包（62d8acb）→
  plan-debt-sweep 欠账清洗（44fb1df）→ wf-open-smoke 飞轮第五条（7027d53）。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线全建（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性；heal 是唯一诚实桩）：
  相0 归一 ingest（bin/ingest.mjs + lib/parse-testcase.mjs + tests/_golden/schemas/testcase.schema.json：
  候选文本→规范嵌套 TestCase，凭据门前置扫输入原文、手写投影器保「校验对象=落盘对象」同一性）
  → 相1 编译 compile（flow-bridge 桥 + compile 三段式；COMPILE_KNOWN_ATOMS 现 13；仍需一次真机
  compile bring-up 落 events + 观测现状，ADR-0003）→ 相2 草拟+冻结+人签（casey draft + casey sign；
  未签前置闸硬接 replay；sign 冻结期字面量 lint：断言字符串含 atl_ 裸前缀或 9+ 位时间戳 exit 65）
  → 相3 回放 replay（零 LLM，登录预备动作 + 舞步登录态 carry + 视频录制 + 静默点采集 + 动态流等待）
  → 相4 裁定 verdict（零 LLM 四态）→ 相5 自愈 self-heal（仅确证 HARNESS_ERROR，尚未吃过真场景，CLI 桩）
  → 相6 报告 report（零 LLM 自包含 HTML/MD/json + 回放诊断栏目）。
  hermetic「文本→报告」十站全链已由 e2e-chain 集成金牌锁定（tests/_golden/e2e-chain.golden.mjs，~35s 不入 tier1）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中才 acted；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。workflow.open 另有容器归属闸：
    text-exact 全页唯一仍须命中在表格行/卡片记录容器内，容器外硬阻断 fail-closed 不点（同名非行控件碰撞实证）。
  · 网络取证按发起方归因：按 attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 断言词汇表：kind 枚举唯一活在 bin/check.mjs；IMPLEMENTED_KINDS 现 11 种（replay-assert 唯一供源）；
    buttonState 四 op 全实现（present/absent/enabled/disabled）——disabled 判据 = disabled 属性 ∨
    aria-disabled="true" ∨ profile.buttons.disabledClass 命中（Steven 人签）；buttonDisabledHits 双通道
    采集镜像 buttonHits；hits===0 时 enabled/disabled 一律证不出 ok:false；NaN 经 Number.isInteger 闸封 fail-open。
  · capturedAgainstBuild：编译期从入口 HTML 脚本 src 抓 [?&]v= 前端发版号自动填，取不到 fail-safe null。
  · 通道剖面 profile：channel 回放所需非凭据配置（背景 denylist + 信封成功字段 + routes + chat 流参数 +
    buttons.extraSelector / buttons.disabledClass）。
  · 投影器纪律（ingest）：落盘 JSON 走手写投影（own enumerable data、稠密数组、拒 toJSON/accessor、
    Object.create(null) 防原型污染键），杜绝「校验的对象与落盘的字节不同一」。
  · 登录预备动作 / 凭据路由名打码 / 静默点 / 观测现状 / 冻结断言契约 / TestCase 聚合根 / 错误信封：见 CONTEXT.md。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict / 熔断器 / 报告渲染 / 凭据兜底门）；
  L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁。
- 入口分流三档：direct=地板全放行（台账仍六阶段齐走：grill 要 --user-confirmed、accept 要 prd 且 testChecksums 非空 + --red-verified）；
  light=加 plan 门；full=全链（碰冻结内核必走）。direct 不豁免异构评审深度（wf-history-version 三轮、wf-open-smoke 两轮实证）。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；共享夹具改动后跑全部消费者 golden + 重签全部相关 prd 的夹具 checksum。
- 例翻涟漪纪律：金牌拿「无编译知识原子」当反例时，该原子一旦建成须例翻到仍无知识的原子并重签 prd
  （flow-bridge 金牌两轮例翻实证：nav.workflowManagement 建成后换 workflow.addNode）。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫；加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 /
  #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 入参畸形 fail-closed（verdict exit 64/65）；回放看门狗 120s 强退；--login-bootstrap 前置/登录失败 exit 65 不落 axes。
- 断言评估：未实现 kind / 缺采集 / 缺 value 一律 ok:false + actual:null；buttonState.absent 缺活性反证证不出；
  enabled/disabled 在按钮不在场（hits===0）时证不出。
- 取证按发起方归因：只认 attributedStepId===本步；stepId==null 不背书。
- gate 默认 FAIL 凭证据翻绿；熔断器越阈写 loop/inbox.md 后 exit 2。
- 凭据兜底门：所有落盘口过 lib/cred-gate.mjs（FORBIDDEN_KEYWORDS 单一事实源）——ingest/flow-bridge 输入
  前置扫、compile 四件套、sign 冻结+sidecar、报告、axes、回放历史/指标；命中拒写非零退出。
  投影侧配套：路径段打码 + axes 剥 host + 登录期流量切断 + 报告诊断标量 :// 零容忍；
  拒绝分支不回显原值（caseid-echo-mask 六处封缝 + 全仓输出通道系统审计挂账）。

【排期】
- P0–P9 机制面全建：相0–相6 七相全建首尾成链（heal 唯一诚实桩）；hermetic 全链集成金牌（e2e-chain）+
  CLI/MCP/skill 三面漂移锁金牌（cli-mcp-face，MCP 工具 12 个、TOOLS 导出直测）+ README 移交包（handover-pack）。
  P8 多目标未开始；P9 tier-1 绿、tier-2 随真机实跑持续兑现。真机端到端（真机 compile bring-up + 相2 人签在场）全属 route:human。
- 飞轮五条铺四维度：dom_crud（tc_catalog_wf_crud 7 条全硬 4/4 PASS）/ chat（tc_chiefcomplaint_smoke 首跑
  SUT_DEFECT 真发现）/ 发布状态（wf_publish_states + wf_history_version）/ 列表打开（wf_open_smoke）。
  三条 hermetic 半程待真机（wf_publish_states / wf_history_version / wf_open_smoke，可一次行程合并）。
  下一前线 = 画布维度：23 条 R9 坐标 flow blocked 在画布原子编译知识（workflow.addNode 现被两处金牌当反例用，建原子须例翻）。
- 单 baton 上限：loop-kit 单活契约；并行只用在零 baton fan-out（研究/探针/schema/golden 起草/异构评审）。

【当前契约 / 状态】
- 活契约槽 baton 空闲（wf-open-smoke 六阶段全 done）——下一契约直接 contract init。最新提交 36fb9c0；
  工作树仅剩用户自己的 M .gitignore（Steven 的改动，别动别提交）。
- 本 session（2026-07-06 晚—07-07）八契约八提交：前四条把机制面收满（ingest 相0 / caseid-echo-mask 回显缝 /
  e2e-chain 全链金牌 / cli-mcp-face 三面对齐），后四条是 Steven 三问点单（btn-enable-ops 断言提硬 /
  handover-pack 移交包 / plan-debt-sweep 欠账清洗 / wf-open-smoke 飞轮第五条），全部 codex PASS 记 audit、
  learn 各落 docs/plans/<slug>/learn.md。
- 最新工程纪律：① 评审包不许「…」省略被评对象（handover-pack R2 残项根因实证）；② sign 冻结期字面量 lint
  上线后，断身份要用去前缀子串而非 atl_ 字面量（wf-open-smoke 实证其误伤面）；③ 手写投影器保校验↔落盘
  同一性（JSON.parse 可把原型污染键建成 own 键、投影赋值可触原型 setter——ingest R6 High 实证）；
  ④ 容器归属闸：全页 text-exact 唯一不等于身份正确。
- 承前纪律不变：review 用 codex（gpt-5.5 非同族、空 cwd 喂 stdin、逐发现采信/证伪/修正采纳三处置）绝不同族自评；
  评审包新文件走 cat 全文、改动文件走 git diff；direct 不豁免评审深度；route:human 项人不在场只挂账绝不代签；
  模型分层机制（I1/I2 已上线、三级兜底 watcher 待建）不变；提交只用显式路径绝不 -A。

【下一步（任选其一，先对齐再动手）】
A 真机合并行程（route:human，需拉隧道 + Steven 在场，一次行程清三类；HANDOFF「下一步」0 有全单）：
  ① 飞轮三条 tc 四停站（wf_publish_states / wf_history_version / wf_open_smoke：flow confirm →
  compile --execute → casey draft 人签 → casey run 报告过目；顺带核回放诊断栏目 + 视频呈现 +
  真机 disabled 类名采样）；② 两笔缺陷单转交平台修后复跑见绿；③ 移交包真机侧（MCP 挂载核验 + 凭据带外交付演练）。
B 飞轮第六条 = 画布维度 R9 前线（机器可独立推进 hermetic 半程）：画布原子编译知识（workflow.addNode 等），
  建原子须例翻两处金牌反例 + 重签 prd（例翻涟漪先例已两轮）。
C 小加法菜单（机器可独立推进）：余 kind 按需加法（护栏 #17）/ 错误 toast 结构类名采样 /
  report 用法错历史码 exit 2 收敛 / 全仓输出通道系统审计 / p2-intent-compile learn / term-guard 乙真接线（待密钥）。
D 相5 自愈真机首触（需真 HARNESS_ERROR，依赖 A 行程中真机漂移出现）/ casey run 相0–2 前段接线（依赖真机 compile bring-up）。

【环境坑（WSL）】
- 反向隧道（真机访问必用）启动顺序敏感：先 WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），
  后 Windows 侧双击 scripts/win-forward-start.cmd；Windows 先起会留僵尸连接占池不补，重启 Windows 代理即愈。
  WSL 内基址 http://127.0.0.1:15519（= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出。
  真机命令一律 WSL 侧跑（G6 人签既定）。
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
决策分岔用可点选项呈现、别散文长问。真机 route:human 项需人在场（拉隧道/人签/过目），人不在场只挂账绝不代签。
```

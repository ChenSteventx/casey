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

【先读，别现编已决的事】（必读顺序）
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用）
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-03 续：飞轮三/四 + 报告诊断三契约收口）
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源）、docs/design/（端到端设计）；
   docs/decisions/ 目录不存在，loop 纪律钩子引的坏引用真身是 docs/adr/0001-reuse-loop-kit.md。
   环境坑参考本文件文末（WSL / 隧道启动顺序 / 中文字体 / loop-guard 误判）。

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
  P4 草拟器 + draft-cli → kinds-harden（5→7）→ 重签提硬（7 条全硬）→ 2026-07-03 全日七契约
  （run-history → chiefcomplaint-smoke 飞轮第二条真机贯通、Casey 首个真机 SUT_DEFECT，f0bd596）→
  2026-07-03 续三契约：wf-publish-states 飞轮第三条（buttonState 提硬，158ead2）→ report-diagnostics
  报告回放诊断栏目（7ca5fc6）→ wf-history-version 飞轮第四条（零机制缝，7ec2ff2）。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest（桩）→ 相1 编译 compile（唯一一次真机跑，落 events + 观测现状）→ 相2 草拟+冻结+人签（casey draft 命令化）
  → 相3 回放 replay（零 LLM，--login-bootstrap 过登录墙 + 代表步静默点采集 + 动态流等待）→ 相4 裁定 verdict（零 LLM 四态）
  → 相5 自愈 self-heal（仅确证 HARNESS_ERROR，尚未吃过真场景）→ 相6 报告 report（零 LLM 自包含 HTML/MD/json）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中或点击后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 网络取证按发起方归因：按 initiator/attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 动态流等待：动作步作用域内「本步发起 且 命中 profile.chat.streamUrlPattern 域」的 EventSource 才等 finished。
  · 断言词汇表：kind 枚举唯一活在 bin/check.mjs（15 种）；IMPLEMENTED_KINDS 现 11 种（replay-assert 唯一供源；
    2026-07-03 续 +buttonState，present/absent 双 op；enabled/disabled 留位挂账随 publish_blocked 带实现回归）；
    buttonState 采集 = buttonHits 双通道合计（role 必采 + profile.buttons.extraSelector 补采）+ buttonSeen 活性反证
    （absent 判真须通道活着、盲区证不出）。未实现 kind 现以 switchState 为冻结 golden 未实现范例。
  · 回放诊断（report-diagnostics）：报告呈现层加法——run-metrics 全局指标行 + run-history 按 intentId 嵌步卡，
    标「仅诊断不进裁定」；渲染器 renderReport(model, diagnostics) 可选第二参、单参字节级零差异；旁件缺席零行为差、
    坏件 fail-closed；诊断标量 :// 零容忍脱敏（路 B 绕过装配器脱敏、呈现层补防线）。report-model 与冻结 schema 零动。
  · 通道剖面 profile：channel 回放所需非凭据配置（背景 denylist + 信封成功字段 + routes + chat 段流参数 + buttons.extraSelector）。
  · 登录预备动作 / 凭据路由名打码 / 静默点 / 观测现状 / 冻结断言契约 / TestCase 聚合根 / 错误信封：见 CONTEXT.md。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict / 熔断器 / 报告渲染 / 凭据兜底门）；
  L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁。
- 入口分流三档：direct=地板全放行（但台账仍六阶段齐走：grill 要 --user-confirmed、accept 要 prd 且 testChecksums 非空 + --red-verified）；
  light=加 plan 门；full=全链（碰冻结内核必走）。direct 不豁免异构评审深度（wf-history-version 三轮才 PASS 实证）。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；共享夹具改动后跑全部消费者 golden + 重签全部相关 prd 的夹具 checksum。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫；加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 /
  #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 入参畸形 fail-closed（verdict exit 64/65）；回放看门狗 120s 强退；--login-bootstrap 前置/登录失败 exit 65 不落 axes。
- 断言评估：未实现 kind / 缺采集 / 缺 value 一律 ok:false + actual:null；buttonState.absent 缺活性反证（buttonSeen）证不出。
- 取证按发起方归因：只认 attributedStepId===本步；stepId==null 不背书。
- gate 默认 FAIL 凭证据翻绿；熔断器越阈写 loop/inbox.md 后 exit 2。
- 凭据兜底门：所有落盘口过 lib/cred-gate.mjs——compile 四件套、报告、axes、回放历史/指标；命中拒写非零退出。
  投影侧配套：路径段打码 + axes 剥 host + 登录期流量切断 + 报告诊断标量 :// 零容忍。

【排期】
- P0–P3 全收官；P4 全落；P5 done；P6 hermetic done（相5 未吃过真 HARNESS_ERROR）；P7 done + 保真度三修 + 报告诊断栏目；
  P8 未开始；P9 tier-1 绿、tier-2 随真机实跑持续兑现。
- 飞轮已铺三维度：dom_crud（tc_catalog_wf_crud 7 条全硬 4/4 PASS + tc_wf_publish_states + tc_wf_history_version）/
  chat（tc_chiefcomplaint_smoke 6 条全硬、首跑 SUT_DEFECT 真发现）/ 发布状态（wf_publish_states/wf_history_version）。
  画布维度（R9 前线）压最后；wf_open_smoke（只读零缝）是暖场候选。
- 单 baton 上限：loop-kit 单活契约；并行只用在零 baton fan-out（研究/探针/schema/golden 起草/异构评审）。

【当前契约 / 状态】
- 活契约槽 baton 空闲（wf-history-version 六阶段全 done）——下一契约直接 contract init。工作树净，最新提交 7ec2ff2。
- 本 session（2026-07-03 续）三契约三提交：wf-publish-states（full，飞轮第三条，buttonState 提硬）/
  report-diagnostics（light，报告回放诊断栏目）/ wf-history-version（direct，飞轮第四条，零机制缝）。
  机制缝递减假设终点验证：第二条 3 缝 → 第三条 1 缝 → 第四条 0 缝。
- 选型教训：echo_default_on 归 chat 是二手结论错档（实测画布维度、坐标拖拽），FLYWHEEL/CONTEXT 已纠；
  排期表维度归类按「用了什么机制通路」重验，不按名字/直觉。
- 报告事实（本 session 用户三问揪出）：cases/runs 全 gitignored（凭据卫生），报告只在真机 casey run 后本地产；
  新两条 tc 从未真机跑、无报告；报告无视频根因 = replay.mjs 未启 recordVideo（非隧道问题，补录是加法契约候选）。
- 最新工程纪律：review 用 codex（gpt-5.5 非同族、空 cwd 喂 stdin、逐发现采信/证伪/修正采纳三处置）绝不同族自评；
  评审包新文件走 cat 全文、改动文件走 git diff（未跟踪文件 git diff 空会误判）；direct 不豁免评审深度；
  对 route:human 项人不在场只挂账绝不代签；模型分层机制（I1/I2 已上线，三级兜底 watcher 待建）不变。

【下一步（任选其一，先对齐再动手）】
A 真机四停站（route:human，需拉隧道 + Steven 在场，可一次行程合并 wf-publish-states + wf-history-version）：
  flow confirm → compile --execute → casey draft 人签 → casey run 报告过目；顺带核回放诊断栏目真机呈现。
B 会话异常闭环（route:human）：defect-handoff.md 已备两笔缺陷单，Steven 转交平台修复 → casey run 复跑见绿。
C 回放视频录制（P7/replay 加法，碰回放器须 full）：newContext({recordVideo}) + 落 runDir + 报告 attachments.video
  接线 + 凭据卫生（视频不含登录期镜头）——补报告无视频缺口。
D 飞轮第五条（wf_open_smoke 只读零缝暖场 或 画布维度 R9 前线）/ 余 kind 加法（含 enabled/disabled 随 publish_blocked
  带实现回归）/ 错误 toast 结构类名采样 / p2-intent-compile learn / 相5 自愈真机首触。

【环境坑（WSL）】
- 反向隧道（真机访问必用）启动顺序敏感：先 WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），
  后 Windows 侧双击 scripts/win-forward-start.cmd；Windows 先起会留僵尸连接占池不补，重启 Windows 代理即愈。
  WSL 内基址 http://127.0.0.1:15519（= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出。
  真机命令一律 WSL 侧跑（G6 人签既定）。
- WSL 中文字体：已装用户级 Noto Sans CJK；截图/录屏中文空白先 fc-list :lang=zh 查。
- 9p 崩溃：/mnt/d 全局 EIO 时资源管理器戳一下 D: 唤醒，或 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d。
- git index.lock 卡挂：先 pgrep -a git 杀挂死进程、再删 .git/index.lock。loop/audit.jsonl 与 cases/runs gitignored（提交时警告非错）。
- loop-guard 误判（比想象宽）：命令含 prd 路径 → 判 write-prd；node -e 内联 / cp / rm → 判 edit-impl；
  读类命令带重定向/管道 + bin/ 路径 → 判 edit-impl。对策：查文件用 Read 工具或 scratchpad 脚本。
- 授权提交/切 baton：full 契约 pre-loop 拦 commit-impl，先 init 一个 direct 契约授权、提完 re-init 恢复；
  post-loop 的 full 契约与 plan 后的 light 契约提交放行；纯 docs 提交任何时候放行。
- 行尾/checksum 整库 LF 一致；查行尾用 node 数 0x0d。路径 D:\→/mnt/d/。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
契约 review 用 codex 异构评审、绝不同族自评。可并行的活优先 fan-out 零 baton 子代理；
决策分岔用可点选项呈现、别散文长问。真机 route:human 项需人在场（拉隧道/人签/过目），人不在场只挂账绝不代签。
```

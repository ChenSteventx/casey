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
人类同事移交入口 = README.md；分家 agent（codex/pi）接入入口 = 仓根 AGENTS.md + docs/runbooks/onboarding.md。

【先读，别现编已决的事】（必读顺序）
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用；
   CLAUDE.md 有「开发工作法」节：长链条走 ultracode/Workflow 编排）
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-09 晚：本 session「全做」八契约一趟并行落地并合并回 dev）
3. loop/GUARDRAILS.md（18 条护栏逐条有效，#18 是并行工作树纪律）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源，0001–0007）、docs/design/（端到端设计，文实不符处见文内「已知偏离」errata 表）。
   环境坑参考本文件文末。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎同仓拷入归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与四态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN；裁判与自愈分进程。
- ADR-0003 编译再回放（LLM 一次编译）+ 非就地有界自愈：LLM 只编译期读一次、之后确定性回放零 LLM；禁纯坐标步；自愈写旁文件补丁人签后才应用；testChecksums 只冻断言不冻 spec。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从带类型词汇表选、易变值模板化、草拟→冻结→人签三段；gate 绿 ≠ 完成。
- ADR-0005 统一语言强制（term-lint + 双 hook + 门禁）：四列制术语表白/黑名单唯一源、术语须加粗或反引号、三执行点、造词先登记、中文一律简体。
- ADR-0006 Casey = autotester 与 regress 分层融合（方向已接受、实施待 P2 重定义）。
- ADR-0007 P5 回放基座（@playwright/test）+ 取证按 CDP 真发起方归因 + 三轴裁定单元 = intent + hermetic 假 SUT。
- 里程碑时间线（近→远）：2026-07-09 晚 「全做」八契约一趟并行落地合并回 dev（run-convention[codex 版] / mcp-parity / ingest-scaffold / casey-demo / casey-doctor / distribution / wf-select-node-dropdown / resolution，b4f5c27→44df070）；
  2026-07-09 早 record-intake + record-distill 收尾示教兜底人录三环 + worktree-baton 解单 baton 天花板；
  2026-07-08 record-capture 首环 + 用户易操作文档 + P7 报告五增量 + wf-open-node 画布第三原子；
  更早 P2–P7 内核 + 接缝冻结 + 真机首航 + 画布 addNode/connectNodes/openNode。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile → 相2 冻结+人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐三组事实——动作（过点击身份门判 true/ambiguous/false）/逐条断言/取证；裁判·桥·报告共吃。
  · 多态裁定四态：PASS / SUT_DEFECT（人签+动作对+响应违期+取证背书，禁自愈）/ HARNESS_ERROR（正向确证定位漂移，可自愈）/ NEEDS_HUMAN（证不出，绝不自愈，带 reason 子类）。
  · 点击身份门：解析唯一或点后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous。
    resolution 多匹配的唯一合法字面量 = ambiguous（CONTEXT 登记词，三门 emitters 收敛同源；2026-07-09 晚 resolution 契约统一，识别端认 ambiguous→AMBIGUOUS_ACTION，幽灵 coord_fallback 从识别端删、run-history 诊断可表征锁保留）。
  · 网络取证：记 {url,status,initiator}+错误信封，按请求发起方归因（非时间窗，防背景轮询 401 翻判）。
  · 只读漂移探针 / 通道剖面 / 错误信封（HTTP200 body 表失败的软失败）/ 静默点 / 观测现状 / 冻结断言契约 / 人签门 / TestCase 聚合根。
  · 示教（teach-in）：手动录制退化机制，录制物是语料不是签署；示教录制包 / 入账 / 蒸馏 / 蒸馏候选 / 采集忠实闸。
  · 归一脚手架 / 候选骨架 / 归一提示模板（ingest-scaffold 登记）：相0 前段自由文本零 LLM 包成候选骨架 + 归一模板，供 CLI 外 LLM 归一后重新入场。
  · 画布四原子：workflow.addNode / connectNodes / openNode / selectNodeDropdown（COMPILE_KNOWN_ATOMS=17）。
- 五层 LLM 准入边界（智能与频率成反比 ADR-0003）：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门）；LLM 手术刀仅 L1 归一·L2 断言草拟·L3 编译与自愈执行；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者、绝不反向进裁判进程（verdict-purity-guard 机制强制）。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。accept 任何车道都不跳。
- 多契约并行落地：走 git worktree（护栏 #18）——contract worktree <slug> 每树一独立 baton，contract list 跨树总览，各树自绿后 git-native 合并回 dev（绝不 cp 进 lib/bin）。依赖契约栈在栈父分支上起（栈式）。
- 长链条走 ultracode/Workflow 编排（CLAUDE.md 开发工作法，Steven 2026-07-09 定）：多契约并行落地 + 逐个异构评审 + 分波合并这类走 Workflow（pipeline 各契约 + 并行评审 + 对抗核验 + 循环到干），别手派一堆 Agent 自己盯。
- 协调合并手法：跨契约共改冻结金牌（如 cli-mcp-face EXCLUDED）走顺序合并 + 3-way 解冲突 + 合并后重签 + 全量复验，绝不各合各的撞多次；合并后必跑 gate + tier1 全量复验（无文本冲突≠语义没坏）。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读。
- 双 hook 术语拦截：回合输出与写入 md/json 都被 term-lint 扫，违例/繁体/未登记加粗英文拦红（加粗只给中文）。
- 异构冗余评审（Dissimilar Redundancy）：评审家族≠实现家族（Claude 实现→codex 评；codex 实现→Claude 评）；只喂 spec+diff+门禁证据；触裁判内核的契约除 codex 评审外自己再亲核。
- 护栏 18 条要点：#1 冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知 / #18 并行工作树纪律。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE/AMBIGUOUS_ACTION)，绝不静默 PASS。
- 点击身份门：action 轴缺失/畸形→false；多匹配→ambiguous→NEEDS_HUMAN(AMBIGUOUS_ACTION)，绝不点首项猜。
- 取证按发起方归因（非时间窗）：仅 attributedStepId===本步才背书；背景轮询 401 不翻本步 verdict。
- 自愈门须确证 HARNESS_ERROR 才开闸；入参畸形 fail-closed（verdict exit 65）；回放看门狗 75s 强退；熔断器越阈写 Inbox+exit 2；gate 默认 FAIL 凭三检查翻绿；凭据兜底门落盘前深扫、命中拒写。
- 易用性面 fail-closed：scaffold-case/mcp-config/doctor 等新 CLI 入参畸形落明确退出码（64/65）、零凭据零目标地址回显；serverAbs 挂载配置对含空格/引号/反斜杠路径做 TOML/shell 转义。

【排期】
- P0–P9：P0–P6 机制面全建（hermetic 完成、真机 route:human 未正式核销）；P7 报告块 0→5；P8 多 channel 基本未开始；P9 tier-1 done、tier-2 真机 UAT 未走。heal 是 CLI 唯一诚实桩。
- 排期 v3 三层：第0层引擎+裁判内核 + 第1层接缝冻结（已完成）→ 第2层并行 hermetic 建造（已并 dev，本 session 把易用性+分发六契约 + 画布第四原子 + 裁判词表统一全落）→ 第3层集成（真数据端到端，未开始 = 下面下一步 A）。
- 战略六点（strategy-2026-07-08）进度：openNode 收口✓ / 人录兜底✓ / cli-mcp-skill 易用+分发✓（本 session）/ 强化 DDD✓ / 多 subagent✓；剩 regress 参数化+内置提示词。
- 并行硬规则：碰 lib/bin 走 worktree 隔离 + git-native 合并；不碰 baton 的活（研究/grill/schema/golden 起草/异构评审）无限 fan-out 子代理。

【当前契约 / 状态】
- dev = 44df070：全 8 契约 + codex 的 run-convention 齐落、逐一 gate 复验绿（cli-mcp-face 2/2 含 e2e-chain + tier1 裁判零 LLM + 全部判内核/画布金牌 exit 0）。终版 cli-mcp-face EXCLUDED 九项。
- 活契约槽（主树）= run-convention（六阶段全 done、baton 空闲，下一契约直接 contract init）。本仓无 git 远端。
- 未提交现场（git status --short）：M .gitignore（Steven 的，别动别提交）+ ?? docs/plans/usability-audit/（母审计草稿、非契约）。
- 八个已合并契约分支保留为存档（run-convention-claude 是 Claude 版 run-convention 的存档、未落 dev；其余已并入 dev）；要清跑 git branch -d。
- 最新工程纪律（2026-07-09 晚锁）：① 长链条走 ultracode/Workflow 编排（CLAUDE.md 开发工作法）；② 协调合并手法（跨契约共改冻结金牌顺序合并 + 3-way + 重签 + 全量复验）；③ worktree 栈式（依赖契约栈在栈父分支）；④ 与并行 codex 会话协作时先摸清主树占用、别 reset 它的在制品、择优取版并存档另一份。此前已锁：模型分层（主环 Opus + subagent 分工）；异构评审归属可反转 + 触裁判内核自己亲核；缺字段零行为差是加法护身符。

【下一步（任选其一，先对齐再动手）】
A. 真机 UAT / 第3层集成（route:human，最高优先真机项，需 Steven 在场 + 拉隧道 + 先带外确认 .auth 为 autotest）：易用性+分发面现全 hermetic 建好，真机趟是自然下一步。含 ① tc_catalog_wf_crud / tc_wf_publish_states 从历史绿转非绿追因（SUT 变了还是环境漂移，见 docs/runbooks/real-zero-error-examples.md）；② 示教兜底人录三环真机验证一轮（录制→intake→distill→候选真过 ingest→compile→draft→人签）；③ ingest-scaffold 全新用例端到端真通（自由文本→scaffold-case→归一→ingest→…→报告，相1 compile 必打真机）；④ 各家 agent 真机 MCP 挂载核验（用 casey mcp-config 产的配置真挂真调）。真机唯一许用账户 = autotest。
B. 画布维度续建（addNode/connectNodes/openNode/selectNodeDropdown 四原子已建，hermetic）：下一 setNodeField（按贪心序解锁）；建原子须例翻当时仍无知识的反例 + 重签 prd。
C. regress 战略项（strategy 剩项）：参数化 + 内置提示词。
D. 收尾挂账清理（下次批量重签窗口顺带，低风险）：resolution 的 prd desc 散文残留「fallback_first」旧词 + fake-sut server.mjs:157 注释失准 + wf-select-node-dropdown 两条 med backlog（非法 nth 静默降级为 0 / 域锁 .hr-select 未限可见，回放侧 replay-actions.mjs:161 同型 nth 降级）；+ 清理八个已合并分支。
（选任一先 contract init 或 contract worktree 声明入口分流；决策分岔用可点选项呈现、别散文长问。）

【环境坑（WSL）】
- 行尾/checksum 整库 LF 一致；查行尾别用 grep -c $'\r'（git-bash 下退化误报），用 node 数 0x0d。
- loop-guard 粗粒度误判：读类命令带重定向（如 2>&1、>）且含 loop-kit/bin 或 bin/ 或 loop/prd- 路径 token 会被判 edit-impl/write-prd 拦——直接跑别加重定向。
- 路径：D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版。别在 /mnt/d 混用 Windows git 与 WSL git（filemode/CRLF 假报）。
- worktree 并行：全新 worktree 无 node_modules（gitignored 不随 HEAD 进树）——需 playwright 的金牌在树内会红，软链主树 node_modules 进去（ln -sfn）。契约草稿 docs/plans/<slug>/ 未入 git、不随 HEAD 进树，实现 subagent 需自己 cp 进本树；合并回 dev 前主树同名未跟踪草稿要先清（备份后 rm）否则 git merge 拒。
- codex 异构评审：codex exec --skip-git-repo-check -C $(mktemp -d) - < 评审料.md（空 cwd 喂 stdin）。压小料 + 后台跑更稳。pi 从本 WSL 驱不动，别试。
- 真机唯一许用账户 = autotest（Steven 禁令）：任何真机动作前须 Steven 带外确认 .auth/credentials.json 已是 autotest；未确认只做 hermetic。反向隧道是两半（WSL 监听器 + Windows 代理）、易累积多实例，动真机前先核清进程数。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读（改须重签 checksum）；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体（加粗只给中文）；新概念先查既有学科术语、造词先登记 CONTEXT.md。
可并行的活优先 fan-out 子代理；长链条走 Workflow 编排；碰 lib/bin 的真并行走 worktree；决策分岔用可点选项呈现、别散文长问。
```

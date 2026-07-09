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
人类同事移交入口 = README.md（handover-pack 契约建成，八节自包含）。

【先读，别现编已决的事】（必读顺序）
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用；
   CONTEXT 第 47-49 行 2026-07-09 新登记 worktree 并行三术语）
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-09：本 session 三提交——
   record-intake + record-distill 收尾示教兜底人录三环 + worktree-baton 解单 baton 天花板）
3. loop/GUARDRAILS.md（18 条护栏逐条有效，#18 是 2026-07-09 新增并行工作树纪律）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源，0001–0007）、docs/design/（端到端设计，文实不符处见文内
   「已知偏离」errata 表）；docs/decisions/ 不存在，loop 纪律钩子引的坏引用真身是 docs/adr/0001-reuse-loop-kit.md。
   环境坑参考本文件文末。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎同仓拷入归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与四态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN；裁判与自愈分进程。
- ADR-0003 编译再回放（LLM 一次编译）+ 非就地有界自愈：LLM 只编译期读一次、之后确定性回放零 LLM；禁纯坐标步；自愈写旁文件补丁人签后才应用；testChecksums 只冻断言不冻 spec。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从带类型词汇表选、易变值模板化（uniqueName 永不进冻结字面量）、草拟→冻结→人签三段；gate 绿 ≠ 完成。
- ADR-0005 统一语言强制（term-lint + 双 hook + 门禁）：四列制术语表白/黑名单唯一源、术语须加粗或反引号、三执行点、造词先登记、中文一律简体。
- ADR-0006 Casey = autotester 与 regress 分层融合（方向已接受、实施待 P2 重定义）：五层端态、骑原子需先重写三轴非白嫖。
- ADR-0007 P5 回放基座（@playwright/test）+ 取证按 CDP 真发起方归因 + 三轴裁定单元 = intent + hermetic 假 SUT。
- 里程碑时间线（近→远）：2026-07-09 record-intake（46ae7a3）→ record-distill（4bce3a5）→ worktree-baton（ef94da4）；
  2026-07-08 record-capture（bb0ee3c）+ 用户易操作文档 + P7 报告五增量（report-nl-atomic/video-block/cleanup-evidence/workflow-structure）+ wf-open-node 画布第三原子；
  2026-07-07 真机合并行程首航（24865f4）+ 画布两原子 addNode/connectNodes + output-seal 全仓封缝；
  2026-07-06 ingest 相0 归一（b7c8f61）+ e2e-chain hermetic 全链首贯通 + cli-mcp-face 三面对齐 + sign/flow-bridge/video-login-carry 补三相；更早 P2–P5 内核 + 接缝冻结 + 飞轮四条。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile → 相2 冻结+人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐三组事实——动作（过点击身份门判 true/ambiguous/false）/逐条断言/取证；裁判·桥·报告共吃。
  · 多态裁定四态：PASS（动作成+断言全满足，机器终判）/ SUT_DEFECT（人签+动作对+响应违期+取证背书，禁自愈出缺陷单）/ HARNESS_ERROR（正向确证定位漂移，可自愈）/ NEEDS_HUMAN（证不出，绝不自愈，带 reason 子类）。
  · 点击身份门：解析目标唯一或点击后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous。
  · 网络取证：记 {url,status,initiator}+错误信封，按请求发起方归因（非时间窗，防背景轮询 401 翻判）。
  · 只读漂移探针：无 spec 变更无重跑探「同稳定签名唯一元素是否仍在」，供 verdict 判 HARNESS_ERROR，与自愈写回严格分离。
  · 通道剖面（非凭据配置，与 site.json 密文分离）/ 错误信封（HTTP200 body 表失败的软失败）/ 静默点（编译期确定性等待）/ 观测现状（编译期落盘地面真值）/ 冻结断言契约（只冻断言不冻 spec）/ 人签门（gate 绿≠完成）/ TestCase 聚合根。
  · 示教（teach-in）：手动录制退化机制，录制物是语料不是签署；示教录制包 / 示教入账 / 示教蒸馏 / 蒸馏候选 / 采集忠实闸。
  · loop-kit 2026-07-09 新三条：并行工作树 baton（每 worktree 各一独立 baton）/ contract list 跨树 baton 总览 / contract worktree 起树脚手架。
- 五层 LLM 准入边界（智能与频率成反比 ADR-0003）：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门）；LLM 手术刀仅 L1 归一·L2 断言草拟·L3 编译与自愈执行；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者、绝不反向进裁判进程（否则 LLM 把真 bug 重锚成绿=最危险假绿）。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。
- 入口分流三档：direct=只剩地板全放行；light=加 plan 门；full=全六阶段链（grill→plan→accept→loop→review→learn）。accept 任何车道都不跳。
- 多契约并行落地：走 git worktree（护栏 #18）——contract worktree <slug> --lane full --reason "…" 每树一独立 baton，contract list 跨树总览，各树自绿后 git-native 合并回 dev（绝不 cp 进 lib/bin）；不建共享池、不加 LOOP_CONTRACT_FILE 选槽/breaker --state（背红队 1 High+4 Med）。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读。
- 双 hook 术语拦截：回合输出与写入 md/json 都被 term-lint 扫，违例/繁体/未登记加粗英文拦红（加粗只给中文）。
- 异构冗余评审（Dissimilar Redundancy）：评审家族≠实现家族（Claude 实现→codex 评；实现方是 codex 则反转由 Claude 评）；只喂 spec+diff+门禁证据；codex 全断时走同族末位兜底但 audit 必明标非跨族 + 挂账正式复审。
- 护栏 18 条要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知 / #18 并行工作树纪律。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 点击身份门：action 轴缺失/畸形→false；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
- 取证按发起方归因（非时间窗）：仅 attributedStepId===本步才背书；背景轮询 401 不翻本步 verdict。
- 自愈门：须确证 HARNESS_ERROR 才开闸；缺证据落 INDETERMINATE。入参畸形 fail-closed（verdict exit 65）；回放看门狗 75s 强退；熔断器越阈写 Inbox+exit 2；gate 默认 FAIL 凭三检查翻绿；凭据兜底门落盘前深扫、命中拒写。
- 示教兜底人录三环安全纪律：intake 入账闸凭据门 raw+canon+decoded 三扫 + symlink 四段守卫 + captureSha256 TOCTOU 绑定；distill 零 LLM 全 pending 投影降权（候选绝不 signed/replayReady/直通回放）+ verifyIntaken TOCTOU 硬门 + 采集忠实闸。

【排期】
- P0–P9：P0–P6 机制面全建（P5/P6 hermetic 完成、真机 route:human 未正式核销，相5 自愈真机首触未走）；P7 报告大体成型（report-model 报告块 0→5，report-spec §3 六项落五，余 #12 属编译/草拟期）；P8 多 channel（cef CDP+arbitrary）基本未开始；P9 tier-1 done、tier-2 真机 UAT 未走。heal 是 CLI 唯一诚实桩。
- 排期 v3 三层：第0层引擎+裁判内核 + 第1层接缝冻结（已完成）→ 第2层并行 hermetic 建造（已并 dev）→ 第3层集成（真数据端到端，未开始）。§三「解锁真多轨落地前提」已由 worktree-baton 解决（每 worktree 一独立 baton、零机制改动），§二单 baton 天花板破。
- 并行硬规则：碰 lib/bin 走 worktree 隔离 + git-native 合并；不碰 baton 的活（研究/grill/schema/golden 起草/异构评审）无限 fan-out 子代理。

【当前契约 / 状态】
- 活契约 loop/active-contract.json = worktree-baton（full，六阶段全 done，2026-07-09）——baton 空闲，下一契约直接 contract init；多契约并行改起 worktree。gate 全绿、tier1 绿。本仓无 git 远端（git remote 空，待定 GitHub 目标仓）。
- 未提交现场（git status --short）：M .gitignore（Steven 的，别动别提交）+ 七个未跟踪 docs/plans/ 草稿目录（run-convention / mcp-parity / casey-demo / casey-doctor / distribution / ingest-scaffold / usability-audit——排队候选契约，plan+GRILL+golden 已起草、契约未落地、未入 git）。
- 最新工程纪律（2026-07-09 已锁）：① 并行开发经 worktree、不建共享池（护栏 #18）；② codex 逐轮深挖路径安全边角（worktree-baton F1 五轮收口：真实路径投影 realpath + 正确 containment 谓词 + guard==git canonical 单点；安全边角实测证伪才放行）。此前已锁：模型分层（主环 Opus 4.8 ultracode + Sonnet 5 max subagent 轻车道；I1 verdict 零 LLM + I2 异构评审不塌同族 已机制强制、三级兜底 watcher 仍待建）；异构评审归属可反转；缺字段零行为差是加法护身符；金牌栽在「含子串≠形态正确」。

【下一步（任选其一，先对齐再动手）】
A. 用户易操作 / 分发线（战略「cli-mcp-skill 易用+分发」，可开多棵 worktree 并行）：七个草稿契约 casey-demo / casey-doctor / distribution / ingest-scaffold / usability-audit / mcp-parity / run-convention 已备 plan+GRILL+golden，各起一棵 worktree 走 full/light 落地。目标：说清输入/结果位置 + 如何入 git + 如何接入各家 coding agent（claude code/codex/pi）。
B. resolution 词表 full 契约（触裁判内核，挂账未做）：CONTEXT 登记 resolution 枚举 + verdict.mjs/report-model.mjs 认已登记 ambiguous（多匹配→AMBIGUOUS_ACTION）+ 删幽灵 coord_fallback + 统一多匹配字面量口径。
C. 真机退化追因（route:human，最高优先真机项，需拉隧道 + Steven 在场 + 先带外确认 .auth 为 autotest）：tc_catalog_wf_crud（现 PASS=2/NEEDS_HUMAN=2）、tc_wf_publish_states（现 PASS=2/SUT_DEFECT=1/NEEDS_HUMAN=1）从历史绿转非绿，SUT 变了还是环境漂移待查（见 docs/runbooks/real-zero-error-examples.md）。顺带示教兜底真机验证一轮（真机人工录制→intake→distill→候选真过 ingest→compile→draft→人签）。
D. 画布维度续建（addNode/connectNodes/openNode 三原子已建）：下一 selectNodeDropdown（按贪心序解锁 9/23）→ setNodeField；建原子须例翻当时仍无知识的反例 + 重签 prd。
（选任一先 contract init 或 contract worktree 声明入口分流；决策分岔用可点选项呈现、别散文长问。）

【环境坑（WSL）】
- 行尾/checksum 已核实整库 LF 一致；查行尾别用 grep -c $'\r'（git-bash 下退化误报），用 node 数 0x0d。
- loop-guard 粗粒度误判：读类命令带重定向（如 2>&1、>）且含 loop-kit/bin 或 bin/ 或 loop/prd- 路径 token 会被判 edit-impl/write-prd 拦——直接跑别加重定向、别把这些 token 与写动词（mkdir/cp/rm）放同一命令。
- 路径：D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版（非借 Windows chromium）。别在 /mnt/d 混用 Windows git 与 WSL git（filemode/CRLF 假报）；Windows git 需 git config windows.appendAtomically false（已设）。
- codex 异构评审：codex exec --skip-git-repo-check -C $(mktemp -d) - < 评审料.md（空 cwd 喂 stdin）。前台大料易撞后端 outage 超时；压小料 + 后台跑（Bash run_in_background）更稳。pi 从本 WSL 驱不动，别试。
- 真机唯一许用账户 = autotest（Steven 禁令）：任何真机动作前须 Steven 带外确认 .auth/credentials.json 已是 autotest；未确认只做 hermetic。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读（改须重签 checksum）；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体（加粗只给中文）；新概念先查既有学科术语、造词先登记 CONTEXT.md。
可并行的活优先 fan-out 子代理；碰 lib/bin 的真并行走 worktree（护栏 #18）；决策分岔用可点选项呈现、别散文长问。
```

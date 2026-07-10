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
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-10：本 session 三契约 + 漂移收口合并回 dev）
3. loop/GUARDRAILS.md（18 条护栏逐条有效，#18 是并行工作树纪律）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源，0001–0007）、docs/design/（端到端设计，errata 表记文实不符）。
   环境坑参考本文件文末。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎同仓拷入归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与四态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN；裁判与自愈分进程。
- ADR-0003 编译再回放（LLM 一次编译）+ 非就地有界自愈：LLM 只编译期读一次、之后确定性回放零 LLM；禁纯坐标步；自愈写旁文件补丁人签后才应用；testChecksums 只冻断言不冻 spec。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从带类型词汇表选、易变值模板化、草拟→冻结→人签三段；gate 绿 ≠ 完成。
- ADR-0005 统一语言强制（term-lint + 双 hook + 门禁）：四列制术语表白/黑名单唯一源、术语须加粗或反引号、三执行点、造词先登记、中文一律简体。
- ADR-0006 Casey = autotester 与 regress 分层融合（方向已接受、实施待 P2 重定义）。
- ADR-0007 P5 回放基座（@playwright/test）+ 取证按 CDP 真发起方归因 + 三轴裁定单元 = intent + hermetic 假 SUT。
- 里程碑时间线（近→远）：2026-07-10 三契约（B 画布第五原子 setNodeField / D replay-nth 收尾硬化 / C regress scope A）+ 漂移收口（p2-verdict 陈旧夹具 + prd-mcp-parity 漏签）合并回 dev（68f1fe0→ff73011），异构冗余评审真挣钱（codex-sol 揪 B 的 HIGH）、全仓 ratchet 总核逮 3 处共享冻结文件漏签；
  2026-07-09 晚 「全做」八契约一趟并行落地合并回 dev（b4f5c27→44df070）；
  2026-07-09 早 record-intake + record-distill 收尾示教兜底人录三环 + worktree-baton 解单 baton 天花板；
  2026-07-08 record-capture 首环 + 用户易操作文档 + P7 报告五增量 + wf-open-node 画布第三原子；
  更早 P2–P7 内核 + 接缝冻结 + 真机首航 + 画布 addNode/connectNodes/openNode/selectNodeDropdown。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile → 相2 冻结+人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐三组事实——动作（过点击身份门判 true/ambiguous/false）/逐条断言/取证；裁判·桥·报告共吃。
  · 多态裁定四态：PASS / SUT_DEFECT（人签+动作对+响应违期+取证背书，禁自愈）/ HARNESS_ERROR（正向确证定位漂移，可自愈）/ NEEDS_HUMAN（证不出，绝不自愈，带 reason 子类）。
  · 点击身份门：解析唯一或点后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous。
    resolution 多匹配的唯一合法字面量 = ambiguous（CONTEXT 登记词，三门 emitters 收敛同源）；旧字面量 multi/fallback_first/coord_fallback 已从裁定链删，但 fallback_first/coord_fallback 在 run-history 诊断枚举仍是合法可表征锁值（seams-freeze-v2，只读台账不进裁判）。
  · 网络取证：记 {url,status,initiator}+错误信封，按请求发起方归因（非时间窗，防背景轮询 401 翻判）。
  · 只读漂移探针 / 通道剖面 / 错误信封（HTTP200 body 表失败的软失败）/ 静默点 / 观测现状 / 冻结断言契约 / 人签门 / TestCase 聚合根。
  · 示教（teach-in）：手动录制退化机制，录制物是语料不是签署；示教录制包 / 入账 / 蒸馏 / 蒸馏候选 / 采集忠实闸。
  · 归一脚手架 / 候选骨架 / 归一提示模板（ingest-scaffold）：相0 前段自由文本零 LLM 包成候选骨架 + 归一模板，供 CLI 外 LLM 归一后重新入场。
  · 数据驱动被测参数（regress-promptset）：promptset overlay 把 N 行被测参数（prompt 文本）灌进一条冻结 chat flow 的参数槽展开成 N 个 caseId；内置注入向量库 prompts/_lib（boundary/security）；软期望走报告 soft 黄标绝不进裁定；多用例聚合报告。
  · 画布五原子：workflow.addNode / connectNodes / openNode / selectNodeDropdown / setNodeField（COMPILE_KNOWN_ATOMS=18）。
- 五层 LLM 准入边界（智能与频率成反比 ADR-0003）：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门）；LLM 手术刀仅 L1 归一·L2 断言草拟·L3 编译与自愈执行；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者、绝不反向进裁判进程（verdict-purity-guard 机制强制）。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。accept 任何车道都不跳；grill 半硬需 --user-confirmed、accept 需 --red-verified。
- 多契约并行落地：走 git worktree（护栏 #18）——contract worktree <slug> 每树一独立 baton，contract list 跨树总览，各树自绿后 git-native 合并回 dev（绝不 cp 进 lib/bin）。
- 长链条走 ultracode/Workflow 编排（CLAUDE.md 开发工作法，Steven 2026-07-09 定）：多契约并行落地 + 逐个异构评审 + 分波合并这类走 Workflow（pipeline 各契约 + 并行评审 + 对抗核验 + 循环到干），别手派一堆 Agent 自己盯。
- 协调合并手法：跨契约共改冻结金牌走顺序合并 + 3-way 解冲突 + 合并后重签 + 全量复验，绝不各合各的。合并后必跑 gate + tier1 + 全仓 ratchet 总核（遍历每 prd testChecksums 对实际文件 sha256，逮跨契约漏签——本 session 逮出 3 处共享冻结文件只签一处的复发债，单靠各 prd 的 gate 逮不到）。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；改冻结须重签 checksum。
- 双 hook 术语拦截：回合输出与写入 md/json 都被 term-lint 扫，违例/繁体/未登记加粗英文拦红（加粗只给中文）。
- 异构冗余评审（Dissimilar Redundancy）：评审家族≠实现家族（Claude 实现→codex 评；codex 实现→Claude 评）；只喂 spec+diff+门禁证据；触裁判内核的契约除 codex 评审外自己再亲核 + 人签。codex CLI 现 0.144.1，可用模型 gpt-5.6-sol/terra/luna @ xhigh/max（升级走 GitHub release 手动装，chatgpt.com 在 WSL 抖动，见记忆 codex-upgrade-via-github-in-wsl）。
- 护栏 18 条要点：#1 冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知 / #18 并行工作树纪律。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE/AMBIGUOUS_ACTION)，绝不静默 PASS。
- 点击身份门：action 轴缺失/畸形→false；多匹配→ambiguous→NEEDS_HUMAN(AMBIGUOUS_ACTION)，绝不点/填首项猜；显式非法 nth→硬阻断 fail-closed（编译 blocker / 回放 action_failed），绝不降级 index 0。
- 取证按发起方归因（非时间窗）：仅 attributedStepId===本步才背书；背景轮询 401 不翻本步 verdict。
- 自愈门须确证 HARNESS_ERROR 才开闸；入参畸形 fail-closed（verdict exit 65）；回放看门狗 75s 强退；熔断器越阈写 Inbox+exit 2；gate 默认 FAIL 凭三检查翻绿；凭据兜底门落盘前深扫、命中拒写。
- 易用性面 fail-closed：scaffold-case/mcp-config/doctor 等 CLI 入参畸形落明确退出码（64/65）、零凭据零目标地址回显。

【排期】
- P0–P9：P0–P6 机制面全建（hermetic 完成、真机 route:human 未正式核销）；P7 报告块 0→5；P8 多 channel 基本未开始；P9 tier-1 done、tier-2 真机 UAT 未走。heal 是 CLI 唯一诚实桩。
- 排期 v3 三层：第0层引擎+裁判内核 + 第1层接缝冻结（已完成）→ 第2层并行 hermetic 建造（已并 dev：八契约 + 本 session 画布第五原子 + regress scope A + 漂移收口）→ 第3层集成（真数据端到端，未开始 = 下面下一步 A）。
- 战略六点（strategy-2026-07-08）进度：openNode 收口✓ / 人录兜底✓ / cli-mcp-skill 易用+分发✓ / 强化 DDD✓ / 多 subagent✓ / regress 参数化✓（本 session scope A，剩 gen-prompts LLM 合成 scope C 刻意延后）。
- 并行硬规则：碰 lib/bin 走 worktree 隔离 + git-native 合并；不碰 baton 的活（研究/grill/schema/golden 起草/异构评审）无限 fan-out 子代理。

【当前契约 / 状态】
- dev = ff73011：本 session 三契约 + 漂移收口齐落、全量复验绿（115 条 ratchet 全 MATCH、selftest --tier1 裁判零 LLM GREEN）。提交链 68f1fe0→ff73011。
- 活契约槽（主树）= resign-drift-closure（六阶段全 done、baton 空闲，下一契约直接 contract init）。本仓无 git 远端。
- 未提交现场（git status --short）：M .gitignore（Steven 的，别动别提交）+ M loop/prd-selftest.json（无关 gate 时间戳，别并入契约提交）+ ?? docs/codex/（并行 codex 会话的 handoff 功能产物，别碰）+ ?? docs/plans/regress-strategy/ 与 docs/plans/usability-audit/（草稿、非契约）。
- 本 session 落地清单：① B 画布第五原子 setNodeField（补齐半成品 + codex-sol 揪 HIGH 非法 nth fail-open 修毕 + 3 MED 硬化，COMPILE_KNOWN_ATOMS 17→18，merge 6f021a4）；② D replay-nth-visible-hardening 三修 + 编译门 waitFor 时序修（Claude 3 视角评审 CLEAN，merge cb084aa）；③ 漂移收口 p2-verdict 陈旧夹具对齐收敛词 + prd-mcp-parity 漏签补签（gpt-5.6-terra 异构评审 + 人签，791cef1）；④ C regress-promptset scope A 数据驱动被测参数 overlay + 内置库 + 聚合报告（merge 0333f83）；⑤ 两处合并后重签 + 一处 C 合并收尾（prd-seams-freeze）+ B MED#2 域锁挂账。
- 最新工程纪律（2026-07-10 加）：① 合并收尾必跑全仓 ratchet 总核（逮跨契约共享冻结文件漏签复发债——本 session 逮 3 处：D-prd server.mjs / prd-mcp-parity / prd-seams-freeze）；② codex 升级走 GitHub release 手动装（WSL chatgpt.com 抖动）、评审可用 gpt-5.6-sol/terra/luna @ xhigh/max；③ 并发 codex 会话共用主树时两边提交都只显式路径绝不 -A。此前已锁：长链条走 Workflow 编排；协调合并手法；worktree 栈式；模型分层主环 Opus + subagent 分工；触裁判内核自己亲核 + 人签。

【下一步（任选其一，先对齐再动手）】
A. 真机 UAT / 第3层集成（route:human，最高优先真机项，需 Steven 在场 + 拉隧道 + 先带外确认 .auth 为 autotest）：runbook docs/runbooks/real-uat-runbook.md 四子项就绪（历史绿转非绿追因 / 示教兜底人录三环 / ingest-scaffold 全新用例端到端 / 各家 agent MCP 挂载核验）。真机唯一许用账户 = autotest。
B. 画布原子域锁硬化契约（codex-sol MED#2 挂账，prd-wf-set-node-field observability 已记）：openNode/selectNodeDropdown/setNodeField 三原子域锁都用宽 .hr-drawer__content-wrapper（匹配所有抽屉），另一可见抽屉有同 placeholder/触发器时跨抽屉误命中隐患。三原子一起收窄到节点抽屉专属锚（如 .lf-node-drawer 域），fake-sut 加两可见抽屉反面场景红先行。
C. regress gen-prompts（scope C，LLM 合成 authoring）：按 agent 名/内嵌系统提示词合成 N 条被测参数幂等冻结进 promptset.json，绝不进回放/裁定进程，凭据经现成 cred-gate（scope A 已落，本项刻意延后、性价比看真机 promptset 用例需求）。
D. 画布维度续建下一原子（贪心序）或收尾挂账清理（归档分支 archive/codex-wip-* tags + 已合并 wf-set-node-field/replay-nth/regress-promptset 分支；低风险）。
（选任一先 contract init 或 contract worktree 声明入口分流；决策分岔用可点选项呈现、别散文长问。）

【环境坑（WSL）】
- 行尾/checksum 整库 LF 一致；查行尾别用 grep -c $'\r'（git-bash 下退化误报），用 node 数 0x0d。
- loop-guard 粗粒度误判：读类/contract 命令带重定向（如 2>&1、>）且含 loop-kit/bin 或 bin/ 或 loop/prd- 路径 token 会被判 edit-impl/write-prd 拦——直接跑别加重定向。
- 路径：D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版。别在 /mnt/d 混用 Windows git 与 WSL git（filemode/CRLF 假报）。
- worktree 并行：全新 worktree 无 node_modules（gitignored 不随 HEAD 进树）——需 playwright 的金牌在树内会红，软链主树 node_modules 进去（ln -sfn）。契约草稿 docs/plans/<slug>/ 未入 git、不随 HEAD 进树，实现 subagent 需自己 cp 进本树。
- gate 慢（每 golden 真起 chromium + 假 SUT ~30-60s，一契约十来个 golden 十几分钟）——后台跑、别前台等超时；单条命令别拼重定向免 loop-guard 误判。
- scratchpad（/tmp）重启即清：崩溃丢的活去 ~/.claude/projects/*.jsonl 或后台任务输出捞；重要归档打 git tag（持久）别只放 scratchpad。
- codex 异构评审：codex exec --skip-git-repo-check -C <dir> -s read-only -m gpt-5.6-terra -c model_reasoning_effort=max - < 评审料.md；chatgpt.com 网络会中途提断（model-refresh/transport timeout），料压小 + 后台跑更稳。pi 从本 WSL 驱不动，别试。
- 真机唯一许用账户 = autotest（Steven 禁令）：任何真机动作前须 Steven 带外确认 .auth/credentials.json 已是 autotest；未确认只做 hermetic。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读（改须重签 checksum）；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体（加粗只给中文）；新概念先查既有学科术语、造词先登记 CONTEXT.md。
可并行的活优先 fan-out 子代理；长链条走 Workflow 编排；碰 lib/bin 的真并行走 worktree；合并收尾跑全仓 ratchet 总核；决策分岔用可点选项呈现、别散文长问。
```

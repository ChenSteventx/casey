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
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-19 晚：基础债转两阶段方向）
3. loop/GUARDRAILS.md（19 条护栏逐条有效；#19=强制层/迁移落地必复跑受影响金牌、别信 tier1 分层绿）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源）、docs/design/（端到端设计）。

【当前状态（2026-07-19 晚）——基础债转两阶段方向，权威后续见 DIRECTION-AFTER-CODEX.md】
本会话把「semantic-lock 准入门基础债」从 5 金牌口径推进到坐实真实规模并转向：
- 规模真相：enforcement 9ee2731→dfee72c（2026-07-17）落地未迁移测试套件，把整个 hermetic
  浏览器回放金牌套件（约 24 金牌 / 40 prd）打成陈旧绿，非最初发现的 5 个。债务全貌钉死在
  docs/plans/replay-admission-hermetic-migration/DEBT-REGISTER.md。
- codex gpt-5.6-sol high 异构讨论真挣钱（review/codex-sol-strategy-20260719.md，入 audit）：
  逮到 Claude 家族自审看漏的四承重问题——① 路 a「生产门零削弱」不成立（测试锁绑 events 不绑
  --sut、生产 reader 不分测试/生产 signer=利用既有 trust-root 缺口）；② SKILL.md:107 真机规则
  冲突；③ p5 墓碑不该借删两案翻绿；④ mint 工具语义授权不可信（占位身份、同源盲区、可能假绿）。
- Steven 2026-07-19 两裁决：Q1=SKILL.md:107 fake-SUT 只读规则也约束 dev gate/golden（hermetic
  金牌不该被 agent 跑、须按生命周期重裁，非重跑锁绿）；Q2=先修生产/测试信任根分离再迁移。
  → 原执行路径（重跑 fake-sut + 注入测试锁锁绿）作废。
- 本契约 replay-admission-hermetic-migration 转调查/决策契约（状态全在其 docs、不走 loop 正常流；
  活契约槽已归还 alh-open-entry 外部仓、阶段一另立新 slug）：波0 五核心 prd honest 翻红保留权威
  （按 Q1 不得再跑 gate 启动 fake-sut、
  passes:false 不可撤了重生）；波1 settle 锁绿已 git revert（含 mint 工具）；复签 sweep 工具
  tests/_golden/support/resign-changed-goldens.mjs 保留（生命周期工作仍用）。dev HEAD 5df2c17。
- mountdelay-fidelity 仍挂起（worktree 存、grill+plan done）；基础债转大工程、mountdelay 继续排后。
- 主树未提交现场：.gitignore + 一批 prd（M，gate evidence 时间戳漂移，无害别当实质改动）+
  用户未跟踪件（docs/codex/、follow.mjs、docs/atom-readiness-*、docs/plans/regress-strategy|
  usability-audit）——全是用户的/无关漂移，别碰别提交。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile → 相2 冻结+人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- 核心词汇：三轴 StepAxes；多态裁定四态 PASS/SUT_DEFECT（人签+动作对+响应违期+取证背书，禁自愈）/
  HARNESS_ERROR（正向确证漂移，可自愈）/ NEEDS_HUMAN（证不出，带 reason 子类）；点击身份门（唯一或
  点后回读成立才 actionPerformed，多匹配/坐标→ambiguous→NEEDS_HUMAN）；取证按请求发起方归因；
  语义锁=类型+名称+编号联合，同名/缺号/冲突/漂移 fail-closed。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是下游消费者、绝不反向进裁判进程。

【开发准则（机制强制）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），
  hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。accept 任何车道都不跳。
- 碰 lib/bin 真并行走 worktree（护栏 #18），各树自绿后 git-native 合并回 dev（绝不 cp 进 lib/bin），
  合并后必主树复验受影响面（护栏 #19：hermetic 契约树绿≠主树绿）+ 全仓 ratchet 总核。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；改冻结须重签+人签。
- 异构评审铁律：评审家族≠实现家族（Claude 实现→codex/pi 评）；只喂 spec+diff+门禁证据。
  本会话 codex 讨论七次+本次策略讨论真挣钱（逮 Claude 同族自审看漏的真缺陷），铁律必要性强实证。
- 双 hook 术语拦截：回合输出与写 md/json 都被 term-lint 扫，违例/繁体/未登记加粗英文拦红（加粗只给中文）。

【兜底 / fail-safe】
- 四态 catch-all：证不出→NEEDS_HUMAN，绝不静默 PASS；fail-safe 不 fail-open（护栏 #14）。
- fake-SUT 只读铁律（SKILL.md:107，Steven 2026-07-15 定、2026-07-19 重申约束 dev gate/golden）：
  假被测系统只允许读源码作迁移参考，任何 agent 不得启动/连接/回放；golden/gate/selftest --tier1
  仅在可证明不启动/不连接/不回放任何假 SUT 时才允许执行；行为验收一律联网驱真机（route:human）。
- 陈旧绿翻真纪律：enforcement/迁移落地必复跑受影响金牌（护栏 #19）；先翻红记账再修，不手改 passes、
  不盲目复签掩盖债（撞 fidelity-audit 翻真纪律）。

【下一步（Steven 2026-07-19 定序：基础债转两阶段大工程；权威=DIRECTION-AFTER-CODEX.md）】
A.（首推，前置）阶段一 生产/测试信任根分离——kernel 车道契约（触强制层，须 grill/plan +
   护栏 #14/#15 审 + Steven 人签）。修 codex 逮的既有缺口：生产 reader 只读不可变发布 manifest、
   不直接信任开发工作树 prd；artifact 带不可伪造 audience（prod/test）分根签、生产 reader 拒测试
   signer；授权绑环境/SUT scope（不只绑 flow/events）；生产读路验 receipt 内容；测试 reader/发行物
   物理分离、不靠自报 --hermetic；反向验收（强制）=测试锁交生产 reader 必被拒。承重 file:line 在
   DIRECTION-AFTER-CODEX.md 阶段一。
B. 阶段二（阶段一解完后）hermetic 金牌套件逐个生命周期重裁：(a) 转 zero-SUT 确定性（喂冻结
   axes/事件夹具给纯裁判、不启动 SUT=主力出路）/ (b) 真机 UAT-only 墓碑 fake-sut 金牌 / (c) 教义
   作废墓碑+命名后继（p5 drift/vanished：原 story superseded-not-pass 不借删两案翻绿 + successor
   PRD 承 8 存活案 + 自愈 liveness 契约另立）。DEBT-REGISTER C 组约 35 非核心 prd 系统清偿。
C. mountdelay-fidelity 续（基础债方向落地后）：worktree casey-mountdelay-fidelity 已存、grill+plan
   done；注意其原设计依赖跑 fake-sut 金牌，须与阶段二 (a) zero-SUT 转化路线对齐后再动。
D. 前瞻红基线 teachin-semantic-lock-runtime-discrimination-successor（0/26）真机轨填绿：route:human。

【环境坑（WSL）】
- 行尾/checksum 整库 LF 一致；查行尾用 node 数 0x0d、别用 grep -c $'\r'（git-bash 退化误报）。
- loop-guard 误判：读类/contract 命令带重定向且含 lib/bin/loop 路径 token 会被判 edit-impl 拦——直接跑别加重定向。
- 路径 D:\→/mnt/d/；/mnt/d 是 9p/DrvFs（rename 目录偶发 sharing-violation EACCES，用有界 retry 吸收）；
  worktree 无 node_modules（软链主树进去）、cases/ gitignored 不随 worktree 带。别混用 Windows/WSL git。
- codex 异构评审/讨论：codex exec --skip-git-repo-check -C <dir> -s read-only -m gpt-5.6-sol
  -c model_reasoning_effort=high - < 料.md；评审包放仓库外（/mnt/d/ctx/heren/review-packets）。
  pi 亦可（deepseek-v4-pro，先冒烟验通）。缺席不阻塞、如实挂账。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读（改须重签+人签）；
凭据不进任何输出/日志/提交/报告；回合输出禁加粗英文与繁体（加粗只给中文）；
新概念先查既有学科术语、造词先登记 CONTEXT.md；fake-SUT 只读、行为验收只驱真机（SKILL.md:107）；
enforcement/迁移落地必复跑受影响金牌（护栏 #19）；可并行的活优先 fan-out 子代理；
碰 lib/bin 走 worktree；合并后主树复验；决策分岔用可点选项呈现、别散文长问。
```

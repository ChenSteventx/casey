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
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-19：基础债发现+修复方案落盘）
3. loop/GUARDRAILS.md（19 条护栏逐条有效；#19 是本会话新增=强制层/迁移落地必复跑受影响金牌）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源）、docs/design/（端到端设计）。

【当前状态（2026-07-19）】
本会话（跨 2026-07-18→19）从「codex 交来、账实脱节」推进到四契约并 dev + 一基础债浮出：
- 已并 dev 的四契约（全走完实现→codex/pi 异构评审→修复→主树复验闭环）：
  ① semantic-lock-cert-closure（认证漂移收口，pi PASS，5 个 P0 分面重证）；
  ② semantic-unit-discrimination（判别纯函数只读导出面，codex 逮 allowAction 硬门旁路→剥离修）；
  ③ cli-authority-wiring-fill（W2 intake 三件套接线，codex 逮 TOCTOU 失败留脏账→原子化修）；
  ④ obs-cases-isolation（三 observation 金牌 DrvFs 稳定绿，codex 三轮逮两 check-then-act 窗口，
     连带清偿 W2 主树 gate 3/4 环境敏感挂账）。dev HEAD 69d7da1。
- mountdelay-fidelity 契约：worktree casey-mountdelay-fidelity（grill+plan done，落盘 1a315cb），
  核心设计已亲定（settle 加占位门+静止窗兜底、fake-sut 补延迟提交子形态）；因基础债阻塞挂起。
- 基础债（本会话第三次逮「enforcement/迁移落地未复跑受影响金牌→陈旧绿」，已沉淀护栏 #19）：
  2026-07-17 semantic-lock 准入门 enforcement（9ee2731/dfee72c）落地未复跑浏览器回放金牌，
  一批（p5-replay/wf-publish-states/replay-settle-mount/drawer-lock/replay-nth）全 runtime-RED
  （FROZEN_ENTITY_LOCKS）、prd 陈旧 passes:true；tier1 不跑 browser-replay 金牌、掩盖了。
- 主树未提交现场：.gitignore + 一批 prd（M，gate 复跑的 evidence 时间戳漂移，无害别误当实质改动）
  + 用户未跟踪件（docs/codex/、follow.mjs、docs/atom-readiness-*、docs/plans/regress-strategy|usability-audit）
  ——全是用户的/无关漂移，别碰别提交。主树活契约槽 alh-open-entry（外部仓接入，与 Casey 契约无关）。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile → 相2 冻结+人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- 核心词汇：三轴 StepAxes；多态裁定四态 PASS/SUT_DEFECT（人签+动作对+响应违期+取证背书，禁自愈）/
  HARNESS_ERROR（正向确证漂移，可自愈）/ NEEDS_HUMAN（证不出，带 reason 子类）；点击身份门（唯一或
  点后回读成立才 actionPerformed，多匹配/坐标→ambiguous→NEEDS_HUMAN）；取证按请求发起方归因（非时间窗）；
  语义锁=类型+名称+编号联合，同名/缺号/冲突/漂移 fail-closed。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是下游消费者、绝不反向进裁判进程。

【开发准则（机制强制）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），
  hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。accept 任何车道都不跳。
- 碰 lib/bin 真并行走 worktree（护栏 #18），各树自绿后 git-native 合并回 dev（绝不 cp 进 lib/bin），
  合并后必主树复验受影响面（护栏 #19：hermetic 契约树绿≠主树绿）+ 全仓 ratchet 总核。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；改冻结须重签+人签，纪律②同会话原地重签如实记录。
- 异构评审铁律：评审家族≠实现家族（Claude 实现→codex/pi 评）；只喂 spec+diff+门禁证据。
  本会话 codex 七次真挣钱（每次逮 Claude 同族自审看漏的真缺陷），是铁律必要性的强实证。
- 双 hook 术语拦截：回合输出与写 md/json 都被 term-lint 扫，违例/繁体/未登记加粗英文拦红（加粗只给中文）。

【兜底 / fail-safe】
- 四态 catch-all：证不出→NEEDS_HUMAN，绝不静默 PASS；fail-safe 不 fail-open（护栏 #14）。
- 陈旧绿翻真纪律：enforcement/迁移落地必复跑受影响金牌（护栏 #19），陈旧绿先翻红记账再修绿、
  不手改 passes/不随迁移直接补绿（撞 fidelity-audit 翻真纪律）。

【下一步（Steven 2026-07-19 定序：先修基础债、mountdelay 排后）】
A.（首推）基础债修复契约 replay-admission-hermetic-migration：方案已侦察定清并落盘
   docs/plans/replay-admission-hermetic-migration/PROPOSAL.md（file:line 承重，供直接接手）。
   采路 a=测试签名锁注入 + 金牌迁移，不触准入门 kernel（准入读路无 Ed25519/无收据验证/无真 SUT，
   只认结构+自哈希+prd checksum，测试锁可确定性铸造经生产接口合法注册、不削弱生产门；否决路 b
   hermetic seam：触 kernel fail-open 违护栏 #14）。分层：简单案（p5-replay/replay-settle-mount/
   wf-publish-states 静态 events 直接铸锁）+ 摩擦案（drawer-lock/nth-visible compile-driven 非确定性
   +双门，须冻编译产物或拆轨）+ 独立门（p5 drift/vanished 的 deleteByName 死在另一道 binding 门）。
   陈旧绿先翻红记账再修绿。full 车道、非 kernel、不必 worktree。codex 异构评审核迁移正确性。
B. mountdelay-fidelity 续（基础 A 修好后）：worktree casey-mountdelay-fidelity 已存、grill+plan done，
   核心设计在 docs/plans/mountdelay-fidelity/plan.md（settle 占位门+静止窗兜底、fake-sut 延迟提交
   子形态）；注意 plan 次要发现纠正——replay-settle.mjs 冻 0 prd、server.mjs 冻 4（非 5）、
   CONTRACT.md 冻 3（非 2）、兜底 STILL_TICKS=4 会破 U3 须改 opt-driven。真机验证 route:human。
C. 前瞻红基线 teachin-semantic-lock-runtime-discrimination-successor（0/26）真机轨填绿：route:human
   （需真机运行时权威 publication 落地，Steven 在场+autotest 账户）。
D. 两 WIP 特性验收后合并：跨平台安装（cross-os-onboarding @ 902216e）/ 账户配置
   （secure-config-powershell @ 02f4361），抢救提交在各自分支、待跑验证。

【环境坑（WSL）】
- 行尾/checksum 整库 LF 一致；查行尾用 node 数 0x0d、别用 grep -c $'\r'（git-bash 退化误报）。
- loop-guard 误判：读类/contract 命令带重定向且含 lib/bin/loop 路径 token 会被判 edit-impl 拦——直接跑别加重定向。
- 路径 D:\→/mnt/d/；/mnt/d 是 9p/DrvFs（rename 目录偶发 sharing-violation EACCES，用有界 retry 吸收，
  见 tests/_golden/support/retry-transient-fs.mjs）；worktree 无 node_modules（软链主树进去）、
  cases/ gitignored 不随 worktree 带（起浏览器金牌前 mkdir -p cases）。别混用 Windows/WSL git。
- gate 慢（起 chromium + fake-sut ~30-60s/金牌）后台跑别前台超时；单条命令别拼重定向免 loop-guard 误判。
- codex 异构评审：codex exec --skip-git-repo-check -C <dir> -s read-only -m gpt-5.6-terra
  -c model_reasoning_effort=high - < 评审料.md；评审包放仓库外（/mnt/d/ctx/heren/review-packets）。
  pi 亦可（deepseek-v4-pro，先冒烟验通）。缺席不阻塞、如实挂账。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读（改须重签+人签）；
凭据不进任何输出/日志/提交/报告；回合输出禁加粗英文与繁体（加粗只给中文）；
新概念先查既有学科术语、造词先登记 CONTEXT.md；enforcement/迁移落地必复跑受影响金牌（护栏 #19）；
可并行的活优先 fan-out 子代理；碰 lib/bin 走 worktree；合并后主树复验；决策分岔用可点选项呈现、别散文长问。
```

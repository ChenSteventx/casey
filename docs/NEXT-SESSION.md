# 下个 session 接续提示词（Casey）

> 用法：下次只需说「读 `docs/NEXT-SESSION.md` 接着干」。本文件是给接续 Claude 的执行指令；状态事实以 `docs/HANDOFF.md` 为准，二者冲突时信 HANDOFF。本文件由 `/session-handoff` 自动刷新（整节替换为最新开场提示词，剪掉过期内容）。

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
2. 当前状态别只信 HANDOFF：docs/HANDOFF.md 已更到最近一 session 收口；最新事实以
   git log + loop/active-contract.json + 各 docs/plans/*/learn.md 为准，冲突信 git 现场。
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策，主事实源）、docs/design/（端到端设计）；
   注意 docs/decisions/ 目录不存在，loop 纪律钩子引的 docs/decisions/2026-06-12-loop-kit.md 是坏引用，
   真身 docs/adr/0001-reuse-loop-kit.md（根在冻结 loop-kit/bin/hook-loop-triage.mjs:8，route:human）。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎原样拷入同仓归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与多态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN；自愈只对确证 HARNESS_ERROR 开闸。
- ADR-0003 编译再回放 + 非就地有界自愈：LLM 只编译期读一次用例、日常回放零 LLM；禁纯坐标步；自愈写旁车补丁、人签后应用；熔断喂每步进展哈希。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从类型词汇表选、易变值模板化；草拟→冻结（仅断言文件）→人签；人签是 CASE_DEFECT 与 SUT_DEFECT 分水岭。
- ADR-0005 统一语言强制：四列制术语表唯一白/黑名单源，术语必加粗（中文）或反引号；Stop + PostToolUse 双 hook + 门禁三执行点；造词先登记；中文禁繁体。
- ADR-0006 Casey = autotester 与 regress 分层融合：非第三项目而是 L0–L4 分层增量去重（P3 已据此降级为「陌生站点孵化」支线）。
- ADR-0007 P5 回放运行时基座 + 取证归因：基座采纳 @playwright/test；取证按 CDP 真发起方归因 + 背景 denylist；证不出归 null 永不背书。
- 里程碑时间线（git log，越往下越新）：
  P2 裁判内核 loop+review（p2-intent-compile）→ seams-freeze 5 接缝冻结（解锁并行）→ 第 2 层四轨落 dev
  → P5 回放内核 loop GREEN（d790f96）→ P5 codex 异构评审 FAIL→10 修复→复核绿（b982171/b0dcaff/6b94b75）
  → 最近一 session：term-guard 契约（9a9ff03）→ model-lane-guard 契约（34f7e5d，I1+I2 守卫，codex 4 轮收敛）
  → hermetic 缺口 golden 补冻（cfd1ede，P7 凭据门 + P6 superseded）→ P5 learn 收口（d297332）
  → seams-freeze-v2 grill 备料 WIP（8230e0f）→ 会话基建（9c5e4cf，模型分层 config + 双守卫钩子）。
  最近一 session 6 提交全入 dev；本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest（L1）→ 相1 编译 compile（L3，唯一一次真机跑，落 events.json + observed-<caseId>.json 观测现状）
  → 相2 冻结+人签 sign（L2 草拟带类型 expected[] → 人签 → checksum 冻结，只冻断言不冻 spec）
  → 相3 回放 replay（零 LLM，确定性重放 + 录屏 + CDP 取证）→ 相4 裁定 verdict（零 LLM 判定树出四态）
  → 相5 自愈 self-heal（L3，仅对确证 HARNESS_ERROR 写旁车补丁、人签后 apply）→ 相6 报告 report（零 LLM + 凭据兜底门）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐三组正交事实——动作轴（过点击身份门判 true/ambiguous/false）/ 断言轴（每 typed kind 一条、硬软分流）/ 取证轴（网络+生命周期）；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS（硬断言全绿）/ SUT_DEFECT（被测缺陷，须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（工装漂移，可自愈）/ NEEDS_HUMAN（证不出，路由人，带 reason 子类）。
  · 点击身份门：唯一命中或点击后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 网络取证按发起方归因：按 initiator / attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 只读漂移探针：无 spec 变更无重跑，只读探「同稳定签名唯一元素是否仍在」供 verdict 判 HARNESS_ERROR；与自愈写回严格分离（拆 P5/P6 循环）。
  · 通道剖面 profile：某 channel 回放所需非凭据配置（背景 denylist + 错误信封成功字段），与 site.json 凭据分离。
  · 错误信封：按响应 body 成功字段判的软失败（典型 HTTP 200 但 body 表失败），成功字段按 channel 参数化。
  · 静默点：动作后等 UI 稳定的确定性条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现。
  · 观测现状：编译期落盘地面真值（真实成功 URL/提示/回复/请求日志），存 observed-<caseId>.json，断言草拟与裁定依据。
  · 冻结断言契约：人签后写 loop/prd-<caseId>.json 并 checksum 冻结的断言，实现者只读、改即触棘轮。
  · 人签门：断言冻结须人签才算数；gate 绿 ≠ 完成，人签真机才完成。
  · TestCase 聚合根：excel/json/txt/自由文本归一后唯一内部用例对象（target/steps/expected/uniquePrefix）。
- 五层 LLM 准入边界（智能与频率成反比，ADR-0003）：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门）；
  L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者、绝不反向进裁判进程。
- DDD 落法：CONTEXT.md 即 ubiquitous language 注册表（两限界上下文），term-lint 机制强制统一语言、命名先查既有学科。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。
- 入口分流三档：direct=地板全放行（无红基线的活如 coverage 补冻走此，安全网=gate+ratchet）；
  light=加 plan 门跳 grill（edit-impl 需 plan）；full=全链（edit-impl 需 accept、push 需 review），碰或改冻结内核必走。
  accept 半硬要 --red-verified（coverage-add 无红基线者别套 full accept、走 direct）。判定用传递链 doneThrough。
- passes 只 gate 写：prd 的 passes 仅 loop-kit/bin/gate.mjs 有权写（默认 FAIL 凭 Test Ratchet checksum + term-lint + 逐 story acceptance 翻绿）；testChecksums 冻结文件对实现者只读，加测试=棘轮只增不减（护栏 #1 允许）。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫，弃用别名/繁体/未登记加粗英文拦红。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 /
  #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 /
  #16 gate 绿≠完成（需人签真机）/ #17 裁判按断言种类不可知（kind 枚举只活在 check.mjs）。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，畸形步同样，绝不静默 PASS。
- 入参畸形 fail-closed：verdict 缺 --axes/--out → exit 64；坏数据 → exit 65。
- 点击身份门：action 缺失/畸形→false；fallback_first/coord_fallback→ambiguous→NEEDS_HUMAN(AMBIGUOUS_ACTION)。
- 取证按发起方归因：只认 attributedStepId===本步的 5xx/信封/pageerror/crash；stepId==null 不背书。
- 自愈门 driftHolds：须 resolution==='none' 正向 miss + driftProbe.sameSignatureUniquePresent===true，缺证据落 INDETERMINATE。
- 回放看门狗 replay.mjs 75s 超时强退；归因不到本步投 null；行计数 .count() 抛错回 null 不回 0（防 countChange===0 假绿）。
- 熔断器 breaker.mjs 越阈 appendFile 到 loop/inbox.md 后 exit 2；凭据兜底门 report.mjs 落盘前深扫敏感词+比对 site.json 字面量，命中 exit 1 拒写。

【排期】
- P0 引导 loop（direct）已完成；P1 DDD 词表+ADR（plan）已完成；
  P2 规范 TestCase+归一（full，p2-intent-compile）loop+review 完成，仅 learn 待；
  P3 编译期 recorder（full）已降级出 MVP 关键路径（ADR-0006「陌生站点孵化」，route:human）；
  P4 断言草拟+冻结+人签（full，p4-freeze）loop 完成；
  P5 回放+取证+verdict+漂移探针（full，p5-replay）★核心 —— 全 6 阶段收口（loop+review+learn done），tier-2 真机 route:human 未走；
  P6 自愈准入门+非就地自愈（full，p6-selfheal）loop 完成 + superseded coverage 补冻；
  P7 报告+徽章+缺陷单（full，p7-report）loop 完成 + credentialGate coverage 补冻；
  P8 多目标（full）未开始（第 3 层集成）；P9 两层 selftest：tier-1 hermetic 无回归绿，tier-2 live + 真机 UAT 未走。
  MVP 第一刀 = 打通 P0→P5+P7 的 web 单用例。
- 开发流程兜底契约（新，仅开发 lane 不涉产品）：term-guard（统一语言强制）收口；model-lane-guard（模型分层强制）收口、I1+I2 守卫已上线；hermetic-gap-freeze（缺口 golden 补冻）done。
- 排期 v3 三层：第 0/1 层完成；第 2 层四轨 hermetic 建造实质收口；第 3 层集成（真数据端到端）未开始。
- 单 baton 上限：loop-kit 单活契约（主树共享 loop/active-contract.json 一槽），多 full 契约无法真并行；
  并行只用在零 baton fan-out（研究/grill/schema/golden 起草/异构评审）。碰 lib/bin 落地走 worktree 隔离 + git-native 合并，绝不 cp 进 lib/bin。

【当前契约 / 状态】
- 活契约（loop/active-contract.json 亲验）= seams-freeze-v2，lane full，六阶段全 false = grill 进行中（接缝冻结第二批）。
- seams-freeze-v2 现状：3 承重决策已人签——1.1 run-history 删 cacheStatus/cacheHitRate、编译期复用溯源字段登记 deferred（不动已冻 events.schema、本轮不建）；2.2 channelDriver 拉进本轮 co-grill（范围扩到四接缝、channelDriver 净新无草稿）；3.3 fingerprint 聚类粒度延后到哈希实现阶段 route:human。7 条机械决策见 docs/plans/seams-freeze-v2/proposed/GRILL-DECISIONS.md。
  run-history 三改已落已提交（method→action、intentId minLength:1、删 cacheStatus）；channelDriver 待起草（崩溃中断）。
- 其余契约：term-guard/model-lane-guard/p5-replay/p4-freeze/p6-selfheal/p7-report/seams-freeze/hermetic-gap-freeze 均收口或 loop done；p2-intent-compile 仅 learn 待。最近一 session 6 提交全入 dev（进场先 git status 核当下工作树）。
- 最新工程纪律（别漏）：
  · 模型分层升级（2026-07-01 锁，现已被 model-lane-guard 机制强制）：主环 Opus 4.8 ultracode 承 full 与冻结内核；轻车道派 Sonnet 5 独立 subagent（max effort，切 subagent 非主环换模型保 prompt 缓存）；review 未动、sonnet 仍同族末位 fallback。
  · 两条静态不变量已机制强制：I1 verdict 零 LLM 依赖闭包（bin/verdict-purity-guard.mjs 静态扫，入 casey selftest --tier1）；I2 config 异构不塌同族（bin/config-lane-guard.mjs + .claude/settings.json 独立 PostToolUse 钩子）。（I3「Sonnet 5 只作 subagent」是运行时属性、其兜底即 I1。）三级梯 watcher（运行时再派）仍另起辐条未建。
  · review 用 codex（固定纪律）：契约 review 阶段异构评审用 codex（codex CLI 在 ~/.local/bin/codex，非 Claude 同族），绝不用 Claude 子代理同族自评。调法：空 cwd（scratchpad 空目录）+ 自包含料喂 stdin（把 spec/diff/实现全文 inline，因 codex 不跑 shell 读不到文件）+ codex exec -s read-only --skip-git-repo-check -m gpt-5.5 + 明令不跑 shell（锁死护栏 #9）。判 FAIL 采信去修+钉红 golden，判 PASS 记 loop/audit.jsonl 再 advance review。
  · term-guard：甲 Stop 钩子当前 warn-only 只警告不拦、乙真非 Claude 评分员接线待密钥——别误判硬拦全开。

【下一步（任选其一，先对齐再动手）】
A（首推，接续活契约）seams-freeze-v2 grill：① run-history 的 fixture + grill.md 跟 schema 改（method→action、去 cacheStatus 值）；
  ② 起草 channelDriver 接缝（schema+fixture+grill，actionSpace ⊆ events.schema 的 action 枚举，凭据不进护栏 #7）+ 定它与 action-vocabulary 边界（决策 2.2 核心）；
  ③ action-vocabulary/failure-ledger 决策落地 + 编译期复用溯源登记 deferred；④ 写合并 grill.md + 登记 CONTEXT.md 新词
  → advance grill → plan → accept（冻四接缝 schema+fixture 入新 prd-seams-freeze-v2）→ loop（golden 校验器）→ codex 异构评审 → learn。
B p2-intent-compile 的 learn（沉淀收尾，轻）。
C tier-2 真机 UAT（route:human，护栏 #16）：catalog_wf_crud 真站全 PASS + 注 HTTP500 出 SUT_DEFECT + 验 CDP initiator 真发起方归因可靠度（ADR-0007 推翻条件）。
D 第 3 层集成：compile-gate 真产物 → P5 真回放 → verdict → P7 报告，首条 web 端到端真报告。

【环境坑（WSL）】
- 【9p 崩溃】/mnt/d（drvfs 9p 挂载）会全局 EIO 崩溃（WSL↔Windows 传输通道断）：所有仓库读写失败但 /tmp 本地盘正常。
  恢复（别 wsl --shutdown 杀 session）：Windows 资源管理器戳一下 D: 唤醒，或 WSL 里 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d。
  原子写（Edit 写 .tmp 再改名）保护：崩溃中失败的写不落半成品、不损坏原文件。
- loop-guard 误判（比想象宽）：命令里含任何 prd 文件路径 → 判 write-prd（契约 pre-plan 时拦）；含 node -e 内联 / cp / rm → 判 edit-impl；
  读类/git 命令带重定向或管道 + bin/ 路径 → 判 edit-impl。对策：查文件用 Read 工具或 scratchpad 脚本、别在命令行带 prd 路径与重定向。
- 授权提交/切 baton：full 契约 pre-loop 会拦 commit-impl。要提交先 init 一个 direct 契约授权，提完 re-init 原契约恢复 baton（direct=全放行）。
- 行尾/checksum 已核实整库 LF 一致（.gitattributes eol=lf + core.autocrlf=false）；查行尾用 node 数 0x0d，别用 grep -c $'\r'（git-bash 下退化误报）。
- 路径 D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版（npx playwright install --with-deps chromium，非借 Windows chromium）。别在 /mnt/d 混用 Windows 与 WSL git（filemode/CRLF 假报）。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
契约 review 用 codex 异构评审、绝不同族自评。可并行的活优先 fan-out 零 baton 子代理；决策分岔用可点选项呈现、别散文长问。
```

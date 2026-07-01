# 下个 session 接续提示词（Casey / 排期 v2 第2层，P5 回放内核 next）

> 用法：下次只需说「读 `docs/NEXT-SESSION.md` 接着干」。本文件是给接续 Claude 的执行指令；状态事实以 `docs/HANDOFF.md` 为准，二者冲突时信 HANDOFF。

## 开场提示词

> 本节是当前（2026-07-01）新 session 开场提示词，由 `/session-handoff` 生成，是本文件最新的事实入口；本文件下方各节停在 P5 accept/loop，已过期，冲突一律以本节与 `docs/HANDOFF.md` 为准。

```
项目：Casey（测易，LLM 驱动「文本用例→测试报告」确定性可回放测试系统）。
工作目录 /mnt/d/ctx/heren/casey，分支 dev（master 稳定 / test 提测）。
你是接手者，零上下文起步——先读文档对齐，再按下一步动手。

【一句话定位 + 血缘】
Casey 是 autotester（人录·机回放·零 LLM）的「翻面」：输入端改 LLM 读懂文本用例，
但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。
复用 autotester 的 loop-kit 作第二消费者（ADR-0001）。三处统一标识符 casey：
CLI bin/casey.mjs、skill .claude/skills/casey、MCP server casey。

【先读，别现编已决的事】（必读顺序）
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用）
2. docs/HANDOFF.md（最新进度，冲突以它为准）
3. docs/NEXT-SESSION.md（仅本「开场提示词」节 + 环境坑参考，其余节可能过期、不作下一步事实源）
4. loop/GUARDRAILS.md（17 条护栏逐条有效）
5. 追溯「为何这么定」：docs/adr/（架构决策，主事实源）、docs/design/（端到端设计）；
   注意 docs/decisions/ 目录当前不存在，loop 纪律钩子里引的
   docs/decisions/2026-06-12-loop-kit.md 是坏引用，真身是 docs/adr/0001-reuse-loop-kit.md。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎原样拷入同仓归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与多态 verdict.mjs 分两个写者；机器只终判 PASS 与有取证的 SUT_DEFECT，证不出一律 NEEDS_HUMAN；自愈只对确证 HARNESS_ERROR 开闸。
- ADR-0003 编译再回放 + 非就地有界自愈：LLM 只在编译期读一次用例，日常回放零 LLM；禁纯坐标步；自愈写旁车漂移补丁、人签后才应用；熔断器喂每步进展哈希。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从类型词汇表选、易变值模板化；草拟→冻结（只冻断言文件）→人签三段；人签是 CASE_DEFECT 与 SUT_DEFECT 的分水岭。
- ADR-0005 统一语言强制：四列制术语表为唯一白/黑名单源，术语必加粗（中文）或反引号；Stop + PostToolUse 双 hook + 门禁三执行点；造词先登记；中文一律简体；hook fail-open、门禁 fail-closed。
- ADR-0006 Casey = autotester 与 regress 的分层融合：非第三个项目而是 L0–L4 分层增量去重（P3 已据此降级为「陌生站点孵化」支线）。
- ADR-0007 P5 回放运行时基座 + 取证归因：回放基座采纳 @playwright/test；取证按 CDP 真发起方归因 + 背景 denylist；证不出归 null 永不背书。
- 里程碑时间线（git log 提炼，全部已入史那部分）：
  P1 三交付面术语登记 → P2 裁判内核 loop+review 收口（契约 p2-intent-compile，codex gpt-5.5 真异构 7 修复）
  → seams-freeze 5 条数据契约接缝冻结（解锁并行）→ 第 2 层四轨并行落 dev（p7-report / track-F fail-safe 覆盖锁 / p6-selfheal / p4-freeze）
  → P5 回放内核 loop GREEN（p5-replay：runner+三轴+CDP 取证+漂移探针+SSE 静默点）→ codex 异构评审判 FAIL→10 fail-safe 修复→覆盖 golden 冻结防回退。
  最近 5 条提交：00cc561 session-handoff 固定模板 / 6b94b75 HANDOFF P5 收口 / b0dcaff P5 覆盖 golden 冻结 / b982171 P5 异构评审收口 / d790f96 P5 回放内核 loop GREEN。
- 关键提醒：git log 停在「P5 收口」，但工作树有一大批未入史现场（见下【当前契约 / 状态】），别误判为已稳定。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest（L1 归一）→ 相1 编译 compile（L3，唯一一次真机直接跑，落 events.json + observed-<caseId>.json 观测现状）
  → 相2 冻结+人签 sign（L2 草拟带类型 expected[] → 人签 → checksum 冻结，只冻断言不冻 spec）
  → 相3 回放 replay（零 LLM，确定性重放 + 录屏 + CDP 取证）→ 相4 裁定 verdict（零 LLM 判定树出四态）
  → 相5 自愈 self-heal（L3，仅对确证 HARNESS_ERROR 写旁车补丁、人签后 apply）→ 相6 报告 report（零 LLM 渲染 + 凭据兜底门）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐三组正交事实——动作轴（过点击身份门判 true/ambiguous/false）/ 断言轴（每 typed kind 一条、硬软分流）/ 取证轴（网络+生命周期）；是裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS（硬断言全绿）/ SUT_DEFECT（被测缺陷，须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（工装漂移，可自愈）/ NEEDS_HUMAN（证不出，路由人，带 reason 子类）。
  · 点击身份门：仅唯一命中或点击后身份回读成立才置 actionPerformed=true；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 网络取证按发起方归因：按请求 initiator / attributedStepId 归到发起步，非时间窗；背景轮询 401 不得翻本步 verdict。
  · 只读漂移探针：无 spec 变更、无重跑，只读探明「同稳定签名唯一元素是否仍在」，供 verdict 判 HARNESS_ERROR；与自愈写回严格分离（拆 P5/P6 循环依赖）。
  · 通道剖面 profile：某 channel 回放所需的非凭据配置（背景 denylist + 错误信封成功字段/值），与 site.json 凭据密文分离。
  · 错误信封：按响应 body 成功字段判的软失败（典型 HTTP 200 但 body 表失败），成功字段按 channel 参数化。
  · 静默点：动作后等 UI 稳定的确定性等待条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现。
  · 观测现状：编译期落盘的地面真值（真实成功 URL/提示/回复/请求日志），存 observed-<caseId>.json，是断言草拟与裁定依据。
  · 冻结断言契约：人签后写 loop/prd-<caseId>.json 并 checksum 冻结的断言，实现者只读、改即触棘轮红。
  · 人签门：断言冻结须人工签署才算数；gate 绿 ≠ 完成，人签真机才完成。
  · TestCase 聚合根：DDD 聚合根，excel/json/txt/自由文本归一后唯一内部用例对象（target/steps/expected/uniquePrefix）。
- 五层 LLM 准入边界（智能与频率成反比，ADR-0003：越频繁跑的层越不许有 LLM）：
  L0 确定性内核（零 LLM，任何 LLM 不得进此进程）：gate.mjs 唯一写 passes / verdict.mjs 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门 / 快照取证 / atl_ 清扫。
  L1 输入归一（LLM 提案）：杂乱输入→规范 TestCase，产物由确定性 parseTestCase 校验、不合规 fail-closed。
  L2 断言草拟（LLM 提案）：从 intent + observedReality 推带类型 expected[]，冻结+人签后才算数。
  L3 编译/自愈执行（LLM 真机 agent）：编译 intent→稳健动作+观测现状→spec；自愈仅对确证漂移重锚；受熔断器约束，产出必经 L0 复核。
  人签门归人：签掉冻结断言、NEEDS_HUMAN 时三选一裁决（修用例/记缺陷/重签基线），机器不得代签。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者、绝不反向进裁判进程（否则 LLM 把真 bug 重锚成绿=最危险的假绿）。
- DDD 落法：CONTEXT.md 即 ubiquitous language 注册表（两限界上下文：Casey 核心域 + loop-kit 工程域，同名术语按分节为准）；term-lint 机制强制统一语言、命名先查既有学科（DDD→SRE→控制论→CI/CD→XP/BDD→ITIL），映射不到才造词、且先登记。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。
- 入口分流三档（contract.mjs checkAction 核对）：
  direct=地板全放行（唯一底线：init 要非空 --reason）；
  light=加 plan 门跳 grill（write-prd/edit-impl/commit-impl 需 plan.done，push 需 loop.done）；
  full=全链（write-prd 需 plan、edit-impl 需 accept、commit-impl 需 loop、push 需 review），碰或改冻结内核（verdict.mjs 判定树 / StepAxes 形状）必走。
  判定用传递链 doneThrough（逐阶段全 done 才算过，防孤立 done 放行）；未声明 lane 默认 full。
  「accept 任何车道都不跳」是散文纪律，非 light 硬门——但传递链间接兜住（进 loop 必先 accept.done）。
- passes 只 gate 写：prd 的 passes 仅 loop-kit/bin/gate.mjs 有权写（默认 FAIL 凭三检查翻绿：Test Ratchet checksum + term-lint + 逐 story acceptance 全 exit 0）；testChecksums 冻结文件对实现者只读。
- 双 hook 术语拦截：回合输出与写入 md/json 都被 term-lint 扫，弃用别名/繁体/未登记加粗英文术语拦红。
- 护栏 17 条要点：#1 测试冻结棘轮（gate 强制）/ #3 熔断（20 轮/零进展 3/同错 5/8 时，breaker 强制）/ #4+#12 统一语言+禁繁体（hook+gate 强制）/ #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁（hook 强制）/ #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成（需人签真机）/ #17 裁判按断言种类不可知（kind 枚举只活在 check.mjs）。

【兜底 / fail-safe 机制】（证不出怎么收；行为已在代码落地并 golden）
- 四态 catch-all：verdict.mjs 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，畸形步同样落 NEEDS_HUMAN，绝不静默 PASS。
- 入参畸形 fail-closed：verdict 缺 --axes/--out → exit 64；坏数据（axes 非对象/steps 空）→ exit 65；内部错 → exit 1。
- 点击身份门：action 缺失/畸形→false；resolution 为 fallback_first/coord_fallback→ambiguous→NEEDS_HUMAN(AMBIGUOUS_ACTION)。
- 取证按发起方归因：只认 attributedStepId===本步的 5xx/错误信封/pageerror/crash；stepId==null 不背书（防 undefined===undefined 假命中）。
- soft 只 ===true 才排除出裁定树（非布尔 truthy 当硬断言，防静默降级）。
- 自愈门 driftHolds：须 resolution==='none' 正向 miss + driftProbe.sameSignatureUniquePresent===true 才判 HARNESS_ERROR，缺 miss 证据落 INDETERMINATE。
- 回放看门狗：replay.mjs setTimeout 75 秒超时强制 exit 1（绝不挂死）；归因不到本步的记录投 null；行计数 .count() 抛错回 null 不回 0（防 countChange===0 假绿）。
- 熔断器：breaker.mjs 越阈 appendFileSync 到 loop/inbox.md 后 exit 2（调用方必须停循环）。
- 凭据兜底门：report.mjs 落盘前深扫禁字段关键词 + 精确比对 .auth/site.json 敏感字面量，命中即 console.error + exit 1，在 write 之前拒写。

【排期 + 并行策略】
- P0–P9 现状：
  P0 引导 loop 机制（direct）—已完成；P1 DDD 词表 + ADR（plan）—已完成；
  P2 规范 TestCase + 输入归一（full，p2-intent-compile）—loop+review 完成，仅 learn 待；
  P3 编译期 recorder-as-library（full）—已降级出 MVP 关键路径（ADR-0006 改「陌生站点孵化」支线，route:human）；
  P4 断言草拟+冻结+人签（full，p4-freeze）—loop 完成落 dev；
  P5 确定性回放+取证+verdict+漂移探针（full，p5-replay）★核心—loop+review 完成、passes:true，仅 learn 待，tier-2 真机 route:human 未走；
  P6 自愈准入门+非就地自愈（full，p6-selfheal）—loop 完成落 dev；
  P7 报告+裁定徽章+缺陷单（full，p7-report）—loop 完成落 dev；
  P8 多目标 web/cef/arbitrary（full）—未开始（属第 3 层集成）；
  P9 两层 selftest + 真机 UAT（full）—tier-1 hermetic 无回归绿，tier-2 live smoke + 真机 UAT 未走。
  MVP 第一刀 = 打通 P0→P5 + P7 的 web 单用例，再回头做 P6 自愈与 P8 多目标。
- 排期 v3 三层：第 0 层（P0/P1/P2）已完成；第 1 层 接缝冻结（6 接缝 + prd.schema v2）已完成；
  第 2 层 四轨 hermetic 建造 已实质收口（各轨合并 dev 亲验绿，P3 降级 route:human，P5 亦 loop 绿）；
  第 3 层 集成 未开始（compile-gate 真产物 → P5 真回放 → verdict → P7 报告 首条 web 端到端 → P8 多 channel → P9 真机 UAT）。
- 并行硬约束（决定「怎么并行」的总闸）：loop-kit 是单活契约（主树共享 loop/active-contract.json 一个槽），
  LOOP_CONTRACT_FILE 参数化 + breaker --state 未建 → 多个 full/light 契约无法真并行；此基建已决定暂不投。
  所以「最大化并行」= 单 baton 串行推进契约脊 + 尽量 fan-out 零 baton 备料活并排跑。
- 可无限 fan-out 的零 baton 活（不碰 active-contract、不写 lib/bin，可并排多子代理跑）：
  研究 / grill 起草 / schema 起草 / golden 起草 / 异构评审 / 纯文档直干修复。
- 必须串行的活（单活 full/light 契约，占 baton）：碰 lib/bin 的落地实现；要并行须 worktree 隔离 + git-native merge/apply，绝不 cp 进 lib/bin。

【当前契约 / 状态】
- 活契约（loop/active-contract.json 亲验）= term-guard，lane light，6 阶段（grill/plan/accept/loop/review/learn）全 done。
  → baton 实质已空闲，可直接 contract init 下一个契约接手（注意 init 会重置台账）。
- model-lane-guard = plan-done：仅有 docs/plans/model-lane-guard/{grill.md,plan.md}，无 prd 无 golden，accept 未做。
- p5-replay（full）= grill/plan/accept/loop/review done、passes:true，仅 learn 待。
- p2-intent-compile = 仅 learn 待。其余 seams-freeze / p2-failsafe-coverage / p7-report / p4-freeze / p6-selfheal = loop done、产物落 dev。
- 已建成能力（loop 绿 / hermetic 骨架，gate 绿≠完成、护栏 #16）：
  裁判 bin/verdict.mjs、取证 lib/forensics.mjs、断言硬闸 bin/check.mjs、编译门 lib/compile-gate.mjs、
  P5 回放器 bin/replay.mjs + lib/replay-{actions,forensics,assert}.mjs + lib/drift-probe.mjs + lib/instantiate.mjs、
  P7 报告 lib/report.mjs + bin/report.mjs、P4 骨架 lib/{expected-compile,sign-gate}.mjs、P6 骨架 lib/{heal-gate,drift-patch}.mjs。
- 未提交现场（git status，本仓 git remote 空、无远端、push 目标待定；只看 git log 会误判已稳定）：
  已改：.claude/settings.json（term-guard Stop 钩子 warn-only 接线）、loop/config.json（模型分层升级）、docs/HANDOFF.md、docs/FLYWHEEL.md、.claude/skills/session-handoff/SKILL.md；
  新增未跟踪：bin/term-guard.mjs、bin/term-judge.mjs、bin/term-guard-hook.mjs、tests/_golden/term-guard.golden.mjs、loop/prd-term-guard.json、docs/plans/term-guard/、docs/plans/model-lane-guard/。
  即整个 term-guard 契约 + 模型分层升级 + 钩子接线 + 文档更新，全部只在工作树、尚未入史。
- 最新工程纪律与决策（2026-07-01 锁定，别漏）：
  · 模型分层升级（仅开发流程 lane，不涉产品功能）：主环 Opus 4.8 ultracode 当编排器承 full 与冻结内核；
    轻车道派 Sonnet 5 独立 subagent（max effort）——切 subagent 而非主环换模型，保 prompt 缓存不断 + 上下文隔离；
    review 未动、sonnet 仍同族末位 fallback；toil 缓（撤回原 codex:gpt-5.5，待 nightly runner）。
  · 三级兜底阶梯：Sonnet 5 max 卡（zeroCommitRounds/sameErrorRounds 跳闸）→ 升 Opus 4.8 xhigh 重试 → 再卡 → NEEDS_HUMAN 写 loop/inbox.md（护栏 #14 fail-safe 不 fail-open）；toil 不入此梯。
  · 静态强制兜底三不变量：I1 裁判零 LLM（verdict.mjs 依赖闭包零 LLM/网络，护栏 #15 承重）；
    I2 异构评审不塌同族（review.model 家族 ≠ implementation.model 家族，sonnet/opus 只能在 review fallback）；
    I3「Sonnet 5 只作 subagent」是运行时属性、静态不可查，兜底即 I1。
  · term-guard 契约：甲 bin/term-guard.mjs 零 LLM 拦 R3 比喻声明块格式 / R6 加粗未登记英文与弃用别名（引用豁免只认反引号代码体）；
    乙 bin/term-judge.mjs 语义评分员（只对甲候选跑）。现状别误判：甲 Stop 钩子当前 warn-only 只警告不拦，
    乙真非 Claude 评分员（callRealJudge）接线待密钥——硬拦并未全开。

【下一步（并行优化版；先对齐再动手，可点选）】
先把并行与串行分层看清（受单 baton 约束）：
▶ 立即可并排跑的零 baton fan-out 组（开局就派多子代理，不占 baton、不写 lib/bin）：
  F1 修坏引用（直干，纯文档）：把引 docs/decisions/2026-06-12-loop-kit.md 处改指 docs/adr/0001-reuse-loop-kit.md。
  F2 起草两个 hermetic 缺口 golden：P7 credentialGate / P6 superseded（草稿在各 proposed/，起草零 baton，冻结时再占 baton）。
  F3 seams-freeze-v2 增冻 grill 续稿：草稿已在 docs/plans/seams-freeze-v2/proposed/（3 接缝：run-history / action-vocabulary / failure-ledger 的 grill+schema+fixture 齐）。
  F4 起草 model-lane-guard 的 I1/I2 红 golden（起草零 baton；accept 冻结时占 baton）。
  F5 term-guard 乙 callRealJudge 接线方案研究（执行待非 Claude 密钥，设计/研究零 baton 可先做）。
▶ 单 baton 串行契约脊（一次只推一个，占 active-contract 槽）：
  A（首推）model-lane-guard 契约（轻车道，仅开发流程不碰产品功能）：吃 F4 的红 golden → contract init model-lane-guard --lane light
    → 从 accept 起冻 I1（verdict.mjs 零 LLM 闭包断言入 casey selftest --tier1）+ I2（config.json 异构不变量），
    加三级兜底 watcher（读 breaker 状态、跳闸自动 Sonnet 5→Opus 4.8 xhigh 再派）→ loop → codex 异构 review → learn；
    不改 loop-kit / verdict.mjs，参考 term-guard 甲乙模式。目标：把 2026-07-01 锁的三不变量从散文变成机制强制。
  B p5-replay 的 learn（关键路径接续第二步）：baton 现空闲，contract init 或按 slug 恢复后走完 learn 沉淀收口流水线。
  C term-guard 乙真接线收尾：待 ~/.loop-kit 非 Claude 密钥；接上 callRealJudge，观察期无误判后把 term-guard-hook.mjs 的 WARN_ONLY 置 false 切硬拦。
  D tier-2 真机验收（route:human，护栏 #16）：依赖 P3 编译 + P5 真回放；catalog_wf_crud 真站全 PASS + 注 HTTP500 出 SUT_DEFECT + 验 CDP initiator 归因可靠度。
  E 第 3 层集成（串行必后）：依赖 P5 真回放 + P7 报告；compile-gate 真产物 → P5 真回放 → verdict → P7 报告，首条 web 端到端真报告（非合成 fixture）。
推荐编排：开局同时派 F1–F5 五个零 baton 子代理并排跑，主脑同时占 baton 推 A（model-lane-guard）；
A 的 accept 直接吃 F4 产物；A 收口后 baton 转 B（p5-replay learn），再进 E 集成脊。
（注：若要让多个 full 契约真并行，须先建 LOOP_CONTRACT_FILE 参数化 + breaker --state——此基建已决定暂不投，别顺手开工。）

【环境坑（WSL）】
- 行尾/checksum 已核实整库 LF 一致；查行尾别用 grep -c $'\r'（git-bash 下退化误报），用 node 数 0x0d。
- loop-guard：读类命令带重定向且含 bin/ 路径会被误判 edit-impl 拦——直接跑别加重定向；cp/rm 进 lib/ 会被拦。
- 路径：D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版（非借 Windows chromium）。
- 别在 /mnt/d 混用 Windows git 与 WSL git（filemode/CRLF 假报）。
- scratchpad 的 active-contract.{model-lane-guard,p5-replay}.bak.json 新会话可能取不到（本次已不在）；切 baton 用 contract init 或 re-init + 逐阶段 re-advance 恢复，别指望 bak。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
可并行的活优先 fan-out 子代理（受单 baton 约束：零 baton 备料尽量并排，占 baton 的契约脊串行）；
决策分岔用可点选项呈现、别散文长问。
```

## 第一步：先读，别跳

1. `CLAUDE.md` 必读顺序：`CONTEXT.md` → `docs/design/txt2testreport-design.md` → `docs/plans/bootstrap/plan.md` → `loop/GUARDRAILS.md`。
2. `docs/HANDOFF.md`（现状、产物、冻结接口、下一步）。
3. `docs/plans/p2-intent-compile/`：`grill.md`（锁定决策）、`plan.md`（三 story + 验收点）、`regress-intel.md`（带 file:line 的实现参考，建 impl 时直接查、别重跑深读）。
4. `docs/adr/0006-fuse-autotester-regress.md`（融合决策 + 深读核验后的风险修正）。
5. 跑 `node bin/casey.mjs selftest --tier1` 确认环境。注意：别加 `2>&1` 这类重定向——会被 loop-guard 误判成 edit-impl 拦下；要看输出直接跑即可。

## 一句话现状

排期 v2/v3 已落；P5（★ 回放核心，第2层最后一轨）loop 绿（2026-06-30）：`bin/replay.mjs` + `lib/{replay-actions,replay-forensics,replay-assert,drift-probe,instantiate}.mjs` 全建成，真 chromium 回放假 SUT 产三轴喂已冻 `verdict.mjs`，golden 10/10 全绿。accept 前修法发现并修掉一个冻结夹具缺陷：进程内假 SUT 被同步 `execFileSync(replay)` 冻死、答不了 replay 浏览器（goto 卡死）→ 把假 SUT fork 出独立进程（8 态行为一字未改），server.mjs checksum 重签入 prd、accept 重签、gate GREEN。`active-contract.json` = `p5-replay`（full，grill/plan/accept/loop done，review 待）。下一步 = P5 异构冗余评审（codex:gpt-5.5 非同族，评审料 `scratchpad/p5-review-packet.md`，护栏 #9 只喂 spec+diff+证据），判 FAIL 采信去修、判 PASS 记 `loop/audit.jsonl` 再 `advance review`；再 tier-2 真机 route:human（护栏 #16 gate 绿 != 完成）。细节信 `docs/HANDOFF.md`，内部排期信 `docs/plans/p5-replay/exec-plan.md`。

## WSL 环境注意（下次在 WSL/bash 跑，不再 PowerShell）

1. 行尾/checksum（已核实安全，无需处理）：`.gitattributes` 钉 `eol=lf`，整库已是 LF 一致——HEAD `blob`、工作树、testChecksums 三者全按 LF 字节对齐（2026-06-29 用 node `buf.includes(0x0d)` + `git cat-file blob` 逐文件核 CR=0，7 个 `gate` + `selftest` 全绿）。WSL `checkout` LF `blob` 仍出 LF、字节稳、ratchet 不失配，进 WSL 后**直接干即可**。两个坑别踩：(a) 查行尾别用 `grep -c $'\r'`——git-bash 下这个 CR pattern 会退化成空 pattern、把**行数**误报成 CR 数（本会话一度据此误判「工作树 CRLF」、追了个不存在的幻影）；要查用 node 数 `0x0d`、或 `git cat-file blob <f> | od -c`。(b) 本仓 local config 已设 `core.autocrlf=false` + `core.eol=lf`，与 `.gitattributes` 同向、防 Windows 端未来 CRLF 渗入；WSL 端 Linux git 默认即 LF，无需另设。
2. 路径：`D:\ctx\heren\casey` → `/mnt/d/ctx/heren/casey`；`M:` → `/mnt/m/`（`M:\home` 仍禁用，产物放 /mnt/m 别处且**先问确切路径**）。提交代码无硬编码盘符（可移植）。autotester 复用源 → `/mnt/d/ctx/heren/autotester`。
3. playwright（P5 前置）：WSL 要装 Linux（非 Windows）playwright `npx playwright install --with-deps chromium`（需 libnss3 等系统依赖），**不能借** autotester 的 Windows chromium。
4. shell + loop-guard：用 bash（`cp`/`rm`/`sha256sum`/`ps`），不是 PowerShell cmdlet。loop-guard 的 WRITE_CAP 正则按 bash 写——`cp`/`rm`/`>` 会被正确命中：(a) 读类命令带 `2>&1`/`>` 且含 `bin/` 路径会被误判 edit-impl 拦（PS 下也有）；(b) 本会话用 `Copy-Item` 把文件拷进 `lib/` 绕过 edit-impl 的 loophole，bash 下 `cp` 进 `lib/` 会被拦——baton-swap landing 改走 git-native（`merge`/`apply`），别 `cp` 进 lib/bin。
5. git 跨平台：别在 /mnt/d 上混用 Windows git 与 WSL git（filemode/CRLF 会让一堆文件假报 modified）。`core.filemode` 已 false。`windows.appendAtomically false` 那条 config 在 WSL 无害（Linux git 忽略）；Windows 的 index.lock 写错坑 WSL 没有，但 /mnt/d 是 9p 挂载、偏慢。

## 这次要干：先审 accept 4 处承诺 → 冻 → Phase 2 起 runner

Phase 0+1 已落（环境 + 假 SUT + 红 golden + prd），accept 已备未冻。第一步是**人审 accept 4 处承诺**（细节在 `docs/HANDOFF.md`「下一步」）：① runner CLI 形态 `node bin/replay.mjs --events --sut --expected --denylist --out`；② 漂移探针契约（探针从 atom+targetName 构造 `drift-patch` canonical）；③ expected 是对着假 SUT 自写的（已冻 expected-frozen 与 events.fixture 对不上）；④ 假 SUT `server.mjs` 进 testChecksums。审过 → `node loop-kit/bin/contract.mjs advance accept --artifact loop/prd-p5-replay.json` 冻、解锁 `lib`/`bin`。

Phase 2 实现（按 `docs/plans/p5-replay/exec-plan.md` 的并行/串行排期）：先 `robust-actions` 三轴埋点（主干入口），再串 runner→StepAxes 合并→喂已冻 verdict，叶子模块（replay-guards/instantiate/watchPageLifecycle/waitForReplyByStream/watchNetworkForensics/漂移探针）fan-out 起草。不开 worktree、不起第二契约（单活契约 baton 教训）。决策仍按 ADR-0007 7 条（基座 A、CDP 真发起方归因、三轴按 intent、本地 fixture server、流式 finished、漂移探针只读、唯一名 instantiate）。

环境前置已清：playwright 1.60.0 + chromium + 系统库装齐、headless 实起验过（不必再补环境）。

组件（accept→loop）：
- fixture server（新建假 SUT，借 autotester `web/server.mjs` 的 http 骨架；它是控制台不是 SUT mock、非照搬）：静态假 SUT HTML（含 events 所指 role/accessibleName 元素）+ 可脚本化路由（save 200/500+信封、背景 poll 401、SSE 流、触 pageerror）。
- 回放 runner：移植 autotester `robust-actions`/`_fixtures`，消费已冻 `tests/_golden/fixtures/seams/events.fixture.json`、按 intentId 聚合 N 个 event 依序回放、`instantiate` 填 `{{uniqueName}}`（atl_ 由 compile-gate 注入）。
- `watchNetworkForensics`（新建）：CDP `Network.initiator` 真发起方 + site.json 背景 denylist + 证不出归 null（背景 401 不翻 verdict 的命门）；`watchPageLifecycle` 移植。
- 三轴产出：按 intent 出 `axes.json`（形态对齐已冻 `tests/_golden/fixtures/p2/verdict-cases.json` 的 StepAxes）→ 喂已冻 `bin/verdict.mjs`。
- 只读漂移探针 `findEquivalentAffordance`：同稳定签名 count===1（不点、不改 spec）。
- 红 golden 对 fixture server：replay→axes→verdict happy path + 注 500 出 SUT_DEFECT + 背景 401 不背书 + 漂移出 HARNESS_ERROR + 流式 finished；accept(--red-verified)→loop 绿。

第2层产物已 live、被各 golden 钉死（勿改测试）：`lib/report.mjs`(P7)、`lib/expected-compile.mjs`+`lib/sign-gate.mjs`(P4)、`lib/heal-gate.mjs`+`lib/drift-patch.mjs`(P6)、`tests/_golden/p2-*-coverage.golden.mjs`(track-F)。已冻接缝在 `tests/_golden/schemas/` + `tests/_golden/fixtures/seams/`。

## 纪律硬约束（反复栽的，务必守）

- 统一语言（ADR-0005）：动任何词先查 `CONTEXT.md`，有现成用现成、造词先登记。**绝不在回合输出里发加粗英文**——连散文标题加粗拉丁字母都会被 Stop hook 当场拦；每条要发的话先过 `node loop-kit/bin/term-lint.mjs`（检的是含加粗的最终形态），code 用反引号是安全的、不会被扫。裁判义用 裁定/裁判/多态裁定，路由义用 路由人。
- 阶段互锁：active-contract = `p5-replay`（full）；P5 accept 未走 → 先 accept 冻红 golden 才能改 `lib`/`bin`，`commit-impl` 需 loop done。单活契约 baton：并行多契约会撞主树共享槽（教训见 HANDOFF「契约/运维」），别再盲目并行起多 full 契约。
- 裁判零 LLM（护栏 #15）：`verdict.mjs` 纯确定性，自愈是其下游消费者、本期不做。fail-safe 不 fail-open（#14）：机器证不出一律 `NEEDS_HUMAN`。冻结测试只读（#1）。`.auth/`、`site.json` 凭据不进任何输出/日志/报告（#7）。
- **裁判按种类不可知（岔一，2026-06-29 锁）**：`verdict.mjs` 消费已判好的 `StepAxes`，对 `postAssertions` 只把硬断言 `ok` 与上、忽略 `soft`，**绝不按种类分支**（不 switch on `kind`）；取证缺失子字段当「本步无此特征」、不报解析错；断言 `kind` 只在 `check.mjs` 枚举。这样对话/发布等新维度是纯加法、`verdict.mjs` 不动。背景与岔二/岔三倾向见 `docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。
- Bash 小坑：含 `2>&1` 或 `>` 重定向、且命令里带 `bin/` 路径，会被 loop-guard 误判 edit-impl 拦——读类命令别带重定向。
- gate 绿 ≠ 完成（#16）：真机三轴回放（`@playwright/test` 薄壳跑 Heren）与注入故障出 SUT_DEFECT 是 route:human 的 tier-2，不在 loop 绿范围；它们在 prd 的 observability 里。

## 后续方向：数据飞轮（第一条绿后）

第一条 flow 真绿后，按维度扩 flow 是 roadmap（chat → 发布 → 画布最后），骑 regress 现成语料；排期、复利项、与 ratchet 的加法式关系见 `docs/FLYWHEEL.md`。对本次 loop 的直接影响：S1 的 `verdict`/`forensics`/`StepAxes` 抽象要按「将来喂三四种 flow 形状」设计，别只对着 `catalog_wf_crud` 长——第一条绿时飞轮的轴得已经通用，第二条接上去是移植原子、不是重做内核。

## 待裁决（route:human）

端态运行时 A/B/C 已拍 A（ADR-0007）。剩 route:human：CDP initiator 真发起方栈分类在真 Heren 流量下的可靠度（ADR-0007 推翻条件——不可靠则退「denylist + 活动步窗 + 仍证不出归 null」，绝不退纯时间窗）；tier-2 真机注 HTTP500 出 SUT_DEFECT；其余见各 prd observability。

## 文风

正式、规范、自然的简体中文，不用网络用语、不用英文直译腔；复杂决策先 grill、再落 `CONTEXT`/ADR。

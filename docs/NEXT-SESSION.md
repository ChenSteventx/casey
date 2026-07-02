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
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-03 重签提硬收官）
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
- 里程碑时间线（git log，越往下越新）：接缝两层冻结 + 四轨 hermetic → P5 回放内核 → term-guard/model-lane-guard 机制上线 →
  layer3-wiring 集成骨架 → p3-compile 编译命令化六阶段 → P3 tier-2 真机收官（六项 route:human 全清，含三跑真编译四件套 + 回放核验二轮）
  → 相2 首航（首份人签断言契约 + noerrenv-absence 修评估器夹具债，真机 4/4 PASS 全链贯通）→ 相6 真机报告（run-login-passthrough
  + report-fidelity 三修）→ P4 草拟器（p4-drafter 纯函数层 + G-seam 双 enum 对齐 + draft-cli 命令化）→ kinds-harden 提硬
  （IMPLEMENTED_KINDS 5→7）→ 重签提硬收官：7 条全硬断言真机 4/4 PASS 零 soft（f587e99，D2 生命周期端到端走完）。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile（唯一一次真机跑，落 events + 观测现状）→ 相2 草拟+冻结+人签（casey draft 已命令化）
  → 相3 回放 replay（零 LLM，--login-bootstrap 过登录墙 + 代表步静默点采集）→ 相4 裁定 verdict（零 LLM 判定树四态）
  → 相5 自愈 self-heal（仅确证 HARNESS_ERROR，旁车补丁人签 apply；尚未吃过真 HARNESS_ERROR）→ 相6 报告 report（零 LLM 自包含 HTML/MD/json）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中或点击后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 网络取证按发起方归因：按 initiator/attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 只读漂移探针：无 spec 变更无重跑，只读探「同稳定签名唯一元素是否仍在」供 verdict 判 HARNESS_ERROR。
  · 通道剖面 profile：channel 回放所需非凭据配置（背景 denylist + 信封成功字段 + routes.workflowList）；与 site.json 凭据分离。
  · 通道驱动 channelDriver：端口适配器能力声明接缝，actionSpace ⊆ 已冻 events.schema 枚举。
  · 登录预备动作：回放/编译开始前把浏览器带到已登录态；不产 event、不进 axes、凭据只进内存（replay/compile/run 均 --login-bootstrap）。
  · 错误信封：按响应 body 成功字段判的软失败（Heren 实测 body.status===200）；noErrorEnvelope 为缺席语义（本步归因无坏信封即过）。
  · 静默点：动作后等 UI 稳定的确定性条件，替代固定睡眠；回放代表步在此刻采 toast 快照与文本命中计数。
  · 观测现状：编译期落盘地面真值（实测 URL/标题/toast/请求日志），存 observed-<caseId>.json。
  · 冻结断言契约：人签后逐条盖 signedAt/signedAgainstBuild/signerId 的 expected.frozen.json；改即触棘轮、重签走新 signedAt。
  · TestCase 聚合根：excel/json/txt/自由文本归一后唯一内部用例对象（含 uniquePrefix）。
  · 断言词汇表：kind 枚举唯一活在 bin/check.mjs（15 种）；expected-frozen schema 双 enum 已对齐（G-seam，Steven 追认）。
  · 已实现 kind 集 IMPLEMENTED_KINDS：replay-assert 导出的唯一供源，现 7 种；草拟器据此定 soft（D2：未实现冻 soft、补实现重签提硬）。
  · 回放历史/失败记录台账/失败指纹/人裁决回填：诊断侧只读接缝（已冻 schema），绝不进 verdict、绝不写 passes；真产出未接线。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict / 熔断器 / 报告渲染 / 凭据兜底门）；L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁。
- 入口分流三档：direct=地板全放行；light=加 plan 门；full=全链（碰冻结内核必走）。accept 任何车道都不跳、红先行必核。
- passes 只 gate 写：prd 的 passes 仅 loop-kit/bin/gate.mjs 有权写；testChecksums 冻结文件对实现者只读，改冻结 golden 须契约更新补冻且人过目。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫；加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成（需人签真机）/ #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 入参畸形 fail-closed：verdict 缺 --axes/--out → exit 64；坏数据/steps 非数组 → exit 65。
- 回放看门狗 75s 强退；--login-bootstrap 前置加载/登录失败 exit 65 不落 axes、登录期流量归 null。
- 断言评估：未实现 kind / 缺采集一律 ok:false + actual:null（证不出绝不判真）；行计数失败回 null 不回 0。
- check.mjs 词表硬闸：词表外 kind / 越界 op exit 2（LLM 不准发明自由断言）。
- 取证按发起方归因：只认 attributedStepId===本步的信号；stepId==null 不背书。
- gate 默认 FAIL 凭证据翻绿；熔断器越阈写 loop/inbox.md 后 exit 2。
- 凭据兜底门：所有落盘口过 lib/cred-gate.mjs，命中敏感词/凭据字面量拒写；报错通道同罪（loadCreds/loadSiteConfig 报错消毒不回显内容）。
- 草拟准入闸 validateDraft：kind/op 经 check.mjs 复核零副本表、易变字面量盖全 op、D2 soft 语义两向钉死、闸自身 total 不抛。

【排期】
- P0/P1 完成；P2 完成（仅 learn 待）；P3 收官（hermetic 六阶段 + tier-2 真机六项 route:human 全清）；
  P4 两半块全落（p4-freeze 冻结人签骨架 + p4-drafter 草拟器 + draft-cli 命令化，相2 真机端到端走通）；
  P5 六阶段 done（回放内核已随 P3/P4 真机多轮实跑全绿，其 prd 的 tier-2 route:human 标注未正式核销）；
  P6 hermetic done（相5 未吃过真 HARNESS_ERROR）；P7 done + 保真度三修；P8 未开始；P9 tier-1 绿、tier-2 已随真机实跑部分兑现。
- 真机端到端已贯通三圈全绿：文本用例 → 编译 → casey draft 草拟 → 人签冻结 → casey run（回放+裁定+装配+报告）。
- 单 baton 上限：loop-kit 单活契约；并行只用在零 baton fan-out（研究/grill/schema/golden 起草/异构评审）。碰 lib/bin 落地走 worktree + git-native 合并。

【当前契约 / 状态】
- 活契约槽 = kinds-harden（light）六阶段全 done——baton 空闲，下一契约直接 contract init。工作树净，最新提交 f587e99。
- 本 session（2026-07-02 夜至 07-03）收口六契约 + 三次人签：p4-drafter（full，codex 四轮）/ noerrenv-absence / run-login-passthrough（direct）/
  report-fidelity（codex 三轮，两 High：混签投影+跨源拼合）/ draft-cli（codex 两轮 + 修正采纳先例）/ kinds-harden（一轮零发现）。
  Steven 人签：相2 首航 7 条断言 → G-seam 追认 → noErrorToast 词表判 → 重签提硬（7 条全硬真机 4/4 PASS 零 soft）。
- cases/tc_catalog_wf_crud/（gitignored）：testcase/profile/events/observed/compile-report/expected.frozen（全硬已签）/expected.draft 齐备；
  runs/（gitignored）多轮真机报告，最新 run_1783008079114 全硬全绿。
- 最新工程纪律（别漏）：模型分层机制强制（I1 verdict 零 LLM 闭包 + I2 config 异构不塌同族已上线，三级兜底 watcher 待建）；
  review 用 codex（gpt-5.5 非同族、空 cwd 喂 stdin、逐发现采信/证伪/修正采纳三种处置、PASS 记 audit）绝不同族自评；
  term-guard 甲 warn-only、乙待非 Claude 密钥；对 route:human 项人不在场只挂账绝不代签（缺席推定须记可否决+回滚路径交追认）。

【下一步（任选其一，先对齐再动手）】
A casey run 接 run-history.jsonl/run-metrics.json 真产出（light）：已冻接缝的天然生产者是编排器，纯加法接线。
B 第二条用例移植 chiefcomplaint_smoke（飞轮第二条，route:human 需人在场拉隧道+人签）：首次全程吃现成命令面
  ingest→compile→draft→人签→run，对流水线泛化性的第一次真考。
C compile.mjs caseId 形状同修（direct 小契约）：draft-cli 评审挖出的同型缝（caseId 拼文件名未验形状）。
D 其余：余 8 kind 按需加法（护栏 #17）/ 错误 toast 结构类名采样（撞真机错误弹窗顺手采）/ p2-intent-compile learn /
  term-guard 乙接线 / 相5 自愈真机首触（需真 HARNESS_ERROR 场景）。

【环境坑（WSL）】
- 反向隧道（真机访问必用）启动顺序敏感：先 WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），
  后 Windows 侧双击 scripts/win-forward-start.cmd；Windows 先起会留僵尸连接占池不补，重启 Windows 代理即愈。
  WSL 内基址 http://127.0.0.1:15519（= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出。
  真机命令一律 WSL 侧跑（G6 人签：Windows 上 127.0.0.1:15519 非设计路径、playwright 是 Linux 版）。
- WSL 中文字体：已装用户级 Noto Sans CJK；截图/录屏中文空白先 fc-list :lang=zh 查。
- 9p 崩溃：/mnt/d 全局 EIO 时资源管理器戳一下 D: 唤醒，或 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d。
- git index.lock 卡挂：先 pgrep -a git 杀挂死进程、再删 .git/index.lock。
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

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
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-02 收口）
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源）、docs/design/（端到端设计）；
   docs/decisions/ 目录不存在，loop 纪律钩子引的坏引用真身是 docs/adr/0001-reuse-loop-kit.md。
   环境坑参考本文件文末（WSL / loop-guard 误判 / 反向隧道）。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎原样拷入同仓归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与多态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN。
- ADR-0003 编译再回放 + 非就地有界自愈：LLM 只编译期读一次用例、日常回放零 LLM；禁纯坐标步；自愈写旁车补丁、人签后应用。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从类型词汇表选、易变值模板化；草拟→冻结（仅断言文件）→人签；人签是 CASE_DEFECT 与 SUT_DEFECT 分水岭。
- ADR-0005 统一语言强制：四列制术语表唯一白/黑名单源，术语必加粗（中文）或反引号；Stop + PostToolUse 双 hook；造词先登记；中文禁繁体。
- ADR-0006 Casey = autotester 与 regress 分层融合：L0–L4 分层增量去重（P3 据此降级「陌生站点孵化」支线、第一条骑 regress 现成 flow）。
- ADR-0007 P5 回放运行时基座 + 取证归因：基座采纳 @playwright/test；取证按 CDP 真发起方归因 + 背景 denylist；证不出归 null 永不背书。
- 里程碑时间线（git log，越往下越新）：第 1 层 5 接缝冻结 → 第 2 层四轨（P4/P5/P6/P7）hermetic 全绿合并 dev → P5 回放内核收口 → term-guard / model-lane-guard 兜底契约 → seams-freeze-v2 四接缝冻结（f41e527）→ layer3-wiring 第 3 层 hermetic 骨架（a7ab5e9）+ review 收口（b4985d9）→ 本 session（2026-07-02）：seams-freeze-v2 review 十二轮 codex 至 PASS + learn 六阶段收口（827cebc + 7c52114）、P3 备料三草稿 + WSL 反向隧道 + site.json/.auth 凭据就位（a06c29c）。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile（唯一一次真机跑，落 events.json + observed 观测现状）→ 相2 冻结+人签 sign
  → 相3 回放 replay（零 LLM，重放 + 录屏 + CDP 取证 → axes.json 三轴）→ 相4 裁定 verdict（零 LLM 判定树出四态 → verdict.json）
  → 相5 自愈 self-heal（仅确证 HARNESS_ERROR 写旁车补丁、人签后 apply）→ 相6 报告 report（零 LLM，报表模型装配 → 自包含 HTML/MD/json + 凭据兜底门）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中或点击后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 网络取证按发起方归因：按 initiator / attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 只读漂移探针：无 spec 变更无重跑，只读探「同稳定签名唯一元素是否仍在」供 verdict 判 HARNESS_ERROR；与自愈写回严格分离。
  · 通道剖面 profile：某 channel 回放所需非凭据配置（背景 denylist + 错误信封成功字段），与 site.json 凭据分离。
  · 通道驱动 channelDriver：端口适配器式能力声明接缝，actionSpace ⊆ 已冻 events.schema 枚举 + profileRef 指针，与通道剖面正交。
  · 动作词汇表：已冻 events.schema action 枚举的治理投影层，与断言词汇表对称。
  · 回放历史 run-history / 失败记录台账 failure ledger / 失败指纹 fingerprint / 人裁决回填 humanResolution：回放证据与只读诊断台账，绝不进 verdict.mjs、绝不作自愈输入。
  · 错误信封：按响应 body 成功字段判的软失败（HTTP 200 但 body 表失败），成功字段按 channel 参数化（Heren 实测 body.status===200）。
  · 静默点：动作后等 UI 稳定的确定性条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现。
  · 观测现状：编译期落盘地面真值（真实成功 URL/提示/回复/请求日志），存 observed-<caseId>.json。
  · 冻结断言契约：人签后写 loop/prd-<caseId>.json 并 checksum 冻结的断言，实现者只读、改即触棘轮。
  · 报表模型 report-model：verdict ⋈ 三轴 ⋈ 观测现状 ⋈ 冻结契约的只读报告数据源，缺陷单仅 SUT_DEFECT。
  · TestCase 聚合根：excel/json/txt/自由文本归一后唯一内部用例对象。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门）；L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。
- 入口分流三档：direct=地板全放行；light=加 plan 门（edit-impl 需 plan）；full=全链（edit-impl 需 accept、push 需 review），碰或改冻结内核必走。accept 任何车道都不跳。
- passes 只 gate 写：prd 的 passes 仅 loop-kit/bin/gate.mjs 有权写（默认 FAIL 凭 Test Ratchet checksum + term-lint + 逐 story acceptance 翻绿）；testChecksums 冻结文件对实现者只读。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫，弃用别名/繁体/未登记加粗英文拦红。加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成（需人签真机）/ #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，畸形步同样，绝不静默 PASS。
- 入参畸形 fail-closed：verdict 缺 --axes/--out → exit 64；坏数据/steps 非数组 → exit 65。
- 点击身份门：action 缺失/畸形→false；fallback_first/coord_fallback→ambiguous→NEEDS_HUMAN(AMBIGUOUS_ACTION)。
- 取证按发起方归因：只认 attributedStepId===本步的 5xx/信封/pageerror/crash；stepId==null 不背书。
- 自愈门 driftHolds：须 resolution==='none' 正向 miss + driftProbe.sameSignatureUniquePresent===true，缺证据落 INDETERMINATE。
- 回放看门狗 replay.mjs 75s 超时强退；归因不到本步投 null；行计数抛错回 null 不回 0（防 countChange===0 假绿）。
- 熔断器 breaker.mjs 越阈 appendFile 到 loop/inbox.md 后 exit 2；凭据兜底门 report.mjs 落盘前深扫敏感词+比对 site.json 字面量，命中 exit 1 拒写。
- casey run 编排器退出码归一：各阶段非零 fail-closed、不吞错。

【排期】
- P0 引导 + P1 DDD 词表/ADR 已完成；P2 规范 TestCase+归一 loop+review 完成、仅 learn 待；
  P3 编译期产真输入（full）★关键路径头——备料已齐（docs/plans/p3-compile/proposed/ 三草稿：重表达清单 7 步→4 intent/15 event、观测现状采集计划、grill 决策草稿 G1–G7 留人签），凭据/连通/site.json 全就位，随时可 init 开工；
  P4 断言草拟+冻结+人签 loop 完成；P5 回放+取证+verdict+漂移探针 六阶段全收口，tier-2 真机 route:human 未走；
  P6 自愈准入门+非就地自愈 loop 完成 + superseded 补冻；P7 报告+徽章+缺陷单 loop 完成 + credentialGate 补冻；
  P8 多目标未开始；P9 两层 selftest：tier-1 hermetic 无回归绿，tier-2 live + 真机 UAT 未走。
- 接缝冻结：第 1 层 5 接缝 done；第 2 层四接缝 v2（seams-freeze-v2）六阶段全收口 done（codex 十二轮对抗复评至 PASS、learn 沉淀 docs/plans/seams-freeze-v2/learn.md）。
- 第 3 层集成：hermetic wiring 骨架（layer3-wiring）六阶段全收口 done——casey run 编排 replay→verdict→装配→report，假 SUT 端到端绿；真数据端到端 = P3 之后的直接下一步。
- 单 baton 上限：loop-kit 单活契约（主树共享 loop/active-contract.json 一槽），多 full 契约无法真并行；并行只用在零 baton fan-out（研究/grill 起草/schema 起草/异构评审）。碰 lib/bin 落地走 worktree 隔离 + git-native 合并，绝不 cp 进 lib/bin。

【当前契约 / 状态】
- 活契约槽 = seams-freeze-v2，六阶段全 done（review = codex 十二轮 PASS 记 loop/audit.jsonl，learn 已落）——baton 空闲，下一契约直接 contract init。
- 契约一览：layer3-wiring / seams-freeze-v2 / p5-replay / term-guard / model-lane-guard / hermetic-gap-freeze / p4-freeze / p6-selfheal / p7-report / seams-freeze 全收口或 loop done；p2-intent-compile 仅 learn 待。
- 工作树干净（进场先 git status 核当下）。本仓无 git 远端。
- 真机现场已备（凭据内容不进任何输出/日志/提交）：.auth/ 凭据 + site.json（gitignored，含 target.startUrl 与 devProxyUrl、登录选择器、信封判据）已就位；WSL 直连站点不通、走反向隧道（见环境坑）；登录页经隧道亲验 HTTP 200；UAT 不能真造 500（用户确认），SUT_DEFECT 场景走回放侧代理拦截注入。
- 最新工程纪律（别漏）：
  · 模型分层（model-lane-guard 机制强制）：主环 Opus 4.8 ultracode 承 full 与冻结内核；轻车道派 Sonnet 5 独立 subagent（max effort）；三级兜底梯（Sonnet 卡→Opus 4.8 xhigh→NEEDS_HUMAN 写 inbox）；I1 verdict 零 LLM 依赖闭包 + I2 config 异构不塌同族已上线；三级梯 watcher 仍待建。
  · review 用 codex（固定纪律）：契约 review 用 codex（~/.local/bin/codex，gpt-5.5 非同族），空 cwd + 自包含料喂 stdin + codex exec -s read-only --skip-git-repo-check -m gpt-5.5 + 明令不跑 shell（护栏 #9）。判 FAIL 逐条核实采信去修+钉红 golden（红方向须亲验）、评审者建议违反领域规则时修正采纳并 audit 留案（例：seams-v2 R9-F1）；判 PASS 记 loop/audit.jsonl 再 advance review。绝不同族自评。
  · term-guard：甲 Stop 钩子当前 warn-only 只警告不拦、乙真非 Claude 评分员接线待密钥——别误判硬拦全开；回合输出加粗只给纯中文（含 ASCII 字母即违例）。

【下一步（任选其一，先对齐再动手）】
A P3 真机 bring-up（首推，料全齐）：contract init p3-compile --lane full → grill（吃 docs/plans/p3-compile/proposed/grill-draft.md 的 G1–G7、人签）→ plan → accept → loop：骑 regress catalog_wf_crud 重表达产真 events.json + 观测现状（基址用 site.json 的 devProxyUrl、先拉起反向隧道）→ 灌 casey run 管线（已通）→ 相2 断言草拟+冻结+人签 → tier-2 真站 UAT（验四态 + CDP initiator 真发起方归因可靠度 = ADR-0007 推翻条件；500 场景走回放侧代理拦截注入）。
B casey run 编排器接 run-history.jsonl / run-metrics.json 真产出（light 车道）——刚冻的接缝、编排器是天然生产者；可与 A 的 grill 等待期并行。
C p2-intent-compile 的 learn（旧沉淀尾，轻）。
D term-guard 乙真接线（待非 Claude 密钥）/ push 远端（待定 GitHub 目标仓）。

【环境坑（WSL）】
- 反向隧道（真机访问必用）：WSL 直连站点不通（Windows 防火墙拦正向入站，亲验）。用法——WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），Windows 侧双击 scripts/win-forward-start.cmd（或 node scripts/win-reverse-agent.mjs）；WSL 内基址 http://127.0.0.1:15519（= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出。
- 9p 崩溃：/mnt/d（drvfs 9p 挂载）会全局 EIO 崩溃：所有仓库读写失败但 /tmp 正常。恢复：Windows 资源管理器戳一下 D: 唤醒，或 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d（别 wsl --shutdown）。原子写保护（写 .tmp 再改名）。
- git index.lock 卡挂：9p 下只读 git diff 进程可能挂死留 0 字节锁。先 pgrep -a git 杀挂死进程、再删 .git/index.lock。
- loop-guard 误判（比想象宽）：命令含 prd 文件路径 → 判 write-prd；含 node -e 内联 / cp / rm → 判 edit-impl；读类/git 命令带重定向或管道（>、2>&1、|）+ bin/ 或 loop-kit/bin 路径 → 判 edit-impl。对策：查文件用 Read 工具或 scratchpad 脚本、别在命令行带 prd 路径与重定向管道。tests/ 与 scripts/ 路径不被判 edit-impl。
- 授权提交/切 baton：full 契约 pre-loop 拦 commit-impl。要提交先 init 一个 direct 契约授权，提完 re-init 原契约恢复 baton；light 契约 plan 后 commit-impl 即放行、无 lib/bin 的提交任何时候放行；post-loop 的 full 契约提交放行。
- 行尾/checksum 整库 LF 一致（.gitattributes eol=lf + core.autocrlf=false）；查行尾用 node 数 0x0d，别用 grep -c $'\r'。
- 路径 D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版。别在 /mnt/d 混用 Windows 与 WSL git。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
契约 review 用 codex 异构评审、绝不同族自评。可并行的活优先 fan-out 零 baton 子代理；决策分岔用可点选项呈现、别散文长问。
```

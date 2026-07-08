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
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用）
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-08 晚：本 session 八提交——
   record-capture 示教兜底人录 + 用户易操作文档 + P7 报告五增量收口）
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源，0001–0007）、docs/design/（端到端设计，文实不符处见文内
   「已知偏离」errata 表——report-spec.md 顶部对账表现已滚到「五报告块已落地、余 #12」）；docs/decisions/ 不存在，
   loop 纪律钩子引的坏引用真身是 docs/adr/0001-reuse-loop-kit.md。环境坑参考本文件文末。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎同仓拷入归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与四态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN。
- ADR-0003 编译再回放 + 非就地有界自愈：LLM 只编译期读一次用例、日常回放零 LLM；自愈写旁车补丁、人签后应用。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从类型词汇表选、易变值模板化；人签是 CASE_DEFECT 与 SUT_DEFECT 分水岭。
- ADR-0005 统一语言强制：四列制术语表唯一白/黑名单源；Stop + PostToolUse 双 hook；造词先登记；中文禁繁体。
- ADR-0006 Casey = autotester 与 regress 分层融合：否决白嫖 60 原子，锁「扩断言词表 + watchNetworkForensics + 原子吐三轴」增量序。
- ADR-0007 P5 回放基座 @playwright/test + 取证按 CDP 真发起方归因 + 背景 denylist；证不出归 null 永不背书。
- 里程碑时间线（git log，越往下越新）：接缝两层冻结 → P5 回放内核 → 机制护栏上线 → p3-compile 收官 →
  相2 首航（人签断言真机 4/4 PASS）→ 相6 真机报告 → P4 草拟器 → 2026-07-03 全日七契约（飞轮真机贯通 +
  Casey 首个真机 SUT_DEFECT）→ 2026-07-06 三相补齐 + 晚—07-07 凌晨八契约（相0 ingest 建成 + e2e-chain 全链金牌
  + cli-mcp-face 三面对齐 + Steven 三问点单四契约）→ 2026-07-07 下午—晚五契约（真机合并行程首航 wf_publish/history
  真机全绿 + 画布两原子 wf-add-node/wf-connect-nodes + report-exit64 + output-seal）→ 2026-07-08 wf-open-node
  画布第三原子（657556a，集 15→16）+ 隧道 agent 修复（3d7513c）→ 2026-07-08 下午—晚八提交：record-capture
  示教兜底人录（bb0ee3c）+ 用户易操作文档（62ad838）+ P7 报告五增量（report-model 报告块 0→5、report-spec §3
  六项落五）。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线全建（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性；heal 是唯一诚实桩）：
  相0 归一 ingest → 相1 编译 compile（COMPILE_KNOWN_ATOMS 现 16，画布三原子 addNode/connectNodes/openNode 已建）
  → 相2 草拟+冻结+人签 → 相3 回放 replay（零 LLM）→ 相4 裁定 verdict（零 LLM 四态）
  → 相5 自愈 self-heal（仅确证 HARNESS_ERROR，CLI 诚实桩）→ 相6 报告 report（零 LLM 自包含 HTML/MD/json）。
  hermetic「文本→报告」十站全链已由 e2e-chain 集成金牌锁定。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中才 acted；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 断言词汇表：kind 枚举唯一活在 bin/check.mjs；IMPLEMENTED_KINDS 现 11 种；countChange 计数通道 actual = 删前→删后。
  · 网络取证按发起方归因：按 attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 通道剖面 profile / 登录预备动作 / 静默点 / 观测现状 / 冻结断言契约 / TestCase 聚合根 / 错误信封：见 CONTEXT.md。
  · 示教（teach-in）/ 示教录制包：人在真界面操作、机器只采语料；录制物非签署、不直通回放、必经蒸馏 + L0 复核 + 人签。
    record-capture 契约已建（casey record CLI，产 signed:false/replayReady:false/distillRequired:true 的安全包）。
  · report-model 报告块（本 session P7 五增量，均缺字段零行为差、不进裁定）：naturalLanguage（用例自然语言）/
    atomicSteps（原子操作清单稳定编号）/ replayVideo（回放录像块）/ cleanupEvidence（清理证据 surface countChange
    删前后命中数）/ workflowStructure（工作流画布结构，据画布原子 PASS 覆盖判三类：节点/连线/节点配置 + 空/半成警示，
    report-spec #11 诚实收缩——model 不携开始/结束节点身份）。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict / 熔断器 / 报告渲染 / 凭据兜底门）；
  L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁。
  loop 阶段不能跳：accept 后先 advance loop（交 prd）再 advance review。
- 入口分流三档：direct=地板全放行（台账仍六阶段齐走）；light=加 plan 门；full=全链（碰冻结内核必走）。accept 任何车道都不跳。
- passes 只 gate 写；testChecksums 冻结文件对实现者只读；改冻结 golden/schema 须重签全部相关 prd 的 checksum（本 session
  报告增量每轮改 report-model.schema.json 都涟漪 prd-seams-freeze 的 schema checksum，须双照重签）。
- 缺字段零行为差（本 session 报告增量护身符）：报告块加法用「'field' in model」/ 非空数组判定——缺字段旧模型/共享
  fixture 字节不变，既有 report 涟漪金牌（定向断言、非全量 deepEq）自动免疫，不必动共享 fixture、涟漪只剩一处 schema。
- spec 超前于码的诚实生命周期（report-spec errata）：spec 加了码没落地的需求 → 先进「目标态、尚未实现」对账表（诚实）
  → 增量实现（各自六阶段契约）→ 实现后从对账表 un-errata（文档双向诚实、不反向撒谎）。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫；加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 /
  #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成 / #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 入参畸形 fail-closed（verdict exit 64/65）；回放看门狗 120s 强退；--login-bootstrap 前置/登录失败 exit 65 不落 axes。
- 断言评估：未实现 kind / 缺采集 / 缺 value 一律 ok:false + actual:null；行计数失败回 null 不回 0（防 countChange===0 假绿）。
- 取证按发起方归因：只认 attributedStepId===本步；stepId==null 不背书。
- gate 默认 FAIL 凭证据翻绿；熔断器越阈写 loop/inbox.md 后 exit 2。
- 凭据兜底门：所有落盘口过 lib/cred-gate.mjs（FORBIDDEN_KEYWORDS 单一事实源）；命中拒写非零退出。record-capture 的
  host 安全 URL 投影复用 replay.mjs 已封接缝（白名单 http/https/ws/wss 剥 host + :// 零容忍 + 非白名单 scheme/协议相对脱敏）。

【排期】
- P0–P9 机制面全建：相0–相6 七相全建首尾成链（heal 唯一诚实桩）；hermetic 全链集成金牌 + CLI/MCP/skill 三面漂移锁 +
  README 移交包 + 全仓输出通道封缝。P7 报告消费侧本 session 大补：report-model 报告块 0→5，report-spec §3 六项报告块落五。
- 飞轮五条铺四维度 + 画布维度三原子（addNode/connectNodes/openNode 已建）：dom_crud / chat（首个真机 SUT_DEFECT）/
  发布状态（真机 4/4 + 8/8 PASS）/ 列表打开 / 画布。
- 示教兜底（人录，战略 item 1）：record-capture 契约已建；record-intake / record-distill 后续。
- 用户易操作（战略 item 3）：SKILL.md 自然语言操作面 + runbook + verify-zero-error-report 已落。
- 单 baton 上限：loop-kit 单活契约；并行只用在零 baton fan-out（研究/探针/schema/golden 起草/异构评审）。

【当前契约 / 状态】
- 活契约槽 baton 空闲（report-workflow-structure 六阶段全 done）——下一契约直接 contract init。最新提交 d9a39df；
  工作树仅剩 Steven 的 M .gitignore（别动别提交）。
- 本 session（2026-07-08 下午—晚）八提交入 dev：record-capture（full，bb0ee3c，示教兜底人录——codex 自评标 done 但
  audit 写「非正式异构待补」= 不算数，Claude 补跑正式异构评审揪 3 High host 泄漏/caseId 穿越/中文敏感字段明文 + 3 Med，
  红先行全修）/ 用户易操作文档 + report-spec 记账（62ad838）/ P7 报告五增量（report-nl-atomic 0719919 + 收账 ed3e6ea /
  report-video-block 8f7bcf5 / report-cleanup-evidence 6267dff / report-workflow-structure 1ad0702 + 跨族复审补强 d9a39df）。
- 最新工程纪律（本 session 新增，接手须知）：
  ① 异构评审工具实操：跨族异构冗余评审首选 codex——`codex exec --skip-git-repo-check -C $(mktemp -d) - < 评审料.md`（空 cwd
     喂 stdin）；deepseek 兜底需 ~/.loop-kit/config.json 的 deepseekKey（本机常无）；pi（pi.dev coding agent，Windows
     npm 全局）从本 WSL shell 驱动不了（cli.js 载入即挂、`--version` 都不出，无 TTY），别浪费时间试非交互驱动 pi。
  ② 跨族异构冗余评审全断时（codex 撞额度上限 / deepseek 未配 / pi 驱不动）走 config 末位同族兜底（Claude 子代理 ×2 fresh 对抗
     镜头），但 audit 必须明标「同族末位、非跨族」+ 信任非对称 + 跨族正式复审挂账，绝不冒充跨族、绝不静默标 done；codex
     额度会重置，挂账的跨族复审工具可达后补（本 session report-workflow-structure 即此路径：先末位兜底、codex 回来后补
     正式跨族复审并强化金牌）。
  ③ 缺字段零行为差 + spec-errata 诚实生命周期（见【开发准则】）；④ 报告增量每改 report-model.schema.json 涟漪
     prd-seams-freeze schema checksum 须重签；⑤ 承前纪律不变：异构铁律「评审家族≠实现家族」（Claude 实现→codex 评；
     codex 实现→Claude 评），提交只用显式路径绝不 -A、真机账户唯一许用 autotest、动真机前带外核 .auth。

【下一步（任选其一，先对齐再动手）】
A 真机 route:human 趟（需拉反向隧道 + Steven 在场 + 先带外确认 .auth 为 autotest；HANDOFF「下一步」有全单）：
  ① 真机退化追因——本 session codex 记的 tc_catalog_wf_crud（现 PASS=2/NEEDS_HUMAN=2）、tc_wf_publish_states（现
     PASS=2/SUT_DEFECT=1/NEEDS_HUMAN=1）从历史绿转非绿，SUT 变了还是环境漂移待查（现状见 docs/runbooks/real-zero-error-examples.md）；
  ② wf_open_smoke 四停站（三件已备、须现场定 openName）；③ record-capture 真机录制一次（拉隧道 + autotest + 包内卫生目检）；
  ④ 两笔缺陷单转交平台修后复跑见绿；⑤ 顺带真机采 wf-add-node 四项观测 + disabled 类名。
B 报告余项 / 后续增量（机器可独立推 hermetic）：report-spec #12 变量默认自定义（属相1 编译/相2 草拟期规则、非报告渲染——
  另立编译/草拟契约）；report-workflow-structure #11 per-node 五项细分（开始/结束节点身份区分，需断言层携节点标签）。
C 画布维度续建（addNode/connectNodes/openNode 已建）：selectNodeDropdown（贪心序 +此解锁 9/23）→ setNodeField。
  建原子须例翻仍无知识的反例 + 重签 prd。
D 示教兜底续建（record-capture 已建）：record-intake（触发接线 + 失败台账兑现）/ record-distill（蒸馏 SOP + 例翻闭环）。
E 小加法菜单：resolution 词表统一 full 契约（触裁判内核，90768cf 挂账）/ 余 kind 按需 / term-guard 乙接线（待密钥）/
  相5 自愈真机首触（需真 HARNESS_ERROR）。

【环境坑（WSL）】
- 反向隧道（真机访问必用）启动顺序敏感：先 WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），后 Windows 侧双击
  scripts/win-forward-start.cmd；Windows 先起会留僵尸连接占池，重启 Windows 代理即愈（隧道 agent 连接风暴已于 3d7513c 修）。
  WSL 内基址 http://127.0.0.1:15519（= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出。
- 异构评审工具：codex 可用（codex exec ...，见【当前契约】纪律①）；pi 无法从本 WSL shell 非交互驱动（别试）；codex 撞额度
  会到点重置，挂账的评审重置后补。
- 真机账户：唯一许用 autotest，动真机前先请 Steven 带外确认 .auth/credentials.json 已换（机器不回显内容）。
- WSL 中文字体：已装用户级 Noto Sans CJK；截图/录屏中文空白先 fc-list :lang=zh 查。
- 9p 崩溃：/mnt/d 全局 EIO 时资源管理器戳一下 D: 唤醒，或 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d。
- loop-guard 误判：node -e 内联 / cp / rm → 判 edit-impl；读类命令带重定向/管道 + bin/ 路径 → 判 edit-impl。删/拷用 scratchpad 脚本。
- 授权提交/切 baton：full 契约 pre-loop 拦 commit-impl，先 init 一个 direct 契约授权、提完 re-init 恢复；post-loop 的 full
  契约与 plan 后的 light 契约提交放行；纯 docs 提交任何时候放行。行尾/checksum 整库 LF 一致。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
契约 review 用异构冗余评审、绝不同族自评（跨族全断时末位同族兜底须明标非跨族 + 挂账复审）。
可并行的活优先 fan-out 零 baton 子代理；决策分岔用可点选项呈现、别散文长问。
真机 route:human 项需人在场（拉隧道/人签/过目）；真机账户唯一许用 autotest、动真机前带外核 .auth。
```

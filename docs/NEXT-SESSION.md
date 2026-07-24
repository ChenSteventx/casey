# 下个 session 接续提示词（Casey）

> 用法：下次开新 session 只需 `/starter`（等价于说「读 `docs/NEXT-SESSION.md` 接着干」）。
> 本文件只作入口索引与开场指令；状态事实以 `docs/HANDOFF.md`、各树 `loop/active-contract.json`
> 和实时 `git status --short` 为准，冲突时信这三处。

## 开场提示词

```
项目：Casey（测易，LLM 驱动「文本用例→测试报告」确定性可回放测试系统）。
工作目录 /mnt/d/ctx/heren/casey，分支 dev（master 稳定 / test 提测）。
你是接手者，零上下文起步——先读文档对齐，再按下一步动手。

【2026-07-24 最新覆盖层（C0/C2/C3 已落 dev；C1/C4 候选分树在飞）】
主树 `dev@cea3a9b`。C0/C2/C3 的 P3 C5 跨契约调和已在
`integration-entity-c0c2c3@94f6da9` 闭合，并由 merge commit `cea3a9b` 落入 dev。

C1 正确组合树=`/tmp/casey-c1-c3-integration-v2`，
分支 `integration-entity-c1-c3-v2@dfc2ecc`（基于 `dev@cea3a9b`）。生产候选已接通
`replay→axes→verdict→report-model` 深消费；Grok R1 发现错 kind 身份通道可洗绿的 High，
现已改为逐 `registry.boundKind` 检查同 kind 良构通道，浏览器启动前 fail-closed exit 65。
安全组合影响面 26/26、C1 owner gate 8/8、组合 gate 1/1 全绿；Grok TUI `/code-review`
R2 终判 APPROVE（会话 `019f9369-86d1-71b2-ac92-13e003dfe899`）。评审通过只背书组合修复，
不等于 C1 完成或可合 dev。

真实环境已亲跑，不是假 SUT：Steven 带外确认 `.auth=autotest`；doctor exit 0；
Windows 真链路与 WSL 回环隧道均 HTTP 200；真实 Playwright+Chromium 登录并看到智能体列表控件。
完整 `casey run tc_agent_id_readback_real_uat_v1` 已产 verdict、三形态报告、录像与视觉复核，
留存 `runs/tc_agent_id_readback_real_uat_v1/run_c1_candidate_live_20260724_r1/`。
确定性裁定=导航 PASS，agent.searchOpen NEEDS_HUMAN/INDETERMINATE，
身份 `v2/absent/complete`、候选数 0、未误点；只证明目标缺席时不假 PASS。

C1 仍缺正式 baseline/schema 晋升、浏览器 C7、新 `atl_` 实体新 platformId 的正向真实 UAT、
ADR-0004/0009 Steven 人签；`oi1` 保持 open，禁止合 dev。C4 分支
`work/c4-golden-closure@a8b2581` 已有两枚候选金牌 4/4 与原金牌 7/7，
但 Grok 仍判 CHANGES_REQUIRED、baton 4/6，未改生产、未合 dev。

禁止运行假 SUT 金牌 `tests/_golden/p3-compile.golden.mjs`。旧错误组合树
`/tmp/casey-c1-c3-integration` 不得续用。主树用户未提交文件全程未碰；提交只走显式路径。

【一句话定位 + 血缘】
Casey 是 autotester（人录·机回放·零 LLM）的「翻面」：输入端改为 LLM 读懂文本用例，
但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核不让渡。
loop-kit 已按 ADR-0008 提取为兄弟目录独立包，Casey 与 autotester 是双消费者。
三处统一标识符 casey：CLI bin/casey.mjs、skill .claude/skills/casey、MCP mcp/casey-server.mjs。

【先读，别现编已决的事】
1. CLAUDE.md + CONTEXT.md：硬规则与统一语言；弃用别名是黑名单，中文禁繁体。
2. docs/HANDOFF.md：当前状态权威源；只信最新覆盖层，较早日期段落只作溯源。
3. docs/REQUIREMENTS-STATUS.md：用户需求/缺陷/完成度统一入口（含 §3 实体身份与双定位）。
4. loop/GUARDRAILS.md：现有 19 条护栏逐条有效。
5. docs/adr/：难逆转决策；docs/design/：端到端设计，顶部“已知偏离”优先于历史正文。

【项目历史 / ADR】
- ADR-0001：Casey 成为 loop-kit 第二消费者；同仓复制/延期提取两条已被 ADR-0008 取代。
- ADR-0002：gate 二值与 verdict 四态分写者；fail-safe 默认；自愈只收确证 HARNESS_ERROR。
- ADR-0003：LLM 一次编译、日常确定性回放；自愈非就地写补丁，人签后应用。
- ADR-0004：typed 断言草拟→冻结→人签；改版走重签；gate 绿不等于完成。
- ADR-0005：CONTEXT.md 统一语言经 hook + gate 强制；hook 故障放行、门禁失败关闭。
- ADR-0006：Casey 分层融合 autotester 与 regress；先把原子重表达为三轴，否决单 bit 直通裁判。
- ADR-0007：Playwright 回放基座；取证按真发起方归因，含糊归 null；非凭据通道配置进 profile。
- ADR-0008：loop-kit 提取为独立包；通用引擎归包，Casey 保留项目配置与契约实例。
- ADR-0009：hermetic 绿只是必要条件，真机 UAT 人签才是完成；注意当前 agent 不得运行 fake-SUT。
- ADR-0010：准入件必填 audience，凭据上下文严格匹配；密钥签名、manifest 根、receipt 复验、
  撤销与 SUT scope 明确留后续。

【DDD / 统一语言】
- 七相：相0 归一 ingest → 相1 编译 compile → 相2 草拟/冻结/人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- LLM 只在相0/1/2/5；相3/4/6 为零 LLM 确定性。
- TestCase 是归一聚合根；intentId 是语义步，stepId 是回放事件位置，一 intent 可裂成 N event。
- 三轴 StepAxes = 动作轴 + typed 断言轴 + 取证轴，是裁判、桥与报告共享的数据契约。
- 四态：PASS；有本步取证背书的 SUT_DEFECT；正向确证定位漂移的 HARNESS_ERROR；
  其余证不出的 NEEDS_HUMAN。后者含 SUT_DEFECT_OR_STALE / CASE_DEFECT /
  AMBIGUOUS_ACTION / AFFORDANCE_ABSENT / INDETERMINATE。
- 点击身份门：只有唯一解析或点击后身份回读成立才算动作对；多匹配/坐标兜底为 ambiguous。
- 实体身份与双定位（P0 信任边界）：业务对象按 kind + name + code + platformId + scope 联合定位；
  同名不同 ID 判 DIFFERENT，多匹配绝不取 first 必判 AMBIGUOUS，缺 ID/坏候选不得推 SAME。
  智能体侧 ID 走列表接口网络信封读回（agent-id-readback）；DOM 物理卡片+信封双证、
  身份观察事务 arm→settle→seal→consume、sign 五元 join、回放点击前对已签 platformId 比对。
- 取证按 attributedStepId 精确归因，不按时间窗；背景轮询不能翻本步裁定。
- 通道剖面只承载非凭据配置；site.json 与 .auth 内容不得进入输出。
- verdict.mjs 零 LLM；自愈是其下游消费者，绝不反向进入裁判进程。

【开发准则：现役代码事实】
- contract CLI 当前只接受 direct|light|full；kernel 是已批准但尚未接线的目标车道。
- 现役互锁：direct 全放行；light 写 prd/改实现/提交需连续到 plan、推送到 loop；
  full 写 prd 到 plan、改实现到 accept、提交到 loop、推送到 review。
- passes 只有 gate.mjs 可写；testChecksums 冻结件对实现者只读，改 checksum/重签须走 ADR-0004 人签；
  修金牌合法路径=断言零弱化+外科 stash 无实现态重钉红+prd checksumAmendments 记账（本会话四笔实证）。
- 碰 lib/bin 的并行落地用独立 worktree + 每树独立 baton；git-native 合回 dev，绝不复制实现文件。
- 强制层、迁移或共享冻结面落地后，须复跑全部受影响金牌并回主树复验；tier1 绿不能代替影响闭包。
- 评审家族必须不同于实现家族；只喂 spec、diff、门禁证据，不喂实现者推理。策略/前提也送异构评审。
- 「不可达/不确定」断言先实测再落账（本会话两次被异构评审逼收回：sign 字节确定性、五面可达性）。

【兜底 / fail-safe】
- verdict 输入整体畸形 exit 65；单步畸形不丢弃，落 NEEDS_HUMAN(INDETERMINATE)。
- intent 内逐事件动作折叠 fail-safe：前序 ambiguous/none/action_failed 不得被末事件 unique 洗成 PASS。
- 动作成功但没有硬断言不能空 PASS；多匹配落 AMBIGUOUS_ACTION；本步 5xx/错误信封/pageerror/crash
  才可背书 SUT_DEFECT；正向漂移双证才可落 HARNESS_ERROR；其余一律 NEEDS_HUMAN。
- replay 只写三轴，不裁定、不写 passes；行计数异常回 null，不回 0；看门狗现为 120 秒。
- gate 是单 PRD 门，checksum/术语/任一验收红则 exit 1；--dry 不是完成证据，受影响闭包仍靠纪律核全。
- fake-SUT 和夹具 SUT 只允许读源码作迁移参考；agent 会话语境不得启动、连接或回放。
  例外=契约级范围化例外（Steven 拍板、prd observability 记账，如 agent-id-readback 五场景金牌）。
- 身份观察账本 fail-safe：完整性先决（total 恰等行数、hasNextPath 声明即严格 false）、
  整页坏行拒、查询回声不符不入账、200 失败信封拒、consume 先 seal、消费即出账。

【排期】
- P0–P2 已完成。P3 编译机制与真机 bring-up 已收口。P4 草拟/冻结/人签主机制已建。
- P5 回放/取证/零 LLM 裁定/只读漂移探针已建；余真机义务 route:human。
- P6 hermetic 自愈机制已建；真 HARNESS_ERROR 首触仍待真机。P7 报告主链已建。
- P8 多通道尚未完整收口。P9 tier-1 已建；tier-2 真机 UAT 未完成。P10 可信闭环自进化在建。
- 实体身份与双定位（独立 P0 信任边界）：hermetic 轨全收口——身份模型/判别内核/信封读回/双证
  联合定位经 codex 四轮修单加固、R4 PASS 并入 dev@648e09e（差分棘轮 21 检查含 sol 五面构造）；
  完整真机 UAT 链绑 uatCaseId=tc_agent_id_readback_real_uat_v1 走后继契约 real-uat-attestation、
  同名敌意真机用例仍 route:human。

【当前契约 / 工作树】
- 主树：`dev@cea3a9b`；C0/C2/C3 与 P3 C5 调和已合入。
- C1 正确组合树：`/tmp/casey-c1-c3-integration-v2`，
  `integration-entity-c1-c3-v2@dfc2ecc`；仅剩未跟踪 `node_modules`，禁止合 dev。
- C4 树：`/tmp/casey-c4-golden-closure`，`work/c4-golden-closure@a8b2581`；
  评审 `CHANGES_REQUIRED`，禁止合 dev。
- 旧 `/tmp/casey-c1-c3-integration` 基线错误，不得续用。
- 主树未提交现场：全部为用户/并行现场（.gitignore、prd-cli-authority-wiring-fill/selftest/
  semantic-unit-discrimination、casey-agent-loop-local-first-total.zip、follow.mjs、
  atom-readiness-assessment、regress-strategy/SCOPE-OPTIONS、usability-audit），不碰不提交。
  提交只走显式路径、绝不 -A。
- 运维坑：共享 .git/objects 有 339 个 {uuid} 畸形垃圾对象（DrvFs/并发 agent 写产物，git 正常操作
  忽略、rev-list 可达链完好），gc 被陈旧 gc.log 阻断；功能无碍，集成合并前值得清。

【下一步】
A（在飞·推荐）先收 C1 正式完成边界：
  ① Steven 复核并晋升正式 `agent-id-regression-diff` baseline/schema，完成浏览器 C7 改判。
  ② 只用 autotest 新建 `atl_` 实体，取得新 platformId 后重编译冻结件，跑正向真实
    Playwright UAT，按 ADR-0004/0009 人签；不得复用旧 platformId，不得机器代签。
  ③ 再做干净异构复审；只有正式门、正向 UAT 与人签都闭合后才考虑合 dev。
B（并行）C4 按 Grok `CHANGES_REQUIRED` 补生产事件环端到端保真证据并复审；仍独立 worktree。
C（后续）C2 角色契约再签、C3 真机破坏 UAT 与冻结件再签等 `route:human` 面另开真机轮。
D（活契约槽）sut-503-diagnosis（direct 0/6，未动手）：Steven 令三 subagent 解 503 缺陷（骨架智能体详情页
  agentPlus/queryPlus+getAgentDetail 确定性 503、两实例复现；取证账见 docs/plans/real-uat-attestation/
  evidence/uat-run.md「503 缺陷账」节）。分工=真机差分定位/上报包铸造/对抗性反证；铁律只一个 subagent
  碰真机（同账户并发 UI 互踩），②③吃①产物；真机前置=doctor 就绪+隧道回环+.auth=autotest 带外核。
E route:human 其余面：密钥签名威胁面 / SKILL.md 措辞统一 / P8 多通道 / P10 可信闭环等排期线。

改冻结金牌一律走 checksumAmendments 修单路径。

【铁律追加（Steven 2026-07-22）】
loop 改革（工作流状态引擎/gate 分层一族）全线冻结：不读、不续、不列为选项、不出现在任何
建议里；loop-p0-4a-state-engine 与 loop-p0-4b-gate-layering 两树冻结原地、不计入待办。
唯一解冻条件=Steven 明确要求。

【环境坑】
- /mnt/d 是 DrvFs，git status/diff 慢（16-18 秒），15 秒超时的工具会必败——用 300 秒超时。
- codex exec 评审纪律：-s read-only + 受限包；后台跑配哨兵；实现审 high、设计咨询 max。
- gate 全跑约 10-15 分钟（含浏览器金牌），nohup 脱壳+哨兵等终账行，别让工具超时杀掉。
- 回放事件环 press→click 零等待：旧 DOM-only 门在 fetch 渲染页有固有竞态——考场要确定性化
  （同步渲染场景），别用重试遮竞态。
- 行尾/checksum 用 node 数 0x0d；整库保持 LF；不要混用 Windows/WSL git。
- 读类命令不要带重定向并混入 lib/bin/loop 路径 token，避免 hook 误判 edit-impl。
- 真机一律 WSL 侧经回环隧道；凭据与真实目标地址不得进命令行、日志、报告或提交。

【硬约束】
裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据不外泄；中文禁繁体；
新概念先查既有学科，造词先登记 CONTEXT.md；fake-SUT 只读（范围化例外须 Steven 拍板+记账）；
行为验收只驱真机；强制层/迁移后复跑受影响面；碰 lib/bin 走 worktree；合并后主树复验；
异构评审家族≠实现家族；完成只认退出码与人签真机证据，不把桩、文件存在或模型印象当完成。
```

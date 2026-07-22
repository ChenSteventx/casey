# 下个 session 接续提示词（Casey）

> 用法：下次开新 session 只需 `/starter`（等价于说「读 `docs/NEXT-SESSION.md` 接着干」）。
> 本文件只作入口索引与开场指令；状态事实以 `docs/HANDOFF.md`、各树 `loop/active-contract.json`
> 和实时 `git status --short` 为准，冲突时信这三处。

## 开场提示词

```
项目：Casey（测易，LLM 驱动「文本用例→测试报告」确定性可回放测试系统）。
工作目录 /mnt/d/ctx/heren/casey，分支 dev（master 稳定 / test 提测）。
你是接手者，零上下文起步——先读文档对齐，再按下一步动手。

【2026-07-22 深夜 最新覆盖层（agent-id-readback 评审闭环+合并）】
契约六阶段全 done、codex 四轮异构评审 R4 终判 PASS、已合并 dev@648e09e（主树复验对提交态
gate GREEN；未提交报告模板层触棘轮 R21——renderJson 新增 overview 字段，重签义务见下一步 A）。
① 三波=sol 五面构造兑现：bin/replay.mjs 三轴投影逐字搬移成生产纯函数 lib/replay-axes.mjs；
  mock Page/forensics 替身（tests/_golden/fixtures/agent-id-readback/mock-page.mjs）驱【真实】
  createCompileRun/compileFlow/performAction；棘轮扩 R18-R21 四冻结面（events/动作轴/axes/
  verdict→report 真 CLI 链四态各一）。基线 82484ab 窗口重录、既有六面零漂移=窗口保真机器证据；
  退窗现树 21/21 绿=身份实现不动 v1 字节的机器证据。plan §6/§8 权威修正+interface-spec §7 披露
  +prd 第五笔 checksumAmendments。
② R3 FAIL（机器五面判闭合）→四波全采信：H1 命中卡句柄全路径 finally dispose、M1 identityTokens
  消费即出账、H6 UAT 三件套落字段（prd observability：uatCaseId=tc_agent_id_readback_real_uat_v1
  +successorContract=real-uat-attestation+冻结 uatDefinition 四步定义）→R4 PASS（全 FIXED、
  plan §6 修正接受）。audit.jsonl 终账（rounds 4、pass）。
③ 陈旧红挂账（别顺手修）：tests/_golden/real-run-trust.zero-sut.golden.mjs 红——源码字面检查
  在 82484ab 前已失效（ctx 多行化）、主树/分支同红、无 owner prd 引用；待独立修单。
④ worktree ../casey-agent-id-readback 可退役（分支已并入 dev）；真机义务按冻结 uatDefinition
  走后继契约 real-uat-attestation（route:human）。
上一 session 同日早前四线（stale-red 修单/报告模板/真机三链）见 HANDOFF 溯源层。

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
- 主树：dev@648e09e（agent-id-readback 已并入）；活契约 stale-red-admission-refit
  （light，六阶段全 done、产物未提交）。
- worktree ../casey-agent-id-readback：已退役（分支并入 dev 后 worktree remove+分支删除，
  并行槽回 4/5）。
- 并发 baton 4/5：stale-red 主树 6/6 / loop-p0-4a 3/6、loop-p0-4b 2/6（别 session 暂停树，
  续前先重对 dev@648e09e 基线）/ mountdelay 6/6 残留。
- 主树未提交现场（三线增量已于五笔提交入 dev，至 31d5169+交接文档笔）：剩余全部为用户/并行现场
  （.gitignore、prd-cli-authority-wiring-fill/selftest/semantic-unit-discrimination、zip、follow.mjs、
  atom-readiness、regress-strategy、usability-audit），不碰不提交。提交只走显式路径、绝不 -A。

【下一步】
A（推荐）恢复 loop 改革（4a 3/6 / 4b 2/6，先重对最新 dev 基线；两树都落后逾 165 提交，
  沿用旧红基线直接续实现是禁手）。
B route:human 面：真机 UAT 后继契约 real-uat-attestation（冻结 uatDefinition 已入
  prd-agent-id-readback observability，绑 uatCaseId=tc_agent_id_readback_real_uat_v1）/
  同名敌意用例/密钥签名威胁面/SKILL.md 措辞统一。
C 陈旧红独立修单：real-run-trust.zero-sut（源码字面检查 82484ab 前已失效，主树同红、
  无 owner prd 引用）。
D P8 多通道 / P10 可信闭环自进化等排期线（见【排期】）。

改冻结金牌一律走 checksumAmendments 修单路径；A/B 择向建议先问 Steven。

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

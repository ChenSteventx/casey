# 下个 session 接续提示词（Casey）

> 用法：下次开新 session 只需 `/starter`，或把下方整段复制给接手者。
> 状态事实以 `docs/HANDOFF.md`、`loop/active-contract.json` 和实时
> `git status --short` 为准；冲突时信这三处。

## 开场提示词

```
项目：Casey（测易，LLM 驱动「文本用例→测试报告」确定性可回放测试系统）。
工作目录 /mnt/d/ctx/heren/casey，分支 dev（master 稳定 / test 提测）。
你是接手者，零上下文起步——先读文档对齐，再按下一步动手。

【一句话定位 + 血缘】
Casey 是 autotester（人录·机回放·零 LLM）的「翻面」：输入端改 LLM 读懂文本用例，
但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。
复用 autotester 的 loop-kit 作第二消费者（ADR-0001，兄弟目录独立包 ADR-0008）。
三处统一标识符 `casey`：CLI `bin/casey.mjs`、skill `.claude/skills/casey`、
MCP `mcp/casey-server.mjs`。

【先读，别现编已决的事】（必读顺序）
1. `CLAUDE.md` + `CONTEXT.md`（统一语言注册表，命名以它为准；弃用别名是黑名单、繁体禁用）
2. `docs/HANDOFF.md`（最新覆盖层即权威现状，顶节是 2026-08-08 傍晚）
3. `loop/GUARDRAILS.md`（19 条，逐条有效；表头仍写「13–16 新增」是陈旧措辞）
4. `.claude/skills/casey/SKILL.md`、`README.md`
5. 追溯「为何这么定」：`docs/adr/`（0001–0010）、`docs/design/txt2testreport-design.md`
6. 本轮证据链（plan/GRILL/reviews/learn）：`docs/plans/compile-intent-lineage-rebind/`
   （意图号重绑+前提修正）、`docs/plans/terminal-coverage-yield/`（基数门让位）、
   `docs/plans/admission-envelope-yield/`（准入信封让位）、
   `docs/plans/admission-terminal-group/`（准入终端语义）、
   `docs/plans/delete-spec-magnifier/`（放大镜白名单）

不要读取、搜索、推断或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。

【项目历史 / 决策档案】
- ADR-0001 loop-kit 第二消费者；ADR-0002 多态裁定四态 + fail-safe + 自愈准入门；
  ADR-0003 编译再回放、自愈非就地；ADR-0004 断言冻结→人签→改版重签；
  ADR-0005 统一语言由 hook 与 gate 强制；ADR-0006 Casey = autotester ⊕ regress 分层融合；
  ADR-0007 Playwright 回放基座、取证按发起方归因；ADR-0008 loop-kit 独立提取；
  ADR-0009 hermetic 绿只是必要条件、真机 UAT 与人签才是完成；ADR-0010 准入受众与凭据严格匹配。
- 2026-08-06/08 十六契约入 dev（本地零 push），近六个：意图号重绑 `b38c679`、
  基数门让位 `28e02a2`、准入信封让位 `87d86c1`、准入终端语义 `b80ee4e`、
  放大镜白名单 `c9d453d`；现役顶端为交接文档提交。每契约固定
  「grill→plan→accept（红先行冻结）→实现+突变闭环→全仓串行扫描→双路异构评审→
  并集修→收据+learn+audit→merge」；近四契约全部首轮双 APPROVE 零 C/H/M。
- 里程碑双达阵（2026-08-08）：十五跑 `b4r150807m` exit 0——B 段首例史上首次全链
  compile 产件；sign 三跑 EXIT 0——五断言 Steven 盖签落盘（expected.frozen +
  entity-locks 滞后冻结件改版重签兑现，17 行 created-in-run 真读回确认件）。

【DDD / 统一语言】
- 七相（LLM 只在相 0/1/2/5；相 3/4/6 零 LLM）：相0 归一 → 相1 编译 → 相2 冻结人签 →
  相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告。
- `TestCase` 是聚合根；`intentId` 是语义步（authored，人/LLM 写）、`stepId` 是回放
  事件位置；三轴 `StepAxes` = 动作轴 + typed 断言轴 + 取证轴；四态 = `PASS` /
  有本步证据的 `SUT_DEFECT` / 正向确证漂移的 `HARNESS_ERROR` / 证不出的
  `NEEDS_HUMAN`（五个子类见 CONTEXT.md）。
- 点击身份门（多匹配、坐标兜底、身份不明都不算 unique）；容器归属闸（命中还须落在
  记录容器内）；因果菜单授权（只认点入口后恰一浮现的新浮层）；网络取证按
  `attributedStepId` 不按时间窗；裁判与自愈分进程、`verdict.mjs` 对断言种类不可知。
- 本轮新知识（事实，未登记新词）：标准编译路径事件意图号逐步重绑（带号步三通道
  events/observed/verification 同号、裸步保持自生号；出处链闸拒因实为命名空间错配
  非单发行语义）；观察让位以 `yieldedToPlatformId` 取证字段硬桥接（字段是证据不是
  豁免宣告，门内重推导恰一匹配 subject 行才豁免——基数门/准入信封/准入终端三消费者
  已接线，准入侧多一条「信封整缺才是让位形」紧条件）；准入终端语义=组内末 click
  （对齐基数门先例，脚手架 click 不产观察义务）；replay delete-spec 闸白名单放大镜
  精确形状（文案 null ∧ value 缺 ∧ fallbackCss 逐字等于编译器字面才放）。

【开发准则（机制强制）】
- 阶段互锁：改实现或提交前必先 `contract init` 声明入口分流（`direct`|`light`|`full`）。
  已知缺陷：`hook-loop-guard` 在 git worktree 里解析主树 baton，工作树合规靠自律。
- `passes` 只由 `loop-kit/bin/gate.mjs` 写；`testChecksums` 冻结件只读，改动走
  checksumAmendment + 人签（events.schema 改版先例：两份归属 PRD 各登条目 +
  signerId/signedAt/signedVia）。gate 会回写 PRD evidence 时间戳弄脏已冻快照，
  验完 `git checkout -- loop/prd-<slug>.json` 还原。
- 双 hook 术语拦截：回合输出与写入 md/json 都被扫，违例、繁体、未登记加粗英文拦红。
- 评审纪律：对不可变快照（先 commit、`git diff HEAD` 空再派审）；任一 CHANGES_REQUIRED
  按并集修 + delta 复审；红证复现用 `git show <rev>:<file> >` 姿势绝不 `git checkout --`。
- 突变闭环是钉力判据：目标突变必红、现行必绿、还原 sha256 逐字节同。
- 全仓金牌扫描单侧串行跑（双侧并行互染上百对称假红，2026-08-07 实证）；判绿只信
  退出码、124 是超时码须单跑复核。

【兜底 / fail-safe】
- 证不出一律 `NEEDS_HUMAN`，绝不静默 `PASS`；`SUT_DEFECT` 须取证背书；自愈只对
  正向确证 `HARNESS_ERROR` 开闸且非就地、人签后应用。
- 入参畸形 fail-closed（`verdict` exit 65；缺参 64）；回放看门狗 120 秒强退；
  熔断器越阈写 inbox + exit 2；凭据兜底门落盘前深扫、命中拒写。
- replay 对 v3 created-in-run 用例是权威+票据双旗标 fail-closed：一次性票据失败尝试
  也核销（本轮实证烧掉一张、已披露重铸）、令牌须 `<batchToken>-` 前缀。

【排期】
- P0–P7 已建；P8 web 已有、cef 与 arbitrary 未开始；P9 tier-1 已建、tier-2 真机 UAT
  收口中（A 段已闭；B 段首例 `tc_catalog_wf_crud`：compile 全链产件 ✓、sign 落盘 ✓、
  replay 连破四门现停第五门）；后两例 `tc_wf_publish_states`/`tc_wf_history_version`
  等 crud 全通统一处置；P10 未开始。
- 并行硬规则：碰 `lib`/`bin` 走 worktree 隔离 + git-native 合并；每树一独立 baton；
  39 棵树多数已 6/6 收口可摘（护栏 #18 建议 ≤5 树，已超）。

【当前状态（2026-08-08 傍晚）】
- dev 顶端 `b6443d8`（credgate-lineage-keys merge），本地零 push。当日两契约收口：
  `replay-identity-channel-kind`（kind 泛化，五连双 APPROVE）+ `credgate-lineage-keys`
  （凭据门世系键形状豁免，pi APPROVE + grok M1 并集修一轮闭合）。
- **第十九跑 `b4r190808e` exit 0——相 3 真机回放史上首通、B 段首例七相链贯通**：
  axes 52.7KB 过凭据门落盘；相 4 裁定三步 PASS + intent_cleanup
  `NEEDS_HUMAN(INDETERMINATE)`（清理取证三绿、破坏步出站半边按 C3 诚实边界
  route:human）；相 6 报告三件落 `runs/b4-replay-20260808/tc_catalog_wf_crud/
  report-replay19/`。**待 Steven 裁 cleanup 一步**（完工信已附证据指针）。
- 票据 a-e 五张全核销（台账 `runs/_tier2/replay-grant-ledger/` 为权威；上一版
  「b 现役未核销」已被台账证伪——occupy 早于 launch，浏览器后段失败也烧票）。
- 主树活契约槽 `p9-created-workflow-cleanup-continuity-v3`（full，3/6——s5 深消费
  即本链 cleanup 取证，等 Steven 裁后收）。主树用户未提交资产一律勿动、勿 `git add -A`。
- 评审工艺现役配方：commit 快照 → ext4 浅克隆 `~/casey-review/`（node_modules 软链）
  → grok tmux 伪终端 + pi 默认配置入口（--exclude-tools edit,write）。新坑：grok
  第二条长中文消息会楔死输入部件——简报写文件 + 纯 ASCII 短令引用（credgate learn §4）。

【下一步（任选其一，先对齐再动手）】
甲. Steven 裁 cleanup `NEEDS_HUMAN`（证据：verdict.replay19 三绿断言 + report-replay19）
   ——签过则 B 段首例完成闸达成（ADR-0009 真机 UAT + 人签），顺手收主树 p9 槽。
乙. 后两例 `tc_wf_publish_states` / `tc_wf_history_version` 统一处置（凭据门与 kind
   泛化两修同受益）。
丙. 挂账清偿：「段非良构∧锁点名」hermetic 钉（checksumAmendment+人签待裁）、
   replay-identity-channel-kind plan W3 表笔误、A4 义务白名单独立钉、teach-in 三通道
   同缺、承前旧账（`wf-open-smoke` 陈旧红 owner、门面拆分族两陈旧红等）。
丁. 工作树清理：41 棵树多数 6/6 已收口可摘（本日新增两棵均可摘）。

【环境坑（WSL）】
- **D 盘（drvfs）不稳**：2026-08-07 一日四挂+（持续 I/O 下 Windows 侧 D: 卷静默停摆、
  C: 恒活、内核零痕迹，Steven 待查盘）。姿势：commit 早提勤提；评审走 ext4 克隆；
  重要产物随手落 `~/casey-recovery-20260807/`；挂死 WSL 内无法自愈，须 Windows 侧
  `wsl --shutdown` 重启；`/tmp` scratchpad 重启即清。
- 跑真机前先重启隧道两端（池老化约一小时，浏览器复用连接报
  `net::ERR_EMPTY_RESPONSE` 而 `curl` 恒好）：先 WSL 侧
  `node scripts/wsl-reverse-listen.mjs`，后 Windows 侧
  `cmd.exe /c "cd /d D:\ctx\heren\casey\scripts && node win-reverse-agent.mjs"`，
  `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:15519/` 核 200。
  `--sut` 只喂隧道回环基址。**杀隧道绝不模式杀**：death_report 项目同名脚本
  `wsl-reverse-listen.mjs`/`win-reverse-agent.mjs` 共存，我方进程命令行是相对路径
  不含 `casey`、模式串区分不开——2026-08-08 两轮 `pgrep -f` 清理把对方隧道团灭两次
  （已认账道歉）。唯一姿势：起监听时把 pid 记进
  `~/casey-recovery-20260807/tunnel-casey.pid`，杀时按档案纯数字 kill；档案缺失就
  `readlink /proc/<pid>/cwd` 核归属（cwd=casey 才许杀）。另：模式串与击杀同行仍会
  自匹配自杀（exit 144）。
- `/mnt/d` git 慢给足 300 秒；短超时空输出别误判成干净工作树；全仓检索过滤
  `.claude/worktrees/` 与兄弟树副本。
- 禁止启动 fake-SUT 或夹具 SUT；金牌只跑 zero-SUT / static / 纯内存。
- grok 评审必须 tmux 伪终端多轮（`--prompt-file` 单轮只吐意图不做事）；pi 用默认
  配置入口（画蛇添足传模型样式会走错供应方报 No API key）。
- 共享收件箱与同机其他 session 分工：各答己方主题、他方信只转不答；Steven 时间
  标签写珀斯（UTC+8）；碰引擎长流程先问对方 session 健康度。

【硬约束】
裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据与真实目标地址不外泄；中文
标准简体；新概念先查 `CONTEXT.md`；完成只认真实退出码、真机证据与 Steven 人签；
不把桩、文件存在、静态绿或模型印象冒充完成；不 push、不 merge 未经授权。
```

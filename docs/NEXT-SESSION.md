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
1. `CLAUDE.md` + `CONTEXT.md`（统一语言注册表，命名以它为准；弃用别名列是黑名单、
   命中即红，繁体禁用；同名异义与易踩别名详查注册表，别凭印象用词）
2. `docs/HANDOFF.md`（最新覆盖层即权威现状，顶节是 2026-08-10）
3. `loop/GUARDRAILS.md`（19 条逐条有效；CLAUDE.md 仍写「13–16 新增」是计数陈旧）
4. `.claude/skills/casey/SKILL.md`、`README.md`
5. 追溯「为何这么定」：`docs/adr/`（0001–0010）、`docs/design/txt2testreport-design.md`
6. 本轮证据链（plan/GRILL/reviews/learn）：`docs/plans/replay-identity-channel-kind/`
   （kind 泛化）、`docs/plans/credgate-lineage-keys/`（凭据门世系键形状豁免）、
   `docs/plans/p9-uat-close/`（P9 关账台账；其 resign-runbooks B 段判断已被超车，
   勿按它重新决策）、`docs/plans/gate-contract-preflight/`（门禁前置闸，停人签）

不要读取、搜索、推断或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。

【项目历史 / 决策档案】
- ADR-0001 loop-kit 第二消费者；ADR-0002 多态裁定四态 + fail-safe + 自愈准入门；
  ADR-0003 编译再回放、自愈非就地；ADR-0004 断言冻结→人签→改版重签；
  ADR-0005 统一语言由 hook 与 gate 强制；ADR-0006 Casey = autotester ⊕ regress 分层融合；
  ADR-0007 Playwright 回放基座、取证按发起方归因；ADR-0008 loop-kit 独立提取；
  ADR-0009 hermetic 绿只是必要条件、真机 UAT 与人签才是完成；ADR-0010 准入受众与凭据严格匹配。
- 2026-08-06/08 十六契约入 dev（本地零 push），近六个：意图号重绑 `b38c679`、
  基数门让位 `28e02a2`、准入信封让位 `87d86c1`、准入终端语义 `b80ee4e`、
  放大镜白名单 `c9d453d`、kind 泛化 `41a09a0` + 凭据门形状豁免 `b6443d8`；现役顶端
  `7c0aa58`（cleanup 人签落档等三笔文档提交）。每契约固定
  「grill→plan→accept（红先行冻结）→实现+突变闭环→全仓串行扫描→双路异构评审→
  并集修→收据+learn+audit→merge」；近五契约首轮双 APPROVE 零 C/H/M。
- 里程碑三达阵（2026-08-08）：签署史上首次落盘（sign 三跑 EXIT 0，五断言 Steven
  盖签）；第十九跑 `b4r190808e` exit 0——相 3 真机回放史上首通、B 段首例七相链贯通；
  cleanup 人签 → B 段首例完成闸达成（ADR-0009 三件齐）。

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
- 同名异义高发区（详查 CONTEXT.md，接手首日最易误解）：「冻结」两义（断言契约
  冻结=人签+checksum ≠ promptset 幂等冻结）；verdict 出四态 ≠ gate 写二值 `passes`；
  `run-history` 的 `result` 不是四态；「剖面」两义（loop-kit 执行剖面 ≠ 通道剖面）。
- 观察让位以 `yieldedToPlatformId` 取证字段硬桥接（字段是证据不是豁免宣告，门内
  重推导恰一匹配才豁免——基数门/准入信封/准入终端三消费者已接线）；准入终端语义=
  组内末 click；replay delete-spec 闸白名单放大镜精确形状（文案 null ∧ value 缺 ∧
  fallbackCss 逐字等于编译器字面才放）。

【开发准则（机制强制）】
- 阶段互锁：改实现或提交前必先 `contract init` 声明入口分流（`direct`|`light`|`full`）。
  已知缺陷：`hook-loop-guard` 在 git worktree 里解析主树 baton，工作树合规靠自律。
- `passes` 只由 `loop-kit/bin/gate.mjs` 写；`testChecksums` 冻结件只读，改动走
  checksumAmendment + 人签。gate 会回写 PRD evidence 时间戳弄脏已冻快照，
  验完 `git checkout -- loop/prd-<slug>.json` 还原。
- 双 hook 术语拦截：回合输出与写入 md/json 都被扫，违例、繁体、未登记加粗英文拦红。
- 裁判对断言种类不可知（护栏 #17）：新增断言维度只改 `check.mjs` + 金牌，绝不按
  kind 进裁判分支。强制层/迁移/共享冻结面改动必复跑全部受影响 browser-replay 金牌、
  合并回 dev 后主树复验——tier1 绿不含回放层（护栏 #19）。
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
  也核销、令牌须 `<batchToken>-` 前缀。

【排期】
- P0–P7 已建；P8 web 已有、cef 与 arbitrary 未开始；P9 tier-1 已建、tier-2 真机 UAT
  收口中（A 段已闭；B 段首例 `tc_catalog_wf_crud` 完成闸已达成；后两例待）；P10
  底座已建、正式原子晋升/跨运行复验/版本撤销/可运行 heal 未完成
  （`docs/REQUIREMENTS-STATUS.md` 快照仍是 2026-07-22，P5/P9 两行已被 08-08 进展
  推翻，冲突按其自述判序信实际代码与 HANDOFF）。
- P9 关账规则（Steven 2026-07-30 裁）：不走 waiver，清单每例必须真机全 PASS + 人签，
  P9 保持 open 直到全部真绿（`docs/plans/p9-uat-close/P9-CLOSE-LEDGER.md`）。
- 分支归属风险：GitHub `main` 与内部 `dev` 无共同祖先；公共发布能力与内部内核分裂
  在两条历史上，更新 `main` 前必须需求级+文件级对账，不能把 `dev` 当 `main` 超集。
- 并行硬规则：碰 `lib`/`bin` 走 worktree 隔离 + git-native 合并；每树一独立 baton；
  41 棵树多数已 6/6 收口可摘（护栏 #18 建议 ≤5 树，已严重超标）。

【当前状态（2026-08-10 下午）】
- **B 段三例 v3 接线链全线收口，契约 `p9-created-workflow-cleanup-continuity-v3` 六阶段
  全 done**。三例（`tc_catalog_wf_crud` / `tc_wf_publish_states` / `tc_wf_history_version`）
  的 v3 三件齐备，五源字节自检全 ok；tier2 清单换签 + checksumAmendment 完成；
  `gate GREEN 5/5`、全仓 `ratchet verify GREEN`（184 PRD / 786 冻结件 / 0 问题）；
  双路异构评审（grok-4.5 + pi.dev）R1 均 CHANGES_REQUIRED → 并集修 → R2 均 APPROVE，
  收据 `docs/plans/p9-created-workflow-cleanup-continuity-v3/reviews/README.md`。
  `lib` 与 `bin` 一字未改。
- **本轮最大发现：意图号重绑会静默移动断言求值点**（learn.md 全文）。断言只在意图代表步
  （末动作步）求值一次，而重绑把意图粒度并粗成 authored 意图，令「点开弹窗→断言→关闭」
  同意图形状的用例正向断言必红。表达规则：**一个意图只能有一个求值时刻**。三笔欠账已登记：
  编译期 lint（碰强制层须另立契约）、publish 拆意图重表达、assert 类原子准入三面登记不全
  （补登记须与清理本轮所加绑定同车做）。
- 三例真机 UAT 完成闸只走完 compile/sign 面，**replay 面尚未跑**（票据须重铸，台账
  `runs/_tier2/replay-grant-ledger/` 为权威）。B 段首例的 cleanup 人签早于本轮已达成。
- 隧道两端已重启并接管档案（新 pid 见 `~/casey-recovery-20260807/tunnel-casey.pid`）。
  **Windows 侧另有 herentunnels\engine(15549) 与 herentunnels\kibana(15529) 两个同名
  `win-reverse-agent.mjs` 属他方**，必须按完整命令行路径区分、不可按进程名。
- 邮件标题格式已改（Steven 2026-08-10 定）：`[类型前缀]【casey】具体事项`——类型前缀必须
  最前（看门狗靠它识别），项目标识紧随；死亡报卡侧同日用 `【死亡报卡】`，两边对齐。
- 未提交现场 14 项已逐项审计（2026-08-10）：全部是登记过的用户资产，勿动、勿
  `git add -A`。分三类：07-31 代执行签署批次（`SIGN-AND-AFTER.md` +255 行、
  `resign-runbooks.md` +49 行、三个 prd 的签署字段）；08-08 签署落盘批次
  （`prd-tc_catalog_wf_crud` 换 sha + authority 登记、`prd-p9-…continuity-v3` 跑证
  时间戳）；4 个 prd 纯 gate 时间戳噪音（08-03，可弃可提）。唯一文档外增量：
  `loop/prd-tc_wf_publish_states.json`（08-08 22:21）新登记
  `runs/b4-publish-20260808/execute-authority.json`，此前无任何文档记载，须 Steven
  确认归属。
- 未跟踪三件：`REVIEW-PROMPT-for-codex.md` 应入库（gate-contract-preflight 异构评审
  账上的空格，备 Steven 亲自发起 codex）；`casey-agent-loop-local-first-total.zip`
  与 `follow.mjs` 是临时物不该入库（建议移 `tmp/` 或补 ignore）。
- 停泊的两条人签链（勿自主启动）：gate-contract-preflight——实现全绿在兄弟工作树
  `../loop-kit-gate-preflight`、真包故意未动（包同步须与 kit-lock 重签同车落）、
  SIGN-REQUEST 状态 PENDING_STEVEN 且有一处实现偏差待他确认（无差别 64 与已冻零字节
  钉冲突，实做最严一路）；chiefcomplaint v2 后继——plan+红基线已冻（`60f7263`）、
  loop 未开、不占槽，卡在铸权前（v2 草稿只有真机编译产得出，2026-07-22 的代签明确
  不重复；解链顺序文档已写死：补 profile agents 段→人签权威件→真机 compile→
  带观察件签→验证回放）。
- 主树活契约槽 `p9-created-workflow-cleanup-continuity-v3`（full，3/6）——s5 深消费
  证据已齐（cleanup 已签），可收 6/6。
- 文档陈旧三处待修：CLAUDE.md 护栏计数（写 13–16 实为 19 条）；GUARDRAILS #16 仍标
  prose 但 ADR-0009 已升流程强制；`resign-runbooks.md` B 段 B-1/B-2 两难已被 8 月
  B-1 路线实际超车。
- 评审工艺现役配方：commit 快照 → ext4 浅克隆 `~/casey-review/`（node_modules 软链）
  → grok tmux 伪终端 + pi 默认配置入口（--exclude-tools edit,write）。

【下一步（任选其一，先对齐再动手）】
A. **三例 replay 面**——本轮只到 compile/sign，回放尚未跑。依赖：重铸批级回放票据
   （一次性、失败尝试也烧票，台账为权威；票据须绑各例 `created-workflow-authority.frozen.json`
   的 `structuralAuthoritySha256`，本轮三件已齐故可铸）+ 隧道探活。目标：三例真机
   UAT 人签完成闸，P9 关账。
B. 工装欠账立契约：编译期加「意图内断言步之后还有改状态动作步 → blocker」前置检查。
   碰编译门属强制层、按 ADR-0008 是 kernel 级治理（双设计审 + 异构冗余 + 人签）。
   **lint 落地前，任何「点开→断言→关闭」同意图形状的用例，下次重编译必踩同坑。**
C. assert 类原子准入三面登记补齐（`assert.textHidden` / `assert.buttonState` /
   `workflow.closeDrawer` 均未登记、走保守默认当 mutation）。**须与清理本轮所加
   `entityBindings` 同车做**，否则补登记会反过来拒掉这些绑定。
D. 承前挂账：「段非良构∧锁点名」hermetic 钉（需人签）、publish 拆意图重表达（搭车下次
   真机）、41 棵工作树清理、停泊两链（gate-contract-preflight 签核 / chiefcomplaint
   v2 铸权，均卡 PENDING_STEVEN）。

【环境坑（WSL）】
- WSL 本体会整机挂死：2026-08-10 晨挂过一次，Windows 侧重启后新实例即健康。判死活
  先 `uptime` 看实例新旧再动手；重启窗口内读 `/mnt/d` 会零星 EIO，重试即复原；
  `/tmp` scratchpad 重启即清；`.git/sequencer` 本次已核无残留。
- D 盘（drvfs）不稳：2026-08-07 一日四挂+（持续 I/O 下 Windows 侧 D: 卷静默停摆、
  C: 恒活、内核零痕迹）。姿势：commit 早提勤提；评审走 ext4 克隆；重要产物随手落
  `~/casey-recovery-20260807/`；挂死 WSL 内无法自愈，须 Windows 侧 `wsl --shutdown`
  重启。swap 16G + sysctl 防线已装（内存耗尽压垮 9p 的根因侧）。
- 跑真机前先重启隧道两端（池老化约一小时，浏览器复用连接报
  `net::ERR_EMPTY_RESPONSE` 而 `curl` 恒好）：先 WSL 侧
  `node scripts/wsl-reverse-listen.mjs`，后 Windows 侧
  `cmd.exe /c "cd /d D:\ctx\heren\casey\scripts && node win-reverse-agent.mjs"`，
  `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:15519/` 核 200。
  `--sut` 只喂隧道回环基址。**杀隧道绝不模式杀**：death_report 项目同名脚本共存、
  模式串区分不开（2026-08-08 两轮误伤对方隧道已认账）。唯一姿势：起监听时把 pid
  记进 `~/casey-recovery-20260807/tunnel-casey.pid`，杀时按档案纯数字 kill；档案
  缺失就 `readlink /proc/<pid>/cwd` 核归属（cwd=casey 才许杀）。模式串与击杀同行
  仍会自匹配自杀（exit 144）。
- `/mnt/d` git 慢给足 300 秒；短超时空输出别误判成干净工作树；全仓检索过滤
  `.claude/worktrees/` 与兄弟树副本。
- 禁止启动 fake-SUT 或夹具 SUT；金牌只跑 zero-SUT / static / 纯内存。
- grok 评审必须 tmux 伪终端多轮（`--prompt-file` 单轮只吐意图不做事）；第二条长
  中文消息会楔死输入部件——简报写文件 + 纯 ASCII 短令引用；pi 用默认配置入口
  （画蛇添足传模型样式会走错供应方报 No API key）。
- 共享收件箱与同机其他 session 分工：各答己方主题、他方信只转不答；Steven 时间
  标签写珀斯（UTC+8）；碰引擎长流程先问对方 session 健康度。

【硬约束】
裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据与真实目标地址不外泄；中文
标准简体；新概念先查 `CONTEXT.md`；完成只认真实退出码、真机证据与 Steven 人签；
不把桩、文件存在、静态绿或模型印象冒充完成；不 push、不 merge 未经授权。
```

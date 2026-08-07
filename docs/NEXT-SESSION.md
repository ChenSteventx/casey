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
复用 autotester 的 loop-kit 作第二消费者（ADR-0001，现已是兄弟目录独立包 ADR-0008）。
三处统一标识符 `casey`：CLI `bin/casey.mjs`、skill `.claude/skills/casey`、
MCP `mcp/casey-server.mjs`。

【先读，别现编已决的事】（必读顺序）
1. `CLAUDE.md` + `CONTEXT.md`（统一语言注册表，命名以它为准；弃用别名是黑名单、繁体禁用）
2. `docs/HANDOFF.md`（最新覆盖层即权威现状，顶节是 2026-08-07 凌晨）
3. `loop/GUARDRAILS.md`（19 条，逐条有效；表头仍写「13–16 新增」是陈旧措辞）
4. `.claude/skills/casey/SKILL.md`、`README.md`
5. 追溯「为何这么定」：`docs/adr/`（0001–0010）、`docs/design/txt2testreport-design.md`
6. 本轮真机证据链：`docs/plans/wf-open-preface-notes/`（诊断契约）、
   `docs/plans/semantic-name-instantiate/`（语义名根因契约）与
   `docs/plans/wf-open-readback-requery/`（读回门根因契约）的 plan/learn/reviews

不要读取、搜索、推断或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。

【项目历史 / 决策档案】
- ADR-0001 loop-kit 第二消费者；ADR-0002 多态裁定四态 + fail-safe + 自愈准入门；
  ADR-0003 编译再回放、自愈非就地；ADR-0004 断言冻结→人签→改版重签；
  ADR-0005 统一语言由 hook 与 gate 强制；ADR-0006 Casey = autotester ⊕ regress 分层融合；
  ADR-0007 Playwright 回放基座、取证按发起方归因；ADR-0008 loop-kit 独立提取；
  ADR-0009 hermetic 绿只是必要条件、真机 UAT 与人签才是完成；ADR-0010 准入受众与凭据严格匹配。
- 2026-08-06/07 十契约入 dev（本地零 push）：sleep 导入修 `8d0b0bc`、create 入口锚
  `158829d`、登录预算 `9bb2300`、post-nav 双锚 `db80a17`、open 搜索先行 `7f38606`、
  open 诊断 notes `97c0d83`、语义名回填 `8d0e6e3`、读回门丙路线 `a507f5c`、
  删除搜索修 `b6880e3`（现役顶端）。
  每个契约固定「实现 → 双路评审 → 并集修 → 收据 + learn → merge」，全部双路 APPROVE 才合。

【DDD / 统一语言】
- 七相（LLM 只在相 0/1/2/5；相 3/4/6 零 LLM）：相0 归一 → 相1 编译 → 相2 冻结人签 →
  相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告。
- `TestCase` 是聚合根；`intentId` 是语义步、`stepId` 是回放事件位置；三轴 `StepAxes` =
  动作轴 + typed 断言轴 + 取证轴；四态 = `PASS` / 有本步证据的 `SUT_DEFECT` /
  正向确证漂移的 `HARNESS_ERROR` / 证不出的 `NEEDS_HUMAN`（五个子类见 CONTEXT.md）。
- 点击身份门（多匹配、坐标兜底、身份不明都不算 unique）；容器归属闸（命中还须落在
  记录容器内）；因果菜单授权（只认点入口后恰一浮现的新浮层）；网络取证按
  `attributedStepId` 不按时间窗；裁判与自愈分进程、`verdict.mjs` 对断言种类不可知。
- 本轮新知识（未登记新词，只是事实）：`semantic.name` 落盘留模板、定位那一刻回填——
  两侧定位入口各过一次纯投影 `instantiateEventSemantic`。

【开发准则（机制强制）】
- 阶段互锁：改实现或提交前必先 `contract init` 声明入口分流（`direct` | `light` | `full`）。
  已知缺陷：`hook-loop-guard` 在 git worktree 里解析主树 baton 与主树暂存区，既不会正确拦
  也不会正确放——工作树里的合规靠执行者自律走完流程（本日第四次实证；分步 add/commit 可绕）。
- `passes` 只由 `loop-kit/bin/gate.mjs` 写；`testChecksums` 冻结件只读，改动走
  checksumAmendment + 人签。gate 会回写 PRD 的 evidence 时间戳弄脏已冻快照，
  验完 `git checkout -- loop/prd-<slug>.json` 还原。
- 双 hook 术语拦截：回合输出与写入 md/json 都被扫，违例、繁体、未登记的加粗英文拦红。
- 评审纪律：任一评审方 `CHANGES_REQUIRED` 即按发现并集修，不宣称完成；评审必须对着
  不可变快照（先 commit、`git diff HEAD` 为空再派审）；评审后提交前必核
  `git diff --cached`（评审方用 `git checkout <rev> -- <file>` 复现会写暂存区，
  本日已有把回退带进提交的事故）；红证复现改用 `git show <rev>:<file> >` 姿势。
- 突变验证是钉力判据：目标突变下必红、现行实现下必绿、还原后 sha256 逐字节相同。
- 碰定位核心、强制层、共享冻结面的改动必跑全仓金牌扫描（护栏 #19）：抽样邻接会漏
  ——本日实证首版设计邻接全绿却打红两个用字面匹配判接线顺序的冻结金牌。

【兜底 / fail-safe】
- 证不出一律 `NEEDS_HUMAN`，绝不静默 `PASS`；`SUT_DEFECT` 须取证背书；
  自愈只对正向确证 `HARNESS_ERROR` 开闸且非就地、人签后应用。
- 入参畸形 fail-closed（`verdict` exit 65；缺参 64）；回放看门狗 120 秒强退；
  熔断器越阈写 inbox + exit 2；凭据兜底门落盘前深扫、命中拒写。

【排期】
- P0–P7 已建；P8 web 已有、cef 与 arbitrary 未开始；P9 tier-1 已建、tier-2 机器面已建
  而真机 UAT 收口中（A 段已闭，B 段首例 `tc_catalog_wf_crud` 推进到 open 步）；
  P10 可信闭环自进化未开始。
- 并行硬规则：碰 `lib`/`bin` 的落地走 worktree 隔离 + git-native 合并，绝不 cp 进
  `lib`/`bin`；每树一独立 baton（护栏 #18 建议 ≤5 树，当前 29 树全持活 baton、已超，
  多数是已 6/6 收口的历史树，可择机清理）。

【当前状态（2026-08-07 凌晨收盘）】
- dev 顶端 `b6880e3`，本地零 push。活契约槽 `p9-created-workflow-cleanup-continuity-v3`
  （`full`，3/6 不变）。两晚新契约树 `casey-wf-open-readback-requery`、
  `casey-wf-delete-search-filter` 均 6/6 收口可摘。
- B4 十至十二跑账（详 HANDOFF 顶节）：十跑定读回门根因（丙路线契约修，open 首次真机
  走通于十一跑）；十一跑定删除计数门根因（搜索修契约，计数门通过于十二跑）；十二跑停
  「同名观察多条」设计缝——create（subject）+ open（source）同 flow 各产一条身份观察，
  C3 破坏性连续性守卫如实拒绝二选一（wiring 金牌 H1i 早钉的多身份原子同流面）。
- 三跑残留各建一删一，B4 累计建九删九零残留；全链耗时十跑 1m17.5s/十一跑 1m6s/十二跑 22s。
- 主树有用户未提交资产（七个 `prd`、两个 md、四个未跟踪件）——一律勿动、勿 `git add -A`。

【下一步（任选其一，先对齐再动手）】
甲. 同名观察多条设计缝（推荐，岔口待 Steven 裁）：甲案=open 读回观察去重让位（同 flow
   已有同 platformId 的 subject 观察时 open 跳过归档 source 行，双证照跑；冻结面零接触）
   vs 乙案=C3 守卫改值唯一（动破坏性守卫语义，不推荐）。裁后走契约，十三跑预期全链首过。
乙. 后两例 `tc_wf_publish_states` / `tc_wf_history_version`：等 crud 通了统一处置。
丙. 挂账清偿（可并行 fan-out）：PRD notes 史迹措辞；真机金牌依赖未跟踪产物（新树必红
   两例：real-uat-attestation / teachin-nav-expansion-recipe）；工作流身份账本接线拆除；
   金牌自产残件自清；`wf-open-smoke` 陈旧红 owner；门面拆分族两陈旧红；`pi` 对
   `wf-delete-card-layout` 补审；`hook-loop-guard` 立项；清单重签补 `replayGrantPath`。
丁. 工作树清理：31 棵树全持活 baton、远超建议的 5 棵，已 6/6 收口的可摘。

【环境坑（WSL）】
- 跑真机前先重启隧道两端（本日成纪律）：池老化约一小时或高请求量后，浏览器复用
  连接报 `net::ERR_EMPTY_RESPONSE` 而 `curl` 恒好；重启即愈。顺序敏感：先 WSL 侧
  `node scripts/wsl-reverse-listen.mjs`，后 Windows 侧 `scripts/win-forward-start.cmd`
  （或直接 `cmd.exe /c "cd /d D:\ctx\heren\casey\scripts && node win-reverse-agent.mjs"`），
  然后 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:15519/` 核 200。
- 会话重启后隧道必断，需按上面顺序重建；`--sut` 只喂隧道回环基址。
- `/mnt/d` 的 git 慢，给足 300 秒；短超时的空输出别误判成干净工作树。
- `/mnt/d` 挂载偶发 drvfs 整体 I/O 故障，WSL 内无法自愈，须 Windows 侧 `wsl --shutdown`
  重启；`/tmp` 的 scratchpad 重启即清，重要产物存 `~`。
- 全仓 `grep`/`find` 会命中 `.claude/worktrees/` 与兄弟工作树里的副本，检索需过滤。
- 禁止启动 fake-SUT 或夹具 SUT；金牌只跑 zero-SUT / static / 纯内存。
- 金牌扫描用 `timeout N node <golden>` 时注意 124 是超时码不是红，需给足时间复核。

【硬约束】
裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据与真实目标地址不外泄；中文标准简体；
新概念先查 `CONTEXT.md`；完成只认真实退出码、真机证据与 Steven 人签；
不把桩、文件存在、静态绿或模型印象冒充完成；不 push、不 merge 未经授权。
```

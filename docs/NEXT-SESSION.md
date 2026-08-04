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
复用 autotester 的 loop-kit 作第二消费者（ADR-0001）。三处统一标识符 `casey`：
CLI `bin/casey.mjs`、skill `.claude/skills/casey`、MCP `mcp/casey-server.mjs`。

【先读，别现编已决的事】（必读顺序）
1. `CLAUDE.md` + `CONTEXT.md`（统一语言注册表，命名以它为准；弃用别名是黑名单、繁体禁用）
2. `docs/HANDOFF.md`（最新覆盖层即权威现状，顶节是 2026-08-04 全天收盘）
3. `loop/GUARDRAILS.md`（19 条，逐条有效）
4. `.claude/skills/casey/SKILL.md`、`README.md`
5. 追溯「为何这么定」：`docs/adr/`（0001-0010）、`docs/design/txt2testreport-design.md`
6. 本轮真机证据：`docs/plans/p9-created-workflow-cleanup-continuity-v3/evidence/`
   下 `signing-a-segment-20260804.md`、`shape-probe-20260804.md`

不要读取、搜索、推断或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。

【项目历史 / 决策档案】
- ADR-0001 Casey 作 loop-kit 第二消费者；ADR-0002 多态裁定四态 + fail-safe + 自愈准入门；
  ADR-0003 编译再回放、自愈非就地；ADR-0004 断言草拟→冻结→人签、改版重签；
  ADR-0005 `CONTEXT.md` 统一语言由 hook 与 gate 强制；ADR-0006 原子结果重表达三轴；
  ADR-0007 Playwright 回放基座、取证按发起方归因；ADR-0008 loop-kit 独立提取；
  ADR-0009 hermetic 绿只是必要条件、真机 UAT 与人签才是完成；ADR-0010 准入受众与凭据严格匹配。
- 2026-08-04 六批次入 dev（本地零 push）：chief 漏导入修 `a57366c`、
  ref-rebuild `6f51aaf`、agent-delete 漏导入修 `c66544e`、A 段签署封账 `57422af`、
  卡片布局删除路径 `3010d86`、回放票据 `158f2ec` + C2 签回 `c89b3b8`（现役顶端）。

【DDD / 统一语言】
- 七相（LLM 只在相 0/1/2/5；相 3/4/6 零 LLM）：相0 归一 → 相1 编译 → 相2 冻结人签 →
  相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告。
- `TestCase` 是聚合根；`intentId` 是语义步、`stepId` 是回放事件位置；三轴 `StepAxes` =
  动作轴 + typed 断言轴 + 取证轴；四态 = `PASS` / 有本步证据的 `SUT_DEFECT` /
  正向确证漂移的 `HARNESS_ERROR` / 证不出的 `NEEDS_HUMAN`。
- 点击身份门（多匹配、坐标兜底、身份不明都不算 unique）；网络取证按 `attributedStepId`
  不按时间窗；裁判与自愈分进程、`verdict.mjs` 对断言种类不可知。
- 本轮新登记：因果菜单授权（卡片布局删除入口只接受点击更多操作入口后恰一浮现的新浮层菜单）。

【开发准则（机制强制）】
- 阶段互锁：改实现或提交前必先 `contract init` 声明入口分流（`direct` | `light` | `full`）。
  已知缺陷：`hook-loop-guard` 在 git worktree 里解析主树 baton 与主树暂存区，
  既不会正确拦也不会正确放——工作树里的合规靠执行者自律走完流程，别当机制已验证。
- `passes` 只由 `loop-kit/bin/gate.mjs` 写；`testChecksums` 冻结件只读，改动走
  checksumAmendment + 人签。注意 gate 会回写 PRD 的 evidence 时间戳弄脏已冻快照，
  验完 `git checkout -- loop/prd-<slug>.json` 还原。
- 双 hook 术语拦截：回合输出与写入 md/json 都被扫，违例、繁体、未登记的加粗英文拦红。
- 评审纪律：任一评审方 `CHANGES_REQUIRED` 即按发现并集修，不宣称完成；评审必须对着
  不可变快照（先 commit、`git diff HEAD` 为空再派审），执行者持树期间收到「已派审」要喊停；
  运行故障（超时/限额/上游 503）如实记 HARNESS_ERROR，绝不改写成供应方或额度不可用。
- 突变验证是钉力的判据：目标突变下必红、现行实现下必绿、还原后 sha256 逐字节相同；
  突变必须外科式（保持 `node --check` 过），红因必须是目标断言文案而非语法错。

【兜底 / fail-safe】
- 证不出一律 `NEEDS_HUMAN`，绝不静默 `PASS`；`SUT_DEFECT` 须取证背书；
  自愈只对正向确证 `HARNESS_ERROR` 开闸且非就地、人签后应用。
- 入参畸形 fail-closed（`verdict` exit 65）；回放看门狗；熔断越阈写 inbox + exit 2；
  凭据兜底门落盘前深扫、命中拒写。

【排期】
- P0-P7 已建；P8 web 已有、CEF 与 arbitrary 未完成；P9 tier-1 已建、
  tier-2 机器面已建而真机 UAT 收口中（本轮 A 段已闭、B 段停在首例 B4）；
  P10 可信闭环自进化未开始。
- 并行硬规则：碰 `lib`/`bin` 的落地走 worktree 隔离 + git-native 合并，绝不 cp 进 `lib`/`bin`。

【当前状态（2026-08-04 收盘）】
- dev 顶端 `c89b3b8`，本地零 push。活契约槽 `p9-created-workflow-cleanup-continuity-v3`
  （`full`，`grill`/`plan`/`accept` done、`loop` 待）。
- A 段已闭合：A3 真机重编译 exit 0 找回 `events.json`、首份真机流回复证据；
  A5 代签（Steven 会话内显式授权，代执行如实标注）冻结 `expected.frozen.json` 与
  v2 `entity-locks.frozen.json`；`--force` 的 1 条 pending 已留痕披露。
- B 段停在首例：`tc_catalog_wf_crud` 的 B0-B3 就位，B4 `COMPILE_EXIT=1` 停在
  `stepOrdinal=1 atom=workflow.create`，只落 `compile-report.json`；只读扫库确认
  `atl_` 残留 0 条（创建未落库、被测方干净）。根因未定位，**先查再跑**。
- 真机检查单已核：搜索框 `Enter` 不过滤（要点 `.hr-input__suffix .search-icon`）；
  现役卡片是 `.agent-card`（`.hr-card.hr-card--bordered` 计数为 0，旧金牌选择器陈旧）；
  目标卡 `button.agent-card__more` 物理 1 个（无隐藏克隆）。
- 主树有用户未提交资产（六个 `prd`、两个 md、四个未跟踪件）——一律勿动、勿 `git add -A`。

【下一步（任选其一，先对齐再动手）】
A. 定位 B4 `workflow.create` 失败根因（只读探针核新增入口现役形态，与
   `lib/compile-atoms-workflow-crud.mjs` 的 07-02 实采知识对表）——不重跑编译。
B. 续跑 B 段三例 B4-B9（Steven 已全授权、代签口径同 A5；一例一跑、失败即停）。
C. 清单重签补 `replayGrantPath`（`p9-tier2-selftest` T9a 计划内红的清偿点）。
D. `hook-loop-guard` 跨树互锁失效立项（kernel 级，机理已查明，车道待裁）。
E. 挂账补审：`pi` 对 `wf-delete-card-layout` 前提审那一轮。

【环境坑（WSL）】
- 优先在 WSL 交互 shell 跑（`wsl.exe -e bash -ic '<cmd>'` 载 NVM Node）：工作树
  `.git` 指针与 `node_modules` 软链都是 WSL 形态，Windows 下会产生假红；
  曾出现 `.git` 指针被写成 `D:/` 形态导致 WSL git 直接 fatal，改回 `/mnt/d` 即可。
- `/mnt/d` 的 git 慢，给足 300 秒；短超时的空输出别误判成干净工作树。
- 真机链路：`--sut` 只喂隧道回环基址；起隧道顺序敏感（先 WSL 侧
  `scripts/wsl-reverse-listen.mjs`、后 Windows 侧代理），核 `doctor` 与单实例。
- `/mnt/d` 挂载偶发 drvfs 整体 I/O 故障（本日发生一次），WSL 内无法自愈，
  须 Windows 侧 `wsl --shutdown` 重启；`/tmp` 的 scratchpad 重启即清，重要产物存 `~`。
- 禁止启动 fake-SUT 或夹具 SUT；金牌只跑 zero-SUT / static / 纯内存。

【硬约束】
裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据与真实目标地址不外泄；中文标准简体；
新概念先查 `CONTEXT.md`；完成只认真实退出码、真机证据与 Steven 人签；
不把桩、文件存在、静态绿或模型印象冒充完成；不 push、不 merge 未经授权。
```

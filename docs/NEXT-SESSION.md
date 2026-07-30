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
2. `docs/HANDOFF.md`（最新进度，冲突以它为准；顶部覆盖层是权威现状）
3. `loop/GUARDRAILS.md`（现为 19 条，逐条有效）
4. `.claude/skills/casey/SKILL.md`、`README.md`
5. 追溯「为何这么定」：`docs/adr/`（0001-0010）、`docs/design/txt2testreport-design.md`

不要读取、搜索、推断或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。

【项目历史 / 决策档案】
- ADR-0001 Casey 作 loop-kit 第二消费者；ADR-0002 多态裁定四态 + fail-safe + 自愈准入门；
  ADR-0003 编译再回放、自愈非就地；ADR-0004 断言草拟→冻结→人签、改版重签；
  ADR-0005 `CONTEXT.md` 统一语言由 hook 与 gate 强制；ADR-0006 原子结果重表达三轴；
  ADR-0007 Playwright 回放基座、取证按发起方归因；ADR-0008 loop-kit 独立提取；
  ADR-0009 hermetic 绿只是必要条件、真机 UAT 与人签才是完成；ADR-0010 准入受众与凭据严格匹配。
- 里程碑：2026-07-24 实体 C0/C2/C3 调和入 dev；07-27 意图规划与执行目标硬化；
  07-28 示教可回放闭包六阶段收口（未提交）；07-28 夜至 07-29 晨 P6 自愈六阶段收口。

【DDD / 统一语言】
- 七相（LLM 只在相 0/1/2/5；相 3/4/6 零 LLM）：相0 归一 ingest → 相1 编译 compile →
  相2 冻结人签 sign → 相3 回放 replay → 相4 裁定 verdict → 相5 自愈 heal → 相6 报告 report。
- `TestCase` 是聚合根；`intentId` 是语义步、`stepId` 是回放事件位置；`StepAxes` 三轴 =
  动作轴 + typed 断言轴 + 取证轴；四态 = `PASS` / 有本步证据的 `SUT_DEFECT` /
  正向确证漂移的 `HARNESS_ERROR` / 证不出的 `NEEDS_HUMAN`。
- 点击身份门保证做了对的动作（多匹配、坐标兜底、身份不明都不算 unique）；
  网络取证按 `attributedStepId` 不按时间窗；裁判与自愈分进程、`verdict.mjs` 对断言种类不可知。
- 示教录制物是未签语料，不得提升为正式 spec 或正式 `PASS`。

【开发准则（机制强制）】
- 阶段互锁：改实现或提交前必先 `contract init` 声明入口分流（`direct` | `light` | `full`），
  `hook-loop-guard` 按 contract 拦；缺上一阶段交付物拦红。
- `passes` 只由 `loop-kit/bin/gate.mjs` 写；`testChecksums` 冻结件对实现者只读，
  改动走 checksumAmendment + 人签。
- 双 hook 术语拦截：回合输出与写入的 md/json 都被扫，违例、繁体、未登记的加粗英文拦红。
- 模型分工（Steven 2026-07-28 定）：plan 用 fable；执行用 opus 5 medium 的 subagent；
  执行过程多回抛 fable 咨询；评审用 codex `gpt-5.6-sol` xhigh + grok 联合，codex 无额度走 pi.dev。
- 决策超时阶梯：提问 15 分钟未答发邮件，再 15 分钟未答可代签（须全盘披露、代签身份如实标注）。
- 每收口一个批次主动发完工邮件通知 Steven（agently 两阶段确认）。

【兜底 / fail-safe】
- 证不出一律 `NEEDS_HUMAN`，绝不静默 `PASS`；`SUT_DEFECT` 须取证背书；
  自愈只对正向确证 `HARNESS_ERROR` 开闸且非就地、人签后应用。
- 入参畸形 fail-closed（`verdict` exit 65）；回放看门狗；熔断越阈写 inbox + exit 2；
  凭据兜底门落盘前深扫、命中拒写。

【排期（bootstrap P0-P10）】
- P0-P2 完成；P3 编译机制与真机 bring-up 已建（陌生站点示教/zero-shot 是后续增强）；
  P4 草拟冻结人签已建；P5 回放取证零 LLM 裁定已建；
  P6 自愈已于 2026-07-29 六阶段收口（`casey heal` 不再是桩，gate 6/6，这是本轮最大进展）；
  P7 报告主链已建；P8 web 已有、CEF 与 arbitrary 未完成；
  P9 tier-1 已建、tier-2 与真机 UAT 未完成；P10 可信闭环自进化未开始
  （晋升链、跨运行复验、自动撤销均未建）。

【当前契约 / 状态（2026-07-30 晨更新）】
- 07-29 晚至 07-30 晨三契约连闭：`teachin-clear-fill-admission`（清空 fill 误拒修+
  真机 54 事件实证）、`teachin-nav-expansion-recipe`（带槽双击导航配方，计划四轮+
  代码三轮评审，真机计划层 exit 0）、`teachin-cycle-evidence`（闭环取证边车，
  计划七轮+代码八轮 codex 评审，六阶段+A4 全兑现）。三契约 prd 全 gate GREEN、
  audit 落卷、Steven 签换签账。
- **真因已见光（07-30 晨真机实证）**：`RUN_COMPLETION_INVALID` 的真因=
  `raw-runner.event` seq 1 点击 `candidateCount:1, performOk:false`——元素定位唯一
  成功但点击执行失败（可操作性失败类：不可见/被遮挡/未稳定）。边车
  `runs/teachin-uat/tc_wf_list_smoke_cycle_20260730_0930/…/cycle-evidence.dc42acca….json`。
  机器侧 `bin/teachin-raw-replay.mjs` 可稳定复现（ACTION_FAILED seq 1），
  修复迭代不需要人录。真因修复=后继契约（点击可操作性）。
- 换签注意：`cycle-plan.static` 金牌现为六钉+威胁模型版（sha 31956edc，closure prd
  已换签），`record.mjs` 闭环包裹形状被刚性模板钉死——正当改写回调形状须人工复核
  同步改模板，别放宽。
- B-2 三例（catalog/publish/history）已裁剪到 sign-ready：三条脚本
  `runs/resign-20260729-b2/sign-and-verify-<caseId>.sh` 等 Steven `!` 执行；
  签后跑三次真机重跑出 B.5 正式报告。
- tier-2 契约（`p9-tier2-live-smoke`）：GRILL/plan 五轮 codex 批+Steven 签、
  红金牌 77 钉+manifest 草稿已备，等主树契约槽落地实现。
- 工作树仍全未提交（Steven 已裁「全部入库分批提」+push dev）——禁止 `git add -A`、
  按批次显式路径提交。

【下一步（任选其一）】
A. 后继契约：修点击可操作性真因（`teachin-raw-replay` 机器侧可复现，
   从「元素唯一定位但 performOk:false」入手查遮挡/可见性/稳定等待）。
B. B-2 收口：Steven 跑三条 `!` 签字线 → 三次真机重跑 → B.5 正式报告
   （report-to-pdf.mjs / video-to-mp4.mjs）。
C. tier-2 落地：主树槽空后 contract init，按已批 plan 实现 `selftest --tier2`。
D. 若 07-30 晨未完成：分批语义提交 + push origin dev + P9 账本收口。

【环境坑（WSL）】
- `/mnt/d` 的 git 慢，给足 300 秒；短超时的空输出别误判成干净工作树。
- 只用 WSL git、保持 LF；`hook-loop-guard` 会把带重定向且含 `bin/` 的命令误判成改实现拦下。
- `--sut` 只喂隧道回环基址；隧道现为 origin 保真代理形态，`site.json` 已配
  `transport.mode`；起隧道先 WSL 侧后 Windows 侧。
- 键盘：远程桌面下 WSLg 窗口收不到键；人在机器前英文可直敲，中文走 `clip.exe` 注入剪贴板。
- 禁止启动 fake-SUT 或夹具 SUT；金牌只跑 zero-SUT / static / 纯内存。

【硬约束】
裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据与真实目标地址不外泄；中文标准简体；
新概念先查 `CONTEXT.md`；完成只认真实退出码、真机证据与 Steven 人签；
不把桩、文件存在、静态绿或模型印象冒充完成。
```

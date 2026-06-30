---
name: session-handoff
description: 生成「能让零上下文的新 session 直接接手 Casey」的完整交接提示词。当用户说「给我提示词」「新 session 提示词」「写一份交接」「handoff」「换个 session 接着干，先给我开场词」时使用。按固定模板从已落文档取料（项目历史/开发准则/排期/DDD 统一语言/兜底机制/当前状态/下一步），产出可直接粘贴的开场词，并可写入 docs/NEXT-SESSION.md。只读综合，不改实现。
---

# session-handoff — Casey 新 session 交接提示词生成器

把「为新 session 写开场提示词」这件事固定成模板：用户只需说一句「给我提示词」，照本流程产出一份覆盖项目史/准则/排期/DDD/兜底/下一步的完整开场词，不用每次重新交代要包含什么。

## 铁律（违反即重来）

- **一切以已落文档为事实源，绝不现编**（记忆 [[ground-in-docs-before-acting]]）。冲突时**信最新**：`docs/HANDOFF.md` 的更新通常晚于 `docs/NEXT-SESSION.md`，二者矛盾以 HANDOFF 现状为准。
- **绝不在产出里发加粗英文 / 繁体字**：Stop hook + PostToolUse hook 会当场拦（ADR-0005）。英文术语一律用反引号包、别给拉丁字母加粗；中文一律标准简体。
- 这是只读综合：入口分流属**直干**（不改数据、不碰 `lib`/`bin`），无需 `contract init`。

## 流程

### 1. 取料（grounding）

并行 fan-out 4 个只读 Explore 子代理各取一块（记忆 [[prefer-subagent-fanout]]），各自返回结构化要点、不贴整段原文：

- **项目史 / 决策档案**：读 `docs/adr/*.md`（每个 ADR 一行：编号+标题+锁了什么）；`CLAUDE.md` 顶部血缘（Casey = autotester 翻面、复用 loop-kit）；`git log --oneline -25` 提炼里程碑提交时间线；`docs/HANDOFF.md` 的「已建成什么」。
- **排期 / 里程碑**：`docs/plans/bootstrap/plan.md`（P0–P9 一行一条+状态）；`docs/plans/roadmap-parallel.md` 文末「排期 v3」（三层结构、单 baton 上限、并行硬规则）；`docs/NEXT-SESSION.md` 的下一步与环境坑；HANDOFF「契约/运维」节的各契约状态。
- **DDD / 统一语言**：`CONTEXT.md` 全文（七相流水线职责、领域词汇表、弃用别名黑名单）；`docs/design/txt2testreport-design.md`（五层 LLM 准入边界、裁判与自愈分进程、三处 `casey` 标识符）。
- **护栏 / 兜底**：`loop/GUARDRAILS.md`（17 条逐条）；`CLAUDE.md` 硬规则；`bin/verdict.mjs`/`bin/replay.mjs`/`loop-kit/bin/breaker.mjs`/`loop-kit/bin/gate.mjs` 的实际兜底机制；`loop-kit/bin/contract.mjs` 的入口分流三档判据。

子代理在跑时不要自己重复读同一批文件。若只想快速刷新而非全量重取，可只跑「排期 + 契约状态」一块（其余从上次产出沿用）。

### 2. 填模板

把取回的要点填进下面「固定模板」的各节。校对：里程碑状态与契约状态以 HANDOFF 为准；下一步要可执行、给可点选项而非散文长问（记忆 [[use-askuserquestion-for-decisions]]）。

### 3. 交付

- 在回合输出里给出**可整段复制**的提示词（包在代码块里，term-clean）。
- 问用户是否同时写进 `docs/NEXT-SESSION.md`（写则替换该文件的「开场提示词」节、保留其余；这一步会触 term-lint，注意无加粗英文/繁体）。

## 固定模板（章节骨架，每次照填）

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
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名是黑名单、繁体禁用）
2. docs/HANDOFF.md（最新进度，冲突以它为准）
3. docs/NEXT-SESSION.md（环境坑）
4. loop/GUARDRAILS.md（17 条护栏逐条有效）
5. 追溯「为何这么定」：docs/adr/（架构决策）、docs/decisions/（需求决策）、docs/design/（端到端设计）

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
<填：ADR 0001–00NN 各锁了什么；P0→当前的关键 commit 时间线>

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile → 相2 冻结+人签 sign → 相3 回放 replay
  → 相4 裁定 verdict → 相5 自愈 self-heal → 相6 报告 report。
- 核心领域词汇：<填：三轴 StepAxes、多态裁定四态 PASS/SUT_DEFECT/HARNESS_ERROR/NEEDS_HUMAN、
  点击身份门、网络取证按发起方归因、只读漂移探针、通道剖面、错误信封、静默点、
  观测现状、冻结断言契约、人签门、TestCase 聚合根 …各一行白话>
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 /
  报告渲染 / 凭据兜底门）；LLM 手术刀仅 L1 归一·L2 断言草拟·L3 编译与自愈执行；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者、绝不反向进裁判进程。
- DDD 落法：CONTEXT.md 即 ubiquitous language 注册表，term-lint 机制强制统一语言、命名先查既有学科。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（直干|轻契约|全流水线），
  hook-loop-guard 按 contract 互锁；缺上一阶段交付物拦红。
- 入口分流三档：direct=只剩地板全放行；light=加 plan 门（跳 grill、留 plan+accept+loop）；
  full=全链（碰冻结内核 lib/bin 必走）。accept 任何车道都不跳。
- passes 只 gate 写：prd 的 passes 仅 loop-kit/bin/gate.mjs 有权写；testChecksums 冻结文件对实现者只读。
- 双 hook 术语拦截：回合输出与写入 md/json 都被 term-lint 扫，违例/繁体/未登记加粗英文拦红。
- 护栏 17 条要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 /
  #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 /
  #16 gate 绿≠完成（需人签真机）/ #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 点击身份门：action 轴缺失/畸形→false；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN，绝不当做对。
- 取证按发起方归因（非时间窗）：仅 attributedStepId===本步才背书；背景轮询 401 不翻本步 verdict。
- 自愈门：须 resolution==='none' 正向 miss + 同稳定签名唯一仍在；缺证据落 INDETERMINATE。
- 入参畸形 fail-closed（verdict exit 65）；回放看门狗 75s 强退；归因证不出归 null；
  行计数失败回 null 不回 0（防 countChange===0 假绿）；熔断器越阈写 Inbox+exit 2；
  gate 默认 FAIL 凭三检查翻绿；凭据兜底门落盘前深扫敏感词、命中拒写。

【排期】
- P0–P9 现状：<填：每个 P 一行+状态（已完成/进行中/未开始）；标 MVP 第一刀 P0→P5+P7>
- 排期 v3 三层：第0层（引擎+裁判内核，已完成）→ 第1层 接缝冻结（总钥匙，已完成）→
  第2层 并行 hermetic 建造（各轨 worktree 起草+串行合并）→ 第3层 集成（真数据端到端，未开始）。
- 单 baton 上限：loop-kit 单活契约（主树共享 loop/active-contract.json 一槽），
  LOOP_CONTRACT_FILE 参数化 + breaker --state 未建 → 多 full 契约真并行落地暂不支持；
  并行只用在不碰 baton 的 fan-out（研究/grill/schema/golden 起草/异构评审）。
- 并行硬规则：碰 lib/bin 的落地走 worktree 隔离 + git-native 合并（merge/apply），绝不 cp 进 lib/bin。

【当前契约 / 状态】
<填：active-contract 是谁、各 loop 契约状态（loop done / review / learn 待）、gate 绿几比几、本仓无 git 远端>

【下一步（任选其一，先对齐再动手）】
<填：A/B/C… 可点选项，每条带依赖与一句目标>

【环境坑（WSL）】
- 行尾/checksum 已核实整库 LF 一致；查行尾别用 grep -c $'\r'（git-bash 下退化误报），用 node 数 0x0d。
- loop-guard：读类命令带重定向且含 bin/ 路径会被误判 edit-impl 拦——直接跑别加重定向；cp/rm 进 lib/ 会被拦。
- 路径：D:\→/mnt/d/；M:\home 禁用，产物先问确切路径。playwright 装 Linux 版（非借 Windows chromium）。
- 别在 /mnt/d 混用 Windows git 与 WSL git（filemode/CRLF 假报）。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
可并行的活优先 fan-out 子代理；决策分岔用可点选项呈现、别散文长问。
```

## 维护

模板章节骨架是固定的；只有「<填…>」处随项目推进刷新。新增护栏 / ADR / 里程碑时，更新本 SKILL.md 对应行，使模板与 `CONTEXT.md`、`GUARDRAILS.md`、`HANDOFF.md` 不漂移。

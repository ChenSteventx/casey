# loop-kit-extract 方案评审备料

> 本文件是喂给异构冗余评审（实现方=Claude 规划，评审方=`codex`，评审家族≠规划家族）的**唯一输入**。按护栏 #9：评审料只含 spec/plan 与门禁证据，不含任何凭据、不含规划者的内心推理过程。以下依次是评审指令、关键设计裁量清单、`ADR-0008` 全文、`GRILL.md` 全文、`plan.md` 全文。

## 评审指令

这是把 `gate`/`contract`/hook 等强制层源头搬迁到独立包（`loop-kit-extract` 契约）的 `kernel` 级设计评审——本轮只评审方案本身（GRILL 决策 + plan 骨架），尚未动任何实现字节。请重点核查：

1. 无 `node_modules` 的新 `worktree` 场景下，hook/`gate` 是否留有 fail-open 缺口；
2. `shim`（垫片，转发层）与直指包路径两种方案的降级行为是否 fail-safe；
3. 兼容金牌是否真能钉住行为等价（会不会假绿，即测试通过但实际行为已漂移）；
4. 切换点的可回滚性是否成立；
5. `prd` 验收命令路径的涟漪是否有遗漏；
6. 是否顺手夹带了不属于本契约范围的改动面。

请按 `HIGH`/`MED`/`LOW` 分级列出发现（findings）；若确无发现，给出 `PASS`。

## 关键设计裁量清单（简报要点）

1. 消费形态三选一选①`in-repo` 薄 `shim` 转发（对比②hook 直指包路径=三冻结金牌+多 `prd` 重签+`settings.json`/`CLAUDE.md` 全改、③`bin` 目录作安装产物=复活 `ADR-0008` 要杀的第三变体）；`shim` 十余行零业务逻辑，模板形状被金牌 C5 钉死。
2. `ROOT` 解析是全案唯一语义改动面：包内新增 `lib/root.mjs` 单点 `resolveRoot()`（`LOOP_KIT_ROOT` 环境变量→`cwd` 上溯 `loop/config.json`→exit 64），七件含 `ROOT` 锚定的脚本换用；`hook-stop`/`hook-loop-triage`/`review-deepseek` 逐字节照搬。
3. `shim` 主模式必须 `spawn` 包内脚本而非纯 re-export——`contract`/`term-lint`/`ratchet` 以 `argv[1]` 判 CLI 主模式，纯 `import` 会让 CLI 哑火（勘定发现的硬约束）；库模式动态 `import`+显式名单 re-export（`contract` 18 名/`term-lint` 3 名/`ratchet` 4 名）。
4. `shim` 以自身位置无条件覆盖写 `LOOP_KIT_ROOT`（非 `??=`）——防树 A 进程派生跑树 B `shim` 时继承树 A 的 `ROOT`（跨树污染），语义与今日位置锚定逐字等价。
5. 无 `node_modules` 新树零安装可跑：包定位 `LOOP_KIT_PKG` 环境变量（测试逃生口）→静态兄弟约定 `../../../loop-kit`；`contract worktree` 默认落点即兄弟目录，结构前提实证成立。
6. 降级矩阵（包缺失）：CLI exit 64+补救提示；`hook-loop-guard` exit 2 拦（对「hook 自身故障 fail-open」的定向加严，防阶段互锁静默失守）；lint 三 hook exit 0+`WARN`（沿 `ADR-0005` lint 永不阻塞）。
7. 迁移清单：8 字节一致件+`contract.mjs`（Casey 版为准含 `worktree` baton）+`ratchet.mjs`（Casey 独有）全量入包+新 `root.mjs`；两仓 `loop-kit/` 现均只有 `bin/`、无 `schema`/模板可迁；P0-4a/4b 新原语直接在包内出生（非本契约）。
8. 兼容金牌 C0–C6：C0 包字节对期望存档（`tests/fixtures/loop-kit-expected/`，机械 `ROOT` 行替换+人审）`sha256` 逐文件相等兼作跨仓棘轮；C1 API 面 `deepEq`；C2 标记包转发证明+五命令行为等价；C3 无 `node_modules` 临时 `worktree` 互锁/门禁等价+跨树自锚；C4 降级矩阵逐格；C5 `shim` 模板形状；C6 三份存量冻结金牌零字节改动零重签。
9. 涟漪归零实证：全仓 68 `prd` 的 `testChecksums` 无一冻 `loop-kit/bin` 文件；仅 `prd-p2-intent-compile`（2 命令）与 `prd-ratchet-reverse-index`（1 命令）引路径、经 `shim` 原样生效——重签清单为空；`.claude/settings.json` 与 `CLAUDE.md` 常用命令零改动，治理面只剩 `CLAUDE.md` 加一段 bootstrap+`CONTEXT.md` 词条，归本契约收尾不另开小契约。
10. 切换点单提交可回滚：包仓先落成自提交（Casey 零改动、旧拷贝仍唯一生效源）→Casey 十 `shim`+金牌+存档+`prd`+文档一个提交→`git revert` 一步回滚；在飞并行树带旧引擎自洽照跑、合并冲突按护栏 #18 `route:human`。

## `ADR-0008` 全文

```markdown
# ADR-0008：loop-kit 提取为独立包，Casey 先迁、autotester 后迁

- 状态：已接受（Steven 2026-07-13 拍板，loop 双 profile 改革 P0-3）
- 日期：2026-07-13

## 背景

autotester ADR-0001 约定「提取触发条件 = 第二消费者出现」；Casey ADR-0001 改为「先拷贝同仓、同步痛感超过提取成本再提取」（YAGNI）。两 ADR 张力在 loop 双 profile 改革（`docs/plans/loop-dual-profile-reform/PROPOSAL.md`，唯一活动改革设计源）立项时到期：实测两仓 8 份脚本仍字节一致（`breaker`/`gate`/`hook-loop-guard`/`hook-loop-triage`/`hook-posttool`/`hook-stop`/`review-deepseek`/`term-lint`），但 Casey 的 `contract.mjs` 已为 worktree baton 分叉、`ratchet.mjs` 为 Casey 独有新增——分叉在扩大；改革还将新建 `workflow-state.mjs`/`orchestrate.mjs`/schema 并重改 `gate`/`contract`/hook。不定所有权就动工，必然造出第三个不同步变体（提案 §12.1 明令禁止静默复制粘贴演化）。

两条候选路线（提案 §12.1）：① 立即提取独立包（bold，提案推荐）；② 新 ADR 宣告 Casey 专用分叉、停止字节一致声明，稳定后再议提取。评审（`FABLE-REVIEW-DISPOSITION.md`）确认二选一皆可接受、但必须先决后动。

## 决策

1. **走路线 ①：立即提取**。通用引擎、schema、runner 契约提取为本地独立 `loop-kit` 包（形态沿 autotester ADR-0001 预定：独立仓 + npm 本地路径依赖分发确定性脚本；落点默认兄弟目录 `/mnt/d/ctx/heren/loop-kit`，最终以提取契约 GRILL 定案为准）。
2. **迁移次序**：Casey 经兼容性金牌先迁（字节/API 兼容金牌先行，迁移期间旧 in-repo 拷贝保持唯一生效源直到切换点）；autotester 后迁、单独有界工作流，不触其无关脏测试数据。
3. **源头真相边界**（提案 §12.1）：通用转移/schema/gate 原语归提取后的 loop-kit 包；项目侧适配器、`loop/config.json`、context map、`prd-*.json` 实例、`GUARDRAILS.md`、`CONTEXT.md` 留各仓。Casey 已分叉件归位：`contract.mjs` worktree baton 能力与 `ratchet.mjs` 属通用编排域，随提取入包。
4. **治理**：提取本身触强制层（`gate`/`contract`/hook 的源头搬迁），按 `kernel` 级治理走——双设计审 + 异构冗余实现审 + 全仓门禁 + Steven 人签；在 `kernel` 车道机制建成前以 `full` 车道 + 上述加严约定执行（先例：`resolution` 契约）。
5. **改革衔接**：P0-4a（状态引擎）/P0-4b（gate 分层）的新原语在提取后的包内建造，不再往 in-repo 拷贝上叠新面。

## 后果

- 收益：从第一天杀死第三变体漂移；两仓共享一个内核与一套内核金牌；autotester ADR-0001 的提取触发承诺兑现。
- 代价：P0 期间每刀都在双消费者共享包上改，跨仓兼容金牌负担前置；改革体量变大（评审已知情标注，Steven 仍选此路线）。
- 兑现关系：本 ADR 取代 Casey ADR-0001 决策第 1/4 条（「先拷贝同仓」「推迟独立成仓」——其分界线原则与数据契约锚定原则继续有效）；兑现 autotester ADR-0001 决策第 3 条的触发器。autotester 侧的对应 ADR 更新在其迁移工作流内落，不在本仓代办。
```

## `GRILL.md` 全文

```markdown
# loop-kit-extract — grill 决策记录（loop-kit 提取独立包 + Casey 兼容迁移，full/kernel 级加严）

> baton 已立于本 worktree（lane full，理由见台账）；本文与 `plan.md` 是 grill/plan 两阶段交付物。授权凭据：Steven 2026-07-13 主会话点选路线① + ADR-0008 已接受。实现开工另被 kernel 级设计人签门阻断——本轮只规划，不动任何实现字节。
> 事实源：`docs/adr/0008-loop-kit-extraction.md`（路线①已定，本文不翻案）、`docs/plans/loop-dual-profile-reform/PROPOSAL.md` §12.1/§13/§14、Casey `docs/adr/0001-reuse-loop-kit.md`、autotester `docs/adr/0001-loop-kit-incubation.md`（预定分发形态）、`loop-kit/bin/` 十脚本头注、`.claude/settings.json`、全仓 grep 勘定（清单见 `plan.md` §0）。

## 背景（勘定实证，2026-07-13 本树 HEAD=0e7c415）

- 两仓逐字节 `cmp` 复核：8 份脚本字节一致（`breaker`/`gate`/`hook-loop-guard`/`hook-loop-triage`/`hook-posttool`/`hook-stop`/`review-deepseek`/`term-lint`）；`contract.mjs` 已分叉（Casey 版带 `worktree` baton 全套）；`ratchet.mjs` 为 Casey 独有。与 ADR-0008 背景陈述一致。
- 十脚本全部以自身文件位置锚定仓根：`ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')`。提取后包在消费仓之外，此锚定必然指错（会指到 `/mnt/d/ctx/heren`）——ROOT 发现方式是全案唯一必须的语义改动面（D4）。
- `contract.mjs`/`term-lint.mjs`/`ratchet.mjs` 以 `argv[1] === fileURLToPath(import.meta.url)` 判 CLI 主模式：若薄转发层只做动态 import，包内判据不成立、CLI 哑火。故转发层主模式必须 spawn 包内脚本（argv[1] 即包路径，判据原样成立、包内 CLI 尾块零改动）（D4）。
- 消费面锚点（grep 全量）：`.claude/settings.json` 四条 hook 均挂 `$CLAUDE_PROJECT_DIR/loop-kit/bin/...`；`bin/term-guard.mjs`/`bin/term-guard-hook.mjs` import `../loop-kit/bin/term-lint.mjs`；三份冻结金牌 import `../../loop-kit/bin/{contract,term-lint,ratchet}.mjs`；两份 prd 的 acceptance 命令 + `loop/config.json` 的 `review.fallbackRunner` + `package.json` scripts 三条引 `loop-kit/bin` 路径。全部按「路径一个不改」设计归零涟漪（D3）。
- 全仓 68 个 prd 的 `testChecksums` 无一冻结 `loop-kit/bin` 文件（脚本核验 0 命中）——原地替换为转发层不触任何既有棘轮。

## D1 车道与治理

- full 车道 + kernel 级加严约定（ADR-0008 决策 4，`resolution` 契约先例）：双设计审 + 异构冗余实现审 + 全仓门禁 + Steven 人签；`kernel` 车道机制建成前以 `full` 车道承载。
- 本 baton 以此立（laneReason 记档）。grill/plan 由本轮交付；accept 起的每一步以 Steven 对本设计的人签为前置（route:human #1）。

## D2 包仓落点与形态

- 落点：`/mnt/d/ctx/heren/loop-kit`，独立 git 仓（ADR-0008 默认落点 + autotester ADR-0001 预定形态）。它与 casey 主仓、各并行 `worktree` 天然同层——`contract worktree` 的默认落点就是兄弟目录 `../<仓名>-<slug>`（`contract.mjs` 实证），这是 D4 兄弟目录解析成立的结构前提。
- 新仓 fresh `git init`、不搬两仓历史；出处以 SHA 记入包 `README.md`（提取自 casey@切换点 SHA；8 份与 autotester 字节一致件的对齐基线一并记档）。（route:human #3）
- 包 `package.json`：name `loop-kit`、`private: true`、`type: module`、engines node>=22.12、零第三方依赖（内核「零依赖、纯 node」纪律不变）。
- 分发双出口（autotester ADR-0001 决策 3）：npm 本地路径依赖（`file:../loop-kit`，声明层，route:human #4）+ 兄弟目录直解析（实际生效层，见 D4——新 `worktree` 无 `node_modules` 也零安装可跑）。「个人 skill 编排层」这第二出口不在本契约（D10）。
- 凭据仍走 `~/.loop-kit/`（仓外），一字不动。

## D3 消费形态三选一（核心裁量）——选 in-repo 薄转发层

| 方案 | 无 `node_modules` 新树 | 涟漪面 | 切换/回滚 |
|---|---|---|---|
| ① in-repo 薄转发层（选定） | 兄弟目录直解析，零安装即跑 | 零：hook/金牌/prd/命令路径全不变 | 单提交，revert 一步回滚 |
| ② hook 直指包路径 | hook 可跑，但三份冻结金牌、`bin/term-guard*` import、prd acceptance 命令的 in-repo 路径全断 | 三金牌重冻 + 其 prd 重签 + `settings.json`/`CLAUDE.md`/skills 改 | 多点散布，回滚不原子 |
| ③ 保留 `bin` 目录为安装产物（同步拷贝） | 可跑 | 表面为零 | 正是 ADR-0008 要杀死的第三变体：安装产物就是又一份会漂的拷贝，字节一致声明重新变成手工纪律 |

选①理由：`loop-kit/bin/*.mjs` 十个文件原地换成同名薄转发层（下称 `shim`，待登记词见 `plan.md` §6），所有既有消费路径——hook 挂载、库 import、acceptance 命令、npm scripts、文档命令——一个字节不用改；兼容性由金牌钉死（D7）；切换 = Casey 侧一个提交，回滚 = revert 该提交（D9）。②把涟漪推给冻结面，违「切换点单提交可回滚」的任务硬约束；③复活 ADR-0008 明令杀死的漂移。

## D4 `shim` 协议与 ROOT 解析（唯一语义改动面）

- 包内新增 `lib/root.mjs`，单点 `resolveRoot()`：`LOOP_KIT_ROOT` 环境变量（含目录存在校验）→ 自 `process.cwd()` 逐级上溯找 `loop/config.json` 标记 → 都无则 stderr 补救提示 + exit 64（对齐 `gate` 既有「用法/契约缺失」退出码语义）。含 ROOT 锚定的七件（`breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet`）换用它；`hook-stop`/`hook-loop-triage`/`review-deepseek` 无 ROOT 锚定、逐字节照搬。
- `shim`（每件十余行、零业务逻辑，模板形状被金牌 C5 钉死）：
  - 包定位：`LOOP_KIT_PKG` 环境变量（测试与非常规布局的显式逃生口）→ 静态兄弟约定 `new URL('../../../loop-kit', import.meta.url)`。因各 `worktree` 与包同层，任何新树零安装即解析成功。
  - ROOT 注入：以 `shim` 自身位置**无条件覆盖**写 `LOOP_KIT_ROOT`（= `shim` 的 `../..`）——语义与今日位置锚定逐字等价、每树自锚。无条件覆盖是防跨树污染：树 A 的进程派生跑树 B 的 `shim` 时，绝不许树 B 继承树 A 的 ROOT（金牌 C3 钉死）。
  - CLI 主模式（`argv[1]` 是 `shim` 自身）：`spawnSync(node, [包内同名脚本, ...argv], stdio 继承)`，退出码透传、stdin/stdout/stderr 原样流经（hook 的 stdin JSON 协议不受影响）。
  - 库模式（被 import）：动态 import 包内模块 + 显式名单 re-export——`contract` 18 名、`term-lint` 3 名（`parseRegistry`/`scanText`/`lintFiles`）、`ratchet` 4 名；名单被金牌 C1 对提取前快照 deepEq 钉死，漂一个名即红。其余七件无库消费者，`shim` 只做 CLI 主模式。
- `LOOP_CONTRACT_FILE` 既有覆盖口、`loop/` 运行态（baton/熔断态 gitignored 每树一份）语义一律不动（护栏 #18 不触）。

## D5 fail-safe 降级矩阵（包缺失时，逐格冻进金牌 C4）

| 入口 | 行为 | 理由 |
|---|---|---|
| CLI `shim`（`gate`/`contract`/`breaker`/`term-lint`/`ratchet`/`review-deepseek`） | exit 64 + stderr 补救提示（clone 包到兄弟目录，或设 `LOOP_KIT_PKG`） | 与门禁「默认 FAIL、凭证据翻绿」同族：引擎证不出在场就不给任何绿 |
| `hook-loop-guard` `shim` | exit 2 拦 | 包缺失是可确定性判死的环境错误，不是意外异常：若沿用 fail-open，新 clone 忘配包 = 阶段互锁静默失守（护栏 #11 掉牙、冻结面裸奔）。这是对「hook 自身故障不阻塞」既有约定的一次**定向加严**（route:human #2） |
| `hook-stop`/`hook-posttool`/`hook-loop-triage` `shim` | exit 0 + 一行 WARN | 沿用 ADR-0005 已文档化立场：lint 监督层永不阻塞正常工作（fail-open 仅限 lint/hook，护栏语义原文） |

包内脚本自身的既有 fail-open/fail-closed 语义（各头注约定）一律不动；上表只约束 `shim` 在「包解析失败」这一新增故障面的行为。

## D6 迁移清单与源头真相边界

- 入包：十脚本全量——8 份字节一致件 + `contract.mjs`（**以 Casey 版为准**，含 `worktree` baton 全部纯函数与 CLI；ADR-0008 决策 3「已分叉件归位」）+ `ratchet.mjs`（Casey 独有件）——外加新 `lib/root.mjs`。字节保真：除 ROOT 锚定行外逐字节照搬，「提取只是搬目录、不是重构」（两仓 ADR-0001 共同原则）；差异面由评审以 diff 白名单核。
- 留 Casey（ADR-0001 分界线 + ADR-0008 决策 3）：`CONTEXT.md`、`loop/GUARDRAILS.md`、`loop/config.json`、`loop/prd-*.json` 实例、`loop/` 运行态、`bin/term-guard*.mjs`（Casey 侧统一语言补充件，经 `shim` 继续 import）、ADR 与 docs、`.claude/` 全部。
- schema/prompt 模板归属：按 ADR-0001 分界线归 kit——但勘定实证两仓 `loop-kit/` 目录当前都只有 `bin/`，本契约无 schema/模板可迁。改革 P0-4a/4b 要新造的 `workflow-state`/`orchestrate`/schema 直接在提取后的包内出生（ADR-0008 决策 5），不属本契约（D10）。
- autotester 在其自己的迁移工作流之前继续用它的 in-repo 拷贝（对它而言唯一生效源不变）；届时其 `contract.mjs` 对齐 Casey 版、其 ADR 更新在其仓落——均非本契约（ADR-0008 决策 2/后果）。

## D7 兼容性金牌设计（先红后绿，冻进 `loop/prd-loop-kit-extract.json`）

新金牌 `tests/_golden/loop-kit-extract.golden.mjs` + 期望存档 `tests/fixtures/loop-kit-expected/`。期望存档 = 预期包内容：对提取前 HEAD 十脚本做机械 ROOT 行替换后的存档，人审 diff 后随 prd 冻结——这是 Golden Test 的「人工确认过的存档」范式，惰性数据、绝不执行，不构成第三变体。

- C0 搬运保真 + 跨仓棘轮：包内 `bin/*.mjs` 与 `lib/root.mjs` 对期望存档逐文件 sha256 相等。红：包不存在。绿：包落成。此 pin 兼作跨仓兼容棘轮：日后任何包改动（含 autotester 侧发起的）必先改 Casey 期望存档 + 重签 `prd-loop-kit-extract`——ADR-0008 已认的「兼容金牌负担前置」的机制形态（route:human #5）。
- C1 API 面 deepEq：经 `shim` 动态 import 的 `contract`/`term-lint`/`ratchet` 导出名集合，对提取前 in-repo 快照（18/3/4 名，写死在金牌里）deepEq。红：包缺失或名单漂移。
- C2 转发证明 + 全命令行为等价：先以 `LOOP_KIT_PKG` 指向测试标记包证明 `shim` 真转发（提取前的全量引擎无视该变量 → 红基线）；再经真包跑 `gate --dry` / `contract init·advance·check·show·list` / `breaker --reset·--round` / `term-lint --registry·--file·--stdin` / `ratchet index`，exit code + 关键输出对钉死期望逐条相等。
- C3 无 `node_modules` 新树：临时 git `worktree`（确保无 `node_modules`，复用 worktree-baton 金牌的真接缝驱动范式）内跑 `hook-loop-guard` 互锁（合成 PreToolUse stdin JSON）与 `gate`/`contract`，行为与主树等价；并断言跨树派生时 `LOOP_KIT_ROOT` 以被执行 `shim` 的位置为准（树 B 的 baton 写进树 B，绝不写树 A）。
- C4 降级矩阵：`LOOP_KIT_PKG` 指向空目录模拟包缺失——逐入口断言 D5 表（CLI 64 / guard 2 / lint 0+WARN）。红：提取前无降级协议。
- C5 `shim` 零逻辑：十个 `shim` 匹配模板形状（行数上限 + 必含转发与注入标志 + 不含引擎特征串），杀 `shim` 层第三变体。红：现文件是全量引擎。
- C6 存量零重签（非回归钉）：三份冻结金牌（`worktree-baton`/`term-guard`/`ratchet-reverse-index`）与其 prd 零字节改动、经 `shim` 复跑照绿；全仓 gate 复验 GREEN + `ratchet index` 复验。此项无红基线（守既有绿），豁免理由记档于 plan §3。

## D8 治理面与涟漪（重签清单 = 空）

- `.claude/settings.json`：零改动（hook 路径原样生效）。
- `CLAUDE.md`：常用命令零改动；新增一段「`loop-kit` 已提取为兄弟目录独立包（ADR-0008），新机器 bootstrap 需先把包 clone 到 `/mnt/d/ctx/heren/loop-kit`」。**归本契约收尾**、不另开小契约——一段纯文档不值一个 baton，且与切换同提交才不出现文档与事实脱节窗口。
- prd acceptance 涟漪 grep 全量（证据见 plan §0）：`prd-p2-intent-compile`（2 条 `term-lint` 命令）、`prd-ratchet-reverse-index`（1 条 `ratchet index` 命令）——路径经 `shim` 原样生效，命令零改动；`prd-model-lane-guard` 仅 dimension 散文提及、无命令。**重签清单为空。**
- `loop/config.json` 的 `review.fallbackRunner` 路径不变；`package.json` scripts 三条不变；是否在 casey `package.json` 增加 `"loop-kit": "file:../loop-kit"` 依赖声明（兑现 ADR 预定形态 vs 实际解析已走兄弟约定、声明近乎装饰）——route:human #4。
- `CONTEXT.md`：更新 `loop-kit` 词条白话解释（提取已发生、指 ADR-0008）+ 登记 `shim` 新词（四列制，见 plan §6）；随切换提交落，先于任何使用。

## D9 切换点单提交可回滚

- 次序：包仓先落成并自提交（此时 casey 树零改动，旧 in-repo 拷贝仍是唯一生效源——ADR-0008 决策 2 的迁移期约定）→ Casey 侧**单提交切换**（十 `shim` + 金牌 + 期望存档 + prd + `CLAUDE.md`/`CONTEXT.md` 词条 + 交接文档）→ 全仓门禁复验。
- 回滚：`git revert` 该切换提交，一步回到全量 in-repo 引擎；包仓存在但无消费者，惰性无害。
- 在飞并行树：其分支仍带旧引擎、位置锚定自洽照跑；合并进 dev 时若 `loop-kit/bin` 冲突（罕见，内核文件极少被功能契约触碰）按护栏 #18 合并纪律 route:human。

## D10 非目标（本契约不做）

- autotester 侧迁移与其 ADR 更新（另一有界工作流，不触其无关脏测试数据）。
- P0-4a/4b 新引擎原语（`workflow-state`/`orchestrate`/schema/gate 分层）——提取后另立契约在包内建造。
- 任何 `verdict`/`sign`/凭据面/回放/报告业务行为改动；`loop/GUARDRAILS.md` 条目增删；`loop/config.json` 语义改动。
- npm registry 发布、CI、语义化版本流程（个人本地路径依赖场景，YAGNI）。
- 「个人 skill 编排层」分发出口（autotester ADR-0001 预定第二出口）——后续小契约。
- 两仓 hook 头注里的历史坏路径文案（如 `hook-loop-triage` 指向的旧决策文档路径）——字节冻结照搬，已有账（`prd-model-lane-guard` dimension），不顺手改。
```

## `plan.md` 全文

```markdown
# loop-kit-extract — loop-kit 提取独立包 + Casey 兼容迁移（full/kernel 级加严）

> baton 已立于本 worktree（lane full）。决策全集见 `docs/plans/loop-kit-extract/proposed/GRILL.md`（D1–D10）；本文是计划骨架 + 验收点。实现开工前置：Steven 对本设计的 kernel 级人签（未签不动任何实现字节）。
> 决策依据：ADR-0008（路线①立即提取，已定不翻）、`docs/plans/loop-dual-profile-reform/PROPOSAL.md` §12.1/§13/§14、Casey ADR-0001（分界线与数据契约锚定原则继续有效）、autotester ADR-0001（分发形态：独立仓 + npm 本地路径依赖 + 个人 skill 编排层）。

## 背景

两仓 8 份脚本字节一致、`contract.mjs` 已分叉、`ratchet.mjs` Casey 独有——分叉在扩大，而改革 P0-4a/4b 还要在这套内核上新建原语。不定所有权就动工必然造出第三个不同步变体（提案 §12.1 明令禁止）。ADR-0008 已拍板路线①：通用引擎提取为本地独立 `loop-kit` 包，Casey 经兼容性金牌先迁，autotester 后迁。本契约就是这次提取与迁移本身：**内核行为一字不让**——确定性是默认、完成是退出码、裁判零 LLM 的纪律面，提取前后逐命令等价。

## 0. 涟漪勘定（grep 全量，2026-07-13 本树 HEAD=0e7c415）

消费面清单（选定 GRILL D3 方案①后全部按「路径一个不改」归零）：

- hook 挂载：`.claude/settings.json` 四条（`hook-loop-triage`/`hook-loop-guard`/`hook-stop`/`hook-posttool`，均 `$CLAUDE_PROJECT_DIR/loop-kit/bin/...`）——零改动。
- 库 import：`bin/term-guard.mjs`、`bin/term-guard-hook.mjs`（要 `parseRegistry`）；`tests/_golden/worktree-baton.golden.mjs`（`import * as C` + 驱真 CLI）；`tests/_golden/term-guard.golden.mjs`（`parseRegistry`）；`tests/_golden/ratchet-reverse-index.golden.mjs`（`normalizeRepoPath` 等 4 名）——经 `shim` 显式名单 re-export 原样生效，**三份冻结金牌零字节改动、零重签**。
- prd acceptance 命令：`loop/prd-p2-intent-compile.json`（`node loop-kit/bin/term-lint.mjs --registry`、`node loop-kit/bin/term-lint.mjs --file ...` 两条）、`loop/prd-ratchet-reverse-index.json`（`node loop-kit/bin/ratchet.mjs index` 一条）——命令路径经 `shim` 原样生效；`loop/prd-model-lane-guard.json` 仅 dimension 散文提及、无命令。**重签清单 = 空。**
- 其余：`loop/config.json` 的 `review.fallbackRunner`（`loop-kit/bin/review-deepseek.mjs`）、`package.json` scripts 三条（`term-lint`/`gate`/`breaker`）、`CLAUDE.md` 常用命令、`.claude/skills/*` 文档命令——全零改动。
- `testChecksums` 勘定：全仓 68 个 prd 无一冻结 `loop-kit/bin` 文件（脚本核验 0 命中）——原地替换为 `shim` 不触任何既有棘轮；`gate` 以 `cwd=ROOT` 执行 acceptance，树内相对路径命令语义不变。
- CLI 主模式判据：`contract`/`term-lint`/`ratchet` 以 `argv[1]` 对齐自身路径判 CLI——`shim` 主模式必须 spawn 包内脚本，不能纯 re-export（GRILL 背景，金牌 C2 钉转发证明）。
- 术语纪律：新词见 §6 待登记；英文一律代码体、加粗只给中文；写入过 `term-lint` 双 hook。

## 1. 改动清单

A. 包仓侧（`/mnt/d/ctx/heren/loop-kit`，新独立 git 仓，fresh init）

1. `bin/` 十脚本迁入，字节保真：唯一允许差异 = ROOT 锚定行换 `resolveRoot()`（涉及 `breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet` 七件）；`hook-stop`/`hook-loop-triage`/`review-deepseek` 逐字节照搬。`contract.mjs` 以 Casey 版为准（含 `worktree` baton 全套）；`ratchet.mjs` Casey 独有件入包。CLI 尾块（`isMain` 判据）零改动。
2. `lib/root.mjs`（新，全案唯一新逻辑）：`resolveRoot()` 单点——`LOOP_KIT_ROOT` 环境变量（目录存在校验）→ 自 `process.cwd()` 上溯找 `loop/config.json` → stderr 补救 + exit 64。
3. `package.json`（name `loop-kit`、private、`type: module`、engines node>=22.12、零依赖）+ `README.md`（出处 SHA、双消费者、ADR-0008 与 autotester ADR-0001 指针、兄弟目录布局约定）。

B. Casey 侧（单提交切换点，GRILL D9）

4. `loop-kit/bin/*.mjs` 十件原地换同名 `shim`（GRILL D4 协议：包定位 `LOOP_KIT_PKG` → 兄弟约定；ROOT 无条件注入自锚；主模式 spawn 退出码透传；库模式显式名单 re-export，`contract` 18 名 / `term-lint` 3 名 / `ratchet` 4 名；GRILL D5 降级矩阵）。
5. `tests/fixtures/loop-kit-expected/`：期望包内容存档（对提取前 HEAD 十脚本机械替换 ROOT 行 + `lib/root.mjs` 期望件；人审 diff 后随 prd 冻结；惰性数据绝不执行）。
6. `tests/_golden/loop-kit-extract.golden.mjs`：C0–C6（见 §3）。
7. `loop/prd-loop-kit-extract.json`：冻结金牌 + 期望存档 checksum；stories 见 §3。
8. `CLAUDE.md` 新增 bootstrap 一段（包为兄弟目录独立包、新机器先 clone；常用命令不变）+ `CONTEXT.md`（`loop-kit` 词条白话解释更新、`shim` 词条登记，§6）。
9. `docs/HANDOFF.md`、`docs/NEXT-SESSION.md` 刷新（文档先于 dev 提交）。

## 2. 实现次序（红先行）

0. 前置：Steven kernel 级设计人签（对 GRILL + 本 plan 整体）。未签不进下一步。
1. accept 阶段（本树）：生成期望存档（§1.5）+ 写金牌（§1.6）→ 跑**红基线**（C0 红=包不存在；C2 转发证明红=全量引擎无视 `LOOP_KIT_PKG`；C4 红=无降级协议；C5 红=现文件非 `shim`；C6 照绿=非回归钉）→ 建 `loop/prd-loop-kit-extract.json` 冻结 → `contract advance accept --red-verified`。
2. 落包仓（§1.1–1.3）：casey 树零改动，旧 in-repo 拷贝仍唯一生效源；包首提交后 C0/C1 转绿。
3. Casey 侧单提交切换（§1.4–1.9 同一提交）：C2–C5 转绿。
4. 全仓复验：`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json` 全绿；三份存量金牌所属 prd 的 gate 复跑 GREEN；`node loop-kit/bin/ratchet.mjs index` 复验；`node bin/casey.mjs selftest --tier1` 无回归。
5. `contract advance loop` → 异构冗余实现审（codex 评 Claude 实现；输入只给 spec+diff+门禁证据，护栏 #9）→ `advance review` → Steven 人签收尾 → `advance learn`。

## 3. 验收点（可执行规格，冻进 prd）

story 划分与红/绿判据：

- S1 包保真（C0+C1）：**红** = 包不存在；**绿** = 包内 `bin/*.mjs` + `lib/root.mjs` 对期望存档逐文件 sha256 相等，且经 `shim` import 的 `contract`/`term-lint`/`ratchet` 导出名集合对提取前快照（18/3/4 名）deepEq。C0 兼作跨仓棘轮：日后任何包改动必先改期望存档 + 重签本 prd。
- S2 切换等价（C2+C5）：**红** = 提取前全量引擎无视 `LOOP_KIT_PKG`（转发证明不成立）、文件非 `shim` 模板形状；**绿** = 标记包证明真转发 + `gate --dry`/`contract init·advance·check·show·list`/`breaker --reset·--round`/`term-lint --registry·--file·--stdin`/`ratchet index` 逐命令 exit code 与关键输出对钉死期望相等 + 十件匹配 `shim` 模板（行数上限、必含转发标志、不含引擎特征串）。
- S3 新树与降级（C3+C4）：**红** = 提取前无降级协议（模拟包缺失时不出 D5 矩阵行为）；**绿** = 临时 git `worktree`（无 `node_modules`）内 `hook-loop-guard` 互锁与 `gate`/`contract` 行为与主树等价、跨树派生时 ROOT 以被执行 `shim` 位置自锚（树 B baton 落树 B）+ 包缺失矩阵逐格命中（CLI exit 64 补救提示 / `hook-loop-guard` exit 2 / lint 三 hook exit 0+WARN）。
- S4 存量零重签（C6，非回归钉）：`worktree-baton`/`term-guard`/`ratchet-reverse-index` 三金牌与其 prd **零字节改动**、经 `shim` 复跑照绿；全仓 gate 复验 GREEN。红基线豁免：本 story 守「既有绿不许变红」，无「先红」语义，豁免理由随 prd 记档。

验收命令在 acceptance 冻结时定稿，形如：`node tests/_golden/loop-kit-extract.golden.mjs`（内分 C0–C6 checks）；`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json`。

## 4. route:human（须 Steven 拍板）

1. **实现开工闸**：对 GRILL D1–D10 + 本 plan 的 kernel 级设计人签（双设计审后）。
2. **D5 降级加严**：`hook-loop-guard` 在包缺失时 fail-closed（exit 2 拦）——对既有「hook 自身故障不阻塞」约定的定向加严；代价是忘配包的新 clone 会被拦到配好为止。
3. **D2 包仓历史**：fresh `git init` 不携两仓历史，出处以 SHA 记包 `README.md`。
4. **D8 依赖声明**：casey `package.json` 是否加 `"loop-kit": "file:../loop-kit"`（兑现 ADR 预定形态 vs 实际解析走兄弟约定、声明近乎装饰）。
5. **C0 跨仓棘轮形态**：包字节 pin 进 Casey 期望存档 = 未来每刀包改动（含 autotester 侧发起）都触 Casey 重签——ADR-0008 已认「兼容金牌负担前置」，此处确认其机制形态。

## 5. 非目标（本契约不做）

- autotester 侧迁移、其 `contract.mjs` 对齐、其 ADR 更新（另一有界工作流，不触其无关脏测试数据）。
- P0-4a/4b 新引擎原语（`workflow-state`/`orchestrate`/schema/gate 分层）——提取后另立契约在包内建造。
- 任何 `verdict`/`sign`/凭据面/回放/报告业务行为改动；`loop/GUARDRAILS.md` 条目增删；`loop/config.json` 语义改动；`.auth/` 与 `site.json` 与本契约无关。
- npm registry 发布、CI、语义化版本流程；「个人 skill 编排层」分发出口（后续小契约）。
- 历史坏路径文案顺手修（`hook-loop-triage` 头注旧决策文档路径等）——字节冻结照搬，已有账。

## 6. 待登记术语（`CONTEXT.md`，随切换提交落、先登记后使用）

- `shim`（垫片）：只做包定位、ROOT 注入与命令/导出转发的薄层，零业务逻辑；提取后 in-repo `loop-kit/bin/*.mjs` 的形态；其模板形状由兼容金牌钉死，防转发层长出第三变体。
- `loop-kit` 既有词条白话解释更新：「孵化于 autotester `loop-kit/` 目录」→「已提取为独立包（ADR-0008），Casey 与 autotester 双消费者；分发 = 兄弟目录直解析 + npm 本地路径依赖」。
```

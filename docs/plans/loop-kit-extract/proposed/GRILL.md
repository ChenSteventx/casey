# loop-kit-extract — grill 决策记录（loop-kit 提取独立包 + Casey 兼容迁移，full/kernel 级加严）

> 设计评审修订（codex-sol@max，2026-07-13）：D2/D4/D5/D7/D8/D9 已按异构冗余设计评审 9 条发现修订（8 条采信、1 条部分采信），逐条处置见 `../review/planreview-disposition.md`。
> baton 已立于本 worktree（lane full，理由见台账）；本文与 `plan.md` 是 grill/plan 两阶段交付物。授权凭据：Steven 2026-07-13 主会话点选路线① + ADR-0008 已接受。实现开工另被 kernel 级设计人签门阻断——本轮只规划，不动任何实现字节。
> 事实源：`docs/adr/0008-loop-kit-extraction.md`（路线①已定，本文不翻案）、`docs/plans/loop-dual-profile-reform/PROPOSAL.md` §12.1/§13/§14、Casey `docs/adr/0001-reuse-loop-kit.md`、autotester `docs/adr/0001-loop-kit-incubation.md`（预定分发形态）、`loop-kit/bin/` 十脚本头注、`.claude/settings.json`、全仓 grep 勘定（清单见 `plan.md` §0）。

## 背景（勘定实证，2026-07-13 本树 HEAD=0e7c415）

- 两仓逐字节 `cmp` 复核：8 份脚本字节一致（`breaker`/`gate`/`hook-loop-guard`/`hook-loop-triage`/`hook-posttool`/`hook-stop`/`review-deepseek`/`term-lint`）；`contract.mjs` 已分叉（Casey 版带 `worktree` baton 全套）；`ratchet.mjs` 为 Casey 独有。与 ADR-0008 背景陈述一致。
- 十脚本全部以自身文件位置锚定仓根：`ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')`。提取后包在消费仓之外，此锚定必然指错（会指到 `/mnt/d/ctx/heren`）——ROOT 发现方式是全案唯一必须的语义改动面（D4）。
- `contract.mjs`/`term-lint.mjs`/`ratchet.mjs` 以 `argv[1] === fileURLToPath(import.meta.url)` 判 CLI 主模式：若薄转发层只做动态 import，包内判据不成立、CLI 哑火。故转发层主模式必须 spawn 包内脚本（argv[1] 即包路径，判据原样成立、包内 CLI 尾块零改动）（D4）。
- 消费面锚点（grep 全量）：`.claude/settings.json` 四条 hook 均挂 `$CLAUDE_PROJECT_DIR/loop-kit/bin/...`；`bin/term-guard.mjs`/`bin/term-guard-hook.mjs` import `../loop-kit/bin/term-lint.mjs`；三份冻结金牌 import `../../loop-kit/bin/{contract,term-lint,ratchet}.mjs`；两份 prd 的 acceptance 命令 + `loop/config.json` 的 `review.fallbackRunner` + `package.json` scripts 三条引 `loop-kit/bin` 路径。全部按「路径一个不改」设计归零涟漪（D3）。
- 全仓 68 个 prd 的 `testChecksums` 无一冻结 `loop-kit/bin` 文件（脚本核验 0 命中）——原地替换为转发层不触任何既有棘轮。

## D1 车道与治理

- full 车道 + kernel 级加严约定（ADR-0008 决策 4，`resolution` 契约先例）：双设计审 + 异构冗余实现审 + 全仓门禁 + Steven 人签；`kernel` 车道机制建成前以 full 承载。
- 本 baton 以此立（laneReason 记档）。grill/plan 由本轮交付；accept 起的每一步以 Steven 对本设计的人签为前置（route:human #1）。

## D2 包仓落点与形态

- 落点：`/mnt/d/ctx/heren/loop-kit`，独立 git 仓（ADR-0008 默认落点 + autotester ADR-0001 预定形态）。它与 casey 主仓、各并行 `worktree` 天然同层——`contract worktree` 的默认落点就是兄弟目录 `../<仓名>-<slug>`（`contract.mjs` 实证），这是 D4 兄弟目录解析成立的结构前提。
- **同层是正式前置条件，不是普遍保证**（评审 M1 采信）：「新树零安装可跑」只对主仓与 `contract worktree` 默认落点成立；任意路径 `git worktree add`、IDE 建树、异地 clone 不在保证内——异地树必须显式设 `LOOP_KIT_PKG`，两无则按 D5 安全失败。三种布局各有金牌用例（C3）。文档表述一律拓扑优先（包 = 消费树兄弟目录），绝对路径只作当前环境示例（评审 L1 采信）。
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

- 包内新增 `lib/root.mjs`，单点 `resolveRoot()`（契约按评审 M2/M3 收严）：`LOOP_KIT_ROOT` 在场则必须有效——目录存在 + 含 `loop/config.json` 根标记 + `realpath` 规范化，无效**立即失败**、绝不静默回退；变量缺席才自 `process.cwd()` 逐级上溯找根标记（同样校验 + 规范化）；两路皆空抛**结构化错误**——库函数绝不 `process.exit` 终止宿主进程，exit 64 + stderr 补救提示（对齐 `gate` 既有「用法/契约缺失」退出码语义）由 Casey 侧引导层在受支持入口给出，且受支持入口总先注入有效 ROOT、包内解析失败在受支持路径不可达。另导出**进程级已解析根探针**（只读查询口），供消费侧核对 ESM 缓存中包模块实际锚定的树。含 ROOT 锚定的七件（`breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet`）换用它；`hook-stop`/`hook-loop-triage`/`review-deepseek` 无 ROOT 锚定、逐字节照搬。
- Casey 侧新增共享引导助手 `loop-kit/lib/boot.mjs`（评审 H2/M2 采信）：包定位、**包身份锁**校验、env 注入、转发与降级逻辑单点收此一处，十个 `shim` 只调它——校验逻辑绝不复制十份（防引导层自身长出会漂的变体）。
- `shim`（每件薄转发、零业务逻辑，由单一模板 + 每件参数展开生成，金牌 C5 逐字比对钉死）：
  - 包定位：`LOOP_KIT_PKG` 环境变量（测试与非常规布局的**显式逃生口**，操作者自担信任，跳过身份锁）→ 静态兄弟约定 `new URL('../../../loop-kit', import.meta.url)`（隐式路径，**每次转发前**对 `loop-kit/kit-lock.json` 全清单 sha256 校验，失配视同包缺失按 D5 逐入口降级）。因各 `worktree` 与包同层（正式前置条件，D2），符合布局的新树零安装即解析成功。
  - 包身份锁（评审 H2 采信）：`kit-lock.json` 记包每文件 sha256 + 包仓 commit，git 跟踪、随本 prd 冻结。信任根 = Casey git 树内的 `shim` + `boot` + `kit-lock`，校验发生在转发层、先于任何包代码执行——兄弟仓切分支/带脏改动/落旧版本都在执行前被判死，「负责校验的 `gate` 自己来自未验证包」的循环信任解除。包 `README.md` 记出处 SHA 是反向出处，二者并存、职责不同。
  - ROOT 注入：以 `shim` 自身位置为准（= `shim` 的 `../..`）——语义与今日位置锚定逐字等价、每树自锚。CLI 模式经 `spawnSync` 的 env 选项注入子进程（对子进程等效于无条件覆盖，防树 A 进程派生跑树 B `shim` 时继承树 A 的 ROOT），**宿主进程环境零改写**；库模式设 env → 动态 import → `finally` 恢复，绝不永久污染调用者 `process.env`（评审 M2 采信）。
  - CLI 主模式（`argv[1]` 是 `shim` 自身）：`spawnSync(node, [包内同名脚本, ...argv], stdio 继承)`，stdin/stdout/stderr 原样流经（hook 的 stdin JSON 协议不受影响）；退出码按 D5 全故障域矩阵处置（合法码原码透传、引导失败归一）。
  - 库模式（被 import）：动态 import 包内模块 + 显式名单 re-export——`contract` 18 名、`term-lint` 3 名（`parseRegistry`/`scanText`/`lintFiles`）、`ratchet` 4 名；名单被金牌 C1 对提取前快照 deepEq 钉死，漂一个名即红。**同进程跨树防线**（评审 M2 采信）：包模块 URL 全树相同、ESM 缓存首树 ROOT 常驻（七件的 ROOT 均模块级求值，实证见处置记录），故 import 后以 `lib/root.mjs` 探针核对包模块实际锚定树，失配抛结构化错误——fail-fast，绝不静默采用他树 ROOT；同进程跨树库复用不在支持面内，金牌 C3 钉此错误行为。其余七件无库消费者，`shim` 只做 CLI 主模式。
- `LOOP_CONTRACT_FILE` 既有覆盖口、`loop/` 运行态（baton/熔断态 gitignored 每树一份）语义一律不动（护栏 #18 不触）。

## D5 fail-safe 降级矩阵（全故障域，逐格冻进金牌 C4）

评审 H1 采信：故障面从「包路径缺失」单态扩为**完整引导失败域**——包目录缺失、身份锁失配、目标脚本缺失/不可读、传递依赖缺失、脚本语法损坏、Node 不兼容、`spawnSync` 报 error、子进程信号终止（`status === null`）、子进程意外退出码。实证：包脚本解析期损坏 exit 1 发生在其任何 `catch` 之前（今日 `hook-loop-guard` 的 fail-open 只护自身 `try` 块内），纯「退出码透传」即 fail-open。

| 入口 | 合法态 | 全部引导失败与异常态 | 理由 |
|---|---|---|---|
| CLI `shim`（`gate`/`contract`/`breaker`/`term-lint`/`ratchet`/`review-deepseek`） | 子进程任何正常退出码**原码透传**（`gate` 的 RED、`term-lint` 的违例码等语义不折损） | 引导失败（缺包/锁失配/缺目标/`spawnSync` error）→ exit 64 + stderr 补救提示（clone 包到兄弟目录，或设 `LOOP_KIT_PKG`）；子进程信号终止 → 以同信号自终（保留 shell `128+n` 语义） | 与门禁「默认 FAIL、凭证据翻绿」同族：引擎证不出在场就不给任何绿；正常码透传保「逐命令等价」 |
| `hook-loop-guard` `shim` | 0（放行）/ 2（拦）原样透传 | **其余一切**（含子进程 exit 1 崩溃、信号、`status === null`、`spawnSync` error、缺包、锁失配、缺目标、损坏脚本）一律归一 exit 2 拦 + stderr 说明 | 这些全是可确定性判死的环境错误，不是意外异常：若沿用 fail-open，新 clone 忘配包或包漂移 = 阶段互锁静默失守（护栏 #11 掉牙、冻结面裸奔）。对「hook 自身故障不阻塞」既有约定的**定向加严**（route:human #2，含扩围） |
| `hook-stop`/`hook-posttool`/`hook-loop-triage` `shim` | 0 / 2 原样透传 | **其余一切**（同上各态）一律一行 WARN + exit 0 | 沿用 ADR-0005 已文档化立场：lint 监督层永不阻塞正常工作（fail-open 仅限 lint/hook，护栏语义原文） |

包内脚本自身的既有 fail-open/fail-closed 语义（各头注约定）一律不动；上表只约束 Casey 侧 `shim`/`boot` 引导层在「包解析/校验/派生失败」这一新增故障面的行为。金牌 C4 按故障族逐入口断言（plan §3 S3）；本环境（DrvFs）不可确定性复现的权限类，以引导层单元桩钉协议并记档豁免。

## D6 迁移清单与源头真相边界

- 入包：十脚本全量——8 份字节一致件 + `contract.mjs`（**以 Casey 版为准**，含 `worktree` baton 全部纯函数与 CLI；ADR-0008 决策 3「已分叉件归位」）+ `ratchet.mjs`（Casey 独有件）——外加新 `lib/root.mjs`。字节保真：除 ROOT 锚定行外逐字节照搬，「提取只是搬目录、不是重构」（两仓 ADR-0001 共同原则）；差异面由评审以 diff 白名单核。
- 留 Casey（ADR-0001 分界线 + ADR-0008 决策 3）：`CONTEXT.md`、`loop/GUARDRAILS.md`、`loop/config.json`、`loop/prd-*.json` 实例、`loop/` 运行态、`bin/term-guard*.mjs`（Casey 侧统一语言补充件，经 `shim` 继续 import）、ADR 与 docs、`.claude/` 全部。
- schema/prompt 模板归属：按 ADR-0001 分界线归 kit——但勘定实证两仓 `loop-kit/` 目录当前都只有 `bin/`，本契约无 schema/模板可迁。改革 P0-4a/4b 要新造的 `workflow-state`/`orchestrate`/schema 直接在提取后的包内出生（ADR-0008 决策 5），不属本契约（D10）。
- autotester 在其自己的迁移工作流之前继续用它的 in-repo 拷贝（对它而言唯一生效源不变）；届时其 `contract.mjs` 对齐 Casey 版、其 ADR 更新在其仓落——均非本契约（ADR-0008 决策 2/后果）。

## D7 兼容性金牌设计（先红后绿，冻进 `loop/prd-loop-kit-extract.json`）

新金牌 `tests/_golden/loop-kit-extract.golden.mjs` + 期望存档 `tests/fixtures/loop-kit-expected/`（含 `baseline/` 切换前观测基线）。期望存档 = 预期包内容：对提取前 HEAD 十脚本做机械 ROOT 行替换后的存档，人审 diff 后随 prd 冻结——这是 Golden Test 的「人工确认过的存档」范式，惰性数据、绝不执行，不构成第三变体。评审 H3 采信后总纲：机械替换本身的正确性由 C7 根语义组独立作证 + C2 完整基线行为比对双重覆盖，启发式断言（关键输出/行数上限/特征串）全部废除、换成完整比对。

- C0 搬运保真 + 三方一致 + 跨仓棘轮：包内 `bin/*.mjs` 与 `lib/root.mjs` 对期望存档逐文件 sha256 相等，且期望存档、`kit-lock.json`、真包**三方一致**。红：包不存在。绿：包落成。此 pin 兼作跨仓兼容棘轮：日后任何包改动（含 autotester 侧发起的）必先改 Casey 期望存档 + `kit-lock` + 重签 `prd-loop-kit-extract`——ADR-0008 已认的「兼容金牌负担前置」的机制形态（route:human #5）。
- C1 API 面 deepEq：经 `shim` 动态 import 的 `contract`/`term-lint`/`ratchet` 导出名集合，对提取前 in-repo 快照（18/3/4 名，写死在金牌里）deepEq，且**逐名 `typeof` 相等**；行为面由 C2 完整基线（CLI 与 hook 全入口）+ C6 存量金牌复跑（`worktree-baton` 金牌 `import * as C` 驱 `contract` 多数导出真行为、`term-guard`/`ratchet-reverse-index` 驱其余库面）承担。红：包缺失或名单/类型漂移。
- C2 转发证明 + 完整观测基线等价：先以 `LOOP_KIT_PKG` 指向测试标记包证明 `shim` 真转发（提取前的全量引擎无视该变量 → 红基线）；再经真包跑 `gate --dry` / `contract init·advance·check·show·list` / `breaker --reset·--round` / `term-lint --registry·--file·--stdin` / `ratchet index` + 四 hook 正常路径（合成 stdin JSON，含 guard 放行/拦两态），逐条对**切换前冻结的观测基线**比对：exit code + 规范化 stdout/stderr 全文 + 文件系统差量（`loop/` 运行态产物字节）。基线于提取前 HEAD 录制、随 prd 冻结（评审 H3 采信，废除「关键输出」启发式）。
- C3 布局与跨树：三布局场景（评审 M1 采信）——① 同层默认布局：临时 git `worktree`（确保无 `node_modules`，复用 worktree-baton 金牌的真接缝驱动范式）内跑 `hook-loop-guard` 互锁（合成 PreToolUse stdin JSON）与 `gate`/`contract`，行为与主树等价；② 异地树 + 显式 `LOOP_KIT_PKG` 可跑；③ 异地树无覆盖 → 按 D5 安全失败。跨树两态（评审 M2 采信）——CLI 派生：树 B 的 baton 写进树 B，绝不写树 A；库模式：同进程先 import 树 A `shim` 再 import 树 B `shim` 得结构化错误，绝不静默采用树 A 的 ROOT。
- C4 故障族矩阵：缺包目录 / 身份锁失配（伪造漂移包）/ 缺目标脚本 / 语法损坏脚本 / 信号终止 / `spawnSync` 报 error / 意外退出码，逐故障 × 逐入口断言 D5 表（CLI 64 或同信号自终 / guard 一律 2 / lint 一律 WARN+0）；DrvFs 不可确定性复现的权限类以引导层单元桩钉协议。红：提取前无降级协议。
- C5 `shim` 模板逐字比对：十个 `shim` 由单一模板 + 每件参数（脚本名/库名单）展开生成，金牌对展开结果**逐字比对**（评审 H3 采信，废除行数上限/特征串启发式），杀 `shim` 层第三变体；`loop-kit/lib/boot.mjs` 一并入本 prd 冻结面。红：现文件是全量引擎。
- C6 存量零重签（非回归钉）：三份冻结金牌（`worktree-baton`/`term-guard`/`ratchet-reverse-index`）与其 prd 零字节改动——金牌内写死其**切换前 git blob SHA**、断言当前字节等于该锚（评审 H3 采信：独立基线可证，不只「跑绿」）——且经 `shim` 复跑照绿；全仓 gate 复验 GREEN + `ratchet index` 复验。此项无红基线（守既有绿），豁免理由记档于 plan §3。
- C7 根语义组（评审 M3 采信新增）：`resolveRoot()` 独立语义用例——env 有效命中 / env 无效**立即失败不回退** / 上溯命中根标记 / 上溯无标记抛结构化错误（不终止宿主进程）/ `realpath` 规范化 / 探针回报实际锚定树。红：包不存在。

## D8 治理面与涟漪（重签清单 = 空）

- `.claude/settings.json`：零改动（hook 路径原样生效）。
- `CLAUDE.md`：常用命令零改动；新增一段「`loop-kit` 已提取为兄弟目录独立包（ADR-0008），新机器 bootstrap 需先把包 clone 到 `/mnt/d/ctx/heren/loop-kit`」。**归本契约收尾**、不另开小契约——一段纯文档不值一个 baton，且与切换同提交才不出现文档与事实脱节窗口。
- prd acceptance 涟漪 grep 全量（证据见 plan §0）：`prd-p2-intent-compile`（2 条 `term-lint` 命令）、`prd-ratchet-reverse-index`（1 条 `ratchet index` 命令）——路径经 `shim` 原样生效，命令零改动；`prd-model-lane-guard` 仅 dimension 散文提及、无命令。
- 涟漪反查扩面（评审 M4 采信，2026-07-13 实测）：本契约全部待改路径（`CLAUDE.md`/`CONTEXT.md`/`docs/HANDOFF.md`/`docs/NEXT-SESSION.md`/`package.json`/`package-lock.json`）对 68 个 prd 的 `testChecksums` 与 acceptance 反查 0 冻结命中；`CONTEXT.md` 的 `--registry` 运行时门禁与 `term-guard` 金牌活读弃用别名名单两个耦合点记档（详见 plan §0）。**重签清单为空**（全路径反查证据在案）。
- `loop/config.json` 的 `review.fallbackRunner` 路径不变；`package.json` scripts 三条不变。依赖声明按评审 M5 采信后收紧为**二选一、装饰性声明不可接受**（route:human #4）：甲=本契约单出口只走兄弟约定、不加 `"loop-kit": "file:../loop-kit"`（plan 默认建议；ADR-0008 决策 1 原文「最终以提取契约 GRILL 定案为准」，GRILL 定案即被授权、无需回改 ADR）；乙=加声明，则必须成为真实受测解析分支（`boot` 解析顺序显式加 `node_modules` 步 + 金牌覆盖）并纳入 `package-lock.json` 涟漪复审。
- `CONTEXT.md`：更新 `loop-kit` 词条白话解释（提取已发生、指 ADR-0008）+ 登记 `shim` 新词（四列制，见 plan §6）；随切换提交落，先于任何使用。

## D9 切换点单提交可回滚

- 次序：包仓先落成并自提交（此时 casey 树零改动，旧 in-repo 拷贝仍是唯一生效源——ADR-0008 决策 2 的迁移期约定）→ Casey 侧**单提交切换**（十 `shim` + 金牌 + 期望存档 + prd + `CLAUDE.md`/`CONTEXT.md` 词条 + 交接文档）→ 全仓门禁复验。
- 回滚：`git revert` 该切换提交，一步回到全量 in-repo 引擎；包仓存在但无消费者，惰性无害。
- 在飞并行树：其分支仍带旧引擎、位置锚定自洽照跑；合并进 dev 时若 `loop-kit/bin` 冲突（罕见，内核文件极少被功能契约触碰）按护栏 #18 合并纪律 route:human。
- 身份锁的跨树后果（评审 H2 采信的连带代价，随 route:human #5 一并确认）：切换后，包再升级时未同步 `kit-lock` 的在飞旧分支树会被身份锁按 D5 降级拦下——这是防漂移的预期行为，补救 = 合并 dev 取新 `kit-lock`，或显式 `LOOP_KIT_PKG` 指向匹配版本。

## D10 非目标（本契约不做）

- autotester 侧迁移与其 ADR 更新（另一有界工作流，不触其无关脏测试数据）。
- P0-4a/4b 新引擎原语（`workflow-state`/`orchestrate`/schema/gate 分层）——提取后另立契约在包内建造。
- 任何 `verdict`/`sign`/凭据面/回放/报告业务行为改动；`loop/GUARDRAILS.md` 条目增删；`loop/config.json` 语义改动。
- npm registry 发布、CI、语义化版本流程（个人本地路径依赖场景，YAGNI）。
- 「个人 skill 编排层」分发出口（autotester ADR-0001 预定第二出口）——后续小契约。
- 两仓 hook 头注里的历史坏路径文案（如 `hook-loop-triage` 指向的旧决策文档路径）——字节冻结照搬，已有账（`prd-model-lane-guard` dimension），不顺手改。

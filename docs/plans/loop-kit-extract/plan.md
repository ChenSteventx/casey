# loop-kit-extract — loop-kit 提取独立包 + Casey 兼容迁移（full/kernel 级加严）

> 设计评审修订（codex-sol@max，2026-07-13）：异构冗余设计评审 9 条发现（3 `HIGH` / 5 `MED` / 1 `LOW`，`docs/plans/loop-kit-extract/review/planreview-codex.md`）已逐条裁定——8 条采信修入本文与 GRILL.md，1 条（M5）部分采信；逐条处置与反证见 `docs/plans/loop-kit-extract/review/planreview-disposition.md`。
> round-2 修订（2026-07-13）：codex 异构冗余设计审第二轮 8 条发现（4 `HIGH`/3 `MED`/1 `LOW`，`docs/plans/loop-kit-extract/review/planreview-codex-r2.md`）全部采信——7 条修入本文与 GRILL.md，R2-L1 记债（§7）；逐条处置见 `docs/plans/loop-kit-extract/review/arb-r2.md`。方向性支柱（薄 `shim`/`kit-lock`/观测基线/D5 加严方向）未动；HIGH/MED 清零处置完，round-2 即收口，route:human #1 的有条件签署条件随之满足。
> baton 已立于本 worktree（lane full）。决策全集见 `docs/plans/loop-kit-extract/proposed/GRILL.md`（D1–D10）；本文是计划骨架 + 验收点。实现开工前置：Steven 对本设计的 kernel 级人签（未签不动任何实现字节）。route:human #1 已裁定（Steven 2026-07-13）：**有条件签署**，条件 = 本轮 round-2 codex 设计审收口——round-2 未收口前仍不动任何实现字节。
> Steven 2026-07-13 四裁定汇总（各处标记见 GRILL.md 与本文 §4）：① route:human #1 有条件签署（条件=round-2）；② route:human #4（D8）取甲；③ route:human #2（D5）加严接受；④ route:human #3（D2）取 fresh `git init`。route:human #5/#6 不在本轮裁定范围。
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
- 涟漪反查扩面（评审 M4 采信，2026-07-13 本树实测）：对本契约**全部待改路径**——`CLAUDE.md`/`CONTEXT.md`/`docs/HANDOFF.md`/`docs/NEXT-SESSION.md`/`package.json`/`package-lock.json`——反查 68 个 prd 的 `testChecksums` 与 acceptance 命令：`testChecksums` 0 命中；文本提及（`prd-distribution`/`prd-plan-debt-sweep`/`prd-casey-demo` 等 8 份）均为 dimension 散文、不构成冻结面。两个运行时耦合点记档：① `CONTEXT.md` 被 `prd-p2-intent-compile` 的 `term-lint --registry` acceptance 活读——登记新词是运行时门禁面（写坏即红），不是重签面；② `tests/_golden/term-guard.golden.mjs` 第 122 行 `parseRegistry()` 活读 `CONTEXT.md` 的弃用别名名单——新增词条不删既有条目、C6 复跑兜底。**重签清单仍为空**，且此结论现在有全路径反查证据、不再只覆盖 `loop-kit/bin` 字面路径。
- CLI 主模式判据：`contract`/`term-lint`/`ratchet` 以 `argv[1]` 对齐自身路径判 CLI——`shim` 主模式必须 spawn 包内脚本，不能纯 re-export（GRILL 背景，金牌 C2 钉转发证明）。
- 术语纪律：新词见 §6 待登记；英文一律代码体、加粗只给中文；写入过 `term-lint` 双 hook。

## 1. 改动清单

A. 包仓侧（`/mnt/d/ctx/heren/loop-kit`，新独立 git 仓，fresh init）

1. `bin/` 十脚本迁入，字节保真：唯一允许差异 = ROOT 锚定行换 `resolveRoot()`（涉及 `breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet` 七件）；`hook-stop`/`hook-loop-triage`/`review-deepseek` 逐字节照搬。`contract.mjs` 以 Casey 版为准（含 `worktree` baton 全套）；`ratchet.mjs` Casey 独有件入包。CLI 尾块（`isMain` 判据）零改动。
2. `lib/root.mjs`（新，包内唯一新逻辑，契约按评审 M2/M3 收严）：`resolveRoot()` 单点——`LOOP_KIT_ROOT` 在场则必须有效（目录存在 + 含 `loop/config.json` 根标记 + `realpath` 规范化），无效**立即失败**、绝不静默回退；变量缺席才自 `process.cwd()` 上溯找根标记（同样校验 + 规范化）；两路皆空抛**结构化错误**——库函数绝不 `process.exit` 终止宿主进程，exit 64 + stderr 补救提示由 Casey 侧引导层在受支持入口给出（受支持入口总先注入有效 ROOT，包内解析失败在受支持路径不可达）。解析成功即**原子认领**进程唯一 ROOT（首次认领后不可变、同根幂等，库模式由 `boot` 在目标模块求值前经显式 API 认领），异根解析/认领立即抛结构化错误；另导出探针 = 认领值只读查询口（评审 R2-H3 采信，取代 round-1「import 后核对探针」）。
3. `package.json`（name `loop-kit`、private、`type: module`、engines node>=22.12、零依赖）+ `README.md`（出处 SHA、双消费者、ADR-0008 与 autotester ADR-0001 指针、兄弟目录布局约定）。

B. Casey 侧（单提交切换点，GRILL D9）

4. `loop-kit/bin/*.mjs` 十件原地换同名 `shim` + 新增共享引导助手 `loop-kit/lib/boot.mjs`（Casey 侧新文件：包定位、身份锁校验、env 注入、转发与降级逻辑**单点化**，十个 `shim` 只调它，防十份复制各自漂）。协议按 GRILL D4/D5（round-1 H1/H2/M2 + round-2 R2-H1/H2/H3/M1 采信后版本）：包定位 `LOOP_KIT_PKG`（显式定位口，**只改位置、不豁免校验**——评审 R2-H2）→ 兄弟约定（隐式路径），**两路一体**每次转发前对 `kit-lock.json` 全清单 sha256 校验（严格集合相等），失配视同包缺失按 D5 逐入口降级，测试走独立受测锁注入接缝（锁位置参数化、校验逻辑不变）；`shim` 模板内最小内联 `try/catch` 包住 `boot` 的动态 import 与调用，`boot` 自身缺失/损坏/抛错同入 D5 矩阵（评审 R2-H1）；CLI 主模式 `spawnSync` 转发、`LOOP_KIT_ROOT` 经 `spawnSync` 的 env 选项注入子进程，**绝不改写宿主进程环境**，spawn 前可侦测引导失败归 64、子进程派生后数值退出码一律原码透传（分类按侦测点——评审 R2-M1）；库模式**零环境突变**——`boot` 经包 `lib/root.mjs` 显式 API 在目标模块求值前原子认领进程唯一 ROOT，异根立即抛结构化错误（同进程跨树绝不静默采用他树 ROOT——评审 R2-H3）；库模式显式名单 re-export（`contract` 18 名 / `term-lint` 3 名 / `ratchet` 4 名）。
5. `loop-kit/kit-lock.json`（**包身份锁**，git 跟踪，评审 H2 + R2-M2/R2-M3 采信后版本）：记包除 `.git` 外**全清单**逐文件 sha256，语义 = 严格集合相等（缺件/多件/哈希失配/软链接等非常规文件均判失配，路径限界包根）；**纯内容寻址、自期望存档预计算**、不含包仓 commit——commit 降为包 `README.md` 出处信息、运行时不校验。信任根 = Casey git 树内的 `shim` + `boot` + `kit-lock`（全部被本 prd 冻结面钉住），校验发生在转发层、先于任何包代码执行、对兄弟约定与 `LOOP_KIT_PKG` 两种定位一体适用（评审 R2-H2）——`gate` 自证的循环信任在全部受支持布局解除。威胁模型：防漂移与误配，不防校验后毫秒窗口的主动替换（检查—执行竞态单人本机记档接受）。包任何改动必先更新期望存档 + `kit-lock` + 重签本 prd（跨仓棘轮一并覆盖，route:human #5）。
6. `tests/fixtures/loop-kit-expected/`：期望包内容存档（对提取前 HEAD 十脚本机械替换 ROOT 行 + `lib/root.mjs` 期望件；人审 diff 后随 prd 冻结；惰性数据绝不执行）+ `baseline/` **切换前观测基线**（评审 H3 + R2-H4 采信后协议：于提取前 HEAD 按冻结的逐案录制清单——初始树夹具、完整命令 argv、stdin 字节、env 白名单、执行次序、案间重置步骤——在隔离测试树录制命令矩阵与四 hook 正常路径；原始输出与规范化输出并存；规范化 = 字段级白名单、规范化器自身入 prd 冻结面；比对范围 = exit code + 规范化 stdout/stderr 全文 + 整个测试根路径与字节差量、声明写集之外零变化；含语义扰动反向用例；C2 的比对锚）。
7. `tests/_golden/loop-kit-extract.golden.mjs`：C0–C7（见 §3）。
8. `loop/prd-loop-kit-extract.json`：冻结金牌 + 期望存档/`kit-lock`/基线 checksum；stories 见 §3。
9. `CLAUDE.md` 新增 bootstrap 一段（评审 L1 采信：先写拓扑关系——包是消费树的**兄弟目录**独立包，任何机器任何 OS 同构；`/mnt/d/ctx/heren/loop-kit` 只作当前环境示例；并注明 `hook-loop-guard` 缺包 fail-closed 会连带拦住修复用的工具调用，恢复动作——clone 包或设 `LOOP_KIT_PKG`——须在 hook 触发范围之外人工完成）+ `CONTEXT.md`（`loop-kit` 词条白话解释更新、`shim`/`kit-lock` 词条登记，§6）。
10. `docs/HANDOFF.md`、`docs/NEXT-SESSION.md` 刷新（文档先于 dev 提交）。

## 2. 实现次序（红先行）

0. 前置：Steven kernel 级设计人签（对 GRILL + 本 plan 整体）。未签不进下一步。
1. accept 阶段（本树）：于提取前 HEAD 按冻结的逐案录制清单录制**切换前观测基线** + 生成期望存档与 `kit-lock.json`（§1.5–1.6；锁纯内容寻址、不含包仓 commit——评审 R2-M3，与步 2 包仓后落成无顺序冲突）+ 写金牌（§1.7）→ 跑**红基线**（C0 红=包不存在；C2 转发证明红=全量引擎无视 `LOOP_KIT_PKG`；C4 红=无降级协议；C5 红=现文件非 `shim`；C7 红=包不存在、无 `resolveRoot()` 可测；C6 照绿=非回归钉）→ 建 `loop/prd-loop-kit-extract.json` 冻结 → `contract advance accept --red-verified`。
2. 落包仓（§1.1–1.3）：casey 树零改动，旧 in-repo 拷贝仍唯一生效源；包首提交后 C0/C1/C7 转绿。
3. Casey 侧单提交切换（§1.4–1.10 同一提交）：C2–C5 转绿。
4. 全仓复验：`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json` 全绿；三份存量金牌所属 prd 的 gate 复跑 GREEN；`node loop-kit/bin/ratchet.mjs index` 复验；`node bin/casey.mjs selftest --tier1` 无回归。
5. `contract advance loop` → 异构冗余实现审（codex 评 Claude 实现；输入只给 spec+diff+门禁证据，护栏 #9）→ `advance review` → Steven 人签收尾 → `advance learn`。

## 3. 验收点（可执行规格，冻进 prd）

story 划分与红/绿判据：

- S1 包保真与根语义（C0+C1+C7）：**红** = 包不存在；**绿** = C0 包内除 `.git` 外**全清单**对期望存档逐文件 sha256 相等且集合严格相等（缺件/多件均红，评审 R2-M2），且期望存档、`kit-lock.json`、真包**三方一致**（评审 H2）；C1 经 `shim` import 的 `contract`/`term-lint`/`ratchet` 导出名集合对提取前快照（18/3/4 名）deepEq **且逐名 `typeof` 相等**（行为面由 C2 完整基线 + C6 存量金牌复跑承担，评审 H3）；C7 `resolveRoot()` 语义组（评审 M3 + R2-H3）：env 有效命中 / env 无效**立即失败不回退** / 上溯命中根标记 / 上溯无标记抛结构化错误（不终止宿主进程）/ `realpath` 规范化 / 原子认领（首认领成立、同根幂等、异根立即抛、认领后不可变）/ 探针回报认领值。C0 兼作跨仓棘轮：日后任何包改动必先改期望存档 + `kit-lock` + 重签本 prd。
- S2 切换等价（C2+C5）：**红** = 提取前全量引擎无视 `LOOP_KIT_PKG`（转发证明不成立）、文件非 `shim` 模板形状；**绿** = 标记包证明真转发（标记包配独立受测锁经注入接缝生效、校验不豁免——评审 R2-H2）+ `gate --dry`/`contract init·advance·check·show·list`/`breaker --reset·--round`/`term-lint --registry·--file·--stdin`/`ratchet index` 及四 hook 正常路径（合成 stdin JSON）逐条对**切换前冻结的观测基线**比对：exit code + 规范化 stdout/stderr **全文** + **整个测试根**路径与字节差量（声明写集之外零变化，不止 `loop/`），录制/规范化协议按 §1.6 冻结、含语义扰动反向用例（评审 H3 + R2-H4），废除「关键输出」启发式；C5 十件 `shim` 由**单一模板 + 每件参数**展开生成，金牌对展开结果**逐字比对**，废除行数上限/特征串启发式（评审 H3）。
- S3 布局、降级与跨树（C3+C4）：**红** = 提取前无降级协议（模拟包缺失时不出 D5 矩阵行为）；**绿** = C3 三布局场景（评审 M1）：① 同层默认布局（临时 git `worktree`、无 `node_modules`）内 `hook-loop-guard` 互锁与 `gate`/`contract` 行为与主树等价；② 异地树 + 显式 `LOOP_KIT_PKG` 可跑；③ 异地树无覆盖 → 按 D5 安全失败。跨树防线（评审 M2 + R2-H3）：CLI 派生时 ROOT 以被执行 `shim` 位置自锚（树 B baton 落树 B）；同进程先 import 树 A `shim` 再 import 树 B `shim` → 求值前认领拦下、结构化错误（绝不静默采用树 A 的 ROOT）；另覆盖三库件交错排列导入、并发导入、目标模块 import 抛错、认领 API 抛错各态。C4 **故障族矩阵**（评审 H1 + R2-H1/R2-M1）：缺包目录 / 身份锁失配（伪造漂移包）/ 清单外多余文件 / 缺目标脚本 / `boot` 缺失 / `boot` 语法损坏 / 锁 JSON 损坏 / `boot` 调用前中抛错 / 语法损坏包脚本（锁校验 spawn 前拦下 + 「锁冻错」桩钉透传代价）/ 信号终止 / `spawnSync` 报 error / `status === null` 且无信号 / 意外退出码，逐入口断言 D5（CLI：spawn 前引导失败 64、派生后数值码原码透传、同信号自终 / `hook-loop-guard` 一律 2 / lint 三 hook 一律 WARN+0）；本环境（DrvFs）不可确定性复现的权限类，以引导层单元桩钉协议并记档豁免。
- S4 存量零重签（C6，非回归钉）：`worktree-baton`/`term-guard`/`ratchet-reverse-index` 三金牌与其 prd **零字节改动**、经 `shim` 复跑照绿；金牌内写死三金牌与其 prd 的**切换前 git blob SHA**，断言当前字节等于该锚——「零字节改动」有独立基线可证、不只「跑绿」（评审 H3）；全仓 gate 复验 GREEN。红基线豁免：本 story 守「既有绿不许变红」，无「先红」语义，豁免理由随 prd 记档。

验收命令在 acceptance 冻结时定稿，形如：`node tests/_golden/loop-kit-extract.golden.mjs`（内分 C0–C7 checks）；`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json`。

## 4. route:human（须 Steven 拍板；1–4 已由 Steven 2026-07-13 裁定，5–6 待续裁）

1. **实现开工闸**——Steven 2026-07-13 裁定：**有条件签署**，条件 = 本轮 round-2 codex 设计审收口。对 GRILL D1–D10 + 本 plan 的 kernel 级设计人签在 round-2 收口后即完成；round-2 未收口前不进 accept、不动任何实现字节。
2. **D5 降级加严（评审 H1 采信后扩围）**——Steven 2026-07-13 裁定：**加严接受**，代价条款照录：`hook-loop-guard` 的 `shim` 对合法态 0/2 之外的**一切**引导失败与子进程异常态——包缺失、身份锁失配、目标脚本缺失/不可读、解析期崩溃（exit 1）、Node 不兼容、信号终止、`spawnSync` 报 error——一律归一 exit 2 拦。这是对既有「hook 自身故障不阻塞」约定的定向加严；代价一：忘配包的新 clone 被拦到配好为止；代价二：guard fail-closed 会连带拦住修复用的工具调用，恢复须在 hook 触发范围之外人工完成（`CLAUDE.md` bootstrap 段明示）。
3. **D2 包仓历史**——Steven 2026-07-13 裁定：**取 fresh git init**，不携两仓历史，出处以 SHA 记包 `README.md`。
4. **D8 依赖声明（评审 M5 采信后收紧为二选一，装饰性声明不可接受）**——Steven 2026-07-13 裁定：**取甲**——本契约单出口、只走兄弟约定，`package.json` 不加 `"loop-kit": "file:../loop-kit"`（ADR-0008 决策 1 原文「最终以提取契约 GRILL 定案为准」，本裁定即完成该定案、无需回改 ADR）；乙案（加声明并使其成为真实受测解析分支、纳入 `package-lock.json` 涟漪复审）标弃，不入本契约实现范围。
5. **C0 跨仓棘轮形态**：包字节 pin 进 Casey 期望存档 + `kit-lock.json` = 未来每刀包改动（含 autotester 侧发起）都触 Casey 存档与 `kit-lock` 更新 + prd 重签——ADR-0008 已认「兼容金牌负担前置」，此处确认其机制形态。连带后果（D9）：包升级后，未同步 `kit-lock` 的在飞旧分支树会被身份锁按 D5 降级拦下，补救 = 合并 dev 或显式 `LOOP_KIT_PKG`。
6. **运行时包身份锁（评审 H2 采信新增机制，round-2 R2-H2/R2-L1 修订后）**：任何定位方式（兄弟约定与显式 `LOOP_KIT_PKG`）每次转发前均对 `kit-lock.json` 全清单 sha256 校验、失配视同包缺失逐入口降级——`LOOP_KIT_PKG` 只改包位置、不再豁免校验（评审 R2-H2，生产入口零无校验通道）。成本量化（评审 R2-L1，codex 实测指示值）：本树十脚本约 64 KB，DrvFs 冷态下空 Node 启动约 0.02 秒、逐文件读取并 sha256 约 0.17 秒，一次编辑可能触发多个 hook、成本叠加；实现期补冷/热缓存与完整包全清单实测并给出可接受预算（§7 挂账），禁以 `mtime`（文件修改时间戳）缓存换速——会削弱完整性。确认接受这层每调用校验成本与拦截行为。

## 5. 非目标（本契约不做）

- autotester 侧迁移、其 `contract.mjs` 对齐、其 ADR 更新（另一有界工作流，不触其无关脏测试数据）。
- P0-4a/4b 新引擎原语（`workflow-state`/`orchestrate`/schema/gate 分层）——提取后另立契约在包内建造。
- 任何 `verdict`/`sign`/凭据面/回放/报告业务行为改动；`loop/GUARDRAILS.md` 条目增删；`loop/config.json` 语义改动；`.auth/` 与 `site.json` 与本契约无关。
- npm registry 发布、CI、语义化版本流程；「个人 skill 编排层」分发出口（后续小契约）。
- 历史坏路径文案顺手修（`hook-loop-triage` 头注旧决策文档路径等）——字节冻结照搬，已有账。

## 6. 待登记术语（`CONTEXT.md`，随切换提交落、先登记后使用）

- `shim`（垫片）：只做包定位、ROOT 注入与命令/导出转发的薄层，零业务逻辑（校验与降级逻辑单点收在 `loop-kit/lib/boot.mjs` 引导助手，`shim` 以最小内联 `try/catch` 边界调它、`boot` 自身故障也入降级矩阵——评审 R2-H1）；提取后 in-repo `loop-kit/bin/*.mjs` 的形态；由单一模板展开生成、金牌逐字比对钉死，防转发层长出第三变体。
- `kit-lock`（**包身份锁**）：Casey 侧 git 跟踪的包内容全清单（除 `.git` 外逐文件 sha256，严格集合相等、纯内容寻址、不含包仓 commit——commit 为包 `README.md` 出处信息，评审 R2-M2/R2-M3），任何定位方式每次转发前校验，失配按降级矩阵处置；Casey→包方向的版本锁，与包 `README.md` 记出处 SHA 的反向出处相区分。
- **观测基线**：切换前于旧引擎录制的规范化行为存档（完整 exit code / stdout / stderr / 文件系统差量），行为等价断言的比对锚——既有学科词（golden master 范式），登记取其本仓专义。
- `loop-kit` 既有词条白话解释更新：「孵化于 autotester `loop-kit/` 目录」→「已提取为独立包（ADR-0008），Casey 与 autotester 双消费者；分发 = 兄弟目录直解析（正式前置条件：包与消费树同层）；npm 本地路径依赖出口按 route:human #4 已裁定取甲、本契约不采用」。

## 7. 挂账（已记债务，不阻塞开工）

- R2-L1（round-2 异构冗余设计审，`LOW`）：每调用锁校验的性能预算未量化收口。codex 实测指示值已录（§4 #6：DrvFs 冷态十脚本约 64 KB、空 Node 启动约 0.02 秒、逐文件 sha256 约 0.17 秒，多 hook 叠加放大）；实现期须补冷/热缓存与完整包全清单的实测数据、给出可接受预算，随 route:human #6 呈 Steven 裁定；禁止为提速引入削弱完整性的 `mtime` 缓存。

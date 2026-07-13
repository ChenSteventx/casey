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

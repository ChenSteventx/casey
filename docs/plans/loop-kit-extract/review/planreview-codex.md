# loop-kit-extract 方案评审记录（`kernel` 级设计评审）

## 评审元数据

- 评审对象：`docs/plans/loop-kit-extract/proposed/GRILL.md`（D1–D10）+ `plan.md` 骨架与验收点 + `ADR-0008` 全文（三者全文见 `docs/plans/loop-kit-extract/review/planreview-material.md`）。
- 评审形态：异构冗余评审——规划方=Claude（Sonnet 5），评审方=`codex`（评审家族≠规划家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only -m gpt-5.6-sol -c model_reasoning_effort=max -`，评审料经 stdin 喂入（`< planreview-material.md`），`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec/plan（评审指令 + 关键设计裁量清单 + GRILL/plan/ADR 全文），不含凭据、不含规划者内心推理。
- 运行备注：过程中日志出现若干 `rmcp::transport::worker`/`codex_models_manager` 的 `ERROR`（`chatgpt.com`/`developers.openai.com` 相关网络抖动、MCP 工具发现连接失败），均为 codex 自带辅助连接的噪声，不影响本次评审调用本体——进程最终正常产出完整评审文本并退出。原始日志留存于本机临时目录（非仓库产物，不入 git）。

## 结论

`CHANGES REQUIRED`（codex 原文判据）——基于给出的输入，当前方案**不建议进入 `accept`/实现人签阶段**。计 3 项 `HIGH`、5 项 `MED`、1 项 `LOW`。

## HIGH

- **H1：`hook-loop-guard` 的 fail-closed 只覆盖了「包路径缺失」，没有覆盖完整的引导失败域。**
  `spawnSync` 启动失败、目标文件缺失/不可读、传递依赖缺失、语法错误、不兼容 Node、子进程被信号终止、`status === null`、guard 意外返回 `1` 等，都未规定必须归一为 `exit 2`。若只是「退出码透传」，就可能不满足方案自身「只有 `2` 才拦」的约定。C4 仅用空目录模拟，存在假绿。
  应冻结完整矩阵：guard 对所有解析、加载、启动及非预期退出一律归一为 `2`；三个 lint hook 对同类故障一律 `WARN` + `0`；普通 CLI 使用稳定非零码。至少覆盖缺目录、缺目标、缺依赖、损坏脚本、权限错误、信号终止和 `spawnSync.error`。

- **H2：兄弟目录只有「位置约定」，没有消费方持有的包身份锁；C0 不能充当运行前信任根。**
  Casey 没有记录并在转发前验证所需 `loop-kit` commit、ABI 或完整内容摘要。兄弟仓切分支、带脏改动或落到另一版本时，hook 会先执行它。更严重的是，负责运行 C0 的 `gate` 本身也来自这个尚未验证的包，形成循环信任；一个漂移的 `gate` 可以不执行 C0。
  应由 Casey 内的最小可信引导层持有包锁并在执行任何内核入口前验证，至少包含 package commit/ABI 和可执行文件完整清单摘要；缺失、脏树、版本不符都按入口策略降级。包 `README.md` 记录「来源 Casey SHA」是反向出处，不能替代 Casey → 包的版本锁。

- **H3：C0–C6 尚不足以证明行为等价，存在明显假绿空间。**
  C0 只证明实现与「机械修改后的预期源码」相同，不证明该修改正确；C1 只比导出名；C2 只比「关键输出」；C5 的行数和特征串只是启发式。未明确冻结完整 `stdout`/`stderr`、`stdin` 透传、文件系统差量、环境副作用、信号/退出行为、正常路径下各 hook，以及导出值类型、身份和函数行为。C6 的「零字节改动」也没有说明独立的切换前哈希基线。
  应在切换前生成并冻结旧引擎的规范化观测基线，再对新实现比较完整退出状态、输出流和文件差量；为 ROOT 单独写语义测试；C6 写死切换前 Git blob/hash；`shim` 按少数几种规范模板逐字比对或生成，不能只做行数检查。

## MED

- **M1：无 `node_modules` 的保证只对「包与 worktree 同层」成立，并非任何新 worktree 都成立。** 任意路径的 `git worktree add`、IDE 创建的 worktree 或普通 clone 都会把默认解析指向错误位置。应把「只能由 `contract worktree` 创建且必须同层」写成正式前置条件，并分别测试同层默认布局、异地 worktree + `LOOP_KIT_PKG`、异地且无覆盖时的安全失败。

- **M2：库模式存在跨树 ROOT 缓存错误。** 包模块的绝对 URL 对所有 Casey worktree 相同，而七个脚本很可能在模块求值时执行 `const ROOT = resolveRoot()`。同一 Node 进程先 `import` 树 A、再 `import` 树 B 时，包模块会命中 ESM 缓存，仍持有树 A 的 ROOT；重写环境变量不会重新求值模块。同时 `shim` `import` 会永久污染调用者的 `process.env`。C3 目前只描述 CLI 派生，钉不住该问题。

- **M3：`resolveRoot()` 契约不够精确。** 仅验证 `LOOP_KIT_ROOT` 是存在的目录，仍可能接受不含 `loop/config.json` 的错误根；也未说明显式变量无效时是立即失败还是悄悄回退到 `cwd`。建议显式变量无效立即失败、两条路径都验证根标记并规范化真实路径；库调用抛出结构化错误，由 CLI 边界映射为 `64`，不要让通用库函数直接终止宿主进程。

- **M4：涟漪审计范围过窄。** 「68 个 prd 未冻结 `loop-kit/bin`」只覆盖了十个 `shim`，却没有覆盖本计划还会修改的 `CLAUDE.md`、`CONTEXT.md`、`HANDOFF.md`、`NEXT-SESSION.md`，以及可能修改的 Casey `package.json`/锁文件。重签清单为空目前证据不足，应对所有既有待改路径反查全部 `testChecksums` 和 acceptance 命令。

- **M5：所谓 npm 本地路径依赖并不是实际分发出口，而且关键决定仍悬空。** D4 的解析顺序完全不查询 `node_modules`，所以即使加入 `"loop-kit": "file:../loop-kit"` 也只是装饰；不加入又未兑现 `ADR-0008` 所述形态。签字前应二选一：让 npm 安装路径成为真实、受测的解析分支；或明确本契约仅支持兄弟仓并修正 ADR/设计表述。若加入依赖，还必须纳入 lockfile 和既有门禁涟漪。

## LOW

- **L1：bootstrap 文档写死 `/mnt/d/ctx/heren/loop-kit`，与「相对兄弟布局」这一真实约束及跨 OS 上手不一致。** 文档应描述拓扑关系，再把该绝对路径作为当前环境示例。另需说明 guard 缺包时可能拦住用于修复的工具调用，恢复须在 hook 外完成。

## 附注（codex 原文）

切换提交本身的即时 `git revert` 结构是成立的：旧引擎 Git blob 会恢复，外部包保持惰性。但它只证明「内容可退回」，不解决包版本未锁导致的前向复现问题。除可选且未实际使用的 npm 依赖声明外，**未发现夹带 P0-4a/4b 等明显越界改动**。

## 我方独立复核（Claude 补充，非 codex 产出，供交叉参考）

在备料与等待评审期间，对 plan §0「涟漪归零」的量化声明做了本树 `grep` 独立复核：`loop/prd-*.json` 共 68 个、含 `loop-kit/bin` 字样的仅 3 个（`prd-model-lane-guard.json`/`prd-p2-intent-compile.json`/`prd-ratchet-reverse-index.json`）、`.claude/settings.json` 4 条 hook 挂载、`package.json` 3 条 scripts，均与文档自述吻合；另核出 `.claude/skills/{acceptance-gate,session-handoff,casey}/SKILL.md` 三份文档提及 `loop-kit/bin` 路径（plan 已声明此类文档命令零改动）。**但该复核范围与 codex M4 指出的一致：只覆盖了 `prd`/`settings.json`/`package.json`/skills 文档，未覆盖 `CLAUDE.md`/`CONTEXT.md`/`HANDOFF.md`/`NEXT-SESSION.md` 等本计划自身要修改的文档路径是否被其它冻结面引用**——M4 成立，我方复核不能反证涟漪审计范围充分。

## 处置与去向

本记录是本契约的正式异构冗余评审产出（护栏 #9 达成，非同族兜底）。`route:human` #1「实现开工闸」需在 GRILL/plan 按 H1–H3、M1–M5、L1 修订后，视 Steven 判断决定是否需要再走一轮评审；`accept` 阶段（红先行）不应在本记录的 `HIGH` 项收敛前开工。

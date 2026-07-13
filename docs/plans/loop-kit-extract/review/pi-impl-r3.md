# loop-kit-extract 实现审记录（r2 第二次跑，`pi`）

## 评审元数据

- 评审对象：同 `codex-impl-r3.md`——`loop-kit-extract` 契约 round-2 第一次跑发现处置后的复核，
  评审料 `docs/plans/loop-kit-extract/review/material-impl-r3.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `pi`（`deepseek/deepseek-v4-pro`，
  评审家族≠实现家族）。
- 评审方调用：`pi -p --no-session --no-tools --thinking high --model deepseek/deepseek-v4-pro
  @docs/plans/loop-kit-extract/review/material-impl-r3.md "<评审指令，指向料文件『0. 评审指令』一节>"`，
  `pi` 版本 `0.80.3`。
- 护栏 #9：同一份评审料，只含 spec、round-1 摘要、round-2 第一次跑发现原文、处置表、mutation 验证
  证据、diff、门禁证据，不含凭据、不含实现者内心推理。`--no-tools` 保证 `pi` 只基于料文件内容判断。
- 运行备注：进程正常退出，产出完整结构化评审（本轮原生以英文作答）。

## 结论（原文，未译改）

**PASS** —— "All four `codex` round‑2 findings are verifiably closed, the fixes themselves
introduce no new defects, and the seven round‑1 closures remain unbroken."

## 逐条复核（`pi` 原文摘录，未译改）

- **A1 – worker_threads 边界 + 槽内容防篡改**：`isMainThread` 检测在最早点拒绝任何 Worker 调用，
  `grep` 确认双侧零 `worker_threads` 使用，不误伤合法主线程场景；`writeClaimed()` 只在
  `current===null` 时写入，冻结不干扰正常操作，外部篡改会抛 `TypeError`；`revalidateClaimed` 重跑
  与首次认领相同的校验，失效值/预置伪造值均被拒绝——「额外的 `existsSync`/`realpathSync` 开销可忽略；
  冻结不与任何合法重复认领冲突（只会写入一次）」。
- **A2 – SPAWN_ERROR/NO_STATUS 弱断言**：核实 `boot.mjs` 的 `degrade()` 确实打印含对应 code 子串的
  消息，两态现在即使退出码相同也可区分；材料中的 mutation 测试证实删除 `SPAWN_ERROR` 分支后旧断言
  仍过、新断言因捕获文本变为 `NO_STATUS` 而正确转红；`console` 拦截是临时且不泄漏的，不影响其它测试。
- **A6 – 特殊字符路径回归测试**：测试真实驱动 `boot.loadLib()` 对含空格/`#`/`%` 路径的包做
  `root.mjs` 与目标模块两次 `import`；若退回字符串拼接，`#` 会被当 URL fragment 处理导致测试失败；
  测试只验证既有生产路径，未引入新逻辑。
- **LOW – 孤儿锁文件**：`rmrfWithLock(dir)` 覆盖全部 9 处调用点，`unlinkSync` 有 `try/catch` 保护，
  锁不存在时静默忽略。
- **round-1 闭合完整性**：抽查确认 `globalThis[Symbol.for(...)]` 单例机制、`spawnImpl` 注入仍在
  `runCli` 中并被强化测试驱动、`testChecksums` 仍含 `boot.mjs`、C2 仍用 `buildIsolatedTree`（无
  真实信任根文件篡改）、`normalize.mjs` 字段级白名单与金牌测试未变、`boot.mjs` 仍用 `pathToFileURL`
  且信号兜底码为 `128+n`——本轮改动未削弱任何 round-1 修复。
- **语法核验**：`node --check loop-kit/lib/root.mjs`/`loop-kit/lib/boot.mjs` 均无输出（通过）；
  金牌文件由 `gate` 工具跑过、报告全绿。

## 驱动员核验备注（非评审判断，供归档交叉参考）

本轮 `pi` 判 `PASS`，与同一评审料下 `codex` 判 `CHANGES REQUIRED`（1 `HIGH`：合法预置值未冻结、
可在两个有效 ROOT 间改写，见 `codex-impl-r3.md`）不一致——两路仍未同时通过。`pi` 的专项复核未覆盖
「外部先用普通赋值预置一个已合法、规范化的 ROOT，`revalidateClaimed()` 校验通过后仍未冻结，随后可
再换成另一个同样合法的 ROOT」这一更细的时序场景（`pi` 认为「冻结不与任何合法重复认领冲突」，但
未区分「从空槽写入」与「幂等复用一个从未被冻结的既有值」两条不同代码路径）。按契约流程，`codex`
的 `HIGH` 未清零即不满足双路同时 `PASS` 的收口条件；该 `HIGH` 已由实现方处置（见
`codex-impl-r3.md` 处置栏），处置后需再走一轮双路复核确认。

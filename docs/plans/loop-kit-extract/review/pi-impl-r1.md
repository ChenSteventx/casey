# loop-kit-extract 实现审记录（r1，`pi`）

## 评审元数据

- 评审对象：同 `codex-impl-r1.md`——`loop-kit-extract` 契约实现 diff，评审料
  `docs/plans/loop-kit-extract/review/material-impl-r1.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `pi`（`deepseek/deepseek-v4-pro`，
  评审家族≠实现家族）。
- 评审方调用：`pi -p --no-session --no-tools --thinking high --model deepseek/deepseek-v4-pro
  @docs/plans/loop-kit-extract/review/material-impl-r1.md "<评审指令>"`，`pi` 版本 `0.80.3`。
- 前置 smoke 验真：先以最小 prompt（"回复『pong』两个字"）确认模型可正常应答，再跑正式评审——回应
  `pong`，模型选中有效。
- 护栏 #9：同一份评审料（`material-impl-r1.md`），只含 spec + diff + 门禁证据，不含凭据、不含实现者
  内心推理。`--no-tools` 保证 `pi` 只能基于料文件内容判断，不会自行读取工作树其他文件。
- 运行备注：进程正常退出，产出完整英文结构化评审（`pi` 模型原生以英文作答，本档原样归档、不做译改）。

## 结论（原文，未译改）

Overall assessment: **The implementation passes the kernel-level review with one HIGH finding** that
must be resolved before final sign-off (symlink detection in lock verification).

## HIGH

**`walkPackage` in `loop-kit/lib/boot.mjs` ignores symbolic links (violates GRILL D4)**

- File: `loop-kit/lib/boot.mjs` (Casey tree), lines ~76-84 (the `walkPackage` function)
- Problem: The implementation uses `ent.isFile()` to classify directory entries. According to Node.js
  documentation, `isFile()` returns `true` for a symbolic link that points to a regular file. Therefore,
  symbolic links are treated as normal files and _never_ collected into the `irregular` array. This
  directly contradicts the GRILL D4 specification（原文引用「包身份锁：...软链接等非常规文件均判失配」）。
  As a result, if a regular file in the package is replaced by a symlink with identical target content,
  the lock verification will **pass** even though the file is no longer a regular file. The same
  deficiency exists in `tests/fixtures/loop-kit-expected/hash-tree.mjs` (used to generate the lock),
  but the primary defence is `boot.mjs` at runtime.
- Suggestion: Add an explicit `if (ent.isSymbolicLink()) { irregular.push(rel); continue; }` check
  before the `isDirectory`/`isFile` branches; update `hash-tree.mjs` the same way; add a dedicated
  test case exercising a symlink inside the package.

## LOW

**Signal self-termination fallback discards shell exit-code semantics**

- File: `loop-kit/lib/boot.mjs`, lines ~113-119 (`runCli` CLI branch after `r.signal`)
- Problem: When a CLI child process is terminated by signal, the code tries
  `process.kill(process.pid, r.signal)` to mirror the signal. If that fails, it falls back to
  `return 1`, which does not follow the shell convention `128+n`.
- Suggestion: Either document `return 1` as an accepted fallback, or compute `128 + n`. Rated LOW
  because the fallback path is nearly impossible to trigger in practice.

## 设计忠实度评价（`pi` 原文，逐条对应评审指令角度）

- D5 fault-domain matrix: every failure category (lock mismatch, missing package, missing target,
  spawn error, signal, `status === null`, unexpected exit codes) is captured in `runCli` and
  downgraded per the exact code table.
- ROOT atomic claim: `lib/root.mjs` uses a module-level singleton; no residual environment mutation;
  the claim is enforced before any target module's code runs.
- kit-lock verification: always happens before execution; `LOOP_KIT_PKG` does not bypass it; TOCTOU
  is accepted per design notes.
- Gold falsifiability: normalisation only replaces `TREE_ROOT` and timestamps; the reverse-disturbance
  test in C2 proves it does not mask real behavioural differences.
- Freeze discipline and credentials: `passes` are exclusively machine-written by `gate.mjs`; checksums
  cover all mandatory frozen artefacts; the DeepSeek key path remains unchanged.
- Terminology: no obvious violations of the project glossary detected in the supplied source.

## 驱动员核验备注（非评审判断，供归档交叉参考）

材料准备过程中对 `pi` 的 HIGH 发现做了一次最小可复现的 Node 行为验证（`fs.readdirSync(dir,
{ withFileTypes: true })` 对软链接条目的 `Dirent` 分类），结果：软链接条目 `isSymbolicLink()` 为
`true`、`isFile()` 为 `false`——与 `pi` 引用的「symlink 会被 `isFile()` 判 true」这一 Node 行为描述不
一致（`readdirSync` 默认不跟随符号链接、`Dirent` 类型反映的是目录项自身类型而非其指向目标）。此项
差异仅如实记档供后续处置流程核实，驱动员不对两评审的正确性下裁断。

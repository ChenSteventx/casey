# loop-kit-extract 实现审记录（r2 第一次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-1 实现审（3 `HIGH`/3 `MED`/1 `LOW` 采信）修复落地后的
  round-2 复核。Casey 树 commit `1378181`（父 `31e71de`）+ 包仓 `/mnt/d/ctx/heren/loop-kit` commit
  `1d4bc66`（父 `0f34cc0`）。评审料：`docs/plans/loop-kit-extract/review/material-impl-r2.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only
  -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec（round-1 采信发现原文+处置表+红先行证据+门禁证据）+ 两份 diff（Casey 树
  6 个改动文件 + 包仓 root.mjs），不含凭据、不含实现者内心推理。
- 运行备注：`read-only` 沙箱下 `codex` 对本 worktree/包仓有只读文件与命令执行权限——本轮实际执行了
  多项独立复现：① 两个 Worker（`worker_threads`）各自 import root.mjs 并认领不同 ROOT，验证
  globalThis 是否真跨 Worker 共享；② 直接对 `globalThis[Symbol.for('loop-kit:root:claimed')]` 预置
  一个不存在的路径值，验证幂等复用路径是否校验；③ 核对十个 shim 展开结果确认 `spawnImpl` 未泄漏到
  生产路径；④ 枚举临时目录核对锁文件遗留情况。进程正常产出完整终判并退出（tokens used 147,265）。

## 结论

`CHANGES REQUIRED`——发现 2 项 `HIGH`、1 项 `MED`、1 项 `LOW`。codex 原文：「A3/A4/A5/A7 已闭合；
A1/A2 的『已完全修复』声明不成立；A6 生产代码已修，但缺少承诺的回归测试」。

## HIGH

1. **A1 仍不是严格的「进程唯一 ROOT」**（`loop-kit/lib/root.mjs`、期望存档同名文件）
   `globalThis[Symbol.for(...)]` 只在同一 JS 执行环境内共享，不跨 `worker_threads` 的独立 Worker——
   同进程的两个 Worker 各自认领不同 ROOT、互不冲突（codex 实测：`[{"ok":true,"root":".../casey-loop-kit-extract"},{"ok":true,"root":".../casey"}]`）。另外槽内容读取时不校验类型/目录/根标记，可被同进程代码预置
   任意值后被幂等复用路径直接采信（codex 实测：`globalThis[Symbol.for(...)] = '/preseeded'` 后
   `resolveRoot({envRoot:''})` 返回未经验证的 `/preseeded`）。C3 的不同物理包副本用例在单一 JS 全局
   环境内确实有效（codex 复现第二次认领冲突），但没有兑现更强的「进程级」表述。
2. **A2 的 `SPAWN_ERROR` 测试是可假绿的弱断言**（`tests/_golden/loop-kit-extract.golden.mjs`、
   `loop-kit/lib/boot.mjs:170` 附近）
   `r.error` 与「无 error/无 signal/status=null」两个场景最终都只断言 cli/guard/lint 返回
   `64/2/0`——若删除 `if (r.error) {...}` 分支，桩会落进 `NO_STATUS` 判据，返回码完全相同、测试仍绿，
   这正是 round-1 要消除的「删掉对应生产分支测试仍过」。A2 其余五个场景（信号/`status===null`
   对 cli 分支/目标模块 import 抛错/认领 API 抛错/并发导入）经复核确认真实驱动了对应代码路径；
   `spawnImpl` 确认未出现在十个生产 shim 展开结果中。

## MED

1. **A6 没有补承诺的特殊字符路径回归测试**（`loop-kit/lib/boot.mjs:200`、golden 对应位置）
   生产修复本身正确（`pathToFileURL(join(...)).href` 可正确编码空格/`#`/`%`），但 round-1 要求的
   「补空格/`#`/`%` 路径用例」未落地——当前金牌若退回 `file://${dir}/` 字符串拼接仍会全绿。

## LOW

1. **新增 C4 用例遗留外置临时锁文件**（golden 多处）
   `${dir}.lock.json` 落在测试目录之外，`finally` 只删 `dir` 未删该锁文件，完整跑一次 C4 会在
   临时目录残留多份孤儿锁文件。

## 已确认闭合的项目（codex 原文核实）

- A3：`boot.mjs` 已入 `testChecksums`，sha256 与实际内容一致；90 个冻结文件全部匹配。
- 跨仓一致性：包仓/期望存档/`kit-lock` 共 13 个文件集合与哈希全部一致。
- A4：C2/C4 故障注入只写隔离树，真实工作树 `kit-lock.json`/`boot.mjs` 全程只读、哈希前后不变。
- A5：规范化限定到顶层 stdout/stderr 树根替换与指定 `startedAt` 字段；白名单外时间戳与跨文件同名
  字段保留；26 份 raw 基线中未发现遗漏的现有易变字段。
- A7：兜底通过 `os.constants.signals` 返回 128+n；SIGTERM 桩断言 143，确实驱动 catch 分支。
- 术语检查 0 提示；凭据边界未发现 `.auth`/`site.json`/DeepSeek key 泄漏。

补充限制（codex 原文）：只读沙箱内创建临时目录被 `EROFS` 拒绝，未能把完整 golden 跑一遍当独立
GREEN 证据；不涉及临时写入的语法/哈希/跨模块认领/Worker/全局槽污染探针均已实际执行。

## 处置与去向

本记录是 round-2 复核第一次跑的正式产出。2 项 `HIGH` 未清零，按契约流程实现方需先处置后再复核。
处置详见本轮修复提交（`root.mjs` 增补 `worker_threads` 拒绝 + 认领槽冻结/幂等复用重校验；golden
补 A2 降级判据文本核验、A6 特殊字符路径回归用例、C4 孤儿锁文件清理）；处置完成后需再跑一轮
codex + pi 双路复核（round-2 第二次跑），本记录不构成最终收口。

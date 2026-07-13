# loop-kit-extract 实现审记录（r1，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约实现 diff（Casey 树 `dev`(`0e7c415`)`...`HEAD(`31e71de`) + 包仓
  `/mnt/d/ctx/heren/loop-kit` 首提交 `0f34cc0`）。评审料：
  `docs/plans/loop-kit-extract/review/material-impl-r1.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only
  -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec + diff + 门禁证据（GRILL/plan 决策摘录、变更文件清单、`boot.mjs`/`root.mjs`/
  代表性 `shim`/`kit-lock.json`/兼容性金牌全文、观测基线支撑代码、红证与 gate 复验摘录），不含凭据、
  不含实现者内心推理。
- 运行备注：`read-only` 沙箱下 `codex` 对本 worktree 有只读文件与命令执行权限——本轮实际执行了：
  ① 只读探针脚本（动态 `import` 两份不同物理路径的 `root.mjs`，验证「进程唯一 ROOT」是否真进程级唯一）；
  ② `rg` 核对 plan/prd/金牌中「并发导入/目标模块 import 抛错/认领 API 抛错」等场景的覆盖声明；
  ③ 核对 `gate.mjs` 源码确认 `passes` 写入路径。进程正常产出完整终判并退出（tokens used 105,582）。

## 结论

`FAIL`（codex 原文判据）——发现 3 项 `HIGH`、3 项 `MED`；codex 明确记录「未发现凭据泄漏、`LOOP_KIT_PKG`
绕过锁校验或宿主 `process.env` 残留突变」。

## HIGH

1. **进程唯一 ROOT 只在单个模块 URL 内成立**
   文件：`tests/fixtures/loop-kit-expected/package/lib/root.mjs:25`、`loop-kit/lib/boot.mjs:181`。
   `claimed` 是 `root.mjs` 模块局部变量。两棵树使用不同物理包目录时，会加载两个不同 URL 的
   `root.mjs`，各自独立认领，违反 plan 的「进程唯一 ROOT / 同进程跨树绝不静默采用其一」。
   只读探针已复现：同一 Node 进程分别加载真包（`/mnt/d/ctx/heren/loop-kit/lib/root.mjs`）与期望包副本
   （`tests/fixtures/loop-kit-expected/package/lib/root.mjs`）后，两者分别成功认领
   `casey-loop-kit-extract` 与 `casey`，**没有冲突**（实测输出：
   `{"ra":"/mnt/d/ctx/heren/casey-loop-kit-extract","rb":"/mnt/d/ctx/heren/casey","aClaim":"/mnt/d/ctx/heren/casey-loop-kit-extract","bClaim":"/mnt/d/ctx/heren/casey"}`）。
   现有 C3 特意让两树共享同一个 `LOOP_KIT_PKG`（同一物理包目录、同一模块 URL），因此掩盖了这个故障域。
   建议：把认领槽放到进程级共享位置（如 `globalThis[Symbol.for(...)]`），并将 C7 的状态隔离测试改为
   独立子进程；新增「两树各自解析不同兄弟包目录」的真跨树用例。

2. **D5 金牌没有实际覆盖签署 plan 要求的故障矩阵**
   文件：`docs/plans/loop-kit-extract/plan.md:59`、`tests/_golden/loop-kit-extract.golden.mjs:441`、
   `loop/prd-loop-kit-extract.json:112`。
   - 「CLI 同信号自终」测试只直接运行 `selfkill.mjs`，完全没有经过 `boot.runCli()` 或任何 `shim`；
     删除 `process.kill(process.pid, r.signal)` 后，该测试仍会绿。
   - `spawnSync` 的 `r.error` 分支没有行为测试。
   - `status === null` 仅搜索源码字符串，不证明分支结果。
   - plan 明写的并发导入、目标模块 import 抛错、认领 API 抛错没有实现，随后在 prd 中自行标为
     `waived`；这不是签署设计里的豁免。
   因此「C4 全故障域逐入口断言」及 GREEN 证据不成立。
   建议：为 `spawnSync` 和包 import/认领增加可注入适配器，在不改生产语义的前提下确定性制造
   `error`、无状态、信号、import 抛错等结果；信号测试必须运行真实 shim 外层进程并断言该外层进程的
   signal；补齐 plan 列出的并发与抛错场景。

3. **`boot.mjs` 未进入冻结面，与设计声明直接冲突**
   文件：`loop/prd-loop-kit-extract.json:4`、`docs/plans/loop-kit-extract/plan.md:36`。
   `testChecksums` 包含 `kit-lock.json` 和 `shim-template.mjs`，但不包含 `loop-kit/lib/boot.mjs`。十个
   `shim` 也未直接冻结，不过它们由冻结模板逐字比对，尚有间接保护；`boot.mjs` 只有语法和不完整行为检查。
   这与 plan 所称「`shim` + `boot` + `kit-lock` 全部被本 prd 冻结面钉住」不符，且 D5 测试缺口使 `boot`
   的关键分支可以漂移而 `gate` 仍绿。
   建议：把 `loop-kit/lib/boot.mjs` 加入 `testChecksums`；十个 `shim` 可继续由冻结模板间接钉死，但应在
   prd 中明确这种冻结关系。

## MED

1. **金牌会原地破坏生产信任根，异常退出可留下半份状态**
   文件：`tests/_golden/loop-kit-extract.golden.mjs:120`（C2）、`:455`（C4）。
   C2 直接覆写真实 `loop-kit/kit-lock.json`；C4 直接删除或覆写真实 `loop-kit/lib/boot.mjs`。虽然有
   `finally` 恢复，但进程被信号终止、机器中断或并行 `gate`/hook 执行时，可能留下损坏文件或让其他进程
   观察到临时内容；写入本身也不是原子替换。
   建议：在临时消费树中复制 `shim`/`boot`/锁后做故障注入，真实工作树全程只读；不要通过
   备份—覆写—恢复测试信任根。

2. **C2 规范化并非「字段级白名单」，会洗掉真实时间差异**
   文件：`tests/fixtures/loop-kit-expected/baseline/normalize.mjs:6`。
   实现先把整个结果 `JSON.stringify`，再全局替换所有 ISO 时间戳。这会同时改写 stdout、stderr 和任意
   文件内容中的业务时间戳，而不只是登记过的 `startedAt` 字段。当前反向扰动只改 exit code，不能证明
   时间戳差异不会被吞掉。
   建议：按结构化字段路径只规范化明确登记的易变字段；增加负向用例：未登记字段、stdout 和固定语料里
   的时间戳发生变化必须判红。

3. **库模式用字符串拼接构造文件 URL，显式包路径并非真正任意**
   文件：`loop-kit/lib/boot.mjs:181`。
   `new URL(..., \`file://${dir}/\`)` 没有使用 `pathToFileURL()`。例如包路径 `/tmp/loop#kit` 会被 `#`
   当作 URL fragment，实际解析成错误目录；含裸 `%` 的路径也可能产生非法 URL。CLI 模式不受影响，但
   库模式会在锁校验成功后导入错误位置。
   建议：改为 `pathToFileURL(join(dir, 'lib/root.mjs')).href` 和
   `pathToFileURL(join(dir, 'bin', script)).href`，并增加空格、`#`、`%` 路径测试。

## 补充核对（codex 原文，无独立分级）

- `runCli()` 和 `loadLib()` 都先经过 `resolveVerifiedPkg()`；未发现 `LOOP_KIT_PKG` 豁免锁校验的生产通道。
- CLI 通过 `spawnSync.env` 注入 ROOT，库模式未写 `process.env`；未发现环境恢复残留。
- `passes` 的仓内唯一实现写口仍是包内 `gate.mjs`；提交中的 `gate@...` 证据格式与该写口一致，但单一
  提交本身不能提供独立的写入者审计证明。
- 未发现 `.auth/`、`site.json` 内容或 DeepSeek 凭据进入新增输出。
- 未发现新增弃用术语或明显繁体字问题。

## 处置与去向

本记录是本契约实现阶段的正式异构冗余评审产出（护栏 #9 达成，非同族兜底）。3 项 `HIGH` 未清零，
codex 判据为 `FAIL`——按契约流程应先反馈实现方修订，视 Steven 判断决定是否需要再走一轮实现审，
不应现状直接 `advance review`/`advance learn` 收尾。

# loop-kit-extract 实现审 round-1 双路汇裁（arb-impl-r1，2026-07-13）

> 汇裁者：fable@xhigh。被评对象是 Claude 家族实现——按自评张力护栏，默认采信异构发现，仅凭具体反证驳回、逐条记处置。评审输入：`codex-impl-r1.md`（codex，6 条：3 `HIGH`/3 `MED`）+ `pi-impl-r1.md`（pi，deepseek-v4-pro，2 条：1 `HIGH`/1 `LOW`）；评审料 `material-impl-r1.md`。kernel 级跨族硬门：codex 已出完整结论，跨族双路要求满足。
> 结论：**有发现**——7 条采信（codex 6 条全采信 + pi 的 `LOW` 1 条），1 条驳回（pi 的 `HIGH`「软链接被 `isFile()` 漏判」，两层行为级反证见 R1）。两路无同缺陷重合，无需合并来源。本汇裁不是终闸：修复落地后仍须 round-2 双路复核 + Steven 人签。

## A1（codex `HIGH`）ROOT 认领槽是模块局部变量，跨包目录副本各自独立认领——「进程唯一 ROOT」不成立 —— 采信

- 复核（本汇裁独立探针，非转录 codex）：`root.mjs` 第 25 行 `let claimed = null` 是模块级变量。探针把期望存档的 `root.mjs` 复制成两个物理目录副本、同进程分别 import 并认领两棵不同树：两次认领均成功、零冲突（探针输出 `conflict: null`、`sameModule: false`），与 codex 在只读沙箱内的复现一致。与 plan §1.2「解析成功即原子认领进程唯一 ROOT」、§3 S3「同进程跨树绝不静默采用其一」直接矛盾。
- 定性：GRILL D4 库模式段自带前提「包模块 URL 全树相同」，实现照此把防线立在模块实例内——但该前提只在两树解析到**同一**物理包目录时成立（同层兄弟约定共父目录，或同一 `LOOP_KIT_PKG`）；两树各自兄弟约定解析到不同包目录（不同父目录）时前提失效、防线静默不在场。C3 金牌的跨树用例显式给两树设同一 `LOOP_KIT_PKG`（金牌内注释自认「共享包内 lib/root.mjs 模块实例，才能复现跨树冲突」）——用例被裁到机制恰好可达的布局，掩盖了机制不可达的故障域。
- 修复方向（采 codex 建议）：认领槽移至进程级共享位置（如 `globalThis` 上 `Symbol.for` 键）；C7 各用例改独立子进程隔离（现行「import 加 query 串取新模块实例」的手法在进程级槽下不再能重置状态）；C3 补「两树各自兄弟约定解析到不同物理包目录」的真跨树用例。涉包内 `root.mjs` 改动，须走 C0 跨仓棘轮整链：期望存档 + `kit-lock` + 本 prd 重签。

## A2（codex `HIGH`）D5 金牌未覆盖 plan 承诺的全故障域矩阵；prd 自行扩大豁免面 —— 采信

- 复核逐点（对金牌与 `boot.mjs` 源码核实）：
  - 信号终止用例（金牌约 441–451 行）直接 `spawnSync` 运行 `selfkill.mjs`，全程不经 `boot.runCli` 或 `shim`——只验证了 Node 自身的 `spawnSync` 信号语义；删掉 `boot.mjs` 的 `process.kill` 自终分支（164 行）该用例照绿，codex 此断言成立。
  - `spawnSync` 报 error 分支（`boot.mjs` 158–160 行 `SPAWN_ERROR`）零行为测试。
  - `status === null` 且无信号（169–171 行）只有源码字符串断言（金牌 510–513 行），非行为级验证。
  - plan §3 S3 与 GRILL C3 明写「并发导入、目标模块 import 抛错、认领 API 抛错各态」须覆盖，金牌未实现；prd observability 第 4 条把以上各态自行标 `waived`——设计签署时唯一授权的豁免是「DrvFs 不可确定性复现的权限类」（plan §3 S3 末句），此豁免扩面无设计授权，属实现侧单方削弱已冻结计划。
  - 后果：C4「逐故障 × 逐入口断言 D5」的 GREEN 证据对上述分支不成立。
- 修复方向：信号终止与 128+n 语义经包装子进程驱动 `runCli` 行为级验证；`SPAWN_ERROR` 补受测接缝或单元桩（沿用 plan 已有的「引导层单元桩钉协议」形态并记档）；并发导入 / import 抛错 / 认领 API 抛错按 plan 落用例；prd observability 第 4 条回收至设计授权范围（只留 DrvFs 权限类与经论证确不可构造的态）。

## A3（codex `HIGH`）`boot.mjs` 不入 testChecksums 冻结面，与「信任根全部被冻结面钉住」矛盾 —— 采信

- 复核：prd testChecksums 实测含 `loop-kit/kit-lock.json`、`shim-template.mjs`、金牌、基线与期望存档等 90 项，**不含** `loop-kit/lib/boot.mjs`。plan §1.5 与 GRILL D4 明写「信任根 = Casey git 树内的 `shim` + `boot` + `kit-lock`（全部被本 prd 冻结面钉住）」。十个 `shim` 经冻结模板 + C5 逐字比对间接钉死；`boot.mjs` 只有 C5 语法检查与 C4 行为测试——叠加 A2 的测试缺口，其关键分支可漂移而 gate 照绿。
- 修复方向：`loop-kit/lib/boot.mjs` 补入 testChecksums（冻结后对实现者只读，正合其信任根定位）；与 A2 修复同批重签本 prd。

## A4（codex `MED`）金牌原地覆写/删除生产信任根文件、非原子写 —— 采信

- 复核：C2 转发证明（金牌 137–149 行）备份后覆写**真实** `loop-kit/kit-lock.json`；C4 的 `withSwappedBoot`（455–466 行）删除/覆写**真实** `loop-kit/lib/boot.mjs`。虽有 `finally` 恢复，`writeFileSync` 非原子替换——进程被信号终止、机器中断、或并行 gate/hook 恰在窗口内读取，即留半份损坏信任根或读到临时内容。
- 修复方向：故障注入改在临时消费树内做（复制 `shim` + `boot` + 锁后再注入），真实工作树全程只读；C3 的 `buildIsolatedTree` 已有现成范式可复用。

## A5（codex `MED`）规范化器全局时间戳正则，非字段级白名单 —— 采信

- 复核：`normalize.mjs` 把整个结果 `JSON.stringify` 后全局替换一切 ISO 8601 时间戳——头注自称「字段级白名单」与实现不符；stdout/stderr 及任意文件内容里的业务时间戳一并被洗掉；现有反向扰动用例只扰 exit code，证不了时间戳类真实差异不被吞。违反 R2-H4 冻结的规范化协议「字段级白名单，白名单外一字不动」。
- 修复方向：改为逐字段登记替换（如仅 `.breaker-state.json` 的 `startedAt` 字段与树根路径），补时间戳类反向扰动用例；`normalize.mjs` 在冻结面内，随 A2/A3 同批重签。

## A6（codex `MED`）`loadLib` 字符串拼接构造 `file://` URL，特殊字符包路径解析错位 —— 采信

- 复核（本汇裁独立探针）：`boot.mjs` 181/183 行以 `` new URL('lib/root.mjs', `file://${dir}/`) `` 拼 URL；dir 含 `#`（如 `/tmp/foo#bar/pkg`）时实测解析为 `file:///tmp/lib/root.mjs`——`#` 后全部内容被当 URL fragment 丢弃，锁校验通过后 import 到完全错误的路径。
- 修复方向：改用 `pathToFileURL(join(dir, ...)).href`；补空格/`#`/`%` 路径用例。

## R1（pi `HIGH`）`walkPackage()` 用 `isFile()` 分类会漏判软链接 —— 驳回（具体反证）

- 反证一（Dirent 分类语义，本汇裁探针实测）：`readdirSync(dir, { withFileTypes: true })` 的目录项对「指向常规文件的软链接」返回 `isFile() === false`、`isSymbolicLink() === true`——`readdirSync` 不跟随软链接。pi 引用的「对软链接 `isFile()` 返回 true」是 `statSync()`（跟随语义）的行为，与本实现使用的 Dirent 语义不符。
- 反证二（端到端行为，本汇裁探针实测）：构造含软链接的包 + 与内容完全一致的锁，`boot.runCli`（cli 类）实测降级 exit 64，stderr 明示 `LOCK_MISMATCH`「包内含非常规文件（软链接等），身份锁按严格集合判失配：bin/alias.mjs」——恰为 GRILL D4「软链接等非常规文件均判失配」的承诺行为。`hash-tree.mjs` 同型写法同理不成立。驱动员随料记档的最小复现与本探针结论一致。
- 处置：驳回，不入修复清单。pi 对其余六个审查角度的「符合」判定不因此项失效，但其 `HIGH` 结论作废。

## A7（pi `LOW`）信号自终失败兜底码 1 不符 shell 128+n 语义 —— 采信

- 复核：`boot.mjs` 164–165 行，`process.kill` 自终失败时 `return 1`；GRILL D5 的 CLI 行明写「以同信号自终（保留 shell `128+n` 语义）」。极端兜底路径丢失信号语义，可能被误读为普通业务失败。改返回 `128 + 信号编号` 即可，与 A2 的信号行为级测试同批补验证。

## 汇总与后续

- 处置总账：codex 6 条全采信（3 `HIGH`/3 `MED`）；pi 1 条采信（`LOW`）、1 条驳回（`HIGH`，双层反证）。两路发现零重合。
- 双路对比：codex 给出代码级定位与可复现探针，六条全部经本汇裁独立核实成立，质量高；pi 唯一 `HIGH` 建立在对 Node API 语义的误认上（`statSync` 与 Dirent 混淆），但其 `LOW` 项真实且 codex 未覆盖，双路仍互补。
- 修复涉冻结面（金牌 / `normalize.mjs` / 期望存档 `root.mjs` / `kit-lock` / prd）——按 C0 跨仓棘轮与 prd 重签协议走，红先行互锁不豁免；A1/A6 涉包内文件，包仓与期望存档同步改。
- 本汇裁非终闸：修复落地后 round-2 codex+pi 双路复核，再 Steven 人签收尾。

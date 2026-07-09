# worktree-baton 设计草案（DESIGN-DRAFT，耦合核心，实现方自锁）

> full 契约。目标：解 `roadmap-parallel.md` v3 §二「真天花板：单活契约 baton」——让开发者真·并行开发多条碰 `lib`/`bin` 的活。
> 隔离模型：git worktree（用户 2026-07-09 拍板）。范围：B 案（顺 worktree，不建共享池，用户 2026-07-09 拍板）。
> 本草案是实现与金牌的唯一事实源，GRILL/plan/golden 以它为准。

## 0. 一句话
不新造「baton 池」。实证已证：**每棵 git worktree 天然各有一个独立 baton**（`loop/active-contract.json` 与 `loop/.breaker-state.json` 都 gitignored、每树一份、互不共享），所以「N 路并行」= N 棵 worktree，跑现成的单槽机制、零机制改动。本契约只加**可见性 + 人体工学 + 纪律文档**三样，把这条已经通的路做顺、做安全。

## 1. 关键实证（linchpin，2026-07-09 实测，见 HANDOFF/audit）
- 新建 worktree 里 `loop/active-contract.json` **一开始不存在**（gitignored 不随 checkout 带过去）。
- 在 worktree 里 `contract init <slug>` 只写**它自己那份** `active-contract.json`（其 `contract.mjs` 的 `ROOT` = 该 worktree 根）。
- 主树的 baton **纹丝不动**。拆除干净无残留。
- 结论：单槽机制 + git worktree = 每树独立 baton，零代码即多路并行。`LOOP_CONTRACT_FILE` 参数化与 `breaker --state`（roadmap v3 §四钦点的两把钥匙）在 worktree 模型下**都不需要**——worktree 已在文件系统层把状态隔离了。

## 2. 为什么不建共享池（B 否决 A 的依据，来自设计红队 DESIGN-REDTEAM）
共享池（`loop/active/` 一目录塞 5 槽 + `LOOP_CONTRACT_FILE` env + `breaker --state`）是给「多 session 挤**同一棵** checkout」用的——恰是 worktree 要消灭的场景。红队对池的裁定：
- 物理模型自相矛盾：`loop/active/` 若 gitignored 则每 worktree 各一份（不是共享池）；`loop/prd-<slug>.json` 与 `docs/plans/<slug>/` 却是**入库共享**的。两种物理模型互斥，池的「全局 cap 5」在 worktree 下无意义。
- 1 个 High：`breaker --state` 无约束，`--round --state loop/prd-x.json` 会把入库冻结 PRD 覆盖成熔断态 JSON、毁 `testChecksums`。
- 4 个 Med：cap count-then-write 非原子 TOCTOU（两 session 各见 4/5 → 池破 6）、`LOOP_CONTRACT_FILE` 中毒/容器校验、忘 export 撞陈旧遗留槽的 fail-open 方向、slug 键控共享交付物串味。
B 案不建池 → 上述 High/Med **全部消失**（不引入 env 选槽、不引入 `breaker --state`、不引入 cap 目录）。唯一保留的真风险是「slug 键控的共享 `prd`/`docs`」——B 用 §4.2 的 slug 全局唯一守卫 + 纪律正面堵。

## 3. 交付面（只三样，全部可选增益、零破坏现机制）
### 3.1 `contract list`（新子命令，read-only 跨树总览）
- 枚举 worktree：`git -C ROOT worktree list --porcelain` 解析 `worktree <path>` 与 `branch refs/heads/<b>`。
- 逐 worktree 读 `<path>/loop/active-contract.json`：存在且合法 JSON → 打印 `slug / lane / 六阶段进度（如 grill✓ plan✓ accept· …）/ 分支`；存在但坏 JSON → 标 `(坏契约)`；不存在 → 标 `(无活 baton)`。
- 末行汇总 `N worktree / M 活 baton`。纯读、绝不写盘、绝不抛（坏输入降级显示）。
- `git worktree list` 失败（非 git 仓）→ 友好降级，不崩。
- 价值：一眼看全所有并行 worktree 的 baton 与阶段进度（「5 个 baton 一屏看完」）。

### 3.2 `contract worktree <slug> --lane <..> --reason <..> [--path <dir>]`（新子命令，起树脚手架）
一条命令起一条并行轨：
1. slug 校验 `^[A-Za-z0-9_-]+$`（既做分支名、目录名、baton slug，必须安全；否则拒 exit 3）。
2. slug 全局唯一守卫（堵红队 Med：共享交付物串味）：ROOT 下已存在 `loop/prd-<slug>.json` 或 `docs/plans/<slug>/` → 拒 exit 3（`slug <slug> 已被占用（prd/plan 已存在），换名防串味`）。
3. `path` 默认 `../<repo 目录名>-<slug>`（`resolve(ROOT,'..',basename(ROOT)+'-'+slug)`）；已存在 → 拒。
4. `git -C ROOT worktree add -b <slug> <path> HEAD`（新分支 = slug）。失败（分支已存在等）→ 透传 git 报错、不留半棵树。
5. 在新树写 baton：直接 `writeFileSync(<path>/loop/active-contract.json, initContract({slug,lane,reason}))`（复用纯函数，不 shell 回自己）。
6. 打印下一步：`cd <path>`、baton 已立（grill 起步）、loop 前该树自己 `breaker --reset`。
7. 部分失败清理：worktree add 成功但 baton 写失败 → `git worktree remove --force` 回滚，不留悬挂树。

### 3.3 文档（本契约的大头）
- `CONTEXT.md`：登记术语（§7）。
- `loop/GUARDRAILS.md`：加护栏条款——并行工作树纪律：slug 全局唯一 / git-native 合并回 `dev`（绝不 `cp` 进 `lib`/`bin`）/ 建议并发 ≤5 树 / 每树自己 `breaker --reset` / 合并冲突人裁。
- `docs/plans/worktree-baton/WORKTREE-PARALLEL.md`：并行开发操作手册（起树→立 baton→六阶段→绿→git-native 合并回 `dev`→拆树）。
- `docs/plans/roadmap-parallel.md`：刷新 v3 §四——「暂不投 `LOOP_CONTRACT_FILE` 参数化 + `breaker --state`」的前提已被 worktree 原生隔离**绕过解决**，多轨真落地经 worktree + `contract list`/`contract worktree` 解锁，记录本次转向。
- `CLAUDE.md`：把「单 baton」措辞更新为「每 worktree 一 baton、建议 ≤5 并发」。

## 4. 零改动面（back-compat 铁律，金牌必锁）
- `contract init/advance/check/show`、`hook-loop-guard.mjs`、`breaker.mjs` **逐字节不改**（只在 `contract.mjs` 的 CLI dispatch 加两个新 case）。
- 不设任何新 env、不建 `loop/active/`、不加 `breaker --state`。单树老流程行为与今天逐字节相同。
- 纯函数层（`initContract` 等）复用不改；新增纯函数（slug 校验、path 计算、worktree 列表解析）零 I/O 可测。

## 5. 红先行金牌锁点（驱真 CLI + 真 git worktree，hermetic，用完清理）
- G1 `contract worktree <slug>`：真起 worktree 到预期 path + 该树内立 baton（slug 正确）；**ROOT 的 active-contract 不变**；末了 `git worktree remove` + `branch -D` 清理。红：今日无此子命令。
- G2 slug 唯一守卫：`docs/plans/<slug>/` 或 `loop/prd-<slug>.json` 已存在 → `contract worktree <slug>` 拒 exit 3、不起树。红：今日无守卫。
- G3 slug 穿越：`contract worktree ../evil` / `a/b` → 拒 exit 3、不起树/不写盘外。
- G4 `contract list`：两棵临时 worktree 各立一 baton → list 两 slug 全现 + 计数正确。红：今日无 list。
- G5 list 健壮：worktree 无 baton → `(无活 baton)`；坏 JSON baton → `(坏契约)` 不崩。
- G6 back-compat：现有 `init/advance/check/show` 行为与旧金牌一致；`breaker` 默认路径不变（回归锁，无红先行牙，显式标注）。
- G7 每树隔离回归：worktree 内 init 不动 ROOT 的 baton（linchpin 实证钉成金牌）。

## 6. 非目标 / 残留
- 不建共享池、不加 `LOOP_CONTRACT_FILE` 选槽、不加 `breaker --state`（worktree 已隔离，且引入即背红队 High/Med）。
- 不建自动合并守卫：git-native 合并回 `dev` + 冲突人裁是纪律（route:human），非机制强制。
- cap（≤5 并发树）是文档建议 + 人自律，非硬编码机制（worktree 数无廉价全局锁；硬限收益低）。
- 真·多树并行开发一轮真机演练（起 3 树各走一契约、绿、合并回 dev）属 route:human UAT。

## 7. 术语（造词先登记 CONTEXT.md，ADR-0005）
- 并行工作树 baton（Per-Worktree Baton）：每棵 git worktree 各自独立的活契约槽；N 棵 worktree = N 个并行 baton，互不共享 `active-contract.json`/熔断态。
- 跨树 baton 总览（Cross-Worktree Baton Overview）：`contract list` 枚举所有 worktree 的活 baton 与阶段进度的 read-only 视图。
- 起树脚手架（Worktree Scaffold）：`contract worktree` 一条命令起 worktree + 立 baton，起一条并行开发轨。

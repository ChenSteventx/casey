# worktree-baton 落地计划（plan，full）

> 以 `proposed/DESIGN-DRAFT.md`（B 案）+ `proposed/GRILL.md`（决策 D1–D9，Steven 签核 D5 硬拒 / D6 文档建议）为事实源，不另造设计。

## 目标
解 `roadmap-parallel.md` v3 §二「真天花板：单活契约 baton」。实证已证每 worktree 各有独立 baton（零机制改动即 N 路并行），本契约只加**可见性 + 人体工学 + 纪律文档**，把这条已通的路做顺做安全。

## 范围（改哪些）
- `loop-kit/bin/contract.mjs`：CLI dispatch 加两个新 case —— `list`（跨树只读总览）、`worktree`（起树脚手架）；配套纯函数（slug 校验 / worktree path 计算 / `worktree list --porcelain` 解析）。**不改** `init/advance/check/show`、纯函数 `initContract/checkAction/...`。
- **不改** `hook-loop-guard.mjs`、`breaker.mjs`（零 `--state`）、任何冻结 schema/既有金牌。
- `CONTEXT.md`：登记 3 术语。`loop/GUARDRAILS.md`：加并行工作树纪律护栏。新 `docs/plans/worktree-baton/WORKTREE-PARALLEL.md` 手册。刷 `docs/plans/roadmap-parallel.md` v3 §四。更新 `CLAUDE.md` 单 baton 措辞。

## 涟漪勘定
零冻结 schema 涟漪、零既有金牌重签。新增两 CLI case 为加性；纯函数新增零 I/O。back-compat 铁律：不设 env、不建 `loop/active/`、不加 `breaker --state`，单树老流程逐字节不变。

## 实现步骤（有序）
1. `contract.mjs` 加纯函数：`isValidSlug(s)`（`^[A-Za-z0-9_-]+$`）、`defaultWorktreePath(root, slug)`（`../<basename>-<slug>`）、`parseWorktreePorcelain(text)`（→ `[{path, branch}]`）。零 I/O、可 hermetic 直测。
2. `contract list`：`git -C ROOT worktree list --porcelain` → 逐树读 `<path>/loop/active-contract.json` → 打印 slug/lane/阶段进度/分支 + 末行 `N worktree / M 活 baton`。fail-safe 降级（坏 JSON→`(坏契约)`、缺→`(无活 baton)`、非 git→友好降级），绝不抛。D6：顺带显示 worktree 数、不拒。
3. `contract worktree <slug> --lane --reason [--path]`：slug 校验（拒 exit 3）→ **D5 硬拒**（`loop/prd-<slug>.json` 或 `docs/plans/<slug>/` 已存在→exit 3）→ path 计算/已存在拒 → `git worktree add -b <slug> <path> HEAD` → 新树写 `initContract` baton → 打印下一步 → 部分失败 `worktree remove --force` 回滚。
4. `.gitignore`：确认 `loop/active-contract.json`/`loop/.breaker-state.json` 已忽略（本契约不新增 gitignore 项——不建池）。
5. `CONTEXT.md` 登记 3 术语（loop-kit 通用子域）。
6. `loop/GUARDRAILS.md` 加护栏：并行工作树纪律（slug 全局唯一 / git-native 合并回 dev 绝不 cp 进 lib·bin / 建议并发 ≤5 树 / 每树自 breaker --reset / 冲突人裁）。
7. `WORKTREE-PARALLEL.md` 手册 + `roadmap-parallel.md` v3 §四刷新（「暂不投」→ worktree 原生隔离绕过解决）+ `CLAUDE.md` 措辞更新。

## 验收（stories → prd）
- `s1-worktree-baton-mechanics`（lane=implementation）→ `node tests/_golden/worktree-baton.golden.mjs`　锁 G1 起树脚手架 / G2 slug 唯一硬拒 / G3 slug 穿越拒 / G4 跨树 list / G5 list 健壮降级 / G6 back-compat（现有子命令 + breaker 默认路径不变）/ G7 每树隔离回归。金牌驱真 `contract.mjs` CLI + 真 `git worktree`，hermetic，用完 `worktree remove`+`branch -D` 清理（复现真接缝，非倒裁）。
- `s2-tier1-regression`（lane=implementation）→ `node bin/casey.mjs selftest --tier1`　确定性内核 + 统一语言自检不回归。
- gate 总判据：`node loop-kit/bin/gate.mjs --prd loop/prd-worktree-baton.json` 全绿。

## observability 挂账
- route:human：真·多树并行一轮真机演练（起 3 树各走一契约 → 各绿 → git-native 合并回 dev → 拆树）；合并冲突人裁；建议并发 ≤5 的自律。
- route:machine：back-compat 逐字节零回归（s1 G6）、每树隔离（s1 G7）、hook/breaker 零改（diff 可验）、tier1（s2）。

## 非目标
不建共享池 / 不加 `LOOP_CONTRACT_FILE` 选槽 / 不加 `breaker --state` / 不建自动合并守卫 / 不硬编码并发上限 / 不改 hook·breaker·现有 contract 子命令。

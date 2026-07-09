# worktree 并行开发手册（worktree-baton）

> 解 `roadmap-parallel.md` v3 §二「单活契约 baton 真天花板」。核心事实：每棵 git worktree 各有一个**独立** baton（`loop/active-contract.json` 与 `loop/.breaker-state.json` 都 gitignored、每树一份、互不共享），所以多路并行 = 多棵 worktree，各跑现成的单槽机制、零机制改动。

## 什么时候用
- 要**同时**推进多条碰 `lib`/`bin` 的落地契约（每条要各自的红先行金牌 + 阶段互锁），单棵工作树的单槽会互相顶掉——这时开 worktree。
- 不碰 `lib`/`bin` 的活（研究 / grill 起草 / golden 起草 / 异构评审）不需要 worktree，直接 fan-out 子代理、零 baton。

## 起一条并行轨（脚手架）
```
node loop-kit/bin/contract.mjs worktree <slug> --lane <direct|light|full> --reason "<一句理由>" [--path <落点>]
```
- 默认落点 `../<repo 目录名>-<slug>`（兄弟目录），`--path` 可覆盖。
- 它做四件事：slug 校验（`^[A-Za-z0-9_-]+$`）→ slug 全局唯一硬拒（`loop/prd-<slug>.json` 或 `docs/plans/<slug>/` 已存在即 exit 3，防同名串味）→ `git worktree add -b <slug> <落点> HEAD` → 在新树立 baton。任一步失败回滚，不留悬挂树。
- 起好后：`cd <落点>`，走六阶段（grill 起步）；loop 前该树自己 `node loop-kit/bin/breaker.mjs --reset`。

## 看全部并行轨（总览）
```
node loop-kit/bin/contract.mjs list
```
逐 worktree 列 `slug / lane / 六阶段进度 / 分支`，末行 `N worktree / M 活 baton`。坏契约树标 `(坏契约)`、无 baton 树标 `(无活 baton)`，不崩。建议并发 ≤5 树（软约束，list 显示当前树数；worktree 数无廉价全局锁，靠自律）。

## 各轨自绿 → 合并回 dev（纪律）
- 每棵树独立走完六阶段（gate 绿）。合并只走 git-native：在 `dev` 上 `git merge <slug>` 或 `git cherry-pick`；**绝不** `cp` 文件进主树 `lib`/`bin`（roadmap v3 §三硬规则）。
- 冲突人裁（route:human）：并行轨若碰同一文件，合并时 git 会暴露冲突，人工解。所以**尽量让各轨碰不相交的文件**——slug 全局唯一 + 关注面分离是前提。
- 合并完拆树：`git worktree remove <落点>` + `git branch -d <slug>`。

## 为什么不建「共享池」
共享池（一个目录塞 5 槽 + `LOOP_CONTRACT_FILE` 选槽 + `breaker --state`）是给「多 session 挤同一棵 checkout」用的——恰是 worktree 要消灭的场景。设计红队对池判 1 High（`breaker --state` 路径注入覆盖冻结 PRD）+ 4 Med（cap TOCTOU / env 中毒 / 忘 export fail-open 方向 / slug 键控共享交付物串味）。worktree 隔离把状态在文件系统层隔开，上述洞全消失，只留「slug 全局唯一」一条纪律正面堵串味。详见 `proposed/DESIGN-DRAFT.md` §2。

## 底层不变量（别踩）
- `loop-kit/bin/contract.mjs` 的 `ROOT` 由自身文件位置推导 = 所在 worktree 的根；在哪棵树跑就动哪棵树的 `loop/`。
- `active-contract.json` / `.breaker-state.json` gitignored，不入库、不随 checkout 带过去——这正是每树独立的根因，别把它们加进版本控制。
- `hook-loop-guard.mjs`、`breaker.mjs`、`contract init/advance/check/show` 本契约逐字节没改；worktree 化不改变任何单树内的既有纪律。

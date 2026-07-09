# worktree-baton GRILL（阶段0 决策档，grill-with-docs）

> full 契约。以 `proposed/DESIGN-DRAFT.md`（B 案）为设计事实源，本档只把真岔口与需人签核项摊出来对抗质询，不复述设计。
> 前置已定（用户 2026-07-09 两次拍板）：隔离模型 = git worktree；范围 = B 案（顺 worktree，不建共享池）。

## 决策树

### D1 隔离模型 = git worktree（已定）
问题：5 路并行碰 `lib`/`bin` 怎么防串写？岔口：worktree 隔离 / 共享树纪律 / 共享池。
定夺：worktree（用户拍板）。理由：`active-contract.json`/熔断态 gitignored 每树一份，实证零改动即隔离；git-native 合并结构性防串写。

### D2 不建共享池（已定，B 否决 A）
问题：要不要 `loop/active/` 池 + `LOOP_CONTRACT_FILE` 选槽 + `breaker --state`？
定夺：不建（用户拍板 B）。理由：池是「多 session 挤同一 checkout」的解，背离 worktree；红队对池判 1 High + 4 Med、明说不建议进 accept（见 DESIGN-DRAFT §2）。不建池 = 那些洞全消失。

### D3 交付面 = 可见性 + 人体工学 + 文档（三样，零破坏）
`contract list`（跨树 read-only 总览）+ `contract worktree`（起树脚手架）+ 纪律文档。理由：现机制已能并行（实证），缺的只是「看得见 + 起得快 + 有章法」。

### D4 `contract worktree` 的 worktree 落点
问题：新 worktree 建在哪？岔口：默认兄弟目录 `../<repo>-<slug>` / 强制显式 `--path`。
定夺：默认兄弟目录，`--path` 可覆盖。理由：零参数即用是脚手架的意义；落点越界由 slug 校验兜。**（低风险，实现方定，非签核项）**

### D5 slug 全局唯一守卫强度【需签核】
问题：`contract worktree <slug>` 若 ROOT 下已有 `loop/prd-<slug>.json` 或 `docs/plans/<slug>/`（入库共享交付物）怎么办？岔口：硬拒 exit 3 / 只告警放行。
背景：这是红队指出的**唯一真串味载体**——同名 baton 骑另一 baton 的 gate-绿、覆盖冻结断言。硬拒把它堵死在起点；告警放行留口子。
倾向：硬拒。**交 Steven 签核。**

### D6 并发上限 ≤5 的落法【需签核】
问题：≤5 并发 worktree 是机制强制还是纪律？岔口：文档建议（人自律）/ `contract worktree`/`list` 加软校验（数 worktree ≥5 时告警或拒）。
背景：worktree 数无廉价全局锁（多进程 TOCTOU），硬限收益低且和「zero 机制改动」的 B 初衷相悖；软告警成本低。
倾向：文档建议为主 + `contract list` 顺带显示当前 worktree 数（不拒，只提示）。**交 Steven 签核。**

### D7 不加 `breaker --state`
问题：熔断态要不要按 baton 参数化？定夺：不加。理由：每 worktree 的 `.breaker-state.json` gitignored 已每树一份、天然隔离；加 `--state` 即背红队那条 High（路径注入覆盖冻结 PRD）。**（实现方定）**

### D8 git-native 合并 + 冲突人裁 = 纪律非机制
问题：并行轨绿了怎么回 `dev`？定夺：各树自绿 → `merge`/`cherry-pick` 回 `dev`，绝不 `cp` 进 `lib`/`bin`（roadmap v3 §三硬规则）；冲突人裁（route:human）。不建自动合并守卫。**（实现方定，纪律入 GUARDRAILS）**

### D9 `contract list` 输出非字节冻结
问题：list 输出要不要金牌逐字节锁？定夺：人读总览，金牌只锁关键子串（每 slug 现身、计数正确、坏输入降级不崩），不锁排版字节。理由：人读视图排版会演进，锁字节脆。**（实现方定）**

## 需 Steven 签核清单
- D5 slug 全局唯一守卫强度（硬拒 vs 告警）。
- D6 并发 ≤5 的落法（文档建议 vs 软校验）。

## 攻击面小结（accept 前处理）
- T1 slug 键控共享 `prd`/`docs` 串味 → D5 守卫堵（红队 Med，B 主要残风险）。
- T2 `contract worktree` 起树部分失败留悬挂树 → 步骤 7 回滚（worktree remove --force）。
- T3 slug 作分支名/目录名注入 → `^[A-Za-z0-9_-]+$` 校验 + git 自身拒非法 ref。
- T4 `contract list` 读到坏 JSON/缺文件崩 → fail-safe 降级显示、绝不抛（G5 锁）。
- T5 back-compat 漂移：新增两 case 误改现有 dispatch → G6/tier1 回归锁。

## 护栏对账
- 护栏 #11 阶段互锁：本契约自身走 full 六阶段；新命令不弱化 hook（hook 逐字节不改）。
- 护栏 #15 裁判零 LLM：不涉裁判。
- ADR-0005 造词登记：三术语（并行工作树 baton / 跨树 baton 总览 / 起树脚手架）accept 前登记 CONTEXT.md。

## 非目标
不建池、不加 env 选槽/`breaker --state`、不建自动合并守卫、不硬编码并发上限、不改 hook/breaker/现有 contract 子命令。

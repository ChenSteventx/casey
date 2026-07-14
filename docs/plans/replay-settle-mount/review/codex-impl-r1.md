# replay-settle-mount 实现审记录（r1，`codex`）

## 评审元数据

- 评审对象：`replay-settle-mount` 契约实现 diff（Casey 树 `dev`...`HEAD`(`15f1797`)，15 文件，1171 行插入 / 24 行删除）。评审料：`docs/plans/replay-settle-mount/review/material-impl-r1.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-replay-settle-mount -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 效力值口径更正（如实记）：任务指令原写 `model_reasoning_effort=fast`，实测该枚举对 `gpt-5.6-sol` 非法（`codex` API 400 `invalid_enum_value`，合法值 `none|minimal|low|medium|high|xhigh`）；驱动员就地改用 `medium` 重跑，首次尝试（`fast`）产出作废、不入档。
- 护栏 #9：评审料只含 spec 要点（GRILL/plan）+ 完整实现 diff（`git diff dev...HEAD`）+ 门禁证据（gate 日志摘录、prd 重签记录、全仓 ratchet/tier1 摘要、红先行存证摘录），不含凭据、不含实现者内心推理。
- 运行备注：`read-only` 沙箱下 `codex` 对本 worktree 有只读文件与命令执行权限——本轮实际执行了只读探针（对 `lib/replay-settle.mjs` 关键逻辑做最小复现脚本，验证固定下限与条件预算的时序关系）+ `git status`/`git diff --check`/`nl -ba` 等只读命令核对源码行号与冻结证据。进程正常产出完整终判并退出（`tokens used 133,249`）。驱动员核验：评审前后 `git status --short` 一致（仅本轮新增的 `review/material-impl-r1.md`），worktree 无被写入痕迹。

## 结论（原文）

非 PASS。未发现 HIGH；发现 1 个 MED、1 个 LOW。

## MED

1. **条件预算错误地包含了固定下限，违反「下限后仍给足 2500ms」的铁不变量**

   文件：`lib/replay-settle.mjs:42`（`t0` 记录点）、`:67`（`floorMs` 睡眠）、`:71`（`while` 循环预算判据）；`docs/plans/replay-settle-mount/plan.md:9`、`:13`（铁不变量原文「条件预算 ≥ 编译期同等（2500ms）」）。

   `t0` 在固定下限之前记录，循环却用 `Date.now() - t0 < budgetMs`。因此默认配置（`floorMs=250`、`budgetMs=2500`）不是「250ms floor + 2500ms 条件预算」，而是「250ms floor + 约 2250ms 条件预算」。最小探针实测：`floorMs=250, budgetMs=2500` 的永不稳定页只获得约 2301ms 条件观察窗；`floorMs=250, budgetMs=100` 时静默点在下限结束后直接进入兜底，`page.evaluate` 调用次数为 0。

   这也削弱了金牌 I5：`tests/_golden/replay-settle-mount.golden.mjs:259` 声称验证「条件预算 100ms 耗尽」，实际验证的是「固定下限已经吃完全部预算后直接兜底」；U2 的断言只要求总等待大于 `budgetMs`（`tests/_golden/replay-settle-mount.golden.mjs:83-86`），因此捕捉不到这一偏差。

   失败场景：页面在固定下限后的第 2250–2500ms 区间才完成挂载，当前实现可能提前采集并产生原问题同类的假阴。

   建议：把条件循环的 deadline 建在 floor 完成之后（另起一个 `loopT0`），同时仍用总起点计算对外的 `waitedMs`；补一案明确验证「不稳定页面至少经历 floor + budget」，并让 I5 断言条件轮询确实发生过（`evaluate` 调用次数 > 0）。

   驱动员复核：已用最小 Node 脚本直接复现（`await sleep(floorMs)` 后 `while (Date.now()-t0<budgetMs)`，`floorMs=250,budgetMs=2500` 实测 `waitedMs≈2575`、循环覆盖窗口≈2250ms），与 `codex` 描述一致，判定 `CONFIRMED`。

## LOW

2. **单步有界，但「整体不逼近 120s watchdog」的说法缺少多代表步验收**

   文件：`docs/plans/replay-settle-mount/plan.md:76`；`tests/_golden/replay-settle-mount.golden.mjs:279`（I6）。

   I6 只验证一个代表步 `waited < 4000ms`。按计划自己给出的最坏值约 4.75s/intent，约 26 个持续在途的代表步就可能超过 120s；DOM 持续扰动分支约 2.75s/intent，约 44 个 intent 也可能触达 watchdog。因此「常规用例 intent 数十以内不逼近」不能由当前金牌推出。

   这不是无限等待：单步三段均有界，背景 denylist 轮询也不会进入 `inFlightApi`。问题是整体时限按代表步线性累加。建议收窄文档承诺，或增加多 intent 走时预算测试。

## 其余核查（codex 原文，无独立分级）

- 归因语义：未发现问题。静默点接在 `currentStepId=null` 之后；`attributedStepId` 算法未改。denylist 请求不进入 `inFlightApi`。
- 复合判据：稳定对没有跨零点；`evaluate` 抛错/悬挂和 `inFlight()` 抛错路径符合设计。已登记的等长 DOM 碰撞、响应后延迟提交等盲区仍是 fail-safe 假阴方向。
- 金牌：I1/I2 对按钮、占位、toast 均有实质断言；I4 防期望驱动轮询；I6 的背景轮询确实由夹具全局 300ms 定时请求产生。除上述预算口径外，未发现弱断言绕绿。
- 即时路径：I3 有 `waited < 1500ms` 和 `quietPointReached:true` 量化锁。
- 冻结纪律：三个 checksum 与当前文件 sha256 完全一致。反向索引确认旧 PRD 中只有 `prd-p5-replay` 和 `prd-replay-nth-visible-hardening` 冻结相关夹具，未漏重签。仓内写 `story.passes` 的实现仍只有 `gate.mjs`；最终提交中的 `passes:true` 与所附 gate flip 证据一致。
- 裁判不变量：`bin/verdict.mjs`、`lib/replay-assert.mjs`、`run-history.schema.json` 相对 `dev` 均零改动。
- 凭据：未发现 `.auth` 内容、凭据值或真机地址；只有回环地址与合成夹具引用。
- 术语：未发现繁体字或明显未登记术语；仓内 `term-lint` 复核通过。

## 处置与去向

本记录是本契约实现阶段的正式异构冗余评审产出（护栏 #9 达成，非同族兜底）。1 项 `MED`（经驱动员最小复现脚本核验为 `CONFIRMED`）未清零，`codex` 判据为「非 PASS」——按契约流程应先反馈实现方修订，视 Steven 判断决定是否需要再走一轮实现审，不应现状直接 `advance review`/`advance learn` 收尾。

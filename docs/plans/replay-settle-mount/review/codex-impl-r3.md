# replay-settle-mount 实现审记录（r3，`codex`）

## 评审元数据

- 评审对象：round-2 两路收敛的 `A2`（`plan.md:76` 走时上界式自相矛盾）再修订。评审料：`docs/plans/replay-settle-mount/review/material-impl-r3.md`（spec 铁不变量 + r2 findings + 修复 diff + 门禁证据；护栏 #9，不含凭据、不含实现者内心推理；本轮仅动一行文档）。
- 评审形态：异构冗余评审——实现方 = Claude（`opus 4.8`），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-replay-settle-mount -s read-only -m gpt-5.6-sol -c model_reasoning_effort=low -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 运行备注：`read-only` 沙箱下 `codex` 跑了只读探针——`term-lint --file plan.md`（通过）、`git diff --stat`（确认仅 `plan.md` 一行改动）、并尝试复跑金牌（当前只读环境 `mkdtemp('/tmp/...')` 报 `EROFS` 未能起，`codex` 明确判定为环境限制、不构成本轮 finding）。驱动员核验：评审前后 worktree 无被写入痕迹。

## 结论

PASS。未发现本轮再修订引入的新问题。

## 原文（verbatim）

```
PASS

未发现本轮再修订引入的新问题。

- 250 + 2500 + 500 + 120 + 2000 = 5370ms，写作静态最坏约 5.4s 与实现控制流一致。
- 非 settle 开销已明确排除，并要求额外预留 headroom。
- 删除具体"安全 intent 数"承诺后，已消除贴近 watchdog 却称"不逼近"的算术矛盾。
- 本轮仅修改 plan.md 一行；裁判、断言、schema 冻结面 diff 为空，归因及 fail-safe 语义未变。
- term-lint 实测通过。金牌在当前只读环境因无法创建 /tmp 临时目录而未能复跑；这是环境限制，不构成本轮 finding。
```

## 驱动员归档附注

- `codex` 独立核算 `250+2500+500+120+2000=5370ms` 与实现控制流（`lib/replay-settle.mjs` 条件循环仅拍首查预算、末拍溢出 `EVAL_RACE_MS`+`TICK_MS`）一致，确认再修订后的保守上界自洽；确认「弃安全 intent 数承诺」消除了 r2 两路指出的算术矛盾；确认铁不变量仍守。判 PASS。
- 与同轮 `pi`（PASS）双路一致。驱动员按护栏 #9 如实记档。

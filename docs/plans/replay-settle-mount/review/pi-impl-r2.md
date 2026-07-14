# replay-settle-mount 实现审记录（r2，`pi`）

## 评审元数据

- 评审对象：r1 findings（1 MED `A1` + 1 LOW `A2`）修订（`HEAD`=`ae5eb55`）。评审料同 `codex` 本轮：`docs/plans/replay-settle-mount/review/material-impl-r2.md`（护栏 #9，不含凭据、不含实现者内心推理）。
- 评审形态：异构冗余评审——实现方 = Claude（`opus 4.8`），评审方 = `pi`（评审家族≠实现家族），与 `codex` 并行独立核查。
- 评审方调用：`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro @docs/plans/replay-settle-mount/review/material-impl-r2.md "..."`，`pi-cli`。`--no-tools` 仅基于料文件判断、不自行读工作树。
- 前置 smoke：`READY` 令牌回读验真模型选中有效后再跑正式评审。首次正式跑 `Request timed out`（网络抖动），按协议重试一次即通。

## 结论

VERDICT: CHANGES（发现 1 个本轮修订问题，`pi` 定级 `MED`）。

## 原文（verbatim）

```
本轮修订引入一新问题：

- A2 收窄上界式未随 A1 修法重算单步走时上限（MED）。
  A1 将 settle 的总等待时间从「预算包含下限」改为「floorMs + 全额定条件预算」（典型 250+2500=2750ms），使单个代表步的 settle 阶段最多多花 250ms。
  但 A2 修改 plan.md 时仍沿用原 4.75s/intent 估算（120÷4.75≈25.3，收窄为约 25 个以内），未提供证据表明 4.75s 仍涵盖修订后的单步上限。
  失败场景：若单步其它阶段耗时贴近原来的余量（如 2.25s），修订后单步上限可能接近 5.0s；按 25 个连续代表步计，总时间可达 125s，突破 REPLAY_WATCHDOG_MS(120s) 触发整跑超时，用例便可能因架构级超时而非业务原因失败。

VERDICT: CHANGES
```

## 驱动员归档附注

- `pi` 与 `codex` 本轮独立收敛于同一 `A2` 缺陷：r1 收窄后的走时上界式仍不成立（`pi` 侧重「`4.75s` 估算未随 `A1` 修法重算」，`codex` 侧重「末拍溢出使实现上界约 `5.37s`、`25 × 4.75` 已逼近 120s」——两路指向同一算术不自洽）。r1 曾出现的 `pi` PASS / `codex` 非 PASS 分歧本轮消失，两路均判需修订。
- 两路均未对 `A1` 修法本身、铁不变量守恒（`verdict`/`assert` 字节不动、归因零动、fail-safe）提出新问题。
- 驱动员按护栏 #9 如实记档，不代评审者下判断。

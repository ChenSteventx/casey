# replay-settle-mount 实现审 r1 findings 处置台账（实现方修订）

修订方：`opus 4.8`（`high`），角色=实现方修复者。输入=`fable` 汇裁 `arb-impl-r1.md`（1 MED + 1 LOW，非 `mergeReady`）。
处置原则：真问题红先行修死（先金牌钉红、保留红证、再修绿），HIGH 不许挂账；本轮无 HIGH。

## A1（MED，CONFIRMED，采信修死）：条件预算被固定下限吃掉

### 病灶

`lib/replay-settle.mjs` 中 `t0 = Date.now()`（旧 :42）记录在 `floorMs` 睡眠（:67）之前，条件循环却用同一 `t0` 判 `while (Date.now() - t0 < budgetMs)`（旧 :71）。故条件观察窗被下限吃掉：

- 缺省 `floorMs=250`/`budgetMs=2500`：条件观察窗仅约 2250ms，不足铁不变量承诺的「条件预算 ≥ 编译期同等 2500ms」（`plan.md` :9/:13）。编译侧 `lib/compile-atoms.mjs` :205 的 `quietPoint` 中 `t0` 在循环入口记录、循环前无睡眠，独享全额 2500ms——对称承诺未达成。
- `budgetMs=100`（I5 形态）：下限 250ms 睡完后 `Date.now()-t0` 已 250 > 100，循环体一次未跑、`evaluate` 零调用，直接落兜底分支——I5 标称验证「条件预算耗尽」，实际路径是「固定下限吃完全部预算」。

失败场景：页面在下限后第 2250–2500ms 区间完成挂载且此刻在途已归零 → 提前按现状采 → 原真机 `tc_wf_publish_states` 同类计时假阴（本契约要修的病灶方向本身）。

### 红先行证据（金牌钉红，改前实测）

改前（`t0` 早记的旧实现）跑升级后金牌，两案如实红：

```
RED  U2a ...: 应 waitedMs≥下限+全额预算(1000)，实际 643（条件窗被下限吃掉=红）
RED  U8  ...: 条件循环须至少跑一拍（evaluate≥1），实际 0（下限吃完预算=条件轮询零次=红）
RED  replay-settle-mount: 14 过 / 2 红
```

- U2a 强化（`floorMs:400`/`budgetMs:600`，下限刻意大于一拍 120ms）：改前总等待 643ms（条件窗被下限吃掉、仅约 budget+一拍），断言「≥下限+全额预算(1000)」判红——原 U2a 只断「总等待≥预算」捕不到窗口缩水（汇裁 A1 指出的连带削弱）。
- U8 新增（`floorMs` 缺省 250 + `budgetMs:100`，I5 同参）：改前 `evaluate` 调用 0 次判红——直接钉「小预算下条件轮询确实发生」（汇裁 A1「I5 补断 evaluate 调用次数>0」，因 I5 走子进程无法计次，下沉到单元层钉死）。

### 修法

条件循环 deadline 建在下限睡完之后（另起循环起点 `loopStart`），`while (Date.now() - loopStart < budgetMs)`；对外 `waitedMs` 仍以总起点 `t0` 计（记账口径不变）。这样条件观察窗独享全额 `budgetMs`，与编译侧 `quietPoint` 对称。单代表步最坏走时上界随之为 `floorMs + budgetMs + (仅在途未归零时) IDLE_MS`，全程有界、fail-safe 不变。

改后金牌 16/16 全过（U2a 总等待约 1040ms ≥1000 绿、U8 `evaluate`≥1 绿；I1/I2/I5/W1 等原案照绿）。

## A2（LOW，采信）：多代表步累积走时缺回归锁、文档承诺未量化

汇裁核实 `REPLAY_WATCHDOG_MS`（120s）是整跑单计时器（`bin/replay.mjs` :162-163，一次 `setTimeout`），累加算术成立：按 plan 自述最坏约 4.75s/intent，约 26 个持续在途代表步即可能超 120s，而 26 落在原「数十以内」承诺范围内——承诺不能由现有金牌推出。

修法（采汇裁二选一之「收窄文档承诺为按 intent 数线性的显式上界式」）：`plan.md` :76 改为——`REPLAY_WATCHDOG_MS` 是整跑单计时器，N 个持续在途代表步累计上界 ≈ N × 4.75s，**约 25 个持续在途代表步以内不逼近 watchdog**（120 ÷ 4.75 ≈ 25.3；超此规模须上调 `REPLAY_WATCHDOG_MS` 或改多 intent 累积走时预算案）。原「数十以内」（含 26 个以上、超线性上界）作废。

非阻断项：单步三段均有界、`denylist` 轮询不进 `inFlightApi`，无无限等待——缺口纯在文档断言与验收的量化对齐，收窄措辞即闭。

## pi 全维 PASS 的处置

`pi`（r1）零 findings 与 `codex` 非 PASS 分歧，汇裁记档为异构冗余分歧（`pi` 走 `--no-tools` 纯读料、`codex` 走 `read-only` 沙箱跑只读探针把时序缺陷跑显形），不作驳回依据。本轮 A1 即「跑一下才显形」的时序缺陷，已修死。

## 不变量核查

- `bin/verdict.mjs` / `lib/replay-assert.mjs` / `tests/_golden/schemas/run-history.schema.json` 相对 `dev` 零改动（`git diff --stat dev...HEAD` 空）。
- 本次修订仅动 4 文件：`lib/replay-settle.mjs`（循环起点）、`tests/_golden/replay-settle-mount.golden.mjs`（U2a 强化 + U8 新增）、`docs/plans/replay-settle-mount/plan.md`（:76 收窄）、`loop/prd-replay-settle-mount.json`（golden sha256 重签 + s1 desc 同步 U8）。
- `passes` 仍只 `gate.mjs` 写；golden 冻结面 sha256 重签（`cf81e014…`）。归因语义零动（静默点全程 `currentStepId` 为 null，接线未改）。

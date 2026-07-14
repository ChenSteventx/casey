# replay-settle-mount 实现审 r2 findings 处置台账（实现方修订）

修订方：`opus 4.8`（`high`），角色=实现方修复者兼 round-2 异构冗余评审驱动员（备料/跑 CLI/归档，不代评审者下判断）。
输入=round-2 两路复核（`codex` `LOW` + `pi` `MED`，见 `codex-impl-r2.md`/`pi-impl-r2.md`）。处置原则：真问题修死、`HIGH` 不许挂账；本轮无 `HIGH`。

## 两路收敛 finding（`A2` 再现）：走时上界式仍自相矛盾

### 病灶

r1 对 `A2` 的收窄（`plan.md:76`「约 25 个持续在途代表步以内不逼近 watchdog」）仍不成立，`codex`（`LOW`）与 `pi`（`MED`）本轮独立收敛：

- 算术不自洽：`25 × 4.75s ≈ 118.75s` 实已逼近 `REPLAY_WATCHDOG_MS`(120s)，把贴近 watchdog 的步数称作「不逼近」自相矛盾。
- 单步 settle 上界被低估：条件循环仅拍首查预算（`lib/replay-settle.mjs:75`），末拍可再溢出 `tickLen`（`EVAL_RACE_MS` 500）+ `sleep`（`TICK_MS` 120），故实现上界约 `250+2500+500+120+2000=5.37s`（`codex` 实测），非 `4.75s`；且动作/`waitForResponse`/采集/nav 等非 settle 开销未计入。`pi` 补指：`A1` 修法本身已使单步 settle 多花约 250ms（下限移出预算），`4.75s` 未随之重算。

失败场景：25 个连续持续在途代表步累计可达约 118.75–125s，触发整跑 watchdog 超时——用例因架构级超时而非业务原因失败。方向仍 fail-safe（超时是整跑级、非假绿），但文档承诺不成立。

### 修法（采两路共识：弃安全 intent 数承诺）

`plan.md:76` 再修订：

1. 单步 settle 静态上界由错值 `4.75s` 改为保守 `≈5.4s`，显式列末拍竞速溢出（`EVAL_RACE_MS` 500 + `TICK_MS` 120）——匹配 `codex` 实测 `5.37s`；
2. 显式声明非 settle 开销（动作/`waitForResponse`/采集/nav）未含在数字内、须另留 headroom；
3. 彻底删除「约 25 个以内不逼近」这一自相矛盾的具体安全 intent 数承诺，改为只陈述线性关系 `N × 5.4s` + 把「留 headroom / 上调 `REPLAY_WATCHDOG_MS` / 改累积预算案」列为整跑规模责任。

两路本轮均建议「只陈述线性关系、不承诺安全 intent 数」（`codex` 原文）/「重算单步上限」（`pi`），本修法二者兼采。本轮仅动 `plan.md:76` 一行文档，`lib`/金牌/`prd`/裁判面零改动（`A2` 属文档承诺量化对齐，非机制缺陷，r1 即以「收窄文档承诺」路径处置，本轮延续同路径把措辞改到自洽）。

### 复核证据（round-3 双路 PASS）

- `codex`（r3）：PASS——独立核算 `250+2500+500+120+2000=5370ms` 与实现控制流一致，确认弃承诺消除算术矛盾、铁不变量仍守（`review/codex-impl-r3.md`）。
- `pi`（r3）：VERDICT: PASS——无新 finding（`review/pi-impl-r3.md`）。
- 双路一致 PASS，`A2` 收口。

## 不变量核查

- `bin/verdict.mjs` / `lib/replay-assert.mjs` / `tests/_golden/schemas/run-history.schema.json` 相对 `dev` 零改动。
- 本轮修订仅动 `docs/plans/replay-settle-mount/plan.md` 一行；无任何 prd 冻结面命中（`plan.md` 非任何 `testChecksums` 成员），零新增重签。
- 金牌 `replay-settle-mount` 16/16 原样绿（doc 改动不触碰测试逻辑）；`passes` 仍只 `gate.mjs` 写。

# replay-settle-mount 实现审 round-2 评审料

评审对象：r1 findings（1 MED + 1 LOW）的修订。异构冗余评审——实现方=Claude，评审方≠实现家族。
料内容（护栏 #9）：spec 铁不变量 + r1 findings + 修复 diff + 门禁证据 + 处置表。无凭据、无实现者内心推理。

## spec 铁不变量（不变）

回放代表步（`isLast`）采集断言前补有界静默点 `settleBeforeCapture`（`lib/replay-settle.mjs`），镜像编译侧 `quietPoint`。铁不变量：

- 纯观察者、有界、fail-safe（绝不外抛 / 绝不无限等 / 超预算按现状采不吞步）；
- 条件预算 ≥ 编译期同等（缺省 2500ms，对齐 `compile-atoms.mjs` `quietPoint`）；
- 固定下限（缺省 250ms）是「条件式静默点的起步垫」，绝不承担「等到按钮出现」（那是条件的活）；
- `bin/verdict.mjs` 与 `lib/replay-assert.mjs` 字节不动；`passes` 只 `gate.mjs` 写；归因语义零动（静默点全程 `currentStepId` 为 null）。

## r1 待修 findings（fable 汇裁 arb-impl-r1.md）

- A1（MED，CONFIRMED）：`t0` 记录早于 `floorMs` 睡眠，条件循环 `while(Date.now()-t0<budgetMs)` 用同一 `t0`，故条件观察窗被下限吃掉（floor 250/budget 2500 时仅约 2250ms），违反「条件预算 ≥ 编译期同等 2500ms」铁不变量；`budgetMs=100` 时循环体一次未跑、`evaluate` 零调用。失败场景：页面在下限后 2250–2500ms 区间挂载且在途已归零 → 提前采 → 原真机同类计时假阴。连带削弱 I5（标称验证「条件预算耗尽」实为「下限吃完预算」）与 U2a（只断总等待≥预算、捕不到窗口缩水）。
- A2（LOW）：plan.md :76「常规用例 intent 数十以内不逼近 `REPLAY_WATCHDOG_MS`(120s)」承诺未被验收覆盖——watchdog 是整跑单计时器，按 4.75s/intent，约 26 个持续在途代表步即可能超 120s，26 落在「数十以内」范围。

## 修复 diff

```diff
--- a/lib/replay-settle.mjs
+++ b/lib/replay-settle.mjs
@@ settleBeforeCapture @@
   if (floorMs > 0) await sleep(floorMs);
 
+  // 条件循环独享全额预算（评审 A1）：deadline 建在下限睡完之后（另起循环起点 loopStart），绝不用总起点 t0——
+  // 否则下限会吃掉条件观察窗（floorMs=250/budgetMs=2500 时条件窗仅约 2250ms），违反「条件预算 ≥ 编译期同等
+  // 2500ms」铁不变量。对外 waitedMs 仍以 t0 计。
+  const loopStart = Date.now();
   let prevLen = null;
   let prevZero = false;
-  while (Date.now() - t0 < budgetMs) {
+  while (Date.now() - loopStart < budgetMs) {
```

（`waitedMs` 计算处仍为 `Date.now() - t0`，两处未改，记账口径不变。）

金牌 `tests/_golden/replay-settle-mount.golden.mjs`：

```diff
 // U2a 强化：floorMs 100/600 → 400/600（下限刻意大于一拍 120ms），断言从「waitedMs≥预算(600)」
 // 改为「waitedMs≥下限+全额预算(1000)」——钉条件窗不被下限吃掉。
-  const r = await settle(page, { inFlight: stubInFlight(0), floorMs: 100, budgetMs: 600 });
-  if (!(r.waitedMs >= 600)) throw ...
+  const r = await settle(page, { inFlight: stubInFlight(0), floorMs: 400, budgetMs: 600 });
+  if (!(r.waitedMs >= 400 + 600)) throw new Error(`应 waitedMs≥下限+全额预算(1000)...（条件窗被下限吃掉=红）`);

 // U8 新增：floor 缺省 250 + budgetMs 100（I5 同参）永不稳定页 → evaluate 调用≥1、settled false。
+await checkAsync('U8 小预算下条件轮询仍发生...', async () => {
+  const r = await settle(stubPage((k)=>1000+k*7), { inFlight: stubInFlight(0), budgetMs: 100 });
+  if (r.settled !== false) throw ...
+  if (!(page._calls.evaluate >= 1)) throw new Error(`条件循环须至少跑一拍（evaluate≥1）...（下限吃完预算=条件轮询零次=红）`);
+});
```

plan.md :76 收窄为按 intent 数线性显式上界：`REPLAY_WATCHDOG_MS` 是整跑单计时器（`bin/replay.mjs` :162-163，一次 `setTimeout`、各出口 `clearTimeout`），N 个持续在途代表步累计上界 ≈ N × 4.75s，约 25 个以内不逼近 watchdog（120 ÷ 4.75 ≈ 25.3；超此须上调 `REPLAY_WATCHDOG_MS` 或改多 intent 累积走时预算案）。原「数十以内」（含 26 个以上超线性上界）作废。

prd `loop/prd-replay-settle-mount.json`：golden sha256 重签 `018884e1…` → `cf81e014…`；s1 desc 同步 U1-U8。

## 红先行证据（改前跑升级后金牌）

```
RED  U2a ...: 应 waitedMs≥下限+全额预算(1000)，实际 643（条件窗被下限吃掉=红）
RED  U8  ...: 条件循环须至少跑一拍（evaluate≥1），实际 0（下限吃完预算=条件轮询零次=红）
RED  replay-settle-mount: 14 过 / 2 红
```

## 门禁证据（改后）

- 金牌 `node tests/_golden/replay-settle-mount.golden.mjs`：`ok 16/16 全过`。
- `gate --prd loop/prd-replay-settle-mount.json`：`GREEN —— story 2/2 过`（含 `selftest --tier1` 绿）。
- `ratchet verify`：`GREEN -- 71 PRD / 194 冻结文件 / 0 问题`。
- 不变量：`git diff dev...HEAD -- bin/verdict.mjs lib/replay-assert.mjs tests/_golden/schemas/run-history.schema.json` 空（零改动）。
- 本轮修订仅 4 实现/文档文件：`lib/replay-settle.mjs`、`tests/_golden/replay-settle-mount.golden.mjs`、`docs/plans/replay-settle-mount/plan.md`、`loop/prd-replay-settle-mount.json`。

## 处置表

| r1 finding | 处置 | 证据 |
|---|---|---|
| A1（MED，条件预算被下限吃掉） | 采信修死：条件循环起点改 `loopStart`（下限睡完后），`waitedMs` 仍以 `t0` 计 | U2a 强化 + U8 新增红先行钉红→修后绿；金牌 16/16 |
| A2（LOW，走时承诺未量化） | 采信收窄：plan.md :76 改按 intent 数线性显式上界（约 25 个以内） | plan.md diff |

## 评审指令

请核：(1) A1 修法是否真消除条件窗缩水——`loopStart` 在下限后另起、条件循环是否确得全额 `budgetMs`，`waitedMs` 记账是否仍以总起点 `t0`（对外口径不变）；(2) U2a/U8 是否真钉住该缺陷（改前红、改后绿，非弱断言凑绿）；(3) A2 收窄后的上界式是否自洽（N × 4.75s 线性、约 25 个以内）；(4) 铁不变量是否仍守（纯观察者/有界/fail-safe、verdict/assert 字节不动、归因零动）。只报本轮修订引入的新问题；无则 PASS。

# replay-settle-mount 实现审 round-3 评审料

评审对象：round-2 两路收敛的 `A2`（走时上界式自相矛盾）的再修订。异构冗余评审——实现方=Claude，评审方≠实现家族。料内容（护栏 #9）：spec 铁不变量 + r2 findings + 修复 diff + 门禁证据。无凭据、无实现者内心推理。料压小：本轮仅动 `plan.md:76` 一行文档，`lib`/金牌/`prd`/裁判面零改动。

## spec 铁不变量（不变）

回放代表步（`isLast`）采集断言前的有界静默点 `settleBeforeCapture`（`lib/replay-settle.mjs`），镜像编译侧 `quietPoint`。纯观察者、有界、fail-safe；条件预算 ≥ 编译期同等（缺省 2500ms）；固定下限（缺省 250ms）是起步垫、绝不承担「等到按钮出现」；`bin/verdict.mjs`/`lib/replay-assert.mjs` 字节不动、`passes` 只 `gate.mjs` 写、归因语义零动。

## r2 待修 finding（两路收敛）

`codex`（`LOW`）+ `pi`（`MED`）本轮独立收敛于同一缺陷：r1 收窄后的 `plan.md:76` 走时上界式仍不成立。

- `codex`：循环仅拍首查预算，末拍可再花 `tickLen`（`EVAL_RACE_MS` 500）+ `sleep`（`TICK_MS` 120），故单步 settle 实现上界约 `250+2500+500+120+2000=5.37s`，未计动作/采集等非 settle 开销；`25 × 4.75 ≈ 118.75s` 已逼近 120s，不能称「不逼近」，按实现上界约 22 步即达。建议改保守公式并预留非 settle 开销，或只陈述线性关系、不承诺安全 intent 数。
- `pi`：`A1` 把 settle 总等待从「预算含下限」改为「floorMs + 全额条件预算」，单步 settle 最多多花 250ms；`A2` 仍沿用原 `4.75s/intent` 估算未重算。失败场景：25 个连续代表步总时间可达 125s，突破 `REPLAY_WATCHDOG_MS`(120s)。

## 修复 diff（本轮唯一改动，`plan.md:76`）

```diff
-单代表步最坏 ≈ 250 垫 + 2500 预算 +（仅判据 A 未归零时）2000 兜底 ≈ 4.75s，代表步=每 intent 一步。`REPLAY_WATCHDOG_MS`（120s）是整跑单计时器（…），故 N 个持续在途代表步的累计上界按 intent 数线性 ≈ N × 4.75s——**约 25 个持续在途代表步以内不逼近 watchdog**（120 ÷ 4.75 ≈ 25.3；超此规模须上调 …）。评审修订（A2 采信）：原「数十以内」措辞含 26 个以上、超线性上界，收窄为按 intent 数线性的显式上界式。
+单代表步 settle 静态最坏 ≈ 250 垫 + 2500 预算 + 末拍溢出（条件循环仅拍首查预算，末拍可再花 `EVAL_RACE_MS` 500 + `TICK_MS` 120）+（仅判据 A 未归零时）2000 兜底 ≈ 5.4s，且每步非 settle 开销（动作 / `waitForResponse` / 采集 / nav）另计未含在内，代表步=每 intent 一步。`REPLAY_WATCHDOG_MS`（120s）是整跑单计时器（…），故 N 个持续在途代表步的 settle 累计上界按 intent 数线性 ≈ N × 5.4s（未含非 settle 开销）。本设计不承诺具体「安全 intent 数」：整跑规模逼近该线性上界（须再留 headroom 吸收非 settle 开销）时，须上调 `REPLAY_WATCHDOG_MS` 或改多 intent 累积走时预算案。评审修订（A2 两轮采信）：原「数十以内」及一轮「约 25 个以内不逼近」措辞均自相矛盾——25 × 4.75 ≈ 118.75s 实已逼近 120s，且 4.75s 漏算末拍竞速溢出与非 settle 开销，故弃「承诺安全 intent 数」改为只陈述线性关系 + 显式留 headroom 责任。
```

修订要点：(1) 单步 settle 静态上界由错值 `4.75s` 改为保守 `≈5.4s`，显式列入末拍竞速溢出（`EVAL_RACE_MS`+`TICK_MS`）——匹配 `codex` 实测 `5.37s`；(2) 显式声明非 settle 开销（动作/`waitForResponse`/采集/nav）未含在内、须另留 headroom；(3) 彻底删除「约 25 个以内不逼近」这一自相矛盾的安全 intent 数承诺，改为只陈述线性关系 `N × 5.4s` + 把「留 headroom / 上调 watchdog / 改累积预算案」列为整跑规模责任。

## 门禁证据（本轮再修订后）

- 本轮唯一改动 `docs/plans/replay-settle-mount/plan.md`（文档一行，非任何 prd 冻结面）；`lib`/金牌/`loop/prd-*`/裁判面零改动。
- 金牌 `node tests/_golden/replay-settle-mount.golden.mjs`：`16/16 全过`（doc 改动不触碰任何测试逻辑，回归照绿）。
- 不变量：`git diff dev...HEAD -- bin/verdict.mjs lib/replay-assert.mjs tests/_golden/schemas/run-history.schema.json` 空。
- `term-lint --file plan.md`：通过（0 提示）。

## 评审指令

请核：(1) `plan.md:76` 再修订后的走时上界式是否自洽——单步 settle 保守上界 `≈5.4s` 是否覆盖实现最坏路径（floor + budget + 末拍竞速溢出 + networkidle 兜底），非 settle 开销是否已如实排除在数字之外；(2) 弃「安全 intent 数承诺」改「线性关系 + headroom 责任」是否消除了 r2 两路指出的算术不自洽（不再出现「贴近 watchdog 的具体步数」被称作「不逼近」）；(3) 本轮仅动一行文档，铁不变量（`verdict`/`assert` 字节不动、`passes` 只 gate 写、归因零动、fail-safe 有界）是否仍守、有无因文档措辞引入对实现语义的错误陈述。只报本轮再修订引入的新问题；无则 PASS。

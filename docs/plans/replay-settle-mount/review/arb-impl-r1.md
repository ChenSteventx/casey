# replay-settle-mount 实现审汇裁记录（r1）

## 汇裁元数据

- 汇裁者：`fable`（`xhigh`），角色 = 代码评审汇裁；自评张力：被评实现方为 Claude 族（Sonnet 5），默认采信异构冗余两路（`codex`、`pi`）findings，只有具体反证才驳。
- 输入：`review/codex-impl-r1.md`（非 PASS，1 MED + 1 LOW）、`review/pi-impl-r1.md`（PASS，0 findings）。`crossFamily=true`（`codex` 已出结论），不触发 `BLOCKED_NO_CROSSFAMILY`。
- 本契约非 kernel，kernel 硬门不适用。
- 汇裁者独立复核：不只转抄驱动员核验，另写最小复现脚本直驱 `lib/replay-settle.mjs` 三场景实测（见下），与 `codex` 探针、驱动员复现三方数字一致。

## 汇裁者独立复核记录

复现脚本直接 `import` 本树 `lib/replay-settle.mjs`，三场景实测：

1. 缺省 `floorMs=250`/`budgetMs=2500`、DOM 每拍变长（永不稳定）：`waitedMs=2549`，`evaluate` 首调在动作后 252ms、末调在 2428ms，条件循环实际覆盖窗约 2176ms——不足铁不变量承诺的 2500ms。
2. `floorMs=250`（缺省）/`budgetMs=100`（金牌 I5 形态）：`evaluate` 调用次数 = 0，循环体一次未跑，静默点在下限睡完后直接落入兜底分支——I5 标称验证「条件预算耗尽」，实际执行路径是「固定下限吃完全部预算」。
3. 延迟挂载在下限后第 2300ms 才稳定（落在承诺的 2500ms 条件窗内、在实际约 2250ms 窗外）：`settled:false`、按现状采——若此刻判据 A 已归零（无 `networkidle` 兜底救场），产生与原真机事故同类的计时假阴。

旁证：编译侧 `lib/compile-atoms.mjs:203-213` 的 `quietPoint` 中 `t0` 在循环入口记录、循环前无任何睡眠，条件循环独享全额 2500ms——回放侧「条件预算 ≥ 编译期同等」的对称承诺确实未达成。

## 去重合并

两路无同处命中（`source=both` 计 0）：`pi` 零 findings，`codex` 两条均为独家。合并池即 `codex` 两条，无自增 findings（汇裁者对接线块 `bin/replay.mjs:470-489`、`tickLen` 竞速、判据 A 降级路径另做走读，未见新问题）。

## 逐条裁定

### A1（MED，采信，`CONFIRMED`）：条件预算被固定下限吃掉，违反「下限后仍给足编译期同等预算」铁不变量

- 出处：`codex` MED；文件 `lib/replay-settle.mjs:42`（`t0` 记录点）、`:67`（`floorMs` 睡眠）、`:71`（`while` 预算判据）；铁不变量原文见 `docs/plans/replay-settle-mount/plan.md:9`、`:13`。
- 裁定依据：汇裁者独立复现三场景全部坐实（上节 1/2/3），与 `codex` 只读探针、驱动员最小脚本三方一致。失败场景具体：页面在下限后第 2250-2500ms 区间完成挂载且此刻在途已归零，当前实现提前采集、产生原问题同类假阴——这正是本契约要修的病灶方向，属实质缺陷非口径之争。
- 连带削弱两处金牌：I5（`tests/_golden/replay-settle-mount.golden.mjs:259`）实际验证路径与标称不符（`evaluate` 零调用）；U2a（`:83-86`）只断总等待 ≥ 预算，捕不到条件窗缩水。
- 修法方向（沿 `codex` 建议）：条件循环 deadline 建在下限睡完之后（另起循环起点），对外 `waitedMs` 仍以总起点计；补金牌钉「永不稳定页总等待 ≥ 下限 + 全额预算」；I5 补断条件轮询确实发生（`evaluate` 调用次数 > 0）或改写 I5 标称。
- 定级维持 MED：违反已签铁不变量 + 有具体假阴窗口，但窗口窄（约 250ms 尾段）且失败方向 fail-safe（假阴判 `NEEDS_HUMAN`，绝非假绿）。

### A2（LOW，采信）：多代表步走时累积缺回归锁，「不逼近 120s watchdog」的文档承诺未被验收覆盖

- 出处：`codex` LOW；文件 `docs/plans/replay-settle-mount/plan.md:76`（承诺原文）、`tests/_golden/replay-settle-mount.golden.mjs:279`（I6 单步锁）。
- 裁定依据：汇裁者核 `bin/replay.mjs:162-163`——watchdog 是整跑单计时器（`setTimeout` 一次、各出口 `clearTimeout`），累加算术成立：按 plan 自述最坏约 4.75s/intent，约 26 个持续在途代表步即可能超 120s，而 26 落在「数十以内」的承诺范围——该承诺不能由现有金牌推出。
- 非阻断：单步三段均有界、denylist 轮询不进 `inFlightApi`，无无限等待；缺的是文档断言与验收的量化对齐。
- 修法方向：收窄 `plan.md:76` 承诺（给出按 intent 数线性的显式上界式）或补多 intent 累积走时预算案，二者取一即可。
- 定级维持 LOW：文档承诺与验收覆盖的缺口，非行为缺陷。

### pi 全维 PASS：如实记档，不作为驳回依据

- `pi` 结论「未发现问题」与 `codex` 非 PASS 直接分歧。`pi` 记录第 1 维原文引了 `while(Date.now()-t0<budgetMs)` 并判「预算上界保证」——看到了该行却未察觉 `t0` 记录点早于 `floorMs` 睡眠，属实质漏检而非口径差。
- `pi` 的零 findings 不构成对 A1/A2 的反证（未提供任何具体证据反驳），不能抵消已被复现坐实的发现。分歧成因合理推测（不代 `pi` 裁断）：`pi` 走 `--no-tools` 纯读料评审，`codex` 走 `read-only` 沙箱可跑只读探针——本条 MED 恰是「跑一下才显形」的时序缺陷。

## dispositions 台账

| 条目 | 处置 |
|---|---|
| `codex` MED（条件预算被固定下限吃掉） | 采信，`CONFIRMED`（汇裁者独立三场景复现 + 驱动员脚本 + `codex` 探针三方一致），入裁 A1，回实现方修 |
| `codex` LOW（多代表步累积缺回归锁） | 采信（watchdog 整跑作用域已核实、累加算术成立），入裁 A2，回实现方修文档或补案 |
| `pi` PASS（0 findings） | 如实记档为异构冗余分歧；漏检点 = `t0` 早于下限睡眠的时序细节；不作为驳回 `codex` 的依据 |

## 两路对照（comparison）

`codex`（1 MED + 1 LOW，非 PASS）与 `pi`（PASS，零 findings）同料同轮结论相反，重叠命中为零。分歧点集中在 A1：`pi` 原文引了预算判据行却判其正确，漏看 `t0` 记录点位置；`codex` 借只读沙箱跑了最小探针把时序缺陷跑显形。其余七个维度（归因语义 / 判据鲁棒 / 金牌实质性 / 即时路径 / 冻结纪律 / 裁判不变量 / 凭据与术语）两路结论一致全绿，汇裁者抽核未见异议。本轮采信更严格一路：两条 `codex` findings 全部成立。

## 终裁

`FINDINGS`（1 MED + 1 LOW）。不放行 `mergeReady`：A1 触铁不变量且削弱 I5/U2a 金牌效力，须回实现方修订（修 `lib/replay-settle.mjs` 循环起点 + 补/改金牌 + 视情况收窄 `plan.md:76` 承诺）后再走一轮实现审。

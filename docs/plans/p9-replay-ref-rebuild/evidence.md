# 证据：回放侧逐破坏步连续性 ref 重建

基线 `dev@96f6107`，工作树 `casey-p9-replay-ref-rebuild`，分支 `p9-replay-ref-rebuild`。
判红判绿只信退出码。

## 1. 环境补齐（先于取证）

工作树只带版本库内文件，`cases/` 与 `runs/` 在 `.gitignore` 内，故起手缺冻结件。
从主树 `/mnt/d/ctx/heren/casey` **复制真文件**补齐（绝不软链——软链会触物理边界核假红）：

- `cases/` 全量；
- `runs/**/execute-authority.json` 五枚（`prd-drift-scan` 点名的缺件）。

补齐前 `prd-drift-scan` 偏离 8 条（全为缺件），补齐后零漂移。此步只动被忽略的产物目录，
不进版本库、不改任何被追踪文件。

## 2. 红基线（实现前）

```
node tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs   → exit 1
```

R2–R5 四条红，红因逐条为 `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`（v3 段被闭合面判非法键）；
R1 已绿。存证 `docs/plans/p9-created-workflow-cleanup-continuity-v3/accept/red-proofs/destructive-continuity-ref-rebuild.red.txt`。

## 3. 落地面

| 文件 | 改了什么 |
|---|---|
| `lib/entity-semantic-lock-preflight.mjs` | `validateFrozenEntityLockArtifact` 认 `schemaVersion 3`（闭合面 = v2 + `destructiveContinuity`；观察行 = v2 + 必填 `kind`），新增授权边逐条结构校验；`readFrozenIdentityObservations` 兼收 v3；新增 `readFrozenDestructiveContinuity` |
| `bin/replay.mjs` | 建表之后、准入门之前、浏览器启动哨兵之前，按 I1–I8 逐条校验已签授权边并由已签观察行铸 ref 入表；任一不成立即具名硬退出 `exit 65` |

v1/v2 分支逐字未动；`admitDestructiveTargetContinuity` 及其逐破坏步语义一字未动。

## 4. 与金牌断言的逐条对应

| 场景 | 金牌断言 | 由哪条不变量满足 | 结果 |
|---|---|---|---|
| R1 ref 缺失 | `exit 65` + `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` + 哨兵缺席 | I9，既有准入门（未改） | 绿（保持） |
| R2 平台 ID 错配 | `exit 65` + `DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH` + 哨兵缺席 | I5，边自报值与被引观察行逐字比对 | 红转绿 |
| R3 跨类别 | `exit 65` + `DESTRUCTIVE_CONTINUITY_KIND_MISMATCH` + 哨兵缺席 | I3，`boundKind` 须等于按原子算出的目标类别 | 红转绿 |
| R4 挂错步 | `exit 65` + 拒因点名 `atstep_4` + 哨兵缺席 | I2 触发拒绝，拒绝行投影「仍未获授权的破坏步」清单 | 红转绿 |
| R5 合法 | `exit 66` + 哨兵在场 | 八条不变量全过 → 铸 ref 入表 → 准入门放行 | 红转绿 |

## 5. 金牌未覆盖拒因的探针（防死码）

金牌只钉四条拒因，其余五条另跑探针实证（探针不入库，只作证）：

```
ok  dup     → exit 65 + DESTRUCTIVE_CONTINUITY_DUPLICATE_STEP        + 哨兵缺席
ok  order   → exit 65 + DESTRUCTIVE_CONTINUITY_STEP_ORDER_MISMATCH   + 哨兵缺席
ok  fkey    → exit 65 + DESTRUCTIVE_CONTINUITY_OBSERVATION_REF_MISMATCH + 哨兵缺席
ok  intent  → exit 65 + DESTRUCTIVE_CONTINUITY_INTENT_MISMATCH       + 哨兵缺席
ok  nostep  → exit 65 + DESTRUCTIVE_CONTINUITY_STEP_NOT_IN_EVENTS    + 哨兵缺席
ok  badkey  → exit 65 + FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID       + 哨兵缺席（边带未登记键＝锁非法）
ok  empty   → exit 65 + DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF + 哨兵缺席（空段＝漏授权）
```

## 6. 门禁

```
node loop-kit/bin/gate.mjs --prd loop/prd-p9-replay-ref-rebuild.json   → exit 0
gate: GREEN —— story 6/6 过
```

六个 story 的 `passes` 由 `gate.mjs` 独占写入（S1 红件转绿、S2 动态 ID 路径八枚、S3 守卫家族已绿三枚、
S4 准入裁定邻接九枚、S5 回放消费者十一枚、S6 全仓卫生三项）。

上位契约 `loop/prd-p9-created-workflow-cleanup-continuity-v3.json` 的全绿留给签署之后：
它的 story 里含 `p9-tier2-selftest`，而该件红在签署面未完成（见下表 T7/T9a），与本轮无关。
本轮如实按金牌级窄验证收口，不冒充上位契约门禁已绿。

## 7. 基线既有的红（本轮未引入、未修复）

下列在实现之前就红，实现之后红因与计数逐条一致，属他家挂账：

| 金牌 | 红因 | 根因 |
|---|---|---|
| `entity-destructive-continuity-guard.crosskind` | X3 静态咬 `lib/compile-atoms.mjs` | 生产接线已迁 `lib/compile-atoms-agent.mjs`，静态断言仍钉旧门面 |
| `.round2` | D2（回放守卫回调）、E2（编译侧参数） | 同上：模块拆分后静态断言钉的文件已成门面 |
| `.round3` | R4a、R5c（回放侧静态） | 同上，接线已迁 `lib/replay/event-runner.mjs` |
| `.round4` | H4d、M（回放侧静态） | 同上 |
| `.wiring` | 回放侧调用面、编译侧导入 | 同上 |
| `p9-tier2-selftest` | T7、T9a 两条 | 主诉用例尚未编译产 `events.json`、三成员尚未接动态 ID 清理生产链——签署面未完成 |
| `agent-id-regression-diff` | R13 字节棘轮 | 与本轮无关的既有漂移 |
| `chiefcomplaint-v2-successor` | 读不到 `cases/tc_chiefcomplaint_smoke/events.json` | 与 T7 同根 |

一处**红因措辞位移**须如实标注：`.wiring` 的第一条断言原报「replay 未 import wiring 模块」，
本轮回放确实导入了铸造适配器，故该子断言转过，红点后移到同一条断言的下一句
「replay 未调用出站拦截安装器」。该金牌红/绿状态与红计数（10 过 / 2 红）与基线一致。

## 8. 诚实边界

浏览器前的授权链闭合了；出站消费链仍待真机确认。ref 填进表、准入门放行之后，
破坏动作才走到出站拦截，那一段的正确性 hermetic 证不出，需真浏览器，仍挂 `route:human`。
**不得宣称破坏链已闭。**

v3 冻结锁的产出侧（编译期攒授权边、随实体绑定草案交签署冻结）本轮不落，
故 v3 锁目前只有金牌夹具在造；真机用例升 v3 属另一契约。

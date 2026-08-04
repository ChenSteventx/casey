# GRILL：回放侧逐破坏步连续性 ref 重建（旧固定 ID 路径）

上位契约：`docs/plans/p9-created-workflow-cleanup-continuity-v3/plan.md`（§5 replay 面、§6 出站 guard）。
设计事实源：`docs/plans/destructive-continuity-ref/design-per-step-ref.md`（产物形状与不变量 I1–I9）、
`docs/plans/destructive-continuity-ref/design-replay-rebuild.md`（写入时机与拒绝点）。
本轮只落这两份设计稿写明的实现，不新增设计决策。

## D1 两条 v3 是两件事，绝不混线

「v3」在本仓有两个互不相干的所指，本轮不得让它们互相污染：

| 所指 | artifactKind | 谁在读 | 本轮动它吗 |
|---|---|---|---|
| 已创建工作流归属授权 | `created-workflow-ownership-authority` | `lib/entity-created-workflow-continuity-v3.mjs` | 不动，一字不改 |
| 冻结实体锁第 3 版 | `entity-locks-frozen`（`schemaVersion: 3`） | `lib/entity-semantic-lock-preflight.mjs` | 本轮新增 |

两者各自独立的闭合面与签名算法，同名只是版本号巧合。动态 ID 路径（`--batch-token` 起
`createdWorkflowController` 的那条）本轮零改动，其八枚金牌是停机条件。

## D2 本轮补的是「表怎么被填满」，不是「表怎么被检查」

`admitDestructiveTargetContinuity` 及其逐破坏步语义（codex round-2 High 收口）原样保留，
一个字符不动——改它就要动 round-2 人签冻结金牌，属 ADR-0004 重签事件。
本轮只在 `bin/replay.mjs` 建表之后、准入门之前把表填满。

## D3 拒因词表：拒绝必须当场具名，不许降级成「缺失」

设计纪律一（`design-replay-rebuild.md:75-79`）：授权边不合法时若只是「不铸」让下游准入门去拒，
拒因会退化成 `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`——「锁里压根没写」与
「锁里写了但是伪造的」变得不可区分，而第二种是攻击信号。故本轮一律硬退出并具名：

| 拒因 | 不变量 | 含义 |
|---|---|---|
| `DESTRUCTIVE_CONTINUITY_STEP_NOT_IN_EVENTS` | I1 | 授权边指向 events 里不存在的步 |
| `DESTRUCTIVE_CONTINUITY_ATOM_MISMATCH` | I1 | 边自报原子与该步实际原子不符 |
| `DESTRUCTIVE_CONTINUITY_INTENT_MISMATCH` | I7 | 边自报意图与该步实际意图不符 |
| `DESTRUCTIVE_CONTINUITY_ATOM_NOT_TARGETING` | I2 | 给非破坏步发授权 |
| `DESTRUCTIVE_CONTINUITY_STEP_ORDER_MISMATCH` | I6 | 位序造假 |
| `DESTRUCTIVE_CONTINUITY_KIND_MISMATCH` | I3 | 跨类别绕过 |
| `DESTRUCTIVE_CONTINUITY_OBSERVATION_REF_MISMATCH` | I4 | 选了甲、外键引了乙 |
| `DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH` | I5 | 边自报平台 ID 与被引观察行不符 |
| `DESTRUCTIVE_CONTINUITY_DUPLICATE_STEP` | I8 | 一步两条授权 |
| `DESTRUCTIVE_CONTINUITY_IDENTITY_CHANNEL_UNVERIFIED` | 前置 | 通道指纹未核完就要铸 ref |
| `OBSERVATION_SELECT_*` | I4 | 观察选取纯函数自己的拒因，原样外露 |

上表拒因一律 `process.exit(65)`、不启动浏览器。既有
`DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`（I9，锁里压根没写）保持现状。

## D4 拒绝行须点名「未获授权的破坏步」

红验收 R4 把授权边挂到观察步 `atstep_3`、破坏步 `atstep_4` 因此仍无授权，断言要求拒绝输出
点名 `atstep_4`。硬退出发生在边校验处（点的是 `atstep_3`），故拒绝行必须同时投影
「此刻仍未获授权的破坏步清单」——即 events 里所有破坏步减去已成功铸出 ref 的步。
这既满足逐步可诊断，也不与 D3 的当场具名冲突：一行里既有攻击信号（具名拒因 + 违规边），
也有后果（哪些破坏步仍然裸着）。

## D5 权威恒取观察行，边上的 platformId 只用于对账

设计纪律二（`design-replay-rebuild.md:81-85`）：`platformId` 取 `picked.observation.platformId`，
不取 `edge.platformId`。边上那个字段的唯一用途是被比对（I5），比对通过后**不使用**。

`profileFingerprint` 取锁顶层的 `identityProfileDigest`——它已在
`bin/replay.mjs` 的指纹门与现算值逐字节比对过；逐条再存一份只会制造「两处不一致时听谁的」。

## D6 哨兵语义：正控证「非死闸」

红验收 R5 要求合法 ref 抵达 `chromium.launch` 前哨兵（`exit 66` + 哨兵在场）。
没有这条，「恒拒」也能让 R1–R4 全绿，守卫退化成永远不放行的死闸，而死闸与真守卫在退出码上
无法区分。故 R5 是本轮不可省的正控。

哨兵在场只证「浏览器前的授权链闭合了」，**不**证破坏链已闭：ref 填进表之后，出站拦截
（`lib/replay/event-runner.mjs` 的 `page.route` 真拦住出站请求、平台 ID 真被核对、
`route.abort` 真在请求发出前生效）hermetic 证不出，需真浏览器，仍挂 `route:human`。

## D7 旧件零行为差

- v1 锁：无身份通道，结构上不可核实目标连续性，破坏原子恒拒，逐字不变。
- v2 锁：现役件继续按现行语义走，破坏原子恒拒，与今天逐字一致（红验收 R1 钉住，今日已绿、落地后须仍绿）。
- v3 锁：新增，只有它能让破坏步拿到 ref。

`validateFrozenEntityLockArtifact` 的 v1/v2 分支逐字不动，v3 走并列新分支。

## D8 冻结金牌一字不改

`tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs` 是本轮规格。
它需要任何修改才能转绿即停机、不提交、带证据回报。
落地转绿后由本实现契约 `loop/prd-p9-replay-ref-rebuild.json` 登记 checksum 冻结
（金牌第 27-28 行的原话：「写入侧落地、五类全绿之后，再由实现契约登记冻结」）。

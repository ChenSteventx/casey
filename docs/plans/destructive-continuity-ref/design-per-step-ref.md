# 设计一：逐破坏步目标连续性 ref 产物

状态：设计稿，**未实现**。本文件只定形状与不变量，不含实现。
配套红验收：`tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs`（今日 `exit 1`）。

## 要解决的是什么

现状是「观察」与「破坏」之间缺一条**显式的授权边**。

冻结锁里有身份观察行（哪一步看到了哪个实体、它的 `platformId` 是多少），events 里有破坏步
（哪一步要删）。但没有任何签署过的东西说「`atstep_3` 看到的那个实体，授权 `atstep_4` 去删」。
`bin/replay.mjs:203` 那张空表要的正是这条边。

所以本设计的核心不是「多存几个字段」，而是**把授权边显式签进冻结面**。

## 产物形状

### 落在哪

落在既有的 `entity-locks.frozen.json` 里，作为新版本位 `schemaVersion: 3` 的一个新段
`destructiveContinuity`。

**不另立新文件**，理由三条：

1. 授权边必须与 `eventsSha256`、`identityObservations` 处在**同一个签名覆盖面**内。
   拆成两份件就多一条「两件版本不配对」的攻击面，还要新造一套配对校验。
2. `calculateIdentityAdmissionSignature`（`lib/entity-semantic-lock-preflight.mjs:313-321`）
   已经对除 `signature` 外的全部键取哈希，新段天然被签，签名算法零改动。
3. `bin/replay.mjs` 已经在读这个锁并做权威校验（`readIdentityAdmissionAuthorityFromPrd`），
   重建时零新增 IO。

### 由谁产

由 `bin/compile.mjs --execute` 在真机编译期产出，随 `entity-bindings.draft.json` 一起交给 `bin/sign.mjs` 冻结。
`lib/compile-atoms-flow.mjs:109-119` 已经在攒 `run.identityObservations`（含 `kind`），
编译期同一循环里已知每个破坏步的 `stepId`/`intentId`/`atom`/位序——授权边所需的全部信息**编译期已在手**，
不需要新的采集动作，也不需要人到机器前另做什么。

这一点很重要：**它推翻了「等人到机器前收集身份」的旧判断**。人要做的是签，不是采。

### 形状

`identityObservations` 行补一个字段（见复核第 ⑥ 层，`kind` 目前在冻结时被丢掉）：

```
{ kind, name, code, platformId, sourceIntentId, candidateId, role, atom, evidenceStepId }
```

新段 `destructiveContinuity`，每个破坏步恰一条：

```
{
  destructiveStepId,          // 被授权的破坏步 stepId（表的键）
  destructiveIntentId,        // 该步所属意图，与 events 交叉核对
  destructiveAtom,            // 如 agent.delete，必须满足 requiresTargetContinuityRef
  boundKind,                  // 'agent' | 'workflow'，必须等于 destructiveTargetKind(destructiveAtom)
  observationEvidenceStepId,  // 外键：指向 identityObservations[].evidenceStepId
  platformId,                 // 目标平台 ID，必须等于被引观察行的 platformId
  scope,                      // 授权作用域，如 case:<caseId>/intent:<intentId>
  requestCorrelationId,       // 请求关联 ID，供出站取证对账
  stepOrder                   // 破坏步在 events 里的 0 基位序，整数 >= 0
}
```

`profileFingerprint` **故意不逐条存**。它取锁顶层的 `identityProfileDigest`——那个值
`bin/replay.mjs:179-186` 已经拿去与现算的 `liveDigest` 逐字节比对过。逐条再存一份，
只会制造「两处指纹不一致时听谁的」这种没有正确答案的分歧。一个事实源。

## 不变量（缺一条即 fail-open，红验收逐条钉）

铸 ref 之前，下列每条都必须成立，任一不成立即**不铸**（不铸 → 表里没有该步 → 准入门恒拒）：

| # | 不变量 | 不成立的后果 | 红验收 |
|---|---|---|---|
| I1 | `destructiveStepId` 在 events 里存在，且其 `atom` 逐字等于 `destructiveAtom` | 锁能授权一个与实际不同的原子 | R4 |
| I2 | `requiresTargetContinuityRef(destructiveAtom)` 为真 | 给非破坏步发授权，per-step 粒度失效 | R4 |
| I3 | `boundKind === destructiveTargetKind(destructiveAtom)` | 跨 kind 绕过（codex round-5 Critical 复发） | R3 |
| I4 | 被引观察行存在，且其 `kind === boundKind` | 同上 | R3 |
| I5 | 条目 `platformId` 逐字等于被引观察行的 `platformId` | 伪造 ID 指向别的实体，真删错对象 | R2 |
| I6 | `stepOrder` 等于该步在 events 里的真实下标 | 位序造假，出站对账锚失准 | — |
| I7 | `destructiveIntentId` 等于该步在 events 里的 `intentId` | 授权跨意图漂移 | — |
| I8 | 每个 `destructiveStepId` 在段内**唯一** | 一步两条授权，取谁未定义 | — |
| I9 | events 里每个破坏步都能在段内找到条目 | 漏授权的步应当被拒（这是既有行为，须保持） | R1 |

I5 是本设计的立身之本：**条目自报的 `platformId` 永远不是权威**，观察行才是。
条目里存它只为让「不一致」可被当场发现并具名拒绝，而不是为了拿来用。

## 与已冻结面的关系

- v1 锁：不带身份通道，结构上不可核实目标连续性，**行为不变，破坏原子恒拒**
  （`bin/replay.mjs:205` 的 `frozenLockAuthority` 判据覆盖 v1，见其 `199-200` 行注释）。
- v2 锁：现役件继续按现行语义走，**破坏原子恒拒**，与今天逐字一致。
- v3 锁：新增，只有它能让破坏步拿到 ref。

即：**旧件零行为差**，这是让 `entity-destructive-continuity-guard.failclosed-replay.golden.mjs`
D1 断言仍可能保住的关键——D1 用的是 v2 锁，v3 落地后它应当**继续绿**。
红验收 R1 就是把这条钉住（今日已绿，落地后必须仍绿）。

需要重签的只有 D2 那条正控的延伸：今天「有破坏原子 → 恒 65」，落地后要变成
「有破坏原子且 ref 合法 → 放行」。这是新增语义，不是翻旧断言，但仍属 ADR-0004 面
（改的是守卫可观察行为），**须 Steven 补签**。

## 红验收怎么读

`tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs`，五个场景一律
spawn 真 `bin/replay.mjs`，`--sut` 恒 `http://127.0.0.1:1`（死回环端口），
`CASEY_LAUNCH_SENTINEL` 证「有没有越过浏览器前门」。**不测纯函数**——抽纯函数只测纯函数
是本仓已被逮过的假绿模式。

今日实测（`exit 1`）：

| 场景 | 期望 | 今日实测 | 今日判 |
|---|---|---|---|
| R1 ref 缺失 | `exit 65` + `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` + 哨兵缺席 | 一致 | 绿 |
| R2 ref 错配·`platformId` | `exit 65` + `DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH` | `exit 65` 但 `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID` | 红 |
| R3 ref 错配·跨 kind | `exit 65` + `DESTRUCTIVE_CONTINUITY_KIND_MISMATCH` | 同上 | 红 |
| R4 ref 挂错步 | `exit 65` + 拒因点名 `atstep_4` | 同上，未点名 | 红 |
| R5 ref 合法 | `exit 66` + 哨兵在场 | `exit 65` + 哨兵缺席 | 红 |

R2/R3/R4/R5 今日全部红在同一个因上：v3 段被 `closedRecord` 判为非法键 → 整个锁非法。
这正是复核第 ② 层要说的事——格式扩容绕不过去。

R5 不可省。没有它，「恒拒」也能让 R1-R4 全绿，守卫就退化成永远不放行的死闸，
而死闸和真守卫在退出码上无法区分。

**本金牌不得登记进任何 prd 的 `testChecksums`**：它按设计今日判红，登记会把 `gate` 拖红。
五类全绿之后再由实现契约登记冻结。

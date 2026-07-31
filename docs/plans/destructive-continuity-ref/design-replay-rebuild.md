# 设计二：回放侧逐破坏步 ref 重建接线

状态：设计稿，**未实现**。本轮不落任何 `bin/replay.mjs` 改动。

## 谁在什么时机写

唯一写入点：`bin/replay.mjs`，**在 `203` 行建表之后、`205` 行准入门之前**，浏览器启动之前。

时机不能提前也不能推后：

- 不能早于 `179-186` 的 `identityProfileDigest` 比对。指纹没核完就铸 ref，等于承认一份
  与现行通道剖面不配对的锁——换旧剖面降级新签用例的洞会重开。
- 不能晚于 `205` 的准入门。准入门是浏览器前最后一道，晚一步就等于「先启浏览器再说」。
- 必须在 `chromium.launch` 之前（`bin/replay.mjs:369` 的哨兵短路点之前），
  这样红验收才能用哨兵在场性证明「破坏动作有没有可能真发生」。

## 写什么

伪代码（**非实现**，只表达顺序与拒绝点）：

```
// 位置：bin/replay.mjs，紧接 const destructiveContinuityByStep = new Map();
if (frozenLockAuthority && lockSchemaVersion === 3) {
  const observations = readFrozenIdentityObservations(frozenLockAuthority);   // 已带 kind（v3）
  const edges       = readFrozenDestructiveContinuity(frozenLockAuthority);   // 新读取器
  const stepIndex   = new Map(events.map((ev, i) => [ev.stepId, { ev, i }]));

  for (const edge of edges) {
    const hit = stepIndex.get(edge.destructiveStepId);
    // I1/I2/I7：授权边必须对上 events 里真实存在的那一个破坏步
    if (!hit) refuse('DESTRUCTIVE_CONTINUITY_STEP_NOT_IN_EVENTS', edge);
    if (hit.ev.atom !== edge.destructiveAtom) refuse('DESTRUCTIVE_CONTINUITY_ATOM_MISMATCH', edge);
    if (hit.ev.intentId !== edge.destructiveIntentId) refuse('DESTRUCTIVE_CONTINUITY_INTENT_MISMATCH', edge);
    if (!requiresTargetContinuityRef(edge.destructiveAtom)) refuse('DESTRUCTIVE_CONTINUITY_ATOM_NOT_TARGETING', edge);
    // I6：位序不得造假
    if (hit.i !== edge.stepOrder) refuse('DESTRUCTIVE_CONTINUITY_STEP_ORDER_MISMATCH', edge);
    // I3：跨 kind 硬闸（codex round-5 Critical 在重建路径上的同款封口）
    if (edge.boundKind !== destructiveTargetKind(edge.destructiveAtom)) refuse('DESTRUCTIVE_CONTINUITY_KIND_MISMATCH', edge);
    // I4：按名 + kind 唯一命中，绝不取 first
    const picked = selectObservationForDestructiveTarget({
      observations, targetName: hit.ev.text, boundKind: edge.boundKind,
    });
    if (!picked.ok) refuse(picked.reason, edge);
    // 外键须真指向被选中那一条，不许「选了 A、引了 B」
    if (picked.observation.evidenceStepId !== edge.observationEvidenceStepId) {
      refuse('DESTRUCTIVE_CONTINUITY_OBSERVATION_REF_MISMATCH', edge);
    }
    // I5：条目自报 platformId 只用于对账，权威恒取观察行
    if (picked.observation.platformId !== edge.platformId) {
      refuse('DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH', edge);
    }
    // 复用既有铸造适配器（lib/entity-destructive-continuity-wiring.mjs:97-120），不另造
    const minted = mintDestructiveTargetContinuity(picked.observation, {
      profileFingerprint: frozenLock.identityProfileDigest,  // 顶层唯一事实源，非逐条
      scope: edge.scope,
      requestCorrelationId: edge.requestCorrelationId,
      stepOrder: edge.stepOrder,
    });
    if (!minted.ok) refuse(minted.reason, edge);
    // I8：一步一条，重复即拒（后写覆盖前写是静默取谁未定义）
    if (destructiveContinuityByStep.has(edge.destructiveStepId)) {
      refuse('DESTRUCTIVE_CONTINUITY_DUPLICATE_STEP', edge);
    }
    destructiveContinuityByStep.set(edge.destructiveStepId, minted.ref);
  }
}
// 既有准入门原样保留，一字不改：漏授权的破坏步在这里被拒
```

`refuse` 的含义固定：打印具名 `reason` + 破坏步 `stepId` + `atom`，`process.exit(65)`，
**不启动浏览器**。

## 三条设计纪律

**一、`refuse` 是硬退出，不是跳过。**
容易写错成「这条边不合法就不铸，让下游准入门去拒」。方向上也能拒（fail-closed），
但拒因会退化成 `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`——
「锁里压根没写」和「锁里写了但是伪造的」变得不可区分。第二种是攻击信号，必须当场具名。
红验收 R2/R3 钉的就是这个可区分性。

**二、权威永远是观察行，不是授权边。**
`platformId` 取 `picked.observation.platformId`，不取 `edge.platformId`。
边上那个字段的唯一用途是被比对（I5），比对通过后也**不使用**。
按名再生成预期值是本模块反复申明的禁忌
（`lib/entity-destructive-continuity-wiring.mjs:100-102` 的原话：`platformId` 恒取自观察）。

**三、准入门一字不改。**
新增的是「表怎么被填满」，不是「表怎么被检查」。
`admitDestructiveTargetContinuity` 及其 per-step 语义（codex round-2 High 的收口）原样保留。
改它就要动 round-2 冻结金牌，那是另一场重签。

## 需要新增的读取器

`lib/entity-semantic-lock-preflight.mjs` 侧要加两样（**本轮不写**）：

1. `validateFrozenArtifact` 认 `schemaVersion === 3`，v3 的 allow-list =
   v2 的 + `destructiveContinuity`，且观察行 allow-list 补 `kind`（值域 `agent`/`workflow`）。
   注意 `closedRecord` 的 `required` 默认等于 `allowed`，**v3 的观察行 `kind` 是必填**——
   这正好防住「v3 锁里混进不带 `kind` 的旧行」。
2. `readFrozenDestructiveContinuity(authority)`，与既有 `readFrozenIdentityObservations` 同族。

v1/v2 分支**逐字不动**。这是「旧件零行为差」的兑现处，也是 D1 断言能保住的原因。

## 落地后仍未闭的半边（诚实挂账）

表填满、准入门放行之后，破坏动作才走到 `lib/replay/event-runner.mjs:191-210` 的出站拦截。
那一段的正确性——`page.route` 真拦住了出站请求、`platformId` 真被核对、
`route.abort` 真在请求发出前生效——**hermetic 证不出**，需要真浏览器。
codex 的裁定原话是「ref 消费半边本质需真机 `page.route` 出站拦截 + live 读回，route:human 未闭」
（`docs/plans/entity-destructive-continuity-guard/review/codex-verdict.md:17-25`）。

所以本设计落地后的正确说法是：**浏览器前的授权链闭合了**，出站消费链仍待真机确认。
不得宣称「破坏链已闭」。

另有一条落地时会当场绊倒人的（复核第 ⑦ 层）：`profile.mutationUrlPattern` 是
`lib/replay/event-runner.mjs:199` 的必需输入且 `requirePattern: true`，
但 `bin/compile.mjs` 的剖面形状门从不校验它。ref 全对之后，剖面少这个字段会让破坏步
整步判 `action_failed`（`lib/replay/event-runner.mjs:232-236`，方向安全但会白跑一趟真机）。
把它一并补进剖面形状门，或至少列进真机前的检查单。

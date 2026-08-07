所有证据均已核实。以下是最终裁定：

---

# 评审报告 · wf-open-observation-yield R1（异构只读评审）

**审方**：实现家族=Claude（异构，不采信实现者结论）  
**候选快照**：`4d05447`（HEAD clean）  
**基线**：`b6880e3`  
**评审范围**：白名单内唯一实现变更 `lib/compile-atoms-workflow-nav.mjs` + 金牌 + PRD + 计划文档

---

## 风险清单逐条结论

### 1. 让位判据正确性

**结论：通过。** 判据 `run.identityObservations.some((o) => o && o.platformId === gate.matched.platformId)` 使用严格相等（`===`）精确匹配 `platformId`，非同名字段、非「有观察就让」。

**来源可信度验证**：
- `gate.matched.platformId` ← `resolveDualIdentity` 返回 `matched: { platformId: row.id }`（`agent-identity-gate.mjs:54`）——`row` 是 `sameName.length === 1` 的唯一行，来源可靠。
- create 侧观察的 `platformId` ← `readCreatedWorkflowIdentity` → `matches[0].id`（`compile-atoms-workflow-crud.mjs:32`）——同一字段、同一 API 源。
- `fetchCreatedWorkflowListScan` 在 `record.id` 为空时早返（`entity-created-workflow-continuity-v3.mjs:487`）：`!nonEmpty(record.id)` → 不产出记录。故 `platformId` 恒为非空字符串，不存在 `undefined === undefined` 假阳匹配。
- 无 `platformId` 字段的旧观察行 `o.platformId === <string>` → `undefined === "9001"` → `false`，不会误让位。

### 2. 独跑零回归

**结论：通过。** 实证：`wf-open-readback-requery.zero-sut.golden.mjs` **20/20 全过**，其 S1e 场景为 open 独跑流（零 create 预置），断言 open source 观察归档全档保持不变。

逻辑验证：flow 无 create 时 `run.identityObservations` 为空 → `Array.isArray(run.identityObservations) && run.identityObservations.some(...)` → `priorSameId = false` → 走 `else` 分支照旧设置 `pendingIdentityObservation`。successor amendment 的 open [source] 语义保留。

### 3. 双证不缩水

**结论：通过。** 让位检查位于双证链的**最后一步**——在以下所有步骤完成之后才执行：

1. `resolveWorkflowOpenSourceIdentity`（扫描 + 物理卡片双锚 + `resolveDualIdentity` 判定表）  
2. `run.emit(...)` 句柄内 TOCTOU 重验 + 点击  
3. `waitForURL('**/process/detail**')` 详情页导航确认  

让位只影响是否设置 `run.pendingIdentityObservation`，不触及扫描/卡锚/判定表/过门才点/TOCTOU 任何一环。金牌 S4（双证不缩水钉）零行场景仍硬阻断不点，实证确认。

### 4. 下游效果论证

**结论：通过。** 实码核证（非注释）：

- **连续性 ref 铸造**：`armDestructiveTargetContinuity`（`compile-atoms-agent.mjs:227`）→ `selectObservationForDestructiveTarget`（`entity-destructive-continuity.mjs:340-350`）按 `targetName` + `boundKind` + `platformId` 过滤 → 让位后仅有一条 create subject 观察 → `matches.length === 1` → `ok` → 铸造单一 ref。
- **issuer 单原子通道**：`deriveObservationIssuerAtom`（`entity-observation-registry.mjs:401-415`）取 `new Set(observations.map(o => o.atom))` → 让位后 `atoms = {"workflow.create"}` → `atoms.size === 1` → 返回 `{ok: true, atom: "workflow.create", sourceKind: "compile-envelope"}` → H1b/H1h 已钉通道。
- wiring 金牌 H1h 直接证实此通路：`workflow.create` 观察 → issuer `{atom: "workflow.create"}` → ok（`entity-workflow-source-readback.wiring.zero-sut.golden.mjs` H1h 绿）。

### 5. 边界：异 platformId 两行并存

**结论：通过。** 金牌 S3 钉实：预置 `platformId=8888` 的 create subject + open `platformId=9001` 的 workflow → `8888 !== 9001` → `priorSameId = false` → 不让位 → 两行并存。

该形态后续撞 H1i（`OBSERVATION_ISSUER_MULTIPLE_ATOMS`）：`atoms = {"workflow.create", "workflow.open"}` → `atoms.size !== 1` → fail-closed → route:human。这是 wiring 金牌 H1i 既有的预期行为（"多身份原子同流 issuer fail-closed"），非本契约引入的债，且无静默放行路径。

### 6. 金牌质量与红证

**结论：通过。**

- **金牌强度**：S1-S4 四钉覆盖让位正控/独跑零回归/判据精确/双证不缩水，共 12 断言，逐条断言 `run.identityObservations` 具体形状（atom、platformId、role、evidenceStepId、sourcePath），非笼统计数。
- **红证基线可复现**：基线 `b6880e3` 的 `compileWorkflowOpen` 无条件设置 `pendingIdentityObservation`（`git show b6880e3:lib/compile-atoms-workflow-nav.mjs` L187），在新金牌 S1 场景下必然产生两行 + 让位 notes 缺席 → S1e/S1g 双红，与 `red-proofs/wf-open-observation-yield.red.txt` 记载的 **10 过 / 2 红** 一致。
- **PRD sha256 自算核对**：
  - `tests/_golden/wf-open-observation-yield.zero-sut.golden.mjs`：`df2d8ea1...eaa5` ✓
  - `docs/plans/wf-open-observation-yield/plan.md`：`290f4a76...8991` ✓
  - `docs/plans/wf-open-observation-yield/accept/red-proofs/wf-open-observation-yield.red.txt`：`4554b2bb...a226b` ✓

### 7. 邻接

**结论：通过。** 全仓 297 金牌自跑核：

| 金牌文件 | 结果 | 备注 |
|---|---|---|
| `wf-open-observation-yield` | **12/12** | 本契约 |
| `wf-open-readback-requery` | **20/20** | open 独跑场景零回归 |
| `wf-delete-search-filter` | **9/9** | 删搜修零回归 |
| `entity-workflow-source-readback.wiring` | **18/18** | H1i 面保持 |
| `entity-workflow-source-readback.cardinality-reverse` | **18/18** | 反向基数零回归 |
| `p9-created-workflow-continuity-v3.created-in-run` | **8/8** | v3 continuity 零回归 |
| `term-lint --registry` | **通过** | 统一语言双向有效 |
| `selftest --tier1` | **全链路 GREEN** | 确定性内核 + 熔断器 + gate + verdict 纯函数 |

既存红（门面拆分族两例、wf-open-smoke 一例）基线同码，非本契约引入，不构成阻栏。

---

## Findings

**零 C/H/M finding。** 变更范围极小（+12/-1 行）、判据精确、双证链不受影响、冻结面零接触、下游收益逻辑严密、金牌 12/12 全过、邻接 297 金牌零回归、PRD 三 sha256 自算全对。

唯一代码级注意（非缺陷，属可维护性观察）：let 判据 `priorSameId` 使用 `Array.isArray(run.identityObservations) && run.identityObservations.some(...)` 的双重守卫 `o && o.platformId === gate.matched.platformId`——内层 `o &&` 是防御性无害的，`compileFlow` 在 L143 归档的观察行恒为良构 object，不会推入 falsy 值，但此守卫使代码对异常状态更鲁棒（fail-safe 姿态而非 fail-open）。无需改动。

---

**VERDICT: APPROVE**
PI_EXIT_0

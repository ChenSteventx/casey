All evidence checks pass. Now let me perform the deep code review.

---

## 异构评审 · admission-envelope-yield

**评审对象**：`git diff 5cd36b4..HEAD`（7 文件，+318/−2）

**核心改动**：`lib/entity-observation-registry.mjs` · `validateObservationAdmission` —— +24 行 / −2 行，三处注射点。

---

### R1 豁免滥用面逐条证伪

**终端投影**（`:171-175`）：
```js
yieldedToPlatformId: isNonEmptyString(ev.yieldedToPlatformId) ? ev.yieldedToPlatformId : null,
```
- 无字段输入 → `null` → `terminalIsYielded` 第二条 `isNonEmptyString(t.yieldedToPlatformId)` 返回 `false` → 零豁免。**加法门控成立。**

**`terminalIsYielded` 谓词**（`:264-270`）：
```js
const terminalIsYielded = (t) => {
  const entry = registry.get(t.atom);
  return entry && entry.requiredRoles.length === 1 && entry.requiredRoles[0] === 'source'     // ①义务面
    && isNonEmptyString(t.yieldedToPlatformId)                                                 // ②字段非空
    && !seenEnvelopeAtom.has(t.atom)                                                          // ④信封整缺
    && allRows.filter((r) => r && typeof r === 'object'
      && r.kind === entry.boundKind && r.role === 'subject' && r.platformId === t.yieldedToPlatformId).length === 1;  // ③恰一匹配
};
```

四条与条件逐一证伪泄漏路径：

| 风险 | 攻击形 | 拦点 | 结论 |
|------|--------|------|------|
| A3 伪造字段 | `yieldedToPlatformId: 'P8'`（无匹配行） | `filter(...).length === 0` ≠ 1 → false | **封死** |
| A4 subject 义务 | `workflow.create` 携字段（requiredRoles=`['subject']`） | 条件①：`requiredRoles[0]` 是 `'subject'` ≠ `'source'` → false | **封死** |
| A5 多条匹配 | 两 create subject 行同 platformId `P9` | `filter(...).length === 2` ≠ 1 → false | **封死** |
| A6 空信封畸形态 | open 信封在场（`openEnv([])`） | 条件④：`seenEnvelopeAtom.has(t.atom)` 为 true → false → 落 `rolesMatchMultiset([], ['source'])` → `ROLE_COUNT_MISMATCH` | **封死** |

**第五条泄漏路径穷举**：

- **跨 kind 匹配**：若匹配行的 `kind` 非 `entry.boundKind`（如 agent 行），`r.kind === entry.boundKind` 不成立 → filter 空。**封死。**
- **匹配行 role 非 subject**：`r.role === 'subject'` 不成立 → filter 空。**封死。**
- **空 `allRows`**（零信封）：filter 返回空 → length 0 ≠ 1 → false。但零信封意味着 `seenEnvelopeAtom` 为空，`!seenEnvelopeAtom.has(t.atom)` 为 true，前三条也 true。此时 `terminalIsYielded` 返回 false（因 filter length 0）。然后在 4b 中：`terminals.filter(...).every(terminalIsYielded)` → every 返回 false → `return reject('OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION')`。**封死，全空输入照拒。**
- **多义务角色原子**：`requiredRoles.length === 1` 不成立 → false。**封死。**
- **空字符串字段**：`isNonEmptyString(' ')` → `trim()` 后为空 → false。**封死。**
- **4b 的 `every()` 空数组语义**：若 obligationAtoms 的某 atom 在 terminals 中无匹配（`terminals.filter(...)` 返回 `[]`），`[].every(...)` → true → `continue`。**此路径不可达**：`obligationAtoms` 由 `new Set(terminals.map(t => t.atom))` 构造，故 obligationAtoms 中每个 atom 在 terminals 中至少有一项。**安全。**

**与 compile 侧基数门判据一致性**：compile 侧（`checkIdentityObservationCardinality`，`:370+`）的让位豁免判据与 sign 侧同构——同样要求义务恰 `['source']` / 字段非空 / 恰一匹配 subject 行。sign 侧额外紧一条：要求信封整缺（compile 侧无信封概念）。**一致，sign 侧是 compile 侧的超集约束。**

---

### R2 加法门控逐字节等价

变更仅三处注射点：

1. **`:171-175` terminals push**：加 `yieldedToPlatformId` 字段。无字段输入 → `null`，余下行为不变。
2. **`:264-278` 4b 豁免**：新增 `if (!seenEnvelopeAtom.has(atom)) { if (every-yielded) continue; else reject; }`。原行为是 `if (!seenEnvelopeAtom.has(atom)) return reject(...)`。新分支仅在 `every-yielded`=true 时豁免；不满足时走原 reject 路径。
3. **`:330` 6 豁免**：新增 `if (assignedRoles.length === 0 && terminalIsYielded(terminal)) continue;`。原行为是无条件 `rolesMatchMultiset`。新分支仅在零行+让位时豁免；不满足时走原路径。

**无字段输入时**：`terminalIsYielded` 恒返回 `false`（因 `isNonEmptyString(null)` → false），故 4b 豁免永不触发、6 豁免永不触发。代码路径与原实现逐指令等价。**加法门控成立。**

---

### R3 前置各闸零接触验证

变更在函数体内的时间线：

```
0) 整体输入结构      ← 未改
0b) 注册表不变量     ← 未改
0c) binding 身份字段  ← 未改
1) 终端推导          ← 仅 push 加字段，判定逻辑未改
2) 信封结构 + issuer ← 未改
3) 规范信封形式      ← 未改
4) 逐行校验          ← 未改
4b) 反向覆盖         ← 【变更点：加豁免分支】
5) 行→终端锚定       ← 未改
5b) bindingMode 换轨  ← 未改
6) 角色计数          ← 【变更点：加豁免 continue】
```

变更仅在 4b 和 6 两处后验环节。孤儿信封（`:217` 的 `OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION`）、邪恶 issuer（`:203` 的 `OBSERVATION_ISSUER_NOT_ALLOWED`）、五元关联（`:237` 的 `OBSERVATION_CORRELATION_MISMATCH`）、bindingMode（`:243` / `:314`）、provenance（`:247-249`）、重复终端（`:167`）等具名拒面**原样不变**。

---

### R4 A8 真产物字节形代表性

A8 输入形：
- `workflow.create` click ×1（`c1`） + `workflow.open` click ×1（`o1`，携 `yieldedToPlatformId: 'P9'`） + `workflow.deleteByName` click ×1（`d1`，未登记原子）
- 4 条 binding：两 `workflow.create`（c0/c1，不同 stepId） + 一 `workflow.open` + 一 `workflow.deleteByName`
- 一 create 信封（单 subject 行 `platformId: 'P9'`）

关键桥接路径：`anchoringBindings`（`:280-286`）要求 `b.stepId === t.stepId`，故 binding c0（stepId=`c0`）不匹配终端 c1（stepId=`c1`），仅 c1 匹配 → `bs.length === 1` → 不触发 `OBSERVATION_BINDING_JOIN_AMBIGUOUS`。**安全。**

`workflow.deleteByName` 不在 `ENTITY_OBSERVATION_REGISTRY`，其 click 在终端推导阶段被 `registry.has(ev.atom)` 跳过（`:163`），不产义务终端。其 binding 在五元关联中不被任何行引用。**无干扰。**

多 create binding（同 intent `ic`、同 sourceIntentId `s_create`、不同 stepId）是十五跑真实形状的缩微——真实产物因 compile 阶段 binding 草稿生成逻辑可出现同 intent 多 binding。A8 正确回归了该形态。**代表性充足。**

---

### 额外发现：无 Critical / High / Medium

逐一穷举后未发现可触发误 PASS 或误 REJECT 的代码缺陷。变更紧贴已签设计（GRILL 豁免判据四条件逐字兑现），additive-only，前置闸零接触，八钉金牌全绿，邻接五金牌零回归。

---

**VERDICT: APPROVE**

无 Critical / High / Medium 发现。
pi EXIT=0

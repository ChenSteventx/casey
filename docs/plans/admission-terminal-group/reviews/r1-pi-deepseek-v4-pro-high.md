All probes pass. Here is the final review.

---

## 异构评审报告 · admission-terminal-group

**基线**: `3f34512` | **评审对象**: `git diff 3f34512..HEAD` | **改动文件**: 7 files, +292/-3

---

### 改动范围核实

实际 diff 完全落在白名单内（`lib/entity-observation-registry.mjs` 段 1 11 行改动；`tests/_golden/`、`loop/prd-*.json`、`docs/plans/` 均为新增），无越界改动。

---

### 风险逐项证伪

#### R1 —— 语义收紧完备性：✅ 无发现

脚手架 click 不再进 `terminals` 集后，拒绝路径完全可靠。关键机制在段 5 的 `anchoringBindings(row, t)`：

```js
row.evidenceStepId === t.stepId && row.atom === t.atom
```

脚手架 click 的 `stepId` 不在任何 terminal 的 `stepId` 里（`terminalByGroup` 只保留每组末 click）。行锚脚手架时 `anchored` 为空 → `OBSERVATION_ROW_NOT_ANCHORED` 具名拒。已穷举尝试构造反例：
- 行 `evidenceStepId` = 脚手架 stepId + 绑定 `stepId` = 脚手架 stepId → `anchoringBindings` 立即因 `row.evidenceStepId !== t.stepId` 短路（无任何 terminal 有该 stepId）
- 行 `evidenceStepId` = 终端 stepId + 绑定 `stepId` = 脚手架 stepId → `bs` 为 `[]`（`b.stepId !== t.stepId`），`anchored` 空 → 拒

无误过通路。T2 金牌（`OBSERVATION_ROW_NOT_ANCHORED`）实证。

#### R2 —— 基数门判据同构性：✅ 无发现

两函数终端判定算法逐字节同构：

| 维度 | `validateObservationAdmission` | `checkIdentityObservationCardinality` |
|------|-------------------------------|--------------------------------------|
| 分组键 | `JSON.stringify([intentId, atom])` | `JSON.stringify([intentId, atom])` |
| 遍历序 | events 输入顺序 | clicksInOrder（events 顺序） |
| 胜出语义 | `Map.set()` 最后写入 | `Map.set()` 最后写入 |
| 值 | `{intentId, stepId, atom, yieldedToPlatformId}` | `stepId`（纯子集） |

独立构造的反例探针确认：同输入下两函数提取的终端 stepId 集合逐字一致（`['c','d','e','f']`），含逗号/句点等 JSON 分隔符注入场景键不冲突。

唯一微小差异：`checkIdentityObservationCardinality` 有 `OBSERVATION_CLICK_STEPID_DUPLICATE` 检查而准入验证器无。但此差异需要 stepId 全局非唯一——这在生产编译输出中不可能出现（编译侧 stepId 唯一赋值），且在异组同 stepId 场景下准入验证器的 `anchoringBindings` 六字段全量 join（含 `intentId`）正确区分两终端。**不算发现**——差异只在防御深度层，不造成可触发分歧。

#### R3 —— 遗留等价：✅ 无发现

- 单 click 原子（agent.searchOpen、workflow.open）：组内唯一点击 = 终端，`[...terminalByGroup.values()]` 产 `[{...click...}]`——与旧 `terminals.push(...)` 产 `[{...click...}]` 逐字节同码
- `terminalIsYielded` 让位谓词：**零改动**——读 `t.yieldedToPlatformId`，终端对象 shape 不变
- 五邻接金牌全绿实证零回归（admission-envelope-yield 8/8、terminal-coverage-yield 14/14、cardinality-reverse 18/18、wiring 18/18、observation-yield 12/12）

#### R4 —— 重复三元组拒与组内末语义交互：✅ 无发现

| 场景 | 行为 | 结果 |
|------|------|------|
| 同组同 `(intentId,stepId,atom)` 重复 | `seenTerminal.has()` 命中 | `OBSERVATION_DUPLICATE_TERMINAL` ✅ |
| 同组不同 stepId（脚手架 + 确认） | 全过三元组检查，末 click 胜出 | 终端正确定性 ✅ |
| 异组不同 stepId | 独立终端 | 组隔离正确 ✅ |
| 异组同 stepId（生产不可能） | `anchoringBindings` 六字段全量 join 区分意图维 | 可正确路由（防御深度略低但不可触发） |

---

### 证据复跑确认

- 验收八钉：**exit 0**（8/8 全过）
- 邻接五金牌：**全绿**
- term-lint：**0 提示**
- selftest --tier1：**全链路 GREEN**
- gate：**GREEN 2/2**
- 红基线：5 过 / 3 红（红面即契约面，已在 PRD notes 留痕）

---

### 结论

```
VERDICT: APPROVE
```

改动精准（11 行业务逻辑），语义收紧 fail-closed（脚手架行锚拒路径可靠），基数门判据逐字同构（独立反例试破不成立），遗留等价零回归（五邻接金牌全绿），重复三元组拒与组内末语义交互正确。无 Critical / High / Medium 发现。
pi EXIT=0

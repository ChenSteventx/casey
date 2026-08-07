All evidence gathered. Here is the complete review:

---

# 异构代码评审 · terminal-coverage-yield

**基线**: `643d3a9` → **HEAD**: `0642e36`
**评审日期**: 2026-08-07

---

## 改动白名单验证

`git diff --name-only 643d3a9..HEAD` 产 11 文件，逐项对应：

| # | 文件 | 白名单条目 | 状态 |
|---|------|-----------|------|
| 1 | `lib/compile-atoms-workflow-nav.mjs` | #1 让位分支盖 `yieldedToPlatformId` | ✅ |
| 2 | `lib/entity-observation-registry.mjs` | #2 反向基数四条件豁免（加法门控） | ✅ |
| 3 | `tests/_golden/schemas/events.schema.json` | #3 pattern 放宽 + 新可选属性 | ✅ |
| 4 | `tests/_golden/terminal-coverage-yield.zero-sut.golden.mjs` | #4 验收金牌 | ✅ |
| 5-7 | `loop/prd-*.json`（三份） | #4 PRD 挂账 | ✅ |
| 8-11 | `docs/plans/terminal-coverage-yield/**` | #4 计划/裁定文档 | ✅ |

**结果**: 零越界。所有改动严格在批准范围内。

---

## 风险逐条证伪

### R1 — 豁免是否可被滥用绕过读回义务

**证伪结论：不存在第五条泄漏路径。** 四条件全与（AND）结构提供 fail-closed 门槛：

| 条件 | 含义 | 钉死测试 | 结果 |
|------|------|---------|------|
| ① `count === 0` | 豁免只对"缺少"开，"多"不走 | Y6（同终端两行→去重钉拒） | ✅ `OBSERVATION_EVIDENCE_STEP_DUPLICATE` |
| ② `requiredRoles === ['source']` | subject 所有权义务绝不豁免 | Y5（subject 终端携字段→照拒） | ✅ `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION` |
| ③ `isNonEmptyString(yieldedId)` | 字段缺席不开门——加法门控 | Y2（无字段→原码拒） | ✅ 与基线同码 |
| ④ `observations.filter(...).length === 1` | 零条/多条均拒 | Y3（伪造字段无匹配→拒）、Y4（匹配两条→拒） | ✅ 均拒 |

四条全与才豁免。任意一条不满足 → `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION` 原码拒。不存在第五条可绕过路径。

`s/`条目一`/`条件一`/g` 级的语义歧义？不存在——每条条件在 `lib/entity-observation-registry.mjs:398-404` 以 `&&` 链式表达，执行逻辑与声明一致。

---

### R2 — 加法门控是否成立

**证伪结论：成立。无字段输入下行为与基线逐字节同码。**

金证实证：
- **Y2**：`openClick('o1', 'io')` 不携 `yieldedToPlatformId` → `isNonEmptyString(yieldedId)` 得 `false` → 短路不走豁免 → 原 `return rej('OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION')` 执行。此即十四跑原始红态。
- **Y7**：agent 遗留形 `searchOpen` 全夹具零 `yieldedToPlatformId` → 正常路径走通 `ok: true`，与改前完全一致。

邻接回归实证：
- `cardinality-reverse.zero-sut.golden.mjs` — **18/18** ✅
- `wiring.zero-sut.golden.mjs` — **18/18** ✅
- `wf-open-observation-yield.zero-sut.golden.mjs` — **12/12** ✅
- `wf-open-readback-requery.zero-sut.golden.mjs` — **20/20** ✅
- `compile-intent-lineage-rebind.zero-sut.golden.mjs` — **16/16** ✅
- `p9-created-workflow-continuity-v3.created-in-run.zero-sut.golden.mjs` — **8/8** ✅

所有邻接金牌零回归。加法门控实证成立。

---

### R3 — 盖字段位置与让位判据的耦合

**证伪结论：`r.stepId` 恒指向该组终端 workflow.open click，非让位路径零接触。**

代码流分析（`lib/compile-atoms-workflow-nav.mjs`）：
1. **L168**: `const r = await run.emit({ ..., atom: 'workflow.open', action: 'click', ... })` — 终端 click
2. **L180-186**: `r.resolution !== 'unique'` → 阻断返回；通过后才继续
3. **L196**: `const terminalEvent = run.events.find((e) => e && e.stepId === r.stepId)` — `r` 仍是 L168 的返回值，`r.stepId` 恒为此终端 click 的 stepId

`run.emit` 每调用分配唯一 stepId（`atstep_N`），同一 `r` 变量未被遮蔽，`r.stepId` 在 L196 必然命中刚发出的唯一终端 click 事件。

**非让位路径**（`priorSameId === false`）：走 L201 `run.pendingIdentityObservation = { ..., evidenceStepId: r.stepId }` — 零接触 `yieldedToPlatformId`。`r.stepId` 的使用在此路径已存在（让位契约前即如此），本轮改动无新增。

---

### R4 — schema 放宽的爆炸半径

**证伪结论：爆炸半径零——只放宽不收紧，不引入非法形状。**

1. **`intentId` pattern**: `^intent_[0-9]+$` → `^intent_[A-Za-z0-9_]+$`
   - 新 pattern 是旧 pattern 的严格超集：`[0-9]+` ⊂ `[A-Za-z0-9_]+`
   - 所有既有合法产物（`intent_0`, `intent_1`, ...）仍匹配
   - authored 语义号（`intent_create` 等）现在也合法（M1 兑现）
   - `intent_` 前缀保机器可查，不引入全自由字符串
   - Y9a/Y9b 实证通过 ✅

2. **`yieldedToPlatformId`** 新增于 `event` 定义内
   - 不在 `required` 数组 → 可选，旧产物不受影响
   - `type: "string"`, `minLength: 1` → 非空，值与既有 `platformId` 字段同形
   - `additionalProperties: false` 在 event 级已包含此属性（属显式声明），不存在拒绝问题
   - 三份归属 PRD 的 `checksumAmendments` 均已登记 + Steven 人签 ✅
   - Y9c 实证通过 ✅

3. **消费方验证**：
   - `seams-freeze` — 12/12 ✅
   - `seams-freeze-v2` — 13/13 ✅
   - `page-topology-auth-continuity-boundaries` — 7/7 ✅

---

### R5 — 金牌 Y8 的 harness 是否诚实

**证伪结论：诚实。种子行与合成锚定 click 均为流中态真实构造。**

Y8 harness 结构：
1. `seed` = 完整的 `workflow.create` 观察行（`kind/name/code/platformId/sourceIntentId/candidateId/role/atom/evidenceStepId/sourcePath` — 九字段全），push 进 `run.identityObservations`
2. `wfPage` = 内存 mock，不启动浏览器、无网络调用
3. `compileFlow(run, ...)` 驱真实 `compileWorkflowOpen` → 真实让位判据命中 → 真实盖字段路径 → 产出 `run.events`
4. Y8d 合成 `createClick('w_confirm', ...)`（种子行的 `evidenceStepId`）+ `run.events`（含盖字段的 open click）+ `run.identityObservations` → 喂真实 `checkIdentityObservationCardinality` → `ok: true`

**诚实性分析**：
- 种子 `platformId: '9001'` 与 `wfPage` 扫描行 `{ id: '9001', code: 'WF-OK', name: 'wfok' }` 一致 → 让位判据 `gate.matched.platformId === '9001'` 成立
- 盖字段值 = `'9001'`，种子 subject 行 `platformId` 同为 `'9001'` → 豁免条件④的 `o.platformId === yieldedId` 匹配恰一
- 无假绿：若种子 platformId 与 gate.matched.platformId 不一致（Y3 已证），匹配行零条 → 拒

**结论**：harness 诚实，以最小外推（合成一个本应由 `compileWorkflowCreate` 产出的确认 click 事件）完成端到端闭环，不引入假绿面。

---

## 突变闭环验证

三件实现文件回退到基线 `643d3a9` → 运行金牌 → **8 过 / 6 红**（Y1/Y8b/Y8d/Y9a/Y9b/Y9c），与 `accept/red-proofs/terminal-coverage-yield.red.txt` 逐行一致。恢复 → **14/14 全绿**。

---

## 全仓扫描与门禁

| 测试 | 结果 |
|------|------|
| `terminal-coverage-yield.zero-sut` | 14/14 ✅ |
| `cardinality-reverse.zero-sut` | 18/18 ✅ |
| `wiring.zero-sut` | 18/18 ✅ |
| `wf-open-observation-yield.zero-sut` | 12/12 ✅ |
| `wf-open-readback-requery.zero-sut` | 20/20 ✅ |
| `compile-intent-lineage-rebind.zero-sut` | 16/16 ✅ |
| `p9-created-workflow-continuity-v3.created-in-run.zero-sut` | 8/8 ✅ |
| `seams-freeze` | 12/12 ✅ |
| `seams-freeze-v2` | 13/13 ✅ |
| `page-topology-auth-continuity-boundaries` | 7/7 ✅ |
| `page-topology-auth-continuity-adjacent-regression` | 4/4 ✅ |
| `output-seal-b5-prelaunch` | 1/1 ✅ |
| `term-lint --registry` | ✅ |
| `selftest --tier1` | 5/5 ✅ |

---

## 发现项

**零 Critical / High / Medium finding。**

所有五项风险（R1-R5）已证伪。改动严格：
- 白名单零越界
- 四条件 AND 豁免 fail-closed，无滥用路径
- 加法门控逐字节实证（还原→红→恢复→绿 突变闭环完整）
- `r.stepId` 耦合正确，非让位路径零接触
- schema 只放宽不收紧，三份归属 PRD 均签字登记
- Y8 harness 诚实，合成锚定无假绿

---

## 结论

```
VERDICT: APPROVE
```
pi EXIT=0

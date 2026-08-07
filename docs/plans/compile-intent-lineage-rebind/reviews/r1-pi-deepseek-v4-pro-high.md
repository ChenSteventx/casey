I now have a complete picture. Let me compile the final review.

---

## 评审结论

**VERDICT: APPROVE**

### 改动白名单核验

全部 8 个变更文件均在白名单内，无越界改动：

| # | 文件 | 白名单项 | 状态 |
|---|------|----------|------|
| 1 | `lib/compile-atoms-flow.mjs` | 白名单 #1（+13 行，唯生产码改动） | ✅ |
| 2 | `tests/_golden/compile-intent-lineage-rebind.zero-sut.golden.mjs` | 白名单 #2（新验收金牌） | ✅ |
| 3 | `loop/prd-compile-intent-lineage-rebind.json` | 白名单 #3 | ✅ |
| 4–8 | `docs/plans/compile-intent-lineage-rebind/**` | 白名单 #3（契约文书） | ✅ |

### 风险逐条证伪

**R1 — intentId 消费者无破坏** ✅ 已证伪

- `entityBindingProvenance` 在重绑**之后**记录 `intentId: event.intentId`（`compile-atoms-flow.mjs:126`），此时 `event.intentId` 已是重绑值 `sourceIntentId`。与终端事件的 `intentId` 一致，观察注册表 `b.intentId === t.intentId` join 不受影响（`entity-observation-registry.mjs:269`）。
- 观察归档（`identityObservations`）直接用 `step.sourceIntentId`（`:161`），不经 `event.intentId`，重绑零影响。
- `evidenceStepId` 以 `stepId` join，与 `intentId` 无关。

**R2 — nav/assert 裸步遗留行为等价** ✅ 已证伪（逻辑分析）

- Nav 步不携 `sourceIntentId`，条件 `typeof step?.sourceIntentId === 'string'` 为 false → 不进入重绑块 → 事件保持 `intent_N`、`lastIntentId` 由 `emit()` 同步为 `intent_N`。
- Assert 步读 `run.lastIntentId`，不读事件 `intentId`，折叠锚跟随最后一步无论是否重绑——与遗留行为逐字一致。
- PRD 证据记载 `bindagent-replay` 冻结金牌（需浏览器）已验证通过。

**R3 — teach-in lineage 字节零漂移** ✅ 已验证

- 基线 `05800b4` 与 HEAD 的 teach-in 块（`compile-atoms-flow.mjs:85-103`）逐字节相同。
- 新块以 `if (!plan ...)` 与 teach-in 路径防火墙隔离，并列不交叠。

**R4 — 金牌真钉在缝上** ✅ 已验证

- 金牌通过 `import` 真实 `compileFlow`（`lib/compile-atoms.mjs`）和 `issueCreatedWorkflowCompileProvenance`（`lib/entity-created-workflow-continuity-v3.mjs`），非源码字符串 grep。
- 红基线实证：实现前 G1a（authored 流）3 断⾔红、G2（混合流）2 断⾔红（`accept/red-proofs/compile-intent-lineage-rebind.red.txt`）；改版 delta 红证：首版全或无掷错被 `bindagent-replay` 夹具证伪后 G2 4 断⾔红（`accept/red-proofs/compile-intent-lineage-rebind.mixed-perstep.delta-red.txt`）。
- 现行全绿：13/13 exit 0。

**R5 — 边界条件健壮** ✅ 已验证

- 空流：`steps` 为空，循环不执行，无影响。
- 空白串 `sourceIntentId`：`"".trim()` 返回 `""`（falsy），条件整体 false，不重绑。
- 非 plain object 步：`step?.sourceIntentId` 可选链对 null/undefined 返回 undefined，`typeof undefined === 'string'` 为 false，不重绑。

### 邻接回归零伤

全部八条邻接命令均 exit 0：

```
entity-workflow-source-readback.wiring.zero-sut:  18/18 ✅
wf-open-readback-requery.zero-sut:                 20/20 ✅
wf-open-observation-yield.zero-sut:                12/12 ✅
p9-created-workflow-continuity-v3.created-in-run:   8/8  ✅
teachin-authoring-compiled-intent-lineage:           3/0  ✅
teachin-authoring-compiled-assertion-intent-lineage: 1/0  ✅
term-lint --registry:                               通过 ✅
selftest --tier1:                                   GREEN ✅
```

### 实现质量观察

正面：
- 13 行净增，改动极小、切口精准。
- `!plan` 防火墙与 teach-in 路径完全隔离。
- 条件链：`!plan` → `events.length > firstEvent` → `typeof ... === 'string'` → `.trim()` 渐进式守门。
- 注释引用 CONTEXT.md 词条、teach-in 块原则、bindagent-replay 夹具口径，可追溯。

无 Critical/High/Medium finding。
pi EXIT=0

以下是完整的评审报告。

---

## 评审结论：`CHANGES_REQUIRED`

提交 `684be1d`，目标：P9 v3 三例接线链收口。

---

## 1. 根因判断（textVisible + textHidden 互斥）

**判定：成立。已验证。**

探针证据（`lib/replay-assert.mjs`）：

```
Probe (hits=3): textVisible=ok:true,  textHidden=ok:false
Probe (hits=0): textVisible=ok:false, textHidden=ok:true
Probe (hits=1): textVisible=ok:true,  textHidden=ok:false
Both true? false
```

二者读的是同一个 `c.textHits[a.value]`，判断条件分别为 `> 0` 与 `=== 0`，**在同一意图内必然互斥**。无遗漏的第三条路径能使二者同时为真。

代表步逻辑确认：`lib/replay/event-runner.mjs:103` 行 `isLast = reprStepOf.get(ev.intentId) === ev.stepId`，`reprStepOf` 在 `lib/heal/reverify-replay.mjs:122` 构造为「每个意图最后一个事件」。断言的 `textHits` 只在 `isLast` 分支内采集（`event-runner.mjs:312` 起），故当「点开弹窗 + 断言 + 关闭弹窗」共处一个意图，textVisible 的求值点在关闭之后，自然恒 0 恒红。`groupTextRequests` 的 GRILL D4 取可见计数是严者优先，方向正确（fail-safe）。

---

## 2. 非对称处置（publish pending vs history 拆意图）

**判定：`NEEDS_HUMAN`。正向覆盖丢失属实，但替岗论证不闭合。**

- `tc_wf_publish_states` 两条正向断言移到 `expected.frozen.tc_wf_publish_states.pending.json`（探针已读，`intent_history` 的 `"创建时间"` 与 `"查看"` 两条 `textVisible`），走 `--force` 签。pending 文件的 `reason` 文档写明了冲突机理与路由人。
- 用户称正向覆盖「改由 `tc_wf_history_version` 拆意图新表达承担」。但 **两例是不同的用例、不同的 flow**（publish_states 验证发布态变迁，history_version 验证版本历史空/非空），弹窗相同不共享同一测试目标。history 验证的文本（如版本列表）与 publish_states 弹窗内文本是不同的断言语义，**不能替岗**。
- 用户的诚实度值得认可：pending 文件的 reason 明文写了「本例拆意图重表达记欠账，待下次真机行程搭车」，没有伪装成已覆盖。

---

## 3. Catalog 件「搬位非新签署」

**判定：签名算法路径无关成立，逐字节相同不可复现核验。**

- 签名算法探针：`cases/tc_catalog_wf_crud/created-workflow-authority.frozen.json` 的 `signature = sha256:5f868efc…`，手动计算 `digestValue(unsignedAuthority(authority))` 得到完全相同的值。签名的输入只是规范化 JSON 的纯内容哈希，**不含文件路径**。
- 文件 `signedAt: 2026-08-07T17:32:22Z` 与声称时点一致。
- **但**：原始件声称在 `runs/b4-replay-20260808/` 下，该目录属 `runs/`（gitignored），此浅克隆中不存在。**逐字节相同的声称在本评审环境中不可复现**。算法对，但证据链缺一环。

---

## 4. 清单换签与 `checksumAmendment` 诚实性

**判定：CRITICAL —— 漏签 catalog PRD。**

`loop/prd-p9-tier2-live-smoke.json` 的 `checksumAmendment` 末条称「全员 artifact 哈希按磁盘现字节刷新共 18 处」。然而：

```
prd-tc_catalog_wf_crud.json:
  expected.frozen.json PRD frozen: ea350717...
  expected.frozen.json disk actual: 0dd042b5...  ← MISMATCH
  entity-locks.frozen.json PRD frozen: 2430a856...
  entity-locks.frozen.json disk actual: 4833be31...  ← MISMATCH
```

`prd-drift-scan.mjs` 独立证实两条均为「漂移」。**catalog 的 B8 重签与实体锁重签后，PRD 的 `testChecksums` 未被更新**。对照 checksumAmendment 声称的 18 处全覆盖，这是漏项。\(tc_wf_publish_states 和 tc_wf_history_version 的 `expected.frozen.json` 匹配。）

另外，三个 PRD 均引用 `runs/` 下的 `execute-authority.json`（`runs/` 是 gitignored），在此浅克隆中全部缺件，使全仓漂移扫描必然红。在完整环境中这些文件可能存在，但评审环境中无法验证。

---

## 5. entityBindings 不对称（textHidden 有绑定，textVisible 无）

**判定：HIGH —— textHidden 未注册为 unbound-read，语义归类错误。**

探针揭示：

```
assert.textVisible:  facets={"entityChange":"none","identityBindingRoles":[],"nonEntityEffect":"none"}  ← 已注册 unbound-read
assert.textHidden:   facets={"entityChange":"entity","identityBindingRoles":["subject"],"nonEntityEffect":"unknown"}  ← 未注册，回退默认
```

- `assert.textHidden` **不在** `ATOM_ADMISSION_FACETS` 注册表中，落到 `UNREGISTERED_ATOM_FACETS`（`entityChange: 'entity'`、`requiredRoles: ['subject']`），被归入 mutation 语义。
- `inspectOperationBindings`（`entity-semantic-lock-preflight.mjs:650`）对 `effect === 'read'` 禁止非空绑定，对 mutation 要求非空绑定——textHidden 走 mutation 分支，带着 closeDrawer 的绑定过检，属于**语义归类错误下的巧合通过**。
- 实际后果：textHidden 携带了本不该有的 entityBindings。虽然当前校验器因默认策略不拒（未注册原子走宽松路径），但如果 textHidden 被纠正登记为 unbound-read，带绑定将触发拒。**这不是断路级问题，但是不对称的技术债**。
- 注意此模式非 textHidden 独有：`assert.buttonState` 同样未注册，同样携带 entityBindings（见 publish_states 的 `intent_create` 与 `intent_publish` 步）。

---

## 6. 遗漏的回归面

**判定：gate 在本环境中为 RED（4/5），非用户声称的 GREEN 5/5。**

```
prd-p9-created-workflow-cleanup-continuity-v3 gate: RED (4/5)
  RED s4-prd-drift-and-terms  → 13 条漂移（含 catalog 双漂移）
  RED s5 selftest --tier1     → term-lint 别名检查失败（预存债）
```

`selftest --tier1` 的 term-lint 别名检测失败是**预存债**（`loop-kit` symlink 指向旧版 `/mnt/d/ctx/heren/loop-kit`，term-lint 对「出口闸」别名不再拦截）——非本提交引入。

但 **drift scan 的 13 条偏离中至少 2 条（catalog 的双漂移）是本轮应收未收的债**。

`ratchet verify` 在本环境中 exit 0 但走的是降级路径（loop-kit 版本过旧），实际未做有效验证。

---

## 总判

| # | 等级 | 描述 | 可复现 |
|---|---|---|---|
| 1 | **CRITICAL** | `loop/prd-tc_catalog_wf_crud.json` 的 `testChecksums` 漏更新——B8 重签 + 实体锁重签后的新哈希未写入 PRD，`expected.frozen.json` 与 `entity-locks.frozen.json` 双重漂移。checksumAmendment 声称「全员刷新 18 处」夸大 | `node tests/_golden/support/prd-drift-scan.mjs` exit 1 |
| 2 | **HIGH** | `assert.textHidden` 未注册 admission facets，默认走 mutation 语义并要求 entityBindings。同类的 `assert.textVisible` 已正确注册为 unbound-read。应补注册使二者对称 | 探针 `admissionFacetsForAtom('assert.textHidden')` 返回 UNREGISTERED_ATOM_FACETS |
| 3 | **MEDIUM** | catalog 件「逐字节重现补落」声称在本评审环境中不可复现（`runs/` 缺件），签名算法路径无关成立但逐字节相同无实证 | — |
| 4 | **MEDIUM** | publish_states 的正向覆盖丢失属实，pending 留痕诚实，但「history 替岗」论证不闭合（不同用例，不同 flow） | pending 文件推理链 |

**总判：`CHANGES_REQUIRED`** —— catalog PRD 双漂移必须修复后重签，textHidden 注册遗漏应补，其余项可挂账。

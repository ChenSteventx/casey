# delta 复审收据 R2 —— pi.dev（审 f995539 → 003989c 的评审修正）

- 评审树：~/casey-review-magdispatch/casey（已切 003989c，34/34 绿）
- 日志：~/casey-recovery-20260807/delta-pi-magdispatch.log（进程正常退出）
- 总判：**APPROVE** —— Critical 0 / High 0 / Medium 0
- 要点：Rf 突变独立复现偏点事故并证还原一致；收紧对三例六真件与冻结金牌 M1 零误伤；
  Rd 两条 R1 绕法均已逮住；「Medium-1 修 / pi Medium 记档」的区分（偏点到别处 vs 点本尊）
  经其独立验证成立；换签记录与 git diff 逐项对上。

以下为评审方原文，未经改写：

```
All evidence gathered. Here is the independent delta review.

---

## Delta 复审报告（f995539 → 003989c）

### 独立核验足迹

| 检项 | 命令 | 结果 |
|------|------|------|
| 新金牌 | `node tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs` | **exit 0, 34/34** |
| 冻结金牌 delete-spec-magnifier | 同上 | **exit 0, 6/6** |
| 冻结金牌 wf-delete-search-filter | 同上 | **exit 0, 16/16** |
| 突变1：摘三字段守卫 | 见下 | **fieldLabel 被判 unique + 点 label（偏点实证）** |
| 突变2：死 import | 见下 | **exit 1, 7 红（含调用点钉）** |
| 还原 sha256 | `sha256sum lib/workflow-delete-spec.mjs` | `2e86b060...` 一致 |
| PRD checksums | 四文件逐项对照 | **全部匹配** |

---

### Q1：Rf 是否真钉住了偏点面？有没有第四种次级定位字段被漏掉？

**Rf 钉住了。无遗漏。**

`sensanticLocator`（`lib/replay-actions.mjs:28-36`）共 5 条分支：

| # | 分支条件 | 谓词守卫 | 覆盖 |
|---|---------|---------|------|
| 1 | `ev.semantic.kind==='role' && ev.semantic.role` | `ev.semantic == null` | ✅ |
| 2 | `ev.semantic.kind==='label' && ev.semantic.name` | `ev.semantic == null` | ✅ |
| 3 | `ev.semantic.kind==='text' && ev.semantic.name` | `ev.semantic == null` | ✅ |
| 4 | `ev.role && ev.accessibleName` | `ev.role == null` | ✅ |
| 5 | `ev.fieldLabel` | `ev.fieldLabel == null` | ✅ |

`ev.semantic == null` 是毯式守卫，覆盖 semantic 的全部三个子分支（含 `kind` 为任意值的 semantic 对象）。`ev.role == null` 覆盖分支 4（因为分支 4 要求 `ev.role` 非空）。`ev.fieldLabel == null` 覆盖分支 5。五个分支被三个守卫字段全集覆盖，无第四种定位字段。

**突变实证**（摘 `&& ev.semantic == null && ev.role == null && ev.fieldLabel == null` 后）：

```
fieldLabel: '搜索'       → resolution: unique  → clicks: ['label']          ← 偏点到 label 元素，非放大镜
role+accessibleName      → resolution: unique  → clicks: [MAG]               ← mock getByRole 返 0，退 fallbackCss
semantic.kind='role'     → resolution: unique  → clicks: [MAG]               ← 同上
```

`fieldLabel` 形在 mock 中 `getByLabel` 返 count=1 → `semanticLocator` 返回 label 定位器 → 点击落在 `label` 而非 `.hr-input__suffix .search-icon`。**偏点面实证成立。** 还原守卫后 34/34 绿。

---

### Q2：收紧有没有误伤？

**零误伤。** 三方面验证：

1. **编译器发射形状**（`compile-atoms-workflow-crud.mjs:319/:402`）：`{ intentId, atom:'workflow.deleteByName', action:'click', fallbackCss:'.hr-input__suffix .search-icon' }` —— 5 字段，无 stepId/fieldLabel/role/semantic。

2. **冻结金牌 M1 形状**（`delete-spec-magnifier`）：`{ stepId:'atstep_13', intentId:'ic', atom:'workflow.deleteByName', action:'click', fallbackCss: MAG }` —— 同为纯 fallbackCss 形。该金牌 **exit 0, 6/6**。

3. **三例六个真件**：文档声称六件均为纯 fallbackCss 五字段形，与编译器发射一致——无一携 fieldLabel/role/semantic。收紧后谓词对纯 fallbackCss 形返回 `true`（三个新守卫字段均为 `undefined` → `== null` → `true`）。

两份冻结金牌均 **exit 0**：`delete-spec-magnifier` 6/6、`wf-delete-search-filter` 16/16。

---

### Q3：Rd 加固后，两条绕法是否都被逮住？还有新绕法吗？

**两条原绕法均已逮住：**

| 绕法 | 修复前 | 修复后 | 实证 |
|------|--------|--------|------|
| 死 import（import 在、条件不用） | Rd 绿 | **Rd 红** — 调用点正则不匹配 | 突变得 **exit 1, 7 红**（Ra×6 + Rd 调用点钉×1） |
| 双引号内联 | Rd 绿 | **Rd 红** — `literalDq` 零出现断言 | 新断言 `eq(dispatchSrc.split(literalDq).length - 1, 0, ...)` |

**仍可绕的新路径（理论，需故意为之）：**
- 字符串拼接：`'.hr-input__suffix' + ' .search-icon'` → 绕过字面计数，但 import + 调用点钉仍在
- 模板字面量：同机理

**成本/收益评估**：这些绕法需要「故意回避检测 + 协同变更两文件」。AST 级别语义等价检测成本高，边际收益低。当前三层钉（字面计数×2 + import 正则 + 调用点正则）覆盖了最可能的单文件 drift 场景。**不值得再加固。**

---

### Q4：pi Medium 记档处置是否成立？

**成立。空串与 Medium-1 的区分站得住。**

独立核验：

```
value: ''       → isMagnifierSearchClick: true → resolution: unique → clicks: ['.hr-input__suffix .search-icon']
value: '   '    → isMagnifierSearchClick: true → resolution: unique → clicks: ['.hr-input__suffix .search-icon']
正常放大镜(无value) → isMagnifierSearchClick: true → resolution: unique → clicks: ['.hr-input__suffix .search-icon']
```

**三者行为全同**——都走 fallbackCss 路径，都点放大镜图标本尊。`value: ''` 只是让事件从「分发层拒点」变「真执行」，但执行目标与正确形状无异。

**与 Medium-1 的本质区别：**

| 维度 | Medium-1（fieldLabel/role/semantic） | pi Medium（value 空串） |
|------|--------------------------------------|------------------------|
| 修前 | 分发层拒点 | 分发层拒点 |
| 修后 | 点**到别处元素**（偏点面） | 点**放大镜本尊**（无偏点） |
| 安全风险 | 有（点到错误目标） | 无（行为与规范形状全同） |
| 编译器产出 | 不产此形 | 不产此形 |

**收紧代价不对称**：收紧为 `value == null` 会让前置闸对 `value: ''` 事件从 `continue` 变 `unsupported_click_label` 具名拒——**越出** Steven 2026-08-08 裁「value 缺」的原冻结语义，且需动冻结金牌换签。为一个证不出风险的边界付换签代价，不值。记档处置成立。

---

### Q5：换签记录与 git diff 是否逐项对得上？

**对得上。**

| PRD checksumAmendments 叙述 | git diff 实证 |
|---------------------------|--------------|
| `"files": ["tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs"]` | 该文件确从 23 检扩至 34 检（+Rf 9 检 + Rd 2 检） |
| plan.md / GRILL.md / red-baseline.txt 未动 | `git diff f995539 003989c -- <files>` 均无输出 |
| `testChecksums` 旧值 `2a81e000...4615` → 新值 `ed6a9a5d...9d03` | `sha256sum` 实测 `ed6a9a5d...` 匹配 |

PRD 内 `checksumAmendments[0].reason` 详述三件事：
1. **Medium-1 修复**：谓词收紧 + Rf 九检 → `lib/workflow-delete-spec.mjs` + 金牌 Rf 段逐字对应
2. **Medium-2 修复**：调用点正则 + 双引号零出现钉 → 金牌 Rd 段新增两断言逐字对应
3. **pi Medium 记档不收紧**：learn.md 第五节 → `docs/plans/replay-magnifier-dispatch/learn.md` 新增完整

三件事均与 `git diff` 的文件级变更和内容级 delta 一对一匹配。`evidence` 时间戳从 `01:28:32` 更新至 `02:24:25`，对应换签后重跑 gate。

---

### 判决

- **Critical：0**
- **High：0**
- **Medium：0**（两条 Medium 已修、一条记档不收紧处置合理）

**DELTA-DONE APPROVE**
```

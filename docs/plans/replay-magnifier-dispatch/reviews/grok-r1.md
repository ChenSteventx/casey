<!-- 来源说明：正文自 grok 会话转录 chat_history.jsonl 的末条含总判的 assistant 消息逐字提取
     （pane 回滚仅 24 行不足为源）。评审树 ~/casey-review-magdispatch/casey，同哈希 f995539。 -->

# 评审报告：`replay-magnifier-dispatch`（f995539）

**范围**：`lib/replay-actions.mjs`、`lib/workflow-delete-spec.mjs`、金牌、plan/GRILL/prd  
**基线哈希（还原后一致）**  
- `lib/replay-actions.mjs` → `9624b238…7941`  
- `lib/workflow-delete-spec.mjs` → `02e432fa…16e7`  
- golden → `2a81e000…4615`  

**绿基线**：`node tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs` → **exit 0**，`23/23`  
**关联金牌**：`delete-spec-magnifier` exit 0；`wf-delete-search-filter` exit 0；`workflow-delete-spec-preflight` exit 0  
突变均用 `cp` 备份 + `sha256sum -c` 还原，未用 `git checkout`。

---

## Findings（首轮仅 Critical / High / Medium）

### Medium-1 — 白名单形状未钉死次级定位字段，通用门下可偏点

**证据**（对抗事件，exit 0）：

| 事件附加字段 | `isMagnifierSearchClick` | 前置闸 | 实际点击 |
|---|---|---|---|
| 纯 `fallbackCss` | true | ok | `css:.hr-input__suffix .search-icon` |
| `+ fieldLabel:'搜索'` | true | ok | **`label:搜索`** |
| `+ role/accessibleName` | true | ok | **`role:button:查询`** |
| `+ semantic:{kind:'role',role:'button'}`（无 name） | true | ok | **`role:button:`** |

根因：谓词只查文案/`value`/css（`workflow-delete-spec.mjs:14-19`），而 `resolveCandidate`（`replay-actions.mjs:132-145`）优先 `semanticLocator`（`fieldLabel` / `role` / `semantic.kind`），命中则**不走** `fallbackCss`。

**修前**：同形状进破坏支、无 `value` → 无条件 `action_failed`（`HEAD^` `replay-actions.mjs:108-113`），偏点不可达。  
**修后**：白名单事件落入通用门，次级定位字段成为新可达面。

**生产路径**：编译器两处发射为纯 `fallbackCss`（`compile-atoms-workflow-crud.mjs:319/:402`），无 `fieldLabel`/`role`，正常编译件安全。  
**加固（可选）**：谓词加 `!ev.fieldLabel && !ev.role && !(ev.semantic && ev.semantic.kind)`（或要求 `semantic` 缺席）。

---

### Medium-2 — Rd 结构钉只认 import + 单引号字面，不认调用点

**证据**：

1. 保留 `import { isMagnifierSearchClick }`，条件改为恒进破坏支（死引用）→ **Rd 全绿**，Rb/Rc 红，exit 1。  
2. 保留 import，双引号内联放宽判据 `ev.fallbackCss === ".hr-input__suffix .search-icon"` → **Rd 仍绿**（金牌只数 `'.hr-input__suffix .search-icon'`），Rb 红，exit 1。

`tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs:120-125` 无调用点断言。

**影响**：Rd 防「字面分叉」；功能分叉靠 Ra/Rb/Rc。  
**加固成本低**：加 `!isMagnifierSearchClick(ev)` 调用点正则。非阻断。

---

**Critical / High：无。** 破坏性三 click 的 value 义务与错误文案拒点未放松（见 Q2）。

---

## 六个问题

### 1. 缝的定性对吗？有没有更该修的位置？

**对。** 修前分发层无条件拒点。

| 层 | 证据 |
|---|---|
| 修前分发 | `git show HEAD^:lib/replay-actions.mjs` L108-113：`workflow.deleteByName` click 一律要 `targetName`，无则 `action_failed` |
| 修前闸 | `HEAD^:workflow-delete-spec.mjs` 内联白名单 `continue`（放行放大镜） |
| 修后 | L114：`&& !isMagnifierSearchClick(ev)` 才进破坏支；命中落到 L128-129 通用门 |
| MUT1 | 摘谓词调用 → **exit 1，6 红**（Ra 全家 + Ra2/Ra0），与「修前拒点」同构 |

**是否别处更该修**：

- **删编译发射**：否。S1/`wf-delete-search-filter` 冻结钉住放大镜；真机要图标过滤。  
- **event-runner 特判**：否。缺口在 `performActionOnPage` 域分支，不在跑道。  
- **本刀「分发对齐闸」**：正确，且谓词单点避免再分叉。

---

### 2. 安全面有没有放松？

**破坏性三 click / 矛盾形状：未放松。**

| 对抗 | 谓词 | 闸 | 分发 |
|---|---|---|---|
| `value:''` / `'   '` | true（与「value 缺」一致） | ok | unique + 点放大镜 |
| `text:''` / `semantic.name:''` | false | `unsupported_click_label` | `action_failed` |
| css 前后空格 / 大小写 / 截断 | false | `unsupported_click_label` | `action_failed` |
| 删除/确定/确认 无 value | false | `missing_target_binding` | `action_failed` |
| css 对 + value / +「删除」 | false | 拒 | `action_failed`（Rb） |
| 正常删除 text+value | false | ok | 域处理器（非通用门） |

金牌 Rb/Rc/Re + `delete-spec-magnifier` 6/6 exit 0 交叉钉住。  
残留面见 **Medium-1**（次级定位字段，非破坏三 click 放松）。

---

### 3. 通用锁定门对放大镜是否安全？

**对编译器纯 `fallbackCss` 形状：是。**

- 无 semantic → `semanticLocator` null → `fallbackCss`（L132-145）  
- 金牌 Ra：`semanticTouches.length===0`，click 恰落 `MAG`  
- Ra2 count=2 → `ambiguous` 0 点击；Ra0 count=0 → `none` 0 点击  
- `formalActionGate`：非 unique 不 perform；点失败 → `action_failed`

**会偏点的路径**：见 Medium-1（`fieldLabel` / `role` / 无 name 的 `semantic.kind`）。  
多图标 ambiguous 不点；单候选但 CSS 命中「同选择器非预期节点」是既有 fallback 风险，与 `workflow.open` 同源，非本刀新语义。

---

### 4. 单点谓词结构钉（Rd）够不够硬？

**功能耦合够；结构钉中等。**

| 突变 | 结果 |
|---|---|
| MUT1 摘调用 | exit 1，**6 红** |
| MUT2B `label != null` 反转 | exit 1，**10 红**（Ra×6 + Rb2×2 + Re1 + Re3），两层同红 |
| MUT3 内联单引号字面 | exit 1，**恰 Rd 双红**，功能仍 21/23 绿 |

绕法见 Medium-2（死 import、双引号字面）。加固成本低；Rb/Rc 已兜功能。**不值得为此阻断合并。**

---

### 5. 红先行与突变闭环是否成立？

**成立（独立复现）。**

| 步骤 | 命令/操作 | 退出码 | 结果 |
|---|---|---|---|
| 基线 | `node tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs` | **0** | 23/23 |
| MUT1 摘谓词 | 条件改回无 `isMagnifierSearchClick` | **1** | **6 红** |
| MUT1 还原 | `cp` + `sha256sum -c` | 0 | OK |
| MUT2 判据反转 | `label != null && …`（与 closure 同形） | **1** | **10 红** |
| MUT2 还原 | 同上 | 0 | OK |
| MUT3 内联字面 | 删 import、内联单引号 css | **1** | **Rd 双红** |
| MUT3 还原 | 同上 | 0 | OK |
| 终态 | 再跑金牌 + sha256 | **0** | 23/23，哈希与提交一致 |

说明：全量 `!(...)` 反转得 14 红（多 Rb1/Rc），仍证单点共享；brief 的「10 红」对应 **逐条件反转 label**（MUT2B），已对齐。

---

### 6. 回归面；`workflow.open` 放大镜走哪条路？

**本刀影响面**：仅 `atom==='workflow.deleteByName' && action==='click'` 分支入口（L114）。

**`workflow.open` 放大镜**（`compile-atoms-workflow-nav.mjs:107`）：

```text
atom: 'workflow.open', action: 'click', fallbackCss: MAG
```

- 不进 deleteByName 支（atom 不同）  
- `isMagnifierSearchClick` 对 open 恒 false（L15）  
- 一直走 L128-129 通用门（修前修后同）  
- 探针：open mag → `unique` + 1 次 click 落 MAG，exit 0  

**已跑**：本金牌 23/23；`delete-spec-magnifier`；`wf-delete-search-filter`；preflight。  
**未在本评审机重跑**：全量 51 份 affected 清单与 `selftest --tier1`（清单称 50 绿 / 1 陈旧红 `real-run-trust`；本刀未碰 `bin/replay.mjs`）。证不出「51 份此刻全绿」→ 对该条记 **NEEDS_HUMAN**（不升 Critical）。  
**不必另开面**：`intent-action-fold`、cases 人签（plan 非目标）；真机三例属合并后票据。

---

## 总判

缝的定性与修法位置正确；破坏性绑定与错误形状拒点保持；突变闭环独立闭合；生产编译路径安全。两项 Medium 为次级定位字段形状缺口与 Rd 结构钉硬度，均不否定本刀，建议后续加固而非挡合并。

REVIEW-DONE APPROVE
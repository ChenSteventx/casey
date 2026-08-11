# 评审收据 R1 —— pi.dev（异构，审 f995539）

- 评审树：~/casey-review-magdispatch/casey（浅克隆同哈希，评审方自跑金牌与三轮突变）
- 日志：~/casey-recovery-20260807/review-pi-magdispatch.log（进程正常退出）
- 总判：**APPROVE** —— Critical 0 / High 0 / Medium 1
- Medium 1：谓词对 value 空串按「缺」处理（与前置闸原冻结判据同义），编译器不产此形、
  注入亦只点非破坏图标，无实际风险；建议记为已知取舍或收紧。处置见 fixes 记录。

以下为评审方原文，未经改写：

```
All pass. Now I have all the evidence I need. Here is my independent review.

---

## 评审报告 —— replay-magnifier-dispatch（commit f995539）

### 核验足迹

| 检项 | 命令 | 退出码 | 结论 |
|------|------|--------|------|
| 新金牌 23/23 | `node tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs` | 0 | GREEN |
| gate: delete-spec-magnifier | `node tests/_golden/delete-spec-magnifier.zero-sut.golden.mjs` | 0 | GREEN |
| gate: wf-delete-search-filter | `node tests/_golden/wf-delete-search-filter.zero-sut.golden.mjs` | 0 | GREEN |
| gate: tier1 | `node bin/casey.mjs selftest --tier1` | 0 | GREEN |
| 突变1: 摘谓词调用 | 同上金牌 | 1 | 7红（≥声称6） |
| 突变2: 判据反转 | 同上金牌 | 1 | 14红（≥声称10，两层同红） |
| 突变3: 内联等价字面 | 同上金牌 | 1 | 2红（恰Rd双红） |
| 还原后 sha256 | `sha256sum` 对照 mutation-closure.txt | — | 逐字节一致 |
| entity-rename-negative-guard | node ... | 0 | GREEN |
| entity-rename-unknown-action-guard | node ... | 0 | GREEN |
| resolution.golden | node ... | 0 | GREEN |

---

### 逐题回答

**1. 缝的定性对吗？——对，经独立确认。**

`performActionOnPage`（`lib/replay-actions.mjs:114`）的 `deleteByName`-click 分支修复前为：

```js
if (ev.action === 'click' && ev.atom === 'workflow.deleteByName') {
    const targetName = typeof ev.value === 'string' && ev.value.trim() ? instantiate(ev.value, ctx) : null;
    if (!targetName) return { resolution: 'action_failed', ... };
```

放大镜事件 shape `{ atom:'workflow.deleteByName', action:'click', fallbackCss:'...' }` 无 `value` → `targetName` 恒 `null` → **无条件 `action_failed`**。前置闸（`validateWorkflowDeleteBindings`）用同一判据放行；编译模板（`compile-atoms-workflow-crud.mjs:319/402`）照发。三层中分发层独异——洞在此。

**有没有更该修的位置？** 评估三个备选：

- **删编译模板发射**：需三例真机重编译 + 重签 → 代价高，且删后「删除后重搜归零断言」缺数据源 → 不选，合理。
- **event-runner 特判**：破坏分层（把放大镜执行逻辑塞进 runner 而非分发层）→ 增加耦合面 → 不如当前方案。
- **分发层接通（当前方案）**：零重编译零重签、执行语义零特殊化 → 最小改动，正确。

**2. 安全面有没有放松？——没有。**

破坏性三 click 的绑定逻辑逐字不变：

| 场景 | 谓词返回 | 走的路径 | 结论 |
|------|----------|----------|------|
| css 对、无文案、无 value（真放大镜） | `true` | 通用锁定门 → 真执行 | 修后新行为，正确 |
| css 对 + `value:'atl_x'` | `false`（value 非缺） | 原破坏性分支 → 要 targetName → 正常 | 逐字保持 |
| css 对 + `text:'删除'` + 缺 value | `false`（label='删除'≠null） | 原破坏性分支 → targetName=null → action_failed | 逐字保持 |
| css 错 + 缺 value | `false`（css 不匹配） | 原破坏性分支 → action_failed | 逐字保持 |
| css 对 + `text:'确定'` + `value:'atl_x'` | `false` | 原破坏性分支 → performWorkflowDeleteConfirm | 逐字保持 |

**对抗构造探针**（在 Rb/Rc/Re 检中覆盖）：

| 对抗 shape | 预期 | 实测 |
|-----------|------|------|
| `value:''`（空串） | 谓词 pass（`!''.trim()`=true）→ 走放大镜支 | 非破坏（点图标而已），编译器永不发此形 |
| `value:'   '`（全空白） | 同上 | 同上，零风险 |
| `semantic.name:''`（空串） | `'' == null` = false → 谓词 reject | Rb2/Re3 实证拒点 ✓ |
| `text:null`（显式 null） | `null == null` = true → 谓词 pass | 编译器对 magnifier 不发 text，但即便注入也只点到图标 |
| `text:undefined`（缺省） | `undefined == null` = true → 谓词 pass | 同上 |
| css 前加空格 `' .hr-input__suffix .search-icon'` | 严格 `===` → false → 拒 | Rc 实证 ✓ |
| css 大小写 `'.HR-INPUT__SUFFIX .search-icon'` | 严格 `===` → false → 拒 | Rc 实证 ✓ |

**唯一微隙**：`value:''` 或 `value:'   '` 会通过谓词，与 `value` 完全缺失语义等价。编译器永不产此形，注入也仅点到非破坏图标 → **无安全风险**。

**3. 通用锁定门对放大镜事件安全吗？——安全。**

放大镜事件无 `semantic` 属性（shape 只含 `atom/action/fallbackCss`）。路径：

1. `semanticLocator(page, ev)` → 遍历 role/label/text/fieldLabel 四分支全部不命中 → 返回 `null`
2. `resolveCandidate` 走 `ev.fallbackCss` 分支 → `page.locator('.hr-input__suffix .search-icon')`
3. **多图标**（count>1）→ `ambiguous`，不点（Ra2 实证 ✓）
4. **零图标**（count=0）→ `none` + 漂移探针，不点（Ra0 实证 ✓）
5. **单图标**（count=1）→ `formalActionGate.resolve` → `unique` → `perform`（含动作窗口前重验：connected/sameNode/ownerMatches/候选数不变）

**错点风险**：CSS 选择器 `.hr-input__suffix .search-icon` 是编译器与前置闸共享的同一字面，真机页面 `.hr-input__suffix` 是搜索框后缀容器，`.search-icon` 是其内唯一放大镜图标——编译器已通过 `wf-delete-search-filter` 金牌实证此选择器语义正确。`formalActionGate` 的重验门进一步防节点脱离/替换/计数变化。**路径安全**。

**4. 单点谓词的结构钉（Rd）够不够硬？**

Rd 检三层：
- `lib/workflow-delete-spec.mjs` 中字面 `'.hr-input__suffix .search-icon'` 恰 1 处（**定义面**）
- `lib/replay-actions.mjs` 中同一字面 0 处（**只经 import 消费**）
- `export function isMagnifierSearchClick` 存在于 spec 文件
- `import { ... isMagnifierSearchClick ... } from './workflow-delete-spec.mjs'` 存在于 actions 文件

**绕法评估**：

| 绕法 | 能否绕过 Rd | 成本 |
|------|-------------|------|
| 双引号 `".hr-input__suffix .search-icon"` | 是（单引号计数变 0） | 需同时改谓词定义和前置闸调用——Rd 会红「字面0处」 |
| 字符串拼接 `'.hr-input__suffix' + ' .search-icon'` | 是（拆成两段） | 需变更谓词实现，但 Rd 的 import 检仍绿；**唯一可行绕法** |
| 模板字面量 | 是 | 同上 |
| re-export 中转 | 是（第三文件导出） | Rd 的 import regex 固定匹配 `'./workflow-delete-spec.mjs'`，中转会红 |
| 改引号同时改 import 路径 | 理论上可双绕，但需**协同变更两文件** | 代码评审应能发现 |

**是否值得加固？** 当前三层钉（字面计数 + 导出声明 + import regex）覆盖了最可能的单文件 drift。字符串拼接绕法需要**有意**回避检测，正常重构不会选此路径。**加固成本（语义等价检测如 AST 比较）高而收益边际——不建议追加**。

**5. 红先行与突变闭环是否成立？——成立，经独立复现。**

| 阶段 | 退出码 | 红数 | 与文档对照 |
|------|--------|------|-----------|
| 修前基线 | 1 | 8（Ra 系 6 + Rd 系 2） | 与 red-baseline.txt 一致 |
| 突变1：摘谓词调用 | 1 | 7（Ra全家6 + Rd import 1） | ≥ 声称6 ✓ |
| 突变2：判据反转 | 1 | 14（分发 Ra 系 + 前置闸 Re 系同红） | ≥ 声称10，两层同红证单点有牙 ✓ |
| 突变3：内联等价字面 | 1 | 2（恰 Rd 双红） | 与文档一致 ✓ |
| 还原后 | 0 | 0（23/23 绿） | sha256 与 PRD 一致 ✓ |

**6. 回归面：有没有该跑没跑的？**

**compile-atoms-workflow-nav.mjs:107**：发射同款 fallbackCss 放大镜 click，但 `atom: 'workflow.open'`（非 `workflow.deleteByName`）。在分发层：
- `isMagnifierSearchClick(ev)` 首判 `ev.atom !== 'workflow.deleteByName'` → 返回 `false`
- 不存在 `workflow.open` 专用分支 → 落到函数末尾 `resolveCandidate` + `gateAndAct` 通用路径
- **该路径修前已存在、修后未变——本刀零影响**

**受影响金牌覆盖面**：51 份（`grep -E 'replay\|delete'` + `grep -l 'workflow-delete-domain'`，筛 zero-sut/static）覆盖了所有文件名含 replay/delete 或引用删除域逻辑的金牌。我额外核验了**直接 import `replay-actions.mjs` 但文件名不含 replay/delete 的 3 份金牌**（`entity-rename-negative-guard`、`entity-rename-unknown-action-guard`、`resolution`）——全部 GREEN, exit 0。**无遗漏面**。

受影响金牌中唯一红 `real-run-trust`：该金牌要求 `bin/replay.mjs` 含旧式逐参解析，而生产件已改为对象解析——**既有陈旧红，与本次改动零交集**。

---

### 发现

**Critical: 0** — 无。

**High: 0** — 无。

**Medium: 1** — `isMagnifierSearchClick` 谓词对 `value: ''`（空字符串）返回 `true`，语义上将空串 value 与缺失 value 等同处理。编译器永不产此形，注入亦只点到非破坏图标，无实际安全风险。但若未来编译器因 bug 产 `value:''` 的 deleteByName 事件，会误走放大镜路径而非绑定义务路径。建议在计划文档中记录此边界为已知设计取舍（D2 补充），或收紧为 `value === undefined || value === null`。

---

REVIEW-DONE APPROVE
```

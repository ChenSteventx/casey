# pi 实现评审 r1 —— drawer-lock-hardening（异构冗余第二路，实现方=Claude，评审方=DeepSeek）

- 评审者：deepseek-v4-pro（pi 0.80.3，`pi -p --no-session --no-tools --thinking high --model deepseek/deepseek-v4-pro`，评审料以 @file 附带）
- 评审料：`docs/plans/drawer-lock-hardening/review/material-impl-r1.md`（与 codex 同料同指令）
- 家族：DeepSeek ≠ Claude（crossFamily 成立）
- 模型验真（驱动员 smoke，正式评审前）：`--list-models` 确认 deepseek provider 下存在 `deepseek-v4-pro`；`--mode json` 元数据实测 `"model":"deepseek-v4-pro"`；中文身份探针答「是。我是深度求索（DeepSeek）开发的AI模型。」。注意：英文身份探针曾自称 Claude（模型自我误认，已知现象）；路由证据（provider + API 接受该 model id + 中文自认）足证真身为 DeepSeek。
- 运行：2026-07-14，exit 0
- 驱动员：Claude（只备料/跑 CLI/归档，不代评审下判断）

## 总裁决

CHANGES-REQUIRED（0 HIGH / 1 MED / 0 LOW）

## 评审输出全文（逐字归档）

**异构冗余实现评审结果**

**总裁决：CHANGES-REQUIRED**（发现 1 条 MED 级实现缺陷）

---

### MED — 标题文本可见性检查仅取首个匹配节点，可能误拒合法抽屉

**文件**：
`lib/replay-actions.mjs`（`nodeDrawerDomain` 函数）
`lib/compile-atoms.mjs`（同名重复函数）
对应 diff 中 `async function nodeDrawerDomain` 块。

**问题**：
函数判断“抽屉内标题文本自身可见”时，用 `.getByText(label, { exact: true }).first().isVisible()` 检查首个匹配元素的可见性。若抽屉 DOM 中存在一个隐藏元素（例如 `display:none` 的占位文本、`aria-label` 副本等）恰好包含与节点标题相同的精确文本，且该隐藏元素排在可见的真实标题元素之前，则 `first()` 指向该隐藏元素 → 可见性为 `false` → 整个抽屉被从域锁中排除。即使真实标题元素在该抽屉内确实可见，域锁仍会视该抽屉为“不含可见标题”，导致 `count` 变少或变 0，最终把合法操作误拒为 `NEEDS_HUMAN`（fail‑closed）。

**可复现依据**：
构造一个 fake‑sut 场景：节点抽屉内存在两个包含相同节点标题文本的元素——第一个隐藏（`display:none`），第二个可见（真实标题）。此时调用 `openNode`/`selectNodeDropdown`/`setNodeField` 的域锁检查，得到的 `domain` 数组中不包含该抽屉，从而操作被硬阻断。触发条件为生产环境中某些 SPA 在抽屉头部同时放置隐藏的提示文本与实际可见标题，且隐藏元素在 DOM 序中先于可见标题。

**建议修复**：
将可见性判定改为：遍历 wrapper 内所有匹配的精确文本节点，只要存在任一 `isVisible()` 为 `true`，即可将 wrapper 纳入域锁。伪代码：
```js
const hits = w.getByText(label, { exact: true });
const n = await hits.count();
let anyVisible = false;
for (let i = 0; i < n; i++) {
  if (await hits.nth(i).isVisible()) { anyVisible = true; break; }
}
if (anyVisible) matches.push(w);
```

---

其余各核查项（域锁一致性、`nodeName` 回落全堵死、红先行金牌证伪性、PRD 重签完整性、凭据外泄/术语合规）均通过，无额外发现。

## 驱动员备注

- 本 MED 与 codex（gpt-5.6-sol）独立评审的 MED#1 指向同一缺陷面，双路跨家族独立收敛，互证非偶然误报。
- pi 未报出 codex 的 2 条 HIGH（Locator TOCTOU 漂移 / `nodeDrawerLabel` 陈旧值）与 2 条 LOW；两路 findings 的并集与差集由实现侧处置时逐条对账。

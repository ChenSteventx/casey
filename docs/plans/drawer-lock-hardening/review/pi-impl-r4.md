# 异构冗余实现评审 r4 —— pi 路（deepseek-v4-pro @ thinking high）

- 评审员：deepseek-v4-pro @ thinking high（pi -p --no-session --no-tools --thinking high，@material-impl-r4.md 附料）
- 实现方=Claude、评审方=DeepSeek，crossFamily 成立；与 codex 路同料同指令；被审=commit 157cb74
- 总裁决：**PASS**（0 HIGH、0 MED，3 条非阻断观察）
- pi exit 0（首跑 Request timed out，同调用式重试一次得完整报告）；原始件 pi-impl-r4-raw.txt

---

## 异构冗余实现评审（第四轮）结论

**结论：PASS**

本评审独立核验汇裁 r3 采信的两条 HIGH 修复（A1/A2），对照 `lib/replay-actions.mjs` 与 `lib/compile-atoms.mjs` 两门同刻 diff。认定修复逻辑闭包严密，**真堵死原漏洞**，未引入可导致假绿的新缺陷。具体如下：

### A1 — 初次域扫描即保留物理句柄（堵死 TOCTOU 身份伪造）
- **原漏洞**：`nodeDrawerDomain` 返回惰性 `nth(k)` Locator；`pinNodeDrawer` 扫描后再 `elementHandle()` 锚定，两次解析间同标题抽屉原位替换可使 `rootHandle` 成为冒牌，物理同一校验无从识别。
- **修复**：改为 `structural.elementHandles()` 一次性快照获取全体候选 `ElementHandle`，逐句柄 `evaluate` 页内核验可见标题，返回物理句柄数组；`pinNodeDrawer` 直接对 `domain[0]` 盖 `pin`，删除锚定重解析。快照后任何 DOM 替换会使对应句柄脱附 → 后续操作抛错 → `fail-closed`，构造上封死“检查过的节点 ≠ 锚定的节点”。
- **释放纪律**：新增 `disposeDomain`，在所有仅用计数的调用点（基线、轮询、后置核验）及时释放，路径覆盖完整。
- 无明显句柄泄漏（成功路径 `rootHandle` 由调用方负责，系旧有模式，非本修复引入）。

### A2 — 补挂点闸（防 pin 搬移假绿）
- **原漏洞**：`verifyPinnedNodeDrawer` 仅验①域内唯一者物理同一、②pin 全页恰一。pin 移到无标题嵌套 `wrapper` 后域计数仍唯一、pinCount=1 → 前两闸全过，唯一候选由原抽屉缩窄为嵌套 `wrapper`，`ambiguous` 洗成 `unique` 假绿。
- **修复**：在 `pinCount===1` 后追加第三闸——以 `page.$` 获取 pin 承载者，与 `rootHandle` 物理同一校验。若 pin 已被搬移，承载者必然 ≠ 原钉节点，返回 `action_failed`。配合 fake-sut 的 `pinmove` 场景（MutationObserver 摘钉搬家），三闸齐备，搬移再无假绿。

### 主要关注点（非阻断，建议记录）
1. **`page.evaluate` 内自定义 `visible`**：判据与 Playwright `:visible` 基本对齐（非空盒 + `visibility` 未隐藏），但未检查 `opacity:0`；因外层 `structural` 已用 Playwright `:visible` 筛选，实际覆用窗口极窄，无引致假绿/假阴风险。
2. **`page.evaluate` 内文本规范化 `norm`** 会对连续空格合并，可能比 Playwright `exact: true` 略宽松；但由于候选已通过 `getByText(exact:true)` 筛选，二次核验几乎不可能仅因此变严/变松，行为与原有差异可忽略。
3. **`pinNodeDrawer` 成功路径返回的 `rootHandle`** 仍由上游释放，建议在后续版本中补确认所有调用点均释放，以防长期运行累积泄漏（非本修复新增债务）。

### 复现依据
- 使用材料已列的 `pinmove` 场景（fake-sut server）与金证 G18a/G18b：修前假绿成立，修后原动作被硬阻断，验证 `verdict` 落入 `NEEDS_HUMAN` 或编译出 `exit 65`，全量金牌 35 保持回归全绿。

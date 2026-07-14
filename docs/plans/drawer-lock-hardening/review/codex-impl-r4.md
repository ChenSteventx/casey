# 异构冗余实现评审 r4 —— codex 路（gpt-5.6-sol @ medium）

- 评审员：gpt-5.6-sol @ medium（codex exec --skip-git-repo-check -C 本树 -s read-only，stdin 喂指令+料 material-impl-r4.md）
- 实现方=Claude、评审方=codex/OpenAI GPT，crossFamily 成立；被审=commit 157cb74（A1/A2 修复）
- 总裁决：**NEEDS CHANGES**（A1 复核通过、A2 复核通过、1 MED 新引入标题匹配假阴）
- codex exit 0，tokens 102,014；原始全文 codex-impl-r4-raw.txt（含只读沙箱仓内探索轨迹）

---

结论：NEEDS CHANGES

A1、A2 两条 HIGH 本身已堵住，但新实现引入了可复现的标题匹配假阴，破坏原有 Playwright 精确文本语义。

1. MED：标题参数未按 Playwright 规则归一，合法抽屉被排除

位置：

- [lib/replay-actions.mjs:153](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:153)，实际错误比较在第 156 行
- [lib/compile-atoms.mjs:170](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:170)，实际错误比较在第 173 行

新代码只归一了 DOM 文本，却直接与原始 `lbl` 比较：

```js
norm(node.textContent) === lbl
```

Playwright `getByText(label, { exact: true })` 会同时归一查询文本和 DOM 文本。差分探针：

```text
DOM 标题：Node A
label：␠␠Node␠␠␠A␠␠
```

实测结果：

```json
{
  "structural": 1,
  "old": [{"hits": 1, "any": true}],
  "neu": [false]
}
```

即：

- 原实现的 `getByText(... exact).isVisible()` 接受该标题；
- 新页内判据把同一抽屉排除；
- `nodeNameInvalid()` 只用 `trim()` 判断是否为空，并未禁止这种非空字符串，因此这是既有合法输入；
- 回放 `setNodeField/selectNodeDropdown` 会由原先可操作退化成 `none`，属于新增假阴；编译门同样受影响。

应改为比较 `norm(node.textContent) === norm(lbl)`，并补回放、编译两门的空白归一正向金牌。

A1 复核：通过

- `elementHandles()` 在初次域扫描时取得物理句柄：[replay-actions.mjs:136](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:136)、[compile-atoms.mjs:154](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:154)。
- `rootHandle` 直接取扫描句柄并盖 pin，不再二次惰性解析：[replay-actions.mjs:232](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:232)、[compile-atoms.mjs:248](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:248)。
- 原位替换发生在核验后时，后续物理同一闸会拒绝；发生在核验前时，脱附节点通常因空盒被排除。未发现能重新锚定到替换节点的路径。
- 域句柄、重判句柄、carrier 和成功绑定根句柄均有对应释放路径，未发现本次新增的确定性句柄泄漏。

A2 复核：通过

- 全页 pin 恰一后，确实取得唯一 carrier 并与 `rootHandle` 做物理同一比较：[replay-actions.mjs:213](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:213)、[compile-atoms.mjs:229](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:229)。
- `MutationObserver` 在 pin `setAttribute` 后的微任务检查点执行，后续 Playwright 重判能看到搬移结果；G18 同时钉住零落笔及 `NEEDS_HUMAN/INDETERMINATE`：[drawer-lock-hardening.golden.mjs:780](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/_golden/drawer-lock-hardening.golden.mjs:780)。
- 未发现 pin 搬移后仍能绕过动作时刻重判并形成假绿的具体路径。

冻结测试的 SHA-256 与当前 PRD 登记一致；但当前只读沙箱无法独立复跑会创建 `/tmp` 产物的全量 golden。因此不能用仓内既有 gate 声明替代上述差分反例。

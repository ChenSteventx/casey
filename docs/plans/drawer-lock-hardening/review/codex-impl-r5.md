# 异构冗余实现评审 r5 —— codex 路（gpt-5.6-sol @ medium）

- 评审员：gpt-5.6-sol @ medium（codex exec --skip-git-repo-check -C 本树 -s read-only，stdin 喂指令+料 material-impl-r5.md）
- 实现方=Claude、评审方=codex/OpenAI GPT，crossFamily 成立；被审=commit a2010df（r5 norm 两侧归一）
- 总裁决：**NEEDS CHANGES**（r4 MED 对非空 label 确已堵死，但新引入 1 条 fail-open：纯空白 label 经 norm 成空 target、openNode 入口无 trim 空门）
- codex exit 0，tokens 122,648；原始全文 codex-impl-r5-raw.txt

---

## NEEDS CHANGES

发现 1 条新引入的 fail-open：

- [lib/replay-actions.mjs:155](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:155)、[lib/compile-atoms.mjs:172](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:172)：`target = norm(lbl)` 会把纯空白 `label` 变成 `''`，但 `openNode` 两个入口没有 `trim()` 空值门：
  - 回放仅检查 `!label`，[lib/replay-actions.mjs:281](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:281)；
  - 编译直接 `String(params.label || '')`，[lib/compile-atoms.mjs:674](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:674)。

可复现路径：

1. Playwright 会把纯空白查询归一为空串；仓内固定语料的单节点含一个可见、空文本的 anchor，[server.mjs:254](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/fixtures/fake-sut/server.mjs:254)、[server.mjs:573](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/fixtures/fake-sut/server.mjs:573)。
2. `getByText('   ', {exact:true})` 因此可把该 anchor 当成唯一画布命中；`nodeBoxByLabel`/`workflowNodeBox` 再向上找到 `.lf-node` 并点击。
3. 点击后抽屉内存在可见、空 `textContent` 的 input，[server.mjs:445](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/fixtures/fake-sut/server.mjs:445)。新判据会令 `norm(input.textContent) === target === ''` 成立，把空控件误当标题。
4. 回放遂可能返回 `unique + identityReadback.ok:true`；仅含 `openNode` 的编译流也可能成功产事件。r4 的原比较不可能让 `'' === '   '` 成立，因此这是 r5 新增的假绿面。

现有 G19 只测“非空标题加前后空白”，未覆盖纯空白，[drawer-lock-hardening.golden.mjs:822](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/_golden/drawer-lock-hardening.golden.mjs:822)。

其余核验结论：

- r4 MED 对“非空 label 带前后或内部连续空白”的问题确已堵死，两门同刻。
- 内部空白折叠不偏离 Playwright `exact`：Playwright 同样归一查询文本和 DOM 文本并折叠连续空白，[coreBundle.js:513](/mnt/d/ctx/heren/casey-drawer-lock-hardening/node_modules/playwright-core/lib/coreBundle.js:513)。
- 对非空 label，外层 `getByText(..., exact:true)` 仍是先行门，修复不会把子串标题等原本不匹配的标题纳入域。
- `ghostdup` 的“隐藏在前、可见在后”遍历语义和 `twinghost` 的隐藏标题拒认逻辑未被改变。
- A1/A2、`verdict.mjs`、事件 schema 均未被本次实现改动波及。

建议在回放和编译 `openNode` 入口统一拒绝 `label.trim() === ''`，并补纯空白 label 的回放、编译反向金牌。

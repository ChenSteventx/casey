# 异构冗余实现评审 r6 —— pi 路（deepseek-v4-pro @ thinking high）

- 评审员：deepseek-v4-pro @ thinking high（pi -p --no-session --no-tools --thinking high，@material-impl-r6.md 附料）
- 实现方=Claude、评审方=DeepSeek，crossFamily 成立；与 codex 路同料同指令；被审=commit 44d8cc8
- 总裁决：**PASS**（三条修复路径全堵死、无新引入 fail-open/假绿/假阴、未破坏既有语义、A1/A2/r4-MED 不波及）
- pi exit 0；原始件 pi-impl-r6-raw.txt

---

结论：**PASS**

---

## 1. codex r5 fail‑open 是否真堵死
对照 diff 逐条验证：

| 落点 | 改动 | 堵死分析 |
|---|---|---|
| `lib/replay-actions.mjs` → `doOpenNode` | 入口判断 `if (!label \|\| label.trim() === '')` 替换原 `if (!label)` | **是**。原逻辑仅拒 `null/undefined`，纯空白字符串 `"   "` 为 truthy，直接穿透至 `nodeDrawerDomain`→`getByText(exact)`→空 target 假绿。新条件将 trim 后为空的 label 一律拒动，返回 `action_failed`，封死回放门假绿路径。 |
| `lib/compile-atoms.mjs` → `compileWorkflowOpenNode` | 在 `run.nodeDrawerLabel = null;` 后增 `if (label.trim() === '') { blockers.push(…); return; }` | **是**。原编译路径无 trim 空门，纯空白 label 经 `String(params.label||'')` 保持空白，进入 `nodeDrawerDomain`→域定位→可能匹配空文本节点→伪造 `openNode` 事件。新门径直阻断并写 blocker，fail‑closed。 |
| `lib/replay-actions.mjs` 与 `lib/compile-atoms.mjs` → `nodeDrawerDomain` | 函数首行增 `if (String(label == null ? '' : label).trim() === '') return [];` | **是（纵深防御）**。即使调用方未做 trim 空检查，该防御早返空数组，后续匹配/枚举全数失败，杜绝“空 target 锚定空文本节点当标题”的假绿机制。与入口门构成双重 fail‑closed。 |

**结论**：原 fail‑open（纯空白 label → norm 成 '' → 空 target 命中空文本 → 伪造 identityReadback ok）的三条路径（回放、编译、nodeDrawerDomain 内部）均在本次 diff 中被切断，不再可复现。

---

## 2. 修复是否引入新 fail‑open / 假绿 / 假阴、是否破坏既有语义
- **误拒合法非空 label**：不会。`label.trim() === ''` 仅拦截纯空白/空串；任何含可见字符的 label（如 `"A"`, `"节点 1"`, `" 带空格 "`）trim 后均非空，正常放行。
- **回放门假阴**：不会。之前合法 label 行为不变；纯空白 label 原本是假绿，现正确转为 `action_failed`（与 select/set 的 `nodeNameInvalid` 口径一致），无退化。
- **编译门假阴**：不会。纯空白 label 原本是假绿（产 events），现正确 fail‑closed（exit 65，零 events），行为更严格，无退化。
- **节点域函数破坏既有语义**：`nodeDrawerDomain` 被多种原子操作引用（openNode、select、setValue 等）。若这些操作传入空 target，原语义可能错误命中空文本节点；空 target 防御返回 `[]` 导致调用方自然失败（无候选、匹配为 0），是安全失败，不产生假绿。且原有的 `nodeNameInvalid` 检查已在 select/set 入口拒空，新防御仅为冗余加固，无冲突。
- **A1/A2 及 r4‑MED 不波及**：A1/A2（nodeNameInvalid 相关）与 r4-MED（norm 两侧归一）的代码路径未在本次 diff 中改动。`nodeDrawerDomain` 新增的空防御仅影响“label trim 后为空→早返”，不影响正常 label 的 norm 匹配与 TOCTOU 防护（同标题替换检测、疑似多用途等逻辑完全保留），已验证的正向 case（G1-G19 全回归绿）可辅证。

**结论**：修复**无**新引入 fail‑open / 假绿 / 假阴，**未破坏**既有语义。

---

### 最终判定：**PASS**
codex r5 采信的 fail‑open 已被彻底堵死，修复谨慎、无副作用，可合入。

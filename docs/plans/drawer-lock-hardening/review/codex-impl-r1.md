# codex 实现评审 r1 —— drawer-lock-hardening（异构冗余，实现方=Claude，评审方=codex）

- 评审者：gpt-5.6-sol @ medium（codex-cli 0.144.1，`codex exec --skip-git-repo-check -s read-only`，评审料经 stdin 喂入）
- 评审料：`docs/plans/drawer-lock-hardening/review/material-impl-r1.md`（spec 要点 + `git diff dev...HEAD` 全量实现 diff【驱动员已逐字节核对】+ gate/tier1 门禁证据；不含实现者推理、不含凭据，护栏 #9）
- 家族：OpenAI GPT ≠ Claude（crossFamily 成立）
- 运行：2026-07-14，exit 0，tokens used 53,822；stderr 有一条到 chatgpt.com 的 MCP transport 报错但非致命（输出完整、末行给出明确总裁决，无需重试）
- 驱动员：Claude（只备料/跑 CLI/归档，不代评审下判断）

## 总裁决

CHANGES-REQUIRED（2 HIGH / 1 MED / 2 LOW）

## 评审输出全文（逐字归档）

HIGH

- `lib/replay-actions.mjs`，`nodeDrawerDomain` 新增 hunk（约 `@@ -120`，`matches.push(w)`）及 `doSelectNodeDropdown` / `doSetNodeField` 中 `const root = domain[0]`；`lib/compile-atoms.mjs` 同名 helper 与两处 `const root = domain[0]`：helper 返回的是动态 `structural.nth(k)` Locator，不是已冻结的候选。Playwright Locator 会在后续操作时重新解析；域计数完成后若另一个同标题抽屉插入或移到它前面，`root` 会漂移到新抽屉，且不会重新执行 `none/ambiguous/unique` 判定，可能在冒牌抽屉落笔后精确回读成功而假绿。可复现：初始仅真抽屉含可见精确标题，`nodeDrawerDomain` 得到唯一候选；在 `wide*Snapshot`、`waitFor` 或实际 click/fill 前动态前插第二个同标题抽屉，且其中有唯一目标字段/触发器。现有 `twinlate` 是域检查前两抽屉已经同时在场，不能覆盖这个检查后的 TOCTOU 窗口。

- `lib/compile-atoms.mjs`，`compileWorkflowOpenNode` hunk（约 `@@ -555`，仅成功路径执行 `run.nodeDrawerLabel = label`）：开始尝试打开新节点时没有先清空旧的 `nodeDrawerLabel`，失败路径也不失效旧值。编译器已由 G9c/G9d 证明会在 openNode blocker 后继续调用后续原子，因此先成功打开 A、再打开 B 失败时，后续 set/select 会继续以 A 的旧标题过域锁并可能实际修改 A，而不是走 run 态缺失 blocker。可复现：打开节点 A 成功；打开节点 B 时点击无响应或点后未出现 B 标题抽屉，A 抽屉仍可见；随后执行 `workflow.setNodeField` 或 `workflow.selectNodeDropdown`。最终即使整体 exit 65、零 events，编译执行阶段仍可能已经对错误抽屉落笔，违反 fail-safe。

MED

- `lib/replay-actions.mjs` 与 `lib/compile-atoms.mjs`，`nodeDrawerDomain` 新增 hunk中的 `w.getByText(label, { exact: true }).first().isVisible()`：只检查第一个精确文本命中，而契约要求候选抽屉“内含自身可见的精确标题文本”，即只要存在至少一个可见命中就应成立。若同一合法抽屉先有一个隐藏的同文案节点、后有真实可见标题，`.first()` 为隐藏节点，整个抽屉被错误排除为 `none`。可复现：一个可见 `.hr-drawer__content-wrapper` 内依次放置 `display:none` 的“模型节点”和可见标题“模型节点”。现有 `twinghost` 只有隐藏命中，没有“隐藏在前、可见在后”的合法边界，无法发现该假阴。

LOW

- `tests/fixtures/fake-sut/server.mjs`，冒牌抽屉 `twinghost` 注释 hunk（`当成домен 命中`）：混入未登记的俄文词 `домен`，属于明显术语/文字污染；应改为注册表已有用语“域”或“候选”。tier1 术语检查通过说明当前 lint 没覆盖这一形态，不能消除该违例。

- `loop/prd-drawer-lock-hardening.json`，新增文件第 4 行 `task`：仍写“拆 20 条独立子用例”和“改前 20/20 败”，但同一 PRD 的 story、实际金牌及评审料均为加入 G7d 后的 21 条。可复现依据是文件内 `task` 与 `stories[0].desc` 自相矛盾，冻结契约没有准确描述当前测试闭包及当前版本 G7d 的红基线。

其余所列重签闭包、缺失/非 string/空白 `nodeName` 直接阻断、既有反面金牌的旧实现翻红能力、凭据外泄检查，料内未见额外问题。

CHANGES-REQUIRED

## 驱动员事实核对（仅核「引用文本是否存在」，不构成对 findings 的采信/驳回）

- LOW#1 文本依据成立：`tests/fixtures/fake-sut/server.mjs:399` 注释确含西里尔字符（驱动员 grep 实证）。
- LOW#2 文本依据成立：`loop/prd-drawer-lock-hardening.json` 内「拆 20 条独立子用例」×1、「20/20 败」×2 与「21 条」×2 并存（驱动员 grep 实证）。
- 双路互证：本文件 MED#1 与 pi（deepseek-v4-pro）独立评审的唯一 MED 指向同一缺陷面（`.first().isVisible()` 隐藏在前/可见在后的误拒边界），跨家族独立收敛。

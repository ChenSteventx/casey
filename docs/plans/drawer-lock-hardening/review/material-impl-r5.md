# drawer-lock-hardening 实现审 r5 料（codex r4 MED 修复复核）

## 背景
被审实现：lib/replay-actions.mjs 与 lib/compile-atoms.mjs（编译门/回放门两门同刻）。commit a2010df（r5），基线 157cb74（r4）。
r4 双路复核：codex=NEEDS CHANGES（A1 PASS + A2 PASS + 1 MED），pi=PASS。A1/A2 两 HIGH 已双路确认真堵死，本轮只审 codex r4 那条 MED 的修复。
裁判零 LLM：bin/verdict.mjs 四态判定树未动、events.schema.json 未动。

## codex r4 MED（原文要点）
位置：lib/replay-actions.mjs 页内标题比较、lib/compile-atoms.mjs 同刻。
问题：新代码 `norm(node.textContent) === lbl` 只归一 DOM 文本却与原始 lbl 直接比较；Playwright `getByText(label,{exact:true})` 会同时归一查询文本与 DOM 文本。差分探针：DOM 标题「Node A」、label「␠␠Node␠␠␠A␠␠」——原实现 getByText(exact).isVisible() 接受、新页内判据排除；nodeNameInvalid() 只 trim 判空、非空白 label 属既有合法输入；回放/编译 setNodeField/selectNodeDropdown 由可操作退化成 none/action_failed 假阴。建议改 `norm(node.textContent) === norm(lbl)` 并补回放/编译两门空白归一正向金牌。

## r5 处置
| 条目 | 处置 | 落点 |
|---|---|---|
| MED 标题两侧归一 | 已修 | 两门 nodeDrawerDomain 页内判据：新增 `const target = norm(lbl);`，逐句柄比 `norm(node.textContent) === target`，lbl 侧同走 norm（trim + 折叠连续空白），对齐 Playwright exact 语义。干净 label 行为零变化（norm 幂等）。|

## 红先行金牌 G19a/b（happy 场景，已落，红证/绿证均实测）
- 画布节点标题「模型节点」（干净），事件 label/nodeName 带前后各两空白「  模型节点  」。
- G19a 回放 openNode+setNodeField：修前红证=openNode resolution action_failed（应 unique，页内 raw 比较把合法抽屉排出域）；修后绿=openNode unique + setNodeField unique + identityReadback ok + verdict PASS。
- G19b 编译 openNode+setNodeField：修前红证=exit 65（openNode 点后域 count=0 blocker + setNodeField run 态标题缺失 blocker 级联）；修后绿=exit 0 + 产 events + 零 blockers + notes「节点字段已填入」。
- 红跑实测（r4 lib 上）：review 部分 14 过/2 败（G19a/b 红，G12-G18 全绿）；修后全量 37 过/0 败（G1-G18 回归全绿）。

## 门禁基线
三 gate GREEN（drawer-lock-hardening / p5-replay / replay-nth-visible-hardening）+ tier1 GREEN + ratchet 70 PRD/191 冻结文件/仅两既有 cases/ FILE_MISSING（环境缺口非问题）。golden 重签（G19 加入）；server.mjs/CONTRACT.md r5 未改故 sha 不变。

## 评审指令
核 codex r4 MED 是否真堵死、norm 两侧归一有无新引入假绿/假阴或破坏既有语义。结论 PASS 或 NEEDS CHANGES，带文件行。

## 修复 diff（lib/replay-actions.mjs + lib/compile-atoms.mjs，157cb74..a2010df）
```diff
diff --git a/lib/compile-atoms.mjs b/lib/compile-atoms.mjs
index 8840473..6ad5ebe 100644
--- a/lib/compile-atoms.mjs
+++ b/lib/compile-atoms.mjs
@@ -166,11 +166,14 @@ async function nodeDrawerDomain(page, label) {
         };
         // wrapper 自身须可见（对齐 Playwright :visible：非空盒 + visibility 未隐藏）
         if (!visible(el)) return false;
-        // 内含【自身也可见】的精确标题文本（存在量词：任一命中可见即成立，堵隐藏同文案在前的合法抽屉误拒）
+        // 内含【自身也可见】的精确标题文本（存在量词：任一命中可见即成立，堵隐藏同文案在前的合法抽屉误拒）。
+        // norm 两侧同归一（codex r4 MED，与回放门同刻）：Playwright getByText(exact) 同时归一查询文本与 DOM
+        // 文本，只归一 DOM 却比原始 lbl 会把带前后/多空白的合法 label 判假阴——lbl 侧同走 norm 才对齐 exact 语义。
         const norm = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
+        const target = norm(lbl);
         const nodes = [el, ...el.querySelectorAll('*')];
         for (const node of nodes) {
-          if (norm(node.textContent) === lbl && visible(node)) return true;
+          if (norm(node.textContent) === target && visible(node)) return true;
         }
         return false;
       }, label);
diff --git a/lib/replay-actions.mjs b/lib/replay-actions.mjs
index 1652aff..9443016 100644
--- a/lib/replay-actions.mjs
+++ b/lib/replay-actions.mjs
@@ -150,10 +150,13 @@ async function nodeDrawerDomain(page, label) {
         if (!visible(el)) return false;
         // 内含【自身也可见】的精确标题文本（存在量词：任一命中可见即成立，堵隐藏同文案在前的合法抽屉
         // 被误拒假阴；只查首命中会在「隐藏同文案在前+可见真标题在后」上把整抽屉排出域）。
+        // norm 两侧同归一（codex r4 MED）：Playwright getByText(exact) 同时归一查询文本与 DOM 文本，
+        // 只归一 DOM 却比原始 lbl 会把带前后/多空白的合法 label 判假阴——lbl 侧同走 norm 才对齐 exact 语义。
         const norm = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
+        const target = norm(lbl);
         const nodes = [el, ...el.querySelectorAll('*')];
         for (const node of nodes) {
-          if (norm(node.textContent) === lbl && visible(node)) return true;
+          if (norm(node.textContent) === target && visible(node)) return true;
         }
         return false;
       }, label);
```

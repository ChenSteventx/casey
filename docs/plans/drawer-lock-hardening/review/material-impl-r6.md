# drawer-lock-hardening 实现审 r6 料（codex r5 fail-open 修复复核）

## 背景
被审实现：lib/replay-actions.mjs 与 lib/compile-atoms.mjs（回放门/编译门两门同刻）。r6 基线 a2010df（r5）。
r5 双路：codex=NEEDS CHANGES（1 fail-open：纯空白 label），pi=PASS（漏报——误判 nodeNameInvalid 已拦 openNode 入口）。A1/A2 两 HIGH 与 r4 MED（norm 两侧归一）已前几轮双路确认。
裁判零 LLM：bin/verdict.mjs 与 events.schema.json 未动。

## codex r5 fail-open（原文要点）
r4 MED 修复引入 norm(lbl)；纯空白 label「   」经 norm 归一成空串 ''。openNode 两入口无 trim 空门：回放 doOpenNode 仅 `if (!label)`（"   " truthy 穿过）、编译 compileWorkflowOpenNode 直接 `String(params.label||'')`。Playwright getByText(exact) 把纯空白查询归一为空串可命中画布空文本 anchor；点后抽屉内可见空 textContent 的 input 使 `norm(input.textContent) === target === ''` 成立、把空控件误当标题——回放可返 unique+identityReadback ok、仅含 openNode 的编译流也可能成功产 events（r4 原比较 `'' === '   '` 恒假不可达，故属新增假绿面）。G19 只测非空标题带空白、未覆盖纯空白。建议 openNode 回放门与编译门统一拒 label.trim()===''、补纯空白 label 反向金牌。

## r6 处置
| 条目 | 处置 | 落点 |
|---|---|---|
| openNode 回放门 trim 空门 | 已修 | doOpenNode：`if (!label || label.trim() === '')` → action_failed（与 select/set 的 nodeNameInvalid 同口径） |
| openNode 编译门 trim 空门 | 已修 | compileWorkflowOpenNode：`if (label.trim() === '')` → blocker「label 缺失或纯空白（trim 后为空，非法标题）」exit 65 |
| nodeDrawerDomain 空 target 防御 | 已修 | 两门 nodeDrawerDomain 首行：`if (String(label==null?'':label).trim()==='') return [];`——空 target 绝不锚定任何抽屉，结构上封死「空 target 命中空文本节点」的机制（防御纵深，调用方另有 trim 空门） |

## 红先行金牌 G20a/b（happy 场景，已落，红证/绿证均实测）
- openNode 的 label 为纯空白「   」。
- G20a 回放：修前红证=openNode resolution **unique** + identityReadback ok（空 target 命中空文本节点，假绿实锤）；修后绿=action_failed + verdict NEEDS_HUMAN。
- G20b 编译：修前红证=**exit 0**（成功产 events，假绿）；修后绿=blocker exit 65 + 零 events + blocker 点名 openNode label 空白。
- 红跑实测（r5 lib 上）：review 部分 16 过/2 败（G20a/b 红，其余全绿）；修后全量 39 过/0 败（G1-G19 回归全绿）。

## 门禁基线
三 gate GREEN（drawer-lock-hardening / p5-replay / replay-nth-visible-hardening）+ tier1 GREEN + ratchet 70 PRD/191 冻结文件/仅两既有 cases/ FILE_MISSING（环境缺口非问题）。golden 重签（G20 加入）；server.mjs/CONTRACT.md r6 未改故 sha 不变。

## 评审指令
核 codex r5 fail-open 是否真堵死、trim 空门 + 空 target 防御有无新引入假绿/假阴或破坏既有语义（尤其：会否误拒合法非空 label、会否影响 A1/A2/r4-MED 已修面）。结论 PASS 或 NEEDS CHANGES，带文件行。

## 修复 diff（lib/replay-actions.mjs + lib/compile-atoms.mjs，a2010df..工作树）
```diff
diff --git a/lib/compile-atoms.mjs b/lib/compile-atoms.mjs
index 6ad5ebe..aa2c85b 100644
--- a/lib/compile-atoms.mjs
+++ b/lib/compile-atoms.mjs
@@ -150,6 +150,9 @@ async function dragConnectByLabels(page, fromLabel, toLabel) {
 // 快照之后任何同标题替换 → 句柄脱附 → 后续核验/盖章抛错落 fail-closed，构造上封死「检查过的节点 ≠
 // 锚定的节点」。返回物理句柄数组，调用方用完 disposeDomain 释放；未通过标题核验的候选当场释放不外泄。
 async function nodeDrawerDomain(page, label) {
+  // 空 target 防御（codex r5 fail-open，与回放门同刻）：label trim 后为空时，页内判据 norm(lbl)='' 会命中
+  // 任何空文本节点当标题——空 target 绝不能锚定任何抽屉，早返空数组封死此假绿面（调用方另有 trim 空门）。
+  if (String(label == null ? '' : label).trim() === '') return [];
   const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
   const handles = await structural.elementHandles().catch(() => []);
   const matches = [];
@@ -677,6 +680,13 @@ async function compileWorkflowOpenNode(run, params) {
   // A 抽屉真落笔——即使整体 exit 65 零 events，编译执行期已对错误抽屉产生副作用（违 fail-safe）。
   // 故进本函数即清空，仅下方「点后恰一」确证成功才写回（G13 钉此语义）。
   run.nodeDrawerLabel = null;
+  // trim 空门（codex r5 fail-open，与回放门 doOpenNode 同刻）：纯空白 label 经 nodeDrawerDomain 的 norm
+  // 归一成空串会借空 target 命中画布/抽屉空文本节点假绿——trim 空即非法标题，硬阻断 fail-closed。
+  if (label.trim() === '') {
+    run.blockers.push(`workflow.openNode label 缺失或纯空白（trim 后为空，非法标题）→ 硬阻断 fail-closed 不点（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
   // 预检域锁身份门（emit 的 customAct 通路不走定位核验，此处自证——镜像 addNode 源身份门）：
   const domain = run.page.locator('.lf-canvas-overlay').getByText(label, { exact: true });
   const n = await domain.count().catch(() => null);
diff --git a/lib/replay-actions.mjs b/lib/replay-actions.mjs
index 9443016..ce9d8e9 100644
--- a/lib/replay-actions.mjs
+++ b/lib/replay-actions.mjs
@@ -132,6 +132,9 @@ async function doConnectNodes(page, ev) {
 // 堵初次域扫描后到盖章前同标题抽屉原位替换的 TOCTOU 残留）。返回物理句柄数组，调用方用完 disposeDomain
 // 释放；未通过标题核验的候选当场释放不外泄。可见性判据对齐 Playwright :visible（非空盒 + visibility 未隐藏）。
 async function nodeDrawerDomain(page, label) {
+  // 空 target 防御（codex r5 fail-open）：label trim 后为空时，页内判据 norm(lbl)='' 会命中任何空文本节点
+  // （空 input/anchor）当标题——空 target 绝不能锚定任何抽屉，早返空数组封死此假绿面（调用方另有 trim 空门）。
+  if (String(label == null ? '' : label).trim() === '') return [];
   const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
   const handles = await structural.elementHandles().catch(() => []);
   const matches = [];
@@ -279,7 +282,9 @@ async function wideTriggerSnapshot(page) {
 // 归因于本次单击（证不出）→ 绝不背书；点后恰一——回读要求域内恰 1（0 或 >1 同样证不出归因）。
 async function doOpenNode(page, ev) {
   const label = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
-  if (!label) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 语义证不出，不猜
+  // trim 空门（codex r5 fail-open）：纯空白 label 经 nodeDrawerDomain 的 norm 归一成空串，会借空 target
+  // 命中画布/抽屉空文本节点假绿——openNode 与 select/set 的 nodeNameInvalid 同口径，trim 空即非法标题拒动。
+  if (!label || label.trim() === '') return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 语义证不出/纯空白非法，不猜
   const domain = page.locator('.lf-canvas-overlay').getByText(label, { exact: true });
   // 缺席守卫：waitFor 抛不得穿出——节点缺席 → none 单步降级，非崩整轮回放（nodeBoxByLabel 守卫先例）。
   try { await domain.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
```

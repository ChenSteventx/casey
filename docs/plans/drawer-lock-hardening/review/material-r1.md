# 评审料 r1 —— drawer-lock-hardening（画布三原子域锁跨抽屉边界硬化，light）

> 本文件是异构评审的输入料（护栏 #9：只含 spec + diff + 门禁证据，不含凭据、不含实现者内心推理）。
> 评审指令另发，不含在本文件内。

## 一、契约背景（一句话）

挂账：codex-sol 异构冗余评审 MED#2（2026-07-10，`loop/prd-wf-set-node-field.json` observability 第二条）
——`doSetNodeField`（`lib/replay-actions.mjs`）/`compileWorkflowSetNodeField`（`lib/compile-atoms.mjs`）的域锁
用宽 `.hr-drawer__content-wrapper`，匹配所有抽屉而非当前节点配置抽屉；若另一可见抽屉恰有唯一同
placeholder 字段，域内 `count===1` 会填错抽屉的字段、精确回读仍成立 → 假绿。`openNode`/`selectNodeDropdown`/
`setNodeField` 三原子同型设计局限。本契约把三原子的编译门与回放门同刻收窄到「当前节点抽屉专属锚」。

不做：`workflow.assertNodeFieldValue`（另契约）；不碰 `bin/verdict.mjs`（裁判零 LLM，裁定语义零改动）；
不碰 `events.schema.json`（零改动）；不驱真机（纯 hermetic：fake-sut + chromium）。

## 二、关键设计决策（GRILL D1–D8，精简，全文见 `docs/plans/drawer-lock-hardening/proposed/GRILL.md`）

- 决策 D1（方向定案）：三原子一起收窄、红先行、fail-safe 不 fail-open、hermetic 全程。
- 决策 D2（锚点取舍）：拒 `.lf-node-drawer` 类锚（真机未采样、夹具自造属倒裁）；取「可见的
  `.hr-drawer__content-wrapper` 且内含【自身也可见】的当前节点标题（精确文本）」标题锚——复用 openNode
  已冻双证回读锚下沉为三原子共用域锁。评审修订加「标题文本自身可见」内层限定：`filter({has})` 只证
  「后代存在该文本」不证该文本自身可见，故逐候选二次核验 `:visible`（堵 wrapper 可见但标题
  display:none 隐藏的假命中）。
- 决策 D3（`nodeName` 供给通道）：编译期 `run.nodeDrawerLabel`（`compileWorkflowOpenNode` 成功后写入，后开覆盖
  先开，纳入 `createCompileRun` 的 `mark()`/`rollback()` 快照）+ 回放期事件既有冻结字段 `nodeName`（零
  schema 改动）。
- 决策 D4（事件缺 `nodeName` 一律 fail-closed，绝不回落宽域锁）：判据 = 字段缺席 / 非 `string` / `trim()` 后为空
  三者任一 → 硬阻断 `action_failed`（编译侧同判 blocker）。
- 决策 D5（`openNode` 侧收窄）：预点基线归因守卫（单击前先数「可见且含精确标题」的抽屉，`count>0` 即证不出
  点后归因，绝不背书）+ 点后域内恰一（`0` 或 `>1` 同样证不出归因）。
- 决策 D6（抽屉域三态分层）：select/set 两门先过标题锚域三态——`count===0`→`none`/blocker、`count>1`→
  `ambiguous`/blocker（回放侧带 `candidateCount`）、`count===1`→以该抽屉为根，字段级/触发器级既有闸
  一字不动。
- 决策 D7（夹具反面场景，纯加法，复现挂账接缝，不倒裁）：`twinfield`（冒牌抽屉挂同 placeholder 字段+触发器，
  真抽屉 ddempty 形态）/ `twinboth`（真假抽屉各挂一份，钉「域内唯一才动手」正面半边）/ `twintitle`（单击不
  开抽屉+冒牌预挂含精确标题，钉 openNode 归因假绿）/ `twinlate`（评审新增：单击开真抽屉、同刻动态挂出
  含标题冒牌，钉「点击后才出现的冒牌」）/ `twinghost`（评审新增：冒牌含精确标题但该文本 display:none
  隐藏，钉「隐藏文本命中」假绿）。
- 决策 D8（金牌形态）：新金牌集中 `tests/_golden/drawer-lock-hardening.golden.mjs`（G1–G11，拆 21 条独立子用例）；
  既有三金牌（`wf-set-node-field`/`wf-select-node-dropdown`/`replay-nth-visible-hardening`）只做 D3/D4
  强制的最小改——手编 events 补 `nodeName`。

设计评审修订（codex-sol@max，2026-07-14，先于本轮实现评审，处置见 `docs/plans/drawer-lock-hardening/review/planreview-*`）：
采信 6 条设计 findings 并入——①标题锚加「标题文本自身可见」内层限定（D2）；②`nodeName` 缺失判据扩到空串/
纯空白（D4）；③金牌矩阵补 G8–G11 + 拆分 G3/G7 为独立子用例；④断言升级为精确 `NEEDS_HUMAN` 路由 + 宽域候选
零落笔取证；⑤新 prd 冻结闭包补 fake-sut 双文件；⑥run 态节点标题字段纳入 mark()/rollback() 快照。唯一部分
驳回：「标题须在标题元素内」子项——结构/类锚已被 D2 以实证拒绝，残余假设面见风险 1。

loop 内 codex-sol@medium L2 测试质量咨询（非裁判，实现完成后、本轮异构评审之前的另一轮）：指出 G9a/G9b
宽域候选快照断言漏 length 钉位（空数组对 `.some()` 恒假通过）+ G7 缺「非 string」nodeName 分支覆盖，均已
采信修复（补 length 钉位 + 新增 G7d，20→21 条子用例）；另指出编译侧 domain>1/隐藏标题分支目前只经 openNode
级联间接触达（未被「不经 openNode 直接命中」的用例直接覆盖），记为已知残余覆盖缺口、留档待下一轮决策，未
在本轮补齐（超出本契约已批准范围）。

## 三、反面场景清单（红先行总表，GRILL 原表）

| # | 场景 | 旧行为（红证） | 新行为（验收） |
|---|---|---|---|
| 1 | `twinfield` 回放 setNodeField | 宽域锁 count=1 填冒牌抽屉字段、回读成立 → `unique`+`PASS` 假绿 | 标题锚域内字段 count=0 → `none`、verdict 不 `PASS` |
| 2 | `twinfield` 回放 selectNodeDropdown | 宽域锁 count=1 点冒牌触发器、选中回读成立 → `unique`+`PASS` 假绿 | 标题锚域内触发器 count=0 → `none`、verdict 不 `PASS` |
| 3 | `twinfield` 编译 setNodeField / selectNodeDropdown | 预检命中冒牌抽屉 → exit 0 产 events（编译期假绿） | 预检域内 count=0 → blocker exit 65 零 events |
| 4 | `twinboth` 回放 setNodeField | 宽域锁 count=2 → `ambiguous`（干不了活） | 标题锚锁进节点抽屉 count=1 → `unique` 真填对 + `PASS` |
| 5 | `twintitle` 回放 openNode | 回读命中冒牌抽屉 → `unique` 假绿 | 预点基线 count>0 证不出归因 → `action_failed`、不 `PASS` |
| 6 | `twintitle` 编译 openNode | emit 等到冒牌抽屉可见 + 后置核验过 → exit 0 假绿 | 预点基线 blocker exit 65 零 events |
| 7 | happy 回放 select/set 事件缺 `nodeName`（缺席/空串/纯空白/非 string 四态） | 宽域锁照常 `unique`+`PASS` | 硬阻断 `action_failed`、恰 `NEEDS_HUMAN`（D4 钉桩） |
| 8 | `twinlate` 回放+编译 openNode（点后冒牌） | 回读 first 可见即过 → `unique` 假绿 / 编译 exit 0 | 点后域内 count=2 → `action_failed`/blocker、恰 `NEEDS_HUMAN` |
| 9 | `twinlate` 回放 set/select（两含标题抽屉在场） | 宽域锁 count=1 命中冒牌 → `unique`+`PASS` 假绿 | 域级 count=2 → `ambiguous`+`candidateCount 2`、零落笔、恰 `NEEDS_HUMAN` |
| 10 | `twinghost` 回放 openNode/set（隐藏标题文本） | `filter({has})` 命中隐藏文本 → `unique` 假绿 | 标题文本不可见不算命中 → `action_failed`/`none`、恰 `NEEDS_HUMAN` |
| 11 | `twinboth` 回放 selectNodeDropdown（正面半边） | 宽域 nth=0 误点冒牌触发器（同为 `unique`+`PASS`，红在取证断言） | 锁进真抽屉触发器选对 → `unique`+`PASS`+冒牌零落笔取证 |

## 四、touchesFiles 全量 diff（`git diff dev...HEAD`，按文件分组，一字不省略）


### 4.1 `lib/replay-actions.mjs`（回放门：doOpenNode / doSelectNodeDropdown / doSetNodeField + 标题锚 helper）

```diff
diff --git a/lib/replay-actions.mjs b/lib/replay-actions.mjs
index 437c8ce..50efb3c 100644
--- a/lib/replay-actions.mjs
+++ b/lib/replay-actions.mjs
@@ -120,10 +120,53 @@ async function doConnectNodes(page, ev) {
   return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
 }
 
-// openNode 专用同刻门（wf-open-node GRILL D4/D5）：节点标题同时活在面板 .node-item 与画布
-// .lf-node-content——全页统一身份门必撞多匹配（吐 ambiguous 卡死合法回放，wf-add-node R1-F2 同型缝），
-// 域锁 .lf-canvas-overlay 与编译门（compileWorkflowOpenNode 预检）同一扇门。域内唯一才点
-// （多匹配 ambiguous 绝不点、缺席回 none）；身份回读 = 抽屉可见 + 含节点标题双证（防「点了没开」假 unique）。
+// 当前节点抽屉专属锚（drawer-lock-hardening GRILL D2，评审修订同刻）：可见 .hr-drawer__content-wrapper
+// 且内含【自身也可见】的精确标题文本——filter({has}) 只证「后代存在该文本」、不证该文本节点自身可见
+// （wrapper 可见但标题 display:none 隐藏也会被 filter 命中，评审 F1/D2 修订：堵「wrapper 可见但标题藏在
+// 隐藏节点」的假命中），故逐候选二次核验标题文本自身 :visible。openNode/selectNodeDropdown/setNodeField
+// 三原子共用此域锁（编译门 lib/compile-atoms.mjs 有同算法的独立一份实现，两门同刻；既有代码
+// semanticLocator/canvasBox 等同类重复的先例）。
+async function nodeDrawerDomain(page, label) {
+  const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
+  const n = await structural.count().catch(() => 0);
+  const matches = [];
+  for (let k = 0; k < n; k++) {
+    const w = structural.nth(k);
+    const visible = await w.getByText(label, { exact: true }).first().isVisible().catch(() => false);
+    if (visible) matches.push(w);
+  }
+  return matches;
+}
+// D4 修订（drawer-lock-hardening）：nodeName 缺席判据 = 字段缺席 / 非 string / trim() 后为空 三者任一
+// → 硬阻断，绝不回落宽域锁（events.schema 只约束 string 类型合法，空串/纯空白类型合法但语义非法）。
+function nodeNameInvalid(nodeName) {
+  return typeof nodeName !== 'string' || nodeName.trim() === '';
+}
+// 宽域（不分标题）证据快照：全部可见 .hr-drawer__content-wrapper 内同占位符字段 value（DOM 序）。
+// 纯加法证据字段（axes 无冻结 schema 约束，先例 setmulti candidateValues），供金牌钉住「零落笔/唯一
+// 落笔」——不参与域锁判定本身，判定只认 nodeDrawerDomain 的标题锚域。
+async function wideFieldSnapshot(page, placeholder, exact) {
+  const wide = page.locator('.hr-drawer__content-wrapper:visible').getByPlaceholder(placeholder, { exact });
+  const n = await wide.count().catch(() => 0);
+  const values = [];
+  for (let k = 0; k < n; k++) { try { values.push(await wide.nth(k).inputValue({ timeout: 1000 })); } catch { values.push(null); } }
+  return values;
+}
+// 宽域（不分标题）触发器显示值快照（DOM 序）。同上，纯加法证据字段。
+async function wideTriggerSnapshot(page) {
+  const wide = page.locator('.hr-drawer__content-wrapper:visible .hr-select:visible');
+  const n = await wide.count().catch(() => 0);
+  const values = [];
+  for (let k = 0; k < n; k++) { try { values.push((await wide.nth(k).innerText({ timeout: 1000 })).trim()); } catch { values.push(null); } }
+  return values;
+}
+
+// openNode 专用同刻门（wf-open-node GRILL D4/D5 + drawer-lock-hardening GRILL D2/D5）：节点标题同时活在
+// 面板 .node-item 与画布 .lf-node-content——全页统一身份门必撞多匹配（吐 ambiguous 卡死合法回放，
+// wf-add-node R1-F2 同型缝），域锁 .lf-canvas-overlay 与编译门（compileWorkflowOpenNode 预检）同一扇门。
+// 域内唯一才点（多匹配 ambiguous 绝不点、缺席回 none）；身份回读改为标题锚域三态（drawer-lock-hardening
+// D5）：预点基线——单击前先数「可见且含精确、且标题文本自身可见」的抽屉，count>0 即无法把点后的抽屉
+// 归因于本次单击（证不出）→ 绝不背书；点后恰一——回读要求域内恰 1（0 或 >1 同样证不出归因）。
 async function doOpenNode(page, ev) {
   const label = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
   if (!label) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 语义证不出，不猜
@@ -135,30 +178,42 @@ async function doOpenNode(page, ev) {
   if (n > 1) return { resolution: 'ambiguous', candidateCount: n, identityReadback: { ok: false } }; // 多匹配绝不点
   const box = await nodeBoxByLabel(page, label); // 域内恰 1，.first() 即唯一者（复用、不造第三份孪生体）
   if (!box) return { resolution: 'none', candidateCount: 1, identityReadback: { ok: false } };
+  // D5 预点基线归因守卫：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
+  // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
+  const baseline = await nodeDrawerDomain(page, label);
+  if (baseline.length > 0) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
   try {
     await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」（GRILL D1 单击定案）
   } catch {
     return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
   }
-  try {
-    // 身份回读须【精确】含 label 元素，非子串 hasText（评审 F1）：子串会把标题「label副本」等含子串的开错抽屉
-    // 误判「开对了这个节点」——精确回读堵「点了没开 / 开错抽屉」两向假绿（护栏 #14）。
-    await page.locator('.hr-drawer__content-wrapper').filter({ has: page.getByText(label, { exact: true }) }).first().waitFor({ state: 'visible', timeout: 5000 });
-  } catch {
-    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没开 / 开错抽屉，不假 unique
+  // 点后等待：轮询域内计数直到 ≥1 或超时（需要的是计数、不止存在性，故不用单点 waitFor）。
+  const t0 = Date.now();
+  for (;;) {
+    const cur = await nodeDrawerDomain(page, label);
+    if (cur.length >= 1 || Date.now() - t0 > 5000) break;
+    await new Promise((r) => setTimeout(r, 100));
   }
+  // D5 点后恰一：回读要求域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏文本已被 nodeDrawerDomain
+  // 的精确+可见双限定堵死，评审 F1/D2）。
+  const after = await nodeDrawerDomain(page, label);
+  if (after.length !== 1) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没开 / 开错抽屉 / 点后歧义，不假 unique
   return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
 }
 
-// selectNodeDropdown 专用同刻门（wf-select-node-dropdown GRILL D4/D5）：节点抽屉「请选择」触发器
-// 非 role=combobox-带名——通用 doSelect 的全页 getByRole('combobox',{name}) 门必兜空/撞既有分类下拉
-// （wf-add-node R1-F2 同型缝），故按 ev.atom 分发到本专用门。域锁 .hr-drawer__content-wrapper 内第 nth
-// 个【可见】.hr-select:visible 触发器（nth 是合法确定性位置消歧，路 A；非法 nth（在场但非非负整数）→ action_failed
-// 硬阻断绝不降级 index 0，fix#1；缺席/越界 → none 单步降级，不崩整轮回放，doOpenNode 缺席守卫先例）→ 点触发器
-// → 限【可见浮层】.hr-select-option 作用域（防浮层 teleport 到 body
+// selectNodeDropdown 专用同刻门（wf-select-node-dropdown GRILL D4/D5 + drawer-lock-hardening GRILL
+// D2/D4/D6）：节点抽屉「请选择」触发器非 role=combobox-带名——通用 doSelect 的全页
+// getByRole('combobox',{name}) 门必兜空/撞既有分类下拉（wf-add-node R1-F2 同型缝），故按 ev.atom 分发到
+// 本专用门。先过标题锚域三态（drawer-lock-hardening D6）：nodeName 缺席/非 string/trim 空 → 硬阻断
+// action_failed，绝不回落宽域锁（D4 修订）；域内 count===0 → none；count>1 → ambiguous（证不出归属，
+// 绝不动手，回放侧带 candidateCount）；count===1 → 以该抽屉为根，字段级/触发器级既有闸一字不动——域内
+// 第 nth 个【可见】.hr-select:visible 触发器（nth 是合法确定性位置消歧，路 A；非法 nth（在场但非非负
+// 整数）→ action_failed 硬阻断绝不降级 index 0，fix#1；缺席/越界 → none 单步降级，不崩整轮回放，
+// doOpenNode 缺席守卫先例）→ 点触发器 → 限【可见浮层】.hr-select-option 作用域（防浮层 teleport 到 body
 // 全局 text 撞列表页/孪生浮层）内目标选项唯一才点（多匹配 ambiguous 绝不点、缺席 action_failed）→
 // 身份回读：重读第 nth 触发器显示值不再是「请选择」且【精确】含 option（filter has getByText exact 非
 // 子串——openNode F1 教训下拉版：子串会把「选错项/写错值」误判选对）→ 成立 = unique；证不出 = action_failed。
+// 每个分支返回前都附宽域（不分标题）触发器显示值快照 wideTriggerValues（纯加法证据，D6 评审修订）。
 async function doSelectNodeDropdown(page, ev) {
   // nth 校验（fix#1）：缺省（undefined）→ 合法默认 0；在场但非「非负整数」→ 硬阻断 fail-closed 落 action_failed
   // （不点、绝不降级 index 0 猜首项——静默取 0 会替用户点错第一格还回 unique 假绿，违「fail-safe 不 fail-open」+
@@ -168,54 +223,67 @@ async function doSelectNodeDropdown(page, ev) {
   }
   const nth = ev.nth === undefined ? 0 : ev.nth;
   const option = typeof ev.text === 'string' && ev.text ? ev.text : null;
+  // D4 修订：nodeName 缺席/非 string/trim 空 → 硬阻断，绝不回落宽域锁（此分支证不出「哪个节点」，
+  // 连宽域快照都不取——尚不知该找哪个占位符/触发器族之外的东西可证）。
+  if (nodeNameInvalid(ev.nodeName)) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
+  const label = ev.nodeName;
+  const domain = await nodeDrawerDomain(page, label);
+  const wideTriggerValues = await wideTriggerSnapshot(page);
+  if (domain.length === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues };
+  if (domain.length > 1) return { resolution: 'ambiguous', candidateCount: domain.length, identityReadback: { ok: false }, wideTriggerValues };
+  const root = domain[0];
   // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 未清理的
   // .hr-select 触发器进入计数/nth 定位（否则 nth 误命中隐藏触发器点不动/错位）；对全可见触发器场景恒等无行为差。
-  const triggers = page.locator('.hr-drawer__content-wrapper .hr-select:visible');
+  const triggers = root.locator('.hr-select:visible');
   // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无触发器 → none 单步降级（doOpenNode 守卫先例）。
   try { await triggers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
   const tcount = await triggers.count().catch(() => 0);
-  if (tcount === 0 || nth >= tcount) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false } };
+  if (tcount === 0 || nth >= tcount) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues };
   try {
     await triggers.nth(nth).click({ timeout: 3000 });
   } catch {
-    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
+    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
   }
   // 可见浮层作用域（防 teleport 到 body 撞列表页/孪生浮层）：限可见 .hr-select-option。
   const visibleOptions = page.locator('.hr-select-option:visible');
   try { await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 缺席由下方 count 落轴 */ }
   const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
   const oc = await target.count().catch(() => 0);
-  if (oc === 0) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 目标缺席
+  if (oc === 0) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) }; // 目标缺席
   // 多匹配 / 缺 option 多选项一律绝不点（codex HIGH fail-safe）：option 缺失/未指定时若可见浮层有多个选项，
   // 点「首个可见选项」还返 unique = 假绿（fail-open 成 PASS，违铁律「fail-safe 不 fail-open」+ 点击身份门
   // ADR-0007——没给 option 却替用户猜首项）。故不再带 `option &&` 门：oc>1 一律 ambiguous 绝不点、绝不返 unique
   // （本分支裁判 ap=false 兜底落 NEEDS_HUMAN 仍 fail-safe；resolution 契约合并后升级为精确 AMBIGUOUS_ACTION）。
   // 仅 ①option 指定且域内唯一命中，或 ②浮层恰一项（缺 option 亦然），才走下方 oc===1 通路点选。
-  if (oc > 1) return { resolution: 'ambiguous', candidateCount: oc, identityReadback: { ok: false } };
+  if (oc > 1) return { resolution: 'ambiguous', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
   try {
     await target.first().click({ timeout: 3000 });
   } catch {
-    return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false } };
+    return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
   }
   // 身份回读（点后）：重读第 nth 触发器显示值——不再「请选择」且（给 option 则）精确含 option。
   let val = null;
   try { val = (await triggers.nth(nth).innerText({ timeout: 2000 })).trim(); } catch { val = null; }
-  if (!val || val === '请选择') return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false } };
+  if (!val || val === '请选择') return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
   if (option) {
     const exactHit = await triggers.nth(nth).filter({ has: page.getByText(option, { exact: true }) }).count().catch(() => 0);
-    if (exactHit !== 1) return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false } }; // 选错项/写错值精确回读拒认
+    if (exactHit !== 1) return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) }; // 选错项/写错值精确回读拒认
   }
-  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
+  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true }, wideTriggerValues: await wideTriggerSnapshot(page) };
 }
 
-// setNodeField 专用同刻门（wf-set-node-field GRILL D4/D5）：节点抽屉可填字段按 placeholder 锚——占位符锚
-// 不是 semanticLocator 的 label/text/role 命中口径，通用 doAct 的全页门必兜空或撞别处同名（全页 getByPlaceholder
-// 会撞「新增工作流」抽屉的 请输入工作流名称 → ambiguous 卡死），故按 ev.atom 分发到本专用门。域锁
-// .hr-drawer__content-wrapper 内 getByPlaceholder(placeholder,{exact}) + 字段级唯一闸（未给 nth：count===1
-// 才填、count>1 ambiguous 绝不填首项；显式给 nth：nth<count 才填、越界 none；count===0 缺席 none 单步降级，
-// 缺席守卫 waitFor 抛不得穿出——doOpenNode/doSelectNodeDropdown 缺席守卫先例）→ target.fill → 身份回读（填后
-// inputValue() 精确等于实例化后填入值，非 includes 子串——F1 教训子串会把填错值/半填误判填对）→ 成立 = unique
-// + identityReadback ok:true；证不出 = action_failed + ok:false（防「点了没填 / 填错值」两向假绿，护栏 #14）。
+// setNodeField 专用同刻门（wf-set-node-field GRILL D4/D5 + drawer-lock-hardening GRILL D2/D4/D6）：
+// 节点抽屉可填字段按 placeholder 锚——占位符锚不是 semanticLocator 的 label/text/role 命中口径，通用
+// doAct 的全页门必兜空或撞别处同名（全页 getByPlaceholder 会撞「新增工作流」抽屉的 请输入工作流名称
+// → ambiguous 卡死），故按 ev.atom 分发到本专用门。先过标题锚域三态（drawer-lock-hardening D6）：
+// nodeName 缺席/非 string/trim 空 → 硬阻断 action_failed，绝不回落宽域锁（D4 修订）；域内 count===0 →
+// none；count>1 → ambiguous（证不出归属，绝不填，回放侧带 candidateCount）；count===1 → 以该抽屉为根，
+// 字段级唯一闸一字不动（未给 nth：count===1 才填、count>1 ambiguous 绝不填首项；显式给 nth：nth<count
+// 才填、越界 none；count===0 缺席 none 单步降级，缺席守卫 waitFor 抛不得穿出——doOpenNode/
+// doSelectNodeDropdown 缺席守卫先例）→ target.fill → 身份回读（填后 inputValue() 精确等于实例化后填入值，
+// 非 includes 子串——F1 教训子串会把填错值/半填误判填对）→ 成立 = unique + identityReadback ok:true；
+// 证不出 = action_failed + ok:false（防「点了没填 / 填错值」两向假绿，护栏 #14）。每个分支返回前都附
+// 宽域（不分标题）字段 value 快照 wideCandidateValues（纯加法证据，D6 评审修订）。
 async function doSetNodeField(page, ev, ctx) {
   const s = ev.semantic;
   const placeholder = s && s.kind === 'label' && s.name ? s.name : null;
@@ -229,31 +297,40 @@ async function doSetNodeField(page, ev, ctx) {
   }
   const hasNth = ev.nth !== undefined;
   const nth = hasNth ? ev.nth : 0;
-  const fields = page.locator('.hr-drawer__content-wrapper').getByPlaceholder(placeholder, { exact });
+  // D4 修订：nodeName 缺席/非 string/trim 空 → 硬阻断，绝不回落宽域锁（此分支证不出「哪个节点」，
+  // 连宽域快照都不取）。
+  if (nodeNameInvalid(ev.nodeName)) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
+  const label = ev.nodeName;
+  const domain = await nodeDrawerDomain(page, label);
+  const wideCandidateValues = await wideFieldSnapshot(page, placeholder, exact);
+  if (domain.length === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues };
+  if (domain.length > 1) return { resolution: 'ambiguous', candidateCount: domain.length, identityReadback: { ok: false }, wideCandidateValues };
+  const root = domain[0];
+  const fields = root.getByPlaceholder(placeholder, { exact });
   // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无字段 → 由下方 count 落 none 单步降级（doOpenNode/doSelectNodeDropdown 守卫先例）。
   try { await fields.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
   const fcount = await fields.count().catch(() => 0);
-  if (fcount === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false } };
+  if (fcount === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues };
   if (!hasNth && fcount > 1) {
     // 多匹配未给 nth 绝不填首项。取证：快照全部候选字段 value 佐证「一格未填」（golden C3e 钉「字段值不变」
     //   非空话——candidateValues 全空 = 证明 ambiguous 分支绝没落笔到任何字段）。
     const candidateValues = [];
     for (let k = 0; k < fcount; k++) { try { candidateValues.push(await fields.nth(k).inputValue({ timeout: 1000 })); } catch { candidateValues.push(null); } }
-    return { resolution: 'ambiguous', candidateCount: fcount, identityReadback: { ok: false }, candidateValues };
+    return { resolution: 'ambiguous', candidateCount: fcount, identityReadback: { ok: false }, candidateValues, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
   }
-  if (hasNth && nth >= fcount) return { resolution: 'none', candidateCount: fcount, identityReadback: { ok: false } }; // 越界
+  if (hasNth && nth >= fcount) return { resolution: 'none', candidateCount: fcount, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) }; // 越界
   const target = fields.nth(hasNth ? nth : 0);
   const want = instantiate(ev.value, ctx);
   try {
     await target.fill(want, { timeout: 3000 });
   } catch {
-    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
+    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
   }
   // 身份回读（填后）：重读目标字段 inputValue() 精确等于填入值（非 includes——F1 教训子串会把填错值误判填对）。
   let got = null;
   try { got = await target.inputValue({ timeout: 2000 }); } catch { got = null; }
-  if (got !== want) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没填 / 填错值，不假 unique
-  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
+  if (got !== want) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) }; // 点了没填 / 填错值，不假 unique
+  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
 }
 
 // dragTo 专用同刻门（wf-add-node GRILL D3 + codex R1-F1/F2）：
```

### 4.2 `lib/compile-atoms.mjs`（编译门：compileWorkflowOpenNode / SelectNodeDropdown / SetNodeField + run 态 + emit nodeName）

```diff
diff --git a/lib/compile-atoms.mjs b/lib/compile-atoms.mjs
index 123700f..fe53539 100644
--- a/lib/compile-atoms.mjs
+++ b/lib/compile-atoms.mjs
@@ -141,6 +141,26 @@ async function dragConnectByLabels(page, fromLabel, toLabel) {
   await page.waitForTimeout(500);
 }
 
+// 当前节点抽屉专属锚（drawer-lock-hardening GRILL D2，与 lib/replay-actions.mjs 的 nodeDrawerDomain
+// 同算法，两门同刻，各自持有 page 引用故各自一份实现——既有代码 locatorFor/canvasBox 等同类重复的
+// 先例）：可见 .hr-drawer__content-wrapper 且内含【自身也可见】的精确标题文本——filter({has}) 只证
+// 「后代存在该文本」、不证该文本节点自身可见，故逐候选二次核验标题文本自身 :visible（评审 F1/D2 修订）。
+async function nodeDrawerDomain(page, label) {
+  const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
+  const n = await structural.count().catch(() => 0);
+  const matches = [];
+  for (let k = 0; k < n; k++) {
+    const w = structural.nth(k);
+    const visible = await w.getByText(label, { exact: true }).first().isVisible().catch(() => false);
+    if (visible) matches.push(w);
+  }
+  return matches;
+}
+// D3/D4 修订（drawer-lock-hardening）：run 态当前节点抽屉标题缺失/非 string/trim 后为空 → 硬阻断。
+function nodeDrawerLabelInvalid(label) {
+  return typeof label !== 'string' || label.trim() === '';
+}
+
 export function summarizeDeleteCountAudit({
   tableRows = null,
   targetCards = null,
@@ -188,15 +208,16 @@ export function createCompileRun({ page, forensics, state, sut, uniqueName, site
     countAudit: null,
     blockers: [], // 证不出的硬阻断（计数口径不恒等等）：executeMode 据此 fail-closed、不产成功产物
     stepN: 0, intentN: 0, lastIntentId: null,
+    nodeDrawerLabel: null, // drawer-lock-hardening D3：编译期 run 态当前节点抽屉标题（compileWorkflowOpenNode 成功后写入，SelectNodeDropdown/SetNodeField 读它作标题锚域锁）
 
     newIntent() { return `intent_${this.intentN++}`; },
 
     mark() {
-      return { events: this.events.length, observed: this.observed.length, verification: this.verification.length, stepN: this.stepN, intentN: this.intentN, lastIntentId: this.lastIntentId };
+      return { events: this.events.length, observed: this.observed.length, verification: this.verification.length, stepN: this.stepN, intentN: this.intentN, lastIntentId: this.lastIntentId, nodeDrawerLabel: this.nodeDrawerLabel };
     },
     rollback(m) {
       this.events.length = m.events; this.observed.length = m.observed; this.verification.length = m.verification;
-      this.stepN = m.stepN; this.intentN = m.intentN; this.lastIntentId = m.lastIntentId;
+      this.stepN = m.stepN; this.intentN = m.intentN; this.lastIntentId = m.lastIntentId; this.nodeDrawerLabel = m.nodeDrawerLabel;
     },
 
     // 静默点（确定性条件，替代固定睡眠，ADR-0003）：DOM 连续两拍稳定；networkidle 对带背景轮询的 SPA 永不达成、不作判据。
@@ -533,11 +554,14 @@ async function compileWorkflowConnectNodes(run, params) {
 }
 
 // workflow.openNode（画布节点配置抽屉原子；GRILL D1 单击节点中心定案——registry 真机 SOP 为准、
-// HANDOFF「双击」查无实证按笔误处理）：节点标题同时活在面板 .node-item 与画布 .lf-node-content，
-// 全页身份门必撞多匹配——预检域锁 .lf-canvas-overlay 内 label 恰 1 才点（与回放 doOpenNode 同一扇门）
-// → mouse 单击节点箱中心 → 后置核验抽屉可见且含标题（双证：开了、且开的是这个节点），证不出进
-// blockers 硬阻断（镜像 addNode/connectNodes 先例）。抽屉族原子（setNodeField/selectNodeDropdown/...）
-// 的共同前置。registry「点空重点一次」重试启发式不进确定性原子（差异挂 observability 真机复核）。
+// HANDOFF「双击」查无实证按笔误处理 + drawer-lock-hardening GRILL D2/D3/D5）：节点标题同时活在面板
+// .node-item 与画布 .lf-node-content，全页身份门必撞多匹配——预检域锁 .lf-canvas-overlay 内 label 恰 1
+// 才点（与回放 doOpenNode 同一扇门）→ D5 预点基线归因守卫（单击前先数「可见且含精确、且标题文本自身
+// 可见」的抽屉，count>0 即证不出点后归因，绝不背书）→ mouse 单击节点箱中心 → D5 点后恰一（回读要求
+// 标题锚域内恰 1，0 或 >1 同样证不出归因），证不出进 blockers 硬阻断（镜像 addNode/connectNodes 先例）。
+// 成功后把当前节点标题写入 run.nodeDrawerLabel（D3，后开覆盖先开），供 selectNodeDropdown/setNodeField
+// 读取作标题锚域锁。抽屉族原子的共同前置。registry「点空重点一次」重试启发式不进确定性原子（差异挂
+// observability 真机复核）。
 async function compileWorkflowOpenNode(run, params) {
   const i = run.newIntent();
   const label = String(params.label || '');
@@ -555,32 +579,48 @@ async function compileWorkflowOpenNode(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  // 身份回读须【精确】含 label 元素，非子串 hasText（评审 F1，与回放门 doOpenNode 同刻）：子串会把标题「label副本」
-  // 等含子串的开错抽屉误判开对——精确回读堵「点了没开 / 开错抽屉」两向假绿。
-  const drawerLoc = () => run.page.locator('.hr-drawer__content-wrapper').filter({ has: run.page.getByText(label, { exact: true }) });
+  // D5 预点基线归因守卫（评审修订同刻）：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
+  // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
+  const baseline = await nodeDrawerDomain(run.page, label);
+  if (baseline.length > 0) {
+    run.blockers.push(`workflow.openNode「${label}」预点基线：单击前已有 ${baseline.length} 个可见且含精确标题的抽屉，证不出点后归因 → 硬阻断（fail-closed，route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
   await run.emit({ intentId: i, atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: label, exact: true }, text: label }, async () => {
     await run.page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」
-    await drawerLoc().first().waitFor({ state: 'visible', timeout: 5000 }); // 等不到抛 → emit 落 action_failed
+    // 点后等待：轮询标题锚域内计数直到 ≥1 或超时（需要的是计数、不止存在性，故不用单点 waitFor）。
+    const t0 = Date.now();
+    for (;;) {
+      const cur = await nodeDrawerDomain(run.page, label);
+      if (cur.length >= 1 || Date.now() - t0 > 5000) break;
+      await sleep(100);
+    }
   });
-  // 后置核验（registry post：右侧配置抽屉打开）：抽屉可见 + 含节点标题双证；证不出 → blockers 硬阻断。
-  const open = await drawerLoc().first().isVisible().catch(() => false);
-  if (!open) {
-    run.blockers.push(`workflow.openNode「${label}」后置核验节点配置抽屉未开（可见+含标题双证证不出）→ 硬阻断（fail-closed）`);
+  // D5 点后恰一（评审修订同刻）：回读要求标题锚域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏
+  // 文本已被 nodeDrawerDomain 的精确+可见双限定堵死，评审 F1/D2）。
+  const after = await nodeDrawerDomain(run.page, label);
+  if (after.length !== 1) {
+    run.blockers.push(`workflow.openNode「${label}」后置核验：点后域内含精确标题的可见抽屉 count=${after.length}（非恰一）证不出归因 → 硬阻断（fail-closed）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  run.notes.push(`workflow.openNode「${label}」节点配置抽屉已开（可见+含标题双证过）`);
+  run.nodeDrawerLabel = label; // D3：编译期 run 态记当前节点标题，供 select/set 两原子域锁读取（后开覆盖先开）
+  run.notes.push(`workflow.openNode「${label}」节点配置抽屉已开（可见+含标题双证过，预点基线 0、点后恰一）`);
 }
 
-// workflow.selectNodeDropdown（画布节点抽屉下拉原子；GRILL D1/D3/D4/D5）：抽屉族第二原子（前置必先
-// workflow.openNode 开抽屉——registry requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=click
-// （零冻结 schema：nth 载下拉下标、text 载 option、semantic 载触发器锚）——不走 selectOption（冻结 schema
-// 的 allOf 强制 selectOption 带 dropdownUnit，而 dropdownUnit 无 nth 槽、required fieldLabel/optionText 与
-// 节点 nth 定位冲突）。预检域锁 .hr-drawer__content-wrapper 内第 nth 个【可见】.hr-select:visible 触发器（nth<count，
-// 路 A 确定性位置消歧；非法 nth（在场但非非负整数）/ count=0 无下拉 / nth 越界 → blocker 硬阻断，fail-closed）→ customAct 点第 nth 触发器 +
-// 限【可见浮层】.hr-select-option 唯一才点（多匹配/缺席 throw → emit 落 action_failed）→ 后置触发器值回读
-// （不再「请选择」且精确含 option）。编译门与回放门 doSelectNodeDropdown 同刻（同域锁 + 同可见浮层作用域 +
-// 同精确回读）。registry「点松回读紧」（点选项容 registry 子串但须唯一，回读精确）。
+// workflow.selectNodeDropdown（画布节点抽屉下拉原子；GRILL D1/D3/D4/D5 + drawer-lock-hardening
+// GRILL D2/D3/D4/D6）：抽屉族第二原子（前置必先 workflow.openNode 开抽屉——registry
+// requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=click（零冻结 schema：nth 载下拉下标、
+// text 载 option、semantic 载触发器锚、nodeName 载当前节点标题）——不走 selectOption（冻结 schema 的
+// allOf 强制 selectOption 带 dropdownUnit，而 dropdownUnit 无 nth 槽、required fieldLabel/optionText 与
+// 节点 nth 定位冲突）。先读 run.nodeDrawerLabel 作标题锚域锁（D3；缺失/非 string/trim 空 → blocker
+// fail-closed，D4 修订、D3 run 态缺失分支实钉）——域内 count===0/>1 → blocker（D6 三态）；count===1 才
+// 以该抽屉为根，预检域内第 nth 个【可见】.hr-select:visible 触发器（nth<count，路 A 确定性位置消歧；
+// 非法 nth（在场但非非负整数）/ count=0 无下拉 / nth 越界 → blocker 硬阻断，fail-closed）→ customAct
+// 点第 nth 触发器 + 限【可见浮层】.hr-select-option 唯一才点（多匹配/缺席 throw → emit 落 action_failed）
+// → 后置触发器值回读（不再「请选择」且精确含 option）。编译门与回放门 doSelectNodeDropdown 同刻（同域锁
+// + 同可见浮层作用域 + 同精确回读）。registry「点松回读紧」（点选项容 registry 子串但须唯一，回读精确）。
 async function compileWorkflowSelectNodeDropdown(run, params) {
   const i = run.newIntent();
   // nth 校验（fix#1）：缺省 → 合法默认 0；在场但非「非负整数」→ blocker 硬阻断 fail-closed 零 events
@@ -592,9 +632,30 @@ async function compileWorkflowSelectNodeDropdown(run, params) {
   }
   const nth = params.nth === undefined ? 0 : params.nth;
   const option = params.option != null ? String(params.option) : null;
+  // D3/D4 修订：run 态当前节点标题缺失/非 string/trim 后空白 → 硬阻断 fail-closed（理论不可达，flow gate
+  // 已强制前序 openNode；openNode 若被自身 blocker 截会让 run 态维持缺失，此处兜底截断级联，D3 run 态
+  // 缺失分支实钉）。
+  if (nodeDrawerLabelInvalid(run.nodeDrawerLabel)) {
+    run.blockers.push(`workflow.selectNodeDropdown run 态节点抽屉标题缺失或空白（openNode 未成功开抽屉或标题空白）→ 硬阻断 fail-closed 不点（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  const label = run.nodeDrawerLabel;
+  const domain = await nodeDrawerDomain(run.page, label);
+  if (domain.length === 0) {
+    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不点（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  if (domain.length > 1) {
+    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=${domain.length}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不点（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  const root = domain[0];
   // 预检域锁触发器门（emit 的 customAct 通路不走定位核验，此处自证——镜像 openNode 域锁 + addNode 源身份门）；
   // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 触发器误命中。
-  const triggers = run.page.locator('.hr-drawer__content-wrapper .hr-select:visible');
+  const triggers = root.locator('.hr-select:visible');
   // 可见等待守卫（codex 异构冗余评审 F2）：域锁改 :visible 后计数变时序敏感——抽屉/触发器异步渲染的短暂
   // 不可见窗口会让裸 count() 得 0 误落越界 blocker（fail-closed 假阴、破「两门同刻」）。补 doSelectNodeDropdown
   // 回放门同款有界 waitFor（抛不穿出、5s 上界），对既有全可见触发器场景恒等无行为差、对 ddempty 只多等即同判。
@@ -610,7 +671,7 @@ async function compileWorkflowSelectNodeDropdown(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  const spec = { intentId: i, atom: 'workflow.selectNodeDropdown', action: 'click', nth, semantic: { kind: 'text', name: '请选择', exact: true } };
+  const spec = { intentId: i, atom: 'workflow.selectNodeDropdown', action: 'click', nth, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: label };
   if (option) spec.text = option;
   await run.emit(spec, async () => {
     await triggers.nth(nth).click({ timeout: 3000 });
@@ -634,15 +695,17 @@ async function compileWorkflowSelectNodeDropdown(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  run.notes.push(`workflow.selectNodeDropdown 节点下拉已选中（nth=${nth}/${option ?? '首项'}，触发器值「${val}」精确回读过）`);
+  run.notes.push(`workflow.selectNodeDropdown 节点下拉已选中（nth=${nth}/${option ?? '首项'}，触发器值「${val}」精确回读过，域锁「${label}」）`);
 }
 
-// workflow.setNodeField（画布节点抽屉可填字段原子；GRILL D1/D3/D4/D5）：抽屉族第三原子（前置必先
-// workflow.openNode 开抽屉——registry requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=fill
-// （零冻结 schema：value 载填入值、semantic:{kind:label,name:placeholder,exact} 载占位符锚 + 精确开关、
-// nth 仅显式给时载字段下标消歧）——冻结 schema 的 allOf 对 fill 只要求 value。预检域锁 .hr-drawer__content-wrapper
-// 内 getByPlaceholder(placeholder,{exact})（占位符锚非 semanticLocator 命中口径，故按 ev.atom 分发专用回放门
-// doSetNodeField；全页 getByPlaceholder 会撞「新增工作流」抽屉的 请输入工作流名称 → ambiguous 卡死）。字段级
+// workflow.setNodeField（画布节点抽屉可填字段原子；GRILL D1/D3/D4/D5 + drawer-lock-hardening
+// GRILL D2/D3/D4/D6）：抽屉族第三原子（前置必先 workflow.openNode 开抽屉——registry
+// requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=fill（零冻结 schema：value 载填入值、
+// semantic:{kind:label,name:placeholder,exact} 载占位符锚 + 精确开关、nth 仅显式给时载字段下标消歧、
+// nodeName 载当前节点标题）——冻结 schema 的 allOf 对 fill 只要求 value。先读 run.nodeDrawerLabel 作
+// 标题锚域锁（D3；缺失/非 string/trim 空 → blocker fail-closed，D4 修订、D3 run 态缺失分支实钉）——
+// 域内 count===0/>1 → blocker（D6 三态）；count===1 才以该抽屉为根，预检域内 getByPlaceholder(placeholder,
+// {exact})（占位符锚非 semanticLocator 命中口径，故按 ev.atom 分发专用回放门 doSetNodeField）。字段级
 // 唯一闸（D4，fail-safe 核心）：count=0 缺席 / 未给 nth 且 count>1 多匹配 ambiguous 绝不填首项 / 给 nth 越界
 // → blocker 硬阻断（fail-closed）；唯一或显式 nth 合法才填。emit customAct = target.fill（填值内聚，镜像
 // doSelectNodeDropdown 两击内聚）→ 后置字段 value 回读（inputValue() 精确等于实例化后填入值，非 includes
@@ -667,8 +730,27 @@ async function compileWorkflowSetNodeField(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
+  // D3/D4 修订：run 态当前节点标题缺失/非 string/trim 后空白 → 硬阻断 fail-closed。
+  if (nodeDrawerLabelInvalid(run.nodeDrawerLabel)) {
+    run.blockers.push(`workflow.setNodeField run 态节点抽屉标题缺失或空白（openNode 未成功开抽屉或标题空白）→ 硬阻断 fail-closed 不填（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  const label = run.nodeDrawerLabel;
+  const domain = await nodeDrawerDomain(run.page, label);
+  if (domain.length === 0) {
+    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不填（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  if (domain.length > 1) {
+    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=${domain.length}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不填（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  const root = domain[0];
   // 预检域锁字段门（emit 的 customAct 通路不走定位核验，此处自证——镜像 selectNodeDropdown 域锁 + openNode 源身份门）：
-  const fields = run.page.locator('.hr-drawer__content-wrapper').getByPlaceholder(placeholder, { exact });
+  const fields = root.getByPlaceholder(placeholder, { exact });
   const fcount = await fields.count().catch(() => null);
   if (fcount == null || fcount === 0) {
     run.blockers.push(`workflow.setNodeField 节点抽屉域内占位符「${placeholder}」字段 count=0（抽屉无该字段）→ 硬阻断 fail-closed 不填（route:human）`);
@@ -685,7 +767,7 @@ async function compileWorkflowSetNodeField(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  const spec = { intentId: i, atom: 'workflow.setNodeField', action: 'fill', value, semantic: { kind: 'label', name: placeholder, exact } };
+  const spec = { intentId: i, atom: 'workflow.setNodeField', action: 'fill', value, semantic: { kind: 'label', name: placeholder, exact }, nodeName: label };
   if (hasNth) spec.nth = nth;
   const target = () => fields.nth(hasNth ? nth : 0);
   await run.emit(spec, async () => {
@@ -701,7 +783,7 @@ async function compileWorkflowSetNodeField(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  run.notes.push(`workflow.setNodeField 节点字段已填入（〈${placeholder}〉=〈${want}〉，value 精确回读过）`);
+  run.notes.push(`workflow.setNodeField 节点字段已填入（〈${placeholder}〉=〈${want}〉，value 精确回读过，域锁「${label}」）`);
 }
 
 async function compileAgentSearchOpen(run, params) {
```

### 4.3 `tests/_golden/drawer-lock-hardening.golden.mjs`（新，红先行金牌 G1–G11，21 条独立子用例）

```diff
diff --git a/tests/_golden/drawer-lock-hardening.golden.mjs b/tests/_golden/drawer-lock-hardening.golden.mjs
new file mode 100644
index 0000000..9daf8ec
--- /dev/null
+++ b/tests/_golden/drawer-lock-hardening.golden.mjs
@@ -0,0 +1,506 @@
+// drawer-lock-hardening.golden.mjs —— 画布三原子域锁跨抽屉边界硬化红先行金牌（G1–G11，light）。
+// 决策全录 docs/plans/drawer-lock-hardening/proposed/GRILL.md（D1 方向定案 / D2 标题锚取舍 / D3 nodeName
+// 供给通道 / D4 缺 nodeName fail-closed / D5 openNode 预点基线 / D6 抽屉域三态分层 / D7 夹具反面场景 /
+// D8 金牌形态）+ plan.md 落地步骤与验收。挂账原文：loop/prd-wf-set-node-field.json observability 第二条
+// （codex-sol 异构冗余评审 MED#2，2026-07-10）——doSetNodeField/compileWorkflowSetNodeField 的域锁用宽
+// .hr-drawer__content-wrapper，匹配所有抽屉而非当前节点配置抽屉，若另一可见抽屉恰有唯一同 placeholder
+// 字段，域内 count===1 会填错抽屉的字段、精确回读仍成立→假绿；openNode/selectNodeDropdown/setNodeField
+// 三原子同型设计局限。
+//
+// 本文件在【旧实现】（改前）上跑必须逐条红（红证）；实现收窄标题锚域锁后须逐条绿。
+//
+// 断言总纪律（评审修订，对每条生效）：反面用例的 verdict 一律钉精确路由 NEEDS_HUMAN（不再只断「不 PASS」）；
+// 涉冒牌字段/触发器的用例一律加宽域候选零落笔/唯一落笔取证断言（吃门内宽域候选快照，纯加法证据字段，
+// axes 无冻结 schema 约束）；每个原子分支一个独立子用例（checkAsync 隔离），不许合写短路掩盖。
+//
+// 金牌 × fake-sut 场景映射：
+//   G1  回放 setNodeField 跨抽屉误命中          twinfield
+//   G2  回放 selectNodeDropdown 跨抽屉误命中     twinfield
+//   G3a 编译 setNodeField 跨抽屉误命中           twinfield
+//   G3b 编译 selectNodeDropdown 跨抽屉误命中     twinfield
+//   G4  回放 setNodeField 域内唯一才动手（正面） twinboth
+//   G11 回放 selectNodeDropdown 域内唯一（正面） twinboth
+//   G5  回放 openNode 开错抽屉归因                twintitle
+//   G6  编译 openNode 预点基线                    twintitle
+//   G7a/b/c 回放缺/空/纯空白 nodeName fail-closed happy
+//   G8  回放+编译 openNode 点后歧义                twinlate
+//   G9  回放+编译 set/select 域级多匹配            twinlate
+//   G10 回放隐藏标题文本拒认（openNode + set）     twinghost
+import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
+import { spawnSync } from 'node:child_process';
+import { resolve, dirname, join } from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { tmpdir } from 'node:os';
+import { startFakeSut } from '../fixtures/fake-sut/server.mjs';
+import { signExpected } from './_sign-helper.mjs';
+
+const HERE = dirname(fileURLToPath(import.meta.url));
+const ROOT = resolve(HERE, '..', '..');
+const CASEY = join(ROOT, 'bin', 'casey.mjs');
+const REPLAY = join(ROOT, 'bin', 'replay.mjs');
+const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
+const tmp = mkdtempSync(join(tmpdir(), 'casey-drawer-lock-hardening-'));
+
+const fails = [];
+let pass = 0;
+async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-600)}`); } }
+const SITE_FILE = join(tmp, 'site.synthetic.json');
+writeFileSync(SITE_FILE, '{}\n');
+function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
+const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
+const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
+
+const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut 列表既有行（只读点开进详情=画布页）
+const NODE = '模型节点'; // 与 fake-sut TWIN_TITLE_NODE 一致（twintitle/twinlate/twinghost 冒牌标题固定复用此名）
+const NODE_X = 320, NODE_Y = 150;
+const PLACEHOLDER = '请输入接口的URL'; // registry :252 setNodeField 占位符例
+const VALUE = 'https://api.example.com/drawer-lock';
+const OPT = '订单库'; // 节点抽屉下拉目标选项（happy/twin* 缺省下拉既有项）
+
+// 通道剖面：countSelector 沿用既有三原子金牌约定；本文件多数考场落 NEEDS_HUMAN/不 PASS，countChange 通道
+// 不是本文件关注面（PASS 考场 G4/G11 靠 GLOBALS 兜底，不抢 countChange）。
+const PROFILE_OBJ = { successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
+const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);
+// 全局取证（PASS 考场 G4/G11 靠它得出 PASS，镜像 wf-set-node-field/wf-select-node-dropdown C2-c 先例）。
+const GLOBALS = [{ kind: 'noPageError', op: 'absent' }, { kind: 'noErrorEnvelope', op: 'envelopeOk' }];
+
+// ── 回放面公共助手（p5-replay 形制）：手编 events + 已签 expected → bin/replay → bin/verdict ──
+function runReplayVerdict(tag, sutUrl, eventsDoc, expectedContract) {
+  const evF = writeJson(join(tmp, `${tag}.events.json`), eventsDoc);
+  const exF = writeJson(join(tmp, `${tag}.expected.json`), signExpected(expectedContract));
+  const prF = writeJson(join(tmp, `${tag}.profile.json`), PROFILE_OBJ);
+  const axF = join(tmp, `${tag}.axes.json`);
+  const vdF = join(tmp, `${tag}.verdict.json`);
+  const r1 = run([REPLAY, '--events', evF, '--sut', sutUrl, '--expected', exF, '--profile', prF, '--out', axF], 180000);
+  if (r1.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r1.status}：${(r1.stderr || '').slice(-300)}`);
+  const r2 = run([VERDICT, '--axes', axF, '--out', vdF]);
+  if (r2.status !== 0) throw new Error(`verdict 应 exit 0，实际 ${r2.status}：${(r2.stderr || '').slice(-200)}`);
+  return { axes: readJson(axF), verdict: readJson(vdF) };
+}
+const stepOf = (doc, iid) => (doc.steps || []).find((s) => s.intentId === iid) || {};
+
+// 抽屉族回放 setup（nav→addNode 开面板+落节点），intent_0/intent_1；openNode 独立占 intent_2；
+// 目标原子（set/select）占 intent_3。
+const setupEvents = () => ([
+  { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
+  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
+  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X, oy: NODE_Y },
+]);
+const openNodeEvent = () => ({ stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE });
+// setNodeField/selectNodeDropdown 手编事件：nodeNameValue 可传 undefined（缺席）/ ''（空串）/ '   '（纯空白）/ NODE（合法）。
+const setFieldEvent = (nodeNameValue) => {
+  const ev = { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false } };
+  if (nodeNameValue !== undefined) ev.nodeName = nodeNameValue;
+  return ev;
+};
+const selectEvent = (nodeNameValue) => {
+  const ev = { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } };
+  if (nodeNameValue !== undefined) ev.nodeName = nodeNameValue;
+  return ev;
+};
+const setupIntents = () => ([
+  { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
+  { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
+  { intentId: 'intent_2', expected: [] }, // openNode 本步不强断（本文件各考场对 openNode 自身结局各异，只钉目标原子）
+]);
+
+// ── 编译面公共助手：gate→confirm→execute，回 gate/execute 结果与 out-dir ──
+function compileFlowCase(tag, caseId, steps, sutUrl) {
+  const tc = writeJson(join(tmp, `tc-${tag}.json`), {
+    schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
+    intents: [{ intentId: 'intent_nav', text: '进列表' }, { intentId: 'intent_open', text: '开详情' }, { intentId: 'intent_body', text: '画布考场' }],
+  });
+  const flow = writeJson(join(tmp, `flow-${tag}.json`), { id: caseId, name: `考场 ${tag}`, category: 'normal', steps });
+  const od = join(tmp, `compile-${tag}`);
+  const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
+  if (g.status !== 0) return { g, x: null, od };
+  const fd = readJson(join(od, `flow-${caseId}.json`));
+  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-14T00:00:00.000Z';
+  writeJson(join(od, `flow-${caseId}.json`), fd);
+  const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sutUrl, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag]);
+  return { g, x, od };
+}
+const stdFlow = (tail) => ([
+  { atom: 'nav.workflowManagement', params: {} },
+  { atom: 'workflow.open', params: { openName: OPEN_NAME } },
+  { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
+  { atom: 'workflow.openNode', params: { label: NODE } },
+  ...tail,
+]);
+
+// ============================================================================================
+// twinfield 场景：G1（回放 set 跨抽屉误命中）/ G2（回放 select 跨抽屉误命中）/
+//                 G3a（编译 set 跨抽屉误命中）/ G3b（编译 select 跨抽屉误命中）
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'twinfield' });
+  try {
+    await checkAsync('G1 回放·setNodeField 跨抽屉误命中（twinfield）：标题锚域内字段 count=0 → resolution none + 宽域候选快照全空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧宽域锁 count=1 真填冒牌抽屉字段、回读成立 → unique+PASS 假绿实锤', async () => {
+      const caseId = 'tc_dlh_g1';
+      const { axes, verdict } = runReplayVerdict('g1', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`标题锚域内字段应 count=0 → resolution none（真节点抽屉此时是 ddempty 形态、冒牌抽屉不含标题不入域），实际 ${JSON.stringify(ax.action)}`);
+      const wide = ax.action.wideCandidateValues;
+      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域（不分标题）候选字段快照应恰 1 项且为空（冒牌字段零落笔，唯一存在的同占位符字段在冒牌抽屉），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN（fail-safe 证不出归属），实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁 count=1 命中冒牌抽屉字段、填后回读成立会返 unique+PASS）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE（ap=false 且无取证背书/无漂移探针），实际 ${v.reason}`);
+    });
+
+    await checkAsync('G2 回放·selectNodeDropdown 跨抽屉误命中（twinfield）：标题锚域内触发器 count=0 → resolution none + 宽域候选快照仍「请选择」（零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧门点冒牌触发器选中回读成立 → unique+PASS 假绿实锤', async () => {
+      const caseId = 'tc_dlh_g2';
+      const { axes, verdict } = runReplayVerdict('g2', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`标题锚域内触发器应 count=0 → resolution none，实际 ${JSON.stringify(ax.action)}`);
+      const wide = ax.action.wideTriggerValues;
+      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '请选择') throw new Error(`宽域（不分标题）触发器快照应恰 1 项且仍「请选择」（冒牌触发器零落笔），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧门点冒牌触发器选中回读成立会返 unique+PASS）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G3a 编译·setNodeField 跨抽屉误命中（twinfield）：execute 预检标题锚域内 count=0 → blocker exit 65 + 零 events + blocker 点名域内 count=0。验红：旧编译门命中冒牌抽屉 exit 0 产 events 必红', async () => {
+      const { x, od } = compileFlowCase('g3a', 'tc_dlh_g3a', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（标题锚域内 count=0，绝不误填冒牌抽屉字段），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门宽域命中冒牌抽屉产 events exit 0）`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 setNodeField 标题锚域内 count=0，实际 ${btext.slice(0, 300)}`);
+    });
+
+    await checkAsync('G3b 编译·selectNodeDropdown 跨抽屉误命中（twinfield）：execute 预检标题锚域内 count=0 → blocker exit 65 + 零 events + blocker 点名域内 count=0。验红：旧编译门命中冒牌抽屉 exit 0 产 events 必红', async () => {
+      const { x, od } = compileFlowCase('g3b', 'tc_dlh_g3b', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65，实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门宽域命中冒牌抽屉产 events exit 0）`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 selectNodeDropdown 标题锚域内 count=0，实际 ${btext.slice(0, 300)}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// twinboth 场景：G4（回放 set 域内唯一才动手，正面）/ G11（回放 select 域内唯一，正面）
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'twinboth' });
+  try {
+    await checkAsync('G4 回放·setNodeField 域内唯一才动手（twinboth 正面半边）：标题锚锁进节点抽屉 count=1 → unique + candidateCount 1 + identityReadback ok + 宽域候选快照证唯一落笔在真节点抽屉字段、冒牌字段仍空 + verdict PASS。验红：旧宽域锁 count=2 → ambiguous，断言必红（证明收窄非无脑全关）', async () => {
+      const caseId = 'tc_dlh_g4';
+      const { axes, verdict } = runReplayVerdict('g4', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`标题锚应锁进节点抽屉 count=1 → unique（旧宽域锁 count=2 会返 ambiguous——断言故意钉在这），实际 ${JSON.stringify(ax.action)}`);
+      if (ax.action.candidateCount !== 1) throw new Error(`candidateCount 应恰 1（标题锚域内唯一），实际 ${ax.action.candidateCount}`);
+      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true（字段 value 精确回读），实际 ${JSON.stringify(ax.action.identityReadback)}`);
+      const wide = ax.action.wideCandidateValues;
+      if (!Array.isArray(wide) || wide.length !== 2) throw new Error(`宽域候选字段快照应恰 2 项（冒牌+真节点抽屉各一同占位符字段），实际 ${JSON.stringify(wide)}`);
+      if (wide[0] !== '') throw new Error(`宽域候选[0]（冒牌抽屉字段，DOM 序先于真抽屉）应仍为空——唯一落笔须在真节点抽屉、冒牌字段零落笔，实际 ${JSON.stringify(wide)}`);
+      if (wide[1] !== VALUE) throw new Error(`宽域候选[1]（真节点抽屉字段）应等于填入值「${VALUE}」，实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'PASS') throw new Error(`应 PASS（收窄后能证出归属时照常干活，不是无脑全关），实际 ${v.verdict}/${v.reason}`);
+    });
+
+    await checkAsync('G11 回放·selectNodeDropdown 域内唯一（twinboth 正面半边，冒牌在 DOM 序更前）：标题锚锁进真节点抽屉触发器 → unique + verdict PASS + 宽域候选快照证冒牌触发器仍「请选择」（唯一落笔在真抽屉触发器）。验红：旧宽域 nth=0 误点冒牌触发器同样 unique+PASS——红落在取证断言（旧门无宽域快照证据 + 冒牌触发器被误动）', async () => {
+      const caseId = 'tc_dlh_g11';
+      const { axes, verdict } = runReplayVerdict('g11', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`标题锚应锁进真节点抽屉 count=1 → unique，实际 ${JSON.stringify(ax.action)}`);
+      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true（触发器值精确含 option），实际 ${JSON.stringify(ax.action.identityReadback)}`);
+      const wide = ax.action.wideTriggerValues;
+      if (!Array.isArray(wide) || wide.length !== 2) throw new Error(`宽域触发器快照应恰 2 项（冒牌+真节点抽屉各一「请选择」触发器），实际 ${JSON.stringify(wide)}`);
+      if (wide[0] !== '请选择') throw new Error(`宽域候选[0]（冒牌触发器，DOM 序更前）应仍「请选择」——唯一落笔须在真抽屉触发器，实际 ${JSON.stringify(wide)}（红证：旧宽域 nth=0 会误点这个冒牌触发器）`);
+      if (wide[1] !== OPT) throw new Error(`宽域候选[1]（真节点抽屉触发器）应已选中「${OPT}」，实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'PASS') throw new Error(`应 PASS（域内唯一才动手、真选中真抽屉），实际 ${v.verdict}/${v.reason}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// twintitle 场景：G5（回放 openNode 开错抽屉归因）/ G6（编译 openNode 预点基线）
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'twintitle' });
+  try {
+    await checkAsync('G5 回放·openNode 开错抽屉归因（twintitle：点了不开+冒牌抽屉画布外预挂含节点标题）：预点基线 count>0 证不出归因 → resolution action_failed + identityReadback 非 ok + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧回读命中冒牌抽屉 → unique 假绿实锤', async () => {
+      const caseId = 'tc_dlh_g5';
+      const { axes, verdict } = runReplayVerdict('g5', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent()],
+      }, {
+        caseId, channel: 'web',
+        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_2');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`预点基线已见冒牌抽屉含精确标题（count>0），证不出点后归因 → 应 action_failed（绝不背书），实际 ${JSON.stringify(ax.action)}`);
+      if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('开错抽屉竟 identityReadback ok:true——命中冒牌抽屉假绿（护栏 #14）');
+      const v = stepOf(verdict, 'intent_2');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧回读命中冒牌抽屉会返 unique）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G6 编译·openNode 预点基线（twintitle）：execute 预检预点基线 count>0 → blocker exit 65 + 零 events + blocker 点名预点基线证不出归因。验红：旧编译门等到冒牌抽屉可见后置核验过 exit 0 必红', async () => {
+      const { x, od } = compileFlowCase('g6', 'tc_dlh_g6', stdFlow([]).slice(0, 4), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（预点基线证不出归因，绝不等到冒牌抽屉可见即背书），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门后置核验命中冒牌抽屉过 exit 0）`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/预点基线/.test(btext)) throw new Error(`blockers 应点名 openNode 预点基线证不出归因，实际 ${btext.slice(0, 300)}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// twinlate 场景：G8（回放+编译 openNode 点后歧义）/ G9（回放+编译 set/select 域级多匹配）
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'twinlate' });
+  try {
+    await checkAsync('G8a 回放·openNode 点后歧义（twinlate：单击开真抽屉同刻挂出含标题冒牌）：预点基线 0 过、点后域内 count=2 证不出归因 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧回读 first 可见即过 → unique 假绿必红', async () => {
+      const caseId = 'tc_dlh_g8a';
+      const { axes, verdict } = runReplayVerdict('g8a', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent()],
+      }, {
+        caseId, channel: 'web',
+        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_2');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`点后域内 count=2（真+冒牌同刻现身，均含精确标题）证不出归因 → 应 action_failed，实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_2');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧回读 first 可见即过会返 unique）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G8b 编译·openNode 点后歧义（twinlate）：execute 预检点后域内 count=2 → blocker exit 65 + 零 events + blocker 点名点后域内 count=2。验红：旧编译 isVisible 过 exit 0 必红', async () => {
+      const { x, od } = compileFlowCase('g8b', 'tc_dlh_g8b', stdFlow([]).slice(0, 4), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（点后域内 count=2 证不出归因），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译 isVisible 过 exit 0）`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/count=2/.test(btext)) throw new Error(`blockers 应点名 openNode 点后域内 count=2，实际 ${btext.slice(0, 300)}`);
+    });
+
+    await checkAsync('G9a 回放·setNodeField 域级多匹配（twinlate：openNode 点击已发生、两含标题抽屉在场）：标题锚域内 count=2 → resolution ambiguous + candidateCount 2 + 宽域候选快照零落笔 + verdict 恰 NEEDS_HUMAN/AMBIGUOUS_ACTION。验红：旧宽域锁字段 count=1 命中冒牌 → unique+PASS 假绿必红', async () => {
+      const caseId = 'tc_dlh_g9a';
+      const { axes, verdict } = runReplayVerdict('g9a', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`点击已发生后两抽屉均含精确标题、标题锚域内 count=2 → 应 ambiguous（证不出归属，绝不动手），实际 ${JSON.stringify(ax.action)}`);
+      if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2（域内两个含精确标题的可见抽屉），实际 ${ax.action.candidateCount}`);
+      const wide = ax.action.wideCandidateValues;
+      // codex-sol@medium L2 分析发现：仅 .some() 检查对空数组恒假通过（真节点抽屉此时 ddempty 无字段、
+      // 冒牌抽屉恰一字段——域内应恰 1 项，缺 length 钉位则实现若误吐空数组此断言仍会「通过」，非真校验。
+      if (!Array.isArray(wide) || wide.length !== 1 || wide.some((v) => v !== '')) throw new Error(`宽域候选字段快照应恰 1 项且为空（零落笔，冒牌字段未被误填；真节点抽屉此时 ddempty 无字段），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁 count=1 命中冒牌字段会返 unique+PASS）`);
+      if (v.reason !== 'AMBIGUOUS_ACTION') throw new Error(`reason 应恰 AMBIGUOUS_ACTION（ap='ambiguous' 唯一合法路由），实际 ${v.reason}`);
+    });
+
+    await checkAsync('G9b 回放·selectNodeDropdown 域级多匹配（twinlate，同上两含标题抽屉在场）：标题锚域内 count=2 → resolution ambiguous + candidateCount 2 + 宽域候选快照仍「请选择」（零落笔）+ verdict 恰 NEEDS_HUMAN/AMBIGUOUS_ACTION。验红：旧宽域锁触发器 count=1 命中冒牌 → unique+PASS 假绿必红', async () => {
+      const caseId = 'tc_dlh_g9b';
+      const { axes, verdict } = runReplayVerdict('g9b', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`标题锚域内 count=2 → 应 ambiguous，实际 ${JSON.stringify(ax.action)}`);
+      if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2，实际 ${ax.action.candidateCount}`);
+      const wide = ax.action.wideTriggerValues;
+      // codex-sol@medium L2 分析发现：仅 .some() 检查对空数组恒假通过——域内应恰 1 项（真节点抽屉此时
+      // ddempty 无下拉、冒牌抽屉恰一触发器），缺 length 钉位则实现若误吐空数组此断言仍会「通过」。
+      if (!Array.isArray(wide) || wide.length !== 1 || wide.some((v) => v !== '请选择')) throw new Error(`宽域触发器快照应恰 1 项且全「请选择」（零落笔），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁触发器 count=1 命中冒牌会返 unique+PASS）`);
+      if (v.reason !== 'AMBIGUOUS_ACTION') throw new Error(`reason 应恰 AMBIGUOUS_ACTION，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G9c 编译·setNodeField 域级多匹配（twinlate：openNode 被 blocker 截后 run 态缺失）：openNode 点后 count=2 blocker + setNodeField run 态节点抽屉标题缺失 blocker 级联 → exit 65 零 events（D3 run 态缺失分支实钉，fail-closed 绝不回落宽域锁）', async () => {
+      const { x, od } = compileFlowCase('g9c', 'tc_dlh_g9c', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（openNode 自身被点后歧义截、run 态节点抽屉标题从未写入，setNodeField 须 run 态缺失兜底 fail-closed），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!/openNode/.test(btext) || !/count=2/.test(btext)) throw new Error(`blockers 应含 openNode 点后域内 count=2 的自身 blocker，实际 ${btext.slice(0, 400)}`);
+      if (!/setNodeField/.test(btext) || !/run 态|标题缺失|nodeDrawerLabel/.test(btext)) throw new Error(`blockers 应另含 setNodeField 因 run 态节点抽屉标题缺失而截断的 blocker（D3 run 态缺失分支），实际 ${btext.slice(0, 400)}`);
+    });
+
+    await checkAsync('G9d 编译·selectNodeDropdown 域级多匹配（twinlate，同上级联）：openNode 点后 count=2 blocker + selectNodeDropdown run 态节点抽屉标题缺失 blocker 级联 → exit 65 零 events', async () => {
+      const { x, od } = compileFlowCase('g9d', 'tc_dlh_g9d', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65，实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!/openNode/.test(btext) || !/count=2/.test(btext)) throw new Error(`blockers 应含 openNode 点后域内 count=2 的自身 blocker，实际 ${btext.slice(0, 400)}`);
+      if (!/selectNodeDropdown/.test(btext) || !/run 态|标题缺失|nodeDrawerLabel/.test(btext)) throw new Error(`blockers 应另含 selectNodeDropdown 因 run 态节点抽屉标题缺失而截断的 blocker，实际 ${btext.slice(0, 400)}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// twinghost 场景：G10（回放 openNode + set，隐藏标题文本拒认）
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'twinghost' });
+  try {
+    await checkAsync('G10a 回放·openNode 隐藏标题文本拒认（twinghost：冒牌抽屉标题文本 display:none）：标题文本自身不可见不算命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧 filter({has}) 命中隐藏文本、wrapper 可见即过 → unique 假绿必红', async () => {
+      const caseId = 'tc_dlh_g10a';
+      const { axes, verdict } = runReplayVerdict('g10a', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent()],
+      }, {
+        caseId, channel: 'web',
+        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_2');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`标题文本 display:none 隐藏，自身不可见不算命中 → 应 action_failed（真抽屉本就不开），实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_2');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧 filter({has}) 不查内层可见性、wrapper 可见即命中隐藏文本会返 unique）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G10b 回放·setNodeField 隐藏标题文本拒认（twinghost，冒牌抽屉补挂同占位符字段+触发器）：标题文本不可见 → 标题锚域内 count=0 → resolution none + 宽域候选快照全空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧宽域锁不问标题只问抽屉可见、域内 count=1 真填冒牌抽屉字段、回读成立 → unique+PASS 假绿必红（若冒牌不挂字段则巧合吐 none 不构成红证，故补挂）', async () => {
+      const caseId = 'tc_dlh_g10b';
+      const { axes, verdict } = runReplayVerdict('g10b', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`隐藏标题文本不算命中 → 标题锚域内 count=0 → 应 resolution none，实际 ${JSON.stringify(ax.action)}`);
+      const wide = ax.action.wideCandidateValues;
+      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域（不分标题）候选字段快照应恰 1 项且为空（冒牌字段零落笔，唯一存在的同占位符字段在冒牌抽屉），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁不问标题、域内 count=1 会真填冒牌抽屉字段、回读成立返 unique+PASS）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// happy 场景：G7a/b/c（缺/空/纯空白 nodeName fail-closed 钉桩，四条独立子用例，D4 修订判据）
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'happy' });
+  try {
+    await checkAsync('G7a 回放·setNodeField 事件缺 nodeName（happy）：字段缺席判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE（绝不回落宽域锁）。验红：旧门无此字段要求照常 unique+PASS 必红；此桩锁死后人加 legacy 回落', async () => {
+      const caseId = 'tc_dlh_g7a';
+      const { axes, verdict } = runReplayVerdict('g7a', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(undefined)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`事件缺 nodeName 应硬阻断 action_failed（D4：绝不回落宽域锁），实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（旧门无 nodeName 要求，照常 unique+PASS）`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G7b 回放·selectNodeDropdown 事件缺 nodeName（happy）：字段缺席判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧门无此字段要求照常 unique+PASS 必红', async () => {
+      const caseId = 'tc_dlh_g7b';
+      const { axes, verdict } = runReplayVerdict('g7b', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), selectEvent(undefined)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`事件缺 nodeName 应硬阻断 action_failed，实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G7c-1 回放·setNodeField 事件 nodeName 为空串（happy，D4 修订判据）：trim() 空判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE（schema 只约束 string 类型合法、空串语义非法）。验红：改前（判据只查缺席）空串会穿过判据、旧门宽域锁照常 unique+PASS 必红', async () => {
+      const caseId = 'tc_dlh_g7c1';
+      const { axes, verdict } = runReplayVerdict('g7c1', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent('')],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`nodeName 空串应硬阻断 action_failed（D4 修订：字段缺席/非 string/trim 空三者任一），实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G7c-2 回放·selectNodeDropdown 事件 nodeName 为纯空白（happy，D4 修订判据）：trim() 空判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：改前纯空白会穿过判据、旧门宽域锁照常 unique+PASS 必红', async () => {
+      const caseId = 'tc_dlh_g7c2';
+      const { axes, verdict } = runReplayVerdict('g7c2', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), selectEvent('   ')],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`nodeName 纯空白应硬阻断 action_failed，实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    // codex-sol@medium L2 分析 MED-3：D4 修订判据三者（缺席/非 string/trim 空）里「非 string」此前未直接
+    // 覆盖（events.schema 只挡得住 additionalProperties 越界，挡不住 nodeName 类型；手编 events 越过 schema
+    // 直喂 replay 时非 string 值仍可能出现）。G7d 补齐：nodeName 载数字（非 string 合法 JS 值）。
+    await checkAsync('G7d 回放·setNodeField 事件 nodeName 为非 string（happy，D4 修订判据「非 string」分支）：typeof 非 string 判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：改前判据若只查缺席/trim 空，数字值会穿过判据、旧门宽域锁照常 unique+PASS 必红', async () => {
+      const caseId = 'tc_dlh_g7d';
+      const { axes, verdict } = runReplayVerdict('g7d', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(12345)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`nodeName 非 string（数字）应硬阻断 action_failed（D4 修订：typeof 非 string 判据），实际 ${JSON.stringify(ax.action)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+  } finally { await s.close(); }
+}
+
+console.log(`drawer-lock-hardening golden: ${pass} 过 / ${fails.length} 败`);
+if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
```

### 4.4 既有三金牌手编 events 补 nodeName（`wf-set-node-field` / `wf-select-node-dropdown` / `replay-nth-visible-hardening`）

```diff
diff --git a/tests/_golden/replay-nth-visible-hardening.golden.mjs b/tests/_golden/replay-nth-visible-hardening.golden.mjs
index f320544..dc3e7f4 100644
--- a/tests/_golden/replay-nth-visible-hardening.golden.mjs
+++ b/tests/_golden/replay-nth-visible-hardening.golden.mjs
@@ -98,7 +98,7 @@ await checkAsync('C1 fix#1 replay·非法 nth（happy + 事件 nth=-1 在场但
     const { axes, verdict } = runReplayVerdict('c1', s.url, {
       schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
       // 事件 nth=-1（在场但非非负整数）+ 载 option DD_OPT：修前 coerce 0 点 index 0 真选中回 unique（假绿）。
-      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: -1, text: DD_OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
+      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: -1, text: DD_OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
     }, {
       caseId, channel: 'web',
       intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: DD_OPT }] }],
@@ -139,7 +139,7 @@ await checkAsync('C3 fix#2 replay·隐藏触发器（ddhidden：抽屉先挂 dis
     const caseId = 'tc_rnvh_c3';
     const { axes, verdict } = runReplayVerdict('c3', s.url, {
       schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
-      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: DD_OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
+      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: DD_OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
     }, {
       caseId, channel: 'web',
       intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: DD_OPT }] }],
diff --git a/tests/_golden/wf-select-node-dropdown.golden.mjs b/tests/_golden/wf-select-node-dropdown.golden.mjs
index b092164..f7f561f 100644
--- a/tests/_golden/wf-select-node-dropdown.golden.mjs
+++ b/tests/_golden/wf-select-node-dropdown.golden.mjs
@@ -155,6 +155,7 @@ try {
     if (sel.text !== OPT) throw new Error(`selectNodeDropdown text 应载 option「${OPT}」，实际 ${sel.text}`);
     if (!sel.semantic || sel.semantic.kind !== 'text' || sel.semantic.name !== '请选择' || sel.semantic.exact !== true) throw new Error(`selectNodeDropdown 应经语义锚触发器「请选择」exact，实际 ${JSON.stringify(sel.semantic)}`);
     if (sel.dropdownUnit !== undefined) throw new Error('selectNodeDropdown 不得带 dropdownUnit（走 click 非 selectOption，零冻结 schema）');
+    if (sel.nodeName !== NODE) throw new Error(`selectNodeDropdown 编译产物应带 nodeName「${NODE}」（drawer-lock-hardening D3 供给通道，编译期 run 态 openNode 成功后写入），实际 ${sel.nodeName}`);
     assertEventsDocAgainstSchema(ev);
     const rep = readJson(reportFile);
     if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
@@ -225,7 +226,7 @@ try {
       const caseId = 'tc_wf_seldd_ddtwin';
       const { axes, verdict } = runReplayVerdict('ddtwin', s.url, {
         schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
-        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
+        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
       }, {
         caseId, channel: 'web',
         intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
@@ -317,7 +318,7 @@ try {
       events: [
         { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
         // 抽屉未开（未 addNode/openNode）→ 触发器缺席 → 缺席守卫回 none（waitFor 抛不得穿出崩整轮）。
-        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } },
+        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE },
       ],
     }, {
       caseId, channel: 'web',
@@ -339,7 +340,7 @@ try {
       const caseId = 'tc_wf_seldd_c3d';
       const { axes, verdict } = runReplayVerdict('c3d', s.url, {
         schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
-        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
+        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
       }, {
         caseId, channel: 'web',
         intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
@@ -359,7 +360,7 @@ try {
       const caseId = 'tc_wf_seldd_c3e';
       const { axes, verdict } = runReplayVerdict('c3e', s.url, {
         schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
-        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
+        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
       }, {
         caseId, channel: 'web',
         intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
@@ -379,7 +380,7 @@ try {
       const caseId = 'tc_wf_seldd_c3f';
       const { axes, verdict } = runReplayVerdict('c3f', s.url, {
         schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
-        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
+        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
       }, {
         caseId, channel: 'web',
         intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
@@ -404,7 +405,7 @@ try {
     const { axes, verdict } = runReplayVerdict('c3g', sut.url, {
       schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
       // 末步不载 text（缺 option）：多选项浮层里没给 option。修前误点首项返 unique（假绿），修后 ambiguous 绝不点。
-      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, semantic: { kind: 'text', name: '请选择', exact: true } }],
+      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
     }, {
       caseId, channel: 'web',
       intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
diff --git a/tests/_golden/wf-set-node-field.golden.mjs b/tests/_golden/wf-set-node-field.golden.mjs
index d5d0336..1aff523 100644
--- a/tests/_golden/wf-set-node-field.golden.mjs
+++ b/tests/_golden/wf-set-node-field.golden.mjs
@@ -169,6 +169,7 @@ try {
     if (setf.semantic.exact !== false) throw new Error(`setNodeField exact 缺省应 false（未给 exact 入参），实际 ${setf.semantic.exact}`);
     if (setf.nth !== undefined) throw new Error(`setNodeField 单字段不给 nth（严格唯一，未给 nth 入参不载 nth），实际带 nth=${setf.nth}`);
     if (setf.dropdownUnit !== undefined) throw new Error('setNodeField 不得带 dropdownUnit（走 fill 非 selectOption）');
+    if (setf.nodeName !== NODE) throw new Error(`setNodeField 编译产物应带 nodeName「${NODE}」（drawer-lock-hardening D3 供给通道，编译期 run 态 openNode 成功后写入），实际 ${setf.nodeName}`);
     assertEventsDocAgainstSchema(ev);
     const rep = readJson(reportFile);
     if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
@@ -231,8 +232,9 @@ try {
     { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
     { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
   ]);
-  // setNodeField fill 事件（末步，intent_3）：无 nth（严格唯一/多匹配 ambiguous）；semantic label 载 placeholder + exact。
-  const setFieldEvent = () => ({ stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false } });
+  // setNodeField fill 事件（末步，intent_3）：无 nth（严格唯一/多匹配 ambiguous）；semantic label 载 placeholder + exact；
+  // nodeName 载当前节点标题（drawer-lock-hardening D3/D8：既有金牌手编 events 补齐，供标题锚域锁读取）。
+  const setFieldEvent = () => ({ stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false }, nodeName: NODE });
   // 全局取证（synthesizeSkeleton 缺省加的两条硬断言，手编路径显式带上——setNodeField intent 的 PASS 靠它 + 门内 ap）。
   const GLOBALS = [{ kind: 'noPageError', op: 'absent' }, { kind: 'noErrorEnvelope', op: 'envelopeOk' }];
 
@@ -349,8 +351,9 @@ try {
       schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
       events: [
         { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
-        // 抽屉未开（未 addNode/openNode）→ 字段缺席 → 缺席守卫回 none（waitFor 抛不得穿出崩整轮）。
-        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false } },
+        // 抽屉未开（未 addNode/openNode）→ 标题锚域内缺席 → 缺席守卫回 none（waitFor 抛不得穿出崩整轮）；
+        // nodeName 载 NODE（drawer-lock-hardening D8 既有金牌补齐）——域内确实无此标题，仍归 none，非 nodeName 缺席那支。
+        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false }, nodeName: NODE },
       ],
     }, {
       caseId, channel: 'web',
```

### 4.5 `tests/fixtures/fake-sut/server.mjs` + `CONTRACT.md`（五反面场景纯加法）

```diff
diff --git a/tests/fixtures/fake-sut/CONTRACT.md b/tests/fixtures/fake-sut/CONTRACT.md
index b758b0b..f53f90c 100644
--- a/tests/fixtures/fake-sut/CONTRACT.md
+++ b/tests/fixtures/fake-sut/CONTRACT.md
@@ -30,6 +30,12 @@
 4. 计数一致：`.lf-node` 的 DOM 实数 = 成功拖落次数（真并行网关开始按 +2）；`.lf-graph[data-node-count]` 每次落节点后按 DOM 实数刷新（golden 双向可数：locator count 与属性值互证）。
 5. 连线（wf-connect-nodes）：每个 `.lf-node` 渲 `.lf-node-anchor-hover` 锚点；`mousedown` 锚点 → `mouseup` 落在另一个 `.lf-node`（非自身）→ `.lf-canvas-overlay` 内新增一个 `.lf-edge`。自连（源=目标）或落点非节点 → 不落边（否定行为，连线 fail-closed 反证）。纯 DOM 只断边数增，不携 source/target（连对哪两个的确定性取证挂账真机 window.lf）。
 6. 节点配置抽屉（wf-open-node）：单击 `.lf-node` 节点体 → 详情页出现/更新 `.hr-drawer__content-wrapper`（内含 `.lf-node-drawer__title` 文本 = 该节点 `.lf-node-content` 标题）——registry 真机 SOP「点中心开抽屉」最小复现。锚点 `.lf-node-anchor-hover` 单击不开（连线专属）；连线拖拽 down/up 目标不同元素 → click 事件落共同祖先 overlay、`closest('.lf-node')` 不中 → 不误开（DOM 规范行为，对既有通路零干扰）。抽屉与列表页建单抽屉同类名但异页，画布页域内唯一（回放身份回读干净）。抽屉反面模式（评审 F3/coverage）：由场景控反面考场（replay 的 nav 走 `pathOf` 剥 query 不能用 URL query，故用场景）——`drawernone` 单击节点不开抽屉（「点了不开」反面）、`drawersuperset` 抽屉标题 = 节点名 + `副本`（含 label 子串但非精确，钉身份回读须精确非子串）；既有场景一律缺省行为。
+7. 冒牌抽屉跨边界反面场景（drawer-lock-hardening，GRILL D7）：详情页画布外（不在 `.lf-canvas-overlay` 域内）另挂第二个可见 `.hr-drawer__content-wrapper`「冒牌抽屉」，复现挂账描述的「另一可见抽屉」（真机形态如同页测试面板/新增抽屉并存）。冒牌抽屉的字段/触发器与真节点抽屉共用构建函数 `buildNodeSelect`，不做特判；场景行为即挂账接缝复现，不为金牌预定裁定倒着裁。五场景（既有场景一律缺省行为、零影响）：
+   - `twinfield`：真节点抽屉 `ddempty` 形态（点开但无字段无下拉，仍显示该节点标题）；冒牌抽屉画布外预挂（页面初次渲染即出现，早于真抽屉）、不含节点标题，挂一个同占位符「请输入接口的URL」字段 + 一个「请选择」触发器（可点、可选、值可回读）。
+   - `twinboth`：真节点抽屉（点击后出现）与冒牌抽屉（画布外预挂，先于真抽屉出现）各挂一个同占位符字段 + 各一个「请选择」触发器；冒牌抽屉不含节点标题。
+   - `twintitle`：单击节点不开抽屉（`drawernone` 半形态复用）；冒牌抽屉画布外预挂、含节点标题精确文本（固定复用面板项名「模型节点」）。
+   - `twinlate`：单击节点开真抽屉（`ddempty` 形态：无字段无下拉，显示该节点标题）；与开抽屉的同一次点击事件处理器内，同刻动态挂出第二个含该节点标题精确可见文本的冒牌抽屉（带同占位符字段 + 「请选择」触发器）——点击前不存在（DOM 序晚于真抽屉，因同一处理器内先建真抽屉后建冒牌），钉「点击后才出现的冒牌」。
+   - `twinghost`：单击节点不开抽屉（`drawernone` 半形态复用）；冒牌抽屉画布外预挂、含节点标题精确文本（该文本节点自身 `display:none` 隐藏——wrapper 可见、标题文本不可见），并同 `twinfield` 一样挂一个同占位符字段 + 一个「请选择」触发器（不挂字段/触发器则「宽域锁不问标题只问抽屉可见」在本场景会因压根没有字段而巧合吐缺席，不构成红证；补上后宽域锁会真把这唯一字段/触发器当命中）。
 
 分工与边界（沿既有条款）：
 
diff --git a/tests/fixtures/fake-sut/server.mjs b/tests/fixtures/fake-sut/server.mjs
index c501b6a..aa75744 100644
--- a/tests/fixtures/fake-sut/server.mjs
+++ b/tests/fixtures/fake-sut/server.mjs
@@ -26,6 +26,23 @@ const SCENARIOS = new Set([
   // replay-nth-visible-hardening fix#2：抽屉挂一枚 display:none 的隐藏 .hr-select 触发器（占 DOM 序 index 0）+
   //   真·可见触发器——触发器域锁未限可见时误命中隐藏触发器，限 :visible 后只命中可见触发器。
   'ddhidden',
+  // drawer-lock-hardening（GRILL D7，设计评审修订三扩五）：详情页画布外挂第二个可见
+  //   .hr-drawer__content-wrapper 冒牌抽屉，钉 openNode/selectNodeDropdown/setNodeField 三原子域锁
+  //   跨抽屉边界（codex-sol MED#2 挂账）。冒牌抽屉字段/触发器与真节点抽屉共用构建函数不特判，
+  //   纯加法、既有场景零行为差。
+  //   twinfield：真节点抽屉 ddempty 形态（无字段无下拉）+ 冒牌抽屉挂唯一同 placeholder 字段与「请选择」触发器
+  //     （可点可选可回读）——钉 setNodeField/selectNodeDropdown 跨抽屉误命中；
+  //   twinboth：真节点抽屉与冒牌抽屉各挂一个同 placeholder 字段 + 各一「请选择」触发器（评审修订：冒牌
+  //     补挂触发器）——钉「域内唯一才动手」正面半边（set 与 select 各自的正面半边）；
+  //   twintitle：单击节点不开抽屉（drawernone 半形态）+ 冒牌抽屉（画布外、预挂）含节点标题精确文本——
+  //     钉 openNode 开错抽屉归因假绿（只覆盖『点击前已存在』的冒牌）；
+  //   twinlate（评审修订新增）：单击节点开真抽屉（ddempty 形态：无字段无下拉），同刻（同一次点击的
+  //     同一事件处理器内）动态挂出含该节点标题精确可见文本的冒牌抽屉（带同 placeholder 字段 + 「请选择」
+  //     触发器）——钉『点击后才出现的冒牌』：openNode 预点基线 0 过、点后域内 count=2 证不出归因；
+  //     set/select 域级 count=2 → ambiguous；
+  //   twinghost（评审修订新增）：单击节点不开抽屉（drawernone 半形态，画布外预挂冒牌）+ 冒牌抽屉含节点
+  //     标题精确文本但该文本 display:none 隐藏——钉『隐藏文本命中』假绿（标题文本自身须可见才算命中）。
+  'twinfield', 'twinboth', 'twintitle', 'twinlate', 'twinghost',
 ]);
 
 // 背景轮询 denylist 的合成形态（绝不引真 site.json，护栏 #7）：watchNetworkForensics 用它把 /auths/poll 归 background。
@@ -241,8 +258,11 @@ function clientMain() {
     // 剥 query（bin/replay.mjs:382），故不能用 URL query，改用场景（既有场景一律缺省行为、零影响）：
     //   缺省场景（happy 等）单击节点开抽屉、标题 = 节点名（精确）；
     //   'drawernone'     单击节点不开抽屉（模拟 app 无响应——「点了不开」反面，钉回放 action_failed）；
-    //   'drawersuperset' 单击节点开抽屉、标题 = 节点名 + '副本'（含 label 子串但非精确——substring 假绿考场，钉 F1 精确回读）。
-    var drawerMode = scenario === 'drawersuperset' ? 'superset' : scenario === 'drawernone' ? 'none' : '';
+    //   'drawersuperset' 单击节点开抽屉、标题 = 节点名 + '副本'（含 label 子串但非精确——substring 假绿考场，钉 F1 精确回读）；
+    //   'twintitle'      单击节点不开抽屉（drawernone 半形态复用）——冒牌抽屉另含节点标题精确文本钉 openNode 开错抽屉归因假绿。
+    //   'twinghost'      单击节点不开抽屉（drawernone 半形态复用）——冒牌抽屉另含节点标题精确文本但该文本 display:none 隐藏。
+    var drawerMode = scenario === 'drawersuperset' ? 'superset' : (scenario === 'drawernone' || scenario === 'twintitle' || scenario === 'twinghost') ? 'none' : '';
+    var twinlateFakeDrawer = null; // twinlate：点击同刻动态挂出的冒牌抽屉（点击前不存在，与预挂的 twinfield/twinboth/twintitle/twinghost 冒牌不同）
 
     // —— 节点抽屉「请选择」下拉（wf-select-node-dropdown，registry SOP 最小复现）——
     // 触发器 = .hr-select（初值「请选择」，值放 .hr-select__value 子 span 便于精确回读）；点触发器弹可见浮层
@@ -292,7 +312,19 @@ function clientMain() {
       if (!nodeDrawer) { nodeDrawer = el('div', { class: 'hr-drawer__content-wrapper' }); wrap.appendChild(nodeDrawer); }
       nodeDrawer.textContent = '';
       nodeDrawer.appendChild(el('div', { class: 'lf-node-drawer__title' }, titleText));
-      if (scenario === 'ddempty') return; // 抽屉开但无下拉：域内触发器 count=0（execute 预检的「无下拉」半边）
+      // twinlate（D7 评审修订新增）：真抽屉打开的同一次点击事件处理器内，同刻动态挂出含该节点标题
+      //   精确可见文本的冒牌抽屉（点击前不存在——与 twinfield/twinboth/twintitle/twinghost 的『预挂』
+      //   冒牌不同，钉『点击后才出现的冒牌』这条评审新增支线）。只挂一次（singleton，同 nodeDrawer 先例）。
+      if (scenario === 'twinlate' && !twinlateFakeDrawer) {
+        twinlateFakeDrawer = el('div', { class: 'hr-drawer__content-wrapper' });
+        twinlateFakeDrawer.appendChild(el('div', { class: 'fake-node-title' }, titleText));
+        twinlateFakeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
+        buildNodeSelect(twinlateFakeDrawer, '');
+        wrap.appendChild(twinlateFakeDrawer);
+      }
+      // ddempty/twinfield/twinlate：抽屉开但无字段无下拉——域内触发器/字段 count=0（execute 预检的「无下拉/无字段」半边；
+      //   twinfield/twinlate 复用此缺席半边，真节点抽屉空、跨抽屉误命中的唯一候选靠冒牌抽屉，D7 定）。
+      if (scenario === 'ddempty' || scenario === 'twinfield' || scenario === 'twinlate') return;
       // 节点抽屉下拉纯加法：缺省单下拉；ddtwin 挂两触发器 + 预挂一层 stale 隐藏浮层含目标（两浮层各现一次）。
       // ddhidden（replay-nth-visible-hardening fix#2 复现）：先挂一枚 display:none 的隐藏 .hr-select 触发器占
       //   DOM 序 index 0，再挂真·可见触发器——触发器域锁未限可见时 .hr-select count=2、nth=0 误命中隐藏触发器
@@ -347,6 +379,39 @@ function clientMain() {
     //   全页 getByPlaceholder count=2 必 ambiguous、唯域锁 .hr-drawer__content-wrapper 内 count=1 才 unique，
     //   钉「回放走域锁专用门 doSetNodeField、非全页门」。纯加法、只 setclash 场景挂、既有场景零影响。
     if (scenario === 'setclash') wrap.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
+    // —— 冒牌抽屉（drawer-lock-hardening D7，纯加法反面场景）——详情页画布外（挂 wrap，同 setclash 位置
+    //   先例）再挂第二个可见 .hr-drawer__content-wrapper，真机形态如同页测试面板/新增抽屉并存；字段/
+    //   触发器与真节点抽屉共用构建函数 buildNodeSelect 不特判。本块只覆盖『点击前已预挂』的四场景
+    //   （twinfield/twinboth/twintitle/twinghost）；twinlate 的冒牌是点击同刻动态挂出，见上方 overlay
+    //   click 处理器内 twinlateFakeDrawer。既有场景（非 twin*）零行为差。
+    var TWIN_TITLE_NODE = '模型节点'; // twintitle/twinghost 冒牌抽屉标题固定复用面板项名（金牌据此选同名节点考场）
+    if (scenario === 'twinfield' || scenario === 'twinboth' || scenario === 'twintitle' || scenario === 'twinghost') {
+      var fakeDrawer = el('div', { class: 'hr-drawer__content-wrapper' });
+      if (scenario === 'twintitle') {
+        // 冒牌抽屉含节点标题精确文本——钉 openNode 回读假绿：另一可见抽屉恰含 label（不含字段/触发器，
+        // 本场景只考 openNode 自身，select/set 两原子不会被前置门放行到达）。
+        fakeDrawer.appendChild(el('div', { class: 'fake-node-title' }, TWIN_TITLE_NODE));
+      } else if (scenario === 'twinghost') {
+        // twinghost（评审修订新增）：冒牌抽屉含节点标题精确文本，但该文本节点自身 display:none 隐藏
+        // ——wrapper 可见但文本不可见，钉『标题文本自身须可见』收紧（D2 修订）。同时补挂一个同 placeholder
+        // 字段 + 一个「请选择」触发器（与 twinfield 同构）：若只挂隐藏标题不挂字段/触发器，旧宽域锁在这
+        // 具体夹具里也会因「压根没有字段」而巧合吐 none——不构成红证；补字段/触发器后，旧宽域锁（不问
+        // 标题、只问「抽屉可见」）会真把这唯一字段/触发器当成домen 命中，走完全程真假绿，红证成立。
+        var titleEl = el('div', { class: 'fake-node-title' }, TWIN_TITLE_NODE);
+        titleEl.setAttribute('style', 'display:none');
+        fakeDrawer.appendChild(titleEl);
+        fakeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
+        buildNodeSelect(fakeDrawer, '');
+      } else {
+        // twinfield/twinboth：冒牌抽屉不含节点标题，只挂同 placeholder 字段（钉 setNodeField/
+        // selectNodeDropdown 跨抽屉误命中）+ 一个「请选择」触发器（可点可选可回读，让旧宽域锁走完
+        // 全程真假绿；评审修订：twinboth 冒牌也补挂触发器，钉 selectNodeDropdown 域内唯一才动手的
+        // 正面半边——真节点抽屉此时是 ddempty 形态，无字段无下拉）。
+        fakeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
+        if (scenario === 'twinfield' || scenario === 'twinboth') buildNodeSelect(fakeDrawer, '');
+      }
+      wrap.appendChild(fakeDrawer);
+    }
     app.appendChild(wrap);
   }
 
```

### 4.6 五份 prd（新签 `prd-drawer-lock-hardening.json` + 四份重签 testChecksums/evidence）

```diff
diff --git a/loop/prd-drawer-lock-hardening.json b/loop/prd-drawer-lock-hardening.json
new file mode 100644
index 0000000..3e774b2
--- /dev/null
+++ b/loop/prd-drawer-lock-hardening.json
@@ -0,0 +1,54 @@
+{
+  "schemaVersion": 1,
+  "task": "drawer-lock-hardening（light）：画布三原子 workflow.openNode/selectNodeDropdown/setNodeField 域锁跨抽屉边界硬化。挂账：codex-sol 异构冗余评审 MED#2（2026-07-10，loop/prd-wf-set-node-field.json observability 第二条）——doSetNodeField（lib/replay-actions.mjs）/compileWorkflowSetNodeField（lib/compile-atoms.mjs）的域锁用宽 .hr-drawer__content-wrapper，匹配所有抽屉而非当前节点配置抽屉；若另一可见抽屉恰有唯一同 placeholder 字段，域内 count===1 会填错抽屉的字段、精确回读仍成立→假绿；openNode/selectNodeDropdown/setNodeField 三原子同型设计局限。修法（GRILL D1-D8 决策全录）：编译门与回放门同刻把域锁收窄到当前节点抽屉专属锚——标题锚 = 可见的 .hr-drawer__content-wrapper 且内含【自身也可见】的当前节点标题精确文本（D2，复用 openNode 已冻双证回读锚下沉为三原子共用域锁，评审修订加『标题文本自身可见』内层限定，堵 wrapper 可见但标题藏在隐藏节点的假命中）；nodeName 供给通道 = 编译期 run 态 nodeDrawerLabel（openNode 成功开抽屉后写入，纳入 createCompileRun 的 mark()/rollback() 快照）+ 回放期事件既有冻结字段 nodeName（D3，零 schema 改动）；nodeName 缺席判据 = 字段缺席/非 string/trim() 后为空三者任一 → 硬阻断 action_failed，绝不回落宽域锁（D4 修订）；openNode 侧加预点基线归因守卫（单击前先数可见且含精确标题的抽屉，count>0 即证不出点后归因）+ 点后域内恰一（D5）；select/set 两原子先过抽屉域三态（count===0→none、>1→ambiguous、===1→字段/触发器级既有闸一字不动，D6）；fake-sut 加五个纯加法反面场景 twinfield/twinboth/twintitle/twinlate/twinghost（D7，画布外挂第二个可见 .hr-drawer__content-wrapper 冒牌抽屉，字段/触发器与真节点抽屉共用构建函数不特判）。红先行金牌 tests/_golden/drawer-lock-hardening.golden.mjs（G1-G11，拆 20 条独立子用例：G3a/b、G7a/b/c-1/c-2、G8a/b、G9a/b/c/d、G10a/b）——反面用例一律钉精确路由 NEEDS_HUMAN（不只断不 PASS）；涉冒牌字段/触发器的用例一律加宽域候选零落笔/唯一落笔取证断言（wideCandidateValues/wideTriggerValues，纯加法证据字段，axes 无冻结 schema 约束）。红先行实证：改前 20/20 败（旧宽域锁/旧回读命中冒牌抽屉、旧编译门 exit 0 产 events 等假绿实锤，红证留存）。既有三金牌（wf-set-node-field/wf-select-node-dropdown/replay-nth-visible-hardening）手编 select/set 回放 events 补 nodeName + 编译产物断言加严一条 nodeName 钉位（D8，棘轮只加严）；波及 fake-sut server.mjs/CONTRACT.md 的既有冻结 prd（prd-p5-replay/prd-replay-nth-visible-hardening）与既有三原子 prd（prd-wf-set-node-field/prd-wf-select-node-dropdown）一并重签。不做：workflow.assertNodeFieldValue（另契约）；不碰 bin/verdict.mjs 四态判定树（裁判零 LLM、裁定语义零改动）；不碰 events.schema.json（零改动）；不驱真机（纯 hermetic）。决策全录 docs/plans/drawer-lock-hardening/proposed/GRILL.md（含设计评审修订，codex-sol@max 2026-07-14，处置录 docs/plans/drawer-lock-hardening/review/）。",
+  "specPath": "docs/plans/drawer-lock-hardening/plan.md",
+  "testChecksums": {
+    "tests/_golden/drawer-lock-hardening.golden.mjs": "71d7a8255ee8c3f9b50be62b7cfdafc77dafb98aafba46e725fb176a0fec8eec",
+    "tests/fixtures/fake-sut/server.mjs": "84b8b5ab1861f3577b6a2cc239228e9551f19f184607a46076134f7038508e75",
+    "tests/fixtures/fake-sut/CONTRACT.md": "88d335faa58735ba980cb15f53726faf96621acbe570eaa2f86edac8ab72a7ab"
+  },
+  "observability": [
+    {
+      "dimension": "真机采样（route:human，与既有 openNode/selectNodeDropdown/setNodeField observability 合并行程，行程本身不因本契约新起）：节点抽屉真实容器类名/字段清单/多同占位符字段真机锚点仍未采样。标题锚承袭 openNode 已冻真机假设（节点抽屉显示节点标题、精确文本可命中），本契约不新增假设面。残余假设面（评审修订明示）：可见地展示当前节点精确标题的抽屉即视为该节点的抽屉（身份锚模型）——若某冒牌抽屉可见正文恰含该精确标题且域内恰一，身份锚原理上不可分辨；要再收窄只能靠真机采样节点抽屉专属结构锚（已拒夹具自造类锚 .lf-node-drawer，D2），该采样仍挂本行程。若真机标题带前后缀，openNode 本就开不出 unique——属既有暴露面、非本契约新增。",
+      "route": "human"
+    },
+    {
+      "dimension": "挂账原文处置：codex-sol 异构冗余评审 MED#2（2026-07-10，loop/prd-wf-set-node-field.json observability 第二条）——doSetNodeField/compileWorkflowSetNodeField 域锁用宽 .hr-drawer__content-wrapper 匹配所有抽屉、跨抽屉误命中假绿——本契约在此收口：三原子编译门与回放门同刻收窄到标题锚域锁，G1-G11 红先行金牌逐条钉住旧实现的假绿路径并在新实现下转绿。此条挂账标记为已处置（非再挂账）。",
+      "route": "human"
+    }
+  ],
+  "stories": [
+    {
+      "id": "s1-drawer-lock-hardening-e2e",
+      "desc": "G1-G11（21 条独立子用例，checkAsync 隔离防短路）红先行金牌：G1/G2/G3a/G3b（twinfield 跨抽屉误命中反面）、G4/G11（twinboth 域内唯一才动手正面半边）、G5/G6（twintitle 开错抽屉归因反面）、G8a/G8b/G9a/G9b/G9c/G9d（twinlate 点后歧义+域级多匹配）、G10a/G10b（twinghost 隐藏标题文本拒认）、G7a/G7b/G7c-1/G7c-2/G7d（happy 场景缺/空串/纯空白/非 string nodeName fail-closed 钉桩）。反面用例精确钉 verdict 恰 NEEDS_HUMAN（INDETERMINATE/AMBIGUOUS_ACTION 分场景钉 reason）；涉冒牌字段/触发器用例加宽域候选零落笔/唯一落笔取证（含 length 钉位，防空数组对 .some() 恒假通过）。fake-sut 五反面场景（twinfield/twinboth/twintitle/twinlate/twinghost，纯加法，既有场景零行为差）+ CONTRACT.md 登记。既有三金牌（wf-set-node-field/wf-select-node-dropdown/replay-nth-visible-hardening）补 nodeName + 编译产物 nodeName 钉位加严；wf-open-node/画布族涟漪（wf-add-node/wf-connect-nodes/wf-open-smoke/flow-bridge）零行为差复跑。红先行：实现前 tests/_golden/drawer-lock-hardening.golden.mjs 20/20 败（红证留存运行输出，逐条对应旧实现的具体假绿路径——旧宽域锁/旧回读命中冒牌抽屉返 unique、旧编译门 exit 0 产 events 等）；accept 收口后 --red-verified 通过。loop 内 codex-sol@medium L2 测试质量咨询（非裁判）指出 G9a/G9b 宽域候选快照断言漏 length 钉位（空数组对 `.some()` 恒假通过）+ G7 缺「非 string」nodeName 分支覆盖，均属真发现、已补 G9a/G9b length 钉位 + 新增 G7d（20→21 条），复跑仍全绿；另指出编译侧 domain>1/隐藏标题分支未被『不经 openNode 级联』的用例直接命中（仅经 run 态缺失级联间接触达）——记为已知残余覆盖缺口，未在本轮补（需新夹具场景或新测试手法，超出本契约已批准范围，留档待下一轮决策）。",
+      "lane": "implementation",
+      "acceptance": [
+        "node tests/_golden/drawer-lock-hardening.golden.mjs",
+        "node tests/_golden/wf-set-node-field.golden.mjs",
+        "node tests/_golden/wf-select-node-dropdown.golden.mjs",
+        "node tests/_golden/replay-nth-visible-hardening.golden.mjs",
+        "node tests/_golden/wf-open-node.golden.mjs",
+        "node tests/_golden/wf-add-node.golden.mjs",
+        "node tests/_golden/wf-connect-nodes.golden.mjs",
+        "node tests/_golden/wf-open-smoke.golden.mjs",
+        "node tests/_golden/flow-bridge.golden.mjs"
+      ],
+      "passes": true,
+      "evidence": "gate@2026-07-13T23:01:29.751Z 全部 acceptance exit 0"
+    },
+    {
+      "id": "s2-regression-and-selftest",
+      "desc": "全链回归零行为差（fake-sut 双冻文件影响面：p5-replay 夹具回归 + p5-replay-coverage fail-safe 不变量 + e2e-chain 全链 + report-workflow-structure 集 18 COMPILE_KNOWN_ATOMS 不变）+ 裁判零 LLM 链路自检 selftest --tier1。",
+      "lane": "implementation",
+      "acceptance": [
+        "node tests/_golden/p5-replay.golden.mjs",
+        "node tests/_golden/p5-replay-coverage.golden.mjs",
+        "node tests/_golden/e2e-chain.golden.mjs",
+        "node tests/_golden/report-workflow-structure.golden.mjs",
+        "node bin/casey.mjs selftest --tier1"
+      ],
+      "passes": true,
+      "evidence": "gate@2026-07-13T23:02:49.318Z 全部 acceptance exit 0"
+    }
+  ]
+}
diff --git a/loop/prd-p5-replay.json b/loop/prd-p5-replay.json
index fbc4859..0489ef8 100644
--- a/loop/prd-p5-replay.json
+++ b/loop/prd-p5-replay.json
@@ -6,8 +6,8 @@
     "tests/_golden/p5-replay.golden.mjs": "8a368f628ba19b0d487744e9e74e873966bb0fc4cb4d6d42e7ce1456ed1529c1",
     "tests/_golden/p5-replay-coverage.golden.mjs": "3e46e9a7fdf6824ed17e3a3c83e406ff55e95a2e5bb279d6bbdb92d67f7e2706",
     "tests/_golden/fixtures/p5/replay-cases.json": "931c708956e6abb0fa2fad0e4ad081b203da884d9a08894dd0828a5e216524b0",
-    "tests/fixtures/fake-sut/server.mjs": "a1c4266905bb6022bc1c8612ca0cc66eb36cad7cfaf6be36c9b8e3c2ce11e00f",
-    "tests/fixtures/fake-sut/CONTRACT.md": "905e0dd72c830ef166f9585eb28587f3b8026b776685824b641026a3658dc598",
+    "tests/fixtures/fake-sut/server.mjs": "84b8b5ab1861f3577b6a2cc239228e9551f19f184607a46076134f7038508e75",
+    "tests/fixtures/fake-sut/CONTRACT.md": "88d335faa58735ba980cb15f53726faf96621acbe570eaa2f86edac8ab72a7ab",
     "tests/_golden/fixtures/seams/events.fixture.json": "49545e6efe597c33d9eeaaff65e9f8f9e268e125509533ccf54026a70023dd14"
   },
   "observability": [
@@ -34,7 +34,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T04:38:15.340Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:48:35.662Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-failsafe-coverage",
@@ -44,7 +44,7 @@
         "node tests/_golden/p5-replay-coverage.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T04:38:15.940Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:48:36.291Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-replay-nth-visible-hardening.json b/loop/prd-replay-nth-visible-hardening.json
index 36854a9..0afbc00 100644
--- a/loop/prd-replay-nth-visible-hardening.json
+++ b/loop/prd-replay-nth-visible-hardening.json
@@ -3,8 +3,8 @@
   "task": "replay-nth-visible-hardening（light）：`selectNodeDropdown` 同域收尾三修（两 med backlog + 一条注释失准），全部红先行。fix#1 非法 `nth` 静默降级 index 0 → 硬阻断 fail-closed（`lib/replay-actions.mjs` `doSelectNodeDropdown` 落 `action_failed` 不点、`lib/compile-atoms.mjs` `compileWorkflowSelectNodeDropdown` 落 blocker exit 65 零 events），与「多匹配→ambiguous、越界→blocker」口径一致、绝不猜首项；`nth` 缺省仍默认 0（registry 明载，C2 金牌钉，不动）。fix#2 触发器域锁 `.hr-drawer__content-wrapper .hr-select` 未限可见 → 补 `:visible`（照选项侧已有 `.hr-select-option:visible` 先例，两门同刻），封隐藏/teleport 触发器误命中。fix#3 `tests/fixtures/fake-sut/server.mjs` `ambiguous` 场景注释 `resolution=fallback_first` → `ambiguous` 订正（通用门 `gateAndAct` count>1 吐 `ambiguous`、`p3-compile` 已钉、CONTEXT.md 第 79 行定多匹配唯一合法字面量=`ambiguous`；纯注释无冻结断言）。红先行夹具加法：`ddhidden` 场景（抽屉先挂 `display:none` 隐藏 `.hr-select` 触发器占 DOM 序 index 0、再挂真可见触发器）——既有场景零行为差、破 `prd-p5-replay` 的 `server.mjs` checksum 故重签。本契约与 B 契约都碰 `lib/replay-actions.mjs`/`lib/compile-atoms.mjs`，各自 worktree 隔离、主环 3-way 合并。决策 docs/plans/replay-nth-visible-hardening/proposed/GRILL.md（D1-D3）、验收 plan.md（C1-C5）。",
   "specPath": "docs/plans/replay-nth-visible-hardening/plan.md",
   "testChecksums": {
-    "tests/_golden/replay-nth-visible-hardening.golden.mjs": "3f447bfe78c1c8abbf819da9abc0d70c36d2a3c7d45681cab73f7aac3b124790",
-    "tests/fixtures/fake-sut/server.mjs": "a1c4266905bb6022bc1c8612ca0cc66eb36cad7cfaf6be36c9b8e3c2ce11e00f"
+    "tests/_golden/replay-nth-visible-hardening.golden.mjs": "78cc7d18fcbf87ecfbe686c6fa37f3ef6410d6d0214ff4c57a5b9b96c5c360c6",
+    "tests/fixtures/fake-sut/server.mjs": "84b8b5ab1861f3577b6a2cc239228e9551f19f184607a46076134f7038508e75"
   },
   "stories": [
     {
@@ -15,7 +15,7 @@
         "node tests/_golden/replay-nth-visible-hardening.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T05:07:12.178Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:37:24.778Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-resign-and-regression",
@@ -34,7 +34,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T05:16:07.837Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:47:27.992Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-wf-select-node-dropdown.json b/loop/prd-wf-select-node-dropdown.json
index de30398..7659e93 100644
--- a/loop/prd-wf-select-node-dropdown.json
+++ b/loop/prd-wf-select-node-dropdown.json
@@ -3,7 +3,7 @@
   "task": "wf-select-node-dropdown（light）：画布维度第四原子 workflow.selectNodeDropdown——节点配置抽屉里选 HEREN「请选择」下拉（GRILL D1/D3/D4/D5）。COMPILE_KNOWN_ATOMS 16→17（分派表加法，纯加法零冻结 schema 改动）：复用 events.action=click 承载（nth 载下拉下标、text 载 option、semantic 载触发器锚），不走 selectOption（冻结 dropdownUnit 无 nth 槽、required fieldLabel/optionText 冲突）。doSelectNodeDropdown 专用回放门按 ev.atom 分发（域锁 .hr-drawer__content-wrapper 内第 nth 个 .hr-select 触发器——nth 路 A 确定性位置消歧 + 限可见浮层 .hr-select-option 作用域唯一才点 + 缺席守卫不抛穿 + 触发器值精确回读不再「请选择」且精确含 option），不复用通用 doSelect（全页 combobox 门必兜空/撞既有分类下拉）。编译门 compileWorkflowSelectNodeDropdown 与回放门同刻（同域锁 + 同可见浮层作用域 + 同精确回读）。fake-sut 节点抽屉「请选择」下拉纯加法夹具 + 反面场景（ddmulti 选项多匹配 / ddabsent 目标缺席 / ddwrong 选错项写错值 / ddtwin 两触发器孪生浮层 / ddempty 抽屉开无下拉）。例翻：五金牌「集 16」翻 17（agent.openToolPicker 不可编译长寿反例不翻、只翻计数）+ 六 prd 重签（flow-bridge/wf-add-node/wf-connect-nodes/wf-open-smoke/wf-open-node 棘轮 + p5-replay 夹具 checksum）。决策 docs/plans/wf-select-node-dropdown/proposed/GRILL.md。",
   "specPath": "docs/plans/wf-select-node-dropdown/plan.md",
   "testChecksums": {
-    "tests/_golden/wf-select-node-dropdown.golden.mjs": "e5fa51e8322bdfb197d412e594be39a2569f72a1c861248b9c74a008459df3b6"
+    "tests/_golden/wf-select-node-dropdown.golden.mjs": "4e0cf69975ecb71014c2dc7ed07948046a21261f26a25bb48bf770cdb6aba73f"
   },
   "observability": [
     {
@@ -25,7 +25,7 @@
         "node tests/_golden/wf-open-smoke.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-09T11:04:55.364Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:33:47.491Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-resign-and-regression",
@@ -42,7 +42,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-09T11:07:38.890Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:36:49.849Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-wf-set-node-field.json b/loop/prd-wf-set-node-field.json
index 28edcb5..f3c276e 100644
--- a/loop/prd-wf-set-node-field.json
+++ b/loop/prd-wf-set-node-field.json
@@ -3,7 +3,7 @@
   "task": "wf-set-node-field（light）：画布维度第五原子 workflow.setNodeField——节点配置抽屉里按 placeholder 填某文本字段、填后精确 value 回读（GRILL D1/D3/D4/D5）。COMPILE_KNOWN_ATOMS 17→18（分派表加法，纯加法零冻结 schema 改动）：复用 events.action=fill 承载（value 载填入值、semantic:{kind:label,name:placeholder,exact} 载占位符锚 + 精确开关、nth 仅显式给时载字段下标消歧），冻结 schema 的 allOf 对 fill 只要求 value。doSetNodeField 专用回放门按 ev.atom 分发（域锁 .hr-drawer__content-wrapper 内 getByPlaceholder(placeholder,{exact}) + 字段级唯一闸：未给 nth 时 count===1 才填 / count>1 ambiguous 绝不填首项、显式给 nth 时确定性位置消歧、越界 none + 缺席守卫不抛穿 + 填后 inputValue() 精确等于填入值），不复用通用 doAct（占位符锚不是 semanticLocator 命中口径、通用门必兜空/撞别处同名）。编译门 compileWorkflowSetNodeField 与回放门同刻。value 非文本节点（assert.textVisible 看不到）→ 填值正确性由门内精确 value 回读（动作轴 identityReadback）确定性守住、金牌按动作轴核；判内核纯编译/回放（不新增断言 kind、不碰 verdict/replay 采集，L1 断言 workflow.assertNodeFieldValue = 另契约）。fake-sut 节点抽屉可填字段纯加法夹具 + 反面场景（setmulti 多匹配 / setclash 域锁反例 / 复用 ddempty 无字段）。例翻：六金牌「集 17」翻 18（agent.openToolPicker 不可编译长寿反例不翻、只翻计数）+ 七 prd 重签（flow-bridge/wf-add-node/wf-connect-nodes/wf-open-smoke/wf-open-node/wf-select-node-dropdown 棘轮 + p5-replay 夹具 checksum）。决策 docs/plans/wf-set-node-field/proposed/GRILL.md。",
   "specPath": "docs/plans/wf-set-node-field/plan.md",
   "testChecksums": {
-    "tests/_golden/wf-set-node-field.golden.mjs": "83889d46dbfd6dedd84761fb6e0e0ddceee3f1090ae9409f33f7a0480141f13e"
+    "tests/_golden/wf-set-node-field.golden.mjs": "06486bcb22816ea4e751ab90f75597d90f629031027374a0a7e35cb8a686aa33"
   },
   "observability": [
     {
@@ -30,7 +30,7 @@
         "node tests/_golden/wf-open-smoke.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T04:48:05.788Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:24:08.091Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-resign-and-regression",
@@ -47,7 +47,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T04:51:05.079Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T22:27:10.295Z 全部 acceptance exit 0"
     }
   ]
 }
```
## 五、门禁证据摘录（gate/tier1，`passes` 字段只由 `loop-kit/bin/gate.mjs` 写入）

5/5 prd GREEN（最终态，含 codex-sol@medium L2 强化后的重跑）：

- `loop/prd-drawer-lock-hardening.json`（新签）：
  - `s1-drawer-lock-hardening-e2e` | passes=true | evidence=gate@2026-07-13T23:01:29.751Z 全部 acceptance exit 0
  - `s2-regression-and-selftest` | passes=true | evidence=gate@2026-07-13T23:02:49.318Z 全部 acceptance exit 0
- `loop/prd-wf-set-node-field.json`：
  - `s1-setnodefield-atom-e2e` | passes=true | evidence=gate@2026-07-13T22:24:08.091Z 全部 acceptance exit 0
  - `s2-resign-and-regression` | passes=true | evidence=gate@2026-07-13T22:27:10.295Z 全部 acceptance exit 0
- `loop/prd-wf-select-node-dropdown.json`：
  - `s1-selectnodedropdown-atom-e2e` | passes=true | evidence=gate@2026-07-13T22:33:47.491Z 全部 acceptance exit 0
  - `s2-resign-and-regression` | passes=true | evidence=gate@2026-07-13T22:36:49.849Z 全部 acceptance exit 0
- `loop/prd-replay-nth-visible-hardening.json`：
  - `s1-three-fixes-red-golden` | passes=true | evidence=gate@2026-07-13T22:37:24.778Z 全部 acceptance exit 0
  - `s2-resign-and-regression` | passes=true | evidence=gate@2026-07-13T22:47:27.992Z 全部 acceptance exit 0
- `loop/prd-p5-replay.json`：
  - `s1-replay` | passes=true | evidence=gate@2026-07-13T22:48:35.662Z 全部 acceptance exit 0
  - `s2-failsafe-coverage` | passes=true | evidence=gate@2026-07-13T22:48:36.291Z 全部 acceptance exit 0

红先行实证：改前 `tests/_golden/drawer-lock-hardening.golden.mjs` 20/20 败（旧宽域锁/旧回读命中冒牌抽屉返
`unique`+`PASS`、旧编译门 exit 0 产 events 等假绿实锤，红证留存运行输出）；accept 阶段以 `--red-verified` 收口。

收尾全仓 ratchet 总核（node 遍历全部 70 份 `prd-*.json` 的 `testChecksums` 逐键比对实际 sha256）：209 项
检查、0 处不符；2 处「缺失」为既有真机产物文件（`prd-tc_wf_history_version.json` /
`prd-tc_wf_publish_states.json` 指向的 `cases/*/expected.frozen.json`），与本契约无关、历史既有缺口，非
本轮引入。`events.schema.json` 与 `bin/verdict.mjs` 全程零改动（`git diff` 空）。

### tier1 独立复跑（本轮评审材料准备时现场重跑，非引用旧日志）

```
$ node bin/casey.mjs selftest --tier1

casey selftest --tier1 —— hermetic 链路自检（零外部依赖）

ok   统一语言注册表完整（term-lint --registry exit 0）
ok   弃用别名被 term-lint 拦红（黑名单方向）
ok   熔断器可清零（breaker --reset exit 0）
ok   质量门禁消费 1-story 契约并翻绿（gate exit 0 + passes 翻 true）
ok   裁判零 LLM：verdict.mjs 闭包无 LLM/网络客户端（verdict-purity-guard exit 0）

selftest --tier1: 全链路 GREEN —— 确定性内核 + 统一语言双向有效。
```

## 六、提交记录（供对照，非评审对象本身）

commit `0301936` drawer-lock-hardening：画布三原子域锁收窄到当前节点抽屉专属锚（标题锚），堵跨抽屉误命中假绿。
四份既有 prd 重签 testChecksums 的 sha256 变更已在提交说明逐项记账（`wf-set-node-field.golden.mjs` /
`wf-select-node-dropdown.golden.mjs` / `replay-nth-visible-hardening.golden.mjs` / 双冻 `server.mjs`）。

（评审料到此为止，全文完）

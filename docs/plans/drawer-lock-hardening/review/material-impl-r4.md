# drawer-lock-hardening 实现审 r4 料（A1/A2 修复复核）

## 背景
被审实现：lib/replay-actions.mjs 与 lib/compile-atoms.mjs（编译门/回放门两门同刻）。
本轮修 fable 汇裁 r3 采信的两条 HIGH（详见 docs/plans/drawer-lock-hardening/review/arb-impl-r3.md）。
裁判零 LLM：bin/verdict.mjs 四态判定树未动、events.schema.json 未动（硬约束）。

## 汇裁 r3 两条 HIGH（要点摘录）
- A1（HIGH，血统 r2 HIGH 未闭合子项）：nodeDrawerDomain 旧实现返回惰性 nth(k) Locator，pinNodeDrawer 扫描后才 elementHandle() 做身份锚定——锚定时刻晚于检查时刻。扫描到锚定窗内同标题原位替换让 rootHandle 从一开始就是冒牌，后续「一直是锚定那个节点」的物理同一校验证不出「就是扫描时检查过的那个节点」。
  修法：nodeDrawerDomain 改 elementHandles() 一次性快照 + 逐句柄页内核验可见标题、返回物理句柄数组；pinNodeDrawer 直接对扫描时句柄盖 pin，删掉锚定时刻惰性重解析；配 disposeDomain 释放纪律。
- A2（HIGH，新报，假绿向）：verifyPinnedNodeDrawer 旧两闸（①域内唯一者物理同一 ②pin 全页恰一）验不到 pin 挂点——pin 搬到无标题嵌套 wrapper 后候选计数域 2→1，ambiguous 洗成 unique 假绿。
  修法：pin 全页恰一之后补第三闸——唯一 pin 承载者须与 rootHandle 物理同一（elementHandle 等价判定），否则 action_failed。

## 逐条处置
| 条目 | 处置 | 落点 |
|---|---|---|
| A1 nodeDrawerDomain 一次性句柄快照 | 已修 | 两门 nodeDrawerDomain 改 structural.elementHandles() 快照 + 逐句柄 h.evaluate 页内核验「wrapper 自身可见 + 内含自身可见的精确标题文本」，返回物理句柄数组；未通过核验的候选当场 dispose |
| A1 pinNodeDrawer 直接盖 pin | 已修 | rootHandle = domain[0]（扫描时句柄本身），直接 setAttribute 盖 pin，删掉 `await domain[0].elementHandle()` 重解析；verifyPinnedNodeDrawer 的 cur[0] 已是句柄，直接 sameDomNode，删掉重解析 |
| A1 释放纪律 disposeDomain | 已修 | 新增 disposeDomain(handles)；只用计数的调用方（doOpenNode 基线/轮询/点后、compileWorkflowOpenNode 同段）每次调用后全量释放；verifyPinnedNodeDrawer finally 释放 cur；pinNodeDrawer 非 ok 路径释放 rootHandle |
| A2 挂点闸（第三闸） | 已修 | verifyPinnedNodeDrawer 在 pinCount===1 之后补：carrier = page.$(`[pin]`)；!sameDomNode(carrier, rootHandle) → action_failed；carrier finally 释放。两门同刻 |
| four 门对齐 | 已对齐 | doSetNodeField/doSelectNodeDropdown（回放）+ compileWorkflowSetNodeField/compileWorkflowSelectNodeDropdown（编译）经共享 pinNodeDrawer/verifyPinnedNodeDrawer 自动继承三闸 |

## 红先行金牌（已落，红证/绿证均实测）
- pinmove 场景（fake-sut/server.mjs 新增）：真抽屉 A 含两个同占位符字段，其一包在 A 内部无标题嵌套 .hr-drawer__content-wrapper B 内；MutationObserver 监听 pin，A 一被钉即摘 A 的 pin 挂到 B（全页始终恰一，零时序依赖）。
- G18a（回放 setNodeField）/G18b（编译 setNodeField）：修前红证 = G18a 返 unique 假绿（wideCandidateValues=["","https://api.example.com/drawer-lock"]，B 内字段被真填）、G18b exit 0 产 events；修后 = G18a action_failed + 宽域候选恰 2 项全空 + verdict NEEDS_HUMAN/INDETERMINATE，G18b blocker exit 65 零 events。
- 全量金牌 35 过/0 败（含 G1-G17 回归全绿）。

## 评审指令
核 A1/A2 是否真堵死、有无新引入缺陷（尤其：句柄泄漏、时序竞态、既有场景行为回归、页内可见性判据与 Playwright :visible 语义偏差）。结论 PASS 或 NEEDS CHANGES，带文件行。

## 修复 diff（lib/replay-actions.mjs + lib/compile-atoms.mjs）
```diff
diff --git a/lib/compile-atoms.mjs b/lib/compile-atoms.mjs
index 4a07f17..8840473 100644
--- a/lib/compile-atoms.mjs
+++ b/lib/compile-atoms.mjs
@@ -145,36 +145,55 @@ async function dragConnectByLabels(page, fromLabel, toLabel) {
 // 同算法，两门同刻，各自持有 page 引用故各自一份实现——既有代码 locatorFor/canvasBox 等同类重复的
 // 先例）：可见 .hr-drawer__content-wrapper 且内含【自身也可见】的精确标题文本——filter({has}) 只证
 // 「后代存在该文本」、不证该文本节点自身可见，故逐候选二次核验标题文本自身 :visible（评审 F1/D2 修订）。
+// A1 修复（汇裁 r4，与 lib/replay-actions.mjs 同算法两门同刻）：一次性快照物理句柄（elementHandles 单次
+// 解析即锚定全体候选），再逐句柄页内核验可见标题——不再经任何惰性 nth(k) Locator 重解析。扫描即锚定：
+// 快照之后任何同标题替换 → 句柄脱附 → 后续核验/盖章抛错落 fail-closed，构造上封死「检查过的节点 ≠
+// 锚定的节点」。返回物理句柄数组，调用方用完 disposeDomain 释放；未通过标题核验的候选当场释放不外泄。
 async function nodeDrawerDomain(page, label) {
   const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
-  const n = await structural.count().catch(() => 0);
+  const handles = await structural.elementHandles().catch(() => []);
   const matches = [];
-  for (let k = 0; k < n; k++) {
-    const w = structural.nth(k);
-    // 任一命中可见即纳入（实现评审 r1 codex/pi 双路 MED#1，与回放门同刻修）：只查 .first() 会在
-    // 「隐藏同文案在前+可见真标题在后」的合法抽屉上误吐不可见 → 整抽屉被排出域（fail-closed 假阴）。
-    // 契约语义「内含自身可见的精确标题文本」= 存在量词，遍历全部命中、任一可见即成立。
-    const hits = w.getByText(label, { exact: true });
-    const hn = await hits.count().catch(() => 0);
-    let anyVisible = false;
-    for (let i = 0; i < hn; i++) {
-      if (await hits.nth(i).isVisible().catch(() => false)) { anyVisible = true; break; }
-    }
-    if (anyVisible) matches.push(w);
+  for (const h of handles) {
+    let ok = false;
+    try {
+      ok = await h.evaluate((el, lbl) => {
+        const visible = (node) => {
+          if (!node || node.nodeType !== 1) return false;
+          const style = window.getComputedStyle(node);
+          if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
+          const rect = node.getBoundingClientRect();
+          return rect.width > 0 && rect.height > 0;
+        };
+        // wrapper 自身须可见（对齐 Playwright :visible：非空盒 + visibility 未隐藏）
+        if (!visible(el)) return false;
+        // 内含【自身也可见】的精确标题文本（存在量词：任一命中可见即成立，堵隐藏同文案在前的合法抽屉误拒）
+        const norm = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
+        const nodes = [el, ...el.querySelectorAll('*')];
+        for (const node of nodes) {
+          if (norm(node.textContent) === lbl && visible(node)) return true;
+        }
+        return false;
+      }, label);
+    } catch { ok = false; }
+    if (ok) matches.push(h); else await disposeHandle(h);
   }
   return matches;
 }
-// 抗漂移绑定（实现评审 r1 codex HIGH#1，与 lib/replay-actions.mjs 同算法两门同刻）：nodeDrawerDomain
-// 返回动态 structural.nth(k) Locator，惰性重解析——域计数通过之后、落笔之前同标题抽屉动态前插会让
-// nth(0) 漂移到冒牌且不重判三态（TOCTOU 假绿）。域内恰一判定通过后把唯一候选钉到 DOM 节点本身
-// （一次性 pin 属性），后续字段/触发器定位与落笔全以 pin 锚为根；stamp 后重判（域内恰一且唯一者恰带
-// 本次 pin）才算绑定成立。pin 是惰性 data 属性，不进 events/observed/报告，不影响 SUT 行为。
+// 抗漂移绑定（实现评审 r1 codex HIGH#1，r4 汇裁 A1 收口，与 lib/replay-actions.mjs 同算法两门同刻）：
+// nodeDrawerDomain 已返回扫描时锚定的物理句柄（不再是惰性 nth(k) Locator），域内恰一判定通过后直接对该
+// 句柄盖 pin，后续字段/触发器定位与落笔全以 pin 锚为根；因盖 pin 用的就是扫描时核验过的句柄本身，身份
+// 锚定不再晚于检查时刻。pin 是惰性 data 属性，不进 events/observed/报告，不影响 SUT 行为。
 const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
 let nodeDrawerPinSeq = 0;
 async function disposeHandle(handle) {
   if (!handle) return;
   try { await handle.dispose(); } catch { /* 清理失败不得覆盖原裁定 */ }
 }
+// 释放 nodeDrawerDomain 返回的物理句柄数组（A1 释放纪律：只用计数的调用方每次调用后全量释放，防泄漏）。
+async function disposeDomain(handles) {
+  if (!handles) return;
+  for (const h of handles) await disposeHandle(h);
+}
 async function sameDomNode(page, left, right) {
   if (!left || !right) return false;
   try { return await page.evaluate((pair) => pair[0] === pair[1], [left, right]); } catch { return false; }
@@ -196,32 +215,39 @@ async function locatorStillBound(page, locator, index, expectedHandle, exactCoun
     await disposeHandle(current);
   }
 }
-// r2 HIGH 加固（codex r2，pinclone 反面钉此缝，与 lib/replay-actions.mjs 同刻）：pin 属性可被页面脚本
-// 复制/搬移，只验「域内唯一者带 pin」会被复制骗过——重判改验两条物理口径：①域内唯一者与初次绑定的
-// ElementHandle【物理同一】（DOM 节点身份不可伪造）；②pin 全页恰一（属性被复制会把域外节点纳入按
-// pin 定根的定位——全页非恰一即绑定证不出，fail-closed 拒动）。
+// 三闸齐备（r2 HIGH 物理化 + r4 汇裁 A2 补挂点闸，与 lib/replay-actions.mjs 同刻）：pin 属性可被页面脚本
+// 复制/搬移，重判验三条物理口径——①域内唯一者与被钉 ElementHandle【物理同一】（防替换，cur[0] 经 A1
+// 已是扫描时锚定的句柄，直接比对）；②pin 全页恰一（防复制，属性被复制会把域外节点纳入按 pin 定根的
+// 定位）；③唯一 pin 承载者与被钉物理节点【物理同一】（A2 防搬移：pin 搬到无标题嵌套 wrapper 后域计数仍
+// 唯一、pinCount 仍 1，前两闸皆过，唯挂点闸能识破——否则 bound.root 按 pin 定位到嵌套 wrapper、候选域缩窄
+// 洗成 unique 假绿）。任一闸不过 → action_failed，绝不带疑落笔。
 async function verifyPinnedNodeDrawer(page, label, pin, rootHandle) {
   const cur = await nodeDrawerDomain(page, label);
-  if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
-  let same = false;
-  let h = null;
   try {
-    h = await cur[0].elementHandle();
-    same = await sameDomNode(page, h, rootHandle);
-  } catch { same = false; }
-  finally { await disposeHandle(h); }
-  if (!same) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉物理节点=漂移/被替换，证不出归属
-  const pinCount = await page.locator(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`).count().catch(() => 0);
-  if (pinCount !== 1) return { status: 'action_failed', count: pinCount }; // pin 被复制/丢失，绑定证不出
-  return { status: 'ok', count: 1 };
+    if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
+    if (!(await sameDomNode(page, cur[0], rootHandle))) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉物理节点=漂移/被替换，证不出归属
+    const pinCount = await page.locator(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`).count().catch(() => 0);
+    if (pinCount !== 1) return { status: 'action_failed', count: pinCount }; // pin 被复制/丢失，绑定证不出
+    let carrier = null;
+    try {
+      carrier = await page.$(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`);
+      if (!(await sameDomNode(page, carrier, rootHandle))) return { status: 'action_failed', count: 1 }; // A2：唯一 pin 承载者不是被钉物理节点=被搬移，证不出归属
+    } finally { await disposeHandle(carrier); }
+    return { status: 'ok', count: 1 };
+  } finally {
+    await disposeDomain(cur);
+  }
 }
 async function pinNodeDrawer(page, label) {
   const domain = await nodeDrawerDomain(page, label);
-  if (domain.length !== 1) return { status: domain.length === 0 ? 'none' : 'ambiguous', count: domain.length, root: null, pin: null, rootHandle: null };
+  if (domain.length !== 1) {
+    const count = domain.length;
+    await disposeDomain(domain);
+    return { status: count === 0 ? 'none' : 'ambiguous', count, root: null, pin: null, rootHandle: null };
+  }
+  const rootHandle = domain[0]; // A1：扫描时核验过的物理句柄本身，直接盖 pin（删掉锚定时刻的惰性重解析）
   const pin = `pin_${(nodeDrawerPinSeq++).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
-  let rootHandle = null; // 被钉抽屉的物理句柄（r2 HIGH）：后续重判与落笔都以它为身份地面真值
   try {
-    rootHandle = await domain[0].elementHandle();
     await rootHandle.evaluate((el, args) => el.setAttribute(args[0], args[1]), [NODE_DRAWER_PIN_ATTR, pin]);
   } catch {
     await disposeHandle(rootHandle);
@@ -665,8 +691,10 @@ async function compileWorkflowOpenNode(run, params) {
   // D5 预点基线归因守卫（评审修订同刻）：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
   // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
   const baseline = await nodeDrawerDomain(run.page, label);
-  if (baseline.length > 0) {
-    run.blockers.push(`workflow.openNode「${label}」预点基线：单击前已有 ${baseline.length} 个可见且含精确标题的抽屉，证不出点后归因 → 硬阻断（fail-closed，route:human）`);
+  const baselineCount = baseline.length;
+  await disposeDomain(baseline); // A1 释放纪律：只用计数即释放
+  if (baselineCount > 0) {
+    run.blockers.push(`workflow.openNode「${label}」预点基线：单击前已有 ${baselineCount} 个可见且含精确标题的抽屉，证不出点后归因 → 硬阻断（fail-closed，route:human）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
@@ -676,15 +704,19 @@ async function compileWorkflowOpenNode(run, params) {
     const t0 = Date.now();
     for (;;) {
       const cur = await nodeDrawerDomain(run.page, label);
-      if (cur.length >= 1 || Date.now() - t0 > 5000) break;
+      const curCount = cur.length;
+      await disposeDomain(cur); // A1 释放纪律：轮询每拍即释放
+      if (curCount >= 1 || Date.now() - t0 > 5000) break;
       await sleep(100);
     }
   });
   // D5 点后恰一（评审修订同刻）：回读要求标题锚域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏
   // 文本已被 nodeDrawerDomain 的精确+可见双限定堵死，评审 F1/D2）。
   const after = await nodeDrawerDomain(run.page, label);
-  if (after.length !== 1) {
-    run.blockers.push(`workflow.openNode「${label}」后置核验：点后域内含精确标题的可见抽屉 count=${after.length}（非恰一）证不出归因 → 硬阻断（fail-closed）`);
+  const afterCount = after.length;
+  await disposeDomain(after); // A1 释放纪律
+  if (afterCount !== 1) {
+    run.blockers.push(`workflow.openNode「${label}」后置核验：点后域内含精确标题的可见抽屉 count=${afterCount}（非恰一）证不出归因 → 硬阻断（fail-closed）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
diff --git a/lib/replay-actions.mjs b/lib/replay-actions.mjs
index 7efbc9b..1652aff 100644
--- a/lib/replay-actions.mjs
+++ b/lib/replay-actions.mjs
@@ -126,38 +126,58 @@ async function doConnectNodes(page, ev) {
 // 隐藏节点」的假命中），故逐候选二次核验标题文本自身 :visible。openNode/selectNodeDropdown/setNodeField
 // 三原子共用此域锁（编译门 lib/compile-atoms.mjs 有同算法的独立一份实现，两门同刻；既有代码
 // semanticLocator/canvasBox 等同类重复的先例）。
+// A1 修复（汇裁 r4）：一次性快照物理句柄（elementHandles 单次解析即锚定全体候选），再逐句柄页内核验
+// 可见标题——不再经任何惰性 nth(k) Locator 重解析。扫描即锚定：快照之后任何同标题替换 → 句柄脱附 →
+// 后续核验/盖章抛错落 fail-closed，构造上封死「检查过的节点 ≠ 锚定的节点」（身份连续性在扫描原点即成立，
+// 堵初次域扫描后到盖章前同标题抽屉原位替换的 TOCTOU 残留）。返回物理句柄数组，调用方用完 disposeDomain
+// 释放；未通过标题核验的候选当场释放不外泄。可见性判据对齐 Playwright :visible（非空盒 + visibility 未隐藏）。
 async function nodeDrawerDomain(page, label) {
   const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
-  const n = await structural.count().catch(() => 0);
+  const handles = await structural.elementHandles().catch(() => []);
   const matches = [];
-  for (let k = 0; k < n; k++) {
-    const w = structural.nth(k);
-    // 任一命中可见即纳入（实现评审 r1 codex/pi 双路 MED#1）：只查 .first() 会在「隐藏同文案在前+可见
-    // 真标题在后」的合法抽屉上误吐不可见 → 整抽屉被排出域（fail-closed 假阴、合法操作被误拒）。
-    // 契约语义是「内含自身可见的精确标题文本」= 存在量词，故遍历全部命中、任一可见即成立。
-    const hits = w.getByText(label, { exact: true });
-    const hn = await hits.count().catch(() => 0);
-    let anyVisible = false;
-    for (let i = 0; i < hn; i++) {
-      if (await hits.nth(i).isVisible().catch(() => false)) { anyVisible = true; break; }
-    }
-    if (anyVisible) matches.push(w);
+  for (const h of handles) {
+    let ok = false;
+    try {
+      ok = await h.evaluate((el, lbl) => {
+        const visible = (node) => {
+          if (!node || node.nodeType !== 1) return false;
+          const style = window.getComputedStyle(node);
+          if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
+          const rect = node.getBoundingClientRect();
+          return rect.width > 0 && rect.height > 0;
+        };
+        // wrapper 自身须可见
+        if (!visible(el)) return false;
+        // 内含【自身也可见】的精确标题文本（存在量词：任一命中可见即成立，堵隐藏同文案在前的合法抽屉
+        // 被误拒假阴；只查首命中会在「隐藏同文案在前+可见真标题在后」上把整抽屉排出域）。
+        const norm = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
+        const nodes = [el, ...el.querySelectorAll('*')];
+        for (const node of nodes) {
+          if (norm(node.textContent) === lbl && visible(node)) return true;
+        }
+        return false;
+      }, label);
+    } catch { ok = false; }
+    if (ok) matches.push(h); else await disposeHandle(h);
   }
   return matches;
 }
-// 抗漂移绑定（实现评审 r1 codex HIGH#1）：nodeDrawerDomain 返回的是动态 structural.nth(k) Locator，
-// Playwright 惰性重解析——域计数通过之后、click/fill 之前若有同标题抽屉动态【前插】，nth(0) 会漂移到
-// 冒牌抽屉且不重判三态，落笔+精确回读成立=假绿（TOCTOU）。绑定法：域内恰一判定通过后，把唯一候选
-// 钉到 DOM 节点本身（一次性 pin 属性，值一次一换），后续字段/触发器定位与落笔全部以 pin 锚为根——
-// pin 锚只解析到被钉的那个节点，前插冒牌物理上接不到动作。stamp 本身经 elementHandle 解析、也可能落在
-// 已漂移的节点上，故 stamp 后必须重判（域内恰一且该唯一者恰带本次 pin）才算绑定成立。pin 是惰性
-// data 属性：不进事件/取证/报告，不影响 SUT 行为；值含单调序号+随机尾，同节点后续动作重钉即覆盖。
+// 抗漂移绑定（实现评审 r1 codex HIGH#1，r4 汇裁 A1 收口）：nodeDrawerDomain 已返回扫描时锚定的物理
+// 句柄（不再是惰性 nth(k) Locator），域内恰一判定通过后直接对该句柄盖 pin（值一次一换），后续字段/触发器
+// 定位与落笔全部以 pin 锚为根——pin 锚只解析到被钉的那个节点，前插/替换冒牌物理上接不到动作。因盖 pin
+// 用的就是扫描时核验过的句柄本身，身份锚定不再晚于检查时刻。pin 是惰性 data 属性：不进事件/取证/报告，
+// 不影响 SUT 行为；值含单调序号+随机尾，同节点后续动作重钉即覆盖。
 const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
 let nodeDrawerPinSeq = 0;
 async function disposeHandle(handle) {
   if (!handle) return;
   try { await handle.dispose(); } catch { /* 清理失败不得覆盖原裁定 */ }
 }
+// 释放 nodeDrawerDomain 返回的物理句柄数组（A1 释放纪律：只用计数的调用方每次调用后全量释放，防泄漏）。
+async function disposeDomain(handles) {
+  if (!handles) return;
+  for (const h of handles) await disposeHandle(h);
+}
 async function sameDomNode(page, left, right) {
   if (!left || !right) return false;
   try { return await page.evaluate((pair) => pair[0] === pair[1], [left, right]); } catch { return false; }
@@ -179,32 +199,39 @@ async function locatorStillBound(page, locator, index, expectedHandle, exactCoun
     await disposeHandle(current);
   }
 }
-// r2 HIGH 加固（codex r2，pinclone 反面钉此缝）：pin 属性可被页面脚本复制/搬移，只验「域内唯一者带
-// pin」会被复制骗过——重判改验两条物理口径：①域内唯一者与初次绑定的 ElementHandle【物理同一】
-// （DOM 节点身份不可伪造）；②pin 全页恰一（root 定位器按 pin 属性选择，属性被复制会把域外节点纳入
-// 定位——全页非恰一即绑定证不出，fail-closed 拒动）。
+// 三闸齐备（r2 HIGH 物理化 + r4 汇裁 A2 补挂点闸）：pin 属性可被页面脚本复制/搬移，重判验三条物理口径——
+// ①域内唯一者与被钉 ElementHandle【物理同一】（防替换，DOM 节点身份不可伪造，cur[0] 经 A1 已是扫描时
+// 锚定的句柄，直接比对）；②pin 全页恰一（防复制，属性被复制会把域外节点纳入按 pin 定根的定位）；
+// ③唯一 pin 承载者与被钉物理节点【物理同一】（A2 防搬移：pin 搬到无标题嵌套 wrapper 后域计数仍唯一、
+// pinCount 仍 1，前两闸皆过，唯挂点闸能识破——否则 bound.root 按 pin 定位到嵌套 wrapper、候选域缩窄洗成
+// unique 假绿）。任一闸不过 → action_failed，绝不带疑落笔。
 async function verifyPinnedNodeDrawer(page, label, pin, rootHandle) {
   const cur = await nodeDrawerDomain(page, label);
-  if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
-  let same = false;
-  let h = null;
   try {
-    h = await cur[0].elementHandle();
-    same = await sameDomNode(page, h, rootHandle);
-  } catch { same = false; }
-  finally { await disposeHandle(h); }
-  if (!same) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉物理节点=漂移/被替换，证不出归属
-  const pinCount = await page.locator(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`).count().catch(() => 0);
-  if (pinCount !== 1) return { status: 'action_failed', count: pinCount }; // pin 被复制/丢失，绑定证不出
-  return { status: 'ok', count: 1 };
+    if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
+    if (!(await sameDomNode(page, cur[0], rootHandle))) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉物理节点=漂移/被替换，证不出归属
+    const pinCount = await page.locator(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`).count().catch(() => 0);
+    if (pinCount !== 1) return { status: 'action_failed', count: pinCount }; // pin 被复制/丢失，绑定证不出
+    let carrier = null;
+    try {
+      carrier = await page.$(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`);
+      if (!(await sameDomNode(page, carrier, rootHandle))) return { status: 'action_failed', count: 1 }; // A2：唯一 pin 承载者不是被钉物理节点=被搬移，证不出归属
+    } finally { await disposeHandle(carrier); }
+    return { status: 'ok', count: 1 };
+  } finally {
+    await disposeDomain(cur);
+  }
 }
 async function pinNodeDrawer(page, label) {
   const domain = await nodeDrawerDomain(page, label);
-  if (domain.length !== 1) return { status: domain.length === 0 ? 'none' : 'ambiguous', count: domain.length, root: null, pin: null, rootHandle: null };
+  if (domain.length !== 1) {
+    const count = domain.length;
+    await disposeDomain(domain);
+    return { status: count === 0 ? 'none' : 'ambiguous', count, root: null, pin: null, rootHandle: null };
+  }
+  const rootHandle = domain[0]; // A1：扫描时核验过的物理句柄本身，直接盖 pin（删掉锚定时刻的惰性重解析）
   const pin = `pin_${(nodeDrawerPinSeq++).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
-  let rootHandle = null; // 被钉抽屉的物理句柄（r2 HIGH）：后续重判与落笔都以它为身份地面真值
   try {
-    rootHandle = await domain[0].elementHandle();
     await rootHandle.evaluate((el, args) => el.setAttribute(args[0], args[1]), [NODE_DRAWER_PIN_ATTR, pin]);
   } catch {
     await disposeHandle(rootHandle);
@@ -261,7 +288,9 @@ async function doOpenNode(page, ev) {
   // D5 预点基线归因守卫：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
   // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
   const baseline = await nodeDrawerDomain(page, label);
-  if (baseline.length > 0) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
+  const baselineCount = baseline.length;
+  await disposeDomain(baseline); // A1 释放纪律：只用计数即释放
+  if (baselineCount > 0) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
   try {
     await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」（GRILL D1 单击定案）
   } catch {
@@ -271,13 +300,17 @@ async function doOpenNode(page, ev) {
   const t0 = Date.now();
   for (;;) {
     const cur = await nodeDrawerDomain(page, label);
-    if (cur.length >= 1 || Date.now() - t0 > 5000) break;
+    const curCount = cur.length;
+    await disposeDomain(cur); // A1 释放纪律：轮询每拍即释放
+    if (curCount >= 1 || Date.now() - t0 > 5000) break;
     await new Promise((r) => setTimeout(r, 100));
   }
   // D5 点后恰一：回读要求域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏文本已被 nodeDrawerDomain
   // 的精确+可见双限定堵死，评审 F1/D2）。
   const after = await nodeDrawerDomain(page, label);
-  if (after.length !== 1) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没开 / 开错抽屉 / 点后歧义，不假 unique
+  const afterCount = after.length;
+  await disposeDomain(after); // A1 释放纪律
+  if (afterCount !== 1) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没开 / 开错抽屉 / 点后歧义，不假 unique
   return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
 }
 
```

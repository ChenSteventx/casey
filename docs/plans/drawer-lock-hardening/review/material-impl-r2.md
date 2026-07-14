# 评审料 impl-r2 —— drawer-lock-hardening 实现评审第二轮（r1 findings 修复复核，light）

> 驱动员核验：第五节 diff 块由 `git diff 0301936..835a8ec -- lib tests loop` 机械导出（逐字节等同工作树提交），2026-07-14。
> 本文件是异构评审的输入料（护栏 #9：只含处置表 + 修复 diff + 红证/门禁证据，不含凭据、不含实现者内心推理）。
> 评审指令另发，不含在本文件内。

## 一、本轮范围（一句话）

对实现评审 r1 的全部 findings（codex gpt-5.6-sol：2 HIGH / 1 MED / 2 LOW；pi deepseek-v4-pro：1 MED，与 codex MED#1 同缺陷面双路共报）逐条采信并修复，红先行新增 6 条金牌钉死，本轮请复核修复是否真闭合、有无新引入缺陷。

r1 基线 commit：`0301936`（上一轮评审对象）；本轮修复 commit：`835a8ec`。

不变边界：不碰 `bin/verdict.mjs`（裁判零 LLM）；不碰 `events.schema.json`；纯 hermetic。

## 二、r1 findings 逐条处置表

| # | 来源/级别 | finding 要点 | 处置 | 修复内容 | 金牌钉位（红先行） |
| --- | --- | --- | --- | --- | --- |
| 1 | codex HIGH#1 | `nodeDrawerDomain` 返回动态 `structural.nth(k)` Locator（惰性重解析），域计数后到 click/fill 前同标题抽屉动态前插 → root 漂移到冒牌且不重判三态 → 落笔+精确回读成立=假绿（TOCTOU） | 采信 | 抗漂移绑定：域内恰一判定通过后把唯一候选钉到 DOM 节点本身（一次性 `data-casey-domain-pin` 属性，值一次一换），后续字段/触发器定位与落笔全以 pin 锚为根（前插冒牌物理接不到动作）；stamp 本身可能落在已漂移节点上，故钉后重判（域内恰一且唯一者恰带本次 pin）绑定才成立；落笔前再重判「域内唯一 + pin 一致」，证不出（count≠1 / pin 失配）→ ambiguous/none/action_failed 绝不落笔。回放门 `doSetNodeField`/`doSelectNodeDropdown` 与编译门 `compileWorkflowSetNodeField`/`compileWorkflowSelectNodeDropdown` 同刻；编译门 emit customAct 内另有落笔时刻重判兜底（抛错走既有 action_failed 通道、随后回读必证不出 → blocker）。select 侧对「选项单击」（真正改写触发器值的落笔）再重判一次。缺席分支（域内字段/触发器 count=0）返回前重取宽域快照，取证返回时刻现状 | 新 fake-sut 场景 `twindelay`（点击开真抽屉 ddempty 形态，延时 3000ms 把含同标题冒牌抽屉【前插】到真抽屉之前，冒牌带同占位符字段+「请选择」触发器）；G12a（回放 set）/G12b（回放 select）/G12c（编译 select）——修后钉 none + 宽域快照冒牌零落笔 + NEEDS_HUMAN/INDETERMINATE（编译侧 blocker exit 65 零 events） |
| 2 | codex HIGH#2 | `compileWorkflowOpenNode` 只在成功路径写 `run.nodeDrawerLabel`，开始尝试/失败路径不失效旧值：A 开成 B 开败（A 抽屉仍见）→ 后续 set/select 借 A 旧标题过域锁对 A 抽屉真落笔，exit 65 零 events 也已发生编译执行期副作用（违 fail-safe） | 采信 | `compileWorkflowOpenNode` 进函数第一步 `run.nodeDrawerLabel = null`（尝试开始即失效，覆盖预检 blocker/点击失败/点后非恰一全部失败路径），仅「点后恰一」确证成功才写回。`mark()`/`rollback()` 快照既有语义不变 | G13（happy：openNode A 成功 → openNode B=面板有但从未落画布的「SQL查询」预检 blocker → setNodeField 须 run 态标题缺失 blocker 级联 + compile-report notes 无「节点字段已填入」零落笔取证 + exit 65 零 events） |
| 3 | codex MED#1 + pi MED#1（双路共报） | `.getByText(exact).first().isVisible()` 只查首命中：合法抽屉内隐藏同文案在前、可见真标题在后被误排出域 → count 变少/0，合法操作被误拒 NEEDS_HUMAN（fail-closed 假阴） | 采信 | 两份同名 `nodeDrawerDomain`（`lib/replay-actions.mjs` 与 `lib/compile-atoms.mjs`）同刻改为遍历全部命中、任一可见即纳入（契约语义「内含自身可见的精确标题文本」= 存在量词），按 pi 归档附带的修复伪码实现 | 新 fake-sut 场景 `ghostdup`（真抽屉合法、可见标题之前先挂 display:none 同文案隐藏节点占 DOM 序更早）；G14a（回放 openNode unique + set unique + PASS）/G14b（编译 exit 0 + events 产出 + 零 blockers）正面钉「不误伤合法形态」 |
| 4 | codex LOW#1 | `tests/fixtures/fake-sut/server.mjs:399` 注释混入西里尔词 | 采信 | 改简体「当成域内命中」，全文件西里尔字符清零（grep 实证） | 无需金牌（注释文字修正） |
| 5 | codex LOW#2 | `loop/prd-drawer-lock-hardening.json` task 字段「拆 20 条独立子用例」「20/20 败」与 story 21 条自相矛盾 | 采信 | task 字段对齐现行金牌 27 条（G1-G14 全列），红先行账改三轮累计明账（初版 20/20 → L2 补 G7d 成 21 → r1 修复轮增 6 条 6/6 红后修绿成 27）；story desc 同步 | 无需金牌（冻结契约文字对齐） |

## 三、红先行证据（红证摘录，libs 暂回 r1 态 `0301936` 干净重跑）

结果：`drawer-lock-hardening golden: 21 过 / 6 败`（旧 21 条全绿佐证既有面未回归，新 6 条全红）：

- G12a 红形：`实际 {"resolution":"unique","candidateCount":1,"identityReadback":{"ok":true},"wideCandidateValues":["https://api.example.com/drawer-lock"]}` ——旧动态 root 在 5s 字段等待里漂移到前插冒牌、真填其字段回读成立返 unique+PASS（宽域快照实录冒牌字段被真落笔，HIGH#1 假绿实锤）。
- G12b 红形：`实际 {"resolution":"unique",...,"wideTriggerValues":["订单库"]}` ——冒牌触发器被真选中（同上实锤）。
- G12c 红形：`实际 0`（应 exit 65）——旧编译门等待期漂移到冒牌触发器、走完点选回读 exit 0 产 events。
- G13 红形：compile-report notes 实录 `"workflow.setNodeField 节点字段已填入（〈请输入接口的URL〉=〈https://api.example.com/drawer-lock〉，value 精确回读过，域锁「模型节点」)"` 且无 setNodeField blocker——openNode B（SQL查询）blocker 后仍借 A 旧标题对 A 抽屉真落笔（HIGH#2 编译期副作用实锤）。
- G14a 红形：openNode `实际 {"resolution":"action_failed",...}`（应 unique）——合法抽屉被排出域（MED#1 假阴实锤）。
- G14b 红形：`实际 65`（应 exit 0），blockers 实录 `workflow.openNode「模型节点」后置核验：点后域内含精确标题的可见抽屉 count=0（非恰一）`（同上假阴实锤）。

修复后全量重跑：`drawer-lock-hardening golden: 27 过 / 0 败`。

## 四、门禁证据（修复 commit `835a8ec` 后）

- `node loop-kit/bin/gate.mjs --prd loop/prd-drawer-lock-hardening.json` → `gate: GREEN —— story 2/2 过`（含 27 条金牌 + 既有三金牌 + 画布族涟漪 + s2 全链回归 + tier1，全部 acceptance exit 0）。
- 重签闭包（`ratchet affected` 列举，一个不漏）：`server.mjs` → 3 prd（drawer-lock-hardening / p5-replay / replay-nth-visible-hardening）、`CONTRACT.md` → 2 prd、金牌 → 1 prd；三 prd testChecksums 全部重签，`prd-p5-replay` 与 `prd-replay-nth-visible-hardening` gate 复跑均 `GREEN —— story 2/2 过`。
- `node bin/casey.mjs selftest --tier1` → `全链路 GREEN`。
- `node loop-kit/bin/ratchet.mjs verify` → 70 PRD / 191 冻结文件 / 2 问题——两条 `cases/` FILE_MISSING 为既有环境性缺口（真机产物不入库、主树在），非本轮引入（与 r1 备料时相同）。

## 五、修复 diff 全量（`git diff 0301936..835a8ec -- lib tests loop`，机械导出）

```diff
diff --git a/lib/compile-atoms.mjs b/lib/compile-atoms.mjs
index fe53539..3a80569 100644
--- a/lib/compile-atoms.mjs
+++ b/lib/compile-atoms.mjs
@@ -151,11 +151,47 @@ async function nodeDrawerDomain(page, label) {
   const matches = [];
   for (let k = 0; k < n; k++) {
     const w = structural.nth(k);
-    const visible = await w.getByText(label, { exact: true }).first().isVisible().catch(() => false);
-    if (visible) matches.push(w);
+    // 任一命中可见即纳入（实现评审 r1 codex/pi 双路 MED#1，与回放门同刻修）：只查 .first() 会在
+    // 「隐藏同文案在前+可见真标题在后」的合法抽屉上误吐不可见 → 整抽屉被排出域（fail-closed 假阴）。
+    // 契约语义「内含自身可见的精确标题文本」= 存在量词，遍历全部命中、任一可见即成立。
+    const hits = w.getByText(label, { exact: true });
+    const hn = await hits.count().catch(() => 0);
+    let anyVisible = false;
+    for (let i = 0; i < hn; i++) {
+      if (await hits.nth(i).isVisible().catch(() => false)) { anyVisible = true; break; }
+    }
+    if (anyVisible) matches.push(w);
   }
   return matches;
 }
+// 抗漂移绑定（实现评审 r1 codex HIGH#1，与 lib/replay-actions.mjs 同算法两门同刻）：nodeDrawerDomain
+// 返回动态 structural.nth(k) Locator，惰性重解析——域计数通过之后、落笔之前同标题抽屉动态前插会让
+// nth(0) 漂移到冒牌且不重判三态（TOCTOU 假绿）。域内恰一判定通过后把唯一候选钉到 DOM 节点本身
+// （一次性 pin 属性），后续字段/触发器定位与落笔全以 pin 锚为根；stamp 后重判（域内恰一且唯一者恰带
+// 本次 pin）才算绑定成立。pin 是惰性 data 属性，不进 events/observed/报告，不影响 SUT 行为。
+const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
+let nodeDrawerPinSeq = 0;
+async function verifyPinnedNodeDrawer(page, label, pin) {
+  const cur = await nodeDrawerDomain(page, label);
+  if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
+  const got = await cur[0].getAttribute(NODE_DRAWER_PIN_ATTR).catch(() => null);
+  if (got !== pin) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉者=漂移，证不出归属
+  return { status: 'ok', count: 1 };
+}
+async function pinNodeDrawer(page, label) {
+  const domain = await nodeDrawerDomain(page, label);
+  if (domain.length !== 1) return { status: domain.length === 0 ? 'none' : 'ambiguous', count: domain.length, root: null, pin: null };
+  const pin = `pin_${(nodeDrawerPinSeq++).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
+  try {
+    const h = await domain[0].elementHandle();
+    await h.evaluate((el, args) => el.setAttribute(args[0], args[1]), [NODE_DRAWER_PIN_ATTR, pin]);
+  } catch {
+    return { status: 'action_failed', count: 1, root: null, pin: null }; // 钉不上（节点已脱离等）=证不出，不猜
+  }
+  const re = await verifyPinnedNodeDrawer(page, label, pin);
+  if (re.status !== 'ok') return { status: re.status, count: re.count, root: null, pin };
+  return { status: 'ok', count: 1, root: page.locator(`.hr-drawer__content-wrapper[${NODE_DRAWER_PIN_ATTR}="${pin}"]`), pin };
+}
 // D3/D4 修订（drawer-lock-hardening）：run 态当前节点抽屉标题缺失/非 string/trim 后为空 → 硬阻断。
 function nodeDrawerLabelInvalid(label) {
   return typeof label !== 'string' || label.trim() === '';
@@ -565,6 +601,11 @@ async function compileWorkflowConnectNodes(run, params) {
 async function compileWorkflowOpenNode(run, params) {
   const i = run.newIntent();
   const label = String(params.label || '');
+  // 尝试开始即失效旧 run 态标题（实现评审 r1 codex HIGH#2）：A 开成后 B 开败（任一失败路径：预检
+  // blocker/点击失败/点后非恰一）时，若旧值不失效，后续 select/set 会借 A 的旧标题过域锁、对仍开着的
+  // A 抽屉真落笔——即使整体 exit 65 零 events，编译执行期已对错误抽屉产生副作用（违 fail-safe）。
+  // 故进本函数即清空，仅下方「点后恰一」确证成功才写回（G13 钉此语义）。
+  run.nodeDrawerLabel = null;
   // 预检域锁身份门（emit 的 customAct 通路不走定位核验，此处自证——镜像 addNode 源身份门）：
   const domain = run.page.locator('.lf-canvas-overlay').getByText(label, { exact: true });
   const n = await domain.count().catch(() => null);
@@ -641,18 +682,25 @@ async function compileWorkflowSelectNodeDropdown(run, params) {
     return;
   }
   const label = run.nodeDrawerLabel;
-  const domain = await nodeDrawerDomain(run.page, label);
-  if (domain.length === 0) {
+  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续触发器定位/落笔全以 pin 锚为根——
+  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝，与回放门 doSelectNodeDropdown 同刻）。
+  const bound = await pinNodeDrawer(run.page, label);
+  if (bound.status === 'none') {
     run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不点（route:human）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  if (domain.length > 1) {
-    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=${domain.length}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不点（route:human）`);
+  if (bound.status === 'ambiguous') {
+    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=${bound.count}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不点（route:human）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  const root = domain[0];
+  if (bound.status !== 'ok') {
+    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」抽屉抗漂移绑定证不出（钉后重判失配）→ 硬阻断 fail-closed 不点（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  const root = bound.root;
   // 预检域锁触发器门（emit 的 customAct 通路不走定位核验，此处自证——镜像 openNode 域锁 + addNode 源身份门）；
   // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 触发器误命中。
   const triggers = root.locator('.hr-select:visible');
@@ -671,9 +719,21 @@ async function compileWorkflowSelectNodeDropdown(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
+  // 动作时刻重判（r1 HIGH#1）：点触发器前重验域内唯一性 + pin 一致——预检到落笔之间的窗口冒出同
+  // 标题冒牌 → 证不出归属，绝不带疑落笔（与回放门同刻；emit 内亦有落笔前重判兜底）。
+  const preClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin);
+  if (preClick.status !== 'ok') {
+    run.blockers.push(`workflow.selectNodeDropdown 落笔前重判：当前节点「${label}」标题锚域 count=${preClick.count}${preClick.status === 'action_failed' ? '（域内唯一者非被钉抽屉，漂移）' : ''} 证不出归属 → 硬阻断 fail-closed 不点（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
   const spec = { intentId: i, atom: 'workflow.selectNodeDropdown', action: 'click', nth, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: label };
   if (option) spec.text = option;
   await run.emit(spec, async () => {
+    // 落笔时刻重判兜底（r1 HIGH#1）：emit 记账与动作之间仍有窗口，抛错走 emit 既有 action_failed 通道
+    // （随后触发器值回读必证不出 → blocker，fail-closed 收口）。
+    const atAct = await verifyPinnedNodeDrawer(run.page, label, bound.pin);
+    if (atAct.status !== 'ok') throw new Error(`落笔时刻标题锚域重判失败（count=${atAct.count}，${atAct.status}），拒点`);
     await triggers.nth(nth).click({ timeout: 3000 });
     // 可见浮层作用域（防浮层 teleport 到 body 全局 text 撞列表页/孪生浮层）：限可见 .hr-select-option。
     const visibleOptions = run.page.locator('.hr-select-option:visible');
@@ -681,6 +741,9 @@ async function compileWorkflowSelectNodeDropdown(run, params) {
     const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
     const oc = await target.count().catch(() => 0);
     if (oc !== 1) throw new Error(`浮层内目标选项「${option ?? '首项'}」可见 count=${oc} 非唯一/缺席，拒点`);
+    // 选项单击才是真正改写触发器值的落笔，浮层开着的窗口同样重判（与回放门 preOpt 同刻）。
+    const atOpt = await verifyPinnedNodeDrawer(run.page, label, bound.pin);
+    if (atOpt.status !== 'ok') throw new Error(`选项落笔前标题锚域重判失败（count=${atOpt.count}，${atOpt.status}），拒点`);
     await target.first().click({ timeout: 3000 });
   });
   // 后置核验（触发器值回读；registry post：该下拉已选中含 option 的项）：不再「请选择」且【精确】含 option
@@ -737,18 +800,25 @@ async function compileWorkflowSetNodeField(run, params) {
     return;
   }
   const label = run.nodeDrawerLabel;
-  const domain = await nodeDrawerDomain(run.page, label);
-  if (domain.length === 0) {
+  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续字段定位/落笔全以 pin 锚为根——
+  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝，与回放门 doSetNodeField 同刻）。
+  const bound = await pinNodeDrawer(run.page, label);
+  if (bound.status === 'none') {
     run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不填（route:human）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  if (domain.length > 1) {
-    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=${domain.length}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不填（route:human）`);
+  if (bound.status === 'ambiguous') {
+    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=${bound.count}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不填（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
+  if (bound.status !== 'ok') {
+    run.blockers.push(`workflow.setNodeField 当前节点「${label}」抽屉抗漂移绑定证不出（钉后重判失配）→ 硬阻断 fail-closed 不填（route:human）`);
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
-  const root = domain[0];
+  const root = bound.root;
   // 预检域锁字段门（emit 的 customAct 通路不走定位核验，此处自证——镜像 selectNodeDropdown 域锁 + openNode 源身份门）：
   const fields = root.getByPlaceholder(placeholder, { exact });
   const fcount = await fields.count().catch(() => null);
@@ -767,10 +837,22 @@ async function compileWorkflowSetNodeField(run, params) {
     run.notes.push(run.blockers[run.blockers.length - 1]);
     return;
   }
+  // 动作时刻重判（r1 HIGH#1）：落笔（fill）前重验域内唯一性 + pin 一致——预检到落笔之间的窗口冒出同
+  // 标题冒牌 → 证不出归属，绝不带疑落笔（与回放门同刻；emit 内亦有落笔前重判兜底）。
+  const preFill = await verifyPinnedNodeDrawer(run.page, label, bound.pin);
+  if (preFill.status !== 'ok') {
+    run.blockers.push(`workflow.setNodeField 落笔前重判：当前节点「${label}」标题锚域 count=${preFill.count}${preFill.status === 'action_failed' ? '（域内唯一者非被钉抽屉，漂移）' : ''} 证不出归属 → 硬阻断 fail-closed 不填（route:human）`);
+    run.notes.push(run.blockers[run.blockers.length - 1]);
+    return;
+  }
   const spec = { intentId: i, atom: 'workflow.setNodeField', action: 'fill', value, semantic: { kind: 'label', name: placeholder, exact }, nodeName: label };
   if (hasNth) spec.nth = nth;
   const target = () => fields.nth(hasNth ? nth : 0);
   await run.emit(spec, async () => {
+    // 落笔时刻重判兜底（r1 HIGH#1）：emit 记账与动作之间仍有窗口，抛错走 emit 既有 action_failed 通道
+    // （随后字段值回读必证不出 → blocker，fail-closed 收口）。
+    const atAct = await verifyPinnedNodeDrawer(run.page, label, bound.pin);
+    if (atAct.status !== 'ok') throw new Error(`落笔时刻标题锚域重判失败（count=${atAct.count}，${atAct.status}），拒填`);
     await target().fill(instantiate(value, run.ctx), { timeout: 3000 });
   });
   // 后置核验（registry post：该字段被填入值）：字段 value 回读【精确】等于实例化后填入值（非 includes 子串——
diff --git a/lib/replay-actions.mjs b/lib/replay-actions.mjs
index 50efb3c..0f33c7d 100644
--- a/lib/replay-actions.mjs
+++ b/lib/replay-actions.mjs
@@ -132,11 +132,49 @@ async function nodeDrawerDomain(page, label) {
   const matches = [];
   for (let k = 0; k < n; k++) {
     const w = structural.nth(k);
-    const visible = await w.getByText(label, { exact: true }).first().isVisible().catch(() => false);
-    if (visible) matches.push(w);
+    // 任一命中可见即纳入（实现评审 r1 codex/pi 双路 MED#1）：只查 .first() 会在「隐藏同文案在前+可见
+    // 真标题在后」的合法抽屉上误吐不可见 → 整抽屉被排出域（fail-closed 假阴、合法操作被误拒）。
+    // 契约语义是「内含自身可见的精确标题文本」= 存在量词，故遍历全部命中、任一可见即成立。
+    const hits = w.getByText(label, { exact: true });
+    const hn = await hits.count().catch(() => 0);
+    let anyVisible = false;
+    for (let i = 0; i < hn; i++) {
+      if (await hits.nth(i).isVisible().catch(() => false)) { anyVisible = true; break; }
+    }
+    if (anyVisible) matches.push(w);
   }
   return matches;
 }
+// 抗漂移绑定（实现评审 r1 codex HIGH#1）：nodeDrawerDomain 返回的是动态 structural.nth(k) Locator，
+// Playwright 惰性重解析——域计数通过之后、click/fill 之前若有同标题抽屉动态【前插】，nth(0) 会漂移到
+// 冒牌抽屉且不重判三态，落笔+精确回读成立=假绿（TOCTOU）。绑定法：域内恰一判定通过后，把唯一候选
+// 钉到 DOM 节点本身（一次性 pin 属性，值一次一换），后续字段/触发器定位与落笔全部以 pin 锚为根——
+// pin 锚只解析到被钉的那个节点，前插冒牌物理上接不到动作。stamp 本身经 elementHandle 解析、也可能落在
+// 已漂移的节点上，故 stamp 后必须重判（域内恰一且该唯一者恰带本次 pin）才算绑定成立。pin 是惰性
+// data 属性：不进事件/取证/报告，不影响 SUT 行为；值含单调序号+随机尾，同节点后续动作重钉即覆盖。
+const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
+let nodeDrawerPinSeq = 0;
+async function verifyPinnedNodeDrawer(page, label, pin) {
+  const cur = await nodeDrawerDomain(page, label);
+  if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
+  const got = await cur[0].getAttribute(NODE_DRAWER_PIN_ATTR).catch(() => null);
+  if (got !== pin) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉者=漂移，证不出归属
+  return { status: 'ok', count: 1 };
+}
+async function pinNodeDrawer(page, label) {
+  const domain = await nodeDrawerDomain(page, label);
+  if (domain.length !== 1) return { status: domain.length === 0 ? 'none' : 'ambiguous', count: domain.length, root: null, pin: null };
+  const pin = `pin_${(nodeDrawerPinSeq++).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
+  try {
+    const h = await domain[0].elementHandle();
+    await h.evaluate((el, args) => el.setAttribute(args[0], args[1]), [NODE_DRAWER_PIN_ATTR, pin]);
+  } catch {
+    return { status: 'action_failed', count: 1, root: null, pin: null }; // 钉不上（节点已脱离等）=证不出，不猜
+  }
+  const re = await verifyPinnedNodeDrawer(page, label, pin);
+  if (re.status !== 'ok') return { status: re.status, count: re.count, root: null, pin };
+  return { status: 'ok', count: 1, root: page.locator(`.hr-drawer__content-wrapper[${NODE_DRAWER_PIN_ATTR}="${pin}"]`), pin };
+}
 // D4 修订（drawer-lock-hardening）：nodeName 缺席判据 = 字段缺席 / 非 string / trim() 后为空 三者任一
 // → 硬阻断，绝不回落宽域锁（events.schema 只约束 string 类型合法，空串/纯空白类型合法但语义非法）。
 function nodeNameInvalid(nodeName) {
@@ -227,18 +265,29 @@ async function doSelectNodeDropdown(page, ev) {
   // 连宽域快照都不取——尚不知该找哪个占位符/触发器族之外的东西可证）。
   if (nodeNameInvalid(ev.nodeName)) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
   const label = ev.nodeName;
-  const domain = await nodeDrawerDomain(page, label);
+  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续触发器定位/落笔全以 pin 锚为根——
+  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝）。
+  const bound = await pinNodeDrawer(page, label);
   const wideTriggerValues = await wideTriggerSnapshot(page);
-  if (domain.length === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues };
-  if (domain.length > 1) return { resolution: 'ambiguous', candidateCount: domain.length, identityReadback: { ok: false }, wideTriggerValues };
-  const root = domain[0];
+  if (bound.status === 'none') return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues };
+  if (bound.status === 'ambiguous') return { resolution: 'ambiguous', candidateCount: bound.count, identityReadback: { ok: false }, wideTriggerValues };
+  if (bound.status !== 'ok') return { resolution: 'action_failed', candidateCount: bound.count, identityReadback: { ok: false }, wideTriggerValues };
+  const root = bound.root;
   // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 未清理的
   // .hr-select 触发器进入计数/nth 定位（否则 nth 误命中隐藏触发器点不动/错位）；对全可见触发器场景恒等无行为差。
   const triggers = root.locator('.hr-select:visible');
   // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无触发器 → none 单步降级（doOpenNode 守卫先例）。
   try { await triggers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
   const tcount = await triggers.count().catch(() => 0);
-  if (tcount === 0 || nth >= tcount) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues };
+  // 缺席/越界返回前重取宽域快照（r1 HIGH#1 配套取证）：5s 可见等待期间宽域可能已变（如晚到冒牌现身），
+  // 快照取返回时刻现状才能佐证「冒牌触发器零落笔」。
+  if (tcount === 0 || nth >= tcount) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
+  // 动作时刻重判（r1 HIGH#1）：点触发器前重验域内唯一性 + pin 一致——检查后窗口冒出同标题冒牌 →
+  // count=2 证不出归属 ambiguous；被钉抽屉出域/pin 失配 → action_failed。绝不带疑落笔。
+  const preClick = await verifyPinnedNodeDrawer(page, label, bound.pin);
+  if (preClick.status !== 'ok') {
+    return { resolution: preClick.status === 'ambiguous' ? 'ambiguous' : preClick.status === 'none' ? 'none' : 'action_failed', candidateCount: preClick.count, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
+  }
   try {
     await triggers.nth(nth).click({ timeout: 3000 });
   } catch {
@@ -256,6 +305,12 @@ async function doSelectNodeDropdown(page, ev) {
   // （本分支裁判 ap=false 兜底落 NEEDS_HUMAN 仍 fail-safe；resolution 契约合并后升级为精确 AMBIGUOUS_ACTION）。
   // 仅 ①option 指定且域内唯一命中，或 ②浮层恰一项（缺 option 亦然），才走下方 oc===1 通路点选。
   if (oc > 1) return { resolution: 'ambiguous', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
+  // 动作时刻重判之二（r1 HIGH#1）：真正落笔的是选项单击（触发器值由此改写），浮层开着的窗口里同标题
+  // 冒牌现身同样证不出归属——落笔前再验一次域内唯一 + pin 一致。
+  const preOpt = await verifyPinnedNodeDrawer(page, label, bound.pin);
+  if (preOpt.status !== 'ok') {
+    return { resolution: preOpt.status === 'ambiguous' ? 'ambiguous' : preOpt.status === 'none' ? 'none' : 'action_failed', candidateCount: preOpt.count, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
+  }
   try {
     await target.first().click({ timeout: 3000 });
   } catch {
@@ -301,16 +356,21 @@ async function doSetNodeField(page, ev, ctx) {
   // 连宽域快照都不取）。
   if (nodeNameInvalid(ev.nodeName)) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
   const label = ev.nodeName;
-  const domain = await nodeDrawerDomain(page, label);
+  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续字段定位/落笔全以 pin 锚为根——
+  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝）。
+  const bound = await pinNodeDrawer(page, label);
   const wideCandidateValues = await wideFieldSnapshot(page, placeholder, exact);
-  if (domain.length === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues };
-  if (domain.length > 1) return { resolution: 'ambiguous', candidateCount: domain.length, identityReadback: { ok: false }, wideCandidateValues };
-  const root = domain[0];
+  if (bound.status === 'none') return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues };
+  if (bound.status === 'ambiguous') return { resolution: 'ambiguous', candidateCount: bound.count, identityReadback: { ok: false }, wideCandidateValues };
+  if (bound.status !== 'ok') return { resolution: 'action_failed', candidateCount: bound.count, identityReadback: { ok: false }, wideCandidateValues };
+  const root = bound.root;
   const fields = root.getByPlaceholder(placeholder, { exact });
   // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无字段 → 由下方 count 落 none 单步降级（doOpenNode/doSelectNodeDropdown 守卫先例）。
   try { await fields.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
   const fcount = await fields.count().catch(() => 0);
-  if (fcount === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues };
+  // 缺席返回前重取宽域快照（r1 HIGH#1 配套取证）：5s 可见等待期间宽域可能已变（如晚到冒牌现身），
+  // 快照取返回时刻现状才能佐证「冒牌字段零落笔」。
+  if (fcount === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
   if (!hasNth && fcount > 1) {
     // 多匹配未给 nth 绝不填首项。取证：快照全部候选字段 value 佐证「一格未填」（golden C3e 钉「字段值不变」
     //   非空话——candidateValues 全空 = 证明 ambiguous 分支绝没落笔到任何字段）。
@@ -321,6 +381,12 @@ async function doSetNodeField(page, ev, ctx) {
   if (hasNth && nth >= fcount) return { resolution: 'none', candidateCount: fcount, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) }; // 越界
   const target = fields.nth(hasNth ? nth : 0);
   const want = instantiate(ev.value, ctx);
+  // 动作时刻重判（r1 HIGH#1）：落笔（fill）前重验域内唯一性 + pin 一致——检查后窗口冒出同标题冒牌 →
+  // count=2 证不出归属 ambiguous；被钉抽屉出域/pin 失配 → action_failed。绝不带疑落笔。
+  const preFill = await verifyPinnedNodeDrawer(page, label, bound.pin);
+  if (preFill.status !== 'ok') {
+    return { resolution: preFill.status === 'ambiguous' ? 'ambiguous' : preFill.status === 'none' ? 'none' : 'action_failed', candidateCount: preFill.count, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
+  }
   try {
     await target.fill(want, { timeout: 3000 });
   } catch {
diff --git a/loop/prd-drawer-lock-hardening.json b/loop/prd-drawer-lock-hardening.json
index 3e774b2..f3a62b5 100644
--- a/loop/prd-drawer-lock-hardening.json
+++ b/loop/prd-drawer-lock-hardening.json
@@ -1,11 +1,11 @@
 {
   "schemaVersion": 1,
-  "task": "drawer-lock-hardening（light）：画布三原子 workflow.openNode/selectNodeDropdown/setNodeField 域锁跨抽屉边界硬化。挂账：codex-sol 异构冗余评审 MED#2（2026-07-10，loop/prd-wf-set-node-field.json observability 第二条）——doSetNodeField（lib/replay-actions.mjs）/compileWorkflowSetNodeField（lib/compile-atoms.mjs）的域锁用宽 .hr-drawer__content-wrapper，匹配所有抽屉而非当前节点配置抽屉；若另一可见抽屉恰有唯一同 placeholder 字段，域内 count===1 会填错抽屉的字段、精确回读仍成立→假绿；openNode/selectNodeDropdown/setNodeField 三原子同型设计局限。修法（GRILL D1-D8 决策全录）：编译门与回放门同刻把域锁收窄到当前节点抽屉专属锚——标题锚 = 可见的 .hr-drawer__content-wrapper 且内含【自身也可见】的当前节点标题精确文本（D2，复用 openNode 已冻双证回读锚下沉为三原子共用域锁，评审修订加『标题文本自身可见』内层限定，堵 wrapper 可见但标题藏在隐藏节点的假命中）；nodeName 供给通道 = 编译期 run 态 nodeDrawerLabel（openNode 成功开抽屉后写入，纳入 createCompileRun 的 mark()/rollback() 快照）+ 回放期事件既有冻结字段 nodeName（D3，零 schema 改动）；nodeName 缺席判据 = 字段缺席/非 string/trim() 后为空三者任一 → 硬阻断 action_failed，绝不回落宽域锁（D4 修订）；openNode 侧加预点基线归因守卫（单击前先数可见且含精确标题的抽屉，count>0 即证不出点后归因）+ 点后域内恰一（D5）；select/set 两原子先过抽屉域三态（count===0→none、>1→ambiguous、===1→字段/触发器级既有闸一字不动，D6）；fake-sut 加五个纯加法反面场景 twinfield/twinboth/twintitle/twinlate/twinghost（D7，画布外挂第二个可见 .hr-drawer__content-wrapper 冒牌抽屉，字段/触发器与真节点抽屉共用构建函数不特判）。红先行金牌 tests/_golden/drawer-lock-hardening.golden.mjs（G1-G11，拆 20 条独立子用例：G3a/b、G7a/b/c-1/c-2、G8a/b、G9a/b/c/d、G10a/b）——反面用例一律钉精确路由 NEEDS_HUMAN（不只断不 PASS）；涉冒牌字段/触发器的用例一律加宽域候选零落笔/唯一落笔取证断言（wideCandidateValues/wideTriggerValues，纯加法证据字段，axes 无冻结 schema 约束）。红先行实证：改前 20/20 败（旧宽域锁/旧回读命中冒牌抽屉、旧编译门 exit 0 产 events 等假绿实锤，红证留存）。既有三金牌（wf-set-node-field/wf-select-node-dropdown/replay-nth-visible-hardening）手编 select/set 回放 events 补 nodeName + 编译产物断言加严一条 nodeName 钉位（D8，棘轮只加严）；波及 fake-sut server.mjs/CONTRACT.md 的既有冻结 prd（prd-p5-replay/prd-replay-nth-visible-hardening）与既有三原子 prd（prd-wf-set-node-field/prd-wf-select-node-dropdown）一并重签。不做：workflow.assertNodeFieldValue（另契约）；不碰 bin/verdict.mjs 四态判定树（裁判零 LLM、裁定语义零改动）；不碰 events.schema.json（零改动）；不驱真机（纯 hermetic）。决策全录 docs/plans/drawer-lock-hardening/proposed/GRILL.md（含设计评审修订，codex-sol@max 2026-07-14，处置录 docs/plans/drawer-lock-hardening/review/）。",
+  "task": "drawer-lock-hardening（light）：画布三原子 workflow.openNode/selectNodeDropdown/setNodeField 域锁跨抽屉边界硬化。挂账：codex-sol 异构冗余评审 MED#2（2026-07-10，loop/prd-wf-set-node-field.json observability 第二条）——doSetNodeField（lib/replay-actions.mjs）/compileWorkflowSetNodeField（lib/compile-atoms.mjs）的域锁用宽 .hr-drawer__content-wrapper，匹配所有抽屉而非当前节点配置抽屉；若另一可见抽屉恰有唯一同 placeholder 字段，域内 count===1 会填错抽屉的字段、精确回读仍成立→假绿；openNode/selectNodeDropdown/setNodeField 三原子同型设计局限。修法（GRILL D1-D8 决策全录）：编译门与回放门同刻把域锁收窄到当前节点抽屉专属锚——标题锚 = 可见的 .hr-drawer__content-wrapper 且内含【自身也可见】的当前节点标题精确文本（D2，复用 openNode 已冻双证回读锚下沉为三原子共用域锁，评审修订加『标题文本自身可见』内层限定，堵 wrapper 可见但标题藏在隐藏节点的假命中）；nodeName 供给通道 = 编译期 run 态 nodeDrawerLabel（openNode 成功开抽屉后写入，纳入 createCompileRun 的 mark()/rollback() 快照）+ 回放期事件既有冻结字段 nodeName（D3，零 schema 改动）；nodeName 缺席判据 = 字段缺席/非 string/trim() 后为空三者任一 → 硬阻断 action_failed，绝不回落宽域锁（D4 修订）；openNode 侧加预点基线归因守卫（单击前先数可见且含精确标题的抽屉，count>0 即证不出点后归因）+ 点后域内恰一（D5）；select/set 两原子先过抽屉域三态（count===0→none、>1→ambiguous、===1→字段/触发器级既有闸一字不动，D6）；fake-sut 加五个纯加法反面场景 twinfield/twinboth/twintitle/twinlate/twinghost（D7，画布外挂第二个可见 .hr-drawer__content-wrapper 冒牌抽屉，字段/触发器与真节点抽屉共用构建函数不特判）。红先行金牌 tests/_golden/drawer-lock-hardening.golden.mjs（G1-G14，现行 27 条独立子用例：G1/G2/G3a/G3b、G4/G11、G5/G6、G7a/b/c-1/c-2/d、G8a/b、G9a/b/c/d、G10a/b、G12a/b/c、G13、G14a/b）——反面用例一律钉精确路由 NEEDS_HUMAN（不只断不 PASS）；涉冒牌字段/触发器的用例一律加宽域候选零落笔/唯一落笔取证断言（wideCandidateValues/wideTriggerValues，纯加法证据字段，axes 无冻结 schema 约束）。红先行实证（三轮累计）：初版改前 20/20 败（旧宽域锁/旧回读命中冒牌抽屉、旧编译门 exit 0 产 events 等假绿实锤，红证留存）；loop 内 L2 咨询补 G7d 成 21 条；实现评审 r1 修复轮再增 6 条（G12a/b/c twindelay 检查后窗口前插、G13 openNode 失败不失效旧 run 态标题、G14a/b ghostdup 隐藏同文案在前合法正面），在 r1 实现上 6/6 败红证留存后修绿。实现评审 r1 处置（codex 2 HIGH/1 MED/2 LOW + pi 1 MED，五条全采信全修）：HIGH#1 抗漂移绑定——域内恰一判定通过后把唯一候选钉到 DOM 节点本身（一次性 pin 属性），字段/触发器定位与落笔全以 pin 锚为根，落笔前重判「域内唯一 + pin 一致」，编译门回放门同刻（堵动态 Locator 惰性重解析在检查后窗口漂移到前插冒牌的 TOCTOU 假绿）；HIGH#2 compileWorkflowOpenNode 尝试开始即失效 run.nodeDrawerLabel、仅点后恰一确证成功才写回（堵 A 开成 B 开败后借 A 旧标题过域锁对 A 抽屉落笔的编译期副作用）；MED#1（codex/pi 双路共报）标题可见性判定由只查首命中改为遍历全部命中任一可见即纳入（堵隐藏同文案在前的合法抽屉被误拒假阴）；LOW#1 fake-sut 注释西里尔词改简体；LOW#2 本字段计数对齐现行金牌。fake-sut 纯加法新增 twindelay（延时前插冒牌）与 ghostdup（隐藏同文案在前合法正面）两场景，CONTRACT.md 同步登记。既有三金牌（wf-set-node-field/wf-select-node-dropdown/replay-nth-visible-hardening）手编 select/set 回放 events 补 nodeName + 编译产物断言加严一条 nodeName 钉位（D8，棘轮只加严）；波及 fake-sut server.mjs/CONTRACT.md 的既有冻结 prd（prd-p5-replay/prd-replay-nth-visible-hardening）与既有三原子 prd（prd-wf-set-node-field/prd-wf-select-node-dropdown）一并重签。不做：workflow.assertNodeFieldValue（另契约）；不碰 bin/verdict.mjs 四态判定树（裁判零 LLM、裁定语义零改动）；不碰 events.schema.json（零改动）；不驱真机（纯 hermetic）。决策全录 docs/plans/drawer-lock-hardening/proposed/GRILL.md（含设计评审修订，codex-sol@max 2026-07-14，处置录 docs/plans/drawer-lock-hardening/review/）。",
   "specPath": "docs/plans/drawer-lock-hardening/plan.md",
   "testChecksums": {
-    "tests/_golden/drawer-lock-hardening.golden.mjs": "71d7a8255ee8c3f9b50be62b7cfdafc77dafb98aafba46e725fb176a0fec8eec",
-    "tests/fixtures/fake-sut/server.mjs": "84b8b5ab1861f3577b6a2cc239228e9551f19f184607a46076134f7038508e75",
-    "tests/fixtures/fake-sut/CONTRACT.md": "88d335faa58735ba980cb15f53726faf96621acbe570eaa2f86edac8ab72a7ab"
+    "tests/_golden/drawer-lock-hardening.golden.mjs": "def11accfacfa08bff17bded73190f8315451337455c12a3bc8e80d1df837020",
+    "tests/fixtures/fake-sut/server.mjs": "e3f35ffd843fd501fd55339b46742143329094e82c9955277e23d157f39329f3",
+    "tests/fixtures/fake-sut/CONTRACT.md": "624d1076803adfa0e077d39d75c2ab2f418fb5a53ccb79d94ebdc517f9d6a5a3"
   },
   "observability": [
     {
@@ -20,7 +20,7 @@
   "stories": [
     {
       "id": "s1-drawer-lock-hardening-e2e",
-      "desc": "G1-G11（21 条独立子用例，checkAsync 隔离防短路）红先行金牌：G1/G2/G3a/G3b（twinfield 跨抽屉误命中反面）、G4/G11（twinboth 域内唯一才动手正面半边）、G5/G6（twintitle 开错抽屉归因反面）、G8a/G8b/G9a/G9b/G9c/G9d（twinlate 点后歧义+域级多匹配）、G10a/G10b（twinghost 隐藏标题文本拒认）、G7a/G7b/G7c-1/G7c-2/G7d（happy 场景缺/空串/纯空白/非 string nodeName fail-closed 钉桩）。反面用例精确钉 verdict 恰 NEEDS_HUMAN（INDETERMINATE/AMBIGUOUS_ACTION 分场景钉 reason）；涉冒牌字段/触发器用例加宽域候选零落笔/唯一落笔取证（含 length 钉位，防空数组对 .some() 恒假通过）。fake-sut 五反面场景（twinfield/twinboth/twintitle/twinlate/twinghost，纯加法，既有场景零行为差）+ CONTRACT.md 登记。既有三金牌（wf-set-node-field/wf-select-node-dropdown/replay-nth-visible-hardening）补 nodeName + 编译产物 nodeName 钉位加严；wf-open-node/画布族涟漪（wf-add-node/wf-connect-nodes/wf-open-smoke/flow-bridge）零行为差复跑。红先行：实现前 tests/_golden/drawer-lock-hardening.golden.mjs 20/20 败（红证留存运行输出，逐条对应旧实现的具体假绿路径——旧宽域锁/旧回读命中冒牌抽屉返 unique、旧编译门 exit 0 产 events 等）；accept 收口后 --red-verified 通过。loop 内 codex-sol@medium L2 测试质量咨询（非裁判）指出 G9a/G9b 宽域候选快照断言漏 length 钉位（空数组对 `.some()` 恒假通过）+ G7 缺「非 string」nodeName 分支覆盖，均属真发现、已补 G9a/G9b length 钉位 + 新增 G7d（20→21 条），复跑仍全绿；另指出编译侧 domain>1/隐藏标题分支未被『不经 openNode 级联』的用例直接命中（仅经 run 态缺失级联间接触达）——记为已知残余覆盖缺口，未在本轮补（需新夹具场景或新测试手法，超出本契约已批准范围，留档待下一轮决策）。",
+      "desc": "G1-G14（27 条独立子用例，checkAsync 隔离防短路）红先行金牌：G1/G2/G3a/G3b（twinfield 跨抽屉误命中反面）、G4/G11（twinboth 域内唯一才动手正面半边）、G5/G6（twintitle 开错抽屉归因反面）、G8a/G8b/G9a/G9b/G9c/G9d（twinlate 点后歧义+域级多匹配）、G10a/G10b（twinghost 隐藏标题文本拒认）、G7a/G7b/G7c-1/G7c-2/G7d（happy 场景缺/空串/纯空白/非 string nodeName fail-closed 钉桩）、G12a/G12b/G12c（twindelay 检查后窗口前插冒牌——抗漂移绑定 pin 锚 + 落笔前重判，codex r1 HIGH#1）、G13（happy，openNode 尝试即失效旧 run 态标题——A 开成 B 开败后 set 不得借 A 旧标题落笔，codex r1 HIGH#2）、G14a/G14b（ghostdup 隐藏同文案在前合法抽屉不误拒正面——任一命中可见即纳入，codex/pi r1 双路 MED#1）。反面用例精确钉 verdict 恰 NEEDS_HUMAN（INDETERMINATE/AMBIGUOUS_ACTION 分场景钉 reason）；涉冒牌字段/触发器用例加宽域候选零落笔/唯一落笔取证（含 length 钉位，防空数组对 .some() 恒假通过）。fake-sut 六反面场景（twinfield/twinboth/twintitle/twinlate/twinghost/twindelay）+ ghostdup 合法正面场景（纯加法，既有场景零行为差）+ CONTRACT.md 登记。既有三金牌（wf-set-node-field/wf-select-node-dropdown/replay-nth-visible-hardening）补 nodeName + 编译产物 nodeName 钉位加严；wf-open-node/画布族涟漪（wf-add-node/wf-connect-nodes/wf-open-smoke/flow-bridge）零行为差复跑。红先行：实现前 tests/_golden/drawer-lock-hardening.golden.mjs 初版 20/20 败（红证留存运行输出，逐条对应旧实现的具体假绿路径——旧宽域锁/旧回读命中冒牌抽屉返 unique、旧编译门 exit 0 产 events 等）；实现评审 r1 修复轮新增 6 条（G12a/b/c、G13、G14a/b）在 r1 实现上 6/6 败（21 旧条全绿佐证既有面未回归）后修绿；accept 收口后 --red-verified 通过。loop 内 codex-sol@medium L2 测试质量咨询（非裁判）指出 G9a/G9b 宽域候选快照断言漏 length 钉位（空数组对 `.some()` 恒假通过）+ G7 缺「非 string」nodeName 分支覆盖，均属真发现、已补 G9a/G9b length 钉位 + 新增 G7d（20→21 条），复跑仍全绿；另指出编译侧 domain>1/隐藏标题分支未被『不经 openNode 级联』的用例直接命中（仅经 run 态缺失级联间接触达）——记为已知残余覆盖缺口，未在本轮补（需新夹具场景或新测试手法，超出本契约已批准范围，留档待下一轮决策）。",
       "lane": "implementation",
       "acceptance": [
         "node tests/_golden/drawer-lock-hardening.golden.mjs",
@@ -34,7 +34,7 @@
         "node tests/_golden/flow-bridge.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T23:01:29.751Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T03:38:29.712Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-regression-and-selftest",
@@ -48,7 +48,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T23:02:49.318Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T03:39:51.906Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-p5-replay.json b/loop/prd-p5-replay.json
index 0489ef8..8f6b6f7 100644
--- a/loop/prd-p5-replay.json
+++ b/loop/prd-p5-replay.json
@@ -6,8 +6,8 @@
     "tests/_golden/p5-replay.golden.mjs": "8a368f628ba19b0d487744e9e74e873966bb0fc4cb4d6d42e7ce1456ed1529c1",
     "tests/_golden/p5-replay-coverage.golden.mjs": "3e46e9a7fdf6824ed17e3a3c83e406ff55e95a2e5bb279d6bbdb92d67f7e2706",
     "tests/_golden/fixtures/p5/replay-cases.json": "931c708956e6abb0fa2fad0e4ad081b203da884d9a08894dd0828a5e216524b0",
-    "tests/fixtures/fake-sut/server.mjs": "84b8b5ab1861f3577b6a2cc239228e9551f19f184607a46076134f7038508e75",
-    "tests/fixtures/fake-sut/CONTRACT.md": "88d335faa58735ba980cb15f53726faf96621acbe570eaa2f86edac8ab72a7ab",
+    "tests/fixtures/fake-sut/server.mjs": "e3f35ffd843fd501fd55339b46742143329094e82c9955277e23d157f39329f3",
+    "tests/fixtures/fake-sut/CONTRACT.md": "624d1076803adfa0e077d39d75c2ab2f418fb5a53ccb79d94ebdc517f9d6a5a3",
     "tests/_golden/fixtures/seams/events.fixture.json": "49545e6efe597c33d9eeaaff65e9f8f9e268e125509533ccf54026a70023dd14"
   },
   "observability": [
@@ -34,7 +34,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T22:48:35.662Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T03:27:22.014Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-failsafe-coverage",
@@ -44,7 +44,7 @@
         "node tests/_golden/p5-replay-coverage.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T22:48:36.291Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T03:27:22.463Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-replay-nth-visible-hardening.json b/loop/prd-replay-nth-visible-hardening.json
index 0afbc00..f02949e 100644
--- a/loop/prd-replay-nth-visible-hardening.json
+++ b/loop/prd-replay-nth-visible-hardening.json
@@ -4,7 +4,7 @@
   "specPath": "docs/plans/replay-nth-visible-hardening/plan.md",
   "testChecksums": {
     "tests/_golden/replay-nth-visible-hardening.golden.mjs": "78cc7d18fcbf87ecfbe686c6fa37f3ef6410d6d0214ff4c57a5b9b96c5c360c6",
-    "tests/fixtures/fake-sut/server.mjs": "84b8b5ab1861f3577b6a2cc239228e9551f19f184607a46076134f7038508e75"
+    "tests/fixtures/fake-sut/server.mjs": "e3f35ffd843fd501fd55339b46742143329094e82c9955277e23d157f39329f3"
   },
   "stories": [
     {
@@ -15,7 +15,7 @@
         "node tests/_golden/replay-nth-visible-hardening.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T22:37:24.778Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T03:27:08.705Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-resign-and-regression",
@@ -34,7 +34,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T22:47:27.992Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T03:34:34.400Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/tests/_golden/drawer-lock-hardening.golden.mjs b/tests/_golden/drawer-lock-hardening.golden.mjs
index 9daf8ec..af0a50d 100644
--- a/tests/_golden/drawer-lock-hardening.golden.mjs
+++ b/tests/_golden/drawer-lock-hardening.golden.mjs
@@ -26,6 +26,13 @@
 //   G8  回放+编译 openNode 点后歧义                twinlate
 //   G9  回放+编译 set/select 域级多匹配            twinlate
 //   G10 回放隐藏标题文本拒认（openNode + set）     twinghost
+//   —— 实现评审 r1 修复轮新增（红先行：在 r1 实现上逐条红后修绿）——
+//   G12a 回放 setNodeField 检查后窗口前插冒牌      twindelay（codex HIGH#1 TOCTOU）
+//   G12b 回放 selectNodeDropdown 检查后窗口前插    twindelay（codex HIGH#1 TOCTOU）
+//   G12c 编译 selectNodeDropdown 检查后窗口前插    twindelay（codex HIGH#1 TOCTOU）
+//   G13  编译 openNode 失败不失效旧 run 态标题     happy（codex HIGH#2 陈旧 nodeDrawerLabel）
+//   G14a 回放 隐藏同文案在前合法抽屉不误拒（正面）  ghostdup（codex/pi 双路 MED#1）
+//   G14b 编译 隐藏同文案在前合法抽屉不误拒（正面）  ghostdup（codex/pi 双路 MED#1）
 import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
 import { spawnSync } from 'node:child_process';
 import { resolve, dirname, join } from 'node:path';
@@ -502,5 +509,129 @@ const stdFlow = (tail) => ([
   } finally { await s.close(); }
 }
 
+// ============================================================================================
+// twindelay 场景（实现评审 r1 修复轮新增，codex HIGH#1）：G12a/G12b（回放 set/select 检查后窗口
+// 前插冒牌）/ G12c（编译 select 同窗口）。夹具：点击开真抽屉（ddempty 形态），延时 3000ms 把含同
+// 标题的冒牌抽屉（带字段+触发器）前插到真抽屉之前（DOM 序更早）——初次域计数（点击后约 1s 内）
+// 只见真抽屉、字段/触发器 5s 可见等待期间冒牌现身。旧实现 root=structural.nth(0) 惰性重解析漂移
+// 到冒牌抽屉且不重判三态 → 落笔冒牌+回读成立=假绿；抗漂移绑定后动作只认已钉抽屉，真抽屉无字段/
+// 无触发器 → 5s 等待超时 count=0 → none（fail-closed）。
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'twindelay' });
+  try {
+    await checkAsync('G12a 回放·setNodeField 检查后窗口前插冒牌（twindelay）：域计数时唯一（真抽屉）、等待字段期间同标题冒牌前插 → 抗漂移绑定只认已钉真抽屉、域内字段 count=0 → resolution none + 宽域候选快照恰 1 项且为空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧动态 root 漂移到冒牌、真填冒牌字段回读成立 → unique+PASS 假绿实锤', async () => {
+      const caseId = 'tc_dlh_g12a';
+      const { axes, verdict } = runReplayVerdict('g12a', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`已钉真抽屉内字段应 count=0 → resolution none（冒牌是检查后前插、绝不得漂移过去），实际 ${JSON.stringify(ax.action)}（挂账假绿：旧动态 root 在 5s 字段等待里漂移到前插冒牌、真填其字段回读成立会返 unique+PASS）`);
+      const wide = ax.action.wideCandidateValues;
+      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域（不分标题）候选字段快照应恰 1 项且为空（超时后冒牌已在场、其字段零落笔），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G12b 回放·selectNodeDropdown 检查后窗口前插冒牌（twindelay）：同 G12a 型——已钉真抽屉内触发器 count=0 → resolution none + 宽域触发器快照恰 1 项仍「请选择」（冒牌触发器零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧动态 root 漂移点冒牌触发器选中回读成立 → unique+PASS 假绿实锤', async () => {
+      const caseId = 'tc_dlh_g12b';
+      const { axes, verdict } = runReplayVerdict('g12b', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`已钉真抽屉内触发器应 count=0 → resolution none，实际 ${JSON.stringify(ax.action)}（挂账假绿：旧动态 root 漂移到前插冒牌、点其触发器选中回读成立会返 unique+PASS）`);
+      const wide = ax.action.wideTriggerValues;
+      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '请选择') throw new Error(`宽域触发器快照应恰 1 项且仍「请选择」（冒牌触发器零落笔），实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
+      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
+    });
+
+    await checkAsync('G12c 编译·selectNodeDropdown 检查后窗口前插冒牌（twindelay）：execute 预检域计数唯一后、触发器 5s 可见等待期间冒牌前插 → 已钉真抽屉内触发器 count=0 → blocker exit 65 + 零 events + blocker 点名触发器 count=0。验红：旧编译门等待期漂移到冒牌触发器、点选回读成立 exit 0 产 events 假绿必红', async () => {
+      const { x, od } = compileFlowCase('g12c', 'tc_dlh_g12c', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（已钉真抽屉无触发器，绝不漂移到检查后前插的冒牌），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门在 5s 等待里漂移到冒牌触发器、走完点选回读 exit 0 产 events）`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 selectNodeDropdown 触发器 count=0，实际 ${btext.slice(0, 300)}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// happy 场景（实现评审 r1 修复轮新增，codex HIGH#2）：G13 编译 openNode 尝试即失效旧 run 态标题。
+// A（模型节点，在画布上）开成 → B（SQL查询，从未落画布）开败（画布域 count=0 预检 blocker）→
+// 后续 setNodeField 不得借 A 的旧标题过域锁对 A 抽屉落笔（exit 65 零 events 也不允许编译执行期对
+// 错误抽屉产生副作用，fail-safe）。
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'happy' });
+  try {
+    await checkAsync('G13 编译·openNode 失败不失效旧 run 态标题（happy）：openNode A 成功后 openNode B 预检 blocker，随后 setNodeField 须 run 态标题缺失 blocker 级联（尝试开始即失效旧值、仅确证成功才写回）→ exit 65 + 零 events + 零落笔（notes 无「节点字段已填入」）。验红：旧实现 B 失败不清 A 旧标题、setNodeField 借 A 标题过域锁真填 A 抽屉字段（notes 现「已填入」、无 setNodeField blocker）必红', async () => {
+      const NODE_B = 'SQL查询'; // 面板项存在但从未拖落画布 → openNode B 画布域 count=0 预检 blocker（确定性开败）
+      const { x, od } = compileFlowCase('g13', 'tc_dlh_g13', stdFlow([
+        { atom: 'workflow.openNode', params: { label: NODE_B } },
+        { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } },
+      ]), s.url);
+      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（openNode B 画布域 count=0），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
+      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      const ntext = JSON.stringify(rep.notes || []);
+      if (/节点字段已填入/.test(ntext)) throw new Error(`B 开败后 setNodeField 竟对 A 抽屉真落笔（notes 现「节点字段已填入」）——借旧标题过域锁的编译期副作用假绿（codex HIGH#2 实锤），notes=${ntext.slice(0, 400)}`);
+      const btext = JSON.stringify(rep.blockers || []);
+      if (!/openNode/.test(btext) || !new RegExp(NODE_B).test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应含 openNode「${NODE_B}」画布域 count=0 的自身 blocker，实际 ${btext.slice(0, 400)}`);
+      if (!/setNodeField/.test(btext) || !/run 态|标题缺失|nodeDrawerLabel/.test(btext)) throw new Error(`blockers 应另含 setNodeField 因 run 态节点抽屉标题缺失而截断的 blocker（尝试开始即失效旧值），实际 ${btext.slice(0, 400)}`);
+    });
+  } finally { await s.close(); }
+}
+
+// ============================================================================================
+// ghostdup 场景（实现评审 r1 修复轮新增，codex/pi 双路 MED#1 合法正面）：G14a 回放 / G14b 编译。
+// 真抽屉合法（标题可见、字段/下拉照常），但可见标题之前有一个 display:none 的同文案隐藏节点占
+// DOM 序更早——可见性判定只查首命中会把合法抽屉整个排出域（fail-closed 假阴、合法操作被误拒）；
+// 须遍历全部命中任一可见即纳入。
+// ============================================================================================
+{
+  const s = await startFakeSut({ scenario: 'ghostdup' });
+  try {
+    await checkAsync('G14a 回放·隐藏同文案在前合法抽屉不误拒（ghostdup 正面）：openNode unique + setNodeField unique + identityReadback ok + 宽域候选快照恰 1 项等于填入值 + verdict PASS（收窄不误伤合法形态）。验红：r1 实现 .first() 只查首命中（隐藏节点）→ 合法抽屉被排出域、openNode action_failed / set none 假阴必红', async () => {
+      const caseId = 'tc_dlh_g14a';
+      const { axes, verdict } = runReplayVerdict('g14a', s.url, {
+        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
+        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
+      }, {
+        caseId, channel: 'web', globalAssertions: GLOBALS,
+        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
+      });
+      const axOpen = stepOf(axes, 'intent_2');
+      if (!axOpen.action || axOpen.action.resolution !== 'unique') throw new Error(`openNode 应 unique（隐藏同文案在前不碍事、可见真标题在后即命中），实际 ${JSON.stringify(axOpen.action)}（假阴实锤：只查首命中把合法抽屉排出域）`);
+      const ax = stepOf(axes, 'intent_3');
+      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`setNodeField 应 unique（合法抽屉入域、域内字段恰 1），实际 ${JSON.stringify(ax.action)}`);
+      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true，实际 ${JSON.stringify(ax.action.identityReadback)}`);
+      const wide = ax.action.wideCandidateValues;
+      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== VALUE) throw new Error(`宽域候选字段快照应恰 1 项且等于填入值「${VALUE}」，实际 ${JSON.stringify(wide)}`);
+      const v = stepOf(verdict, 'intent_3');
+      if (v.verdict !== 'PASS') throw new Error(`应 PASS（合法形态不误拒），实际 ${v.verdict}/${v.reason}`);
+    });
+
+    await checkAsync('G14b 编译·隐藏同文案在前合法抽屉不误拒（ghostdup 正面）：openNode 点后恰一过、setNodeField 域内唯一真填 → exit 0 + events 产出 + 零 blockers。验红：r1 实现 openNode 点后域计数把合法抽屉排出域（count=0）→ blocker exit 65 假阴必红', async () => {
+      const { x, od } = compileFlowCase('g14b', 'tc_dlh_g14b', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
+      if (!x || x.status !== 0) throw new Error(`应 exit 0（合法形态照常编译产 events），实际 ${x && x.status}：${(x && x.stderr || '').slice(-300)}（假阴实锤：只查首命中致 openNode 点后域 count=0 blocker）`);
+      if (!existsSync(join(od, 'events.json'))) throw new Error('应产出 events.json（合法编译全通）');
+      const rep = readJson(join(od, 'compile-report.json'));
+      if ((rep.blockers || []).length) throw new Error(`blockers 应为空，实际 ${JSON.stringify(rep.blockers).slice(0, 300)}`);
+    });
+  } finally { await s.close(); }
+}
+
 console.log(`drawer-lock-hardening golden: ${pass} 过 / ${fails.length} 败`);
 if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
diff --git a/tests/fixtures/fake-sut/CONTRACT.md b/tests/fixtures/fake-sut/CONTRACT.md
index f53f90c..67bd74f 100644
--- a/tests/fixtures/fake-sut/CONTRACT.md
+++ b/tests/fixtures/fake-sut/CONTRACT.md
@@ -29,13 +29,14 @@
 3. 点击不落（否定行为，金牌反证用）：单击/双击 `.node-item` 不产生 `.lf-node`；微动（位移 < 12px）或落点出画布界同样不落。机制：位移阈值 + 落点界内双守卫，二者缺一不落。
 4. 计数一致：`.lf-node` 的 DOM 实数 = 成功拖落次数（真并行网关开始按 +2）；`.lf-graph[data-node-count]` 每次落节点后按 DOM 实数刷新（golden 双向可数：locator count 与属性值互证）。
 5. 连线（wf-connect-nodes）：每个 `.lf-node` 渲 `.lf-node-anchor-hover` 锚点；`mousedown` 锚点 → `mouseup` 落在另一个 `.lf-node`（非自身）→ `.lf-canvas-overlay` 内新增一个 `.lf-edge`。自连（源=目标）或落点非节点 → 不落边（否定行为，连线 fail-closed 反证）。纯 DOM 只断边数增，不携 source/target（连对哪两个的确定性取证挂账真机 window.lf）。
-6. 节点配置抽屉（wf-open-node）：单击 `.lf-node` 节点体 → 详情页出现/更新 `.hr-drawer__content-wrapper`（内含 `.lf-node-drawer__title` 文本 = 该节点 `.lf-node-content` 标题）——registry 真机 SOP「点中心开抽屉」最小复现。锚点 `.lf-node-anchor-hover` 单击不开（连线专属）；连线拖拽 down/up 目标不同元素 → click 事件落共同祖先 overlay、`closest('.lf-node')` 不中 → 不误开（DOM 规范行为，对既有通路零干扰）。抽屉与列表页建单抽屉同类名但异页，画布页域内唯一（回放身份回读干净）。抽屉反面模式（评审 F3/coverage）：由场景控反面考场（replay 的 nav 走 `pathOf` 剥 query 不能用 URL query，故用场景）——`drawernone` 单击节点不开抽屉（「点了不开」反面）、`drawersuperset` 抽屉标题 = 节点名 + `副本`（含 label 子串但非精确，钉身份回读须精确非子串）；既有场景一律缺省行为。
-7. 冒牌抽屉跨边界反面场景（drawer-lock-hardening，GRILL D7）：详情页画布外（不在 `.lf-canvas-overlay` 域内）另挂第二个可见 `.hr-drawer__content-wrapper`「冒牌抽屉」，复现挂账描述的「另一可见抽屉」（真机形态如同页测试面板/新增抽屉并存）。冒牌抽屉的字段/触发器与真节点抽屉共用构建函数 `buildNodeSelect`，不做特判；场景行为即挂账接缝复现，不为金牌预定裁定倒着裁。五场景（既有场景一律缺省行为、零影响）：
+6. 节点配置抽屉（wf-open-node）：单击 `.lf-node` 节点体 → 详情页出现/更新 `.hr-drawer__content-wrapper`（内含 `.lf-node-drawer__title` 文本 = 该节点 `.lf-node-content` 标题）——registry 真机 SOP「点中心开抽屉」最小复现。锚点 `.lf-node-anchor-hover` 单击不开（连线专属）；连线拖拽 down/up 目标不同元素 → click 事件落共同祖先 overlay、`closest('.lf-node')` 不中 → 不误开（DOM 规范行为，对既有通路零干扰）。抽屉与列表页建单抽屉同类名但异页，画布页域内唯一（回放身份回读干净）。抽屉反面模式（评审 F3/coverage）：由场景控反面考场（replay 的 nav 走 `pathOf` 剥 query 不能用 URL query，故用场景）——`drawernone` 单击节点不开抽屉（「点了不开」反面）、`drawersuperset` 抽屉标题 = 节点名 + `副本`（含 label 子串但非精确，钉身份回读须精确非子串）、`ghostdup`（实现评审 r1 修复新增，codex/pi 双路 MED#1 合法正面）抽屉正常打开且形态与缺省一致，但可见标题之前先挂一个 `display:none` 的同文案隐藏节点（占 DOM 序更早，真机形态如抽屉头部隐藏提示文本/占位副本）——钉「隐藏同文案在前+可见真标题在后」的合法抽屉不得被误拒（可见性判定须遍历全部命中任一可见即纳入，只查首命中会把合法抽屉整个排出域成 fail-closed 假阴）；既有场景一律缺省行为。
+7. 冒牌抽屉跨边界反面场景（drawer-lock-hardening，GRILL D7）：详情页画布外（不在 `.lf-canvas-overlay` 域内）另挂第二个可见 `.hr-drawer__content-wrapper`「冒牌抽屉」，复现挂账描述的「另一可见抽屉」（真机形态如同页测试面板/新增抽屉并存）。冒牌抽屉的字段/触发器与真节点抽屉共用构建函数 `buildNodeSelect`，不做特判；场景行为即挂账接缝复现，不为金牌预定裁定倒着裁。六场景（既有场景一律缺省行为、零影响）：
    - `twinfield`：真节点抽屉 `ddempty` 形态（点开但无字段无下拉，仍显示该节点标题）；冒牌抽屉画布外预挂（页面初次渲染即出现，早于真抽屉）、不含节点标题，挂一个同占位符「请输入接口的URL」字段 + 一个「请选择」触发器（可点、可选、值可回读）。
    - `twinboth`：真节点抽屉（点击后出现）与冒牌抽屉（画布外预挂，先于真抽屉出现）各挂一个同占位符字段 + 各一个「请选择」触发器；冒牌抽屉不含节点标题。
    - `twintitle`：单击节点不开抽屉（`drawernone` 半形态复用）；冒牌抽屉画布外预挂、含节点标题精确文本（固定复用面板项名「模型节点」）。
    - `twinlate`：单击节点开真抽屉（`ddempty` 形态：无字段无下拉，显示该节点标题）；与开抽屉的同一次点击事件处理器内，同刻动态挂出第二个含该节点标题精确可见文本的冒牌抽屉（带同占位符字段 + 「请选择」触发器）——点击前不存在（DOM 序晚于真抽屉，因同一处理器内先建真抽屉后建冒牌），钉「点击后才出现的冒牌」。
    - `twinghost`：单击节点不开抽屉（`drawernone` 半形态复用）；冒牌抽屉画布外预挂、含节点标题精确文本（该文本节点自身 `display:none` 隐藏——wrapper 可见、标题文本不可见），并同 `twinfield` 一样挂一个同占位符字段 + 一个「请选择」触发器（不挂字段/触发器则「宽域锁不问标题只问抽屉可见」在本场景会因压根没有字段而巧合吐缺席，不构成红证；补上后宽域锁会真把这唯一字段/触发器当命中）。
+   - `twindelay`（实现评审 r1 修复新增，codex HIGH#1 检查后窗口）：单击节点开真抽屉（`ddempty` 形态：无字段无下拉，显示该节点标题）；点击后延时 3000ms 把第二个含该节点标题精确可见文本的冒牌抽屉（带同占位符字段 + 「请选择」触发器）【前插】到真抽屉之前（`insertBefore`，DOM 序更早）——与 `twinlate`（同刻挂出、DOM 序更晚）互补，专钉「域计数通过之后、click/fill 之前」动态前插的 TOCTOU 窗口：惰性重解析的动态 Locator 会在字段/触发器 5s 可见等待里漂移到冒牌抽屉且不重判三态。延时依据：域计数在点击后约 1s 内发生，3000ms 晚于它、早于 5s 等待超时。
 
 分工与边界（沿既有条款）：
 
diff --git a/tests/fixtures/fake-sut/server.mjs b/tests/fixtures/fake-sut/server.mjs
index aa75744..f7d6a90 100644
--- a/tests/fixtures/fake-sut/server.mjs
+++ b/tests/fixtures/fake-sut/server.mjs
@@ -42,7 +42,16 @@ const SCENARIOS = new Set([
   //     set/select 域级 count=2 → ambiguous；
   //   twinghost（评审修订新增）：单击节点不开抽屉（drawernone 半形态，画布外预挂冒牌）+ 冒牌抽屉含节点
   //     标题精确文本但该文本 display:none 隐藏——钉『隐藏文本命中』假绿（标题文本自身须可见才算命中）。
-  'twinfield', 'twinboth', 'twintitle', 'twinlate', 'twinghost',
+  //   twindelay（实现评审 r1 修复新增，codex HIGH#1 检查后窗口）：单击节点开真抽屉（ddempty 形态），
+  //     延时 3000ms 后把含该节点标题精确可见文本的冒牌抽屉（带同 placeholder 字段 + 「请选择」触发器）
+  //     【前插】到真抽屉之前（DOM 序更早）——复现『域计数后到 click/fill 前同标题抽屉动态前插』：
+  //     旧实现 root=structural.nth(0) 惰性重解析会在字段/触发器 5s 可见等待里漂移到冒牌抽屉且不重判
+  //     三态，落笔+回读成立=假绿；延时晚于域计数（点击后约 1s 内发生）、早于 5s 等待超时，落在窗口正中。
+  //   ghostdup（实现评审 r1 修复新增，codex/pi 双路 MED#1 合法正面）：真节点抽屉正常打开（缺省形态：
+  //     标题+字段+下拉都在），但标题元素之前先挂一个 display:none 的同文案隐藏节点（占 DOM 序更早）——
+  //     钉『隐藏同文案在前+可见真标题在后』的合法抽屉不得被误拒：可见性判定只查首命中会把该抽屉整个
+  //     排出域（fail-closed 假阴），须遍历全部命中任一可见即纳入。
+  'twinfield', 'twinboth', 'twintitle', 'twinlate', 'twinghost', 'twindelay', 'ghostdup',
 ]);
 
 // 背景轮询 denylist 的合成形态（绝不引真 site.json，护栏 #7）：watchNetworkForensics 用它把 /auths/poll 归 background。
@@ -263,6 +272,7 @@ function clientMain() {
     //   'twinghost'      单击节点不开抽屉（drawernone 半形态复用）——冒牌抽屉另含节点标题精确文本但该文本 display:none 隐藏。
     var drawerMode = scenario === 'drawersuperset' ? 'superset' : (scenario === 'drawernone' || scenario === 'twintitle' || scenario === 'twinghost') ? 'none' : '';
     var twinlateFakeDrawer = null; // twinlate：点击同刻动态挂出的冒牌抽屉（点击前不存在，与预挂的 twinfield/twinboth/twintitle/twinghost 冒牌不同）
+    var twindelayScheduled = false; // twindelay：延时前插冒牌只排程一次（singleton，同 twinlateFakeDrawer 先例）
 
     // —— 节点抽屉「请选择」下拉（wf-select-node-dropdown，registry SOP 最小复现）——
     // 触发器 = .hr-select（初值「请选择」，值放 .hr-select__value 子 span 便于精确回读）；点触发器弹可见浮层
@@ -311,7 +321,33 @@ function clientMain() {
       if (drawerMode === 'superset') titleText = titleText + '副本'; // 开错抽屉：标题含 label 非精确
       if (!nodeDrawer) { nodeDrawer = el('div', { class: 'hr-drawer__content-wrapper' }); wrap.appendChild(nodeDrawer); }
       nodeDrawer.textContent = '';
+      // ghostdup（实现评审 r1 修复新增，codex/pi 双路 MED#1 合法正面）：真抽屉里、可见标题【之前】先挂
+      //   一个 display:none 的同文案隐藏节点（真机形态如抽屉头部隐藏提示文本/占位副本先于可见标题渲染）。
+      //   抽屉本身完全合法（标题可见、字段/下拉照常）——钉『可见性判定只查首命中』的误拒假阴：首命中是
+      //   隐藏节点时整抽屉被排出域，合法操作被硬阻断；判定须遍历全部命中任一可见即纳入。既有场景零行为差。
+      if (scenario === 'ghostdup') {
+        var ghostDup = el('div', { class: 'lf-node-drawer__ghost' }, titleText);
+        ghostDup.setAttribute('style', 'display:none');
+        nodeDrawer.appendChild(ghostDup);
+      }
       nodeDrawer.appendChild(el('div', { class: 'lf-node-drawer__title' }, titleText));
+      // twindelay（实现评审 r1 修复新增，codex HIGH#1 检查后 TOCTOU 窗口）：真抽屉打开后延时 3000ms 把
+      //   含该节点标题精确可见文本的冒牌抽屉【前插】到真抽屉之前（DOM 序更早，wrap.insertBefore）——
+      //   与 twinlate 的『同刻挂出、DOM 序更晚』互补，专钉『域计数通过之后、click/fill 之前』动态前插：
+      //   旧实现 root=structural.nth(0) 惰性重解析，字段/触发器 5s 可见等待里会漂移到冒牌抽屉且不重判
+      //   三态。冒牌带同 placeholder 字段 + 「请选择」触发器（与 twinlate 冒牌同构，共用构建函数不特判）。
+      //   延时窗口依据：回放/编译门的初次域计数在点击后约 1s 内发生（respWait 600ms + 因果窗 150ms +
+      //   静默点），3000ms 晚于它、早于字段/触发器 5s 可见等待超时（约点击后 6s），落在窗口正中。
+      if (scenario === 'twindelay' && !twindelayScheduled) {
+        twindelayScheduled = true;
+        setTimeout(function () {
+          var lateFake = el('div', { class: 'hr-drawer__content-wrapper' });
+          lateFake.appendChild(el('div', { class: 'fake-node-title' }, titleText));
+          lateFake.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
+          buildNodeSelect(lateFake, '');
+          wrap.insertBefore(lateFake, nodeDrawer);
+        }, 3000);
+      }
       // twinlate（D7 评审修订新增）：真抽屉打开的同一次点击事件处理器内，同刻动态挂出含该节点标题
       //   精确可见文本的冒牌抽屉（点击前不存在——与 twinfield/twinboth/twintitle/twinghost 的『预挂』
       //   冒牌不同，钉『点击后才出现的冒牌』这条评审新增支线）。只挂一次（singleton，同 nodeDrawer 先例）。
@@ -322,9 +358,9 @@ function clientMain() {
         buildNodeSelect(twinlateFakeDrawer, '');
         wrap.appendChild(twinlateFakeDrawer);
       }
-      // ddempty/twinfield/twinlate：抽屉开但无字段无下拉——域内触发器/字段 count=0（execute 预检的「无下拉/无字段」半边；
-      //   twinfield/twinlate 复用此缺席半边，真节点抽屉空、跨抽屉误命中的唯一候选靠冒牌抽屉，D7 定）。
-      if (scenario === 'ddempty' || scenario === 'twinfield' || scenario === 'twinlate') return;
+      // ddempty/twinfield/twinlate/twindelay：抽屉开但无字段无下拉——域内触发器/字段 count=0（execute 预检的「无下拉/无字段」半边；
+      //   twinfield/twinlate/twindelay 复用此缺席半边，真节点抽屉空、跨抽屉误命中的唯一候选靠冒牌抽屉，D7 定）。
+      if (scenario === 'ddempty' || scenario === 'twinfield' || scenario === 'twinlate' || scenario === 'twindelay') return;
       // 节点抽屉下拉纯加法：缺省单下拉；ddtwin 挂两触发器 + 预挂一层 stale 隐藏浮层含目标（两浮层各现一次）。
       // ddhidden（replay-nth-visible-hardening fix#2 复现）：先挂一枚 display:none 的隐藏 .hr-select 触发器占
       //   DOM 序 index 0，再挂真·可见触发器——触发器域锁未限可见时 .hr-select count=2、nth=0 误命中隐藏触发器
@@ -396,7 +432,7 @@ function clientMain() {
         // ——wrapper 可见但文本不可见，钉『标题文本自身须可见』收紧（D2 修订）。同时补挂一个同 placeholder
         // 字段 + 一个「请选择」触发器（与 twinfield 同构）：若只挂隐藏标题不挂字段/触发器，旧宽域锁在这
         // 具体夹具里也会因「压根没有字段」而巧合吐 none——不构成红证；补字段/触发器后，旧宽域锁（不问
-        // 标题、只问「抽屉可见」）会真把这唯一字段/触发器当成домen 命中，走完全程真假绿，红证成立。
+        // 标题、只问「抽屉可见」）会真把这唯一字段/触发器当成域内命中，走完全程真假绿，红证成立。
         var titleEl = el('div', { class: 'fake-node-title' }, TWIN_TITLE_NODE);
         titleEl.setAttribute('style', 'display:none');
         fakeDrawer.appendChild(titleEl);
```

// 回放动作原语 + 点击身份门（动作轴）。移植 autotester robust-actions 思路，但守卫不抛——
// 动作失败如实翻译成轴信号交 verdict.mjs 裁（守卫不自己定生死、绝不谎报 actionPerformed，护栏 #15/#14）。
// 统一身份门：count===1 才唯一可动作；count>1 一律 ambiguous【且绝不执行变更动作】；count===0 → none + 漂移探针。
// 返回动作轴 { resolution, identityReadback?, driftProbe?, candidateCount? } 或纯断言步 { kind:'none' }。
import { instantiate } from './instantiate.mjs';
import { findEquivalentAffordance } from './drift-probe.mjs';

function semanticLocator(page, ev) {
  const s = ev.semantic;
  if (s && s.kind === 'role' && s.role) return page.getByRole(s.role, { name: s.name, exact: s.exact !== false });
  if (s && s.kind === 'label' && s.name) return page.getByLabel(s.name);
  if (s && s.kind === 'text' && s.name) return page.getByText(s.name, { exact: !!s.exact });
  if (ev.role && ev.accessibleName) return page.getByRole(ev.role, { name: ev.accessibleName, exact: true });
  if (ev.fieldLabel) return page.getByLabel(ev.fieldLabel);
  return null;
}

export async function performAction(page, ev, ctx) {
  // 纯断言步（无动作）：actionPerformed 由断言驱动（verdict 对 kind==='none' 视作 true）。
  if (!ev.action || ev.action === 'none' || ev.action === 'assert') return { kind: 'none' };
  // nav 的动作轴由 orchestrator 按 goto 实际成败给（这里不下结论，回 null 让 orchestrator 接管）。
  if (ev.action === 'nav') return null;
  if (ev.action === 'selectOption') return await doSelect(page, ev, ctx);
  if (ev.action === 'dragTo') return await doDragTo(page, ev);
  if (ev.action === 'click' && ev.atom === 'workflow.openNode') return await doOpenNode(page, ev);
  if (ev.action === 'click' && ev.atom === 'workflow.selectNodeDropdown') return await doSelectNodeDropdown(page, ev);
  if (ev.action === 'fill' && ev.atom === 'workflow.setNodeField') return await doSetNodeField(page, ev, ctx);

  const cand = await resolveCandidate(page, ev);
  return await gateAndAct(page, cand, ev, ctx);
}

const exactTextRe = (s) => new RegExp(`^${String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

async function canvasBox(page) {
  const locs = [page.locator('.lf-canvas-overlay'), page.locator('.lf-graph')];
  for (const loc of locs) {
    if ((await loc.count().catch(() => 0)) !== 1) continue;
    const box = await loc.boundingBox().catch(() => null);
    if (box) return box;
  }
  return null;
}

async function nodeBoxByLabel(page, label) {
  const handle = page.locator('.lf-canvas-overlay').getByText(label, { exact: true }).first();
  // 缺席守卫（codex R2-F1）：waitFor 抛不得穿出——节点缺席 → 返回 null，让 doConnectNodes 的 !sBox/!eBox
  // 优雅落 none（否则 TimeoutError 穿出 performAction 崩整轮回放、废后续 intent，非单步降级）。同 nodeDragSource 守卫。
  try { await handle.waitFor({ state: 'visible', timeout: 5000 }); } catch { return null; }
  return await handle.evaluate((el) => {
    let n = el;
    while (n && !(n.classList && n.classList.contains('lf-node'))) n = n.parentElement;
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }).catch(() => null);
}

async function nodeDragSource(page, name) {
  const src = page.locator('.node-item').filter({ hasText: exactTextRe(name) });
  try { await src.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const n = await src.count().catch(() => 0);
  if (n !== 1) return { locator: src, count: n, box: null };

  const item = src.first();
  const icon = item.locator('.node-icon, [class*="hr-icon"], svg, i').first();
  let box = null;
  if ((await icon.count().catch(() => 0)) >= 1) box = await icon.boundingBox().catch(() => null);
  if (!box) box = await item.boundingBox().catch(() => null);
  return { locator: item, count: 1, box };
}

async function doConnectNodes(page, ev) {
  const from = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
  const to = typeof ev.nodeName === 'string' && ev.nodeName ? ev.nodeName : null;
  if (!from || !to) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };

  const before = await page.locator('.lf-edge').count().catch(() => null);
  const sBox = await nodeBoxByLabel(page, from);
  const eBox = await nodeBoxByLabel(page, to);
  if (!sBox || !eBox) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false } };

  const ok = await (async () => {
    try {
      await page.mouse.move(sBox.x + sBox.w / 2, sBox.y + sBox.h / 2);
      await page.waitForTimeout(300);
      const srcAnchor = await page.evaluate(({ x, y, w, h }) => {
        const target = { x: x + w, y: y + h / 2 };
        let best = null;
        let bestD = Infinity;
        document.querySelectorAll('.lf-node-anchor-hover').forEach((c) => {
          const r = c.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const cx = r.x + r.width / 2;
          const cy = r.y + r.height / 2;
          const d = Math.hypot(cx - target.x, cy - target.y);
          if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
        });
        return best;
      }, sBox);
      if (!srcAnchor) return false;
      await page.mouse.move(srcAnchor.x, srcAnchor.y);
      await page.waitForTimeout(200);
      await page.mouse.down();
      try {
        await page.mouse.move(eBox.x + eBox.w / 2, eBox.y + eBox.h / 2, { steps: 30 });
        await page.waitForTimeout(300);
      } finally {
        await page.mouse.up();
      }
      await page.waitForTimeout(500);
      return true;
    } catch {
      return false;
    }
  })();
  if (!ok) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  const after = await page.locator('.lf-edge').count().catch(() => null);
  if (before != null && after != null && after > before) return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
  return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
}

// 当前节点抽屉专属锚（drawer-lock-hardening GRILL D2，评审修订同刻）：可见 .hr-drawer__content-wrapper
// 且内含【自身也可见】的精确标题文本——filter({has}) 只证「后代存在该文本」、不证该文本节点自身可见
// （wrapper 可见但标题 display:none 隐藏也会被 filter 命中，评审 F1/D2 修订：堵「wrapper 可见但标题藏在
// 隐藏节点」的假命中），故逐候选二次核验标题文本自身 :visible。openNode/selectNodeDropdown/setNodeField
// 三原子共用此域锁（编译门 lib/compile-atoms.mjs 有同算法的独立一份实现，两门同刻；既有代码
// semanticLocator/canvasBox 等同类重复的先例）。
async function nodeDrawerDomain(page, label) {
  const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
  const n = await structural.count().catch(() => 0);
  const matches = [];
  for (let k = 0; k < n; k++) {
    const w = structural.nth(k);
    // 任一命中可见即纳入（实现评审 r1 codex/pi 双路 MED#1）：只查 .first() 会在「隐藏同文案在前+可见
    // 真标题在后」的合法抽屉上误吐不可见 → 整抽屉被排出域（fail-closed 假阴、合法操作被误拒）。
    // 契约语义是「内含自身可见的精确标题文本」= 存在量词，故遍历全部命中、任一可见即成立。
    const hits = w.getByText(label, { exact: true });
    const hn = await hits.count().catch(() => 0);
    let anyVisible = false;
    for (let i = 0; i < hn; i++) {
      if (await hits.nth(i).isVisible().catch(() => false)) { anyVisible = true; break; }
    }
    if (anyVisible) matches.push(w);
  }
  return matches;
}
// 抗漂移绑定（实现评审 r1 codex HIGH#1）：nodeDrawerDomain 返回的是动态 structural.nth(k) Locator，
// Playwright 惰性重解析——域计数通过之后、click/fill 之前若有同标题抽屉动态【前插】，nth(0) 会漂移到
// 冒牌抽屉且不重判三态，落笔+精确回读成立=假绿（TOCTOU）。绑定法：域内恰一判定通过后，把唯一候选
// 钉到 DOM 节点本身（一次性 pin 属性，值一次一换），后续字段/触发器定位与落笔全部以 pin 锚为根——
// pin 锚只解析到被钉的那个节点，前插冒牌物理上接不到动作。stamp 本身经 elementHandle 解析、也可能落在
// 已漂移的节点上，故 stamp 后必须重判（域内恰一且该唯一者恰带本次 pin）才算绑定成立。pin 是惰性
// data 属性：不进事件/取证/报告，不影响 SUT 行为；值含单调序号+随机尾，同节点后续动作重钉即覆盖。
const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
let nodeDrawerPinSeq = 0;
async function disposeHandle(handle) {
  if (!handle) return;
  try { await handle.dispose(); } catch { /* 清理失败不得覆盖原裁定 */ }
}
async function sameDomNode(page, left, right) {
  if (!left || !right) return false;
  try { return await page.evaluate((pair) => pair[0] === pair[1], [left, right]); } catch { return false; }
}
async function handleInsideRoot(handle, rootHandle) {
  if (!handle || !rootHandle) return false;
  try { return await handle.evaluate((el, rootEl) => rootEl.contains(el), rootHandle); } catch { return false; }
}
async function locatorStillBound(page, locator, index, expectedHandle, exactCount = null) {
  const count = await locator.count().catch(() => 0);
  if ((exactCount != null && count !== exactCount) || index < 0 || index >= count) return false;
  let current = null;
  try {
    current = await locator.nth(index).elementHandle({ timeout: 1000 });
    return await sameDomNode(page, current, expectedHandle);
  } catch {
    return false;
  } finally {
    await disposeHandle(current);
  }
}
// r2 HIGH 加固（codex r2，pinclone 反面钉此缝）：pin 属性可被页面脚本复制/搬移，只验「域内唯一者带
// pin」会被复制骗过——重判改验两条物理口径：①域内唯一者与初次绑定的 ElementHandle【物理同一】
// （DOM 节点身份不可伪造）；②pin 全页恰一（root 定位器按 pin 属性选择，属性被复制会把域外节点纳入
// 定位——全页非恰一即绑定证不出，fail-closed 拒动）。
async function verifyPinnedNodeDrawer(page, label, pin, rootHandle) {
  const cur = await nodeDrawerDomain(page, label);
  if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
  let same = false;
  let h = null;
  try {
    h = await cur[0].elementHandle();
    same = await sameDomNode(page, h, rootHandle);
  } catch { same = false; }
  finally { await disposeHandle(h); }
  if (!same) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉物理节点=漂移/被替换，证不出归属
  const pinCount = await page.locator(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`).count().catch(() => 0);
  if (pinCount !== 1) return { status: 'action_failed', count: pinCount }; // pin 被复制/丢失，绑定证不出
  return { status: 'ok', count: 1 };
}
async function pinNodeDrawer(page, label) {
  const domain = await nodeDrawerDomain(page, label);
  if (domain.length !== 1) return { status: domain.length === 0 ? 'none' : 'ambiguous', count: domain.length, root: null, pin: null, rootHandle: null };
  const pin = `pin_${(nodeDrawerPinSeq++).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  let rootHandle = null; // 被钉抽屉的物理句柄（r2 HIGH）：后续重判与落笔都以它为身份地面真值
  try {
    rootHandle = await domain[0].elementHandle();
    await rootHandle.evaluate((el, args) => el.setAttribute(args[0], args[1]), [NODE_DRAWER_PIN_ATTR, pin]);
  } catch {
    await disposeHandle(rootHandle);
    return { status: 'action_failed', count: 1, root: null, pin: null, rootHandle: null }; // 钉不上（节点已脱离等）=证不出，不猜
  }
  const re = await verifyPinnedNodeDrawer(page, label, pin, rootHandle);
  if (re.status !== 'ok') {
    await disposeHandle(rootHandle);
    return { status: re.status, count: re.count, root: null, pin, rootHandle: null };
  }
  return { status: 'ok', count: 1, root: page.locator(`.hr-drawer__content-wrapper[${NODE_DRAWER_PIN_ATTR}="${pin}"]`), pin, rootHandle };
}
// D4 修订（drawer-lock-hardening）：nodeName 缺席判据 = 字段缺席 / 非 string / trim() 后为空 三者任一
// → 硬阻断，绝不回落宽域锁（events.schema 只约束 string 类型合法，空串/纯空白类型合法但语义非法）。
function nodeNameInvalid(nodeName) {
  return typeof nodeName !== 'string' || nodeName.trim() === '';
}
// 宽域（不分标题）证据快照：全部可见 .hr-drawer__content-wrapper 内同占位符字段 value（DOM 序）。
// 纯加法证据字段（axes 无冻结 schema 约束，先例 setmulti candidateValues），供金牌钉住「零落笔/唯一
// 落笔」——不参与域锁判定本身，判定只认 nodeDrawerDomain 的标题锚域。
async function wideFieldSnapshot(page, placeholder, exact) {
  const wide = page.locator('.hr-drawer__content-wrapper:visible').getByPlaceholder(placeholder, { exact });
  const n = await wide.count().catch(() => 0);
  const values = [];
  for (let k = 0; k < n; k++) { try { values.push(await wide.nth(k).inputValue({ timeout: 1000 })); } catch { values.push(null); } }
  return values;
}
// 宽域（不分标题）触发器显示值快照（DOM 序）。同上，纯加法证据字段。
async function wideTriggerSnapshot(page) {
  const wide = page.locator('.hr-drawer__content-wrapper:visible .hr-select:visible');
  const n = await wide.count().catch(() => 0);
  const values = [];
  for (let k = 0; k < n; k++) { try { values.push((await wide.nth(k).innerText({ timeout: 1000 })).trim()); } catch { values.push(null); } }
  return values;
}

// openNode 专用同刻门（wf-open-node GRILL D4/D5 + drawer-lock-hardening GRILL D2/D5）：节点标题同时活在
// 面板 .node-item 与画布 .lf-node-content——全页统一身份门必撞多匹配（吐 ambiguous 卡死合法回放，
// wf-add-node R1-F2 同型缝），域锁 .lf-canvas-overlay 与编译门（compileWorkflowOpenNode 预检）同一扇门。
// 域内唯一才点（多匹配 ambiguous 绝不点、缺席回 none）；身份回读改为标题锚域三态（drawer-lock-hardening
// D5）：预点基线——单击前先数「可见且含精确、且标题文本自身可见」的抽屉，count>0 即无法把点后的抽屉
// 归因于本次单击（证不出）→ 绝不背书；点后恰一——回读要求域内恰 1（0 或 >1 同样证不出归因）。
async function doOpenNode(page, ev) {
  const label = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
  if (!label) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 语义证不出，不猜
  const domain = page.locator('.lf-canvas-overlay').getByText(label, { exact: true });
  // 缺席守卫：waitFor 抛不得穿出——节点缺席 → none 单步降级，非崩整轮回放（nodeBoxByLabel 守卫先例）。
  try { await domain.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const n = await domain.count().catch(() => 0);
  if (n === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false } };
  if (n > 1) return { resolution: 'ambiguous', candidateCount: n, identityReadback: { ok: false } }; // 多匹配绝不点
  const box = await nodeBoxByLabel(page, label); // 域内恰 1，.first() 即唯一者（复用、不造第三份孪生体）
  if (!box) return { resolution: 'none', candidateCount: 1, identityReadback: { ok: false } };
  // D5 预点基线归因守卫：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
  // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
  const baseline = await nodeDrawerDomain(page, label);
  if (baseline.length > 0) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  try {
    await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」（GRILL D1 单击定案）
  } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  // 点后等待：轮询域内计数直到 ≥1 或超时（需要的是计数、不止存在性，故不用单点 waitFor）。
  const t0 = Date.now();
  for (;;) {
    const cur = await nodeDrawerDomain(page, label);
    if (cur.length >= 1 || Date.now() - t0 > 5000) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  // D5 点后恰一：回读要求域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏文本已被 nodeDrawerDomain
  // 的精确+可见双限定堵死，评审 F1/D2）。
  const after = await nodeDrawerDomain(page, label);
  if (after.length !== 1) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没开 / 开错抽屉 / 点后歧义，不假 unique
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
}

// selectNodeDropdown 专用同刻门（wf-select-node-dropdown GRILL D4/D5 + drawer-lock-hardening GRILL
// D2/D4/D6）：节点抽屉「请选择」触发器非 role=combobox-带名——通用 doSelect 的全页
// getByRole('combobox',{name}) 门必兜空/撞既有分类下拉（wf-add-node R1-F2 同型缝），故按 ev.atom 分发到
// 本专用门。先过标题锚域三态（drawer-lock-hardening D6）：nodeName 缺席/非 string/trim 空 → 硬阻断
// action_failed，绝不回落宽域锁（D4 修订）；域内 count===0 → none；count>1 → ambiguous（证不出归属，
// 绝不动手，回放侧带 candidateCount）；count===1 → 以该抽屉为根，字段级/触发器级既有闸一字不动——域内
// 第 nth 个【可见】.hr-select:visible 触发器（nth 是合法确定性位置消歧，路 A；非法 nth（在场但非非负
// 整数）→ action_failed 硬阻断绝不降级 index 0，fix#1；缺席/越界 → none 单步降级，不崩整轮回放，
// doOpenNode 缺席守卫先例）→ 点触发器 → 限【可见浮层】.hr-select-option 作用域（防浮层 teleport 到 body
// 全局 text 撞列表页/孪生浮层）内目标选项唯一才点（多匹配 ambiguous 绝不点、缺席 action_failed）→
// 身份回读：重读第 nth 触发器显示值不再是「请选择」且【精确】含 option（filter has getByText exact 非
// 子串——openNode F1 教训下拉版：子串会把「选错项/写错值」误判选对）→ 成立 = unique；证不出 = action_failed。
// 每个分支返回前都附宽域（不分标题）触发器显示值快照 wideTriggerValues（纯加法证据，D6 评审修订）。
async function doSelectNodeDropdown(page, ev) {
  // nth 校验（fix#1）：缺省（undefined）→ 合法默认 0；在场但非「非负整数」→ 硬阻断 fail-closed 落 action_failed
  // （不点、绝不降级 index 0 猜首项——静默取 0 会替用户点错第一格还回 unique 假绿，违「fail-safe 不 fail-open」+
  // 点击身份门 ADR-0007；与「越界→none、多匹配→ambiguous」同口径）。
  if (ev.nth !== undefined && (!Number.isInteger(ev.nth) || ev.nth < 0)) {
    return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  }
  const nth = ev.nth === undefined ? 0 : ev.nth;
  const option = typeof ev.text === 'string' && ev.text ? ev.text : null;
  // D4 修订：nodeName 缺席/非 string/trim 空 → 硬阻断，绝不回落宽域锁（此分支证不出「哪个节点」，
  // 连宽域快照都不取——尚不知该找哪个占位符/触发器族之外的东西可证）。
  if (nodeNameInvalid(ev.nodeName)) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  const label = ev.nodeName;
  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续触发器定位/落笔全以 pin 锚为根——
  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝）。
  const bound = await pinNodeDrawer(page, label);
  const wideTriggerValues = await wideTriggerSnapshot(page);
  if (bound.status === 'none') return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues };
  if (bound.status === 'ambiguous') return { resolution: 'ambiguous', candidateCount: bound.count, identityReadback: { ok: false }, wideTriggerValues };
  if (bound.status !== 'ok') return { resolution: 'action_failed', candidateCount: bound.count, identityReadback: { ok: false }, wideTriggerValues };
  let trigHandle = null;
  let optHandle = null;
  let exactTextHandle = null;
  try {
  const root = bound.root;
  // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 未清理的
  // .hr-select 触发器进入计数/nth 定位（否则 nth 误命中隐藏触发器点不动/错位）；对全可见触发器场景恒等无行为差。
  const triggers = root.locator('.hr-select:visible');
  // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无触发器 → none 单步降级（doOpenNode 守卫先例）。
  try { await triggers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const tcount = await triggers.count().catch(() => 0);
  // 缺席/越界返回前重取宽域快照（r1 HIGH#1 配套取证）：5s 可见等待期间宽域可能已变（如晚到冒牌现身），
  // 快照取返回时刻现状才能佐证「冒牌触发器零落笔」。
  if (tcount === 0 || nth >= tcount) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  // 计数成立时立即绑定物理触发器，封住 count 与后续 elementHandle 之间的惰性定位漂移。
  try { trigHandle = await triggers.nth(nth).elementHandle({ timeout: 3000 }); } catch { trigHandle = null; }
  if (!trigHandle) return { resolution: 'action_failed', candidateCount: tcount, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  // 动作时刻重判（r1 HIGH#1 + r2 物理化）：点触发器前重验域内唯一性 + 物理同一 + pin 全页恰一——
  // 检查后窗口冒出同标题冒牌 → count=2 证不出归属 ambiguous；被钉抽屉出域/被替换/pin 被复制 →
  // action_failed。绝不带疑落笔。
  const preClick = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
  if (preClick.status !== 'ok') {
    return { resolution: preClick.status === 'ambiguous' ? 'ambiguous' : preClick.status === 'none' ? 'none' : 'action_failed', candidateCount: preClick.count, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  if (!(await locatorStillBound(page, triggers, nth, trigHandle)) || !(await handleInsideRoot(trigHandle, bound.rootHandle))) {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  try {
    await trigHandle.click({ timeout: 3000 });
  } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  const afterTriggerClick = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
  if (afterTriggerClick.status !== 'ok'
    || !(await locatorStillBound(page, triggers, nth, trigHandle))
    || !(await handleInsideRoot(trigHandle, bound.rootHandle))) {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  // 可见浮层作用域（防 teleport 到 body 撞列表页/孪生浮层）：限可见 .hr-select-option。
  const visibleOptions = page.locator('.hr-select-option:visible');
  try { await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 缺席由下方 count 落轴 */ }
  const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
  const oc = await target.count().catch(() => 0);
  if (oc === 0) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) }; // 目标缺席
  // 多匹配 / 缺 option 多选项一律绝不点（codex HIGH fail-safe）：option 缺失/未指定时若可见浮层有多个选项，
  // 点「首个可见选项」还返 unique = 假绿（fail-open 成 PASS，违铁律「fail-safe 不 fail-open」+ 点击身份门
  // ADR-0007——没给 option 却替用户猜首项）。故不再带 `option &&` 门：oc>1 一律 ambiguous 绝不点、绝不返 unique
  // （本分支裁判 ap=false 兜底落 NEEDS_HUMAN 仍 fail-safe；resolution 契约合并后升级为精确 AMBIGUOUS_ACTION）。
  // 仅 ①option 指定且域内唯一命中，或 ②浮层恰一项（缺 option 亦然），才走下方 oc===1 通路点选。
  if (oc > 1) return { resolution: 'ambiguous', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  // 选项唯一性成立时立即绑定物理节点；preOpt 之后还要证明当前唯一者仍是这一节点。
  try { optHandle = await target.first().elementHandle({ timeout: 3000 }); } catch { optHandle = null; }
  if (!optHandle) return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  // 动作时刻重判之二（r1 HIGH#1 + r2 物理化）：真正落笔的是选项单击（触发器值由此改写），浮层开着的
  // 窗口里同标题冒牌现身/pin 被复制同样证不出归属——落笔前再验一次。
  const preOpt = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
  if (preOpt.status !== 'ok'
    || !(await locatorStillBound(page, triggers, nth, trigHandle))
    || !(await handleInsideRoot(trigHandle, bound.rootHandle))
    || !(await locatorStillBound(page, target, 0, optHandle, 1))) {
    return { resolution: preOpt.status === 'ambiguous' ? 'ambiguous' : preOpt.status === 'none' ? 'none' : 'action_failed', candidateCount: preOpt.count, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  // 选项句柄落笔（r2）：浮层 teleport 到 body、无祖先物理包含可验（域外容器）——靠上方 oc===1 唯一闸 +
  // 下方【触发器物理句柄】精确回读兜底（值必须落在被钉抽屉内的物理触发器上才算成立）。
  try {
    await optHandle.click({ timeout: 3000 });
  } catch {
    return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  const afterOptionClick = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
  if (afterOptionClick.status !== 'ok'
    || !(await locatorStillBound(page, triggers, nth, trigHandle))
    || !(await handleInsideRoot(trigHandle, bound.rootHandle))) {
    return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  }
  // 身份回读（点后，物理句柄口径）：重读被钉抽屉内第 nth 触发器（trigHandle 物理节点）显示值——
  // 不再「请选择」且（给 option 则）内含精确 option 文本（text= 引擎带引号=规范化精确匹配）。
  let val = null;
  try { val = (await trigHandle.innerText({ timeout: 2000 })).trim(); } catch { val = null; }
  if (!val || val === '请选择') return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) };
  if (option) {
    let exactHit = 0;
    try {
      exactTextHandle = await trigHandle.$(`text=${JSON.stringify(option)}`);
      exactHit = exactTextHandle ? 1 : 0;
    } catch { exactHit = 0; }
    if (exactHit !== 1) return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false }, wideTriggerValues: await wideTriggerSnapshot(page) }; // 选错项/写错值精确回读拒认
  }
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true }, wideTriggerValues: await wideTriggerSnapshot(page) };
  } finally {
    await disposeHandle(exactTextHandle);
    await disposeHandle(optHandle);
    await disposeHandle(trigHandle);
    await disposeHandle(bound.rootHandle);
  }
}

// setNodeField 专用同刻门（wf-set-node-field GRILL D4/D5 + drawer-lock-hardening GRILL D2/D4/D6）：
// 节点抽屉可填字段按 placeholder 锚——占位符锚不是 semanticLocator 的 label/text/role 命中口径，通用
// doAct 的全页门必兜空或撞别处同名（全页 getByPlaceholder 会撞「新增工作流」抽屉的 请输入工作流名称
// → ambiguous 卡死），故按 ev.atom 分发到本专用门。先过标题锚域三态（drawer-lock-hardening D6）：
// nodeName 缺席/非 string/trim 空 → 硬阻断 action_failed，绝不回落宽域锁（D4 修订）；域内 count===0 →
// none；count>1 → ambiguous（证不出归属，绝不填，回放侧带 candidateCount）；count===1 → 以该抽屉为根，
// 字段级唯一闸一字不动（未给 nth：count===1 才填、count>1 ambiguous 绝不填首项；显式给 nth：nth<count
// 才填、越界 none；count===0 缺席 none 单步降级，缺席守卫 waitFor 抛不得穿出——doOpenNode/
// doSelectNodeDropdown 缺席守卫先例）→ target.fill → 身份回读（填后 inputValue() 精确等于实例化后填入值，
// 非 includes 子串——F1 教训子串会把填错值/半填误判填对）→ 成立 = unique + identityReadback ok:true；
// 证不出 = action_failed + ok:false（防「点了没填 / 填错值」两向假绿，护栏 #14）。每个分支返回前都附
// 宽域（不分标题）字段 value 快照 wideCandidateValues（纯加法证据，D6 评审修订）。
async function doSetNodeField(page, ev, ctx) {
  const s = ev.semantic;
  const placeholder = s && s.kind === 'label' && s.name ? s.name : null;
  if (placeholder == null || typeof ev.value !== 'string') return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 语义/值证不出，不猜
  const exact = !!(s && s.exact);
  // nth 校验（HIGH fix，镜像 doSelectNodeDropdown fix#1）：缺省（undefined）→ 合法默认 0；在场但非「非负整数」
  // → 硬阻断 fail-closed 落 action_failed（不填、绝不降级 index 0 猜首项——静默取 0 会替用户填错第一格还回
  // unique 假绿，违「fail-safe 不 fail-open」+ ADR-0007；与「越界→none、多匹配→ambiguous」同口径）。
  if (ev.nth !== undefined && (!Number.isInteger(ev.nth) || ev.nth < 0)) {
    return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  }
  const hasNth = ev.nth !== undefined;
  const nth = hasNth ? ev.nth : 0;
  // D4 修订：nodeName 缺席/非 string/trim 空 → 硬阻断，绝不回落宽域锁（此分支证不出「哪个节点」，
  // 连宽域快照都不取）。
  if (nodeNameInvalid(ev.nodeName)) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  const label = ev.nodeName;
  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续字段定位/落笔全以 pin 锚为根——
  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝）。
  const bound = await pinNodeDrawer(page, label);
  const wideCandidateValues = await wideFieldSnapshot(page, placeholder, exact);
  if (bound.status === 'none') return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues };
  if (bound.status === 'ambiguous') return { resolution: 'ambiguous', candidateCount: bound.count, identityReadback: { ok: false }, wideCandidateValues };
  if (bound.status !== 'ok') return { resolution: 'action_failed', candidateCount: bound.count, identityReadback: { ok: false }, wideCandidateValues };
  let targetHandle = null;
  try {
  const root = bound.root;
  const fields = root.getByPlaceholder(placeholder, { exact });
  // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无字段 → 由下方 count 落 none 单步降级（doOpenNode/doSelectNodeDropdown 守卫先例）。
  try { await fields.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const fcount = await fields.count().catch(() => 0);
  // 缺席返回前重取宽域快照（r1 HIGH#1 配套取证）：5s 可见等待期间宽域可能已变（如晚到冒牌现身），
  // 快照取返回时刻现状才能佐证「冒牌字段零落笔」。
  if (fcount === 0) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  if (!hasNth && fcount > 1) {
    // 多匹配未给 nth 绝不填首项。取证：快照全部候选字段 value 佐证「一格未填」（golden C3e 钉「字段值不变」
    //   非空话——candidateValues 全空 = 证明 ambiguous 分支绝没落笔到任何字段）。
    const candidateValues = [];
    for (let k = 0; k < fcount; k++) { try { candidateValues.push(await fields.nth(k).inputValue({ timeout: 1000 })); } catch { candidateValues.push(null); } }
    return { resolution: 'ambiguous', candidateCount: fcount, identityReadback: { ok: false }, candidateValues, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  }
  if (hasNth && nth >= fcount) return { resolution: 'none', candidateCount: fcount, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) }; // 越界
  const targetIndex = hasNth ? nth : 0;
  const target = fields.nth(targetIndex);
  // 计数成立时立即绑定物理字段；后续必须证明当前同一候选位置仍是该节点，不能在重判窗口后再从惰性
  // Locator 取一个可能已漂移的新节点。
  try { targetHandle = await target.elementHandle({ timeout: 3000 }); } catch { targetHandle = null; }
  if (!targetHandle) return { resolution: 'action_failed', candidateCount: fcount, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  const want = instantiate(ev.value, ctx);
  // 动作时刻重判（r1 HIGH#1 + r2 物理化）：落笔（fill）前重验域内唯一性 + 物理同一 + pin 全页恰一——
  // 检查后窗口冒出同标题冒牌 → count=2 证不出归属 ambiguous；被钉抽屉出域/被替换/pin 被复制 →
  // action_failed。绝不带疑落笔。
  const preFill = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
  if (preFill.status !== 'ok') {
    return { resolution: preFill.status === 'ambiguous' ? 'ambiguous' : preFill.status === 'none' ? 'none' : 'action_failed', candidateCount: preFill.count, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  }
  const exactCount = hasNth ? null : 1;
  if (!(await locatorStillBound(page, fields, targetIndex, targetHandle, exactCount)) || !(await handleInsideRoot(targetHandle, bound.rootHandle))) {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  }
  // fill 会先 focus；页面可在 focus handler 中搬移字段。显式 focus 后再验一次，把这类同步搬移挡在真正写值前。
  try {
    await targetHandle.focus();
    const afterFocus = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
    if (afterFocus.status !== 'ok'
      || !(await locatorStillBound(page, fields, targetIndex, targetHandle, exactCount))
      || !(await handleInsideRoot(targetHandle, bound.rootHandle))) {
      return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
    }
    await targetHandle.fill(want, { timeout: 3000 });
  } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  }
  // 动作后仍须证明根、候选位置与物理包含关系未漂移；同句柄回读成功本身不能证明仍写在目标抽屉。
  const afterFill = await verifyPinnedNodeDrawer(page, label, bound.pin, bound.rootHandle);
  if (afterFill.status !== 'ok'
    || !(await locatorStillBound(page, fields, targetIndex, targetHandle, exactCount))
    || !(await handleInsideRoot(targetHandle, bound.rootHandle))) {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  }
  // 身份回读（填后，物理句柄口径）：重读同一物理字段 inputValue() 精确等于填入值（非 includes——F1
  // 教训子串会把填错值误判填对）。
  let got = null;
  try { got = await targetHandle.inputValue({ timeout: 2000 }); } catch { got = null; }
  if (got !== want) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) }; // 点了没填 / 填错值，不假 unique
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true }, wideCandidateValues: await wideFieldSnapshot(page, placeholder, exact) };
  } finally {
    await disposeHandle(targetHandle);
    await disposeHandle(bound.rootHandle);
  }
}

// dragTo 专用同刻门（wf-add-node GRILL D3 + codex R1-F1/F2）：
// · 源解析锁 .node-item 域 + 精确文本——与编译门（compileWorkflowAddNode 的面板项过滤）同一扇门，
//   防「全页 getByText 撞既有同名节点内容」两门漂移（R1-F2：既有同名 .lf-node-content 会让全页门吐 ambiguous 卡死合法回放）；
// · 落点 ox/oy 须有限数——缺失/非法 = 证不出，绝不默认 0 拖左上角（R1-F1 假绿向）；
// · 画布容器优先 .lf-canvas-overlay、旧夹具兜底 .lf-graph；动作 mouse 三段式 down→move(steps:20)→300ms→up，up 走 finally 防悬按；
// · 三态落轴与统一身份门同律：唯一才拖、多匹配绝不拖、缺席回 none + 漂移探针。
async function doDragTo(page, ev) {
  if (ev.atom === 'workflow.connectNodes') return await doConnectNodes(page, ev);
  const name = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
  if (!name) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 源语义证不出，不猜
  const src = await nodeDragSource(page, name);
  const n = src.count;
  if (n > 1) return { resolution: 'ambiguous', candidateCount: n };
  if (n === 0) {
    const driftProbe = await findEquivalentAffordance(page, ev.atom, ev.targetName);
    return { resolution: 'none', candidateCount: 0, driftProbe };
  }
  const ok = await (async () => {
    try {
      if (!Number.isFinite(ev.ox) || !Number.isFinite(ev.oy)) return false; // 落点证不出（R1-F1）
      const gbox = await canvasBox(page);
      const sbox = src.box;
      if (!gbox || !sbox) return false;
      await page.waitForTimeout(500);
      await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
      await page.mouse.down();
      try {
        await page.mouse.move(gbox.x + ev.ox, gbox.y + ev.oy, { steps: 20 });
        await page.waitForTimeout(300);
      } finally { await page.mouse.up(); }
      await page.waitForTimeout(500);
      return true;
    } catch { return false; }
  })();
  if (ok) return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
  return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
}

// 解析候选：先语义定位器，语义 0 命中再 fallbackCss（次级兜底）。返回 { locator, count } 或 { count:0 }。
async function resolveCandidate(page, ev) {
  const loc = semanticLocator(page, ev);
  if (loc) {
    try { await loc.first().waitFor({ state: 'attached', timeout: 1200 }); } catch {}
    let n = 0; try { n = await loc.count(); } catch { n = 0; }
    if (n >= 1) return { locator: loc, count: n };
  }
  if (ev.fallbackCss) {
    const fb = page.locator(ev.fallbackCss);
    let n = 0; try { n = await fb.count(); } catch { n = 0; }
    if (n >= 1) return { locator: fb, count: n };
  }
  return { count: 0 };
}

// 点击身份门（统一所有定位分支）。
async function gateAndAct(page, cand, ev, ctx) {
  if (cand.count > 1) {
    // 多匹配：不知点哪个，绝不执行变更动作，只记 ambiguous 证据（防污染 SUT，护栏 #15）。
    return { resolution: 'ambiguous', candidateCount: cand.count };
  }
  if (cand.count === 1) {
    const ok = await doAct(page, cand.locator.first(), ev, ctx);
    if (ok) return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
    // 元素唯一但动作失败：绝不谎报 unique；落证不出（verdict ap=false、无 driftProbe）→ INDETERMINATE（fail-safe）。
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  // count===0：录制 locator 全失配 → 只读漂移探针（不点不改 spec）。
  const driftProbe = await findEquivalentAffordance(page, ev.atom, ev.targetName);
  return { resolution: 'none', candidateCount: 0, driftProbe };
}

// doAct 回真实成功布尔；守卫不抛、失败如实回 false（绝不谎报 actionPerformed）。
// dragTo 不走本函数——它有专用同刻门 doDragTo（源域锁定 + 落点必填，见上）。
async function doAct(page, loc, ev, ctx) {
  try {
    if (ev.action === 'click') await loc.click({ timeout: 2000 });
    else if (ev.action === 'dblclick') await loc.dblclick({ timeout: 2000 });
    else if (ev.action === 'fill') await loc.fill(instantiate(ev.value, ctx), { timeout: 2000 });
    else if (ev.action === 'press') await loc.press(ev.key || 'Enter', { timeout: 2000 });
    else return false; // 未知动作不谎报成功
    return true;
  } catch { return false; }
}

// 自定义下拉：combobox count===1 才动作；多 combobox → ambiguous 不变更。
async function doSelect(page, ev, ctx) {
  const du = ev.dropdownUnit || {};
  let n = 0, combo = null;
  try { combo = page.getByRole('combobox', { name: du.fieldLabel }); n = await combo.count(); } catch { n = 0; }
  if (n > 1) return { resolution: 'ambiguous', candidateCount: n };
  if (n === 1) {
    let ok = false;
    try {
      await combo.first().click({ timeout: 2000 });
      const list = page.locator(du.optionListSelector || '.hr-select__list');
      await list.getByText(du.optionText, { exact: true }).first().click({ timeout: 2000 });
      ok = true;
    } catch { ok = false; }
    return ok ? { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } } : { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  return { resolution: 'none', candidateCount: 0, driftProbe: await findEquivalentAffordance(page, ev.atom, ev.targetName) };
}

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

// openNode 专用同刻门（wf-open-node GRILL D4/D5）：节点标题同时活在面板 .node-item 与画布
// .lf-node-content——全页统一身份门必撞多匹配（fallback_first 卡死合法回放，wf-add-node R1-F2 同型缝），
// 域锁 .lf-canvas-overlay 与编译门（compileWorkflowOpenNode 预检）同一扇门。域内唯一才点
// （多匹配 ambiguous 绝不点、缺席回 none）；身份回读 = 抽屉可见 + 含节点标题双证（防「点了没开」假 unique）。
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
  try {
    await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」（GRILL D1 单击定案）
  } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  try {
    // 身份回读须【精确】含 label 元素，非子串 hasText（评审 F1）：子串会把标题「label副本」等含子串的开错抽屉
    // 误判「开对了这个节点」——精确回读堵「点了没开 / 开错抽屉」两向假绿（护栏 #14）。
    await page.locator('.hr-drawer__content-wrapper').filter({ has: page.getByText(label, { exact: true }) }).first().waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } }; // 点了没开 / 开错抽屉，不假 unique
  }
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
}

// selectNodeDropdown 专用同刻门（wf-select-node-dropdown GRILL D4/D5）：节点抽屉「请选择」触发器
// 非 role=combobox-带名——通用 doSelect 的全页 getByRole('combobox',{name}) 门必兜空/撞既有分类下拉
// （wf-add-node R1-F2 同型缝），故按 ev.atom 分发到本专用门。域锁 .hr-drawer__content-wrapper 内第 nth
// 个 .hr-select 触发器（nth 是合法确定性位置消歧，路 A；缺席/越界 → none 单步降级，不崩整轮回放，
// doOpenNode 缺席守卫先例）→ 点触发器 → 限【可见浮层】.hr-select-option 作用域（防浮层 teleport 到 body
// 全局 text 撞列表页/孪生浮层）内目标选项唯一才点（多匹配 ambiguous 绝不点、缺席 action_failed）→
// 身份回读：重读第 nth 触发器显示值不再是「请选择」且【精确】含 option（filter has getByText exact 非
// 子串——openNode F1 教训下拉版：子串会把「选错项/写错值」误判选对）→ 成立 = unique；证不出 = action_failed。
async function doSelectNodeDropdown(page, ev) {
  const nth = Number.isInteger(ev.nth) && ev.nth >= 0 ? ev.nth : 0;
  const option = typeof ev.text === 'string' && ev.text ? ev.text : null;
  const triggers = page.locator('.hr-drawer__content-wrapper .hr-select');
  // 缺席守卫：waitFor 抛不得穿出——抽屉未开/无触发器 → none 单步降级（doOpenNode 守卫先例）。
  try { await triggers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const tcount = await triggers.count().catch(() => 0);
  if (tcount === 0 || nth >= tcount) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false } };
  try {
    await triggers.nth(nth).click({ timeout: 3000 });
  } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  // 可见浮层作用域（防 teleport 到 body 撞列表页/孪生浮层）：限可见 .hr-select-option。
  const visibleOptions = page.locator('.hr-select-option:visible');
  try { await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 缺席由下方 count 落轴 */ }
  const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
  const oc = await target.count().catch(() => 0);
  if (oc === 0) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 目标缺席
  if (option && oc > 1) return { resolution: 'ambiguous', candidateCount: oc, identityReadback: { ok: false } }; // 多匹配绝不点
  try {
    await target.first().click({ timeout: 3000 });
  } catch {
    return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false } };
  }
  // 身份回读（点后）：重读第 nth 触发器显示值——不再「请选择」且（给 option 则）精确含 option。
  let val = null;
  try { val = (await triggers.nth(nth).innerText({ timeout: 2000 })).trim(); } catch { val = null; }
  if (!val || val === '请选择') return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false } };
  if (option) {
    const exactHit = await triggers.nth(nth).filter({ has: page.getByText(option, { exact: true }) }).count().catch(() => 0);
    if (exactHit !== 1) return { resolution: 'action_failed', candidateCount: oc, identityReadback: { ok: false } }; // 选错项/写错值精确回读拒认
  }
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
}

// dragTo 专用同刻门（wf-add-node GRILL D3 + codex R1-F1/F2）：
// · 源解析锁 .node-item 域 + 精确文本——与编译门（compileWorkflowAddNode 的面板项过滤）同一扇门，
//   防「全页 getByText 撞既有同名节点内容」两门漂移（R1-F2：既有同名 .lf-node-content 会让全页门 fallback_first 卡死合法回放）；
// · 落点 ox/oy 须有限数——缺失/非法 = 证不出，绝不默认 0 拖左上角（R1-F1 假绿向）；
// · 画布容器优先 .lf-canvas-overlay、旧夹具兜底 .lf-graph；动作 mouse 三段式 down→move(steps:20)→300ms→up，up 走 finally 防悬按；
// · 三态落轴与统一身份门同律：唯一才拖、多匹配绝不拖、缺席回 none + 漂移探针。
async function doDragTo(page, ev) {
  if (ev.atom === 'workflow.connectNodes') return await doConnectNodes(page, ev);
  const name = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
  if (!name) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 源语义证不出，不猜
  const src = await nodeDragSource(page, name);
  const n = src.count;
  if (n > 1) return { resolution: 'fallback_first', candidateCount: n };
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
    return { resolution: 'fallback_first', candidateCount: cand.count };
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
  if (n > 1) return { resolution: 'fallback_first', candidateCount: n };
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

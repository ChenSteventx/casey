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

  const cand = await resolveCandidate(page, ev);
  return await gateAndAct(page, cand, ev, ctx);
}

// dragTo 专用同刻门（wf-add-node GRILL D3 + codex R1-F1/F2）：
// · 源解析锁 .node-item 域 + 精确文本——与编译门（compileWorkflowAddNode 的面板项过滤）同一扇门，
//   防「全页 getByText 撞既有同名节点内容」两门漂移（R1-F2：既有同名 .lf-node-content 会让全页门 fallback_first 卡死合法回放）；
// · 落点 ox/oy 须有限数——缺失/非法 = 证不出，绝不默认 0 拖左上角（R1-F1 假绿向）；
// · 画布容器 .lf-graph 须唯一且 boundingBox 可取；动作 mouse 三段式 down→move(steps:12)→300ms→up，up 走 finally 防悬按；
// · 三态落轴与统一身份门同律：唯一才拖、多匹配绝不拖、缺席回 none + 漂移探针。
async function doDragTo(page, ev) {
  const name = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
  if (!name) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 源语义证不出，不猜
  const exactRe = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const src = page.locator('.node-item').filter({ hasText: exactRe });
  try { await src.first().waitFor({ state: 'attached', timeout: 1200 }); } catch { /* 计数照实 */ }
  let n = 0; try { n = await src.count(); } catch { n = 0; }
  if (n > 1) return { resolution: 'fallback_first', candidateCount: n };
  if (n === 0) {
    const driftProbe = await findEquivalentAffordance(page, ev.atom, ev.targetName);
    return { resolution: 'none', candidateCount: 0, driftProbe };
  }
  const ok = await (async () => {
    try {
      if (!Number.isFinite(ev.ox) || !Number.isFinite(ev.oy)) return false; // 落点证不出（R1-F1）
      const graph = page.locator('.lf-graph');
      if ((await graph.count()) !== 1) return false;
      const gbox = await graph.boundingBox();
      const sbox = await src.first().boundingBox();
      if (!gbox || !sbox) return false;
      await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
      await page.mouse.down();
      try {
        await page.mouse.move(gbox.x + ev.ox, gbox.y + ev.oy, { steps: 12 });
        await page.waitForTimeout(300);
      } finally { await page.mouse.up(); }
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

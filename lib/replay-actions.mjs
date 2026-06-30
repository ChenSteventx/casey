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

  const cand = await resolveCandidate(page, ev);
  return await gateAndAct(page, cand, ev, ctx);
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
    const ok = await doAct(cand.locator.first(), ev, ctx);
    if (ok) return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
    // 元素唯一但动作失败：绝不谎报 unique；落证不出（verdict ap=false、无 driftProbe）→ INDETERMINATE（fail-safe）。
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  // count===0：录制 locator 全失配 → 只读漂移探针（不点不改 spec）。
  const driftProbe = await findEquivalentAffordance(page, ev.atom, ev.targetName);
  return { resolution: 'none', candidateCount: 0, driftProbe };
}

// doAct 回真实成功布尔；守卫不抛、失败如实回 false（绝不谎报 actionPerformed）。
async function doAct(loc, ev, ctx) {
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

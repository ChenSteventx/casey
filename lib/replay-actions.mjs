// 回放动作原语 + 点击身份门（动作轴）。移植 autotester robust-actions 思路，但守卫不抛——
// 动作失败翻译成三轴信号交 verdict.mjs 裁（守卫不自己定生死，护栏 #15）。
// 返回动作轴 { resolution ∈ unique|fallback_first|none, identityReadback?, driftProbe? }。
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
  if (ev.action === 'nav') return { resolution: 'unique' };
  if (ev.action === 'selectOption') return await doSelect(page, ev);

  const loc = semanticLocator(page, ev);
  let count = 0;
  if (loc) {
    try { await loc.first().waitFor({ state: 'attached', timeout: 1200 }); } catch {}
    try { count = await loc.count(); } catch { count = 0; }
  }

  // 点击身份门：唯一→unique；多匹配→fallback_first(ambiguous)；零→次级兜底/漂移探针。
  if (count > 1) {
    if (ev.action === 'click') { try { await loc.first().click({ timeout: 2000 }); } catch {} }
    return { resolution: 'fallback_first' };
  }
  if (count === 1) {
    await doAct(page, loc.first(), ev, ctx);
    return { resolution: 'unique', identityReadback: { ok: true } };
  }

  // 语义 0 命中 → 试 fallbackCss（次级兜底线索，非冻结主锚）
  if (ev.fallbackCss) {
    const fb = page.locator(ev.fallbackCss);
    let fbCount = 0;
    try { fbCount = await fb.count(); } catch { fbCount = 0; }
    if (fbCount >= 1) {
      await doAct(page, fb.first(), ev, ctx);
      // 有语义却靠 css 兜底 = fallback_first；本就只有脆性 css 的步命中才算 unique。
      return { resolution: ev.semantic || ev.role || ev.fieldLabel ? 'fallback_first' : 'unique' };
    }
  }

  // 录制 locator 全失配 → resolution=none + 只读漂移探针（不点不改 spec）
  const driftProbe = await findEquivalentAffordance(page, ev.atom, ev.targetName);
  return { resolution: 'none', driftProbe };
}

async function doAct(page, loc, ev, ctx) {
  try {
    if (ev.action === 'click') await loc.click({ timeout: 2000 });
    else if (ev.action === 'fill') await loc.fill(instantiate(ev.value, ctx), { timeout: 2000 });
    else if (ev.action === 'press') await loc.press(ev.key || 'Enter', { timeout: 2000 });
  } catch { /* 守卫不抛：失败由断言/取证轴体现 */ }
}

// 自定义下拉（非原生 select）：点开 combobox → 选项列表点 optionText。
async function doSelect(page, ev) {
  const du = ev.dropdownUnit || {};
  try {
    const combo = page.getByRole('combobox', { name: du.fieldLabel });
    if (await combo.count()) {
      await combo.first().click({ timeout: 2000 });
      const list = page.locator(du.optionListSelector || '.hr-select__list');
      await list.getByText(du.optionText, { exact: true }).first().click({ timeout: 2000 });
      return { resolution: 'unique', identityReadback: { ok: true } };
    }
  } catch { /* 守卫不抛 */ }
  return { resolution: 'none', driftProbe: await findEquivalentAffordance(page, ev.atom, ev.targetName) };
}

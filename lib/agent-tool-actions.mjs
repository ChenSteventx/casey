// 智能体工具首纵切的专用动作身份门。
// 这些函数只返回动作轴事实，不裁定 PASS；缺席、多匹配、后置回读失败一律 fail-closed。
import { instantiate } from './instantiate.mjs';
import {
  performWorkflowDeleteConfirm,
  performWorkflowDeleteTrigger,
} from './workflow-delete-domain.mjs';

const PICKER_DIALOG_SELECTOR = '.hr-dialog:visible';
const AGENT_SEARCH_NAME = '输入智能体名称或编码进行搜索';
const TOOL_ADD_PIN = 'data-casey-agent-tool-add-pin';
const AGENT_FORM_PIN = 'data-casey-agent-form-pin';
const AGENT_DELETE_ZERO_MIN_MS = 3000;
const AGENT_DELETE_ZERO_SAMPLES = 3;
let pinSequence = 0;

const axis = (resolution, candidateCount = 0, ok = false) => ({ resolution, candidateCount, identityReadback: { ok } });
const exactTextRe = (text) => new RegExp(`^${String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

export function advanceAgentDeleteZeroEvidence(previous, sample) {
  const elapsedMs = sample?.elapsedMs;
  const matches = sample?.matches;
  const busy = sample?.busy;
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0) throw new TypeError('elapsedMs 须为非负整数');
  if (!Number.isInteger(matches) || matches < 0) throw new TypeError('matches 须为非负整数');
  if (typeof busy !== 'boolean') throw new TypeError('busy 须为 boolean');
  const isZero = matches === 0;
  if (busy || !isZero) {
    return { zeroSamples: 0, zeroWindowStartedAt: null, ok: false };
  }
  const priorSamples = Number.isInteger(previous?.zeroSamples) && previous.zeroSamples > 0
    ? previous.zeroSamples
    : 0;
  const priorWindowStartedAt = Number.isInteger(previous?.zeroWindowStartedAt)
    && previous.zeroWindowStartedAt >= 0
    && previous.zeroWindowStartedAt <= elapsedMs
    ? previous.zeroWindowStartedAt
    : null;
  const continuesWindow = priorSamples > 0 && priorWindowStartedAt != null;
  const zeroSamples = continuesWindow ? priorSamples + 1 : 1;
  const zeroWindowStartedAt = continuesWindow ? priorWindowStartedAt : elapsedMs;
  return {
    zeroSamples,
    zeroWindowStartedAt,
    ok: elapsedMs - zeroWindowStartedAt >= AGENT_DELETE_ZERO_MIN_MS
      && zeroSamples >= AGENT_DELETE_ZERO_SAMPLES,
  };
}

async function pickerDialogs(page) {
  const all = page.locator(PICKER_DIALOG_SELECTOR).filter({ hasText: '仅显示已选' });
  try { await all.first().waitFor({ state: 'visible', timeout: 3000 }); } catch { /* 计数照实 */ }
  return { locator: all, count: await all.count().catch(() => 0) };
}

async function uniquePicker(page) {
  const found = await pickerDialogs(page);
  if (found.count !== 1) return { ...axis(found.count > 1 ? 'ambiguous' : 'none', found.count), locator: null };
  return { ...axis('unique', 1, true), locator: found.locator.first() };
}

async function clearToolAddPins(page) {
  try {
    await page.locator(`[${TOOL_ADD_PIN}]`).evaluateAll((nodes, attr) => {
      for (const node of nodes) node.removeAttribute(attr);
    }, TOOL_ADD_PIN);
  } catch { /* 清理失败不得覆盖动作轴 */ }
}

async function clearFormPins(page) {
  try {
    await page.locator(`[${AGENT_FORM_PIN}]`).evaluateAll((nodes, attr) => {
      for (const node of nodes) node.removeAttribute(attr);
    }, AGENT_FORM_PIN);
  } catch { /* 清理失败不得覆盖动作轴 */ }
}

async function performAgentCreateAction(page, ev, ctx) {
  const pin = `agent-form-${++pinSequence}-${Math.random().toString(36).slice(2, 9)}`;
  const fieldMode = ev.action === 'fill';
  const optionMode = ev.action === 'click' && typeof ev.fallbackCss === 'string' && /hr-select__(?:dropdown|option)|hr-popup/.test(ev.fallbackCss);
  const confirmMode = ev.action === 'click' && ev.text === '确认';
  const label = fieldMode ? ev.fieldLabel : ev.text;
  if (typeof label !== 'string' || !label.trim()) return axis('action_failed', 0);
  await clearFormPins(page);
  const count = await page.evaluate(({ attr, value, wanted, fieldMode: fill, optionMode: option, confirmMode: confirm }) => {
    const norm = (input) => String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
    const visible = (node) => {
      if (!node || node.nodeType !== 1 || !node.isConnected) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0;
    };
    const unique = (nodes) => [...new Set(nodes.filter(Boolean))];
    let candidates = [];
    if (option) {
      candidates = [...document.querySelectorAll('.hr-select-option')]
        .filter((node) => visible(node) && norm(node.textContent) === norm(wanted));
    } else {
      const drawers = [...document.querySelectorAll('.hr-drawer.hr-drawer--open')].filter(visible);
      if (drawers.length !== 1) return drawers.length;
      const drawer = drawers[0];
      if (confirm) {
        candidates = [...drawer.querySelectorAll('button,[role="button"],.hr-button')]
          .filter((node) => visible(node) && norm(node.textContent) === norm(wanted));
      } else {
        const labels = [drawer, ...drawer.querySelectorAll('*')]
          .filter((node) => visible(node) && norm(node.textContent) === norm(wanted) && node.children.length <= 1);
        for (const textNode of labels) {
          const lr = textNode.getBoundingClientRect();
          const ly = lr.y + lr.height / 2;
          const inputs = [...drawer.querySelectorAll('input')].filter((input) => {
            if (!visible(input)) return false;
            const r = input.getBoundingClientRect();
            return r.x >= lr.x && Math.abs(r.y + r.height / 2 - ly) <= 24;
          }).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
          const input = inputs[0];
          if (!input) continue;
          if (fill) candidates.push(input);
          else {
            let control = input;
            for (let depth = 0; control && depth < 7; depth += 1, control = control.parentElement) {
              const cls = typeof control.className === 'string' ? control.className : '';
              if (/(^|\s)hr-select(?:\s|--|$)/.test(cls) && visible(control)) { candidates.push(control); break; }
            }
          }
        }
      }
    }
    candidates = unique(candidates);
    if (candidates.length === 1) candidates[0].setAttribute(attr, value);
    return candidates.length;
  }, {
    attr: AGENT_FORM_PIN,
    value: pin,
    wanted: label,
    fieldMode,
    optionMode,
    confirmMode,
  }).catch(() => -1);
  if (count !== 1) {
    await clearFormPins(page);
    return axis(count > 1 ? 'ambiguous' : count === 0 ? 'none' : 'action_failed', Math.max(0, count));
  }
  try {
    const target = page.locator(`[${AGENT_FORM_PIN}="${pin}"]`);
    if (await target.count().catch(() => 0) !== 1) return axis('action_failed', 1);
    if (fieldMode) {
      const value = instantiate(ev.value, ctx);
      await target.first().fill(value, { timeout: 3000 });
      const got = await target.first().inputValue({ timeout: 1000 }).catch(() => null);
      return got === value ? axis('unique', 1, true) : axis('action_failed', 1);
    }
    await target.first().click({ timeout: 3000 });
    if (confirmMode) {
      try { await page.waitForURL('**/agent/detail**', { timeout: 8000 }); } catch { return axis('action_failed', 1); }
    }
    return axis('unique', 1, true);
  } catch {
    return axis('action_failed', 1);
  } finally {
    await clearFormPins(page);
  }
}

async function pinUniqueToolAdd(page) {
  const pin = `agent-tool-${++pinSequence}-${Math.random().toString(36).slice(2, 9)}`;
  const count = await page.evaluate(({ attr, value }) => {
    const visible = (node) => {
      if (!node || node.nodeType !== 1 || !node.isConnected) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0;
    };
    const norm = (input) => String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
    const all = [...document.querySelectorAll('*')].filter(visible);
    const labels = all.filter((node) => norm(node.textContent) === '工具' && node.getBoundingClientRect().width < 90);
    const controls = [];
    for (const label of labels) {
      const start = all.indexOf(label);
      for (let index = start + 1; index < all.length; index += 1) {
        const node = all[index];
        const text = norm(node.textContent);
        if ((text === '插件' || text === '知识库') && node.getBoundingClientRect().width < 90) break;
        if (!visible(node) || !/^(\+\s*)?添加$/.test(text) || node.getBoundingClientRect().width >= 120) continue;
        let control = node;
        for (let depth = 0; control && depth < 6; depth += 1, control = control.parentElement) {
          const tag = control.tagName.toLowerCase();
          const role = control.getAttribute('role');
          const cls = typeof control.className === 'string' ? control.className : '';
          if (tag === 'button' || tag === 'a' || role === 'button' || /(^|\s)hr-button(?:\s|--|$)/.test(cls)) break;
        }
        if (control && visible(control) && !controls.includes(control)) controls.push(control);
        break;
      }
    }
    if (controls.length === 1) controls[0].setAttribute(attr, value);
    return controls.length;
  }, { attr: TOOL_ADD_PIN, value: pin }).catch(() => -1);
  return { pin, count };
}

async function openToolPicker(page) {
  await clearToolAddPins(page);
  const pinned = await pinUniqueToolAdd(page);
  if (pinned.count !== 1) {
    await clearToolAddPins(page);
    return axis(pinned.count > 1 ? 'ambiguous' : pinned.count === 0 ? 'none' : 'action_failed', Math.max(0, pinned.count));
  }
  try {
    const target = page.locator(`[${TOOL_ADD_PIN}="${pinned.pin}"]`);
    if (await target.count().catch(() => 0) !== 1) return axis('action_failed', 1);
    const stillValid = await target.first().evaluate((node) => {
      if (!node || !node.isConnected) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        && /添加/.test(String(node.textContent || '').trim());
    }).catch(() => false);
    if (!stillValid) return axis('action_failed', 1);
    await target.first().click({ timeout: 3000 });
    const picker = await uniquePicker(page);
    return picker.resolution === 'unique' ? axis('unique', 1, true) : axis('action_failed', picker.candidateCount);
  } catch {
    return axis('action_failed', 1);
  } finally {
    await clearToolAddPins(page);
  }
}

async function searchPicker(page, ev) {
  const picker = await uniquePicker(page);
  if (picker.resolution !== 'unique') return axis(picker.resolution, picker.candidateCount);
  const box = picker.locator.locator('input[placeholder="请输入关键字搜索"]');
  const count = await box.count().catch(() => 0);
  if (count !== 1) return axis(count > 1 ? 'ambiguous' : 'none', count);
  try { await box.first().press(ev.key || 'Enter', { timeout: 3000 }); } catch { return axis('action_failed', 1); }
  const expectedName = typeof ev.text === 'string' ? ev.text.trim() : '';
  if (!expectedName) return axis('action_failed', 1);
  const headers = picker.locator.locator('.hr-collapse-panel__header').filter({ hasText: exactTextRe(expectedName) });
  try { await headers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const matches = await headers.count().catch(() => 0);
  return matches === 1 ? axis('unique', 1, true) : axis(matches > 1 ? 'ambiguous' : 'action_failed', matches);
}

async function expandPrimary(page, ev) {
  const picker = await uniquePicker(page);
  if (picker.resolution !== 'unique') return axis(picker.resolution, picker.candidateCount);
  const name = typeof ev.text === 'string' ? ev.text.trim() : '';
  if (!name) return axis('action_failed', 0);
  const headers = picker.locator.locator('.hr-collapse-panel__header').filter({ hasText: exactTextRe(name) });
  const count = await headers.count().catch(() => 0);
  if (count !== 1) return axis(count > 1 ? 'ambiguous' : 'none', count);
  const panel = headers.first().locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," hr-collapse-panel ")][1]');
  try {
    await headers.first().click({ timeout: 3000 });
    const tools = panel.locator('.tool-item:visible');
    await tools.first().waitFor({ state: 'visible', timeout: 5000 });
    return (await tools.count().catch(() => 0)) > 0 ? axis('unique', 1, true) : axis('action_failed', 1);
  } catch { return axis('action_failed', 1); }
}

async function selectFirstTool(page, ev, ctx) {
  const picker = await uniquePicker(page);
  if (picker.resolution !== 'unique') return axis(picker.resolution, picker.candidateCount);
  const primary = typeof ev.nodeName === 'string' ? ev.nodeName.trim() : '';
  if (!primary || ev.nth !== 0) return axis('action_failed', 0);
  const headers = picker.locator.locator('.hr-collapse-panel__header').filter({ hasText: exactTextRe(primary) });
  const headerCount = await headers.count().catch(() => 0);
  if (headerCount !== 1) return axis(headerCount > 1 ? 'ambiguous' : 'none', headerCount);
  const panel = headers.first().locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," hr-collapse-panel ")][1]');
  const items = panel.locator('.tool-item:visible');
  try { await items.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  if (await items.count().catch(() => 0) < 1) return axis('none', 0);
  const item = items.first();
  const checks = item.locator('.hr-checkbox');
  const checkCount = await checks.count().catch(() => 0);
  if (checkCount !== 1) return axis(checkCount > 1 ? 'ambiguous' : 'none', checkCount);
  const toolName = await item.evaluate((node) => {
    const desc = node.querySelector('.one-line-desc')?.textContent?.trim() || '';
    let text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (desc) text = text.replace(desc.replace(/\s+/g, ' ').trim(), '').trim();
    return text;
  }).catch(() => '');
  if (!toolName) return axis('action_failed', 1);
  try { await checks.first().click({ timeout: 3000 }); } catch { return axis('action_failed', 1); }
  const checked = await item.evaluate((node) => {
    const input = node.querySelector('input[type="checkbox"]');
    return input ? input.checked === true : !!node.querySelector('.is-checked, .hr-is-checked');
  }).catch(() => false);
  if (!checked) return axis('action_failed', 1);
  ctx.lastToolName = toolName;
  return axis('unique', 1, true);
}

async function confirmPicker(page, ctx) {
  const picker = await uniquePicker(page);
  if (picker.resolution !== 'unique') return axis(picker.resolution, picker.candidateCount);
  const buttons = picker.locator.getByRole('button', { name: '确认', exact: true });
  const count = await buttons.count().catch(() => 0);
  if (count !== 1) return axis(count > 1 ? 'ambiguous' : 'none', count);
  try { await buttons.first().click({ timeout: 3000 }); } catch { return axis('action_failed', 1); }
  try { await picker.locator.waitFor({ state: 'hidden', timeout: 5000 }); } catch { return axis('action_failed', 1); }
  const toolName = typeof ctx.lastToolName === 'string' ? ctx.lastToolName.trim() : '';
  if (!toolName) return axis('action_failed', 1);
  const chips = page.locator('.hr-tag.hr-tag--close').filter({ hasText: exactTextRe(toolName) });
  try { await chips.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  return await chips.count().catch(() => 0) === 1 ? axis('unique', 1, true) : axis('action_failed', 1);
}

async function targetRecordCount(page, targetName) {
  const records = page.locator('.hr-table-row, .hr-card.hr-card--bordered');
  const count = await records.count().catch(() => -1);
  if (count < 0) return null;
  let matches = 0;
  for (let index = 0; index < count; index += 1) {
    const exact = records.nth(index).getByText(targetName, { exact: true });
    if (await exact.count().catch(() => 0) > 0) matches += 1;
  }
  return matches;
}

async function verifyDeleteZero(page, ev, ctx) {
  const target = typeof ev.value === 'string' ? instantiate(ev.value, ctx).trim() : '';
  if (!target || ctx.agentDeleteConfirmedTarget !== target) return axis('action_failed', 0);
  // 确认授权只供一次后置检查消费；失败时也不得复用旧确认链。
  delete ctx.agentDeleteConfirmedTarget;
  const search = page.getByRole('textbox', { name: AGENT_SEARCH_NAME, exact: true });
  const count = await search.count().catch(() => 0);
  if (count !== 1) return axis(count > 1 ? 'ambiguous' : 'none', count);
  try { await search.first().press(ev.key || 'Enter', { timeout: 3000 }); } catch { return axis('action_failed', 1); }
  const startedAt = Date.now();
  const deadline = startedAt + 5000;
  let evidence = null;
  while (true) {
    const matches = await targetRecordCount(page, target);
    if (matches == null || matches > 1) return axis(matches > 1 ? 'ambiguous' : 'action_failed', matches || 0);
    const busy = await page.locator([
      '.hr-loading-mask:visible',
      '.hr-loading:visible',
      '.hr-icon-loading:visible',
      '[aria-busy="true"]',
    ].join(',')).count().then((value) => value > 0).catch(() => true);
    evidence = advanceAgentDeleteZeroEvidence(evidence, {
      elapsedMs: Math.max(0, Date.now() - startedAt),
      matches,
      busy,
    });
    if (evidence.ok) return axis('unique', 1, true);
    if (Date.now() >= deadline) return axis('action_failed', 1);
    try { await page.waitForTimeout(100); } catch { return axis('action_failed', 1); }
  }
}

export function isAgentToolSpecialAction(ev) {
  return ev && (
    (ev.atom === 'agent.create' && (ev.action === 'fill' || (ev.action === 'click' && ev.text !== '新增智能体')))
    || ev.atom === 'agent.openToolPicker'
    || (ev.atom === 'picker.search' && ev.action === 'press')
    || ev.atom === 'picker.expandPrimary'
    || ev.atom === 'picker.selectFirstTool'
    || ev.atom === 'agent.confirmToolPicker'
    || (ev.atom === 'agent.delete' && (ev.action === 'click' || (ev.action === 'press' && ev.text === 'post-delete-zero')))
  );
}

export async function performAgentToolAction(page, ev, ctx = {}) {
  if (ev.atom === 'agent.create') return performAgentCreateAction(page, ev, ctx);
  if (ev.atom === 'agent.openToolPicker') return openToolPicker(page);
  if (ev.atom === 'picker.search' && ev.action === 'press') return searchPicker(page, ev);
  if (ev.atom === 'picker.expandPrimary') return expandPrimary(page, ev);
  if (ev.atom === 'picker.selectFirstTool') return selectFirstTool(page, ev, ctx);
  if (ev.atom === 'agent.confirmToolPicker') return confirmPicker(page, ctx);
  if (ev.atom === 'agent.delete' && ev.action === 'press' && ev.text === 'post-delete-zero') return verifyDeleteZero(page, ev, ctx);
  if (ev.atom === 'agent.delete' && ev.action === 'click') {
    const target = typeof ev.value === 'string' ? instantiate(ev.value, ctx).trim() : '';
    if (!target) return axis('action_failed', 0);
    if (ev.text === '删除') {
      delete ctx.agentDeleteTriggeredTarget;
      delete ctx.agentDeleteConfirmedTarget;
      const result = await performWorkflowDeleteTrigger(page, target, { searchBoxName: AGENT_SEARCH_NAME });
      if (result.resolution === 'unique' && result.identityReadback?.ok === true) ctx.agentDeleteTriggeredTarget = target;
      return result;
    }
    if (ev.text === '确定' || ev.text === '确认') {
      if (ctx.agentDeleteTriggeredTarget !== target) return axis('action_failed', 0);
      delete ctx.agentDeleteTriggeredTarget;
      delete ctx.agentDeleteConfirmedTarget;
      const result = await performWorkflowDeleteConfirm(page, ev.text, target);
      if (result.resolution === 'unique' && result.identityReadback?.ok === true) ctx.agentDeleteConfirmedTarget = target;
      return result;
    }
  }
  return axis('action_failed', 0);
}

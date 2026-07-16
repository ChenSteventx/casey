// workflow.deleteByName 的破坏性动作域锁。
//
// 这里不裁定用例，只返回动作轴事实。目标记录、确认弹层或域内动作只要缺席/非唯一，
// 或扫描后物理身份发生变化，就 fail-safe 为 none/ambiguous/action_failed，绝不猜测点击。
const SEARCH_BOX_NAME = '输入工作流名称或编码进行搜索';
const ROOT_PIN_ATTR = 'data-casey-delete-domain-pin';
const ACTION_PIN_ATTR = 'data-casey-delete-action-pin';
const DIALOG_AUTH_PIN_ATTR = 'data-casey-delete-dialog-auth-pin';
const RECORD_SELECTOR = '.hr-table-row, .hr-card.hr-card--bordered';
const DIALOG_SELECTOR = [
  '.hr-dialog',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '.hr-message-box',
  '.hr-popconfirm',
  '[class$="message-box"]',
  '[class$="popconfirm"]',
].join(', ');
const CAUSAL_DIALOG_TIMEOUT_MS = 3000;
const CAUSAL_DIALOG_POLL_MS = 50;
const TARGET_RECORD_TIMEOUT_MS = 3000;
const TARGET_RECORD_POLL_MS = 50;

let pinSequence = 0;
const pendingDeleteByPage = new WeakMap();

function axis(resolution, candidateCount = 0, ok = false) {
  return { resolution, candidateCount, identityReadback: { ok } };
}

function freshPin(kind) {
  pinSequence += 1;
  return `casey-${kind}-${pinSequence}-${Math.random().toString(36).slice(2, 10)}`;
}

async function dispose(handle) {
  if (!handle) return;
  try { await handle.dispose(); } catch { /* 清理不得覆盖动作轴 */ }
}

async function disposeAll(handles) {
  for (const handle of handles || []) await dispose(handle);
}

async function sameNode(left, right) {
  if (!left || !right) return false;
  try { return await left.evaluate((node, other) => node === other, right); } catch { return false; }
}

async function sameNodeStrict(left, right) {
  if (!left || !right) throw new Error('physical identity unavailable');
  return await left.evaluate((node, other) => node === other, right);
}

// 纯身份分类：调用方提供物理同一性比较器，不能用 ElementHandle 包装对象引用代替 DOM 身份。
// 返回的 dialog 只可能来自 after，且必须是 before 中不存在的唯一物理节点。
export async function classifyCausalDialog(before, after, isSameNode = sameNodeStrict) {
  const baseline = Array.isArray(before) ? before : [];
  const current = Array.isArray(after) ? after : [];
  const fresh = [];
  try {
    for (const candidate of current) {
      let existed = false;
      for (const prior of baseline) {
        if (await isSameNode(candidate, prior)) {
          existed = true;
          break;
        }
      }
      if (existed) continue;
      let duplicate = false;
      for (const seen of fresh) {
        if (await isSameNode(candidate, seen)) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) fresh.push(candidate);
    }
  } catch {
    return { ...axis('action_failed', 0), dialog: null };
  }
  if (fresh.length !== 1) {
    return { ...axis(fresh.length > 1 ? 'ambiguous' : 'none', fresh.length), dialog: null };
  }
  return { ...axis('unique', 1, true), dialog: fresh[0] };
}

async function visibleExactDescendant(handle, text) {
  try {
    return await handle.evaluate((root, wanted) => {
      const norm = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
      const visible = (node) => {
        if (!node || node.nodeType !== 1 || !node.isConnected) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      if (!visible(root)) return false;
      const target = norm(wanted);
      if (!target) return false;
      for (const node of [root, ...root.querySelectorAll('*')]) {
        if (visible(node) && norm(node.textContent) === target) return true;
      }
      return false;
    }, text);
  } catch { return false; }
}

async function uniquePhysical(handles) {
  const out = [];
  for (const handle of handles || []) {
    let duplicate = false;
    for (const seen of out) {
      if (await sameNode(handle, seen)) { duplicate = true; break; }
    }
    if (duplicate) await dispose(handle); else out.push(handle);
  }
  return out;
}

async function recordDomains(page, targetName) {
  const raw = await page.locator(RECORD_SELECTOR).elementHandles().catch(() => []);
  const matches = [];
  for (const handle of raw) {
    if (await visibleExactDescendant(handle, targetName)) matches.push(handle);
    else await dispose(handle);
  }
  return uniquePhysical(matches);
}

async function waitForTargetRecordDomain(page, targetName) {
  const deadline = Date.now() + TARGET_RECORD_TIMEOUT_MS;
  while (true) {
    let domains;
    try {
      domains = await recordDomains(page, targetName);
    } catch {
      return { ...axis('action_failed', 0), root: null };
    }
    if (domains.length === 1) return { ...axis('unique', 1, true), root: domains[0] };
    const count = domains.length;
    await disposeAll(domains);
    if (count > 1) return { ...axis('ambiguous', count), root: null };
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { ...axis('none', 0), root: null };
    try {
      await page.waitForTimeout(Math.min(TARGET_RECORD_POLL_MS, remaining));
    } catch {
      return { ...axis('action_failed', 0), root: null };
    }
  }
}

async function dialogDomains(page, strict = true) {
  let raw;
  try {
    raw = await page.locator(DIALOG_SELECTOR).elementHandles();
  } catch (error) {
    if (strict) throw error;
    raw = [];
  }
  const visible = [];
  try {
    for (const handle of raw) {
      let ok = false;
      try {
        ok = await handle.evaluate((root) => {
          if (!root || !root.isConnected) return false;
          const style = window.getComputedStyle(root);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
          const rect = root.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      } catch (error) {
        if (strict) throw error;
        ok = false;
      }
      if (ok) visible.push(handle); else await dispose(handle);
    }
    if (!strict) return uniquePhysical(visible);

    const unique = [];
    for (const handle of visible) {
      let duplicate = false;
      for (const seen of unique) {
        if (await sameNodeStrict(handle, seen)) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) await dispose(handle); else unique.push(handle);
    }
    return unique;
  } catch (error) {
    await disposeAll(raw);
    throw error;
  }
}

async function pinHandle(root, attr, pin) {
  try {
    return await root.evaluate((node, { attr, value }) => {
      if (!node || !node.isConnected) return false;
      node.setAttribute(attr, value);
      return true;
    }, { attr, value: pin });
  } catch { return false; }
}

async function clearPin(page, attr, pin) {
  if (!pin) return;
  try {
    await page.locator(`[${attr}="${pin}"]`).evaluateAll((nodes, name) => {
      for (const node of nodes) node.removeAttribute(name);
    }, attr);
  } catch { /* 清理不得覆盖动作轴 */ }
}

async function pinExactAction(root, actionText, pin) {
  try {
    return await root.evaluate((domain, { text, attr, value }) => {
      const norm = (input) => String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
      const visible = (node) => {
        if (!node || node.nodeType !== 1 || !node.isConnected) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const isControl = (node) => {
        if (!node || node.nodeType !== 1) return false;
        const tag = node.tagName.toLowerCase();
        const role = node.getAttribute('role');
        const cls = typeof node.className === 'string' ? node.className : '';
        return tag === 'button' || tag === 'a' || role === 'button' || /(^|\s)hr-button(?:\s|--|$)/.test(cls);
      };
      const wanted = norm(text);
      if (!wanted || !visible(domain)) return 0;
      const controls = [];
      for (const node of [domain, ...domain.querySelectorAll('*')]) {
        if (!visible(node) || norm(node.textContent) !== wanted) continue;
        let control = node;
        while (control && control !== domain && !isControl(control)) control = control.parentElement;
        if (control === domain && !isControl(control)) control = null;
        if (control && visible(control) && domain.contains(control) && !controls.includes(control)) controls.push(control);
      }
      if (controls.length === 1) controls[0].setAttribute(attr, value);
      return controls.length;
    }, { text: actionText, attr: ACTION_PIN_ATTR, value: pin });
  } catch { return -1; }
}

async function rootStillLocked(page, root, pin, rescan) {
  const carriers = await page.locator(`[${ROOT_PIN_ATTR}="${pin}"]`).elementHandles().catch(() => []);
  if (carriers.length !== 1) { await disposeAll(carriers); return false; }
  const carrierSame = await sameNode(root, carriers[0]);
  await disposeAll(carriers);
  if (!carrierSame) return false;

  const current = await rescan();
  const unique = current.length === 1 && await sameNode(root, current[0]);
  await disposeAll(current);
  return unique;
}

async function authorizedDialogDomains(page, authorizedDialog) {
  const current = await dialogDomains(page, false);
  const matches = [];
  for (const handle of current) {
    if (await sameNode(handle, authorizedDialog)) matches.push(handle);
    else await dispose(handle);
  }
  return matches;
}

async function authorizedDialogStillLocked(page, pending) {
  const carriers = await page.locator(`[${DIALOG_AUTH_PIN_ATTR}="${pending.dialogPin}"]`).elementHandles().catch(() => []);
  if (carriers.length !== 1) {
    await disposeAll(carriers);
    return false;
  }
  const carrierSame = await sameNode(pending.dialog, carriers[0]);
  await disposeAll(carriers);
  if (!carrierSame) return false;

  const current = await authorizedDialogDomains(page, pending.dialog);
  const unique = current.length === 1 && await sameNode(pending.dialog, current[0]);
  await disposeAll(current);
  return unique;
}

async function waitForCausalDialog(page, baselineDialogs) {
  const deadline = Date.now() + CAUSAL_DIALOG_TIMEOUT_MS;
  while (true) {
    let current;
    try {
      current = await dialogDomains(page);
    } catch {
      return { ...axis('action_failed', 0), dialog: null };
    }
    const result = await classifyCausalDialog(baselineDialogs, current, sameNodeStrict);
    if (result.resolution === 'unique' && result.dialog) {
      for (const handle of current) {
        if (handle !== result.dialog) await dispose(handle);
      }
      return result;
    }
    await disposeAll(current);
    if (result.resolution === 'ambiguous' || result.resolution === 'action_failed') return result;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return result;
    try {
      await page.waitForTimeout(Math.min(CAUSAL_DIALOG_POLL_MS, remaining));
    } catch {
      return { ...axis('action_failed', 0), dialog: null };
    }
  }
}

async function releasePendingDelete(page, pending = null) {
  const stored = pendingDeleteByPage.get(page);
  const owned = pending || stored;
  if (stored && (!pending || stored === pending)) pendingDeleteByPage.delete(page);
  if (!owned) return;
  await clearPin(page, DIALOG_AUTH_PIN_ATTR, owned.dialogPin);
  await dispose(owned.dialog);
}

async function actionStillLocked(page, root, actionPin, actionText) {
  const actions = await page.locator(`[${ACTION_PIN_ATTR}="${actionPin}"]`).elementHandles().catch(() => []);
  if (actions.length !== 1) { await disposeAll(actions); return null; }
  const action = actions[0];
  let valid = false;
  try {
    valid = await action.evaluate((node, { domain, wanted }) => {
      const norm = (input) => String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
      if (!node || !node.isConnected || !domain || !domain.isConnected || !domain.contains(node)) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0 && norm(node.textContent) === norm(wanted);
    }, { domain: root, wanted: actionText });
  } catch { valid = false; }
  if (!valid) { await dispose(action); return null; }
  return action;
}

async function targetNameFromSearch(page, expectedName = null) {
  const search = page.getByRole('textbox', { name: SEARCH_BOX_NAME, exact: true });
  const count = await search.count().catch(() => 0);
  if (count !== 1) return { ok: false, axis: axis(count > 1 ? 'ambiguous' : 'none', count) };
  const value = await search.first().inputValue().catch(() => null);
  const actual = typeof value === 'string' ? value.trim() : '';
  if (!actual) return { ok: false, axis: axis('action_failed', 1) };
  if (expectedName != null && String(expectedName).trim() !== actual) return { ok: false, axis: axis('action_failed', 1) };
  return { ok: true, name: actual };
}

async function performLockedAction(page, { root, candidateCount, actionText, rescan }) {
  const rootPin = freshPin('root');
  const actionPin = freshPin('action');
  let action = null;
  try {
    if (!await pinHandle(root, ROOT_PIN_ATTR, rootPin)) return axis('action_failed', candidateCount);
    // 让同步 DOM 观察器/框架微任务有机会处理 pin；随后所有物理条件从头重验。
    await page.evaluate(() => Promise.resolve()).catch(() => {});
    if (!await rootStillLocked(page, root, rootPin, rescan)) return axis('action_failed', candidateCount);

    const actionCount = await pinExactAction(root, actionText, actionPin);
    if (actionCount === 0) return axis('none', 0);
    if (actionCount > 1) return axis('ambiguous', actionCount);
    if (actionCount < 0) return axis('action_failed', candidateCount);
    if (!await rootStillLocked(page, root, rootPin, rescan)) return axis('action_failed', candidateCount);
    action = await actionStillLocked(page, root, actionPin, actionText);
    if (!action) return axis('action_failed', 1);
    await action.click({ timeout: 3000 });
    return axis('unique', 1, true);
  } catch {
    return axis('action_failed', candidateCount);
  } finally {
    await dispose(action);
    await clearPin(page, ACTION_PIN_ATTR, actionPin);
    await clearPin(page, ROOT_PIN_ATTR, rootPin);
  }
}

export async function inspectWorkflowDeleteTarget(page, targetName) {
  const target = String(targetName == null ? '' : targetName).trim();
  if (!target) return { ...axis('action_failed', 0), tableRows: 0, targetCards: 0, deleteButtons: 0, layout: 'unknown' };
  const domains = await recordDomains(page, target);
  let tableRows = 0;
  let targetCards = 0;
  let deleteButtons = 0;
  for (const domain of domains) {
    try {
      const data = await domain.evaluate((root) => ({
        table: root.classList.contains('hr-table-row'),
        card: root.classList.contains('hr-card') && root.classList.contains('hr-card--bordered'),
      }));
      if (data.table) tableRows += 1;
      if (data.card) targetCards += 1;
      const pin = freshPin('audit-action');
      const count = await pinExactAction(domain, '删除', pin);
      await clearPin(page, ACTION_PIN_ATTR, pin);
      if (count > 0) deleteButtons += count;
    } catch { /* 对不上时由 deleteButtons/recordContainers 不恒等阻断 */ }
  }
  const count = domains.length;
  await disposeAll(domains);
  return {
    ...axis(count === 1 ? 'unique' : count > 1 ? 'ambiguous' : 'none', count, count === 1),
    tableRows,
    targetCards,
    deleteButtons,
    layout: tableRows > 0 ? 'table' : targetCards > 0 ? 'card' : 'unknown',
  };
}

export async function performWorkflowDeleteTrigger(page, expectedName = null) {
  await releasePendingDelete(page);
  const named = await targetNameFromSearch(page, expectedName);
  if (!named.ok) return named.axis;
  const target = await waitForTargetRecordDomain(page, named.name);
  if (target.resolution !== 'unique' || !target.root) return target;
  const root = target.root;
  let baselineDialogs = [];
  try {
    try {
      baselineDialogs = await dialogDomains(page);
    } catch {
      return axis('action_failed', 0);
    }
    const result = await performLockedAction(page, {
      root,
      candidateCount: 1,
      actionText: '删除',
      rescan: () => recordDomains(page, named.name),
    });
    if (result.resolution !== 'unique' || result.identityReadback?.ok !== true) return result;

    const causal = await waitForCausalDialog(page, baselineDialogs);
    if (causal.resolution !== 'unique' || !causal.dialog) {
      return axis('action_failed', causal.candidateCount);
    }
    const pending = {
      targetName: named.name,
      dialog: causal.dialog,
      dialogPin: freshPin('dialog-auth'),
    };
    if (!await pinHandle(pending.dialog, DIALOG_AUTH_PIN_ATTR, pending.dialogPin)) {
      await releasePendingDelete(page, pending);
      return axis('action_failed', 1);
    }
    if (!await authorizedDialogStillLocked(page, pending)) {
      await releasePendingDelete(page, pending);
      return axis('action_failed', 1);
    }
    pendingDeleteByPage.set(page, {
      targetName: pending.targetName,
      dialog: pending.dialog,
      dialogPin: pending.dialogPin,
    });
    return result;
  } finally {
    await dispose(root);
    await disposeAll(baselineDialogs);
  }
}

export async function inspectWorkflowDeleteConfirm(page) {
  const pending = pendingDeleteByPage.get(page);
  if (!pending) return axis('action_failed', 0);
  if (!await authorizedDialogStillLocked(page, pending)) {
    await releasePendingDelete(page, pending);
    return axis('action_failed', 0);
  }
  const root = pending.dialog;
  const candidates = [];
  let inspectFailed = false;
  for (const name of ['确定', '确认']) {
    const pin = freshPin('inspect-confirm');
    const count = await pinExactAction(root, name, pin);
    await clearPin(page, ACTION_PIN_ATTR, pin);
    if (count < 0) inspectFailed = true;
    for (let i = 0; i < Math.max(0, count); i++) candidates.push(name);
  }
  if (inspectFailed) {
    await releasePendingDelete(page, pending);
    return axis('action_failed', 0);
  }
  if (candidates.length !== 1) {
    await releasePendingDelete(page, pending);
    return axis(candidates.length > 1 ? 'ambiguous' : 'none', candidates.length);
  }
  return { ...axis('unique', 1, true), confirmName: candidates[0] };
}

export async function performWorkflowDeleteConfirm(page, confirmName, expectedName = null) {
  const pending = pendingDeleteByPage.get(page);
  if (!pending) return axis('action_failed', 0);
  // 一次性消费发生在任何校验或点击之前；失败也不得复用旧授权。
  pendingDeleteByPage.delete(page);
  try {
    const wanted = String(confirmName == null ? '' : confirmName).trim();
    if (!['确定', '确认'].includes(wanted)) return axis('action_failed', 0);
    const expected = expectedName == null ? null : String(expectedName).trim();
    if (expected && pending.targetName !== expected) return axis('action_failed', 0);
    if (!await authorizedDialogStillLocked(page, pending)) return axis('action_failed', 0);

    return await performLockedAction(page, {
      root: pending.dialog,
      candidateCount: 1,
      actionText: wanted,
      rescan: () => authorizedDialogDomains(page, pending.dialog),
    });
  } finally {
    await releasePendingDelete(page, pending);
  }
}

// workflow.deleteByName 的破坏性动作域锁。
//
// 这里不裁定用例，只返回动作轴事实。目标记录、确认弹层或域内动作只要缺席/非唯一，
// 或扫描后物理身份发生变化，就 fail-safe 为 none/ambiguous/action_failed，绝不猜测点击。
const SEARCH_BOX_NAME = '输入工作流名称或编码进行搜索';
const ROOT_PIN_ATTR = 'data-casey-delete-domain-pin';
const ACTION_PIN_ATTR = 'data-casey-delete-action-pin';
const DIALOG_AUTH_PIN_ATTR = 'data-casey-delete-dialog-auth-pin';
const RECORD_SELECTOR = '.hr-table-row, .hr-card.hr-card--bordered, .agent-card';
const DIALOG_SELECTOR = [
  '.hr-dialog',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '.hr-message-box',
  '.hr-popconfirm',
  // class$ 只覆盖目标类恰好位于 class 属性末尾的节点；组件追加状态类后会漏掉根弹层。
  // 但裸 class*= 会把 hr-message-box__header/body 等内部节点也抓成多个“弹层”。
  // 这里限定 token 边界：目标片段后须为空格或整个属性结束，兼容多 class 根节点且不抓子类。
  '[class*="message-box "]',
  '[class$="message-box"]',
  '[class*="popconfirm "]',
  '[class$="popconfirm"]',
].join(', ');
// 卡片布局（2026-08-04 真机实采）：删除入口不在记录容器内，藏在悬停浮现的「更多操作」菜单里。
// 菜单浮层带 hr-dropdown token；绝不用裸 .hr-popup——那会误抓 .hr-popup.hr-select__dropdown 选择器弹层。
// 与 DIALOG_SELECTOR 逐 token 互不相交：菜单不污染确认弹层的因果快照。
const MENU_SELECTOR = '.hr-popup.hr-dropdown, .hr-dropdown__menu';
const MENU_DELETE_TEXT = '删除';
const CAUSAL_DIALOG_TIMEOUT_MS = 3000;
const CAUSAL_DIALOG_POLL_MS = 50;
const CAUSAL_MENU_TIMEOUT_MS = 3000;
const CAUSAL_MENU_POLL_MS = 50;
// 菜单离场等待（replay-confirm-menu-dismiss 契约）：点完菜单里的删除项后，菜单不是立刻消失的。
// 已发布件的操作菜单比未发布件多一个「停用」项、关闭动画更长，而回放推进到确认步比菜单关完更快，
// 于是确认点击撞在未关闭的菜单上、被 hit-target 拦下（2026-08-10 真机录像抽帧实证：1ms 即
// actionError；对照未发布件同一步 758ms 成功）。编译期每步带观察停顿、天然慢一拍，故只在回放期显形。
const MENU_DISMISS_TIMEOUT_MS = 3000;
const MENU_DISMISS_POLL_MS = 50;
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

// mode 语义（默认 'text' = 收敛前的原行为，逐字不变）：
//   'text'           —— 域内可见、textContent 精确等于 actionText 的控件（表格直见删除钮 / 确认弹层按钮 / 只读审计）；
//   'menu'           —— 同上，但控件谓词额外认下拉菜单项（真机菜单是无角色 div 汤），并对父子同文本做包含收敛；
//   'more'           —— 域内【可见】的更多操作入口（悬停之后，点击前实证可见性）；
//   'more-presence'  —— 域内更多操作入口按【存在性】计数（只读审计环绝不悬停、绝不开菜单，故不要求可见）。
async function pinExactAction(root, actionText, pin, mode = 'text') {
  try {
    return await root.evaluate((domain, { text, attr, value, mode }) => {
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
        if (tag === 'button' || tag === 'a' || role === 'button' || /(^|\s)hr-button(?:\s|--|$)/.test(cls)) return true;
        // 菜单档默认关闭：只有显式传 mode='menu' 的调用点才放宽，既有三个调用点谓词逐字不变。
        if (mode !== 'menu') return false;
        return role === 'menuitem' || tag === 'li' || /(^|\s)hr-dropdown__item(?:-text)?(?:\s|--|$)/.test(cls);
      };
      // 更多操作入口按真机实采的两个信号取并集：专用 class 或 title 文案，任一命中即算入口。
      const isMoreEntry = (node) => {
        if (!node || node.nodeType !== 1) return false;
        const cls = typeof node.className === 'string' ? node.className : '';
        return /(^|\s)agent-card__more(?:\s|--|$)/.test(cls) || norm(node.getAttribute('title')) === '更多操作';
      };
      if (!visible(domain)) return 0;
      const controls = [];
      if (mode === 'more' || mode === 'more-presence') {
        const requireVisible = mode === 'more';
        for (const node of domain.querySelectorAll('*')) {
          if (!isMoreEntry(node)) continue;
          if (requireVisible && !visible(node)) continue;
          if (domain.contains(node) && !controls.includes(node)) controls.push(node);
        }
      } else {
        const wanted = norm(text);
        if (!wanted) return 0;
        for (const node of [domain, ...domain.querySelectorAll('*')]) {
          if (!visible(node) || norm(node.textContent) !== wanted) continue;
          let control = node;
          while (control && control !== domain && !isControl(control)) control = control.parentElement;
          if (control === domain && !isControl(control)) control = null;
          if (control && visible(control) && domain.contains(control) && !controls.includes(control)) controls.push(control);
        }
        // 菜单档专属归一：div.hr-dropdown__item > span.hr-dropdown__item-text 两层 textContent 都恰为
        // 目标文案、两层又都被菜单档认成控件，只靠身份去重会收出两个 → 假 ambiguous、功能直接不通。
        // 命中集内被另一命中节点包含者剔除，只留最外层（真实可点的那一层）。互不包含的两项仍判多命中。
        if (mode === 'menu') {
          for (let i = controls.length - 1; i >= 0; i--) {
            if (controls.some((other) => other !== controls[i] && other.contains(controls[i]))) controls.splice(i, 1);
          }
        }
      }
      if (controls.length === 1) controls[0].setAttribute(attr, value);
      return controls.length;
    }, { text: actionText, attr: ACTION_PIN_ATTR, value: pin, mode });
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

async function actionStillLocked(page, root, actionPin, actionText, mode = 'text') {
  const actions = await page.locator(`[${ACTION_PIN_ATTR}="${actionPin}"]`).elementHandles().catch(() => []);
  if (actions.length !== 1) { await disposeAll(actions); return null; }
  const action = actions[0];
  let valid = false;
  try {
    valid = await action.evaluate((node, { domain, wanted, mode }) => {
      const norm = (input) => String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
      if (!node || !node.isConnected || !domain || !domain.isConnected || !domain.contains(node)) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const shown = style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0;
      if (!shown) return false;
      if (mode === 'more') {
        const cls = typeof node.className === 'string' ? node.className : '';
        return /(^|\s)agent-card__more(?:\s|--|$)/.test(cls) || norm(node.getAttribute('title')) === '更多操作';
      }
      return norm(node.textContent) === norm(wanted);
    }, { domain: root, wanted: actionText, mode });
  } catch { valid = false; }
  if (!valid) { await dispose(action); return null; }
  return action;
}

async function targetNameFromSearch(page, expectedName = null, searchBoxName = SEARCH_BOX_NAME) {
  const searchName = typeof searchBoxName === 'string' ? searchBoxName.trim() : '';
  if (!searchName) return { ok: false, axis: axis('action_failed', 0) };
  const search = page.getByRole('textbox', { name: searchName, exact: true });
  const count = await search.count().catch(() => 0);
  if (count !== 1) return { ok: false, axis: axis(count > 1 ? 'ambiguous' : 'none', count) };
  const value = await search.first().inputValue().catch(() => null);
  const actual = typeof value === 'string' ? value.trim() : '';
  if (!actual) return { ok: false, axis: axis('action_failed', 1) };
  if (expectedName != null && String(expectedName).trim() !== actual) return { ok: false, axis: axis('action_failed', 1) };
  return { ok: true, name: actual };
}

// beforeClick（可选）：在真正落笔点击的前一刻回调，供调用方精确区分「点过了」与「还没点就败了」。
// 它只做标记，抛错也一律吞掉——绝不允许标记动作改写动作轴。缺省不传时行为与收敛前逐字相同。
async function performLockedAction(page, { root, candidateCount, actionText, rescan, mode = 'text', beforeClick = null }) {
  const rootPin = freshPin('root');
  const actionPin = freshPin('action');
  let action = null;
  try {
    if (!await pinHandle(root, ROOT_PIN_ATTR, rootPin)) return axis('action_failed', candidateCount);
    // 让同步 DOM 观察器/框架微任务有机会处理 pin；随后所有物理条件从头重验。
    await page.evaluate(() => Promise.resolve()).catch(() => {});
    if (!await rootStillLocked(page, root, rootPin, rescan)) return axis('action_failed', candidateCount);

    const actionCount = await pinExactAction(root, actionText, actionPin, mode);
    if (actionCount === 0) return axis('none', 0);
    if (actionCount > 1) return axis('ambiguous', actionCount);
    if (actionCount < 0) return axis('action_failed', candidateCount);
    if (!await rootStillLocked(page, root, rootPin, rescan)) return axis('action_failed', candidateCount);
    action = await actionStillLocked(page, root, actionPin, actionText, mode);
    if (!action) return axis('action_failed', 1);
    if (typeof beforeClick === 'function') { try { beforeClick(); } catch { /* 标记不得覆盖动作轴 */ } }
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

// 浮层菜单命中集归一：可见过滤（真机菜单有隐藏副本多份）→ 物理去重 → 只留最外层。
// 「只留最外层」是因为浮层根 .hr-popup.hr-dropdown 与其内层 .hr-dropdown__menu 会同时命中，
// 两者都算「新浮层」就会自造 ambiguous。互不包含的两个浮层仍判 ambiguous，fail-safe 不变。
async function outermostOnly(handles) {
  const list = handles || [];
  const keep = [];
  const drop = [];
  for (const handle of list) {
    let contained = false;
    for (const other of list) {
      if (other === handle) continue;
      let inside = false;
      try { inside = await other.evaluate((node, child) => node !== child && node.contains(child), handle); } catch { inside = false; }
      if (inside) { contained = true; break; }
    }
    (contained ? drop : keep).push(handle);
  }
  await disposeAll(drop);
  return keep;
}

async function menuDomains(page) {
  const raw = await page.locator(MENU_SELECTOR).elementHandles();
  const shown = [];
  try {
    for (const handle of raw) {
      const ok = await handle.evaluate((root) => {
        if (!root || !root.isConnected) return false;
        const style = window.getComputedStyle(root);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        const rect = root.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (ok) shown.push(handle); else await dispose(handle);
    }
  } catch (error) {
    await disposeAll(raw);
    throw error;
  }
  return outermostOnly(await uniquePhysical(shown));
}

async function authorizedMenuDomains(page, authorizedMenu) {
  let current;
  try { current = await menuDomains(page); } catch { return []; }
  const matches = [];
  for (const handle of current) {
    if (await sameNode(handle, authorizedMenu)) matches.push(handle);
    else await dispose(handle);
  }
  return matches;
}

// 重渲染换节点洗绿（pi R3 反例）：原因果句柄缺席不足以证闭合——SUT 可在 Escape 同一拍移除旧节点
// 并重渲染同形可见菜单。闭合的充分条件收紧为：原句柄缺席 且 页面不存在「可见、菜单域形状、含可见
// 精确『删除』项」的残留。本判据只读（绝不给残留菜单打 pin 属性——那是别人的菜单）；读不出即抛、
// 由调用方判 failed。代价：合法保留的基线旧菜单（含删除项）会被保守判 failed——保守失败而非假
// closed，语义与边界见 plan §3.2b 与金牌 R25。
async function visibleDeleteMenuResidual(page) {
  let domains = [];
  try {
    domains = await menuDomains(page);
    for (const domain of domains) {
      const hit = await domain.evaluate((root, wanted) => {
        const norm = (input) => String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
        const visible = (node) => {
          if (!node || node.nodeType !== 1 || !node.isConnected) return false;
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        if (!visible(root)) return false;
        for (const node of root.querySelectorAll('*')) {
          if (visible(node) && norm(node.textContent) === wanted) return true;
        }
        return false;
      }, MENU_DELETE_TEXT);
      if (hit) return true;
    }
    return false;
  } finally {
    await disposeAll(domains);
  }
}

// 因果菜单授权：只接受点击目标记录的更多操作入口后恰好新出现的那一个浮层菜单。
// 与确认弹层同一条纪律、同一个已冻结的纯函数 classifyCausalDialog、同一套物理身份比较。
async function waitForCausalMenu(page, baselineMenus) {
  const deadline = Date.now() + CAUSAL_MENU_TIMEOUT_MS;
  while (true) {
    let current;
    try {
      current = await menuDomains(page);
    } catch {
      return { ...axis('action_failed', 0), dialog: null };
    }
    const result = await classifyCausalDialog(baselineMenus, current, sameNodeStrict);
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
      await page.waitForTimeout(Math.min(CAUSAL_MENU_POLL_MS, remaining));
    } catch {
      return { ...axis('action_failed', 0), dialog: null };
    }
  }
}

// 卡片布局删除触发：记录容器内无直见删除钮时才走这条（调用点只喂它旧路径已判 none 的那一支）。
// 结构性容器归属在浮层场景不成立，改由三道锁顶上：更多操作入口须在卡片域内恰一命中、菜单须是恰一个
// 因果新浮层、点删除项前重验卡片仍唯一锁定（防框架重渲染换根后误删邻居）。
async function performCardMenuDeleteTrigger(page, { root, rescan }) {
  // beforeClick 只证明 click 调用已经开始，不能证明事件已分发、更不能证明菜单属于本次动作。
  // 收拾所有权必须绑定 waitForCausalMenu 实证得到的唯一新菜单；拿不到物理句柄就不按 Escape，
  // 绝不关闭基线旧菜单，也绝不虚报 menuCleanup。
  let entryAttempted = false;
  let menu = null;
  // 收拾唯一因果新菜单。Escape 不抛错不等于真的关掉，须再按同一物理句柄验缺席。
  // 失败绝不吞：具名落 menuCleanup，且任何取值都不参与 resolution 判定。
  const settle = async (result) => {
    if (!menu) return result;
    let menuCleanup = 'closed';
    try { await page.keyboard.press('Escape'); } catch { menuCleanup = 'failed'; }
    let remaining = [];
    try {
      remaining = await authorizedMenuDomains(page, menu);
      if (remaining.length !== 0) menuCleanup = 'failed';
      // 原句柄缺席≠闭合（pi R3 重渲染洗绿）：还须页面无「可见、菜单形、含可见精确『删除』项」残留。
      // 判据只读、证不出一律 failed；绝不为此追加 Escape，也绝不收拾无所有权菜单。
      else if (await visibleDeleteMenuResidual(page)) menuCleanup = 'failed';
    } catch {
      menuCleanup = 'failed';
    } finally {
      await disposeAll(remaining);
    }
    return { ...result, menuCleanup };
  };
  try {
    // 悬停排在唯一性锁定之后：更多操作入口在真机上悬停才浮现，但绝不对未锁定的记录动手。
    try { await root.hover(); } catch { return axis('action_failed', 1); }

    let baselineMenus = [];
    try { baselineMenus = await menuDomains(page); } catch { return axis('action_failed', 1); }
    let entry;
    try {
      entry = await performLockedAction(page, {
        root, candidateCount: 1, actionText: null, rescan, mode: 'more',
        beforeClick: () => { entryAttempted = true; },
      });
      if (entry.resolution !== 'unique' || entry.identityReadback?.ok !== true) {
        // click 可能在生成菜单后才抛错；仍须经因果差分取得唯一物理所有权，不能仅凭 attempt 猜。
        if (entryAttempted && entry.resolution === 'action_failed') {
          const causal = await waitForCausalMenu(page, baselineMenus);
          if (causal.resolution === 'unique' && causal.dialog) menu = causal.dialog;
        }
        return await settle(entry);
      }

      const causal = await waitForCausalMenu(page, baselineMenus);
      if (causal.resolution !== 'unique' || !causal.dialog) {
        return axis(causal.resolution === 'unique' ? 'action_failed' : causal.resolution, causal.candidateCount);
      }
      menu = causal.dialog;
    } finally {
      await disposeAll(baselineMenus);
    }

    if (!await rescanStillUnique(page, root, rescan)) return await settle(axis('action_failed', 1));
    const picked = await performLockedAction(page, {
      root: menu,
      candidateCount: 1,
      actionText: MENU_DELETE_TEXT,
      rescan: () => authorizedMenuDomains(page, menu),
      mode: 'menu',
    });
    if (picked.resolution !== 'unique' || picked.identityReadback?.ok !== true) return await settle(picked);
    // 点完菜单项后等菜单离场再交棒，否则下一步的确认点击会撞上尚未关闭的菜单（真机实证）。
    // 加法字段：不改 resolution、不改任何既有字段，超时也只留痕不阻断。
    return { ...picked, menuDismiss: await waitForMenuDismissed(menu) };
  } catch {
    return await settle(axis('action_failed', 1));
  } finally {
    await dispose(menu);
  }
}

// 菜单是否仍占着可交互位。判据逐字复用本文件 actionStillLocked 的三合一口径
// （display / visibility / rect），不另造：取可见性而非 DOM 移除——assert-visibility-semantics
// 契约的真机探针实测过同类浮层「关闭后 DOM 命中仍 1、可见命中 0」，判 detach 会等到超时。
// evaluate 抛错按已离场处理：节点卸载后 evaluate 必抛，这是最常见的抛错来由，且与本文件
// dispose / sameNode 等既有 catch 风格一致；判错的代价只是少等一会儿，而后续确认点击自己
// 还有一道 fail-safe（点不动就 action_failed，裁定判 NEEDS_HUMAN，不会假绿）。
async function menuStillShown(menu) {
  if (!menu) return false;
  try {
    return await menu.evaluate((node) => {
      if (!node || !node.isConnected) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0;
    });
  } catch { return false; }
}

// 有界等菜单离场。返回加法证据字段，绝不改写动作轴的 resolution（D3 由 Steven 裁取丙：
// 超时不阻断、但必须留痕——超时若不留痕，事后只能从耗时反推，而「菜单未在预算内离场」
// 正是本次事故里最该被看见却恰恰看不见的那条事实）。
async function waitForMenuDismissed(menu) {
  const startedAt = Date.now();
  for (;;) {
    if (!await menuStillShown(menu)) return { dismissed: true, waitedMs: Date.now() - startedAt };
    if (Date.now() - startedAt >= MENU_DISMISS_TIMEOUT_MS) {
      return { dismissed: false, waitedMs: Date.now() - startedAt };
    }
    await new Promise((resolve) => { setTimeout(resolve, MENU_DISMISS_POLL_MS); });
  }
}

// 菜单浮出后目标记录必须仍是唯一命中且仍是同一个物理节点。
async function rescanStillUnique(page, root, rescan) {
  let current;
  try { current = await rescan(); } catch { return false; }
  const unique = current.length === 1 && await sameNode(root, current[0]);
  await disposeAll(current);
  return unique;
}

export async function inspectWorkflowDeleteTarget(page, targetName) {
  const target = String(targetName == null ? '' : targetName).trim();
  if (!target) {
    return {
      ...axis('action_failed', 0),
      tableRows: 0, targetCards: 0, deleteButtons: 0,
      directDeleteButtons: 0, menuDeleteEntries: 0, layout: 'unknown',
    };
  }
  const domains = await recordDomains(page, target);
  let tableRows = 0;
  let targetCards = 0;
  let directDeleteButtons = 0;
  let menuDeleteEntries = 0;
  for (const domain of domains) {
    try {
      const data = await domain.evaluate((root) => ({
        table: root.classList.contains('hr-table-row'),
        card: (root.classList.contains('hr-card') && root.classList.contains('hr-card--bordered'))
          || root.classList.contains('agent-card'),
      }));
      if (data.table) tableRows += 1;
      if (data.card) targetCards += 1;
      const directPin = freshPin('audit-action');
      const direct = await pinExactAction(domain, '删除', directPin);
      await clearPin(page, ACTION_PIN_ATTR, directPin);
      if (direct > 0) directDeleteButtons += direct;
      // 审计是编译期只读对账，绝不悬停、绝不开菜单（开菜单有副作用且菜单是瞬态的）。
      // 故更多操作入口按存在性数；它当前可不可见由触发环在点击前实证。
      const menuPin = freshPin('audit-more');
      const entries = await pinExactAction(domain, null, menuPin, 'more-presence');
      await clearPin(page, ACTION_PIN_ATTR, menuPin);
      if (entries > 0) menuDeleteEntries += entries;
    } catch { /* 对不上时由 deleteButtons/recordContainers 不恒等阻断 */ }
  }
  const count = domains.length;
  await disposeAll(domains);
  return {
    ...axis(count === 1 ? 'unique' : count > 1 ? 'ambiguous' : 'none', count, count === 1),
    tableRows,
    targetCards,
    // 可达删除面 = 直见删除钮 + 更多操作入口。汇总器要证的不变量是「一条记录 ↔ 一个删除入口」的基数
    // 恒等，不是字面量统计；两类入口都能删，故都得算进去（并存 = 2 ≠ 1，编译期照样硬阻断）。
    deleteButtons: directDeleteButtons + menuDeleteEntries,
    // 下面两个是加法证据字段，只许当证据读：任何生产判断一律只认 deleteButtons 与汇总器结论。
    directDeleteButtons,
    menuDeleteEntries,
    layout: tableRows > 0 ? 'table' : targetCards > 0 ? 'card' : 'unknown',
  };
}

export async function performWorkflowDeleteTrigger(page, expectedName = null, options = {}) {
  await releasePendingDelete(page);
  // 删除目标必须由已签 events 显式绑定；缺值时不得退化为从搜索框现状猜目标。
  const expected = expectedName == null ? '' : String(expectedName).trim();
  if (!expected) return axis('action_failed', 0);
  const named = await targetNameFromSearch(page, expected, options.searchBoxName || SEARCH_BOX_NAME);
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
    // 卡片布局接管点：只吃旧路径判 none 的那一支（记录容器内无直见删除钮）。
    // unique / ambiguous / action_failed 全部短路——表格布局与多命中具名拒的行为一寸不动。
    const effective = result.resolution === 'none'
      ? await performCardMenuDeleteTrigger(page, { root, rescan: () => recordDomains(page, named.name) })
      : result;
    if (effective.resolution !== 'unique' || effective.identityReadback?.ok !== true) return effective;

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
    return effective;
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

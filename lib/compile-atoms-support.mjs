// Shared deterministic helpers for compile atom modules.
import { stripUrlQuery, maskCredentialRoute } from './cred-gate.mjs';
import { inspectWorkflowDeleteTarget } from './workflow-delete-domain.mjs';

export const ROUTE_LIST = '/ai-manager/process/list';
export const SEARCH_BOX_NAME = '输入工作流名称或编码进行搜索';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// chat 维度常量（chiefcomplaint-smoke，regress atoms.registry 默认值原样移植；GRILL D5/D6）。

// bindAgent 选中值物理回读（codex R3-H2 同刻助手）：只在已绑定触发器物理句柄内查询可见 `.agent-bind-select__value`，
// 可见判据与 nodeDrawerDomain 同口径（computedStyle + 非零盒），恰一才返回文本，否则 null（证不出）。
export async function readBoundAgentSelectValue(trigHandle) {
  try {
    return await trigHandle.evaluate((el) => {
      const visible = (node) => {
        if (!node || node.nodeType !== 1) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const nodes = Array.from(el.querySelectorAll('.agent-bind-select__value')).filter(visible);
      return nodes.length === 1 ? nodes[0].textContent : null;
    });
  } catch {
    return null;
  }
}

export const AGENT_SEARCH_NAME = '输入智能体名称或编码进行搜索';
export const AGENT_MENU_ITEM_CSS = '.hr-menu :text-is("智能体管理")'; // 菜单容器限定（regress 裸 getByText 真机挂档：面包屑同名 + 拦截）
export const CHAT_STREAM_ROUTE = '/ai-api/tester/agent/stream';
export const CHAT_REPLY_SELECTOR = '.hr-chat__text__assistant';
export const CHAT_SEND_ICON = '.hr-icon.hr-icon-arrow-up';
export const CHAT_DRAWER_CLOSE = '.hr-drawer.hr-drawer--right.hr-drawer--open > .hr-drawer__content-wrapper > .hr-drawer__close-btn > .hr-icon';

export const exactTextRe = (s) => new RegExp(`^${String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

export function requestLogPath(url) {
  const clean = stripUrlQuery(url);
  let p;
  try { p = new URL(clean).pathname; } catch { p = clean; }
  return maskCredentialRoute(p); // 凭据路由名源头打码（cred-route-mask）：门全严之下真机 requestLog 可落盘
}

// 语义定位（与 lib/replay-actions.mjs 的 semanticLocator 同语义——编译期作者与回放期消费者同构）。
export function locatorFor(page, ev) {
  const s = ev.semantic;
  if (s && s.kind === 'role' && s.role) return page.getByRole(s.role, { name: s.name, exact: s.exact !== false });
  if (s && s.kind === 'label' && s.name) return page.getByLabel(s.name);
  if (s && s.kind === 'text' && s.name) return page.getByText(s.name, { exact: !!s.exact });
  if (ev.role && ev.accessibleName) return page.getByRole(ev.role, { name: ev.accessibleName, exact: true });
  if (ev.fieldLabel) return page.getByLabel(ev.fieldLabel);
  return null;
}

export async function canvasBox(page) {
  const locs = [page.locator('.lf-canvas-overlay'), page.locator('.lf-graph')];
  for (const loc of locs) {
    if ((await loc.count().catch(() => 0)) !== 1) continue;
    const box = await loc.boundingBox().catch(() => null);
    if (box) return box;
  }
  return null;
}

export async function nodeDragSource(page, nodeName) {
  const src = page.locator('.node-item').filter({ hasText: exactTextRe(nodeName) });
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

export async function workflowNodeBox(page, label) {
  const handle = page.locator('.lf-canvas-overlay').getByText(label, { exact: true }).first();
  // 缺席守卫（codex R2-F2）：waitFor 抛不得穿出——节点缺席 → 返回 null，让编译期预检推 blocker（fail-closed
  // 带诊断），否则 TimeoutError 穿出 compileFlow → executeMode catch 跳产物块、连 blocker 诊断都不落只剩剥栈 exit 1。
  try { await handle.waitFor({ state: 'visible', timeout: 5000 }); } catch { return null; }
  return await handle.evaluate((el) => {
    let n = el;
    while (n && !(n.classList && n.classList.contains('lf-node'))) n = n.parentElement;
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }).catch(() => null);
}

export async function dragConnectByLabels(page, fromLabel, toLabel) {
  const sBox = await workflowNodeBox(page, fromLabel);
  const eBox = await workflowNodeBox(page, toLabel);
  if (!sBox || !eBox) throw new Error('源/目标节点 boundingBox 证不出');
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
  if (!srcAnchor) throw new Error('找不到源节点 .lf-node-anchor-hover');
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
}

// 当前节点抽屉专属锚（drawer-lock-hardening GRILL D2，与 lib/replay-actions.mjs 的 nodeDrawerDomain
// 同算法，两门同刻，各自持有 page 引用故各自一份实现——既有代码 locatorFor/canvasBox 等同类重复的
// 先例）：可见 .hr-drawer__content-wrapper 且内含【自身也可见】的精确标题文本——filter({has}) 只证
// 「后代存在该文本」、不证该文本节点自身可见，故逐候选二次核验标题文本自身 :visible（评审 F1/D2 修订）。
// A1 修复（汇裁 r4，与 lib/replay-actions.mjs 同算法两门同刻）：一次性快照物理句柄（elementHandles 单次
// 解析即锚定全体候选），再逐句柄页内核验可见标题——不再经任何惰性 nth(k) Locator 重解析。扫描即锚定：
// 快照之后任何同标题替换 → 句柄脱附 → 后续核验/盖章抛错落 fail-closed，构造上封死「检查过的节点 ≠
// 锚定的节点」。返回物理句柄数组，调用方用完 disposeDomain 释放；未通过标题核验的候选当场释放不外泄。
export async function nodeDrawerDomain(page, label) {
  // 空 target 防御（codex r5 fail-open，与回放门同刻）：label trim 后为空时，页内判据 norm(lbl)='' 会命中
  // 任何空文本节点当标题——空 target 绝不能锚定任何抽屉，早返空数组封死此假绿面（调用方另有 trim 空门）。
  if (String(label == null ? '' : label).trim() === '') return [];
  const structural = page.locator('.hr-drawer__content-wrapper:visible').filter({ has: page.getByText(label, { exact: true }) });
  const handles = await structural.elementHandles().catch(() => []);
  const matches = [];
  for (const h of handles) {
    let ok = false;
    try {
      ok = await h.evaluate((el, lbl) => {
        const visible = (node) => {
          if (!node || node.nodeType !== 1) return false;
          const style = window.getComputedStyle(node);
          if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        // wrapper 自身须可见（对齐 Playwright :visible：非空盒 + visibility 未隐藏）
        if (!visible(el)) return false;
        // 内含【自身也可见】的精确标题文本（存在量词：任一命中可见即成立，堵隐藏同文案在前的合法抽屉误拒）。
        // norm 两侧同归一（codex r4 MED，与回放门同刻）：Playwright getByText(exact) 同时归一查询文本与 DOM
        // 文本，只归一 DOM 却比原始 lbl 会把带前后/多空白的合法 label 判假阴——lbl 侧同走 norm 才对齐 exact 语义。
        const norm = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
        const target = norm(lbl);
        const nodes = [el, ...el.querySelectorAll('*')];
        for (const node of nodes) {
          if (norm(node.textContent) === target && visible(node)) return true;
        }
        return false;
      }, label);
    } catch { ok = false; }
    if (ok) matches.push(h); else await disposeHandle(h);
  }
  return matches;
}
// 抗漂移绑定（实现评审 r1 codex HIGH#1，r4 汇裁 A1 收口，与 lib/replay-actions.mjs 同算法两门同刻）：
// nodeDrawerDomain 已返回扫描时锚定的物理句柄（不再是惰性 nth(k) Locator），域内恰一判定通过后直接对该
// 句柄盖 pin，后续字段/触发器定位与落笔全以 pin 锚为根；因盖 pin 用的就是扫描时核验过的句柄本身，身份
// 锚定不再晚于检查时刻。pin 是惰性 data 属性，不进 events/observed/报告，不影响 SUT 行为。
export const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
let nodeDrawerPinSeq = 0;
export async function disposeHandle(handle) {
  if (!handle) return;
  try { await handle.dispose(); } catch { /* 清理失败不得覆盖原裁定 */ }
}
// 释放 nodeDrawerDomain 返回的物理句柄数组（A1 释放纪律：只用计数的调用方每次调用后全量释放，防泄漏）。
export async function disposeDomain(handles) {
  if (!handles) return;
  for (const h of handles) await disposeHandle(h);
}
export async function sameDomNode(page, left, right) {
  if (!left || !right) return false;
  try { return await page.evaluate((pair) => pair[0] === pair[1], [left, right]); } catch { return false; }
}
export async function handleInsideRoot(handle, rootHandle) {
  if (!handle || !rootHandle) return false;
  try { return await handle.evaluate((el, rootEl) => rootEl.contains(el), rootHandle); } catch { return false; }
}
export async function locatorStillBound(page, locator, index, expectedHandle, exactCount = null) {
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
// 三闸齐备（r2 HIGH 物理化 + r4 汇裁 A2 补挂点闸，与 lib/replay-actions.mjs 同刻）：pin 属性可被页面脚本
// 复制/搬移，重判验三条物理口径——①域内唯一者与被钉 ElementHandle【物理同一】（防替换，cur[0] 经 A1
// 已是扫描时锚定的句柄，直接比对）；②pin 全页恰一（防复制，属性被复制会把域外节点纳入按 pin 定根的
// 定位）；③唯一 pin 承载者与被钉物理节点【物理同一】（A2 防搬移：pin 搬到无标题嵌套 wrapper 后域计数仍
// 唯一、pinCount 仍 1，前两闸皆过，唯挂点闸能识破——否则 bound.root 按 pin 定位到嵌套 wrapper、候选域缩窄
// 洗成 unique 假绿）。任一闸不过 → action_failed，绝不带疑落笔。
export async function verifyPinnedNodeDrawer(page, label, pin, rootHandle) {
  const cur = await nodeDrawerDomain(page, label);
  try {
    if (cur.length !== 1) return { status: cur.length === 0 ? 'none' : 'ambiguous', count: cur.length };
    if (!(await sameDomNode(page, cur[0], rootHandle))) return { status: 'action_failed', count: 1 }; // 域内唯一者不是被钉物理节点=漂移/被替换，证不出归属
    const pinCount = await page.locator(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`).count().catch(() => 0);
    if (pinCount !== 1) return { status: 'action_failed', count: pinCount }; // pin 被复制/丢失，绑定证不出
    let carrier = null;
    try {
      carrier = await page.$(`[${NODE_DRAWER_PIN_ATTR}="${pin}"]`);
      if (!(await sameDomNode(page, carrier, rootHandle))) return { status: 'action_failed', count: 1 }; // A2：唯一 pin 承载者不是被钉物理节点=被搬移，证不出归属
    } finally { await disposeHandle(carrier); }
    return { status: 'ok', count: 1 };
  } finally {
    await disposeDomain(cur);
  }
}
export async function pinNodeDrawer(page, label) {
  const domain = await nodeDrawerDomain(page, label);
  if (domain.length !== 1) {
    const count = domain.length;
    await disposeDomain(domain);
    return { status: count === 0 ? 'none' : 'ambiguous', count, root: null, pin: null, rootHandle: null };
  }
  const rootHandle = domain[0]; // A1：扫描时核验过的物理句柄本身，直接盖 pin（删掉锚定时刻的惰性重解析）
  const pin = `pin_${(nodeDrawerPinSeq++).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
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
// D3/D4 修订（drawer-lock-hardening）：run 态当前节点抽屉标题缺失/非 string/trim 后为空 → 硬阻断。
export function nodeDrawerLabelInvalid(label) {
  return typeof label !== 'string' || label.trim() === '';
}

export function summarizeDeleteCountAudit({
  tableRows = null,
  targetCards = null,
  tableDeleteButtons = null,
  targetCardDeleteButtons = null,
  globalDeleteButtons = null,
} = {}) {
  // 一个目标同时落入表格行和卡片域时，不能任选其一继续对账：那会把另一布局的同名
  // 记录静默丢掉，给破坏性删除制造假 1:1。混合/未知布局都明确 fail-closed。
  const hasTable = Number.isInteger(tableRows) && tableRows > 0;
  const hasCard = Number.isInteger(targetCards) && targetCards > 0;
  const layout = hasTable && hasCard ? 'mixed' : hasTable ? 'table' : hasCard ? 'card' : 'unknown';
  const recordContainers = layout === 'table' ? tableRows : layout === 'card' ? targetCards : null;
  const deleteButtons = layout === 'table'
    ? tableDeleteButtons
    : layout === 'card'
      ? targetCardDeleteButtons
      : null;
  return {
    tableRows, targetCards, tableDeleteButtons, targetCardDeleteButtons, globalDeleteButtons,
    layout, recordContainers, deleteButtons,
    equal: (layout === 'table' || layout === 'card')
      && Number.isInteger(deleteButtons) && deleteButtons >= 0
      && recordContainers === deleteButtons,
  };
}

export async function auditDeleteCount(page, targetName) {
  const inspected = await inspectWorkflowDeleteTarget(page, targetName);
  // inspectWorkflowDeleteTarget.deleteButtons 是所有命中记录域内的总数；只有布局互斥时，
  // 才能诚实命名为 tableDeleteButtons / targetCardDeleteButtons。混合布局留 null，由汇总器阻断。
  const tableOnly = inspected.tableRows > 0 && inspected.targetCards === 0;
  const cardOnly = inspected.targetCards > 0 && inspected.tableRows === 0;
  const counts = {
    tableRows: inspected.tableRows,
    targetCards: inspected.targetCards,
    tableDeleteButtons: tableOnly ? inspected.deleteButtons : null,
    targetCardDeleteButtons: cardOnly ? inspected.deleteButtons : null,
    globalDeleteButtons: await page.getByText('删除', { exact: true }).count().catch(() => null),
  };
  return summarizeDeleteCountAudit(counts);
}

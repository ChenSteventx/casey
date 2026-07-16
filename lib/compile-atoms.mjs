// lib/compile-atoms.mjs —— 相1 编译执行引擎：骑 atom 知识把 flow 步翻成确定性 events + 观测现状 + 核验记录。
// 决策依 docs/plans/p3-compile/proposed/GRILL.md：G1 取 B（本引擎只产事实，回放核验另跑）、
// G6 分岔三取 C（events url 一律 {{baseUrl}} 占位符）、G1 附属（入口可证缺席 → 候选 + 不落该步、编译继续）、
// G7-3（assert.* 原子不产 event、折进所在 intent 意图留痕）。
// 本引擎零 LLM：flow 草稿由 LLM 在 CLI 外产出；这里是确定性执行 + 采集（L0）。
// 裁判零 LLM（护栏 #15）：本模块只产事实，绝不裁定、绝不写 verdict/passes。
import { instantiate } from './instantiate.mjs';
import { stripUrlQuery, maskCredentialRoute } from './cred-gate.mjs';
import {
  inspectWorkflowDeleteConfirm,
  inspectWorkflowDeleteTarget,
  performWorkflowDeleteConfirm,
  performWorkflowDeleteTrigger,
} from './workflow-delete-domain.mjs';
import {
  buildAgentToolAtomEvents,
  createAgentToolCompileState,
} from './agent-tool-compile.mjs';
import { isAgentToolSpecialAction, performAgentToolAction } from './agent-tool-actions.mjs';

export const ROUTE_LIST = '/ai-manager/process/list';
// 编译分派表 = 单一事实源（codex R1-F1）：atom → 编译函数；COMPILE_KNOWN_ATOMS 由其键派生、compileAtomStep
// 也查它执行，杜绝「Set 与 if 分派链」双源漂移（Set 多/少列一个都会重现桥要堵的缝）。编译函数为 async function
// 声明（模块内提升），此处引用安全。login/assert.* 是显式特殊分支（不产 event/折进意图），不入本表。
// Object.create(null)（codex R2）：无原子链、`toString`/`constructor` 这类键取不到 Object.prototype 函数。
const COMPILE_ATOM_COMPILERS = Object.assign(Object.create(null), {
  'workflow.create': compileWorkflowCreate,
  'workflow.save': compileWorkflowSave,
  'workflow.publish': compileWorkflowPublish,
  'workflow.clickEditorButton': compileWorkflowClickEditorButton,
  'workflow.closeDrawer': compileWorkflowCloseDrawer,
  'workflow.deleteByName': compileWorkflowDelete,
  'workflow.open': compileWorkflowOpen,
  'workflow.addNode': compileWorkflowAddNode,
  'workflow.connectNodes': compileWorkflowConnectNodes,
  'workflow.openNode': compileWorkflowOpenNode,
  'workflow.selectNodeDropdown': compileWorkflowSelectNodeDropdown,
  'workflow.setNodeField': compileWorkflowSetNodeField,
  'nav.agentManagement': compileNavAgentManagement,
  'nav.workflowManagement': compileNavWorkflowManagement,
  'agent.searchOpen': compileAgentSearchOpen,
  'agent.openTestPanel': compileAgentOpenTestPanel,
  'agent.create': compileAgentCreate,
  'agent.openToolPicker': compileAgentOpenToolPicker,
  'picker.search': compilePickerSearch,
  'picker.expandPrimary': compilePickerExpandPrimary,
  'picker.selectFirstTool': compilePickerSelectFirstTool,
  'agent.confirmToolPicker': compileAgentConfirmToolPicker,
  'agent.delete': compileAgentDelete,
  'chat.sendAndWait': compileChatSendAndWait,
  'chat.closeTestPanel': compileChatCloseTestPanel,
});
// 导出只读快照供展示/测试；行为判定不依赖它（防同进程 import 方 .add/.delete 致漂移，codex R2）。
export const COMPILE_KNOWN_ATOMS = new Set(Object.keys(COMPILE_ATOM_COMPILERS));
// 允许集谓词直查私有分派表 own key（单一事实源、不受导出 Set 可变性影响）：login/assert.* 显式特殊分支。
export function isCompilableAtom(atom) {
  return atom === 'login' || (typeof atom === 'string' && atom.startsWith('assert.')) || (typeof atom === 'string' && Object.hasOwn(COMPILE_ATOM_COMPILERS, atom));
}
const SEARCH_BOX_NAME = '输入工作流名称或编码进行搜索';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// chat 维度常量（chiefcomplaint-smoke，regress atoms.registry 默认值原样移植；GRILL D5/D6）。
const AGENT_SEARCH_NAME = '输入智能体名称或编码进行搜索';
const AGENT_MENU_ITEM_CSS = '.hr-menu :text-is("智能体管理")'; // 菜单容器限定（regress 裸 getByText 真机挂档：面包屑同名 + 拦截）
const CHAT_STREAM_ROUTE = '/ai-api/tester/agent/stream';
const CHAT_REPLY_SELECTOR = '.hr-chat__text__assistant';
const CHAT_SEND_ICON = '.hr-icon.hr-icon-arrow-up';
const CHAT_DRAWER_CLOSE = '.hr-drawer.hr-drawer--right.hr-drawer--open > .hr-drawer__content-wrapper > .hr-drawer__close-btn > .hr-icon';

// {{baseUrl}} 占位符 → 路径段（执行期与 --sut 拼接；events 落盘保留占位符）。
const pathOfPlaceholder = (u) => String(u).replace('{{baseUrl}}', '') || '/';
const exactTextRe = (s) => new RegExp(`^${String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

function requestLogPath(url) {
  const clean = stripUrlQuery(url);
  let p;
  try { p = new URL(clean).pathname; } catch { p = clean; }
  return maskCredentialRoute(p); // 凭据路由名源头打码（cred-route-mask）：门全严之下真机 requestLog 可落盘
}

// 语义定位（与 lib/replay-actions.mjs 的 semanticLocator 同语义——编译期作者与回放期消费者同构）。
function locatorFor(page, ev) {
  const s = ev.semantic;
  if (s && s.kind === 'role' && s.role) return page.getByRole(s.role, { name: s.name, exact: s.exact !== false });
  if (s && s.kind === 'label' && s.name) return page.getByLabel(s.name);
  if (s && s.kind === 'text' && s.name) return page.getByText(s.name, { exact: !!s.exact });
  if (ev.role && ev.accessibleName) return page.getByRole(ev.role, { name: ev.accessibleName, exact: true });
  if (ev.fieldLabel) return page.getByLabel(ev.fieldLabel);
  return null;
}

async function canvasBox(page) {
  const locs = [page.locator('.lf-canvas-overlay'), page.locator('.lf-graph')];
  for (const loc of locs) {
    if ((await loc.count().catch(() => 0)) !== 1) continue;
    const box = await loc.boundingBox().catch(() => null);
    if (box) return box;
  }
  return null;
}

async function nodeDragSource(page, nodeName) {
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

async function workflowNodeBox(page, label) {
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

async function dragConnectByLabels(page, fromLabel, toLabel) {
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
async function nodeDrawerDomain(page, label) {
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
const NODE_DRAWER_PIN_ATTR = 'data-casey-domain-pin';
let nodeDrawerPinSeq = 0;
async function disposeHandle(handle) {
  if (!handle) return;
  try { await handle.dispose(); } catch { /* 清理失败不得覆盖原裁定 */ }
}
// 释放 nodeDrawerDomain 返回的物理句柄数组（A1 释放纪律：只用计数的调用方每次调用后全量释放，防泄漏）。
async function disposeDomain(handles) {
  if (!handles) return;
  for (const h of handles) await disposeHandle(h);
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
// 三闸齐备（r2 HIGH 物理化 + r4 汇裁 A2 补挂点闸，与 lib/replay-actions.mjs 同刻）：pin 属性可被页面脚本
// 复制/搬移，重判验三条物理口径——①域内唯一者与被钉 ElementHandle【物理同一】（防替换，cur[0] 经 A1
// 已是扫描时锚定的句柄，直接比对）；②pin 全页恰一（防复制，属性被复制会把域外节点纳入按 pin 定根的
// 定位）；③唯一 pin 承载者与被钉物理节点【物理同一】（A2 防搬移：pin 搬到无标题嵌套 wrapper 后域计数仍
// 唯一、pinCount 仍 1，前两闸皆过，唯挂点闸能识破——否则 bound.root 按 pin 定位到嵌套 wrapper、候选域缩窄
// 洗成 unique 假绿）。任一闸不过 → action_failed，绝不带疑落笔。
async function verifyPinnedNodeDrawer(page, label, pin, rootHandle) {
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
async function pinNodeDrawer(page, label) {
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
function nodeDrawerLabelInvalid(label) {
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

export function createCompileRun({ page, forensics, state, sut, uniqueName, site, listRoute, agentListRoute }) {
  return {
    page, forensics, state, site,
    // 列表页路由：通道剖面可选 routes.workflowList（非凭据通道配置，channel-driver schema 边界注明归剖面）；
    // 缺省 = ROUTE_LIST（hermetic 假 SUT 路由，行为不变）。真机实采：/ai-manager/* 是 API 前缀（503），列表真身另有其路。
    listRoute: listRoute || ROUTE_LIST,
    // 智能体列表路由（chief-bringup G1）：有则 nav.agentManagement 走路由导航，无则退点击通路。
    agentListRoute: agentListRoute || null,
    sut: String(sut).replace(/\/$/, ''),
    ctx: { uniqueName, baseUrl: String(sut).replace(/\/$/, '') },
    events: [], observed: [], verification: [], caseDefectCandidates: [], assertionAtoms: [], notes: [],
    countAudit: null,
    blockers: [], // 证不出的硬阻断（计数口径不恒等等）：executeMode 据此 fail-closed、不产成功产物
    stepN: 0, intentN: 0, lastIntentId: null,
    nodeDrawerLabel: null, // drawer-lock-hardening D3：编译期 run 态当前节点抽屉标题（compileWorkflowOpenNode 成功后写入，SelectNodeDropdown/SetNodeField 读它作标题锚域锁）
    agentToolState: createAgentToolCompileState(), // regress 智能体工具首纵切：创建目标与选择器一级目标只在本次编译内存传递

    newIntent() { return `intent_${this.intentN++}`; },

    mark() {
      return { events: this.events.length, observed: this.observed.length, verification: this.verification.length, stepN: this.stepN, intentN: this.intentN, lastIntentId: this.lastIntentId, nodeDrawerLabel: this.nodeDrawerLabel };
    },
    rollback(m) {
      this.events.length = m.events; this.observed.length = m.observed; this.verification.length = m.verification;
      this.stepN = m.stepN; this.intentN = m.intentN; this.lastIntentId = m.lastIntentId; this.nodeDrawerLabel = m.nodeDrawerLabel;
    },

    // 静默点（确定性条件，替代固定睡眠，ADR-0003）：DOM 连续两拍稳定；networkidle 对带背景轮询的 SPA 永不达成、不作判据。
    async quietPoint(budgetMs = 2500) {
      let prev = -1;
      const t0 = Date.now();
      while (Date.now() - t0 < budgetMs) {
        let n = -2;
        try { n = await this.page.evaluate(() => document.body ? document.body.innerHTML.length : 0); } catch { n = -2; }
        if (n >= 0 && n === prev) return true;
        prev = n;
        await sleep(120);
      }
      return false;
    },

    async capture(stepId, intentId, atom, recStart, quiet) {
      let urlPathnameAfter = '';
      try { urlPathnameAfter = new URL(this.page.url()).pathname; } catch { urlPathnameAfter = ''; }
      const cleanTitles = await this.page.evaluate(() => {
        const out = [];
        if (document.title) out.push(document.title.trim());
        for (const el of document.querySelectorAll('h1,h2,h3,[class*="__title"]')) {
          const t = (el.textContent || '').trim();
          if (t) out.push(t);
        }
        return [...new Set(out)].filter(Boolean);
      }).catch(() => []);
      const toastTexts = await this.page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.hr-toast,.hr-message,[role="status"],[role="alert"]')) {
          const t = (el.textContent || '').trim();
          if (t) out.push(t);
        }
        return [...new Set(out)];
      }).catch(() => []);
      this.observed.push({
        stepId, intentId, atom, urlPathnameAfter, cleanTitles, toastTexts,
        replyText: null, replyStreamUrl: null,
        recStart, recEnd: this.forensics.records().length,
        quietPointReached: quiet,
      });
    },

    // 单事件全生命周期：定位核验 → 动作（归因窗开在动作+静默期，镜像 bin/replay.mjs 的因果作用域）→ 静默点 → 采观测。
    async emit(spec, customAct) {
      const stepId = `atstep_${this.stepN++}`;
      this.lastIntentId = spec.intentId;
      const ev = { stepId, ...spec };
      const recStart = this.forensics.records().length;
      let resolution = 'unique', candidateCount = 1, acted = false;
      this.state.currentStepId = stepId;
      const respWait = spec.action === 'click'
        ? this.page.waitForResponse((r) => /saveOrModifyProcessData|streamReply/.test(r.url()), { timeout: 600 }).catch(() => null)
        : Promise.resolve(null);
      try {
        if (customAct) {
          const outcome = await customAct();
          if (outcome && typeof outcome.resolution === 'string') {
            resolution = outcome.resolution;
            candidateCount = Number.isInteger(outcome.candidateCount) ? outcome.candidateCount : candidateCount;
            acted = resolution === 'unique' && outcome.identityReadback?.ok === true;
          } else {
            acted = true;
          }
        } else if (spec.action === 'nav') {
          await this.page.goto(this.sut + pathOfPlaceholder(spec.url), { waitUntil: 'load' });
          acted = true;
        } else if (spec.action === 'selectOption') {
          const du = spec.dropdownUnit;
          const combo = this.page.getByRole('combobox', { name: du.fieldLabel });
          candidateCount = await combo.count().catch(() => 0);
          resolution = candidateCount === 1 ? 'unique' : candidateCount > 1 ? 'ambiguous' : 'absent';
          // 点击身份门对称（R1-F2）：count===1 才动作，多匹配绝不点击（防真机点错/污染 SUT）。
          if (candidateCount === 1) {
            await combo.first().click({ timeout: 3000 });
            // 选项点击同过身份门（R2-F2）：限定 scope 容器内的选项浮层、选项文本唯一才点。
            const scopeLoc = du.scope ? this.page.locator(du.scope) : this.page;
            const list = scopeLoc.locator(du.optionListSelector || '.hr-select__list');
            const opt = list.getByText(du.optionText, { exact: true });
            const optCount = await opt.count().catch(() => 0);
            if (optCount === 1) {
              await opt.first().click({ timeout: 3000 });
              acted = true;
            } else {
              resolution = optCount > 1 ? 'ambiguous' : 'absent';
              candidateCount = optCount;
              this.notes.push(`步 ${stepId} 选项「${du.optionText}」在 scope 内 count=${optCount} 非唯一/缺席，拒点`);
            }
          }
        } else if (spec.action === 'press') {
          const { locator, count } = await this.resolveTarget(ev);
          candidateCount = count;
          resolution = count === 1 ? 'unique' : count > 1 ? 'ambiguous' : 'absent';
          if (count === 1) { await locator.first().press(spec.key || 'Enter', { timeout: 3000 }); acted = true; }
        } else {
          const { locator, count } = await this.resolveTarget(ev);
          candidateCount = count;
          resolution = count === 1 ? 'unique' : count > 1 ? 'ambiguous' : 'absent';
          if (count === 1) {
            const first = locator.first();
            if (spec.action === 'fill') await first.fill(instantiate(spec.value, this.ctx), { timeout: 3000 });
            else if (spec.action === 'dblclick') await first.dblclick({ timeout: 3000 });
            else await first.click({ timeout: 3000 });
            acted = true;
          }
        }
      } catch (e) {
        resolution = 'action_failed';
        this.notes.push(`步 ${stepId}（${spec.atom}/${spec.action}）动作失败：${String(e && e.message).slice(0, 160)}`);
      }
      await respWait;
      if (spec.action === 'click') await sleep(150); // 动作直接异步后果的出现窗（因果作用域，非任意时间窗）
      const quiet = await this.quietPoint();
      this.state.currentStepId = null;
      await this.capture(stepId, spec.intentId, spec.atom, recStart, quiet);
      this.events.push(ev);
      this.verification.push({ stepId, intentId: spec.intentId, atom: spec.atom, action: spec.action, resolution, candidateCount, acted });
      if (resolution !== 'unique') this.notes.push(`步 ${stepId} 定位核验非唯一（${resolution}，count=${candidateCount}）→ route:human`);
      return { stepId, resolution, candidateCount, acted };
    },

    async resolveTarget(ev) {
      const loc = locatorFor(this.page, ev);
      if (loc) {
        try { await loc.first().waitFor({ state: 'attached', timeout: 1500 }); } catch { /* 计数照实 */ }
        const n = await loc.count().catch(() => 0);
        if (n >= 1) return { locator: loc, count: n };
      }
      if (ev.fallbackCss) {
        const fb = this.page.locator(ev.fallbackCss);
        const n = await fb.count().catch(() => 0);
        if (n >= 1) return { locator: fb, count: n };
      }
      return { locator: null, count: 0 };
    },
  };
}

// ── 原子编译知识（第一条只骑 catalog_wf_crud 所用原子；atomId 钉 registry 原名） ──

export async function compileFlow(run, flow) {
  for (const step of flow.steps || []) {
    await compileAtomStep(run, step);
  }
}

async function compileAtomStep(run, { atom, params = {} }) {
  if (atom === 'login') { run.notes.push('login 原子由登录预备动作承接，不产 event（凭据红线，护栏 #7）'); return; }
  if (atom && atom.startsWith('assert.')) {
    // 断言原子不产 event：折进所在 intent 作 P4 草拟输入（G7-3 取 A，意图留痕）。
    run.assertionAtoms.push({ intentId: run.lastIntentId, atom, params });
    return;
  }
  // 命名原子经单一事实源分派表执行（own key 判定，防原型链键绕过，codex R1-F1/R2）。
  if (typeof atom === 'string' && Object.hasOwn(COMPILE_ATOM_COMPILERS, atom)) return COMPILE_ATOM_COMPILERS[atom](run, params);
  throw new Error(`原子 ${atom} 暂无编译知识（扩表走飞轮排期，护栏 #17 加法式）`);
}

// ── chat 维度编译知识（chiefcomplaint-smoke；决策依 docs/plans/chiefcomplaint-smoke/proposed/GRILL.md）──

// 气泡文本稳定等待——逻辑逐字同构 bin/replay.mjs 的 waitReplyStable（编译期作者与回放期消费者同构，
// 采集器同构纪律；regress 实测「网络流结束 ≠ UI 渲染完成」）。取不到回 null（证不出，不背书）。
async function waitReplyStableCompile(page, selector, { stableMs = 2000, budgetMs = 10000 } = {}) {
  const t0 = Date.now();
  let prev = null;
  let since = Date.now();
  while (Date.now() - t0 < budgetMs) {
    let cur = null;
    try {
      const loc = page.locator(selector).last();
      cur = (await loc.count()) ? await loc.innerText({ timeout: 500 }) : null;
    } catch { cur = null; }
    if (cur !== prev) { prev = cur; since = Date.now(); }
    else if (cur != null && Date.now() - since >= stableMs) return cur;
    await sleep(250);
  }
  return prev;
}

async function compileNavAgentManagement(run) {
  const i = run.newIntent();
  const waitSearchbox = () => run.page.getByRole('textbox', { name: AGENT_SEARCH_NAME }).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (run.agentListRoute) {
    // 路由导航优先（chief-bringup G1）：真机点击通路被 hr-submenu/spacer 拦截且父 li 多匹配（探针实证），
    // 直接路由一击即中；routes.agentList 属通道剖面非凭据路径段。
    const r = await run.emit({ intentId: i, atom: 'nav.agentManagement', action: 'nav', url: `{{baseUrl}}${run.agentListRoute}` });
    if (r.resolution === 'unique') await waitSearchbox(); // 失败步不堆等（G2）：立即让 fail-closed 走到头
    return;
  }
  // 无路由兜底：点击通路（已知脆：submenu/spacer 拦截风险，真机优先配 routes.agentList）。
  // 壳页锚 = run.listRoute（真机裸根未必渲染应用壳，列表页已证含侧栏）。
  await run.emit({ intentId: i, atom: 'nav.agentManagement', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });
  const r = await run.emit({ intentId: i, atom: 'nav.agentManagement', action: 'click', text: '智能体管理', fallbackCss: AGENT_MENU_ITEM_CSS });
  // 后置条件（registry：provides 在智能体管理页）：搜索框可见；仅本步 unique 才等（G2 失败步不堆等）。
  if (r.resolution === 'unique') await waitSearchbox();
}

// nav.workflowManagement（wf-open-smoke）：路由导航一击即中——工作流列表是缺省着陆页（listRoute =
// profile.routes.workflowList 缺省 ROUTE_LIST，真机路由已实证），不设点击兜底通路（镜像 nav.agentManagement
// 的路由优先形态、简去其兜底半边）。后置锚 = 列表记录容器可见（表格行/卡片双布局口径同 auditDeleteCount）；
// 仅本步 unique 才等（G2 失败步不堆等）。
async function compileNavWorkflowManagement(run) {
  const i = run.newIntent();
  const r = await run.emit({ intentId: i, atom: 'nav.workflowManagement', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });
  if (r.resolution === 'unique') {
    await run.page.locator('.hr-table-row, .hr-card.hr-card--bordered').first()
      .waitFor({ state: 'visible', timeout: 30000 }).catch(() => { /* 后置锚等不到不堆错：fail-closed 由后续步走到头 */ });
  }
}

// workflow.open（wf-open-smoke，只读零破坏）：列表按 openName 点开进详情。语义 = 文本精确命中
// （表格行 td / 卡片标题均以纯名渲染，同 deleteByName 点「删除」的 text 语义先例）；点击身份门唯一才 acted，
// 多匹配 fail-closed 交回放期。非破坏性原子不带 uniquePrefix 闸。后置 = 详情路由（真机 /process/detail
// 已实证）；仅 unique 才等（G2）。
async function compileWorkflowOpen(run, params) {
  const i = run.newIntent();
  // 容器归属闸（codex R1-F1）：text-exact 全页唯一还不够——命中元素须在列表记录容器内（表格行/卡片
  // 双布局口径同 auditDeleteCount），否则同名非行控件（按钮/菜单）碰撞会被点。容器外命中 = 硬阻断
  // fail-closed 不点（executeMode 据 blockers 截断、不产成功产物）；证不出（采样异常）同阻断。
  const probe = run.page.getByText(instantiate(params.openName, run.ctx), { exact: true });
  const n = await probe.count().catch(() => null);
  if (n === 1) {
    const inContainer = await probe.evaluate((el) => !!el.closest('.hr-table-row, .hr-card.hr-card--bordered')).catch(() => null);
    if (inContainer !== true) {
      run.blockers.push(`workflow.open「${params.openName}」text-exact 唯一命中但在列表记录容器外（同名非行控件碰撞）→ 硬阻断 fail-closed 不点（route:human）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
  } // n!==1（0/多/证不出）交 emit 的点击身份门走既有 fail-closed 通道（多匹配不点、缺席不 acted）。
  const r = await run.emit({ intentId: i, atom: 'workflow.open', action: 'click', semantic: { kind: 'text', name: params.openName, exact: true }, text: params.openName });
  if (r.resolution === 'unique') {
    await run.page.waitForURL('**/process/detail**', { timeout: 30000 }).catch(() => { /* 同上：不堆等 */ });
  }
}

// workflow.addNode（wf-add-node，画布维度首原子；GRILL D3/D4，真机二号探针 2026-07-07 乙案实证——
// 面板项单击/双击不落节点、mouse 三段式拖拽落 .lf-node）：条件步线性化开面板（「添加节点」钮，镜像 create
// 下拉分支先例）→ dragTo 本体（源=面板项 text-exact 身份门、落点 ox/oy=registry x/y 直译内容参数、出界不
// clamp）→ 后置核验 .lf-node 计数 +1，不过进 run.blockers 硬阻断（镜像 workflow.open 容器归属闸先例）。
// window.lf 图对象真机缺席（globals 仅 __VUE__），取证只靠 DOM 计数 + 网络切片如实归因。
async function compileWorkflowAddNode(run, params) {
  const i = run.newIntent();
  const nodeName = String(params.nodeName || '');
  const ox = Number.isFinite(params.x) ? params.x : 600;
  const oy = Number.isFinite(params.y) ? params.y : 280;
  const expectedDelta = Number.isFinite(params.expectedNodeDelta)
    ? Number(params.expectedNodeDelta)
    : nodeName === '真并行网关开始' ? 2 : 1;
  const nodeCount = () => run.page.locator('.lf-node').count().catch(() => null);
  const before = await nodeCount();
  // 面板项锚：.node-item 内文本精确命中（锚定用正则钉全等，防「并行网关」子串撞「真并行网关开始」）。
  const panelItem = () => run.page.locator('.node-item').filter({ hasText: exactTextRe(nodeName) });
  // 条件步：面板项不可见才点「添加节点」开面板（面板已开则跳过——线性化，镜像 create 下拉分支先例）。
  const panelOpen = await panelItem().first().isVisible().catch(() => false);
  if (!panelOpen) {
    await run.emit({ intentId: i, atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' });
  }
  await panelItem().first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await run.page.waitForTimeout(500);
  // 源身份门（emit 的 customAct 通路不走定位核验，此处自证）：count===1 才拖；缺席/多匹配/证不出 →
  // 硬阻断 fail-closed 不拖、点名进 blockers（executeMode 据此截断、不产成功产物）。
  const source = await nodeDragSource(run.page, nodeName);
  const n = source.count;
  if (n !== 1) {
    run.blockers.push(`workflow.addNode 源面板项「${nodeName}」count=${n ?? '证不出'} 非唯一/缺席 → 硬阻断 fail-closed 不拖（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  await run.emit({ intentId: i, atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: nodeName, exact: true }, text: nodeName, nodeName, ox, oy }, async () => {
    const gbox = await canvasBox(run.page);
    const freshSource = await nodeDragSource(run.page, nodeName);
    const sbox = freshSource.box;
    if (!gbox || !sbox) throw new Error('源/画布 boundingBox 证不出');
    await run.page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
    await run.page.mouse.down();
    try {
      await run.page.mouse.move(gbox.x + ox, gbox.y + oy, { steps: 20 });
      await run.page.waitForTimeout(300);
    } finally { await run.page.mouse.up(); }
    await run.page.waitForTimeout(500);
  });
  // 后置核验（registry post：画布节点数增加）：真并行网关开始在 Heren 真机一次拖拽生成 start/end 两节点（+2），
  // 其他节点默认 +1；计数不符（含出界未落、基线/终值证不出）→ blockers 硬阻断。
  const after = await nodeCount();
  if (before == null || after == null || after !== before + expectedDelta) {
    run.blockers.push(`workflow.addNode「${nodeName}」后置核验 .lf-node 计数 ${before ?? '证不出'}→${after ?? '证不出'} 非 +${expectedDelta} → 硬阻断（fail-closed，落点不 clamp、落不进如实阻断）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.addNode「${nodeName}」.lf-node 计数 ${before}→${after}（+${expectedDelta} 后置核验过）`);
}

// workflow.connectNodes（画布连线原子）：hover 源节点 → 取 .lf-node-anchor-hover 真锚点 → 拖到目标节点中心。
// 仍复用 events.action=dragTo，不扩动作枚举；目标节点名落既有 nodeName 字段，ox/oy 写目标中心相对画布的
// 内容坐标作为诊断/兜底锚。动作成功以 .lf-edge 计数 +1 为身份回读，防“鼠标动了但没连上”假 unique。
async function compileWorkflowConnectNodes(run, params) {
  const i = run.newIntent();
  const fromLabel = String(params.fromLabel || '');
  const toLabel = String(params.toLabel || '');
  const edgeCount = () => run.page.locator('.lf-edge').count().catch(() => null);
  const before = await edgeCount();
  const canvas = await canvasBox(run.page);
  // 预检两端在场（codex R2-F2）：源/目标节点或画布证不出 → 硬阻断 fail-closed 带诊断（镜像 addNode 干净预检，
  // 不让 workflowNodeBox 抛穿出跳产物块）；避免 ox/oy 走 :0 兜底（落点默认 0 假绿向同型缝，一并收）。
  const source = await workflowNodeBox(run.page, fromLabel);
  const target = await workflowNodeBox(run.page, toLabel);
  if (!canvas || !source || !target) {
    run.blockers.push(`workflow.connectNodes「${fromLabel}→${toLabel}」画布/源/目标节点证不出（canvas=${!!canvas}/source=${!!source}/target=${!!target}）→ 硬阻断 fail-closed 不连（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const ox = target.x + target.w / 2 - canvas.x;
  const oy = target.y + target.h / 2 - canvas.y;

  await run.emit({
    intentId: i,
    atom: 'workflow.connectNodes',
    action: 'dragTo',
    semantic: { kind: 'text', name: fromLabel, exact: true },
    text: fromLabel,
    nodeName: toLabel,
    ox,
    oy,
  }, async () => {
    await dragConnectByLabels(run.page, fromLabel, toLabel);
    const after = await edgeCount();
    if (before == null || after == null || after !== before + 1) {
      throw new Error(`连线后置核验 .lf-edge 计数 ${before ?? '证不出'}→${after ?? '证不出'} 非 +1`);
    }
  });

  const after = await edgeCount();
  if (before == null || after == null || after !== before + 1) {
    run.blockers.push(`workflow.connectNodes「${fromLabel}→${toLabel}」后置核验 .lf-edge 计数 ${before ?? '证不出'}→${after ?? '证不出'} 非 +1 → 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.connectNodes「${fromLabel}→${toLabel}」.lf-edge 计数 ${before}→${after}（+1 后置核验过）`);
}

// workflow.openNode（画布节点配置抽屉原子；GRILL D1 单击节点中心定案——registry 真机 SOP 为准、
// HANDOFF「双击」查无实证按笔误处理 + drawer-lock-hardening GRILL D2/D3/D5）：节点标题同时活在面板
// .node-item 与画布 .lf-node-content，全页身份门必撞多匹配——预检域锁 .lf-canvas-overlay 内 label 恰 1
// 才点（与回放 doOpenNode 同一扇门）→ D5 预点基线归因守卫（单击前先数「可见且含精确、且标题文本自身
// 可见」的抽屉，count>0 即证不出点后归因，绝不背书）→ mouse 单击节点箱中心 → D5 点后恰一（回读要求
// 标题锚域内恰 1，0 或 >1 同样证不出归因），证不出进 blockers 硬阻断（镜像 addNode/connectNodes 先例）。
// 成功后把当前节点标题写入 run.nodeDrawerLabel（D3，后开覆盖先开），供 selectNodeDropdown/setNodeField
// 读取作标题锚域锁。抽屉族原子的共同前置。registry「点空重点一次」重试启发式不进确定性原子（差异挂
// observability 真机复核）。
async function compileWorkflowOpenNode(run, params) {
  const i = run.newIntent();
  const label = String(params.label || '');
  // 尝试开始即失效旧 run 态标题（实现评审 r1 codex HIGH#2）：A 开成后 B 开败（任一失败路径：预检
  // blocker/点击失败/点后非恰一）时，若旧值不失效，后续 select/set 会借 A 的旧标题过域锁、对仍开着的
  // A 抽屉真落笔——即使整体 exit 65 零 events，编译执行期已对错误抽屉产生副作用（违 fail-safe）。
  // 故进本函数即清空，仅下方「点后恰一」确证成功才写回（G13 钉此语义）。
  run.nodeDrawerLabel = null;
  // trim 空门（codex r5 fail-open，与回放门 doOpenNode 同刻）：纯空白 label 经 nodeDrawerDomain 的 norm
  // 归一成空串会借空 target 命中画布/抽屉空文本节点假绿——trim 空即非法标题，硬阻断 fail-closed。
  if (label.trim() === '') {
    run.blockers.push(`workflow.openNode label 缺失或纯空白（trim 后为空，非法标题）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 预检域锁身份门（emit 的 customAct 通路不走定位核验，此处自证——镜像 addNode 源身份门）：
  const domain = run.page.locator('.lf-canvas-overlay').getByText(label, { exact: true });
  const n = await domain.count().catch(() => null);
  if (n !== 1) {
    run.blockers.push(`workflow.openNode「${label}」画布域内 count=${n ?? '证不出'} 非唯一/缺席 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const box = await workflowNodeBox(run.page, label);
  if (!box) {
    run.blockers.push(`workflow.openNode「${label}」节点 boundingBox 证不出 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // D5 预点基线归因守卫（评审修订同刻）：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
  // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
  const baseline = await nodeDrawerDomain(run.page, label);
  const baselineCount = baseline.length;
  await disposeDomain(baseline); // A1 释放纪律：只用计数即释放
  if (baselineCount > 0) {
    run.blockers.push(`workflow.openNode「${label}」预点基线：单击前已有 ${baselineCount} 个可见且含精确标题的抽屉，证不出点后归因 → 硬阻断（fail-closed，route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  await run.emit({ intentId: i, atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: label, exact: true }, text: label }, async () => {
    await run.page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」
    // 点后等待：轮询标题锚域内计数直到 ≥1 或超时（需要的是计数、不止存在性，故不用单点 waitFor）。
    const t0 = Date.now();
    for (;;) {
      const cur = await nodeDrawerDomain(run.page, label);
      const curCount = cur.length;
      await disposeDomain(cur); // A1 释放纪律：轮询每拍即释放
      if (curCount >= 1 || Date.now() - t0 > 5000) break;
      await sleep(100);
    }
  });
  // D5 点后恰一（评审修订同刻）：回读要求标题锚域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏
  // 文本已被 nodeDrawerDomain 的精确+可见双限定堵死，评审 F1/D2）。
  const after = await nodeDrawerDomain(run.page, label);
  const afterCount = after.length;
  await disposeDomain(after); // A1 释放纪律
  if (afterCount !== 1) {
    run.blockers.push(`workflow.openNode「${label}」后置核验：点后域内含精确标题的可见抽屉 count=${afterCount}（非恰一）证不出归因 → 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.nodeDrawerLabel = label; // D3：编译期 run 态记当前节点标题，供 select/set 两原子域锁读取（后开覆盖先开）
  run.notes.push(`workflow.openNode「${label}」节点配置抽屉已开（可见+含标题双证过，预点基线 0、点后恰一）`);
}

// workflow.selectNodeDropdown（画布节点抽屉下拉原子；GRILL D1/D3/D4/D5 + drawer-lock-hardening
// GRILL D2/D3/D4/D6）：抽屉族第二原子（前置必先 workflow.openNode 开抽屉——registry
// requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=click（零冻结 schema：nth 载下拉下标、
// text 载 option、semantic 载触发器锚、nodeName 载当前节点标题）——不走 selectOption（冻结 schema 的
// allOf 强制 selectOption 带 dropdownUnit，而 dropdownUnit 无 nth 槽、required fieldLabel/optionText 与
// 节点 nth 定位冲突）。先读 run.nodeDrawerLabel 作标题锚域锁（D3；缺失/非 string/trim 空 → blocker
// fail-closed，D4 修订、D3 run 态缺失分支实钉）——域内 count===0/>1 → blocker（D6 三态）；count===1 才
// 以该抽屉为根，预检域内第 nth 个【可见】.hr-select:visible 触发器（nth<count，路 A 确定性位置消歧；
// 非法 nth（在场但非非负整数）/ count=0 无下拉 / nth 越界 → blocker 硬阻断，fail-closed）→ customAct
// 点第 nth 触发器 + 限【可见浮层】.hr-select-option 唯一才点（多匹配/缺席 throw → emit 落 action_failed）
// → 后置触发器值回读（不再「请选择」且精确含 option）。编译门与回放门 doSelectNodeDropdown 同刻（同域锁
// + 同可见浮层作用域 + 同精确回读）。registry「点松回读紧」（点选项容 registry 子串但须唯一，回读精确）。
async function compileWorkflowSelectNodeDropdown(run, params) {
  const i = run.newIntent();
  // nth 校验（fix#1）：缺省 → 合法默认 0；在场但非「非负整数」→ blocker 硬阻断 fail-closed 零 events
  // （绝不降级 index 0 猜首项——与「越界→blocker」同口径，fail-safe 不 fail-open）。
  if (params.nth !== undefined && (!Number.isInteger(params.nth) || params.nth < 0)) {
    run.blockers.push(`workflow.selectNodeDropdown nth=${JSON.stringify(params.nth)} 非法（在场但非非负整数）→ 硬阻断 fail-closed 不点（route:human，绝不降级 index 0）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const nth = params.nth === undefined ? 0 : params.nth;
  const option = params.option != null ? String(params.option) : null;
  // D3/D4 修订：run 态当前节点标题缺失/非 string/trim 后空白 → 硬阻断 fail-closed（理论不可达，flow gate
  // 已强制前序 openNode；openNode 若被自身 blocker 截会让 run 态维持缺失，此处兜底截断级联，D3 run 态
  // 缺失分支实钉）。
  if (nodeDrawerLabelInvalid(run.nodeDrawerLabel)) {
    run.blockers.push(`workflow.selectNodeDropdown run 态节点抽屉标题缺失或空白（openNode 未成功开抽屉或标题空白）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const label = run.nodeDrawerLabel;
  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续触发器定位/落笔全以 pin 锚为根——
  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝，与回放门 doSelectNodeDropdown 同刻）。
  const bound = await pinNodeDrawer(run.page, label);
  if (bound.status === 'none') {
    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status === 'ambiguous') {
    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=${bound.count}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status !== 'ok') {
    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」抽屉抗漂移绑定证不出（钉后重判失配）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  let actedTrigHandle = null;
  let actedOptHandle = null;
  let exactTextHandle = null;
  try {
  const root = bound.root;
  // 预检域锁触发器门（emit 的 customAct 通路不走定位核验，此处自证——镜像 openNode 域锁 + addNode 源身份门）；
  // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 触发器误命中。
  const triggers = root.locator('.hr-select:visible');
  // 可见等待守卫（codex 异构冗余评审 F2）：域锁改 :visible 后计数变时序敏感——抽屉/触发器异步渲染的短暂
  // 不可见窗口会让裸 count() 得 0 误落越界 blocker（fail-closed 假阴、破「两门同刻」）。补 doSelectNodeDropdown
  // 回放门同款有界 waitFor（抛不穿出、5s 上界），对既有全可见触发器场景恒等无行为差、对 ddempty 只多等即同判。
  try { await triggers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const tcount = await triggers.count().catch(() => null);
  if (tcount == null || tcount === 0) {
    run.blockers.push(`workflow.selectNodeDropdown 节点抽屉域内「请选择」触发器 count=${tcount ?? '证不出'}（抽屉无下拉）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (nth >= tcount) {
    run.blockers.push(`workflow.selectNodeDropdown nth=${nth} ≥ 抽屉域内触发器 count=${tcount} 越界 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  try { actedTrigHandle = await triggers.nth(nth).elementHandle({ timeout: 3000 }); } catch { actedTrigHandle = null; }
  if (!actedTrigHandle) {
    run.blockers.push(`workflow.selectNodeDropdown 触发器物理绑定证不出（count=${tcount}，nth=${nth}）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 动作时刻重判（r1 HIGH#1 + r2 物理化）：点触发器前重验域内唯一性 + 物理同一 + pin 全页恰一——
  // 预检到落笔之间的窗口冒出同标题冒牌/pin 被复制 → 证不出归属，绝不带疑落笔（与回放门同刻；
  // emit 内亦有落笔时刻重判兜底）。
  const preClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
  if (preClick.status !== 'ok') {
    run.blockers.push(`workflow.selectNodeDropdown 落笔前重判：当前节点「${label}」标题锚域 count=${preClick.count}${preClick.status === 'action_failed' ? '（物理绑定证不出：被钉抽屉漂移/被替换或 pin 被复制）' : ''} 证不出归属 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (!(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
    || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) {
    run.blockers.push(`workflow.selectNodeDropdown 触发器候选在落笔前发生漂移或已离开被钉抽屉 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const spec = { intentId: i, atom: 'workflow.selectNodeDropdown', action: 'click', nth, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: label };
  if (option) spec.text = option;
  const emitResult = await run.emit(spec, async () => {
    // 落笔时刻重判兜底（r1 HIGH#1 + r2 物理化）：emit 记账与动作之间仍有窗口，抛错走 emit 既有
    // action_failed 通道（随后触发器值回读必证不出 → blocker，fail-closed 收口）。
    const atAct = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (atAct.status !== 'ok') throw new Error(`落笔时刻标题锚域重判失败（count=${atAct.count}，${atAct.status}），拒点`);
    if (!(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) throw new Error('触发器候选漂移或不在被钉抽屉物理节点内，拒点');
    await actedTrigHandle.click({ timeout: 3000 });
    const afterTriggerClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterTriggerClick.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) throw new Error('触发器点击后漂移或离开被钉抽屉，拒认');
    // 可见浮层作用域（防浮层 teleport 到 body 全局 text 撞列表页/孪生浮层）：限可见 .hr-select-option。
    const visibleOptions = run.page.locator('.hr-select-option:visible');
    await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 });
    const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
    const oc = await target.count().catch(() => 0);
    if (oc !== 1) throw new Error(`浮层内目标选项「${option ?? '首项'}」可见 count=${oc} 非唯一/缺席，拒点`);
    actedOptHandle = await target.first().elementHandle({ timeout: 3000 });
    if (!actedOptHandle) throw new Error('浮层目标选项物理绑定证不出，拒点');
    // 选项单击才是真正改写触发器值的落笔，浮层开着的窗口同样重判（与回放门 preOpt 同刻）。浮层
    // teleport 到 body 无祖先物理包含可验——靠 oc===1 唯一闸 + 触发器物理句柄回读兜底。
    const atOpt = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (atOpt.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))
      || !(await locatorStillBound(run.page, target, 0, actedOptHandle, 1))) throw new Error(`选项落笔前物理绑定重判失败（count=${atOpt.count}，${atOpt.status}），拒点`);
    await actedOptHandle.click({ timeout: 3000 });
    const afterOptionClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterOptionClick.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) throw new Error('选项点击后触发器漂移或离开被钉抽屉，拒认');
  });
  // 后置核验（触发器值回读，物理句柄口径；registry post：该下拉已选中含 option 的项）：重读被点的
  // 同一物理触发器——不再「请选择」且【精确】含 option（text= 引擎带引号=规范化精确匹配，非子串——
  // openNode F1 教训下拉版：子串会把「选错项/写错值」误判选对）。
  let val = null;
  try { val = actedTrigHandle ? (await actedTrigHandle.innerText({ timeout: 2000 })).trim() : null; } catch { val = null; }
  let exactHit = 0;
  if (option) {
    try {
      exactTextHandle = actedTrigHandle ? await actedTrigHandle.$(`text=${JSON.stringify(option)}`) : null;
      exactHit = exactTextHandle ? 1 : 0;
    } catch { exactHit = 0; }
  } else {
    exactHit = val && val !== '请选择' ? 1 : 0;
  }
  const afterReadback = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
  const triggerStillBound = await locatorStillBound(run.page, triggers, nth, actedTrigHandle);
  const triggerStillInside = await handleInsideRoot(actedTrigHandle, bound.rootHandle);
  if (emitResult.resolution !== 'unique' || afterReadback.status !== 'ok' || !triggerStillBound || !triggerStillInside
    || !val || val === '请选择' || exactHit !== 1) {
    run.blockers.push(`workflow.selectNodeDropdown 后置核验触发器值回读证不出（值=${val ?? '证不出'}，精确含 option=${option ? exactHit === 1 : 'n/a'}）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.selectNodeDropdown 节点下拉已选中（nth=${nth}/${option ?? '首项'}，触发器值「${val}」精确回读过，域锁「${label}」）`);
  } finally {
    await disposeHandle(exactTextHandle);
    await disposeHandle(actedOptHandle);
    await disposeHandle(actedTrigHandle);
    await disposeHandle(bound.rootHandle);
  }
}

// workflow.setNodeField（画布节点抽屉可填字段原子；GRILL D1/D3/D4/D5 + drawer-lock-hardening
// GRILL D2/D3/D4/D6）：抽屉族第三原子（前置必先 workflow.openNode 开抽屉——registry
// requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=fill（零冻结 schema：value 载填入值、
// semantic:{kind:label,name:placeholder,exact} 载占位符锚 + 精确开关、nth 仅显式给时载字段下标消歧、
// nodeName 载当前节点标题）——冻结 schema 的 allOf 对 fill 只要求 value。先读 run.nodeDrawerLabel 作
// 标题锚域锁（D3；缺失/非 string/trim 空 → blocker fail-closed，D4 修订、D3 run 态缺失分支实钉）——
// 域内 count===0/>1 → blocker（D6 三态）；count===1 才以该抽屉为根，预检域内 getByPlaceholder(placeholder,
// {exact})（占位符锚非 semanticLocator 命中口径，故按 ev.atom 分发专用回放门 doSetNodeField）。字段级
// 唯一闸（D4，fail-safe 核心）：count=0 缺席 / 未给 nth 且 count>1 多匹配 ambiguous 绝不填首项 / 给 nth 越界
// → blocker 硬阻断（fail-closed）；唯一或显式 nth 合法才填。emit customAct = target.fill（填值内聚，镜像
// doSelectNodeDropdown 两击内聚）→ 后置字段 value 回读（inputValue() 精确等于实例化后填入值，非 includes
// 子串——F1 教训子串会把填错值/半填误判填对）证不出 → blocker 硬阻断。编译门与回放门 doSetNodeField 同刻。
async function compileWorkflowSetNodeField(run, params) {
  const i = run.newIntent();
  const placeholder = String(params.placeholder || '');
  const value = String(params.value != null ? params.value : '');
  const exact = params.exact === true;
  // nth 校验（HIGH fix，镜像 selectNodeDropdown fix#1）：缺省（undefined）→ 合法默认 0；在场但非「非负整数」
  // → blocker 硬阻断 fail-closed 零 events（绝不降级 index 0 猜首项——静默取 0 会替用户填错第一格还返 unique
  // 假绿，违「fail-safe 不 fail-open」+ ADR-0007；与「越界→blocker」同口径）。
  if (params.nth !== undefined && (!Number.isInteger(params.nth) || params.nth < 0)) {
    run.blockers.push(`workflow.setNodeField nth=${JSON.stringify(params.nth)} 非法（在场但非非负整数）→ 硬阻断 fail-closed 不填（route:human，绝不降级 index 0）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const hasNth = params.nth !== undefined;
  const nth = hasNth ? params.nth : 0;
  if (!placeholder || params.value == null) {
    run.blockers.push(`workflow.setNodeField placeholder/value 证不出（placeholder=「${placeholder}」value=${params.value == null ? '缺' : '有'}）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // D3/D4 修订：run 态当前节点标题缺失/非 string/trim 后空白 → 硬阻断 fail-closed。
  if (nodeDrawerLabelInvalid(run.nodeDrawerLabel)) {
    run.blockers.push(`workflow.setNodeField run 态节点抽屉标题缺失或空白（openNode 未成功开抽屉或标题空白）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const label = run.nodeDrawerLabel;
  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续字段定位/落笔全以 pin 锚为根——
  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝，与回放门 doSetNodeField 同刻）。
  const bound = await pinNodeDrawer(run.page, label);
  if (bound.status === 'none') {
    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status === 'ambiguous') {
    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=${bound.count}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status !== 'ok') {
    run.blockers.push(`workflow.setNodeField 当前节点「${label}」抽屉抗漂移绑定证不出（钉后重判失配）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  let actedFieldHandle = null;
  try {
  const root = bound.root;
  // 预检域锁字段门（emit 的 customAct 通路不走定位核验，此处自证——镜像 selectNodeDropdown 域锁 + openNode 源身份门）：
  const fields = root.getByPlaceholder(placeholder, { exact });
  const fcount = await fields.count().catch(() => null);
  if (fcount == null || fcount === 0) {
    run.blockers.push(`workflow.setNodeField 节点抽屉域内占位符「${placeholder}」字段 count=0（抽屉无该字段）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (!hasNth && fcount > 1) {
    run.blockers.push(`workflow.setNodeField 节点抽屉域内占位符「${placeholder}」多匹配 count=${fcount} 未给 nth → ambiguous 硬阻断 fail-closed 绝不填首项（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (hasNth && nth >= fcount) {
    run.blockers.push(`workflow.setNodeField nth=${nth} ≥ 抽屉域内占位符「${placeholder}」字段 count=${fcount} 越界 → 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const targetIndex = hasNth ? nth : 0;
  const target = fields.nth(targetIndex);
  try { actedFieldHandle = await target.elementHandle({ timeout: 3000 }); } catch { actedFieldHandle = null; }
  if (!actedFieldHandle) {
    run.blockers.push(`workflow.setNodeField 字段物理绑定证不出（count=${fcount}，nth=${targetIndex}）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 动作时刻重判（r1 HIGH#1 + r2 物理化）：落笔（fill）前重验域内唯一性 + 物理同一 + pin 全页恰一——
  // 预检到落笔之间的窗口冒出同标题冒牌/pin 被复制 → 证不出归属，绝不带疑落笔（与回放门同刻；
  // emit 内亦有落笔时刻重判兜底）。
  const preFill = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
  if (preFill.status !== 'ok') {
    run.blockers.push(`workflow.setNodeField 落笔前重判：当前节点「${label}」标题锚域 count=${preFill.count}${preFill.status === 'action_failed' ? '（物理绑定证不出：被钉抽屉漂移/被替换或 pin 被复制）' : ''} 证不出归属 → 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const exactCount = hasNth ? null : 1;
  if (!(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
    || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) {
    run.blockers.push(`workflow.setNodeField 字段候选在落笔前发生漂移或已离开被钉抽屉 → 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const spec = { intentId: i, atom: 'workflow.setNodeField', action: 'fill', value, semantic: { kind: 'label', name: placeholder, exact }, nodeName: label };
  if (hasNth) spec.nth = nth;
  const emitResult = await run.emit(spec, async () => {
    // 落笔时刻重判兜底（r1 HIGH#1 + r2 物理化）：emit 记账与动作之间仍有窗口，抛错走 emit 既有
    // action_failed 通道（随后字段值回读必证不出 → blocker，fail-closed 收口）。
    const atAct = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (atAct.status !== 'ok') throw new Error(`落笔时刻标题锚域重判失败（count=${atAct.count}，${atAct.status}），拒填`);
    if (!(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
      || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) throw new Error('字段候选漂移或不在被钉抽屉物理节点内，拒填');
    await actedFieldHandle.focus();
    const afterFocus = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterFocus.status !== 'ok'
      || !(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
      || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) throw new Error('字段 focus 后漂移或离开被钉抽屉，拒填');
    await actedFieldHandle.fill(instantiate(value, run.ctx), { timeout: 3000 });
    const afterFill = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterFill.status !== 'ok'
      || !(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
      || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) throw new Error('字段 fill 后漂移或离开被钉抽屉，拒认');
  });
  // 后置核验（registry post：该字段被填入值，物理句柄口径）：重读被填的同一物理字段，value 回读
  // 【精确】等于实例化后填入值（非 includes 子串——openNode/selectNodeDropdown F1 精确回读同律：
  // 子串会把填错值/半填/value副本超集误判填对，fail-open 假绿）。
  const want = instantiate(value, run.ctx);
  let got = null;
  try { got = actedFieldHandle ? await actedFieldHandle.inputValue({ timeout: 2000 }) : null; } catch { got = null; }
  if (emitResult.resolution !== 'unique' || got !== want) {
    run.blockers.push(`workflow.setNodeField 后置核验字段值回读证不出（占位符「${placeholder}」回读值=${got == null ? '证不出' : `「${got}」`}，期望精确「${want}」）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.setNodeField 节点字段已填入（〈${placeholder}〉=〈${want}〉，value 精确回读过，域锁「${label}」）`);
  } finally {
    await disposeHandle(actedFieldHandle);
    await disposeHandle(bound.rootHandle);
  }
}

async function compileAgentSearchOpen(run, params) {
  const i = run.newIntent();
  const SEARCH = { kind: 'role', role: 'textbox', name: AGENT_SEARCH_NAME, exact: true };
  await run.emit({ intentId: i, atom: 'agent.searchOpen', action: 'fill', semantic: SEARCH, value: params.searchKeyword });
  // 搜索需回车触发过滤（regress 实测）。
  await run.emit({ intentId: i, atom: 'agent.searchOpen', action: 'press', key: 'Enter', semantic: SEARCH });
  const r = await run.emit({ intentId: i, atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: params.openName, exact: false }, text: params.openName });
  // 后置条件（registry：provides 智能体详情已开）：「测试」按钮可见；仅本步 unique 才等（G2 失败步不堆等）。
  if (r.resolution === 'unique') await run.page.getByRole('button', { name: '测试' }).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
}

async function compileAgentOpenTestPanel(run) {
  const i = run.newIntent();
  // 真机实证（chief-bringup 彩排）：详情页仍在加载时点「测试」会被重渲染间歇吞掉——networkidle 前置
  // + 点空重点（regress 全款搬回；原 GRILL D6「不搬自愈」被真机证伪、修订记档）。重点属编译期采集
  // 自愈、不产 event；回放期单击吞点风险由 fail-safe 兜（NEEDS_HUMAN 绝不假绿），挂账真机观察。
  // 有界（codex bring-up R1）：networkidle 对带背景轮询的 SPA 可能永不达成（CONTEXT 既有定论）——
  // 5s 上界后放行点击，靠点空重点兜底；无界等待会复活「看门狗先于诊断死」的病。
  await run.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  const r = await run.emit({ intentId: i, atom: 'agent.openTestPanel', action: 'click', semantic: { kind: 'role', role: 'button', name: '测试', exact: true }, text: '测试' });
  // 仅本步 unique 才等（G2 失败步不堆等）。
  if (r.resolution === 'unique') {
    const msgBox = run.page.getByRole('textbox', { name: '请输入消息' }); // 非 exact：真名带省略号
    try {
      await msgBox.first().waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      run.notes.push('openTestPanel 首击被吞（真机间歇性），编译期采集自愈重点一次（不产 event）');
      try { await run.page.getByRole('button', { name: '测试' }).first().click({ timeout: 3000 }); } catch { /* 后续步计数如实暴露 */ }
      await msgBox.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }
  }
}

// regress agent_tool_add 首纵切：配方由 lib/agent-tool-compile.mjs 单点生成，编译与回放共用
// lib/agent-tool-actions.mjs 的专用动作身份门。未真机复核前只产候选 events，行为状态仍 route:human。
async function compileAgentToolRecipe(run, atom, params) {
  let recipes;
  try {
    recipes = buildAgentToolAtomEvents(atom, params, run.agentToolState);
  } catch {
    run.blockers.push(`${atom} 参数或前序状态非法 → 硬阻断（fail-closed，route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return [];
  }
  const intentId = run.newIntent();
  const results = [];
  for (let index = 0; index < recipes.length; index += 1) {
    let recipe = recipes[index];
    // 新增智能体可能是“按钮直开抽屉”或“按钮→菜单项”两种布局；仅当首击后抽屉未开才落菜单项事件。
    if (atom === 'agent.create' && index === 1) {
      const drawerOpen = await run.page.locator('.hr-drawer.hr-drawer--open:visible').count().catch(() => 0);
      if (drawerOpen === 1) continue;
    }
    // agent 列表路由以当前通道剖面为准；冻结 spec 只留 {{baseUrl}}+非凭据路径段。
    if (atom === 'agent.delete' && recipe.action === 'nav') {
      const route = run.agentListRoute || '/agent/list';
      recipe = { ...recipe, url: `{{baseUrl}}${route}` };
    }
    // 删除确认文本从本次因果弹层实采，拒用全页最后一个按钮。
    if (atom === 'agent.delete' && recipe.action === 'click' && recipe.text === '确定') {
      const inspected = await inspectWorkflowDeleteConfirm(run.page);
      if (inspected.resolution !== 'unique' || !inspected.confirmName) {
        run.blockers.push('agent.delete 因果确认弹层内确认按钮非唯一/缺席 → 硬阻断（fail-closed，route:human）');
        run.notes.push(run.blockers[run.blockers.length - 1]);
        return results;
      }
      recipe = { ...recipe, text: inspected.confirmName };
    }
    const spec = { intentId, ...recipe };
    const result = isAgentToolSpecialAction(spec)
      ? await run.emit(spec, () => performAgentToolAction(run.page, spec, run.ctx))
      : await run.emit(spec);
    results.push(result);
  }
  return results;
}

async function compileAgentCreate(run, params) {
  const results = await compileAgentToolRecipe(run, 'agent.create', params);
  if (!results.length || results.some((result) => result.resolution !== 'unique')) return;
  const path = (() => { try { return new URL(run.page.url()).pathname; } catch { return ''; } })();
  if (!path.includes('/agent/detail')) {
    run.blockers.push('agent.create 后置 URL 未进入 /agent/detail → 硬阻断（fail-closed，route:human）');
    run.notes.push(run.blockers[run.blockers.length - 1]);
  }
}

async function compileAgentOpenToolPicker(run, params) {
  await compileAgentToolRecipe(run, 'agent.openToolPicker', params);
}

async function compilePickerSearch(run, params) {
  const results = await compileAgentToolRecipe(run, 'picker.search', params);
  if (!results.length || results.some((result) => result.resolution !== 'unique')) return;
  if (params.expectCount !== undefined) {
    const panels = run.page.locator('.hr-dialog:visible').filter({ hasText: '仅显示已选' }).locator('.hr-collapse-panel:visible');
    const count = await panels.count().catch(() => null);
    if (count !== params.expectCount) {
      run.blockers.push(`picker.search 后置一级卡片数不符（期望 ${params.expectCount}，实际 ${count == null ? '证不出' : count}）→ 硬阻断（route:human）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
    }
  }
}

async function compilePickerExpandPrimary(run, params) {
  await compileAgentToolRecipe(run, 'picker.expandPrimary', params);
}

async function compilePickerSelectFirstTool(run, params) {
  await compileAgentToolRecipe(run, 'picker.selectFirstTool', params);
}

async function compileAgentConfirmToolPicker(run, params) {
  await compileAgentToolRecipe(run, 'agent.confirmToolPicker', params);
}

async function compileAgentDelete(run, params) {
  await compileAgentToolRecipe(run, 'agent.delete', params);
}

async function compileChatSendAndWait(run, params) {
  const i = run.newIntent();
  const streamUrlPattern = params.streamUrlPattern || CHAT_STREAM_ROUTE;
  const replySelector = params.replySelector || CHAT_REPLY_SELECTOR;
  // reply 陈迹基线（codex R1-F3，同构 bin/replay.mjs）：只在「新气泡出现或末泡文本变化」时回填，
  // 旧气泡陈迹绝不当新回复；基线证不出则不回填（fail-safe）。
  let replyBase = null;
  try {
    const bl = run.page.locator(replySelector);
    const bn = await bl.count();
    replyBase = { n: bn, text: bn ? await bl.last().innerText({ timeout: 500 }) : null };
  } catch { replyBase = null; }
  const MSG = { kind: 'role', role: 'textbox', name: '请输入消息', exact: false }; // 真名「请输入消息...」带省略号（真机实采），exact 必 0 命中
  await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'fill', semantic: MSG, value: params.prompt });
  // keydown 触发垫（GRILL D3，Steven 拍板）：fill 不触发 keydown、发送钮保持 disabled（regress 真机实测）；
  // Space+Backspace 发 keydown、终文本不变，全在冻结 events 枚举内、确定性可复放。
  await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'press', key: 'Space', semantic: MSG });
  await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'press', key: 'Backspace', semantic: MSG });
  const recMark = run.forensics.records().length;
  const clickR = await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'click', fallbackCss: params.sendIconSelector || CHAT_SEND_ICON });
  // 流等待（地面真值采集；codex R1-F2 同构收紧）：只等本次点击后新增、命中 streamUrlPattern 的流
  // 走到 finished（或 30s 上界）；5s 内没开流即证不出、不干等（背景/历史长流绝不拖本步）。
  // 点击未成不等（G2 失败步不堆等）。
  if (clickR.resolution === 'unique') {
    const swT = Date.now();
    for (;;) {
      const mine = run.forensics.records().slice(recMark).filter((r) => r.type === 'EventSource' && String(r.url).includes(streamUrlPattern));
      if (mine.length && mine.every((r) => r.streamFinished === true)) break;
      if (!mine.length && Date.now() - swT > 5000) break;
      if (Date.now() - swT > 30000) break;
      await sleep(200);
    }
  }
  const replyText = clickR.resolution === 'unique' ? await waitReplyStableCompile(run.page, replySelector) : null;
  // 回填本原子代表步 observed 的 replyText/replyStreamUrl（schema 字段既有、此前恒 null；GRILL D5）。
  const last = run.observed[run.observed.length - 1];
  if (last) {
    const n = await run.page.locator(replySelector).count().catch(() => 0);
    const changed = replyBase != null && replyText != null && (n > replyBase.n || replyText !== replyBase.text);
    last.replyText = changed ? replyText : null;
    const streamRec = run.forensics.records().slice(recMark).filter((r) => String(r.url).includes(streamUrlPattern)).slice(-1)[0];
    last.replyStreamUrl = streamRec ? requestLogPath(streamRec.url) : null;
  }
}

async function compileChatCloseTestPanel(run) {
  const i = run.newIntent();
  await run.emit({ intentId: i, atom: 'chat.closeTestPanel', action: 'click', fallbackCss: CHAT_DRAWER_CLOSE });
}

// workflow.create：拆两 intent（进列表 + 新增）——对齐重表达清单草稿一。
async function compileWorkflowCreate(run, params) {
  const iNav = run.newIntent();
  await run.emit({ intentId: iNav, atom: 'workflow.create', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });

  const iCreate = run.newIntent();
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true }, text: '新增工作流',
  });
  // 下拉菜单分支线性化（约定 4）：真机若开菜单则多一步 menuitem 点击；直开抽屉则无本步。
  const menuitem = run.page.getByRole('menuitem', { name: '新增工作流' });
  await sleep(250);
  if ((await menuitem.count().catch(() => 0)) >= 1) {
    await run.emit({
      intentId: iCreate, atom: 'workflow.create', action: 'click',
      semantic: { kind: 'role', role: 'menuitem', name: '新增工作流', exact: true }, text: '新增工作流',
    });
  } else {
    // Heren 真机（2026-07-02 实采）：下拉菜单无 menuitem 角色（.hr-dropdown__menu div 汤，隐藏副本多份）——
    // 限定可见菜单容器锚定；裸 text 不进 semantic（全局同名 3 处，避免回放多命中 ambiguous）。
    const itemCss = '.hr-dropdown__menu:visible .hr-dropdown__item-text:text-is("新增工作流")';
    if ((await run.page.locator(itemCss).count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', text: '新增工作流', fallbackCss: itemCss });
    }
  }
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'fill',
    semantic: { kind: 'label', name: '工作流名称' }, fieldLabel: '工作流名称', required: true,
    value: params.name, uniqueGuard: true,
    // Heren 真机（2026-07-02 实采）：表单标签是 div、无程序化关联（getByLabel 必 0）——form__item 容器锚定（count=1 亲验）。
    fallbackCss: '.hr-form__item:has(label:text-is("工作流名称")) input',
  });
  if (params.desc) {
    // 描述 textarea 标签锚定可行性 = route:human ④：锚不上则不落步、记录。真机标签实名「工作流描述」（必填）。
    const descCss = '.hr-form__item:has(label:has-text("工作流描述")) textarea';
    if ((await run.page.getByLabel('描述').count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'fill', semantic: { kind: 'label', name: '描述' }, fieldLabel: '描述', value: params.desc });
    } else if ((await run.page.locator(descCss).count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'fill', semantic: { kind: 'label', name: '工作流描述' }, fieldLabel: '工作流描述', value: params.desc, fallbackCss: descCss });
    } else {
      run.notes.push('描述 textarea 无标签锚定（route:human ④）：本步不落 event');
    }
  }
  if (params.category) {
    const sel = (run.site && run.site.select) || {};
    const combo = run.page.getByRole('combobox', { name: '分类' });
    if ((await combo.count().catch(() => 0)) >= 1) {
      await run.emit({
        intentId: iCreate, atom: 'workflow.create', action: 'selectOption',
        dropdownUnit: {
          fieldLabel: '分类', optionText: params.category,
          scope: (sel.scopes && sel.scopes[0]) || '.hr-drawer__content-wrapper',
          optionListSelector: sel.optionList || '.hr-select__list',
          native: false,
        },
      });
    } else {
      // Heren 真机（2026-07-02 实采）：分类下拉无 combobox 角色（input placeholder=请选择）→ 线性化两击（约定 4）。
      // 回放侧 doSelect 只认 combobox，selectOption 事件在此 DOM 不可回放；选项浮层 teleport 到 body、
      // 全局 text 会撞列表页分类 tab（抽屉遮罩拦点），必须限定可见选项列表作用域。
      const shellCss = '.hr-form__item:has(label:has-text("分类")) input';
      const optCss = `${sel.optionList || '.hr-select__list'}:visible :text-is(${JSON.stringify(params.category)})`;
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', fieldLabel: '分类', fallbackCss: shellCss });
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', text: params.category, fallbackCss: optCss });
    }
  }
  // 抽屉确认按钮文本实采（确定/确认，route:human ⑤ 的编译期核验位）。
  let confirmName = null;
  for (const cand of ['确定', '确认']) {
    if ((await run.page.getByRole('button', { name: cand, exact: true }).count().catch(() => 0)) >= 1) { confirmName = cand; break; }
  }
  if (confirmName) {
    await run.emit({
      intentId: iCreate, atom: 'workflow.create', action: 'click',
      semantic: { kind: 'role', role: 'button', name: confirmName, exact: true }, text: confirmName,
      fallbackCss: '.hr-drawer__footer button.hr-button--primary',
    });
  } else {
    // Heren 真机（2026-07-02 实采）：抽屉 footer 是 div 按钮（hr-button--theme-primary，role=button 采样必 0）——
    // footer 主按钮锚定；实采文本记 compile-report（route:human ⑤ 证据）。
    const footCss = '.hr-drawer:visible .hr-drawer__footer .hr-button--theme-primary';
    const footN = await run.page.locator(footCss).count().catch(() => 0);
    if (footN >= 1) {
      const footText = ((await run.page.locator(footCss).first().textContent().catch(() => '')) || '').trim() || '确定';
      run.notes.push(`抽屉确认按钮实采（div 按钮）：文本「${footText}」count=${footN}（route:human ⑤ 证据）`);
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', text: footText, fallbackCss: footCss });
    } else {
      run.notes.push('抽屉确认按钮文本实采失败（确定/确认均 0 命中）→ route:human ⑤');
      await run.emit({
        intentId: iCreate, atom: 'workflow.create', action: 'click',
        semantic: { kind: 'role', role: 'button', name: '确定', exact: true }, text: '确定',
        fallbackCss: '.hr-drawer__footer button.hr-button--primary',
      });
    }
  }
}

async function compileWorkflowSave(run) {
  const iSave = run.newIntent();
  await run.emit({
    intentId: iSave, atom: 'workflow.save', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '保存', exact: true }, text: '保存',
  });
}

// workflow.publish（wf-publish-states GRILL M4）：照 workflow.save 形状——单击编辑器「发布」；
// 不强断后置（regress 同款：完整=发布成功、不完整=校验拦，交 assert.* 判定）。破坏性但无名参，
// 清理由同 flow 的 deleteByName 承担（uniqueName 纪律）。
async function compileWorkflowPublish(run) {
  const iPub = run.newIntent();
  await run.emit({
    intentId: iPub, atom: 'workflow.publish', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '发布', exact: true }, text: '发布',
  });
}

// workflow.clickEditorButton（wf-history-version D1）：点编辑器只读类按钮（历史版本等）——
// 照 clickEditorButton regress 形状，semantic role button exact 语义锚定（casey 纪律）。
async function compileWorkflowClickEditorButton(run, params) {
  const i = run.newIntent();
  await run.emit({
    intentId: i, atom: 'workflow.clickEditorButton', action: 'click',
    semantic: { kind: 'role', role: 'button', name: params.name, exact: true }, text: params.name,
  });
}

// workflow.closeDrawer（wf-history-version D2）：Esc 关弹窗/抽屉——press Escape 锚 body（count 恒 1
// 过身份门；Playwright press 先 focus 再发键，Esc 冒泡关弹窗，与 regress keyboard.press 等效）。
async function compileWorkflowCloseDrawer(run) {
  const i = run.newIntent();
  await run.emit({
    intentId: i, atom: 'workflow.closeDrawer', action: 'press', key: 'Escape',
    fallbackCss: 'body',
  });
}

// workflow.deleteByName（收尾清理线性化）：入口 = 列表搜索框；可证缺席（count===0）→ CASE_DEFECT 候选，
// 整个原子不落 event、编译继续（G1 附属人签形态）。
async function compileWorkflowDelete(run, params) {
  const m = run.mark();
  const iDel = run.newIntent();
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });
  const search = run.page.getByRole('textbox', { name: SEARCH_BOX_NAME });
  const n = await search.count().catch(() => 0);
  if (n === 0) {
    run.rollback(m);
    run.caseDefectCandidates.push({
      atom: 'workflow.deleteByName', params,
      evidence: { target: `role=textbox name=${SEARCH_BOX_NAME}`, count: 0 },
      note: '入口可证缺席：目标 role/text 全 DOM count===0；候选仅编译期/人签前有效（design §4.3）',
    });
    run.notes.push('workflow.deleteByName 入口可证缺席 → CASE_DEFECT 候选、不落该步、编译继续（G1 附属）');
    return;
  }
  const searchSemantic = { kind: 'role', role: 'textbox', name: SEARCH_BOX_NAME };
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'fill', semantic: searchSemantic, value: params.name });
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'press', semantic: searchSemantic, key: 'Enter' });
  // 计数口径对账（R1-F6，机械决策兑现）：搜索隔离后实采记录容器 count 与「删除」目标 count。
  // 真机可能是表格行，也可能是卡片布局；恒等才继续破坏性删除，不恒等升 route:human。
  run.countAudit = await auditDeleteCount(run.page, instantiate(params.name, run.ctx));
  if (!run.countAudit.equal) {
    // R2-F4：不恒等 = 证不出「删除按钮 ↔ 目标行」对应关系——破坏性点击一律不做，
    // 截断删除链路剩余步并硬阻断（executeMode 据 blockers fail-closed、不产成功产物）。
    run.blockers.push(`计数口径不恒等（布局=${run.countAudit.layout}，记录容器=${run.countAudit.recordContainers}，删除目标=${run.countAudit.deleteButtons}）→ 删除链路截断、route:human（接缝级）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const trigger = await run.emit(
    { intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'text', name: '删除', exact: true }, text: '删除', value: params.name },
    () => performWorkflowDeleteTrigger(run.page, instantiate(params.name, run.ctx)),
  );
  if (trigger.resolution !== 'unique' || trigger.acted !== true) {
    run.blockers.push(`目标记录删除动作域锁失败（resolution=${trigger.resolution}，count=${trigger.candidateCount}）→ 删除链路截断、route:human`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }

  // 先只读发现唯一可见确认弹层与其域内唯一确认文案，事件仍保持既有 role/name 形状；
  // 真正落笔时共享 helper 从物理域重新扫描、pin 并重验，发现与执行之间变化则 action_failed。
  const confirm = await inspectWorkflowDeleteConfirm(run.page);
  if (confirm.resolution !== 'unique' || !confirm.confirmName) {
    run.blockers.push(`确认弹层域锁失败（resolution=${confirm.resolution}，count=${confirm.candidateCount}）→ 删除链路截断、route:human`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const confirmResult = await run.emit(
    { intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'role', role: 'button', name: confirm.confirmName, exact: true }, text: confirm.confirmName, value: params.name },
    () => performWorkflowDeleteConfirm(run.page, confirm.confirmName, instantiate(params.name, run.ctx)),
  );
  if (confirmResult.resolution !== 'unique' || confirmResult.acted !== true) {
    run.blockers.push(`确认动作域锁失败（resolution=${confirmResult.resolution}，count=${confirmResult.candidateCount}）→ 删除链路截断、route:human`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 重搜（删后归零断言的取数前提，属动作不属断言）。
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'fill', semantic: searchSemantic, value: params.name });
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'press', semantic: searchSemantic, key: 'Enter' });
}

// 观测现状最终投影（drain 后调用，让异步 status/errorEnvelope 都已就位）：
// requestLog 条目与 watchNetworkForensics 记录同形；url 只落 pathname 且剥 query（G5）、initiator = 归因步或 background、
// status 取不到记 0（schema：requestfailed 记 0）、ts 归一 epoch 毫秒。
export function projectObserved(run, { caseId, capturedAt, capturedAgainstBuild = null }) {
  const records = run.forensics.records();
  const steps = run.observed.map((o) => ({
    stepId: o.stepId, intentId: o.intentId, atom: o.atom,
    urlPathnameAfter: o.urlPathnameAfter, cleanTitles: o.cleanTitles, toastTexts: o.toastTexts,
    replyText: o.replyText, replyStreamUrl: o.replyStreamUrl,
    requestLog: records.slice(o.recStart, o.recEnd).map((r) => ({
      url: requestLogPath(r.url),
      method: r.method ?? null,
      status: Number.isInteger(r.status) ? r.status : 0,
      ts: Math.round((r.ts || 0) * 1000),
      initiator: r.attributedStepId != null ? r.attributedStepId : 'background',
      attributedStepId: r.attributedStepId ?? null,
      errorEnvelope: r.errorEnvelope ?? null,
    })),
    quietPointReached: o.quietPointReached,
  }));
  return { schemaVersion: 1, caseId, channel: 'web', capturedAt, capturedAgainstBuild, steps };
}

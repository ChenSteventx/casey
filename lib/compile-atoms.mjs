// lib/compile-atoms.mjs —— 相1 编译执行引擎：骑 atom 知识把 flow 步翻成确定性 events + 观测现状 + 核验记录。
// 决策依 docs/plans/p3-compile/proposed/GRILL.md：G1 取 B（本引擎只产事实，回放核验另跑）、
// G6 分岔三取 C（events url 一律 {{baseUrl}} 占位符）、G1 附属（入口可证缺席 → 候选 + 不落该步、编译继续）、
// G7-3（assert.* 原子不产 event、折进所在 intent 意图留痕）。
// 本引擎零 LLM：flow 草稿由 LLM 在 CLI 外产出；这里是确定性执行 + 采集（L0）。
// 裁判零 LLM（护栏 #15）：本模块只产事实，绝不裁定、绝不写 verdict/passes。
import { instantiate } from './instantiate.mjs';
import { stripUrlQuery, maskCredentialRoute } from './cred-gate.mjs';

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

export function summarizeDeleteCountAudit({
  tableRows = null,
  targetCards = null,
  tableDeleteButtons = null,
  targetCardDeleteButtons = null,
  globalDeleteButtons = null,
} = {}) {
  const layout = tableRows > 0 ? 'table' : targetCards > 0 ? 'card' : 'unknown';
  const recordContainers = layout === 'table' ? tableRows : layout === 'card' ? targetCards : tableRows;
  const deleteButtons = layout === 'table'
    ? tableDeleteButtons
    : layout === 'card'
      ? targetCardDeleteButtons
      : globalDeleteButtons;
  return {
    tableRows, targetCards, tableDeleteButtons, targetCardDeleteButtons, globalDeleteButtons,
    layout, recordContainers, deleteButtons,
    equal: recordContainers != null && deleteButtons != null && recordContainers === deleteButtons,
  };
}

export async function auditDeleteCount(page, targetName) {
  const targetCards = page.locator('.hr-card.hr-card--bordered').filter({ hasText: targetName });
  const counts = {
    tableRows: await page.locator('.hr-table-row').count().catch(() => null),
    targetCards: await targetCards.count().catch(() => null),
    tableDeleteButtons: await page.locator('.hr-table-row').getByText('删除', { exact: true }).count().catch(() => null),
    targetCardDeleteButtons: await targetCards.getByText('删除', { exact: true }).count().catch(() => null),
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

    newIntent() { return `intent_${this.intentN++}`; },

    mark() {
      return { events: this.events.length, observed: this.observed.length, verification: this.verification.length, stepN: this.stepN, intentN: this.intentN, lastIntentId: this.lastIntentId };
    },
    rollback(m) {
      this.events.length = m.events; this.observed.length = m.observed; this.verification.length = m.verification;
      this.stepN = m.stepN; this.intentN = m.intentN; this.lastIntentId = m.lastIntentId;
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
          await customAct();
          acted = true;
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
      return { stepId, resolution };
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
// HANDOFF「双击」查无实证按笔误处理）：节点标题同时活在面板 .node-item 与画布 .lf-node-content，
// 全页身份门必撞多匹配——预检域锁 .lf-canvas-overlay 内 label 恰 1 才点（与回放 doOpenNode 同一扇门）
// → mouse 单击节点箱中心 → 后置核验抽屉可见且含标题（双证：开了、且开的是这个节点），证不出进
// blockers 硬阻断（镜像 addNode/connectNodes 先例）。抽屉族原子（setNodeField/selectNodeDropdown/...）
// 的共同前置。registry「点空重点一次」重试启发式不进确定性原子（差异挂 observability 真机复核）。
async function compileWorkflowOpenNode(run, params) {
  const i = run.newIntent();
  const label = String(params.label || '');
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
  // 身份回读须【精确】含 label 元素，非子串 hasText（评审 F1，与回放门 doOpenNode 同刻）：子串会把标题「label副本」
  // 等含子串的开错抽屉误判开对——精确回读堵「点了没开 / 开错抽屉」两向假绿。
  const drawerLoc = () => run.page.locator('.hr-drawer__content-wrapper').filter({ has: run.page.getByText(label, { exact: true }) });
  await run.emit({ intentId: i, atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: label, exact: true }, text: label }, async () => {
    await run.page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」
    await drawerLoc().first().waitFor({ state: 'visible', timeout: 5000 }); // 等不到抛 → emit 落 action_failed
  });
  // 后置核验（registry post：右侧配置抽屉打开）：抽屉可见 + 含节点标题双证；证不出 → blockers 硬阻断。
  const open = await drawerLoc().first().isVisible().catch(() => false);
  if (!open) {
    run.blockers.push(`workflow.openNode「${label}」后置核验节点配置抽屉未开（可见+含标题双证证不出）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.openNode「${label}」节点配置抽屉已开（可见+含标题双证过）`);
}

// workflow.selectNodeDropdown（画布节点抽屉下拉原子；GRILL D1/D3/D4/D5）：抽屉族第二原子（前置必先
// workflow.openNode 开抽屉——registry requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=click
// （零冻结 schema：nth 载下拉下标、text 载 option、semantic 载触发器锚）——不走 selectOption（冻结 schema
// 的 allOf 强制 selectOption 带 dropdownUnit，而 dropdownUnit 无 nth 槽、required fieldLabel/optionText 与
// 节点 nth 定位冲突）。预检域锁 .hr-drawer__content-wrapper 内第 nth 个 .hr-select 触发器（nth<count，路 A
// 确定性位置消歧；count=0 无下拉 / nth 越界 → blocker 硬阻断，fail-closed）→ customAct 点第 nth 触发器 +
// 限【可见浮层】.hr-select-option 唯一才点（多匹配/缺席 throw → emit 落 action_failed）→ 后置触发器值回读
// （不再「请选择」且精确含 option）。编译门与回放门 doSelectNodeDropdown 同刻（同域锁 + 同可见浮层作用域 +
// 同精确回读）。registry「点松回读紧」（点选项容 registry 子串但须唯一，回读精确）。
async function compileWorkflowSelectNodeDropdown(run, params) {
  const i = run.newIntent();
  const nth = Number.isInteger(params.nth) && params.nth >= 0 ? params.nth : 0;
  const option = params.option != null ? String(params.option) : null;
  // 预检域锁触发器门（emit 的 customAct 通路不走定位核验，此处自证——镜像 openNode 域锁 + addNode 源身份门）：
  const triggers = run.page.locator('.hr-drawer__content-wrapper .hr-select');
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
  const spec = { intentId: i, atom: 'workflow.selectNodeDropdown', action: 'click', nth, semantic: { kind: 'text', name: '请选择', exact: true } };
  if (option) spec.text = option;
  await run.emit(spec, async () => {
    await triggers.nth(nth).click({ timeout: 3000 });
    // 可见浮层作用域（防浮层 teleport 到 body 全局 text 撞列表页/孪生浮层）：限可见 .hr-select-option。
    const visibleOptions = run.page.locator('.hr-select-option:visible');
    await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 });
    const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
    const oc = await target.count().catch(() => 0);
    if (oc !== 1) throw new Error(`浮层内目标选项「${option ?? '首项'}」可见 count=${oc} 非唯一/缺席，拒点`);
    await target.first().click({ timeout: 3000 });
  });
  // 后置核验（触发器值回读；registry post：该下拉已选中含 option 的项）：不再「请选择」且【精确】含 option
  // （filter has getByText exact 非子串——openNode F1 教训下拉版：子串会把「选错项/写错值」误判选对）。
  let val = null;
  try { val = (await triggers.nth(nth).innerText({ timeout: 2000 })).trim(); } catch { val = null; }
  const exactHit = option
    ? await triggers.nth(nth).filter({ has: run.page.getByText(option, { exact: true }) }).count().catch(() => 0)
    : (val && val !== '请选择' ? 1 : 0);
  if (!val || val === '请选择' || exactHit !== 1) {
    run.blockers.push(`workflow.selectNodeDropdown 后置核验触发器值回读证不出（值=${val ?? '证不出'}，精确含 option=${option ? exactHit === 1 : 'n/a'}）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.selectNodeDropdown 节点下拉已选中（nth=${nth}/${option ?? '首项'}，触发器值「${val}」精确回读过）`);
}

// workflow.setNodeField（画布节点抽屉可填字段原子；GRILL D1/D3/D4/D5）：抽屉族第三原子（前置必先
// workflow.openNode 开抽屉——registry requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=fill
// （零冻结 schema：value 载填入值、semantic:{kind:label,name:placeholder,exact} 载占位符锚 + 精确开关、
// nth 仅显式给时载字段下标消歧）——冻结 schema 的 allOf 对 fill 只要求 value。预检域锁 .hr-drawer__content-wrapper
// 内 getByPlaceholder(placeholder,{exact})（占位符锚非 semanticLocator 命中口径，故按 ev.atom 分发专用回放门
// doSetNodeField；全页 getByPlaceholder 会撞「新增工作流」抽屉的 请输入工作流名称 → ambiguous 卡死）。字段级
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
  // 预检域锁字段门（emit 的 customAct 通路不走定位核验，此处自证——镜像 selectNodeDropdown 域锁 + openNode 源身份门）：
  const fields = run.page.locator('.hr-drawer__content-wrapper').getByPlaceholder(placeholder, { exact });
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
  const spec = { intentId: i, atom: 'workflow.setNodeField', action: 'fill', value, semantic: { kind: 'label', name: placeholder, exact } };
  if (hasNth) spec.nth = nth;
  const target = () => fields.nth(hasNth ? nth : 0);
  await run.emit(spec, async () => {
    await target().fill(instantiate(value, run.ctx), { timeout: 3000 });
  });
  // 后置核验（registry post：该字段被填入值）：字段 value 回读【精确】等于实例化后填入值（非 includes 子串——
  // openNode/selectNodeDropdown F1 精确回读同律：子串会把填错值/半填/value副本超集误判填对，fail-open 假绿）。
  const want = instantiate(value, run.ctx);
  let got = null;
  try { got = await target().inputValue({ timeout: 2000 }); } catch { got = null; }
  if (got !== want) {
    run.blockers.push(`workflow.setNodeField 后置核验字段值回读证不出（占位符「${placeholder}」回读值=${got == null ? '证不出' : `「${got}」`}，期望精确「${want}」）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.setNodeField 节点字段已填入（〈${placeholder}〉=〈${want}〉，value 精确回读过）`);
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
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'text', name: '删除', exact: true }, text: '删除' });
  // 删除确认按钮文本实采（route:human ⑦）。role=button 优先（规范表单）；Heren 真机对话框同为 div 按钮 →
  // 可见对话框容器候选序里取 count===1 的锚（确定性：DOM 给定则唯一），实采文本记 compile-report。
  let confirmName = null;
  for (const cand of ['确定', '确认']) {
    if ((await run.page.getByRole('button', { name: cand, exact: true }).count().catch(() => 0)) >= 1) { confirmName = cand; break; }
  }
  if (confirmName) {
    await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'role', role: 'button', name: confirmName, exact: true }, text: confirmName });
  } else {
    const dlgCandidates = [
      '.hr-dialog:visible .hr-button--theme-primary',
      '[class*="dialog"]:visible .hr-button--theme-primary',
      '[class*="message-box"]:visible .hr-button--theme-primary',
      '[class*="popconfirm"]:visible .hr-button--theme-primary',
    ];
    let hit = null;
    for (const css of dlgCandidates) {
      if ((await run.page.locator(css).count().catch(() => 0)) === 1) { hit = css; break; }
    }
    if (hit) {
      const t = ((await run.page.locator(hit).first().textContent().catch(() => '')) || '').trim() || '确定';
      run.notes.push(`删除确认按钮实采（div 按钮）：文本「${t}」锚「${hit}」（route:human ⑦ 证据）`);
      await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'click', text: t, fallbackCss: hit });
    } else {
      run.notes.push('删除确认按钮文本实采失败 → route:human ⑦');
      await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'role', role: 'button', name: '确定', exact: true }, text: '确定' });
    }
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

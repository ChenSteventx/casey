// 回放动作原语 + 点击身份门（动作轴）。移植 autotester robust-actions 思路，但守卫不抛——
// 动作失败如实翻译成轴信号交 verdict.mjs 裁（守卫不自己定生死、绝不谎报 actionPerformed，护栏 #15/#14）。
// 统一身份门：count===1 才唯一可动作；count>1 一律 ambiguous【且绝不执行变更动作】；count===0 → none + 漂移探针。
// 返回动作轴 { resolution, identityReadback?, driftProbe?, candidateCount? } 或纯断言步 { kind:'none' }。
import { instantiate, instantiateEventSemantic } from './instantiate.mjs';
import { findEquivalentAffordance } from './drift-probe.mjs';
import { performWorkflowDeleteConfirm, performWorkflowDeleteTrigger } from './workflow-delete-domain.mjs';
import { isAgentToolSpecialAction, performAgentToolAction } from './agent-tool-actions.mjs';
import { resolveAgentSearchTarget, resolveAgentCardTarget, clickAgentCardWithin } from './agent-search-gate.mjs';
import { encodeInputReadback } from './replay-assert.mjs';
import { createActionAuthorityGate } from './replay/action-authority.mjs';
import { isCompilableAtom } from './compile-atoms.mjs';
import {
  dispatchActivePageReplayAction,
  dispatchNewPageReplayAction,
} from './page-topology/replay-action.mjs';
import { consumeNewPageAction } from './page-topology/replay-bridge.mjs';
import { doDragTo } from './replay-actions/canvas.mjs';
import { doAgentSearchOpen } from './replay-actions/agent-search.mjs';
import {
  doBindAgent,
  doOpenNode,
  doSelectNodeDropdown,
  doSetNodeField,
} from './replay-actions/workflow-drawer.mjs';

function semanticLocator(page, ev) {
  const s = ev.semantic;
  if (s && s.kind === 'role' && s.role) return page.getByRole(s.role, { name: s.name, exact: s.exact !== false });
  if (s && s.kind === 'label' && s.name) return page.getByLabel(s.name);
  if (s && s.kind === 'text' && s.name) return page.getByText(s.name, { exact: !!s.exact });
  if (ev.role && ev.accessibleName) return page.getByRole(ev.role, { name: ev.accessibleName, exact: true });
  if (ev.fieldLabel) return page.getByLabel(ev.fieldLabel);
  return null;
}

function encodeNodeFieldReadback({ label, placeholder, exact, got }) {
  return encodeInputReadback({ nodeName: label, placeholder, exact, value: got });
}

// 未知原子前置拒绝判据（负护栏 C4 entity-rename-negative-guard，护栏 #14 fail-safe）——纯函数、只看 ev、零 page。
// ev.atom 是字符串但不在编译知识允许集（isCompilableAtom 单一事实源 = login / assert.* / NAMED_ASSERTION_ATOMS /
// COMPILE_ATOM_COMPILERS own key）即返回具名拒绝轴，否则返回 null（放行）。合法编译只发允许集内原子的 event
// （compileAtomStep 对未知原子早抛「暂无编译知识」，编译面已前置拒），故本判据对任何真实产出的 event 恒返 null、
// 零行为差；它只在回放侧补齐对称——回放消费手造/被篡改 artifact 携 workflow.rename 等无编译器原子时，据此在触碰
// page 之前具名拒。判据只针对 string 原子（缺省/非 string 原子沿旧路，不扩本判据责任面）。
// resolution='action_failed' 令 verdict.mjs 的 actionPerformed=false（绝不 unique）→ 该路径绝不产 PASS。
export function unknownAtomRejection(ev) {
  if (typeof ev?.atom === 'string' && !isCompilableAtom(ev.atom)) {
    return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false }, rejectReason: 'UNKNOWN_ATOM', unknownAtom: ev.atom };
  }
  return null;
}

// 回放动作分发点（原子分发点，护栏 #14）：先过未知原子前置闸——命中即在第一次浏览器副作用之前 fail-closed 拒、
// 绝不触碰 page；未命中才委派 performAction 执行真实动作。生产回放（bin/replay.mjs）经此分发；performAction 保持
// 原样（既有金牌逐字节钉其对全谱事件的动作轴，本闸不改其行为面，只在其之前加一道前置拒）。
export async function dispatchReplayAction(page, ev, ctx) {
  const reject = unknownAtomRejection(ev);
  if (reject) return reject;
  return performAction(page, ev, ctx);
}

export async function performAction(page, ev, ctx) {
  if (ev && ev.action === 'newpage') {
    return dispatchNewPageReplayAction({
      topology: ctx?.pageTopology,
      event: ev,
      consumeNewPageAction,
    });
  }
  if (ctx?.pageTopology && ev?.action !== 'nav') {
    return dispatchActivePageReplayAction({
      topology: ctx.pageTopology,
      event: ev,
      perform: (activePage) => performActionOnPage(activePage, ev, ctx),
    });
  }
  return performActionOnPage(page, ev, ctx);
}

async function performActionOnPage(page, ev, ctx) {
  // 纯断言步（无动作）：actionPerformed 由断言驱动（verdict 对 kind==='none' 视作 true）。
  if (!ev.action || ev.action === 'none' || ev.action === 'assert') return { kind: 'none' };
  // nav 的动作轴由 orchestrator 按 goto 实际成败给（这里不下结论，回 null 让 orchestrator 接管）。
  if (ev.action === 'nav') return null;
  if (ev.action === 'selectOption') return await doSelect(page, ev, ctx);
  if (ev.action === 'dragTo') return await doDragTo(page, ev);
  if (isAgentToolSpecialAction(ev)) return await performAgentToolAction(page, ev, ctx);
  if (ev.action === 'click' && ev.atom === 'agent.searchOpen') {
    return await doAgentSearchOpen(page, ev, ctx, {
      resolveAgentSearchTarget,
      resolveAgentCardTarget,
      clickAgentCardWithin,
    });
  }
  if (ev.action === 'click' && ev.atom === 'workflow.bindAgent') return await doBindAgent(page, ev, ctx);
  if (ev.action === 'click' && ev.atom === 'workflow.openNode') return await doOpenNode(page, ev);
  if (ev.action === 'click' && ev.atom === 'workflow.selectNodeDropdown') return await doSelectNodeDropdown(page, ev);
  if (ev.action === 'click' && ev.atom === 'workflow.deleteByName') {
    const label = ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
    // 删除 click 必须携既有 schema 的 value（目标名模板）；旧 spec 缺该绑定一律拒点，须先真机重编译。
    // 这既防搜索框残值误删，也把“触发成功 → 确认”绑成同页一次性链，前一动作失败时不得确认旧弹层。
    const targetName = typeof ev.value === 'string' && ev.value.trim() ? instantiate(ev.value, ctx) : null;
    if (!targetName) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
    if (label === '删除') return await performWorkflowDeleteTrigger(page, targetName);
    if (label === '确定' || label === '确认') return await performWorkflowDeleteConfirm(page, label, targetName);
    return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  }
  if (ev.action === 'fill' && ev.atom === 'workflow.setNodeField') {
    return await doSetNodeField(page, ev, ctx, { encodeNodeFieldReadback });
  }

  // 语义名回填（semantic-name-instantiate）：通用定位路径入口处把 semantic.name 的 {{占位符}} 按本次
  // run 的 ctx 回填成定位视图——落盘 event 与上游对象永不被改（只在真含占位时产浅拷贝）。不这么做，
  // 定位就拿字面 {{…}} 找元素、恒 0 命中（B4 九跑实证）。专用身份门分支在本行之前、完全不受影响；
  // 下游 gateAndAct 不消费 semantic.name（只看 action/value/atom/targetName），故行为面只此一处。
  ev = instantiateEventSemantic(ev, ctx);
  const cand = await resolveCandidate(page, ev);
  return await gateAndAct(page, cand, ev, ctx);
}

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

async function admitActionOrigin(page, ctx) {
  if (typeof ctx?.admitReplayActionOrigin !== 'function') return true;
  try {
    return await ctx.admitReplayActionOrigin(page) === true;
  } catch {
    return false;
  }
}

// 通用动作的活动页归属令牌：现役 page topology 在场时才有 active owner 概念。
// 未绑定 topology 的旧调用方（无 owner 提供者）退化为 page 对象身份，语义不变。
function activeOwnerToken(page, ctx) {
  try {
    const authority = ctx?.pageTopology?.activePageAuthority?.();
    return authority && typeof authority === 'object' ? authority : page;
  } catch {
    return page;
  }
}

// 通用路径 resolve 接缝：只读 locator/count/identity，绝不产生页面动作。
// 绑定 active owner 时同时取 physical ElementHandle，供动作窗口前核对 owner 归属。
async function resolveFormalCandidate({ runtime }) {
  const { page, ctx, cand } = runtime;
  if (cand.count !== 1) return { count: cand.count };
  const locator = cand.locator.first();
  const owner = activeOwnerToken(page, ctx);
  const bound = owner !== page;
  const handle = bound ? await locator.elementHandle() : null;
  if (bound && !handle) return null;
  return {
    count: 1,
    candidate: { locator, handle, page },
    pageAuthority: owner,
  };
}

// 动作窗口前重验：active owner 换代、page owner 错配、节点脱离/替换或候选数变化一律拒。
async function revalidateFormalCandidate({ candidate, pageAuthority, runtime }) {
  const { ctx } = runtime;
  if (activeOwnerToken(candidate.page, ctx) !== pageAuthority) return null;
  const candidateCount = await candidate.locator.count();
  if (!candidate.handle) {
    // 无 owner 提供者时只可确证「该 locator 当刻仍恰解析到一个在册节点」，动作也由它当场重解析。
    const unique = candidateCount === 1;
    return {
      connected: unique,
      sameNode: unique,
      candidateCount,
      ownerMatches: true,
    };
  }
  const connected = await candidate.handle
    .evaluate((node) => node?.isConnected === true) === true;
  const frame = await candidate.handle.ownerFrame();
  const ownerPage = frame && typeof frame.page === 'function' ? frame.page() : null;
  const fresh = candidateCount === 1 ? await candidate.locator.elementHandle() : null;
  const sameNode = fresh
    ? await fresh.evaluate((node, other) => node === other, candidate.handle) === true
    : false;
  return {
    connected,
    sameNode,
    candidateCount,
    ownerMatches: ownerPage === candidate.page,
  };
}

async function performFormalCandidate({ candidate, event, runtime }) {
  return await doAct(runtime.page, candidate.handle || candidate.locator, event, runtime.ctx);
}

async function admitFormalOrigin({ runtime }) {
  return await admitActionOrigin(runtime.page, runtime.ctx);
}

async function probeFormalDrift({ event, runtime }) {
  // count===0：录制 locator 全失配 → 只读漂移探针（不点不改 spec）。
  return await findEquivalentAffordance(runtime.page, event.atom, event.targetName);
}

// 点击身份门（统一所有通用定位分支）：与示教 raw 驱动共用同一 opaque 一次性 action authority gate，
// 避免正式回放与 raw 复现两条执行路径漂移。多匹配绝不落笔，唯一候选也必须过重验才动作（护栏 #15）。
const formalActionGate = createActionAuthorityGate({
  resolveCandidate: resolveFormalCandidate,
  revalidateCandidate: revalidateFormalCandidate,
  performCandidate: performFormalCandidate,
  probeDrift: probeFormalDrift,
  admitOrigin: admitFormalOrigin,
});

async function gateAndAct(page, cand, ev, ctx) {
  const topologyAuthority = ctx?.pageTopology ?? null;
  const executionTargetAuthority = ctx?.executionTargetAuthority ?? null;
  const runtime = { page, ctx, cand };
  const resolved = await formalActionGate.resolve({
    event: ev,
    topologyAuthority,
    executionTargetAuthority,
    runtime,
  });
  if (resolved.resolution !== 'unique') return resolved;
  // 元素唯一但动作失败：绝不谎报 unique；落证不出（verdict ap=false）→ INDETERMINATE（fail-safe）。
  return await formalActionGate.perform({
    actionAuthority: resolved.actionAuthority,
    topologyAuthority,
    executionTargetAuthority,
  });
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
  if (n > 1) return { resolution: 'ambiguous', candidateCount: n };
  if (n === 1) {
    let ok = false;
    try {
      if (!await admitActionOrigin(page, ctx)) {
        return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
      }
      await combo.first().click({ timeout: 2000 });
      const list = page.locator(du.optionListSelector || '.hr-select__list');
      if (!await admitActionOrigin(page, ctx)) {
        return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
      }
      await list.getByText(du.optionText, { exact: true }).first().click({ timeout: 2000 });
      ok = true;
    } catch { ok = false; }
    return ok ? { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } } : { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  return { resolution: 'none', candidateCount: 0, driftProbe: await findEquivalentAffordance(page, ev.atom, ev.targetName) };
}

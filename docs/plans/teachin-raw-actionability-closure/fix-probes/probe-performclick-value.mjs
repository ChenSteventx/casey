// 探针：canonical raw driver 的 click 路对「现役 controller.performClick 的真实成功形状」是否成立。
// 现役 lib/page-topology/controller.mjs performClick 成功返回 { ok, reason, handoff, activePageAuthority }
// —— 无 value 键；而 lib/teachin/raw-playwright-driver.mjs 判 performed.value === true。
// 留证件（GRILL v3 D0 事实链的机器复现）：路径按仓内相对写，任何机器可跑。
//   node docs/plans/teachin-raw-actionability-closure/fix-probes/probe-performclick-value.mjs
// 修前预期：faithful-controller click 出 {"ok":false,"reason":"ACTION_FAILED"} 而物理动作已落地；
// 修后预期：三形态全 ok:true（legacy-double 一行留作 seam 回退对照，不是目标形状）。
import { canonicalRawPlaywrightDriver } from '../../../../lib/teachin/raw-playwright-driver.mjs';
import { resolveExecutionTarget } from '../../../../lib/execution-target/authority.mjs';

const URL_HOME = 'https://probe.invalid/home';
const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: URL_HOME },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});

const physical = [];
const page = {};
const node = { isConnected: true };
const frame = { page: () => page };
const handle = {
  async evaluate(fn, arg) {
    const other = arg && typeof arg === 'object' && arg.__node ? arg.__node() : arg;
    return fn(node, other);
  },
  async ownerFrame() { return frame; },
  async click() { physical.push('click'); },
  async fill(value) { physical.push(`fill:${value}`); },
};
Object.defineProperty(handle, '__node', { value: () => node, enumerable: false });
const locator = {
  first() { return locator; },
  async waitFor() {},
  async count() { return 1; },
  async elementHandle() { return handle; },
};
Object.assign(page, {
  locator: () => locator,
  mainFrame: () => frame,
  url: () => URL_HOME,
  isClosed: () => false,
});

const authority = Object.freeze(Object.create(null));

function faithfulTopology() {
  // 逐字复刻现役 controller 成功返回形状（无 value 键，回调返回值被丢弃）。
  return Object.freeze({
    activePageAuthority: () => authority,
    async evaluateActive({ pageAuthority, evaluate }) {
      if (pageAuthority !== authority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      try {
        return Object.freeze({ ok: true, reason: null, value: await evaluate(page) });
      } catch { return Object.freeze({ ok: false, reason: 'PAGE_EVALUATION_FAILED' }); }
    },
    async performClick({ pageAuthority, perform }) {
      if (pageAuthority !== authority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      let failed = false;
      try { await perform(page); } catch { failed = true; }
      if (failed) return Object.freeze({ ok: false, reason: 'PAGE_ACTION_FAILED', verdictHint: 'NEEDS_HUMAN' });
      return Object.freeze({
        ok: true,
        reason: null,
        handoff: Object.freeze({ kind: 'none', candidateCount: 0 }),
        activePageAuthority: authority,
      });
    },
  });
}

function legacyDoubleTopology() {
  // 既有金牌替身的形状（多回 value 键）——与现役 controller 不一致。
  return Object.freeze({
    activePageAuthority: () => authority,
    async evaluateActive({ pageAuthority, evaluate }) {
      if (pageAuthority !== authority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      return { ok: true, value: await evaluate(page) };
    },
    async performClick({ pageAuthority, perform }) {
      if (pageAuthority !== authority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      return { ok: true, value: await perform(page) };
    },
  });
}

for (const [label, topology, event] of [
  ['faithful-controller click', faithfulTopology(), { action: 'click', path: '/home', fallbackCss: '#go' }],
  ['legacy-double click', legacyDoubleTopology(), { action: 'click', path: '/home', fallbackCss: '#go' }],
  ['faithful-controller fill', faithfulTopology(), { action: 'fill', path: '/home', fallbackCss: '#go', value: 'x' }],
]) {
  physical.length = 0;
  const resolved = await canonicalRawPlaywrightDriver.resolve({
    event,
    topologyAuthority: topology,
    executionTargetAuthority: execution.authority,
  });
  const performed = await canonicalRawPlaywrightDriver.perform({
    actionAuthority: resolved.actionAuthority,
    topologyAuthority: topology,
    executionTargetAuthority: execution.authority,
  });
  console.log(label, '=>', JSON.stringify({
    resolve: { resolution: resolved.resolution, candidateCount: resolved.candidateCount },
    perform: performed,
    physical: [...physical],
  }));
}

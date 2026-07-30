// canonical raw Playwright 驱动：raw replay 的真实定位与动作路径。
// 它不是测试替身——runner 用的就是这条 canonical 路径。定位、重验与动作全部经现役 page topology
// active owner 接缝与共用 action authority gate；origin 由现役 execution-target 校验器裁定，
// 不接调用方布尔。CLI/orchestrator 不接 factory/provider。

import { createActionAuthorityGate } from '../replay/action-authority.mjs';
import { createReplayOriginAdmission } from '../replay/origin-admission.mjs';

const CLICK_ACTIONS = new Set(['click', 'dblclick']);

function activeOwnerToken(topologyAuthority) {
  try {
    const authority = topologyAuthority?.activePageAuthority?.();
    return authority && typeof authority === 'object' ? authority : null;
  } catch {
    return null;
  }
}

async function evaluateInActivePage(topologyAuthority, pageAuthority, evaluate) {
  let evaluated;
  try {
    evaluated = await topologyAuthority.evaluateActive({ pageAuthority, evaluate });
  } catch {
    return null;
  }
  return evaluated?.ok === true ? evaluated : null;
}

function hostFreePath(url) {
  try {
    const parsed = new URL(String(url));
    return `${parsed.pathname || '/'}${parsed.search || ''}`;
  } catch {
    return null;
  }
}

// resolve 只读 locator/count/identity，绝不产生页面动作；恰一候选才交 gate 铸权。
async function resolveRawCandidate({ event, topologyAuthority }) {
  const pageAuthority = activeOwnerToken(topologyAuthority);
  if (!pageAuthority) return null;
  const evaluated = await evaluateInActivePage(topologyAuthority, pageAuthority,
    async (page) => {
      const locator = page.locator(event.fallbackCss).first();
      try {
        await locator.waitFor({ state: 'attached', timeout: 1200 });
      } catch {
        // 缺席由 count 如实反映，不在此处下结论。
      }
      const count = await locator.count();
      if (count !== 1) return { count };
      return { count, handle: await locator.elementHandle(), page };
    });
  const value = evaluated?.value;
  if (!value || !Number.isSafeInteger(value.count)) return null;
  if (value.count !== 1) return { count: value.count };
  if (!value.handle) return null;
  return {
    count: 1,
    candidate: {
      handle: value.handle,
      page: value.page,
      selector: event.fallbackCss,
    },
    pageAuthority,
  };
}

// 动作窗口前重验：active owner 换代、page owner 错配、节点脱离/替换或候选数变化一律拒。
async function revalidateRawCandidate({ candidate, pageAuthority, topologyAuthority }) {
  if (activeOwnerToken(topologyAuthority) !== pageAuthority) return null;
  const evaluated = await evaluateInActivePage(topologyAuthority, pageAuthority,
    async (page) => {
      const locator = page.locator(candidate.selector).first();
      const candidateCount = await locator.count();
      const connected = await candidate.handle
        .evaluate((node) => node?.isConnected === true) === true;
      const frame = await candidate.handle.ownerFrame();
      const ownerPage = frame && typeof frame.page === 'function' ? frame.page() : null;
      const fresh = candidateCount === 1 ? await locator.elementHandle() : null;
      const sameNode = fresh
        ? await fresh.evaluate((node, other) => node === other, candidate.handle) === true
        : false;
      return {
        connected,
        sameNode,
        candidateCount,
        ownerMatches: ownerPage === page,
      };
    });
  return evaluated?.value || null;
}

async function admitRawOrigin({ pageAuthority, topologyAuthority, executionTargetAuthority }) {
  const admitOrigin = createReplayOriginAdmission(executionTargetAuthority);
  const evaluated = await evaluateInActivePage(topologyAuthority, pageAuthority,
    async (page) => await admitOrigin(page) === true);
  return evaluated?.value === true;
}

async function performRawCandidate({ candidate, pageAuthority, topologyAuthority, event }) {
  const act = async () => {
    if (event.action === 'click') await candidate.handle.click({ timeout: 2000 });
    else if (event.action === 'dblclick') await candidate.handle.dblclick({ timeout: 2000 });
    else if (event.action === 'fill') await candidate.handle.fill(event.value, { timeout: 2000 });
    else if (event.action === 'press') await candidate.handle.press(event.key, { timeout: 2000 });
    else return false;
    return true;
  };
  let performed;
  try {
    performed = CLICK_ACTIONS.has(event.action)
      ? await topologyAuthority.performClick({ pageAuthority, perform: act })
      : await topologyAuthority.evaluateActive({ pageAuthority, evaluate: act });
  } catch {
    return false;
  }
  return performed?.ok === true && performed.value === true;
}

async function probeRawDrift() {
  // raw 复现不做语义漂移猜测：零候选就是零候选。
  return { sameSignatureUniquePresent: false };
}

const rawActionGate = createActionAuthorityGate({
  resolveCandidate: resolveRawCandidate,
  revalidateCandidate: revalidateRawCandidate,
  performCandidate: performRawCandidate,
  probeDrift: probeRawDrift,
  admitOrigin: admitRawOrigin,
});

async function readActivePath({ topologyAuthority } = {}) {
  const pageAuthority = activeOwnerToken(topologyAuthority);
  if (!pageAuthority) return null;
  const evaluated = await evaluateInActivePage(topologyAuthority, pageAuthority,
    async (page) => hostFreePath(page.url()));
  return typeof evaluated?.value === 'string' ? evaluated.value : null;
}

async function resolveRawAction(input = {}) {
  return rawActionGate.resolve({
    event: input.event,
    topologyAuthority: input.topologyAuthority,
    executionTargetAuthority: input.executionTargetAuthority,
  });
}

async function performRawAction(input = {}) {
  const axis = await rawActionGate.perform({
    actionAuthority: input.actionAuthority,
    topologyAuthority: input.topologyAuthority,
    executionTargetAuthority: input.executionTargetAuthority,
  });
  return axis.resolution === 'unique'
    ? Object.freeze({ ok: true, identityReadback: Object.freeze({ ok: true }) })
    : Object.freeze({ ok: false, reason: 'ACTION_FAILED' });
}

export const canonicalRawPlaywrightDriver = Object.freeze({
  readActivePath,
  resolve: resolveRawAction,
  perform: performRawAction,
});

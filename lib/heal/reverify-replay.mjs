// lib/heal/reverify-replay.mjs —— S6 复核的「真回放」半边（从 lib/heal/reverify.mjs 拆出）。
//
// 拆分只为让编排模块与回放装配各自留在可读体量内，语义一字未改：本模块仍只走现役共用件
// （身份门 / 语义定位 / 只读漂移探针 / 观察原语 / 三轴投影），不合成任何裁定字节。
// 复核编排（准入、互斥、基线绑定、裁定消费与回滚）仍在 lib/heal/reverify.mjs。

import { createActionAuthorityGate } from '../replay/action-authority.mjs';
import {
  captureIntentObservationBaseline,
  captureIntentObservationTerminal,
} from '../replay/intent-observation.mjs';
import { projectReplayAxes } from '../replay-axes.mjs';
import { projectReplayAssertion } from '../replay-entity-anchor.mjs';
import { inputReadbackFromAction } from '../replay-assert.mjs';
import { findEquivalentAffordance } from '../drift-probe.mjs';
import { locatorFor } from '../compile-atoms-support.mjs';
import { instantiate } from '../instantiate.mjs';

// ── 真回放：现役共用身份门 + 现役语义定位 + 现役只读漂移探针 ─────────────────
// D13 ①：复核的定位面**只**走现役 `compile-atoms-support::locatorFor`（与回放消费面
// `lib/replay-actions.mjs::semanticLocator` 逐字同形）。`within` 在这里一个字都不读——
// 生产回放不读它，复核多读一个键就等于「复核比生产强」，那种绿不能代表回放会绿。
// 候选文件里的 `within` 仍在（人签绑定的字节差 + 前向兼容注记），只是无人消费。
async function resolveHealCandidate({ event, runtime }) {
  const { page } = runtime;
  const locator = locatorFor(page, event);
  if (!locator) return { count: 0 };
  try { await locator.first().waitFor({ state: 'attached', timeout: 1200 }); } catch { /* 缺席由 count 如实反映 */ }
  let n = 0;
  try { n = await locator.count(); } catch { n = 0; }
  if (n !== 1) return { count: n };
  return { count: 1, candidate: { locator: locator.first(), page }, pageAuthority: page };
}

// 无 ElementHandle 提供者时只可确证「该 locator 当刻仍恰解析到一个节点」，与现役 generic
// 路径的同名分支（lib/replay-actions.mjs::revalidateFormalCandidate）逐字同语义。
async function revalidateHealCandidate({ candidate, pageAuthority }) {
  if (candidate.page !== pageAuthority) return null;
  let candidateCount = 0;
  try { candidateCount = await candidate.locator.count(); } catch { return null; }
  const unique = candidateCount === 1;
  return { connected: unique, sameNode: unique, candidateCount, ownerMatches: true };
}

async function performHealCandidate({ candidate, event, runtime }) {
  const loc = candidate.locator;
  try {
    if (event.action === 'click') await loc.click({ timeout: 2000 });
    else if (event.action === 'dblclick') await loc.dblclick({ timeout: 2000 });
    else if (event.action === 'fill') await loc.fill(instantiate(event.value, runtime.ctx), { timeout: 2000 });
    else if (event.action === 'press') await loc.press(event.key || 'Enter', { timeout: 2000 });
    else return false;
    return true;
  } catch { return false; }
}

async function admitHealOrigin({ runtime }) {
  const admit = runtime.ctx?.admitReplayActionOrigin;
  if (typeof admit !== 'function') return true;
  try { return await admit(runtime.page) === true; } catch { return false; }
}

async function probeHealDrift({ event, runtime }) {
  return findEquivalentAffordance(runtime.page, event.atom, event.targetName);
}

const healActionGate = createActionAuthorityGate({
  resolveCandidate: resolveHealCandidate,
  revalidateCandidate: revalidateHealCandidate,
  performCandidate: performHealCandidate,
  probeDrift: probeHealDrift,
  admitOrigin: admitHealOrigin,
});

async function dispatchHealAction(runtime, event) {
  if (!event.action || event.action === 'none' || event.action === 'assert') return { kind: 'none' };
  const resolved = await healActionGate.resolve({
    event, topologyAuthority: null, executionTargetAuthority: null, runtime,
  });
  if (resolved.resolution !== 'unique') return resolved;
  return healActionGate.perform({
    actionAuthority: resolved.actionAuthority,
    topologyAuthority: null,
    executionTargetAuthority: null,
  });
}

/** 运行时取证快照 → axes 投影入参（接缝给 axes 形，真 hub 给 records() 形，两形都接）。 */
function forensicsSnapshot(runtime) {
  const f = runtime?.forensics;
  if (f && typeof f.records === 'function') {
    return {
      records: f.records() || [],
      pageErrors: Array.isArray(runtime.pageErrors) ? runtime.pageErrors.slice() : [],
    };
  }
  if (f && Array.isArray(f.network)) {
    const pe = Array.isArray(f.lifecycle?.pageerror) ? f.lifecycle.pageerror : [];
    return { records: f.network, pageErrors: pe };
  }
  return { records: [], pageErrors: [] };
}

/** 真回放一遍已晋升的 spec，产 axes 全文（不裁定；裁定归冻结裁判）。 */
export async function replayPromotedSpec({ runtime, caseId, eventsDoc, expectedDoc }) {
  const page = runtime.page;
  const ctx = {
    uniqueName: 'r1',
    baseUrl: '',
    profile: {},
    admitReplayActionOrigin: typeof runtime.originAdmission === 'function'
      ? runtime.originAdmission : null,
  };
  const bound = { page, ctx };
  const events = eventsDoc.events;
  const intentOrder = [];
  const intentEvents = new Map();
  for (const ev of events) {
    if (!intentEvents.has(ev.intentId)) { intentEvents.set(ev.intentId, []); intentOrder.push(ev.intentId); }
    intentEvents.get(ev.intentId).push(ev);
  }
  const reprStepOf = new Map(intentOrder.map((iid) => [iid, intentEvents.get(iid).slice(-1)[0].stepId]));
  const expectedByIntent = new Map((expectedDoc.intents || []).map((it) => [
    it.intentId, (it.expected || []).map((a) => projectReplayAssertion(a, ctx)),
  ]));
  const globalAssertions = (expectedDoc.globalAssertions || []).map((a) => projectReplayAssertion(a, ctx));

  const actionByStep = new Map();
  const intentUrl = new Map();
  const intentCount = new Map();
  const intentToasts = new Map();
  const intentTextHits = new Map();
  const intentButtonHits = new Map();
  const intentButtonSeen = new Map();
  const intentButtonDisabledHits = new Map();
  const intentInputReadback = new Map();
  const intentReply = new Map();
  const countSelector = '.hr-table-row';

  for (const ev of events) {
    const isFirst = intentEvents.get(ev.intentId)[0].stepId === ev.stepId;
    const isLast = reprStepOf.get(ev.intentId) === ev.stepId;
    if (isFirst) {
      const baseline = await captureIntentObservationBaseline({
        page, countSelector, chat: null, replySelector: null,
      });
      intentCount.set(ev.intentId, { before: baseline.count, after: null });
    }
    actionByStep.set(ev.stepId, await dispatchHealAction(bound, ev));
    if (isLast) {
      const assertions = [...(expectedByIntent.get(ev.intentId) || []), ...globalAssertions];
      const terminal = await captureIntentObservationTerminal({
        page, countSelector, chat: null, replySelector: null, replyBaseline: null,
        assertions, buttons: null,
      });
      intentUrl.set(ev.intentId, terminal.url);
      const count = intentCount.get(ev.intentId);
      if (count) count.after = terminal.count;
      intentToasts.set(ev.intentId, terminal.toasts);
      intentTextHits.set(ev.intentId, terminal.textHits);
      if (terminal.buttonObservation) {
        intentButtonHits.set(ev.intentId, terminal.buttonObservation.buttonHits);
        intentButtonDisabledHits.set(ev.intentId, terminal.buttonObservation.buttonDisabledHits);
        if (terminal.buttonObservation.buttonSeen != null) {
          intentButtonSeen.set(ev.intentId, terminal.buttonObservation.buttonSeen);
        }
      }
      intentInputReadback.set(ev.intentId, inputReadbackFromAction(actionByStep.get(ev.stepId)));
      intentReply.set(ev.intentId, undefined);
    }
  }

  const snapshot = forensicsSnapshot(runtime);
  return projectReplayAxes({
    caseId,
    records: snapshot.records,
    intentOrder,
    intentEvents,
    reprStepOf,
    actionByStep,
    pageErrors: snapshot.pageErrors,
    intentCount,
    expectedByIntent,
    globalAssertions,
    intentUrl,
    intentToasts,
    intentTextHits,
    intentButtonHits,
    intentButtonSeen,
    intentButtonDisabledHits,
    intentReply,
    intentInputReadback,
    chatCfg: null,
    allStepIds: new Set(events.map((e) => e.stepId)),
  });
}

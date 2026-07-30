// Deterministic replay event loop. Navigation is injected through the shared
// execution-target origin guard; this module never calls page.goto directly.

import { dispatchReplayAction, unknownAtomRejection } from '../replay-actions.mjs';
import { instantiate } from '../instantiate.mjs';
import { settleBeforeCapture } from '../replay-settle.mjs';
import { inputReadbackFromAction } from '../replay-assert.mjs';
import {
  installOutboundMutationGuard,
  evaluateDestructiveTargetAbsence,
} from '../entity-destructive-continuity-wiring.mjs';
import { requiresTargetContinuityRef } from '../entity-semantic-lock-preflight.mjs';
import {
  replayHistoryLine,
  replayPathOf,
  waitReplyStable,
} from './history.mjs';
import {
  captureIntentObservationBaseline,
  captureIntentObservationTerminal,
} from './intent-observation.mjs';
import {
  ReplayNavigationAbort,
  requireReplayNavigation,
  requireReplayPageOrigin,
} from './navigation.mjs';

const SAFE_DIAGNOSTICS = new Set([
  'BROWSER_LAUNCH_FAILED',
  'NAVIGATION_FAILED',
  'NAVIGATION_ORIGIN_MISMATCH',
  'EXECUTION_TARGET_AUTHORITY_INVALID',
  'MUTATION_URL_PATTERN_REQUIRED',
  'OUTBOUND_GUARD_INSTALL_FAILED',
  'Error',
  'TypeError',
  'TimeoutError',
  'ReplayNavigationAbort',
]);

export function projectReplayDiagnostic(error) {
  for (const candidate of [error?.reason, error?.name]) {
    if (SAFE_DIAGNOSTICS.has(candidate)) return candidate;
  }
  return 'REPLAY_INTERNAL_ERROR';
}

export async function runReplayEvents({
  page,
  execution,
  args,
  events,
  intentEvents,
  reprStepOf,
  profile,
  ctx,
  forensics,
  state,
  guardAborts,
  expectedByIntent,
  globalAssertions,
  countSelector,
  buttons,
  caseId,
  videoStartedAt,
  log,
  debug = false,
  dispatchAction = dispatchReplayAction,
  captureInputReadback = ({
    intentInputReadback,
    intentId,
    actionAxis,
  }) => {
    intentInputReadback.set(intentId, inputReadbackFromAction(actionAxis));
  },
}) {
  const actionByStep = new Map();
  const intentUrl = new Map();
  const intentCount = new Map();
  const intentToasts = new Map();
  const intentTextHits = new Map();
  const intentButtonHits = new Map();
  const intentButtonSeen = new Map();
  const intentButtonDisabledHits = new Map();
  const intentInputReadback = new Map();
  const intentTargetAbsence = new Map();
  const historyEnabled = !!(args.runHistory || args.runMetrics);
  const historyLines = [];
  let quietWaitMs = 0;
  const videoSteps = [];
  const chat = profile.chat && typeof profile.chat === 'object' ? profile.chat : null;
  const replySelector = (chat && chat.replySelector) || '.hr-chat__text__assistant';
  const intentReply = new Map();
  const intentReplyBase = new Map();

  try {
    for (const event of events) {
      const isFirst = intentEvents.get(event.intentId)[0].stepId === event.stepId;
      const isLast = reprStepOf.get(event.intentId) === event.stepId;
      log(`event ${event.stepId} ${event.action} intent=${event.intentId}`);
      state.currentStepId = null;
      const eventStartedAt = Date.now();
      let representativeSettled = false;
      if (args.videoDir) {
        videoSteps.push({
          stepId: event.stepId,
          videoAt: Math.max(0, eventStartedAt - videoStartedAt),
        });
      }

      const atomRejection = unknownAtomRejection(event);
      let navigationOk = true;
      let navigationError = null;
      if (event.action !== 'nav') {
        // 先于任何 DOM 观察核对当前页；pre.path 缺失或同 pathname 也不能绕过。
        await requireReplayPageOrigin({ page, execution });
      }
      if (!atomRejection) {
        try {
          if (event.action === 'nav') {
            state.currentStepId = event.stepId;
            if (typeof event.url !== 'string' || !event.url) {
              throw new TypeError('nav event target missing');
            }
            await requireReplayNavigation({
              page,
              execution,
              target: instantiate(event.url, ctx),
              gotoOptions: { waitUntil: 'load' },
            });
          } else {
            const wantedPath = event.pre && event.pre.path;
            if (wantedPath && replayPathOf(page.url()) !== wantedPath) {
              const restoreStartedAt = Date.now();
              try {
                await requireReplayNavigation({
                  page,
                  execution,
                  target: wantedPath,
                  gotoOptions: { waitUntil: 'load' },
                });
              } finally {
                quietWaitMs += Date.now() - restoreStartedAt;
              }
            }
          }
        } catch (error) {
          if (error instanceof ReplayNavigationAbort) throw error;
          navigationOk = false;
          navigationError = error;
        }
      }

      if (isFirst) {
        // 共用观察原语：formal runner 与 raw observer 调用同一实现，不各写一份。
        const baseline = await captureIntentObservationBaseline({
          page, countSelector, chat, replySelector,
        });
        intentCount.set(event.intentId, { before: baseline.count, after: null });
        if (chat) intentReplyBase.set(event.intentId, baseline.replyBaseline);
      }

      if (atomRejection) {
        actionByStep.set(event.stepId, atomRejection);
        state.currentStepId = null;
      } else if (event.action === 'nav') {
        actionByStep.set(event.stepId, navigationOk
          ? { resolution: 'unique', identityReadback: { ok: true } }
          : { resolution: 'action_failed', identityReadback: { ok: false } });
        state.currentStepId = null;
      } else {
        // pathname 相同不代表仍在同一站点。任何定位、route 安装或动作之前先核对
        // browser-visible origin；异步准备完成后在真正 dispatch 前再核一次。
        await requireReplayPageOrigin({ page, execution });
        state.currentStepId = event.stepId;
        if (ctx.identityLedger
          && event.atom === 'agent.searchOpen'
          && event.action === 'fill'
          && !ctx.identityTokens.has(event.intentId)) {
          const expectedQuery = event.value == null ? null : instantiate(event.value, ctx);
          ctx.identityTokens.set(
            event.intentId,
            ctx.identityLedger.arm({ intentId: event.intentId, expectedQuery }),
          );
        }

        let guardReady = null;
        let guardTeardown = null;
        let guardInstallFailed = false;
        let lastGuardAbortUrl = null;
        if (event.action === 'click'
          && requiresTargetContinuityRef(event.atom)
          && ctx.destructiveContinuityByStep) {
          const resolved = ctx.destructiveContinuityByStep.get(event.stepId);
          if (resolved && typeof resolved.platformId === 'string' && resolved.platformId) {
            const installed = installOutboundMutationGuard(page, {
              atom: event.atom,
              ref: { platformId: resolved.platformId },
              urlPattern: profile.mutationUrlPattern,
              requirePattern: true,
              onAbort: (url) => {
                lastGuardAbortUrl = url;
              },
              onDecision: (decision) => {
                if (!decision.ok) {
                  guardAborts.push({
                    attributedStepId: event.stepId,
                    atom: event.atom,
                    reason: decision.reason,
                    abortedRequestUrl: lastGuardAbortUrl,
                  });
                }
              },
            });
            if (installed && installed.installed === false) {
              guardInstallFailed = true;
              log(`C3 guard install failed (${projectReplayDiagnostic({
                reason: installed.reason,
              })})`);
            } else {
              guardReady = installed?.ready || null;
              if (guardReady) await guardReady;
              guardTeardown = typeof installed?.unroute === 'function'
                ? installed.unroute
                : null;
            }
          }
        }

        let axis = null;
        try {
          if (guardInstallFailed) {
            axis = {
              resolution: 'action_failed',
              identityReadback: { ok: false },
            };
            actionByStep.set(event.stepId, axis);
          } else {
            await requireReplayPageOrigin({ page, execution });
            const responseWait = event.action === 'click'
              ? page.waitForResponse(
                (response) => /saveOrModifyProcessData|streamReply/.test(response.url()),
                { timeout: 600 },
              ).catch(() => null)
              : Promise.resolve(null);
            axis = await dispatchAction(page, event, ctx);
            actionByStep.set(event.stepId, axis || { resolution: 'none' });
            const settleStartedAt = Date.now();
            await responseWait;
            if (event.action === 'click') {
              await new Promise((resolve) => setTimeout(resolve, 150));
            }
            const streamInScope = (url) => !(chat && chat.streamUrlPattern)
              || String(url).includes(chat.streamUrlPattern);
            const ownStreams = () => forensics.records().filter((record) =>
              record.type === 'EventSource'
              && record.firingStepId === event.stepId
              && streamInScope(record.url));
            if (ownStreams().length > 0) {
              log(`step stream open, waiting finished ${event.stepId}`);
              const streamStartedAt = Date.now();
              while (Date.now() - streamStartedAt < 30000
                && !ownStreams().every((record) => record.streamFinished === true)) {
                await new Promise((resolve) => setTimeout(resolve, 200));
              }
              if (chat) await waitReplyStable(page, replySelector);
            }
            quietWaitMs += Date.now() - settleStartedAt;
          }
          log(`acted ${event.stepId} resolution=${axis && axis.resolution}`);
          state.currentStepId = null;
        } finally {
          if (guardTeardown) {
            try {
              await guardTeardown();
            } catch (error) {
              log(`guard unroute best-effort: ${projectReplayDiagnostic(error)}`);
            }
          }
        }
      }

      if (isLast) {
        // 动作可触发异步导航；代表步采证前必须再次确认页面仍属同一 authority。
        await requireReplayPageOrigin({ page, execution });
        const settleFloor = Number(process.env.REPLAY_SETTLE_FLOOR_MS);
        const settleBudget = Number(process.env.REPLAY_SETTLE_BUDGET_MS);
        const settleStartedAt = Date.now();
        try {
          const result = await settleBeforeCapture(page, {
            inFlight: () => forensics.inFlightCount(),
            floorMs: Number.isFinite(settleFloor) && settleFloor >= 0
              ? settleFloor
              : undefined,
            budgetMs: Number.isFinite(settleBudget) && settleBudget > 0
              ? settleBudget
              : undefined,
            profile,
            log,
          });
          representativeSettled = result.settled;
          if (debug) {
            log(`settle intent=${event.intentId} waited=${result.waitedMs} settled=${result.settled}`);
          }
        } catch (error) {
          log(`settle helper error: ${projectReplayDiagnostic(error)}`);
        }
        quietWaitMs += Date.now() - settleStartedAt;

        // 静默等待本身也是异步漂移窗口；真正读取断言证据前再核一次。
        await requireReplayPageOrigin({ page, execution });
        const assertions = [
          ...(expectedByIntent.get(event.intentId) || []),
          ...globalAssertions,
        ];
        // 代表步取证同样只经共用观察原语：URL、行数、toast、文本命中、按钮态与 chat 回复。
        const terminal = await captureIntentObservationTerminal({
          page,
          countSelector,
          chat,
          replySelector,
          replyBaseline: intentReplyBase.get(event.intentId),
          assertions,
          buttons,
        });
        intentUrl.set(event.intentId, terminal.url);
        captureInputReadback({
          intentInputReadback,
          intentId: event.intentId,
          actionAxis: actionByStep.get(event.stepId),
        });
        const count = intentCount.get(event.intentId);
        if (count) count.after = terminal.count;
        if (requiresTargetContinuityRef(event.atom) && ctx.destructiveContinuityByStep) {
          const resolved = ctx.destructiveContinuityByStep.get(event.stepId);
          if (resolved && typeof resolved.platformId === 'string' && resolved.platformId) {
            intentTargetAbsence.set(event.intentId, evaluateDestructiveTargetAbsence({
              ref: { platformId: resolved.platformId },
              identityRows: ctx.identityPresentRows,
              stable: ctx.identityPresentStable === true,
            }));
          }
        }
        intentToasts.set(event.intentId, terminal.toasts);
        intentTextHits.set(event.intentId, terminal.textHits);
        if (terminal.buttonObservation) {
          intentButtonHits.set(event.intentId, terminal.buttonObservation.buttonHits);
          intentButtonDisabledHits.set(
            event.intentId,
            terminal.buttonObservation.buttonDisabledHits,
          );
          if (terminal.buttonObservation.buttonSeen != null) {
            intentButtonSeen.set(event.intentId, terminal.buttonObservation.buttonSeen);
          }
        }
        if (chat) intentReply.set(event.intentId, terminal.reply);
      }

      if (historyEnabled) {
        const line = replayHistoryLine(event, {
          navOk: navigationOk,
          navErr: navigationError,
          axis: event.action === 'nav' ? null : actionByStep.get(event.stepId),
          durationMs: Date.now() - eventStartedAt,
          caseId,
          isLast,
          settled: representativeSettled,
        });
        if (line) historyLines.push(line);
      }
    }
  } finally {
    log('loop done, settling streams + draining');
    await forensics.awaitStreamsSettled(2500);
    await forensics.drain();
    log('drained');
  }

  return {
    actionByStep,
    intentUrl,
    intentCount,
    intentToasts,
    intentTextHits,
    intentButtonHits,
    intentButtonSeen,
    intentButtonDisabledHits,
    intentInputReadback,
    intentTargetAbsence,
    intentReply,
    chatCfg: chat,
    historyEnabled,
    historyLines,
    quietWaitMs,
    videoSteps,
  };
}

// Replay artifact finalization. This module writes only after all deterministic
// gates pass and never prints raw adapter/browser errors.

import { writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { credentialGate } from '../cred-gate.mjs';
import { projectReplayAxes } from '../replay-axes.mjs';
import { partitionGuardAbortPageErrors } from '../entity-destructive-continuity.mjs';

export class ReplayFinalizeAbort extends Error {
  constructor(reason, exitCode = 1) {
    super(reason);
    this.name = 'ReplayFinalizeAbort';
    this.reason = reason;
    this.exitCode = exitCode;
  }
}

async function finalizeVideo({
  args,
  context,
  loginPage,
  page,
  sweepVideos,
}) {
  if (!args.videoDir) return false;
  const loginVideo = loginPage ? loginPage.video() : null;
  const replayVideo = page.video();
  try {
    await context.close();
  } catch {
    // Video is diagnostic-only; absence remains acceptable.
  }
  if (loginVideo) {
    let deleted = false;
    for (let attempt = 0; attempt < 2 && !deleted; attempt += 1) {
      try {
        await loginVideo.delete();
        deleted = true;
      } catch {
        // One bounded retry.
      }
    }
    if (!deleted) throw new ReplayFinalizeAbort('LOGIN_VIDEO_DELETE_FAILED');
  }
  let videoOk = false;
  try {
    const rawPath = replayVideo ? await replayVideo.path() : null;
    if (rawPath) {
      renameSync(rawPath, join(args.videoDir, 'video.webm'));
      videoOk = true;
    }
  } catch {
    videoOk = false;
  }
  if (!videoOk) sweepVideos();
  return videoOk;
}

function assertCredentialSafe(outputs, reason) {
  if (!credentialGate(outputs).ok) throw new ReplayFinalizeAbort(reason);
}

export async function finalizeReplayArtifacts({
  args,
  context,
  loginPage,
  page,
  sweepVideos,
  caseId,
  records,
  loginMark,
  intentOrder,
  intentEvents,
  reprStepOf,
  expectedByIntent,
  globalAssertions,
  allStepIds,
  pageErrors,
  guardAborts,
  evidence,
  videoStartedAt,
  runStartedAt,
  log,
}) {
  const videoOk = await finalizeVideo({
    args,
    context,
    loginPage,
    page,
    sweepVideos,
  });
  const allRecords = records.slice(loginMark);
  const partitioned = partitionGuardAbortPageErrors({ pageErrors, guardAborts });
  if (partitioned.excluded.length) {
    log(`guard-abort causal exclusion: ${partitioned.excluded.length}`);
  }
  const axesText = projectReplayAxes({
    caseId,
    records: allRecords,
    intentOrder,
    intentEvents,
    reprStepOf,
    actionByStep: evidence.actionByStep,
    pageErrors: partitioned.kept,
    intentCount: evidence.intentCount,
    expectedByIntent,
    globalAssertions,
    intentUrl: evidence.intentUrl,
    intentToasts: evidence.intentToasts,
    intentTextHits: evidence.intentTextHits,
    intentButtonHits: evidence.intentButtonHits,
    intentButtonSeen: evidence.intentButtonSeen,
    intentButtonDisabledHits: evidence.intentButtonDisabledHits,
    intentReply: evidence.intentReply,
    intentInputReadback: evidence.intentInputReadback,
    chatCfg: evidence.chatCfg,
    allStepIds,
  });
  assertCredentialSafe({ 'axes.json': axesText }, 'AXES_CREDENTIAL_GATE_REJECTED');
  writeFileSync(args.out, axesText, 'utf8');

  if (evidence.historyEnabled) {
    const denominator = evidence.historyLines.filter(
      (line) => line.locatorResolution !== null,
    );
    const metrics = {
      schemaVersion: 1,
      caseId,
      runId: args.runId || null,
      totalSteps: evidence.historyLines.length,
      passedActions: evidence.historyLines.filter((line) => line.result === 'ok').length,
      locatorHitRate: denominator.length
        ? denominator.filter((line) => line.locatorResolution === 'unique').length
          / denominator.length
        : null,
      quietPointWaitMs: Math.max(0, Math.round(evidence.quietWaitMs)),
      totalDurationMs: Date.now() - runStartedAt,
    };
    const outputs = {};
    if (args.runHistory) {
      outputs['run-history.jsonl'] = evidence.historyLines.length
        ? `${evidence.historyLines.map((line) => JSON.stringify(line)).join('\n')}\n`
        : '';
    }
    if (args.runMetrics) {
      outputs['run-metrics.json'] = `${JSON.stringify(metrics, null, 2)}\n`;
    }
    assertCredentialSafe(outputs, 'DIAGNOSTIC_CREDENTIAL_GATE_REJECTED');
    if (args.runHistory) {
      writeFileSync(args.runHistory, outputs['run-history.jsonl'], 'utf8');
    }
    if (args.runMetrics) {
      writeFileSync(args.runMetrics, outputs['run-metrics.json'], 'utf8');
    }
  }

  if (args.videoDir && videoOk) {
    const videoText = `${JSON.stringify({
      schemaVersion: 1,
      file: 'video.webm',
      startedAt: videoStartedAt,
      steps: evidence.videoSteps,
    }, null, 2)}\n`;
    if (!videoText.includes('://')) {
      assertCredentialSafe({ 'video.json': videoText }, 'VIDEO_CREDENTIAL_GATE_REJECTED');
      writeFileSync(join(args.videoDir, 'video.json'), videoText, 'utf8');
    }
  }
  return { videoOk };
}

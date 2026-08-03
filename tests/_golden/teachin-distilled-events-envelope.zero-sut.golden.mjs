#!/usr/bin/env node
// Distilled authoring candidate 必须把 compiler event 数组包成 formal events document，
// canonical entity verifier 与 pair sealer 必须消费同一枚 exact envelope bytes。
// 纯内存 authority/runtime doubles；零 SUT/browser/network/credentials/LLM。

import { createHash } from 'node:crypto';
import {
  api,
  assert,
  buildHappy,
  cycleApi,
  expectOk,
  owners,
  ready,
  loadFailure,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-distilled-events-envelope';
const EMPTY_LOCK_SET_SHA256 = `sha256:${createHash('sha256').update('[]').digest('hex')}`;
const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function formalNavEvent() {
  return {
    intentId: 'intent_1',
    atom: 'nav.workflowManagement',
    action: 'nav',
    url: '{{baseUrl}}/ai-manager/process/list',
  };
}

function makeAuthoringAdapter(tag, observeEntityInput) {
  return cycleApi.createRuntimeCycleAdapter({
    ...(typeof observeEntityInput === 'function' ? {
      verifyRuntimeEntityLock(input) {
        observeEntityInput(input);
        return {
          ok: true,
          handle: Object.freeze(Object.create(null)),
          mode: 'not-required',
          runtimeAuthorized: false,
          setSha256: EMPTY_LOCK_SET_SHA256,
        };
      },
    } : {}),
    verifyAuthoringReset() {
      return { ok: true };
    },
    createCompileRun(input) {
      return { ...input, compileRun: true };
    },
    async compileFlow(run) {
      assert(run?.compileRun === true, 'compileFlow 必须收到 createCompileRun 结果');
      return { ok: true, events: [formalNavEvent()] };
    },
    async closeRuntimeOwners({ browser, context }) {
      await context.close();
      await browser.close();
      return { ok: true };
    },
    async openFreshAuthoringRuntime() {
      const runtime = owners(`authoring-envelope-${tag}`);
      return {
        ok: true,
        replayBrowser: runtime.browser,
        replayContext: runtime.context,
        replayPage: runtime.page,
        topologyAuthority: Object.freeze(Object.create(null)),
      };
    },
  });
}

async function prepareAuthoring(tag, observeEntityInput) {
  const built = await buildHappy(tag, { stopAfterSource: true });
  const sourceClosed = expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
  }), 'source close before authoring');
  const adapter = makeAuthoringAdapter(tag, observeEntityInput);
  const sealed = await adapter.runAndSealDistilledCandidate({
    atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
    sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
    authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
    runNamespace: `run_authoring_${tag}`,
    executionTargetAuthority: built.execution.authority,
  });
  return { adapter, built, sealed };
}

if (!ready) failures.push(`production API unavailable: ${loadFailure || 'FROZEN_API_MISSING'}`);

if (ready) {
  await check('E1 canonical entity verifier 必须收到可准入的 formal events document', async () => {
    const { sealed } = await prepareAuthoring('events_envelope_canonical');
    expectOk(sealed, 'canonical formal events envelope');
  });

  await check('E2 pair seal 必须绑定 verifier 所见 exact envelope bytes，而非裸 event 数组', async () => {
    let observedBytes = null;
    let observedDocument = null;
    const { built, sealed } = await prepareAuthoring('events_envelope_exact', ({
      caseId, eventsBytes, verificationScopeAuthority,
    }) => {
      assert(caseId === 'tc_events_envelope_exact', `verifier caseId 错：${caseId}`);
      assert(Buffer.isBuffer(eventsBytes) && eventsBytes.length > 0,
        'verifier 必须收到非空 Buffer eventsBytes');
      assert(verificationScopeAuthority && typeof verificationScopeAuthority === 'object',
        'verifier 必须收到 genuine authoring closure scope');
      observedBytes = Buffer.from(eventsBytes);
      observedDocument = JSON.parse(eventsBytes.toString('utf8'));
      assert(observedDocument && typeof observedDocument === 'object'
        && !Array.isArray(observedDocument),
      'eventsBytes 顶层必须是 formal document，禁止裸数组');
      assert(observedDocument.caseId === caseId, 'formal document.caseId 必须与 verifier caseId 一致');
      assert(Array.isArray(observedDocument.events) && observedDocument.events.length === 1,
        'formal document.events 必须保留 exact compiled event 序列');
      assert(observedDocument.url === formalNavEvent().url,
        'formal document.url 必须绑定 compiler-authored 首个 nav 目标');
      assert(JSON.stringify(observedDocument.events[0])
        === JSON.stringify({ ...formalNavEvent(), stepId: 'synthcompiled_1' }),
      `formal document.events 漂移：${JSON.stringify(observedDocument.events)}`);
    });
    expectOk(sealed, 'observed formal events envelope');
    assert(observedBytes && observedDocument, 'entity verifier 未观察到 formal envelope bytes');

    const finalized = expectOk(api.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: built.sourcePlan.authority,
      sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
      distilledCandidateAuthority: sealed.distilledCandidateAuthority,
    }), 'pair finalization with exact envelope');
    assert(finalized.receipt?.distilledEventsSha256 === sha256(observedBytes),
      `pair seal 未绑定 verifier 所见 exact envelope bytes：${JSON.stringify(finalized.receipt)}`);
    assert(finalized.receipt.distilledEventsSha256 !== sha256(Buffer.from(
      JSON.stringify(observedDocument.events), 'utf8',
    )), 'pair seal 禁止退化为裸 event 数组 digest');
  });
}

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);

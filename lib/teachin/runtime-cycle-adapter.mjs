// canonical 静态装配：把三段 runtime 的 open/claim/close ratchet、逐 event observation、
// resolved axes/frozen verdict、独立 authoring compile 与 entity 授权接到各自专用 seam。
// 本模块不写 browser、observation、compile 或 axes 逻辑，也不裁定；对外只给薄 issuer 与 authority。

import {
  runObservedRawReplay, consumeRawObservationAuthority,
  inspectRawEventObservationAuthority,
} from './raw-event-observation.mjs';
// axes/verdict 两个 role 接缝都由 raw-axes-adapter 静态绑定现役 projector 与 verdict-cli-adapter。
import { createRawAxesAdapter, createRoleAxesSeam } from './raw-axes-adapter.mjs';
import { createCompileRuntimeAdapter } from './compile-runtime-adapter.mjs';
// frozen verdict 只有唯一 child-process 边界：composer 在此静态绑定该 canonical 桥。
import { canonicalVerdictCliAdapter } from './verdict-cli-adapter.mjs';
import { canonicalRuntimeBootstrap } from './runtime-bootstrap.mjs';
import { createFreshReplayWitness, authorizeFreshReplayRuntime } from './fresh-runtime.mjs';
import { canonicalRawPlaywrightDriver } from './raw-playwright-driver.mjs';
import { runRawReplay as canonicalRunRawReplay } from './raw-replay-runner.mjs';
import { canonicalEntityLockVerifier, createEntityLockVerifier } from './entity-lock-verifier.mjs';
import { createPreparedRun } from '../replay/prepared-run.mjs';
// formal claim/preflight 与 live reset 的 canonical 生产实现在此静态绑定：不许依赖空 deps 走空心接缝。
import {
  inspectClaimedReplayRuntime, runCanonicalPreflight, stageClaimedReplayExecution,
} from './prepared-runtime-seam.mjs';
import {
  canonicalRuntimeResetIssuer,
  observeRuntimeBaselineProjection,
  observeRuntimeResetBaseline,
} from './runtime-reset.mjs';
import {
  openRunExecution, consumeResolvedProjectionAuthority, consumeAuthoringBaselineGrant,
  inspectResolvedProjectionAuthority,
} from '../dual-replay/replay-completion.mjs';
import { sealDistilledCandidateAuthority } from '../dual-replay/pair-authority.mjs';
import { frozen, denied } from '../dual-replay/source-plan-authority.mjs';
import {
  readRuntimeOwner, createAuthoringRuntimeSeam,
  sealPreparedSourceRuntime, claimSourceRuntimePreparation, disposeSourceRuntimePreparation,
  closeRoleRuntimeOwners, defaultCloseRuntimeOwners,
  closeLiveRuntime, projectTopologyAuthority,
} from './runtime-owner.mjs';
import { prepareOwnedDistilledRuntime } from './distilled-runtime-preparation.mjs';

const OWNERSHIP_MISMATCH = 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH';
const TARGET_INVALID = 'EXECUTION_TARGET_AUTHORITY_INVALID';
const PREPARE_FAILED = 'SOURCE_RUNTIME_PREPARATION_FAILED';

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 注入的接缝只替换「判定」；缺席时走 canonical verifier。两条路径都不收 caller 的
// mode/handle/digest，handle 也只由 verifier 模块铸造。
function seamOrCanonical(verifier, { authority, caseId, eventsBytes, authoringClosureAuthority }) {
  const scope = { caseId, eventsBytes };
  const input = authority === undefined ? scope : { authority, ...scope };
  if (verifier) {
    return verifier.verify({ ...input, verificationScopeAuthority: authoringClosureAuthority });
  }
  return canonicalEntityLockVerifier.verify({
    ...input, verificationScopeAuthority: authoringClosureAuthority,
  });
}

// source 段第一步：先对同进程 live recording Browser/Context 装 witness，再关闭它们，
// 并以对象状态复核「真的关掉了」；关不掉就没有 fresh 见证，后续一步都不许发生。
async function witnessClosedRecording(closeRecording, { recordingBrowser, recordingContext }) {
  const witnessed = createFreshReplayWitness({ recordingBrowser, recordingContext });
  if (witnessed.ok !== true) return null;
  const closed = await closeLiveRuntime(closeRecording, {
    browser: recordingBrowser, context: recordingContext,
  });
  return closed ? witnessed.witness : null;
}

// 缺省 recording 关闭接缝：同进程 Context 先关、Browser 后断；「关掉了没有」不由调用成功决定。
async function closeRecordingRuntime({ browser: recordingBrowser, context: recordingContext }) {
  await recordingContext.close();
  await recordingBrowser.close();
  return { ok: true };
}

// 三段 runtime 的 canonical 物理 open 全部经跨平台 bootstrap，输入 exact {role,target}。
const canonicalRoleOpen = (role) => ({ executionTargetAuthority }) =>
  canonicalRuntimeBootstrap.openRuntime({ role, executionTargetAuthority });
const canonicalSourceOpen = ({ executionTargetAuthority }) =>
  canonicalRuntimeBootstrap.openRuntime({ role: 'source', executionTargetAuthority });

// 新开且已登录的 runtime 在交权前观察一次 canonical reset baseline 并记账，供 createResetAuthority
// 闭合成 exact reset receipt；观察不到即 fail-closed。注入 verifyReset 替身时零物理观察。
function resetBaselineObserver(injectedVerifyReset) {
  if (typeof injectedVerifyReset === 'function') return async () => true;
  return (role, runNamespace, executionTargetAuthority, topologyAuthority) =>
    observeRuntimeResetBaseline({ role, runNamespace, executionTargetAuthority, topologyAuthority });
}

// 新开 runtime 的对象身份必须与 witness 对上，才铸一次性 fresh authority。
function authorizeSourceFreshRuntime(witness, runtime, topologyAuthority) {
  return authorizeFreshReplayRuntime({
    witness, topologyAuthority,
    replayBrowser: runtime.browser, replayContext: runtime.context, replayPage: runtime.page,
  });
}

export function createRuntimeCycleAdapter(deps = {}) {
  // adapter 实例身份：preparation cap 只在铸它的 adapter 内可 claim/dispose，跨实例一律拒。
  const adapterIdentity = frozen(Object.create(null));
  // 注入接缝缺席即走 canonical：装配只做「有则用、无则 canonical」，不做别的判断。
  const seam = (injected, canonical) => (typeof injected === 'function' ? injected : canonical);
  const runtimeBootstrap = isRecord(deps.runtimeBootstrap) ? deps.runtimeBootstrap
    : frozen({ openRuntime: canonicalSourceOpen });
  const runRawReplay = seam(deps.runRawReplay, canonicalRunRawReplay);
  const closeRuntimeOwners = seam(deps.closeRuntimeOwners, defaultCloseRuntimeOwners);
  const closeRecording = seam(deps.closeRuntimeOwners, closeRecordingRuntime);
  const openAuthoring = seam(deps.openFreshAuthoringRuntime, canonicalRoleOpen('authoring'));
  const openDistilled = seam(deps.openFreshReplayRuntime, canonicalRoleOpen('distilled'));
  const injectedEntityVerifier = typeof deps.verifyRuntimeEntityLock === 'function'
    ? createEntityLockVerifier({ verifyRuntimeEntityLock: deps.verifyRuntimeEntityLock }) : null;
  const verifyEntity = (input) => seamOrCanonical(injectedEntityVerifier, input);
  const verifyResetFacts = seam(deps.verifyReset, canonicalRuntimeResetIssuer.verifyReset);
  const observeReset = resetBaselineObserver(deps.verifyReset);
  const verifyAuthoringReset = seam(
    deps.verifyAuthoringReset,
    (input) => observeRuntimeBaselineProjection(input),
  );
  const roleAxes = (role) => createRoleAxesSeam({ role, projectAxes: deps.projectAxes, runVerdict: deps.runVerdict });
  const sourceAxes = roleAxes('source');
  const distilledAxes = roleAxes('distilled');
  // 裁判入口恒为 canonical frozen 桥；只有 zero-SUT 装配注入 runVerdict 时才改走 role 接缝替身。
  const verdictAdapter = typeof deps.runVerdict === 'function'
    ? sourceAxes.verdictAdapter
    : frozen({ runFrozenVerdict: (input) => canonicalVerdictCliAdapter.runFrozenVerdict(input) });
  // 两枚 inspect 接缝给 axes 做双消费前的非消费式绑定预检：探针/错绑不得烧掉 genuine authority。
  const rawAxes = createRawAxesAdapter({
    consumeRawObservationAuthority,
    consumeResolvedProjectionAuthority,
    inspectRawObservationAuthority: inspectRawEventObservationAuthority,
    inspectResolvedProjectionAuthority,
    projectReplayAxes: sourceAxes.projectReplayAxes,
    verdictAdapter,
  });
  const preparedRun = createPreparedRun({
    inspectClaimedReplayRuntime: seam(deps.inspectClaimedReplayRuntime, inspectClaimedReplayRuntime),
    runCanonicalPreflight: seam(deps.runCanonicalPreflight, runCanonicalPreflight),
  });
  // 已归属 runtime 内的 formal replay：缺省走现役 prepared runner，注入接缝时由接缝执行。
  const runFormalReplay = seam(deps.runCompiledReplay, (input) => preparedRun.runPreparedReplay(input));
  const compileRuntime = createCompileRuntimeAdapter({
    runAtomRoundtrip: deps.runAtomRoundtrip,
    createCompileRun: deps.createCompileRun,
    compileFlow: deps.compileFlow,
    ...createAuthoringRuntimeSeam({
      openAuthoring, closeRuntimeOwners, consumeAuthoringBaselineGrant,
      verifyAuthoringReset,
      executeAuthoringPreconditions: deps.executeAuthoringPreconditions,
    }),
  });

  // ── 三段 runtime 的 open/close ratchet ──
  async function prepareSourceReplayRuntime({
    executionTargetAuthority, recordingBrowser, recordingContext, runNamespace,
  }) {
    if (!isRecord(executionTargetAuthority) || typeof runNamespace !== 'string') return denied(OWNERSHIP_MISMATCH);
    const witness = await witnessClosedRecording(closeRecording, { recordingBrowser, recordingContext });
    if (!witness) return denied(PREPARE_FAILED);
    let runtime = null;
    let transferred = false;
    try {
      const opened = await runtimeBootstrap.openRuntime({ role: 'source', executionTargetAuthority });
      runtime = opened?.ok === true && isRecord(opened.runtime) ? opened.runtime : null;
      if (!runtime?.browser || !runtime.context || !runtime.page) return denied(PREPARE_FAILED);
      const topology = projectTopologyAuthority(runtime.topology);
      const fresh = authorizeSourceFreshRuntime(witness, runtime, topology);
      if (fresh.ok !== true) return denied(fresh.reason || PREPARE_FAILED);
      if (await observeReset('source', runNamespace, executionTargetAuthority, topology) !== true) {
        return denied(PREPARE_FAILED);
      }
      const sealed = sealPreparedSourceRuntime({
        freshRuntimeAuthority: fresh.freshRuntimeAuthority, topologyAuthority: topology,
        runtime, runNamespace, executionTargetAuthority, adapterIdentity,
      });
      transferred = sealed?.ok === true;
      return transferred ? sealed : denied(PREPARE_FAILED);
    } finally {
      if (runtime && !transferred) await closeLiveRuntime(closeRuntimeOwners, runtime);
    }
  }

  function claimPreparedSourceReplayRuntime({
    sourceRuntimePreparationAuthority, sourcePlanAuthority, runNamespace, executionTargetAuthority,
  }) {
    if (!isRecord(sourcePlanAuthority)) return denied(OWNERSHIP_MISMATCH);
    return claimSourceRuntimePreparation({
      sourceRuntimePreparationAuthority, runNamespace, executionTargetAuthority, adapterIdentity,
    }) || denied(OWNERSHIP_MISMATCH);
  }

  async function disposePreparedSourceReplayRuntime({ sourceRuntimePreparationAuthority }) {
    const disposed = await disposeSourceRuntimePreparation({
      sourceRuntimePreparationAuthority, closeRuntimeOwners, adapterIdentity,
    });
    if (disposed === null) return denied(OWNERSHIP_MISMATCH);
    return disposed ? frozen({ ok: true }) : denied('SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED');
  }

  function closeReplayRuntimeOwners({ runtimeOwnerAuthority }) {
    return closeRoleRuntimeOwners({ runtimeOwnerAuthority, closeRuntimeOwners });
  }

  // ── 独立 authoring compile + entity 授权 + candidate 铸造 ───────────────────
  async function runAndSealDistilledCandidate({
    atomRoundtripGrant, sourceClosureAuthority, authoringBaselineGrant,
    runNamespace, entityLockAuthority, executionTargetAuthority,
  }) {
    const compiled = await compileRuntime.compileAuthoringCandidate({
      atomRoundtripGrant, authoringBaselineGrant, sourceClosureAuthority,
      runNamespace, executionTargetAuthority,
    });
    if (compiled?.ok !== true) return denied(compiled?.reason || 'AUTHORING_COMPILE_FAILED');
    const { authoringClosureAuthority, candidate } = compiled;
    const caseId = candidate?.candidateTestCase?.caseId;
    const candidateBytes = Buffer.from(JSON.stringify(candidate.candidateTestCase), 'utf8');
    const eventsBytes = Buffer.from(JSON.stringify(candidate.eventsCandidate), 'utf8');
    const verified = await verifyEntity({
      authority: entityLockAuthority, caseId, eventsBytes,
      verificationScopeAuthority: authoringClosureAuthority, authoringClosureAuthority,
    });
    if (verified?.ok !== true) return denied(verified?.reason || 'ENTITY_LOCK_AUTHORITY_INVALID');
    const admitted = verified.mode === 'not-required'
      || (verified.mode === 'runtime-required' && verified.runtimeAuthorized === true);
    if (!admitted) return denied('ENTITY_LOCK_RUNTIME_UNAUTHORIZED');
    const roundtripCandidate = { caseId, candidateBytes, eventsBytes };
    const sealed = sealDistilledCandidateAuthority({
      roundtripCandidate, authoringClosureAuthority,
      verifiedEntityLockHandle: verified.handle,
      verifiedEntityLockSetSha256: verified.setSha256, executionTargetAuthority,
    });
    if (sealed?.ok !== true) return denied(sealed?.reason || 'DISTILLED_CANDIDATE_SEAL_INVALID');
    return frozen({
      ok: true, authoringClosureAuthority,
      distilledCandidateAuthority: sealed.distilledCandidateAuthority,
    });
  }

  async function prepareDistilledReplayRuntime({
    authoringClosureAuthority, pairAuthority, runNamespace, executionTargetAuthority,
  }) {
    return prepareOwnedDistilledRuntime({
      authoringClosureAuthority, pairAuthority, runNamespace, executionTargetAuthority,
      openDistilled, observeReset, closeRuntimeOwners,
    });
  }

  // ── 两次 evidence replay 的薄 issuer ───────────────────────────────────────
  return frozen({
    // reset 事实只能来自 canonical live reset issuer；zero-SUT 装配注入 verifyReset 时才改走替身。
    resetIssuer: frozen({ verifyReset: (input) => verifyResetFacts(input) }),
    rawReplayIssuer: frozen({
      async executeAndVerify({ runExecutionAuthority }) {
        const execution = openRunExecution(runExecutionAuthority);
        if (!execution) return denied('RUN_COMPLETION_INVALID');
        const owner = readRuntimeOwner(execution.runtimeOwnerAuthority);
        if (!owner) return denied(OWNERSHIP_MISMATCH);
        return runObservedRawReplay({
          execution: { ...execution, runExecutionAuthority }, owner, runRawReplay,
          actionDriver: canonicalRawPlaywrightDriver,
        });
      },
    }),
    // source 语义只能来自 resolved 之后的 canonical axes 接缝；evidence 由 axes 产物确定性导出。
    resolvedSourceIssuer: frozen({
      async projectAndVerify(input) {
        const result = await rawAxes.projectAndVerify(input);
        if (result?.ok !== true) return result;
        return frozen({ ...result, evidence: sourceAxes.evidenceOf(result.axesBytes, result.evidence) });
      },
    }),
    atomReplayIssuer: frozen({
      async executeAndVerify({ runExecutionAuthority }) {
        const execution = openRunExecution(runExecutionAuthority);
        if (!execution) return denied('RUN_COMPLETION_INVALID');
        // canonical prepared runner 只经本次开箱的 exact execution 取事实，无第二条入口。
        // stage 失败（同一 authority 重复 stage 或形状不合）即归属失守，零动作退出。
        if (stageClaimedReplayExecution({ runExecutionAuthority, execution }) !== true) {
          return denied(OWNERSHIP_MISMATCH);
        }
        return distilledAxes.sealFormalRun({ runExecutionAuthority, execution, runFormalReplay });
      },
    }),
    prepareSourceReplayRuntime,
    claimPreparedSourceReplayRuntime,
    disposePreparedSourceReplayRuntime,
    closeReplayRuntimeOwners,
    runAndSealDistilledCandidate,
    prepareDistilledReplayRuntime,
  });
}

export const canonicalRuntimeCycleAdapter = createRuntimeCycleAdapter({});

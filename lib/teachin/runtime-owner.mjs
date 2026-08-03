// source/authoring/distilled 三段 runtime 的归属与关闭 ratchet。
// 私有 WeakMap 绑定 Browser/Context/Page/topology/target；对外只给 opaque preparation/owner/closure
// capability，绝不暴露 runtime 对象、地址或会话值。关闭必须观察到 exact Context closed 与 Browser
// disconnected，且每个 owner 只能被关闭一次；关掉无关 runtime 不能冒充本 owner 的关闭。

import { createFreshReplayWitness, authorizeFreshReplayRuntime } from './fresh-runtime.mjs';
import { readSourcePlan } from '../dual-replay/source-plan-authority.mjs';
import { parseAuthoringChannelProfileBytes } from './channel-profile.mjs';

const PREPARATION_STATE = new WeakMap();
const OWNER_STATE = new WeakMap();
const SOURCE_CLOSURE_STATE = new WeakMap();
const AUTHORING_CLOSURE_STATE = new WeakMap();

function frozen(value) {
  return Object.freeze(value);
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// topology authority 由本模块铸造：把现役 controller 能力原样转交，活动页只认 controller 的授权。
// 现役 controller 无 active 时返回 null（controller.mjs），此处一律照转 null——绝不回退到装配时的
// 裸 Playwright Page：拿到 topology 投影的一方因此永远拿不到能 goto/evaluate 的原始页面对象。
// 调用方（raw driver / runner）对 null 首错停。
export function projectTopologyAuthority(topology) {
  const controller = isRecord(topology) ? topology : null;
  const projected = Object.create(null);
  for (const name of [
    'captureHandoffBoundary', 'performClick', 'evaluateActive', 'consumeNewPageEvent',
  ]) {
    if (typeof controller?.[name] === 'function') {
      projected[name] = (options) => controller[name](options);
    }
  }
  projected.activePageAuthority = () => {
    if (typeof controller?.activePageAuthority !== 'function') return null;
    return controller.activePageAuthority() || null;
  };
  return frozen(projected);
}

export function sealRuntimeOwner({
  role, runtime, topologyAuthority, runNamespace, executionTargetAuthority,
}) {
  if (!isRecord(runtime) || !runtime.browser || !runtime.context || !runtime.page) return null;
  const runtimeOwnerAuthority = frozen(Object.create(null));
  OWNER_STATE.set(runtimeOwnerAuthority, {
    role,
    browser: runtime.browser,
    context: runtime.context,
    page: runtime.page,
    forensics: runtime.forensics || null,
    state: runtime.state || { currentStepId: null },
    pageErrors: Array.isArray(runtime.pageErrors) ? runtime.pageErrors : [],
    originAdmission: runtime.originAdmission || null,
    topologyAuthority,
    runNamespace,
    executionTargetAuthority,
    closed: false,
  });
  return runtimeOwnerAuthority;
}

export function readRuntimeOwner(runtimeOwnerAuthority) {
  if (!isRecord(runtimeOwnerAuthority)) return null;
  const record = OWNER_STATE.get(runtimeOwnerAuthority);
  return record && !record.closed ? record : null;
}

export function markRuntimeOwnerClosed(runtimeOwnerAuthority) {
  const record = readRuntimeOwner(runtimeOwnerAuthority);
  if (!record) return null;
  record.closed = true;
  return record;
}

// 关闭事实只认对象状态：Context 已关且 Browser 已断连才算关闭，崩溃后已达该状态同样成立。
export function observeRuntimeClosed(record) {
  try {
    if (typeof record.browser.isConnected === 'function'
      && record.browser.isConnected() === true) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

// 关闭活的 Browser/Context：先交注入的 close 接缝，再以对象状态复核，绝不以调用成功冒充关闭。
export async function closeLiveRuntime(closeRuntimeOwners, record) {
  // Browser 已由用户关闭/崩溃时，状态事实已经成立；不要再调用幂等性不受本模块
  // 保证的 close 接缝。fresh 资格仍由预装 lifecycle witness 独立复核。
  if (observeRuntimeClosed(record)) return true;
  try {
    await closeRuntimeOwners({ browser: record.browser, context: record.context });
  } catch {
    return false;
  }
  return observeRuntimeClosed(record);
}

// 后继 runtime 的 fresh 见证只能来自前一段 runtime 关闭前安装的真实事件监听。
export async function openOwnedRuntime({
  open, role, executionTargetAuthority, runNamespace, witness,
}) {
  const opened = await open({ role, executionTargetAuthority, runNamespace });
  if (opened?.ok !== true) return null;
  const runtime = isRecord(opened.runtime)
    ? opened.runtime
    : {
      browser: opened.replayBrowser,
      context: opened.replayContext,
      page: opened.replayPage,
      topology: opened.topologyAuthority,
    };
  if (!runtime.browser || !runtime.context || !runtime.page) return null;
  const topologyAuthority = projectTopologyAuthority(runtime.topology);
  const fresh = authorizeFreshReplayRuntime({
    witness,
    replayBrowser: runtime.browser,
    replayContext: runtime.context,
    replayPage: runtime.page,
    topologyAuthority,
  });
  return { runtime, topologyAuthority, fresh, role, runNamespace };
}

// exact owner 关闭恰一次：关闭前先装下一段 runtime 的 fresh 见证监听。
export async function closeOwnedRuntime({ runtimeOwnerAuthority, closeRuntimeOwners }) {
  const owner = readRuntimeOwner(runtimeOwnerAuthority);
  if (!owner) return null;
  markRuntimeOwnerClosed(runtimeOwnerAuthority);
  const witnessed = createFreshReplayWitness({
    recordingBrowser: owner.browser, recordingContext: owner.context,
  });
  const closed = await closeLiveRuntime(closeRuntimeOwners, owner);
  return {
    ok: closed,
    owner,
    witness: witnessed.ok === true ? witnessed.witness : null,
  };
}

// 缺省关闭接缝：先关 Context 再关 Browser；「关掉了没有」仍只由对象状态复核，不以调用成功冒充。
export async function defaultCloseRuntimeOwners({ browser, context }) {
  await context.close();
  await browser.close();
  return { ok: true };
}

// source 段的封权：composer 见证录制 runtime 真实关闭、由 canonical bootstrap 新开 runtime
// 并取得 fresh 授权后，fresh/topology/owner 三件套只以 opaque preparation capability 交出。
export function sealPreparedSourceRuntime({
  freshRuntimeAuthority, topologyAuthority, runtime, runNamespace,
  executionTargetAuthority, adapterIdentity,
}) {
  return frozen({
    ok: true,
    sourceRuntimePreparationAuthority: sealSourceRuntimePreparation({
      freshRuntimeAuthority,
      topologyAuthority,
      runtimeOwnerAuthority: sealRuntimeOwner({
        role: 'source',
        runtime,
        topologyAuthority,
        runNamespace,
        executionTargetAuthority,
      }),
      runNamespace,
      executionTargetAuthority,
      adapterIdentity,
    }),
  });
}

// 非消费式归属检查：plain/clone/foreign preparation cap 一律在消费前拒，绝不吃掉别人的 genuine cap。
// 返回私有 record 仅供本模块在 consume 前完成整组绑定检查；opaque capability 本身不投影 record。
function ownedPreparationRecord(authority, adapterIdentity) {
  if (!isRecord(authority)) return null;
  const record = PREPARATION_STATE.get(authority);
  return record && !record.consumed && record.adapterIdentity === adapterIdentity ? record : null;
}

function ownedPreparation(authority, adapterIdentity) {
  return !!ownedPreparationRecord(authority, adapterIdentity);
}

// preparation 是一次性 capability：铸它的 adapter、namespace/target 不符即拒，绝不二次交权。
export function claimSourceRuntimePreparation({
  sourceRuntimePreparationAuthority, sourcePlanAuthority, runNamespace,
  executionTargetAuthority, adapterIdentity,
}) {
  const record = ownedPreparationRecord(sourceRuntimePreparationAuthority, adapterIdentity);
  if (!record) return null;
  const sourcePlan = readSourcePlan(sourcePlanAuthority);
  if (!sourcePlan || sourcePlan.runNamespace !== runNamespace
    || sourcePlan.executionTargetAuthority !== executionTargetAuthority) return null;
  if (record.runNamespace !== runNamespace
    || record.executionTargetAuthority !== executionTargetAuthority) {
    return null;
  }
  const owner = readRuntimeOwner(record.runtimeOwnerAuthority);
  if (!owner || owner.role !== 'source'
    || owner.runNamespace !== runNamespace
    || owner.executionTargetAuthority !== executionTargetAuthority) return null;
  // 直到 preparation/source plan/owner 的 namespace、target、role 全部匹配才消费。
  // 拒绝路径因此仍可由 orchestrator finally dispose exact live source owner 一次。
  if (consumeSourceRuntimePreparation(sourceRuntimePreparationAuthority) !== record) return null;
  // 私有 record 引用沿 owner→closure 传播；不投影进任何 public capability/result。
  owner.sourcePlanRecord = sourcePlan;
  return frozen({
    ok: true,
    freshRuntimeAuthority: record.freshRuntimeAuthority,
    topologyAuthority: record.topologyAuthority,
    runtimeOwnerAuthority: record.runtimeOwnerAuthority,
  });
}

export async function disposeSourceRuntimePreparation({
  sourceRuntimePreparationAuthority, closeRuntimeOwners, adapterIdentity,
}) {
  // 无权 preparation cap 与「已取权但关不掉」是两件事：前者归属不符，后者才是 dispose 失败。
  if (!ownedPreparation(sourceRuntimePreparationAuthority, adapterIdentity)) return null;
  const record = consumeSourceRuntimePreparation(sourceRuntimePreparationAuthority);
  if (!record) return null;
  const owner = markRuntimeOwnerClosed(record.runtimeOwnerAuthority);
  if (!owner) return false;
  return closeLiveRuntime(closeRuntimeOwners, owner);
}

// evidence runtime 的关闭：source 关闭额外产一次性 closure，交给独立 authoring 段。
export async function closeRoleRuntimeOwners({ runtimeOwnerAuthority, closeRuntimeOwners }) {
  const closed = await closeOwnedRuntime({ runtimeOwnerAuthority, closeRuntimeOwners });
  if (!closed) return frozen({ ok: false, reason: 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH' });
  if (!closed.ok) {
    return frozen({
      ok: false,
      reason: closed.owner.role === 'source'
        ? 'SOURCE_RUNTIME_CLOSE_FAILED' : 'DISTILLED_RUNTIME_CLOSE_FAILED',
    });
  }
  if (closed.owner.role !== 'source') return frozen({ ok: true });
  return frozen({
    ok: true,
    sourceClosureAuthority: sealSourceClosureAuthority({
      runNamespace: closed.owner.runNamespace,
      executionTargetAuthority: closed.owner.executionTargetAuthority,
      sourcePlanRecord: closed.owner.sourcePlanRecord,
      witness: closed.witness,
    }),
  });
}

// 独立 authoring runtime 的四段生命周期接缝：open/precondition/reset/close 全部落在 owner 模块，
// 编排层只做静态装配。它不编译、不裁定，也不铸 candidate。
export function createAuthoringRuntimeSeam({
  openAuthoring, closeRuntimeOwners, verifyAuthoringReset, executeAuthoringPreconditions,
  consumeAuthoringBaselineGrant,
}) {
  const failed = (reason) => frozen({ ok: false, reason });
  const baselineByRuntime = new WeakMap();

  async function openFreshAuthoringRuntime({
    sourceClosureAuthority, authoringBaselineGrant, candidateCaseId,
    runNamespace, executionTargetAuthority,
  }) {
    // 三枚 authority 齐备前零物理 open：baseline grant 必须是 genuine one-shot，clone/plain 一律拒。
    const baseline = typeof consumeAuthoringBaselineGrant === 'function'
      ? consumeAuthoringBaselineGrant(authoringBaselineGrant)
      : null;
    if (!baseline) return failed('AUTHORING_BASELINE_GRANT_INVALID');
    if (baseline.executionTargetAuthority !== executionTargetAuthority) {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    // genuine 但跨 pair 的 atom candidate：case 身份与 baseline 绑定不符，物理 open 前即拒。
    if (candidateCaseId !== undefined
      && candidateCaseId !== null
      && candidateCaseId !== baseline.caseId) {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    // exact profile 在 source closure 消费与任何 authoring Browser/Context/Page open 前完成
    // 纯解析。身份 listApi 的网络账本尚未接入三段 runtime；声明即明确拒绝，绝不静默
    // 退到 DOM-only legacy。拒绝时 closure 仍可由正确调用方消费/处置。
    const channelProfile = parseAuthoringChannelProfileBytes(
      baseline.channelProfileBytes ?? undefined,
    );
    if (!channelProfile.ok) return failed('AUTHORING_COMPILE_FAILED');
    if (channelProfile.identityChannelDeclared) {
      return failed('AUTHORING_IDENTITY_CHANNEL_UNSUPPORTED');
    }
    const closure = consumeSourceClosureAuthority(sourceClosureAuthority);
    if (!closure) return failed('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
    if (closure.executionTargetAuthority !== executionTargetAuthority) {
      return failed('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
    }
    // baseline grant 与 source closure 必须来自同一 opaque source plan record；相同
    // namespace/pair/case/target 标签的另一份 plan 也不能把 profile 换绑进本次 runtime。
    if (baseline.sourceRunNamespace !== closure.runNamespace) {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    if (baseline.sourcePlanRecord !== closure.sourcePlanRecord) {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    const owned = await openOwnedRuntime({
      open: openAuthoring,
      role: 'authoring',
      executionTargetAuthority,
      runNamespace,
      witness: closure.witness,
    });
    if (!owned || owned.fresh?.ok !== true) {
      if (owned?.runtime) await closeLiveRuntime(closeRuntimeOwners, owned.runtime);
      return failed('AUTHORING_RUNTIME_OPEN_FAILED');
    }
    const authoringRuntimeAuthority = sealRuntimeOwner({
      role: 'authoring',
      runtime: owned.runtime,
      topologyAuthority: owned.topologyAuthority,
      runNamespace,
      executionTargetAuthority,
    });
    if (!authoringRuntimeAuthority) {
      await closeLiveRuntime(closeRuntimeOwners, owned.runtime);
      return failed('AUTHORING_RUNTIME_OPEN_FAILED');
    }
    baselineByRuntime.set(authoringRuntimeAuthority, {
      runNamespace,
      executionTargetAuthority,
      baselineProjectionSha256: baseline.baselineProjectionSha256,
    });
    const openedRuntime = {
      ok: true,
      authoringRuntimeAuthority,
      page: owned.runtime.page,
      forensics: owned.runtime.forensics || null,
      state: owned.runtime.state || { currentStepId: null },
    };
    // 只有 genuine baseline grant 已消费且 runtime 已成功归属后，才向静态绑定的
    // trusted compile adapter 返回 exact copy；legacy 无 bytes 时保持旧返回形状。
    if (baseline.channelProfileBytes) {
      openedRuntime.channelProfileBytes = Buffer.from(baseline.channelProfileBytes);
    }
    return frozen(openedRuntime);
  }

  // 首版 read-only-v1 的前置只有登录，由 canonical bootstrap 在 open 时完成；
  // 更强的前置执行由注入的现役 runner 承接，缺席即视为无额外前置。
  async function runAuthoringPreconditions({ authoringRuntimeAuthority }) {
    if (typeof executeAuthoringPreconditions === 'function') {
      return executeAuthoringPreconditions({ authoringRuntimeAuthority });
    }
    return readRuntimeOwner(authoringRuntimeAuthority)
      ? frozen({ ok: true })
      : failed('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
  }

  async function verifyAuthoringResetFacts({
    runNamespace, authoringRuntimeAuthority, executionTargetAuthority,
  }) {
    if (typeof verifyAuthoringReset !== 'function') return failed('AUTHORING_BASELINE_MISMATCH');
    const owner = readRuntimeOwner(authoringRuntimeAuthority);
    const baseline = baselineByRuntime.get(authoringRuntimeAuthority);
    if (!owner || !baseline) {
      return failed('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
    }
    if (baseline.runNamespace !== runNamespace
      || baseline.executionTargetAuthority !== executionTargetAuthority
      || owner.executionTargetAuthority !== executionTargetAuthority) {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    let facts;
    try {
      facts = await verifyAuthoringReset({
        role: 'authoring',
        runNamespace,
        authoringRuntimeAuthority,
        executionTargetAuthority,
        topologyAuthority: owner.topologyAuthority,
        expectedBaselineProjectionSha256: baseline.baselineProjectionSha256,
      });
    } catch {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    if (!isRecord(facts) || facts.ok === false) return failed('AUTHORING_BASELINE_MISMATCH');
    // canonical observer 必须回 exact digest；可信 zero-SUT 注入可只回 {ok:true}。
    if (facts.baselineProjectionSha256 !== undefined
      && facts.baselineProjectionSha256 !== baseline.baselineProjectionSha256) {
      return failed('AUTHORING_BASELINE_MISMATCH');
    }
    return frozen({ ok: true });
  }

  async function closeAuthoringRuntime({ authoringRuntimeAuthority }) {
    const closed = await closeOwnedRuntime({
      runtimeOwnerAuthority: authoringRuntimeAuthority, closeRuntimeOwners,
    });
    if (!closed) return failed('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
    if (!closed.ok) return failed('AUTHORING_RUNTIME_CLOSE_FAILED');
    return frozen({
      ok: true,
      authoringClosureAuthority: sealAuthoringClosureAuthority({
        runNamespace: closed.owner.runNamespace,
        executionTargetAuthority: closed.owner.executionTargetAuthority,
        witness: closed.witness,
      }),
    });
  }

  return frozen({
    openFreshAuthoringRuntime,
    executeAuthoringPreconditions: runAuthoringPreconditions,
    verifyAuthoringReset: verifyAuthoringResetFacts,
    closeAuthoringRuntime,
  });
}

export function sealSourceRuntimePreparation(record) {
  const sourceRuntimePreparationAuthority = frozen(Object.create(null));
  PREPARATION_STATE.set(sourceRuntimePreparationAuthority, { ...record, consumed: false });
  return sourceRuntimePreparationAuthority;
}

export function consumeSourceRuntimePreparation(authority) {
  if (!isRecord(authority)) return null;
  const record = PREPARATION_STATE.get(authority);
  if (!record || record.consumed) return null;
  record.consumed = true;
  return record;
}

export function sealSourceClosureAuthority(record) {
  const sourceClosureAuthority = frozen(Object.create(null));
  SOURCE_CLOSURE_STATE.set(sourceClosureAuthority, { ...record, consumed: false });
  return sourceClosureAuthority;
}

export function consumeSourceClosureAuthority(authority) {
  if (!isRecord(authority)) return null;
  const record = SOURCE_CLOSURE_STATE.get(authority);
  if (!record || record.consumed) return null;
  record.consumed = true;
  return record;
}

export function sealAuthoringClosureAuthority(record) {
  const authoringClosureAuthority = frozen(Object.create(null));
  AUTHORING_CLOSURE_STATE.set(authoringClosureAuthority, { ...record, consumed: false });
  return authoringClosureAuthority;
}

export function consumeAuthoringClosureAuthority(authority) {
  if (!isRecord(authority)) return null;
  const record = AUTHORING_CLOSURE_STATE.get(authority);
  if (!record || record.consumed) return null;
  record.consumed = true;
  return record;
}

// authoring closure → fresh distilled runtime 的物理生命周期。
// composer 只保留闭合 public 签名；本模块负责 open/fresh/reset/owner/cleanup 原子转移。

import {
  closeLiveRuntime,
  consumeAuthoringClosureAuthority,
  openOwnedRuntime,
  sealRuntimeOwner,
} from './runtime-owner.mjs';
import { denied, frozen } from '../dual-replay/source-plan-authority.mjs';

const OWNERSHIP_MISMATCH = 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH';
const OPEN_FAILED = 'AUTHORING_RUNTIME_OPEN_FAILED';

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function prepareOwnedDistilledRuntime({
  authoringClosureAuthority,
  pairAuthority,
  runNamespace,
  executionTargetAuthority,
  openDistilled,
  observeReset,
  closeRuntimeOwners,
}) {
  if (!isRecord(pairAuthority)) return denied(OWNERSHIP_MISMATCH);
  const closure = consumeAuthoringClosureAuthority(authoringClosureAuthority);
  if (!closure) return denied(OWNERSHIP_MISMATCH);
  if (closure.executionTargetAuthority !== executionTargetAuthority) {
    return denied('EXECUTION_TARGET_AUTHORITY_INVALID');
  }
  const owned = await openOwnedRuntime({
    open: openDistilled,
    role: 'distilled',
    executionTargetAuthority,
    runNamespace,
    witness: closure.witness,
  });
  if (!owned || owned.fresh?.ok !== true) {
    if (owned?.runtime) await closeLiveRuntime(closeRuntimeOwners, owned.runtime);
    return denied(OPEN_FAILED);
  }
  let transferred = false;
  try {
    if (await observeReset(
      'distilled',
      runNamespace,
      executionTargetAuthority,
      owned.topologyAuthority,
    ) !== true) return denied(OPEN_FAILED);
    const runtimeOwnerAuthority = sealRuntimeOwner({
      role: 'distilled',
      runtime: owned.runtime,
      topologyAuthority: owned.topologyAuthority,
      runNamespace,
      executionTargetAuthority,
    });
    if (!runtimeOwnerAuthority) return denied(OPEN_FAILED);
    transferred = true;
    return frozen({
      ok: true,
      freshRuntimeAuthority: owned.fresh.freshRuntimeAuthority,
      topologyAuthority: owned.topologyAuthority,
      runtimeOwnerAuthority,
    });
  } finally {
    if (!transferred) await closeLiveRuntime(closeRuntimeOwners, owned.runtime);
  }
}

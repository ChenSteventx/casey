import { verifyExecutionTargetPageOrigin } from '../execution-target/runtime.mjs';

// Production-only dependency injected into replay actions. Low-level action
// helpers stay reusable, while the replay entry point cannot bypass the same
// execution-target authority used by navigation.
export function createReplayOriginAdmission(authority) {
  return async function admitReplayActionOrigin(page) {
    try {
      const admitted = await verifyExecutionTargetPageOrigin({
        page,
        authority,
        closeOnReject: false,
      });
      return admitted?.ok === true;
    } catch {
      return false;
    }
  };
}

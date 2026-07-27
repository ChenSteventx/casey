import { executeWithAdmissionAuthority } from './action-admission.mjs';

function denied(reason) {
  return Object.freeze({ ok: false, reason, actionReceipt: null });
}

export async function executeAdmittedAction({ admission } = {}) {
  const result = await executeWithAdmissionAuthority(admission);
  return result?.ok === true
    ? result
    : denied(result?.reason || 'ADMISSION_AUTHORITY_INVALID');
}

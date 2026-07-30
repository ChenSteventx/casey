// Replay entity admission 拒绝原因的唯一跨模块分类源。
// 仅下列原因可由 genuine runtime entity authority 解除；未列出的新原因缺省
// 视为 events 本身不合法，必须重编译，避免未知拒绝悄悄流入铸权分支。

export const REPLAY_ENTITY_ADMISSION_LOCK_REQUIRED_REASONS = Object.freeze([
  'FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID',
  'FROZEN_ENTITY_LOCKS_EVENTS_MISMATCH',
  'FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID',
  'FROZEN_ENTITY_LOCKS_EXTRA_BINDINGS',
  'REPLAY_READ_EVENT_TARGET_INVALID',
  'REPLAY_EVENT_POLICY_INVALID',
]);

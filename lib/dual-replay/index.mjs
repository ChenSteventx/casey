// 双回放 staged façade：只导出 authority-only 的公开 API。
// 不导出 reset/fresh issuer、internal candidate sealer 或任何 caller 可填的事实入口。

export { createSourceReplayPlanAuthority } from './source-plan-authority.mjs';
export { authorizeSourceReplay, authorizeDistilledReplay } from './run-authority.mjs';
export {
  completeAuthorizedReplay,
  completeResolvedSourceReplay,
  executeAuthorizedSourceReplay,
} from './replay-completion.mjs';
export { finalizeDualReplayPlanAuthority } from './pair-authority.mjs';
export {
  createSemanticReplayReceipt,
  issueComparisonGrant,
  issuePredecessorGrant,
  validateSemanticReplayReceipt,
} from './receipt-shape.mjs';
export { compareSemanticReplayReceipts } from './comparator.mjs';

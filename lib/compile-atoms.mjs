// Public facade for the deterministic compile atom engine.
// compile-atoms-flow applies projectCompileEntityProvenance to each event's
// sourceIntentId/entityBindings before any signed promotion.
import { navigateExecutionTargetPage } from './execution-target/runtime.mjs';

export { ROUTE_LIST, auditDeleteCount, summarizeDeleteCountAudit } from './compile-atoms-support.mjs';
export { createCompileRun, projectObserved } from './compile-atoms-run.mjs';
export { COMPILE_KNOWN_ATOMS, compileFlow, isCompilableAtom } from './compile-atoms-flow.mjs';

export function navigateCompileTarget(options) {
  return navigateExecutionTargetPage(options);
}

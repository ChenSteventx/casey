// 生产 façade：静态绑定 canonical 依赖并把唯一入口委托给 canonical core。
// 对外不开放任何注入面，也不在本地组装结论；技术闭环恒为开发期候选，不冒充正式报告 PASS。

import * as dualReplayApi from '../dual-replay/index.mjs';
import * as runAuthorityApi from '../dual-replay/run-authority.mjs';
import atomRegistry from '../atoms-registry.snapshot.json' with { type: 'json' };
import { createDualReplayOrchestratorCore } from './dual-replay-orchestrator-core.mjs';
import * as resolvedProjectionApi from './resolved-projection.mjs';
import { canonicalRuntimeCycleAdapter } from './runtime-cycle-adapter.mjs';

const canonicalCore = createDualReplayOrchestratorCore({
  dualReplayApi,
  runAuthorityApi,
  resolvedProjectionApi,
  atomRegistry,
  runtimeCycleAdapter: canonicalRuntimeCycleAdapter,
});

export async function runTeachinReplayabilityCycle(input) {
  return canonicalCore.runCycle(input);
}

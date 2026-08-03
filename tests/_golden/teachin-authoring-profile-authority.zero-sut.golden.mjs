#!/usr/bin/env node
// exact channel profile bytes 的 source-plan authority 绑定。纯内存，零 SUT/network/credentials/LLM。

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import {
  createSourceReplayPlanAuthority, digestOf, readSourcePlan,
} from '../../lib/dual-replay/source-plan-authority.mjs';
import { admitRawReplayCapture } from '../../lib/teachin/raw-capture.mjs';

const TAG = 'teachin-authoring-profile-authority';
let passed = 0;
const failures = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${TAG}: ${name}`); }
  catch (error) {
    const detail = String(error?.message || error).slice(-800);
    failures.push(`${name}: ${detail}`); console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

const caseId = 'tc_profile_authority';
const captureBytes = Buffer.from(JSON.stringify({
  schemaVersion: 1, artifactKind: 'teach-in-capture', caseId,
  createdAt: '2026-08-03T00:00:00.000Z', startPath: '/home',
  source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
  events: [{ seq: 1, action: 'click', path: '/home', selector: '#workflow-management', text: '工作流管理' }],
}));
const admitted = admitRawReplayCapture({ caseId, captureBytes });
assert(admitted.ok === true, 'capture authority 未铸成');
const target = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://shape.invalid/start' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(target.ok === true, 'target authority 未铸成');
const profileBytes = Buffer.from('{"routes":{"workflowList":"/tenant/workflows"}}');
const testcaseBytes = Buffer.from(JSON.stringify({ caseId, steps: [{ intentId: 'i1', intent: '进入工作流管理' }] }));
const expectedBytes = Buffer.from(JSON.stringify({ caseId, intents: [{ intentId: 'i1', expected: [] }] }));
const entityLockBytes = Buffer.from('[]');

function input(overrides = {}) {
  return {
    pairId: 'pair_profile_authority', testcaseBytes, expectedBytes,
    expectedObligations: {
      intents: ['i1'], terminalHardPredicates: [], topology: [], entities: [], effects: [],
      cleanup: { required: false, status: 'not-required', policySha256: digestOf('cleanup') },
    },
    sutBuildDigest: digestOf('build'),
    channelProfileDigest: digestOf(profileBytes),
    channelProfileBytes: profileBytes,
    identityProfileDigest: digestOf('identity'),
    replayKernelDigest: digestOf('kernel'),
    resetPlanDigest: digestOf('reset'),
    sessionPolicyDigest: digestOf('session'),
    executionTargetAuthority: target.authority,
    source: {
      captureAuthority: admitted.captureAuthority,
      candidateBytes: testcaseBytes,
      eventsBytes: captureBytes,
      entityLockBytes,
      runNamespace: 'run_source_profile_authority',
    },
    ...overrides,
  };
}

await check('P1 exact profile bytes 与 digest 绑定且 authority 内复制防后改', () => {
  const mutable = Buffer.from(profileBytes);
  const result = createSourceReplayPlanAuthority(input({ channelProfileBytes: mutable }));
  assert(result.ok === true, `exact profile source plan 未铸成：${JSON.stringify(result)}`);
  mutable.fill(0);
  const record = readSourcePlan(result.authority);
  assert(Buffer.isBuffer(record?.bytes?.channelProfileBytes)
    && record.bytes.channelProfileBytes.equals(profileBytes),
  'authority 未复制 exact profile bytes，受 caller 后改污染');
});

await check('P2 profile bytes 摘要不符/空值必须在 source authority 铸造前拒绝', () => {
  for (const bytes of [Buffer.from('{"routes":{}}'), Buffer.alloc(0), null]) {
    const result = createSourceReplayPlanAuthority(input({ channelProfileBytes: bytes }));
    assert(result.ok === false && result.reason === 'SOURCE_REPLAY_PLAN_AUTHORITY_INVALID',
      `坏 profile bytes 未固定拒绝：${JSON.stringify(result)}`);
  }
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);

// record CLI 的 cycle input 装配边界。
// 默认把同次录制的 exact capture bytes 与盘上 testcase/expected/profile 组成内存 input；
// 旧 cycle-plan 只作 mapping/expected 模板，capture identity 与 events 必须重绑当前录制。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import atomRegistry from '../atoms-registry.snapshot.json' with { type: 'json' };
import { flowContainsEntityMutation } from '../entity-semantic-lock-preflight.mjs';
import {
  generateKnownReadOnlyCycleInput,
  projectAuthoredTestCase,
} from './cycle-plan-generator.mjs';
import { projectReadOnlyObligations } from './read-only-obligations.mjs';

export const AUTO_CYCLE_FLAGS = Object.freeze([
  'testcase', 'expected', 'entity-lock', 'profile', 'sut-build-digest',
]);

const CYCLE_PLAN_SHAPE = Object.freeze({
  sourcePlan: Object.freeze({
    strings: Object.freeze(['pairId', 'testcase', 'expected', 'sutBuildDigest',
      'channelProfileDigest', 'identityProfileDigest', 'replayKernelDigest',
      'resetPlanDigest', 'sessionPolicyDigest']),
    objects: Object.freeze(['expectedObligations', 'source']),
  }),
  source: Object.freeze({
    strings: Object.freeze(['candidate', 'events', 'entityLock', 'runNamespace']),
  }),
  projection: Object.freeze({ objects: Object.freeze(['mappingCandidate', 'authoredTestCase']) }),
  distilled: Object.freeze({ strings: Object.freeze(['authoringRunNamespace', 'runNamespace']) }),
});

function denied(reason) {
  return Object.freeze({ ok: false, reason });
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function planBytes(file) {
  if (typeof file !== 'string' || !file) throw new Error('CYCLE_PLAN_INVALID');
  const bytes = readFileSync(resolve(file));
  if (!bytes.length) throw new Error('CYCLE_PLAN_INVALID');
  return bytes;
}

function assertExactSection(section, spec) {
  if (!isPlainRecord(section)) throw new Error('CYCLE_PLAN_INVALID');
  const expected = [...(spec.strings || []), ...(spec.objects || [])].sort().join(' ');
  if (Object.keys(section).sort().join(' ') !== expected) throw new Error('CYCLE_PLAN_INVALID');
  for (const key of spec.strings || []) {
    if (typeof section[key] !== 'string' || !section[key]) throw new Error('CYCLE_PLAN_INVALID');
  }
  for (const key of spec.objects || []) {
    if (!isPlainRecord(section[key]) && !Array.isArray(section[key])) {
      throw new Error('CYCLE_PLAN_INVALID');
    }
  }
}

function assertCyclePlanShape(plan) {
  if (!isPlainRecord(plan)
    || Object.keys(plan).sort().join(' ') !== 'distilled projection sourcePlan') {
    throw new Error('CYCLE_PLAN_INVALID');
  }
  assertExactSection(plan.sourcePlan, CYCLE_PLAN_SHAPE.sourcePlan);
  assertExactSection(plan.sourcePlan.source, CYCLE_PLAN_SHAPE.source);
  assertExactSection(plan.projection, CYCLE_PLAN_SHAPE.projection);
  assertExactSection(plan.distilled, CYCLE_PLAN_SHAPE.distilled);
}

function captureToken(captureBytes) {
  return createHash('sha256').update(captureBytes).digest('hex').slice(0, 12);
}

function parsedRecord(bytes) {
  const parsed = JSON.parse(bytes.toString('utf8'));
  if (!isPlainRecord(parsed)) throw new Error('CYCLE_PLAN_INVALID');
  return parsed;
}

// 两侧同规则投影后逐字节比对：键序由同一段构造代码决定，序列化相等即语义相等。
function sameDocument(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildLegacyCycleInput(planFile, executionTargetAuthority, currentCaptureBytes) {
  try {
    if (!Buffer.isBuffer(currentCaptureBytes) || currentCaptureBytes.length === 0) {
      throw new Error('CYCLE_PLAN_INVALID');
    }
    const plan = JSON.parse(readFileSync(resolve(planFile), 'utf8'));
    assertCyclePlanShape(plan);
    const { sourcePlan, projection } = plan;
    const source = sourcePlan.source;
    // 生成期具名前置门：entity lock 必须恰是空集，mapping 必须复跑一次 mutation 判定。
    const entityLockBytes = planBytes(source.entityLock);
    if (!entityLockBytes.equals(Buffer.from('[]', 'utf8'))) {
      return denied('CYCLE_PLAN_RUNTIME_ENTITY_REVIEW_REQUIRED');
    }
    const mappingCandidate = projection.mappingCandidate;
    if (!Array.isArray(mappingCandidate) || mappingCandidate.length === 0) {
      throw new Error('CYCLE_PLAN_INVALID');
    }
    if (flowContainsEntityMutation(mappingCandidate.map((row) => ({ atom: row?.atom })))) {
      return denied('CYCLE_PLAN_EFFECT_REVIEW_REQUIRED');
    }
    // 盘上字节是唯一事实源：内嵌 authoredTestCase/expectedObligations 只作模板，
    // 必须由同一份字节重新 parse/重投影；两者不一致即拒，绝不让 receipt 摘要
    // 指向一份没被真正用上的字节。
    const testcaseBytes = planBytes(sourcePlan.testcase);
    const expectedBytes = planBytes(sourcePlan.expected);
    const authoredTestCase = projectAuthoredTestCase(parsedRecord(testcaseBytes));
    const expectedObligations = projectReadOnlyObligations({
      expectedDocument: parsedRecord(expectedBytes),
      intentOrder: mappingCandidate.map((row) => row?.intentId),
    });
    if (!authoredTestCase || !expectedObligations
      || !sameDocument(authoredTestCase, projection.authoredTestCase)
      || !sameDocument(expectedObligations, sourcePlan.expectedObligations)) {
      throw new Error('CYCLE_PLAN_INVALID');
    }
    const token = captureToken(currentCaptureBytes);
    return {
      ok: true,
      cycleInput: {
        sourcePlan: {
          pairId: `pair_${token}`,
          testcaseBytes,
          expectedBytes,
          expectedObligations,
          sutBuildDigest: sourcePlan.sutBuildDigest,
          channelProfileDigest: sourcePlan.channelProfileDigest,
          identityProfileDigest: sourcePlan.identityProfileDigest,
          replayKernelDigest: sourcePlan.replayKernelDigest,
          resetPlanDigest: sourcePlan.resetPlanDigest,
          sessionPolicyDigest: sourcePlan.sessionPolicyDigest,
          source: {
            candidateBytes: planBytes(source.candidate),
            eventsBytes: Buffer.from(currentCaptureBytes),
            entityLockBytes,
            runNamespace: `run_source_${token}`,
          },
        },
        executionTargetAuthority,
        projection: {
          mappingCandidate,
          authoredTestCase,
        },
        distilled: {
          authoringRunNamespace: `run_authoring_${token}`,
          runNamespace: `run_distilled_${token}`,
        },
      },
    };
  } catch {
    return denied('CYCLE_PLAN_INVALID');
  }
}

function buildSameCaptureCycleInput(args, caseId, captureBytes, executionTargetAuthority) {
  let testcaseBytes;
  let expectedBytes;
  let entityLockBytes;
  let channelProfileBytes;
  let replayKernelBytes;
  try {
    testcaseBytes = planBytes(args.testcase);
    expectedBytes = planBytes(args.expected);
    entityLockBytes = planBytes(args['entity-lock']);
    channelProfileBytes = planBytes(args.profile);
    replayKernelBytes = readFileSync(new URL('../atoms-registry.snapshot.json', import.meta.url));
  } catch {
    return denied('CYCLE_PLAN_INPUT_UNREADABLE');
  }
  return generateKnownReadOnlyCycleInput({
    atomRegistry,
    captureBytes,
    caseId,
    channelProfileBytes,
    entityLockBytes,
    executionTargetAuthority,
    expectedBytes,
    replayKernelBytes,
    sutBuildDigest: args['sut-build-digest'],
    testcaseBytes,
  });
}

export function inspectRecordedCycleArgs(args = {}) {
  const legacy = args['cycle-plan'] !== undefined;
  const autoCount = AUTO_CYCLE_FLAGS.filter((flag) => args[flag] !== undefined).length;
  if (legacy && autoCount > 0) return denied('CYCLE_INPUT_MODE_CONFLICT');
  if (autoCount > 0 && autoCount !== AUTO_CYCLE_FLAGS.length) {
    return denied('CYCLE_INPUT_INCOMPLETE');
  }
  return Object.freeze({
    ok: true,
    requested: legacy || autoCount === AUTO_CYCLE_FLAGS.length,
    mode: legacy ? 'legacy-plan-template'
      : autoCount === AUTO_CYCLE_FLAGS.length ? 'same-capture' : 'capture-only',
  });
}

export function buildRecordedCycleInput({
  args, caseId, captureBytes, executionTargetAuthority,
} = {}) {
  const mode = inspectRecordedCycleArgs(args);
  if (mode.ok !== true || mode.requested !== true) {
    return denied(mode.reason || 'CYCLE_PLAN_INVALID');
  }
  if (mode.mode === 'legacy-plan-template') {
    return buildLegacyCycleInput(args['cycle-plan'], executionTargetAuthority, captureBytes);
  }
  return buildSameCaptureCycleInput(args, caseId, captureBytes, executionTargetAuthority);
}

// capture 完成后的 deterministic known-recipe cycle plan 生成器。
// 只覆盖当前首发 read-only、零 pending、零 popup 的闭环；其余返回明确 reason，
// 留给 grill/LLM/人工 mapping，绝不把模糊事件硬猜成 atom。

import { createHash } from 'node:crypto';
import { flowContainsEntityMutation } from '../entity-semantic-lock-preflight.mjs';
import { projectCaptureEvents } from '../teachin-distillation/event-projection.mjs';
import { resolveCaptureAtoms } from '../teachin-distillation/atom-resolution.mjs';
import {
  admitRawReplayCapture,
  inspectAdmittedRawReplayCapture,
} from './raw-capture.mjs';
import { projectReadOnlyObligations } from './read-only-obligations.mjs';

const GENERATOR_KEYS = [
  'atomRegistry',
  'authoredTestCase',
  'captureBytes',
  'caseId',
  'channelProfileBytes',
  'expectedDocument',
  'paths',
  'replayKernelBytes',
  'sutBuildDigest',
];

const CYCLE_INPUT_GENERATOR_KEYS = [
  'atomRegistry',
  'captureBytes',
  'caseId',
  'channelProfileBytes',
  'entityLockBytes',
  'executionTargetAuthority',
  'expectedBytes',
  'replayKernelBytes',
  'sutBuildDigest',
  'testcaseBytes',
];

function digestOf(value) {
  return `sha256:${createHash('sha256')
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest('hex')}`;
}

function denied(reason) {
  return Object.freeze({ ok: false, reason });
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseRecordBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return null;
  try {
    const parsed = JSON.parse(bytes.toString('utf8'));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 从盘上 testcase 字节投影出 plan 内嵌的 authored case：生成期与 legacy 复核期共用同一规则，
// 两处不得各写一份，否则「盘上字节」与「内嵌对象」会悄悄分叉。
export function projectAuthoredTestCase(document) {
  if (!isRecord(document) || !Array.isArray(document.steps)) return null;
  const projected = {
    schemaVersion: document.schemaVersion ?? 1,
    caseId: document.caseId,
  };
  for (const key of [
    'title', 'preconditions', 'steps', 'globalAssertions', 'uniquePrefix',
  ]) {
    if (document[key] !== undefined) projected[key] = structuredClone(document[key]);
  }
  return projected;
}

function exactRelativePaths(paths) {
  const expected = ['capture', 'entityLock', 'expected', 'testcase'];
  if (!isRecord(paths)
    || Object.keys(paths).sort().join(' ') !== expected.join(' ')) return false;
  return expected.every((key) => typeof paths[key] === 'string' && paths[key]
    && !paths[key].startsWith('/') && !paths[key].startsWith('\\')
    && !paths[key].split(/[\\/]/).includes('..'));
}

// 配方的语义标签集：无槽配方取跨度级 textAnyOf；带槽配方只认末槽（目的地条目名），
// 标签事实源唯一落在 slots，不另抄一份 textAnyOf 制造双事实源。
// 取末槽而非并集：并集会让只写组名（如「进入智能应用」）的 authored intent 错绑本 atom，
// 而 authored 步描述的是目的地，槽 0 只是路上的展开动作（plan §1 v3，计划审 delta 裁定）。
function recipeSemanticLabels(recipe) {
  if (Array.isArray(recipe?.slots) && recipe.slots.length > 0) {
    const terminal = recipe.slots[recipe.slots.length - 1];
    return Array.isArray(terminal?.textAnyOf) ? terminal.textAnyOf : [];
  }
  return Array.isArray(recipe?.textAnyOf) ? recipe.textAnyOf : [];
}

function semanticIntentMatches(step, unit, recipes) {
  if (!isRecord(step) || typeof step.intentId !== 'string' || !step.intentId
    || typeof step.intent !== 'string' || !step.intent || step.route === 'human') return false;
  const recipe = recipes.find((candidate) => candidate.ruleId === unit.ruleId);
  const labels = recipeSemanticLabels(recipe);
  if (labels.length === 0) return false;
  const intent = step.intent.replace(/\s+/g, '').toLocaleLowerCase('zh-CN');
  return labels.some((label) => intent.includes(
    label.replace(/\s+/g, '').toLocaleLowerCase('zh-CN'),
  ));
}

function remapKnownUnits(capture, authoredSteps, atomRegistry) {
  const initialProjection = projectCaptureEvents({ capture });
  if (initialProjection?.ok !== true) return denied(initialProjection?.reason || 'CYCLE_PLAN_INVALID');
  const initialResolution = resolveCaptureAtoms({
    projection: initialProjection.projection,
    registry: atomRegistry,
  });
  if (initialResolution?.ok !== true) return denied(initialResolution?.reason || 'CYCLE_PLAN_INVALID');
  if (initialResolution.pending.length > 0) return denied('CYCLE_PLAN_MAPPING_REQUIRED');
  if (initialResolution.structural.length > 0) return denied('CYCLE_PLAN_TOPOLOGY_REVIEW_REQUIRED');
  if (initialResolution.resolved.length !== authoredSteps.length) {
    return denied('CYCLE_PLAN_INTENT_BINDING_REQUIRED');
  }
  const intentIdBySeq = new Map();
  for (const [index, unit] of initialResolution.resolved.entries()) {
    const step = authoredSteps[index];
    const intentId = step?.intentId;
    if (!semanticIntentMatches(step, unit, initialResolution.recipes)) {
      return denied('CYCLE_PLAN_INTENT_BINDING_REQUIRED');
    }
    for (const seq of unit.evidenceEventSeqs) intentIdBySeq.set(seq, intentId);
  }
  const projection = projectCaptureEvents({ capture, intentIdBySeq });
  if (projection?.ok !== true) return denied(projection?.reason || 'CYCLE_PLAN_INVALID');
  // 第二遍投影的 intentId 是 authored 绑定标签：显式声明绑定集，多击配方就不会把
  // 分属两个 authored 步的相邻事件合并成一个单元（GRILL D6 防合并）。
  const resolution = resolveCaptureAtoms({
    projection: projection.projection,
    registry: atomRegistry,
    boundIntents: new Set(intentIdBySeq.keys()),
  });
  if (resolution?.ok !== true || resolution.pending.length > 0) {
    return denied('CYCLE_PLAN_MAPPING_REQUIRED');
  }
  return Object.freeze({ ok: true, resolution });
}

export function generateKnownReadOnlyCyclePlan(options = {}) {
  if (!isRecord(options)
    || Object.keys(options).sort().join(' ') !== GENERATOR_KEYS.join(' ')) {
    return denied('CYCLE_PLAN_INVALID');
  }
  const {
    caseId,
    captureBytes,
    authoredTestCase,
    expectedDocument,
    atomRegistry,
    paths,
    sutBuildDigest,
    channelProfileBytes,
    replayKernelBytes,
  } = options;
  if (typeof caseId !== 'string' || !caseId || !Buffer.isBuffer(captureBytes)
    || !isRecord(atomRegistry) || !exactRelativePaths(paths)
    || !/^sha256:[a-f0-9]{64}$/.test(sutBuildDigest || '')
    || !Buffer.isBuffer(channelProfileBytes) || !Buffer.isBuffer(replayKernelBytes)) {
    return denied('CYCLE_PLAN_INVALID');
  }
  const admitted = admitRawReplayCapture({ caseId, captureBytes });
  if (admitted?.ok !== true) return denied(admitted?.reason || 'CYCLE_PLAN_INVALID');
  const inspected = inspectAdmittedRawReplayCapture({
    captureAuthority: admitted.captureAuthority,
  });
  if (inspected?.ok !== true) return denied('CYCLE_PLAN_INVALID');
  const capture = inspected.capture;
  const authored = projectAuthoredTestCase(authoredTestCase);
  if (!authored || authored.caseId !== caseId) return denied('CYCLE_PLAN_INVALID');
  const remapped = remapKnownUnits(capture, authored.steps, atomRegistry);
  if (remapped.ok !== true) return remapped;
  const mappingCandidate = remapped.resolution.resolved.map((unit) => ({
    intentId: unit.intentId,
    atom: unit.atom,
    params: structuredClone(unit.params),
    evidenceEventSeqs: [...unit.evidenceEventSeqs],
  }));
  if (flowContainsEntityMutation(mappingCandidate.map(({ atom }) => ({ atom })))) {
    return denied('CYCLE_PLAN_EFFECT_REVIEW_REQUIRED');
  }
  const intentOrder = mappingCandidate.map((row) => row.intentId);
  const expectedIntentIds = Array.isArray(expectedDocument?.intents)
    ? expectedDocument.intents.map((intent) => intent?.intentId)
    : null;
  if (expectedDocument?.caseId !== caseId
    || !expectedIntentIds
    || expectedIntentIds.join('\0') !== intentOrder.join('\0')) {
    return denied('CYCLE_PLAN_EXPECTED_INVALID');
  }
  const expectedObligations = projectReadOnlyObligations({
    expectedDocument,
    intentOrder,
  });
  if (!expectedObligations) return denied('CYCLE_PLAN_EXPECTED_INVALID');
  const token = inspected.captureSha256.slice('sha256:'.length, 'sha256:'.length + 12);
  const channelProfileDigest = digestOf(channelProfileBytes);
  return Object.freeze({
    ok: true,
    plan: {
      sourcePlan: {
        pairId: `pair_${token}`,
        testcase: paths.testcase,
        expected: paths.expected,
        expectedObligations,
        sutBuildDigest,
        channelProfileDigest,
        identityProfileDigest: digestOf(Buffer.concat([
          Buffer.from('identity-profile:', 'utf8'),
          channelProfileBytes,
        ])),
        replayKernelDigest: digestOf(replayKernelBytes),
        resetPlanDigest: digestOf('read-only-v1-reset-plan'),
        sessionPolicyDigest: digestOf('fresh-login-session-v1'),
        source: {
          candidate: paths.testcase,
          events: paths.capture,
          entityLock: paths.entityLock,
          runNamespace: `run_source_${token}`,
        },
      },
      projection: {
        mappingCandidate,
        authoredTestCase: authored,
      },
      distilled: {
        authoringRunNamespace: `run_authoring_${token}`,
        runNamespace: `run_distilled_${token}`,
      },
    },
  });
}

// 同次录制入口使用：从刚落盘且将交给 capture admission 的同一份 exact bytes
// 同步生成 plan 与内存 cycle input。这里不读取路径，也不允许调用方另塞 capture 对象，
// 因而 source plan、pair identity 与三个 runtime namespace 不会绑定到旧录制。
export function generateKnownReadOnlyCycleInput(options = {}) {
  if (!isRecord(options)
    || Object.keys(options).sort().join(' ') !== CYCLE_INPUT_GENERATOR_KEYS.join(' ')) {
    return denied('CYCLE_PLAN_INVALID');
  }
  const {
    atomRegistry,
    captureBytes,
    caseId,
    channelProfileBytes,
    entityLockBytes,
    executionTargetAuthority,
    expectedBytes,
    replayKernelBytes,
    sutBuildDigest,
    testcaseBytes,
  } = options;
  if (!Buffer.isBuffer(captureBytes) || captureBytes.length === 0
    || !Buffer.isBuffer(entityLockBytes) || !isRecord(executionTargetAuthority)) {
    return denied('CYCLE_PLAN_INVALID');
  }
  if (!entityLockBytes.equals(Buffer.from('[]', 'utf8'))) {
    return denied('CYCLE_PLAN_RUNTIME_ENTITY_REVIEW_REQUIRED');
  }
  const authoredTestCase = parseRecordBytes(testcaseBytes);
  const expectedDocument = parseRecordBytes(expectedBytes);
  if (!authoredTestCase || !expectedDocument) return denied('CYCLE_PLAN_INVALID');

  const generated = generateKnownReadOnlyCyclePlan({
    atomRegistry,
    authoredTestCase,
    captureBytes,
    caseId,
    channelProfileBytes,
    expectedDocument,
    paths: {
      capture: 'runtime/current-capture.json',
      entityLock: 'runtime/entity-lock.json',
      expected: 'runtime/expected.json',
      testcase: 'runtime/testcase.json',
    },
    replayKernelBytes,
    sutBuildDigest,
  });
  if (generated?.ok !== true) return generated;

  const { sourcePlan, projection, distilled } = generated.plan;
  return Object.freeze({
    ok: true,
    cycleInput: {
      sourcePlan: {
        pairId: sourcePlan.pairId,
        // same-capture 闭环把刚读入并用于 channelProfileDigest 的 exact bytes
        // 私有地交给 source-plan authority；落盘 legacy plan 不新增该字段。
        channelProfileBytes: Buffer.from(channelProfileBytes),
        testcaseBytes: Buffer.from(testcaseBytes),
        expectedBytes: Buffer.from(expectedBytes),
        expectedObligations: structuredClone(sourcePlan.expectedObligations),
        sutBuildDigest: sourcePlan.sutBuildDigest,
        channelProfileDigest: sourcePlan.channelProfileDigest,
        identityProfileDigest: sourcePlan.identityProfileDigest,
        replayKernelDigest: sourcePlan.replayKernelDigest,
        resetPlanDigest: sourcePlan.resetPlanDigest,
        sessionPolicyDigest: sourcePlan.sessionPolicyDigest,
        source: {
          candidateBytes: Buffer.from(testcaseBytes),
          eventsBytes: Buffer.from(captureBytes),
          entityLockBytes: Buffer.from(entityLockBytes),
          runNamespace: sourcePlan.source.runNamespace,
        },
      },
      executionTargetAuthority,
      projection: structuredClone(projection),
      distilled: structuredClone(distilled),
    },
  });
}

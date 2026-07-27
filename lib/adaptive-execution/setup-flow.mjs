// 业务前置条件 setup flow 的确定性纯规划核。
//
// candidate 只声明要使用的既有 atom；requires/provides/removes 的真值始终取 registry。
// 本模块只负责闭合形态、稳定拓扑和现役编译/实体门复用，不执行浏览器动作、不产成功收据。
import {
  checkDestructivePrefix,
  traceStateMachine,
  validateStructural,
} from '../compile-gate.mjs';
import { isCompilableAtom } from '../compile-atoms.mjs';
import { requiredFlowEntityBindings } from '../entity-semantic-lock-preflight.mjs';
import { ENTITY_OBSERVATION_REGISTRY } from '../entity-observation-registry.mjs';
import { buildFlow } from '../flow-bridge.mjs';

const SETUP_KIND = 'setup-flow-candidate';
const STATE_KEYS = ['requires', 'provides', 'removes'];
const TRUSTED_BOOTSTRAP_STATES = new Set(['已登录']);

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonBlank(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function sortedStrings(values) {
  return Array.isArray(values)
    ? [...values].filter((value) => typeof value === 'string').sort()
    : [];
}

function projectionOf(definition) {
  return {
    requires: sortedStrings(definition?.requires),
    provides: sortedStrings(definition?.provides),
    removes: sortedStrings(definition?.removes),
  };
}

function sameProjection(left, right) {
  if (!isRecord(left)) return false;
  return STATE_KEYS.every((key) => (
    Array.isArray(left[key])
    && left[key].every((value) => typeof value === 'string')
    && JSON.stringify(sortedStrings(left[key])) === JSON.stringify(right[key])
  ));
}

function emptyTrace(initialStates = []) {
  return {
    steps: [],
    finalStates: [...new Set(sortedStrings(initialStates))].sort(),
    problems: [],
  };
}

function normalizedInitialStates(testcase) {
  return [...new Set(
    sortedStrings(testcase?.preconditions).filter((state) => TRUSTED_BOOTSTRAP_STATES.has(state)),
  )].sort();
}

function stableStepKey(step, index) {
  return `${String(step?.intentId ?? '')}\u0000${String(step?.atom ?? '')}\u0000${String(index).padStart(10, '0')}`;
}

function compareStepKeys(left, right) {
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

function addProblem(problems, seen, code, fields = {}) {
  const problem = { code, ...fields };
  const key = JSON.stringify(problem);
  if (!seen.has(key)) {
    seen.add(key);
    problems.push(problem);
  }
}

function directProjection(step) {
  if (!STATE_KEYS.some((key) => Object.hasOwn(step, key))) return null;
  return Object.fromEntries(STATE_KEYS.map((key) => [key, step[key] ?? []]));
}

function mappingEntry(step) {
  const entry = {
    intentId: step.intentId,
    atom: step.atom,
    params: Object.hasOwn(step, 'params') ? step.params : {},
  };
  if (Object.hasOwn(step, 'entityBindings')) entry.entityBindings = step.entityBindings;
  return entry;
}

function fallbackFlow(testcase) {
  const caseId = nonBlank(testcase?.caseId) ? testcase.caseId : 'invalid_setup';
  return {
    id: String(caseId).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: nonBlank(testcase?.title) ? testcase.title : caseId,
    category: 'normal',
    steps: [],
  };
}

export function planSetupFlow({ testcase, candidate, registry } = {}) {
  const problems = [];
  const seenProblems = new Set();
  const initialStates = normalizedInitialStates(testcase);
  const atomDefinitions = isRecord(registry?.atoms) ? registry.atoms : {};

  if (!isRecord(testcase) || !nonBlank(testcase.caseId)) {
    addProblem(problems, seenProblems, 'SETUP_TESTCASE_INVALID');
  }
  if (!isRecord(candidate)
    || candidate.schemaVersion !== 1
    || candidate.artifactKind !== SETUP_KIND
    || !nonBlank(candidate.caseId)
    || !Array.isArray(candidate.goalStates)
    || !candidate.goalStates.every(nonBlank)
    || !Array.isArray(candidate.steps)
    || candidate.steps.length === 0) {
    addProblem(problems, seenProblems, 'SETUP_CANDIDATE_INVALID');
  }
  if (!isRecord(registry) || !isRecord(registry.atoms)) {
    addProblem(problems, seenProblems, 'SETUP_REGISTRY_INVALID');
  }
  if (nonBlank(testcase?.caseId) && nonBlank(candidate?.caseId) && testcase.caseId !== candidate.caseId) {
    addProblem(problems, seenProblems, 'SETUP_CASE_MISMATCH');
  }

  const sourceSteps = Array.isArray(candidate?.steps) ? candidate.steps : [];
  const stepRecords = [];
  const seenIntentIds = new Set();

  sourceSteps.forEach((step, index) => {
    if (!isRecord(step) || !nonBlank(step.intentId) || !nonBlank(step.atom)
      || (Object.hasOwn(step, 'params') && !isRecord(step.params))) {
      addProblem(problems, seenProblems, 'SETUP_STEP_INVALID', { index });
      return;
    }
    if (seenIntentIds.has(step.intentId)) {
      addProblem(problems, seenProblems, 'SETUP_INTENT_ID_DUPLICATE', { intentId: step.intentId });
    }
    seenIntentIds.add(step.intentId);
    const definition = atomDefinitions[step.atom];
    stepRecords.push({
      index,
      step,
      definition: isRecord(definition) ? definition : null,
      key: stableStepKey(step, index),
    });
  });

  // Candidate 可携状态投影方便审阅，但无权改写 registry 真值。
  for (const record of stepRecords) {
    if (!record.definition) continue;
    const expected = projectionOf(record.definition);
    const declarations = [];
    if (Object.hasOwn(record.step, 'stateProjection')) declarations.push(record.step.stateProjection);
    const direct = directProjection(record.step);
    if (direct) declarations.push(direct);
    for (const declared of declarations) {
      if (!sameProjection(declared, expected)) {
        addProblem(problems, seenProblems, 'SETUP_STATE_PROJECTION_MISMATCH', {
          intentId: record.step.intentId,
          atom: record.step.atom,
        });
      }
    }
  }

  // 只做依赖图，不复制状态机：初态外的每个 requires 必须在本 candidate 中有唯一 provider。
  const initial = new Set(sortedStrings(initialStates));
  const edges = new Map(stepRecords.map((record) => [record.index, new Set()]));
  const indegree = new Map(stepRecords.map((record) => [record.index, 0]));
  for (const consumer of stepRecords) {
    if (!consumer.definition) continue;
    for (const state of sortedStrings(consumer.definition.requires)) {
      if (initial.has(state)) continue;
      const providers = stepRecords
        .filter((record) => record.definition && sortedStrings(record.definition.provides).includes(state))
        .sort(compareStepKeys);
      if (providers.length === 0) {
        addProblem(problems, seenProblems, 'SETUP_PROVIDER_MISSING', {
          intentId: consumer.step.intentId,
          atom: consumer.step.atom,
          state,
        });
        continue;
      }
      if (providers.length > 1) {
        addProblem(problems, seenProblems, 'SETUP_PROVIDER_AMBIGUOUS', {
          intentId: consumer.step.intentId,
          atom: consumer.step.atom,
          state,
          providerIntentIds: providers.map((record) => record.step.intentId),
        });
        continue;
      }
      const provider = providers[0];
      if (!edges.get(provider.index).has(consumer.index)) {
        edges.get(provider.index).add(consumer.index);
        indegree.set(consumer.index, indegree.get(consumer.index) + 1);
      }
    }
  }

  const byIndex = new Map(stepRecords.map((record) => [record.index, record]));
  const readyQueue = stepRecords
    .filter((record) => indegree.get(record.index) === 0)
    .sort(compareStepKeys);
  const ordered = [];
  while (readyQueue.length) {
    const current = readyQueue.shift();
    ordered.push(current);
    const consumers = [...edges.get(current.index)]
      .map((index) => byIndex.get(index))
      .sort(compareStepKeys);
    for (const consumer of consumers) {
      indegree.set(consumer.index, indegree.get(consumer.index) - 1);
      if (indegree.get(consumer.index) === 0) {
        readyQueue.push(consumer);
        readyQueue.sort(compareStepKeys);
      }
    }
  }

  const orderedIndexes = new Set(ordered.map((record) => record.index));
  const cyclic = stepRecords
    .filter((record) => !orderedIndexes.has(record.index))
    .sort(compareStepKeys);
  if (cyclic.length) {
    // 依赖环是图事实，即使环中 atom 同时无编译知识也必须单独报告。
    addProblem(problems, seenProblems, 'SETUP_DEPENDENCY_CYCLE', {
      intentIds: cyclic.map((record) => record.step.intentId),
    });
    ordered.push(...cyclic);
  }

  // capability 检查刻意晚于 cycle 检查，避免“不可编译”遮住真实依赖环。
  for (const record of stepRecords) {
    if (record.step.atom === 'login') {
      addProblem(problems, seenProblems, 'SETUP_LOGIN_FORBIDDEN', { intentId: record.step.intentId });
    } else if (!record.definition) {
      addProblem(problems, seenProblems, 'SETUP_ATOM_UNKNOWN', {
        intentId: record.step.intentId,
        atom: record.step.atom,
      });
    } else if (!isCompilableAtom(record.step.atom)) {
      addProblem(problems, seenProblems, 'SETUP_ATOM_NOT_COMPILABLE', {
        intentId: record.step.intentId,
        atom: record.step.atom,
      });
    } else if (sortedStrings(record.definition.provides).length === 0) {
      // setup 的完成条件必须可 readback；只有 action unique、没有业务状态产物不能证明前置条件已完成。
      addProblem(problems, seenProblems, 'SETUP_ATOM_NO_VERIFIABLE_STATE', {
        intentId: record.step.intentId,
        atom: record.step.atom,
      });
    }
  }

  let flow = fallbackFlow(testcase);
  const orderedValidSteps = ordered.filter((record) => record.definition);
  try {
    flow = buildFlow(testcase, ordered.map((record) => mappingEntry(record.step)));
  } catch (error) {
    const detail = String(error?.message || error);
    addProblem(problems, seenProblems, 'SETUP_FLOW_BUILD_INVALID', {
      detail,
    });
    if (/entityBindings|candidateId|role|subject|source|target/.test(detail)) {
      addProblem(problems, seenProblems, 'SETUP_ENTITY_BINDINGS_INVALID', {
        reason: 'ENTITY_BINDING_SHAPE_INVALID',
      });
    }
    try {
      flow = buildFlow(testcase, orderedValidSteps.map((record) => mappingEntry(record.step)));
    } catch {
      flow = fallbackFlow(testcase);
    }
  }

  if (ordered.length === orderedValidSteps.length && ordered.length > 0) {
    for (const detail of validateStructural(flow, registry)) {
      addProblem(problems, seenProblems, 'SETUP_FLOW_STRUCTURAL_INVALID', { detail });
    }
    for (const detail of checkDestructivePrefix(flow, registry, testcase?.uniquePrefix)) {
      addProblem(problems, seenProblems, 'SETUP_DESTRUCTIVE_PREFIX_INVALID', { detail });
    }
  }

  const bindingGate = requiredFlowEntityBindings(flow);
  if (!Array.isArray(bindingGate)) {
    addProblem(problems, seenProblems, 'SETUP_ENTITY_BINDINGS_INVALID', {
      reason: bindingGate?.reason || 'ENTITY_BINDING_POLICY_INVALID',
    });
  }
  for (const record of orderedValidSteps) {
    const observationPolicy = ENTITY_OBSERVATION_REGISTRY.get(record.step.atom);
    if (!observationPolicy) continue;
    const actualRoles = sortedStrings(record.step.entityBindings?.map((binding) => binding?.role));
    const requiredRoles = sortedStrings(observationPolicy.requiredRoles);
    if (actualRoles.length !== requiredRoles.length
      || actualRoles.some((role, index) => role !== requiredRoles[index])) {
      addProblem(problems, seenProblems, 'SETUP_IDENTITY_ROLE_CONFLICT', {
        intentId: record.step.intentId,
        atom: record.step.atom,
        route: 'human',
      });
    }
  }

  let stateTrace = emptyTrace(initialStates);
  if (ordered.length === orderedValidSteps.length) {
    try {
      stateTrace = traceStateMachine(flow, registry, initialStates);
      for (const detail of stateTrace.problems) {
        addProblem(problems, seenProblems, 'SETUP_STATE_TRACE_INVALID', { detail });
      }
    } catch (error) {
      addProblem(problems, seenProblems, 'SETUP_STATE_TRACE_INVALID', {
        detail: String(error?.message || error),
      });
    }
  }

  const finalStates = new Set(stateTrace.finalStates);
  const producedBySetup = new Set();
  for (const record of orderedValidSteps) {
    for (const state of sortedStrings(record.definition.provides)) {
      if (finalStates.has(state) && !initial.has(state)) producedBySetup.add(state);
    }
  }
  const providedStates = [...producedBySetup].sort();
  const goalStates = sortedStrings(candidate?.goalStates);
  const businessPreconditions = sortedStrings(testcase?.preconditions)
    .filter((state) => !TRUSTED_BOOTSTRAP_STATES.has(state));
  for (const state of businessPreconditions) {
    if (!goalStates.includes(state)) {
      addProblem(problems, seenProblems, 'SETUP_PRECONDITION_GOAL_MISSING', { state });
    }
  }
  for (const state of goalStates) {
    const genuinelyAvailable = initial.has(state) || producedBySetup.has(state);
    if (!genuinelyAvailable || !finalStates.has(state)) {
      addProblem(problems, seenProblems, 'SETUP_GOAL_UNSATISFIED', { state });
    }
  }
  for (const state of businessPreconditions) {
    if (!providedStates.includes(state) || !finalStates.has(state)) {
      addProblem(problems, seenProblems, 'SETUP_PRECONDITION_UNVERIFIED', { state });
    }
  }

  return {
    schemaVersion: 1,
    artifactKind: 'setup-flow-plan',
    caseId: nonBlank(candidate?.caseId) ? candidate.caseId : (testcase?.caseId ?? null),
    ready: problems.length === 0,
    orderedIntentIds: ordered.map((record) => record.step.intentId),
    flow,
    initialStates,
    stateTrace,
    providedStates,
    problems,
  };
}

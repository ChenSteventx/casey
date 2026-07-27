// Pure main-flow and identity-resolution support for setup receipt admission.
// Session lifecycle and receipt authorization remain owned by setup-receipt.mjs.
import { createHash } from 'node:crypto';
import { buildFlow, validateBridge } from '../flow-bridge.mjs';
import { traceStateMachine } from '../compile-gate.mjs';
import { ENTITY_OBSERVATION_REGISTRY } from '../entity-observation-registry.mjs';
import {
  HASH_RE,
  OBSERVATION_ROW_KEYS,
  OBSERVATION_SOURCE_KEYS,
  OBSERVATION_TOP_KEYS,
  ROLES,
  TRUSTED_BOOTSTRAP_STATES,
  hasClosedDataShape,
  isPlainRecord,
  issue,
  nonEmpty,
} from './setup-receipt-shape.mjs';

function initialStatesFor(testcase, providedStates = []) {
  const out = [];
  const seen = new Set();
  const bootstrap = (Array.isArray(testcase?.preconditions) ? testcase.preconditions : [])
    .filter((state) => TRUSTED_BOOTSTRAP_STATES.has(state));
  for (const state of [...bootstrap, ...providedStates]) {
    if (!nonEmpty(state) || seen.has(state)) continue;
    seen.add(state);
    out.push(state);
  }
  return out;
}

function inspectMainMappingBindings(mainMapping) {
  if (!Array.isArray(mainMapping)) return false;
  for (const entry of mainMapping) {
    if (!isPlainRecord(entry)) return false;
    if (!Object.hasOwn(entry, 'entityBindings')) continue;
    if (!Array.isArray(entry.entityBindings)) return false;
    for (const binding of entry.entityBindings) {
      if (!hasClosedDataShape(binding, new Set(['candidateId', 'role']))
        || !nonEmpty(binding.candidateId)
        || !ROLES.has(binding.role)) return false;
    }
  }
  return true;
}

export function mainFacts(testcase, mainMapping, registry, providedStates = []) {
  const initialStates = initialStatesFor(testcase, providedStates);
  let mainFlow = null;
  let stateTrace = { steps: [], finalStates: [...initialStates], problems: [] };
  const problems = [];
  if (!inspectMainMappingBindings(mainMapping)) {
    problems.push(issue('SETUP_MAIN_MAPPING_IDENTITY_BINDING_INVALID'));
    return { initialStates, mainFlow, stateTrace, problems };
  }
  try {
    const augmentedTestcase = {
      ...structuredClone(testcase),
      preconditions: [...initialStates],
    };
    const bridge = validateBridge(augmentedTestcase, mainMapping, { registry });
    if (!bridge.ok) {
      problems.push(...bridge.problems.map((message) => issue('SETUP_MAIN_BRIDGE_REJECTED', { message })));
    }
    mainFlow = buildFlow(testcase, mainMapping);
    stateTrace = traceStateMachine(mainFlow, registry, initialStates);
    if (stateTrace.problems.length > 0) {
      problems.push(...stateTrace.problems.map(
        (message) => issue('SETUP_MAIN_STATE_TRACE_REJECTED', { message }),
      ));
    }
  } catch {
    problems.push(issue('SETUP_MAIN_FLOW_INVALID'));
  }
  return { initialStates, mainFlow, stateTrace, problems };
}

function parseObservationArtifact(bytes, caseId) {
  if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)) {
    return { ok: false, problem: issue('SETUP_IDENTITY_OBSERVATION_BYTES_REQUIRED') };
  }
  let doc;
  try { doc = JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch { return { ok: false, problem: issue('SETUP_IDENTITY_OBSERVATION_PARSE_FAILED') }; }
  if (!hasClosedDataShape(doc, OBSERVATION_TOP_KEYS)
    || doc.schemaVersion !== 1
    || doc.artifactKind !== 'compile-identity-observation'
    || doc.caseId !== caseId
    || !(doc.capturedAgainstBuild === null || nonEmpty(doc.capturedAgainstBuild))
    || !HASH_RE.test(doc.identityProfileDigest || '')
    || !HASH_RE.test(doc.eventsSha256 || '')
    || !hasClosedDataShape(doc.source, OBSERVATION_SOURCE_KEYS)
    || doc.source.kind !== 'compile-envelope'
    || !nonEmpty(doc.source.atom)
    || doc.source.signed !== false
    || doc.source.replayReady !== false
    || !Array.isArray(doc.observations)
    || doc.observations.length === 0) {
    return { ok: false, problem: issue('SETUP_IDENTITY_OBSERVATION_SHAPE_INVALID') };
  }
  for (const row of doc.observations) {
    if (!hasClosedDataShape(row, OBSERVATION_ROW_KEYS)
      || !['kind', 'name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'atom',
        'evidenceStepId', 'sourcePath']
        .every((field) => nonEmpty(row[field]))
      || !ROLES.has(row.role)) {
      return { ok: false, problem: issue('SETUP_IDENTITY_OBSERVATION_ROW_INVALID') };
    }
    if (row.atom !== doc.source.atom) {
      return { ok: false, problem: issue('SETUP_IDENTITY_OBSERVATION_SOURCE_MISMATCH') };
    }
  }
  return {
    ok: true,
    doc,
    sha256: `sha256:${createHash('sha256').update(Buffer.from(bytes)).digest('hex')}`,
  };
}

export function resolveIdentityRefs({ refs, bytes, caseId, planFacts }) {
  if (!Array.isArray(refs) || refs.length === 0) return { ok: true, identities: [] };
  const artifact = parseObservationArtifact(bytes, caseId);
  if (!artifact.ok) return { ok: false, problems: [artifact.problem], identities: [] };
  const identities = [];
  const problems = [];
  for (const ref of refs) {
    if (ref.artifactSha256 !== artifact.sha256) {
      problems.push(issue('SETUP_IDENTITY_OBSERVATION_HASH_MISMATCH'));
      continue;
    }
    const matches = artifact.doc.observations.filter(
      (row) => row.sourceIntentId === ref.sourceIntentId
        && row.candidateId === ref.candidateId
        && row.role === ref.role
        && row.atom === ref.atom
        && row.evidenceStepId === ref.evidenceStepId,
    );
    if (matches.length !== 1) {
      problems.push(issue('SETUP_IDENTITY_OBSERVATION_NOT_UNIQUE', {
        sourceIntentId: ref.sourceIntentId,
      }));
      continue;
    }
    const row = matches[0];
    const setupStep = planFacts.expectedByIntent.get(ref.sourceIntentId);
    const policy = ENTITY_OBSERVATION_REGISTRY.get(ref.atom);
    const expectedName = setupStep?.params?.openName;
    const expectedCode = setupStep?.params?.code;
    if (!policy
      || artifact.doc.source.kind !== policy.issuer.sourceKind
      || artifact.doc.source.atom !== policy.issuer.atom
      || row.kind !== policy.boundKind
      || !nonEmpty(expectedName)
      || !nonEmpty(expectedCode)
      || row.name !== expectedName
      || row.code !== expectedCode) {
      problems.push(issue('SETUP_IDENTITY_NAME_OR_CODE_MISMATCH', {
        sourceIntentId: ref.sourceIntentId,
      }));
      continue;
    }
    identities.push({ ...row });
  }
  return { ok: problems.length === 0, problems, identities };
}

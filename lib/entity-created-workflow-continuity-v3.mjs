// Created-workflow continuity v3 authority and runtime guard.
// Pure core: no filesystem, browser, network, or LLM access.

import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import { evaluateStableTargetAbsence } from './entity-destructive-continuity.mjs';
import { readReplayGrantHandle } from './entity-created-workflow-replay-grant.mjs';

const DRAFT_STATE = new WeakMap();
const AUTHORITY_STATE = new WeakMap();
const OBSERVATION_STATE = new WeakMap();
const REF_STATE = new WeakMap();

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const EDGE_KEYS = Object.freeze([
  'create', 'delete', 'listApiScope', 'nameTemplate', 'consume', 'mutationAdapter',
]);
const ENDPOINT_KEYS = Object.freeze([
  'intentId', 'stepId', 'atom', 'candidateId', 'role',
]);
const ADAPTER_KEYS = Object.freeze(['method', 'path', 'idLocation']);
const DRAFT_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'authorizedFor', 'caseId', 'signed',
  'eventsSha256', 'flowSha256', 'testcaseSha256', 'profileSha256', 'ownershipEdges',
]);
const AUTHORITY_KEYS = Object.freeze([
  ...DRAFT_KEYS, 'signerId', 'signedAt', 'audience', 'signature',
]);
const SOURCE_BYTE_FIELDS = Object.freeze([
  ['eventsBytes', 'eventsSha256'],
  ['flowBytes', 'flowSha256'],
  ['testcaseBytes', 'testcaseSha256'],
  ['profileBytes', 'profileSha256'],
]);

const frozen = (value) => Object.freeze(value);
const denied = (reason, extra = {}) => frozen({ ok: false, ...extra, reason });
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

function plainRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  let descriptors;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  const out = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') return null;
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out[key] = descriptor.value;
  }
  return out;
}

function exactKeys(value, keys) {
  const record = plainRecord(value);
  if (!record) return null;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

function deepFreeze(value, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value == null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function digestBytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function digestValue(value) {
  return digestBytes(Buffer.from(JSON.stringify(canonical(value)), 'utf8'));
}

function copyBytes(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array ? Buffer.from(value) : null;
}

function parseJsonBytes(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

function flowBody(document) {
  const outer = plainRecord(document);
  if (!outer) return null;
  const nested = plainRecord(outer.flow);
  return nested && Array.isArray(nested.steps) ? nested : outer;
}

function valueAt(root, dottedPath) {
  if (!nonEmpty(dottedPath)) return undefined;
  return dottedPath.split('.').reduce((value, key) => (
    value != null && typeof value === 'object' ? value[key] : undefined
  ), root);
}

function containsRuntimeId(value, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const record = Array.isArray(value) ? null : plainRecord(value);
  if (!Array.isArray(value) && !record) return true;
  if (record && (Object.hasOwn(record, 'platformId') || Object.hasOwn(record, 'runtimeId'))) return true;
  return Object.values(record || value).some((child) => containsRuntimeId(child, seen));
}

function normalizeEndpoint(value, expectedAtom) {
  const row = exactKeys(value, ENDPOINT_KEYS);
  if (!row || !ENDPOINT_KEYS.every((key) => nonEmpty(row[key]))) return null;
  if (row.atom !== expectedAtom || row.role !== 'subject') return null;
  return {
    intentId: row.intentId,
    stepId: row.stepId,
    atom: row.atom,
    candidateId: row.candidateId,
    role: row.role,
  };
}

function normalizeAdapter(value) {
  const row = exactKeys(value, ADAPTER_KEYS);
  if (!row || !ADAPTER_KEYS.every((key) => nonEmpty(row[key]))) return null;
  if (row.method !== row.method.toUpperCase() || !row.path.startsWith('/')) return null;
  if (!/^(?:body|query)(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(row.idLocation)) return null;
  return { method: row.method, path: row.path, idLocation: row.idLocation };
}

function normalizeEdge(value) {
  const row = exactKeys(value, EDGE_KEYS);
  if (!row || !nonEmpty(row.listApiScope) || !nonEmpty(row.nameTemplate)
    || !row.nameTemplate.includes('{{uniqueName}}') || row.consume !== 'once') return null;
  const create = normalizeEndpoint(row.create, 'workflow.create');
  const deletion = normalizeEndpoint(row.delete, 'workflow.deleteByName');
  const mutationAdapter = normalizeAdapter(row.mutationAdapter);
  if (!create || !deletion || !mutationAdapter || create.candidateId !== deletion.candidateId) return null;
  return {
    create,
    delete: deletion,
    listApiScope: row.listApiScope,
    nameTemplate: row.nameTemplate,
    consume: 'once',
    mutationAdapter,
  };
}

function normalizeEdges(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const edges = [];
  const createSteps = new Set();
  const deleteSteps = new Set();
  for (const raw of value) {
    const edge = normalizeEdge(raw);
    if (!edge || createSteps.has(edge.create.stepId) || deleteSteps.has(edge.delete.stepId)) return null;
    createSteps.add(edge.create.stepId);
    deleteSteps.add(edge.delete.stepId);
    edges.push(edge);
  }
  return edges;
}

function sameEndpoint(left, right) {
  return ENDPOINT_KEYS.every((key) => left?.[key] === right?.[key]);
}

function sourceDocumentsSupportEdges(caseId, bytesByField, edges) {
  const events = parseJsonBytes(bytesByField.eventsBytes);
  const flowDocument = parseJsonBytes(bytesByField.flowBytes);
  const flow = flowBody(flowDocument);
  const testcase = parseJsonBytes(bytesByField.testcaseBytes);
  const profile = parseJsonBytes(bytesByField.profileBytes);
  if (!plainRecord(events) || !plainRecord(flow) || !plainRecord(testcase) || !plainRecord(profile)) return false;
  if (events.caseId !== caseId || flow.id !== caseId || testcase.caseId !== caseId) return false;
  if (!Array.isArray(events.events) || !Array.isArray(flow.steps)) return false;
  for (const edge of edges) {
    for (const endpoint of [edge.create, edge.delete]) {
      const event = events.events.find((row) => row?.stepId === endpoint.stepId
        && row?.intentId === endpoint.intentId && row?.atom === endpoint.atom);
      const step = flow.steps.find((row) => row?.sourceIntentId === endpoint.intentId
        && row?.atom === endpoint.atom
        && (row?.stepId === undefined || row.stepId === endpoint.stepId));
      const bindings = Array.isArray(step?.entityBindings) ? step.entityBindings : [];
      if (!event || bindings.length !== 1
        || bindings[0]?.candidateId !== endpoint.candidateId || bindings[0]?.role !== endpoint.role) return false;
    }
  }
  return true;
}

function terminalEventsFor(events, semanticStep) {
  return events.filter((event) => event?.intentId === semanticStep?.sourceIntentId
    && event?.atom === semanticStep?.atom
    && event?.compilePhase === 'terminal');
}

export function issueCreatedWorkflowCompileProvenance(options, legacyFlowBytes) {
  const input = copyBytes(options)
    ? { eventsBytes: options, confirmedFlowBytes: legacyFlowBytes }
    : plainRecord(options);
  const eventsBytes = copyBytes(input?.eventsBytes);
  const flowBytes = copyBytes(input?.confirmedFlowBytes ?? input?.flowBytes);
  if (!eventsBytes || !flowBytes) return denied('CREATED_WORKFLOW_PROVENANCE_SOURCE_BYTES_INVALID');
  const eventsDocument = parseJsonBytes(eventsBytes);
  const flowDocument = parseJsonBytes(flowBytes);
  const flow = flowBody(flowDocument);
  const caseId = input?.caseId ?? eventsDocument?.caseId;
  if (!plainRecord(eventsDocument) || !plainRecord(flow) || !nonEmpty(caseId)
    || eventsDocument.caseId !== caseId || flow.id !== caseId
    || !Array.isArray(eventsDocument.events) || !Array.isArray(flow.steps)) {
    return denied('CREATED_WORKFLOW_PROVENANCE_SOURCE_INVALID');
  }
  const mappings = [];
  for (const step of flow.steps.filter((row) => (
    row?.atom === 'workflow.create' || row?.atom === 'workflow.deleteByName'
  ))) {
    const terminal = terminalEventsFor(eventsDocument.events, step);
    if (terminal.length !== 1 || !nonEmpty(step.sourceIntentId)) {
      return denied('CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID');
    }
    mappings.push({
      atom: step.atom,
      sourceIntentId: step.sourceIntentId,
      terminalStepId: terminal[0].stepId,
    });
  }
  if (!mappings.length) return denied('CREATED_WORKFLOW_PROVENANCE_EDGE_MISSING');
  const provenance = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'created-workflow-compile-provenance',
    caseId,
    eventsSha256: digestBytes(eventsBytes),
    flowSha256: digestBytes(flowBytes),
    mappings,
  });
  return frozen({ ok: true, provenance });
}

export function prepareCreatedWorkflowOwnershipDraft(options) {
  const input = plainRecord(options);
  if (!input || !nonEmpty(input.caseId)) return denied('CREATED_WORKFLOW_PREPARE_INPUT_INVALID');
  const eventsBytes = copyBytes(input.eventsBytes);
  const flowBytes = copyBytes(input.flowBytes ?? input.confirmedFlowBytes);
  const testcaseBytes = copyBytes(input.testcaseBytes);
  const profileBytes = copyBytes(input.profileBytes);
  const provenanceBytes = copyBytes(input.compileProvenanceBytes);
  if (![eventsBytes, flowBytes, testcaseBytes, profileBytes, provenanceBytes].every(Boolean)) {
    return denied('CREATED_WORKFLOW_PREPARE_SOURCE_BYTES_INVALID');
  }
  const issued = issueCreatedWorkflowCompileProvenance({
    caseId: input.caseId,
    eventsBytes,
    confirmedFlowBytes: flowBytes,
  });
  const suppliedProvenance = parseJsonBytes(provenanceBytes);
  if (!issued.ok || digestValue(issued.provenance) !== digestValue(suppliedProvenance)) {
    return denied('CREATED_WORKFLOW_PREPARE_PROVENANCE_MISMATCH');
  }
  const flow = flowBody(parseJsonBytes(flowBytes));
  const profile = parseJsonBytes(profileBytes);
  const workflowProfile = plainRecord(profile?.workflows);
  const listApi = plainRecord(workflowProfile?.listApi);
  const mutation = plainRecord(workflowProfile?.mutationAdapter ?? workflowProfile?.deleteApi);
  const adapter = mutation && normalizeAdapter({
    method: mutation.method,
    path: mutation.path ?? mutation.pathname,
    idLocation: mutation.idLocation,
  });
  if (!flow || !listApi || !nonEmpty(listApi.pathname) || !adapter) {
    return denied('CREATED_WORKFLOW_PREPARE_PROFILE_ADAPTER_INVALID');
  }
  const mappings = new Map(suppliedProvenance.mappings.map((row) => [
    `${row.atom}\u0000${row.sourceIntentId}`,
    row,
  ]));
  const creates = flow.steps.filter((row) => row?.atom === 'workflow.create');
  const deletions = flow.steps.filter((row) => row?.atom === 'workflow.deleteByName');
  const ownershipEdges = [];
  for (const createStep of creates) {
    const createBindings = Array.isArray(createStep.entityBindings) ? createStep.entityBindings : [];
    const subject = createBindings.length === 1 && createBindings[0]?.role === 'subject'
      ? createBindings[0]
      : null;
    const deletionStep = subject && deletions.find((row) => {
      const bindings = Array.isArray(row?.entityBindings) ? row.entityBindings : [];
      return bindings.length === 1 && bindings[0]?.role === 'subject'
        && bindings[0]?.candidateId === subject.candidateId;
    });
    const createMap = mappings.get(`workflow.create\u0000${createStep.sourceIntentId}`);
    const deleteMap = deletionStep
      ? mappings.get(`workflow.deleteByName\u0000${deletionStep.sourceIntentId}`)
      : null;
    const nameTemplate = createStep?.params?.name;
    if (!subject || !deletionStep || !createMap || !deleteMap || !nonEmpty(nameTemplate)
      || deletionStep?.params?.name !== nameTemplate) {
      return denied('CREATED_WORKFLOW_PREPARE_EDGE_INVALID');
    }
    ownershipEdges.push({
      create: {
        intentId: createStep.sourceIntentId,
        stepId: createMap.terminalStepId,
        atom: 'workflow.create',
        candidateId: subject.candidateId,
        role: 'subject',
      },
      delete: {
        intentId: deletionStep.sourceIntentId,
        stepId: deleteMap.terminalStepId,
        atom: 'workflow.deleteByName',
        candidateId: subject.candidateId,
        role: 'subject',
      },
      listApiScope: listApi.pathname,
      nameTemplate,
      consume: 'once',
      mutationAdapter: adapter,
    });
  }
  if (!ownershipEdges.length || ownershipEdges.length !== deletions.length) {
    return denied('CREATED_WORKFLOW_PREPARE_EDGE_SET_INVALID');
  }
  return authorCreatedWorkflowOwnershipDraft({
    caseId: input.caseId,
    eventsBytes,
    flowBytes,
    testcaseBytes,
    profileBytes,
    ownershipEdges,
  });
}

function draftShape(value) {
  const draft = exactKeys(value, DRAFT_KEYS);
  if (!draft || draft.schemaVersion !== 3
    || draft.artifactKind !== 'created-workflow-ownership-authority'
    || draft.authorizedFor !== 'created-workflow-continuity'
    || draft.signed !== false || !nonEmpty(draft.caseId)) return null;
  for (const [, digestField] of SOURCE_BYTE_FIELDS) if (!DIGEST_RE.test(draft[digestField] || '')) return null;
  const ownershipEdges = normalizeEdges(draft.ownershipEdges);
  if (!ownershipEdges || containsRuntimeId(draft)) return null;
  return { ...draft, ownershipEdges };
}

function unsignedAuthority(authority) {
  return Object.fromEntries(Object.entries(authority).filter(([key]) => key !== 'signature'));
}

function authorityShape(value) {
  const authority = exactKeys(value, AUTHORITY_KEYS);
  if (!authority || authority.schemaVersion !== 3
    || authority.artifactKind !== 'created-workflow-ownership-authority'
    || authority.authorizedFor !== 'created-workflow-continuity'
    || authority.signed !== true || !nonEmpty(authority.caseId)
    || !nonEmpty(authority.signerId) || !nonEmpty(authority.signedAt) || !nonEmpty(authority.audience)
    || !DIGEST_RE.test(authority.signature || '')) return null;
  for (const [, digestField] of SOURCE_BYTE_FIELDS) if (!DIGEST_RE.test(authority[digestField] || '')) return null;
  const ownershipEdges = normalizeEdges(authority.ownershipEdges);
  if (!ownershipEdges || containsRuntimeId(authority)) return null;
  const normalized = { ...authority, ownershipEdges };
  return authority.signature === digestValue(unsignedAuthority(normalized)) ? normalized : null;
}

export function authorCreatedWorkflowOwnershipDraft(options) {
  const input = plainRecord(options);
  if (!input || !nonEmpty(input.caseId) || !Array.isArray(input.ownershipEdges)) {
    return denied('CREATED_WORKFLOW_AUTHORITY_AUTHOR_INPUT_INVALID');
  }
  const ownershipEdges = normalizeEdges(input.ownershipEdges);
  if (!ownershipEdges || containsRuntimeId(input.ownershipEdges)) {
    return denied('CREATED_WORKFLOW_AUTHORITY_EDGE_INVALID');
  }
  const sourceBytes = Object.create(null);
  const sourceDigests = Object.create(null);
  for (const [bytesField, digestField] of SOURCE_BYTE_FIELDS) {
    const bytes = copyBytes(input[bytesField]);
    if (!bytes || bytes.length === 0) return denied('CREATED_WORKFLOW_AUTHORITY_SOURCE_BYTES_INVALID');
    sourceBytes[bytesField] = bytes;
    sourceDigests[digestField] = digestBytes(bytes);
  }
  if (!sourceDocumentsSupportEdges(input.caseId, sourceBytes, ownershipEdges)) {
    return denied('CREATED_WORKFLOW_AUTHORITY_SOURCE_LINEAGE_INVALID');
  }
  const draft = deepFreeze({
    schemaVersion: 3,
    artifactKind: 'created-workflow-ownership-authority',
    authorizedFor: 'created-workflow-continuity',
    caseId: input.caseId,
    signed: false,
    ...sourceDigests,
    ownershipEdges,
  });
  DRAFT_STATE.set(draft, frozen({ caseId: input.caseId }));
  return frozen({ ok: true, draft });
}

export function freezeCreatedWorkflowOwnershipAuthority(options) {
  const input = plainRecord(options);
  if (!input || !DRAFT_STATE.has(input.draft) || !nonEmpty(input.signerId)
    || !nonEmpty(input.signedAt) || !nonEmpty(input.audience)) {
    return denied('CREATED_WORKFLOW_AUTHORITY_SIGN_INPUT_INVALID');
  }
  const draft = draftShape(input.draft);
  if (!draft) return denied('CREATED_WORKFLOW_AUTHORITY_DRAFT_INVALID');
  const unsigned = {
    ...draft,
    signed: true,
    signerId: input.signerId,
    signedAt: input.signedAt,
    audience: input.audience,
  };
  const authority = deepFreeze({ ...unsigned, signature: digestValue(unsigned) });
  return frozen({ ok: true, authority });
}

export function readCreatedWorkflowOwnershipAuthority(options) {
  const input = plainRecord(options);
  if (!input || !nonEmpty(input.caseId)) return denied('CREATED_WORKFLOW_AUTHORITY_READ_INPUT_INVALID');
  const authorityBytes = copyBytes(input.authorityBytes);
  if (!authorityBytes || authorityBytes.length === 0) return denied('CREATED_WORKFLOW_AUTHORITY_BYTES_INVALID');
  const parsed = parseJsonBytes(authorityBytes);
  const authority = authorityShape(parsed);
  if (!authority || authority.caseId !== input.caseId) return denied('CREATED_WORKFLOW_AUTHORITY_INVALID');
  for (const [bytesField, digestField] of SOURCE_BYTE_FIELDS) {
    const bytes = copyBytes(input[bytesField]);
    if (!bytes || digestBytes(bytes) !== authority[digestField]) {
      return denied('CREATED_WORKFLOW_AUTHORITY_SOURCE_BYTES_MISMATCH');
    }
  }
  const handle = frozen(Object.create(null));
  AUTHORITY_STATE.set(handle, deepFreeze({ authority }));
  return frozen({ ok: true, handle, audience: authority.audience });
}

export function checkCreatedWorkflowOwnershipPreflight(options) {
  const input = plainRecord(options);
  const state = input ? AUTHORITY_STATE.get(input.handle) : null;
  if (!state || !nonEmpty(input.caseId) || state.authority.caseId !== input.caseId) {
    return denied('CREATED_WORKFLOW_PREFLIGHT_AUTHORITY_INVALID', { allowExecution: false });
  }
  const create = normalizeEndpoint(input.create, 'workflow.create');
  const deletion = normalizeEndpoint(input.deletion, 'workflow.deleteByName');
  if (!create || !deletion) return denied('CREATED_WORKFLOW_PREFLIGHT_EDGE_INVALID', { allowExecution: false });
  const edge = state.authority.ownershipEdges.find((row) => sameEndpoint(row.create, create)
    && sameEndpoint(row.delete, deletion));
  if (!edge) return denied('CREATED_WORKFLOW_PREFLIGHT_EDGE_NOT_AUTHORIZED', { allowExecution: false });
  return frozen({ ok: true, allowExecution: true });
}

function normalizeCreate(value) {
  return normalizeEndpoint(value, 'workflow.create');
}

export function issueCreatedWorkflowRuntimeObservation(options) {
  const input = plainRecord(options);
  if (!input || !nonEmpty(input.caseId) || !nonEmpty(input.runId)
    || !nonEmpty(input.batchToken) || !nonEmpty(input.uniqueNameToken)
    || !nonEmpty(input.entityName) || !DIGEST_RE.test(input.identityProfileDigest || '')) {
    return denied('CREATED_WORKFLOW_OBSERVATION_INPUT_INVALID');
  }
  const create = normalizeCreate(input.create);
  const scan = plainRecord(input.scan);
  if (!create || !scan || scan.complete !== true || scan.correlatable !== true
    || scan.hasNext !== false || scan.cursor !== null || !Number.isSafeInteger(scan.total)
    || scan.total < 0 || !Array.isArray(scan.records) || scan.total !== scan.records.length) {
    return denied('CREATED_WORKFLOW_OBSERVATION_SCAN_INCOMPLETE');
  }
  const records = [];
  for (const raw of scan.records) {
    const record = exactKeys(raw, ['id', 'code', 'name']);
    if (!record || !nonEmpty(record.id) || !nonEmpty(record.code) || !nonEmpty(record.name)) {
      return denied('CREATED_WORKFLOW_OBSERVATION_RECORD_INVALID');
    }
    records.push({ id: record.id, code: record.code, name: record.name });
  }
  const matches = records.filter((record) => record.name === input.entityName);
  if (matches.length !== 1) return denied('CREATED_WORKFLOW_OBSERVATION_NAME_NOT_UNIQUE');
  if (!input.uniqueNameToken.startsWith(`${input.batchToken}-`)) {
    return denied('CREATED_WORKFLOW_OBSERVATION_TOKEN_LINEAGE_INVALID');
  }
  const unsigned = {
    schemaVersion: 1,
    artifactKind: 'created-workflow-runtime-observation',
    caseId: input.caseId,
    runId: input.runId,
    batchToken: input.batchToken,
    uniqueNameToken: input.uniqueNameToken,
    entityName: input.entityName,
    platformId: matches[0].id,
    entityCode: matches[0].code,
    create,
    identityProfileDigest: input.identityProfileDigest,
    scanProof: {
      complete: true,
      correlatable: true,
      total: scan.total,
      hasNext: false,
      cursor: null,
    },
  };
  const observation = deepFreeze({ ...unsigned, observationDigest: digestValue(unsigned) });
  OBSERVATION_STATE.set(observation, frozen({ observation }));
  return frozen({ ok: true, observation });
}

function renderName(template, uniqueNameToken) {
  return template.split('{{uniqueName}}').join(uniqueNameToken);
}

export function resolveCreatedWorkflowDeletionRef(options) {
  const input = plainRecord(options);
  const authorityState = input ? AUTHORITY_STATE.get(input.authority) : null;
  const observationState = input ? OBSERVATION_STATE.get(input.observation) : null;
  if (!authorityState || !observationState) return denied('CREATED_WORKFLOW_REF_AUTHORITY_OR_OBSERVATION_INVALID');
  const { authority } = authorityState;
  const { observation } = observationState;
  const deletion = normalizeEndpoint(input.deletion, 'workflow.deleteByName');
  if (!deletion || input.caseId !== authority.caseId || input.caseId !== observation.caseId
    || !nonEmpty(input.runId) || input.runId !== observation.runId) {
    return denied('CREATED_WORKFLOW_REF_LINEAGE_INVALID');
  }
  const edge = authority.ownershipEdges.find((row) => sameEndpoint(row.create, observation.create)
    && sameEndpoint(row.delete, deletion));
  if (!edge || renderName(edge.nameTemplate, observation.uniqueNameToken) !== observation.entityName) {
    return denied('CREATED_WORKFLOW_REF_EDGE_NOT_AUTHORIZED');
  }
  const ref = deepFreeze({
    schemaVersion: 1,
    caseId: input.caseId,
    runId: input.runId,
    batchToken: observation.batchToken,
    uniqueNameToken: observation.uniqueNameToken,
    entityName: observation.entityName,
    platformId: observation.platformId,
    createStepId: observation.create.stepId,
    deleteStepId: deletion.stepId,
    observationDigest: observation.observationDigest,
    listApiScope: edge.listApiScope,
    consume: edge.consume,
    mutationAdapter: edge.mutationAdapter,
  });
  REF_STATE.set(ref, {
    consumed: false,
    platformId: observation.platformId,
    atom: deletion.atom,
    mutationAdapter: edge.mutationAdapter,
  });
  return frozen({ ok: true, ref });
}

function requestPathAndQuery(url) {
  if (typeof url !== 'string' || url.length === 0) return null;
  try {
    const parsed = new URL(url, 'http://casey.invalid');
    const query = [];
    for (const [key, value] of parsed.searchParams) {
      if (/id$/i.test(key)) query.push({ location: `query.${key}`, value });
    }
    return { path: parsed.pathname, query };
  } catch {
    return null;
  }
}

function bodyIdOccurrences(value, prefix = 'body', seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => bodyIdOccurrences(child, `${prefix}.${index}`, seen));
  }
  const record = plainRecord(value);
  if (!record) return [{ location: `${prefix}.__invalid__`, value: undefined, invalid: true }];
  const out = [];
  for (const [key, child] of Object.entries(record)) {
    const location = `${prefix}.${key}`;
    if (/id$/i.test(key)) out.push({ location, value: child });
    if (child != null && typeof child === 'object') out.push(...bodyIdOccurrences(child, location, seen));
  }
  return out;
}

export async function runCreatedWorkflowGuardedMutation(options) {
  const abort = (reason) => denied(reason, { aborted: true, released: false, mutated: false });
  const input = plainRecord(options);
  const state = input ? REF_STATE.get(input.ref) : null;
  if (!state) return abort('CREATED_WORKFLOW_MUTATION_REF_INVALID');
  if (state.consumed) return abort('CREATED_WORKFLOW_MUTATION_REF_ALREADY_CONSUMED');
  if (input.atom !== state.atom) return abort('CREATED_WORKFLOW_MUTATION_ATOM_MISMATCH');
  if (typeof input.send !== 'function') return abort('CREATED_WORKFLOW_MUTATION_SEND_MISSING');
  const request = plainRecord(input.request);
  if (!request || request.method !== state.mutationAdapter.method) {
    return abort('CREATED_WORKFLOW_MUTATION_METHOD_MISMATCH');
  }
  const url = requestPathAndQuery(request.url);
  if (!url || url.path !== state.mutationAdapter.path) return abort('CREATED_WORKFLOW_MUTATION_PATH_MISMATCH');
  const occurrences = [...url.query, ...bodyIdOccurrences(request.body)];
  if (occurrences.length !== 1 || occurrences[0].location !== state.mutationAdapter.idLocation) {
    return abort('CREATED_WORKFLOW_MUTATION_ID_LOCATION_MISMATCH');
  }
  if (!nonEmpty(occurrences[0].value) || occurrences[0].value !== state.platformId) {
    return abort('CREATED_WORKFLOW_MUTATION_ID_MISMATCH');
  }
  state.consumed = true;
  try {
    const response = await input.send(input.request);
    return frozen({ ok: true, released: true, mutated: true, response });
  } catch {
    return frozen({ ok: false, aborted: false, released: true, mutated: null, reason: 'CREATED_WORKFLOW_MUTATION_SEND_FAILED' });
  }
}

function normalizeListApi(profile) {
  const workflow = plainRecord(profile?.workflows);
  const listApi = plainRecord(workflow?.listApi);
  const fields = plainRecord(listApi?.fields);
  if (!listApi || !fields || !nonEmpty(listApi.pathname) || !listApi.pathname.startsWith('/')
    || !['GET', 'POST'].includes(listApi.method) || !nonEmpty(listApi.recordsPath)
    || !nonEmpty(listApi.totalPath) || !nonEmpty(listApi.queryParam)
    || !nonEmpty(fields.id) || !nonEmpty(fields.code) || !nonEmpty(fields.name)) return null;
  return {
    pathname: listApi.pathname,
    method: listApi.method,
    recordsPath: listApi.recordsPath,
    totalPath: listApi.totalPath,
    hasNextPath: nonEmpty(listApi.hasNextPath) ? listApi.hasNextPath : null,
    cursorPath: nonEmpty(listApi.cursorPath) ? listApi.cursorPath : null,
    queryParam: listApi.queryParam,
    pageSize: Number.isSafeInteger(listApi.pageSize) && listApi.pageSize > 0 && listApi.pageSize <= 200
      ? listApi.pageSize
      : null,
    pageIndex: Number.isSafeInteger(listApi.pageIndex) && listApi.pageIndex > 0
      ? listApi.pageIndex
      : null,
    fields: { id: fields.id, code: fields.code, name: fields.name },
  };
}

export async function fetchCreatedWorkflowListScan(page, { profile, entityName } = {}) {
  const listApi = normalizeListApi(profile);
  if (!page || typeof page.evaluate !== 'function' || !listApi || !nonEmpty(entityName)) {
    return denied('CREATED_WORKFLOW_LIST_FETCH_INPUT_INVALID');
  }
  let raw;
  try {
    raw = await page.evaluate(async ({ adapter, query }) => {
      const init = { method: adapter.method, credentials: 'same-origin' };
      let url = adapter.pathname;
      if (adapter.method === 'GET') {
        const params = new URLSearchParams({ [adapter.queryParam]: query });
        if (adapter.pageSize !== null) params.set('pageSize', String(adapter.pageSize));
        if (adapter.pageIndex !== null) params.set('pageIndex', String(adapter.pageIndex));
        url = `${url}?${params.toString()}`;
      } else {
        init.headers = { 'content-type': 'application/json' };
        const body = { [adapter.queryParam]: query };
        if (adapter.pageSize !== null) body.pageSize = adapter.pageSize;
        if (adapter.pageIndex !== null) body.pageIndex = adapter.pageIndex;
        init.body = JSON.stringify(body);
      }
      const response = await fetch(url, init);
      const body = await response.json();
      return { ok: response.ok, status: response.status, body };
    }, { adapter: listApi, query: entityName });
  } catch {
    return denied('CREATED_WORKFLOW_LIST_FETCH_FAILED');
  }
  if (!raw?.ok || !plainRecord(raw.body)) return denied('CREATED_WORKFLOW_LIST_RESPONSE_INVALID');
  const sourceRecords = valueAt(raw.body, listApi.recordsPath);
  const total = valueAt(raw.body, listApi.totalPath);
  const hasNextValue = listApi.hasNextPath ? valueAt(raw.body, listApi.hasNextPath) : undefined;
  const cursorValue = listApi.cursorPath ? valueAt(raw.body, listApi.cursorPath) : undefined;
  if (!Array.isArray(sourceRecords) || !Number.isSafeInteger(total)) {
    return denied('CREATED_WORKFLOW_LIST_RESPONSE_SHAPE_INVALID');
  }
  const records = [];
  for (const source of sourceRecords) {
    const id = valueAt(source, listApi.fields.id);
    const code = valueAt(source, listApi.fields.code);
    const name = valueAt(source, listApi.fields.name);
    if (!nonEmpty(id) || !nonEmpty(code) || !nonEmpty(name)) {
      return denied('CREATED_WORKFLOW_LIST_RECORD_INVALID');
    }
    records.push({ id, code, name });
  }
  const hasNext = hasNextValue === undefined ? records.length < total : hasNextValue;
  const cursor = cursorValue === undefined ? null : cursorValue;
  const complete = hasNext === false && cursor === null && total === records.length;
  return frozen({
    ok: true,
    scan: {
      complete,
      correlatable: true,
      total,
      hasNext,
      cursor,
      records,
    },
  });
}

export function createCreatedWorkflowReplayContinuityController(options) {
  const input = plainRecord(options);
  const authorityState = input ? AUTHORITY_STATE.get(input.authority) : null;
  const profile = input?.profile;
  // 回放授权票据是必填（p9-replay-authority-split，fable 裁 Q2：授权闸下沉纯层）。
  // 结构授权边只说「哪条边可以删」，不说「这一批可以跑」；后者由票据表达，
  // 且必须在这里拦——只在 bin/replay.mjs 拦是命令行单点假门，旁路调用方绕得开。
  const grantState = input ? readReplayGrantHandle(input.grant) : null;
  if (!grantState) {
    return denied('CREATED_WORKFLOW_REPLAY_GRANT_MISSING', { allowLaunch: false });
  }
  if (!nonEmpty(input.caseId) || !grantState.caseIds.includes(input.caseId)) {
    return denied('CREATED_WORKFLOW_REPLAY_GRANT_CASE_NOT_AUTHORIZED', { allowLaunch: false });
  }
  if (!authorityState || !nonEmpty(input.caseId) || !nonEmpty(input.runId)
    || !nonEmpty(input.batchToken) || !nonEmpty(input.uniqueNameToken)
    || !input.uniqueNameToken.startsWith(`${input.batchToken}-`)
    || authorityState.authority.caseId !== input.caseId || !normalizeListApi(profile)) {
    return denied('CREATED_WORKFLOW_REPLAY_CONTROLLER_INPUT_INVALID', { allowLaunch: false });
  }
  const edges = authorityState.authority.ownershipEdges;
  if (edges.length !== 1) {
    return denied('CREATED_WORKFLOW_REPLAY_EDGE_COUNT_INVALID', { allowLaunch: false });
  }
  const edge = edges[0];
  const entityName = renderName(edge.nameTemplate, input.uniqueNameToken);
  let observation = null;
  let deletionRef = null;
  let deletionReleasedAt = null;
  const absenceSamples = [];

  const controller = {
    coveredIntentAtoms() {
      return frozen([
        frozen({ intentId: edge.create.intentId, atom: edge.create.atom }),
        frozen({ intentId: edge.delete.intentId, atom: edge.delete.atom }),
      ]);
    },
    createTerminalStepId: edge.create.stepId,
    deleteTerminalStepId: edge.delete.stepId,
    entityName,
    mutationRoutePattern() {
      return `**${edge.mutationAdapter.path}`;
    },
    captureCreatedScan(scan) {
      const issued = issueCreatedWorkflowRuntimeObservation({
        caseId: input.caseId,
        runId: input.runId,
        batchToken: input.batchToken,
        uniqueNameToken: input.uniqueNameToken,
        entityName,
        identityProfileDigest: authorityState.authority.profileSha256,
        create: edge.create,
        scan,
      });
      if (!issued.ok) return issued;
      const resolved = resolveCreatedWorkflowDeletionRef({
        authority: input.authority,
        observation: issued.observation,
        caseId: input.caseId,
        runId: input.runId,
        deletion: edge.delete,
      });
      if (!resolved.ok) return resolved;
      observation = issued.observation;
      deletionRef = resolved.ref;
      return frozen({ ok: true, platformId: deletionRef.platformId });
    },
    hasDeletionRef(stepId) {
      return stepId === edge.delete.stepId && deletionRef !== null;
    },
    async runGuardedDeletion({ stepId, request, send }) {
      if (stepId !== edge.delete.stepId || !deletionRef) {
        return denied('CREATED_WORKFLOW_REPLAY_DELETION_REF_MISSING', {
          aborted: true, released: false, mutated: false,
        });
      }
      const result = await runCreatedWorkflowGuardedMutation({
        atom: edge.delete.atom,
        ref: deletionRef,
        request,
        send,
      });
      if (result.ok && result.released) deletionReleasedAt = Date.now();
      return result;
    },
    recordAbsenceScan(scan, observedAt = Date.now()) {
      if (!deletionRef || deletionReleasedAt === null || !plainRecord(scan)) {
        return denied('CREATED_WORKFLOW_ABSENCE_SAMPLE_NOT_READY');
      }
      const ids = Array.isArray(scan.records)
        ? scan.records.map((row) => row?.id).filter((id) => typeof id === 'string')
        : null;
      absenceSamples.push({
        observedAtMs: observedAt,
        scanComplete: scan.complete === true && scan.hasNext === false && scan.cursor === null,
        correlatable: scan.correlatable === true,
        presentPlatformIds: ids,
      });
      return frozen({ ok: true, sampleCount: absenceSamples.length });
    },
    cleanupEvidence() {
      if (!deletionRef) return denied('CREATED_WORKFLOW_CLEANUP_REF_MISSING');
      const result = evaluateStableTargetAbsence({
        ref: { platformId: deletionRef.platformId },
        samples: absenceSamples,
        minWindowMs: 3000,
        minCompleteSamples: 3,
      });
      return frozen({
        ok: true,
        cleanupSatisfied: result.cleanupSatisfied === true,
        reason: result.reason ?? null,
        sampleCount: absenceSamples.length,
        windowMs: absenceSamples.length > 1
          ? absenceSamples[absenceSamples.length - 1].observedAtMs - absenceSamples[0].observedAtMs
          : 0,
        batchToken: input.batchToken,
        uniqueNameToken: input.uniqueNameToken,
        entityName,
      });
    },
    observationCaptured() {
      return observation !== null;
    },
  };
  return frozen({ ok: true, allowLaunch: true, controller: frozen(controller) });
}

export function installCreatedWorkflowDeletionGuard(page, {
  controller, stepId, onDecision,
} = {}) {
  if (!page || typeof page.route !== 'function' || !controller
    || typeof controller.hasDeletionRef !== 'function'
    || controller.hasDeletionRef(stepId) !== true) {
    return { installed: false, reason: 'CREATED_WORKFLOW_DELETION_GUARD_NOT_READY' };
  }
  const pattern = controller.mutationRoutePattern();
  const handler = async (route) => {
    const request = route.request();
    let body = null;
    try {
      const text = request.postData();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    const decision = await controller.runGuardedDeletion({
      stepId,
      request: { method: request.method(), url: request.url(), body },
      send: () => route.continue(),
    });
    if (!decision.ok && typeof route.abort === 'function') await route.abort('blockedbyclient');
    if (typeof onDecision === 'function') onDecision(decision);
  };
  const ready = Promise.resolve(page.route(pattern, handler));
  return {
    installed: true,
    pattern,
    ready,
    unroute: () => page.unroute(pattern, handler),
  };
}

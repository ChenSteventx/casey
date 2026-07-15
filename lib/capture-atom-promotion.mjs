// 示教成功链 → 候选宏原子 → 人签 → 学习原子注册表。
// 纯函数、零 I/O、零 LLM、零 verdict 实现依赖；verdict.json 只是上游确定性证据输入。
import { createHash } from 'node:crypto';
import { assertSignedContract } from './sign-gate.mjs';
import { captureSha256Of, validateCaptureFidelity, verifyIntaken } from './record-distill.mjs';
import { isCompilableAtom } from './compile-atoms.mjs';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ATOM_ID_RE = /^learned\.[a-z][a-z0-9_.-]*$/;
const PARAM_TYPES = new Set(['string', 'number', 'boolean', 'string[]']);
const TEMPLATE_RE = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
const DEF_KEYS = new Set(['atomId', 'desc', 'params', 'macro']);
const PARAM_KEYS = new Set(['type', 'required', 'desc']);
const STEP_KEYS = new Set(['sourceIntentId', 'atom', 'params']);
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const clone = (v) => structuredClone(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const EVIDENCE_RAW_KEYS = [
  'captureRaw', 'intakeLedgerRaw', 'manifestRaw', 'mappingRaw', 'expectedRaw',
  'eventsRaw', 'axesRaw', 'verdictRaw', 'videoMetaRaw', 'provenanceRaw',
];

// 去重指纹刻画可执行语义，atomId 只是在 registry 中的名字；同一宏换名不得绕过去重。
function definitionFingerprint(definition) {
  const { atomId: _atomId, ...semantic } = definition || {};
  return stableSha256(jsonText(semantic));
}

export function stableSha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');
}

function parseIntakeLedger(raw, problems) {
  try {
    const entries = String(raw).split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
    if (entries.length === 0) problems.push('INTAKE_LEDGER_REQUIRED');
    return entries;
  } catch {
    problems.push('MALFORMED_INTAKE_LEDGER');
    return [];
  }
}

function latestAcceptedEntry(caseId, ledgerEntries) {
  const accepts = ledgerEntries.filter((entry) => entry?.intakeStatus === 'accepted' && String(entry?.caseId) === String(caseId));
  return accepts.length ? accepts[accepts.length - 1] : null;
}

function evidenceVerificationSha(candidate) {
  return stableSha256(jsonText({
    schemaVersion: 1,
    candidateSha256: stableSha256(jsonText(candidate)),
    evidence: candidate?.evidence,
  }));
}

export function verifyProvenanceBinding({ caseId, provenanceRaw, captureRaw, manifestRaw, mappingRaw, expectedRaw, eventsRaw, axesRaw, verdictRaw, videoMetaRaw, videoBytes } = {}) {
  try {
    const receipt = JSON.parse(String(provenanceRaw));
    const runDocs = [eventsRaw, axesRaw, verdictRaw, videoMetaRaw].map((raw) => JSON.parse(String(raw)));
    const expected = {
      captureSha256: stableSha256(captureRaw),
      manifestSha256: stableSha256(manifestRaw),
      mappingSha256: stableSha256(mappingRaw),
      expectedSha256: stableSha256(expectedRaw),
      eventsSha256: stableSha256(eventsRaw),
      axesSha256: stableSha256(axesRaw),
      verdictSha256: stableSha256(verdictRaw),
      videoMetaSha256: stableSha256(videoMetaRaw),
      videoSha256: stableSha256(videoBytes),
    };
    const problems = [];
    if (receipt?.artifactKind !== 'capture-replay-provenance' || receipt?.schemaVersion !== 1) problems.push('PROVENANCE_RECEIPT_REQUIRED');
    if (String(receipt?.caseId || '') !== String(caseId || '') || !nonEmpty(receipt?.runId)) problems.push('PROVENANCE_ID_MISMATCH');
    if (receipt?.formalVerdictEligible !== true) problems.push('PROVENANCE_FORMAL_VERDICT_REQUIRED');
    for (const [key, hash] of Object.entries(expected)) if (receipt?.hashes?.[key] !== hash) problems.push(`PROVENANCE_HASH_MISMATCH: ${key}`);
    const runIds = runDocs.map((doc) => nonEmpty(doc?.runId) ? doc.runId : null);
    const hasAnyArtifactRunId = runIds.some(Boolean);
    const machineLinked = hasAnyArtifactRunId && runIds.every((id) => id === receipt.runId);
    if (hasAnyArtifactRunId && !machineLinked) problems.push('ARTIFACT_RUN_ID_MISMATCH');
    // 旧正式产物没有共同 runId 时只能由人对这组精确哈希作同 run 见证；明确降级为 route:human，
    // 不把 receipt 自身当机器可证的派生链。将来四件都落同 runId 时自动转 machine-linked。
    if (!hasAnyArtifactRunId) {
      if (!nonEmpty(receipt?.attestation?.signerId)
        || !nonEmpty(receipt?.attestation?.signedAgainstBuild)
        || !nonEmpty(receipt?.attestation?.signedAt)
        || !ISO_RE.test(receipt.attestation.signedAt)) problems.push('HUMAN_RUN_ATTESTATION_REQUIRED');
    }
    return { ok: problems.length === 0, problems, receipt, linkageMode: machineLinked ? 'machine-run-id' : 'human-attested-hash-bundle' };
  } catch {
    return { ok: false, problems: ['PROVENANCE_MALFORMED'], receipt: null };
  }
}

function parseJson(raw, label, problems) {
  try { return JSON.parse(String(raw)); }
  catch { problems.push(`MALFORMED_${label}: 非合法 JSON`); return null; }
}

function typeOk(type, value) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string[]') return Array.isArray(value) && value.every((x) => typeof x === 'string');
  return false;
}

function templateNames(value, out = new Set()) {
  if (typeof value === 'string') {
    for (const m of value.matchAll(TEMPLATE_RE)) out.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) templateNames(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) templateNames(item, out);
  }
  return out;
}

function validateDefinition(definition, baseRegistry) {
  const problems = [];
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return { ok: false, problems: ['MALFORMED_DEFINITION'] };
  for (const key of Object.keys(definition)) if (!DEF_KEYS.has(key)) problems.push(`UNAUTHORIZED_DEFINITION_FIELD: ${key}`);
  if (!ATOM_ID_RE.test(String(definition.atomId || ''))) problems.push('INVALID_ATOM_ID: v1 只允许 learned.* 命名空间');
  if (!nonEmpty(definition.desc)) problems.push('MISSING_DESCRIPTION');
  if (!definition.params || typeof definition.params !== 'object' || Array.isArray(definition.params)) problems.push('MALFORMED_PARAMS');
  const params = definition.params && typeof definition.params === 'object' && !Array.isArray(definition.params) ? definition.params : {};
  for (const [name, spec] of Object.entries(params)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || RESERVED_KEYS.has(name)) problems.push(`INVALID_PARAM_NAME: ${name}`);
    if (!spec || typeof spec !== 'object' || !PARAM_TYPES.has(spec.type)) problems.push(`INVALID_PARAM_SPEC: ${name}`);
    else for (const key of Object.keys(spec)) if (!PARAM_KEYS.has(key)) problems.push(`UNAUTHORIZED_PARAM_FIELD: ${name}.${key}`);
  }
  const steps = definition.macro?.steps;
  if (!Array.isArray(steps) || steps.length === 0) problems.push('EMPTY_MACRO');
  const intentIds = new Set();
  for (const [i, step] of (Array.isArray(steps) ? steps : []).entries()) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) { problems.push(`MALFORMED_MACRO_STEP: ${i}`); continue; }
    for (const key of Object.keys(step)) if (!STEP_KEYS.has(key)) problems.push(`UNAUTHORIZED_MACRO_FIELD: ${i}.${key}`);
    if (!nonEmpty(step.sourceIntentId) || intentIds.has(step.sourceIntentId)) problems.push(`INVALID_SOURCE_INTENT: ${i}`);
    else intentIds.add(step.sourceIntentId);
    const child = baseRegistry?.atoms?.[step.atom];
    if (!child || !isCompilableAtom(step.atom) || child.macro || String(step.atom).startsWith('learned.')) problems.push(`UNSUPPORTED_CHILD_ATOM: ${i}`);
    if (step.params !== undefined && (!step.params || typeof step.params !== 'object' || Array.isArray(step.params))) problems.push(`MALFORMED_CHILD_PARAMS: ${i}`);
    for (const name of templateNames(step.params ?? {})) if (!Object.hasOwn(params, name)) problems.push(`UNDECLARED_TEMPLATE_PARAM: ${name}`);
    if (child && !child.macro && step.params && typeof step.params === 'object' && !Array.isArray(step.params)) {
      const declaredChild = child.params || {};
      for (const [name, spec] of Object.entries(declaredChild)) {
        const has = Object.hasOwn(step.params, name);
        if (spec.required && !has) problems.push(`MISSING_CHILD_PARAM: ${i}.${name}`);
        if (!has) continue;
        const value = step.params[name];
        const exact = typeof value === 'string' ? /^\{\{([A-Za-z][A-Za-z0-9_]*)\}\}$/.exec(value) : null;
        if (exact) {
          if (params[exact[1]]?.type !== spec.type) problems.push(`TEMPLATE_PARAM_TYPE_MISMATCH: ${i}.${name}`);
        } else if (templateNames(value).size > 0) {
          if (spec.type !== 'string') problems.push(`EMBEDDED_TEMPLATE_TYPE_MISMATCH: ${i}.${name}`);
        } else if (!typeOk(spec.type, value)) problems.push(`CHILD_PARAM_TYPE_MISMATCH: ${i}.${name}`);
      }
      for (const name of Object.keys(step.params)) if (!Object.hasOwn(declaredChild, name)) problems.push(`UNDECLARED_CHILD_PARAM: ${i}.${name}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

function validateEvidenceSequence({ mapping, definition, verdict, events }, problems) {
  const macro = definition.macro.steps;
  if (macro.length !== mapping.length) problems.push('MACRO_EVIDENCE_MISMATCH: 步数不一致');
  const n = Math.min(macro.length, mapping.length);
  for (let i = 0; i < n; i++) {
    if (macro[i].sourceIntentId !== mapping[i]?.intentId || macro[i].atom !== mapping[i]?.atom) problems.push(`MACRO_EVIDENCE_MISMATCH: step ${i}`);
  }
  const verdictPairs = (verdict.steps || []).map((s) => `${s.intentId}\u0000${s.atom}`);
  const mappingPairs = mapping.map((s) => `${s.intentId}\u0000${s.atom}`);
  if (verdictPairs.length !== mappingPairs.length || verdictPairs.some((p, i) => p !== mappingPairs[i])) problems.push('VERDICT_MAPPING_MISMATCH');
  const allowedPairs = new Set(mappingPairs);
  const eventPairs = new Set((events.events || []).map((e) => `${e.intentId}\u0000${e.atom}`));
  for (const p of eventPairs) if (!allowedPairs.has(p)) problems.push('EVENT_MAPPING_MISMATCH');
  for (const p of allowedPairs) if (!eventPairs.has(p)) problems.push('EVENT_MAPPING_MISMATCH');
}

export function proposeCandidate(input = {}) {
  try {
    const problems = [];
    const caseId = String(input.caseId || '');
    const capture = parseJson(input.captureRaw, 'CAPTURE', problems);
    const ledgerEntries = parseIntakeLedger(input.intakeLedgerRaw, problems);
    const manifest = parseJson(input.manifestRaw, 'MANIFEST', problems);
    const mapping = parseJson(input.mappingRaw, 'MAPPING', problems);
    const expected = parseJson(input.expectedRaw, 'EXPECTED', problems);
    const events = parseJson(input.eventsRaw, 'EVENTS', problems);
    const axes = parseJson(input.axesRaw, 'AXES', problems);
    const verdict = parseJson(input.verdictRaw, 'VERDICT', problems);
    const videoMeta = parseJson(input.videoMetaRaw, 'VIDEO_META', problems);
    if (problems.length) return { ok: false, problems };

    let provenance = null;
    let linkageMode = null;
    if (!nonEmpty(input.provenanceRaw)) {
      problems.push('PROVENANCE_REQUIRED');
    } else {
      const bound = verifyProvenanceBinding({ ...input });
      if (!bound.ok) problems.push(...bound.problems);
      else { provenance = bound.receipt; linkageMode = bound.linkageMode; }
    }

    const docs = [capture, manifest, expected, events, axes, verdict];
    if (!caseId || docs.some((d) => String(d?.caseId || '') !== caseId)) problems.push('CASE_ID_MISMATCH');
    if (capture?.artifactKind !== 'teach-in-capture'
      || capture?.source?.signed !== false
      || capture?.source?.replayReady !== false
      || capture?.source?.distillRequired !== true) problems.push('INVALID_CAPTURE_PROVENANCE');
    const intake = verifyIntaken({ caseId, ledgerEntries, currentSha256: captureSha256Of(input.captureRaw) });
    const acceptedEntry = latestAcceptedEntry(caseId, ledgerEntries);
    if (!intake.ok || !acceptedEntry) problems.push(`INTAKE_BINDING_REQUIRED: ${intake.reason || 'NOT_INTAKEN'}`);
    if (manifest?.artifactKind !== 'distill-candidate' || manifest.captureSha256 !== stableSha256(input.captureRaw)) problems.push('CAPTURE_HASH_MISMATCH');
    if (!Array.isArray(mapping)) problems.push('MALFORMED_MAPPING');
    else {
      const fidelity = validateCaptureFidelity({ mapping, projection: manifest?.projection, pending: manifest?.pending });
      if (!fidelity.ok) problems.push(...fidelity.problems.map((p) => `CAPTURE_FIDELITY: ${p}`));
    }

    const defGate = validateDefinition(input.definition, input.baseRegistry);
    if (!defGate.ok) problems.push(...defGate.problems);
    const signed = assertSignedContract(expected);
    const assertionCount = (expected?.intents || []).reduce((n, it) => n + (Array.isArray(it.expected) ? it.expected.length : 0), 0)
      + (Array.isArray(expected?.globalAssertions) ? expected.globalAssertions.length : 0);
    if (!signed.ok || assertionCount === 0) problems.push('SIGNED_EXPECTED_REQUIRED');

    if (verdict?.formalVerdictEligible === false || verdict?.verdict === null || verdict?.artifactKind === 'cef-replay-receipt') {
      problems.push('FORMAL_VERDICT_REQUIRED');
    }
    if (!Array.isArray(verdict?.steps) || verdict.steps.length === 0 || verdict.steps.some((s) => s?.verdict !== 'PASS')) problems.push('ALL_PASS_REQUIRED');
    const axesByStep = new Map((Array.isArray(axes?.steps) ? axes.steps : []).map((s) => [s?.stepId, s]));
    for (const step of (Array.isArray(verdict?.steps) ? verdict.steps : [])) {
      const axis = axesByStep.get(step.stepId);
      if (!axis || axis.intentId !== step.intentId || axis.atom !== step.atom
        || axis.action?.resolution !== 'unique' || axis.action?.identityReadback?.ok !== true
        || (axis.postAssertions || []).some((a) => a?.soft !== true && a?.ok !== true)) problems.push(`ACTION_NOT_PROVEN: ${step.stepId || '?'}`);
    }

    if (!Array.isArray(events?.events) || events.events.length === 0) problems.push('EVENTS_REQUIRED');
    if (!videoMeta || !nonEmpty(videoMeta.file) || !/\.(?:webm|mp4)$/i.test(videoMeta.file)
      || !Buffer.isBuffer(input.videoBytes) || input.videoBytes.length === 0) problems.push('VIDEO_EVIDENCE_REQUIRED');
    const videoSteps = new Set((Array.isArray(videoMeta?.steps) ? videoMeta.steps : []).map((s) => s?.stepId));
    for (const s of (Array.isArray(verdict?.steps) ? verdict.steps : [])) if (!videoSteps.has(s.stepId)) problems.push(`VIDEO_STEP_MISSING: ${s.stepId || '?'}`);

    if (Array.isArray(mapping) && Array.isArray(input.definition?.macro?.steps) && Array.isArray(verdict?.steps) && Array.isArray(events?.events)) {
      validateEvidenceSequence({ mapping, definition: input.definition, verdict, events }, problems);
    }
    if (problems.length) return { ok: false, problems: [...new Set(problems)] };

    const definition = clone(input.definition);
    const candidate = {
      schemaVersion: 2,
      artifactKind: 'atom-candidate',
      status: 'pending',
      caseId,
      generatedAt: input.generatedAt || new Date().toISOString(),
      definition,
      definitionFingerprint: definitionFingerprint(definition),
      evidence: {
        validationVersion: 2,
        captureSha256: stableSha256(input.captureRaw),
        intakeEntrySha256: stableSha256(jsonText(acceptedEntry)),
        manifestSha256: stableSha256(input.manifestRaw),
        mappingSha256: stableSha256(input.mappingRaw),
        expectedSha256: stableSha256(input.expectedRaw),
        eventsSha256: stableSha256(input.eventsRaw),
        axesSha256: stableSha256(input.axesRaw),
        verdictSha256: stableSha256(input.verdictRaw),
        videoMetaSha256: stableSha256(input.videoMetaRaw),
        videoSha256: stableSha256(input.videoBytes),
        baseRegistrySha256: stableSha256(jsonText(input.baseRegistry)),
        provenanceSha256: stableSha256(input.provenanceRaw),
        runId: provenance.runId,
        runLinkage: linkageMode,
        provenanceReceipt: clone(provenance),
        ...(provenance.attestation ? { runAttestation: clone(provenance.attestation) } : {}),
        verdict: 'PASS',
        formalVerdictEligible: true,
      },
      note: 'pending 候选：LLM/人只提议语义；须显式人工签署与 atom-promote 才能进入学习原子注册表。',
    };
    return { ok: true, problems: [], candidate };
  } catch {
    return { ok: false, problems: ['ATOM_PROPOSAL_INTERNAL_ERROR'] };
  }
}

export function verifyCandidateAgainstEvidence(candidate, evidenceInput = {}) {
  try {
    const problems = [];
    if (!candidate || candidate.schemaVersion !== 2 || candidate.artifactKind !== 'atom-candidate' || candidate.status !== 'pending') {
      return { ok: false, problems: ['PENDING_CANDIDATE_REQUIRED'] };
    }
    for (const key of EVIDENCE_RAW_KEYS) if (!nonEmpty(evidenceInput[key])) problems.push(`EVIDENCE_INPUT_REQUIRED: ${key}`);
    if (!Buffer.isBuffer(evidenceInput.videoBytes) || evidenceInput.videoBytes.length === 0) problems.push('EVIDENCE_INPUT_REQUIRED: videoBytes');
    if (!evidenceInput.baseRegistry || typeof evidenceInput.baseRegistry !== 'object') problems.push('EVIDENCE_INPUT_REQUIRED: baseRegistry');
    if (!evidenceInput.definition || typeof evidenceInput.definition !== 'object') problems.push('EVIDENCE_INPUT_REQUIRED: definition');
    if (problems.length) return { ok: false, problems };

    const reproposed = proposeCandidate({
      ...evidenceInput,
      caseId: candidate.caseId,
      generatedAt: candidate.generatedAt,
    });
    if (!reproposed.ok) return { ok: false, problems: reproposed.problems.map((p) => `EVIDENCE_RECHECK_FAILED: ${p}`) };
    if (stableSha256(jsonText(reproposed.candidate)) !== stableSha256(jsonText(candidate))) {
      return { ok: false, problems: ['CANDIDATE_EVIDENCE_MISMATCH'] };
    }
    return { ok: true, problems: [], evidenceVerificationSha256: evidenceVerificationSha(reproposed.candidate) };
  } catch {
    return { ok: false, problems: ['CANDIDATE_EVIDENCE_RECHECK_INTERNAL_ERROR'] };
  }
}

export function signCandidate(candidate, approval = {}, evidenceInput = {}) {
  try {
    const problems = [];
    if (!candidate || candidate.schemaVersion !== 2 || candidate.artifactKind !== 'atom-candidate' || candidate.status !== 'pending') problems.push('PENDING_CANDIDATE_REQUIRED');
    if (!nonEmpty(approval.signerId)) problems.push('SIGNER_REQUIRED');
    if (!nonEmpty(approval.signedAgainstBuild)) problems.push('SIGNED_BUILD_REQUIRED');
    if (!nonEmpty(approval.signedAt) || !ISO_RE.test(approval.signedAt)) problems.push('SIGNED_AT_INVALID');
    const evidenceGate = verifyCandidateAgainstEvidence(candidate, evidenceInput);
    if (!evidenceGate.ok) problems.push(...evidenceGate.problems);
    if (problems.length) return { ok: false, problems: [...new Set(problems)] };
    const signed = {
      schemaVersion: 2,
      artifactKind: 'signed-atom-candidate',
      status: 'signed',
      candidate: clone(candidate),
      candidateSha256: stableSha256(jsonText(candidate)),
      evidenceVerificationSha256: evidenceGate.evidenceVerificationSha256,
      approval: {
        signerId: approval.signerId.trim(),
        signedAgainstBuild: approval.signedAgainstBuild.trim(),
        signedAt: approval.signedAt,
      },
    };
    return { ok: true, problems: [], signed };
  } catch {
    return { ok: false, problems: ['ATOM_SIGN_INTERNAL_ERROR'] };
  }
}

export function verifySignedCandidate(signed, evidenceInput = {}) {
  try {
    const problems = [];
    if (!signed || signed.schemaVersion !== 2 || signed.artifactKind !== 'signed-atom-candidate' || signed.status !== 'signed') problems.push('SIGNED_CANDIDATE_REQUIRED');
    if (!signed?.candidate || signed.candidate.schemaVersion !== 2 || signed.candidate.artifactKind !== 'atom-candidate' || signed.candidate.status !== 'pending') problems.push('PENDING_PAYLOAD_REQUIRED');
    if (signed?.candidate && signed.candidateSha256 !== stableSha256(jsonText(signed.candidate))) problems.push('CANDIDATE_SHA_MISMATCH');
    if (!nonEmpty(signed?.approval?.signerId) || !nonEmpty(signed?.approval?.signedAgainstBuild)
      || !nonEmpty(signed?.approval?.signedAt) || !ISO_RE.test(signed.approval.signedAt)) problems.push('APPROVAL_INVALID');
    if (signed?.candidate) {
      const evidenceGate = verifyCandidateAgainstEvidence(signed.candidate, evidenceInput);
      if (!evidenceGate.ok) problems.push(...evidenceGate.problems);
      else if (signed.evidenceVerificationSha256 !== evidenceGate.evidenceVerificationSha256) problems.push('SIGNED_EVIDENCE_VERIFICATION_MISMATCH');
    }
    return { ok: problems.length === 0, problems: [...new Set(problems)] };
  } catch {
    return { ok: false, problems: ['SIGNED_CANDIDATE_INTERNAL_ERROR'] };
  }
}

function definitionFromEntry(entry) {
  return {
    atomId: entry.atomId,
    desc: entry.desc,
    params: clone(entry.params || {}),
    macro: clone(entry.macro),
    ...(entry.requires ? { requires: clone(entry.requires) } : {}),
    ...(entry.provides ? { provides: clone(entry.provides) } : {}),
    ...(entry.removes ? { removes: clone(entry.removes) } : {}),
    ...(entry.destructive !== undefined ? { destructive: entry.destructive } : {}),
    ...(entry.entityNameParam ? { entityNameParam: entry.entityNameParam } : {}),
  };
}

export function promoteCandidate({ signed, evidenceInput, learnedRegistry, baseRegistry, promotedAt = new Date().toISOString() } = {}) {
  try {
    const verified = verifySignedCandidate(signed, evidenceInput);
    if (!verified.ok) return { ok: false, problems: verified.problems };
    const candidate = signed.candidate;
    const definition = candidate.definition;
    const problems = [];
    if (stableSha256(jsonText(baseRegistry)) !== stableSha256(jsonText(evidenceInput?.baseRegistry))) problems.push('CURRENT_BASE_REGISTRY_MISMATCH');
    const defGate = validateDefinition(definition, baseRegistry);
    if (!defGate.ok) problems.push(...defGate.problems);
    if (baseRegistry?.atoms?.[definition.atomId]) problems.push('BUILTIN_COLLISION');
    if (candidate.definitionFingerprint !== definitionFingerprint(definition)) problems.push('DEFINITION_FINGERPRINT_MISMATCH');
    const registry = learnedRegistry && typeof learnedRegistry === 'object' ? clone(learnedRegistry) : { schemaVersion: 1, version: 0, atoms: {} };
    if (registry.schemaVersion !== 1 || !Number.isInteger(registry.version) || registry.version < 0 || !registry.atoms || typeof registry.atoms !== 'object') problems.push('LEARNED_REGISTRY_INVALID');
    if (problems.length) return { ok: false, problems };

    for (const [id, entry] of Object.entries(registry.atoms)) {
      if (id !== definition.atomId && entry?.definitionFingerprint === candidate.definitionFingerprint) return { ok: false, problems: ['DUPLICATE_DEFINITION'] };
    }
    const existing = registry.atoms[definition.atomId];
    if (existing?.definitionFingerprint === candidate.definitionFingerprint) return { ok: true, problems: [], registry, idempotent: true };

    const revision = existing ? Number(existing.activeRevision || 0) + 1 : 1;
    const revisionRecord = {
      revision,
      definition: clone(definition),
      definitionFingerprint: candidate.definitionFingerprint,
      candidateSha256: signed.candidateSha256,
      evidence: clone(candidate.evidence),
      approval: clone(signed.approval),
      promotedAt,
    };
    registry.version += 1;
    registry.atoms[definition.atomId] = {
      ...clone(definition),
      activeRevision: revision,
      definitionFingerprint: candidate.definitionFingerprint,
      revisions: [...(Array.isArray(existing?.revisions) ? existing.revisions : []), revisionRecord],
    };
    return { ok: true, problems: [], registry, idempotent: false };
  } catch {
    return { ok: false, problems: ['ATOM_PROMOTION_INTERNAL_ERROR'] };
  }
}

export function mergeAtomRegistries(baseRegistry, learnedRegistry) {
  try {
    const problems = [];
    if (!baseRegistry || typeof baseRegistry !== 'object' || !baseRegistry.atoms) return { ok: false, problems: ['BASE_REGISTRY_INVALID'] };
    const merged = clone(baseRegistry);
    const learned = learnedRegistry ?? { schemaVersion: 1, version: 0, atoms: {} };
    if (learned.schemaVersion !== 1 || !Number.isInteger(learned.version) || learned.version < 0 || !learned.atoms || typeof learned.atoms !== 'object') return { ok: false, problems: ['LEARNED_REGISTRY_INVALID'] };
    for (const [id, entry] of Object.entries(learned.atoms)) {
      if (merged.atoms[id]) { problems.push(`BUILTIN_COLLISION: ${id}`); continue; }
      const revisions = Array.isArray(entry?.revisions) ? entry.revisions : [];
      const active = revisions.find((r) => r?.revision === entry?.activeRevision);
      if (!active || active.definitionFingerprint !== entry.definitionFingerprint
        || definitionFingerprint(active.definition) !== entry.definitionFingerprint
        || !/^[a-f0-9]{64}$/.test(String(active.candidateSha256 || ''))
        || !nonEmpty(active.approval?.signerId) || !nonEmpty(active.approval?.signedAgainstBuild)
        || !nonEmpty(active.approval?.signedAt) || !ISO_RE.test(active.approval.signedAt)
        || active.evidence?.validationVersion !== 2
        || !['captureSha256', 'intakeEntrySha256', 'manifestSha256', 'mappingSha256', 'expectedSha256', 'eventsSha256', 'axesSha256', 'verdictSha256', 'videoMetaSha256', 'videoSha256', 'baseRegistrySha256', 'provenanceSha256']
          .every((key) => /^[a-f0-9]{64}$/.test(String(active.evidence?.[key] || '')))
        || !nonEmpty(active.evidence?.runId) || !nonEmpty(active.evidence?.runLinkage)
        || active.evidence?.verdict !== 'PASS' || active.evidence?.formalVerdictEligible !== true) { problems.push(`UNVERIFIED_LEARNED_ENTRY: ${id}`); continue; }
      const definition = definitionFromEntry(entry);
      const dg = validateDefinition(definition, baseRegistry);
      if (!dg.ok) { problems.push(...dg.problems.map((p) => `${id}: ${p}`)); continue; }
      merged.atoms[id] = { ...clone(definition), learned: { activeRevision: entry.activeRevision, registryVersion: learned.version } };
    }
    if (problems.length) return { ok: false, problems };
    merged.learnedRegistryVersion = learned.version;
    return { ok: true, problems: [], registry: merged };
  } catch {
    return { ok: false, problems: ['REGISTRY_MERGE_INTERNAL_ERROR'] };
  }
}

function substitute(value, params, problems, label) {
  if (typeof value === 'string') {
    const exact = /^\{\{([A-Za-z][A-Za-z0-9_]*)\}\}$/.exec(value);
    if (exact) {
      if (!Object.hasOwn(params, exact[1])) { problems.push(`MISSING_MACRO_PARAM: ${exact[1]}`); return null; }
      return clone(params[exact[1]]);
    }
    const out = value.replace(TEMPLATE_RE, (_m, name) => {
      if (!Object.hasOwn(params, name)) { problems.push(`MISSING_MACRO_PARAM: ${name}`); return ''; }
      if (typeof params[name] !== 'string') { problems.push(`EMBEDDED_TEMPLATE_REQUIRES_STRING: ${name}`); return ''; }
      return params[name];
    });
    if (/\{\{/.test(out)) problems.push(`UNRESOLVED_TEMPLATE: ${label}`);
    return out;
  }
  if (Array.isArray(value)) return value.map((v, i) => substitute(v, params, problems, `${label}[${i}]`));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, params, problems, `${label}.${k}`)]));
  return value;
}

export function expandLearnedFlow(flow, registry) {
  try {
    const problems = [];
    if (!flow || typeof flow !== 'object' || !Array.isArray(flow.steps)) return { ok: false, problems: ['FLOW_INVALID'] };
    if (!registry || typeof registry !== 'object' || !registry.atoms) return { ok: false, problems: ['REGISTRY_INVALID'] };
    const steps = [];
    for (const [i, step] of flow.steps.entries()) {
      if (!step || typeof step !== 'object' || !nonEmpty(step.atom)) { problems.push(`FLOW_STEP_INVALID: ${i}`); continue; }
      const def = registry.atoms[step.atom];
      if (!def) { problems.push(`UNKNOWN_ATOM: ${i}`); continue; }
      if (!def.macro) { steps.push(clone(step)); continue; }
      const declared = def.params || {};
      const given = step.params || {};
      if (!given || typeof given !== 'object' || Array.isArray(given)) { problems.push(`MACRO_PARAMS_INVALID: ${i}`); continue; }
      for (const [name, spec] of Object.entries(declared)) {
        const has = Object.hasOwn(given, name);
        if (spec.required && !has) problems.push(`MISSING_MACRO_PARAM: ${name}`);
        if (has && !typeOk(spec.type, given[name])) problems.push(`MACRO_PARAM_TYPE: ${name}`);
      }
      for (const name of Object.keys(given)) if (!Object.hasOwn(declared, name)) problems.push(`UNDECLARED_MACRO_PARAM: ${name}`);
      for (const [j, child] of (def.macro.steps || []).entries()) {
        const childDef = registry.atoms[child.atom];
        if (!childDef || childDef.macro || !isCompilableAtom(child.atom)) { problems.push(`NESTED_OR_UNKNOWN_MACRO_CHILD: ${i}.${j}`); continue; }
        steps.push({ atom: child.atom, params: substitute(child.params || {}, given, problems, `step[${i}].macro[${j}]`) });
      }
    }
    if (problems.length) return { ok: false, problems: [...new Set(problems)] };
    return { ok: true, problems: [], flow: { ...clone(flow), steps } };
  } catch {
    return { ok: false, problems: ['MACRO_EXPANSION_INTERNAL_ERROR'] };
  }
}

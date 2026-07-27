// Bounded proposal builder. Model output may only point at one affordance in the
// exact builder-issued zero-hit catalog; it cannot introduce selectors or code.
import { createHash } from 'node:crypto';
import { validateObservationArtifact } from './affordance-catalog.mjs';
import {
  resolveDeterministicAction,
} from './deterministic-resolver.mjs';
import { isReadSafeZeroShotTarget } from './read-safe-target.mjs';
import { validateZeroShotStepContractAuthority } from './step-contract.mjs';

const PROPOSAL_AUTHORITIES = new WeakMap();
const AFFORDANCE_ID = /^af_[a-z0-9_]+$/;
const PROPOSAL_KEYS = Object.freeze([
  'schemaVersion',
  'artifactKind',
  'observationId',
  'intentId',
  'targetAffordanceId',
  'action',
]);

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalJson(value) {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  if (typeof value === 'string') return `s${JSON.stringify(value)}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `d${JSON.stringify(value)}`;
  if (Array.isArray(value)) return `a[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) throw new TypeError('proposal 含 symbol key');
    return `o{${ownKeys.sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('proposal authority 内容须为 JSON 值');
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function denied(reason) {
  return { ok: false, reason, proposal: null };
}

function exactProposalShape(rawProposal) {
  if (!isRecord(rawProposal)) return false;
  const actual = Object.keys(rawProposal).sort();
  const expected = [...PROPOSAL_KEYS].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function currentTarget(observation, affordanceId, action) {
  const matches = observation.affordances.filter((item) => item?.affordanceId === affordanceId);
  if (matches.length !== 1) return null;
  const item = matches[0];
  if (item.pageCount !== 1
    || item.visible !== true
    || item.enabled !== true
    || item.actionable !== true
    || !Array.isArray(item.actionSpace)
    || !item.actionSpace.includes(action)) return null;
  return item;
}

export function createActionProposal({
  stepContract,
  observation,
  rawProposal,
} = {}) {
  if (validateZeroShotStepContractAuthority(stepContract)?.ok !== true) {
    return denied('CONTRACT_AUTHORITY_INVALID');
  }
  if (validateObservationArtifact(observation)?.ok !== true) {
    return denied('OBSERVATION_INVALID');
  }

  const deterministic = resolveDeterministicAction({ stepContract, observation });
  if (deterministic.status === 'resolved') {
    return denied('DETERMINISTIC_RESOLUTION_DOMINATES');
  }
  if (deterministic.status !== 'proposal-required'
    || deterministic.reason !== 'AFFORDANCE_NOT_FOUND') {
    return denied(deterministic.reason || 'PROPOSAL_NOT_ALLOWED');
  }
  if (!exactProposalShape(rawProposal)) return denied('PROPOSAL_SHAPE_INVALID');
  if (rawProposal.schemaVersion !== 1
    || rawProposal.artifactKind !== 'zero-shot-action-proposal'
    || rawProposal.observationId !== observation.observationId
    || rawProposal.intentId !== stepContract.intentId
    || rawProposal.intentId !== observation.intentId
    || rawProposal.action !== stepContract.action
    || !AFFORDANCE_ID.test(rawProposal.targetAffordanceId ?? '')) {
    return denied('PROPOSAL_BINDING_INVALID');
  }
  const target = currentTarget(observation, rawProposal.targetAffordanceId, rawProposal.action);
  if (!target) {
    return denied('PROPOSAL_TARGET_INVALID');
  }
  if (!isReadSafeZeroShotTarget(target.semantic)) {
    return denied('PROPOSAL_TARGET_NOT_READ_SAFE');
  }

  const proposal = deepFreeze(structuredClone(rawProposal));
  PROPOSAL_AUTHORITIES.set(proposal, Object.freeze({
    digest: digest(proposal),
    stepContract,
    observation,
    observationDigest: digest(observation),
  }));
  return { ok: true, reason: null, proposal };
}

export function validateActionProposalAuthority({
  proposal,
  stepContract,
  observation,
} = {}) {
  const authority = isRecord(proposal) ? PROPOSAL_AUTHORITIES.get(proposal) : null;
  if (!authority
    || authority.stepContract !== stepContract
    || authority.observation !== observation
    || validateZeroShotStepContractAuthority(stepContract)?.ok !== true
    || validateObservationArtifact(observation)?.ok !== true) {
    return { ok: false, reason: 'PROPOSAL_AUTHORITY_INVALID' };
  }
  try {
    if (digest(proposal) !== authority.digest
      || digest(observation) !== authority.observationDigest) {
      return { ok: false, reason: 'PROPOSAL_AUTHORITY_INVALID' };
    }
  } catch {
    return { ok: false, reason: 'PROPOSAL_AUTHORITY_INVALID' };
  }
  return {
    ok: true,
    reason: null,
    targetAffordanceId: proposal.targetAffordanceId,
    action: proposal.action,
    observationId: proposal.observationId,
    intentId: proposal.intentId,
  };
}

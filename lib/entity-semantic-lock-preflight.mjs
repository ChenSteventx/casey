// compile/replay 身份准入前检（纯函数 + 固定 PRD/checksum 读取边界）。
// execute 使用绑定 flow + TestCase 的预执行身份授权；verify/replay 使用绑定最终 events 的 frozen locks。
// 普通 JSON 与公开内容自哈希都不是执行权限；只有模块内铸造、分域且不可复制的 opaque handle 可授权。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { types as utilTypes } from 'node:util';
import { PROJECT_ROOT } from './paths.mjs';
import { verifyEntityLockReceipt } from './entity-semantic-lock.mjs';
import { readProjectArtifactBytes } from './project-artifact-boundary.mjs';

const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const BARE_HASH_RE = /^[a-f0-9]{64}$/;
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;
const ROLES = new Set(['subject', 'source', 'target']);
const DOMAINS = new Set(['execute', 'verify']);
const MAX_BINDINGS = 10000;
const authorityState = new WeakMap();

const EXECUTE_ARTIFACT_FIELDS = [
  'schemaVersion', 'artifactKind', 'authorizedFor', 'caseId', 'signed', 'signerId', 'signedAt',
  'flowSha256', 'testcaseSha256', 'bindings', 'signature',
];
const FROZEN_ARTIFACT_FIELDS = [
  'schemaVersion', 'artifactKind', 'caseId', 'signed', 'replayReady', 'signerId', 'signedAt',
  'eventsSha256', 'bindings', 'signature',
];
const EXECUTE_BINDING_FIELDS = ['sourceIntentId', 'candidateId', 'role'];
const FROZEN_BINDING_FIELDS = ['stepId', 'intentId', 'atom', 'role', 'candidateId', 'lockId', 'receiptHash'];
const READER_FIELDS = ['prdId', 'artifactKey', 'domain'];
const CHECK_FIELDS = [
  'mode', 'caseId', 'containsEntityMutation', 'executeAuthority', 'frozenLockAuthority',
  'flowBytes', 'testcaseBytes', 'eventsBytes', 'requiredBindings', 'flow', 'eventsDocument',
  // 只为给旧调用面返回分域拒绝原因；其值绝不读取、绝不进入 authorityState。
  'signedAuthority', 'frozenLocks',
];

// 人签冻结的 admission policy 在生产侧的只读镜像。只有这里明确列为 read 的原子
// 才能跳过 mutation authority；未知项一律 mutation，registry/caller flags 均无表决权。
const SIDE_EFFECT_POLICY = new Map([
  ['nav.workflowManagement', Object.freeze({ effect: 'read', requiredRoles: Object.freeze([]), allowedActions: Object.freeze(['nav']) })],
  ['assert.textVisible', Object.freeze({ effect: 'read', requiredRoles: Object.freeze([]), allowedActions: Object.freeze(['assert']) })],
  ['workflow.create', Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) })],
  ['workflow.addNode', Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) })],
  ['workflow.setNodeField', Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) })],
  ['workflow.setSwitch', Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) })],
  ['workflow.addNodeInputVar', Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) })],
  ['agent.removeToolByName', Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) })],
  ['workflow.bindAgent', Object.freeze({ effect: 'relation', requiredRoles: Object.freeze(['source', 'target']) })],
]);

// 无 frozen authority 的 read 通道必须同时钉住会影响导航的事件载荷，不能只凭 atom/action
// 放行。compile 缺省只会写固定列表路由；`/workflow` 仅保留给既有 v2 只读信封。通道剖面
// 自定义路由无法在这里证明为 compiler-authored，须走 frozen authority，不能由 caller 自报。
const UNBOUND_READ_ENVELOPE_URLS = new Set([
  '{{baseUrl}}/ai-manager/process/list',
  '{{baseUrl}}/workflow',
]);

function safeUnboundReadEvent(event, document) {
  if (!UNBOUND_READ_ENVELOPE_URLS.has(document.url)) return false;
  if (Object.hasOwn(event, 'pre')) return false;
  if (event.atom === 'nav.workflowManagement' && event.action === 'nav') {
    if (!Object.hasOwn(event, 'url')) return true; // 旧信封：replay 必须按缺目标失败且不得导航。
    return UNBOUND_READ_ENVELOPE_URLS.has(event.url) && event.url === document.url;
  }
  if (event.atom === 'assert.textVisible' && event.action === 'assert') {
    return nonEmpty(event.text) && !Object.hasOwn(event, 'url');
  }
  return false;
}

const invalidBindings = (reason) => Object.freeze({ ok: false, valid: false, reason });

const denied = (reason, nextAction) => Object.freeze({
  ok: false,
  allowBrowserLaunch: false,
  reason,
  nextAction,
});

const allowed = (authorityKind) => Object.freeze({
  ok: true,
  allowBrowserLaunch: true,
  reason: null,
  nextAction: null,
  authorityKind,
});

const nonEmpty = (value) => typeof value === 'string' && Boolean(value.trim());
const isBytes = (value) => {
  if (value != null && (typeof value === 'object' || typeof value === 'function') && utilTypes.isProxy(value)) return false;
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
};

function dataRecord(value) {
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

// Proxy 先由 util.types.isProxy 判掉；普通对象只读 descriptor.value，绝不执行 getter/setter。
function closedRecord(value, { allowed, required = allowed } = {}) {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  let descriptors;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  const allowedSet = new Set(allowed || []);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== 'string' || !allowedSet.has(key))) return null;
  for (const key of required || []) if (!Object.hasOwn(descriptors, key)) return null;
  const out = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out[key] = descriptor.value;
  }
  return out;
}

function closedArray(value) {
  if (value != null && (typeof value === 'object' || typeof value === 'function') && utilTypes.isProxy(value)) return null;
  if (!Array.isArray(value)) return null;
  let descriptors;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  const lengthDescriptor = descriptors.length;
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BINDINGS) return null;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') return null;
    if (key === 'length') continue;
    if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) return null;
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
  }
  const out = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out.push(descriptor.value);
  }
  return out;
}

function inspectBindings(value, fields, { receipt = false } = {}) {
  const source = closedArray(value);
  if (!source) return null;
  const out = [];
  const keys = new Set();
  for (const item of source) {
    const binding = closedRecord(item, { allowed: fields, required: fields });
    if (!binding || !fields.every((field) => nonEmpty(binding[field]))) return null;
    if (!ROLES.has(binding.role)) return null;
    if (receipt && !HASH_RE.test(binding.receiptHash)) return null;
    const key = JSON.stringify(fields.map((field) => binding[field]));
    if (keys.has(key)) return null;
    keys.add(key);
    out.push(Object.freeze({ ...binding }));
  }
  return Object.freeze(out);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value == null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

function plainDataTree(value, ancestors = new Set()) {
  if (value == null || typeof value !== 'object') return value;
  if (utilTypes.isProxy(value) || ancestors.has(value)) throw new TypeError('identity admission artifact 含不安全或循环对象');
  const next = new Set(ancestors);
  next.add(value);
  if (Array.isArray(value)) {
    const items = closedArray(value);
    if (!items) throw new TypeError('identity admission artifact 数组须为闭合数据');
    return items.map((item) => plainDataTree(item, next));
  }
  const record = dataRecord(value);
  if (!record) throw new TypeError('identity admission artifact 须为无 accessor 的普通对象');
  return Object.fromEntries(Object.keys(record).map((key) => [key, plainDataTree(record[key], next)]));
}

// 兼容既有 artifact 内容摘要格式。该函数不铸造 authority，输出只具内容校验意义。
export function calculateIdentityAdmissionSignature(artifact) {
  if (artifact == null || typeof artifact !== 'object' || Array.isArray(artifact) || utilTypes.isProxy(artifact)) {
    throw new TypeError('identity admission artifact 须为无 accessor 的普通对象');
  }
  const record = plainDataTree(artifact);
  const unsigned = {};
  for (const key of Object.keys(record)) if (key !== 'signature') unsigned[key] = record[key];
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalValue(unsigned))).digest('hex')}`;
}

export function hashIdentityAdmissionBytes(bytes) {
  if (!isBytes(bytes)) throw new TypeError('identity admission digest 须使用原始字节');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function validateExecuteArtifact(value) {
  const artifact = closedRecord(value, { allowed: EXECUTE_ARTIFACT_FIELDS, required: EXECUTE_ARTIFACT_FIELDS });
  if (!artifact
    || artifact.schemaVersion !== 1
    || artifact.artifactKind !== 'entity-pre-execution-authority'
    || artifact.authorizedFor !== 'compile-execute'
    || artifact.signed !== true
    || !nonEmpty(artifact.caseId)
    || !nonEmpty(artifact.signerId)
    || !nonEmpty(artifact.signedAt)
    || !HASH_RE.test(artifact.flowSha256 || '')
    || !HASH_RE.test(artifact.testcaseSha256 || '')
    || !HASH_RE.test(artifact.signature || '')) return null;
  const bindings = inspectBindings(artifact.bindings, EXECUTE_BINDING_FIELDS);
  if (!bindings || artifact.signature !== calculateIdentityAdmissionSignature(artifact)) return null;
  return Object.freeze({ ...artifact, bindings });
}

function validateFrozenArtifact(value) {
  const artifact = closedRecord(value, { allowed: FROZEN_ARTIFACT_FIELDS, required: FROZEN_ARTIFACT_FIELDS });
  if (!artifact
    || artifact.schemaVersion !== 1
    || artifact.artifactKind !== 'entity-locks-frozen'
    || artifact.signed !== true
    || artifact.replayReady !== true
    || !nonEmpty(artifact.caseId)
    || !nonEmpty(artifact.signerId)
    || !nonEmpty(artifact.signedAt)
    || !HASH_RE.test(artifact.eventsSha256 || '')
    || !HASH_RE.test(artifact.signature || '')) return null;
  const bindings = inspectBindings(artifact.bindings, FROZEN_BINDING_FIELDS, { receipt: true });
  if (!bindings || artifact.signature !== calculateIdentityAdmissionSignature(artifact)) return null;
  return Object.freeze({ ...artifact, bindings });
}

function artifactPathFromKey(artifactKey) {
  if (!nonEmpty(artifactKey) || isAbsolute(artifactKey) || artifactKey.includes('\\')) return null;
  const absolute = resolve(PROJECT_ROOT, artifactKey);
  const rel = relative(PROJECT_ROOT, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  const canonicalKey = rel.split(sep).join('/');
  return canonicalKey === artifactKey ? absolute : null;
}

function mintAuthority(domain, artifact, provenance) {
  const handle = Object.freeze(Object.create(null));
  authorityState.set(handle, Object.freeze({ domain, artifact, provenance: Object.freeze({ ...provenance }) }));
  return handle;
}

// 当前 trust anchor 是仓内规范 loop/prd-<prdId>.json + 其中已登记的精确 checksum。
// prdId 的运行时发布根、只读安装边界和撤销语义由后续独立契约补齐；本函数不接受路径/hash/bytes 注入。
export function readIdentityAdmissionAuthorityFromPrd(rawOptions) {
  const options = closedRecord(rawOptions, { allowed: READER_FIELDS, required: READER_FIELDS });
  if (!options
    || !SAFE_ID_RE.test(options.prdId || '')
    || !DOMAINS.has(options.domain)
    || !nonEmpty(options.artifactKey)) {
    return denied('IDENTITY_AUTHORITY_READER_OPTIONS_INVALID', 'USE_FIXED_PRD_CHECKSUM_REFERENCE');
  }
  const artifactPath = artifactPathFromKey(options.artifactKey);
  if (!artifactPath) return denied('IDENTITY_AUTHORITY_ARTIFACT_KEY_INVALID', 'USE_CANONICAL_PROJECT_RELATIVE_ARTIFACT_KEY');
  try {
    const prdPath = resolve(PROJECT_ROOT, 'loop', `prd-${options.prdId}.json`);
    const prd = JSON.parse(readFileSync(prdPath, 'utf8'));
    const expected = prd?.testChecksums?.[options.artifactKey];
    if (!BARE_HASH_RE.test(expected || '')) {
      return denied('IDENTITY_AUTHORITY_CHECKSUM_NOT_PUBLISHED', 'FREEZE_ARTIFACT_IN_CANONICAL_PRD');
    }
    const physicalRead = readProjectArtifactBytes({ projectRoot: PROJECT_ROOT, targetPath: artifactPath });
    if (!physicalRead.ok) return denied('IDENTITY_AUTHORITY_ARTIFACT_PHYSICAL_BOUNDARY_INVALID', 'RESTORE_PHYSICAL_PROJECT_ARTIFACT_PATH');
    const bytes = physicalRead.bytes;
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected) return denied('IDENTITY_AUTHORITY_CHECKSUM_MISMATCH', 'RESTORE_FROZEN_ARTIFACT_BYTES');
    const parsed = JSON.parse(bytes.toString('utf8'));
    const artifact = options.domain === 'execute'
      ? validateExecuteArtifact(parsed)
      : validateFrozenArtifact(parsed);
    if (!artifact) return denied('IDENTITY_AUTHORITY_ARTIFACT_SCHEMA_INVALID', 'REVIEW_AND_REFREEZE_CLOSED_SCHEMA_ARTIFACT');
    const authority = mintAuthority(options.domain, artifact, {
      prdId: options.prdId,
      artifactKey: options.artifactKey,
      sha256: actual,
    });
    return Object.freeze({ ok: true, authority });
  } catch {
    return denied('IDENTITY_AUTHORITY_READ_OR_PARSE_FAILED', 'RESTORE_CANONICAL_PRD_AND_ARTIFACT');
  }
}

function exactBindingSet(actual, required, fields) {
  if (!actual || !required || actual.length !== required.length) return false;
  const actualKeys = new Set(actual.map((binding) => JSON.stringify(fields.map((field) => binding[field]))));
  if (actualKeys.size !== actual.length) return false;
  for (const binding of required) {
    const key = JSON.stringify(fields.map((field) => binding[field]));
    if (!actualKeys.has(key)) return false;
  }
  return true;
}

function stateFor(handle, domain) {
  if (handle == null || (typeof handle !== 'object' && typeof handle !== 'function')) return null;
  const state = authorityState.get(handle);
  return state?.domain === domain ? state : null;
}

function verifyExecuteAuthority({ caseId, executeAuthority, flowBytes, testcaseBytes, requiredBindings }) {
  const state = stateFor(executeAuthority, 'execute');
  const artifact = state?.artifact;
  if (!artifact) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID', 'LOAD_FIXED_OR_HUMAN_SIGNED_EXECUTE_AUTHORITY');
  }
  if (artifact.caseId !== caseId) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_CASE_MISMATCH', 'RESIGN_AUTHORITY_FOR_THIS_CASE');
  }
  if (!isBytes(flowBytes) || !isBytes(testcaseBytes)) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_CONTEXT_MISSING', 'PROVIDE_FLOW_AND_TESTCASE_BYTES');
  }
  if (artifact.flowSha256 !== hashIdentityAdmissionBytes(flowBytes)
    || artifact.testcaseSha256 !== hashIdentityAdmissionBytes(testcaseBytes)) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_HASH_MISMATCH', 'REVIEW_AND_RESIGN_CURRENT_FLOW');
  }
  if (!requiredBindings.length) {
    return denied('PRE_EXECUTION_IDENTITY_BINDINGS_MISSING', 'DISTILL_AND_CONFIRM_ENTITY_BINDINGS');
  }
  if (!exactBindingSet(artifact.bindings, requiredBindings, EXECUTE_BINDING_FIELDS)) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_BINDINGS_INCOMPLETE', 'CONFIRM_ALL_ENTITY_BINDINGS_AND_RESIGN');
  }
  return allowed('pre-execution-authority');
}

function verifyFrozenLocks({ caseId, containsEntityMutation, frozenLockAuthority, eventsBytes, requiredBindings }) {
  const state = stateFor(frozenLockAuthority, 'verify');
  const artifact = state?.artifact;
  if (!artifact) {
    return denied('FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID', 'LOAD_FIXED_OR_HUMAN_SIGNED_FROZEN_LOCK_AUTHORITY');
  }
  if (artifact.caseId !== caseId) {
    return denied('FROZEN_ENTITY_LOCKS_CASE_MISMATCH', 'SIGN_LOCKS_FOR_THIS_CASE');
  }
  if (!isBytes(eventsBytes)) {
    return denied('FROZEN_ENTITY_LOCKS_EVENTS_MISSING', 'PROVIDE_FINAL_EVENTS_BYTES');
  }
  if (artifact.eventsSha256 !== hashIdentityAdmissionBytes(eventsBytes)) {
    return denied('FROZEN_ENTITY_LOCKS_EVENTS_HASH_MISMATCH', 'REDRAFT_AND_RESIGN_LOCKS_FOR_CURRENT_EVENTS');
  }
  if (containsEntityMutation === true && !requiredBindings.length) {
    return denied('FROZEN_ENTITY_EVENT_BINDINGS_MISSING', 'RECOMPILE_EVENTS_WITH_ENTITY_BINDINGS');
  }
  if (!exactBindingSet(artifact.bindings, requiredBindings, FROZEN_BINDING_FIELDS)) {
    return denied('FROZEN_ENTITY_LOCKS_BINDINGS_INCOMPLETE', 'LOCK_ALL_EVENT_ENTITY_BINDINGS_AND_RESIGN');
  }
  return allowed('frozen-entity-locks');
}

function operationRecords(document, collectionKey) {
  // 生产 compile 的 flow 是 step 数组；旧 authority/测试文档也可能用闭合 `{steps:[...]}`。
  // 两种只是同一域的容器形态，逐 step 闭合校验与固定 side-effect policy 完全相同。
  const directFlow = collectionKey === 'steps' ? closedArray(document) : null;
  const root = directFlow ? null : dataRecord(document);
  if (!directFlow && !root) return null;
  const items = directFlow || closedArray(root[collectionKey]);
  if (!items) return null;
  const out = [];
  for (const item of items) {
    const record = dataRecord(item);
    if (!record) return null;
    out.push(record);
  }
  return out;
}

function policyForAtom(atom) {
  if (!nonEmpty(atom)) return null;
  return SIDE_EFFECT_POLICY.get(atom) || Object.freeze({ effect: 'mutation', requiredRoles: Object.freeze(['subject']) });
}

// 旧 events 内嵌 binding 投影只用于历史 authority 回归，不参与 successor replay 决策；保留其“单一显式角色”读取兼容。
function legacyEventProjectionPolicyForAtom(atom) {
  if (!nonEmpty(atom)) return null;
  return SIDE_EFFECT_POLICY.get(atom) || Object.freeze({ effect: 'mutation', requiredRoles: null });
}

function containsMutation(document, collectionKey) {
  const records = operationRecords(document, collectionKey);
  if (!records) return true;
  for (const record of records) {
    const policy = policyForAtom(record.atom);
    if (!policy || policy.effect !== 'read') return true;
  }
  return false;
}

export function flowContainsEntityMutation(flow, _registry) {
  return containsMutation(flow, 'steps');
}

export function eventsContainEntityMutation(eventsDocument, _registry) {
  return containsMutation(eventsDocument, 'events');
}

function inspectOperationBindings(operation, policy, allowedFields, requiredFields, identityFields) {
  const hasBindings = Object.hasOwn(operation, 'entityBindings');
  if (policy.effect === 'read') {
    if (!hasBindings) return Object.freeze([]);
    const bindings = closedArray(operation.entityBindings);
    return bindings && bindings.length === 0 ? Object.freeze([]) : null;
  }
  if (!hasBindings) return null;
  const source = closedArray(operation.entityBindings);
  if (!source || source.length === 0) return null;
  const rows = [];
  const seenRoles = new Set();
  for (const value of source) {
    const binding = closedRecord(value, { allowed: allowedFields, required: requiredFields });
    if (!binding || !nonEmpty(binding.candidateId) || !nonEmpty(binding.role)
      || !ROLES.has(binding.role) || seenRoles.has(binding.role)) return null;
    for (const field of identityFields) if (!nonEmpty(operation[field])) return null;
    for (const field of identityFields) {
      if (Object.hasOwn(binding, field) && binding[field] !== operation[field]) return null;
    }
    if (requiredFields.includes('receiptHash') && !HASH_RE.test(binding.receiptHash || '')) return null;
    seenRoles.add(binding.role);
    rows.push(Object.freeze({ operation, binding }));
  }
  const expected = policy.requiredRoles;
  if (expected) {
    if (seenRoles.size !== expected.length || expected.some((role) => !seenRoles.has(role))) return null;
  } else if (seenRoles.size !== 1) {
    // 未登记原子仍按 mutation 阻断；在旧 artifact 迁移期只接受一个明确语义角色，
    // 绝不把空集或多角色猜成完整关系。
    return null;
  }
  return Object.freeze(rows);
}

function requiredEntityBindings(document, collectionKey, allowedBindingFields, requiredBindingFields, identityFields, project, policyLookup = policyForAtom) {
  const operations = operationRecords(document, collectionKey);
  if (!operations) return invalidBindings('ENTITY_BINDING_DOCUMENT_INVALID');
  const out = [];
  for (const operation of operations) {
    const policy = policyLookup(operation.atom);
    if (!policy) return invalidBindings('ENTITY_BINDING_ATOM_INVALID');
    const rows = inspectOperationBindings(operation, policy, allowedBindingFields, requiredBindingFields, identityFields);
    if (!rows) return invalidBindings('ENTITY_BINDING_REQUIRED_ROLES_INVALID');
    for (const row of rows) out.push(Object.freeze(project(row.operation, row.binding)));
  }
  return Object.freeze(out);
}

export function requiredFlowEntityBindings(flow) {
  return requiredEntityBindings(
    flow,
    'steps',
    EXECUTE_BINDING_FIELDS.slice(1),
    EXECUTE_BINDING_FIELDS.slice(1),
    ['sourceIntentId'],
    (step, binding) => ({
      sourceIntentId: step.sourceIntentId,
      candidateId: binding.candidateId,
      role: binding.role,
    }),
  );
}

export function requiredEventEntityBindings(eventsDocument) {
  return requiredEntityBindings(
    eventsDocument,
    'events',
    FROZEN_BINDING_FIELDS,
    ['role', 'candidateId', 'lockId', 'receiptHash'],
    ['stepId', 'intentId', 'atom'],
    (event, binding) => ({
      stepId: event.stepId,
      intentId: event.intentId,
      atom: event.atom,
      role: binding.role,
      candidateId: binding.candidateId,
      lockId: binding.lockId,
      receiptHash: binding.receiptHash,
    }),
    legacyEventProjectionPolicyForAtom,
  );
}

// compile 只投影候选 provenance；锁号/收据摘要必须由 sign 后续补齐。
export function projectCompileEntityProvenance(rawOptions) {
  const options = closedRecord(rawOptions, { allowed: ['flowStep', 'events'], required: ['flowStep', 'events'] });
  if (!options) return invalidBindings('COMPILE_PROVENANCE_OPTIONS_INVALID');
  const step = dataRecord(options.flowStep);
  const events = closedArray(options.events);
  if (!step || !events || !nonEmpty(step.sourceIntentId)) return invalidBindings('COMPILE_PROVENANCE_SOURCE_INVALID');
  let bindings = Object.freeze([]);
  if (Object.hasOwn(step, 'entityBindings')) {
    const source = closedArray(step.entityBindings);
    if (!source) return invalidBindings('COMPILE_PROVENANCE_BINDINGS_INVALID');
    const projected = [];
    for (const value of source) {
      const binding = closedRecord(value, { allowed: ['candidateId', 'role'], required: ['candidateId', 'role'] });
      if (!binding || !nonEmpty(binding.candidateId) || !ROLES.has(binding.role)) {
        return invalidBindings('COMPILE_PROVENANCE_BINDINGS_INVALID');
      }
      projected.push(Object.freeze({ candidateId: binding.candidateId, role: binding.role }));
    }
    bindings = Object.freeze(projected);
  }
  const projectedEvents = [];
  for (const value of events) {
    const event = dataRecord(value);
    if (!event || event.replayReady === true) return invalidBindings('COMPILE_PROVENANCE_EVENT_INVALID');
    projectedEvents.push(Object.freeze({
      ...event,
      sourceIntentId: step.sourceIntentId,
      ...(bindings.length ? { entityBindings: bindings.map((binding) => ({ ...binding })) } : {}),
    }));
  }
  return Object.freeze({ ok: true, valid: true, events: Object.freeze(projectedEvents) });
}

function unsignedBindingKey({ stepId, intentId, atom, role, candidateId }) {
  return JSON.stringify([stepId, intentId, atom, role, candidateId]);
}

function eventKey({ stepId, intentId, atom }) {
  return JSON.stringify([stepId, intentId, atom]);
}

function parseBoundEvents(eventsBytes, eventsDocument) {
  if (!isBytes(eventsBytes)) return null;
  let parsed;
  let supplied;
  try {
    parsed = plainDataTree(JSON.parse(Buffer.from(eventsBytes).toString('utf8')));
    supplied = plainDataTree(eventsDocument);
  } catch {
    return null;
  }
  if (JSON.stringify(parsed) !== JSON.stringify(supplied)) return null;
  const root = dataRecord(supplied);
  const events = root ? operationRecords(root, 'events') : null;
  if (!root || !events || !nonEmpty(root.caseId)) return null;
  return Object.freeze({ document: root, events: Object.freeze(events) });
}

function expectedRoles(policy, actualRoles) {
  if (policy.effect === 'read') return actualRoles.size === 0;
  if (policy.requiredRoles) {
    return actualRoles.size === policy.requiredRoles.length
      && policy.requiredRoles.every((role) => actualRoles.has(role));
  }
  return actualRoles.size === 1 && [...actualRoles].every((role) => ROLES.has(role));
}

export function buildEntityBindingsDraft(rawOptions) {
  const options = closedRecord(rawOptions, {
    allowed: ['eventsBytes', 'eventsDocument', 'provenance'],
    required: ['eventsBytes', 'eventsDocument', 'provenance'],
  });
  if (!options) return invalidBindings('ENTITY_BINDING_DRAFT_OPTIONS_INVALID');
  const bound = parseBoundEvents(options.eventsBytes, options.eventsDocument);
  const source = closedArray(options.provenance);
  if (!bound || !source || source.length === 0) return invalidBindings('ENTITY_BINDING_DRAFT_SOURCE_INVALID');

  const byEvent = new Map();
  const rows = [];
  const unique = new Set();
  for (const value of source) {
    const row = closedRecord(value, {
      allowed: ['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'],
      required: ['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'],
    });
    if (!row || !['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'].every((field) => nonEmpty(row[field]))
      || !ROLES.has(row.role)) return invalidBindings('ENTITY_BINDING_DRAFT_PROVENANCE_INVALID');
    const key = JSON.stringify(['sourceIntentId', 'candidateId', 'role', 'stepId', 'intentId', 'atom'].map((field) => row[field]));
    if (unique.has(key)) return invalidBindings('ENTITY_BINDING_DRAFT_PROVENANCE_DUPLICATE');
    unique.add(key);
    const frozen = Object.freeze({
      stepId: row.stepId,
      intentId: row.intentId,
      atom: row.atom,
      sourceIntentId: row.sourceIntentId,
      candidateId: row.candidateId,
      role: row.role,
    });
    rows.push(frozen);
    const triple = eventKey(frozen);
    if (!byEvent.has(triple)) byEvent.set(triple, []);
    byEvent.get(triple).push(frozen);
  }

  const eventTriples = new Set();
  for (const event of bound.events) {
    if (!['stepId', 'intentId', 'atom'].every((field) => nonEmpty(event[field]))) {
      return invalidBindings('ENTITY_BINDING_DRAFT_EVENT_INVALID');
    }
    const triple = eventKey(event);
    if (eventTriples.has(triple)) return invalidBindings('ENTITY_BINDING_DRAFT_EVENT_DUPLICATE');
    eventTriples.add(triple);
    const policy = policyForAtom(event.atom);
    if (!policy) return invalidBindings('ENTITY_BINDING_DRAFT_EVENT_INVALID');
    const actual = byEvent.get(triple) || [];
    const roles = new Set(actual.map((row) => row.role));
    if (roles.size !== actual.length || !expectedRoles(policy, roles)) {
      return invalidBindings('ENTITY_BINDING_DRAFT_REQUIRED_ROLES_INVALID');
    }
  }
  for (const triple of byEvent.keys()) if (!eventTriples.has(triple)) return invalidBindings('ENTITY_BINDING_DRAFT_EVENT_MISSING');

  const draft = Object.freeze({
    schemaVersion: 1,
    artifactKind: 'entity-bindings-draft',
    caseId: bound.document.caseId,
    signed: false,
    replayReady: false,
    eventsSha256: hashIdentityAdmissionBytes(options.eventsBytes),
    bindings: Object.freeze(rows),
  });
  return Object.freeze({ ok: true, valid: true, draft });
}

export function freezeEntityBindingsDraft(rawOptions) {
  const options = closedRecord(rawOptions, {
    allowed: ['caseId', 'eventsBytes', 'eventsDocument', 'draft', 'confirmations', 'signerId', 'signedAt'],
    required: ['caseId', 'eventsBytes', 'eventsDocument', 'draft', 'confirmations', 'signerId', 'signedAt'],
  });
  if (!options || !nonEmpty(options.caseId) || !nonEmpty(options.signerId) || !nonEmpty(options.signedAt)) {
    return invalidBindings('ENTITY_LOCK_FREEZE_OPTIONS_INVALID');
  }
  const draft = closedRecord(options.draft, {
    allowed: ['schemaVersion', 'artifactKind', 'caseId', 'signed', 'replayReady', 'eventsSha256', 'bindings'],
    required: ['schemaVersion', 'artifactKind', 'caseId', 'signed', 'replayReady', 'eventsSha256', 'bindings'],
  });
  if (!draft || draft.schemaVersion !== 1 || draft.artifactKind !== 'entity-bindings-draft'
    || draft.caseId !== options.caseId || draft.signed !== false || draft.replayReady !== false
    || draft.eventsSha256 !== hashIdentityAdmissionBytes(options.eventsBytes)) {
    return invalidBindings('ENTITY_LOCK_FREEZE_DRAFT_INVALID');
  }
  const rebuilt = buildEntityBindingsDraft({
    eventsBytes: options.eventsBytes,
    eventsDocument: options.eventsDocument,
    provenance: draft.bindings,
  });
  if (rebuilt.ok !== true || JSON.stringify(rebuilt.draft) !== JSON.stringify(options.draft)) {
    return invalidBindings('ENTITY_LOCK_FREEZE_DRAFT_TAMPERED');
  }

  const source = closedArray(options.confirmations);
  if (!source || source.length === 0) return invalidBindings('ENTITY_LOCK_FREEZE_CONFIRMATIONS_INVALID');
  const confirmations = new Map();
  for (const value of source) {
    const row = closedRecord(value, {
      allowed: ['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role', 'receipt'],
      required: ['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role', 'receipt'],
    });
    let receipt = null;
    try { receipt = plainDataTree(row?.receipt); } catch { receipt = null; }
    if (!row || !['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'].every((field) => nonEmpty(row[field]))
      || !ROLES.has(row.role) || !receipt || !verifyEntityLockReceipt(receipt)) {
      return invalidBindings('ENTITY_LOCK_FREEZE_CONFIRMATIONS_INVALID');
    }
    const key = JSON.stringify(['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'].map((field) => row[field]));
    if (confirmations.has(key)) return invalidBindings('ENTITY_LOCK_FREEZE_CONFIRMATIONS_DUPLICATE');
    confirmations.set(key, Object.freeze({ row, receipt: Object.freeze(receipt) }));
  }

  const draftRows = closedArray(draft.bindings);
  if (!draftRows || draftRows.length !== confirmations.size) return invalidBindings('ENTITY_LOCK_FREEZE_CONFIRMATIONS_INEXACT');
  const bindings = [];
  const used = new Set();
  for (const value of draftRows) {
    const row = closedRecord(value, {
      allowed: ['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'],
      required: ['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'],
    });
    if (!row) return invalidBindings('ENTITY_LOCK_FREEZE_DRAFT_INVALID');
    const key = JSON.stringify(['stepId', 'intentId', 'atom', 'sourceIntentId', 'candidateId', 'role'].map((field) => row[field]));
    const confirmed = confirmations.get(key);
    if (!confirmed || used.has(key)) return invalidBindings('ENTITY_LOCK_FREEZE_CONFIRMATIONS_INEXACT');
    used.add(key);
    bindings.push({
      stepId: row.stepId,
      intentId: row.intentId,
      atom: row.atom,
      role: row.role,
      candidateId: row.candidateId,
      lockId: confirmed.receipt.lockId,
      receiptHash: confirmed.receipt.receiptHash,
    });
  }
  const artifact = {
    schemaVersion: 1,
    artifactKind: 'entity-locks-frozen',
    caseId: options.caseId,
    signed: true,
    replayReady: true,
    signerId: options.signerId,
    signedAt: options.signedAt,
    eventsSha256: draft.eventsSha256,
    bindings,
  };
  artifact.signature = calculateIdentityAdmissionSignature(artifact);
  return Object.freeze({ ok: true, valid: true, artifact: Object.freeze(artifact) });
}

export function checkReplayEntityAdmission(rawOptions) {
  const options = closedRecord(rawOptions, {
    allowed: ['caseId', 'eventsBytes', 'eventsDocument', 'frozenLockAuthority'],
    required: ['caseId', 'eventsBytes', 'eventsDocument'],
  });
  if (!options || !nonEmpty(options.caseId)) return denied('REPLAY_IDENTITY_OPTIONS_INVALID', 'PROVIDE_CLOSED_REPLAY_IDENTITY_INPUTS');
  const bound = parseBoundEvents(options.eventsBytes, options.eventsDocument);
  if (!bound || bound.document.caseId !== options.caseId) return denied('REPLAY_EVENTS_INVALID', 'RESTORE_ORIGINAL_EVENTS_BYTES');
  if (bound.events.length === 0) return denied('REPLAY_EVENTS_EMPTY', 'COMPILE_AT_LEAST_ONE_DETERMINISTIC_EVENT');
  const authorityWasSupplied = Object.hasOwn(options, 'frozenLockAuthority');
  const classifiedTriples = new Set();
  let allRead = true;
  for (const event of bound.events) {
    if (!['stepId', 'intentId', 'atom', 'action'].every((field) => nonEmpty(event[field]))) {
      return denied('REPLAY_EVENT_SHAPE_INVALID', 'RECOMPILE_CLOSED_EVENT_SHAPES');
    }
    const triple = eventKey(event);
    if (classifiedTriples.has(triple)) return denied('REPLAY_EVENT_TRIPLE_DUPLICATE', 'RECOMPILE_EVENTS_WITH_UNIQUE_TRIPLES');
    classifiedTriples.add(triple);
    const policy = policyForAtom(event.atom);
    if (!policy) return denied('REPLAY_EVENT_POLICY_INVALID', 'RECOMPILE_EVENTS_WITH_KNOWN_SHAPES');
    if (policy.effect === 'read') {
      if (!policy.allowedActions?.includes(event.action)) {
        return denied('REPLAY_READ_EVENT_ACTION_INVALID', 'RESTORE_COMPILER_AUTHORED_READ_EVENT_ACTION');
      }
      if (!authorityWasSupplied && !safeUnboundReadEvent(event, bound.document)) {
        return denied('REPLAY_READ_EVENT_TARGET_INVALID', 'USE_FIXED_READ_ROUTE_OR_ROUTE_HUMAN_FOR_SIGNED_ZERO_BINDING_AUTHORITY');
      }
    } else {
      allRead = false;
    }
  }
  if (allRead && !authorityWasSupplied) return allowed('deterministic-read-only-policy');
  const state = stateFor(options.frozenLockAuthority, 'verify');
  const artifact = state?.artifact;
  if (!artifact) return denied('FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID', 'LOAD_FIXED_OR_HUMAN_SIGNED_FROZEN_LOCK_AUTHORITY');
  if (artifact.caseId !== options.caseId || artifact.eventsSha256 !== hashIdentityAdmissionBytes(options.eventsBytes)) {
    return denied('FROZEN_ENTITY_LOCKS_EVENTS_MISMATCH', 'RESIGN_LOCKS_FOR_EXACT_EVENTS_BYTES');
  }

  const byEvent = new Map();
  for (const binding of artifact.bindings) {
    const triple = eventKey(binding);
    if (!byEvent.has(triple)) byEvent.set(triple, []);
    byEvent.get(triple).push(binding);
  }
  const seenEvents = new Set();
  let usedBindings = 0;
  for (const event of bound.events) {
    if (!['stepId', 'intentId', 'atom'].every((field) => nonEmpty(event[field]))) {
      return denied('REPLAY_EVENT_TRIPLE_INVALID', 'RECOMPILE_EVENTS_AND_BINDINGS');
    }
    const triple = eventKey(event);
    if (seenEvents.has(triple)) return denied('REPLAY_EVENT_TRIPLE_DUPLICATE', 'RECOMPILE_EVENTS_WITH_UNIQUE_TRIPLES');
    seenEvents.add(triple);
    const rows = byEvent.get(triple) || [];
    const roles = new Set(rows.map((row) => row.role));
    const policy = policyForAtom(event.atom);
    if (!policy || roles.size !== rows.length || !expectedRoles(policy, roles)) {
      return denied('FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID', 'REDRAFT_AND_RESIGN_ALL_EVENT_ROLES');
    }
    usedBindings += rows.length;
  }
  if (usedBindings !== artifact.bindings.length || [...byEvent.keys()].some((triple) => !seenEvents.has(triple))) {
    return denied('FROZEN_ENTITY_LOCKS_EXTRA_BINDINGS', 'REMOVE_NON_EVENT_BINDINGS_AND_RESIGN');
  }
  return allowed('frozen-entity-locks-internal-policy');
}

export function checkCompileIdentityAdmission(rawOptions) {
  const options = closedRecord(rawOptions, {
    allowed: CHECK_FIELDS,
    required: ['mode', 'caseId', 'containsEntityMutation'],
  });
  if (!options) return denied('IDENTITY_ADMISSION_OPTIONS_INVALID', 'PROVIDE_CLOSED_DATA_ONLY_OPTIONS');
  if (!nonEmpty(options.caseId)) return denied('IDENTITY_ADMISSION_CASE_INVALID', 'PROVIDE_SAFE_CASE_ID');
  if (typeof options.containsEntityMutation !== 'boolean') {
    return denied('IDENTITY_ADMISSION_MUTATION_POLICY_INVALID', 'DERIVE_MUTATION_POLICY_FROM_REGISTRY');
  }
  if (Object.hasOwn(options, 'signedAuthority') || Object.hasOwn(options, 'frozenLocks')) {
    if (options.mode === 'execute') {
      return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID', 'LOAD_FIXED_OR_HUMAN_SIGNED_EXECUTE_AUTHORITY');
    }
    if (options.mode === 'verify') {
      return denied('FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID', 'LOAD_FIXED_OR_HUMAN_SIGNED_FROZEN_LOCK_AUTHORITY');
    }
  }

  if (options.mode === 'execute') {
    const forbidden = ['frozenLockAuthority', 'eventsBytes', 'eventsDocument'].some((key) => Object.hasOwn(options, key));
    if (forbidden) return denied('IDENTITY_ADMISSION_DOMAIN_FIELDS_INVALID', 'USE_EXECUTE_AUTHORITY_FIELDS_ONLY');
    const requiredBindings = Object.hasOwn(options, 'requiredBindings')
      ? inspectBindings(options.requiredBindings, EXECUTE_BINDING_FIELDS)
      : Object.freeze([]);
    if (!requiredBindings) return denied('PRE_EXECUTION_IDENTITY_BINDINGS_INVALID', 'PROVIDE_CLOSED_EXECUTE_BINDINGS');
    const hasFlow = Object.hasOwn(options, 'flow');
    const policyMutation = hasFlow ? flowContainsEntityMutation(options.flow) : null;
    if (policyMutation === false) return allowed('deterministic-read-only-policy');
    // true 可由上游作为额外 fail-closed 信号；false 没有冻结 flow 背书时绝不授权。
    if (policyMutation === null && options.containsEntityMutation !== true) {
      return denied('IDENTITY_ADMISSION_MUTATION_POLICY_UNPROVEN', 'PROVIDE_FLOW_FOR_INTERNAL_SIDE_EFFECT_DERIVATION');
    }
    return verifyExecuteAuthority({
      caseId: options.caseId,
      executeAuthority: options.executeAuthority,
      flowBytes: options.flowBytes,
      testcaseBytes: options.testcaseBytes,
      requiredBindings,
    });
  }

  if (options.mode === 'verify') {
    const forbidden = ['executeAuthority', 'flowBytes', 'testcaseBytes', 'flow'].some((key) => Object.hasOwn(options, key));
    if (forbidden) return denied('IDENTITY_ADMISSION_DOMAIN_FIELDS_INVALID', 'USE_VERIFY_AUTHORITY_FIELDS_ONLY');
    const requiredBindings = Object.hasOwn(options, 'requiredBindings')
      ? inspectBindings(options.requiredBindings, FROZEN_BINDING_FIELDS, { receipt: true })
      : Object.freeze([]);
    if (!requiredBindings) return denied('FROZEN_ENTITY_BINDINGS_INVALID', 'PROVIDE_CLOSED_FROZEN_BINDINGS');
    return verifyFrozenLocks({
      caseId: options.caseId,
      containsEntityMutation: options.containsEntityMutation,
      frozenLockAuthority: options.frozenLockAuthority,
      eventsBytes: options.eventsBytes,
      requiredBindings,
    });
  }

  return denied('IDENTITY_ADMISSION_MODE_INVALID', 'USE_EXECUTE_OR_VERIFY_MODE');
}

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
import { requiresTargetContinuityRef as continuityRefRequired } from './entity-destructive-continuity.mjs';

const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const BARE_HASH_RE = /^[a-f0-9]{64}$/;
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;
const ROLES = new Set(['subject', 'source', 'target']);
const DOMAINS = new Set(['execute', 'verify']);
// 准入受众（admission audience，ADR-0010）：冻结身份准入件的必填签名字段，标记该件只许在测试还是生产上下文授权。
const AUDIENCES = new Set(['test', 'production']);
const MAX_BINDINGS = 10000;
const authorityState = new WeakMap();

const EXECUTE_ARTIFACT_FIELDS = [
  'schemaVersion', 'artifactKind', 'authorizedFor', 'caseId', 'signed', 'signerId', 'signedAt',
  'audience', 'flowSha256', 'testcaseSha256', 'bindings', 'signature',
];
const FROZEN_ARTIFACT_FIELDS = [
  'schemaVersion', 'artifactKind', 'caseId', 'signed', 'replayReady', 'signerId', 'signedAt',
  'audience', 'eventsSha256', 'bindings', 'signature',
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

// ── 准入三面策略（three-facet admission policy）───────────────────────────────
// 人签冻结的 admission policy 在生产侧的只读镜像。事实源是三个互不蕴含的面，不是一个 effect 字符串：
//   entityChange          结构性变更：none | entity | relation —— 改不改业务实体、改的是单体还是关系；
//   identityBindingRoles  身份钉定角色：冻结实体绑定必须覆盖哪些角色（空集 = 没有身份可钉）；
//   nonEntityEffect       非实体持久副作用：none | persistent | unknown —— 会不会在业务对象模型之外
//                         留下持久痕迹（例如真给被测智能体发一条消息、在对方会话记录里留痕）。
// 第四面「目标身份连续性」（动作时刻要不要回读证明「删的正是建的那个」）**不在本表登记**：
// 唯一事实源是纯守卫 entity-destructive-continuity 的 requiresTargetContinuityRef，经
// admissionPolicyForAtom 外联拼进聚合视图，绝不在两张表各存一份。
// 三面 → 旧 { effect, requiredRoles } 是 deriveAdmissionRule 的纯函数派生投影（唯一投影点，
// 只保留兼容读法）；只有三面全清白才进零绑定只读通道，未知项一律保守默认，registry/caller flags
// 均无表决权。往本表加登记原子是 ADR-0004 人签事件，实现者不得自行添加。
const ENTITY_CHANGES = new Set(['none', 'entity', 'relation']);
const NON_ENTITY_EFFECTS = new Set(['none', 'persistent', 'unknown']);
const FACET_FIELDS = ['entityChange', 'identityBindingRoles', 'nonEntityEffect', 'allowedActions'];

const facetRow = (entityChange, identityBindingRoles, nonEntityEffect, allowedActions) => Object.freeze({
  entityChange,
  identityBindingRoles: Object.freeze([...identityBindingRoles]),
  nonEntityEffect,
  ...(allowedActions ? { allowedActions: Object.freeze([...allowedActions]) } : {}),
});

const ATOM_ADMISSION_FACETS = new Map([
  ['nav.workflowManagement', facetRow('none', [], 'none', ['nav'])],
  ['assert.textVisible', facetRow('none', [], 'none', ['assert'])],
  ['workflow.create', facetRow('entity', ['subject'], 'none')],
  ['workflow.addNode', facetRow('entity', ['subject'], 'none')],
  ['workflow.setNodeField', facetRow('entity', ['subject'], 'none')],
  ['workflow.setSwitch', facetRow('entity', ['subject'], 'none')],
  ['workflow.addNodeInputVar', facetRow('entity', ['subject'], 'none')],
  ['agent.removeToolByName', facetRow('entity', ['subject'], 'none')],
  ['workflow.bindAgent', facetRow('relation', ['source', 'target'], 'none')],
  // chat.sendAndWait：不改业务实体（none）；被测智能体即 subject，身份可钉且必须钉（['subject']）；
  // 真给被测智能体发一条消息、在对方会话里留痕，故第三面是 persistent 而非 unknown。
  // 派生回 entity-lock + mutation + ['subject']——与登记前的未登记保守默认逐字节相同（主策略通道零位移）；
  // 唯一位移是遗留 event 投影由「三角色任一」收紧成「恰 subject」（收紧方向）。
  // 档位由 Steven 2026-07-31 在决策岔口裁定（甲：登记为可锁；不取乙：守住 unsupported）——
  // 见 docs/plans/admission-policy-facets/plan.md §2.1.1 与 docs/plans/chiefcomplaint-sendandwait-admission/GRILL.md。
  // 注意：persistent 只是如实记录「会真发消息」这件事实，本行【不】承载「允许执行几次」的授权，
  // 「有非实体持久副作用」的独立授权档仍未开（同 plan §2.3 末尾挂账）。
  ['chat.sendAndWait', facetRow('none', ['subject'], 'persistent')],
]);

// 未登记原子的保守默认：当作改业务实体、须钉 subject 身份、持久副作用未知——三面任一不清白即
// 进不了只读通道。派生回 mutation + ['subject']，与三面拆分前逐字节相同。
const UNREGISTERED_ATOM_FACETS = facetRow('entity', ['subject'], 'unknown');

// 零绑定只读通道的准入条件：三面全清白。缺任一条件都不得零绑定放行（身份敏感读取要钉身份、
// 有持久副作用的原子要有人为它签字，都不是「只读」）。
function unboundReadAdmissible(facets) {
  return facets.entityChange === 'none' && facets.identityBindingRoles.length === 0 && facets.nonEntityEffect === 'none';
}

// 准入档（admission class）：unbound-read = 零绑定只读；entity-lock = 须恰好钉住指定角色的冻结绑定；
// unsupported = 既不是只读、又没有身份可钉——现有三条通道都不适用，一律 fail-closed。
// 【不要】把 unsupported 投影成「非只读 + 空必需角色集」：实测证明那不是挡板而是漏洞
// ——inspectBindings 收空集为合法、expectedRoles 遇空 requiredRoles 精确匹配零绑定成功，于是零绑定
// 的已签冻结件会真放行、真启动浏览器（docs/plans/admission-policy-facets/plan.md §2.2）。
function admissionClassOf(facets) {
  if (unboundReadAdmissible(facets)) return 'unbound-read';
  return facets.identityBindingRoles.length > 0 ? 'entity-lock' : 'unsupported';
}

function validatedFacets(value) {
  const facets = closedRecord(value, { allowed: FACET_FIELDS, required: FACET_FIELDS.slice(0, 3) });
  if (!facets || !ENTITY_CHANGES.has(facets.entityChange) || !NON_ENTITY_EFFECTS.has(facets.nonEntityEffect)) return null;
  const roles = closedArray(facets.identityBindingRoles);
  if (!roles || roles.some((role) => !ROLES.has(role)) || new Set(roles).size !== roles.length) return null;
  const readAdmissible = facets.entityChange === 'none' && roles.length === 0 && facets.nonEntityEffect === 'none';
  // allowedActions 与只读档联锁：只有零绑定只读行可携，且必须携非空闭集；非只读行携带 = schema 非法，
  // 不得静默忽略（否则表上写着的动作白名单永远不生效，读者会以为它在把关）。
  const hasActions = Object.hasOwn(facets, 'allowedActions');
  if (readAdmissible !== hasActions) return null;
  let actions = null;
  if (hasActions) {
    actions = closedArray(facets.allowedActions);
    if (!actions || actions.length === 0 || actions.some((action) => !nonEmpty(action))) return null;
  }
  return { entityChange: facets.entityChange, roles, nonEntityEffect: facets.nonEntityEffect, actions };
}

// 三面 → 旧读法的唯一投影点。effect/requiredRoles 的字面量只许出现在这里。
export function deriveAdmissionRule(rawFacets) {
  const facets = validatedFacets(rawFacets);
  if (!facets) return null;
  const admissionClass = admissionClassOf({
    entityChange: facets.entityChange, identityBindingRoles: facets.roles, nonEntityEffect: facets.nonEntityEffect,
  });
  // unsupported 档没有合法旧投影：effect 置 null，查表出口据此判死。
  const effect = admissionClass === 'unsupported' ? null
    : facets.entityChange === 'relation' ? 'relation'
      : admissionClass === 'unbound-read' ? 'read' : 'mutation';
  return Object.freeze({
    admissionClass,
    effect,
    requiredRoles: Object.freeze([...facets.roles]),
    ...(facets.actions ? { allowedActions: Object.freeze([...facets.actions]) } : {}),
  });
}

// 逐原子三面（未登记原子回保守默认）。atom 非法（非字符串/空串）→ null，消费方各自 fail-closed。
export function admissionFacetsForAtom(atom) {
  if (!nonEmpty(atom)) return null;
  return ATOM_ADMISSION_FACETS.get(atom) || UNREGISTERED_ATOM_FACETS;
}

// 已登记原子清单（供「生产镜像不得比人签权威多登记原子」这类守卫消费）。
export function admissionFacetAtoms() {
  return Object.freeze([...ATOM_ADMISSION_FACETS.keys()]);
}

// 聚合视图：三面 + 外联的第四面（目标身份连续性）+ 派生旧读法。第四面单一供源，本表零重复登记。
export function admissionPolicyForAtom(atom) {
  const facets = admissionFacetsForAtom(atom);
  if (!facets) return null;
  return Object.freeze({
    atom,
    ...facets,
    targetContinuity: continuityRefRequired(atom) ? 'same-platform-id' : 'none',
    rule: deriveAdmissionRule(facets),
  });
}

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
    || !AUDIENCES.has(artifact.audience)
    || !HASH_RE.test(artifact.flowSha256 || '')
    || !HASH_RE.test(artifact.testcaseSha256 || '')
    || !HASH_RE.test(artifact.signature || '')) return null;
  const bindings = inspectBindings(artifact.bindings, EXECUTE_BINDING_FIELDS);
  if (!bindings || artifact.signature !== calculateIdentityAdmissionSignature(artifact)) return null;
  return Object.freeze({ ...artifact, bindings });
}

function validateFrozenArtifact(value) {
  // v1/v2 只按 schemaVersion 判别（agent-id-readback R2-3）；v1 闭合面逐字不变。
  const version = value && typeof value === 'object' && !Array.isArray(value) ? value.schemaVersion : null;
  const isV2 = version === 2;
  const V2_EXTRA = ['identityProfileDigest', 'identityObservationsSha256', 'identityObservations'];
  const fields = isV2 ? [...FROZEN_ARTIFACT_FIELDS, ...V2_EXTRA] : FROZEN_ARTIFACT_FIELDS;
  const artifact = closedRecord(value, { allowed: fields, required: fields });
  if (!artifact
    || (artifact.schemaVersion !== 1 && artifact.schemaVersion !== 2)
    || artifact.artifactKind !== 'entity-locks-frozen'
    || artifact.signed !== true
    || artifact.replayReady !== true
    || !nonEmpty(artifact.caseId)
    || !nonEmpty(artifact.signerId)
    || !nonEmpty(artifact.signedAt)
    || !AUDIENCES.has(artifact.audience)
    || !HASH_RE.test(artifact.eventsSha256 || '')
    || !HASH_RE.test(artifact.signature || '')) return null;
  if (isV2) {
    if (!HASH_RE.test(artifact.identityProfileDigest || '') || !HASH_RE.test(artifact.identityObservationsSha256 || '')) return null;
    const rows = closedArray(artifact.identityObservations);
    if (!rows || rows.length === 0) return null;
    for (const rawRow of rows) {
      const row = closedRecord(rawRow, {
        allowed: ['name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId'],
        required: ['name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId'],
      });
      if (!row || !['name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId'].every((f) => nonEmpty(row[f]))
        || !ROLES.has(row.role)) return null;
    }
  }
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
      audience: artifact.audience,
    });
    // audience 是已验证签名件的公开元数据（非权限），随成功返回外露供凭据上下文门判；opaque handle 仍不可伪造。
    return Object.freeze({ ok: true, authority, audience: artifact.audience });
  } catch {
    return denied('IDENTITY_AUTHORITY_READ_OR_PARSE_FAILED', 'RESTORE_CANONICAL_PRD_AND_ARTIFACT');
  }
}

// 目标连续性 ref 强制判据（C3，GRILL D2/D4）：破坏性/targeting 原子（workflow.deleteByName / agent.delete /
// picker.selectFirstTool）才索要 identityObservationRef；孤儿 agent.removeToolByName（有 side-effect policy、
// 无编译器）与 create/addNode/setNodeField 等一律不索要。判定本体委给纯守卫 entity-destructive-continuity，
// 本层只作生产侧准入策略的可消费入口——【不改】上方人签冻结的 SIDE_EFFECT_POLICY 只读镜像（effect/role 不动）；
// 把本判据升进人签冻结准入策略件属 ADR-0004 重签事件，走人。
export function requiresTargetContinuityRef(atom) {
  return continuityRefRequired(atom);
}

// v2 冻结锁的期望三元组读取（agent-id-readback plan §5）：只对已铸 verify 域 opaque authority 暴露
// identityObservations 只读投影；v1 件回 null（零行为差）。供 replay 点击前对已签 platformId 比对消费。
export function readFrozenIdentityObservations(frozenLockAuthority) {
  const state = stateFor(frozenLockAuthority, 'verify');
  const artifact = state?.artifact;
  if (!artifact || artifact.schemaVersion !== 2 || !Array.isArray(artifact.identityObservations)) return null;
  return artifact.identityObservations.map((row) => ({ ...row }));
}

// 凭据上下文门（credential-context gate，ADR-0010）：准入铸权后、启动浏览器前的纯函数门。
// 严格匹配——真凭据 run(生产上下文) 只放行 production 受众、无凭据 run(测试上下文) 只放行 test 受众，
// 不符 fail-closed 不启动浏览器。防「测试锁被误指向真 SUT 授权真实改动」。入参闭合、枚举校验、畸形 fail-closed。
export function checkCredentialAudienceGate(rawOptions) {
  const options = closedRecord(rawOptions, { allowed: ['audience', 'credentialContext'] });
  if (!options || !AUDIENCES.has(options.audience) || !AUDIENCES.has(options.credentialContext)) {
    return denied('CREDENTIAL_AUDIENCE_OPTIONS_INVALID', 'PROVIDE_CLOSED_AUDIENCE_AND_CREDENTIAL_CONTEXT');
  }
  if (options.audience !== options.credentialContext) {
    return denied('CREDENTIAL_AUDIENCE_MISMATCH', 'USE_AUDIENCE_MATCHING_THE_RUN_CREDENTIAL_CONTEXT');
  }
  return allowed('credential-audience-match');
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

// 旧策略表 = 三面的派生投影（不是第二张手写表）。派生一次冻结复用，消费方拿到的对象与拆分前同形。
// 落在这里而不是三面表旁边：派生要用下方的 nonEmpty/closedRecord/closedArray，模块求值顺序不能倒挂。
const SIDE_EFFECT_POLICY = new Map([...ATOM_ADMISSION_FACETS].map(([atom, facets]) => [atom, deriveAdmissionRule(facets)]));
const UNREGISTERED_ATOM_RULE = deriveAdmissionRule(UNREGISTERED_ATOM_FACETS);
// 遗留 event 投影的未登记默认：requiredRoles: null 表示「三角色任一且恰一个」，与主策略的精确
// ['subject'] 不是同一件事——合并会把未登记 event 的 source/target 由合法变 invalid，故保留独立 adapter。
const LEGACY_UNREGISTERED_EVENT_RULE = Object.freeze({ effect: UNREGISTERED_ATOM_RULE.effect, requiredRoles: null });

function policyForAtom(atom) {
  if (!nonEmpty(atom)) return null;
  const rule = SIDE_EFFECT_POLICY.get(atom) || UNREGISTERED_ATOM_RULE;
  // unsupported 档没有合法通道：返 null，让各消费点走自己既有的 !policy fail-closed 分支。
  return rule.admissionClass === 'unsupported' ? null : rule;
}

// 旧 events 内嵌 binding 投影只用于历史 authority 回归，不参与 successor replay 决策；保留其“单一显式角色”读取兼容。
function legacyEventProjectionPolicyForAtom(atom) {
  if (!nonEmpty(atom)) return null;
  const registered = SIDE_EFFECT_POLICY.get(atom);
  if (!registered) return LEGACY_UNREGISTERED_EVENT_RULE;
  return registered.admissionClass === 'unsupported' ? null : registered;
}

function containsMutation(document, collectionKey) {
  const records = operationRecords(document, collectionKey);
  if (!records) return true;
  for (const record of records) {
    const facets = admissionFacetsForAtom(record.atom);
    // 「不能走零绑定只读」= 三面里任一不清白（等价于拆分前的 effect !== 'read'，不是「改没改业务实体」）。
    if (!facets || !unboundReadAdmissible(facets)) return true;
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
    allowed: ['caseId', 'eventsBytes', 'eventsDocument', 'draft', 'confirmations', 'signerId', 'signedAt', 'audience', 'identityObservations'],
    required: ['caseId', 'eventsBytes', 'eventsDocument', 'draft', 'confirmations', 'signerId', 'signedAt', 'audience'],
  });
  if (!options || !nonEmpty(options.caseId) || !nonEmpty(options.signerId) || !nonEmpty(options.signedAt)
    || !AUDIENCES.has(options.audience)) {
    return invalidBindings('ENTITY_LOCK_FREEZE_OPTIONS_INVALID');
  }
  // v1/v2 只按 schemaVersion 判别（agent-id-readback R2-3：禁按字段缺席猜版本）；v1 路径逐字不变。
  const draftVersion = options.draft && typeof options.draft === 'object' && !Array.isArray(options.draft)
    ? options.draft.schemaVersion : null;
  const isV2 = draftVersion === 2;
  const V1_DRAFT_FIELDS = ['schemaVersion', 'artifactKind', 'caseId', 'signed', 'replayReady', 'eventsSha256', 'bindings'];
  const draft = closedRecord(options.draft, {
    allowed: isV2 ? [...V1_DRAFT_FIELDS, 'identityProfileDigest', 'identityObservationsSha256'] : V1_DRAFT_FIELDS,
    required: isV2 ? [...V1_DRAFT_FIELDS, 'identityProfileDigest', 'identityObservationsSha256'] : V1_DRAFT_FIELDS,
  });
  if (!draft || (draft.schemaVersion !== 1 && draft.schemaVersion !== 2) || draft.artifactKind !== 'entity-bindings-draft'
    || draft.caseId !== options.caseId || draft.signed !== false || draft.replayReady !== false
    || draft.eventsSha256 !== hashIdentityAdmissionBytes(options.eventsBytes)) {
    return invalidBindings('ENTITY_LOCK_FREEZE_DRAFT_INVALID');
  }
  if (isV2 && (!HASH_RE.test(draft.identityProfileDigest || '') || !HASH_RE.test(draft.identityObservationsSha256 || ''))) {
    return invalidBindings('ENTITY_LOCK_FREEZE_DRAFT_INVALID');
  }
  // 身份观察行（v2 必备、v1 禁携）：由 sign 侧完成对账后传入，此处复验闭合形状。
  let identityObservations = null;
  if (isV2) {
    const rows = closedArray(options.identityObservations);
    if (!rows || rows.length === 0) return invalidBindings('ENTITY_LOCK_FREEZE_OBSERVATIONS_INVALID');
    identityObservations = [];
    for (const value of rows) {
      const row = closedRecord(value, {
        allowed: ['name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId'],
        required: ['name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId'],
      });
      if (!row || !['name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId'].every((f) => nonEmpty(row[f]))
        || !ROLES.has(row.role)) {
        return invalidBindings('ENTITY_LOCK_FREEZE_OBSERVATIONS_INVALID');
      }
      identityObservations.push(Object.freeze({ ...row }));
    }
  } else if (Object.hasOwn(options, 'identityObservations') && options.identityObservations != null) {
    return invalidBindings('ENTITY_LOCK_FREEZE_OBSERVATIONS_INVALID');
  }
  // 防篡改重建：对 v1 投影比对（v2 附加字段剥离后必须与 provenance 重建结果逐字一致）。
  const rebuilt = buildEntityBindingsDraft({
    eventsBytes: options.eventsBytes,
    eventsDocument: options.eventsDocument,
    provenance: draft.bindings,
  });
  const draftV1Projection = isV2
    ? { ...Object.fromEntries(V1_DRAFT_FIELDS.map((f) => [f, draft[f]])), schemaVersion: 1 }
    : options.draft;
  if (rebuilt.ok !== true || JSON.stringify(rebuilt.draft) !== JSON.stringify(draftV1Projection)) {
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
    schemaVersion: isV2 ? 2 : 1,
    artifactKind: 'entity-locks-frozen',
    caseId: options.caseId,
    signed: true,
    replayReady: true,
    signerId: options.signerId,
    signedAt: options.signedAt,
    audience: options.audience,
    eventsSha256: draft.eventsSha256,
    bindings,
    // v2 身份闭环（agent-id-readback plan §4）：通道指纹 + 观察件原始字节 sha + 期望三元组（回放点击前比对消费）。
    ...(isV2 ? {
      identityProfileDigest: draft.identityProfileDigest,
      identityObservationsSha256: draft.identityObservationsSha256,
      identityObservations,
    } : {}),
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

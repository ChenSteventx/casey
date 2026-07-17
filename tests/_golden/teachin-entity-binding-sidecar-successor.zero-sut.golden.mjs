#!/usr/bin/env node
// successor 门禁：events v2 原字节 + 未签 binding sidecar + 人签 frozen locks + replay 内部推导。
// 纯函数/静态读取；禁止子进程、SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as admission from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const SECTION = process.argv[2] ?? 'all';
if (!new Set(['all', 'draft', 'sign', 'replay', 'hostile']).has(SECTION)) process.exit(2);
const ROOT = new URL('../../', import.meta.url);
const FIXTURE_ROOT = 'tests/_golden/fixtures/teachin-entity-binding-sidecar-successor';
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/teachin-entity-binding-sidecar-successor/${name}`, import.meta.url), 'utf8'));
const draftSchema = fixture('entity-bindings-draft.schema.json');
const locksSchema = fixture('entity-locks-frozen.schema.json');
const frozenFixture = fixture('entity-locks.frozen.json');
const oldEventsSchema = JSON.parse(readFileSync(new URL('./schemas/events.schema.json', import.meta.url), 'utf8'));
const prd = JSON.parse(readFileSync(new URL('../../loop/prd-teachin-entity-binding-sidecar-successor.json', import.meta.url), 'utf8'));

const EVENTS_TEXT = '{"schemaVersion":2,"channel":"web","caseId":"tc_sidecar_successor","url":"{{baseUrl}}/workflow","recordedAt":"2026-07-17T00:00:00.000Z","compiledBy":"successor-golden","authored":false,"events":[{"stepId":"atstep_1","intentId":"intent_1","atom":"workflow.create","action":"click","text":"新增工作流"},{"stepId":"atstep_2","intentId":"intent_2","atom":"workflow.setNodeField","action":"fill","fieldLabel":"名称","value":"{{uniqueName}}"},{"stepId":"atstep_3","intentId":"intent_3","atom":"workflow.bindAgent","action":"click","text":"绑定智能体"}]}\n';
const EVENTS_BYTES = Buffer.from(EVENTS_TEXT);
const EVENTS = JSON.parse(EVENTS_TEXT);
const EVENTS_SHA = `sha256:${createHash('sha256').update(EVENTS_BYTES).digest('hex')}`;
const PROVENANCE = [
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', sourceIntentId: 'source_1', candidateId: 'candidate-workflow-main', role: 'subject' },
  { stepId: 'atstep_2', intentId: 'intent_2', atom: 'workflow.setNodeField', sourceIntentId: 'source_2', candidateId: 'candidate-workflow-main', role: 'subject' },
  { stepId: 'atstep_3', intentId: 'intent_3', atom: 'workflow.bindAgent', sourceIntentId: 'source_3', candidateId: 'candidate-workflow-main', role: 'source' },
  { stepId: 'atstep_3', intentId: 'intent_3', atom: 'workflow.bindAgent', sourceIntentId: 'source_3', candidateId: 'candidate-agent-main', role: 'target' },
];
const workflowReceipt = createEntityLockReceipt({
  lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-workflow',
  expected: { name: '工作流A', code: 'WF-A' }, observed: { name: '工作流A', code: 'WF-A' }, source: 'user-confirmed',
});
const agentReceipt = createEntityLockReceipt({
  lockId: 'lock-agent-main', kind: 'agent', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-agent',
  expected: { name: '智能体A', code: 'AG-A' }, observed: { name: '智能体A', code: 'AG-A' }, source: 'user-confirmed',
});
const CONFIRMATIONS = PROVENANCE.map((row) => ({ ...row, receipt: row.candidateId.includes('agent') ? agentReceipt : workflowReceipt }));

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const denied = (value) => value?.ok === false && value?.allowBrowserLaunch === false;
const clone = (value) => JSON.parse(JSON.stringify(value));

function validateClosed(schema, value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} 非 object`);
  const properties = schema.properties || {};
  if (schema.additionalProperties === false) for (const key of Object.keys(value)) assert(Object.hasOwn(properties, key), `${label} 越界键 ${key}`);
  for (const key of schema.required || []) assert(Object.hasOwn(value, key), `${label} 缺 ${key}`);
  for (const [key, rule] of Object.entries(properties)) {
    if (!Object.hasOwn(value, key)) continue;
    const field = value[key];
    if (Object.hasOwn(rule, 'const')) assert(field === rule.const, `${label}.${key} const`);
    if (rule.type === 'string') assert(typeof field === 'string', `${label}.${key} 须 string`);
    if (rule.pattern) assert(new RegExp(rule.pattern).test(field), `${label}.${key} pattern`);
    if (rule.type === 'array') {
      assert(Array.isArray(field) && field.length >= (rule.minItems || 0), `${label}.${key} array`);
      const child = rule.items?.$ref?.endsWith('/binding') ? schema.definitions.binding : rule.items;
      if (child) field.forEach((item, index) => validateClosed(child, item, `${label}.${key}[${index}]`));
    }
    if (rule.enum) assert(rule.enum.includes(field), `${label}.${key} enum`);
  }
}

function buildDraft() {
  assert(typeof admission.buildEntityBindingsDraft === 'function', '缺 buildEntityBindingsDraft');
  return admission.buildEntityBindingsDraft({ eventsBytes: EVENTS_BYTES, eventsDocument: EVENTS, provenance: PROVENANCE });
}

function freeze(draft, confirmations = CONFIRMATIONS, patch = {}) {
  assert(typeof admission.freezeEntityBindingsDraft === 'function', '缺 freezeEntityBindingsDraft');
  return admission.freezeEntityBindingsDraft({
    caseId: EVENTS.caseId, eventsBytes: EVENTS_BYTES, eventsDocument: EVENTS, draft,
    confirmations, signerId: 'fixture-human', signedAt: '2026-07-17T01:00:00.000Z', ...patch,
  });
}

test('draft', 'S1 events v2 原字节与闭合 schema shape 不扩字段', () => {
  assert(EVENTS_SHA === frozenFixture.eventsSha256, 'fixture 未绑定原 events bytes');
  const top = new Set(Object.keys(oldEventsSchema.properties));
  const event = new Set(Object.keys(oldEventsSchema.definitions.event.properties));
  assert(Object.keys(EVENTS).every((key) => top.has(key)), 'events 顶层扩字段');
  assert(EVENTS.events.every((row) => Object.keys(row).every((key) => event.has(key))), 'event 扩字段');
  assert(!EVENTS_TEXT.includes('sourceIntentId') && !EVENTS_TEXT.includes('entityBindings') && !EVENTS_TEXT.includes('replayReady'), 'events 污染 provenance/sign 字段');
});

test('draft', 'S1 compile 纯 builder 另产未签 draft，输入 events bytes 不变', () => {
  const before = Buffer.from(EVENTS_BYTES);
  const result = buildDraft();
  assert(result?.ok === true && result.draft, `draft 失败 ${JSON.stringify(result)}`);
  validateClosed(draftSchema, result.draft, 'draft');
  assert(result.draft.signed === false && result.draft.replayReady === false && result.draft.eventsSha256 === EVENTS_SHA, 'draft 签名/hash 状态错误');
  assert(EVENTS_BYTES.equals(before) && JSON.stringify(EVENTS) === JSON.stringify(JSON.parse(EVENTS_TEXT)), 'builder 修改 events 输入');
});

test('draft', 'S1 连续双 mutation 与 relation 双端逐 event 保留 provenance', () => {
  const result = buildDraft();
  assert(result?.ok === true && result.draft.bindings.length === 4, 'draft 未保留四条逐 event binding');
  assert(JSON.stringify(result.draft.bindings) === JSON.stringify(PROVENANCE), 'draft provenance/角色漂移');
});

test('draft', 'S1 compile 静态接线写 entity-bindings.draft sidecar，不改 events schema', () => {
  const source = readFileSync(new URL('../../bin/compile.mjs', import.meta.url), 'utf8');
  assert(source.includes('buildEntityBindingsDraft') && source.includes('entity-bindings.draft.json'), 'compile 未接 sidecar builder/文件');
  assert(!source.includes('signed-events') && !source.includes('events.replay-ready'), 'compile 引入 signed events');
});

test('sign', 'S2 sign exact join 正向产唯一 frozen locks，与 fixture 同义', () => {
  const draft = buildDraft();
  const result = freeze(draft.draft);
  assert(result?.ok === true && result.artifact, `freeze 失败 ${JSON.stringify(result)}`);
  validateClosed(locksSchema, result.artifact, 'locks');
  assert(JSON.stringify(result.artifact) === JSON.stringify(frozenFixture), 'frozen locks 与人签 fixture 漂移');
});

test('sign', 'S2 confirmations 缺/多/重复/错 receipt 或角色全部拒绝', () => {
  const draft = buildDraft().draft;
  const attacks = [
    CONFIRMATIONS.slice(1),
    [...CONFIRMATIONS, { ...CONFIRMATIONS[0], stepId: 'atstep_extra' }],
    [...CONFIRMATIONS, clone(CONFIRMATIONS[0])],
    CONFIRMATIONS.map((row, index) => index ? row : { ...row, role: 'target' }),
    CONFIRMATIONS.map((row, index) => index ? row : { ...row, receipt: { ...row.receipt, receiptHash: `sha256:${'e'.repeat(64)}` } }),
  ];
  for (const confirmations of attacks) assert(freeze(draft, confirmations)?.ok === false, '坏 confirmations 被签发');
});

test('sign', 'S2 events bytes 或 draft provenance/hash tamper 均拒签', () => {
  const draft = buildDraft().draft;
  const changedDraft = clone(draft); changedDraft.bindings[0].candidateId = 'candidate-other';
  assert(freeze(changedDraft)?.ok === false, 'draft tamper 被签发');
  const changedEvents = Buffer.from(EVENTS_TEXT.replace('新增工作流', '新建工作流'));
  assert(freeze(draft, CONFIRMATIONS, { eventsBytes: changedEvents })?.ok === false, 'events bytes tamper 被签发');
});

test('sign', 'S2 sign 只写 frozen locks 入 ratchet，不生成 signed events/draft checksum', () => {
  const source = readFileSync(new URL('../../bin/sign.mjs', import.meta.url), 'utf8');
  assert(source.includes('freezeEntityBindingsDraft') && source.includes('entity-locks.frozen.json'), 'sign 未接 frozen locks');
  assert(!source.includes('signed-events-out') && !source.includes('signedEvents'), 'sign 生成了 signed events');
  const keys = Object.keys(prd.testChecksums || {});
  assert(keys.some((key) => key.endsWith('/entity-locks.frozen.json')), 'ratchet 未登记 frozen locks fixture');
  assert(!keys.some((key) => /(^|\/)(events[^/]*\.json|entity-bindings\.draft\.json)$/.test(key)), 'events/draft 进入 ratchet');
});

let frozenAuthority = null;
function authority() {
  if (frozenAuthority) return frozenAuthority;
  const read = admission.readIdentityAdmissionAuthorityFromPrd({
    prdId: 'teachin-entity-binding-sidecar-successor',
    artifactKey: `${FIXTURE_ROOT}/entity-locks.frozen.json`,
    domain: 'verify',
  });
  assert(read?.ok === true && read.authority, `opaque locks authority 未铸造 ${JSON.stringify(read)}`);
  frozenAuthority = read.authority;
  return frozenAuthority;
}

function replayCheck(patch = {}) {
  assert(typeof admission.checkReplayEntityAdmission === 'function', '缺 checkReplayEntityAdmission');
  return admission.checkReplayEntityAdmission({
    caseId: EVENTS.caseId,
    eventsBytes: EVENTS_BYTES,
    eventsDocument: EVENTS,
    frozenLockAuthority: authority(),
    ...patch,
  });
}

test('replay', 'S3 opaque frozen locks + 原 events 正向允许 replay', () => {
  const result = replayCheck();
  assert(result?.ok === true && result.allowBrowserLaunch === true, `正向 replay 被拒 ${JSON.stringify(result)}`);
});

test('replay', 'S3 caller bool/requiredBindings 不能决定准入', () => {
  const result = replayCheck({ containsEntityMutation: false, requiredBindings: [] });
  assert(denied(result), 'caller 旁路字段被接受');
});

test('replay', 'S3 events bytes/triple/action 任意 tamper 全拒', () => {
  assert(denied(replayCheck({ eventsBytes: Buffer.from(EVENTS_TEXT.replace('新增工作流', '新建工作流')) })), 'events bytes tamper 放行');
  const triple = clone(EVENTS); triple.events[0].stepId = 'atstep_9';
  assert(denied(replayCheck({ eventsDocument: triple })), 'event triple tamper 放行');
  const action = clone(EVENTS); action.events[1].atom = 'nav.workflowManagement';
  assert(denied(replayCheck({ eventsDocument: action })), 'side-effect atom tamper 放行');
});

test('replay', 'S3 replay 内部 checker 在 browser 前，且不调用 caller required bindings 投影', () => {
  const source = readFileSync(new URL('../../bin/replay.mjs', import.meta.url), 'utf8');
  const checkAt = source.indexOf('checkReplayEntityAdmission');
  const browserAt = source.indexOf('chromium.launch');
  assert(checkAt >= 0 && browserAt >= 0 && checkAt < browserAt, 'replay checker 未早于 browser');
  assert(!source.includes('requiredEventEntityBindings(eventsDoc)'), 'replay 仍信 caller requiredBindings 投影');
});

function hostileProxy(counter) {
  return new Proxy({}, {
    get() { counter.count += 1; throw new Error('HOSTILE_GET'); },
    ownKeys() { counter.count += 1; throw new Error('HOSTILE_KEYS'); },
    getOwnPropertyDescriptor() { counter.count += 1; throw new Error('HOSTILE_DESC'); },
  });
}

test('hostile', 'S4 新 draft/locks schema 闭合且 frozen fixture 合规', () => {
  for (const schema of [draftSchema, locksSchema]) {
    assert(schema.additionalProperties === false && schema.definitions.binding.additionalProperties === false, 'schema 未闭合');
  }
  validateClosed(locksSchema, frozenFixture, 'fixture');
});

test('hostile', 'S4 builder/sign 顶层与嵌套 Proxy/accessor 零执行', () => {
  for (const name of ['buildEntityBindingsDraft', 'freezeEntityBindingsDraft']) {
    assert(typeof admission[name] === 'function', `缺 ${name}`);
    const counter = { count: 0 };
    const result = admission[name](hostileProxy(counter));
    assert(counter.count === 0 && result?.ok === false, `${name} Proxy trap/未拒`);
    let gets = 0; const nested = { eventsDocument: {} };
    Object.defineProperty(nested.eventsDocument, 'events', { enumerable: true, get() { gets += 1; throw new Error('GETTER'); } });
    const nestedResult = admission[name](nested);
    assert(gets === 0 && nestedResult?.ok === false, `${name} accessor 执行/未拒`);
  }
});

test('hostile', 'S4 replay checker 顶层/嵌套 Proxy 零 trap，invalid 不洗空集', () => {
  assert(typeof admission.checkReplayEntityAdmission === 'function', '缺 checkReplayEntityAdmission');
  for (const nested of [false, true]) {
    const counter = { count: 0 }; const proxy = hostileProxy(counter);
    const input = nested ? { caseId: EVENTS.caseId, eventsBytes: EVENTS_BYTES, eventsDocument: proxy, frozenLockAuthority: authority() } : proxy;
    const result = admission.checkReplayEntityAdmission(input);
    assert(counter.count === 0 && denied(result), `replay ${nested ? 'nested' : 'top'} Proxy trap/未拒`);
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-entity-binding-sidecar-successor: ${failure}`);
  console.error(`RED  teachin-entity-binding-sidecar-successor/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-entity-binding-sidecar-successor/${SECTION}: ${passed}/${passed} 全过（动态纯函数/静态，零 SUT）`);

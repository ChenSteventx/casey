#!/usr/bin/env node
// zero-SUT：只读 JSON/源码并在内存中做突变；绝不 import、spawn 或执行任何旧 golden/SUT/browser。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE_DIR = join(ROOT, 'tests/_golden/fixtures/hermetic-golden-retired');
const FIXTURES = Object.freeze({
  obligations: 'source-obligations.json',
  matrix: 'subsumption-matrix.json',
  units: 'surviving-unit-cases.json',
  uat: 'retired-uat-manifest.json',
  isolation: 'isolated-browser-obligations.json',
  supersession: 'supersession-receipts.json',
});
const COVERAGE = new Set(['full', 'partial', 'none', 'uncertain']);
const LIFECYCLES = new Set(['survive-unit', 'retire', 'retain-isolated', 'superseded']);
const SHA256 = /^[a-f0-9]{64}$/;
const LEGACY_18_DOCTRINE = 'compile-known-atoms-18-to-25';
const LEGACY_18_SOURCES = new Set([
  'tests/_golden/wf-open-smoke.golden.mjs',
  'tests/_golden/wf-connect-nodes.golden.mjs',
  'tests/_golden/wf-add-node.golden.mjs',
  'tests/_golden/wf-open-node.golden.mjs',
]);
const UAT_IMMUTABLE_KEYS = Object.freeze([
  'uatCaseId', 'sourceObligationId', 'sourceGolden', 'sourceCheckId', 'sourceSubObligationId', 'archiveSha256',
  'preconditions', 'nlSteps', 'expectedEvidenceSchema', 'invariant', 'owner',
]);
const ISOLATION_KEYS = Object.freeze([
  'obligationId', 'sourceGolden', 'sourceCheckId', 'subObligationId', 'originalFileSha256', 'coverageRelation',
  'partialSuccessors', 'uncoveredDimensions', 'agentExecution', 'route',
]);

function clone(value) { return structuredClone(value); }
function array(value, label, errors) {
  if (!Array.isArray(value)) { errors.push(`${label} 须为数组`); return []; }
  return value;
}
function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} 须为对象`); return;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join('\0') !== expected.join('\0')) errors.push(`${label} 键集不闭合`);
}
function unique(rows, keyOf, label, errors) {
  const seen = new Set();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key || seen.has(key)) errors.push(`${label} 重复/空键 ${key || '(空)'}`);
    seen.add(key);
  }
  return seen;
}
function edgeKey(edge) {
  if (edge?.kind === 'unit-golden') return `unit:${edge.targetKey?.unitGoldenPath || ''}\0${edge.targetKey?.unitCheckId || ''}`;
  if (edge?.kind === 'uat-case') return `uat:${edge.targetKey?.uatCaseId || ''}`;
  if (edge?.kind === 'supersession') return `supersession:${edge.targetKey?.receiptId || ''}`;
  return `invalid:${JSON.stringify(edge)}`;
}
function canonicalObligation(row) {
  return `${row?.sourceGolden || ''}\0${row?.sourceCheckId || ''}\0${row?.subObligationId || ''}`;
}
function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

export function validateLifecycleClosure(bundle, options = {}) {
  const errors = [];
  const obligations = array(bundle?.obligations?.obligations, 'source-obligations.obligations', errors);
  const matrix = array(bundle?.matrix?.rows, 'subsumption-matrix.rows', errors);
  const units = array(bundle?.units?.cases, 'surviving-unit-cases.cases', errors);
  const uat = array(bundle?.uat?.cases, 'retired-uat-manifest.cases', errors);
  const isolated = array(bundle?.isolation?.obligations, 'isolated-browser-obligations.obligations', errors);
  const superseded = array(bundle?.supersession?.receipts, 'supersession-receipts.receipts', errors);

  const obligationIds = unique(obligations, (r) => r?.obligationId, 'obligationId', errors);
  unique(obligations, canonicalObligation, '原子规范键', errors);
  const matrixIds = unique(matrix, (r) => r?.obligationId, 'matrix obligationId', errors);
  if (!sameJson([...obligationIds].sort(), [...matrixIds].sort())) errors.push('obligations 与 matrix obligationId 不等集');

  const byId = new Map(obligations.map((r) => [r.obligationId, r]));
  const matrixById = new Map(matrix.map((r) => [r.obligationId, r]));
  const allTargetKeys = [];
  for (const row of obligations) {
    const label = `obligation ${row?.obligationId || '(空)'}`;
    const required = ['obligationId', 'sourceGolden', 'sourceCheckId', 'subObligationId', 'sourceSpan',
      'originalFileSha256', 'executionRequiresSut', 'assertionConsumesSutEvidence', 'shapeProducedByBrowser',
      'judgmentCanRunZeroSut', 'coverageRelation', 'lifecycle', 'successors', 'partialSuccessors'];
    exactKeys(row, row?.doctrineId === undefined ? required : [...required, 'doctrineId'], label, errors);
    if (!COVERAGE.has(row.coverageRelation)) errors.push(`${label} coverageRelation 非法`);
    if (!LIFECYCLES.has(row.lifecycle)) errors.push(`${label} lifecycle 非法`);
    if (!SHA256.test(row.originalFileSha256 || '')) errors.push(`${label} originalFileSha256 非 sha256`);
    for (const axis of ['executionRequiresSut', 'assertionConsumesSutEvidence', 'shapeProducedByBrowser', 'judgmentCanRunZeroSut']) {
      if (typeof row[axis] !== 'boolean') errors.push(`${label} ${axis} 须为 boolean`);
    }
    const successors = array(row.successors, `${label}.successors`, errors);
    const partial = array(row.partialSuccessors, `${label}.partialSuccessors`, errors);
    for (const edge of [...successors, ...partial]) {
      if (edge?.sourceObligationId !== row.obligationId) errors.push(`${label} successor 边缺/错 sourceObligationId 血缘`);
    }
    const mr = matrixById.get(row.obligationId);
    if (!mr || mr.coverageRelation !== row.coverageRelation || mr.lifecycle !== row.lifecycle
      || !sameJson(mr.successors, successors) || !sameJson(mr.partialSuccessors, partial)) {
      errors.push(`${label} 与 matrix 的分类/边不一致`);
    }
    if (row.lifecycle === 'retire') {
      if (row.coverageRelation !== 'full') errors.push(`${label} retire 必须 full`);
      if (successors.length === 0 || successors.some((e) => e.kind !== 'uat-case') || partial.length !== 0) {
        errors.push(`${label} retire 只能携已落盘 UAT 边`);
      }
    } else if (row.lifecycle === 'survive-unit') {
      if (successors.length === 0 || successors.some((e) => e.kind !== 'unit-golden') || partial.length !== 0) {
        errors.push(`${label} survive-unit 只能携 unit 边`);
      }
    } else if (row.lifecycle === 'retain-isolated') {
      if (row.coverageRelation === 'full') errors.push(`${label} retain-isolated 不得伪报 full`);
      if (successors.length !== 0) errors.push(`${label} retain-isolated 不得携退役 successor`);
    } else if (row.lifecycle === 'superseded') {
      if (successors.length !== 1 || successors[0]?.kind !== 'supersession' || partial.length !== 0) {
        errors.push(`${label} superseded 须且只须一条 supersession 边`);
      }
    }
    for (const edge of successors) allTargetKeys.push(edgeKey(edge));
  }
  unique(allTargetKeys, (x) => x, 'successor targetKey', errors);

  const unitByObligation = new Map();
  for (const item of units) {
    const key = item?.sourceObligationId;
    if (!key || unitByObligation.has(key)) errors.push(`unit manifest 重复/空 sourceObligationId ${key || '(空)'}`);
    unitByObligation.set(key, item);
    const row = byId.get(key);
    const expected = row?.successors?.[0];
    if (row?.lifecycle !== 'survive-unit' || expected?.kind !== 'unit-golden'
      || expected.targetKey?.unitGoldenPath !== item.unitGoldenPath || expected.targetKey?.unitCheckId !== item.unitCheckId) {
      errors.push(`unit ${key || '(空)'} 的边血缘不一致`);
    }
    const path = item?.unitGoldenPath;
    const exists = options.virtualFiles ? options.virtualFiles.has(path) : existsSync(join(ROOT, path || ''));
    if (!exists) errors.push(`拟 unit successor 尚未落盘 ${path || '(空)'}`);
    else {
      const source = options.virtualContents?.get(path) ?? readFileSync(join(ROOT, path), 'utf8');
      if (!source.includes(`sourceObligationId:${key}`)) errors.push(`unit successor 未冻结 sourceObligationId:${key}`);
    }
  }
  const expectedUnitIds = obligations.filter((r) => r.lifecycle === 'survive-unit').map((r) => r.obligationId).sort();
  if (!sameJson(expectedUnitIds, [...unitByObligation.keys()].sort())) errors.push('survive-unit 与 unit manifest 不双射');

  const uatByObligation = new Map();
  for (const item of uat) {
    const key = item?.sourceObligationId;
    exactKeys(item, UAT_IMMUTABLE_KEYS, `UAT case ${item?.uatCaseId || '(空)'}`, errors);
    if (!key || uatByObligation.has(key)) errors.push(`UAT manifest 重复/空 sourceObligationId ${key || '(空)'}`);
    uatByObligation.set(key, item);
    const row = byId.get(key);
    const expected = row?.successors?.[0];
    if (row?.lifecycle !== 'retire' || row.coverageRelation !== 'full' || expected?.kind !== 'uat-case'
      || expected.targetKey?.uatCaseId !== item.uatCaseId) errors.push(`UAT ${key || '(空)'} 的边血缘不一致`);
    if (!row || item.sourceGolden !== row.sourceGolden || item.sourceCheckId !== row.sourceCheckId
      || item.sourceSubObligationId !== row.subObligationId || item.archiveSha256 !== row.originalFileSha256) {
      errors.push(`UAT ${key || '(空)'} 的固定 ID 载荷投影不一致`);
    }
  }
  const expectedUatIds = obligations.filter((r) => r.lifecycle === 'retire').map((r) => r.obligationId).sort();
  if (!sameJson(expectedUatIds, [...uatByObligation.keys()].sort())) errors.push('retire 与 UAT manifest 不双射');

  const isolationIds = unique(isolated, (r) => r?.obligationId, 'isolation obligationId', errors);
  const expectedIsolationIds = obligations.filter((r) => r.lifecycle === 'retain-isolated').map((r) => r.obligationId).sort();
  if (!sameJson(expectedIsolationIds, [...isolationIds].sort())) errors.push('retain-isolated 与 isolation manifest 不双射');
  for (const item of isolated) {
    exactKeys(item, ISOLATION_KEYS, `isolation ${item?.obligationId || '(空)'}`, errors);
    const row = byId.get(item.obligationId);
    if (!row || item.sourceGolden !== row.sourceGolden || item.sourceCheckId !== row.sourceCheckId
      || item.subObligationId !== row.subObligationId || item.originalFileSha256 !== row.originalFileSha256
      || item.coverageRelation !== row.coverageRelation || !sameJson(item.partialSuccessors, row.partialSuccessors)
      || item.agentExecution !== 'forbidden' || item.route !== 'human'
      || !Array.isArray(item.uncoveredDimensions) || item.uncoveredDimensions.length === 0) {
      errors.push(`isolation ${item?.obligationId || '(空)'} 载荷/路由不闭合`);
    }
  }

  const supersessionByObligation = new Map();
  for (const receipt of superseded) {
    if (!receipt?.sourceObligationId || supersessionByObligation.has(receipt.sourceObligationId)) {
      errors.push(`supersession receipt 重复/空 sourceObligationId ${receipt?.sourceObligationId || '(空)'}`);
    }
    supersessionByObligation.set(receipt.sourceObligationId, receipt);
    const row = byId.get(receipt.sourceObligationId);
    if (!row || row.lifecycle !== 'superseded' || receipt.sourceGolden !== row.sourceGolden
      || receipt.sourceCheckId !== row.sourceCheckId || receipt.subObligationId !== row.subObligationId
      || receipt.doctrineId !== row.doctrineId || row.successors?.[0]?.targetKey?.receiptId !== receipt.receiptId) {
      errors.push(`supersession ${receipt?.sourceObligationId || '(空)'} 血缘不一致`);
    }
  }
  const expectedSupersededIds = obligations.filter((r) => r.lifecycle === 'superseded').map((r) => r.obligationId).sort();
  if (!sameJson(expectedSupersededIds, [...supersessionByObligation.keys()].sort())) errors.push('superseded 与 receipt 不双射');

  const legacy = obligations.filter((r) => r.doctrineId === LEGACY_18_DOCTRINE);
  if (legacy.length !== 4 || !sameJson(legacy.map((r) => r.sourceGolden).sort(), [...LEGACY_18_SOURCES].sort())) {
    errors.push('旧 COMPILE_KNOWN_ATOMS 18→25 四项集合不闭合');
  }
  for (const row of legacy) {
    if (row.sourceCheckId !== 'C1' || row.lifecycle !== 'superseded' || row.successors?.[0]?.kind !== 'supersession') {
      errors.push(`旧 18→25 ${row.sourceGolden} 只能 superseded，不得伪称 subsumed`);
    }
  }
  return errors;
}

const sha = (ch) => String(ch).repeat(64);
const axes = Object.freeze({ executionRequiresSut: false, assertionConsumesSutEvidence: false, shapeProducedByBrowser: false, judgmentCanRunZeroSut: true });
function obligation(id, sourceGolden, sourceCheckId, subObligationId, lifecycle, coverageRelation, successors = [], partialSuccessors = [], extra = {}) {
  const digestNibble = 'abcdef'[id.length % 6];
  return { obligationId: id, sourceGolden, sourceCheckId, subObligationId, sourceSpan: '1-2', originalFileSha256: sha(digestNibble),
    ...axes, coverageRelation, lifecycle, successors, partialSuccessors, ...extra };
}
const unitEdge = (sourceObligationId, path, check) => ({ sourceObligationId, kind: 'unit-golden', targetKey: { unitGoldenPath: path, unitCheckId: check } });
const uatEdge = (sourceObligationId, id) => ({ sourceObligationId, kind: 'uat-case', targetKey: { uatCaseId: id } });
const supersessionEdge = (sourceObligationId, id) => ({ sourceObligationId, kind: 'supersession', targetKey: { receiptId: id } });
const syntheticObligations = [
  obligation('a-unit', 'tests/_golden/a.golden.mjs', 'C1', 'unit-a', 'survive-unit', 'full', [unitEdge('a-unit', 'tests/_golden/a-unit.zero-sut.golden.mjs', 'U1')]),
  obligation('b-unit', 'tests/_golden/b.golden.mjs', 'C1', 'unit-b', 'survive-unit', 'full', [unitEdge('b-unit', 'tests/_golden/b-unit.zero-sut.golden.mjs', 'U1')]),
  obligation('c-uat', 'tests/_golden/c.golden.mjs', 'C2', 'uat-c', 'retire', 'full', [uatEdge('c-uat', 'uat-c')]),
  obligation('d-uat', 'tests/_golden/d.golden.mjs', 'C2', 'uat-d', 'retire', 'full', [uatEdge('d-uat', 'uat-d')]),
  obligation('e-isolated', 'tests/_golden/e.golden.mjs', 'C3', 'browser-cause', 'retain-isolated', 'partial', [], [{ sourceObligationId: 'e-isolated', kind: 'unit-golden', targetKey: { unitGoldenPath: 'tests/_golden/e-unit.zero-sut.golden.mjs', unitCheckId: 'U1' } }]),
  obligation('f-isolated', 'tests/_golden/e.golden.mjs', 'C3', 'wiring', 'retain-isolated', 'uncertain', [], []),
  ...[...LEGACY_18_SOURCES].map((source, i) => obligation(`legacy-${i}`, source, 'C1', 'known-atoms-count-18', 'superseded', 'none',
    [supersessionEdge(`legacy-${i}`, `sup-${i}`)], [], { doctrineId: LEGACY_18_DOCTRINE })),
];
function uatCase(row, id) {
  return { uatCaseId: id, sourceObligationId: row.obligationId, sourceGolden: row.sourceGolden, sourceCheckId: row.sourceCheckId,
    sourceSubObligationId: row.subObligationId, archiveSha256: row.originalFileSha256, preconditions: [], nlSteps: ['step'],
    expectedEvidenceSchema: { type: 'object' }, invariant: 'invariant', owner: 'human' };
}
function syntheticBundle() {
  const obligations = clone(syntheticObligations);
  return {
    obligations: { schemaVersion: 1, obligations },
    matrix: { schemaVersion: 1, rows: obligations.map((r) => ({ obligationId: r.obligationId, coverageRelation: r.coverageRelation, lifecycle: r.lifecycle, successors: clone(r.successors), partialSuccessors: clone(r.partialSuccessors) })) },
    units: { schemaVersion: 1, cases: [
      { sourceObligationId: 'a-unit', unitGoldenPath: 'tests/_golden/a-unit.zero-sut.golden.mjs', unitCheckId: 'U1' },
      { sourceObligationId: 'b-unit', unitGoldenPath: 'tests/_golden/b-unit.zero-sut.golden.mjs', unitCheckId: 'U1' },
    ] },
    uat: { schemaVersion: 1, cases: [uatCase(obligations[2], 'uat-c'), uatCase(obligations[3], 'uat-d')] },
    isolation: { schemaVersion: 1, obligations: obligations.filter((r) => r.lifecycle === 'retain-isolated').map((r) => ({
      obligationId: r.obligationId, sourceGolden: r.sourceGolden, sourceCheckId: r.sourceCheckId, subObligationId: r.subObligationId,
      originalFileSha256: r.originalFileSha256, coverageRelation: r.coverageRelation, partialSuccessors: clone(r.partialSuccessors),
      uncoveredDimensions: ['browser cause/wiring'], agentExecution: 'forbidden', route: 'human',
    })) },
    supersession: { schemaVersion: 1, receipts: obligations.filter((r) => r.lifecycle === 'superseded').map((r, i) => ({
      receiptId: `sup-${i}`, sourceObligationId: r.obligationId, sourceGolden: r.sourceGolden, sourceCheckId: r.sourceCheckId,
      subObligationId: r.subObligationId, doctrineId: LEGACY_18_DOCTRINE,
    })) },
  };
}
const virtualFiles = new Set(['tests/_golden/a-unit.zero-sut.golden.mjs', 'tests/_golden/b-unit.zero-sut.golden.mjs']);
const virtualContents = new Map([
  ['tests/_golden/a-unit.zero-sut.golden.mjs', '// sourceObligationId:a-unit\n'],
  ['tests/_golden/b-unit.zero-sut.golden.mjs', '// sourceObligationId:b-unit\n'],
]);
const syntheticOptions = { virtualFiles, virtualContents };

const baselineErrors = validateLifecycleClosure(syntheticBundle(), syntheticOptions);
if (baselineErrors.length) {
  console.error('RED  合成闭合基线自身无效：\n' + baselineErrors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
const mutations = [
  ['合并原子规范键', (b) => { b.obligations.obligations[1].sourceGolden = b.obligations.obligations[0].sourceGolden; b.obligations.obligations[1].subObligationId = b.obligations.obligations[0].subObligationId; }],
  ['partial 偷进 retire', (b) => { b.obligations.obligations[2].coverageRelation = 'partial'; b.matrix.rows[2].coverageRelation = 'partial'; }],
  ['删 isolation 行', (b) => { b.isolation.obligations.pop(); }],
  ['unit 同分区协同换线', (b) => { const x = b.obligations.obligations[0].successors; b.obligations.obligations[0].successors = b.obligations.obligations[1].successors; b.obligations.obligations[1].successors = x; b.matrix.rows[0].successors = clone(b.obligations.obligations[0].successors); b.matrix.rows[1].successors = clone(b.obligations.obligations[1].successors); }],
  ['UAT 同分区协同换线', (b) => { const x = b.obligations.obligations[2].successors; b.obligations.obligations[2].successors = b.obligations.obligations[3].successors; b.obligations.obligations[3].successors = x; b.matrix.rows[2].successors = clone(b.obligations.obligations[2].successors); b.matrix.rows[3].successors = clone(b.obligations.obligations[3].successors); }],
  ['固定 UAT ID 交换载荷', (b) => { const a = b.uat.cases[0]; const d = b.uat.cases[1]; for (const k of ['sourceObligationId', 'sourceGolden', 'sourceCheckId', 'sourceSubObligationId', 'archiveSha256']) [a[k], d[k]] = [d[k], a[k]]; }],
  ['UAT 偷渡运行状态', (b) => { b.uat.cases[0].passes = true; b.uat.cases[0].evidence = 'self-claimed'; }],
  ['isolation 偷渡第二事实源', (b) => { b.isolation.obligations[0].invariant = 'duplicated prose authority'; }],
  ['两义务重复 target', (b) => { b.obligations.obligations[1].successors = clone(b.obligations.obligations[0].successors); b.matrix.rows[1].successors = clone(b.obligations.obligations[1].successors); }],
  ['拟 unit successor 缺文件', (_b, o) => { o.virtualFiles = new Set(['tests/_golden/a-unit.zero-sut.golden.mjs']); }],
  ['unit 文件缺 sourceObligationId', (_b, o) => { o.virtualContents = new Map(virtualContents); o.virtualContents.set('tests/_golden/a-unit.zero-sut.golden.mjs', '// lineage missing\n'); }],
  ['旧 18→25 伪称 survive-unit', (b) => { const i = b.obligations.obligations.findIndex((r) => r.doctrineId === LEGACY_18_DOCTRINE); b.obligations.obligations[i].lifecycle = 'survive-unit'; b.matrix.rows[i].lifecycle = 'survive-unit'; }],
];
let mutationPassed = 0;
for (const [name, mutate] of mutations) {
  const bundle = syntheticBundle();
  const options = { virtualFiles: new Set(virtualFiles), virtualContents: new Map(virtualContents) };
  mutate(bundle, options);
  const errors = validateLifecycleClosure(bundle, options);
  if (errors.length === 0) {
    console.error(`RED  突变未被检出：${name}`);
    process.exitCode = 1;
  } else {
    mutationPassed += 1;
    console.log(`ok   突变必红：${name}`);
  }
}

const missing = [];
const actual = {};
for (const [key, name] of Object.entries(FIXTURES)) {
  const path = join(FIXTURE_DIR, name);
  if (!existsSync(path)) { missing.push(`tests/_golden/fixtures/hermetic-golden-retired/${name}`); continue; }
  try { actual[key] = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { missing.push(`${name} 无法解析：${error.message}`); }
}
if (missing.length) {
  console.error(`\nRED  lifecycle closure 真实冻结合同未落盘（实现前预期红）：\n${missing.map((p) => `  - ${p}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const actualErrors = validateLifecycleClosure(actual);
  if (actualErrors.length) {
    console.error(`\nRED  lifecycle closure 不闭合：\n${actualErrors.map((e) => `  - ${e}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('\nok   atomized obligations / unit / UAT / isolation / supersession 生命周期闭合');
  }
}

console.log(`\nhermetic golden lifecycle closure: mutation ${mutationPassed}/${mutations.length} 敏感；真实合同 ${process.exitCode ? 'RED' : 'GREEN'}`);

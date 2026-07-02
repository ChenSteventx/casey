#!/usr/bin/env node
// 【草稿·未冻】P4 断言草拟器 golden（预备轨 p4-drafter）。
// 落地时移进 tests/_golden/、经 acceptance-gate 跑验红 + sha256 冻入 prd-p4-drafter；
// 现放 proposed/ 只作红基线草稿，不进任何 prd.testChecksums、不被 gate 跑。
// 钉待实现纯函数模块 lib/assertion-draft.mjs：
//   synthesizeSkeleton(observed, assertionAtoms) -> expectedDraft   （S1 确定性合成骨架，零 LLM）
//   validateDraft(expectedDraft) -> { ok, problems }                （S2 零 LLM 校验闸，fail-closed）
// 消费已冻接缝：observed-reality.fixture.json（输入）+ expected-frozen.schema.json 词表 + bin/check.mjs --validate-only。
// hermetic：纯函数 + 已冻 fixture/schema。实现前必红（模块不存在 → import 抛）。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// 草稿在 docs/plans/p4-drafter/proposed/ 下 → 上溯四层到 repo 根；落地移进 tests/_golden/ 后改回两层。
const ROOT = resolve(HERE, '..', '..', '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const OBSERVED = join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'observed-reality.fixture.json');
const SCHEMA = join(ROOT, 'tests', '_golden', 'schemas', 'expected-frozen.schema.json');
const fail = (m) => { console.error(`RED  p4-drafter(草稿): ${m}`); process.exit(1); };

let synthesizeSkeleton, validateDraft;
try {
  ({ synthesizeSkeleton, validateDraft } = await import(pathToFileURL(join(ROOT, 'lib', 'assertion-draft.mjs')).href));
} catch (e) { fail(`import lib/assertion-draft.mjs 失败（实现前预期红）：${String(e.message).slice(-200)}`); }
if (typeof synthesizeSkeleton !== 'function') fail('lib/assertion-draft.mjs 未导出 synthesizeSkeleton 函数');
if (typeof validateDraft !== 'function') fail('lib/assertion-draft.mjs 未导出 validateDraft 函数');

const observed = JSON.parse(readFileSync(OBSERVED, 'utf8'));
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));
const KINDS = new Set(schema.definitions.assertionKind.enum);

// 合成 assertionAtoms（编译期 assert.* 原子留痕，配 observed fixture 的 intent_1=wf.create）：
const assertionAtoms = [
  { intentId: 'intent_1', atom: 'assert.onPage', params: { urlIncludes: '/heren/aimanagement/edit' } },
  { intentId: 'intent_1', atom: 'assert.textVisible', params: { text: '新增成功' } },
];

// ───────────── S1 确定性合成骨架 ─────────────
const draft = synthesizeSkeleton(observed, assertionAtoms);
if (!draft || typeof draft !== 'object' || !Array.isArray(draft.intents)) fail('synthesizeSkeleton 须返回 { caseId, intents:[], globalAssertions:[] }');
if (draft.caseId !== observed.caseId) fail(`草稿 caseId 应卷回 observed（${observed.caseId}），实际 ${draft.caseId}`);

// 全局取证默认在场（noPageError + noErrorEnvelope）
const gk = new Set((draft.globalAssertions || []).map((a) => a.kind));
for (const k of ['noPageError', 'noErrorEnvelope']) if (!gk.has(k)) fail(`全局取证缺 ${k}`);

// 逐条：kind 在词表、带 op 的过 check --validate-only
const allDraft = [...draft.intents.flatMap((it) => (it.expected || [])), ...(draft.globalAssertions || [])];
for (const a of allDraft) {
  if (!KINDS.has(a.kind)) fail(`草稿 kind「${a.kind}」不在已冻 schema 词表内`);
  if (a.op) {
    try { execFileSync(process.execPath, [CHECK, '--kind', a.kind, '--op', a.op, '--validate-only'], { stdio: 'pipe' }); }
    catch { fail(`check --validate-only 拒了草稿 (kind=${a.kind}, op=${a.op})`); }
  }
}

// assert.onPage → urlPathname startsWith，值剥实体 ID（不含 observed 的 /8f3a21）
const i1 = draft.intents.find((it) => it.intentId === 'intent_1');
if (!i1) fail('intent_1 草稿缺失');
const urlA = (i1.expected || []).find((a) => a.kind === 'urlPathname');
if (!urlA) fail('assert.onPage 未合成出 urlPathname 断言');
if (urlA.op !== 'startsWith' && urlA.op !== 'matches') fail(`urlPathname op 应 startsWith/matches，实际 ${urlA.op}`);
if (typeof urlA.value === 'string' && /8f3a21/.test(urlA.value)) fail(`urlPathname 值冻了实体 ID（含 8f3a21）：${urlA.value}——须剥尾`);

// ───────────── S2 零 LLM 校验闸 ─────────────
const okDraft = { caseId: 'tc_v', intents: [{ intentId: 'i0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/edit' }] }], globalAssertions: [] };
const r0 = validateDraft(okDraft);
if (!r0 || r0.ok !== true) fail(`合规草稿应 ok:true，实际 ${JSON.stringify(r0).slice(0, 160)}`);

const bad = [
  { why: '词表外 kind', d: { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'looksRight', op: 'appears', value: 'x' }] }] } },
  { why: 'equals 含 atl_ 字面量', d: { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'inputReadback', op: 'equals', value: 'atl_目录CRUD_1782634443' }] }] } },
  { why: '未模板化 uniqueName', d: { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'inputReadback', op: 'equals', value: 'atl_目录CRUD' }] }] } },
];
for (const b of bad) {
  const r = validateDraft(b.d);
  if (!r || r.ok !== false) fail(`违规草稿（${b.why}）应 ok:false`);
  if (!Array.isArray(r.problems) || r.problems.length === 0) fail(`违规草稿（${b.why}）须给 problems 落点`);
}

// ───────────── S3 pendingImpl：未实现 kind 标 soft ─────────────
// replay-assert 已实现 5 种（urlPathname/countChange/streamReplyReceived/noPageError/noErrorEnvelope）；
// textVisible 未实现 → 草拟器须标 soft（进报告不进裁定、不假红），待补实现后重签提 hard。
const tv = (i1.expected || []).find((a) => a.kind === 'textVisible');
if (!tv) fail('assert.textVisible 未合成出 textVisible 断言');
if (tv.soft !== true) fail('未实现 kind textVisible 应标 soft:true（pendingImpl，不假红）');
if (urlA.soft === true) fail('已实现 kind urlPathname 不应标 soft');

console.log('ok   p4-drafter(草稿): S1 合成骨架（取证在场/剥ID）+ S2 校验闸（3 违规拦/合规放）+ S3 未实现 kind 标 soft 全中');
process.exit(0);

#!/usr/bin/env node
// 冻结黄金标准（P4 相2 断言草拟器 · hermetic）：确定性合成骨架 + 零 LLM 校验闸 + soft 承载。
// 决策依 docs/plans/p4-drafter/proposed/GRILL.md（D1/D2 人签 + G-seam 对齐拍板）；计划依 docs/plans/p4-drafter/plan.md。
// 底稿 = proposed/p4-drafter.golden.draft.mjs（另一 session 预备轨、已验红），落地增补：
//   C-align 接缝对齐钉死（schema 15 kind 含新三种）/ C-map-ext D1 映射表全量（buttonState 已随
//   wf-publish-states 提硬、soft 生命周期范例换 switchState——2026-07-03 涟漪重钉）
//   / C-pending 未知原子不发明 / C-tpl-ok atl_{{uniqueName}} 模板形态合法（防过度拒绝）。
// 钉 lib/assertion-draft.mjs 纯函数：synthesizeSkeleton(observed, assertionAtoms) / validateDraft(expectedDraft)。
// 消费已冻接缝：observed-reality.fixture.json + expected-frozen.schema.json 词表 + bin/check.mjs --validate-only。
// 实现前必红（模块缺席 import 抛）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const OBSERVED = join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'observed-reality.fixture.json');
const SCHEMA = join(ROOT, 'tests', '_golden', 'schemas', 'expected-frozen.schema.json');

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}

let synthesizeSkeleton, validateDraft;
try {
  ({ synthesizeSkeleton, validateDraft } = await import(pathToFileURL(join(ROOT, 'lib', 'assertion-draft.mjs')).href));
} catch (e) {
  console.error(`RED  p4-drafter: import lib/assertion-draft.mjs 失败（实现前预期红）：${String(e.message).slice(-200)}`);
  process.exit(1);
}

const observed = JSON.parse(readFileSync(OBSERVED, 'utf8'));
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));
const KINDS = new Set(schema.definitions.assertionKind.enum);

// ---------- C0 接缝对齐钉死（G-seam）：schema 词表 = check.mjs 权威 15 种 ----------
check('C0 接缝对齐 15 kind', () => {
  if (KINDS.size !== 15) throw new Error(`schema assertionKind 应 15 种（对齐 check.mjs），实际 ${KINDS.size}`);
  for (const k of ['textHidden', 'buttonState', 'switchState']) if (!KINDS.has(k)) throw new Error(`schema 缺新收 kind ${k}`);
  const OPS = new Set(schema.definitions.assertionOp.enum);
  for (const op of ['filled', 'finished', 'contains', 'enabled', 'disabled', 'on', 'off']) {
    if (!OPS.has(op)) throw new Error(`schema assertionOp 缺 ${op}（已收 kind 的法定 op 表达不了 = 假拒）`);
  }
});

check('C1 导出面', () => {
  if (typeof synthesizeSkeleton !== 'function') throw new Error('未导出 synthesizeSkeleton 函数');
  if (typeof validateDraft !== 'function') throw new Error('未导出 validateDraft 函数');
});

// 合成 assertionAtoms（编译期 assert.* 原子留痕，配 observed fixture 的 intent_1=wf.create）：
const assertionAtoms = [
  { intentId: 'intent_1', atom: 'assert.onPage', params: { urlIncludes: '/heren/aimanagement/edit' } },
  { intentId: 'intent_1', atom: 'assert.textVisible', params: { text: '新增成功' } },
];
const draft = synthesizeSkeleton(observed, assertionAtoms);

// ---------- S1 确定性合成骨架 ----------
check('S1a 骨架形状与卷回', () => {
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.intents)) throw new Error('synthesizeSkeleton 须返回 { caseId, intents:[], globalAssertions:[] }');
  if (draft.caseId !== observed.caseId) throw new Error(`草稿 caseId 应卷回 observed（${observed.caseId}），实际 ${draft.caseId}`);
});

check('S1b 全局取证默认在场', () => {
  const gk = new Set((draft.globalAssertions || []).map((a) => a.kind));
  for (const k of ['noPageError', 'noErrorEnvelope']) if (!gk.has(k)) throw new Error(`全局取证缺 ${k}`);
});

check('S1c kind 落词表 + op 过 check 硬闸', () => {
  const allDraft = [...draft.intents.flatMap((it) => (it.expected || [])), ...(draft.globalAssertions || [])];
  if (!allDraft.length) throw new Error('草稿断言为空');
  for (const a of allDraft) {
    if (!KINDS.has(a.kind)) throw new Error(`草稿 kind「${a.kind}」不在已冻 schema 词表内`);
    if (a.op) {
      try { execFileSync(process.execPath, [CHECK, '--kind', a.kind, '--op', a.op, '--validate-only'], { stdio: 'pipe' }); }
      catch { throw new Error(`check --validate-only 拒了草稿 (kind=${a.kind}, op=${a.op})`); }
    }
  }
});

check('S1d assert.onPage → urlPathname startsWith 且剥实体 ID', () => {
  const i1 = draft.intents.find((it) => it.intentId === 'intent_1');
  if (!i1) throw new Error('intent_1 草稿缺失');
  const urlA = (i1.expected || []).find((a) => a.kind === 'urlPathname');
  if (!urlA) throw new Error('assert.onPage 未合成出 urlPathname 断言');
  if (urlA.op !== 'startsWith' && urlA.op !== 'matches') throw new Error(`urlPathname op 应 startsWith/matches，实际 ${urlA.op}`);
  if (typeof urlA.value !== 'string' || !urlA.value.startsWith('/')) throw new Error(`urlPathname 值应为路径段，实际 ${urlA.value}`);
  if (/8f3a21/.test(urlA.value)) throw new Error(`urlPathname 值冻了实体 ID（含 8f3a21）：${urlA.value}——须剥尾`);
});

// ---------- S3 pendingImpl：未实现 kind 标 soft（D2） ----------
check('S3 soft 承载：textVisible 已提硬 / urlPathname 硬（kinds-harden 翻转）', () => {
  const i1 = draft.intents.find((it) => it.intentId === 'intent_1');
  const tv = (i1.expected || []).find((a) => a.kind === 'textVisible');
  if (!tv) throw new Error('assert.textVisible 未合成出 textVisible 断言');
  if (tv.soft === true) throw new Error('textVisible 已提硬（kinds-harden），骨架不应再标 soft');
  const urlA = (i1.expected || []).find((a) => a.kind === 'urlPathname');
  if (urlA.soft === true) throw new Error('已实现 kind urlPathname 不应标 soft');
});

// ---------- C-map-ext：D1 映射表全量（新收 kind + 取证类）+ 未知原子不发明 ----------
const draft2 = synthesizeSkeleton(observed, [
  { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '保存', state: 'present' } },
  { intentId: 'intent_1', atom: 'assert.noErrorToast', params: {} },
  { intentId: 'intent_2', atom: 'assert.bubble', params: {} },
]);

check('C-map buttonState 同名映射 + 已提硬（wf-publish-states 翻转：present/absent 实现、enabled/disabled 挂账后补）', () => {
  const i1 = draft2.intents.find((it) => it.intentId === 'intent_1');
  const bs = (i1?.expected || []).find((a) => a.kind === 'buttonState');
  if (!bs) throw new Error('assert.buttonState(present) 未合成出 buttonState 断言');
  if (bs.op !== 'present') throw new Error(`buttonState op 应取 params.state（present），实际 ${bs.op}`);
  if (bs.soft === true) throw new Error('buttonState 已提硬（wf-publish-states），骨架不应再标 soft');
});

check('C-map noErrorToast 同名映射 + 已提硬', () => {
  const i1 = draft2.intents.find((it) => it.intentId === 'intent_1');
  const nt = (i1?.expected || []).find((a) => a.kind === 'noErrorToast');
  if (!nt) throw new Error('assert.noErrorToast 未合成出 noErrorToast 断言');
  if (nt.op !== 'absent') throw new Error(`noErrorToast op 应 absent，实际 ${nt.op}`);
  if (nt.soft === true) throw new Error('noErrorToast 已提硬（kinds-harden），骨架不应再标 soft');
});

check('C-pending 未知原子不发明、落 pending', () => {
  const all2 = [...draft2.intents.flatMap((it) => (it.expected || [])), ...(draft2.globalAssertions || [])];
  if (all2.some((a) => String(a.kind).includes('bubble'))) throw new Error('未知原子 assert.bubble 被硬凑成断言（禁发明）');
  const pend = draft2.pending || [];
  if (!pend.some((p) => p.atom === 'assert.bubble' && p.intentId === 'intent_2')) throw new Error('未知原子应落 pending[]（route:human 留痕），不得静默丢');
});

// ---------- S2 零 LLM 校验闸 ----------
check('S2a 合规草稿放行', () => {
  const okDraft = { caseId: 'tc_v', intents: [{ intentId: 'i0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/edit' }] }], globalAssertions: [] };
  const r0 = validateDraft(okDraft);
  if (!r0 || r0.ok !== true) throw new Error(`合规草稿应 ok:true，实际 ${JSON.stringify(r0).slice(0, 160)}`);
});

check('S2b 三违规全拦且给落点', () => {
  const bad = [
    { why: '词表外 kind', d: { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'looksRight', op: 'appears', value: 'x' }] }] } },
    { why: 'equals 含 atl_ 字面量', d: { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'inputReadback', op: 'equals', value: 'atl_目录CRUD_1782634443' }] }] } },
    { why: '未模板化 uniqueName', d: { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'inputReadback', op: 'equals', value: 'atl_目录CRUD' }] }] } },
  ];
  for (const b of bad) {
    const r = validateDraft(b.d);
    if (!r || r.ok !== false) throw new Error(`违规草稿（${b.why}）应 ok:false`);
    if (!Array.isArray(r.problems) || r.problems.length === 0) throw new Error(`违规草稿（${b.why}）须给 problems 落点`);
  }
});

// ---------- codex R1 三发现回归锁 ----------
check('S2d 非 equals op 同守易变字面量纪律（R1-F2）', () => {
  const d = { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'replyContains', op: 'contains', value: 'atl_sess_1782634444' }] }], globalAssertions: [] };
  const r = validateDraft(d);
  if (!r || r.ok !== false) throw new Error('contains 冻 atl_ 会话 ID 字面量应被拒（易变值纪律不分 op）');
  if (!Array.isArray(r.problems) || !r.problems.length) throw new Error('须给 problems 落点');
});

check('S2e 数字长串守卫独立覆盖（R1-F3）', () => {
  const d = { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'inputReadback', op: 'equals', value: '工作流编号1782634443' }] }], globalAssertions: [] };
  const r = validateDraft(d);
  if (!r || r.ok !== false) throw new Error('9+ 位数字长串（无 atl_）应被独立拒——数字守卫不得靠 atl_ 正则搭车');
});

check('S2f 形状闸：intent 缺 expected 数组应拒（R1-F1）', () => {
  const r = validateDraft({ caseId: 't', intents: [{ intentId: 'i' }], globalAssertions: [] });
  if (!r || r.ok !== false) throw new Error('intents[].expected 缺席/非数组应 ok:false（fail-closed 形状闸）');
});

check('S2g 顶层 intents 非数组不抛、按契约拒（R2-F1）', () => {
  let r;
  try { r = validateDraft({ caseId: 't', intents: {} }); }
  catch (e) { throw new Error(`validateDraft 对畸形 intents 抛异常（${String(e.message).slice(0, 80)}）——fail-closed 闸必须全域返回 {ok,problems}`); }
  if (!r || r.ok !== false || !r.problems.length) throw new Error('intents 非数组应 ok:false + problems 落点');
});

check('S2h 顶层 globalAssertions 非数组不抛、按契约拒（R2-F2）', () => {
  let r;
  try { r = validateDraft({ caseId: 't', intents: [], globalAssertions: {} }); }
  catch (e) { throw new Error(`validateDraft 对畸形 globalAssertions 抛异常（${String(e.message).slice(0, 80)}）`); }
  if (!r || r.ok !== false || !r.problems.length) throw new Error('globalAssertions 非数组应 ok:false + problems 落点');
});

check('S2c 模板形态 atl_{{uniqueName}} 合法（防过度拒绝）', () => {
  const d = { caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'inputReadback', op: 'equals', value: 'atl_{{uniqueName}}', soft: true }] }], globalAssertions: [] };
  const r = validateDraft(d);
  if (!r || r.ok !== true) throw new Error(`前缀字面 + 模板化的 equals 应放行，实际 ${JSON.stringify(r).slice(0, 200)}`);
});

// ---------- codex R3 两发现回归锁 ----------
check('S3b 校验闸钉 D2 soft 语义两向（R3-F1）', () => {
  // 已实现 kind 标 soft = 绕硬裁定（fail-open 向），拒：
  const r1 = validateDraft({ caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', soft: true }] }], globalAssertions: [] });
  if (!r1 || r1.ok !== false || !r1.problems.length) throw new Error('已实现 kind 带 soft:true 应被拒（绕硬裁定）');
  // 未实现 kind 漏标 soft = 回放必假红，拒（范例换 switchState：buttonState 已随 wf-publish-states 提硬）：
  const r2 = validateDraft({ caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'switchState', op: 'on', value: 'x' }] }], globalAssertions: [] });
  if (!r2 || r2.ok !== false || !r2.problems.length) throw new Error('未实现 kind 漏 soft:true 应被拒（假红温床）');
  // 未实现 kind 带 soft = 合法（D2 正向）：
  const r3 = validateDraft({ caseId: 't', intents: [{ intentId: 'i', expected: [{ kind: 'switchState', op: 'on', value: 'x', soft: true }] }], globalAssertions: [] });
  if (!r3 || r3.ok !== true) throw new Error(`未实现 kind 带 soft:true 应放行，实际 ${JSON.stringify(r3).slice(0, 160)}`);
});

check('S3c onPage fallback 分支同剥实体 ID（R3-F2）', () => {
  const d = synthesizeSkeleton(observed, [
    { intentId: 'intent_9', atom: 'assert.onPage', params: { urlIncludes: '/heren/aimanagement/edit/8f3a21' } },
  ]);
  const i9 = d.intents.find((it) => it.intentId === 'intent_9');
  const urlA = (i9?.expected || []).find((a) => a.kind === 'urlPathname');
  if (!urlA) throw new Error('无观测步的 assert.onPage 应走 urlIncludes fallback 合成');
  if (/8f3a21/.test(urlA.value)) throw new Error(`fallback 分支漏剥实体 ID：${urlA.value}`);
});

if (fails.length) {
  for (const f of fails) console.error(`RED  p4-drafter: ${f}`);
  console.error(`RED  p4-drafter: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   p4-drafter: ${pass}/${pass} 全过（接缝对齐+骨架映射全量+剥ID+pending不发明+校验闸正反+soft 承载）`);
process.exit(0);

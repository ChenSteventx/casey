#!/usr/bin/env node
// intent-plan-known-atom-foundation：TestCase authored expected 是断言事实源之一，必须确定性进入 draft，
// compiler/model 只能单调加法，不能让 authored 字节消失。裁定仍由现有 validate/sign/verdict 链负责。
// 本文件是冻结验收，不得由实现 agent 修改。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DRAFT_CLI = join(ROOT, 'bin', 'draft.mjs');
const fail = (message) => {
  console.error(`RED  testcase-expected-draft: ${message}`);
  process.exit(1);
};

let projectTestCaseAssertions;
let mergeAssertionSources;
let validateDraft;
try {
  ({ projectTestCaseAssertions, mergeAssertionSources, validateDraft } = await import(pathToFileURL(join(ROOT, 'lib', 'assertion-draft.mjs')).href));
} catch (error) {
  fail(`导入 assertion-draft 失败：${String(error.message).slice(-240)}`);
}
if (typeof projectTestCaseAssertions !== 'function' || typeof mergeAssertionSources !== 'function') {
  fail('缺 projectTestCaseAssertions/mergeAssertionSources 导出（实现前预期红）');
}

const CASE_ID = 'tc_authored_expected';
const AUTHORED = { kind: 'textVisible', op: 'appears', value: '保存成功' };
const TESTCASE = {
  schemaVersion: 1,
  caseId: CASE_ID,
  title: 'authored expected 验收',
  source: { kind: 'freetext', raw: '保存并确认成功' },
  preconditions: ['画布已开'],
  steps: [
    { intentId: 'intent_save', intent: '保存', actionHint: 'click', expected: [AUTHORED] },
    { intentId: 'intent_incomplete', intent: '检查未知结果', actionHint: 'assert', expected: [{ kind: 'textVisible' }] },
  ],
  globalAssertions: [{ kind: 'noPageError', op: 'absent' }],
  uniquePrefix: 'atl_',
};
const OBSERVED = {
  caseId: CASE_ID,
  steps: [
    { intentId: 'intent_save', urlPathnameAfter: '/ai-manager/process/detail' },
    { intentId: 'intent_incomplete', urlPathnameAfter: '/ai-manager/process/detail' },
  ],
};
const ASSERTION_ATOMS = [
  { intentId: 'intent_save', atom: 'assert.textVisible', params: { text: '保存成功' } },
  { intentId: 'intent_save', atom: 'assert.noErrorToast', params: {} },
];

const failures = [];
let passes = 0;
function check(name, fn) {
  try {
    fn();
    passes++;
  } catch (error) {
    failures.push(`${name}: ${String(error?.stderr || error?.message || error).slice(-500)}`);
  }
}
function authoredStillPresent(draft) {
  const save = draft.intents?.find((x) => x.intentId === 'intent_save');
  return JSON.stringify(save?.expected?.[0]) === JSON.stringify(AUTHORED);
}

check('A1 导出面', () => {
  if (typeof projectTestCaseAssertions !== 'function') throw new Error('未导出 projectTestCaseAssertions');
  if (typeof mergeAssertionSources !== 'function') throw new Error('未导出 mergeAssertionSources');
  if (typeof validateDraft !== 'function') throw new Error('旧 validateDraft 导出消失');
});

check('A2 step expected/globalAssertions 确定性投影；不完整 authored 只进 pending', () => {
  const projected = projectTestCaseAssertions(TESTCASE);
  if (projected.caseId !== CASE_ID) throw new Error('caseId 未卷回');
  const save = projected.intents.find((x) => x.intentId === 'intent_save');
  if (JSON.stringify(save?.expected) !== JSON.stringify([AUTHORED])) {
    throw new Error(`step expected 投影漂移：${JSON.stringify(save)}`);
  }
  if (JSON.stringify(projected.globalAssertions) !== JSON.stringify(TESTCASE.globalAssertions)) {
    throw new Error(`globalAssertions 投影漂移：${JSON.stringify(projected.globalAssertions)}`);
  }
  const pending = projected.pending.find((x) => x.intentId === 'intent_incomplete');
  if (pending?.reason !== 'AUTHORED_ASSERTION_INCOMPLETE') {
    throw new Error(`不完整 authored 未 fail-closed 到 pending：${JSON.stringify(projected.pending)}`);
  }
  if (projected.intents.some((x) => x.intentId === 'intent_incomplete' && x.expected.length)) {
    throw new Error('不完整 authored 不得被猜成 hard assertion');
  }
});

check('A3 合并顺序 authored → compiler；精确重复去重，compiler 额外断言仍可加', () => {
  const draft = mergeAssertionSources({ testcase: TESTCASE, observed: OBSERVED, assertionAtoms: ASSERTION_ATOMS });
  if (!authoredStillPresent(draft)) throw new Error(`authored 未保持第一优先：${JSON.stringify(draft.intents)}`);
  const save = draft.intents.find((x) => x.intentId === 'intent_save');
  const visible = save.expected.filter((x) => x.kind === 'textVisible' && x.op === 'appears' && x.value === '保存成功');
  if (visible.length !== 1) throw new Error(`authored/compiler 精确重复应去重为 1，实际 ${visible.length}`);
  if (!save.expected.some((x) => x.kind === 'noErrorToast' && x.op === 'absent')) {
    throw new Error('compiler 的额外断言未加进 draft');
  }
  const noPage = draft.globalAssertions.filter((x) => x.kind === 'noPageError' && x.op === 'absent');
  if (noPage.length !== 1) throw new Error(`authored/default 全局精确重复应去重为 1，实际 ${noPage.length}`);
  if (!draft.globalAssertions.some((x) => x.kind === 'noErrorEnvelope' && x.op === 'envelopeOk')) {
    throw new Error('既有默认 noErrorEnvelope 消失');
  }
  if (!draft.pending.some((x) => x.intentId === 'intent_incomplete' && x.reason === 'AUTHORED_ASSERTION_INCOMPLETE')) {
    throw new Error('authored pending 在合并时丢失');
  }
  const gate = validateDraft(draft);
  if (!gate.ok) throw new Error(`合并产物应过现有 validateDraft：${JSON.stringify(gate.problems)}`);
});

const tmp = mkdtempSync(join(tmpdir(), 'casey-authored-draft-'));
const observedFile = join(tmp, 'observed.json');
const reportFile = join(tmp, 'compile-report.json');
const testcaseFile = join(tmp, 'testcase.json');
const patchFile = join(tmp, 'patch.json');
writeFileSync(observedFile, JSON.stringify(OBSERVED));
writeFileSync(reportFile, JSON.stringify({ caseId: CASE_ID, handoff: { assertionAtoms: ASSERTION_ATOMS } }));
writeFileSync(testcaseFile, JSON.stringify(TESTCASE));
writeFileSync(patchFile, JSON.stringify([
  { intentId: 'intent_save', kind: 'textVisible', op: 'appears', value: '保存按钮已恢复' },
]));
function run(args) {
  return spawnSync(process.execPath, [DRAFT_CLI, ...args], { encoding: 'utf8', timeout: 60000 });
}

check('A4 CLI --testcase 四方 caseId 一致时落盘，authored 字节在 model patch 后仍不变', () => {
  const out = join(tmp, 'out-happy');
  mkdirSync(out, { recursive: true });
  const result = run([
    CASE_ID,
    '--observed', observedFile,
    '--compile-report', reportFile,
    '--testcase', testcaseFile,
    '--out-dir', out,
    '--patch', patchFile,
  ]);
  if (result.status !== 0) throw new Error(`--testcase happy 应 exit 0，实际 ${result.status}：${result.stderr}`);
  const output = join(out, `expected.draft-${CASE_ID}.json`);
  if (!existsSync(output)) throw new Error('draft 未落盘');
  const draft = JSON.parse(readFileSync(output, 'utf8'));
  if (!authoredStillPresent(draft)) throw new Error('patch 后 authored 第一条字节被覆盖/删除');
  const save = draft.intents.find((x) => x.intentId === 'intent_save');
  if (!save.expected.some((x) => x.value === '保存按钮已恢复')) throw new Error('合法 model 加法补缝未进入');
  if (!save.expected.some((x) => JSON.stringify(x) === JSON.stringify(AUTHORED))) throw new Error('authored 断言不再存在');
});

check('A5 testcase/observed/report/CLI 任一 caseId 不一致，exit 65 且零落盘', () => {
  const wrongFile = join(tmp, 'testcase-wrong.json');
  writeFileSync(wrongFile, JSON.stringify({ ...TESTCASE, caseId: 'tc_other' }));
  const out = join(tmp, 'out-mismatch');
  mkdirSync(out, { recursive: true });
  const result = run([
    CASE_ID,
    '--observed', observedFile,
    '--compile-report', reportFile,
    '--testcase', wrongFile,
    '--out-dir', out,
  ]);
  if (result.status !== 65) throw new Error(`testcase caseId 不一致应 exit 65，实际 ${result.status}`);
  if (existsSync(join(out, `expected.draft-${CASE_ID}.json`))) throw new Error('caseId 不一致不得落半份 draft');
});

check('A6 不给 --testcase 时 CLI 旧行为仍可用', () => {
  const out = join(tmp, 'out-legacy');
  mkdirSync(out, { recursive: true });
  const result = run([
    CASE_ID,
    '--observed', observedFile,
    '--compile-report', reportFile,
    '--out-dir', out,
  ]);
  if (result.status !== 0) throw new Error(`旧 CLI 行为应 exit 0，实际 ${result.status}：${result.stderr}`);
  const draft = JSON.parse(readFileSync(join(out, `expected.draft-${CASE_ID}.json`), 'utf8'));
  if (!draft.intents.some((x) => x.intentId === 'intent_save')) throw new Error('旧 compiler assertion 骨架丢失');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  testcase-expected-draft: ${failure}`);
  console.error(`RED  testcase-expected-draft: ${passes} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   testcase-expected-draft: ${passes}/${passes}（authored 冻结 + 单调合并 + CLI 四方一致）`);
process.exit(0);

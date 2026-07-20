#!/usr/bin/env node
// p2-sign 的 hermetic 存活覆盖：仅驱动 sign CLI 与纯签名门，不启动监听器/浏览器。
// sourceObligationId:hg-p2-sign-c1  unitCheckId:U-C1
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c1","unitCheckId":"U-C1"}
// sourceObligationId:hg-p2-sign-c2  unitCheckId:U-C2
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c2","unitCheckId":"U-C2"}
// sourceObligationId:hg-p2-sign-c3  unitCheckId:U-C3
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c3","unitCheckId":"U-C3"}
// sourceObligationId:hg-p2-sign-c4  unitCheckId:U-C4
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c4","unitCheckId":"U-C4"}
// sourceObligationId:hg-p2-sign-c6  unitCheckId:U-C6
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c6","unitCheckId":"U-C6"}
// sourceObligationId:hg-p2-sign-c7  unitCheckId:U-C7
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c7","unitCheckId":"U-C7"}
// sourceObligationId:hg-p2-sign-c8  unitCheckId:U-C8
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c8","unitCheckId":"U-C8"}
// sourceObligationId:hg-p2-sign-c9  unitCheckId:U-C9
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c9","unitCheckId":"U-C9"}
// sourceObligationId:hg-p2-sign-c10 unitCheckId:U-C10
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c10","unitCheckId":"U-C10"}
// sourceObligationId:hg-p2-sign-c11 unitCheckId:U-C11
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c11","unitCheckId":"U-C11"}
// sourceObligationId:hg-p2-sign-c12 unitCheckId:U-C12
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c12","unitCheckId":"U-C12"}
// sourceObligationId:hg-p2-sign-c13 unitCheckId:U-C13
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c13","unitCheckId":"U-C13"}
// sourceObligationId:hg-p2-sign-c14 unitCheckId:U-C14
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c14","unitCheckId":"U-C14"}
// sourceObligationId:hg-p2-sign-c15 unitCheckId:U-C15
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c15","unitCheckId":"U-C15"}
// sourceObligationId:hg-p2-sign-c16 unitCheckId:U-C16
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c16","unitCheckId":"U-C16"}
// sourceObligationId:hg-p2-sign-c17 unitCheckId:U-C17
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c17","unitCheckId":"U-C17"}
// sourceObligationId:hg-p2-sign-c18 unitCheckId:U-C18
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c18","unitCheckId":"U-C18"}
// sourceObligationId:hg-p2-sign-c19 unitCheckId:U-C19
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c19","unitCheckId":"U-C19"}
// sourceObligationId:hg-p2-sign-c20 unitCheckId:U-C20
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c20","unitCheckId":"U-C20"}
// sourceObligationId:hg-p2-sign-c21 unitCheckId:U-C21
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c21","unitCheckId":"U-C21"}
// sourceObligationId:hg-p2-sign-c22 unitCheckId:U-C22
// lifecycle-successor: {"sourceObligationId":"hg-p2-sign-c22","unitCheckId":"U-C22"}
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { assertSignedContract, isSigned } from '../../../lib/sign-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const FIX = join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'expected-draft.fixture.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-p2-sign-unit-'));
const SIGNER = 'qa.steven';
const BUILD = 'heren-b1';
const FROZEN_KEYS = new Set(['kind', 'op', 'value', 'soft', 'signedAt', 'signedAgainstBuild', 'signerId']);
const INTENT_KEYS = new Set(['intentId', 'intent', 'expected', 'expectedVerdict']);
const failures = [];
let passed = 0;

function check(unitCheckId, name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${unitCheckId} ${name}`);
  } catch (error) {
    failures.push(`${unitCheckId} ${name}: ${String(error?.message || error).slice(-500)}`);
  }
}

function run(args) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, env: process.env });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writePrd(path, caseId, extra = {}) {
  writeFileSync(path, JSON.stringify({ schemaVersion: 2, caseId, task: 'p2-sign hermetic unit', testChecksums: {}, stories: [], ...extra }, null, 2));
}

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

check('U-C1', '签署字段、签名门与 soft 标记', () => {
  const draft = join(tmp, 'draft-c1.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c1.json'); const prd = join(tmp, 'prd-c1.json'); writePrd(prd, 'tc_sign_probe');
  const result = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD, '--signed-at', '2026-07-06T00:00:00.000Z']);
  if (result.status !== 0) throw new Error(`sign 应 exit 0，实际 ${result.status}：${(result.stderr || '').slice(-200)}`);
  const contract = readJson(frozen);
  const assertions = [...contract.intents.flatMap((intent) => intent.expected), ...(contract.globalAssertions || [])];
  if (!assertions.length) throw new Error('frozen 无断言');
  for (const assertion of assertions) {
    if (!isSigned(assertion)) throw new Error(`断言 kind=${assertion.kind} 未 isSigned`);
    if (assertion.signerId !== SIGNER || assertion.signedAgainstBuild !== BUILD) throw new Error('signer/build 值不对');
  }
  if (!assertSignedContract(contract).ok) throw new Error('assertSignedContract 应 ok');
  const soft = contract.intents.flatMap((intent) => intent.expected).find((assertion) => assertion.kind === 'textVisible');
  if (!soft || soft.soft !== true) throw new Error('soft 标记应原样保留');
});

check('U-C2', 'additionalProperties 白名单', () => {
  const draft = join(tmp, 'draft-c2.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c2.json'); const prd = join(tmp, 'prd-c2.json'); writePrd(prd, 'tc_sign_probe');
  const result = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (result.status !== 0) throw new Error(`sign 应 exit 0，实际 ${result.status}`);
  const contract = readJson(frozen);
  if ('pending' in contract) throw new Error('frozen 不得含顶层 pending');
  for (const intent of contract.intents) {
    for (const key of Object.keys(intent)) if (!INTENT_KEYS.has(key)) throw new Error(`intentContract 越界键 ${key}`);
    for (const assertion of intent.expected) for (const key of Object.keys(assertion)) if (!FROZEN_KEYS.has(key)) throw new Error(`断言越界键 ${key}`);
  }
});

check('U-C3', 'pending 默认拒签且 force 留独立旁车', () => {
  const value = readJson(FIX); value.pending = [{ intentId: 'intent_9', atom: 'assert.switchState', reason: '映射不出→route:human' }];
  const draft = join(tmp, 'draft-c3.json'); writeFileSync(draft, JSON.stringify(value));
  const frozen = join(tmp, 'frozen-c3.json'); const prd = join(tmp, 'prd-c3.json'); writePrd(prd, 'tc_sign_probe');
  const rejected = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (rejected.status !== 65) throw new Error(`pending 非空应拒签 exit 65，实际 ${rejected.status}`);
  if (existsSync(frozen)) throw new Error('拒签应零落盘 frozen');
  const forced = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD, '--force']);
  if (forced.status !== 0) throw new Error(`--force 应 exit 0，实际 ${forced.status}`);
  if ('pending' in readJson(frozen)) throw new Error('--force frozen 仍不得含 pending');
  const sidecar = join(tmp, 'expected.frozen.tc_sign_probe.pending.json');
  if (!existsSync(sidecar)) throw new Error('--force 应留痕 pending 独立旁车');
  if (!readJson(sidecar).some((entry) => entry.intentId === 'intent_9')) throw new Error('留痕旁车应含该 pending 条目');
});

check('U-C4', '只将 frozen checksum 写入 PRD', () => {
  const draft = join(tmp, 'draft-c4.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c4.json'); const prd = join(tmp, 'prd-c4.json'); writePrd(prd, 'tc_sign_probe');
  const result = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (result.status !== 0) throw new Error(`sign 应 exit 0，实际 ${result.status}`);
  const value = readJson(prd);
  if (value.schemaVersion !== 2 || !value.expectedFrozenPath) throw new Error('prd schemaVersion/expectedFrozenPath 不对');
  if (value.testChecksums[value.expectedFrozenPath] !== sha(frozen)) throw new Error('frozen checksum 不匹配');
  for (const key of Object.keys(value.testChecksums)) if (/\.(events|spec)\.json$|events-|spec-/.test(key)) throw new Error(`testChecksums 越界：${key}`);
});

check('U-C6', '重签归档、anti-clobber、checksum 与零缺陷账', () => {
  const draft = join(tmp, 'draft-c6.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c6.json'); const prd = join(tmp, 'prd-c6.json'); writePrd(prd, 'tc_sign_probe'); const archiveDir = join(tmp, 'archive-c6');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'heren-b1', '--archive-dir', archiveDir]).status !== 0) throw new Error('首签失败');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'heren-b2', '--archive-dir', archiveDir]).status === 0) throw new Error('无 --resign 覆写应拒');
  const resigned = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'heren-b2', '--resign', '--archive-dir', archiveDir]);
  if (resigned.status !== 0) throw new Error(`重签失败 ${resigned.status}`);
  if (readJson(frozen).intents.flatMap((intent) => intent.expected).some((assertion) => assertion.signedAgainstBuild !== 'heren-b2')) throw new Error('重签 build 未全翻新');
  if (!readdirSync(archiveDir).some((name) => /heren-b1/.test(name))) throw new Error('旧 build 未归档');
  const value = readJson(prd); if (value.testChecksums[value.expectedFrozenPath] !== sha(frozen)) throw new Error('重签 checksum 未更新');
  if (existsSync(join(tmp, 'failure-ledger.jsonl')) || existsSync(join(archiveDir, 'failure-ledger.jsonl'))) throw new Error('重签不得写 failure-ledger');
});

check('U-C7', 'verdict baseline 只接受人给值并 fail-safe', () => {
  const draft = join(tmp, 'draft-c7.json'); writeFileSync(draft, readFileSync(FIX));
  const noFrozen = join(tmp, 'frozen-c7-no.json'); const noPrd = join(tmp, 'prd-c7-no.json'); writePrd(noPrd, 'tc_sign_probe');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', noPrd, '--frozen-out', noFrozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 0) throw new Error('无基线签失败');
  if (readJson(noFrozen).intents.some((intent) => 'expectedVerdict' in intent)) throw new Error('无基线不得反推 expectedVerdict');
  const good = join(tmp, 'vb-good.json'); writeFileSync(good, JSON.stringify({ intent_1: { verdict: 'NEEDS_HUMAN', reason: 'CASE_DEFECT' } }));
  const goodFrozen = join(tmp, 'frozen-c7-good.json'); const goodPrd = join(tmp, 'prd-c7-good.json'); writePrd(goodPrd, 'tc_sign_probe');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', goodPrd, '--frozen-out', goodFrozen, '--signer', SIGNER, '--against-build', BUILD, '--verdict-baseline', good]).status !== 0) throw new Error('好基线签失败');
  const expected = readJson(goodFrozen).intents.find((intent) => intent.intentId === 'intent_1').expectedVerdict;
  if (expected?.verdict !== 'NEEDS_HUMAN' || expected?.reason !== 'CASE_DEFECT') throw new Error('expectedVerdict 未按基线写入');
  const bad = join(tmp, 'vb-bad.json'); writeFileSync(bad, JSON.stringify({ intent_1: { verdict: 'NEEDS_HUMAN' } }));
  const badFrozen = join(tmp, 'frozen-c7-bad.json'); const badPrd = join(tmp, 'prd-c7-bad.json'); writePrd(badPrd, 'tc_sign_probe');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', badPrd, '--frozen-out', badFrozen, '--signer', SIGNER, '--against-build', BUILD, '--verdict-baseline', bad]).status !== 65) throw new Error('坏基线应拒');
  if (existsSync(badFrozen)) throw new Error('坏基线拒签应零落盘');
});

check('U-C8', 'caseId、路径与凭据门', () => {
  const draft = join(tmp, 'draft-c8.json'); writeFileSync(draft, readFileSync(FIX));
  const prd = join(tmp, 'prd-c8.json'); writePrd(prd, 'tc_other');
  if (run([SIGN, 'tc_other', '--draft', draft, '--prd', prd, '--frozen-out', join(tmp, 'f-c8a.json'), '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('draft/命令 caseId 不一致应拒');
  if (run([SIGN, '../evil', '--draft', draft, '--prd', prd, '--frozen-out', join(tmp, 'f-c8b.json'), '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('路径穿越 caseId 应拒');
  const value = readJson(FIX); value.intents[0].expected.push({ kind: 'textVisible', op: 'appears', value: 'password=hunter2' });
  const credDraft = join(tmp, 'draft-c8-cred.json'); writeFileSync(credDraft, JSON.stringify(value));
  const frozen = join(tmp, 'f-c8-cred.json'); const credPrd = join(tmp, 'prd-c8-cred.json'); writePrd(credPrd, 'tc_sign_probe');
  if (run([SIGN, 'tc_sign_probe', '--draft', credDraft, '--prd', credPrd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 1) throw new Error('凭据门应 exit 1');
  if (existsSync(frozen)) throw new Error('凭据门应零 frozen');
});

check('U-C9', 'sign 拒绝 PRD caseId 不符', () => {
  const draft = join(tmp, 'draft-c9.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c9.json'); const prd = join(tmp, 'prd-c9.json'); writePrd(prd, 'tc_OTHER');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('PRD caseId 不符应拒');
  if (existsSync(frozen)) throw new Error('caseId 不符应零 frozen');
});

check('U-C10', '输出路径与 signer/build 字符安全', () => {
  const draft = join(tmp, 'draft-c10.json'); writeFileSync(draft, readFileSync(FIX)); const prd = join(tmp, 'prd-c10.json'); writePrd(prd, 'tc_sign_probe');
  const base = [SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--signer', SIGNER, '--against-build', BUILD];
  if (run([...base, '--frozen-out', join(tmp, 'evil.txt')]).status !== 65) throw new Error('非 json 输出应拒');
  if (run([...base, '--frozen-out', join(tmp, 'events-x.json')]).status !== 65) throw new Error('events 形态输出应拒');
  const frozen = join(tmp, 'f-c10.json');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', 'a/b/../x', '--against-build', BUILD]).status !== 65) throw new Error('非法 signer 应拒');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', '../evil']).status !== 65) throw new Error('非法 build 应拒');
});

check('U-C11', '坏 draft 不得降级成空契约', () => {
  const prd = join(tmp, 'prd-c11.json'); writePrd(prd, 'tc_sign_probe'); const frozen = join(tmp, 'f-c11.json');
  const badPending = readJson(FIX); badPending.pending = 'oops'; const first = join(tmp, 'd-c11a.json'); writeFileSync(first, JSON.stringify(badPending));
  if (run([SIGN, 'tc_sign_probe', '--draft', first, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('非数组 pending 应拒');
  const missingIntents = readJson(FIX); delete missingIntents.intents; const second = join(tmp, 'd-c11b.json'); writeFileSync(second, JSON.stringify(missingIntents));
  if (run([SIGN, 'tc_sign_probe', '--draft', second, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('缺 intents 应拒');
  const badExpected = readJson(FIX); badExpected.intents[0].expected = 'nope'; const third = join(tmp, 'd-c11c.json'); writeFileSync(third, JSON.stringify(badExpected));
  if (run([SIGN, 'tc_sign_probe', '--draft', third, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('坏 expected 应拒');
  if (existsSync(frozen)) throw new Error('坏 draft 应零 frozen');
});

check('U-C12', '凭据拒签不污染 PRD', () => {
  const value = readJson(FIX); value.intents[0].expected.push({ kind: 'textVisible', op: 'appears', value: 'token=abc123' });
  const draft = join(tmp, 'draft-c12.json'); writeFileSync(draft, JSON.stringify(value));
  const frozen = join(tmp, 'f-c12.json'); const prd = join(tmp, 'prd-c12.json'); writePrd(prd, 'tc_sign_probe'); const before = readFileSync(prd, 'utf8');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 1) throw new Error('凭据门应 exit 1');
  if (existsSync(frozen) || readFileSync(prd, 'utf8') !== before || Object.keys(readJson(prd).testChecksums || {}).length !== 0) throw new Error('凭据拒签留下半份产物');
});

check('U-C13', '归档名清洗且不能逃出 archiveDir', () => {
  const draft = join(tmp, 'draft-c13.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c13.json'); const prd = join(tmp, 'prd-c13.json'); writePrd(prd, 'tc_sign_probe'); const archiveDir = join(tmp, 'archive-c13');
  writeFileSync(frozen, JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: '../../etc/evil', signerId: 'x' }] }] }));
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD, '--resign', '--archive-dir', archiveDir]).status !== 0) throw new Error('重签失败');
  const names = readdirSync(archiveDir); if (!names.length) throw new Error('未产归档');
  const absolute = resolve(archiveDir);
  for (const name of names) {
    if (name.includes('/') || name.includes('\\')) throw new Error(`归档名未清洗：${name}`);
    const path = resolve(archiveDir, name); if (!path.startsWith(`${absolute}/`) && path !== absolute) throw new Error(`归档逃逸：${name}`);
  }
});

check('U-C14', 'globalAssertions 越界键拒签', () => {
  const value = readJson(FIX); value.globalAssertions.push({ kind: 'noPageError', op: 'absent', bogus: 'x' });
  const draft = join(tmp, 'draft-c14.json'); writeFileSync(draft, JSON.stringify(value));
  const frozen = join(tmp, 'f-c14.json'); const prd = join(tmp, 'prd-c14.json'); writePrd(prd, 'tc_sign_probe');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('全局断言越界键应拒');
  if (existsSync(frozen)) throw new Error('越界键拒签应零 frozen');
});

check('U-C15', '不同旧内容的连续重签不能归档碰撞', () => {
  const draft = join(tmp, 'draft-c15.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c15.json'); const prd = join(tmp, 'prd-c15.json'); writePrd(prd, 'tc_sign_probe'); const archiveDir = join(tmp, 'archive-c15');
  const base = [SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--archive-dir', archiveDir];
  if (run([...base, '--against-build', 'b1']).status !== 0 || run([...base, '--against-build', 'b2', '--resign']).status !== 0 || run([...base, '--against-build', 'b3', '--resign']).status !== 0) throw new Error('连续签署失败');
  const names = readdirSync(archiveDir); if (new Set(names).size < 2) throw new Error(`应产至少两份独立归档，实际 ${names.length}`);
});

check('U-C16', 'PRD 写中失败不留下 frozen/tmp', () => {
  const draft = join(tmp, 'draft-c16.json'); writeFileSync(draft, readFileSync(FIX)); const frozen = join(tmp, 'f-c16.json');
  const dir = join(tmp, 'c16'); mkdirSync(dir, { recursive: true }); const prd = join(dir, 'prd.json'); writePrd(prd, 'tc_sign_probe'); mkdirSync(`${prd}.tmp`);
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status === 0) throw new Error('PRD 写中失败应非零');
  if (existsSync(frozen) || existsSync(`${frozen}.tmp`)) throw new Error('写中失败留下 frozen/tmp');
});

check('U-C17', 'frozen-out 与 PRD 路径碰撞 fail-closed', () => {
  const draft = join(tmp, 'draft-c17.json'); writeFileSync(draft, readFileSync(FIX)); const prd = join(tmp, 'prd-c17.json'); writePrd(prd, 'tc_sign_probe'); const before = readFileSync(prd, 'utf8');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', prd, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('路径碰撞应 exit 65');
  if (readFileSync(prd, 'utf8') !== before) throw new Error('路径碰撞污染 PRD');
});

check('U-C18', '输出目录与 pending 旁车目录在 rename 前拒绝', () => {
  const draft = join(tmp, 'draft-c18.json'); writeFileSync(draft, readFileSync(FIX)); const prd = join(tmp, 'prd-c18.json'); writePrd(prd, 'tc_sign_probe');
  const frozenDir = join(tmp, 'f-c18.json'); mkdirSync(frozenDir);
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozenDir, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('目录输出应拒');
  const sub = join(tmp, 'c18-sub'); mkdirSync(sub); const value = readJson(FIX); value.pending = [{ intentId: 'intent_9', atom: 'assert.x', reason: 'r' }];
  const secondDraft = join(sub, 'draft.json'); writeFileSync(secondDraft, JSON.stringify(value)); const secondFrozen = join(sub, 'frozen.json'); mkdirSync(join(sub, 'expected.frozen.tc_sign_probe.pending.json'));
  if (run([SIGN, 'tc_sign_probe', '--draft', secondDraft, '--prd', prd, '--frozen-out', secondFrozen, '--signer', SIGNER, '--against-build', BUILD, '--force']).status !== 65) throw new Error('旁车目录应拒');
  if (existsSync(secondFrozen)) throw new Error('旁车预检失败留下 frozen');
});

check('U-C19', 'PRD 与 frozen.tmp 派生路径碰撞 fail-closed', () => {
  const draft = join(tmp, 'draft-c19.json'); writeFileSync(draft, readFileSync(FIX)); const frozen = join(tmp, 'f-c19.json'); const prd = `${frozen}.tmp`; writePrd(prd, 'tc_sign_probe'); const before = readFileSync(prd, 'utf8');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('.tmp 路径碰撞应拒');
  if (!existsSync(prd) || readFileSync(prd, 'utf8') !== before || existsSync(frozen)) throw new Error('.tmp 碰撞留下覆盖/删除/输出');
});

check('U-C20', 'resign 预检失败不创建 archiveDir', () => {
  const draft = join(tmp, 'draft-c20.json'); writeFileSync(draft, readFileSync(FIX)); const frozen = join(tmp, 'f-c20.json');
  writeFileSync(frozen, JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'b0', signerId: 'x' }] }] }));
  const prd = `${frozen}.tmp`; writePrd(prd, 'tc_sign_probe'); const archiveDir = join(tmp, 'archive-c20-should-not-exist');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', archiveDir]).status !== 65) throw new Error('预检应 exit 65');
  if (existsSync(archiveDir)) throw new Error('预检失败创建了 archiveDir');
});

check('U-C21', '既存 tmp 与 archiveDir/tmp 碰撞均零目录副作用', () => {
  const oldFrozen = () => JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'b0', signerId: 'x' }] }] });
  const draft = join(tmp, 'draft-c21.json'); writeFileSync(draft, readFileSync(FIX));
  const frozenA = join(tmp, 'f-c21a.json'); writeFileSync(frozenA, oldFrozen()); const prdA = join(tmp, 'prd-c21a.json'); writePrd(prdA, 'tc_sign_probe'); writeFileSync(`${frozenA}.tmp`, 'squatter'); const archiveA = join(tmp, 'archive-c21a');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdA, '--frozen-out', frozenA, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', archiveA]).status !== 65) throw new Error('既存 tmp 应拒');
  if (existsSync(archiveA)) throw new Error('既存 tmp 拒绝后创建 archiveDir');
  const frozenB = join(tmp, 'f-c21b.json'); writeFileSync(frozenB, oldFrozen()); const prdB = join(tmp, 'prd-c21b.json'); writePrd(prdB, 'tc_sign_probe');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdB, '--frozen-out', frozenB, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', `${frozenB}.tmp`]).status !== 65) throw new Error('archive-dir 撞 tmp 应拒');
  let stat = null; try { stat = statSync(`${frozenB}.tmp`); } catch {}
  if (stat?.isDirectory()) throw new Error('archive-dir 撞 tmp 建出了目录');
});

check('U-C22', 'archiveDir 位于 frozen.tmp 下应预检拒绝', () => {
  const draft = join(tmp, 'draft-c22.json'); writeFileSync(draft, readFileSync(FIX)); const frozen = join(tmp, 'f-c22.json');
  writeFileSync(frozen, JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'b0', signerId: 'x' }] }] }));
  const prd = join(tmp, 'prd-c22.json'); writePrd(prd, 'tc_sign_probe'); const archiveDir = `${frozen}.tmp/arch`;
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', archiveDir]).status !== 65) throw new Error('archiveDir 位于 tmp 下应拒');
  if (existsSync(`${frozen}.tmp`)) throw new Error('预检失败建出了 frozen.tmp');
});

console.log(`p2-sign zero-SUT unit: ${passed} passed / ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

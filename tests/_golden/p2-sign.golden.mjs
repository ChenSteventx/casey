// p2-sign.golden.mjs —— 相2 人签门（sign，full）红金牌。实现前 bin/sign.mjs 缺席 → C1 起全红。
// sign 把 draft（expected.draft-<caseId>.json）盖签署字段冻成 expected.frozen.json + checksum 冻进 prd
// + 未签→裁定拒算数接进 bin/replay.mjs 前置闸。裁判零 LLM、fail-safe 不 fail-open、凭据不外泄。
// C1 draft→frozen 盖三签字段 + assertSignedContract ok。C2 additionalProperties 合规（去 pending、白名单键）。
// C3 pending 非空拒签 / --force 留痕独立旁车（别静默丢）。C4 checksum 冻进 prd testChecksums+expectedFrozenPath
//    （只断言文件，spec/events 不进）。C5 未签非空契约→replay 前置闸 exit 65 零 axes；已签→exit 0 产 axes
//    （红先行：闸未接时未签 case 现在 exit 0）。C6 重签归档+anti-clobber+不记缺陷。C7 expectedVerdict 仅人给值
//    +fail-safe 不变量+不反推。C8 凭据兜底门 + caseId 一致/路径安全。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { isSigned, assertSignedContract } from '../../lib/sign-gate.mjs';
import { signExpected } from './_sign-helper.mjs';
import { startLoginSut } from '../fixtures/login-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const FIX = join(HERE, 'fixtures', 'seams', 'expected-draft.fixture.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-p2-sign-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-400)}`); } }
function run(args, env) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, env: env || process.env }); }
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// 最小 prd（schemaVersion 2）供 sign 写 testChecksums/expectedFrozenPath。
function writePrd(path, caseId, extra = {}) {
  writeFileSync(path, JSON.stringify({ schemaVersion: 2, caseId, task: 'p2-sign hermetic', testChecksums: {}, stories: [], ...extra }, null, 2));
}
const SIGNER = 'qa.steven';
const BUILD = 'heren-b1';
const FROZEN_KEYS = new Set(['kind', 'op', 'value', 'soft', 'signedAt', 'signedAgainstBuild', 'signerId']);
const INTENT_KEYS = new Set(['intentId', 'intent', 'expected', 'expectedVerdict']);

// ---------- C1 draft→frozen 盖三签字段 ----------
check('C1 sign 盖签署字段：每条断言 isSigned + assertSignedContract ok + signer/build/signedAt 正确', () => {
  const draft = join(tmp, 'draft-c1.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c1.json'); const prd = join(tmp, 'prd-c1.json'); writePrd(prd, 'tc_sign_probe');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD, '--signed-at', '2026-07-06T00:00:00.000Z']);
  if (r.status !== 0) throw new Error(`sign 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const f = readJson(frozen);
  const all = [...f.intents.flatMap((it) => it.expected), ...(f.globalAssertions || [])];
  if (!all.length) throw new Error('frozen 无断言');
  for (const a of all) {
    if (!isSigned(a)) throw new Error(`断言 kind=${a.kind} 未 isSigned`);
    if (a.signerId !== SIGNER || a.signedAgainstBuild !== BUILD) throw new Error('signer/build 值不对');
  }
  if (!assertSignedContract(f).ok) throw new Error('assertSignedContract 应 ok');
  const soft = f.intents.flatMap((it) => it.expected).find((a) => a.kind === 'textVisible');
  if (!soft || soft.soft !== true) throw new Error('soft 标记应原样保留');
});

// ---------- C2 additionalProperties 合规 ----------
check('C2 合规：无顶层 pending、断言只白名单键、intentContract 只白名单键', () => {
  const draft = join(tmp, 'draft-c2.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c2.json'); const prd = join(tmp, 'prd-c2.json'); writePrd(prd, 'tc_sign_probe');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 0) throw new Error(`sign 应 exit 0，实际 ${r.status}`);
  const f = readJson(frozen);
  if ('pending' in f) throw new Error('frozen 不得含顶层 pending');
  for (const it of f.intents) {
    for (const k of Object.keys(it)) if (!INTENT_KEYS.has(k)) throw new Error(`intentContract 越界键 ${k}`);
    for (const a of it.expected) for (const k of Object.keys(a)) if (!FROZEN_KEYS.has(k)) throw new Error(`断言越界键 ${k}`);
  }
});

// ---------- C3 pending 非空拒签 / --force 留痕 ----------
check('C3 pending 非空默认拒签 exit 65 零落盘；--force 放行 + 留痕独立旁车（别静默丢）', () => {
  const d = readJson(FIX); d.pending = [{ intentId: 'intent_9', atom: 'assert.switchState', reason: '映射不出→route:human' }];
  const draft = join(tmp, 'draft-c3.json'); writeFileSync(draft, JSON.stringify(d));
  const frozen = join(tmp, 'frozen-c3.json'); const prd = join(tmp, 'prd-c3.json'); writePrd(prd, 'tc_sign_probe');
  const r1 = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (r1.status !== 65) throw new Error(`pending 非空应拒签 exit 65（fail-closed），实际 ${r1.status}`);
  if (existsSync(frozen)) throw new Error('拒签应零落盘 frozen');
  const r2 = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD, '--force']);
  if (r2.status !== 0) throw new Error(`--force 应 exit 0，实际 ${r2.status}`);
  if ('pending' in readJson(frozen)) throw new Error('--force frozen 仍不得含 pending');
  const sidecar = join(tmp, 'expected.frozen.tc_sign_probe.pending.json');
  if (!existsSync(sidecar)) throw new Error('--force 应留痕 pending 独立旁车');
  const sc = readJson(sidecar);
  if (!Array.isArray(sc) || !sc.some((p) => p.intentId === 'intent_9')) throw new Error('留痕旁车应含该 pending 条目');
});

// ---------- C4 checksum 冻进 prd（只断言文件） ----------
check('C4 checksum 冻进 prd：testChecksums[expectedFrozenPath]===sha256(frozen) + schemaVersion 2；spec/events 不进', () => {
  const draft = join(tmp, 'draft-c4.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c4.json'); const prd = join(tmp, 'prd-c4.json'); writePrd(prd, 'tc_sign_probe');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 0) throw new Error(`sign 应 exit 0，实际 ${r.status}`);
  const p = readJson(prd);
  if (p.schemaVersion !== 2) throw new Error('prd schemaVersion 应 2');
  if (!p.expectedFrozenPath) throw new Error('prd 应设 expectedFrozenPath');
  const tc = p.testChecksums || {};
  if (tc[p.expectedFrozenPath] !== sha(frozen)) throw new Error('testChecksums[expectedFrozenPath] 应 === sha256(frozen)');
  for (const k of Object.keys(tc)) if (/\.(events|spec)\.json$|events-|spec-/.test(k)) throw new Error(`testChecksums 越界冻 spec/events：${k}`);
});

// ---------- C5 未签→replay 前置闸拒算数（红先行） ----------
await checkAsync('C5 未签非空契约→replay exit 65 零 axes；已签→exit 0 产 axes', async () => {
  const srv = await startLoginSut({ markerFile: join(tmp, 'm-c5') });
  try {
    const events = join(tmp, 'events-c5.json');
    writeFileSync(events, JSON.stringify({ schemaVersion: 2, channel: 'web', caseId: 'tc_sign_c5', url: '{{baseUrl}}/plain', recordedAt: '2026-07-06T00:00:00.000Z', compiledBy: 'golden', authored: false,
      events: [{ stepId: 'atstep_0', intentId: 'intent_1', atom: 'workflow.create', action: 'nav', url: '{{baseUrl}}/plain' }] }));
    const profile = join(tmp, 'profile-c5.json'); writeFileSync(profile, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
    const unsigned = { caseId: 'tc_sign_c5', channel: 'web', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/plain' }] }], globalAssertions: [] };
    const unsignedF = join(tmp, 'exp-unsigned-c5.json'); writeFileSync(unsignedF, JSON.stringify(unsigned));
    const signedF = join(tmp, 'exp-signed-c5.json'); writeFileSync(signedF, JSON.stringify(signExpected(unsigned)));
    const axU = join(tmp, 'ax-unsigned-c5.json'), axS = join(tmp, 'ax-signed-c5.json');
    const rU = run([REPLAY, '--events', events, '--sut', srv.url, '--expected', unsignedF, '--profile', profile, '--out', axU]);
    if (rU.status !== 65) throw new Error(`未签契约 replay 应 exit 65（前置闸），实际 ${rU.status}`);
    if (existsSync(axU)) throw new Error('未签拒算数应零 axes');
    const rS = run([REPLAY, '--events', events, '--sut', srv.url, '--expected', signedF, '--profile', profile, '--out', axS]);
    if (rS.status !== 0) throw new Error(`已签契约 replay 应 exit 0，实际 ${rS.status}：${(rS.stderr || '').slice(-200)}`);
    if (!existsSync(axS)) throw new Error('已签契约应产 axes');
  } finally {
    await srv.close();
  }
});

// ---------- C6 重签版本化：归档 + anti-clobber + 不记缺陷 ----------
check('C6 重签：--resign 归档旧 frozen + build 翻新 + testChecksums 更新 + 不记缺陷；无 --resign 覆写拒（anti-clobber）', () => {
  const draft = join(tmp, 'draft-c6.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'frozen-c6.json'); const prd = join(tmp, 'prd-c6.json'); writePrd(prd, 'tc_sign_probe');
  const archiveDir = join(tmp, 'archive');
  const r1 = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'heren-b1', '--archive-dir', archiveDir]);
  if (r1.status !== 0) throw new Error(`首签应 exit 0，实际 ${r1.status}`);
  const rClobber = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'heren-b2', '--archive-dir', archiveDir]);
  if (rClobber.status === 0) throw new Error('已存在 frozen 无 --resign 覆写应拒（anti-clobber）');
  const r2 = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'heren-b2', '--resign', '--archive-dir', archiveDir]);
  if (r2.status !== 0) throw new Error(`重签应 exit 0，实际 ${r2.status}`);
  const f = readJson(frozen);
  if (f.intents.flatMap((it) => it.expected).some((a) => a.signedAgainstBuild !== 'heren-b2')) throw new Error('重签后 build 应全翻新为 heren-b2');
  if (!existsSync(archiveDir) || !readdirSync(archiveDir).some((n) => /heren-b1/.test(n))) throw new Error('重签应归档旧 build 期望');
  if (readJson(prd).testChecksums[readJson(prd).expectedFrozenPath] !== sha(frozen)) throw new Error('重签后 testChecksums 应更新到新 sha');
  // 不记缺陷（ADR-0004 §4，codex R1-F6 钉实）：sign 绝不在其产物区写 failure-ledger。
  if (existsSync(join(tmp, 'failure-ledger.jsonl')) || existsSync(join(archiveDir, 'failure-ledger.jsonl'))) throw new Error('重签绝不写 failure-ledger（ADR-0004 §4）');
});

// ---------- C7 expectedVerdict 人给值 + fail-safe 不变量 + 不反推 ----------
check('C7 expectedVerdict：仅 --verdict-baseline 人给值 + fail-safe 不变量；坏基线拒；无基线不写不反推', () => {
  const draft = join(tmp, 'draft-c7.json'); writeFileSync(draft, readFileSync(FIX));
  // 无基线：frozen 不得含 expectedVerdict
  const fNo = join(tmp, 'frozen-c7no.json'); const prdNo = join(tmp, 'prd-c7no.json'); writePrd(prdNo, 'tc_sign_probe');
  const rNo = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdNo, '--frozen-out', fNo, '--signer', SIGNER, '--against-build', BUILD]);
  if (rNo.status !== 0) throw new Error('无基线签应 exit 0');
  if (readJson(fNo).intents.some((it) => 'expectedVerdict' in it)) throw new Error('无基线不得写 expectedVerdict（禁反推）');
  // 好基线：intent_1 → NEEDS_HUMAN/CASE_DEFECT
  const good = join(tmp, 'vb-good.json'); writeFileSync(good, JSON.stringify({ intent_1: { verdict: 'NEEDS_HUMAN', reason: 'CASE_DEFECT' } }));
  const fG = join(tmp, 'frozen-c7g.json'); const prdG = join(tmp, 'prd-c7g.json'); writePrd(prdG, 'tc_sign_probe');
  const rG = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdG, '--frozen-out', fG, '--signer', SIGNER, '--against-build', BUILD, '--verdict-baseline', good]);
  if (rG.status !== 0) throw new Error(`好基线签应 exit 0，实际 ${rG.status}`);
  const ev = readJson(fG).intents.find((it) => it.intentId === 'intent_1').expectedVerdict;
  if (!ev || ev.verdict !== 'NEEDS_HUMAN' || ev.reason !== 'CASE_DEFECT') throw new Error('expectedVerdict 应按基线人给值');
  // 坏基线：NEEDS_HUMAN 缺 reason → 拒
  const bad = join(tmp, 'vb-bad.json'); writeFileSync(bad, JSON.stringify({ intent_1: { verdict: 'NEEDS_HUMAN' } }));
  const fB = join(tmp, 'frozen-c7b.json'); const prdB = join(tmp, 'prd-c7b.json'); writePrd(prdB, 'tc_sign_probe');
  const rB = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdB, '--frozen-out', fB, '--signer', SIGNER, '--against-build', BUILD, '--verdict-baseline', bad]);
  if (rB.status !== 65) throw new Error(`坏基线（NEEDS_HUMAN 缺 reason）应拒签 exit 65，实际 ${rB.status}`);
  if (existsSync(fB)) throw new Error('坏基线拒签应零落盘');
});

// ---------- C8 凭据兜底门 + caseId 一致/路径安全 ----------
check('C8 凭据兜底门 + caseId 一致/路径安全', () => {
  // caseId 不一致
  const draft = join(tmp, 'draft-c8.json'); writeFileSync(draft, readFileSync(FIX));
  const prd = join(tmp, 'prd-c8.json'); writePrd(prd, 'tc_other');
  const r1 = run([SIGN, 'tc_other', '--draft', draft, '--prd', prd, '--frozen-out', join(tmp, 'f-c8a.json'), '--signer', SIGNER, '--against-build', BUILD]);
  if (r1.status !== 65) throw new Error(`draft.caseId 与命令行 caseId 不一致应拒 exit 65，实际 ${r1.status}`);
  // caseId 路径穿越
  const r2 = run([SIGN, '../evil', '--draft', draft, '--prd', prd, '--frozen-out', join(tmp, 'f-c8b.json'), '--signer', SIGNER, '--against-build', BUILD]);
  if (r2.status !== 65) throw new Error(`caseId 含 / .. 应拒 exit 65（路径安全），实际 ${r2.status}`);
  // 凭据兜底门：draft 断言 value 含 forbidden 关键词
  const d = readJson(FIX); d.intents[0].expected.push({ kind: 'textVisible', op: 'appears', value: 'password=hunter2' });
  const draftCred = join(tmp, 'draft-c8cred.json'); writeFileSync(draftCred, JSON.stringify(d));
  const fC = join(tmp, 'f-c8cred.json'); const prdC = join(tmp, 'prd-c8cred.json'); writePrd(prdC, 'tc_sign_probe');
  const r3 = run([SIGN, 'tc_sign_probe', '--draft', draftCred, '--prd', prdC, '--frozen-out', fC, '--signer', SIGNER, '--against-build', BUILD]);
  if (r3.status !== 1) throw new Error(`凭据兜底门应拦截 value 含 password= 的断言 exit 1，实际 ${r3.status}`);
  if (existsSync(fC)) throw new Error('凭据门拦截应零落盘');
});

// ---------- C9 caseId 端到端绑定（codex R1-F1） ----------
check('C9 caseId 绑定：sign 拒 prd.caseId 不符', () => {
  const draft = join(tmp, 'd-c9.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c9.json'); const prd = join(tmp, 'prd-c9.json'); writePrd(prd, 'tc_OTHER'); // prd.caseId ≠ 命令行/draft
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 65) throw new Error(`prd.caseId 不符应 exit 65，实际 ${r.status}`);
  if (existsSync(frozen)) throw new Error('caseId 不符拒签应零落盘');
});
await checkAsync('C9b replay 拒 events/expected caseId 不符（已签也拒）', async () => {
  const srv = await startLoginSut({ markerFile: join(tmp, 'm-c9b') });
  try {
    const events = join(tmp, 'events-c9b.json');
    writeFileSync(events, JSON.stringify({ schemaVersion: 2, channel: 'web', caseId: 'tc_events_X', url: '{{baseUrl}}/plain', recordedAt: '2026-07-06T00:00:00.000Z', compiledBy: 'golden', authored: false,
      events: [{ stepId: 'atstep_0', intentId: 'intent_1', atom: 'workflow.create', action: 'nav', url: '{{baseUrl}}/plain' }] }));
    const profile = join(tmp, 'profile-c9b.json'); writeFileSync(profile, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
    // 已签契约但 caseId=tc_expected_Y ≠ events 的 tc_events_X
    const signedMismatch = signExpected({ caseId: 'tc_expected_Y', channel: 'web', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/plain' }] }], globalAssertions: [] });
    const expF = join(tmp, 'exp-c9b.json'); writeFileSync(expF, JSON.stringify(signedMismatch));
    const r = run([REPLAY, '--events', events, '--sut', srv.url, '--expected', expF, '--profile', profile, '--out', join(tmp, 'ax-c9b.json')]);
    if (r.status !== 65) throw new Error(`已签但 caseId 不符 replay 应 exit 65，实际 ${r.status}`);
    // C9c（codex R2-F2）：非空签署契约删掉 caseId 也不能绕过绑定 → 仍拒。
    const noCase = signExpected({ caseId: 'tc_events_X', channel: 'web', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/plain' }] }], globalAssertions: [] });
    delete noCase.caseId;
    const expF2 = join(tmp, 'exp-c9c.json'); writeFileSync(expF2, JSON.stringify(noCase));
    const r2 = run([REPLAY, '--events', events, '--sut', srv.url, '--expected', expF2, '--profile', profile, '--out', join(tmp, 'ax-c9c.json')]);
    if (r2.status !== 65) throw new Error(`删 caseId 的非空签署契约应仍 exit 65（强制双向绑定），实际 ${r2.status}`);
  } finally { await srv.close(); }
});

// ---------- C10 路径 / 字符安全（codex R1-F2） ----------
check('C10 安全：frozen-out 非.json/events 形态拒 · signer|build 非法字符拒', () => {
  const draft = join(tmp, 'd-c10.json'); writeFileSync(draft, readFileSync(FIX)); const prd = join(tmp, 'prd-c10.json'); writePrd(prd, 'tc_sign_probe');
  const base = [SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--signer', SIGNER, '--against-build', BUILD];
  if (run([...base, '--frozen-out', join(tmp, 'evil.txt')]).status !== 65) throw new Error('frozen-out 非 .json 应拒');
  if (run([...base, '--frozen-out', join(tmp, 'events-x.json')]).status !== 65) throw new Error('frozen-out events- 形态应拒（testChecksums 只冻断言文件）');
  const f = join(tmp, 'f-c10.json');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', f, '--signer', 'a/b/../x', '--against-build', BUILD]).status !== 65) throw new Error('signer 非法字符应拒');
  if (run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', f, '--signer', SIGNER, '--against-build', '../evil']).status !== 65) throw new Error('build 非法字符应拒');
});

// ---------- C11 严校 draft（codex R1-F4：坏结构绝不静默降级空契约） ----------
check('C11 严校：非数组 pending 拒 · 缺/坏 intents 拒（不静默签成空）', () => {
  const prd = join(tmp, 'prd-c11.json'); writePrd(prd, 'tc_sign_probe'); const f = join(tmp, 'f-c11.json');
  const bad1 = readJson(FIX); bad1.pending = 'oops';
  const d1 = join(tmp, 'd-c11a.json'); writeFileSync(d1, JSON.stringify(bad1));
  if (run([SIGN, 'tc_sign_probe', '--draft', d1, '--prd', prd, '--frozen-out', f, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('非数组 pending 应拒');
  const bad2 = readJson(FIX); delete bad2.intents;
  const d2 = join(tmp, 'd-c11b.json'); writeFileSync(d2, JSON.stringify(bad2));
  if (run([SIGN, 'tc_sign_probe', '--draft', d2, '--prd', prd, '--frozen-out', f, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('缺 intents 应拒');
  const bad3 = readJson(FIX); bad3.intents[0].expected = 'nope';
  const d3 = join(tmp, 'd-c11c.json'); writeFileSync(d3, JSON.stringify(bad3));
  if (run([SIGN, 'tc_sign_probe', '--draft', d3, '--prd', prd, '--frozen-out', f, '--signer', SIGNER, '--against-build', BUILD]).status !== 65) throw new Error('坏 intents[].expected 应拒');
  if (existsSync(f)) throw new Error('坏 draft 拒签应零落盘');
});

// ---------- C12 半份落盘 fail-closed（codex R1-F3/F5）：cred-gate 命中时 prd 不被改 ----------
check('C12 fail-closed：凭据门命中 → frozen 零落盘且 prd 的 testChecksums 未被污染', () => {
  const d = readJson(FIX); d.intents[0].expected.push({ kind: 'textVisible', op: 'appears', value: 'token=abc123' });
  const draft = join(tmp, 'd-c12.json'); writeFileSync(draft, JSON.stringify(d));
  const f = join(tmp, 'f-c12.json'); const prd = join(tmp, 'prd-c12.json'); writePrd(prd, 'tc_sign_probe');
  const before = readFileSync(prd, 'utf8');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', f, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 1) throw new Error(`凭据门应 exit 1，实际 ${r.status}`);
  if (existsSync(f)) throw new Error('凭据门命中应零 frozen');
  if (readFileSync(prd, 'utf8') !== before) throw new Error('凭据门命中 prd 不得被改（半份落盘 fail-closed）');
  if (Object.keys(readJson(prd).testChecksums || {}).length !== 0) throw new Error('拒签不得污染 testChecksums');
});

// ---------- C13 归档名不穿越（codex R1-F2：旧 frozen 的 build 含 /..） ----------
check('C13 归档安全：手工构造旧 frozen 的 signedAgainstBuild 含 /.. → 重签归档名清洗、不逃出 archiveDir', () => {
  const draft = join(tmp, 'd-c13.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c13.json'); const prd = join(tmp, 'prd-c13.json'); writePrd(prd, 'tc_sign_probe');
  const archiveDir = join(tmp, 'arch-c13');
  // 手工写一份「旧 frozen」，其 build 含穿越串（模拟被篡改的历史 frozen）
  writeFileSync(frozen, JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: '../../etc/evil', signerId: 'x' }] }] }));
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD, '--resign', '--archive-dir', archiveDir]);
  if (r.status !== 0) throw new Error(`重签应 exit 0，实际 ${r.status}`);
  const names = existsSync(archiveDir) ? readdirSync(archiveDir) : [];
  if (!names.length) throw new Error('应产归档');
  // 真安全性 = 归档文件解析后仍在 archiveDir 内（斜杠已清洗为 _，单个文件名组件里的字符逃不出目录）。
  const adAbs = resolve(archiveDir);
  for (const n of names) {
    if (n.includes('/') || n.includes('\\')) throw new Error(`归档名含路径分隔符（未清洗）：${n}`);
    if (!resolve(archiveDir, n).startsWith(adAbs + '/') && resolve(archiveDir, n) !== adAbs) throw new Error(`归档文件逃出 archiveDir：${n}`);
  }
});

// ---------- C14 全局断言白名单自守（codex R2-F3） ----------
check('C14 globalAssertions 越界键拒签（与 intents 同口径 additionalProperties 合规）', () => {
  const d = readJson(FIX); d.globalAssertions.push({ kind: 'noPageError', op: 'absent', bogus: 'x' });
  const draft = join(tmp, 'd-c14.json'); writeFileSync(draft, JSON.stringify(d));
  const f = join(tmp, 'f-c14.json'); const prd = join(tmp, 'prd-c14.json'); writePrd(prd, 'tc_sign_probe');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', f, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 65) throw new Error(`全局断言越界键应拒 exit 65，实际 ${r.status}`);
  if (existsSync(f)) throw new Error('越界键拒签应零落盘');
});

// ---------- C15 归档防碰撞（codex R2-F4）：不同旧内容重签产不同归档 ----------
check('C15 重签归档防碰撞：连续两次重签（不同旧内容）产两份独立归档', () => {
  const draft = join(tmp, 'd-c15.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c15.json'); const prd = join(tmp, 'prd-c15.json'); writePrd(prd, 'tc_sign_probe');
  const archiveDir = join(tmp, 'arch-c15');
  const base = [SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--archive-dir', archiveDir];
  if (run([...base, '--against-build', 'b1']).status !== 0) throw new Error('首签应 exit 0');
  if (run([...base, '--against-build', 'b2', '--resign']).status !== 0) throw new Error('重签 b2 应 exit 0');
  if (run([...base, '--against-build', 'b3', '--resign']).status !== 0) throw new Error('重签 b3 应 exit 0');
  const names = existsSync(archiveDir) ? readdirSync(archiveDir) : [];
  if (new Set(names).size < 2) throw new Error(`两次重签（旧内容 b1/b2 不同）应产 ≥2 份独立归档，实际 ${names.length}`);
});

// ---------- C16 写中 I/O 失败零半份（codex R2-F1）：prd 不可写 → frozen 不落盘 ----------
check('C16 两阶段落盘：prd 写中失败（prd.json.tmp 被目录占位触 EISDIR）→ frozen 零落盘、非零退出、清孤儿', () => {
  const draft = join(tmp, 'd-c16.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c16.json');
  const prdDir = join(tmp, 'c16'); mkdirSync(prdDir, { recursive: true });
  const prd = join(prdDir, 'prd.json'); writePrd(prd, 'tc_sign_probe'); // prd 可读
  mkdirSync(prd + '.tmp'); // 占位目录：写 prd.json.tmp 触 EISDIR（读 prd 成功、写 prd 失败——真写中失败）
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status === 0) throw new Error('prd 写中失败应非零退出');
  if (existsSync(frozen)) throw new Error('写中失败 frozen 不得落盘（两阶段：全温写完才 rename）');
  if (existsSync(frozen + '.tmp')) throw new Error('失败应清孤儿 frozen.tmp');
});

// ---------- C17 输出路径碰撞预检（codex R3-F1）：frozen-out 与 prd 同路径 → 拒、零落盘 ----------
check('C17 落盘预检：输出路径碰撞（frozen-out === prd）→ exit 65 零落盘', () => {
  const draft = join(tmp, 'd-c17.json'); writeFileSync(draft, readFileSync(FIX));
  const prd = join(tmp, 'prd-c17.json'); writePrd(prd, 'tc_sign_probe');
  const before = readFileSync(prd, 'utf8');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', prd, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 65) throw new Error(`输出路径碰撞应 exit 65，实际 ${r.status}`);
  if (readFileSync(prd, 'utf8') !== before) throw new Error('碰撞拒签 prd 不得被改');
});

// ---------- C18 目标是既存目录预检（codex R3-F1）：frozen-out / pending 旁车是目录 → 拒、零 rename 半提交 ----------
check('C18 落盘预检：frozen-out 是既存目录 → exit 65 零落盘；pending 旁车是目录（--force）→ exit 65 frozen 零落盘', () => {
  const draft = join(tmp, 'd-c18.json'); writeFileSync(draft, readFileSync(FIX));
  const prd = join(tmp, 'prd-c18.json'); writePrd(prd, 'tc_sign_probe');
  // frozen-out 是目录
  const fdir = join(tmp, 'f-c18.json'); mkdirSync(fdir);
  const r1 = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', fdir, '--signer', SIGNER, '--against-build', BUILD]);
  if (r1.status !== 65) throw new Error(`frozen-out 是目录应 exit 65，实际 ${r1.status}`);
  // pending 旁车路径预建成目录 + --force（复现 codex R3 构造例）——用独立子目录避开 C3 已写的同名旁车文件
  const sub = join(tmp, 'c18sub'); mkdirSync(sub);
  const d2 = readJson(FIX); d2.pending = [{ intentId: 'intent_9', atom: 'assert.x', reason: 'r' }];
  const draft2 = join(sub, 'd-c18b.json'); writeFileSync(draft2, JSON.stringify(d2));
  const frozen2 = join(sub, 'f-c18b.json');
  mkdirSync(join(sub, 'expected.frozen.tc_sign_probe.pending.json')); // 旁车目标占位目录（本子目录内）
  const r2 = run([SIGN, 'tc_sign_probe', '--draft', draft2, '--prd', prd, '--frozen-out', frozen2, '--signer', SIGNER, '--against-build', BUILD, '--force']);
  if (r2.status !== 65) throw new Error(`pending 旁车是目录应 exit 65（预检），实际 ${r2.status}`);
  if (existsSync(frozen2)) throw new Error('预检拒应零 frozen（rename 前拦截，无半提交）');
});

// ---------- C19 .tmp 派生路径碰撞预检（codex R4-F1）：某目标恰为另一目标的 .tmp → 拒、零覆盖 ----------
check('C19 落盘预检：--prd 恰为 --frozen-out 的 .tmp 派生路径 → exit 65、prd 零覆盖零删除', () => {
  const draft = join(tmp, 'd-c19.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c19.json');
  const prd = frozen + '.tmp'; // prd 恰是 frozen 的 tmp 派生路径（codex R4 构造例）
  writePrd(prd, 'tc_sign_probe');
  const before = readFileSync(prd, 'utf8');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', BUILD]);
  if (r.status !== 65) throw new Error(`.tmp 派生碰撞应 exit 65，实际 ${r.status}`);
  if (!existsSync(prd) || readFileSync(prd, 'utf8') !== before) throw new Error('碰撞拒签 prd 不得被覆盖/删除');
  if (existsSync(frozen)) throw new Error('碰撞拒签应零 frozen');
});

// ---------- C20 零落盘含目录副作用（codex R4-F2）：预检失败不留新建 archiveDir ----------
check('C20 零落盘含目录：resign 下预检失败（.tmp 碰撞）→ 不留新建 archiveDir', () => {
  const draft = join(tmp, 'd-c20.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c20.json');
  // 预置合法旧 frozen（供 resign 读取）
  writeFileSync(frozen, JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'b0', signerId: 'x' }] }] }));
  const prd = frozen + '.tmp'; writePrd(prd, 'tc_sign_probe'); // 触 .tmp 碰撞预检
  const archiveDir = join(tmp, 'arch-c20-should-not-exist');
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', archiveDir]);
  if (r.status !== 65) throw new Error(`预检应 exit 65，实际 ${r.status}`);
  if (existsSync(archiveDir)) throw new Error('预检失败不得留新建 archiveDir（零落盘含目录副作用）');
});

// ---------- C21 目录副作用零残留（codex R5-F1）：预植 tmp / archive-dir 撞 tmp → 预检拒、不建 archiveDir ----------
check('C21 零目录副作用：预植 frozenOut.tmp（文件）+ 新 archiveDir → 65 不建 archiveDir；archive-dir===frozenOut.tmp → 65', () => {
  // 合法旧 frozen 供 resign 读
  const oldFrozen = () => JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'b0', signerId: 'x' }] }] });
  const draft = join(tmp, 'd-c21.json'); writeFileSync(draft, readFileSync(FIX));
  // (a) 预植 frozenOut.tmp 为普通文件 + 新 archiveDir → 预检拒既存 tmp、mkdir 前退出
  const frozenA = join(tmp, 'f-c21a.json'); writeFileSync(frozenA, oldFrozen());
  const prdA = join(tmp, 'prd-c21a.json'); writePrd(prdA, 'tc_sign_probe');
  writeFileSync(frozenA + '.tmp', 'squatter'); // 预植 tmp 文件
  const arcA = join(tmp, 'arc-c21a-should-not-exist');
  const rA = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdA, '--frozen-out', frozenA, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', arcA]);
  if (rA.status !== 65) throw new Error(`预植 tmp 应预检拒 exit 65，实际 ${rA.status}`);
  if (existsSync(arcA)) throw new Error('预检拒不得留新建 archiveDir（零目录副作用）');
  // (b) --archive-dir === frozenOut.tmp（撞 frozen 的 tmp 派生路径）→ 预检拒
  const frozenB = join(tmp, 'f-c21b.json'); writeFileSync(frozenB, oldFrozen());
  const prdB = join(tmp, 'prd-c21b.json'); writePrd(prdB, 'tc_sign_probe');
  const rB = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prdB, '--frozen-out', frozenB, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', frozenB + '.tmp']);
  if (rB.status !== 65) throw new Error(`archive-dir 撞 frozen.tmp 应预检拒 exit 65，实际 ${rB.status}`);
  let st = null; try { st = statSync(frozenB + '.tmp'); } catch { st = null; }
  if (st && st.isDirectory()) throw new Error('archive-dir 撞 tmp 不得把 frozen.tmp 建成目录');
});

// ---------- C22 archive-dir 祖先/后代关系（codex R6-F1）：archive-dir 在 frozenOut.tmp 之下 → 预检拒、不建 frozen.tmp ----------
check('C22 落盘预检：--archive-dir 位于 frozenOut.tmp 之下 → exit 65、不把 frozenOut.tmp 建成目录', () => {
  const draft = join(tmp, 'd-c22.json'); writeFileSync(draft, readFileSync(FIX));
  const frozen = join(tmp, 'f-c22.json');
  writeFileSync(frozen, JSON.stringify({ caseId: 'tc_sign_probe', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/x', signedAt: '2026-07-06T00:00:00.000Z', signedAgainstBuild: 'b0', signerId: 'x' }] }] }));
  const prd = join(tmp, 'prd-c22.json'); writePrd(prd, 'tc_sign_probe');
  const arc = frozen + '.tmp/arch'; // archive-dir 在 frozen 的 tmp 派生路径之下（codex R6 构造例）
  const r = run([SIGN, 'tc_sign_probe', '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', SIGNER, '--against-build', 'b1', '--resign', '--archive-dir', arc]);
  if (r.status !== 65) throw new Error(`archive-dir 在 frozen.tmp 下应预检拒 exit 65，实际 ${r.status}`);
  if (existsSync(frozen + '.tmp')) throw new Error('不得因 mkdir -p 建出 frozen.tmp 目录（零目录副作用）');
});

console.log(`p2-sign golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}

#!/usr/bin/env node
// P9 回放授权票据 · 命令行边界与批会话协议（草案，未冻结）
// 零 SUT、零浏览器、零网络；全部 spawn 真二进制取退出码（不 grep 失败标记串）。
// 拆二理由见 plan §5：本枚是「命令行与签署边界 + 批会话」，纯层与采集面在 pure-suite 那枚。
//
// 批会话协议（评审 C-new 裁定；Tier2 三成员是分进程连跑，实测
//   lib/selftest-tier2-collect.mjs:186 在成员循环 :405 内逐个 spawnSync，全批共用一个
//   batchToken :378-379——所以「一票 launch 前占用一次」会让成员②③被判已核销）：
//   台账根下每 nonce 一目录；
//   ① 首成员 launch 前以 'wx' 原子独占创建 <nonce>/session.json = {batchToken, occupiedAt}；
//   ② 每成员 launch 前依次核：session 在且 batchToken 逐字同值 → 自己 caseId 在票据授权成员集内
//      → 以 'wx' 落 <nonce>/<caseId>.consumed.json；三条全过才放行 launch。
//   崩溃重跑 = 新 batchToken → 撞 session 异值拒 → 走人签新票（绝不自动复用）。

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  CASE_A, CASE_B, BATCH_ID, NOT_AFTER, NONCE,
  json, loadApis, makeBundle, makeGrant, makeGrantDraft, layout, replayArgs,
} from './support/p9-replay-grant-fixtures.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const AUTHORITY = join(ROOT, 'bin', 'entity-authority.mjs');
const failures = [];
let passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}

const { needV3, needGrant } = await loadApis();
const bundle = (caseId, options) => makeBundle(needV3, caseId, options);
const grantOf = (options) => makeGrant(needGrant, options);

const BATCH_TOKEN = 'p9-batch-alpha';
const sessionPath = (root) => join(root, NONCE, 'session.json');
const memberPath = (root, caseId) => join(root, NONCE, `${caseId}.consumed.json`);

// CASEY_LAUNCH_SENTINEL（bin/replay.mjs:450）在 chromium.launch 前短路、写哨兵、exit 66。
// 门若真在浏览器前 fail-closed，哨兵不存在——「未启动浏览器」是可证事实，不是形容词。
function runReplay(dir, files, { grantPath, ledgerRoot, batchToken = BATCH_TOKEN, uniqueName = `${BATCH_TOKEN}-case-1`, tag = 's' } = {}) {
  const sentinel = join(dir, `${tag}.sentinel`);
  const result = spawnSync(process.execPath,
    replayArgs(REPLAY, files, { grantPath, ledgerRoot, batchToken, uniqueName, out: join(dir, `${tag}.axes.json`) }),
    { encoding: 'utf8', timeout: 90000, env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel } });
  return { status: result.status, output: `${result.stdout}${result.stderr}`, launched: existsSync(sentinel) };
}

// ══ R1　结构授权边冒充回放票据 ══════════════════════════════════
await test('R1 结构件当 --replay-grant 传入 → 具名拒，不得被当票据放行', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r1-'));
  try {
    const files = layout(dir, b);
    writeFileSync(files.grant, b.authorityBytes);   // 票据位塞结构件本身
    const r = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: join(dir, 'ledger') });
    assert(r.launched === false, '越过浏览器前门：结构件被当票据放行到了 chromium.launch');
    assert(r.status === 65, `应浏览器前 exit 65，实际 ${r.status}`);
    assert(r.output.includes('REPLAY_GRANT_ARTIFACT_KIND_INVALID'),
      `拒因未具名件种不符（尾段：${r.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R2　回放面无票必拒，且拒因不被旧门吃掉 ══════════════════════
await test('R2 有结构件无票据 → exit 64 具名 --replay-grant，且拒因不是 batch-token', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r2-'));
  try {
    const files = layout(dir, b);
    const r = runReplay(dir, files, { ledgerRoot: join(dir, 'ledger') });
    assert(r.launched === false, '越过浏览器前门：无票也跑到了 chromium.launch');
    assert(r.status === 64, `应用参错误 exit 64，实际 ${r.status}`);
    assert(r.output.includes('replay-grant'), `拒因未具名 replay-grant（尾段：${r.output.slice(-240)}）`);
    assert(!r.output.includes('batch-token'),
      '拒因落在 batch-token 门上：新门次序不对（须排在 bin/replay.mjs:70-73 之后）');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R3b　回放票据反向进结构面签署边界 ═══════════════════════════
await test('R3b 回放票据喂 entity-authority created-workflow-freeze → 具名拒、不落件', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r3b-'));
  try {
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const out = join(dir, 'never-written.json');
    const r = spawnSync(process.execPath, [AUTHORITY, 'created-workflow-freeze', b.caseId,
      '--draft', files.grant, '--events', files.events, '--flow', files.flow,
      '--testcase', files.testcase, '--profile', files.profile, '--compile-provenance', files.provenance,
      '--audience', 'production', '--signer', 'Steven', '--signed-at', '2026-08-04T00:00:00.000Z',
      '--out', out], { encoding: 'utf8' });
    const output = `${r.stdout}${r.stderr}`;
    assert(r.status === 65, `应 exit 65，实际 ${r.status}`);
    // 只判「字节不一致」不够：那是通用拒因，件种错也会顺带命中，钉不出互不可冒充。
    assert(output.includes('REPLAY_GRANT_ARTIFACT_KIND_INVALID'),
      `拒因未具名件种不符（尾段：${output.slice(-240)}）`);
    assert(existsSync(out) === false, '拒了却落了件');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R8　票据 freeze 用当前精确字节重建草案再比对 ════════════════
await test('R8 replay-grant-freeze 草案与当前结构件字节不一致 → exit 65、不落件', async () => {
  const a = bundle(CASE_A);
  const b = bundle(CASE_B);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r8-'));
  try {
    const draftPath = join(dir, 'replay-grant.draft.json');
    const authorityB = join(dir, 'authority-b.json');
    writeFileSync(draftPath, json(makeGrantDraft(needGrant, { cases: [a] })));
    writeFileSync(authorityB, b.authorityBytes);
    const out = join(dir, 'never-written.json');
    const r = spawnSync(process.execPath, [AUTHORITY, 'replay-grant-freeze', BATCH_ID,
      '--draft', draftPath, '--case', a.caseId, '--authority', authorityB,
      '--audience', 'test', '--not-after', NOT_AFTER, '--grant-nonce', NONCE,
      '--signer', 'Steven', '--signed-at', '2026-08-04T00:00:00.000Z',
      '--out', out], { encoding: 'utf8' });
    assert(r.status === 65, `应 exit 65，实际 ${r.status}（${`${r.stdout}${r.stderr}`.slice(-240)}）`);
    assert(existsSync(out) === false, '拒了却落了件');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R9　notAfter 已过期 ═══════════════════════════════════════
await test('R9 票据已过 notAfter → 具名拒，哨兵证明未 launch', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r9-'));
  try {
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b], notAfter: '2020-01-01T00:00:00.000Z' }) });
    const r = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: join(dir, 'ledger') });
    assert(r.launched === false, '过期票据仍跑到 chromium.launch');
    assert(r.status === 65, `应浏览器前 exit 65，实际 ${r.status}`);
    assert(r.output.includes('REPLAY_GRANT_EXPIRED'), `拒因未具名过期（尾段：${r.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R10　先记再放行：到达 launch 点时 session 必须已在 ══════════
await test('R10 首成员到达哨兵点时 session 已落盘（先记再放行的可证伪面）', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r10-'));
  try {
    const ledger = join(dir, 'ledger');
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const r = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: ledger, tag: 's1' });
    // 断言第一进程**真的走到了**哨兵点（评审 L-new3：否则「已落盘」可能只是它压根没跑）
    assert(r.launched === true, `首成员未到达 launch 哨兵点（exit ${r.status}；${r.output.slice(-240)}）`);
    assert(r.status === 66, `到达哨兵应 exit 66，实际 ${r.status}`);
    // 「跑完再写」的实现必然在这里读不到 session——哨兵路径根本走不到事后写
    assert(existsSync(sessionPath(ledger)), '到达 launch 点时 session 不在场：占用没有发生在放行之前');
    const session = JSON.parse(readFileSync(sessionPath(ledger), 'utf8'));
    assert(session.batchToken === BATCH_TOKEN, `session 未绑本批 token：${session.batchToken}`);
    assert(existsSync(memberPath(ledger, b.caseId)), '成员消费标记未在 launch 前落盘');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R13　台账不可写 → 不放行（绝不先跑后补记）══════════════════
await test('R13 台账根不可写 → 具名拒、未 launch，绝不先跑后补记', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r13-'));
  try {
    // 拿一个**普通文件**当台账根：其下无法建目录，占用必然失败
    const blocked = join(dir, 'not-a-dir');
    writeFileSync(blocked, 'x');
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const r = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: blocked });
    assert(r.launched === false, '台账写不下去仍跑到 chromium.launch（先跑后补记的 fail-open）');
    assert(r.status === 65, `应浏览器前 exit 65，实际 ${r.status}`);
    assert(r.output.includes('REPLAY_GRANT_LEDGER_WRITE_FAILED'),
      `拒因未具名台账写失败（尾段：${r.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R14　同 nonce 异 batchToken → 重放，具名拒 ═════════════════
await test('R14 同一票据换 batchToken 再跑 → 具名拒（崩溃重跑不得自动复用）', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r14-'));
  try {
    const ledger = join(dir, 'ledger');
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const first = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: ledger, tag: 'a' });
    assert(first.launched === true, `首批未到达哨兵点（exit ${first.status}）`);
    // collect 崩溃重跑 = 新 batchToken；同一张票必须撞 session 异值而拒
    const second = runReplay(dir, files, {
      grantPath: files.grant, ledgerRoot: ledger, tag: 'b',
      batchToken: 'p9-batch-beta', uniqueName: 'p9-batch-beta-case-1',
    });
    assert(second.launched === false, '异 batchToken 仍跑到 chromium.launch');
    assert(second.status === 65, `应 exit 65，实际 ${second.status}`);
    assert(second.output.includes('REPLAY_GRANT_BATCH_SESSION_MISMATCH'),
      `拒因未具名批会话不符（尾段：${second.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R15　同成员二次 launch → 具名拒 ════════════════════════════
await test('R15 同批同成员第二次 launch → 具名拒、未 launch', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r15-'));
  try {
    const ledger = join(dir, 'ledger');
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const first = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: ledger, tag: 'a' });
    assert(first.launched === true, `首跑未到达哨兵点（exit ${first.status}）`);
    const again = runReplay(dir, files, { grantPath: files.grant, ledgerRoot: ledger, tag: 'b' });
    assert(again.launched === false, '同成员重跑仍到达 chromium.launch');
    assert(again.status === 65, `应 exit 65，实际 ${again.status}`);
    assert(again.output.includes('REPLAY_GRANT_MEMBER_ALREADY_CONSUMED'),
      `拒因未具名成员已消费（尾段：${again.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R16　同批第二成员必须放行（正控——否则整批跑不完）═══════════
await test('R16 同批第二成员同 batchToken → 放行到哨兵点（C-new 的正控）', async () => {
  const a = bundle(CASE_A);
  const b = bundle(CASE_B);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r16-'));
  try {
    const ledger = join(dir, 'ledger');
    const grantBytes = grantOf({ cases: [a, b] });     // 一张票授权两个成员
    const filesA = layout(dir, a, { grantBytes });
    const filesB = layout(dir, b, { grantBytes });
    const first = runReplay(dir, filesA, { grantPath: filesA.grant, ledgerRoot: ledger, tag: 'a' });
    assert(first.launched === true, `成员① 未到达哨兵点（exit ${first.status}；${first.output.slice(-200)}）`);
    assert(first.status === 66, `成员① 到达哨兵应 exit 66，实际 ${first.status}`);
    const second = runReplay(dir, filesB, {
      grantPath: filesB.grant, ledgerRoot: ledger, tag: 'b',
      uniqueName: `${BATCH_TOKEN}-case-2`,
    });
    assert(second.launched === true,
      `成员② 被误拒：一票一批的批会话协议没生效，整批跑不完（exit ${second.status}；${second.output.slice(-240)}）`);
    // 与 R10 对称：只看哨兵落盘不够，退出码必须也是「到达 launch 点」那一种
    assert(second.status === 66, `成员② 到达哨兵应 exit 66，实际 ${second.status}`);
    assert(existsSync(memberPath(ledger, a.caseId)) && existsSync(memberPath(ledger, b.caseId)),
      '两成员的消费标记未各自落盘');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R17　caseId 不在票据授权成员集内 → 具名拒 ═════════════════
await test('R17 成员不在票据授权成员集内 → 具名拒、未 launch', async () => {
  const a = bundle(CASE_A);
  const b = bundle(CASE_B);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r17-'));
  try {
    const ledger = join(dir, 'ledger');
    const grantBytes = grantOf({ cases: [a] });        // 票据只授权 A
    const filesB = layout(dir, b, { grantBytes });     // 却拿去跑 B
    const r = runReplay(dir, filesB, { grantPath: filesB.grant, ledgerRoot: ledger, uniqueName: `${BATCH_TOKEN}-case-2` });
    assert(r.launched === false, '未授权成员仍跑到 chromium.launch');
    assert(r.status === 65, `应 exit 65，实际 ${r.status}`);
    assert(r.output.includes('REPLAY_GRANT_CASE_NOT_AUTHORIZED'),
      `拒因未具名成员未授权（尾段：${r.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R18　真并发：两进程抢同一成员标记，操作系统保证单胜者 ═══════
await test('R18 两进程并发抢同一成员 → 恰一个到达哨兵点（wx 原子独占，非串行）', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r18-'));
  try {
    const ledger = join(dir, 'ledger');
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const launch = (tag) => new Promise((done) => {
      const sentinel = join(dir, `${tag}.sentinel`);
      const child = spawn(process.execPath,
        replayArgs(REPLAY, files, {
          grantPath: files.grant, ledgerRoot: ledger,
          batchToken: BATCH_TOKEN, uniqueName: `${BATCH_TOKEN}-case-1`, out: join(dir, `${tag}.axes.json`),
        }),
        { env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel }, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', (d) => { output += d; });
      child.stderr.on('data', (d) => { output += d; });
      child.on('close', (status) => done({ status, output, launched: existsSync(sentinel) }));
    });
    const [x, y] = await Promise.all([launch('p1'), launch('p2')]);
    const winners = [x, y].filter((r) => r.launched === true);
    const losers = [x, y].filter((r) => r.launched === false);
    assert(winners.length === 1,
      `并发下到达 launch 点的进程数应恰为 1，实际 ${winners.length}——check-and-set 不是原子的（读后写会双放行）`);
    assert(losers.length === 1 && losers[0].status === 65,
      `败者应浏览器前 exit 65，实际 ${losers[0]?.status}`);
    assert(losers[0].output.includes('REPLAY_GRANT_MEMBER_ALREADY_CONSUMED'),
      `败者拒因未具名成员已消费（尾段：${losers[0].output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ══ R19　双旗标棘轮的另半边：有票无台账同样必拒 ═════════════════
// R2 钉的是「有结构件无票据」；这条钉「有票据无台账根」。两条合起来才是
// 「双旗标同为必填、不可缺其一」——只钉一边，实现可以把 ledger 做成可选，C2 当场回潮。
await test('R19 有 --replay-grant 但无 --replay-grant-ledger → exit 64 具名，未 launch', async () => {
  const b = bundle(CASE_A);
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-r19-'));
  try {
    const files = layout(dir, b, { grantBytes: grantOf({ cases: [b] }) });
    const r = runReplay(dir, files, { grantPath: files.grant });   // 故意不给 ledgerRoot
    assert(r.launched === false, '缺台账根仍跑到 chromium.launch（台账被做成可选=C2 回潮）');
    assert(r.status === 64, `应用参错误 exit 64，实际 ${r.status}`);
    assert(r.output.includes('replay-grant-ledger'),
      `拒因未具名 replay-grant-ledger（尾段：${r.output.slice(-240)}）`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log(`p9-replay-authority-split-cli-session: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;

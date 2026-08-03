#!/usr/bin/env node
// 实体锁显式换签：真实 sign 子进程 + 本地文件事务；禁止 SUT、浏览器、server、网络与凭据。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildEntityBindingsDraft } from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';
import { parseSignArgs } from '../../lib/sign-cli-args.mjs';
import { TOOLS } from '../../mcp/casey-server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const SECTION = process.argv[2] || 'all';
const SECTIONS = new Set(['all', 'surface', 'success', 'anti-clobber', 'journal', 'recovery']);
if (!SECTIONS.has(SECTION)) process.exit(2);

const failures = [];
let passed = 0;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) {
    const message = `${name}: ${String(error?.message || error)}`;
    failures.push(message); console.error(`FAIL ${message}`);
  }
}

let serial = 0;
function prepareCase(label) {
  serial += 1;
  const caseId = `tc_lock_resign_${label}_${process.pid}_${serial}`;
  const caseDir = join(ROOT, 'cases', caseId);
  const archiveDir = join(caseDir, 'archive');
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  mkdirSync(caseDir, { recursive: true });
  const events = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow',
    recordedAt: '2026-08-03T01:00:00.000Z', compiledBy: 'entity-lock-resign-golden', authored: false,
    events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', action: 'click', text: 'create' }],
  };
  const eventsText = jsonText(events);
  const provenance = [{
    stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create',
    sourceIntentId: 'intent_1', candidateId: 'candidate-workflow-main', role: 'subject',
  }];
  const binding = buildEntityBindingsDraft({ eventsBytes: Buffer.from(eventsText), eventsDocument: events, provenance });
  assert(binding.ok === true, `fixture binding draft 失败 ${binding.reason}`);
  const receipt = createEntityLockReceipt({
    lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing',
    scopeFingerprint: 'sha256:entity-lock-resign-golden-scope',
    expected: { name: '工作流甲', code: 'WF-A' }, observed: { name: '工作流甲', code: 'WF-A' },
    source: 'user-confirmed',
  });
  const paths = {
    caseId, caseDir, archiveDir, prd: prdPath,
    draft: join(caseDir, 'expected.draft.json'), events: join(caseDir, 'events.json'),
    bindings: join(caseDir, 'entity-bindings.draft.json'), confirmations: join(caseDir, 'entity-confirmations.json'),
    frozen: join(caseDir, 'expected.frozen.json'), locks: join(caseDir, 'entity-locks.frozen.json'),
    revocations: join(archiveDir, 'entity-locks.revocations.jsonl'),
  };
  writeFileSync(paths.draft, jsonText({
    caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [],
  }));
  writeFileSync(paths.events, eventsText);
  writeFileSync(paths.bindings, jsonText(binding.draft));
  writeFileSync(paths.confirmations, jsonText({ caseId, confirmations: provenance.map((row) => ({ ...row, receipt })) }));
  writeFileSync(paths.prd, jsonText({ schemaVersion: 1, caseId, task: 'entity lock resign fixture', testChecksums: {}, stories: [] }));
  const first = runSign(paths, '2026-08-03T01:00:00.000Z');
  assert(first.status === 0, `fixture 首签失败 ${first.status}: ${first.stderr}`);
  return {
    ...paths,
    oldLocksText: readFileSync(paths.locks, 'utf8'), oldFrozenText: readFileSync(paths.frozen, 'utf8'),
    oldPrdText: readFileSync(paths.prd, 'utf8'),
  };
}

function signArgv(fixture, signedAt, extra = []) {
  return [SIGN, fixture.caseId,
    '--draft', fixture.draft, '--prd', fixture.prd, '--frozen-out', fixture.frozen,
    '--signer', 'golden-human', '--against-build', 'golden-build', '--signed-at', signedAt,
    '--events', fixture.events, '--entity-bindings-draft', fixture.bindings,
    '--entity-confirmations', fixture.confirmations, '--entity-locks-out', fixture.locks,
    '--audience', 'test', '--archive-dir', fixture.archiveDir, ...extra];
}
function runSign(fixture, signedAt, extra = []) {
  return spawnSync(process.execPath, signArgv(fixture, signedAt, extra), { cwd: ROOT, encoding: 'utf8' });
}
function cleanup(fixture) {
  if (!fixture) return;
  rmSync(fixture.caseDir, { recursive: true, force: true });
  rmSync(fixture.prd, { force: true });
}
function resign(fixture, signedAt = '2026-08-03T02:00:00.000Z', extra = []) {
  return runSign(fixture, signedAt, ['--resign', '--resign-entity-locks', ...extra]);
}
function entityArchivePath(fixture, oldText = fixture.oldLocksText) {
  return join(fixture.archiveDir, `entity-locks.frozen.${fixture.caseId}.${sha(oldText)}.json`);
}

test('surface', 'R1 direct CLI 与 MCP 都显式暴露 resignEntityLocks', () => {
  const parsed = parseSignArgs(['tc', '--resign-entity-locks']);
  assert(parsed.invalidFlags.length === 0 && parsed['resign-entity-locks'] === true, 'direct CLI 未登记 --resign-entity-locks');
  const tool = TOOLS.find((row) => row.name === 'casey_sign');
  assert(tool?.inputSchema?.properties?.resignEntityLocks?.type === 'boolean', 'MCP schema 缺 resignEntityLocks');
  const argv = tool.toArgs({
    caseId: 'tc', draft: 'draft', prd: 'prd', frozenOut: 'frozen', signer: 'human', againstBuild: 'build',
    resign: true, resignEntityLocks: true,
  });
  assert(argv.includes('--resign') && argv.includes('--resign-entity-locks'), 'MCP argv 未保真双显式旗标');
});

test('anti-clobber', 'R2 旧锁无专用旗标、缺 --resign、首次发布误带均零落盘拒绝', () => {
  let fixture;
  try {
    fixture = prepareCase('flags');
    const before = [readFileSync(fixture.frozen, 'utf8'), readFileSync(fixture.locks, 'utf8'), readFileSync(fixture.prd, 'utf8')];
    const absent = runSign(fixture, '2026-08-03T02:00:00.000Z', ['--resign']);
    assert(absent.status === 65, `旧锁无专用旗标应 exit 65，实际 ${absent.status}`);
    const noExpectedResign = runSign(fixture, '2026-08-03T02:00:00.000Z', ['--resign-entity-locks']);
    assert(noExpectedResign.status === 65, `缺 --resign 应 exit 65，实际 ${noExpectedResign.status}`);
    assert(JSON.stringify(before) === JSON.stringify([
      readFileSync(fixture.frozen, 'utf8'), readFileSync(fixture.locks, 'utf8'), readFileSync(fixture.prd, 'utf8'),
    ]), '旗标拒绝后权威字节变化');

    rmSync(fixture.locks, { force: true });
    const prd = JSON.parse(readFileSync(fixture.prd, 'utf8'));
    delete prd.testChecksums[`cases/${fixture.caseId}/entity-locks.frozen.json`];
    writeFileSync(fixture.prd, jsonText(prd));
    const firstMisuse = resign(fixture);
    assert(firstMisuse.status === 65 && /首次发布|旧锁不存在/.test(firstMisuse.stderr), '首次发布误带专用旗标未具名拒绝');
  } finally { cleanup(fixture); }
});

test('anti-clobber', 'R3 旧 PRD checksum 缺失、畸形或与旧锁不符时零落盘拒绝', () => {
  for (const [label, mutate] of [
    ['missing', (prd, key) => { delete prd.testChecksums[key]; }],
    ['shape', (prd, key) => { prd.testChecksums[key] = 'ABC'; }],
    ['mismatch', (prd, key) => { prd.testChecksums[key] = 'f'.repeat(64); }],
  ]) {
    let fixture;
    try {
      fixture = prepareCase(`prd_${label}`);
      const beforeLocks = readFileSync(fixture.locks, 'utf8');
      const prd = JSON.parse(readFileSync(fixture.prd, 'utf8'));
      mutate(prd, `cases/${fixture.caseId}/entity-locks.frozen.json`);
      writeFileSync(fixture.prd, jsonText(prd));
      const beforePrd = readFileSync(fixture.prd, 'utf8');
      const result = resign(fixture);
      assert(result.status === 65 && /旧 PRD.*entity-locks checksum/.test(result.stderr), `${label} 未具名拒绝: ${result.stderr}`);
      assert(readFileSync(fixture.locks, 'utf8') === beforeLocks && readFileSync(fixture.prd, 'utf8') === beforePrd, `${label} 拒绝后落盘`);
      assert(!existsSync(fixture.revocations), `${label} 拒绝仍创建撤销 journal`);
    } finally { cleanup(fixture); }
  }
});

test('success', 'R4 合法换签归档旧锁、追加撤销记录并令 PRD 指向新锁', () => {
  let fixture;
  try {
    fixture = prepareCase('success');
    const oldHash = sha(fixture.oldLocksText);
    const result = resign(fixture);
    assert(result.status === 0, `合法实体锁换签失败 ${result.status}: ${result.stderr}`);
    const newLocksText = readFileSync(fixture.locks, 'utf8');
    const newHash = sha(newLocksText);
    assert(newHash !== oldHash, '新旧实体锁 hash 未换代');
    const archive = entityArchivePath(fixture);
    assert(readFileSync(archive, 'utf8') === fixture.oldLocksText, '旧实体锁归档不是原始字节');
    const lines = readFileSync(fixture.revocations, 'utf8').trimEnd().split('\n');
    assert(lines.length === 1, '首次换签撤销 journal 非一行');
    const row = JSON.parse(lines[0]);
    assert(row.schemaVersion === 1 && row.artifactKind === 'entity-lock-revocation', '撤销记录形状错');
    assert(row.caseId === fixture.caseId && row.revokedEntityLocksSha256 === oldHash
      && row.successorEntityLocksSha256 === newHash, '撤销记录未绑定新旧锁');
    assert(row.signedAt === '2026-08-03T02:00:00.000Z' && row.signedAgainstBuild === 'golden-build'
      && row.signerId === 'golden-human', '撤销记录未绑定签署输入');
    const prd = JSON.parse(readFileSync(fixture.prd, 'utf8'));
    assert(prd.testChecksums[`cases/${fixture.caseId}/entity-locks.frozen.json`] === newHash, 'PRD 未指向新锁 hash');
  } finally { cleanup(fixture); }
});

test('journal', 'R5 既有撤销 journal 逐字节保留追加；畸形与冲突记录拒绝', () => {
  let fixture;
  try {
    fixture = prepareCase('append');
    assert(resign(fixture).status === 0, '第一代换签失败');
    const firstJournal = readFileSync(fixture.revocations, 'utf8');
    const secondOldLocks = readFileSync(fixture.locks, 'utf8');
    const second = resign(fixture, '2026-08-03T03:00:00.000Z');
    assert(second.status === 0, `第二代换签失败 ${second.status}: ${second.stderr}`);
    const appended = readFileSync(fixture.revocations, 'utf8');
    assert(appended.startsWith(firstJournal) && appended.split('\n').filter(Boolean).length === 2, '旧 journal 字节未原样保留追加');
    assert(readFileSync(entityArchivePath(fixture, secondOldLocks), 'utf8') === secondOldLocks, '第二代旧锁未内容寻址归档');
  } finally { cleanup(fixture); }

  for (const [label, text] of [
    ['malformed', '{bad}\n'],
    ['unterminated', JSON.stringify({ schemaVersion: 1 })],
  ]) {
    let bad;
    try {
      bad = prepareCase(`journal_${label}`); mkdirSync(bad.archiveDir, { recursive: true });
      writeFileSync(bad.revocations, text);
      const before = readFileSync(bad.prd, 'utf8');
      const denied = resign(bad);
      assert(denied.status === 65 && /撤销 journal/.test(denied.stderr), `${label} journal 未具名拒绝`);
      assert(readFileSync(bad.prd, 'utf8') === before && readFileSync(bad.locks, 'utf8') === bad.oldLocksText, `${label} 拒绝仍改 authority`);
    } finally { cleanup(bad); }
  }
});

test('recovery', 'R6 archive/journal/new locks 已到而 PRD 未到时同输入恢复，异输入拒绝', () => {
  let fixture;
  try {
    fixture = prepareCase('recover');
    const signedAt = '2026-08-03T02:00:00.000Z';
    const completed = resign(fixture, signedAt);
    assert(completed.status === 0, `恢复夹具首轮换签失败 ${completed.status}: ${completed.stderr}`);
    const newPrdText = readFileSync(fixture.prd, 'utf8');
    const expectedArchive = readdirSync(fixture.archiveDir)
      .filter((name) => name.startsWith(`expected.frozen.${fixture.caseId}.`) && name.endsWith('.json'))
      .map((name) => join(fixture.archiveDir, name));
    assert(expectedArchive.length === 1, 'expected archive 非唯一');
    const entityArchive = entityArchivePath(fixture);
    const writes = [expectedArchive[0], entityArchive, fixture.revocations, fixture.frozen, fixture.locks, fixture.prd]
      .map((path) => ({ path: resolve(path), text: readFileSync(path, 'utf8') }));
    writeFileSync(fixture.prd, fixture.oldPrdText);
    const publicationJournal = `${resolve(fixture.locks)}.publish.json`;
    writeFileSync(publicationJournal, JSON.stringify({
      schemaVersion: 1, artifactKind: 'casey-sign-publication', signedAt,
      authorityTargetHash: sha(resolve(fixture.prd)),
      entries: writes.map((row) => ({ targetHash: sha(row.path), contentHash: sha(row.text) })),
    }) + '\n');

    const originalDraft = readFileSync(fixture.draft, 'utf8');
    const changedDraft = JSON.parse(originalDraft);
    changedDraft.intents[0].expected[0].value = 'changed-ready';
    writeFileSync(fixture.draft, jsonText(changedDraft));
    const mismatch = resign(fixture, signedAt);
    assert(mismatch.status !== 0 && existsSync(publicationJournal), '异输入恢复被放行或 journal 被删');
    writeFileSync(fixture.draft, originalDraft);
    const recovered = resign(fixture, signedAt);
    assert(recovered.status === 0, `同输入恢复失败 ${recovered.status}: ${recovered.stderr}`);
    assert(!existsSync(publicationJournal) && readFileSync(fixture.prd, 'utf8') === newPrdText, '恢复未以 PRD 最后收口');
  } finally { cleanup(fixture); }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-lock-resign-revocation: ${failure}`);
  console.error(`RED  entity-lock-resign-revocation/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-lock-resign-revocation/${SECTION}: ${passed}/${passed} 全过（本地文件事务，零 SUT）`);

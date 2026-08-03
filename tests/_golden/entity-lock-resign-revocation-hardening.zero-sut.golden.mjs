#!/usr/bin/env node
// 评审加固：纯入口矩阵 + 撤销 fork + 真实 CLI 内容寻址 archive 冲突；零 SUT/浏览器/server/网络。

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEntityBindingsDraft } from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';
import { parseEntityLockRevocationJournal } from '../../lib/entity-lock-resign.mjs';
import { resolveSignResignSurface } from '../../lib/sign-resign-surface.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const matrix = [
  [{ resignEntityLocks: true }, false, 'ENTITY_LOCK_RESIGN_REQUIRES_BUNDLE'],
  [{ resignEntityLocks: true, hasEntityLocksBundle: true, entityLocksExist: true }, false, 'ENTITY_LOCK_RESIGN_REQUIRES_EXPECTED_RESIGN'],
  [{ resign: true, hasEntityLocksBundle: true, entityLocksExist: true }, false, 'ENTITY_LOCK_RESIGN_EXPLICIT_FLAG_REQUIRED'],
  [{ resign: true, resignEntityLocks: true, hasEntityLocksBundle: true }, false, 'ENTITY_LOCK_RESIGN_OLD_LOCK_MISSING'],
  [{ frozenExists: true }, false, 'EXPECTED_RESIGN_EXPLICIT_FLAG_REQUIRED'],
  [{ resign: true, resignEntityLocks: true, hasEntityLocksBundle: true, entityLocksExist: true }, true, 'entity-lock-resign'],
  [{ resign: true, resignEntityLocks: true, hasEntityLocksBundle: true, entityLocksExist: true, hasRecoveryJournal: true, journalHasExpectedArchive: true, journalHasEntityRevocation: true }, true, 'recover-entity-lock-resign'],
  [{ resign: true, resignEntityLocks: true, hasEntityLocksBundle: true, entityLocksExist: true, hasRecoveryJournal: true, journalHasExpectedArchive: true, journalHasEntityRevocation: false }, false, 'ENTITY_LOCK_RESIGN_RECOVERY_MODE_MISMATCH'],
];
for (const [input, expectedOk, marker] of matrix) {
  const result = resolveSignResignSurface(input);
  assert(result.ok === expectedOk && (expectedOk ? result.mode : result.reason) === marker, `入口矩阵漂移 ${marker}`);
}
console.log(`ok   H1 重签入口矩阵 ${matrix.length}/${matrix.length}`);

const revoked = 'a'.repeat(64);
const base = {
  schemaVersion: 1, artifactKind: 'entity-lock-revocation', caseId: 'tc_fork',
  revokedEntityLocksSha256: revoked, successorEntityLocksSha256: 'b'.repeat(64),
  signedAt: '2026-08-03T00:00:00.000Z', signedAgainstBuild: 'build', signerId: 'human',
};
const fork = parseEntityLockRevocationJournal(`${JSON.stringify(base)}\n${JSON.stringify({ ...base, successorEntityLocksSha256: 'c'.repeat(64) })}\n`);
assert(fork.ok === false && fork.reason === 'ENTITY_LOCK_REVOCATION_JOURNAL_FORK', '同旧 hash 分叉 successor 未拒绝');
const duplicate = parseEntityLockRevocationJournal(`${JSON.stringify(base)}\n${JSON.stringify(base)}\n`);
assert(duplicate.ok === false && duplicate.reason === 'ENTITY_LOCK_REVOCATION_JOURNAL_DUPLICATE_GENERATION', '重复代际未拒绝');
console.log('ok   H2 撤销 journal fork/duplicate fail-closed');

const caseId = `tc_lock_archive_conflict_${process.pid}`;
const caseDir = join(ROOT, 'cases', caseId);
const archiveDir = join(caseDir, 'archive');
const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
try {
  mkdirSync(caseDir, { recursive: true });
  const events = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow',
    recordedAt: '2026-08-03T01:00:00.000Z', compiledBy: 'lock-resign-hardening', authored: false,
    events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', action: 'click', text: 'create' }],
  };
  const eventsText = jsonText(events);
  const provenance = [{
    stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', sourceIntentId: 'intent_1',
    candidateId: 'candidate-workflow-main', role: 'subject',
  }];
  const binding = buildEntityBindingsDraft({ eventsBytes: Buffer.from(eventsText), eventsDocument: events, provenance });
  assert(binding.ok === true, `binding fixture ${binding.reason}`);
  const receipt = createEntityLockReceipt({
    lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing',
    scopeFingerprint: 'sha256:lock-resign-hardening', expected: { name: 'A', code: 'WF-A' },
    observed: { name: 'A', code: 'WF-A' }, source: 'user-confirmed',
  });
  const paths = {
    draft: join(caseDir, 'expected.draft.json'), events: join(caseDir, 'events.json'),
    bindings: join(caseDir, 'entity-bindings.draft.json'), confirmations: join(caseDir, 'entity-confirmations.json'),
    frozen: join(caseDir, 'expected.frozen.json'), locks: join(caseDir, 'entity-locks.frozen.json'),
  };
  writeFileSync(paths.draft, jsonText({ caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [] }));
  writeFileSync(paths.events, eventsText);
  writeFileSync(paths.bindings, jsonText(binding.draft));
  writeFileSync(paths.confirmations, jsonText({ caseId, confirmations: provenance.map((row) => ({ ...row, receipt })) }));
  writeFileSync(prdPath, jsonText({ schemaVersion: 1, caseId, task: 'archive conflict', testChecksums: {}, stories: [] }));
  const argv = (signedAt, extra = []) => [SIGN, caseId,
    '--draft', paths.draft, '--prd', prdPath, '--frozen-out', paths.frozen,
    '--signer', 'golden-human', '--against-build', 'golden-build', '--signed-at', signedAt,
    '--events', paths.events, '--entity-bindings-draft', paths.bindings,
    '--entity-confirmations', paths.confirmations, '--entity-locks-out', paths.locks,
    '--audience', 'test', '--archive-dir', archiveDir, ...extra];
  const first = spawnSync(process.execPath, argv('2026-08-03T01:00:00.000Z'), { cwd: ROOT, encoding: 'utf8' });
  assert(first.status === 0, `首签失败 ${first.status}: ${first.stderr}`);
  const oldLocks = readFileSync(paths.locks, 'utf8');
  const oldPrd = readFileSync(prdPath, 'utf8');
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(join(archiveDir, `entity-locks.frozen.${caseId}.${sha(oldLocks)}.json`), 'wrong-audit-bytes\n');
  const denied = spawnSync(process.execPath, argv('2026-08-03T02:00:00.000Z', ['--resign', '--resign-entity-locks']), { cwd: ROOT, encoding: 'utf8' });
  assert(denied.status === 65 && /archive 已存在但字节不一致/.test(denied.stderr), `archive 冲突未具名拒绝 ${denied.status}: ${denied.stderr}`);
  assert(readFileSync(paths.locks, 'utf8') === oldLocks && readFileSync(prdPath, 'utf8') === oldPrd, 'archive 冲突拒绝后 authority 变化');
  console.log('ok   H3 内容寻址 archive 同名异字节零落盘拒绝');
} finally {
  rmSync(caseDir, { recursive: true, force: true });
  rmSync(prdPath, { force: true });
}

console.log('ok   entity-lock-resign-revocation-hardening: 入口矩阵/fork/archive conflict 全过（零 SUT）');

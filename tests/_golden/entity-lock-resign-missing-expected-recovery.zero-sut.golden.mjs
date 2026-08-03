#!/usr/bin/env node
// 终审补钉：旧 expected 缺失但旧实体锁存在时，实体锁换签的 late-interrupt 必须可同输入恢复。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEntityBindingsDraft } from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const caseId = `tc_lock_resign_missing_expected_${process.pid}`;
const caseDir = join(ROOT, 'cases', caseId);
const archiveDir = join(caseDir, 'archive');
const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);

try {
  mkdirSync(caseDir, { recursive: true });
  const paths = {
    draft: join(caseDir, 'expected.draft.json'),
    events: join(caseDir, 'events.json'),
    bindings: join(caseDir, 'entity-bindings.draft.json'),
    confirmations: join(caseDir, 'entity-confirmations.json'),
    frozen: join(caseDir, 'expected.frozen.json'),
    locks: join(caseDir, 'entity-locks.frozen.json'),
    revocations: join(archiveDir, 'entity-locks.revocations.jsonl'),
  };
  const events = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow',
    recordedAt: '2026-08-03T01:00:00.000Z', compiledBy: 'missing-expected-recovery-golden', authored: false,
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
    scopeFingerprint: 'sha256:missing-expected-recovery', expected: { name: 'A', code: 'WF-A' },
    observed: { name: 'A', code: 'WF-A' }, source: 'user-confirmed',
  });
  writeFileSync(paths.draft, jsonText({
    caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [],
  }));
  writeFileSync(paths.events, eventsText);
  writeFileSync(paths.bindings, jsonText(binding.draft));
  writeFileSync(paths.confirmations, jsonText({ caseId, confirmations: provenance.map((row) => ({ ...row, receipt })) }));
  writeFileSync(prdPath, jsonText({ schemaVersion: 1, caseId, task: 'missing expected recovery', testChecksums: {}, stories: [] }));
  const argv = (signedAt, extra = []) => [SIGN, caseId,
    '--draft', paths.draft, '--prd', prdPath, '--frozen-out', paths.frozen,
    '--signer', 'golden-human', '--against-build', 'golden-build', '--signed-at', signedAt,
    '--events', paths.events, '--entity-bindings-draft', paths.bindings,
    '--entity-confirmations', paths.confirmations, '--entity-locks-out', paths.locks,
    '--audience', 'test', '--archive-dir', archiveDir, ...extra];
  const run = (signedAt, extra = []) => spawnSync(process.execPath, argv(signedAt, extra), { cwd: ROOT, encoding: 'utf8' });

  const first = run('2026-08-03T01:00:00.000Z');
  assert(first.status === 0, `首签失败 ${first.status}: ${first.stderr}`);
  const oldLocksText = readFileSync(paths.locks, 'utf8');
  const oldPrdText = readFileSync(prdPath, 'utf8');
  rmSync(paths.frozen);

  const signedAt = '2026-08-03T02:00:00.000Z';
  const completed = run(signedAt, ['--resign', '--resign-entity-locks']);
  assert(completed.status === 0, `无旧 expected 的合法实体锁换签失败 ${completed.status}: ${completed.stderr}`);
  const entityArchive = join(archiveDir, `entity-locks.frozen.${caseId}.${sha(oldLocksText)}.json`);
  const newPrdText = readFileSync(prdPath, 'utf8');
  const writes = [entityArchive, paths.revocations, paths.frozen, paths.locks, prdPath]
    .map((path) => ({ path: resolve(path), text: readFileSync(path, 'utf8') }));
  writeFileSync(prdPath, oldPrdText);
  const publicationJournal = `${resolve(paths.locks)}.publish.json`;
  writeFileSync(publicationJournal, jsonText({
    schemaVersion: 1, artifactKind: 'casey-sign-publication', signedAt,
    authorityTargetHash: sha(resolve(prdPath)),
    entries: writes.map((row) => ({ targetHash: sha(row.path), contentHash: sha(row.text) })),
  }));

  const recovered = run(signedAt, ['--resign', '--resign-entity-locks']);
  assert(recovered.status === 0, `无旧 expected late-interrupt 同输入恢复失败 ${recovered.status}: ${recovered.stderr}`);
  assert(readFileSync(prdPath, 'utf8') === newPrdText, '恢复没有以新 PRD authority 收口');
  assert(!existsSync(publicationJournal), '恢复成功后 publication journal 未删除');
  assert(readFileSync(entityArchive, 'utf8') === oldLocksText, '恢复改写了内容寻址旧锁 archive');
  console.log('ok   entity-lock-resign-missing-expected-recovery: late-interrupt 同输入恢复（零 SUT）');
} finally {
  rmSync(caseDir, { recursive: true, force: true });
  rmSync(prdPath, { force: true });
}

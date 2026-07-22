// real-uat-attestation 确认件（uatDefinition ② 前置）：draft.bindings → 实体锁收据（user-confirmed，
// Steven D1/D2=A 授权链）。code/platformId 用真机观察件读回值（尖峰结论③的兑现——不再用待办标记）。
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';
import { freezeEntityBindingsDraft } from '../../lib/entity-semantic-lock-preflight.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const CASE = 'tc_agent_id_readback_real_uat_v1';
const DIR = join(ROOT, 'cases', CASE);

const draft = JSON.parse(readFileSync(join(DIR, 'entity-bindings.draft.json'), 'utf8'));
const eventsBytes = readFileSync(join(DIR, 'events.json'));
const eventsDocument = JSON.parse(eventsBytes.toString('utf8'));
const obs = JSON.parse(readFileSync(join(DIR, 'identity-observations.compile.json'), 'utf8'));
const row = obs.observations[0];
if (!row || row.kind !== 'agent') { console.error('观察件缺 agent 行'); process.exit(1); }

const scope = `sha256:${createHash('sha256').update('heren-aimanagement-agent-list-scope').digest('hex')}`;
const receipt = createEntityLockReceipt({
  lockId: 'lock-agent-uat-x', kind: 'agent', bindingMode: 'existing', scopeFingerprint: scope,
  expected: { name: row.name, code: row.code },
  observed: { name: row.name, code: row.code, platformId: row.platformId },
  source: 'user-confirmed',
});
const confirmations = draft.bindings.map((r) => ({ ...r, receipt }));
writeFileSync(join(DIR, 'entity-confirmations.json'), JSON.stringify({ caseId: CASE, confirmations }, null, 2) + '\n');

// 纯函数预验（sign 同一入口，防签署时被拒）
const frozen = freezeEntityBindingsDraft({
  caseId: CASE, eventsBytes, eventsDocument, draft,
  confirmations, signerId: 'Steven', signedAt: new Date().toISOString(), audience: 'production',
  identityObservations: obs.observations.map((r) => ({
    name: r.name, code: r.code, platformId: r.platformId, sourceIntentId: r.sourceIntentId,
    candidateId: r.candidateId, role: r.role, atom: r.atom, evidenceStepId: r.evidenceStepId,
  })),
});
console.log('freeze dry-run ok:', frozen?.ok === true, '| replayReady:', frozen?.artifact?.replayReady);
if (frozen?.ok !== true) { console.error('reason:', frozen?.reason); process.exit(1); }
console.log('bindings rows:', frozen.artifact.bindings.length, '| CONFIRM-OK');

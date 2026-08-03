// 未完成 sign publication 中实体锁换签目标的确定性重建。

import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import {
  buildVerifiedEntityLockResignPlans,
  parseEntityLockRevocationJournal,
} from './entity-lock-resign.mjs';
import { recoverJournalBoundArtifact } from './sign-resign-recovery.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const denied = (reason) => Object.freeze({ ok: false, reason });

export function recoverEntityLockResignPlans({
  caseId, archiveDir, newLocksText, signedAt, signedAgainstBuild, signerId, recoveryJournal,
} = {}) {
  if (typeof caseId !== 'string' || typeof archiveDir !== 'string' || typeof newLocksText !== 'string'
    || !recoveryJournal || !Array.isArray(recoveryJournal.entries)) return denied('ENTITY_LOCK_RESIGN_RECOVERY_INPUT_INVALID');
  const escaped = caseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^entity-locks\\.frozen\\.${escaped}\\.([0-9a-f]{64})\\.json(?:\\.tmp)?$`);
  const recoveredArchive = recoverJournalBoundArtifact({
    journal: recoveryJournal,
    archiveDir,
    mapArchiveName: (name) => {
      const match = name.match(pattern);
      if (!match) return null;
      return { targetName: name.endsWith('.tmp') ? name.slice(0, -4) : name, expectedContentHash: match[1] };
    },
  });
  if (!recoveredArchive.ok) return denied('ENTITY_LOCK_RESIGN_RECOVERY_ARCHIVE_NOT_UNIQUE');
  const archive = { ...recoveredArchive.plan, oldHash: sha(recoveredArchive.plan.text) };
  const revocationsPath = join(archiveDir, 'entity-locks.revocations.jsonl');
  const recoveredRevocations = recoverJournalBoundArtifact({
    journal: recoveryJournal,
    archiveDir,
    mapArchiveName: (name) => {
      const targetName = name.endsWith('.tmp') ? name.slice(0, -4) : name;
      return targetName === basename(revocationsPath) ? { targetName } : null;
    },
  });
  if (!recoveredRevocations.ok) return denied('ENTITY_LOCK_RESIGN_RECOVERY_REVOCATION_NOT_UNIQUE');
  const desiredRevocations = recoveredRevocations.plan.text;
  const parsed = parseEntityLockRevocationJournal(desiredRevocations);
  if (!parsed.ok || parsed.rows.length === 0) return denied('ENTITY_LOCK_RESIGN_RECOVERY_REVOCATION_INVALID');
  const last = parsed.rows.at(-1);
  const newHash = sha(newLocksText);
  if (last.caseId !== caseId || last.revokedEntityLocksSha256 !== archive.oldHash
    || last.successorEntityLocksSha256 !== newHash || last.signedAt !== signedAt
    || last.signedAgainstBuild !== signedAgainstBuild || last.signerId !== signerId) {
    return denied('ENTITY_LOCK_RESIGN_RECOVERY_REVOCATION_INPUT_MISMATCH');
  }
  const withoutTerminalNewline = desiredRevocations.slice(0, -1);
  const lastLineBreak = withoutTerminalNewline.lastIndexOf('\n');
  const priorText = lastLineBreak < 0 ? '' : desiredRevocations.slice(0, lastLineBreak + 1);
  const rebuilt = buildVerifiedEntityLockResignPlans({
    caseId,
    oldLocksText: archive.text,
    newLocksText,
    verifiedOldHash: archive.oldHash,
    archiveDir,
    signedAt,
    signedAgainstBuild,
    signerId,
    revocationsText: priorText,
  });
  if (!rebuilt.ok || resolve(rebuilt.archivePlan.path) !== resolve(archive.path)
    || rebuilt.archivePlan.text !== archive.text || rebuilt.revocationPlan.text !== desiredRevocations) {
    return denied('ENTITY_LOCK_RESIGN_RECOVERY_REBUILD_MISMATCH');
  }
  return Object.freeze({ ok: true, reason: null, archivePlan: rebuilt.archivePlan, revocationPlan: rebuilt.revocationPlan });
}

// sign 重签入口矩阵：把 CLI 旗标、既存目标与 recovery journal 收敛成单一模式。

const denied = (reason, exitCode = 65) => Object.freeze({ ok: false, reason, exitCode });

export function classifySignRecoveryJournalTargets({
  entries, frozenTargetHash, entityRevocationTargetHash,
} = {}) {
  if (!Array.isArray(entries) || !/^[0-9a-f]{64}$/.test(frozenTargetHash || '')
    || !/^[0-9a-f]{64}$/.test(entityRevocationTargetHash || '')) {
    return denied('SIGN_RECOVERY_JOURNAL_TARGET_SET_INVALID');
  }
  const frozenIndexes = [];
  const revocationIndexes = [];
  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index]?.targetHash === frozenTargetHash) frozenIndexes.push(index);
    if (entries[index]?.targetHash === entityRevocationTargetHash) revocationIndexes.push(index);
  }
  if (frozenIndexes.length !== 1 || revocationIndexes.length > 1) {
    return denied('SIGN_RECOVERY_JOURNAL_TARGET_SET_INVALID');
  }
  const frozenIndex = frozenIndexes[0];
  const journalHasEntityRevocation = revocationIndexes.length === 1;
  if (journalHasEntityRevocation && (revocationIndexes[0] < 1 || revocationIndexes[0] !== frozenIndex - 1)) {
    return denied('SIGN_RECOVERY_JOURNAL_TARGET_SET_INVALID');
  }
  // PRD-last writes place zero or one expected archive first. An entity resign then contributes
  // exactly entity archive + revocation immediately before the new expected frozen target.
  const expectedArchiveCount = frozenIndex - (journalHasEntityRevocation ? 2 : 0);
  if (expectedArchiveCount !== 0 && expectedArchiveCount !== 1) {
    return denied('SIGN_RECOVERY_JOURNAL_TARGET_SET_INVALID');
  }
  return Object.freeze({
    ok: true,
    reason: null,
    exitCode: 0,
    journalHasExpectedArchive: expectedArchiveCount === 1,
    journalHasEntityRevocation,
  });
}

export function resolveSignResignSurface({
  resign = false,
  resignEntityLocks = false,
  hasEntityLocksBundle = false,
  entityLocksExist = false,
  frozenExists = false,
  hasRecoveryJournal = false,
  journalHasExpectedArchive = false,
  journalHasEntityRevocation = false,
} = {}) {
  if (resignEntityLocks && !hasEntityLocksBundle) {
    return denied('ENTITY_LOCK_RESIGN_REQUIRES_BUNDLE', 64);
  }
  if (resignEntityLocks && !resign) return denied('ENTITY_LOCK_RESIGN_REQUIRES_EXPECTED_RESIGN');
  if (hasRecoveryJournal) {
    // An explicit --resign is also legal when the original publication had no old expected file,
    // so the journal can prove an archive requires the flag but cannot infer flag absence from no archive.
    if (journalHasExpectedArchive && !resign) return denied('EXPECTED_RESIGN_RECOVERY_MODE_MISMATCH');
    if (journalHasEntityRevocation !== Boolean(resignEntityLocks)) return denied('ENTITY_LOCK_RESIGN_RECOVERY_MODE_MISMATCH');
    return Object.freeze({
      ok: true, reason: null, exitCode: 0,
      mode: resignEntityLocks ? 'recover-entity-lock-resign' : 'recover-entity-lock-publish',
    });
  }
  if (hasEntityLocksBundle && entityLocksExist && !resignEntityLocks) {
    return denied('ENTITY_LOCK_RESIGN_EXPLICIT_FLAG_REQUIRED');
  }
  if (resignEntityLocks && !entityLocksExist) return denied('ENTITY_LOCK_RESIGN_OLD_LOCK_MISSING');
  if (frozenExists && !resign) return denied('EXPECTED_RESIGN_EXPLICIT_FLAG_REQUIRED');
  return Object.freeze({
    ok: true, reason: null, exitCode: 0,
    mode: resignEntityLocks ? 'entity-lock-resign'
      : hasEntityLocksBundle ? 'entity-lock-first-publish'
        : resign ? 'expected-resign' : 'expected-first-publish',
  });
}

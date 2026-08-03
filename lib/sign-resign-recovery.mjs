// sign 重签归档的共享恢复扫描：只接受 publication journal 已绑定且物理可读的唯一 target/tmp。

import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readPhysicalFileBytes } from './project-artifact-boundary.mjs';
import { publicationEntryForPath } from './sign-publication.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const denied = (reason) => Object.freeze({ ok: false, reason });

export function recoverJournalBoundArtifact({ journal, archiveDir, currentCandidates = [], mapArchiveName, requiredEntry = null } = {}) {
  if (!journal || !Array.isArray(journal.entries) || typeof archiveDir !== 'string' || !archiveDir
    || !Array.isArray(currentCandidates) || typeof mapArchiveName !== 'function') {
    return denied('RESIGN_RECOVERY_INPUT_INVALID');
  }
  const candidates = new Map();
  const admit = (path, text, expectedContentHash = null) => {
    const targetPath = resolve(path);
    const entry = publicationEntryForPath(journal, targetPath);
    if (!entry || typeof text !== 'string' || sha(text) !== entry.contentHash
      || (requiredEntry && (entry.targetHash !== requiredEntry.targetHash || entry.contentHash !== requiredEntry.contentHash))
      || (expectedContentHash != null && sha(text) !== expectedContentHash)) return;
    candidates.set(`${targetPath}\u0000${sha(text)}`, Object.freeze({ path: targetPath, text, entry }));
  };
  for (const candidate of currentCandidates) {
    if (candidate && typeof candidate.path === 'string' && typeof candidate.text === 'string') {
      admit(candidate.path, candidate.text, candidate.expectedContentHash || null);
    }
  }
  let names;
  try { names = existsSync(archiveDir) ? readdirSync(archiveDir) : []; }
  catch { return denied('RESIGN_RECOVERY_ARCHIVE_SCAN_FAILED'); }
  if (names.length > 1000) return denied('RESIGN_RECOVERY_ARCHIVE_SCAN_UNBOUNDED');
  for (const name of names) {
    const mapped = mapArchiveName(name);
    if (!mapped || typeof mapped.targetName !== 'string') continue;
    const storedPath = join(archiveDir, name);
    const physical = readPhysicalFileBytes({ targetPath: storedPath });
    if (!physical.ok) continue;
    admit(join(archiveDir, mapped.targetName), physical.bytes.toString('utf8'), mapped.expectedContentHash || null);
  }
  if (candidates.size !== 1) return denied('RESIGN_RECOVERY_ARTIFACT_NOT_UNIQUE');
  return Object.freeze({ ok: true, reason: null, plan: [...candidates.values()][0] });
}

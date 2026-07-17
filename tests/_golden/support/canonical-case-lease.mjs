// zero-SUT golden 专用 canonical case lease（规范用例目录租约）。
// 只删除本进程排他创建、目录 identity 未变且私有 marker identity/content 均匹配的 case 目录。
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
  rmdirSync,
  writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { CASES_DIR, PROJECT_ROOT } from '../../../lib/paths.mjs';

export const CASE_LEASE_MARKER = '.casey-golden-case-lease.json';
const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;

function identity(stat) {
  return `${stat.dev}:${stat.ino}`;
}

function writeFully(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writeSync(fd, bytes, offset, bytes.length - offset);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('CASE_LEASE_WRITE_INCOMPLETE');
    offset += count;
  }
}

function readMarker(pathname, expectedIdentity) {
  const pathStat = lstatSync(pathname, { bigint: true });
  if (!pathStat.isFile() || pathStat.isSymbolicLink() || pathStat.nlink !== 1n
    || identity(pathStat) !== expectedIdentity || pathStat.size > 4096n) throw new Error('CASE_LEASE_MARKER_CHANGED');
  let fd;
  try {
    fd = openSync(pathname, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = fstatSync(fd, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || identity(stat) !== expectedIdentity || stat.size > 4096n) {
      throw new Error('CASE_LEASE_MARKER_CHANGED');
    }
    const bytes = Buffer.alloc(Number(stat.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!Number.isSafeInteger(count) || count < 1) throw new Error('CASE_LEASE_MARKER_CHANGED');
      offset += count;
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, offset) !== 0) throw new Error('CASE_LEASE_MARKER_CHANGED');
    return bytes.toString('utf8');
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* fail-safe caller handles denial */ }
    }
  }
}

function cleanupOwned(state) {
  if (state.cleaned) return Object.freeze({ ok: true, reason: null, alreadyClean: true });
  try {
    const dirStat = lstatSync(state.caseDir, { bigint: true });
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || identity(dirStat) !== state.dirIdentity
      || resolve(realpathSync(state.caseDir)) !== resolve(state.caseDir)) {
      return Object.freeze({ ok: false, reason: 'CASE_LEASE_DIRECTORY_CHANGED' });
    }
    const raw = readMarker(state.markerPath, state.markerIdentity);
    let marker;
    try { marker = JSON.parse(raw); } catch { return Object.freeze({ ok: false, reason: 'CASE_LEASE_MARKER_CHANGED' }); }
    if (marker?.schemaVersion !== 1
      || marker?.artifactKind !== 'casey-golden-case-lease'
      || marker?.caseId !== state.caseId
      || marker?.leaseId !== state.leaseId
      || marker?.directoryIdentity !== state.dirIdentity) {
      return Object.freeze({ ok: false, reason: 'CASE_LEASE_MARKER_CHANGED' });
    }
    // 父目录在最后一次 identity 对账与 rm 间的 rename race 无跨 OS dirfd 原语，计划中明确 route:human。
    rmSync(state.caseDir, { recursive: true, force: false });
    state.cleaned = true;
    return Object.freeze({ ok: true, reason: null, alreadyClean: false });
  } catch {
    return Object.freeze({ ok: false, reason: 'CASE_LEASE_CLEANUP_REFUSED' });
  }
}

export function acquireCanonicalCaseLease({ caseId } = {}) {
  if (typeof caseId !== 'string' || !CASE_ID_RE.test(caseId)) throw new Error('CASE_LEASE_CASEID_INVALID');
  if (CASES_DIR !== join(PROJECT_ROOT, 'cases')) throw new Error('CASE_LEASE_ROOT_NOT_FIXED');
  const rootStat = lstatSync(CASES_DIR, { bigint: true });
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()
    || resolve(realpathSync(CASES_DIR)) !== resolve(CASES_DIR)) throw new Error('CASE_LEASE_ROOT_UNSAFE');
  const caseDir = join(CASES_DIR, caseId);
  if (existsSync(caseDir)) throw new Error('CASE_LEASE_PREEXISTING');

  let state = null;
  let markerFd;
  try {
    mkdirSync(caseDir, { recursive: false, mode: 0o700 });
    const dirStat = lstatSync(caseDir, { bigint: true });
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) throw new Error('CASE_LEASE_DIRECTORY_UNSAFE');
    const dirIdentity = identity(dirStat);
    const markerPath = join(caseDir, CASE_LEASE_MARKER);
    const leaseId = randomUUID();
    state = { caseId, caseDir, markerPath, leaseId, dirIdentity, markerIdentity: null, cleaned: false };
    markerFd = openSync(
      markerPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0),
      0o600,
    );
    const markerStat = fstatSync(markerFd, { bigint: true });
    if (!markerStat.isFile() || markerStat.nlink !== 1n) throw new Error('CASE_LEASE_MARKER_UNSAFE');
    state.markerIdentity = identity(markerStat);
    const marker = `${JSON.stringify({
      schemaVersion: 1,
      artifactKind: 'casey-golden-case-lease',
      caseId,
      leaseId,
      directoryIdentity: dirIdentity,
    })}\n`;
    writeFully(markerFd, Buffer.from(marker, 'utf8'));
    fsyncSync(markerFd);
    closeSync(markerFd);
    markerFd = undefined;
    return Object.freeze({
      caseId,
      caseDir,
      packageDir: join(caseDir, 'record-capture'),
      markerPath,
      cleanup: () => cleanupOwned(state),
    });
  } catch (error) {
    if (markerFd !== undefined) {
      try { closeSync(markerFd); } catch { /* cleanup below */ }
    }
    if (state?.markerIdentity) cleanupOwned(state);
    else if (state?.dirIdentity) {
      try {
        const current = lstatSync(caseDir, { bigint: true });
        if (current.isDirectory() && !current.isSymbolicLink() && identity(current) === state.dirIdentity) rmdirSync(caseDir);
      } catch { /* pre-marker failure leaves uncertain directory for human */ }
    }
    throw error;
  }
}

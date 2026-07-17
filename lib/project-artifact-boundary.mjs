// 项目 artifact 物理路径边界：拒 symlink ancestor，并以 no-follow fd + dev/inode 绑定最终文件。
// Windows junction/其它 reparse point 的跨类型完备性由真机 route:human；本模块仍执行 Node 可见的同款检查。
import {
  closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const denied = (reason) => Object.freeze({ ok: false, reason });
const allowed = (extra = {}) => Object.freeze({ ok: true, reason: null, ...extra });

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function inspectPath(projectRoot, targetPath, requireTarget) {
  if (typeof projectRoot !== 'string' || !projectRoot || typeof targetPath !== 'string' || !targetPath) {
    return denied('PROJECT_ARTIFACT_PATH_INPUT_INVALID');
  }
  const root = resolve(projectRoot);
  const target = resolve(targetPath);
  if (!inside(root, target) || target === root) return denied('PROJECT_ARTIFACT_LEXICAL_ESCAPE');
  let rootReal;
  try {
    const rootStat = lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return denied('PROJECT_ROOT_NOT_PHYSICAL_DIRECTORY');
    rootReal = realpathSync(root);
  } catch { return denied('PROJECT_ROOT_UNAVAILABLE'); }

  const parent = dirname(target);
  const parentRel = relative(root, parent);
  let cursor = root;
  for (const segment of parentRel.split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return denied('PROJECT_ARTIFACT_ANCESTOR_NOT_PHYSICAL_DIRECTORY');
      if (!inside(rootReal, realpathSync(cursor))) return denied('PROJECT_ARTIFACT_REALPATH_ESCAPE');
    } catch { return denied('PROJECT_ARTIFACT_ANCESTOR_UNAVAILABLE'); }
  }
  try {
    if (!inside(rootReal, realpathSync(parent))) return denied('PROJECT_ARTIFACT_PARENT_REALPATH_ESCAPE');
  } catch { return denied('PROJECT_ARTIFACT_PARENT_UNAVAILABLE'); }

  if (existsSync(target)) {
    try {
      const targetStat = lstatSync(target);
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) return denied('PROJECT_ARTIFACT_TARGET_NOT_PHYSICAL_FILE');
      if (!inside(rootReal, realpathSync(target))) return denied('PROJECT_ARTIFACT_TARGET_REALPATH_ESCAPE');
    } catch { return denied('PROJECT_ARTIFACT_TARGET_INSPECTION_FAILED'); }
  } else if (requireTarget) {
    return denied('PROJECT_ARTIFACT_TARGET_MISSING');
  }
  return allowed({ root, rootReal, target });
}

export function checkProjectOutputBoundary({ projectRoot, targetPath } = {}) {
  return inspectPath(projectRoot, targetPath, false);
}

function openVerified(projectRoot, targetPath, readBytes) {
  let inspection = inspectPath(projectRoot, targetPath, true);
  if (!inspection.ok) return inspection;
  const noFollow = Number.isInteger(constants.O_NOFOLLOW) ? constants.O_NOFOLLOW : 0;
  let fd = null;
  try {
    fd = openSync(inspection.target, constants.O_RDONLY | noFollow);
    const descriptorStat = fstatSync(fd);
    const pathStat = lstatSync(inspection.target);
    // inode（索引节点）/device 双等把已打开 descriptor 与最终路径身份绑定；不只信 realpath 字符串。
    if (!descriptorStat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile()
      || descriptorStat.ino !== pathStat.ino || descriptorStat.dev !== pathStat.dev) {
      return denied('PROJECT_ARTIFACT_INODE_IDENTITY_MISMATCH');
    }
    inspection = inspectPath(projectRoot, targetPath, true);
    if (!inspection.ok) return inspection;
    const bytes = readBytes ? readFileSync(fd) : null;
    return allowed({ bytes, identity: Object.freeze({ ino: descriptorStat.ino, dev: descriptorStat.dev }) });
  } catch {
    return denied('PROJECT_ARTIFACT_NOFOLLOW_OPEN_FAILED');
  } finally {
    if (fd !== null) try { closeSync(fd); } catch { /* 尽力 */ }
  }
}

// archive 允许由 CLI 显式放在项目外，不能套 project containment；但既存 target/.tmp
// 仍必须是 no-follow 打开的物理普通文件，并与路径 lstat 的 dev/inode 同一。
export function readPhysicalFileBytes({ targetPath } = {}) {
  if (typeof targetPath !== 'string' || !targetPath) return denied('PHYSICAL_FILE_PATH_INPUT_INVALID');
  const target = resolve(targetPath);
  const noFollow = Number.isInteger(constants.O_NOFOLLOW) ? constants.O_NOFOLLOW : 0;
  let fd = null;
  try {
    const before = lstatSync(target);
    if (before.isSymbolicLink() || !before.isFile()) return denied('PHYSICAL_FILE_TARGET_NOT_REGULAR');
    fd = openSync(target, constants.O_RDONLY | noFollow);
    const descriptorStat = fstatSync(fd);
    const after = lstatSync(target);
    if (!descriptorStat.isFile() || after.isSymbolicLink() || !after.isFile()
      || descriptorStat.ino !== after.ino || descriptorStat.dev !== after.dev) {
      return denied('PHYSICAL_FILE_INODE_IDENTITY_MISMATCH');
    }
    return allowed({ bytes: readFileSync(fd), identity: Object.freeze({ ino: descriptorStat.ino, dev: descriptorStat.dev }) });
  } catch {
    return denied('PHYSICAL_FILE_NOFOLLOW_OPEN_FAILED');
  } finally {
    if (fd !== null) try { closeSync(fd); } catch { /* 尽力 */ }
  }
}

export function verifyProjectArtifactIdentity({ projectRoot, targetPath } = {}) {
  return openVerified(projectRoot, targetPath, false);
}

export function readProjectArtifactBytes({ projectRoot, targetPath } = {}) {
  return openVerified(projectRoot, targetPath, true);
}

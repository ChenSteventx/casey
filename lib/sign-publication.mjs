// sign 多文件发布事务：journal 可恢复、PRD(authority) 最后到位。
// 逐文件 rename 不是多文件 OS 原子；本模块只保证中断可判定、同输入可续跑、异输入 fail-closed。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { types as utilTypes } from 'node:util';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const ok = (recovered) => Object.freeze({ ok: true, retryable: false, reason: null, recovered });
const denied = (reason, retryable = false) => Object.freeze({ ok: false, retryable, reason });

function record(value, allowed, required = allowed) {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  let descriptors;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch { return null; }
  const allowedSet = new Set(allowed);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== 'string' || !allowedSet.has(key))) return null;
  if (required.some((key) => !Object.hasOwn(descriptors, key))) return null;
  const out = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out[key] = descriptor.value;
  }
  return out;
}

function array(value) {
  if (value == null || (typeof value === 'object' && utilTypes.isProxy(value)) || !Array.isArray(value)) return null;
  let descriptors;
  try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { return null; }
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 1 || length > 100) return null;
  const out = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out.push(descriptor.value);
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) return null;
  }
  return out;
}

const NODE_IO = Object.freeze({
  exists: existsSync,
  read: (path) => readFileSync(path, 'utf8'),
  writeExclusive: (path, text) => writeFileSync(path, text, { encoding: 'utf8', flag: 'wx' }),
  rename: renameSync,
  remove: (path) => rmSync(path, { force: true }),
});

export function createSignPublicationEngine(io = NODE_IO) {
  if (!io || ['exists', 'read', 'writeExclusive', 'rename', 'remove'].some((name) => typeof io[name] !== 'function')) {
    return () => denied('PUBLICATION_IO_INVALID');
  }

  return function publish(rawPlan) {
    const plan = record(rawPlan, ['writes', 'journalPath', 'signedAt', 'authorityPath']);
    const sourceWrites = plan ? array(plan.writes) : null;
    if (!plan || !sourceWrites || typeof plan.journalPath !== 'string' || !plan.journalPath
      || typeof plan.signedAt !== 'string' || !plan.signedAt
      || typeof plan.authorityPath !== 'string' || !plan.authorityPath) {
      return denied('PUBLICATION_PLAN_INVALID');
    }
    const writes = [];
    for (const value of sourceWrites) {
      const row = record(value, ['path', 'text']);
      if (!row || typeof row.path !== 'string' || !row.path || typeof row.text !== 'string') {
        return denied('PUBLICATION_WRITES_INVALID');
      }
      writes.push(Object.freeze({ path: resolve(row.path), text: row.text }));
    }
    const targets = writes.map((row) => row.path);
    const tmps = targets.map((path) => `${path}.tmp`);
    const authorityPath = resolve(plan.authorityPath);
    const journalPath = resolve(plan.journalPath);
    const journalTmp = `${journalPath}.tmp`;
    if (new Set(targets).size !== targets.length || new Set(tmps).size !== tmps.length
      || targets.some((target) => tmps.includes(target))
      || targets.at(-1) !== authorityPath || targets.filter((target) => target === authorityPath).length !== 1
      || [...targets, ...tmps].includes(journalPath) || [...targets, ...tmps].includes(journalTmp)) {
      return denied('PUBLICATION_PATHS_OR_AUTHORITY_ORDER_INVALID');
    }

    const expectedJournal = {
      schemaVersion: 1,
      artifactKind: 'casey-sign-publication',
      signedAt: plan.signedAt,
      authorityTargetHash: sha(authorityPath),
      entries: writes.map((row) => ({ targetHash: sha(row.path), contentHash: sha(row.text) })),
    };
    const journalText = JSON.stringify(expectedJournal) + '\n';
    let recovered = false;
    try {
      const hasJournal = io.exists(journalPath);
      // 没有 journal 就没有可证明的上一轮事务；此时任何预植 target.tmp 都不能当恢复材料。
      if (!hasJournal && tmps.some((path) => io.exists(path))) return denied('PUBLICATION_TMP_WITHOUT_JOURNAL');
      if (hasJournal) {
        recovered = true;
        if (io.exists(journalTmp)) return denied('PUBLICATION_JOURNAL_AND_TMP_COEXIST');
        let existing;
        try { existing = JSON.parse(io.read(journalPath)); } catch { return denied('PUBLICATION_JOURNAL_INVALID'); }
        if (JSON.stringify(existing) !== JSON.stringify(expectedJournal)) return denied('PUBLICATION_INPUT_MISMATCH');
      } else {
        if (io.exists(journalTmp)) return denied('PUBLICATION_JOURNAL_TMP_ORPHANED');
        try {
          io.writeExclusive(journalTmp, journalText);
          io.rename(journalTmp, journalPath);
        } catch {
          try { io.remove(journalTmp); } catch { /* 留给人工审计 */ }
          return denied('PUBLICATION_JOURNAL_PREPARE_FAILED', true);
        }
      }
    } catch {
      return denied('PUBLICATION_JOURNAL_IO_FAILED', true);
    }

    // 先把所有缺失目标写成 tmp；已到位目标只接受逐字节相等。
    for (let index = 0; index < writes.length; index++) {
      const { path, text } = writes[index];
      try {
        if (io.exists(path) && io.read(path) === text) continue;
        if (io.exists(tmps[index])) {
          if (io.read(tmps[index]) !== text) return denied('PUBLICATION_TMP_MISMATCH');
        } else {
          io.writeExclusive(tmps[index], text);
        }
      } catch {
        return denied('PUBLICATION_STAGE_FAILED', true);
      }
    }

    // 调用契约已强制 authorityPath 位于最后；前序中断只留下无本次新 PRD checksum 的内容。
    for (let index = 0; index < writes.length; index++) {
      const { path, text } = writes[index];
      try {
        if (io.exists(path) && io.read(path) === text) {
          if (io.exists(tmps[index])) io.remove(tmps[index]);
          continue;
        }
        io.rename(tmps[index], path);
      } catch {
        return denied('PUBLICATION_COMMIT_INTERRUPTED', true);
      }
    }
    for (const { path, text } of writes) {
      try { if (!io.exists(path) || io.read(path) !== text) return denied('PUBLICATION_FINAL_CHECK_FAILED', true); }
      catch { return denied('PUBLICATION_FINAL_CHECK_FAILED', true); }
    }
    try { io.remove(journalPath); }
    catch { return denied('PUBLICATION_JOURNAL_CLEANUP_FAILED', true); }
    return ok(recovered);
  };
}

export const publishSignPublication = createSignPublicationEngine();

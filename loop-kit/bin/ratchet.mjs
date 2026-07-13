#!/usr/bin/env node
// Test Ratchet 只读反向索引：冻结文件 -> 全部引用 PRD。
// 本工具只消费既有 testChecksums，不修改 PRD、签署元数据或 gate 结论。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHA256 = /^[a-f0-9]{64}$/i;

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function stableIssues(issues) {
  return issues.sort((a, b) => {
    const ka = [a.code, a.file || '', a.prd || '', String(a.referenceIndex ?? '')].join('\0');
    const kb = [b.code, b.file || '', b.prd || '', String(b.referenceIndex ?? '')].join('\0');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeRepoPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) return null;
  const slash = value.replace(/\\/g, '/');
  if (slash.startsWith('/') || /^[A-Za-z]:\//.test(slash)) return null;
  const normalized = posix.normalize(slash);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null;
  if (normalized !== slash) return null;
  return normalized;
}

function isInsideRoot(root, file) {
  const rel = relative(root, file);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !rel.startsWith(sep));
}

function discoverPrds(root) {
  const loopDir = join(root, 'loop');
  if (!existsSync(loopDir)) return [];
  return readdirSync(loopDir)
    .filter((name) => /^prd-[^/]+\.json$/.test(name))
    .sort()
    .map((name) => `loop/${name}`);
}

export function buildRatchetIndex(root = PROJECT_ROOT) {
  const requestedRoot = resolve(root);
  let repoRoot = requestedRoot;
  try { repoRoot = realpathSync.native(requestedRoot); } catch { /* 由下方结构问题 fail-closed */ }
  const files = new Map();
  const issues = [];
  const loopDir = join(repoRoot, 'loop');
  let prds = [];
  try {
    if (!statSync(loopDir).isDirectory()) throw new Error('not-directory');
    if (!isInsideRoot(repoRoot, realpathSync.native(loopDir))) throw new Error('outside-root');
    prds = discoverPrds(repoRoot);
  } catch {
    issues.push({ code: 'LOOP_DIR_INVALID' });
  }
  if (prds.length === 0) issues.push({ code: 'NO_PRDS' });

  for (const prd of prds) {
    const prdAbs = join(repoRoot, ...prd.split('/'));
    let value;
    try {
      if (!statSync(prdAbs).isFile()) throw new Error('not-file');
      if (!isInsideRoot(repoRoot, realpathSync.native(prdAbs))) throw new Error('outside-root');
      value = JSON.parse(readFileSync(prdAbs, 'utf8'));
    } catch {
      issues.push({ code: 'PRD_PARSE_ERROR', prd });
      continue;
    }

    const checksums = value.testChecksums;
    if (checksums === undefined) continue;
    if (!isRecord(checksums)) {
      issues.push({ code: 'TEST_CHECKSUMS_INVALID', prd });
      continue;
    }

    let referenceIndex = 0;
    for (const [rawFile, rawHash] of Object.entries(checksums)) {
      const file = normalizeRepoPath(rawFile);
      if (!file) {
        issues.push({ code: 'UNSAFE_PATH', prd, referenceIndex });
        referenceIndex += 1;
        continue;
      }
      const abs = resolve(repoRoot, ...file.split('/'));
      if (!isInsideRoot(repoRoot, abs)) {
        issues.push({ code: 'UNSAFE_PATH', prd, referenceIndex });
        referenceIndex += 1;
        continue;
      }
      if (typeof rawHash !== 'string' || !SHA256.test(rawHash)) {
        issues.push({ code: 'CHECKSUM_INVALID', prd, file });
        referenceIndex += 1;
        continue;
      }
      if (existsSync(abs)) {
        try {
          if (!isInsideRoot(repoRoot, realpathSync.native(abs))) {
            issues.push({ code: 'FILE_OUTSIDE_ROOT', prd, file });
            referenceIndex += 1;
            continue;
          }
        } catch {
          issues.push({ code: 'FILE_UNREADABLE', prd, file });
          referenceIndex += 1;
          continue;
        }
      }
      const expected = rawHash.toLowerCase();
      if (!files.has(file)) files.set(file, []);
      files.get(file).push({ prd, expected });
      referenceIndex += 1;
    }
  }

  const indexedFiles = {};
  for (const file of [...files.keys()].sort()) {
    const references = files.get(file).sort((a, b) => a.prd < b.prd ? -1 : a.prd > b.prd ? 1 : 0);
    const expectedHashes = [...new Set(references.map((ref) => ref.expected))].sort();
    indexedFiles[file] = {
      prds: references.map((ref) => ref.prd),
      expectedHashes,
      consistent: expectedHashes.length === 1,
      references,
    };
  }

  return {
    schemaVersion: 1,
    prds,
    files: indexedFiles,
    issues: stableIssues(issues),
  };
}

export function verifyRatchet(root = PROJECT_ROOT) {
  const requestedRoot = resolve(root);
  let repoRoot = requestedRoot;
  try { repoRoot = realpathSync.native(requestedRoot); } catch { /* buildRatchetIndex 产生结构问题 */ }
  const index = buildRatchetIndex(repoRoot);
  const issues = [...index.issues];
  let referenceCount = 0;

  for (const [file, entry] of Object.entries(index.files)) {
    referenceCount += entry.references.length;
    if (!entry.consistent) {
      issues.push({
        code: 'CONFLICTING_EXPECTATIONS',
        file,
        prds: entry.prds,
        expectedHashes: entry.expectedHashes,
      });
    }
    const abs = resolve(repoRoot, ...file.split('/'));
    if (!existsSync(abs)) {
      issues.push({ code: 'FILE_MISSING', file, prds: entry.prds });
      continue;
    }
    let actual;
    try {
      if (!statSync(abs).isFile()) throw new Error('not-file');
      if (!isInsideRoot(repoRoot, realpathSync.native(abs))) {
        issues.push({ code: 'FILE_OUTSIDE_ROOT', file, prds: entry.prds });
        continue;
      }
      actual = sha256File(abs);
    } catch {
      issues.push({ code: 'FILE_UNREADABLE', file, prds: entry.prds });
      continue;
    }
    for (const ref of entry.references) {
      if (ref.expected !== actual) {
        issues.push({ code: 'CHECKSUM_MISMATCH', file, prd: ref.prd, expected: ref.expected, actual });
      }
    }
  }

  stableIssues(issues);
  return {
    schemaVersion: 1,
    ok: issues.length === 0,
    summary: {
      prdCount: index.prds.length,
      frozenFileCount: Object.keys(index.files).length,
      referenceCount,
      issueCount: issues.length,
    },
    issues,
  };
}

export function findAffectedPrds(index, changedFiles) {
  const normalized = [];
  for (const raw of changedFiles || []) {
    const file = normalizeRepoPath(raw);
    if (!file) throw new Error('affected: --file 须为仓库内规范相对路径');
    normalized.push(file);
  }
  const files = [...new Set(normalized)].sort();
  const prds = new Set();
  const untracked = [];
  for (const file of files) {
    const entry = index.files[file];
    if (!entry) {
      untracked.push(file);
      continue;
    }
    for (const prd of entry.prds) prds.add(prd);
  }
  return {
    schemaVersion: 1,
    complete: index.issues.length === 0,
    files,
    prds: [...prds].sort(),
    untracked,
    issues: index.issues,
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { root: PROJECT_ROOT, json: false, files: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--root' && rest[i + 1]) opts.root = resolve(rest[++i]);
    else if (arg === '--file' && rest[i + 1]) opts.files.push(rest[++i]);
    else throw new Error('用法错误');
  }
  return { command, opts };
}

function printHuman(command, result) {
  if (command === 'index') {
    const shared = Object.values(result.files).filter((entry) => entry.prds.length > 1).length;
    console.log(`ratchet index: ${result.prds.length} PRD / ${Object.keys(result.files).length} 冻结文件 / ${shared} 共享文件`);
    for (const issue of result.issues) console.log(`RED ${issue.code} ${issue.prd || issue.file || ''}`.trim());
    return;
  }
  if (command === 'affected') {
    console.log(`ratchet affected: ${result.complete ? 'COMPLETE' : 'INCOMPLETE'} -- ${result.files.length} 文件 -> ${result.prds.length} PRD`);
    for (const prd of result.prds) console.log(prd);
    for (const file of result.untracked) console.log(`untracked ${file}`);
    for (const issue of result.issues) console.log(`RED ${issue.code} ${issue.prd || issue.file || ''}`.trim());
    return;
  }
  console.log(`ratchet verify: ${result.ok ? 'GREEN' : 'RED'} -- ${result.summary.prdCount} PRD / ${result.summary.frozenFileCount} 冻结文件 / ${result.summary.issueCount} 问题`);
  for (const issue of result.issues) console.log(`RED ${issue.code} ${issue.file || issue.prd || ''}`.trim());
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    if (!['index', 'verify', 'affected'].includes(parsed.command)) throw new Error('用法错误');
    if (parsed.command === 'affected' && parsed.opts.files.length === 0) throw new Error('用法错误');
  } catch {
    console.error('用法: ratchet <index|verify|affected> [--root <repo>] [--file <path> ...] [--json]');
    process.exit(64);
  }

  let result;
  try {
    if (parsed.command === 'verify') result = verifyRatchet(parsed.opts.root);
    else {
      const index = buildRatchetIndex(parsed.opts.root);
      result = parsed.command === 'index' ? index : findAffectedPrds(index, parsed.opts.files);
    }
  } catch {
    console.error('ratchet: 无法读取仓库或输入不安全');
    process.exit(64);
  }

  if (parsed.opts.json) console.log(JSON.stringify(result, null, 2));
  else printHuman(parsed.command, result);
  // 让 stdout 在管道/MCP 子进程中自然排空；process.exit() 会截断尚未刷出的 JSON。
  if (parsed.command === 'verify') process.exitCode = result.ok ? 0 : 1;
  if (parsed.command === 'index') process.exitCode = result.issues.length === 0 ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

#!/usr/bin/env node
// SECURITY: 先静态确认 tombstone，才允许 spawn；绝不执行旧 unsafe body。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RECEIPT_PATH = join(ROOT, 'tests/_golden/fixtures/observation-runtime-trust-root/security-revocation.json');
const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
const MARKER = 'SECURITY_REVOKED_GOLDEN_TOMBSTONE';
let passed = 0;
const failures = [];
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function identity(stat) { return `${stat.dev}:${stat.ino}`; }
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}

check('revocation receipt explicitly says revoked, not PASS', () => {
  if (receipt.ratchetStatus !== 'security-revoked-not-pass' || receipt.revoked?.length !== 2) {
    throw new Error('security revocation receipt 语义不闭合');
  }
});

const tombstones = [];
const archives = [];
check('old executable paths are safe fail-fast tombstones and archives preserve bytes', () => {
  for (const entry of receipt.revoked) {
    const executable = join(ROOT, entry.executablePath);
    const archive = join(ROOT, entry.archivePath);
    const source = readFileSync(executable, 'utf8');
    // 此判断失败时立即返回，绝不 spawn 旧 body。
    if (!source.includes(MARKER)) throw new Error(`${entry.executablePath} 尚未 tombstone；拒绝执行`);
    if (/from ['"]node:fs['"]|require\(['"](?:node:)?fs['"]\)|\b(?:rmSync|rmdirSync|unlinkSync|writeFileSync|renameSync)\s*\(/.test(source)) {
      throw new Error(`${entry.executablePath} tombstone 含 filesystem 写删能力`);
    }
    if (!existsSync(archive)) throw new Error(`${entry.archivePath} 不存在`);
    const container = JSON.parse(readFileSync(archive, 'utf8'));
    if (container?.schemaVersion !== 1 || container?.artifactKind !== 'revoked-golden-byte-archive'
      || container?.originalPath !== entry.executablePath || container?.decodedSha256 !== entry.originalSha256
      || typeof container?.originalBase64 !== 'string') throw new Error(`${entry.archivePath} 容器形状/绑定错误`);
    const decoded = Buffer.from(container.originalBase64, 'base64');
    if (decoded.toString('base64') !== container.originalBase64 || sha(decoded) !== entry.originalSha256) {
      throw new Error(`${entry.archivePath} 未保留原始 bytes/hash`);
    }
    tombstones.push(executable);
    archives.push(archive);
  }
});

if (tombstones.length === 2 && archives.length === 2) {
  check('archives refuse node execution; archives and tombstones preserve canonical leased case', () => {
    const lease = acquireCanonicalCaseLease({ caseId: 'tc_observation_driver_provenance' });
    try {
      const sentinel = join(lease.caseDir, 'user-sentinel.txt');
      writeFileSync(sentinel, 'must-survive\n');
      const dirIdentity = identity(statSync(lease.caseDir, { bigint: true }));
      for (const script of [...archives, ...tombstones]) {
        const result = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
        if (result.error || result.status === 0) throw new Error(`${script} 未 fail-fast nonzero`);
        if (!existsSync(sentinel) || readFileSync(sentinel, 'utf8') !== 'must-survive\n'
          || identity(statSync(lease.caseDir, { bigint: true })) !== dirIdentity) {
          throw new Error(`${script} 改动/删除 canonical case`);
        }
      }
    } finally {
      const cleaned = lease.cleanup();
      if (!cleaned.ok) throw new Error(`lease cleanup refused: ${cleaned.reason}`);
    }
  });
}

if (failures.length) {
  console.error(`\nobservation unsafe golden revocation: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nobservation unsafe golden revocation: ${passed}/3 passed`);

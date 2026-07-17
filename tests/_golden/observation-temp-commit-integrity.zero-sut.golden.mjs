#!/usr/bin/env node
// zero-SUT：ledger temp rename 前必须重开同 inode 并完整比对 expected bytes/hash。
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_FILE = fileURLToPath(new URL('../../lib/teachin-observation-authority-root.mjs', import.meta.url));
const source = readFileSync(ROOT_FILE, 'utf8');
let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function identity(stat) { return `${stat.dev}:${stat.ino}`; }
function hash(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }

const api = await import('../../lib/teachin-observation-authority-root.mjs');
check('production exports exact final-temp verifier', () => {
  if (typeof api.verifyLedgerTempCommitBytes !== 'function') throw new Error('缺 verifyLedgerTempCommitBytes');
});

check('same inode tamper is rejected without target pollution', () => {
  const root = mkdtempSync(join(tmpdir(), 'casey-ledger-temp-integrity-'));
  try {
    const tempPath = join(root, 'intake-ledger.jsonl.1.tmp');
    const targetPath = join(root, 'intake-ledger.jsonl');
    const expected = Buffer.from('{"committed":true}\n', 'utf8');
    writeFileSync(tempPath, expected);
    const expectedIdentity = identity(statSync(tempPath, { bigint: true }));
    const clean = api.verifyLedgerTempCommitBytes({
      tempPath, expectedIdentity, completeBytes: expected, completeSha256: hash(expected),
    });
    if (clean?.ok !== true || clean.sha256 !== hash(expected)) throw new Error('clean final temp 未通过');
    writeFileSync(tempPath, Buffer.from('{"tampered":true}\n', 'utf8'));
    let rejected = false;
    try {
      api.verifyLedgerTempCommitBytes({
        tempPath, expectedIdentity, completeBytes: expected, completeSha256: hash(expected),
      });
    } catch { rejected = true; }
    if (!rejected) throw new Error('同 inode 内容篡改未拒');
    try { statSync(targetPath); throw new Error('正式 ledger 被污染'); } catch (error) {
      if (error.message === '正式 ledger 被污染') throw error;
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

check('commit invokes full verifier immediately before rename', () => {
  const renameAt = source.indexOf('renameSync(tempPath, ledgerPath)');
  const verifyAt = source.lastIndexOf('verifyLedgerTempCommitBytes(', renameAt);
  const closeAt = source.lastIndexOf('closeSync(tempFd)', renameAt);
  if (renameAt < 0 || verifyAt < 0 || closeAt < 0 || !(closeAt < verifyAt && verifyAt < renameAt)) {
    throw new Error('final verifier 未位于 close 后 rename 前');
  }
  const between = source.slice(verifyAt, renameAt);
  if (!between.includes('completeBytes') || !between.includes('completeSha256')) {
    throw new Error('commit 未传完整 expected bytes/hash');
  }
});

if (failures.length) {
  console.error(`\nobservation temp commit integrity: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nobservation temp commit integrity: ${passed}/3 passed`);

